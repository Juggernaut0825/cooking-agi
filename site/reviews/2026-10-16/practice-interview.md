# practice / interview / career 专项审核

日期：2026-10-16。执行目录始终为 `/Users/tianyizhang/Documents/ChatGPT/Job Prep/cooking-agi-full-review-20261016`。

## 结论与边界

- 已先读 `EDITORIAL.md`。比较基线为 `02e914a`，本轮接手快照为 `c0a75c1`；报告中的“原位置”均指后者，不是修改后的行号。
- 本轮全文精读 **44 / 128 个 Markdown 文件（22 个双语主题）**，另全文阅读 12 个 Python 文件。其余 **84 个 Markdown 文件未全文审核**，下方逐项列明。
- 该比较区间在本 scope 只有 7 对面试正文发生变化：14 个文件均全文精读，不停留在 diff。检查的是 PR99–102 叠加结果，没有逐一重建各 PR 的独立审核结论。
- 修改 3 对正文，新增 1 个独占测试文件及本报告；不改导航、图形脚本、learn、发布清单或 expression-review 配置。没有 reset、commit、push、换分支或触发 Actions。
- 专项测试最终 **23 passed，0 skipped**。这只验证所列计算、教学实现和少量文本约束，不代表内容全对、生产可用或全站通过。
- 主 agent 已告知统一语言/fragment 修复及 664 页构建完成；这是主 agent 的验证结果，**本 agent 没有执行或独立复核该全站构建**。

## 本轮修改文件

1. `interview/transformer-followups.md`
2. `interview/transformer-followups.en.md`
3. `interview/system-design.md`
4. `interview/system-design.en.md`
5. `practice/recommender-systems/05-evaluation-lab.md`
6. `practice/recommender-systems/05-evaluation-lab.en.md`
7. `site/tests/test_review_practice_interview_20261016.py`
8. `site/reviews/2026-10-16/practice-interview.md`

没有修改任何教学实现，也没有修改 career 个人经历。已有标题、显式锚点、QA summary、Mermaid、widget 标记及 Transformer 的 7 个图解目标均保持；本文未把草稿改成已发布。

## 实质问题、修复与证据

以下 `transformer-followups:数字` 均同时指 `interview/transformer-followups.md` 与 `interview/transformer-followups.en.md` 的原行；其他原位置也同时覆盖对应中英文文件。来源是原论文、官方实现/文档或出版者/作者本人页面；教学小算例为本轮自拟，不是论文实验复现。

### 明确错误或会导致错误实现的表述

