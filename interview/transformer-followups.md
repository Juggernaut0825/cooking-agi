# Transformer 进阶速查：常见的追问

**中文** · [English](transformer-followups.en.md)

> 阅读时间：约 8 分钟 · 最近审阅：2026-10

> **先读这个**：这里只整理公开的基础知识，不是任何一家公司的面试题，也不涉及任何公司的面试流程。模型的具体配置变得很快，数字以[交互图解](../00-foundations/transformer-lab.md)文末的论文和公开 config 为准。

复习 Transformer 时，可以从 attention 公式继续追问：KV cache 为什么能复用？MQA / GQA / MLA 各省了什么？RoPE、MoE、FlashAttention 又改变了哪一步？下面是本站的练习顺序，不是对面试频率或评分标准的统计。

这一页是**考前过一遍**用的：一问一答，先讲机制，再保留成立条件。想看完整推导、动手拖图，去知识板块的 [Transformer 交互图解](../00-foundations/transformer-lab.md) 和 [Transformer 架构](../00-foundations/transformer.md)；每一节末尾都给了对应的图。

## KV cache

<details class="qa" markdown="1">
<summary>为什么解码需要 KV cache？不用会怎样？</summary>

普通自回归生成每次追加一个 token。在权重、已有前缀、位置编码和 mask 规则不变、关闭 dropout 的因果模型里，追加 token 不会改变过去位置的 K/V，因此可以复用。不用 cache、每次完整重算前缀时，第 $t$ 步每层每个 attention head 有 $t(t+1)/2$ 个有效分数；缓存后只新增一个位置的 K/V 和一行 $t$ 个分数。换模型、改前缀或重编号位置，都不能直接沿用旧缓存。

</details>

<details class="qa" markdown="1">
<summary>有了 cache，单步复杂度是多少？瓶颈变成了什么？</summary>

