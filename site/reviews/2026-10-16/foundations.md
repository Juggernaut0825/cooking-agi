# Foundations 高风险审核记录 — 2026-10-16

## 结论与边界

- 工作目录：`/Users/tianyizhang/Documents/ChatGPT/Job Prep/cooking-agi-full-review-20261016`；审核起点 `c0a75c1`，比较基线 `02e914a`。先读了 `EDITORIAL.md`。
- 本轮集中审核 PR102 scaling 和 PR101 去重后的 decoder-only / normalization，以及旧 worktree 的 PyTorch / gated-attention 修复。已按主 agent 要求停止扩展审核。
- **不是全 foundations 验收通过，也不是全部已读页面的一手来源逐条认证。** 全文阅读、来源核对、算例测试和视觉验收在下文分开记录；scaling 的草稿标识全部保留。
- 修改 30 个正文文件，新增 1 个专属测试文件和本报告；未修改现有代码实现、导航配置、图像资产、`CONTENT_RELEASE_CHECKLIST.md` 或 `site/expression-review.toml`。没有 reset、commit、push、切换分支或触发 Actions。

## 实际覆盖范围

统计对象为 `00-foundations/` 下的 179 个 `.md` / `.py` 文件，不含 SVG 等资产。下文的“中英两版”精确指同名 `.md` 与 `.en.md`，不是只读一版再推断另一版。

### 全文精读：36 个正文 + 3 个代码文件

| 路径前缀 | 全文阅读的文件，正文均含中英两版 | 范围说明 |
| --- | --- | --- |
| `00-foundations/scaling/` | `README`、`compute-optimal`、`beyond-chinchilla`、`hyperparameters`、`review` | 10 页全部正文、表格、公式和代码；来源只核对下列具体部分 |
| `00-foundations/pytorch/` | `README`、`tensors-and-storage`、`operations-and-shapes`、`cross-entropy`、`autograd`、`training-loop` | 12 页；CPU 示例实跑，GPU 数据传输部分只读文和核对前提，没有 GPU 实验 |
| `00-foundations/core/` | `decoder-only`、`normalization` | 4 页；包含中文页内的英文概念卡 |
| `00-foundations/deep-dives/` | `gated-attention`、`language-model-objective`、`recurrent-dynamics` | 6 页 |
| `00-foundations/moe/` | `systems` | 2 页 |
| `00-foundations/` | `transformer` | 2 页 |
| `00-foundations/code/` | `model.py`、`loss_contracts.py`、`norm_compare.py` | 3 个文件全文静态阅读；只对 `model.py` 跑了本轮新增的 causal / chunked-cache 检查，另两文件没有独立执行其完整测试 |

### 只看部分 diff：4 个正文

- `00-foundations/core/vanilla-transformer.md`、`00-foundations/core/vanilla-transformer.en.md`。
- `00-foundations/deep-dives/attention-kernels.md`、`00-foundations/deep-dives/attention-kernels.en.md`。
- 只查看 `02e914a..c0a75c1` 的部分改动块；组合输出曾截断，**不算完整 diff 审核，更不算全文精读**。FA4、vLLM / SGLang 的新事实仍待对应一手实现复核。

### 定点扫描：2 个正文

- `00-foundations/core/multi-head-attention.md`、`00-foundations/core/multi-head-attention.en.md`：仅搜索并读取缩放方差推导附近命中行，确认主讲页已保留“全部相互独立、零均值、单位方差”条件；未全文阅读。
- 对全部 foundations 做过文件枚举与 `git diff --stat/--numstat`。**目录和 diff 统计不是内容审核。**

### 未审核：134 个正文 / 代码文件

以下列表穷尽其余文件；每组正文名均指中英两版：