| 编号 / 原位置 | 为什么有问题 | 已作修复 | 一手来源与实际验证 |
| --- | --- | --- | --- |
| P01 · transformer-followups:32 | 把二进制容量写成 0.5 MB、16 GB；32K 示例还可能被读成 Llama-2-7B 原生上下文能力。 | 改成 524,288 bytes = 0.5 MiB；32,768 tokens 为 16 GiB ≈ 17.18 GB；注明单序列、等宽未压缩 K/V、batch 与额外开销，以及原模型 4096 上下文。 | [Llama 2 §2、表 1](https://arxiv.org/html/2307.09288v2#S2)；`test_kv_capacity_uses_binary_units` 实算通过。 |
| P02 · transformer-followups:57、64 | 将 MLA 解码描述为每次展开历史 K/V，遗漏投影吸收这一关键机制；“2.25 heads”易误当实际结构。RoPE 的限制也写得过宽。 | 说明缓存 512+64 元素、固定 latent 宽度的条件、K/Q 与 V/output 投影吸收；2.25 仅为等精度存储比；明确相对旋转阻碍固定投影合并的具体位置。 | [DeepSeek-V2 §2.1.2–2.1.4](https://arxiv.org/html/2405.04434v5#S2.SS1)；两个 2D 线性例子分别复算 21 与 32，展开/吸收一致。不是完整 MLA 内核验证。 |
| P03 · transformer-followups:89 | sink 机制写成普遍必然解释，并把 gpt-oss 的可学习 logit 与分母里的质量混为一谈。真实开头 token 与无 value 的 sink 也不是同一操作。 | 分清 StreamingLLM 的观察与 gpt-oss 实现；分母是加 `exp(s)`，不是直接加 `s`；保留位置处理前提。 | [StreamingLLM §3](https://arxiv.org/html/2309.17453v3)、[gpt-oss 官方 attention 实现](https://github.com/openai/gpt-oss/blob/main/gpt_oss/torch/model.py) 交叉验证。两个普通 logit 和 sink 都为 0 时，普通权重各 1/3、合计 2/3；测试通过。 |
| P04 · transformer-followups:100 | “分数只依赖相对距离”漏了内容向量；相同距离并不产生相同分数。 | 明确固定 q/k 时只有显式位置项依赖相对位移，并区分这个恒等式与整个模型的平移不变性。 | [RoFormer §3.1–3.2](https://arxiv.org/html/2104.09864v5#S3)；测试同移位置保持点积、q 翻倍使点积翻倍。 |
| P05 · transformer-followups:114 | 增大 base 不保证所有低频对在目标长度内不绕圈，也不自动让远处更可区分。 | 给出频率公式、首对频率不变、其余变慢；保留训练/缩放/评估条件及 Gemma 3 适用型号。 | [Llama 3 §3.2](https://arxiv.org/html/2407.21783v3#S3.SS2)、[Gemma 3 §5.3](https://arxiv.org/html/2503.19786v1#S5.SS3)；测试首频率恒为 1，其他频率下降。来源节号同时核准。 |
| P06 · transformer-followups:125 | “单 token 计算只随 k 增长”把选中 expert 的 FFN 成本扩大为整个 MoE 成本，漏 router、shared expert、attention、通信和不均衡。 | 限定固定 expert 宽度/层数下的 FFN 成本，列出其他成本；保留模型具体路由与参数数字。 | [Mixtral §2](https://arxiv.org/html/2401.04088v1#S2)、[DeepSeek-V3 §4.2](https://arxiv.org/html/2412.19437v2#S4.SS2) 对照；未跑多卡性能基准。 |
| P07 · transformer-followups:143 | “精确”未分数学算法与浮点 bitwise；写回内容漏了线性大小归一化统计，省访存不等于去掉稠密二次算术。 | 补容差、统计量和反向重算；说明非近似不等于逐 bit 相同。 | [FlashAttention §3.1](https://arxiv.org/html/2205.14135v2#S3.SS1)、[官方测试说明](https://github.com/Dao-AILab/flash-attention#tests)；稳定 online softmax 与一次性计算在测试容差内一致，未执行 GPU 内核。 |
| P08 · transformer-followups:161 | 原版 Transformer 的 FFN 被写成 ReLU/GELU；norm 位置和 RMSNorm 公式两种变化也被合并成未经限定的稳定性结论。 | 指明原版为 ReLU；拆开 norm 位置与形式，保留 decoder-only、GQA、RoPE、SwiGLU 等结构区别。 | [原 Transformer §3.1、§3.3](https://arxiv.org/html/1706.03762v7#S3)、[Llama 3 §3.2](https://arxiv.org/html/2407.21783v3#S3.SS2)；双语文本检查保留 ReLU，人工核对机制。 |
| P09 · practice/recommender-systems/05-evaluation-lab:81 | 比较“两种表示”一律固定旧内容塔/索引，会把共同重训的两个空间错误混接，测到部署错配而非表示质量。 | 只在兼容空间的用户塔消融时固定内容塔；两塔重训时每个方案配套自己的内容向量和索引，固定查询集、catalog、预算与标签协议。 | [TensorFlow Recommenders 官方双塔示例](https://www.tensorflow.org/recommenders/examples/basic_retrieval) 的共同训练与候选编码；本地 `two_tower_reference.py` 交叉验证。交换二维坐标时两侧一起交换仍返回 A，只换 query 却谎报旧版本会返回 B；真实不同版本被拒绝。 |
| P10 · practice/recommender-systems/05-evaluation-lab:32；code/evaluation.py:4 | 标注“标准库可运行”却不说明最低版本；默认 Python 3.9.6 在 `float | None` 处直接报 TypeError。 | 正文明确完整程序要求 Python 3.10+、无需第三方依赖；不改教学算法或声称兼容 3.9。 | [Python 3.10 / PEP 604 文档](https://docs.python.org/3.10/whatsnew/3.10.html#pep-604-new-type-union-operator)；实际复现 3.9 失败，并用 3.12.2 跑通，得到 1.0、0.0、0.5、1.0 四个输出。 |

### 必须保留的适用条件与叙事修正

| 编号 / 原位置 | 原有风险与已作修复 | 来源与实际验证 |
| --- | --- | --- |
| P11 · transformer-followups:18、25、39 | K/V “永远不变”缺少权重、前缀、位置、mask、dropout 条件；复杂度限于固定维度的 attention；缓存槽号不总是逻辑位置，比较 logits 要用容差。补齐以上边界。 | [原 Transformer 的因果 decoder](https://arxiv.org/html/1706.03762v7#S3)、[RoFormer](https://arxiv.org/html/2104.09864v5#S3)；双语条件人工对照。**没有**运行真实 decoder 的 cached/full 前向，本项不能以 toy 测试代替。 |
| P12 · transformer-followups:50 | MQA 的“质量有损失”写成无条件规律；改成受模型、训练方案及任务影响，固定其他维度时再比较 cache。 | [GQA §3、表 1](https://arxiv.org/html/2305.13245v3#S3)：逐任务结果不支持普遍必降。论文人工核对，没有重新训练 MQA/GQA。 |
| P13 · transformer-followups:75、82 | 滑窗窗口是否含当前位置未明确；理论可达不等于可靠记忆或训练长度；套 mask 不会自动实现局部成本，混有 global 层也不能整体声称线性。 | [Mistral 7B §2、表 1](https://arxiv.org/pdf/2310.06825)、[Gemma 3 §2](https://arxiv.org/html/2503.19786v1#S2)。明确 w 含当前位置，w=3/L=2 的可达集合实算为 5；Mistral 的原训练上下文与理论跨度分开；未做长程召回实验。 |
| P14 · transformer-followups:168 | post-norm 必须 warmup、pre-norm 可直接不用的说法超出论文假设。 | 改为 [Xiong et al. §3–4](https://arxiv.org/pdf/2002.04745) 初始化与实验设置下的结论，不承诺所有模型适用；人工核查，不以本轮测试证明训练稳定性。 |
| P15 · interview/system-design:27 | 把“没有社交图”混成“没有关系/交互数据”，随后又推荐依赖交互的模型；冷启动“往往胜过复杂模型”缺证据。 | 分开无社交图、有行为，以及交互也很少三种情况；热门需要其他用户历史；候选方案是待比较 baseline。对照 [YouTube 2016 §3.2–3.3](https://research.google.com/pubs/archive/45530.pdf) 的历史、侧信息与训练信号；这些建议不是该论文证明的普遍最优策略。 |
| P16 · interview/system-design:37 | 第 2 版精确发布日期依赖此次无法打开的特定博客链接；出版者与作者月份口径不同。 | 改为 [O'Reilly 第 2 版](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781098119058/) 与[作者书目](https://martin.kleppmann.com/#publications) 交叉引用，保留 2026 年并明示 2 月/3 月口径差异；不把 web 读取失败断言为 HTTP 404。 |
| P17 · transformer-followups:9、11；interview/system-design:13 | “面试官通常怎样”“真正考什么”把个人复习组织方式写成招聘规律；两句话限制还会诱导删技术前提。 | 改为本站练习顺序、作者准备重点，不是频率统计或通用评分表；答案先讲机制但保留条件。这是编辑性去泛化，不虚构一个“所有公司规则”的来源。 |

## PR99–101 去重与公司 specific 内容复查

- 全文核查了本 scope 的全部改动页：`ai-roles-prep`、`code-comprehension`、`python`、`speedrun`、`study-plan`、`system-design`、`transformer-followups`，均包括中英文。
- 对 practice/interview/career 做了关键词扫描，覆盖 Google pilot、BusinessInsider、1point3acres、公司与面试组合、原题/必考/过线等词。没有发现残留的特定公司试点流程或“统一门槛”正文；**关键词未命中不是穷尽证明**。
- 保留 `code-comprehension` 的 Google code-review 工程指南，正文已说明它不认证面试形式；这不是公司题库。
- 保留 career 作者本人公司面试名单和公开求职复盘。journey 已区分面试与 offer；签证/求职选择保持个人经历，不扩写成法律或招聘规则。
- `ai-roles-prep` 的个人博文保留各自人群与地区条件；TinyZero 官方 README 确有停止积极维护、转向 verl 的说明，未把其特定 0.5B 实验推广为所有小模型能力上限。
- Alisa 博文此次 web 工具读取失败；Silvia 与 Andrey 的正文能读，但页面上标注的具体发表月份未在此次可见正文中独立确认。保留现有日期，不将“来源核对 2026-10-11”冒充本轮逐条重新验证。
- 基线 diff 中看到旧 `#google` 入口与 study-plan 子标题被移除，存在外部书签风险。主 agent 后续告知已整合共享 fragment 修复；本 agent 未添加导航别名、未修改全局脚本，也未独立验收生成站点里的别名。
- 去重后的跨区入口内容与全站导航由主 agent 核查；本轮不声称 learn 的承接正文、交互图实现或所有目标页面均已审核。

## 覆盖账本

这里的“全文精读”指实际阅读正文/代码并检查语义，不表示每个外链全文阅读、每个实验都复现。带 `{,.en}.md` 的条目明确表示两种语言都读过。

### 全文精读：44 个 Markdown 文件

| 范围 | 双语主题 | 文件数 |
| --- | --- | --- |
| 变更重点 · interview | `ai-roles-prep`、`code-comprehension`、`python`、`speedrun`、`study-plan`、`system-design`、`transformer-followups` | 14 |
| 补充 · interview | `coding-checks`、`algorithms/traversal` | 4 |
| career 全部现有正文 | `README`、`journey`、`metrics`、`new-grad-2026-2027`、`not-binary`、`one-interview`、`prepare` | 14 |
| practice/post-training | `data-pipeline`、`distributed-training`、`checkpoint-and-resume` | 6 |
| practice/rag | `data-and-retrieval` | 2 |
| practice/recommender-systems | `05-evaluation-lab`、`08-serving-lifecycle` | 4 |

### 全文阅读的既有代码：12 个 Python 文件

- `interview/code/comprehension_lab.py`
- `interview/code/prep_checks.py`
- `interview/code/patterns.py`
- `interview/code/deeper_patterns.py`
- `interview/code/number_theory.py`
- `practice/post-training/code/training_contracts.py`
- `practice/post-training/code/experiment_checks.py`
- `practice/rag/code/evidence_pipeline.py`
- `practice/recommender-systems/code/evaluation.py`
- `practice/recommender-systems/code/two_tower_reference.py`
- `practice/web-lab/code/eval_report.py`
- `practice/web-lab/code/server.py`

全文阅读不等于全部函数已经测试。`patterns.py`、`deeper_patterns.py`、`number_theory.py` 及 web-lab 两个 Python 文件未在本轮运行专项测试；未对 web-lab 做浏览器端到端或安全全面审计。

### 只看 diff / 自动扫描

- **只看 diff 的正文：无单独计入项。** 已读 diff 的 14 个改动文件随后全部全文精读。
- 自动扫描：scope 文件清单、基线变更清单、公司 specific 关键词、6 个修改页的标题/QA/显式锚点/Mermaid/widget/图解目标保留、scoped `git diff --check`。
- 只参考了既有 `site/tests/test_interview_preparation.py` 的部分测试写法，没有把该文件或全站测试算入全文审核。
- 没有运行全站 build、链接验证、浏览器视觉检查或完整 tests；避免与主 agent 并行。

### 未全文审核：84 个 Markdown 文件

下列每个 stem 都包含 `.md` 与 `.en.md`，合计 **42 对 / 84 文件**。它们最多经过清单/关键词扫描，不属于语义审核完成。

**interview：19 对 / 38 文件**

- `interview/README`
- `interview/basics/README`
- `interview/leetcode`
- `interview/python-objects`
- `interview/questions`
- `interview/speedrun-start`
- `interview/algorithms/backtracking-and-dp`
- `interview/algorithms/binary-search-trees`
- `interview/algorithms/complexity-and-tools`
- `interview/algorithms/hash-and-prefix`
- `interview/algorithms/knapsack`
- `interview/algorithms/monotonic-queue`
- `interview/algorithms/pointers-and-search`
- `interview/algorithms/primes-and-sieves`
- `interview/algorithms/sequence-dp`
- `interview/algorithms/sorting-and-greedy`
- `interview/algorithms/stack-heap-links`
- `interview/algorithms/state-machine-dp`
- `interview/algorithms/string-matching`

**practice：23 对 / 46 文件**

- `practice/README`
- `practice/ml-system/README`
- `practice/ml-system/data-to-model`
- `practice/ml-system/serving-and-feedback`
- `practice/post-training/README`
- `practice/post-training/data-and-objectives`
- `practice/post-training/experiments-and-release`
- `practice/post-training/training-plan`
- `practice/rag/README`
- `practice/rag/evidence-and-evaluation`
- `practice/recommender-systems/README`
- `practice/recommender-systems/00-architecture`
- `practice/recommender-systems/01-feed-pipeline`
- `practice/recommender-systems/02-candidate-retrieval`
- `practice/recommender-systems/03-ranking-and-diversity`
- `practice/recommender-systems/04-modern-recsys`
- `practice/recommender-systems/06-why-two-towers`
- `practice/recommender-systems/07-component-choices`
- `practice/web-lab/README`
- `practice/web-lab/eval-report`
- `practice/web-lab/next-projects`
- `practice/web-lab/reading-list`
- `practice/web-lab/static-and-ci`

**其他未审核材料**

- `practice/web-lab/code/app.js`、`index.html`、`style.css`。
- `practice/web-lab/code/eval-fixtures/` 内 `baseline.json`、`candidate.json`、`candidate-fixed.json`、`suite.json`。
- 所有不在本 scope 的图、导航、learn 正文与模型实现，以及外链资料未列明的剩余部分。

## 实际验证记录

在目标 repo 根目录运行：

```bash
/opt/anaconda3/bin/python3.12 -B -m unittest discover \
  -s site/tests -p 'test_review_practice_interview_20261016.py' -v
git diff --check -- practice interview career \
  site/tests/test_review_practice_interview_20261016.py \
  site/reviews/2026-10-16/practice-interview.md
```

环境为 Python **3.12.2**、NumPy **1.26.4**。23 项测试全部执行、全部通过，没有跳过 NumPy 项。

- 数学复算：KV 单位、MLA 容量与投影吸收、滑窗可达、sink logit、RoPE 内容依赖/base、稳定 online softmax。
- 既有代码：cache 版本/空值/拷贝隔离，token 分母对 batch 切分不变，pad=EOS 保留真实目标，13 个中断边界的 JSON checkpoint 恢复，manifest 拒绝，token/sample 权重，RAG 版本/权限过滤与 RRF 去重，Recall 定义，双塔错配反例。
- 算法/ML coding：loop/vectorized/blocked kNN 的相同结果及平局规则，二分边界与空输入，拓扑依赖与环检测，Markov 两步分布 0.72/0.28、平稳分布 2/3 与 1/3、命中期望 5。
- 双语保护：6 个改动页的结构与 `c0a75c1` 逐项比较通过；Transformer 7 个图解目标两语言一致；要求中的单位、来源和 Python 版本留在两种语言。
- 测试初次失败是新增文本断言寻找 `exp(s)`，而正确正文使用等价 LaTeX `e^s`；改正测试断言后重跑通过，未为过测试改坏正文。
- 临时结构扫描曾把 URL 的 `data-intensive` 误识别为 widget 属性；改为实际 HTML widget 标签匹配后 6 页全部通过，未改正文规避检查。
- 单独运行推荐评估示例：Python 3.9.6 的 union 注解报错已复现；3.12.2 运行成功。双塔参考程序在默认 3.9.6 下输出 A/B、排除 A 后 B/C，并明确拒绝不兼容版本。

## 待办与交接

1. 主 agent 将这 6 个正文改动纳入最终统一 build/tests；664 页快照是否包含本 agent 最后提交到共享工作区的改动，需要以其最终构建时间为准。
2. 若继续下一轮，优先精读上列未读的算法 13 对、推荐前 4 期/双塔设计及 post-training 其余 4 对；不能用本轮代码小测替代对应正文审核。
3. 在可访问页面/作者元数据上补核 Alisa 来源可达性、Silvia/Andrey 的具体发表月份；本轮不擅自猜日期。
4. 由主 agent 最终验证旧 `#google` 与 study-plan 子标题外部书签兼容，以及双语入口、跨区图解目标；本 agent 未写全局导航。
5. 未完成真实 tokenizer/model cached-forward、多 GPU 梯度归一化/恢复、FlashAttention kernel 或推荐服务负载验证；这些不属于已通过的 23 项测试。
