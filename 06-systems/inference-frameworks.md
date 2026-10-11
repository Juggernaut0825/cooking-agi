# vLLM 和 SGLang：生成引擎在忙什么？

**中文** · [English](inference-frameworks.en.md)

> 核对：2026-10-11 · 机制对照 vLLM V1 与 SGLang 的公开实现。下面的数字是教学算例，没有跑框架性能排名。

一个模型用 `generate()` 能回答问题，为什么还需要 vLLM 或 SGLang？因为服务里不只有一个人在问：长短请求一起进来，有人中途关闭窗口，也有人反复问同一份文档。引擎要安排这些工作，而不是每来一条请求就从头独占 GPU。

先会 [prefill、decode 和 KV cache](../00-foundations/deep-dives/kv-cache-and-inference.md)即可。想逐步跟代码，配合[一次请求怎样跑完](llm-serving.md)；这篇重点看架构关系和选型。

## 从应用到算子，中间隔着几层 {#layers}

<figure class="worked-update" lang="zh-CN">
<ol>
<li><small>01 / 应用服务</small><strong>决定要做什么</strong><span>鉴权、检索、工具、prompt 与超时预算。用户无权读取的资料，不能交给模型再指望它保密。</span></li>
<li><small>02 / 生成引擎</small><strong>安排谁先算、复用什么</strong><span>排队、组 batch、管理 KV、调度 worker、采样和输出；这里才是 vLLM / SGLang 的位置。</span></li>
<li><small>03 / 运行与算子</small><strong>把当前这批计算完成</strong><span>模型执行、attention kernel、矩阵乘法、跨卡通信。更快的 kernel 不一定能消除前面的排队。</span></li>
</ol>
<figcaption>这是职责划分，不要求每一层对应一个独立进程，也不代表引擎承担完整的生产安全边界。</figcaption>
</figure>

