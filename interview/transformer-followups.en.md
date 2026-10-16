# Transformer follow-ups, quick review: the common ones

[中文](transformer-followups.md) · **English**

> Reading time: ~8 min · Last reviewed: 2026-10

> **Read this first**: only public fundamentals are collected here. These are not any company's interview questions, and nothing here describes any company's process. Model configurations change quickly; for numbers, trust the papers and released configs at the end of [the interactive Transformer page](../00-foundations/transformer-lab.en.md).

When reviewing Transformers, follow the attention equation with concrete questions: why can a KV cache be reused, what do MQA / GQA / MLA save, and which computation do RoPE, MoE, and FlashAttention change? This is our practice sequence, not a survey of interview frequency or scoring criteria.

This page is for a **run-through before an interview**: one question and answer at a time, with the mechanism and its assumptions kept together. For full derivations and interactive figures, use [The Transformer, interactively](../00-foundations/transformer-lab.en.md) and [The Transformer architecture](../00-foundations/transformer.en.md). Each section below links to the matching figure.

## KV cache

<details class="qa" markdown="1">
<summary>Why does decoding need a KV cache? What happens without one?</summary>

Ordinary autoregressive generation appends one token at a time. With fixed weights, prefix, position encoding, and mask rules, and dropout disabled, appending a token to a causal model leaves earlier K/V unchanged. Recomputing the full prefix at step $t$ requires $t(t+1)/2$ valid scores per layer and attention head; caching adds one position's K/V and one row of $t$ scores. Changing the model, prefix, or position numbering can invalidate that reuse.

</details>

<details class="qa" markdown="1">
<summary>With a cache, what is the per-step complexity, and what becomes the bottleneck?</summary>