固定 head 数与维度时，完整因果 attention 的单步计算从重算前缀的 $O(t^2)$ 降到 $O(t)$；这不是整个模型的全部成本。代价是缓存随长度线性增长，每步仍需读取可见的 K/V。小 batch 解码常受权重和缓存读取带宽限制（**memory-bound**）；增大 batch 是否转向算力受限，还要看硬件与 workload，见 [decode 的 roofline 算例](../12-infra/performance.md#decode-batching)。GQA、MLA 减少每个位置的存储，sliding window 则限制可见位置数。

</details>

<details class="qa" markdown="1">
<summary>cache 的大小怎么算？</summary>

普通 MHA / GQA、K/V 等宽、未压缩的单序列缓存是 $2 \times n_{\text{layers}} \times n_{\text{kv heads}} \times d_{\text{head}} \times \text{tokens} \times \text{bytes}$；等长 batch 再乘序列数，不含分页、对齐和运行时开销。注意里面没有 query head 的数量。用 Llama-2-7B 的形状（32 层、32 个 KV head、$d_{\text{head}}=128$、fp16 每元素 2 bytes）复算：每个 token 是 524,288 bytes = **0.5 MiB**；32,768 tokens 是 **16 GiB ≈ 17.18 GB**。这是容量假设，不代表原始模型支持 32K；[Llama 2 论文 §2、表 1](https://arxiv.org/html/2307.09288v2#S2) 的上下文长度是 4,096。

</details>

<details class="qa" markdown="1">
<summary>怎样证明带 cache 的实现是对的？</summary>

固定权重和同一 token 序列，关闭 dropout，在相同位置与 mask 规则下，对比缓存路径与完整前向的逐位置 logits：应在所用精度的容差内一致，不要求逐 bit 相同。简单连续缓存里，query 位置是 `cache.pos + i`；$T$ 个新 query 对 $S$ 个累计 key 的 mask 是非方阵 $(T,S)$，RoPE 也从正确位置开始。若使用左 padding、滑窗或分页，逻辑位置未必等于缓存槽号，要另外核对。

</details>

看图：[KV cache：解码每一步到底算了什么](../00-foundations/transformer-lab.md#tx-kv-cache)

## MHA → GQA → MQA → MLA

<details class="qa" markdown="1">
<summary>MQA、GQA 各自改了什么？为什么只动 K/V 不动 Q？</summary>

固定其他维度时，缓存大小随 KV head 数变化，不直接随 query head 数变化。**MQA** 让全部 query head 共用一组 K/V，**GQA** 则按组共享；Llama 3 8B 是 32 个 query head 配 8 个 KV head。共享会约束表示能力，但不意味着每个任务必然掉分：[GQA 论文 §3、表 1](https://arxiv.org/html/2305.13245v3#S3) 的结果取决于模型、继续训练方式和任务。

</details>

<details class="qa" markdown="1">
<summary>MLA 缓存的是什么？为什么它的 cache 和 head 数无关？</summary>

MLA 每层每个 token 缓存共享的 KV latent 和解耦的 RoPE key。以 DeepSeek-V2 为例，是 $512+64=576$ 个元素；固定这两个维度时，缓存不随 query head 数增长。每个 head 有自己的投影，但高效解码可以把 K 的上投影吸收到 Q 侧、V 的上投影吸收到输出侧，**不必展开全部历史 K/V**。同精度、head 宽 128 时，$576/(2\times128)=2.25$ 是与 GQA 比较的存储比，不是实际有 2.25 个 head。[DeepSeek-V2 §2.1.2–2.1.4](https://arxiv.org/html/2405.04434v5#S2.SS1)

</details>

<details class="qa" markdown="1">
<summary>MLA 里的 RoPE 为什么要单独拿出来？</summary>

若给展开后的 content key 做 RoPE，点积里的相对旋转会夹在 Q/K 投影之间，随位置对变化，不能预先合成一个固定投影。DeepSeek-V2 因此另设 64 维、跨 head 共享的 RoPE key，并配各 head 的 RoPE query；content 部分仍可做投影吸收。这不等于所有低秩 attention 都不能使用 RoPE。[论文 §2.1.3](https://arxiv.org/html/2405.04434v5#S2.SS1.SSS3)

</details>

看图：[MHA → GQA → MQA → MLA 与显存计算器](../00-foundations/transformer-lab.md#tx-kv-heads)

## Sliding window 与 attention sink

<details class="qa" markdown="1">
<summary>Sliding window 每层只看 w 个 token，远处的信息怎么传过来？</summary>

靠层间传递。若 $w$ **包含当前位置**，每层最多向前扩展 $w-1$ 个位置，$L$ 层的结构可达范围是 $L(w-1)+1$；例如 $w=3,L=2$ 时是 5 个位置。Mistral 7B 原始报告采用 4096 的窗口、32 层，给出约 131K 的理论跨度，但**结构可达不等于可靠记住那么远的内容，也不等于训练上下文长度**；原报告表 1 的上下文是 8192。[Mistral 7B §2](https://arxiv.org/pdf/2310.06825)

</details>

<details class="qa" markdown="1">
<summary>它省了什么？</summary>

对纯滑窗层，实际执行局部 attention 时，attention 计算从 $O(n^2)$ 变为 $O(n\min(n,w))$；若用滚动缓存淘汰不可见 K/V，每层缓存可限制到 $w$ 个位置。只给完整分数矩阵加局部 mask，并不会自动省掉二次计算或缓存分配。Gemma 3 的 5 层 local / 1 层 global 设计仍含全局层的二次 attention 计算和完整长度缓存，不能把纯滑窗的复杂度套给整个模型。[Gemma 3 §2](https://arxiv.org/html/2503.19786v1#S2)

</details>

<details class="qa" markdown="1">
<summary>Attention sink 是什么？为什么把最开头的 token 逐出 cache 会出事？</summary>

[StreamingLLM §3.1–3.2](https://arxiv.org/html/2309.17453v3#S3) 观察到：一些模型会给开头 token 很大的注意力，即使它们语义不重要；删掉这些 K/V 会改变归一化并破坏流式表现。论文用 softmax 必须分配完权重来解释这一现象；它不是仅凭归一化就能推出的普遍定律。StreamingLLM 保留开头与最近的 token，并处理缓存中的位置编码。

[gpt-oss 参考实现](https://github.com/openai/gpt-oss/blob/main/gpt_oss/torch/model.py) 则为每个 query head 添加一个可学习的 **sink logit** $s$，再丢弃它对应的输出权重：普通位置的权重为 $e^{z_j}/(\sum_i e^{z_i}+e^s)$，不是直接在分母加 $s$。例如两个普通 logit 与 sink logit 都是 0，普通 token 各得 $1/3$，合计 $2/3$；sink 不携带原始 token 的 value，不能与保留真实开头 token 视为同一个操作。

</details>

看图：[谁能看到谁](../00-foundations/transformer-lab.md#tx-windows)

## RoPE

<details class="qa" markdown="1">
<summary>RoPE 怎么表示位置？为什么说它是“相对”的？</summary>

把 $q$ 和 $k$ 的每对维度按位置旋转，各对频率不同。**固定内容向量 $q,k$** 时，$\langle R_mq,R_nk\rangle=\langle q,R_{n-m}k\rangle$：显式位置项只依赖相对距离，分数仍取决于内容。相同距离下把 $q$ 变成 $2q$，点积也会翻倍；RoPE 不保证整套模型对平移完全不变。[RoFormer §3.1–3.2](https://arxiv.org/html/2104.09864v5#S3)

</details>

<details class="qa" markdown="1">
<summary>为什么必须同时旋转 Q 和 K？只转一个行不行？</summary>

不行。相对性来自两个旋转相互抵消：$\langle R_m q, R_n k\rangle = \langle q, R_{n-m} k\rangle$。只旋转一边，点积里剩下的就是绝对位置。

</details>

<details class="qa" markdown="1">
<summary>长上下文为什么要调大 RoPE 的 base θ？</summary>

在常见频率公式 $\omega_i=\theta^{-2i/d}$ 中，增大 base 会让 $i>0$ 的维度对转慢、周期变长，$i=0$ 的频率仍为 1。不能据此断言所有低频对在目标长度内都不转满一圈，或远距离一定更易区分；还要看具体频率、缩放方案、训练和评估。Llama 3 用 $\theta=500\text{k}$；Gemma 3 global 层用 $\theta=1\text{M}$，其 4B / 12B / 27B 扩到 128K 还结合了 RoPE rescaling 和训练。[Llama 3 §3.2](https://arxiv.org/html/2407.21783v3#S3.SS2) · [Gemma 3 §5.3](https://arxiv.org/html/2503.19786v1#S5.SS3)

</details>

看图：[RoPE：位置就是旋转](../00-foundations/transformer-lab.md#tx-rope)

## MoE

<details class="qa" markdown="1">
<summary>MoE 的总参数量和激活参数量分别随什么增长？</summary>

固定每个 expert 的宽度和层数，$N$ 个 routed expert 中每 token 选 $k$ 个：expert 参数量随 $N$ 增长，**被选中 expert 的 FFN 计算**随 $k$ 增长。整层还要算 router（常要给全部 $N$ 个 expert 打分）、attention、shared expert，以及通信和负载不均，不能说总成本只由 $k$ 决定。[Mixtral 8×7B](https://arxiv.org/html/2401.04088v1#S2) 是 8 选 2（约 47B 总参数、13B 激活）；[DeepSeek-V3 §4.2](https://arxiv.org/html/2412.19437v2#S4.SS2) 的 MoE 层是 256 选 8，加 1 个 shared expert（模型共 671B、每 token 激活 37B）。

</details>

<details class="qa" markdown="1">
<summary>MoE 训练最典型的问题是什么？</summary>

负载不均：router 容易把 token 都塞给少数几个 expert，其余 expert 学不到东西。常见做法是加辅助的 load-balancing loss；DeepSeek-V3 主要改用一个 bias 项来调节，只保留一个权重很小的序列级辅助 loss。

</details>

看图：[MoE：按真实 expert 数量画的路由](../00-foundations/transformer-lab.md#tx-moe)

## FlashAttention

<details class="qa" markdown="1">
<summary>FlashAttention 是近似算法吗？它到底省了什么？</summary>

它是**精确 attention 算法**，不是稀疏或低秩近似；浮点归约顺序不同，结果不要求逐 bit 相同，[官方测试](https://github.com/Dao-AILab/flash-attention#tests) 用数值容差比较。它分块在片上 SRAM 计算，避免把完整 $n\times n$ 分数／概率矩阵写到 HBM；写回输出及线性大小的归一化统计量，反向时重算需要的分块。因此主要节省访存和中间存储，标准稠密 attention 的算术量仍是二次方，反向还可能多做重算。[FlashAttention §3.1](https://arxiv.org/html/2205.14135v2#S3.SS1) · [GPU 的内存层级](../12-infra/gpu-architecture.md)

</details>

<details class="qa" markdown="1">
<summary>分块之后 softmax 怎么算？整行不是要一起归一化吗？</summary>

用 online softmax：每一行维护一个 running max 和一个归一化因子，每来一个新 block 就更新这两个量并修正已经累积的输出。数学上和一次性算整行完全等价。

</details>

看图：[FlashAttention：attention 矩阵放在哪里](../00-foundations/transformer-lab.md#tx-flash)

## 结构与模型家族

<details class="qa" markdown="1">
<summary>从原版 Transformer 到 Llama 3，block 里改了哪几处？</summary>

主要比较四处：post-LN 的 LayerNorm 换成 pre-norm 的 RMSNorm；加在 embedding 上的位置编码换成 RoPE；FFN 从 **ReLU** 换成 SwiGLU；MHA 换成 GQA。另外 Llama 3 是 decoder-only，没有 encoder / cross-attention，主要线性投影不带 bias。原版 Transformer 用 ReLU，不是 GELU；norm 的位置与 RMSNorm 的具体公式也是两项不同选择，不能把稳定性全归给其中一个名字。[原论文 §3.1、§3.3](https://arxiv.org/html/1706.03762v7#S3) · [Llama 3 §3.2](https://arxiv.org/html/2407.21783v3#S3.SS2)

</details>

<details class="qa" markdown="1">
<summary>Pre-norm 和 post-norm 差在哪？</summary>

post-norm 是 $\mathrm{Norm}(x+F(x))$，残差通路也经过 norm；pre-norm 是 $x+F(\mathrm{Norm}(x))$，保留直接的恒等通路。[Xiong 等（2020）§3–4](https://arxiv.org/pdf/2002.04745) 在其初始化与实验设置下解释了 post-LN 为什么更依赖 warmup，并展示了 pre-LN 无 warmup 的训练；这不是所有 post-norm 都必须 warmup、所有 pre-norm 都可省略的定律。

</details>

看图：[结构图：在模型家族之间变形](../00-foundations/transformer-lab.md#tx-arch)

## 继续

- [考前速查：按知识板块过一遍考题](questions.md)
- [Transformer 交互图解](../00-foundations/transformer-lab.md) —— 同样的内容，学习版
