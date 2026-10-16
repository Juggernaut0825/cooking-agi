# Frontier / multimodal / embodied：高风险内容审阅交接

日期：2026-10-16。工作目录：`/Users/tianyizhang/Documents/ChatGPT/Job Prep/cooking-agi-full-review-20261016`。

本轮起始 HEAD：`c0a75c13c4cc78727e50e82cda71f7a741637ad9`；PR99–102 差异基线：`02e914a`。以下“原位置”均指起始 HEAD，不是修改后的行号。读过 `EDITORIAL.md`，也检查了共享 checkout 中后来新增的语言精修要求。

**结论范围：这是已停止扩展的高风险审阅，不是全范围独立来源核验完成。** 全文阅读不等于逐条引文核验；自动测试不证明论文解读正确，也不证明真实机器人安全。按主审协调要求交回本轮结果，剩余页面和时效性声明列入待办；这不表示用户撤回了全面审核的要求。

## 1. 覆盖台账

范围内共 88 个 Markdown 文件。下文 `{,.en}.md` 表示中文 `.md` 与英文 `.en.md` 两个实际文件，不把中文阅读算作英文审核。

### 全文精读：32 文件

- `03-multimodal-learning/{blip-and-q-former,vision-to-language,qwen-vl,vit,vlm-finetuning,image-generation,siglip}{,.en}.md`：14 文件。读正文、公式、代码和双语；只对下文列明的版本和关键论断回查来源，未逐一复现所有模型。
- `11-frontier/README{,.en}.md`：2 文件，并对照上一轮目录介绍。
- `11-frontier/world-models/{dreamer,jepa}{,.en}.md`：4 文件。重点核查部署/训练区别、论文版本、理论假设和动作范数。
- `11-frontier/self-improvement/{README,generate-verify-train}{,.en}.md`：4 文件。重点核查 verifier 概率、gap 前提及实验饱和的适用范围；2026 年新闻、实验室阈值与每个实测案例并未全部重新核验。
- `11-frontier/interpretability/sparse-autoencoders{,.en}.md`：2 文件。重点核查手算、TopK 与 oracle 稀疏编码的区别；后半篇所有 2025–2026 研究并未逐条核验。
- `13-embodied/README{,.en}.md`：2 文件，并对照上一轮自然语言介绍。
- `13-embodied/perception/camera-geometry{,.en}.md`：2 文件。核查标定、双目误差和齐次投影。
- `13-embodied/driving/prediction-planning{,.en}.md`：2 文件。核查玩具代价与概率反例、PDM 原论文表格；未完整核查 Tesla 演讲、Waymo 等全部后续材料。

### 局部精读，不算全文：5 文件

- `11-frontier/self-improvement/review{,.en}.md`：只读并同步修正饱和解释与 verifier 算例；中文标题的基线 diff 也读过。
- `11-frontier/interpretability/review{,.en}.md`：只读 SAE 相关问答并同步修正。
- `11-frontier/interpretability/README.md`：局部正文与基线 diff；未完成全篇精读。

### 只看基线 diff，未全文读：16 文件

- `03-multimodal-learning/README{,.en}.md`
- `03-multimodal-learning/clip.md`
- `03-multimodal-learning/{ocr-compression,omni-streaming,vlm-designs}{,.en}.md`
- `13-embodied/driving/{README,bev-occupancy}.md`
- `13-embodied/perception/README{,.en}.md`
- `13-embodied/perception/reconstruction.md`
- `13-embodied/perception/tracking{,.en}.md`

这些变化主要是标题、入口、引导句和链接；未因 diff 小而宣称原正文正确。范围内本次基线差异没有新增正文文件。

### 仅文件清点／关键词扫描，未人工全文审核：34 文件

- `11-frontier/interpretability/README.en.md`
- `11-frontier/interpretability/{features-and-superposition,circuits}{,.en}.md`
- `11-frontier/self-improvement/{code-not-weights,measuring}{,.en}.md`
- `11-frontier/world-models/{README,do-they-understand,interactive-video,review,robotics-driving}{,.en}.md`
- `13-embodied/driving/{README,bev-occupancy}.en.md`
- `13-embodied/driving/end-to-end{,.en}.md`
- `13-embodied/perception/reconstruction.en.md`
- `13-embodied/perception/{detection,foundation-models}{,.en}.md`
- `13-embodied/robot-learning/{README,imitation,vla}{,.en}.md`

