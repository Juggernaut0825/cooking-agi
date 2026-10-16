# AI 基础设施：一次请求背后的整条链路

**中文** · [English](README.en.md)

> 阅读时间：约 7 分钟 · 草稿，待审核

同一个模型，为什么有时迟迟不出第一个字，有时开头很快、后面却很慢？可能是请求还在排队，也可能是 GPU 正在读权重，或者几张卡在等彼此传数据。这一组笔记沿着一次请求往下看：推理引擎怎样安排工作，框架怎样调用 kernel，芯片和内存又限制了什么。后面的手算例子会把这些时间拆开。

> **待审核草稿。** 这一篇还没有经过站主审阅，事实、取舍和措辞都可能修改；引用前请回到文中链接的一手资料核对。

## 九层地图：从晶圆到产品

表格从制造端排到产品端。想了解全貌可以依次读；已经在排查推理性能，就从第 7 层开始，再沿着瓶颈往下查。“先看哪个数”只是一个排查入口。

| 层 | 做什么 | 通常先看哪个数 | 读哪篇 |
| --- | --- | --- | --- |
| 1 制造与封装 | 在晶圆上做出 die，测试、切割，再和 HBM 一起封装 | 每片晶圆能出多少个好 die；先进封装与 HBM 的产能 | [芯片怎么造出来](chips-and-fabs.md) |
| 2 芯片 | CPU 管控制和数据准备，GPU / 加速器算大矩阵 | 峰值 FLOP/s（注明精度、dense 还是 sparse）与显存带宽之比 | [CPU 架构](cpu-architecture.md)、[GPU 架构](gpu-architecture.md)、[NVIDIA 各代 GPU](nvidia-generations.md) |
| 3 服务器、互联、机柜 | 把 GPU、CPU、网卡连起来：PCIe、NVLink、InfiniBand / Ethernet；供电与散热 | 每张卡的卡间带宽，分清节点内和节点间，分清 GB/s 和 Gb/s | [NVIDIA 各代 GPU](nvidia-generations.md)、[多卡训练](../06-systems/distributed-training.md) |
| 4 集群软件与调度 | 驱动、CUDA runtime、容器，Kubernetes / Slurm 把 GPU 分给任务 | 分出去的 GPU 有多少时间真在算：排队时间、空闲率 | [CUDA](cuda.md)、[Kubernetes](kubernetes.md) |
| 5 kernel 与库 | cuBLAS 做矩阵乘，cuDNN 提供常见 DNN 算子，NCCL 做集合通信，Triton 写自定义 kernel | 达到峰值的百分比；算术强度落在屋脊点哪一边 | [CUDA](cuda.md)、[性能](performance.md)、[attention kernel](../00-foundations/deep-dives/attention-kernels.md) |
| 6 框架 | PyTorch 把模型代码变成一串 kernel；编译器做融合；分布式训练切分状态 | 单步耗时、MFU（实际算力占峰值的比例）、CPU 发射 kernel 的开销 | [框架](frameworks.md)、[训练框架](../06-systems/training-frameworks.md)、[张量并行](../06-systems/tensor-parallel.md) |
| 7 训练与推理系统 | serving engine 排队、组 batch、管 KV cache；训练系统管数据、checkpoint 和恢复 | TTFT、token 间隔（ITL）、满足延迟目标时的 tokens/s | [一次请求怎样跑完](../06-systems/llm-serving.md)、[vLLM 与 SGLang](../06-systems/inference-frameworks.md)、[推理导读](../learn/inference/README.md) |
| 8 模型 | 参数量和结构决定每个 token 要算多少、读多少 | 权重字节数；每个 token 的 KV 字节数 | [KV cache](../00-foundations/deep-dives/kv-cache-and-inference.md)、[精度与显存](../00-foundations/deep-dives/precision-and-memory.md) |
| 9 产品 | 用户看到的回答、延迟和账单 | 延迟目标，每次请求的成本 | [现代 AI 系统](../06-systems/README.md) |

