# AI infrastructure: review questions

[中文](review.md) · **English**

> Reading time: ~5 min · Draft, pending review

Interview questions on AI infrastructure tend to land on one chain: how chips are made, how a GPU runs kernels, how a framework launches them, and how a cluster hands out GPUs. **To answer them, first fix the basis (precision, dense or sparse, which SKU), then work out which layer holds the bottleneck and which number limits it.** Every number below comes from the notes in this series, where the derivations and sources are.

> **Draft, pending review.** The site owner has not reviewed this note yet; facts, emphasis and wording may change. Check the primary sources linked in the text before relying on it.

## Interview questions

<details class="interview" markdown="1">
<summary>Why is a process node name such as "7 nm" or "N4" not a physical size? What should you compare when comparing two chips?</summary>

Early node names roughly matched a physical dimension of the transistor; today a node name is closer to the name of a process generation. A 2020 IEEE Spectrum article points out that most of the critical features of a "7 nm" transistor are much larger than 7 nm, that names and dimensions have been disconnected for about two decades, and describes LMC, an alternative metric proposed by Wong and colleagues: logic density, memory density, and the density of connections between them. Vendor figures also need their baseline checked: TSMC calls N4 an enhanced version of N5; N4P's "11% performance boost" is relative to N5; N2P versus N3E is 18% faster at the same power or 36% lower power at the same speed, which usually cannot be had at the same time, and 1.2x logic density and 1.15x chip density are two separate numbers. NVIDIA's 4N and 4NP are custom processes, and no public statement was found on exactly how they differ from TSMC's public N4 family.

So the node name is only a starting point; in the end, compare measured performance, power and cost on the same workload. The physical constraint that really caps a single die is the exposure field: 26 mm × 33 mm, or 858 mm², and the GH100's 814 mm² already takes 95% of it. See [How chips are made](chips-and-fabs.en.md).

</details>

<details class="interview" markdown="1">
<summary>Why is batch-1 decode limited by memory bandwidth? What does a larger batch change, and what does it not change?</summary>

To generate one token, each weight does a single multiply-add (2 FLOP) but costs 2 bytes to read in BF16, an arithmetic intensity of about 1 FLOP per byte; the H100 SXM5's ridge point is its dense BF16 989.4 TFLOPS divided by 3,352 GB/s, about 295. A 7B model's BF16 weights are about $1.4\times10^{10}$ bytes, and reading them once takes at least 4.18 ms, so a single request tops out at about 239 tokens/s, while the arithmetic itself needs only 0.014 ms.

