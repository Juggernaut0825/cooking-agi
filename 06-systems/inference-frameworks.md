# vLLM 和 SGLang：生成引擎在忙什么？

**中文** · [English](inference-frameworks.en.md)

> 核对：2026-10-12 · 对照 vLLM v0.31.0（2026-10-05）与 SGLang v0.5.21（2026-10-02）的文档；源码链接固定到 2026-10-10 的 main commit。下面的数字是教学算例，没有跑框架性能排名。

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

[vLLM V1 的架构文档](https://docs.vllm.ai/en/v0.31.0/design/arch_overview/)区分 API server、engine core 与 GPU workers：前者处理输入输出，中间组织调度与缓存，后者执行模型；开数据并行时还会多一个 DP coordinator。具体进程数量随部署而变。SGLang 也有自己的请求处理、调度与模型执行路径，不要把 vLLM 的类名原封不动套过去。

更具体地看，[SGLang 固定版本的 Engine](https://github.com/sgl-project/sglang/blob/436d73ddda02d17d6d56e770a5362ebd5dd95ac0/python/sglang/srt/entrypoints/engine.py#L238)把 tokenization、调度与 detokenization 分开：

```text
请求 → TokenizerManager → Scheduler → 模型执行
        ↑                                ↓
     返回文本 ← DetokenizerManager ← 输出 token IDs
```

TokenizerManager 管输入与请求结果，Scheduler 决定当前批次，执行路径完成 forward，DetokenizerManager 把 token 转回文本。图里省略了多卡拓扑与跨实例路由，不是在承诺每次部署都只有三个进程。这个拆法也帮你排错：GPU 没满、请求却很慢时，可以检查输入处理和输出回传，而不只盯着 attention kernel。

## 把两套实现放在同一张图里 {#engine-map}

先沿左边读一次 vLLM，再沿右边看 SGLang。箭头旁写的是交接内容：不是把完整模型或整个 KV cache 在每层之间来回复制。图只画普通自回归文本生成的主要职责；多模态和推测解码会有分支。图按一步一步画，但两边默认都让 CPU 排下一轮时 GPU 同时算这一轮（vLLM 叫 async scheduling，SGLang 叫 overlap scheduler）。

<figure class="engine-map" lang="zh-CN">
<div class="engine-map__lanes">
<section aria-label="vLLM 请求链路"><h3>vLLM V1</h3><ol>
<li><strong>API server / AsyncLLM</strong><span>校验、整理输入，追踪请求与流式输出</span><small>↓ token IDs、采样参数、request ID</small></li>
<li><strong>EngineCore → Scheduler</strong><span>队列、计算预算、KV block 分配</span><small>↓ SchedulerOutput：请求更新、token 数与 block IDs</small></li>
<li><strong>Executor → GPU workers</strong><span>把调度结果交给持有模型分片的 worker</span><small>↓ SchedulerOutput → worker 内的 model runner</small></li>
<li><strong>Model runner → kernels</strong><span>准备输入张量与 attention 元数据，再执行模型、KV 读写与采样</span><small>↑ 输出 token / 执行结果，回到调度与输出端</small></li>
</ol></section>
<section aria-label="SGLang 请求链路"><h3>SGLang SRT</h3><ol>
<li><strong>HTTP → TokenizerManager</strong><span>输入处理、请求状态、结果返回</span><small>↓ tokenized request</small></li>
<li><strong>Scheduler + cache / pools</strong><span>等待与运行请求、前缀匹配、缓存位置</span><small>↓ ScheduleBatch；worker 内转成 ForwardBatch</small></li>
<li><strong>模型 worker → ModelRunner</strong><span>执行 scheduler 安排的批次；不是额外独立服务</span><small>↓ 模型输入张量与 attention 元数据</small></li>
<li><strong>Model → attention backend</strong><span>运行算子、更新 KV，输出结果经 detokenizer 返回</span><small>↑ DetokenizerManager → TokenizerManager</small></li>
</ol></section>
</div>
<figcaption>未结束的请求继续下一轮。两列是职责对照，不是一一对应的进程图；特别是 SGLang 的 ModelRunner 属于 scheduler 的执行路径，不能凭一个框就给它增加独立进程。</figcaption>
</figure>

vLLM 的进程边界可查[官方架构](https://docs.vllm.ai/en/v0.31.0/design/arch_overview/)，执行入口可跟 [EngineCore](https://github.com/vllm-project/vllm/blob/10cc2f6ae2c9ba7cc5841ece95e27d0562aef1bf/vllm/v1/engine/core.py)。它把 `SchedulerOutput` 交给 executor；worker 里的 model runner 再结合本地请求状态准备 token、位置与 attention 元数据，不是由调度器提前拼好全部模型输入张量。这一版默认用 [Model Runner V2](https://github.com/vllm-project/vllm/blob/10cc2f6ae2c9ba7cc5841ece95e27d0562aef1bf/vllm/v1/worker/gpu/model_runner.py)，配置里有它还不支持的功能时，才退回旧的 [GPUModelRunner](https://github.com/vllm-project/vllm/blob/10cc2f6ae2c9ba7cc5841ece95e27d0562aef1bf/vllm/v1/worker/gpu_model_runner.py)。SGLang 这条路径核对到固定 commit：从 [Scheduler.run_batch](https://github.com/sgl-project/sglang/blob/436d73ddda02d17d6d56e770a5362ebd5dd95ac0/python/sglang/srt/managers/scheduler.py#L4405)，到 [worker 的批次转换与 forward](https://github.com/sgl-project/sglang/blob/436d73ddda02d17d6d56e770a5362ebd5dd95ac0/python/sglang/srt/managers/tp_worker.py#L598)，再到 [ModelRunner](https://github.com/sgl-project/sglang/blob/436d73ddda02d17d6d56e770a5362ebd5dd95ac0/python/sglang/srt/model_executor/model_runner.py)。这些是阅读坐标，不是要求背下类名。

假设 request R 有 6 个 prompt token，其中前 4 个对应可复用的完整缓存块。Scheduler 不能简单说“命中了就结束”：它还要确认复用有效、剩余 2 个 token 有位置可写、本轮有预算。算完后采样出第一个新 token X；**这不表示 X 的 KV 已经写好了**。下一轮把 X 作为输入，才会生成它自己的 KV，再预测下一个 token。全前缀命中时如何得到下一 token 的 logits，还要看具体实现是否需要计算末位置等路径，不能把缓存直接当答案。

这里有两种容易混淆的“传递”：

- **控制消息**：请求元数据、取消、批次计划、完成通知。API 和引擎间可能使用 IPC；不是每条消息都带一整份权重。
- **张量传输**：TP collective、PP 的中间激活、跨设备或跨实例搬 KV。真正的带宽、同步和拓扑成本在这里具体计算。

## 模型执行再往下，还有哪些层？ {#runtime-stack}

| 层 | 负责什么 | 被追问时可以落到哪里 |
| --- | --- | --- |
| Model runner | 准备本轮 token、位置、缓存索引和模型调用 | 动态 batch 怎样变成可执行张量？为什么 shape 会影响执行路径？ |
| 模型层与 attention backend | QKV 投影、attention、MLP、KV 读写 | Prefill 与 decode 的张量形状有何不同？GQA 怎样影响缓存？ |
| 编译、算子与 CUDA Graph | 生成或选择算子，减少启动与调度成本 | Graph capture 的 shape / buffer 约束；不适配时回退到什么路径？ |
| GPU 内存与通信 | 在 HBM 存权重与 KV，在寄存器 / shared memory 复用局部数据；多卡交换张量 | 计算、显存带宽还是互联限速？通信能否与计算重叠？ |

PyTorch、Triton、CUDA / 厂商库可能出现在不同后端，不是每次执行都必经的一串“服务”。比如 CUDA Graph 主要减少 CPU 发起 GPU 工作的开销，不会让 KV cache 免费，也不会消除 TP 的通信。FlashAttention 的 IO 优化与 paged KV 的内存管理同样不在一个层面：前者改变 attention 怎么计算，后者改变 KV 怎么分配和寻址。详见[attention kernel 与缓存布局](../00-foundations/deep-dives/attention-kernels.md)。

SGLang 的上述执行选择可以在固定版本的 [ModelRunner](https://github.com/sgl-project/sglang/blob/436d73ddda02d17d6d56e770a5362ebd5dd95ac0/python/sglang/srt/model_executor/model_runner.py)中继续追。面试讲到自己没测过的后端，就说清阅读到哪一层，不把源码阅读说成调优经验。

## 多张 GPU，不是只有一种拼法 {#deployment-map}

<figure class="worked-update" lang="zh-CN">
<ol>
<li><small>分请求 / Replicas</small><strong>请求 A → 副本 1<br>请求 B → 副本 2</strong><span>每个完整副本服务不同请求。总容量可增加，但权重重复，热前缀不一定在选中的副本。</span></li>
<li><small>分模型 / TP</small><strong>同一请求 → GPU 0 + GPU 1</strong><span>各卡算同一层的不同部分。不是两条独立请求，层内要通信；互联差时可能不划算。</span></li>
<li><small>分阶段 / P–D</small><strong>Prefill worker → KV → Decode worker</strong><span>把不同计算形态分开安排，也多了 KV 搬运、路由和两个队列。不是看到 decode 慢就默认拆。</span></li>
</ol>
<figcaption>三种划分可以组合，不是互斥的产品选项。图里的“副本”指完整推理副本，不概括所有 MoE 的 DP / EP 拓扑。</figcaption>
</figure>

举个教学配置：总共八张 GPU，TP=2、4 个完整副本，就是每个请求由一个双卡组处理，共有 4 组独立安排请求。不能把它说成“每个请求自动用满八张”。是否比 TP=8 更合适，取决于模型放得下吗、KV 余量、单请求延迟、到达率和互联。先把[显存账](../00-foundations/deep-dives/kv-cache-and-inference.md#inference-budget)算清，再拿代表性负载验证。

## 为什么请求结束一个，就能补进一个 {#batching}

只看一个理想化 decode 算例：两条已完成 prefill 的请求 A、B，还需生成 2、5 个 token。第三条 C 已准备好，还需 3 个。每轮最多放两条、各生成一个 token，忽略所有额外成本。

| 轮次 | 等整批结束才补位 | 每轮可补位 |
| --- | --- | --- |
| 1–2 | A、B | A、B |
| 3–5 | B，另一个位置空着 | B、C |
| 6–8 | C | 已结束 |

从 8 轮到 5 轮，是这个假设下的排程差别，不是实测加速比。真实 prefill、KV 容量和长上下文读写都要计入。Continuous batching 也不是让所有请求同时进来：超出预算时仍要排队、限流或拒绝。

## vLLM 和 SGLang 的缓存怎么理解 {#prefix}

两者都能做前缀复用，而且默认都开着（vLLM 的 `--enable-prefix-caching`，SGLang 的 radix cache），不能简单说“vLLM 管显存，SGLang 才管 cache”。今天还能比较的是索引结构、默认粒度和回收策略：

| 观察点 | vLLM V1 | SGLang 的 radix 树（默认 `UnifiedRadixCache`） |
| --- | --- | --- |
| 怎么组织可复用前缀 | 带前缀关系的块哈希与 block pool，按哈希查块 | 用树表示共同的 token 路径；v0.5.21 起树的核心默认用 Rust 实现 |
| 复用边界 | 默认每 16 个 token 一块，只复用完整块 | 默认 page size 为 1，可以停在任意 token；部分后端或模型把 page 调到 64、128 等，就向下对齐到整页 |
| 生命周期 | 引用计数、空闲队列按 LRU 驱逐、重新分配 | 锁定、引用、节点拆分；默认 LRU，也可选 LFU、SLRU、priority、T-LRU |
| 不能直接推出什么 | 块组织不等于整个服务更快 | 树组织不等于任意 workload 都更快 |

实现细节可对照已有的[缓存生命周期与页对齐算例](../00-foundations/deep-dives/attention-kernels.md#cache-lifecycle)，其中固定了 vLLM 与 SGLang 源码版本。[SGLang 原论文](https://arxiv.org/abs/2312.07104)解释了 RadixAttention 的背景；不要把论文发表时的功能边界当成今天的完整产品对比。

例如两个请求共享一份 2,000-token 说明，后面各有 100-token 问题。第二条请求可能少做共同前缀的 prefill，但生成新答案时依然需要使用前缀 KV。省的是重复计算，不是把历史从 attention 里删除。权重、adapter、token IDs、位置与多模态输入也必须兼容；“人看起来文字一样”不是充分条件。

多租户还要设计隔离。共同前缀带来的时间差可能泄露缓存是否命中，不能把缓存机制当成权限机制。[vLLM 的 cache salt 说明](https://docs.vllm.ai/en/v0.31.0/design/prefix_caching/)提供了一种复用隔离手段，SGLang 的 OpenAI 接口也接受 `cache_salt`；服务端仍要决定可信分组，不能任由客户端声称自己属于别人的组。

## HiCache：显存以外，也能存 KV {#hicache}

[SGLang HiCache](https://docs.sglang.io/docs/advanced_features/hicache_design)把 KV 放在 GPU、主机内存及存储后端等层次。GPU / 主机层归推理实例使用；跨实例共享要看存储后端及 namespace 的实际配置，不能把两台机器的 RAM 当成天然共享池。vLLM 现在也能这样分层：[OffloadingConnector](https://docs.vllm.ai/en/v0.31.0/features/kv_offloading_usage/) 把算完的完整块先放进 CPU 内存，还可以再接文件、对象存储等二级层，也可以改接 LMCache 或 Mooncake Store。两边默认都不开。

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

截至 2026-10（vLLM v0.31.0、SGLang v0.5.21），两套引擎的大部分机制已经重合：分页管理 KV、默认开启的前缀复用、continuous batching 与 chunked prefill、CPU 调度与 GPU 执行重叠、CUDA Graph、EAGLE / MTP / n-gram 推测解码、xgrammar 等结构化输出、TP / PP / DP + EP、P/D 分离与 KV 分层存储，两边都有。还说得清的差别多在默认行为：前缀索引一个是块哈希、一个是 radix 树，默认粒度 16 个 token 对 1 个 token；vLLM 每轮先排 decode，再把 prefill 分块塞进同一批，SGLang 默认有新 prefill 就先跑 prefill 批，要混合得开 `--enable-mixed-chunk`；vLLM 默认用 torch.compile，SGLang 默认不开；P/D 分离在 SGLang 是内置的 prefill / decode 角色加 router，在 vLLM 走 KV connector，文档仍标为实验性。比较的仍是**固定版本、模型、硬件和功能组合**，不是记住“Agent 选这个，高并发选那个”。FSDP 属于[训练状态分片](training-frameworks.md)，不是这张表里另一个生成引擎。

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

## 面试里怎样顺着讲，而不是报一串名字 {#interview-walkthrough}

可以先用一小段话把范围说清：

> 我会先按请求路径拆。应用负责权限、prompt 和流量入口；推理引擎维护请求队列、计算预算和 KV，安排每轮执行；worker 跑模型与底层算子，再把结果交回流式输出。接下来我会用输入输出长度、到达率和延迟目标判断瓶颈，再决定调 batch、加副本，还是做模型或阶段拆分。

这只是组织答案的方式，不是标准话术。随后挑一个自己熟悉的点往下讲：

| 追问 | 进一步解释 | 用什么证据支撑 |
| --- | --- | --- |
| Prefix hit 很高，为什么还是慢？ | 命中的是多少 token？命中了哪个副本？省了 prefill，但队列、decode 与传输仍在 | 分阶段 trace、命中 token 数、冷 / 热缓存对照 |
| KV 用满了怎么办？ | 等待、拒绝、驱逐可回收块、抢占或重算；要区分可释放缓存和活跃请求正在用的状态 | 容量、引用状态、抢占与重算量、尾延迟 |
| TP 从 2 加到 4，一定快吗？ | 每卡工作可能变少，但通信更多或占比更高；小 batch 可能吃不满 | 层内 compute / collective 时间、互联、batch 和模型结构 |
| 用户关了页面，显存没降，是泄漏吗？ | 查请求是否终止、引用是否释放；内存池保留容量不等于仍为该请求服务 | request ID 生命周期、活跃块与空闲池，而不只看进程显存 |
| 怎么证明调优有用？ | 同版本与请求集下，比较满足质量和延迟要求的完成率、成本及错误率 | 开放到达压测、失败样本、可重复配置，不只一张 tokens/s 图 |

读源码可以从请求对象一路追到 batch，再到缓存索引与模型执行，不必从第一个文件看到最后一个文件。更广的准备入口见 [RE / MLE 与 inference 面试](../interview/ai-roles-prep.md#inference)。本篇只做源码核对和教学算例，没有运行两套框架的 GPU benchmark。