表里的库名各有官方文档：[cuBLAS](https://docs.nvidia.com/cuda/cublas/)、[cuDNN](https://docs.nvidia.com/cudnn/overview)、[NCCL](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/overview.html)（集合通信，可走 PCIe、NVLink、InfiniBand 和 socket）、[Triton](https://triton-lang.org/main/index.html)。调度这一层，[Slurm](https://slurm.schedmd.com/overview.html) 分配节点、排队和启动作业；[Kubernetes](https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/) 靠厂商的 device plugin 把 GPU 报成 `nvidia.com/gpu` 这类资源，写在容器的 `limits` 里申请。

## 一台服务器里，带宽一级比一级少

拿一台具体的机器看第 3 层。据 [NVIDIA DGX H100 用户手册](https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html)，它有 2 颗 Intel Xeon 8480C（各 56 核）、2 TB 内存、8 张 H100、卡间 NVLink 900 GB/s，以及 8 张单口 ConnectX-7 InfiniBand 卡。下面把各条链路换算成**每个方向**的带宽再比：

| 链路 | 每个方向的带宽 | 出处与换算 | 约为 HBM 的 |
| --- | ---: | --- | ---: |
| HBM（单卡 H100 SXM5） | 3,352 GB/s | [H100 架构白皮书 V1.04](https://dam-cdn.nvd.orangelogic.com/AssetLink/705n6ur546g0uk43w0117r17n8042d73.pdf)（[产品页](https://www.nvidia.com/en-us/data-center/h100/)写 3.35 TB/s）；读写共用，不分方向 | 1 |
| NVLink（每卡） | 450 GB/s | [Hopper 架构博客](https://developer.nvidia.com/blog/nvidia-hopper-architecture-in-depth/)：18 条链路共 900 GB/s，每条每方向 25 GB/s | 1/7 |
| PCIe Gen5 x16 | 64 GB/s | 同一博客：共 128 GB/s，每方向 64 GB/s | 1/52 |
| InfiniBand NDR（一个端口） | 50 GB/s | [ConnectX-7 数据手册](https://www.nvidia.com/content/dam/en-zz/Solutions/networking/infiniband/connectx-7-datasheet.pdf)：400 Gb/s，除以 8 位 | 1/67 |

厂商常把双向加起来报（900、128），网络则按比特报（400 Gb/s）。不换算就比，会差出 2 倍甚至 16 倍。换算以后能看到：每往外走一层，带宽就少好几倍，从 HBM 到网卡差了近两个数量级。所以通信最频繁的切分更适合放在带宽最高的那一层，见[多卡训练](../06-systems/distributed-training.md)和[张量并行](../06-systems/tensor-parallel.md)。

## 手算一次聊天请求

下面全是**教学假设**，只为让数量级可以手算，不是任何产品的实测：

| 假设 | 取值 |
| --- | --- |
| 模型 | 8B 参数的 dense 模型，BF16（每参数 2 字节），权重 $B_W=16$ GB |
| 结构 | 32 层，hidden size 4096，8 个 KV head，head dim 128；每 token 的 KV 是 $2\times32\times8\times128\times2$ 字节 = 128 KiB |
| 请求 | prompt 2,000 tokens（system prompt、历史和问题），输出 300 tokens，单独一个请求 |
| GPU | 峰值 $F=1{,}000$ TFLOP/s（dense BF16），显存带宽 $BW=3$ TB/s |
| 实际效率 | prefill 达到峰值算力的 $\eta_F=50\%$；decode 达到峰值带宽的 $\eta_B=70\%$ |
| GPU 以外 | 网络和网关 40 ms，套模板加 tokenize 2 ms，排队 50 ms |

GPU 一行取了整数，和 H100 SXM5 同一量级：按白皮书 V1.04（封面注明已含最终频率和 TFLOPS），它的 dense BF16（FP32 累加）是 989.4 TFLOPS，显存 3,352 GB/s。产品页上的 BF16 1,979 TFLOPS 注明“with sparsity”，是 2:4 稀疏数字；2022 年架构博客里的 1,000 TFLOPS、3,000 GB/s 是当时标明的初步规格。口径怎样对齐，见 [NVIDIA 各代 GPU](nvidia-generations.md)。

一个 $N$ 参数的 decoder 每处理 1 个 token，前向大约做 $2N$ 次浮点运算（[Kaplan 等，2020，§2.1](https://arxiv.org/abs/2001.08361)）。另外还要算 attention 的 $QK^\top$ 和 $AV$：每个 query 大约是 $4n_{\rm layer}n_{\rm ctx}d_{\rm model}$ FLOPs，乘法和加法各算一次。对 2,000-token 的 causal prefill，平均可见上下文约为 1,000，增加约 3.3%。这里先忽略它、激活值读写和 kernel 调度，只估主要项：

$$
t_{\rm prefill}\approx\frac{2NP}{\eta_F F},\qquad
t_{\rm token}\approx\frac{B_W+B_{\rm KV}}{\eta_B\,BW}.
$$

$P$ 是 prompt 长度，$B_{\rm KV}$ 是这一步要读的 KV 字节数。代进去：

- **Prefill**：$2\times8\times10^9\times2000=3.2\times10^{13}$ 次运算，除以 $0.5\times10^{15}$ FLOP/s，得 64 ms。若权重在这个 batch 内充分复用，16 GB 权重按读一遍估算约 7.6 ms；在这套简化条件下，计算时间更长。实际 kernel 的分块可能带来重复读取。
- **Decode 每一步**：只做 $1.6\times10^{10}$ 次运算，按 50% 峰值只要 0.032 ms；但要把 16 GB 权重和最多 0.3 GB KV 都读一遍，按 2.1 TB/s 约 7.8 ms，所以带宽是瓶颈。

换一个角度看：只按权重流量计算，prefill 每读 1 字节做约 2,000 次运算，decode 只做约 1 次；这块教学 GPU 的“屋脊点”是 $10^{15}/(3\times10^{12})\approx333$ FLOP/字节（H100 SXM5 按上面的规格是 $989.4/3.352\approx295$）。Roofline 在这里给出两种上限：低算术强度先遇到带宽上限，高算术强度先遇到计算上限。实际运行还可能受调度、通信或算子形状限制。[Pope 等（2022）](https://arxiv.org/abs/2211.05102)也指出（[§2 讲显存开销的一段](https://arxiv.org/html/2211.05102v1#S2.SS0.SSS0.Px1)）：“At small batch sizes and sequence lengths, the time to load weights dominates”，即 batch 和序列都小时，读权重的时间占主导。

| 阶段 | 在哪一层 | 教学估计 | 主要受什么限制 |
| --- | --- | ---: | --- |
| 网络、网关、鉴权 | 产品、服务 | 40 ms | 网络往返 |
| 套模板、tokenize | CPU | 2 ms | CPU |
| 排队 | serving engine | 50 ms | 负载与调度 |
| Prefill 2,000 tokens，得到第 1 个 token | GPU | 64 ms | 算力 |
| **首 token 时间（TTFT）** | | **约 156 ms** | |
| Decode 余下 299 个 token | GPU | 299 × 7.8 ms ≈ 2.3 s | HBM 带宽 |
| **合计** | | **约 2.5 s** | decode 约占 94% |

如果 32 个差不多的请求一起 decode，权重每步只读一次，大家共用：每步读 16 GB 权重加 32 份 KV（按每份最多 0.3 GB 算，约 9.6 GB），共约 25.6 GB，一步约 12.2 ms。每个用户的 token 间隔从 7.8 ms 变成 12.2 ms，但总吞吐从约 129 tokens/s 涨到约 2,600 tokens/s，大约 20 倍。这时 KV 已经占了每步读取量的 38%；Pope 等也指出，batch 和序列一长，读 KV 的时间会超过读权重。这就是 serving engine 要组 batch、又要精打细算 KV 的原因，见[一次请求怎样跑完](../06-systems/llm-serving.md)和 [KV cache](../00-foundations/deep-dives/kv-cache-and-inference.md)。

<!-- paper-figure:pope-cost-latency -->

| 改一个条件 | 会看到什么 | 不能据此推出什么 |
| --- | --- | --- |
| 输出从 300 改成 30 tokens | 总时间约 0.38 s，prefill 和排队的占比明显上升 | 短回答的产品一定受算力限制 |
| 权重换成 1 字节一个参数（如 FP8） | decode 每步读约 8.3 GB，约 4 ms | 质量不变，或 kernel 一定能跑到同样的带宽利用率 |
| batch 从 1 加到 32 | 吞吐约 20 倍，单个用户反而变慢 | batch 越大越好；KV 显存和带宽会先用完 |
| prompt 从 2,000 加到 20,000 | 按 $2N$ 算 prefill 约 640 ms，KV 约 2.6 GB | $2N$ 公式还够用；此时 attention 项约多出 33%，不能再忽略 |

<details markdown="1">
<summary>自己算一下：prompt 变长后，attention 多花了多少计算？</summary>

每层 attention 都要算一次 $QK^\top$ 和一次 $AV$。如果 kernel 能跳过 causal mask 上方的区域，长度为 $P$ 的 prompt 一共需要处理 $P(P+1)/2$ 对位置。下面只算这两个矩阵乘，不含 softmax、投影层和实际运行开销：

```python
parameters = 8_000_000_000
layers = 32
hidden_size = 4096
for prompt_tokens in (2000, 20000):
    causal_pairs = prompt_tokens * (prompt_tokens + 1) // 2
    attention_flops = 4 * layers * hidden_size * causal_pairs
    linear_flops = 2 * parameters * prompt_tokens
    print(f"{prompt_tokens}: {attention_flops / linear_flops:.1%}")
```

结果是 `2000: 3.3%` 和 `20000: 32.8%`。这里的百分比，是 attention 两个矩阵乘相对于 $2NP$ 的额外计算量，不是总延迟增加的比例。若先算完整方阵再做 mask，计算量还会更高；真实耗时仍要测。

</details>

## 沿着一步 decode 往下走，再走回来

```text
产品        用户等的是“下一个字什么时候出来”
  ↓
推理引擎    把 32 个请求排进同一步，找到各自的 KV 位置
  ↓
框架        PyTorch 跑一次前向；CUDA Graph 减少 CPU 逐个发射 kernel 的开销
  ↓
kernel      矩阵乘（cuBLAS 等）、attention kernel；多卡切分时还有 NCCL 通信
  ↓
GPU         SM 从 HBM 读出 16 GB 权重和 KV
  ↓
芯片        HBM 堆栈和 GPU die 封装在同一块 interposer 上
  ↓
工厂        die 面积受单次曝光视场限制；HBM 和先进封装的产能有限
```

再往回走：H100 SXM5 的 3,352 GB/s，来自 5 个 HBM3 堆栈和 5,120 位宽的显存接口（白皮书 V1.04、[Hopper 架构博客](https://developer.nvidia.com/blog/nvidia-hopper-architecture-in-depth/)）。在一张这样的卡上，单请求、BF16 的 8B 模型，若每次前向只生成一个 token、每步都从 HBM 完整读取权重，权重读取至少要 $16\ {\rm GB}/3.352\ {\rm TB/s}\approx4.8$ ms，带宽 100% 用满时，对应约 210 tokens/s 的权重读取上限。这是普通逐 token 解码的估算；一次验证多个候选 token 的推测解码，不适用这个逐 token 上限。想再快，要么少读（量化、更小的模型），要么多卡分摊权重，要么换更多、更快的 HBM 堆栈；最后一条又回到封装和产能。每秒 token 数是产品体验，也是成本：同一步里能塞进多少用户，决定了每个 token 摊到多少 GPU 时间。

## 这一组怎么读

1. [芯片怎么造出来：晶圆、制程、封装与 HBM](chips-and-fabs.md)：节点名说明什么，一片晶圆的良率账与 chiplet，CoWoS 和 HBM，出货为什么受逻辑 die、封装、HBM 三样产能共同限制
2. [CPU 架构：流水线、缓存、SIMD 与 NUMA](cpu-architecture.md)：分支预测和缓存怎样减少等待，SIMD/AMX、NUMA 与 Grace，CPU 在 AI 服务器里怎样喂数据、发起 GPU 工作
3. [GPU 架构：SM、warp、内存层级与 Tensor Core](gpu-architecture.md)：warp 分叉与延迟隐藏，各级存储的带宽，Tensor Core 的峰值怎么算，FP8/FP4 的块缩放，NVLink
4. [NVIDIA 各代 GPU：每一代改了什么、为什么](nvidia-generations.md)：读规格表先对齐什么，Volta 到 Rubin 的对比（含官方页面之间的出入），70B 模型要几张卡
5. [CUDA：线程、内存与 kernel](cuda.md)：vector add、访存合并、shared memory 分块、occupancy、stream，以及 cuBLAS、CUTLASS 和 Triton
6. [性能：roofline、算术强度与 MFU](performance.md)：三种操作在屋脊的哪一侧，batch 和 KV 怎样影响 decode，MFU 口径，all-reduce 时间，profiling 顺序
7. [框架这一层：从一行 PyTorch 到 GPU 上的 kernel](frameworks.md)：dispatcher、ATen 与 autograd，eager 的开销，torch.compile、XLA 与 TensorRT，分布式 API 和推理引擎在哪一层
8. [Kubernetes 与 GPU 集群：把卡分给任务](kubernetes.md)：device plugin 与 DRA，MIG/time-slicing/MPS，成组调度与拓扑，和 Slurm 的对比，推理扩容与冷启动
9. [复习题](review.md)：面试题和自检

读完这一组，可以接着读[量化：少存几位，换来什么、丢掉什么](quantization/README.md)（待审核草稿）：权重、激活和 KV cache 各压到几位，省下多少显存和带宽，精度损失怎样测。