A larger batch shares the weights: they are read once per step, so counting weights only, the intensity is roughly the batch size $B$. While $B$ is below about 295, step time barely changes and throughput grows linearly with $B$ (an upper bound of about 15,300 tokens/s at $B=64$); past that point throughput stops growing and each step just gets slower. What cannot be shared is the KV: every request has its own, and the attention part has an intensity of only about 4 FLOP per byte, independent of the batch. With a 4096-token context and 512 MiB of KV per request, the step lower bound rises from 4.34 ms at $B=1$ to 14.4 ms at $B=64$, and the throughput bound is only about 4,440 tokens/s; at $B=128$ the weights plus KV already take about 77 GiB. KV bandwidth and capacity run out before compute does. See [Performance](performance.en.md#decode-batching).

</details>

<details class="interview" markdown="1">
<summary>What determines a kernel's occupancy? Is higher always better?</summary>

Occupancy is the number of active warps on an SM divided by the maximum number of warps that SM can hold. Whether an SM can take one more block depends on which resource runs out first: at compute capability 9.0 (for example the H100), each SM holds at most 2048 threads (64 warps), 32 blocks, 65,536 32-bit registers and 228 KB of shared memory. With 256 threads per block, 32 registers per thread allows 8 resident blocks, 100% occupancy; 64 registers leaves 4 blocks, 50%; 48 KB of shared memory per block also gives 4 blocks, 50%; 80 registers leaves 3, 37.5%. An exact calculation also accounts for registers being allocated per warp in units of 256 and for 1 KB of shared memory reserved per block; in practice, read the usage with `nvcc --resource-usage`, then check with Nsight Compute or `cudaOccupancyMaxActiveBlocksPerMultiprocessor`.

Occupancy answers "are there enough warps to switch between", not "is this kernel fast". The Best Practices Guide states that beyond some point more occupancy does not make a kernel faster; high-performance matrix multiply kernels often use many registers per thread and run at modest occupancy, hiding the wait with instruction-level parallelism and asynchronous copies (hardware async copy from Ampere, TMA on Hopper). Latency can be hidden; the bandwidth ceiling cannot. See [CUDA](cuda.en.md#occupancy) and [GPU architecture](gpu-architecture.en.md).

</details>

<details class="interview" markdown="1">
<summary>What is memory coalescing, and why does strided access waste bandwidth?</summary>

Global memory is transferred in 32-byte units. When a warp executes one load, the hardware merges the addresses of its 32 threads and issues as many transactions as there are 32-byte segments involved (compute capability 6.0 and later). With each thread reading one float32 and the array aligned: neighboring threads reading neighboring elements touch 4 segments, and all 128 bytes are used; shifting the start by one element touches 5 segments, 80% used; stride 2 uses 50%; at stride 32, neighboring threads are 128 bytes apart and each owns a segment, so 1024 bytes are moved to use 128, or 12.5%. Reading a column of a row-major matrix with at least 32 floats per row produces exactly this. Coalescing does not require thread k to read element k, only that a warp's addresses fall in as few segments as possible.

Segment counts are not time: neighboring warps may use extra data already pulled into cache. The Best Practices Guide measured the shifted copy on a V100 at about 9/10 of the aligned bandwidth, not the 4/5 the segment count suggests. When debugging, look at sectors/request in Nsight Compute: the ideal for 32-bit accesses is 4, and stride 32 gives close to 32. The fix is to make `threadIdx.x` land in the lowest address dimension, which is how the tiled matrix multiply loads its sub-tiles of $A$ and $B$. See [CUDA](cuda.en.md#coalescing).

</details>

<details class="interview" markdown="1">
<summary>How do dense and sparse datasheet numbers differ? What must you align before comparing two GPU generations?</summary>

Sparse figures come from 2:4 structured sparsity, introduced with Ampere: when at most 2 of every 4 values are non-zero, Tensor Core throughput doubles; ordinary dense models do not get that factor. The H100 product page's BF16 figure of 1,979 TFLOPS carries the footnote "with sparsity", and whitepaper V1.04 gives the dense value as 989.4 TFLOPS. But you cannot always divide by 2: the GB300 NVL72 page lists FP4 as 1,440 (sparse) against 1,080 (dense).

Three more things need aligning. SKU and form factor: both are called H100, but the SXM part has 80 GB and 3.35 TB/s and the NVL part has 94 GB and 3.9 TB/s, with lower Tensor throughput. What is being counted: a GB200 superchip is 1 Grace CPU plus 2 GPUs and the HGX page gives 8-GPU totals, so convert to per GPU. Preliminary or final specs: the 2022 Hopper blog gives 1,000 TFLOPS and 3,000 GB/s marked preliminary, while whitepaper V1.04 gives 989.4 TFLOPS and 3,352 GB/s. The "AI TOPS" on consumer pages state neither precision nor sparsity and cannot be compared directly with data-centre dense figures.

Once aligned, look at bandwidth. Taking each generation's dense peak at its lowest precision, from V100 FP16 to GB300 NVFP4 the peak rose 120x while memory bandwidth rose only about 9x, and the ridge point climbed from 139 to 1,875 FLOP per byte. So for read-heavy, compute-light work such as decode, generational speedups mostly follow bandwidth: the H200 has the same compute as the H100 and 43% more bandwidth. See [NVIDIA GPU generations](nvidia-generations.en.md).

</details>

<details class="interview" markdown="1">
<summary>What does MFU measure? How does it differ from GPU utilization in nvidia-smi, and from HFU?</summary>

MFU was proposed in the PaLM paper: observed tokens/s divided by the tokens/s the hardware could theoretically reach at peak compute. The theoretical value counts only the operations required for the forward and backward passes, about $6N$ per token for a dense decoder plus $12LHQT$ for the matrix multiplies inside attention, and **not rematerialization**. HFU counts every operation actually executed, including recomputation; it depends on the implementation and is not suited to comparisons across systems. The paper reports an MFU of 46.2% and an HFU of 57.8% for PaLM 540B on 6144 TPU v4 chips. Utilization in `nvidia-smi` is something else: NVML defines it as the fraction of the sample period during which at least one kernel was running, so 100% says nothing about how much compute is being used.

Change the convention and the number changes. Teaching example: a 7B model on 8 H100 SXM5 GPUs at 72,018 tokens/s gives 38.2% counting $6N$ only, 44.1% with attention, an HFU of 50.9% with full recomputation, and only 19.1% if the sparse peak of 1,978.9 TFLOPS is wrongly used as the denominator. When reporting, state whether attention is counted, which precision the peak refers to, dense or sparse, and whether padding is included in tokens/s. A higher HFU than MFU does not mean the run is faster; recomputation is extra work by definition. See [Performance](performance.en.md#mfu).

</details>

<details class="interview" markdown="1">
<summary>What does torch.compile fuse, and why does that make things faster?</summary>

In eager mode, `y = torch.relu(x @ w + b)` becomes 3 ATen operators and at least 3 kernels. Every operator goes through a Python call, the dispatcher, argument checks, output allocation and kernel submission, and each elementwise operator reads its intermediate result from memory and writes it back. `torch.compile` first has TorchDynamo capture an FX graph (with guards that trigger recompilation when they fail, and a graph break on unsupported Python), AOTAutograd captures the backward pass ahead of time, and TorchInductor generates Triton code for GPUs and fuses kernels automatically. What this series observed on a CPU with PyTorch 2.8.0 was the bias folded into an external `addmm`, followed by one generated ReLU kernel; to see what is generated on a GPU, run with `TORCH_LOGS=output_code` in your own environment.

What it saves is not multiplications. At 4096×4096, BF16 and a teaching bandwidth of 2 TB/s: eager add and relu read and write 128 MiB in total, about 67 µs; one fused bias+ReLU kernel moves 64 MiB, about 34 µs; with both bias and ReLU in the GEMM epilogue there is no extra traffic. At a teaching compute rate of 500 TFLOP/s the GEMM itself takes about 275 µs, so the eager elementwise part costs about 24% of it, and one fusion brings that to about 12%. Reduce $M$ to 8 and the bytes become negligible; the saving is then mostly CPU submissions, and the `reduce-overhead` mode uses CUDA Graphs to turn a whole sequence of submissions into one. The costs are compile time on the first call, recompilation when shapes change, and graph breaks. See [Frameworks](frameworks.en.md).

</details>

<details class="interview" markdown="1">
<summary>Why does distributed training on Kubernetes need gang scheduling?</summary>

The default kube-scheduler finds a node for one Pod at a time, while distributed training can start only when all ranks are present; and GPUs are extended resources that must be integers and cannot be overcommitted. Work it once by hand: three nodes with 8 GPUs each, 24 in total; in order, two 4-GPU jobs arrive, then a 16-GPU training job T16 (2 Pods of 8 GPUs each), then an 8-GPU job T8. The default score looks only at CPU and memory, so the two 4-GPU jobs may land on two different nodes; T16's first Pod takes the third node and its second Pod does not fit, so the half that started holds 8 GPUs while it waits; the other two nodes have 4 free GPUs each but cannot form T8. Only 8 of the 24 GPUs are doing work; if a second T16 arrives, the two jobs may each take one node and wait for each other, which is a deadlock.

Gang scheduling binds nothing if the whole group does not fit: the third node goes to T8 and 16 GPUs are doing work, at the cost of T16 waiting for two whole nodes to free up at once. Add bin-packing on GPUs (MostAllocated with a weight on GPUs) and the two small jobs squeeze onto one node, all 24 GPUs work, and now T8 queues. There is more than one implementation: core Kubernetes gang scheduling is beta in v1.37 and disabled by default; Kueue's `waitForPodsReady` evicts and requeues after a timeout; Volcano uses a PodGroup's `minMember`. Once placed, the job should also be close: with the ranks ordered into a ring by node, the number of cross-node edges equals the number of nodes used. Note also that "gang scheduling" in the Slurm documentation means time-sharing, not this all-or-nothing placement. See [Kubernetes](kubernetes.en.md).

</details>

## Self-check

<div class="taste-check">
  <strong>If you really understand it, you should be able to explain:</strong>
  <ol>
    <li>why, at the same $D_0=0.1$ per cm², a monolithic 800 mm² die gives about 29 good dies per wafer while two 400 mm² halves give 48 pairs, and which costs that arithmetic leaves out;</li>
    <li>why tiling cuts a matrix multiply's global reads from $2n^3$ to $2n^3/T$, yet the Best Practices Guide's V100 example only raises effective bandwidth from 119.9 GB/s to 195.5 GB/s;</li>
    <li>what basis NVLink 900 GB/s, PCIe 128 GB/s and InfiniBand 400 Gb/s are each quoted on, and how far apart HBM and the network card are once all are converted to bytes per direction;</li>
    <li>why, for a 70B model at batch 1, FP8 on one H100 and BF16 on two H100s share the same 20.9 ms per-token floor, and why two A100s are slower than five V100s;</li>
    <li>why, with the busbw values assumed in the text, the same 14 GB of BF16 gradients take only about 1.9% of a step to all-reduce on one 8-GPU node but 18% on two 8-GPU nodes, how much of that DDP buckets can hide, and why tensor parallelism cannot hide it.</li>
  </ol>
</div>

## References

- [NVIDIA H100 Tensor Core GPU Architecture whitepaper V1.04](https://dam-cdn.nvd.orangelogic.com/AssetLink/705n6ur546g0uk43w0117r17n8042d73.pdf): final H100 SXM5 specifications, dense and sparse peaks, memory bandwidth
- [NVIDIA Hopper Architecture In-Depth](https://developer.nvidia.com/blog/nvidia-hopper-architecture-in-depth/): the 2022 architecture blog, with preliminary specs, NVLink and PCIe bandwidth, and FP8
- [NVIDIA Ampere Architecture In-Depth](https://developer.nvidia.com/blog/nvidia-ampere-architecture-in-depth/): TF32, BF16 and 2:4 structured sparsity
- [CUDA Programming Guide](https://docs.nvidia.com/cuda/cuda-programming-guide/index.html): thread hierarchy, memory spaces, occupancy and per-compute-capability limits
- [CUDA C++ Best Practices Guide](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html): coalescing, shared memory tiling, occupancy, overlapping copies with compute
- [Roofline: An Insightful Visual Performance Model for Multicore Architectures](https://doi.org/10.1145/1498765.1498785): Williams, Waterman and Patterson, CACM 2009, the roofline model
- [Efficiently Scaling Transformer Inference](https://arxiv.org/abs/2211.05102): Pope et al., 2022; loading weights dominates at small batch, loading the KV cache at larger batches and longer sequences
- [PaLM: Scaling Language Modeling with Pathways](https://arxiv.org/abs/2204.02311): §4.1 and Appendix B define MFU and HFU
- [Bandwidth optimal all-reduce algorithms for clusters of workstations](https://doi.org/10.1016/j.jpdc.2008.09.002): Patarasuk and Yuan, JPDC 2009, the communication lower bound for ring all-reduce
- [PyTorch 2.14 docs: torch.compiler](https://docs.pytorch.org/docs/2.14/user_guide/torch_compiler/torch.compiler.html): TorchDynamo, AOTAutograd and TorchInductor
- [PyTorch 2.14 docs: CUDA semantics](https://docs.pytorch.org/docs/2.14/notes/cuda.html): asynchronous execution, streams, pinned memory and CUDA Graphs
- [Kubernetes docs: scheduling GPUs](https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/): device plugins and `nvidia.com/gpu`
- [Kubernetes docs: gang scheduling](https://kubernetes.io/docs/concepts/scheduling-eviction/gang-scheduling/): all-or-nothing placement for a group of Pods
- [Kueue](https://kueue.sigs.k8s.io/docs/overview/): job-level queuing, quotas and admission on top of kube-scheduler
- [A Better Way to Measure Progress in Semiconductors](https://spectrum.ieee.org/a-better-way-to-measure-progress-in-semiconductors): IEEE Spectrum, 2020; node names detached from physical size, and the LMC metric
