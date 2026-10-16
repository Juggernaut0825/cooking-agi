# Training 高风险内容审核（2026-10-16）

## 边界与结论

- 工作目录：`/Users/tianyizhang/Documents/ChatGPT/Job Prep/cooking-agi-full-review-20261016`；原始内容定位统一以 `c0a75c1` 为准，主分支比较基线为 `02e914a`。收尾时 HEAD 仍为 `c0a75c1`。
- 独占正文：`05-post-training/**`、`11-frontier/agentic-rl/**`、`11-frontier/test-time-compute/**`。仅新增本报告与 `site/tests/test_review_training_20261016.py`。
- 按主 agent 的收尾要求停止扩展审核。本轮是**高风险定点审核，不是全范围审核完成，也不是全范围独立溯源完成**。
- 没有 reset、提交、push、切分支或触发 Actions；没有修改 `11-frontier/README*`、`CONTENT_RELEASE_CHECKLIST.md`、`site/expression-review.toml`，也没有修改共享图示生成器。
- 21 个既有文件修改（20 篇 Markdown + 1 个 Python），新增 1 个回归文件和本报告。共享 checkout 中其他 agent 的改动不计入本报告。

## 覆盖口径

“全文精读”只表示正文全部读过，不表示每条外部事实都已独立溯源或实验复现。长输出被截断且未确认补齐的页，保守列为“局部精读”，不冒充全文。所有源论文也只核对与问题相关的节、公式或表，不称整篇论文复核完毕。

本 scope 共 116 篇 Markdown：全文精读 17 篇；局部精读 17 篇；仅标题/结构扫描 2 篇；未读正文 80 篇。中英文分别计数。

### 全文精读

- `05-post-training/deep-rl/offline-and-ope.en.md`
- `05-post-training/deep-rl/ope-estimators.en.md`
- `05-post-training/deep-rl/ope-estimators.md`
- `05-post-training/deep-rl/returns-and-td.en.md`
- `05-post-training/post-training-infrastructure.en.md`
- `05-post-training/rlhf/after-rlhf.en.md`
- `05-post-training/rlhf/after-rlhf.md`
- `05-post-training/rlhf/rl-for-language-models.en.md`
- `05-post-training/rlhf/rl-for-language-models.md`
- `05-post-training/where-preferences-come-from.en.md`
- `11-frontier/agentic-rl/credit-and-training.en.md`
- `11-frontier/agentic-rl/environments-and-rewards.en.md`
- `11-frontier/agentic-rl/review.en.md`
- `11-frontier/test-time-compute/long-chains.en.md`
- `11-frontier/test-time-compute/parallel-and-verify.en.md`
- `11-frontier/test-time-compute/parallel-and-verify.md`
- `11-frontier/test-time-compute/review.en.md`

另全文读了 `EDITORIAL.md`（任务开始时的版本）、`deep-rl/code/rl_checks.py`、`deep-rl/code/torch_updates.py`。后者只有静态阅读，没有 PyTorch 运行验证。

### 局部精读，不算全文

- `05-post-training/after-ppo.en.md`
- `05-post-training/after-ppo.md`
- `05-post-training/deep-rl/actor-critic-gae.en.md`
- `05-post-training/deep-rl/actor-critic-gae.md`
- `05-post-training/deep-rl/experiments.en.md`
- `05-post-training/deep-rl/llm-bridge.en.md`
- `05-post-training/deep-rl/llm-bridge.md`
- `05-post-training/where-preferences-come-from.md`
- `11-frontier/agentic-rl/README.en.md`
- `11-frontier/agentic-rl/credit-and-training.md`
- `11-frontier/agentic-rl/environments-and-rewards.md`
- `11-frontier/agentic-rl/review.md`
- `11-frontier/test-time-compute/README.en.md`
- `11-frontier/test-time-compute/long-chains.md`
- `11-frontier/test-time-compute/measuring.en.md`
- `11-frontier/test-time-compute/measuring.md`
- `11-frontier/test-time-compute/review.md`

