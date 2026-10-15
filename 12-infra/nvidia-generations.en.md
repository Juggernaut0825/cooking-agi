# NVIDIA GPU generations: what each one changed, and why

[中文](nvidia-generations.md) · **English**

> Reading time: ~14 min · Draft, pending review

When you read "the new generation is N times faster", ask three things first: which precision? Dense or sparse? Which SKU, and is it per GPU or per system? **Once those are aligned, what has grown steadily across generations is low-precision Tensor throughput, HBM capacity and the size of the NVLink domain; memory bandwidth has grown too, but more slowly than compute. The number of operations you must do per byte read to saturate compute went from about 140 on the V100 to about 1,900 on the GB300 with NVFP4, so for read-heavy, compute-light work such as large-model decode, generational speedups mostly follow bandwidth.**

> **Draft, pending review.** The site owner has not reviewed this note yet; facts, emphasis and wording may change. Check the primary sources linked in the text before relying on it.

SMs, warps and Tensor Cores are explained in [GPU architecture](gpu-architecture.en.md). Every hardware number here comes from NVIDIA whitepapers, datasheets, product pages and technical blogs, checked on 2026-10-15; shipped and merely announced products are marked separately.

## Before reading a datasheet, align these

| What to align | Example | How this note handles it |
| --- | --- | --- |
| Dense or sparse | The [H100 product page](https://www.nvidia.com/en-us/data-center/h100/) lists BF16 at 1,979 TFLOPS with the footnote "with sparsity"; dense is half. But the [GB300 NVL72 page](https://www.nvidia.com/en-us/data-center/gb300-nvl72/) lists FP4 as 1,440 (sparse) and 1,080 (dense), not a factor of 2 | Compare dense only. Divide by 2 only when the page gives sparse alone and its footnote says dense is half |
| Which SKU and form factor | Both are "H100": the SXM part has 80 GB and 3.35 TB/s; the NVL (PCIe) part has 94 GB and 3.9 TB/s, with lower Tensor throughput | Use SXM or rack parts throughout and say so |
| What is being counted | A [GB200 superchip](https://www.nvidia.com/en-us/data-center/gb200-nvl72/) is 1 Grace CPU plus 2 GPUs; the [HGX page](https://www.nvidia.com/en-us/data-center/hgx/) gives 8-GPU totals | Convert everything to per GPU |
| Preliminary or final | The 2022 [Hopper blog](https://developer.nvidia.com/blog/nvidia-hopper-architecture-in-depth/) gives dense BF16 of 1,000 TFLOPS and memory of 3,000 GB/s, marked preliminary; the [H100 architecture whitepaper V1.04](https://dam-cdn.nvd.orangelogic.com/AssetLink/705n6ur546g0uk43w0117r17n8042d73.pdf) gives the final 989.4 TFLOPS (dense) and 3,352 GB/s, consistent with the product page's 1,979 (sparse) and 3.35 TB/s | Use final specs: whitepaper V1.04 or the current product page |

Official pages also disagree with each other. For Blackwell memory per GPU, the comparison table in the [Blackwell Ultra technical blog](https://developer.nvidia.com/blog/inside-nvidia-blackwell-ultra-the-chip-powering-the-ai-factory-era/) says up to 192 GB, the GB200 page works out to 186 GB, and the [DGX B200](https://www.nvidia.com/en-us/data-center/dgx-b200/)'s 1,440 GB divided by 8 is 180 GB. For Rubin's memory bandwidth and NVLink, different pages give two sets of numbers (see the Rubin section below). Where this happens, the note says which page it uses.

## One comparison table

All throughput figures are dense and per GPU. The B-series figures are converted from HGX or NVL72 system totals.

| Product (form factor) | Process · transistors | SMs | Tensor Cores (new precisions) | Memory · bandwidth | NVLink (per GPU) | Power limit | BF16 | FP8 | FP4 |
| --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: |
| V100 SXM2 (Volta) | TSMC 12 nm FFN · 21.1B | 80 | 1st gen (FP16) | 32 GB HBM2 · 900 GB/s | NVLink 2: 300 GB/s | 300 W | 125 TFLOPS (FP16) | — | — |
| A100 80GB SXM (Ampere) | TSMC N7 · 54.2B | 108 | 3rd gen (TF32, BF16, 2:4 sparsity) | 80 GB HBM2e · 2,039 GB/s | NVLink 3: 600 GB/s | 400 W | 312 TFLOPS | — | — |
| H100 SXM (Hopper) | TSMC 4N · 80B | 132 | 4th gen (FP8) | 80 GB HBM3 · 3,352 GB/s | NVLink 4: 900 GB/s | 700 W | 989.4 TFLOPS | 1,978.9 TFLOPS | — |
| H200 SXM (Hopper) | TSMC 4N · 80B | — | 4th gen | 141 GB HBM3e · 4.8 TB/s | NVLink 4: 900 GB/s | 700 W | 989.4 TFLOPS | 1,978.9 TFLOPS | — |
| B200 (HGX B200) | TSMC 4NP · 208B (2 dies) | — | 5th gen (FP6, FP4) | 180 GB HBM3e · 8 TB/s | NVLink 5: 1.8 TB/s | up to 1,200 W* | 2.25 PFLOPS | 4.5 PFLOPS | 9 PFLOPS |
| GB200 (each GPU in NVL72) | Same | — | 5th gen | 186 GB HBM3e · 8 TB/s | NVLink 5: 1.8 TB/s | up to 1,200 W* | 2.5 PFLOPS | 5 PFLOPS | 10 PFLOPS |
| B300 (HGX B300, Blackwell Ultra) | TSMC 4NP · 208B (2 dies) | up to 160 | 5th gen (faster NVFP4) | about 262 GB HBM3e · 8 TB/s | NVLink 5: 1.8 TB/s | up to 1,400 W* | 2.25 PFLOPS | 4.5 PFLOPS | 13.5 PFLOPS |
| GB300 (each GPU in NVL72) | Same | up to 160 | Same | about 278 GB HBM3e · 8 TB/s | NVLink 5: 1.8 TB/s | up to 1,400 W* | 2.5 PFLOPS | 5 PFLOPS | 15 PFLOPS |
| Rubin (announced, see below) | Process not disclosed · 336B (2 dies) | 224 | Generation not stated; 3rd-gen Transformer Engine | 288 GB HBM4 · 22 TB/s (19.2 on another page) | NVLink 6: 3.6 TB/s (3 on another page) | Not disclosed | 4 PFLOPS | 17.5 PFLOPS | 35 PFLOPS (NVFP4 training) |

Sources by row: V100 from the [Volta whitepaper](https://images.nvidia.com/content/volta-architecture/pdf/volta-architecture-whitepaper.pdf) and the [V100 datasheet](https://images.nvidia.com/content/technologies/volta/pdf/volta-v100-datasheet-update-us-1165301-r5.pdf) (the SXM2 also came in 16 GB); A100 from the [Ampere blog](https://developer.nvidia.com/blog/nvidia-ampere-architecture-in-depth/) and the [A100 datasheet](https://www.nvidia.com/content/dam/en-zz/Solutions/Data-Center/a100/pdf/nvidia-a100-datasheet-us-nvidia-1758950-r4-web.pdf); H100 from whitepaper V1.04 (final specs) and the product page; H200 from the [H200 product page](https://www.nvidia.com/en-us/data-center/h200/) (which does not list an SM count), whose Tensor rows match the H100 SXM product page exactly, so the whitepaper's 989.4 / 1,978.9 carry over, with process and transistors taken from the Blackwell Ultra blog's Hopper column; B200 memory and bandwidth converted from the DGX B200's 8-GPU totals of 1,440 GB and 64 TB/s, and its throughput from the HGX page; GB200 as the NVL72 page's superchip figures divided by 2; B300 memory as the [DGX B300](https://www.nvidia.com/en-us/data-center/dgx-b300/)'s 2.1 TB divided by 8, GB300 as the NVL72's 20 TB divided by 72, with bandwidth and SM count ("up to 160, varies by SKU") from the Blackwell Ultra blog; Rubin is covered below.

\* The Blackwell and Blackwell Ultra power figures come from the generational comparison table in the Blackwell Ultra blog ("up to", TGP), which does not say which SKU they refer to; the HGX and DGX pages give only system power, for example about 14.3 kW for a DGX B200. Per the GB200 press release, a GB200 holds two B200 GPUs; yet the HGX B200 and GB200 have different per-GPU throughput (2.25 versus 2.5 PFLOPS BF16), so the same GPU is specified differently in different products.

## What each generation changed

### Volta (V100, 2017): Tensor Cores arrive

The Volta whitepaper (August 2017 edition) introduced the first Tensor Cores: each performs one 4×4×4 FP16 multiply-accumulate per clock with FP32 accumulation, and the V100 has 640 of them. On the same card, the ordinary FP32 peak is 15.7 TFLOPS and the Tensor peak is 125 TFLOPS. The whitepaper's reasoning is that matrix multiplication is at the core of neural network training and inference, and purpose-built Tensor Cores with their data paths raise floating-point throughput dramatically at high energy efficiency. The same generation brought second-generation NVLink (6 links, 300 GB/s in total) and independent thread scheduling.

### Ampere (A100, 2020): Tensor Cores for FP32 code too

The A100 was announced in May 2020 (Ampere blog). Third-generation Tensor Cores added three things. TF32 reads FP32 data and computes with FP32 range and reduced internal precision, so training code written in FP32 can use Tensor Cores without changing formats; BF16 runs at the same rate as FP16 but has as many exponent bits as FP32, so it is less prone to overflow in training (the trade-off is in [Precision and memory](../00-foundations/deep-dives/precision-and-memory.en.md)); 2:4 structured sparsity doubles throughput for matrices that satisfy it, and from this generation on, datasheets list Tensor figures in separate dense and sparse columns. Beyond that, L2 grew to 40 MB, NVLink moved to its third generation (600 GB/s), and MIG can split one card into up to 7 isolated instances.

### Hopper (H100 2022, H200 2023): FP8 and the Transformer Engine

The H100 was announced in March 2022 (Hopper blog). Fourth-generation Tensor Cores double the A100's per-SM 16-bit MMA rate and quadruple it with FP8. FP8 comes as E4M3 and E5M2; with only 8 bits, its range is much narrower than 16-bit formats, so the Transformer Engine arrived alongside it: it gathers statistics on each layer's outputs, decides between FP8 and 16 bits, and rescales values dynamically into the representable range. This generation also added TMA, thread block clusters and distributed shared memory, all aimed at making data movement asynchronous (see [GPU architecture](gpu-architecture.en.md)). Memory moved to HBM3 (final value 3,352 GB/s in whitepaper V1.04), NVLink to its fourth generation (900 GB/s), and the power limit to 700 W.

The H200 was announced at SC23 on 13 November 2023, and NVIDIA called it the first GPU with HBM3e ([press release](https://nvidianews.nvidia.com/news/nvidia-supercharges-hopper-the-worlds-leading-ai-computing-platform)). On the product pages, every Tensor row of the H200 SXM matches the H100 SXM exactly; only memory changed, to 141 GB and 4.8 TB/s. **Same compute, more memory capacity and bandwidth**; the worked example below shows why such an upgrade matters for decode.

### Blackwell (B200 / GB200, 2024): two dies, FP4 and NVL72

Blackwell was announced at GTC on 18 March 2024 ([press release](https://nvidianews.nvidia.com/news/nvidia-blackwell-platform-arrives-to-power-a-new-era-of-computing)). The [architecture page](https://www.nvidia.com/en-us/data-center/technologies/blackwell-architecture/) states 208 billion transistors on TSMC 4NP, with two "reticle-limited" dies joined into one GPU by a 10 TB/s chip-to-chip link. The previous three die sizes show why: V100 815 mm², A100 826 mm², H100 814 mm² (each generation's whitepaper and the Hopper blog). A single die could not grow further, so more transistors meant two dies in one package. Process and packaging are in [How chips are made](chips-and-fabs.en.md).

The second-generation Transformer Engine adds FP4 and micro-tensor scaling, i.e. finer-grained scaling. NVFP4, which NVIDIA introduced in June 2025, is a format of this small-block-scaled kind: one FP8 scale per 16 values ([NVFP4 blog](https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/); a worked example is in [GPU architecture](gpu-architecture.en.md)). Fifth-generation NVLink gives 1.8 TB/s per GPU and can connect up to 576 GPUs. GB200 NVL72 puts 36 Grace CPUs and 72 Blackwell GPUs in one liquid-cooled rack that forms a single NVLink domain with 130 TB/s in total.

### Blackwell Ultra (B300 / GB300, 2025): gains concentrated in NVFP4 and attention

Blackwell Ultra was announced at GTC on 18 March 2025, with partner products expected from the second half of 2025 ([press release](https://nvidianews.nvidia.com/news/nvidia-blackwell-ultra-ai-factory-platform-paves-way-for-age-of-ai-reasoning)). As of October 2026, an HGX page footnote says both HGX B300 and B200 are shipping, and the GB300 NVL72 page is headed "Available Now".

Transistors, process and die count match Blackwell; what changed is the allocation (Blackwell Ultra blog): dense NVFP4 rises from 10 to 15 PFLOPS; throughput for the exponentials that softmax in attention needs doubles; memory goes up to 288 GB; the power limit is 1,400 W. The cost is visible too. On the HGX page, the 8-GPU HGX B300 and HGX B200 have the same BF16 and FP8 (36 and 72 PFLOPS sparse), but INT8 drops from 72 POPS to 3 POPS (both sparse figures) and FP64 from 296 TFLOPS to 10 TFLOPS; in the [compute capability tables](https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/compute-capabilities.html), the B300's compute capability 10.3 also lists no FP64 Tensor Core input type. **This generation did not raise BF16 or FP8; its gains are concentrated in NVFP4, memory capacity and softmax exponentials, while most FP64 and INT8 throughput was cut.**

Memory is stated three ways: the blog says up to 288 GB; the DGX and HGX B300 pages say 2.1 TB for 8 GPUs, about 262 GB each; the GB300 NVL72 page says 20 TB for 72 GPUs, about 278 GB each. The pages do not explain the difference.

### Rubin / Vera Rubin (announced): HBM4 and NVLink 6

First, the timeline:

- GTC keynote, 18 March 2025 ([NVIDIA blog recap](https://blogs.nvidia.com/blog/nvidia-keynote-at-gtc-2025-ai-news-live-updates/)): Vera Rubin NVL144 in the second half of 2026, Rubin Ultra systems in the second half of 2027.
- CES, 5 January 2026 ([press release](https://nvidianews.nvidia.com/news/rubin-platform-ai-supercomputer)): NVIDIA said Rubin was "in full production", with partner products in the second half of 2026; the rack was now called Vera Rubin NVL72, with 72 Rubin GPUs and 36 Vera CPUs.
- GTC, 16 March 2026 ([press release](https://nvidianews.nvidia.com/news/nvidia-vera-rubin-platform)): a seventh chip, the Groq 3 LPU, joined the platform, and partner products were still due from the second half of the year. The [Vera Rubin POD blog](https://developer.nvidia.com/blog/nvidia-vera-rubin-pod-seven-chips-five-rack-scale-systems-one-ai-supercomputer/) of the same day described Rubin Ultra (scaling to 576 GPUs) and the Kyber rack with 144 GPUs per rack, and mentioned Kyber later serving NVIDIA Feynman, all without dates.
- GTC Taipei, 31 May 2026 ([press release](https://nvidianews.nvidia.com/news/vera-rubin-full-production-agentic-ai-factory)): production shipments set to begin "this fall".
- An [NVIDIA blog post](https://blogs.nvidia.com/blog/vera-cpu-delivery/) updated on 27 August 2026: AWS received its first Vera CPU server and Vera Rubin GPU.

As of October 2026, the [Vera Rubin NVL72 product page](https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/) is headed "Available Now", but I found no primary source confirming broad volume supply, so the table marks Rubin as "announced", and its numbers are NVIDIA's published specifications, not measurements after delivery.

The [Rubin GPU architecture blog](https://developer.nvidia.com/blog/inside-nvidia-rubin-gpu-architecture-powering-the-era-of-agentic-ai/) (21 July 2026) gives 336 billion transistors, two compute dies, 224 SMs and up to 288 GB of HBM4, without naming the process. Throughput comes from the HGX and NVL72 pages: NVFP4 training 35, FP8 17.5 and BF16 4 PFLOPS, all marked dense; the frequently quoted "50 PFLOPS of NVFP4 inference" is marked sparse on those two pages, while the [platform blog](https://developer.nvidia.com/blog/inside-the-nvidia-rubin-platform-six-new-chips-one-ai-supercomputer/) attributes it to "adaptive compression" in the third-generation Transformer Engine without saying dense or sparse.

Two sets of numbers disagree: the CES press release, the platform blog, the GPU blog and the HGX page give per-GPU memory bandwidth of 22 TB/s, NVLink of 3.6 TB/s and 260 TB/s for an NVL72; the Vera Rubin NVL72 product page (read on 2026-10-15) gives 19.2 TB/s, 3 TB/s and 216 TB/s per rack. Once products ship in volume, the product datasheet should be taken as authoritative.

### Workstation and consumer parts: only what matters for ML

| Product | Architecture (compute capability) | Memory · bandwidth | Power | What it means for ML users |
| --- | --- | --- | --- | --- |
| GeForce RTX 4090 | Ada (8.9) | 24 GB GDDR6X · not listed on the page | 450 W | FP8 Tensor Cores; no NVLink |
| GeForce RTX 5090 | Blackwell (12.0) | 32 GB GDDR7 · not listed on the page | 575 W | FP4 and FP6 Tensor Cores; no NVLink |
| RTX PRO 6000 Blackwell Workstation Edition | Blackwell (12.0) | 96 GB GDDR7 (ECC) · 1,792 GB/s | 600 W | One card holds the 70 GB of FP8 weights of a 70B model, but its bandwidth is about half an H100 SXM's, so by the method below each token takes at least about 39 ms |
| DGX Spark (GB10) | Blackwell (12.1) | 128 GB unified LPDDR5x · 273 GB/s | 140 W for the GB10 chip | Holds large models, but bandwidth is low (see the worked example below) |

Sources: the [RTX 4090](https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4090/), [RTX 5090](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/), [RTX PRO 6000](https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000/) and [DGX Spark](https://www.nvidia.com/en-us/products/workstations/dgx-spark/) product pages; compute capabilities from the [CUDA GPUs list](https://developer.nvidia.com/cuda-gpus); supported Tensor Core types from the compute capability tables. Three cautions. First, the "AI TOPS" on consumer pages (1,321 for the RTX 4090, 3,352 for the RTX 5090) state neither precision nor sparsity, so they cannot be compared with data-centre dense figures; the RTX PRO 6000's 4,000 AI TOPS carries a footnote saying FP4 with sparsity. Second, without NVLink, multi-GPU traffic goes over PCIe. Third, "Blackwell" at 12.x is not the same as the data-centre 10.0: in the compute capability tables, 12.x allows at most 100 KB of shared memory per SM (228 KB on 10.0), and code compiled for an architecture-specific target such as sm_100a runs only on that exact compute capability.

## Design logic: what kept changing

Divide each generation's dense peak at its lowest precision by memory bandwidth and you get "how many operations per byte read are needed to saturate compute". [Performance](performance.en.md) calls this ratio the ridge point:

| Product | Dense peak at lowest precision | Memory bandwidth | FLOPs per byte |
| --- | ---: | ---: | ---: |
| V100 SXM2 | FP16 125 TFLOPS | 0.9 TB/s | 139 |
| A100 80GB SXM | BF16 312 TFLOPS | 2.039 TB/s | 153 |
| H100 SXM | FP8 1,978.9 TFLOPS | 3.352 TB/s | 590 |
| H200 SXM | FP8 1,978.9 TFLOPS | 4.8 TB/s | 412 |
| GB200 (per GPU) | NVFP4 10 PFLOPS | 8 TB/s | 1,250 |
| GB300 (per GPU) | NVFP4 15 PFLOPS | 8 TB/s | 1,875 |
| Rubin (announced) | NVFP4 training 35 PFLOPS | 22 TB/s (or 19.2) | 1,591 (or 1,823) |

Several design threads show up in the table:

1. **Lower precision is the biggest lever.** From V100 FP16 to GB300 NVFP4, the dense peak rose 120×; for 16-bit formats alone (V100 FP16 at 125 versus GB300 BF16 at 2,500 TFLOPS) it is 20×. The remaining factor of about 6 came from narrower formats, and narrower formats only keep their accuracy with the Transformer Engine's scaling: per-tensor statistics in the first generation, micro-blocks in the second, and "adaptive compression" added for Rubin.
2. **Bandwidth grows more slowly than compute.** Over the same span, memory bandwidth went from 0.9 to 8 TB/s, about 9×, so the ridge point keeps rising: to saturate compute, each byte read in must be reused more and more. The H200 is an example in the other direction: same compute as the H100, 43% more bandwidth, and the ridge point falls from 590 to 412.
3. **When one die cannot grow, put two in the package.** Three generations of dies all sit between 814 and 826 mm²; Blackwell and Rubin both moved to two dies with a fast die-to-die link.
4. **NVLink domains keep growing.** Per-GPU NVLink bandwidth rose every generation: 300, 600, 900, 1,800, 3,600 GB/s; the domain grew from one 8-GPU machine to a 72-GPU rack, and the Kyber rack has been announced with 144 per rack. Tensor parallelism communicates at every layer and MoE expert parallelism needs all-to-all, both of which want to stay inside a high-bandwidth domain; see [Tensor parallelism](../06-systems/tensor-parallel.en.md).
5. **More specialized, and more power-hungry.** Blackwell Ultra cut FP64 and INT8; the power limit went from 300 W to 1,400 W, and GB200 NVL72 is a liquid-cooled rack.

## Worked example: how many GPUs a 70B model needs, and the fastest possible token

The [series guide](README.en.md) worked through decode for an 8B model on one card; here we take a 70B-parameter dense model and see how many cards each generation and precision needs. Simplifying assumptions:

- Weights only: BF16 is 2 bytes per parameter, 140 GB in total; FP8 is 1 byte per parameter, 70 GB in total. Capacities are divided as printed on the datasheets, without distinguishing GB from GiB or subtracting what the driver and CUDA context use.
- Batch size 1, one token at a time, each token reads all weights once from HBM; KV cache reads and compute time are ignored.
- With several cards, weights are split evenly and read in parallel, communication takes zero time, and bandwidth runs at 100% of peak.

Then:

$$
n_{\min}=\left\lceil\frac{P\,b}{M}\right\rceil,\qquad
t_{\text{token}}\ \ge\ \frac{P\,b}{n\,B}.
$$

$P=70\times10^9$ is the parameter count, $b$ the bytes per parameter, $M$ the memory per card, $B$ the bandwidth per card, and $n$ the number of cards. For example, BF16 on two H100s: $140\ \text{GB}/(2\times3.352\ \text{TB/s})\approx20.9$ ms, i.e. at most about 48 tokens per second.

| Product | Memory · bandwidth per card | BF16 (140 GB): fewest cards · per-token floor | FP8 (70 GB): fewest cards · per-token floor |
| --- | --- | --- | --- |
| V100 SXM2 | 32 GB · 0.9 TB/s | 5 cards (FP16) · 31.1 ms | No FP8 Tensor Cores |
| A100 80GB SXM | 80 GB · 2.039 TB/s | 2 cards · 34.3 ms | No FP8 Tensor Cores |
| H100 SXM | 80 GB · 3.352 TB/s | 2 cards · 20.9 ms | 1 card (only 10 GB left) · 20.9 ms |
| H200 SXM | 141 GB · 4.8 TB/s | 1 card (almost no headroom) · 29.2 ms; 14.6 ms on 2 cards | 1 card · 14.6 ms |
| B200 (HGX) | 180 GB · 8 TB/s | 1 card · 17.5 ms | 1 card · 8.8 ms |
| B300 (HGX) | about 262 GB · 8 TB/s | 1 card · 17.5 ms | 1 card · 8.8 ms |
| Rubin (announced) | 288 GB · 19.2–22 TB/s | 1 card · 6.4–7.3 ms | 1 card · 3.2–3.6 ms |
| DGX Spark | 128 GB · 0.273 TB/s | Does not fit | 1 unit · 256 ms |

Reading row by row:

- **On H100, FP8 on one card has the same floor as BF16 on two**, 20.9 ms each: halving the bytes is like doubling the bandwidth, and it uses one card fewer.
- **Two A100s (34.3 ms) are slower than five V100s (31.1 ms).** In this model the floor depends only on the group's total bandwidth: 5 × 0.9 = 4.5 TB/s, more than 2 × 2.039 ≈ 4.1 TB/s. More cards also have a cost, namely the communication we ignored.
- **One H200 holds the BF16 weights but is slower than two H100s** (29.2 versus 20.9 ms); it saves cards, not time.
- **B300 and B200 are equally fast at batch 1**, because their bandwidth is the same; the extra memory goes to KV cache and larger batches.
- **DGX Spark holds a 70B model in FP8, but each token takes at least 256 ms**, about 4 tokens per second. Fitting and running fast are different things.

Now check that compute really is not the bottleneck: each token takes about $2P=1.4\times10^{11}$ operations, which the H100 SXM's 989.4 dense BF16 TFLOPS finish in 0.14 ms, more than two orders of magnitude less than the 20.9 ms spent reading weights. Batch-1 decode is deep in bandwidth-bound territory, and serving many requests at once is what puts the compute to use; see [How a request runs](../06-systems/llm-serving.en.md) and [KV cache](../00-foundations/deep-dives/kv-cache-and-inference.en.md).

| Change one condition | What you should see | What you can NOT conclude |
| --- | --- | --- |
| Batch from 1 to 32 | Weights are read once per step and shared by 32 requests; each step also reads 32 sets of KV | Each user's tokens come just as fast |
| Switch to MoE, still 70B total parameters, with only part active per token | Each step reads only the selected experts, so the floor follows the active parameters | Memory shrinks too: all experts still have to fit |
| On H100, tensor parallelism from 2 cards to 8 | The floor in this model drops to a quarter | It really gets 4× faster: every layer needs an all-reduce over NVLink, and that share grows with more cards |
| On B200, FP8 to NVFP4 | Weights become about $70\times10^9\times4.5/8\approx39$ GB, and the floor about 4.9 ms | Model quality is unchanged; check evaluations after quantization |

## What to read next

- The SMs, warps, memory hierarchy and Tensor Cores behind these specs: [GPU architecture](gpu-architecture.en.md).
- How the ridge point tells you whether a kernel is compute-bound or bandwidth-bound: [Performance](performance.en.md).
- Splitting across GPUs and the communication it needs: [Tensor parallelism](../06-systems/tensor-parallel.en.md), [Distributed training](../06-systems/distributed-training.en.md).