- `00-foundations/`：`README`、`from-linear-to-neural`、`hand-write-kit`、`interview-basics`、`ml-math-interview`、`study-guide`、`transformer-lab`。
- `00-foundations/core/`：`README`、`bert`、`decoding`、`embeddings-and-similarity`、`ffn-and-gates`、`recurrent-models`、`residual-connections`、`seq2seq`、`tokenization`。
- `00-foundations/deep-dives/`：`README`、`activation-and-initialization`、`attention-residuals`、`dflash`、`engram`、`gated-deltanet`、`generalization`、`kv-cache-and-inference`、`latent-and-sparse-attention`、`multi-token-prediction`、`muon`、`nope-and-order`、`optimizers`、`position-and-context`、`precision-and-memory`、`pretraining-pipeline`、`tokenizer-algorithms`、`training-step`。
- `00-foundations/looped/`：`README`、`adaptive-depth`、`costs`、`models`、`review`、`why-loops-reason`。
- `00-foundations/model-families/`：`README`、`deepseek-v4`、`deepseek`、`gemma`、`gpt`、`how-to-read`、`llama`、`qwen-early`、`qwen`。
- `00-foundations/moe/`：`README`、`fine-grained-and-shared`、`latent-moe`、`load-balancing`、`review`、`router`。
- `00-foundations/code/README.md`、`00-foundations/code/README.en.md`。
- `00-foundations/code/` 的 Python：`attention_numpy.py`、`attention_torch.py`、`figure_languages.py`、`interview_kit.py`、`make_arch_figures.py`、`make_figures.py`、`make_norm_figures.py`、`make_rlhf_figure.py`、`mlm_contracts.py`、`moe_routing.py`、`multimodal_math.py`、`order_without_positions.py`、`sequence_numpy.py`、`sequence_torch.py`、`svgkit.py`、`test_learning_path.py`、`test_model.py`、`tokenizer_from_scratch.py`、`train.py`、`vanilla.py`、`vanilla_demo.py`、`why_nonlinear.py`。

图像资产、页面实际渲染、移动端、交互按钮、站点导航未做视觉 / 操作验收。

## 实质修复：原位置、依据和验证

位置均指 **`c0a75c1` 原文行号**，不是修改后的行号。除单独说明外，修复同时落在中英正文；decoder 中文概念卡的英文面也同步修改。

### 1. GQA 不只节省 KV cache，MLA 也不只缓存 latent