重点覆盖：after-ppo 的 GRPO/Reference/old-policy、REINFORCE++ 版本差异与 DPO 推导；bridge 的状态/动作/工具输出、GAE 边界；actor-critic 的代码、padding/平均与 autoreset；agentic 的 mask、共享动作、长度归一化和截断；test-time 的投票、验证器、ProRL 与自检重做例子。局部页仍有未读段落，特别是长引用列表、产品 API 档位与新模型自报数字。

### 只看 diff / 自动扫描

- “只看 diff、未读正文”的独立文件：**无**。实际阅读过的 `02e914a..c0a75c1` diff 主要是 `rlhf/after-rlhf.md`、`rlhf/rl-for-language-models.md`，二者同时列入全文。
- `git diff --stat` / 文件清单不是内容审核，不能当作看完 77 个变更文件。
- 仅标题/结构扫描，未精读正文：

- `05-post-training/model-adaptation.en.md`
- `05-post-training/model-adaptation.md`

- 收尾自动检查：对本轮编辑的 20 篇 Markdown，比较原始标题、显式 ID/锚点、paper-figure/widget 标记；未发现删除。这个检查**不是全站链接、旧 main 锚点或视觉渲染验证**。

### 未审核正文

以下只进入文件清单/范围统计；没有据此作内容正确性背书：

- `05-post-training/README.en.md`
- `05-post-training/README.md`
- `05-post-training/alignment-tax.en.md`
- `05-post-training/alignment-tax.md`
- `05-post-training/async-policy-learning.en.md`
- `05-post-training/async-policy-learning.md`
- `05-post-training/clipping-variants.en.md`
- `05-post-training/clipping-variants.md`
- `05-post-training/dapo.en.md`
- `05-post-training/dapo.md`
- `05-post-training/deep-rl/README.en.md`
- `05-post-training/deep-rl/README.md`
- `05-post-training/deep-rl/continuous-control.en.md`
- `05-post-training/deep-rl/continuous-control.md`
- `05-post-training/deep-rl/dqn.en.md`
- `05-post-training/deep-rl/dqn.md`
- `05-post-training/deep-rl/experiments.md`
- `05-post-training/deep-rl/exploration-and-hierarchy.en.md`
- `05-post-training/deep-rl/exploration-and-hierarchy.md`
- `05-post-training/deep-rl/fitted-q.en.md`
- `05-post-training/deep-rl/fitted-q.md`
- `05-post-training/deep-rl/imitation-and-rewards.en.md`
- `05-post-training/deep-rl/imitation-and-rewards.md`
- `05-post-training/deep-rl/mdp-bellman.en.md`
- `05-post-training/deep-rl/mdp-bellman.md`
- `05-post-training/deep-rl/methods-map.en.md`
- `05-post-training/deep-rl/methods-map.md`
- `05-post-training/deep-rl/model-based.en.md`
- `05-post-training/deep-rl/model-based.md`
- `05-post-training/deep-rl/model-types.en.md`
- `05-post-training/deep-rl/model-types.md`
- `05-post-training/deep-rl/offline-and-ope.md`
- `05-post-training/deep-rl/planning-and-control.en.md`
- `05-post-training/deep-rl/planning-and-control.md`
- `05-post-training/deep-rl/planning-and-learning.en.md`
- `05-post-training/deep-rl/planning-and-learning.md`
- `05-post-training/deep-rl/policy-gradients.en.md`
- `05-post-training/deep-rl/policy-gradients.md`
- `05-post-training/deep-rl/returns-and-td.md`
- `05-post-training/deep-rl/soft-actor-critic.en.md`
- `05-post-training/deep-rl/soft-actor-critic.md`
- `05-post-training/deep-rl/trust-region.en.md`
- `05-post-training/deep-rl/trust-region.md`
- `05-post-training/deep-rl/why-rl-is-hard.en.md`
- `05-post-training/deep-rl/why-rl-is-hard.md`
- `05-post-training/distillation.en.md`
- `05-post-training/distillation.md`
- `05-post-training/lora-and-qlora.en.md`
- `05-post-training/lora-and-qlora.md`
- `05-post-training/parameter-efficient-tuning.en.md`
- `05-post-training/parameter-efficient-tuning.md`
- `05-post-training/policy-ratios.en.md`
- `05-post-training/policy-ratios.md`
- `05-post-training/post-training-infrastructure.md`
- `05-post-training/rejection-sampling.en.md`
- `05-post-training/rejection-sampling.md`
- `05-post-training/rlhf/README.en.md`
- `05-post-training/rlhf/README.md`
- `05-post-training/rlhf/evaluation-and-review.en.md`
- `05-post-training/rlhf/evaluation-and-review.md`
- `05-post-training/rlhf/kl-estimators.en.md`
- `05-post-training/rlhf/kl-estimators.md`
- `05-post-training/rlhf/on-off-policy.en.md`
- `05-post-training/rlhf/on-off-policy.md`
- `05-post-training/rlhf/ppo-clipping.en.md`
- `05-post-training/rlhf/ppo-clipping.md`
- `05-post-training/rlhf/reference-and-critic.en.md`
- `05-post-training/rlhf/reference-and-critic.md`
- `05-post-training/rlhf/three-stages.en.md`
- `05-post-training/rlhf/three-stages.md`
- `05-post-training/rlhf/value-and-advantage.en.md`
- `05-post-training/rlhf/value-and-advantage.md`
- `05-post-training/same-base-different-posttraining.en.md`
- `05-post-training/same-base-different-posttraining.md`
- `05-post-training/sft-and-its-ceiling.en.md`
- `05-post-training/sft-and-its-ceiling.md`
- `05-post-training/verifiable-rewards.en.md`
- `05-post-training/verifiable-rewards.md`
- `11-frontier/agentic-rl/README.md`
- `11-frontier/test-time-compute/README.md`