With fixed head counts and dimensions, full causal attention drops from $O(t^2)$ for prefix recomputation to $O(t)$ per step; this is not the cost of the whole model. Cache storage grows linearly with length, and each step still reads the visible K/V. Small-batch decoding is often **memory-bound** by weight and cache reads. Whether batching makes it compute-bound depends on hardware and workload; see the [decode roofline example](../12-infra/performance.en.md#decode-batching). GQA and MLA reduce storage per position; sliding windows limit the visible positions.

</details>

<details class="qa" markdown="1">
<summary>How do you compute the size of the cache?</summary>

For an uncompressed, single-sequence MHA / GQA cache with equal K/V widths: $2 \times n_{\text{layers}} \times n_{\text{kv heads}} \times d_{\text{head}} \times \text{tokens} \times \text{bytes}$. Multiply by batch size for equal-length sequences; paging, alignment, and runtime overhead are extra. Query-head count does not appear. A Llama-2-7B shape (32 layers, 32 KV heads, $d_{\text{head}}=128$, fp16 at 2 bytes per element) takes 524,288 bytes = **0.5 MiB per token**. At 32,768 tokens that is **16 GiB ≈ 17.18 GB**. This is a hypothetical capacity calculation, not a supported-context claim: [Llama 2 §2, Table 1](https://arxiv.org/html/2307.09288v2#S2) specifies 4,096 tokens.

</details>

<details class="qa" markdown="1">
<summary>How do you prove a cached implementation is correct?</summary>

Fix weights and tokens, disable dropout, and use the same position and mask rules. Cached and full-forward per-position logits should agree within a dtype-appropriate tolerance, not necessarily bit for bit. For a simple contiguous cache, query position is `cache.pos + i`; $T$ new queries against $S$ accumulated keys need a non-square $(T,S)$ mask and the correct RoPE offset. Left padding, sliding windows, and paging require extra checks because logical positions need not equal cache-slot indices.

</details>

Figure: [KV cache: what each decoding step computes](../00-foundations/transformer-lab.en.md#tx-kv-cache)

## MHA → GQA → MQA → MLA

<details class="qa" markdown="1">
<summary>What do MQA and GQA change, and why touch only K/V and not Q?</summary>

With other dimensions fixed, cache size scales with KV heads rather than query heads. **MQA** shares one K/V pair across all query heads; **GQA** shares within groups. Llama 3 8B uses 32 query heads and 8 KV heads. Sharing constrains the representation, but does not guarantee worse scores on every task: the results in [GQA §3, Table 1](https://arxiv.org/html/2305.13245v3#S3) depend on the model, uptraining recipe, and task.

</details>

<details class="qa" markdown="1">
<summary>What does MLA cache, and why is its cache independent of the number of heads?</summary>

MLA caches a shared KV latent plus a decoupled RoPE key per token and layer: $512+64=576$ elements in DeepSeek-V2. With those widths fixed, cache size does not grow with query-head count. Heads retain distinct projections, but efficient decoding absorbs the K up-projection into the query side and the V up-projection into the output side, **without expanding all historical K/V**. At equal precision and head width 128, $576/(2\times128)=2.25$ is a GQA storage comparison, not an actual head count. [DeepSeek-V2 §2.1.2–2.1.4](https://arxiv.org/html/2405.04434v5#S2.SS1)

</details>

<details class="qa" markdown="1">
<summary>Why is RoPE handled separately in MLA?</summary>

Applying RoPE to expanded content keys puts a position-pair-dependent rotation between the Q/K projections, preventing their merger into a fixed projection. DeepSeek-V2 instead uses a shared 64-dimensional RoPE key and per-head RoPE queries, leaving content projections absorbable. This is not a claim that every low-rank attention design is incompatible with RoPE. [§2.1.3](https://arxiv.org/html/2405.04434v5#S2.SS1.SSS3)

</details>

Figure: [MHA → GQA → MQA → MLA, with a memory calculator](../00-foundations/transformer-lab.en.md#tx-kv-heads)

## Sliding windows and attention sinks

<details class="qa" markdown="1">
<summary>With a sliding window each layer sees only w tokens. How does distant information arrive?</summary>

Through layer-to-layer propagation. If $w$ **includes the current position**, each layer extends reach by at most $w-1$, giving $L(w-1)+1$ input positions after $L$ layers: $w=3,L=2$ gives 5. The original Mistral 7B report uses a 4096 window and 32 layers, reporting roughly 131K theoretical reach. **Reachability is not reliable recall or training context length**: Table 1 lists an 8192 context. [Mistral 7B §2](https://arxiv.org/pdf/2310.06825)

</details>

<details class="qa" markdown="1">
<summary>What does it save?</summary>

A genuinely local attention kernel reduces a sliding-window layer's attention work from $O(n^2)$ to $O(n\min(n,w))$. Evicting invisible K/V through a rolling cache bounds storage to $w$ positions. Applying a local mask to a full score matrix alone saves neither quadratic computation nor allocated cache storage. Gemma 3 interleaves five local layers with one global layer, so global layers retain quadratic attention work and full-length caches; the pure sliding-window bound does not describe the whole model. [Gemma 3 §2](https://arxiv.org/html/2503.19786v1#S2)

</details>

<details class="qa" markdown="1">
<summary>What is an attention sink, and why does evicting the first tokens from the cache break things?</summary>

[StreamingLLM §3.1–3.2](https://arxiv.org/html/2309.17453v3#S3) observes high attention to initial tokens even when their meaning is unimportant; evicting their K/V changes normalization and can disrupt streaming. The paper explains this through softmax's need to allocate unit mass, not a universal theorem implied by normalization alone. StreamingLLM retains initial and recent tokens and handles their cached position encodings.

The [gpt-oss reference implementation](https://github.com/openai/gpt-oss/blob/main/gpt_oss/torch/model.py) instead adds a learned **sink logit** $s$ per query head and discards its output weight. Ordinary weights become $e^{z_j}/(\sum_i e^{z_i}+e^s)$, not a denominator with $s$ added directly. With two ordinary logits and a sink logit all zero, each ordinary token receives $1/3$, totaling $2/3$. The sink carries no original token value, so this is not the same operation as retaining real initial tokens.

</details>

Figure: [Who can see whom](../00-foundations/transformer-lab.en.md#tx-windows)

## RoPE

<details class="qa" markdown="1">
<summary>How does RoPE represent position, and why is it called “relative”?</summary>

RoPE rotates each dimension pair of $q$ and $k$ according to position, at different frequencies. **For fixed content vectors $q,k$**, $\langle R_mq,R_nk\rangle=\langle q,R_{n-m}k\rangle$: the explicit position term depends on relative distance, but the score still depends on content. Doubling $q$ doubles the score at the same distance. RoPE does not make the entire model translation-invariant. [RoFormer §3.1–3.2](https://arxiv.org/html/2104.09864v5#S3)

</details>

<details class="qa" markdown="1">
<summary>Why must both Q and K be rotated? Would rotating one be enough?</summary>

No. The relativity comes from the two rotations canceling: $\langle R_m q, R_n k\rangle = \langle q, R_{n-m} k\rangle$. Rotate only one side and what is left in the dot product is absolute position.

</details>

<details class="qa" markdown="1">
<summary>Why raise the RoPE base θ for long context?</summary>

In the usual formula $\omega_i=\theta^{-2i/d}$, a larger base slows pairs with $i>0$ and lengthens their periods; $i=0$ remains at frequency 1. This does not ensure that every low-frequency pair avoids wrapping within a target length, or that distant positions become easier to distinguish. Frequencies, scaling, training, and evaluation still matter. Llama 3 uses $\theta=500\text{k}$; Gemma 3 uses $\theta=1\text{M}$ globally, with RoPE rescaling and training also used to extend its 4B / 12B / 27B models to 128K. [Llama 3 §3.2](https://arxiv.org/html/2407.21783v3#S3.SS2) · [Gemma 3 §5.3](https://arxiv.org/html/2503.19786v1#S5.SS3)

</details>

Figure: [RoPE: position as rotation](../00-foundations/transformer-lab.en.md#tx-rope)

## MoE

<details class="qa" markdown="1">
<summary>What do total and active parameters each scale with in an MoE?</summary>

With expert width and layer count fixed, routing to $k$ of $N$ experts makes expert parameters scale with $N$ and **selected-expert FFN computation** scale with $k$. Total cost also includes routing, often scoring all $N$ experts, attention, shared experts, communication, and imbalance. It is not determined by $k$ alone. [Mixtral 8×7B](https://arxiv.org/html/2401.04088v1#S2) selects 2 of 8 (about 47B total, 13B active); [DeepSeek-V3 §4.2](https://arxiv.org/html/2412.19437v2#S4.SS2) uses 8 of 256 plus one shared expert in its MoE layers (671B total, 37B active per token).

</details>

<details class="qa" markdown="1">
<summary>What is the classic problem in MoE training?</summary>

Load imbalance: the router tends to send tokens to a few experts and the rest learn nothing. The usual fix is an auxiliary load-balancing loss; DeepSeek-V3 relies mainly on a bias term instead, keeping only a very small sequence-wise auxiliary loss.

</details>

Figure: [MoE: routing drawn at the true number of experts](../00-foundations/transformer-lab.en.md#tx-moe)

## FlashAttention

<details class="qa" markdown="1">
<summary>Is FlashAttention an approximation? What does it actually save?</summary>

It computes **exact attention**, not a sparse or low-rank approximation. Different floating-point reduction orders need not produce bitwise-identical results; [official tests](https://github.com/Dao-AILab/flash-attention#tests) use numerical tolerances. Tiling in SRAM avoids writing the full $n\times n$ score/probability matrices to HBM. It stores outputs and linear-size normalization statistics, recomputing blocks for backward. The main savings are memory traffic and intermediate storage: dense attention arithmetic remains quadratic, and backward may do extra recomputation. [FlashAttention §3.1](https://arxiv.org/html/2205.14135v2#S3.SS1) · [GPU memory hierarchy](../12-infra/gpu-architecture.en.md)

</details>

<details class="qa" markdown="1">
<summary>How is softmax computed once the row is split into blocks? Does a row not have to be normalized as a whole?</summary>

With an online softmax: every row keeps a running max and a running normalizer, and each new block updates both and corrects the output accumulated so far. Mathematically it is identical to normalizing the whole row at once.

</details>

Figure: [FlashAttention: where the attention matrix lives](../00-foundations/transformer-lab.en.md#tx-flash)

## Structure and model families

<details class="qa" markdown="1">
<summary>Which parts of the block changed between the original Transformer and Llama 3?</summary>

Four useful comparisons: post-LN LayerNorm becomes pre-norm RMSNorm; added position encodings become RoPE; **ReLU** FFNs become SwiGLU; and MHA becomes GQA. Llama 3 is also decoder-only, without encoder/cross-attention, and its main linear projections omit biases. The original Transformer used ReLU, not GELU. Norm placement and the RMSNorm formula are separate design choices, so stability should not be attributed to a name alone. [Original Transformer §3.1, §3.3](https://arxiv.org/html/1706.03762v7#S3) · [Llama 3 §3.2](https://arxiv.org/html/2407.21783v3#S3.SS2)

</details>

<details class="qa" markdown="1">
<summary>What is the difference between pre-norm and post-norm?</summary>

Post-norm computes $\mathrm{Norm}(x+F(x))$, putting normalization on the residual path too. Pre-norm computes $x+F(\mathrm{Norm}(x))$, preserving a direct identity path. [Xiong et al. (2020), §3–4](https://arxiv.org/pdf/2002.04745) explain post-LN's greater warmup sensitivity under their initialization and experimental settings and demonstrate pre-LN training without warmup. This does not prove that every post-norm model requires warmup or that every pre-norm model can omit it.

</details>

Figure: [Architecture map: morphing between model families](../00-foundations/transformer-lab.en.md#tx-arch)

## Keep going

- [Quick review: run through the questions, block by block](questions.en.md)
- [The Transformer, interactively](../00-foundations/transformer-lab.en.md): the same material, in its learning form
