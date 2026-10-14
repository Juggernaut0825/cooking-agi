# 上线以后：请求、故障和反馈怎么接起来

**中文** · [English](serving-and-feedback.en.md)

> 原创教学拆解 · 核对：2026-10-11。沿用资料搜索产品；时间和流量都是假设，不是线上测量。

模型离线表现不错，用户却说不好用。可能是模型答错，也可能是结果来得太晚、权限过滤后没剩几篇，或者看到的是旧索引。先让一次请求可以被追踪，再讨论要不要重新训练。

## 1 · 入口：接收请求，也决定是否接收 {#entry}

客户端传 query、可选图片、request ID 等；服务端解析身份和授权，验证大小、类型、长度，再设置 deadline。不要让“最多输出多少 token”和“整个请求最多等多久”混成一个参数。

过载时不能无限排队。限流、队列上限、超时和重试要一起设计：一次超时被客户端重试三次，如果旧请求仍在 GPU 上运行，压力会更大。纯查询可以用幂等标识去重或合并；带外部副作用的工具更要单独设计幂等与确认。

## 2 · 候选：先保证能看，再考虑排多高 {#retrieval}

多路检索可以并行：关键词、文本向量、可选的图文向量各返回候选 ID、分数、来源、版本。先按明确规则去重、过滤和融合，再重排。不同 encoder 的余弦、BM25 和概率分数不可不经处理直接相加。

尽量让权限参与候选资格约束；若后过滤，必须处理过滤后不足 k 条的情况。最终取文档时再核验权限与当前版本，不能相信数小时前写入 index 的 ACL 永远有效。

| 故障 | 可考虑的退路 | 不可省的检查 |
| --- | --- | --- |
| 向量服务超时 | 只用关键词结果 | 标记降级，不伪装成完整融合结果 |
| reranker 超时 | 返回初排结果 | 保持权限、去重与基本资格过滤 |
| 新 encoder 与 index 不兼容 | 使用完整旧版本组合 | 不能只为了继续返回而混用向量空间 |
| 授权服务不可用 | 按预先约定拒绝，或只返回可证明公开的内容 | 不能把安全检查当成可选性能优化 |

## 3 · 生成：引擎解决执行，不保证证据正确 {#generation}

需要摘要时，应用服务选出允许使用的文档、保留引用 ID，并构造 prompt。vLLM / SGLang 接手排队、KV 与生成。文档里的指令仍是不可信内容，不能因为进入 prompt 就获得工具权限。

<figure class="worked-update" lang="zh-CN">
<ol>
<li><small>01 / 上下文</small><strong>带着版本和引用交接</strong><span>记录究竟选了哪些段落，长上下文预算下删了什么。不要只记录 query。</span></li>
<li><small>02 / 生成</small><strong>跟踪等待与输出</strong><span>分别观察排队、prefill、首 token、持续 decode；用户取消后传播 abort。</span></li>
<li><small>03 / 返回</small><strong>检查答案，保留退路</strong><span>验证引用存在与证据支持；缺依据时可只返回来源或说明无法回答。</span></li>
</ol>
<figcaption>结构化输出可以帮助格式校验，但“有 citations 字段”不代表引用支持答案。生成完成也不是整个请求验收完成。</figcaption>
</figure>

Streaming 还需要决定哪些内容能即时展示、哪些需先完成检查。如果已经把不该展示的内容流给用户，之后再过滤最终字符串无法撤回。具体边界取决于产品风险，不是所有回答都必须等全部生成、检查完再一次性返回。

## 4 · 延迟：优化用户真的在等的部分 {#latency}

以不生成摘要的搜索请求为例，假设一条串行路径：入口 20 ms、query 编码 30 ms、检索 80 ms、重排 60 ms、返回 30 ms，共 220 ms。若预算 250 ms，就还剩 30 ms 余量。这是一条请求的教学分解，**各服务的 p95 不能这样相加就当成端到端 p95**；并行步骤也要按关键路径算。

再假设一个请求总共 500 ms，其中模型计算 300 ms，其余 200 ms。把模型部分加速 3 倍，总时间变成 $200+300/3=300$ ms，端到端只快 $500/300\approx1.67$ 倍。

