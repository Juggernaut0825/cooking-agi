# AI 基础设施：一次请求背后的整条链路

**中文** · [English](README.en.md)

> 阅读时间：约 7 分钟 · 草稿，待审核

用户在聊天框里问了一句话，等了一会儿，答案一个字一个字地冒出来。这两三秒花在了哪里，又是谁决定的？**在下面这个手算例子里，九成以上的时间花在逐个生成 token 的 decode 上；而 decode 有多快，主要看 GPU 每秒能从显存（HBM）读多少字节，不是它每秒能做多少次乘法。** 这个系列就从这个数字出发，一层层往下追到芯片和工厂，再走回产品。

> **待审核草稿。** 这一篇还没有经过站主审阅，事实、取舍和措辞都可能修改；引用前请回到文中链接的一手资料核对。

## 九层地图：从晶圆到产品

从下往上读。“先看哪个数”是排查时的第一个问题，不是说这一层只受这一个数限制。

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

几个库名的官方定义：[cuBLAS](https://docs.nvidia.com/cuda/cublas/) 是建在 CUDA runtime 上的 BLAS 实现；[cuDNN](https://docs.nvidia.com/cudnn/overview) 提供 attention、卷积、矩阵乘、归一化等 DNN 算子；[NCCL](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/overview.html) 实现 AllReduce、AllGather、ReduceScatter 等集合通信，可走 PCIe、NVLink、InfiniBand 和 socket；[Triton](https://triton-lang.org/main/index.html) 自称是一门并行编程语言和编译器。调度这一层，[Slurm](https://slurm.schedmd.com/overview.html) 管分配节点、启动作业和排队；[Kubernetes](https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/) 通过厂商的 device plugin 把 GPU 暴露成 `nvidia.com/gpu` 这类资源，在容器的 `limits` 里申请。

## 一台服务器里，带宽一级比一级少

拿一台具体的机器看第 3 层。据 [NVIDIA DGX H100 用户手册](https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html)，它有 2 颗 Intel Xeon 8480C（各 56 核）、2 TB 内存、8 张 H100、卡间 NVLink 900 GB/s，以及 8 张单口 ConnectX-7 InfiniBand 卡。下面把各条链路换算成**每个方向**的带宽再比：

| 链路 | 每个方向的带宽 | 出处与换算 | 约为 HBM 的 |
| --- | ---: | --- | ---: |
| HBM（单卡 H100 SXM） | 3.35 TB/s | [H100 产品页](https://www.nvidia.com/en-us/data-center/h100/)；显存读写共用，不分方向 | 1 |
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

GPU 的取整数字和 H100 SXM 同一量级：产品页标的 BF16 是 1,979 TFLOPS，但脚注写明这是 sparsity 下的数字；NVIDIA 2022 年架构博客的预发布表里，H100 SXM5 的 dense 与 sparse 是 1000/2000，显存 3000 GB/s，和现在产品页的 3.35 TB/s 也不一样。引用时以具体 SKU 的产品页为准，并写清 dense 还是 sparse。

一个 $N$ 参数的 decoder 每处理 1 个 token，前向大约做 $2N$ 次浮点运算（[Kaplan 等，2020，§2.1](https://arxiv.org/abs/2001.08361)）。这里还有一项随上下文增长的 attention 运算 $2n_{\rm layer}n_{\rm ctx}d_{\rm model}$；按平均上下文 1,000 算，约为 $2N$ 的 1.6%，先忽略。于是：

$$
t_{\rm prefill}\approx\frac{2NP}{\eta_F F},\qquad
t_{\rm token}\approx\frac{B_W+B_{\rm KV}}{\eta_B\,BW}.
$$

$P$ 是 prompt 长度，$B_{\rm KV}$ 是这一步要读的 KV 字节数。代进去：

- **Prefill**：$2\times8\times10^9\times2000=3.2\times10^{13}$ 次运算，除以 $0.5\times10^{15}$ FLOP/s，得 64 ms。同一时间里只需把 16 GB 权重读一遍，约 7.6 ms，所以算力是瓶颈。
- **Decode 每一步**：只做 $1.6\times10^{10}$ 次运算，按 50% 峰值只要 0.032 ms；但要把 16 GB 权重和最多 0.3 GB KV 都读一遍，按 2.1 TB/s 约 7.8 ms，所以带宽是瓶颈。

换一个角度看：prefill 每读 1 字节做约 2,000 次运算，decode 只做约 1 次；这块 GPU 的“屋脊点”是 $10^{15}/(3\times10^{12})\approx333$ FLOP/字节。高于它受算力限制，低于它受带宽限制。[Pope 等（2022）](https://arxiv.org/abs/2211.05102)也指出，batch 和序列都小时，读权重的时间占主导。

| 阶段 | 在哪一层 | 教学估计 | 主要受什么限制 |
| --- | --- | ---: | --- |
| 网络、网关、鉴权 | 产品、服务 | 40 ms | 网络往返 |
| 套模板、tokenize | CPU | 2 ms | CPU |
| 排队 | serving engine | 50 ms | 负载与调度 |
| Prefill 2,000 tokens，得到第 1 个 token | GPU | 64 ms | 算力 |
| **首 token 时间（TTFT）** | | **约 156 ms** | |
| Decode 余下 299 个 token | GPU | 299 × 7.8 ms ≈ 2.3 s | HBM 带宽 |
| **合计** | | **约 2.5 s** | decode 约占 94% |

如果 32 个差不多的请求一起 decode，权重每步只读一次，大家共用：每步读 16 GB 权重加 32 份 KV（约 9 GB），共约 25 GB，一步约 11.9 ms。每个用户的 token 间隔从 7.8 ms 变成 11.9 ms，但总吞吐从约 129 tokens/s 涨到约 2,700 tokens/s，大约 21 倍。这时 KV 已经占了每步读取量的三分之一以上；Pope 等也指出，batch 和序列一长，读 KV 的时间会超过读权重。这就是 serving engine 要组 batch、又要精打细算 KV 的原因，见[一次请求怎样跑完](../06-systems/llm-serving.md)和 [KV cache](../00-foundations/deep-dives/kv-cache-and-inference.md)。

| 改一个条件 | 会看到什么 | 不能据此推出什么 |
| --- | --- | --- |
| 输出从 300 改成 30 tokens | 总时间约 0.38 s，prefill 和排队的占比明显上升 | 短回答的产品一定受算力限制 |
| 权重换成 1 字节一个参数（如 FP8） | decode 每步读约 8.3 GB，约 4 ms | 质量不变，或 kernel 一定能跑到同样的带宽利用率 |
| batch 从 1 加到 32 | 吞吐约 21 倍，单个用户反而变慢 | batch 越大越好；KV 显存和带宽会先用完 |
| prompt 从 2,000 加到 20,000 | 按 $2N$ 算 prefill 约 640 ms，KV 约 2.6 GB | $2N$ 公式还够用；此时 attention 项约多出 16%，不能再忽略 |

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

再往回走：H100 SXM 的 3.35 TB/s，来自 5 个 HBM3 堆栈和 5,120 位宽的显存接口（[Hopper 架构博客](https://developer.nvidia.com/blog/nvidia-hopper-architecture-in-depth/)）。在一张这样的卡上，单请求、BF16 的 8B 模型，每步至少要 $16\ {\rm GB}/3.35\ {\rm TB/s}\approx4.8$ ms，即使带宽 100% 用满，单个用户也快不过每秒约 200 个 token。想再快，要么少读（量化、更小的模型），要么多卡分摊权重，要么换更多、更快的 HBM 堆栈；最后一条又回到封装和产能。每秒 token 数是产品体验，也是成本：同一步里能塞进多少用户，决定了每个 token 摊到多少 GPU 时间。

## 这一组怎么读

1. [芯片怎么造出来：晶圆、制程、封装与 HBM](chips-and-fabs.md)：制程名字的含义、大 die 的良率账、CoWoS 和 HBM，以及为什么产能卡在封装
2. [CPU 架构：流水线、缓存、SIMD 与 NUMA](cpu-architecture.md)：CPU 怎样掩盖延迟，以及它在 AI 服务器里负责什么
3. [GPU 架构](gpu-architecture.md)：GPU 怎样用大量并行线程和高带宽显存换吞吐
4. [NVIDIA 各代 GPU](nvidia-generations.md)：各代架构和产品规格怎么读
5. [CUDA](cuda.md)：kernel、线程层级和 stream
6. [性能](performance.md)：屋脊模型、profiler 和找瓶颈
7. [框架](frameworks.md)：从一行 PyTorch 到 GPU 上的 kernel
8. [Kubernetes](kubernetes.md)：GPU 集群怎样分配和调度
9. [复习题](review.md)：面试题和自检
