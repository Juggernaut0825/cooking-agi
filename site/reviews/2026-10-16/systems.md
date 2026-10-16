# Systems / infra / diffusion-LM 高风险复核

日期：2026-10-16。工作目录：`/Users/tianyizhang/Documents/ChatGPT/Job Prep/cooking-agi-full-review-20261016`。

基准：工作开始时 HEAD 为 `c0a75c1`，PR99–102 的合并内容相对 main `02e914a`。下文“原位置”均指 `c0a75c1` 中的中文文件；英文同名 `.en.md` 已同步修正。迁移标题另与 `02e914a` 对照。

**结论：这是重点风险复核，不是整个独占范围的独立来源认证。** 全文读过不等于每条外部数字都重新核过。收到收尾要求后停止扩展审核；未跑全站 build / tests，未跑 GPU、vLLM、SGLang 实机实验。没有提交、push、切分支、reset 或触发 Actions；未修改发布检查单和 expression-review 配置。

## 1. 覆盖边界

下列文件名 stem 均包含 `.md` 和 `.en.md` 两种语言，共 58 个 Markdown 文件。

### 全文精读：24 个文件

- `11-frontier/diffusion-lm/`：`README`、`masked-diffusion`、`decoding-and-speed`、`review`，8 个文件。逐段检查目标、例子、速度推导、双语、草稿提示与来源陈述；不是逐条完成时间线和所有厂商 benchmark 的来源认证。
- `12-infra/quantization/`：`README`、`formats-and-error`、`weight-only-and-ptq`、`fp8-and-kv-cache`、`checking-quality`、`review`，12 个文件。重点回查零点、浮点编码、GPTQ 更新集合、混合精度 roofline、KV 量化和质量评测解释；不是逐条复核全部论文表格。
- `12-infra/README`，2 个文件。读当前内容并对照上一轮对应文件，整合开头、带前提的速度上界和 attention FLOPs 修正，保留当前 PR102 量化入口。
- `06-systems/inference-frameworks`，2 个文件。读完整请求路径、并行部署、prefix reuse、HiCache、benchmark 和面试段落；本轮外部来源重点核查 vLLM 的 prefix-match 粒度和 MoE 分片范围，未独立验证整个 vLLM/SGLang 功能矩阵。

### 片段精读 / diff-only：4 个文件，不能算全文审核

- `12-infra/performance`：英文选读 roofline、decode/KV、MFU、通信和 profiling 段落；中文重点定位 decode/KV 容量段。修正 GB/GiB 比较。不宣称双语全文精读或 profiling API 版本认证。
- `06-systems/distributed-training`：只对照部署段迁移 diff、相关旧标题及当前转接段；恢复两个旧标题入口。没有重新审核训练同步、ZeRO、TP、PP、恢复训练的完整推导。

### 自动清单 / 关键词或截断 diff 扫描，不构成正文审核：30 个文件

以下页面仅做路径清单、部分关键词命中或在整体 diff 输出中见到片段；正文仍按**未审核**处理：

- `06-systems/README`、`agent-observability`、`decision-support`、`human-in-the-loop`、`llm-serving`、`tensor-parallel`、`training-frameworks`：14 个文件。
- `12-infra/chips-and-fabs`、`cpu-architecture`、`cuda`、`frameworks`、`gpu-architecture`、`kubernetes`、`nvidia-generations`、`review`：16 个文件。

没有把因输出截断而未看到的正文计入全文覆盖。没有做视觉渲染 QA；保留现有 widget、paper-figure、图形结构和草稿标记。

## 2. 实质问题、修复和证据

### S01 — attention FLOPs 少算一半

