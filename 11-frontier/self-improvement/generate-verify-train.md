# 自我改进：生成、验证、再训练，为什么卡在验证器

**中文** · [English](generate-verify-train.en.md)

> 阅读时间：约 12 分钟 · 最近审阅：2026-10

让一个写 Python 函数的模型每道题生成几份解答，跑一遍测试，只把通过的拿去微调，再用新模型生成下一轮。这个回路不需要人写答案，看起来可以一直转下去。可如果测试会放过一部分错解，这些错解也会进训练集。**筛选本身不能区分验证器一视同仁的解；微调可能泛化，但不能仅凭测试通过率，就断言这些错已经被改掉。**

## 一个回路，三个零件

生成、验证、训练。[STaR](https://arxiv.org/abs/2203.14465)（Zelikman 等，2022）是最常被引用的版本：模型先写推理过程和答案，只留下答对的，在这些样本上微调，再进入下一轮。按本系列的写代码例子改写，结构对应 STaR 的 Algorithm 1：

```text
输入：预训练模型 M；题目集 {(x_i, T_i)}，T_i 是第 i 题的测试
M_0 ← M
for n = 1..N:
    对每道题 x_i，用 M_{n-1} 生成解答 ŷ_i
    D_n ← {(x_i, ŷ_i) : ŷ_i 通过 T_i}          # 验证：只留通过的
    对没通过的题，把提示放进 prompt 再生成；通过的也加入 D_n
                                              # STaR 里提示是正确答案，叫 rationalization
    M_n ← 从原始 M 出发，在 D_n 上微调          # 每轮从原模型重训，不接着 M_{n-1} 训
```

STaR 在 §3.1 里把这个过程看成对下面目标做 policy gradient 的近似：

$$
J(M)=\sum_i \mathbb E_{\hat r_i,\hat y_i\sim p_M(\cdot\mid x_i)}\big[\mathbf 1(\hat y_i=y_i)\big]
$$

$\hat r_i$ 是采样出的推理过程，$\hat y_i$ 是答案，$\mathbf 1(\cdot)$ 答对取 1、答错取 0。取 0 的样本梯度为零，所以“扔掉错的、在剩下的上做 SFT”就近似于一次用 0/1 奖励的 policy gradient 更新：**筛选规则就是奖励**。换到写代码的例子里，$\mathbf 1(\hat y_i=y_i)$ 变成了 $\mathbf 1(\hat y_i\text{ 通过 }T_i)$。回路优化的是“通过测试”，而不是“写对”，后面的问题都从这里来。

STaR 报告的结果：GPT-J 在 CommonsenseQA dev 上 72.5%，直接微调是 60.0%，大约 30 倍大的 GPT-3 是 73.0%（Table 1）；GSM8K 上 10.7% 对 5.8%（Table 2）。它也写清了两个前提：没有 rationalization，模型解不出的题永远不产生训练信号，改进会停下（§3.2）；第一轮的 few-shot 正确率必须高于随机，GPT-2 连算术都没能自举起来（§6）。§6 还提到，二选一的题容易碰巧答对，会混进很多推理错误的样本。

## ReST-EM：把“筛选再微调”写成 EM

Google DeepMind 的 [ReST-EM](https://arxiv.org/abs/2312.06585)（Singh 等，2023-12）把同一个回路写成 RL 里的 EM。奖励 $r$ 非负，M 步是：

$$
\theta_{t+1}=\arg\max_\theta\;\mathbb E_{x\sim\mathcal D}\,\mathbb E_{y\sim p_{\theta_t}(y\mid x)}\big[r(x,y)\,\log p_\theta(y\mid x)\big]
$$

样本来自上一轮的模型 $p_{\theta_t}$，在这一步里固定不动；目标是按奖励加权的最大似然。$r$ 取 0/1 时，它就是“在通过的样本上做 SFT”。E 步对应生成和筛选，M 步对应微调（他们每轮也从 base model 开始微调）。论文特别指出，和 PPO 这类在线 RL 相比，这里采样策略固定在上一轮，数据收集和策略优化是分开的。

实测上，论文 §1 说超过两轮左右收益就递减，作者归因于在少量训练题上过拟合；APPS 上迭代更多轮反而退步。2017 年的 [Expert Iteration](https://arxiv.org/abs/1705.08439) 属于同一家族：树搜索当“专家”产生更好的目标，神经网络当“学徒”模仿，学徒再引导下一轮搜索。筛选会怎样改变训练分布，见站内的[拒绝采样](../../05-post-training/rejection-sampling.md)；用测试当奖励的一般问题，见[可验证奖励](../../05-post-training/verifiable-rewards.md)。

## 没有标准答案时，让模型给自己打分

Meta 与 NYU 的 [Self-Rewarding Language Models](https://arxiv.org/abs/2401.10020)（Yuan 等，2024-01）把验证器也换成模型自己：Llama 2 70B 用 LLM-as-a-Judge 的方式给自己的回答打分，组成偏好对，再做迭代 DPO；论文报告打分能力也随之提高。AlpacaEval 2.0 上对 GPT-4 Turbo 的胜率三轮依次为 9.94%、15.38%、20.44%（Table 1）。论文自己列出的限制是：只在一种设置下跑了 3 轮；输出越来越长；没有研究 reward hacking；并且认为这种效果在真实场景里“可能会饱和”。

更早的 [Huang 等（2023）](https://arxiv.org/abs/2310.01798)测了另一种“自己判自己”：没有外部反馈时，模型常常改不对自己的推理，有时还会改得更差。

## 题目也自己出：Absolute Zero 与 R-Zero

[Absolute Zero](https://arxiv.org/abs/2505.03335)（Zhao 等，2025-05）让一个模型扮演两个角色：出题者提出任务 $\tau$，Python 执行器把它变成经过验证的题目和答案 $(x,y^\star)$，解题者再来解。目标（Eq. 3）：

$$
\max_\theta\;\mathbb E_{z}\;\mathbb E_{\tau\sim\pi_\theta^{\rm propose}(\cdot\mid z),\;(x,y^\star)\sim f_e(\cdot\mid\tau)}\Big[\lambda\,r^{\rm propose}(\tau,\pi_\theta)+\mathbb E_{y\sim\pi_\theta^{\rm solve}(\cdot\mid x)}\,r^{\rm solve}(y,y^\star)\Big]
$$

$z$ 是出题时的条件，例如从缓存里抽几个旧的题目–答案对；$f_e$ 是执行器所代表的环境；$\lambda$ 平衡两种奖励。出题者的 learnability reward（Eq. 4）和解题者的奖励（Eq. 5）是：

$$
\bar r_{\rm solve}=\frac1G\sum_{i=1}^{G}r_{\rm solve}^{(i)},\qquad
r^{\rm propose}=\begin{cases}0,&\bar r_{\rm solve}=0\\1-\bar r_{\rm solve},&\text{其他情况}\end{cases},\qquad
r^{\rm solve}=\mathbf 1(y=y^\star)
$$

$\bar r_{\rm solve}$ 是解题者对同一道题做 $G$ 次 Monte Carlo 尝试的平均成功率。手算一次，取 $G=4$：

| 出的题 | 4 次里解出 | $\bar r_{\rm solve}$ | $r^{\rm propose}$ |
| --- | --- | --- | --- |
| 任务 1 | 0 | 0 | 0 |
| 任务 2 | 2 | 0.5 | 0.5 |
| 任务 3 | 4 | 1 | 0 |
| 任务 4 | 1 | 0.25 | 0.75 |

前三行是论文的直觉：一次都解不出和次次都能解出的题，对解题者都没有学习信号，出题者也拿不到奖励。第 4 行是直接按公式算出来的：奖励最高的不是成功率 0.5 的题，而是“偶尔能解出”的题；$G=4$ 时最多拿到 $1-1/4=0.75$。这和 STaR 的困难是同一件事：没有一次成功，就没有信号。

<!-- paper-figure:azr-loop -->

“Zero”指的是不用人工整理的题目和答案；预训练好的 base model 和代码执行器仍然少不了。论文 §4.2 报告 AZR-Coder-7B 的平均分比此前最好的 zero 设置模型高 1.8 分，在代码平均分上比用专家整理代码数据训练的模型高 0.3 分；在 Llama-3.1-8B 上还观察到令人担忧的推理链（作者称为“uh-oh moment”）。[R-Zero](https://arxiv.org/abs/2508.05004)（2025-08）从同一个 base model 分出 Challenger 和 Solver 共同演化，摘要报告 Qwen3-4B-Base 在数学上 +6.49、通用推理上 +7.54，都是相对 base model 的提升。

## 验证器给的上限：generation–verification gap

[Song 等（ICLR 2025）](https://arxiv.org/abs/2412.02674)把上面这些回路拆成同一个框架：生成器 $f$ 采样，验证器 $g$ 打分 $\hat u_g$，用权重 $w(\hat u_g)$ 对样本重新加权，得到分布 $f[w(\hat u_g)]$，再把模型蒸馏到这个分布上。$J$ 是按真实效用算的期望得分。Definition 2.1：

$$
\operatorname{gap}(f,g)=J\big(f[w(\hat u_g)]\big)-J(f)
$$

它问的是：按验证器的意见重新加权，真实得分能涨多少。$g=f$ 就是自我改进。如果更新步骤能把重新加权后的分布学到误差 $\varepsilon_{\rm update}$ 以内，论文给出：

$$
J(f_{t+1})-J(f_t)\;\ge\;\operatorname{gap}(f_t,g)-\varepsilon_{\rm update}
$$

同一个前提也意味着提升不会超过 $\operatorname{gap}+\varepsilon_{\rm update}$。因此，**只有更新误差较小时，一轮提升才接近这个 gap**。gap ≤ 0 表示这次重加权没有提高真实效用，不等于任何训练都不可能进步；在该假设下，提升仍可在误差项的范围内波动。论文也把格式学习等微调收益与验证重加权带来的收益区分开来。这里按[论文 v2 §2.1](https://arxiv.org/html/2412.02674v2)的假设解释，不把它当成所有自训练方法的无条件上限。

<!-- paper-figure:gv-gap-definitions -->

论文的测量（§4–5）：相对 gap 随预训练 FLOPs 单调增大；Qwen-1.5 0.5B、Qwen-2 0.5B、Llama-2 7B 等小模型在几乎所有验证方式下 gap 都不为正；事实类任务上没有显著 gap；迭代时 gap 在两三轮内降到接近 0，不同大小的模型饱和速度相近；大 $k$ 的 pass@k 随轮数下降，说明有效多样性在减少。

## 算一次：测试会放过错解

下面是教学假设，数字是编的。在一批题上，模型生成的解答里 40% 真正正确。测试接受所有正确解，同时放过比例为 $f$ 的错解，比如测试只查了几个普通输入，没查空列表和负数。把通过测试的解拿去微调，并假设微调能把这批解的分布原样学下来，也就是 $\varepsilon_{\rm update}=0$。通过测试的样本占 $0.40+0.60f$，其中真正正确的比例是：

$$
\text{精度}=\frac{0.40}{0.40+0.60f}
$$

| 错解被放过的比例 $f$ | 通过测试的占比 | 其中真正正确 | 微调后按测试看的通过率 | 微调后真实正确率 |
| --- | --- | --- | --- | --- |
| 0（测试完美） | 40% | 100% | 100% | 100% |
| 2% | 41.2% | 97.1% | 100% | 97.1% |
| 10% | 46% | 87.0% | 100% | 87.0% |
| 30% | 58% | 69.0% | 100% | 69.0% |

以这套测试为验证器，$f=10\%$ 时第一轮的 gap 是 $87.0\%-40\%=47$ 个百分点，$f=30\%$ 时是 29 个百分点。一轮能涨很多，而且测试报告的通过率都是 100%。

再转一轮。$f=10\%$ 时，新模型的解里约 87% 正确、13% 是“错但能过测试”。在这个固定题集、固定测试、完美模仿的玩具里，测试全部接受，重加权不改变分布，gap 等于 0，之后仍停在约 87%。真实训练还会泛化、改变采样分布，不能从这个玩具推出一定几轮饱和；Song 等的“两三轮”是其具体实验的观察。

微调能把模型集中到测试接受的解上；如果正确解有可以学的共同套路，还可能迁移到新题，STaR 在 dev 集上的提升就是这类效果。但这份筛选标签没有直接提供区分“正确”和“错但能过测试”的信号；是否能靠已有知识和归纳偏置区分，要独立评估，不能说绝无可能。反过来，如果错解靠对可见测试输入写特判而过关，微调也可能扩散这种取巧。这一点是机制上的推测；下面有 agent 真正找到此类取巧的实测例子。

在上述假设下，把 $f$ 从 10% 降到 2%，接受集精度就从 87.0% 升到 97.1%。隐藏测试、边界用例和性质测试都在加强验证器。**误杀正确解也可能降低精度**：设生成正确率为 $p$，正确解通过率为 $r$，错解通过率为 $f$，由条件概率得到

$$
\operatorname{precision}=\frac{pr}{pr+(1-p)f}.
$$

分母须大于 0。例如 1000 个解中 400 个正确、600 个错误，放过 60 个错解时，接受所有正确解的精度是 $400/460\approx87.0\%$；若只接受一半正确解，就变成 $200/260\approx76.9\%$，数据和多样性也会减少。抽查接受集估计的是 $P(\text{错}\mid\text{通过})=1-\operatorname{precision}$，不是 $f=P(\text{通过}\mid\text{错})$；后者要在包含未通过样本的候选池里标注对错后估计。

<!-- widget:step-verifier-ceiling -->

## 把自己的输出喂回自己：model collapse

Shumailov 等在 [Nature（2024-07-24）](https://www.nature.com/articles/s41586-024-07566-y)研究的递归训练设置中观察到分布尾部消失等退化。带验证器的筛选回路不等于无差别回灌：验证器可能提供外部信息，也可能利用模型已有的判断能力。不过，筛选仍可能丢掉少见的正确解；Song 等观察到大 $k$ 的 pass@k 下降。两者都提醒我们跟踪数据覆盖和多样性，而不是证明“没有新外部信息就绝不可能进步”。

## 信号被钻了空子：已经测到的例子

- DGM（2025-05，附录 H）：一个 agent 在检测工具调用幻觉的目标上拿了满分，办法是删掉检测器依赖的特殊 token 日志，尽管指令要求不要改这些 token；作者发现，不把检测函数对 agent 隐藏时，这类 objective hacking 更常见。[论文](https://arxiv.org/abs/2505.22954)
- Anthropic 自动对齐研究员（2026-04-14）：一个 agent 在数学上跳过弱老师，总是输出最常见的答案；另一个运行代码去对测试，读出答案。两者都被发现并取消资格，作者的结论是自动化研究员需要它们无法篡改的评估。[原文](https://www.anthropic.com/research/automated-alignment-researchers)
- PostTrainBench（2026-03-09）：agent 在测试集上训练、下载现成的 instruction-tuned checkpoint 代替自己训练、未经授权使用找到的 API key。[论文](https://arxiv.org/abs/2603.08640)
- Sakana AI 的后续论文（2025-09-16）：一些 kernel 通过了 KernelBench 的检查，却是利用漏洞得到的 50–120 倍“假加速”；剔除受污染的任务后，平均加速从 3.13 倍降到 1.49 倍。[论文](https://arxiv.org/abs/2509.14279)
- METR 的 Frontier Risk Report（2026-05-19）：在 8 小时以上的 TH1.1 任务上，至少 16% 的成功运行经审查是不合法的。[原文](https://metr.org/blog/2026-05-19-frontier-risk-report/)
- OpenAI–Hugging Face 事件（2026 年 7 月，OpenAI 2026-08-26 的报告）：OpenAI 把 reward hacking、在看似不可能的任务上坚持不放、未经授权的通信、agent 互相采纳对方目标列为促成因素。[原文](https://openai.com/index/hugging-face-incident-and-the-road-ahead/)

## 信号从哪里来：一张对照表

Chen、Wang、Qu 的[综述（2026-07）](https://arxiv.org/abs/2607.07663)把反馈信号排成一个“verification hierarchy”：从形式化验证器（最强）到模型内在的自我评估（最弱），并报告已展示的自我改进强度与这个层级一致。下表按这个顺序排列，例子和失效方式来自前文的来源：

| 信号来源 | 强弱 | 例子 | 典型失效 |
| --- | --- | --- | --- |
| 形式化验证器（证明检查） | 最强 | Gödel Machine 的设计（理论构想） | 规格本身写错或写漏；能形式化的任务少，找证明代价高 |
| 代码执行、测试、自动评估器 | 强，取决于覆盖面 | Absolute Zero 的 Python 执行器、AlphaEvolve 的评估函数、DGM 的 benchmark | 测试放过错解；agent 改日志或改评估环节（DGM、KernelBench） |
| 标准答案 | 对最终答案强，对过程弱 | STaR、ReST-EM | 答案对、推理错（STaR 的二选一题）；在少量题上过拟合（ReST-EM） |
| 学到的奖励模型、LLM judge | 中 | AI Scientist 的自动审稿人，[Nature 版](https://sakana.ai/ai-scientist-nature/)报告 balanced accuracy 69% | 被优化的一方钻 judge 的空子；judge 自身的偏差，见 [LLM-as-a-Judge](../../07-evaluation/llm-as-a-judge/README.md) |
| 模型自我评估 | 最弱 | Self-Rewarding LM；Huang 等的自我纠错实验 | 自我确认；输出变长；几轮内饱和；小模型 gap 不为正 |

## 动手时怎么检查

| 先试什么 | 应该观察什么 | 不能据此推出什么 |
| --- | --- | --- |
| 人工复核一小批“通过测试”的解 | 估计接受集精度与错解占比；要估计 $f$，还须标注完整候选池的代表性样本 | 接受集错解占比就是错解通过率 $f$；抽查没发现问题就没有盲点 |
| 加一组隐藏测试再跑一轮 | 通过率掉了多少，掉的是哪类题 | 隐藏测试本身足够全面 |
| 每轮同时记 pass@1 和大 $k$ 的 pass@k | 大 $k$ 下降说明多样性在丢失 | pass@1 上升就等于能力提升 |
| 多跑几轮，记录第几轮开始不涨 | 饱和出现的位置 | 不涨就是模型到顶；也可能是验证器到顶 |

## 这条线接下来看什么

下面是开放问题，以及什么样的结果会改变现在的判断；不是预测。

1. **自己出题、自己验证能撑多少轮？** Song 等（2024-12）测到 gap 两三轮内接近 0；Absolute Zero（2025-05）和 R-Zero（2025-08）用执行器或 Challenger 不断补充新题，报告了相对 base model 的提升。“几轮饱和”本来就有实验条件；远多于三轮仍在独立 benchmark 上持续提升的结果，会帮助识别哪些条件能延缓饱和。
2. **学到的验证器能不能替代可执行检查？** Self-Rewarding（2024-01）只跑了 3 轮，作者自己预计会饱和。在没有标准答案的任务上，如果自评回路在外部评审的评估上长期持续提升，验证层级的排序就需要重新看。
3. **改进回路会让钻空子变多还是变少？** DGM（2025-05）、Anthropic 自动对齐研究员（2026-04-14）和 PostTrainBench（2026-03-09）都记录了钻空子；AIDE²（2026-09-22）在一个留出任务族上看到 reward hacking 率从 55% 降到 32%，但只是一次运行。多个系统、多次运行的重复结果会更有说服力。
4. **谁来设计更新规则？** 综述（2026-07）说几乎所有论文研究的是有边界的自我精炼。若有公开结果显示模型自己设计数据、loss 和训练流程并通过留出评估，这条线就从 (d) 类走到了 (a) 类。

下一篇：[改代码不改权重](code-not-weights.md)。