[vLLM V1 的架构文档](https://docs.vllm.ai/en/v0.21.0/design/arch_overview/)区分 API server、engine core 与 GPU workers：前者处理输入输出，中间组织调度与缓存，后者执行模型。具体进程数量随部署而变。SGLang 也有自己的请求处理、调度与模型执行路径，不要把 vLLM 的类名原封不动套过去。

更具体地看，[SGLang 固定版本的 Engine](https://github.com/sgl-project/sglang/blob/436d73ddda02d17d6d56e770a5362ebd5dd95ac0/python/sglang/srt/entrypoints/engine.py#L237)把 tokenization、调度与 detokenization 分开：

```text
请求 → TokenizerManager → Scheduler → 模型执行
        ↑                                ↓
     返回文本 ← DetokenizerManager ← 输出 token IDs
```

TokenizerManager 管输入与请求结果，Scheduler 决定当前批次，执行路径完成 forward，DetokenizerManager 把 token 转回文本。图里省略了多卡拓扑与跨实例路由，不是在承诺每次部署都只有三个进程。这个拆法也帮你排错：GPU 没满、请求却很慢时，可以检查输入处理和输出回传，而不只盯着 attention kernel。

## 为什么请求结束一个，就能补进一个 {#batching}

只看一个理想化 decode 算例：两条已完成 prefill 的请求 A、B，还需生成 2、5 个 token。第三条 C 已准备好，还需 3 个。每轮最多放两条、各生成一个 token，忽略所有额外成本。

| 轮次 | 等整批结束才补位 | 每轮可补位 |
| --- | --- | --- |
| 1–2 | A、B | A、B |
| 3–5 | B，另一个位置空着 | B、C |
| 6–8 | C | 已结束 |

从 8 轮到 5 轮，是这个假设下的排程差别，不是实测加速比。真实 prefill、KV 容量和长上下文读写都要计入。Continuous batching 也不是让所有请求同时进来：超出预算时仍要排队、限流或拒绝。

## vLLM 和 SGLang 的缓存怎么理解 {#prefix}

两者都能做前缀复用，不能简单说“vLLM 管显存，SGLang 才管 cache”。可以比较的是组织方式与具体配置：

| 观察点 | vLLM V1 | SGLang 的 RadixCache 路径 |
| --- | --- | --- |
| 怎么组织可复用前缀 | 带前缀关系的块哈希与 block pool | 用树表示共同的 token 路径 |
| 复用边界 | 对照版本按完整 KV blocks 缓存 | 与 page size 等配置有关，不总是单 token |
| 生命周期 | 引用、空闲块、驱逐与重新分配 | 锁定、引用、节点拆分与驱逐等机制 |
| 不能直接推出什么 | 块组织不等于整个服务更快 | 树组织不等于任意 workload 都更快 |

实现细节可对照已有的[缓存生命周期与页对齐算例](../00-foundations/deep-dives/attention-kernels.md#cache-lifecycle)，其中固定了 vLLM 与 SGLang 源码版本。[SGLang 原论文](https://arxiv.org/abs/2312.07104)解释了 RadixAttention 的背景；不要把论文发表时的功能边界当成今天的完整产品对比。

例如两个请求共享一份 2,000-token 说明，后面各有 100-token 问题。第二条请求可能少做共同前缀的 prefill，但生成新答案时依然需要使用前缀 KV。省的是重复计算，不是把历史从 attention 里删除。权重、adapter、token IDs、位置与多模态输入也必须兼容；“人看起来文字一样”不是充分条件。

多租户还要设计隔离。共同前缀带来的时间差可能泄露缓存是否命中，不能把缓存机制当成权限机制。[vLLM 的 cache salt 说明](https://docs.vllm.ai/en/v0.21.0/design/prefix_caching/)提供了一种复用隔离手段；服务端仍要决定可信分组，不能任由客户端声称自己属于别人的组。

## HiCache：显存以外，也能存 KV {#hicache}

[SGLang HiCache](https://docs.sglang.io/docs/advanced_features/hicache_design)把 KV 放在 GPU、主机内存及存储后端等层次。GPU / 主机层归推理实例使用；跨实例共享要看存储后端及 namespace 的实际配置，不能把两台机器的 RAM 当成天然共享池。

拿一笔假设成本判断：重算某段 prefill 需要 80 ms；把它的 KV 搬回 GPU 要 30 ms，查找与调度另需 5 ms，那复用有机会省约 45 ms。如果传输变成 100 ms，这次复用反而可能更慢。这里把各项按串行相加，只是解释取舍；实际异步重叠要用 trace 测。

所以除了 hit rate，还要看命中的 token 数、搬运量、恢复耗时，以及不命中时额外付了多少代价。很多短前缀命中，未必比少数长前缀命中更有用。

## 再加速之前，先定位瓶颈 {#bottlenecks}

| 现象 | 先看什么 | 可以比较的方案 | 可能付出的代价 |
| --- | --- | --- | --- |
| 首 token 等很久 | 排队、tokenization、prefill、缓存命中 | chunked prefill、前缀复用、更多副本 | TTFT 与 ITL 取舍；额外显存 |
| 连续输出卡顿 | decode 批量、KV 读写、资源争抢 | 调度预算、量化、算子、拆分 prefill/decode | 质量、传输或运维复杂度 |
| 模型放不下 | 权重、KV、workspace 分别多大 | 量化、TP / PP | 跨卡通信与硬件支持 |
| JSON 常不合法 | 是否真的启用了输出约束 | 结构化解码与校验 | 格式合法仍不代表内容正确 |
| 使用了推测解码却更慢 | 草拟成本、接受率、验证 batch | 改草拟方法或关闭 | 辅助状态和验证开销 |

两套引擎的模型支持、量化、结构化输出、并行与 speculative decoding 都在变。比较的是**固定版本、模型、硬件和功能组合**，不是记住“Agent 选这个，高并发选那个”。FSDP 属于[训练状态分片](training-frameworks.md)，不是这张表里另一个生成引擎。

## 跑一个有意义的对照 {#benchmark}

不要只发一条“你好”。准备短问答、长文档、多轮共同前缀、突发流量，以及取消请求；记录输入和实际输出长度分布。各组固定权重、tokenizer、聊天模板、采样与硬件，单列冷启动和预热后的结果。

| 要报告什么 | 为什么 |
| --- | --- |
| TTFT、ITL、端到端 p50 / p95 / p99 | 平均吞吐掩盖不了用户等待；短输出也要计入 TTFT |
| 输入吞吐与输出吞吐，分别统计 | 两种 token 的计算含义不同 |
| 满足质量和延迟要求的请求数 / 秒 | 大量超时换来的总吞吐没有同等价值 |
| 超时、取消、拒绝、OOM、错误率 | 不能只统计成功返回的请求 |
| GPU / CPU 内存、网络流量、总成本 | 有时瓶颈已经移出 GPU |

开放到达的压测按计划持续发送，更容易看出排队积压；闭环压测会等前一条完成，系统变慢时实际到达量也会下降。两种都能用，但要说清是哪一种、发了多少、实际完成多少。相同 seed 也不保证不同引擎、batch 或 kernel 的生成逐字一致；另做质量与格式回归。

选型结果应该是一份可重复的记录：版本、配置、输入集、结果和失败样本。接下来读[上线与反馈](../practice/ml-system/serving-and-feedback.md)，看这个引擎怎么接进完整服务。