- 原位置：`00-foundations/core/decoder-only.md:171`、`:206`、`:228`、`:264`；英文 `decoder-only.en.md:108`、`:124`。
- 问题：GQA 表述把 K/V 投影参数的减少也排除了；MLA 的“only latent”遗漏解耦 RoPE key。
- 依据：[GQA §2](https://arxiv.org/html/2305.13245v3#S2) 的共享 K/V 设计；[DeepSeek-V3 §2.1.1](https://arxiv.org/html/2412.19437v2#S2.SS1.SSS1) 的 KV latent 与解耦 key 缓存。两处核对的是具体方法正文，不只是摘要。
- 修复：区分缓存、K/V 投影和整个模型参数；明确 MLA 两类缓存。补可复算例：`d=8, query_heads=4, head_dim=2, KV_heads=4→1`，K/V 参数 `128→32`，attention 总投影参数 `256→160`，每 token 每层 cache 标量 `16→4`。
- 验证：`test_gqa_projection_parameters_and_cache` 通过；模型原实现的 MHA / GQA / MQA 三种 KV-head 配置均通过本轮 chunked-cache 等价性测试。没有运行 DeepSeek-V3 模型。

### 2. 缓存等价性的近似边界与 LM 诊断

- 原位置：`decoder-only.md:229`、`:265`；英文 `:125`；`deep-dives/language-model-objective.md:17`、`:64`、`:71`，英文 `:15`、`:62`、`:69`。
- 问题：decoder 表已有相同权重、位置等条件，但没有说清量化 / 驱逐近似；objective 页“必须一致”没有这些条件。另将单条参考答案的低 likelihood 直接解释成训练没覆盖，不能排除长度、表达、容量和优化因素。
- 依据：[Transformers cache 原理](https://huggingface.co/docs/transformers/main/en/cache_explanation) 的 causal KV 复用和 mask 长度要求，交叉对照本仓库 `model.py`；序列概率随长度累乘也可由该页自身因子分解式直接推出。
- 修复：加入无近似缓存、保留所需 K/V、固定前缀 / 位置 / 可见范围及关闭 dropout 的条件；近似 cache 单独评估误差。诊断改成多个可接受答案、相同模板、按有效 token 报 NLL，不再把低分当成训练数据缺失的证据。也明确 teacher forcing 不允许读取未来 token，训练还有反向和更新。
- 验证：2 层小模型，KV heads 为 1 / 2 / 4，前缀按 3 / 2 / 4 token 分块，与完整前向按 `atol=1e-6, rtol=1e-5` 比较通过；修改未来 token 不改变前 5 个位置的 logits，按零容差通过。未测试量化 cache、跨请求复用或生产 serving。

### 3. QK-norm 不会冻结 logit，也不能由名称猜公式

- 原位置：`00-foundations/core/normalization.md:289`、`:297`；英文相同行号。
- 问题：把 QK-norm 一概定义为 RMSNorm；“logit 只能靠 gain 慢慢变大”忽略方向学习；RoPE 保范数不代表与逐维 gain 可交换。
- 依据：[Henry 等 QKNorm §2–3](https://arxiv.org/pdf/2010.04245) 是 L2 norm + learned score scale；[ViT-22B §2](https://arxiv.org/pdf/2302.05442) 使用 LayerNorm 名称但又声明去掉 centering / bias；[Gemma3 官方框架实现](https://github.com/huggingface/transformers/blob/main/src/transformers/models/gemma3/modeling_gemma3.py) 和 [Qwen3 实现](https://github.com/huggingface/transformers/blob/main/src/transformers/models/qwen3/modeling_qwen3.py) 明确逐 head RMSNorm 在 RoPE 之前。实现核对日期为本轮日期，链接为 main，未固定 commit。
- 修复：区分方法族和本文特定公式；补正向缩放、非零输入、忽略 epsilon 的条件，以及固定 gain 下方向变化的反例。
- 验证：`d=2, q=[1,0]`，key 从 `[0,1]` 变为 `[1,0]`，单位 gain 的归一化分数由 0 变成 `sqrt(2)`；gain `[2,1]` 与 90° 旋转不交换。`test_qk_norm_direction_scale_and_noncommuting_gains` 通过。

### 4. Weight decay 的 batch 规则漏掉学习率条件

- 原位置：`00-foundations/scaling/hyperparameters.md:56`；英文相同行号。
- 问题：由 `tau=B/(eta*lambda*D)` 直接写“固定 N,D，batch 翻倍 weight decay 就翻倍”，漏掉 eta 和 schedule 形状固定的前提；前一节又在改变 eta。
- 依据：[Power Lines §2.2–2.4](https://arxiv.org/html/2505.13738v1) 的时间尺度与实验条件。
- 修复：明确峰值 eta、固定 schedule；固定 D 时一般比例为 `lambda_new/lambda_old=(B_new/B_old)*(eta_old/eta_new)`。保持 tau 不是保证相同 loss。
- 验证：batch 4 倍、eta 2 倍时 lambda 只需 2 倍；直接用 4 倍会改变 tau。专属测试通过。

### 5. Adam 迁移例漏参数，µP 例漏 epsilon 与 bias 约定

- 原位置：`scaling/hyperparameters.md:48`、`:93`、`:96`、`:123`、`:138`；英文相同行号；复习页 `review.md:60`、`:68` 及英文对应段。
- 问题：AdamW 例只算 LR / beta2，未给 beta1 / epsilon，也用“beta2 少见”证明噪声假设；第一步 sign 近似遗漏零矩状态和 epsilon 条件；公式丢失上游梯度符号；bias 的 fan_in 没定义；将 epsilon 压制更新统称为浮点下溢。
- 依据：[Malladi 等 §5 定义 5.2](https://arxiv.org/html/2205.10287v2#S5)、[TP5 表 3、附录 B.1](https://arxiv.org/html/2203.03466v2)、[Everett 等 §4.3](https://arxiv.org/html/2407.05872v1)。
- 修复：例改成 Adam，给出 `eta=6e-4, beta1=.6, beta2=.8, epsilon=5e-9`；检查 beta 合法域，AdamW decay 另算。µP 明确零矩状态、忽略 decay、`|g| >> epsilon`、bias fan_in=1，并用绝对变化量写幅度。解释 epsilon 主导不一定是梯度舍入为 0。
- 验证：batch 放大 20 倍会使原 beta1=.9 变成 -1；宽 512 / 4096 的缩放 LR 均给绝对变化 5.12，正负上游梯度均检查；`g=1e-12, epsilon=1e-8` 的更新因子约 `1e-4`。对应测试全部通过。

### 6. Llama 3 原报告单位疑点不应成为确定配方

- 原位置：`scaling/hyperparameters.md:35`、`:84`；英文相同行号。
- 依据：[Llama 3 v3 §3.4.1 / §3.4.3](https://arxiv.org/html/2407.21783v3#S3.SS4) 原文本身确实写 252M、8M sequences of 8192 tokens、final 40M tokens。
- 修复：没有擅自把 M 改成 B；保留原数值并指出单位不明确、需要作者澄清，避免当作已验证训练步骤复制。
- 实际核算：252M/4M≈63 步；若最终仍为 16M-token batch，40M 仅 2.5 步。这是发现异常的算术，不是证明真实里程碑应是多少。未找到并核对作者修订，保留待办。

### 7. Scaling 优化目标与数值口径

- 原位置：`scaling/README.md:26` / 英文 `:26`；`compute-optimal.md:127`、`:128`、`:137` 及英文；`beyond-chinchilla.md:21`、`:29`、`:31`、`:32`、`:33`、`:35` 及英文；复习页相关答案。
- 问题：导读未说明加入推理成本后固定的是 loss、不是原训练预算；把外推收益写成有保证的“上限”；内插被写成必然可靠；部分表格末位与文中公布的舍入系数不一致。
- 依据：[Sardana 等 §2、§5](https://arxiv.org/html/2401.00448v3) 的固定 loss 优化、input+output token 口径与极端比例拟合局限；[Besiroglu 等重拟](https://arxiv.org/html/2404.10102v2) 的系数与不确定性。下列数值是本轮用文中教学曲面独立计算，不是论文实测。
- 修复：明确目标切换、输入与输出 token、2N 近似及 KV 复用前提；“上限”改为可能偏乐观的外推估计；内插需验证点 / 残差检查；统一使用页面写出的 `E=1.82,A=482,B=2085,alpha=.348,beta=.366`。
- 验证：训练最优 `N=9.0555088B,D=184.0500301B`；四分之一 / 二分之一模型的 D/N 为 325.194 / 81.299，改为 325 / 81。固定目标 loss、推理 `1e12` 时独立三分搜索得到 `N≈4.626693B,D≈446.267789B`，训练多花 23.8846%，总 FLOPs 省 23.0129%。其余推理行 D/N 更新为 535、3204，总 FLOPs 为 `8.04e22`、`4.77e23`。两版表与复习数字同步；测试检查五个推理量的 loss 约束和最优成本。
- 同时补充：超参数 DeepSeek LLM 的 `1e22` 示例已超出原 `1e17..2e19` 拟合区间；步数不等于墙钟时间。没有因此宣称该配方可直接用于大模型。

### 8. 旧 worktree 中仍适用的 PyTorch 修复

- 比较来源：`/Users/tianyizhang/Documents/ChatGPT/Job Prep/cooking-agi-validation-20261015` 的未提交 diff；先看 diff 再合入，没有整文件复制。
- `pytorch/cross-entropy.md:7`、`:109`（英文相同）：低正确类概率对应更高 loss，不直接决定参数纠正大小；软标签 `[.1,.2,.7]` 的目标是 .7，不是“更慢推到 100%”。依据 [PyTorch CE 定义](https://docs.pytorch.org/docs/2.14/generated/torch.nn.CrossEntropyLoss.html)；以 `logits=log(target)` 实测梯度为零，通过。
- `pytorch/autograd.md:63`、`:136`（英文相同）：补 VJP seed `(1,1)` 得 7、`(1,2)` 得 10；把 no_grad 工厂例外写成具体 `torch.tensor(..., requires_grad=True)`。依据 [no_grad 官方文档](https://docs.pytorch.org/docs/2.14/generated/torch.no_grad.html)；正文实例及专属 factory 检查通过。
- `pytorch/tensors-and-storage.md:141`（英文相同）：补独立 NumPy snapshot 的 `.copy()`，并保留 dtype / layout 限制。依据 [Tensor.numpy](https://docs.pytorch.org/docs/2.14/generated/torch.Tensor.numpy.html)；原 Tensor 改值不改变 snapshot，测试通过。中文 ASCII 的 independent storage 改成中文。
- `pytorch/training-loop.md:182`（英文相同）：明确 weights_only 限制反序列化对象，不保证任意文件安全。依据 [serialization security](https://docs.pytorch.org/docs/2.14/notes/serialization.html#weights-only-security)；CPU 保存恢复示例通过，不是恶意文件安全评估。
- 未照搬旧 worktree 的 PyTorch 2.8 文档链接回退；保留当前 2.14 文档与既有 2.8 历史数值验证说明。本轮实际新运行环境另列下方。未合入纯重写风格改动，也未采用会让读者误以为“减最大值后才转换 FP32”的折叠标题。

### 9. Gated Attention 的输入与“独立”含义

- 原位置：`deep-dives/gated-attention.md:9`、`:26`、`:29`、`:75`；英文对应行相同。
- 依据：[原论文 §2.2 脚注、§4.3](https://arxiv.org/html/2505.06708v1)：gate 使用 pre-normalization 后状态，门值逐项 sigmoid；attention-sink 的证据来自多层 / 多样本统计。
- 修复：合入旧 diff 中有效的 pre-norm 输入说明、gate projection 图示、非共同 softmax 不等于统计独立，以及单图只显示该输入上的集中度的边界。保留所有原算例。
- 验证：中英代码 AST 一致、两版 headwise 例全部执行；门 logits 为 0 时输出减半，不是 identity。未复现论文训练或 sink 消失结论。

### 10. 缩放方差、算力单元与 MoE 字节账

- `transformer.md:55` / 英文 `:53`：缩放方差缺零均值，补齐与[原 Transformer §3.2.1 脚注](https://arxiv.org/html/1706.03762v7#S3.SS2.SSS1)一致的假设。离散反例：q,k 独立取 `{0,2}`，各自方差仍为 1，但乘积方差为 3；测试通过。另限定任意 Q/K 基变换不变性仅针对 plain dot product，不外推到中间有 RoPE / QK-norm 的路径。
- `decoder-only.md:230`、`:266` / 英文 `:126`：把“在片上存储里计算”改成计算单元使用片上存储中的数据块；与[CUDA 硬件模型](https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/programming-model.html#gpu-hardware-model)区分计算和存储的口径一致。此项是表述澄清，没有 GPU 性能验证。
- `moe/systems.md:35` / 英文 `:35`：同节点只传一份指跨节点链路，进入节点后仍需 NVLink 转发；28 KiB 是激活载荷，不含 scale / metadata。依据 [V3 §3.2.2、§3.3.3](https://arxiv.org/html/2412.19437v2#S3.SS2)；`8*7168*2*4096 = 448 MiB`、`4*7168 = 28 KiB` 复算通过。没有通信实测。

## 实际验证

专属文件：`site/tests/test_review_foundations_20261016.py`。

运行命令（在目标 repo 显式 workdir 下）：

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/tianyizhang/.local/share/nemo-rl-venv/bin/python -m unittest discover -s site/tests -p test_review_foundations_20261016.py -v
```

- Python 3.13 环境，PyTorch **2.13.0 / CPU**，`torch.cuda.is_available() == False`。
- **16 tests，0 failures，0 errors，0 skips，0.591 秒。** 环境有 pynvml 弃用 FutureWarning，不影响结果；没有修改该环境。
- 两版 PyTorch 六章与 recurrent-dynamics 的 Python 代码块执行；这不等于其中仅定义但未调用的 GPU / TensorBoard helper 已验证。
- scaling 两页、gated-attention、MoE systems 的纯 Python 例执行；12 组双语代码的 AST 对照通过（含 transformer 的 RoPE 定义；该定义不等于完整训练实测）。
- 其余测试包括 scaling 数值、Adam / decay / µP 算例、QK-norm 反例、soft-target 梯度和 cache 因果性。
- `git diff --check -- 00-foundations site/tests/test_review_foundations_20261016.py` 通过。
- 对 30 个改动正文比较 HEAD 与工作区：**没有丢失显式 `{#anchor}` / `id="..."`，Markdown 图片目标序列没有变化**。这不是自动生成 heading anchor 或网页视觉的完整检查。decoder 旧锚点另有专属回归。
- 未运行全站 tests / build；按协调要求留给主 agent。未运行 GPU、真实模型预训练、生产推理或论文 benchmark。

## 改动文件

以下 15 个正文 stem 的 `.md` / `.en.md` 两版，共 30 个文件：

- `00-foundations/core/decoder-only`、`00-foundations/core/normalization`。
- `00-foundations/deep-dives/gated-attention`、`00-foundations/deep-dives/language-model-objective`。
- `00-foundations/moe/systems`。
- `00-foundations/pytorch/autograd`、`00-foundations/pytorch/cross-entropy`、`00-foundations/pytorch/tensors-and-storage`、`00-foundations/pytorch/training-loop`。
- `00-foundations/scaling/README`、`00-foundations/scaling/compute-optimal`、`00-foundations/scaling/beyond-chinchilla`、`00-foundations/scaling/hyperparameters`、`00-foundations/scaling/review`。
- `00-foundations/transformer`。
- 新增：`site/tests/test_review_foundations_20261016.py`、`site/reviews/2026-10-16/foundations.md`。

## 待办 / 交接

1. 主 agent 统一运行全站构建、链接 / parity / 现有测试；本轮局部通过不代替内容验收。
2. scaling 虽全文读完，**不是引用库全量复核**。开源模型训练 token 表（尤其 DeepSeek-V4）、Kimi / OLMo / MiniCPM 各 schedule、Kaplan–Chinchilla 两篇 reconciliation 的全部定量结果、WSD 效果范围及 downstream 预测，仍需逐项原文与版本核对。本轮已核对的部分只以上述来源和具体章节为准。
3. Llama 3 的 252M / 40M 原文单位疑点待作者澄清，不能替它猜 B。
4. `decoder-only` 的既有 Transformers v5.20.0 cache 文档链接本轮 web 读取报 Internal Error；`main/en/cache_explanation` 可读且已用于核对机制。未把工具取回失败认定为确定 404，也未擅自改成新版本 API；主 agent 做独立链接检查。
5. 4 个部分 diff 页、2 个定点扫描页、134 个未审核文件仍不具备本轮全文审阅结论。尤其 attention-kernels 的 FA4 / cache 实现更新未做一手核验。
6. 保留现有图示和全部已检查显式锚点；未对 SVG、窄屏、Mermaid 或概念卡交互做视觉验收。decoder 中文页英文面有 9 行本地链接改为英文目标，需统一 build / linkcheck 核对。

本轮到此停止编辑，交由主 agent 集成；不宣称整个 foundations 或全站审核完成。