```python
def end_to_end_speedup(total_ms, accelerated_ms, factor):
    import math
    if not all(math.isfinite(value) for value in (total_ms, accelerated_ms, factor)):
        raise ValueError("expected finite values")
    if total_ms <= 0 or not 0 <= accelerated_ms <= total_ms or factor <= 0:
        raise ValueError("invalid timing or speed factor")
    new_ms = total_ms - accelerated_ms + accelerated_ms / factor
    return total_ms / new_ms


assert abs(end_to_end_speedup(500, 300, 3) - 5 / 3) < 1e-12
```

还要看负载。系统越接近容量上限，排队可能越明显；拿轻载单请求速度乘一个系数，不能推导出高并发尾延迟。详细对照方案见[生成引擎压测](../../06-systems/inference-frameworks.md#benchmark)。

## 5 · 发布：先确认换的是一个兼容版本 {#release}

发布前先做 artifact 校验和固定输入回归，再考虑 shadow 或 canary。Shadow 可以对照输出和性能，但不能拿它的“影子结果”当成用户真实反应；有副作用的工具不能随便执行两遍。Canary 让部分真实流量使用新版本，需预先定义停机或回滚门槛。

模型、processor、prompt、ranking 配置和 index 不一定每次全部更新，但被改变的依赖关系要在 release manifest 里明确。回滚时恢复兼容组合，处理缓存版本隔离，确认旧版本仍然有容量。

小项目不必先建复杂实验平台。至少保留旧产物、一个可切换指针、一份对照输入和一次真实演练过的回滚步骤。仅在 README 写“可回滚”，还不算验证。

## 6 · 监控：别把所有下降都叫 drift {#monitoring}

| 观察层 | 看哪些信号 | 例子 |
| --- | --- | --- |
| 服务健康 | 错误率、队列、超时、取消清理 | GPU 已空闲，但请求卡在 tokenization |
| 数据健康 | 缺字段、解析失败、freshness、来源比例 | 新版 PDF parser 漏掉表格 |
| 模型质量 | 相关性、拒答、支持性、切片表现 | 总分不变，但中文长文档退化 |
| 产品结果 | 任务完成、满意反馈、真实使用成本 | 更长回答看着完整，却更难找到答案 |

输入分布变了可能只是新用户来了；指标下降也可能是埋点故障。先核对测量与 pipeline，再判断是否 retrain。对于延迟标签，早期监控可以用代理信号，但最终判断仍需成熟标签和稳定定义。

## 7 · 反馈：留下当时看到的结果 {#feedback}

一次点击至少应能关联到 request、展示列表与位置、实际模型 / index 版本、曝光时间和实验分组。只存“用户点了文档 X”，以后很难知道他当时还能选什么、是不是新版本带来的变化。

必要时抽样记录线上实际使用的特征或可重建它们的版本，核对训练和 serving 的差异。[Google 的 Rules of ML](https://developers.google.com/machine-learning/guides/rules-of-ml)专门讨论 training-serving skew 与反馈循环。采集范围仍需最小化，并遵守授权和删除期限。

下一轮数据不能自动把“模型展示过、用户点过”的东西全部当作唯一真值，否则旧模型没展示的资料会越来越没机会被学习。需要适合任务的标注、探索或审计方案；单纯加大日志量不会消除选择偏差。

## 8 · 出了问题，沿边界找，而不是相互甩锅 {#incident}

| 用户现象 | 第一条要查的证据 | 需要共同参与的模块 |
| --- | --- | --- |
| 搜不到新资料 | ingestion 到 index 的 revision 链 | 数据、编码、索引 |
| 相关资料突然排很后 | query / document encoder 与 ranking 版本 | 模型、搜索、发布 |
| 搜到了，但摘要说错 | 实际上下文、引用、生成配置 | 检索、应用、模型 |
| 偶尔等很久 | 同一个 trace 的队列与分段时间 | 应用、推理、平台 |
| 已删除资料又出现 | tombstone、index、cache 与权限检查记录 | 数据、服务、安全 |

每个模块可以由不同团队负责，但整条请求要有明确的服务 owner 来组织排查。对个人来说，最实用的全链路理解是：能把自己这层的问题定位清楚，也能带着输入、版本和 trace 与上下游沟通。

进一步动手可以选[推荐系统](../recommender-systems/README.md)、[RAG](../rag/README.md)或[后训练实验](../post-training/README.md)，不用一次把所有方向都做完。
