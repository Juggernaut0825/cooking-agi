# AI infrastructure: the whole chain behind one request

[中文](README.md) · **English**

> Reading time: ~7 min · Draft, pending review

A user types a question into a chat box, waits a moment, and the answer appears a few words at a time. Where did those two or three seconds go, and what decided them? **In the hand-worked example below, more than 90% of the time goes to decode, generating tokens one at a time; and decode speed depends mainly on how many bytes per second the GPU can read from its memory (HBM), not on how many multiplications per second it can do.** This series starts from that number, follows it down layer by layer to the chip and the fab, and then comes back up to the product.

> **Draft, pending review.** The site owner has not reviewed this note yet; facts, emphasis and wording may change. Check the primary sources linked in the text before relying on it.

## Nine layers, from wafer to product

Read from the bottom up. "Number to check first" is the first question to ask when debugging; it does not mean the layer is limited by that number alone.

| Layer | What it does | Number to check first | Where to read |
| --- | --- | --- | --- |
| 1 Fabrication and packaging | Makes dies on a wafer, tests and dices them, then packages them with HBM | Good dies per wafer; advanced-packaging and HBM capacity | [How chips are made](chips-and-fabs.en.md) |
| 2 Chips | The CPU handles control and data preparation; GPUs and accelerators do the large matrix math | Peak FLOP/s (state the precision, dense or sparse) relative to memory bandwidth | [CPU architecture](cpu-architecture.en.md), [GPU architecture](gpu-architecture.en.md), [NVIDIA generations](nvidia-generations.en.md) |
| 3 Servers, interconnect, racks | Connects GPUs, CPUs and NICs: PCIe, NVLink, InfiniBand / Ethernet; power and cooling | Per-GPU bandwidth to other GPUs, inside a node vs between nodes, GB/s vs Gb/s | [NVIDIA generations](nvidia-generations.en.md), [Multi-GPU training](../06-systems/distributed-training.en.md) |
| 4 Cluster software and scheduling | Drivers, the CUDA runtime, containers; Kubernetes / Slurm assign GPUs to jobs | How much of the allocated GPU time is actually computing: queue time, idle fraction | [CUDA](cuda.en.md), [Kubernetes](kubernetes.en.md) |
| 5 Kernels and libraries | cuBLAS for matrix multiply, cuDNN for common DNN operators, NCCL for collectives, Triton for custom kernels | Percentage of peak reached; which side of the ridge point the arithmetic intensity falls on | [CUDA](cuda.en.md), [Performance](performance.en.md), [Attention kernels](../00-foundations/deep-dives/attention-kernels.en.md) |
| 6 Frameworks | PyTorch turns model code into a sequence of kernels; compilers fuse them; distributed training shards state | Step time, MFU (achieved compute as a fraction of peak), CPU overhead of launching kernels | [Frameworks](frameworks.en.md), [Training frameworks](../06-systems/training-frameworks.en.md), [Tensor parallelism](../06-systems/tensor-parallel.en.md) |
| 7 Training and inference systems | Serving engines queue requests, form batches and manage the KV cache; training systems manage data, checkpoints and recovery | TTFT, inter-token latency (ITL), tokens/s while meeting the latency target | [How one request runs](../06-systems/llm-serving.en.md), [vLLM and SGLang](../06-systems/inference-frameworks.en.md), [Inference guide](../learn/inference/README.en.md) |
| 8 Model | Parameter count and architecture decide how much each token computes and reads | Bytes of weights; KV bytes per token | [KV cache](../00-foundations/deep-dives/kv-cache-and-inference.en.md), [Precision and memory](../00-foundations/deep-dives/precision-and-memory.en.md) |
| 9 Product | The answer, latency and bill the user sees | Latency target, cost per request | [Modern AI systems](../06-systems/README.en.md) |