其他代码：`05-post-training/code/policy_gradient_checks.py`、`05-post-training/code/selection_and_entropy.py`、`deep-rl/code/rl_tradeoffs.py` 未在本轮精读/运行。SVG 与实际页面渲染未审核。

## 实质问题、来源、修复与验证

下面“原位置”是 **c0a75c1 的行号**，不是修复后的行号。以英文位置定位跨语言问题；除特别说明，两种语言对应段落都已同步修正，不把英文行号假称中文行号。

### 1. GAE 的零乘 NaN 会跨 episode 污染

- 原位置：`05-post-training/deep-rl/code/rl_checks.py:24`、`:27`；两种语言 `actor-critic-gae` 的同名代码块。
- 原因：`same_episode * carry` 为零并不能清除 NaN；同理 gamma 为零时，未使用的 next value 也不应参与乘法。原版两段轨迹 `rewards=[1,nan]`、第一段已 terminated，仍得到 `[nan,nan]`，已实际运行原版函数复现。
- 修复：用分支决定是否引入 continuation；gamma=0 跳过 successor value，trace_decay=0 跳过 carry。保留当前动作真实 reward/value 的 NaN，不伪装有效数据。
- 依据：[Gymnasium 时间限制与 bootstrap](https://gymnasium.farama.org/tutorials/gymnasium_basics/handling_time_limits/)、[Farama vector autoreset](https://farama.org/Vector-Autoreset-Mode)；NaN 行为由本地 Python 实测。
- 实际验证：终止后首项为 1；截断 bootstrap 例子首项为 5.5；gamma=0 得 0.75；lambda=0 不受未来 NaN 污染。中英文代码块与可执行函数 AST 一致且分别执行。

### 2. Gymnasium 版本和 autoreset 模式被概括过度

- 原位置：`05-post-training/deep-rl/actor-critic-gae.en.md:112`。
- 原因：笼统写“Gymnasium 1.x 默认 next-step”，容易把 reset-only 返回记成 agent action，或把 reset observation 拿来 bootstrap。
- 修复：限定 Gymnasium v1.1 的 next-step / same-step / disabled；明确 next-step 的 reset-only 项不进 transition buffer，same-step 从 `info["final_obs"]` 取实际末状态；其他 wrapper/版本另查。
- 来源：[Farama v1.1 官方说明](https://farama.org/Vector-Autoreset-Mode)。实际验证为文档对照和 GAE 单测，**未安装 Gymnasium 重跑各 vector 模式**。

### 3. OPE 的无偏、降方差和覆盖条件缺失

- 原位置：`05-post-training/deep-rl/ope-estimators.en.md:7`、`:22`、`:45`、`:55`、`:94`、`:147` 起的总结表。
- 原因：样本“足够多”不是普通 IS 无偏的必要条件；PDIS 单项条件方差下降不自动推出总和方差下降；自归一化不是普遍降方差；权重和为零时比值未定义；边缘状态比也可能指数大；DR 的有限样本无偏需要固定/独立拟合条件。
- 修复：写清固定目标策略、真实行为概率、support/integrability、正分母、gamma<1 与共同初态分布；限定方差结论；补样本分离/交叉拟合；将 marginal ratio 的结论与覆盖常数关联。
- 来源：[Precup et al. 定理 1](http://incompleteideas.net/papers/PSS-00.pdf)、[Jiang & Li §3](https://arxiv.org/pdf/1511.03722)、[Xie et al. §2/§4 的覆盖和比值界条件](https://arxiv.org/pdf/1906.03393)。本轮重点复核后两篇的条件；没有重新复现其整套实验。
- 可复算反例及实际验证：
  - 行为 [.5,.5]、目标 [.8,.2]、奖励 [.625,2.5]：普通 IS 恒为 1、方差 0；单样本 SNIS 均值 1.5625、方差 0.87890625。
  - 连续 10 次必须选 A：目标成功概率 1，行为概率 2^-10，末状态比 1024。
  - DR 用同一条日志记忆 Q，行为 [.9,.1]、目标各半、奖励 [1,3]：估计均值 0.6，真实值 2；换成与该样本独立的固定 Q 后均值恢复 2。
  - 上述均由专属回归计算，不依赖 Monte Carlo 波动。

### 4. DPO 去重摘要不应删掉推导前提

- 原位置：`05-post-training/rlhf/after-rlhf.en.md:151`；中文展开推导段。
- 原因：去重后仍无条件声称 KL 奖励最大化存在闭式最优策略，读者只看本页会漏 beta>0、有限配分函数和 support 条件。
- 修复：用一段话保留这些前提、取 log 的概率为正及有限网络未必达到分布空间最优；完整推导继续链接 after-ppo，没有再复制一整套公式。
- 来源：[DPO §4 与附录](https://arxiv.org/html/2305.18290v3#S4)。核对了 Bradley–Terry 中同一 prompt 的配分项抵消。
- 实际验证：两种语言 3 个 Python 例子分别执行：GRPO 组优势、旧策略概率比分母/clipping、DPO loss 0.5130152524 全通过。
- 无需改动的重点：reward、advantage、old policy、Reference 的作用已区分；DeepSeekMath 原始 GRPO 可用 RM，并非必然 RLVR；本轮以 [DeepSeekMath §4.1](https://arxiv.org/html/2402.03300v3#S4.SS1) 交叉核对，不把 Critic-free 写成 reward-model-free。

### 5. action loss mask 被误写成阻断所有梯度

- 原位置：`11-frontier/agentic-rl/credit-and-training.en.md:21`、`:55`、`:59`，以及 review 对应问答。
- 原因：“只有 200 个 token 收到梯度”把直接 loss target 与条件上下文的反向传播混为一谈；工具文本 mask 不等于 attention mask / stop-gradient。未 mask 多 6 倍 token，也不能推出梯度大小恰为 6 倍。
- 修复：改为 200 个直接 policy-loss 目标位置；后续动作损失仍可经工具上下文的内部表示反传；把错误目标数量与实际梯度幅值分开。
- 来源：[Search-R1 §3.1 与 Table 4](https://arxiv.org/html/2503.09516v3)、[verl Agent Loop 的 response_mask](https://verl.readthedocs.io/en/latest/advance/agent_loop.html)。核对 Search-R1 相应消融的 .431/.343 是论文报告，未训练复现。
- 实际验证：只有 action loss 的二分类 toy，context 参数 .2 的有限差分梯度约 -0.450166，非零；**这是数学反例，不是 PyTorch autograd 集成测试**。

### 6. 共享动作、REINFORCE surrogate 与长度归一化

- 原位置：`11-frontier/agentic-rl/credit-and-training.en.md:13` 附近公式说明、`:65` 及后续“首步相消”段。
- 原因：去掉 ratio/clipping/KL 不是代数上直接得到 -A logp；两条同动作轨迹的 score gradient 相同，不代表乘了正负 A 后方向相同；组内 A 和为零也不保证逐轨迹长度平均后首步相消。
- 修复：说明 fresh-data REINFORCE surrogate 的局部梯度对应条件（behavior=current、未 clipping、固定 A、无其他项）；区分未加权与加权梯度；补相消需要共同分母且不能推出共享参数下真实动作概率不动。
- 来源：[DeepSeekMath §4.1 目标](https://arxiv.org/html/2402.03300v3#S4.SS1)、[Search-R1 §3.1](https://arxiv.org/html/2503.09516v3)。附加反例是直接对这类目标的算术推导。
- 实际验证：A=[1,-1]、长度 [2,6]，逐轨迹平均的同一首步系数为 (1/2-1/6)/2=1/6；共同 token 分母则为 (1-1)/8=0。

### 7. task termination 与采集截断混写

- 原位置：`11-frontier/agentic-rl/credit-and-training.en.md:99` 及 review 限制问答。
- 原因：任务定义的限时失败可以是真实终止；外部采样暂停才需要讨论 bootstrap/续采。直接丢弃超长轨迹会改变分布，并非无偏修复。
- 修复：拆开任务 horizon 与 collector cutoff；允许续采至完整回报或使用 critic；把 DeepSWE compact filtering 限定为具体训练配方而非普遍定理；去掉“目前最常用”之类缺少普查证据的措辞。
- 来源：[Gymnasium 官方说明](https://gymnasium.farama.org/tutorials/gymnasium_basics/handling_time_limits/)、[DeepSWE 作者说明](https://www.together.ai/blog/deepswe)。
- 实际验证：GAE 的终止与截断例子分别验证；DeepSWE 配方按作者发布材料核对，没有重跑训练。

### 8. 通过样本抽查不能直接估计验证器漏检率

- 原位置：`11-frontier/agentic-rl/environments-and-rewards.en.md:100` 起的审计表。
- 原因：随机审核通过补丁估计 P(wrong|pass)，不是 q_miss=P(pass|W2)；恢复测试也不能无条件保证所有攻击收益为零。
- 修复：改表中的可测量量；补充条件概率算例与包含被拒样本的独立分类要求；“H 收益为零”只保留为 toy 假设，不当成现实保证。
- 依据：本页定义与条件概率公式的直接推导，不依赖外部模型实验；这里没有可归属给某篇论文的实验结果，也不拿相邻论文链接为反向条件概率等式背书。可复算证据是下面的枚举值和专属回归。
- 实际验证：错误且通过=.2×.2=.04，总通过=.34，通过样本错误占比=.04/.34≈11.8%，不是20%。回归还检查插入说明未拆断 Markdown 审计表。
- **未独立确认**该页 ImpossibleBench、UTBoost、Kimi K3、GLM-5 环境数量等所有外部结果，见待办。

### 9. 投票的渐近众数规律被当成有限预算单调性

- 原位置：`11-frontier/test-time-compute/parallel-and-verify.en.md:7`、`:43`，以及 review。
- 原因：一次 64 样本计数不证明真实众数；“正确答案不是众数，投票就一定有害”对有限 N 不成立；平票和“错误答案永不重复”的理想化也需单独说明。
- 修复：限定固定分布、iid、有限答案集合、唯一众数的渐近结论；补有限预算反例。
- 来源：[Self-consistency 原论文](https://arxiv.org/abs/2203.11171) 提供方法定义；本次有限 N 反例由独立精确枚举验证，不伪称论文结论。
- 实际验证：[.40,.41,.19] 中首项正确，三票、平票均匀选时准确率 .41432>.4，但极限为0；二项 [.4,.6] 三票为 .352。

### 10. 验证器选择规则、边界值与 recall 的作用不清

- 原位置：`11-frontier/test-time-compute/parallel-and-verify.en.md:49`–`:65`，以及 review。
- 原因：“选一个通过的”不足以唯一决定准确率；基于内容/分数的再选择不满足原公式；分母为0时接受样本 precision 未定义；r<1 并非一定降低极限，f=0、p>0、r>0 时仍趋近1。
- 修复：写明 iid answer/verdict、固定 generator、按生成顺序取第一个通过者、全拒时回退首样本；改为无除零的多项式 prΣq^j+p(1-r)q^(N-1)，明确 q=0/1、N=1；不冒充所有 best-of-N/search 的上界。
- 来源：对文中明确采样/选择规则的全概率展开；[Lightman et al.](https://arxiv.org/html/2305.20050v1) 用于区分真实 reward-model ranking 实验与本页二元 accept/reject toy，不拿 toy 公式代替论文实验。
- 实际验证：穷举 81 组 (p,r,f,N) 参数组合对应的全部 4 类样本序列；公式与选择算法一致；覆盖 p=0/1、r=0/1、f=0/1、全拒、全接受、N=1，另查表值 .7956256。

### 11. Lightman 实验英文把 held-out 评估写成训练集

- 原位置：`11-frontier/test-time-compute/parallel-and-verify.en.md:77`。
- 原因：“fine-tuned ... on 500 MATH test problems”语法上表示用500测试题微调，造成数据泄漏误读。
- 修复：改为 GPT-4-based generator 在500 held-out MATH题上评估，从每题1860样本选择；英文 review 同步明确 held-out。中文原对应句未声称拿这500题训练，不强行扩写。
- 来源与实际验证：[Lightman et al. Appendix C 的数据划分](https://arxiv.org/html/2305.20050v1)。核对原文，不是重新跑78.2/72.4/69.6成绩。

### 12. 自检重做的 .65 隐藏了完美检错前提

- 原位置：`11-frontier/test-time-compute/long-chains.en.md:31`、`review.en.md:51`。
- 原因：.3+.7×.5=.65 需要检测所有初次错误且不损坏正确答案，不能从“发现不对就重做”直接得到。
- 修复：补齐假设，给检错率40%时 .44 的对照，说明误伤正确答案还应扣损失；review 同步。
- 来源：按条件事件分解直接推导；R1 相关背景仍链接 [DeepSeek-R1](https://arxiv.org/abs/2501.12948)，不把 toy 当成其消融实验。
- 实际验证：回归重算 .65/.44；未声称已验证任何模型具有完美自检能力。

### 13. 蒸馏教师上界、ProRL 无限预算与延迟承诺

- 原位置：`long-chains.en.md:46`、`:132`；`measuring.en.md:78`；`review.en.md:16`、`:65`（均位于 test-time-compute）。
- 原因：教师测试分数不是学生数学上界；有限次数无解不是任意预算也无解；“并行延迟几乎不变”省略硬件/服务并发条件。
- 修复：改为教师错误和数据覆盖风险，链接反例；ProRL 明确至多256次基座采样；并行延迟限定真正并发能力，区分 P 参数量/n样本数并补 prompt/attention/verification 开销。
- 来源：[Born Again Neural Networks](https://arxiv.org/abs/1805.04770)、[ProRL §4.2](https://arxiv.org/html/2505.24864v1)、[Snell et al. 计算口径](https://arxiv.org/html/2408.03314v1)。
- 实际验证：核对 BAN 摘要反例和 ProRL 明确的256预算；回归保证三组中英文相关页均保留256。没有性能/延迟 benchmark，不声称验证所有 API 实际时延。

## 来源核查的边界

- 已针对本轮问题检查：DeepSeekMath §4.1、DPO §4/附录、Search-R1 §3.1/Table4、Jiang & Li 独立性条件、Xie 等的覆盖假设、Gymnasium/Farama、verl mask、DeepSWE 配方、Lightman 划分、ProRL §4.2、BAN 反例。
- 阅读过 GiGPO 的分组和超参数相关节，以及 [GLM-5.2 作者镜像](https://huggingface.co/blog/zai-org/glm-52-blog) 的 critic/PPO 说明。这里只能说明公开配方，不代表已验证正文所有数字或复现模型。
- [Rubrics as Rewards v2](https://arxiv.org/html/2507.17746v2) 核到显式聚合公式、训练配置和摘要相对改善口径；[DeepSeek-GRM](https://arxiv.org/html/2504.02495v1) 与 [REINFORCE++ v9](https://arxiv.org/html/2501.03262v9) 做了相关段检索，但未完成全部公式/版本逐项核对，相关页不因此晋升“独立验证完成”。
- TRL v1.16.0 固定版本页面多次返回工具读取错误；未据搜索摘要认证所有 default/loss/importance-sampling 配置。该验证缺口保留给主 agent。
- Navier–Stokes 事件虽然打开过官方页与论文，但没有完成原始问题范围、forcing 与引用一致性的整组核对，不作已核验结论。

## 实际验证结果

仅运行本 scope 的专属回归和原有轻量自检，没有并行跑全站测试或 build。

```text
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 -m unittest discover -s site/tests -p test_review_training_20261016.py -v
Ran 19 tests in 0.006s — OK

PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 05-post-training/deep-rl/code/rl_checks.py
PASS: Bellman, return, GAE boundaries, Double DQN, ESS, LQR, projection, KL

git diff --check -- 05-post-training 11-frontier/agentic-rl 11-frontier/test-time-compute site/tests/test_review_training_20261016.py
通过，无输出
```

另独立执行原始 c0a75c1 GAE 复现 `[nan,nan]`，并检查20篇改动 Markdown 的原有标题、显式锚点和图示标记未丢失。环境无 PyTorch；没有把有限差分或静态检查写成 autograd/训练验证。测试通过不替代内容与证据判断。

## 改动文件

- `05-post-training/deep-rl/actor-critic-gae.en.md`
- `05-post-training/deep-rl/actor-critic-gae.md`
- `05-post-training/deep-rl/code/rl_checks.py`
- `05-post-training/deep-rl/ope-estimators.en.md`
- `05-post-training/deep-rl/ope-estimators.md`
- `05-post-training/rlhf/after-rlhf.en.md`
- `05-post-training/rlhf/after-rlhf.md`
- `11-frontier/agentic-rl/credit-and-training.en.md`
- `11-frontier/agentic-rl/credit-and-training.md`
- `11-frontier/agentic-rl/environments-and-rewards.en.md`
- `11-frontier/agentic-rl/environments-and-rewards.md`
- `11-frontier/agentic-rl/review.en.md`
- `11-frontier/agentic-rl/review.md`
- `11-frontier/test-time-compute/long-chains.en.md`
- `11-frontier/test-time-compute/long-chains.md`
- `11-frontier/test-time-compute/measuring.en.md`
- `11-frontier/test-time-compute/measuring.md`
- `11-frontier/test-time-compute/parallel-and-verify.en.md`
- `11-frontier/test-time-compute/parallel-and-verify.md`
- `11-frontier/test-time-compute/review.en.md`
- `11-frontier/test-time-compute/review.md`
- `site/reviews/2026-10-16/training.md`
- `site/tests/test_review_training_20261016.py`

## 交接待办

1. 主 agent 统一全站 tests/build、HTML/linkcheck、目录/导航以及窄屏视觉检查；本 agent 已停止正文编辑。
2. 按覆盖清单续读局部页与未读页；尤其 model-adaptation、padding/action 相关其余实现、policy-ratios、异步策略、KL 与采样分布修正不能凭本轮结果放行。
3. 补核 TRL 固定版本实际默认值；REINFORCE++ v1/v9 差异；agentic 2026 模型、环境量级、ImpossibleBench/UTBoost 原始统计；test-time 产品 API 档位、Navier–Stokes、最新 benchmark 数字与污染论断。
4. 现存图示全部保留，未渲染；共享图/导航若仍有问题，应交对应 scope 处理，不能从标记保留推导视觉正确。
5. 草稿标识全部保留。站主审核状态没有因为本轮修复而自动变为“已审核”。