扫描只寻找本轮错误的重复表述，例如“只在训练”“13 cm”“87.5%”“几轮饱和”；命中片段不等于该页已读。没有自动语义审核通过的结论。

### 未审核：1 文件

- `03-multimodal-learning/clip.en.md`：仅在文件清点中出现，未读正文或其独立 diff。

## 2. 实质问题、来源与修复

除非另写，位置均为同名中英文件的相同行号。数值检查均为本站教学算例，不是论文实验复现。

### F01 — Dreamer 部署不等于完全不用世界模型

- 原位置：`11-frontier/world-models/dreamer{,.en}.md:7`、`:11`、`:80`、`:113`。
- 问题：把无在线 lookahead 写成模型仅在训练使用；把 actor/critic 一概写成只从想象学习；杯子例子也容易被读成原论文的离线真机流程。
- 来源：[DreamerV3 arXiv v2](https://arxiv.org/html/2301.04104v2)的行为学习段落；[官方 agent.py](https://github.com/danijar/dreamerv3/blob/main/dreamerv3/agent.py)的 `policy` 调用 encoder 与 `dyn.observe`。论文和实现交叉核对，但没有把当前 main 实现等同于 2023 全套超参。
- 修复：部署保留观测编码与 RSSM 更新；区分 V1–V3 收集/训练交替和离线设定；补 critic 的 replay value loss（v2 权重 0.3，相对想象项 1）；将公式明确限定到 v2；“只见模型数字”限定为当前想象更新。
- 实际验证：来源段落与调用链人工核对；测试检查版本与状态更新说明，并复算 λ-return `[0.6948, 1.044, 1.72, 0.8]` 和误判终止后的 `-0.225`。

### F02 — DreamerV2 超人类是聚合指标，不是 55 个游戏逐一超人类

- 原位置：`11-frontier/world-models/dreamer{,.en}.md:119`。
- 来源：[DreamerV2 v4 §4、表 1](https://arxiv.org/html/2010.02193v4)。
- 修复：写明 55 游戏的 median gamer-normalized score 为 2.15；每游戏独立训练，200M 环境帧、动作重复 4，对应 50M 输入观测，单 V100 不到十天。避免把训练时长误读为整个套件总成本。
- 实际验证：逐项对照原表和实验设置；未运行 Atari。

### F03 — JEPA 的表示目标不是保证剔除一切无关细节

- 原位置：`11-frontier/world-models/jepa{,.en}.md:7`、`:16`、`:70`、`:76`、`:164`。
- 问题：I-JEPA 的空间预测被混成一律预测未来；96/100 噪声损失算例易被解释成无法学习杯子；LeJEPA 理论省略 probe/任务分布等条件；无 decoder 被写成只能用 probe。
- 来源：[I-JEPA v3 §8、附录 D](https://arxiv.org/html/2301.08243v3)有另训条件生成器的可视化；[LeJEPA v1 §3、附录 A](https://arxiv.org/html/2511.08544v1)限定固定能量、线性 probe 列空间或非线性任务梯度各向同性等前提。
- 修复：区分空间区域/未来表示；总 loss 掩盖进展不代表期望梯度不能学；固定 EMA 算例明确不是实际变化 schedule；高斯形状本身不提供标签信息；补规划评估与独立 decoder 可视化的途径及其假设。
- 实际验证：核对理论假设和可视化实验；复算固定 `0.996**100 = 0.6697825713`。未复现论文训练或评测。

### F04 — V-JEPA 2 原论文自身存在 L1 半径与 13 cm 不一致

- 原位置：`11-frontier/world-models/jepa{,.en}.md:113`。
- 来源：[V-JEPA 2 v1 §4.1、图 8](https://arxiv.org/html/2506.09985v1)同时写 L1 ball 半径 0.075 和约 13 cm。
- 问题与修复：若平移坐标单位为米，`||a||2 <= ||a||1 <= .075` 最多 7.5 cm；逐坐标界 `.075` 才给 `sqrt(3)*.075 = .1299038 m`，那是 L∞。正文保留并明确标出原文矛盾，不擅自改成“作者一定用了 L∞”。
- 实际验证：原文核对、范数反例单测。**动作缩放与真实 clipping 代码未追到，仍待复现核实。**

### F05 — verifier 假阴性会改变 precision；抽查接受集不能估计 false-positive rate

- 原位置：`11-frontier/self-improvement/generate-verify-train{,.en}.md:124`、`:157`；关联 `review{,.en}.md:33`。
- 问题：原文说误杀正确解不影响精度，还把接受集错误占比当作 `f=P(pass|wrong)`；两者分母不同。
- 来源框架：[Song et al. v2 §2.1](https://arxiv.org/html/2412.02674v2)中的 verifier 重加权；概率公式是本轮独立 Bayes 推导，不冒充论文结论。
- 修复：给出 `precision = pr / (pr + (1-p)f)`，分母须非零；400 正确、600 错误，错放 60 个时，正确解全留为 `400/460=86.96%`，正确解只留一半为 `200/260=76.92%`。接受集错解占比 `60/460` 不等于错解通过率 `60/600`。同步修复复习题缺少 recall 前提。
- 实际验证：计数反例与正文公式回归通过。

### F06 — gap 上下界及“几轮饱和”不是无条件不可能定理

- 原位置：`generate-verify-train{,.en}.md:7`、`:97`、`:120`、`:122`、`:130`、`:166`；`self-improvement/README{,.en}.md:36`、`:66`；`self-improvement/review{,.en}.md:26`。
- 来源：[Song et al. v2 §2.1、§5](https://arxiv.org/html/2412.02674v2)；[ReST-EM v2 的任务奖励和迭代实验](https://arxiv.org/html/2312.06585v2)。ReST-EM 用 ground-truth answers / tests，本来就有外部正确性信号。
- 修复：界包含效用更新误差；非正 gap 只说明这次重加权未提高效用；固定题集、固定测试、完美模仿才得到玩具单轮停滞；模型泛化并非不可能。“两三轮”限定为实验观察，ReST-EM 收益递减不再用来证明“没有外部 verifier”的普遍命题。同步复习题和展望段。
- 实际验证：人工核对假设、外部奖励和实验描述；针对正文版本、公式和相关反例的回归通过。未重新核验此页全部 2026 奖励投机案例。

### F07 — SAE 的 87.5% 不是重建能量；TopK 不做 oracle 字典搜索

- 原位置：`11-frontier/interpretability/sparse-autoencoders{,.en}.md:28`、`:34`、`:42`、`:54`、`:55`；`review{,.en}.md:43`、`:45`。
- 来源：[Gao et al. v1 §2.3–2.4](https://arxiv.org/html/2406.04093v1)：TopK 排序 encoder activations，主重建 loss 外还有 AuxK。
- 修复：单位斜方向写成精确 `1/sqrt(2)`；非负最优系数加截断；将 `1-error/input_energy=87.5%` 与 `reconstructed_energy/input_energy≈41.8%` 分开，也不称为数据均值基线的解释方差。TopK 能否选中斜方向及投影系数是条件，不是其算法保证。同步复习题。
- 实际验证：数值复算误差 0.25、两个比值及大 λ 全零边界；中英回归通过。

### F08 — 平面标定“两张就够”漏掉额外内参约束

- 原位置：`13-embodied/perception/camera-geometry{,.en}.md:87`。
- 来源：[Zhang 技术报告 §3.1](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr98-71.pdf)：一般线性解需三次非退化观测；两次需要额外约束，例如 zero skew。不能只照摘要的“至少两张”。
- 修复：补一般三视图、两视图附加条件和姿态退化限制。
- 实际验证：核对 `2n×6` 约束系统及原文两视图讨论。未运行标定工具。

### F09 — 深度误差是一阶近似，像素重投影须做齐次除法

- 原位置：`camera-geometry{,.en}.md:119`、`:127`、`:131`、`:132`。
- 来源：[Hartley–Zisserman 第 9 章，式 9.7](https://www.robots.ox.ac.uk/~vgg/hzbook/hzbook2/HZepipolar.pdf)；误差数值为本轮独立代入。
- 修复：固定焦距/基线时导数给局部敏感度，不是有限差分精确误差；40 m / 12.5 px 变为 13.5、11.5 px 后深度为 37.04、43.48 m，不是精确 ±3.2 m。一般变换输出齐次坐标，再除第三维；homography 用比例关系。补 `(.5,0,1) -> (.5,0,1.5) -> (1/3,0,1)` 例子。
- 实际验证：有限差分与齐次除法单测通过。未将局部双目关系外推成所有多视图系统的精度规律。

### F10 — 规划玩具漏掉零权重平局，概率打乱也未必降分

- 原位置：`13-embodied/driving/prediction-planning{,.en}.md:74`、`:98`、`:137`。
- 来源上下文：[PDM v2 §3.3](https://arxiv.org/html/2306.07962v2)的候选评分；反例为本站自拟代价函数和指标定义的直接推导，不是论文实验。
- 修复：`JC-JA=1.5 wc+(2/3) ws`，非负权重只能保证不严格胜过；`(1,0,0)` 会平局。补点车辆、C 横向轨迹给定、单位缩放等简化条件。固定 K 条轨迹只重排概率，minADE/minFDE 不变；mAP/似然可以升降或不变，不能保证一次打乱必然下降。
- 实际验证：从中英 Markdown 表读出实际代价，检查默认选 A、安全加倍选 B、零权重平局。概率反例按指标依赖人工核对，未运行真实驾驶评测。

### F11 — PDM 表格解释没有排除 Log Replay，且不是各列都反向排名

- 原位置：`prediction-planning{,.en}.md:119`。
- 来源：[PDM v2 §3.1、表 2](https://arxiv.org/html/2306.07962v2)。
- 修复：PDM-Open 开环最高限定为表内三种非 oracle 规划器；Log Replay OLS 为 100。PDM-Closed 的 OLS 42 仍高于 IDM 38，CLS-NR 93 低于 Log Replay 94，因此删除“正好反过来”的绝对比较；保留 42/86 与 92/54 的跨协议对比，注明仿真不是实路安全证明。
- 实际验证：逐格对原表核对；没有把 nuPlan 的无感知误差、HD map 设置当现实部署结果。

### F12 — VLM assistant-only loss 还需包含停止 token

- 原位置：`03-multimodal-learning/vlm-finetuning{,.en}.md:111`。
- 来源：[TRL v1.15.0 release](https://github.com/huggingface/trl/releases/tag/v1.15.0)与 [v1.16.0 trainer 源码](https://github.com/huggingface/trl/blob/v1.16.0/trl/trainer/sft_trainer.py)交叉核对。文档页面读取失败，因此本轮用 tagged source 核对，不宣称在线文档已读成功。
- 修复：保留新版本/Transformers/数据格式前提，补 generation mask 须覆盖 assistant end-of-turn token。否则 loss 看似健康也可能不学停止；保留旧 v0.29.0 路径说明，更新页首审阅日期。
- 实际验证：执行中英文 labels 例子，EOS label 保留，测试无有效 shifted target、错误 mask 类型的拒绝行为；未安装 TRL 或运行 VLM 训练。

### F13 — API 清单不能证明不存在开放权重；Qwen 版本要分别取证

- 原位置：`03-multimodal-learning/image-generation{,.en}.md:5`、`:77`。
- 来源：[Model Studio 图像模型列表](https://www.alibabacloud.com/help/en/model-studio/image-model)确认 3.0 / 3.0-pro 与 1–3 张编辑输入；[2.1 模型卡](https://huggingface.co/Qwen/Qwen-Image-2.1)及 [transformer config](https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/transformer/config.json)分别核对发布信息与 `num_layers:32`；[2.0 报告架构章节](https://arxiv.org/html/2605.10730v1)确认 Qwen3-VL、16× VAE；[2.0-RL §4.3](https://arxiv.org/html/2606.27608v1)确认 task-specific teacher 的 OPD。
- 修复：3.0 的证据范围写为已核对托管 API 文档，不再把检索未找到当成“只有 API/架构绝未公开”的全称结论；审阅日期对齐 10-16。没有删除各版本区别。
- 实际验证：官方页面和 config 人工核对；执行 flow-matching 算例与步长边界测试；没有下载权重或验证部署性能。另对照 [Qwen3.8-27B 官方模型卡](https://huggingface.co/Qwen/Qwen3.8-27B)检查既有 Qwen-VL 页的层数/混合结构条目，未扩展为全系列复现。

## 3. 目录融合与保留项

从上一轮 checkout `cooking-agi-next-review-20261015` 的 `11-frontier/README{,.en}.md`、`13-embodied/README{,.en}.md` 融合有效的问题式介绍、杯子例子和阅读路线，未整文件覆盖新目录。

- 保留 PR102 diffusion-lm 第六入口、所有草稿提示和原章节标题。
- 保留 embodied 到 `technology-timeline{,.en}.md?field=applications&track=robotics` 的新入口；筛选功能由主 agent 集成，本轮未修改共享导航实现。
- 26 个修改正文相对起始 HEAD 的 Markdown 标题、`paper-figure` / `widget` 标记、Mermaid 块逐一自动比对，全部一致。
- 不修改图资产、共享交互脚本、发布清单或 `site/expression-review.toml`。

## 4. 实际验证与改动文件

已运行且通过：

```text
PYTHONDONTWRITEBYTECODE=1 python3 site/tests/test_review_frontier_20261016.py
Ran 18 tests in 0.007s — OK（最终重跑）
```

测试执行六组双语笔记的 Python 块（BLIP 两块，其余每页一块，共 14 块），另外验证概率、SAE、范数、几何、规划、Dreamer 算例和入口/双语视觉标记。没有依赖真实模型、GPU 或网络。

已运行限定范围 `git diff --check`，无输出、exit 0。另做起始 HEAD 到修改版的 26 页标题、视觉标记、Mermaid 保留检查并通过。**未运行全站 tests/build、浏览器视觉验收或模型训练**；这些结果不替代主 agent 的集成验证。

修改 26 个正文文件（以下每项均为双语一对）：

- `03-multimodal-learning/image-generation{,.en}.md`
- `03-multimodal-learning/vlm-finetuning{,.en}.md`
- `11-frontier/README{,.en}.md`
- `11-frontier/world-models/dreamer{,.en}.md`
- `11-frontier/world-models/jepa{,.en}.md`
- `11-frontier/self-improvement/README{,.en}.md`
- `11-frontier/self-improvement/generate-verify-train{,.en}.md`
- `11-frontier/self-improvement/review{,.en}.md`
- `11-frontier/interpretability/sparse-autoencoders{,.en}.md`
- `11-frontier/interpretability/review{,.en}.md`
- `13-embodied/README{,.en}.md`
- `13-embodied/perception/camera-geometry{,.en}.md`
- `13-embodied/driving/prediction-planning{,.en}.md`

新增：`site/tests/test_review_frontier_20261016.py`；本报告 `site/reviews/2026-10-16/frontier.md`。

未提交、push、改分支、重置或触发 Actions；共享 checkout 中其他 agent 的文件未改动。

## 5. 未完成与交接

1. 覆盖台账中的局部/diff/扫描/未读页均不是完成审核；下一轮先读 `world-models` 的其余正文、`self-improvement/measuring` 和具身的检测/基础模型/VLA，特别是 2026 时效性结论。
2. V-JEPA 2 的 L1 / 13 cm 原文矛盾仍需动作预处理与控制实现证据；本轮仅标注矛盾，未猜测作者意图。
3. 目录之外共享图示/交互本轮未视觉审核。建议主 agent 定向检查 `step-verifier-ceiling`、`step-trajectory-cost` 是否仍复述旧 precision/平局结论，以及 JEPA 图注是否需同步；这是待核查项，不声称已经发现图实现错误。
4. 规划器方法表中 A* 的一致性/reopen 前提、RRT/RRT* 的鲁棒可行与渐近条件仍可补强；曾访问 [Karaman–Frazzoli 原论文](https://arxiv.org/html/1105.1186)与 A* 原论文镜像，但没有继续扩展修改或声称已完成这部分证明审核。
5. 已全文读页面中，新闻时间线、所有性能数据、许可证、所有近期论文仍未逐项核验。特别是 self-improvement overview 的“无实验室宣布跨阈值”等全称时效声明，仍需主 agent/后续来源审阅；不得用本轮 18 项测试为其背书。
6. 全站构建、链接/锚点集成、robotics 筛选行为、可视化与草稿发布状态由主 agent 统一验收。本轮保留草稿，不改变发布授权。