- 原位置：`12-infra/README.md:57`、`:90`，以及英文对应段。
- 原因：只计了一个 attention 矩阵乘，漏掉加权求和；把 2K/20K prompt 的附加工作写成约 1.6%/16%。
- 修复：同时计 `QK^T` 和 `AV`，每个 query-context 对为 `4 * layers * hidden` FLOPs；因果 prefill 使用 `P(P+1)/2` 个位置对。保留三角跳过、softmax/投影和 runtime 不在此项内等条件。
- 来源：[NVIDIA GEMM 运算计数](https://docs.nvidia.com/deeplearning/performance/dl-performance-matrix-multiplication/index.html)，并从本文两个矩阵乘直接推导。
- 验证：导入上一轮获准的 `test_infra_intro.py`；中英文折叠代码相同且执行输出 `2000: 3.3%`、`20000: 32.8%`；另枚举小长度因果位置对验证闭式公式。保留 PR102 量化入口。

### S02 — affine 整数零点不一定落在码域内；零张量例子除零

- 原位置：`12-infra/quantization/formats-and-error.md:24`、`:144`。
- 原因：直接用原始 min/max 算整数 zero-point，输入 `[1,2]` 得到负零点，不满足前文“实数 0 对应可表示码值”的定义；对称 helper 对全零输入除零。
- 修复：范围先扩到包含 0，零点限制在码域内；全零 scale 取 1；新增可执行 affine helper，并拒绝空向量 / 非法最低位数。MSE helper 也不再默默 zip 截断。
- 来源：[Jacob 等，§2.1](https://arxiv.org/pdf/1712.05877)。KIVI 的浮点最小值 offset 与这个整数 zero-point 不是同一定义，见 S07。
- 验证：正区间、负区间、跨零、全零均回归，检查码域、零点、误差界和非零 scale。

### S03 — outlier MSE 换了分母，却继续比较倍数

- 原位置：`12-infra/quantization/formats-and-error.md:52`，`review` 对应答案。
- 原因：原始 `0.0042` 按 8 个权重平均，替换后的 `0.296` 却只按另外 7 个平均，“七十倍”不可比。
- 修复：全部 8 个为 `0.0042 → 0.2592`，约 `61.7×`；只看未替换的 7 个才是 `0.0048 → 0.29623`。分组结果也区分 8 个和 7 个分母。
- 来源：本文明确列出的权重和舍入公式，属于可独立复算的教学算术，不借论文实验背书。
- 验证：执行正文量化函数，确认 `0.2592`、`61.7143`、`0.29623`。

### S04 — FP8 相对误差界和 FNUZ 重解释缺少边界

- 原位置：`12-infra/quantization/formats-and-error.md:85`、`:91`、`:104`，`review` 对应答案。
- 原因：约 6.25% 的界只适用于无溢出的正规数区域；小数舍为 0 可达 100% 相对误差。把 FN payload 的 scale 加倍不是通用格式转换：负零与 NaN 编码不同。
- 修复：区分正规 / 次正规范围，说明相邻格距随 significand 变化；仅对共有的有限非零码允许按 `x=sq` 重解释后 scale×2，单独处理 `0x80`、`0x7f`、`0xff`，并说明 inverse-scale 约定方向相反。
- 来源：[ONNX float8 编码表](https://onnx.ai/onnx/technical/float8.html)。
- 验证：枚举两种 E4M3 的共同有限非零编码，验证二倍关系；验证 FNUZ 的 `0x80=NaN`、`0x7f=240` 与 FN 的 NaN；验证舍零误差反例。

### S05 — FP8 峰值翻倍不等于混合精度模型吞吐翻倍

- 原位置：`12-infra/quantization/weight-only-and-ptq.md` 的 batch 账 / “算力上限”段，约第 34–43 行；`review` 对应答案。
- 原因：已经声明 0.5B 输出头保留 BF16，却在解释中把整模型按 FP8 峰值算。表里的 116,405 tok/s 与“翻倍”的 prose 不一致。
- 修复：明确计算时间为 `2*7.5e9/1978.9e12 + 2*0.5e9/989.4e12 = 8.591 μs`，上界约 116,405 tok/s，比 BF16 高约 88%，不是 100%。同时说明 RTN 不一定需要校准、SmoothQuant 不是所有 8-bit 方法的前置步骤。
- 来源：[NVIDIA H100 产品规格](https://www.nvidia.com/en-us/data-center/h100/)核对 sparse/dense 与 FP8/BF16 倍数；精确 989.4/1978.9 保留文章原先引用的 V1.04 数字，本轮未成功重新取得该 PDF，不能声称重新验证了末位精度。
- 验证：独立计算 116,405 tok/s 和 1.8824 倍。另把 quantization 导读中的“与 performance 配置相同”限定为 KV 头配置：权重账分别用 8B 与 7B。

### S06 — GPTQ 的自由集合 F 定义使公式自相矛盾

- 原位置：`12-infra/quantization/weight-only-and-ptq.md:56`。
- 原因：若 F 是已经排除本轮 q 的剩余集合，公式里的 `H_F^{-1}[q,q]` 不存在。
- 修复：明确更新前 F 包含 q；更新把 q 移到量化格点，然后冻结并移出集合。
- 来源：[GPTQ，§3 及算法](https://arxiv.org/html/2210.17323v1)。
- 验证：执行双语正文例子，RTN 输出 SSE 为 0.3527，补偿后约 0.00176；这仅验证该二变量教学例，不是全 GPTQ 实现验证。

### S07 — KV 例子混淆整数 zero-point、浮点 offset 和缩放 logits

- 原位置：`12-infra/quantization/fp8-and-kv-cache.md:51`、`:54`、`:79`。
- 原因：KIVI 所称 zero-point 是 min-max 的浮点 offset；如果套前篇“整数 zero-point 精确表示 0”，复算结果不同。Kq 还不是已经除 sqrt(head_dim) 的 attention logits。
- 修复：写清 `a=min x`、`s=(max-a)/3`、`xhat=a+s*q_code`；注明不保证精确零，表中是未缩放 dot product；真正 logits 及误差除以 2。128-token BF16 residual 的 16 MiB 仅为量级估算，不当成所有实现精确常驻长度。K per-channel/V per-token 限定为 KIVI 2-bit 方案，不称所有低位方案的必要条件。
- 来源：[KIVI，§3.1–3.3](https://arxiv.org/html/2402.02750v2)。
- 验证：逐行 / 逐列量化后分数分别为 `[0.3,-0.1,-0.8,0.6]` 和 `[1.23,0.90,0.93,1.67]`；最大 dot-product 误差 1.7 与约 0.0667，缩放后减半。

### S08 — vLLM KV 格式清单过窄、默认 scale 被泛化、版本链接失效

- 原位置：`12-infra/quantization/fp8-and-kv-cache.md:94`、`:96`，`checking-quality` 记录表和 `review` 对应答案。
- 原因：功能页不是完整 enum；v0.31.0 还有 `int4_per_token_head`、`fp8_per_token_head`、`nvfp4` 等。普通 FP8 未校准 scale=1 不适用于动态逐 token/head 路径；原 `.html` 功能页地址无法取得。
- 修复：改用有效的目录 URL；交叉核对同版本 CLI 和 tagged source；保留 CUDA 11.8+/ROCm、Flash Attention 校准路径等条件，并注明 enum 不等于任意硬件/模型/kernel 均可用。静态 scale 省掉范围估计，不是省掉所有缩放和转换运算；减少 KV 字节不自动等于相同比例的实测加速。
- 来源：[v0.31.0 功能页](https://docs.vllm.ai/en/v0.31.0/features/quantization/quantized_kvcache/)、[参数表](https://docs.vllm.ai/en/v0.31.0/configuration/engine_args/)、[tagged cache.py](https://raw.githubusercontent.com/vllm-project/vllm/v0.31.0/vllm/config/cache.py)。
- 验证：web 手工比对三个来源；双语回归检查版本及关键条件仍在。没有启动引擎验证支持组合。

### S09 — 显存账把 GB / GiB 及预算当成实卡容量

- 原位置：`12-infra/performance.md:81`、`12-infra/quantization/fp8-and-kv-cache.md:7`、`:56`。
- 原因：77 GiB 是约 82.7 个十进制 GB，不是“几乎占满 80 GB”；3/6 条 128K 序列依赖 80e9、预留 6e9 和 16e9 权重的教学预算。
- 修复：显式区分 decimal GB 与 GiB，定义 128K=131072；容量结论归属于教学预算，实机应以 runtime 可用字节重算，避免断言某 SKU 必定容纳几条。
- 来源：[H100 规格](https://www.nvidia.com/en-us/data-center/h100/)，以及本文逐项字节公式；产品的“80 GB”标记本身不是 runtime 可分配容量测量。
- 验证：BF16 KV=16 GiB，预算容纳 3 条；FP8=8 GiB，预算容纳 6 条。performance 的 `14e9 + 128*4096*131072 = 82.719476736e9` 字节。

### S10 — BERTScore 高不能证明事实 / 含义保真；配对 helper 静默丢样本

- 原位置：`12-infra/quantization/checking-quality.md:45`、`:70`。
- 原因：嵌入相似不保证数字、否定或代码语义正确，“逐字比较没有意义”过强；zip 对不同长度静默截短，空输入除零。
- 修复：开放式改写不只看字面，但数字、代码和严格格式仍保留精确匹配、执行或人工检查；helper 拒绝空/不等长输入，正常无 discordant 项仍返回 p=1。
- 来源：[Kurtic 等，§4.4](https://arxiv.org/html/2411.02355v4)核对原 ROUGE-L/BERTScore 报告；这里增加的是指标不能提供逐项正确性保证的限定，不把论文措辞当真值。
- 验证：正文例子得到 flips=0.056、diff=-0.004、p≈0.6889，95% 区间约 [-1.87,+1.07] 个点；空、错长、完全一致三类边界已测。

### S11 — 扩散 likelihood 被说成任意 sampler 都相同；全 mask 理由不成立

- 原位置：`11-frontier/diffusion-lm/masked-diffusion.md:51`、`:76`，`review` 对应答案。
- 原因：连续均匀采样 t 时，恰好 t=1 的概率为 0；训练遇到全 mask 是积分事件。0.105 是均匀随机顺序、一位置一位置解遮的生成概率，不是置信度选序或并行 sampler 的通用概率。
- 修复：全 mask 概率写成 `integral(t^L,0,1)=1/(L+1)`；明确线性调度、时间无关预测器、连续时间逐一解遮、均匀随机顺序。区分固定左到右的 0.16；loss-vs-t 排查表不再给出必然单调或固定最高方差位置的保证。
- 来源：[RADD v3，§3.2](https://arxiv.org/html/2406.03736v3#S3.SS2)、[MDLM](https://arxiv.org/html/2406.07524v2)。
- 验证：执行两 token 例子，目标 2.414、随机序 NLL 2.254、概率 0.105，固定序 0.16；对多个 L 数值积分全 mask 事件。

### S12 — Feng 最坏情形定理被泛化为所有推理任务；置信度定理少前提

- 原位置：`11-frontier/diffusion-lm/decoding-and-speed.md:45`、`:57`，导读和复习答案。
- 原因：Feng 的线性下界是构造 HMM 的最坏情形，逐 token 正面结论有固定阶数 n-gram、学习误差与调度存在性假设；不能推出所有实际推理任务没有加速。Fast-dLLM 的最大值一致定理不等于独立采样分布一致。
- 修复：补齐两类定理范围；要求边缘来自同一联合分布；0.9 阈值下该充分条件只直接覆盖最多 9 个位置，不保证模型置信度校准。
- 来源：[Feng 定理 4.2/4.4](https://arxiv.org/html/2502.09622v2#S4)、[Fast-dLLM 定理 1](https://arxiv.org/html/2505.22618v1)。
- 验证：逐项阅读 theorem 假设与量词，并核算 `(n+1)*0.1<=1`；没有复现论文证明或下游训练结果。

### S13 — 扩散/AR roofline 多算一次 decode，饱和 batch 向下取整

- 原位置：`11-frontier/diffusion-lm/decoding-and-speed.md:82`、`:99`、`:102`，`review` 对应答案。
- 原因：prefill 已产出第一个 token，输出 256 只需 255 次后续 decode。9*32=288 未达到约 295.17 个位置的算力拐点。
- 修复：AR 约 1072 ms，整段每步落 4 个相对速度约 1.54×；连续并发拐点 9.22，首个 compute-bound 整数 batch=10。保留分块扩散自己的 prefill/去噪计账约定，不误改其 1076 ms 行。
- 来源：[DFlash §4.1 的 prefill/首 token 路径](https://arxiv.org/html/2602.06036v1)、[NVIDIA GEMM 计数](https://docs.nvidia.com/deeplearning/performance/dl-performance-matrix-multiplication/index.html)，加本文公开 teaching assumptions。
- 验证：执行中英文相同的 roofline 代码，AR=1072.280594 ms；整数 ceil=10；数值回归通过。

### S14 — DFlash 无损前提缺失，“最高 6.1×”写成跨任务都超过 6×

- 原位置：`11-frontier/diffusion-lm/decoding-and-speed.md:142`、`:147`，导读和复习答案。
- 原因：保留前缀本身不保证随机采样分布不变；正文的“多种模型和任务上 6 倍以上”容易把最高结果误读为普遍结果。
- 修复：限定精确验证、正确拒绝修正分布及一致的目标温度/截断；改为所测配置最高约 6.1×。原生扩散质量下降也限定为列出的部分同族基准。把“尚无公开测量”改成“本次所查来源未提供”，不把检索不到当不存在。
- 来源：[DFlash 表1与§5](https://arxiv.org/html/2602.06036v1)、[Leviathan 等推测解码论文](https://proceedings.mlr.press/v202/leviathan23a.html)。
- 验证：手工对照表1，单任务最高约 6.09×，各项平均不是 6×；未执行 speculative decoder，报告不将分布等价当作本次实测。

### S15 — serving 框架的当前版本条件

- 原位置：`06-systems/inference-frameworks.md:111`、`:164`。
- 原因：TP×DP 少了“PCP=1”的假设；“只复用完整块”混淆哈希匹配单元与物理块。
- 修复：示例明确 PCP=1；一般 MoE 范围为 TP×PCP×DP。说明 v0.31.0 的 `prefix_match_unit` 可比物理块细，只要整除各组 block size；匹配粒度不是存储频率，不保证任意内部位置有可恢复状态。
- 来源：[v0.31.0 参数表](https://docs.vllm.ai/en/v0.31.0/configuration/engine_args/)、[tagged cache.py](https://raw.githubusercontent.com/vllm-project/vllm/v0.31.0/vllm/config/cache.py)。
- 验证：文档与源码交叉核对 32-token 匹配 / 1024-token 物理块例子；双语关键条件回归通过。不是 vLLM/SGLang GPU 功能测试。

### S16 — 迁移部署章节时原自动锚点入口被删

- 原位置：main `02e914a` 的 `06-systems/distributed-training` 两个标题：“部署时的 DP，不一定是互不相干的副本”“PP 的 KV 在哪里，边界传多少东西？”及英文对应标题；HEAD 只剩 `#eight-gpus` 转接段。
- 修复：恢复原样标题，各用一小段链接到 `inference-frameworks#moe-deployment`、`#pp-kv`，不搬回长篇重复内容。
- 来源：本地 `git show 02e914a:...` 与当前迁移 diff；无外部来源需要。
- 验证：两种语言旧标题各出现一次，`#eight-gpus` 仍在。未跑 HTML 渲染锚点验证，交主 agent 全站检查。

另外：保留 HGX B300 INT8/FP8 的官网差异，但不再从峰值比值推出“INT8 绝不可能帮助小 batch”；[HGX 官方表](https://www.nvidia.com/en-us/data-center/hgx/)核对为 8 GPU sparse 的 3 POPS 与 72 PFLOPS。带宽受限路径是否有收益仍需 kernel 与质量实测。

## 3. 实际验证结果

全部在指定 checkout、显式 workdir 下运行：

```text
python3 -m unittest discover -s site/tests -p test_review_systems_20261016.py -v
Ran 14 tests ... OK

python3 -m unittest discover -s site/tests -p test_infra_intro.py -v
Ran 2 tests ... OK

git diff --check -- 06-systems 12-infra 11-frontier/diffusion-lm site/tests/test_review_systems_20261016.py site/tests/test_infra_intro.py
无输出，退出成功。
```

- 14 项覆盖：双语 Python AST 一致、量化 MSE / 零点 / 零张量、配对比较边界、GPTQ 小例、扩散 sampler 概率、全 mask 积分、roofline off-by-one 与 batch ceil、混合 FP8 上界、KV 字节预算、KIVI 分数、FN/FNUZ 编码、版本条件、迁移入口。
- 2 项来自获准导入的上一轮 intro 测试，验证折叠代码和 causal pair 计数。
- 只运行上述两个专属文件；没有全站 tests / build，没有 Actions，没有 GPU benchmark。测试验证小例和约束，不认证所有正文事实。

## 4. 改动文件

每个 stem 均修改 `.md` 和 `.en.md`，合计 28 个正文文件：

- `06-systems/distributed-training`、`06-systems/inference-frameworks`。
- `11-frontier/diffusion-lm/README`、`masked-diffusion`、`decoding-and-speed`、`review`。
- `12-infra/README`、`12-infra/performance`。
- `12-infra/quantization/README`、`formats-and-error`、`weight-only-and-ptq`、`fp8-and-kv-cache`、`checking-quality`、`review`。
- 新增 `site/tests/test_review_systems_20261016.py`。
- 从上一轮仅引入获准的 `site/tests/test_infra_intro.py`；上一轮除 intro 双语正文与此测试外，未拷入其他文件。
- 新增本报告 `site/reviews/2026-10-16/systems.md`。

## 5. 主 agent 待办 / 未完成

1. 全站 build、测试、内部链接、生成的自动锚点和视觉 QA 由主 agent 统一执行；本轮保留源级图示，没有做浏览器截图验收。
2. 上述 30 个扫描而未审文件及 performance / distributed-training 剩余正文仍待审核；尤其 GPU architecture、NVIDIA generations 的新硬件数字，不能引用本报告为其独立来源核验。
3. 新系列仍有未逐条重新核实的外部实验和时间线：Kim 的详细逐步提交表、LLaDA 附录所有数字、SMDM / 数据受限 scaling、厂商 Mercury 系列全部数字、NVFP4/MXFP8 训练实验、AWQ/SmoothQuant 全部表格、长上下文/多语种量化切片。这些保留原文引用，不能算本轮全部 source-verified。
4. DiffusionGemma 模型卡/开发指南、RADD、Feng、Fast-dLLM、KIVI、ONNX、vLLM 版本文档/源码等做了定点原文核查；网页抓取不等于完整独立复现。Kim HTML 未直接提取到表内 `61.7`，因此没有将该数列标为本轮重新认证。
5. H100 V1.04 PDF 本轮取回失败；产品页可核对取整峰值、sparsity 脚注和带宽，但不是小数末位的替代证据。当前保留原精确数字及原链接，不伪称取得 PDF。
6. serving 全功能矩阵中的 SGLang Rust tree fallback、调度细节、CUDA Graph、编译与 P/D 组合没有全部独立回查到固定源码；需要后续版本专项确认。`00-foundations/deep-dives/attention-kernels` 的跨页旧 block-granularity 解释在权限外，主 agent 如发现与本次 `prefix_match_unit` 条件冲突应协调该 scope；本 agent 未改它。
7. 普通 BERT/MLM 与“无似然解释”的绝对化表述、有限步 sampler 的概率界等可继续做更完整的理论审阅。本轮已修正明确影响例子与结论的前提，不宣称穷尽理论边界。

已停止扩大审核；除最终报告/检查外不再编辑，供主 agent 集成。