Official one-line definitions of the library names: [cuBLAS](https://docs.nvidia.com/cuda/cublas/) is an implementation of BLAS on top of the CUDA runtime; [cuDNN](https://docs.nvidia.com/cudnn/overview) provides DNN operators such as attention, convolution, matrix multiplication and normalization; [NCCL](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/overview.html) implements collectives such as AllReduce, AllGather and ReduceScatter over PCIe, NVLink, InfiniBand and sockets; [Triton](https://triton-lang.org/main/index.html) describes itself as a language and compiler for parallel programming. At the scheduling layer, [Slurm](https://slurm.schedmd.com/overview.html) allocates nodes, launches jobs and queues pending work; [Kubernetes](https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/) exposes GPUs through the vendor's device plugin as a resource such as `nvidia.com/gpu`, requested in a container's `limits`.

## Inside one server, each link has less bandwidth than the last

Take one concrete machine for layer 3. According to the [NVIDIA DGX H100 user guide](https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html), it has 2 Intel Xeon 8480C CPUs (56 cores each), 2 TB of memory, 8 H100 GPUs, 900 GB/s NVLink between GPUs, and 8 single-port ConnectX-7 InfiniBand cards. The table converts every link to bandwidth **per direction** before comparing:

| Link | Bandwidth per direction | Source and conversion | Roughly this fraction of HBM |
| --- | ---: | --- | ---: |
| HBM (one H100 SXM) | 3.35 TB/s | [H100 product page](https://www.nvidia.com/en-us/data-center/h100/); reads and writes share it, no direction split | 1 |
| NVLink (per GPU) | 450 GB/s | [Hopper architecture blog](https://developer.nvidia.com/blog/nvidia-hopper-architecture-in-depth/): 18 links, 900 GB/s total, 25 GB/s per link per direction | 1/7 |
| PCIe Gen5 x16 | 64 GB/s | Same blog: 128 GB/s total, 64 GB/s in each direction | 1/52 |
| InfiniBand NDR (one port) | 50 GB/s | [ConnectX-7 datasheet](https://www.nvidia.com/content/dam/en-zz/Solutions/networking/infiniband/connectx-7-datasheet.pdf): 400 Gb/s, divided by 8 bits | 1/67 |

Vendors often quote both directions added together (900, 128), while networks are quoted in bits (400 Gb/s). Comparing without converting can be off by 2x or even 16x. After converting, each step outward loses several times the bandwidth, and HBM to the network card spans nearly two orders of magnitude. That is why the most communication-heavy splits belong on the fastest link; see [Multi-GPU training](../06-systems/distributed-training.en.md) and [Tensor parallelism](../06-systems/tensor-parallel.en.md).

## Work out one chat request by hand

Everything below is a **teaching assumption**, chosen so the orders of magnitude can be computed by hand. It is not a measurement of any product:

| Assumption | Value |
| --- | --- |
| Model | A dense 8B-parameter model in BF16 (2 bytes per parameter), weights $B_W=16$ GB |
| Architecture | 32 layers, hidden size 4096, 8 KV heads, head dim 128; KV per token is $2\times32\times8\times128\times2$ bytes = 128 KiB |
| Request | 2,000 prompt tokens (system prompt, history and question), 300 output tokens, one request on its own |
| GPU | Peak $F=1{,}000$ TFLOP/s (dense BF16), memory bandwidth $BW=3$ TB/s |
| Achieved efficiency | Prefill reaches $\eta_F=50\%$ of peak compute; decode reaches $\eta_B=70\%$ of peak bandwidth |
| Outside the GPU | Network and gateway 40 ms, chat template plus tokenization 2 ms, queueing 50 ms |

The rounded GPU numbers are the same order as an H100 SXM. Its product page lists BF16 at 1,979 TFLOPS, but the footnote says that figure is with sparsity; the preliminary table in NVIDIA's 2022 architecture blog gave the H100 SXM5 as 1000/2000 dense/sparse and 3000 GB/s of memory bandwidth, which also differs from today's 3.35 TB/s on the product page. When citing, use the product page for the specific SKU and say whether a number is dense or sparse.

A decoder with $N$ parameters does roughly $2N$ floating-point operations per token in the forward pass ([Kaplan et al., 2020, §2.1](https://arxiv.org/abs/2001.08361)). There is also an attention term that grows with context, $2n_{\rm layer}n_{\rm ctx}d_{\rm model}$; with an average context of 1,000 it is about 1.6% of $2N$, so we drop it for now. Then:

$$
t_{\rm prefill}\approx\frac{2NP}{\eta_F F},\qquad
t_{\rm token}\approx\frac{B_W+B_{\rm KV}}{\eta_B\,BW}.
$$

$P$ is the prompt length and $B_{\rm KV}$ is the KV bytes read in this step. Plugging in:

- **Prefill**: $2\times8\times10^9\times2000=3.2\times10^{13}$ operations, divided by $0.5\times10^{15}$ FLOP/s, gives 64 ms. In the same pass the 16 GB of weights are read once, about 7.6 ms, so compute is the bottleneck.
- **Each decode step**: only $1.6\times10^{10}$ operations, 0.032 ms at 50% of peak; but it must read the 16 GB of weights and up to 0.3 GB of KV, about 7.8 ms at 2.1 TB/s, so bandwidth is the bottleneck.

Seen another way: prefill does about 2,000 operations per byte read, decode about 1. This GPU's "ridge point" is $10^{15}/(3\times10^{12})\approx333$ FLOP per byte. Above it you are compute-bound; below it, bandwidth-bound. [Pope et al. (2022)](https://arxiv.org/abs/2211.05102) also note that at small batch sizes and sequence lengths, the time to load weights dominates.

| Stage | Layer | Teaching estimate | Main limit |
| --- | --- | ---: | --- |
| Network, gateway, auth | Product, service | 40 ms | Network round trips |
| Chat template, tokenization | CPU | 2 ms | CPU |
| Queueing | Serving engine | 50 ms | Load and scheduling |
| Prefill 2,000 tokens, producing token 1 | GPU | 64 ms | Compute |
| **Time to first token (TTFT)** | | **~156 ms** | |
| Decode the remaining 299 tokens | GPU | 299 × 7.8 ms ≈ 2.3 s | HBM bandwidth |
| **Total** | | **~2.5 s** | Decode is ~94% |

If 32 similar requests decode together, the weights are read once per step and shared: each step reads 16 GB of weights plus 32 copies of KV (about 9 GB), roughly 25 GB, which takes about 11.9 ms. Each user's inter-token latency rises from 7.8 ms to 11.9 ms, but total throughput goes from about 129 tokens/s to about 2,700 tokens/s, roughly 21x. KV is now more than a third of the bytes read per step; Pope et al. also note that with larger batches and longer sequences, loading the KV cache comes to dominate. This is why serving engines batch requests and also budget the KV cache carefully; see [How one request runs](../06-systems/llm-serving.en.md) and [KV cache](../00-foundations/deep-dives/kv-cache-and-inference.en.md).

| Change one condition | What you see | What you cannot conclude |
| --- | --- | --- |
| Output 30 tokens instead of 300 | Total about 0.38 s; prefill and queueing take a much larger share | Products with short answers are always compute-bound |
| Weights at 1 byte per parameter (e.g. FP8) | Each decode step reads about 8.3 GB, about 4 ms | Quality is unchanged, or the kernels reach the same bandwidth utilization |
| Batch from 1 to 32 | About 21x throughput, while each user gets slower | Bigger batches are always better; KV memory and bandwidth run out first |
| Prompt from 2,000 to 20,000 tokens | Prefill about 640 ms by the $2N$ formula, KV about 2.6 GB | The $2N$ formula is still enough; the attention term now adds about 16% and cannot be dropped |

## Follow one decode step down, then back up

```text
Product          the user is waiting for "when does the next word appear"
  ↓
Serving engine   puts 32 requests into the same step and finds each one's KV
  ↓
Framework        PyTorch runs one forward pass; CUDA Graphs cut the CPU cost of launching kernels one by one
  ↓
Kernels          matrix multiplies (cuBLAS and others), the attention kernel; NCCL communication when sharded across GPUs
  ↓
GPU              the SMs read 16 GB of weights plus KV from HBM
  ↓
Chip             the HBM stacks and the GPU die sit on one interposer in the same package
  ↓
Fab              die area is capped by the exposure field; HBM and advanced-packaging capacity is limited
```

Now back up. The H100 SXM's 3.35 TB/s comes from 5 HBM3 stacks and a 5,120-bit memory interface ([Hopper architecture blog](https://developer.nvidia.com/blog/nvidia-hopper-architecture-in-depth/)). On one such GPU, for a single request to an 8B model in BF16, every step takes at least $16\ {\rm GB}/3.35\ {\rm TB/s}\approx4.8$ ms; even at 100% bandwidth, one user cannot get much more than about 200 tokens per second. To go faster you either read less (quantization, a smaller model), spread the weights over more GPUs, or use more and faster HBM stacks, and that last option leads back to packaging and capacity. Tokens per second is both the product experience and the cost: how many users share each step decides how much GPU time each token costs.

## How this series reads

1. [How chips are made: wafers, process nodes, packaging, and HBM](chips-and-fabs.en.md): what node names mean, the yield arithmetic of large dies, CoWoS and HBM, and why capacity got stuck at packaging
2. [CPU architecture: pipelines, caches, SIMD, and NUMA](cpu-architecture.en.md): how a CPU hides latency, and what it does in an AI server
3. [GPU architecture](gpu-architecture.en.md): how a GPU trades many parallel threads and high-bandwidth memory for throughput
4. [NVIDIA generations](nvidia-generations.en.md): how to read each architecture and its product specifications
5. [CUDA](cuda.en.md): kernels, the thread hierarchy and streams
6. [Performance](performance.en.md): the roofline model, profilers and finding the bottleneck
7. [Frameworks](frameworks.en.md): from one line of PyTorch to kernels on the GPU
8. [Kubernetes](kubernetes.en.md): how GPU clusters are allocated and scheduled
9. [Review questions](review.en.md): interview questions and a self-check
