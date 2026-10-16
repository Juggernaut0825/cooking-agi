# Retrieval / evaluation / agents 高风险审核记录

日期：2026-10-16。审核者范围：retrieval-eval。

仓库：`/Users/tianyizhang/Documents/ChatGPT/Job Prep/cooking-agi-full-review-20261016`。
审查起点及最终 HEAD：`c0a75c1`；叠加变更对照基线：`02e914a`。报告中的“原位置”均指 **c0a75c1 的行号**，不是修改后的行号；路径相对上述仓库。

## 结论与边界

- 已读 `EDITORIAL.md`，优先检查所分配目录中 PR99–101 相关正文、算例及中英对照；实际使用 `02e914a..c0a75c1` 的叠加 diff，不把每个 hunk 武断归属某一 PR。
- 76 个 Markdown 文件中：**42 个全文精读、24 个仅 diff 审核、10 个未读正文**。全文精读指读完本地正文并检查解释/双语关系，**不等于该页全部引用均独立回查，更不等于一手论文全文精读**。
- 修改 13 对中英正文，共 26 个文件；新增本报告和唯一专属测试文件。`09-personal-agi/` 的两页已全文读，未发现本轮需要改动的问题；不能据此称其所有历史来源已重新验证。
- 本组按主审协调要求交回本轮结果，不代表用户撤回了全面审核的要求。没有执行全站 tests/build、没有浏览器渲染验收、没有运行真实模型/API/检索服务、安全渗透或删除传播集成测试。主 agent 统一集成验证。
- 未改分支、提交、push、触发 Actions；未改 `CONTENT_RELEASE_CHECKLIST.md`、`site/expression-review.toml`、`learn/`、根导航或 chronology。共享 checkout 中其他 agent 的修改不属于本报告。

## 1. 精确覆盖清单

以下每个 stem 均表示对应的 **`.md` 和 `.en.md` 两个文件**，没有用“目录已审”代替逐页覆盖。

### 全文精读：21 对 / 42 个文件

| 目录 | 全文读过的 stem | 一手核查的限制 |
| --- | --- | --- |
| `01-data-and-feedback/` | `data-as-supervision`、`feedback-to-objectives` | 重查组内奖励、DAPO/Rufus、IPS 的相关原文；TRL 固定版本链接未成功取回，见待办 |
| `02-memory/` | `README`、`memory-lifecycle` | 重查 MemoryAgentBench 相关段落、缓存安全原则；不是所有记忆基准论文全文复审 |
| `04-search/` | `dual-encoder`、`hybrid-and-reranking`、`tfidf-and-bm25`、`vector-indexes` | 对照 Qwen 模型卡、Lucene、pgvector、RRF 文档及算例；没有跑这些生产引擎 |
| `07-evaluation/` | `benchmark-protocols`、`metric-robustness` | 重查基准版本/退役原因，复算 McNemar、bootstrap；没有独立复跑模型榜单 |
| `07-evaluation/llm-as-a-judge/` | `calibration`、`probability-scores` | 对照校准文档、G-Eval 相关段落，复算 12 条 fixture；没有验证实际 judge 的统计性能 |
| `08-model-experience/` | `README` | 双语正文与本轮 diff；不是文中每个历史项目的独立验证 |
| `09-personal-agi/` | `README` | 双语正文；回查反馈循环模拟论文及 NIST 隐私框架相关部分，没有产品实测 |
| `10-agents/` | `patterns`、`scenarios`、`review`、`model-choice`、`tools-and-skills`、`prompting`、`single-vs-multi-agent` | 按下文列出的风险点核查；`single-vs-multi-agent` 的缓存和教学计算已核查，但 MAST、Kim、Tran、Gao、Who&When 的全部统计及发表状态未重新逐项验证，草稿标识保留 |

### 仅 diff 审核：12 对 / 24 个文件

只检查 `02e914a..c0a75c1` 的修改及必要邻近语境；**其余正文未精读**。

| 目录 | stem |
| --- | --- |
| `01-data-and-feedback/` | `README` |
| `04-search/` | `README`、`embedding-models`、`rag-evidence` |
| `07-evaluation/` | `README`、`ablation-and-slices`、`evaluation-stack`、`text-metrics` |
| `07-evaluation/llm-as-a-judge/` | `bias-and-workflow`、`implementation` |
| `10-agents/` | `README`、`deep-research` |

### 未读正文：5 对 / 10 个文件

- `07-evaluation/eval-observability{,.en}.md`：仅目录/风险词扫描，不算内容审核；草稿未改。
- `07-evaluation/llm-as-a-judge/README{,.en}.md`。
- `07-evaluation/llm-as-a-judge/case-studies{,.en}.md`。
- `07-evaluation/llm-as-a-judge/criteria{,.en}.md`。
- `07-evaluation/llm-as-a-judge/scoring{,.en}.md`。

### 代码、自动扫描及视觉覆盖

- 全文读：`07-evaluation/llm-as-a-judge/code/judge_eval.py`；本轮未改。
- 局部读：`site/static/judge-lab.js` 的 calibration fixture/计算段；其余 JS 不是本轮审核范围，未修改。
- 仅扫描函数名/文件清单：`04-search/code/embedding_contracts.py`、`04-search/code/lexical_retrieval.py`；没有把正文代码块验证算作这两个完整模块的代码审计。
- 未审：`07-evaluation/llm-as-a-judge/code/example-results.jsonl` 的全部数据质量。
- 自动检查全部 26 个已改正文的标题、显式锚点及 `widget:` / `paper-figure:` 标记与 c0a75c1 一致；这只证明这些字符串未改变，不证明渲染、布局、交互或导航无误。

## 2. 实质修正、依据与验证

下列修复都同步修改中英文。既包括错误断言，也包括会改变结论的缺失前提；不把纯措辞润色列作技术发现。

### R1. 零组内优势不代表整个目标零梯度

- 原位置：`01-data-and-feedback/data-as-supervision.md:28`。精简后只说全对/全错的优势为零，把归一化和其他目标项的条件完全交给外链，容易误读成整次更新无信号。
- 修复：正文直接给出 `[0,0,1,1] → [-0.5,-0.5,0.5,0.5]`；全同奖励下归零的是中心化奖励信号；标准差为零须处理，KL 等项仍可能有梯度。
- 依据：[DAPO §3.2](https://arxiv.org/html/2503.14476v2)、[Rufus 训练配置与讨论](https://arxiv.org/html/2609.29421v2)。算法具体是否保留 KL 必须看配置，不能互相套用。
- 验证：专属测试复算中心化；用 Bernoulli KL 的非零导数构造反例。没有运行 GRPO/DAPO 训练。

### R2. 排序、概率校准和单条正确性不是一件事

- 原位置：`07-evaluation/llm-as-a-judge/calibration.md:30`、`:61`、`:68`。泛称 Correlation 为排序一致，且“高分不是正确的证据”过强；没有自包含反例区分校准与区分能力。
- 修复：改成 rank correlation 并区分 Pearson；高分不保证判断正确。新增两组各 10 条、实际通过率 0.8/0.2 的例子：常数 0.5 可整体校准却不区分；0.99/0.90 保持组排序但过度自信；0.8/0.2 保持排序且匹配组频率。补独立校准评估及 isotonic 可能引入 ties。
- 依据：[scikit-learn calibration 官方文档](https://scikit-learn.org/stable/modules/calibration.html)。这是构造数据上的性质，不是假称 20 条足以证明生产校准。
- 验证：逐组复算频率与排序；原 fixture 阈值 3.5/4.0 均得到 agreement=7/12、κ=1/6，且错误放行占比 3/7 不等于 FPR=3/6。

### R3. 分数绝对大不必然主导融合排序

- 原位置：`04-search/hybrid-and-reranking.md:30`。把数值幅度大的通道笼统说成主导；统一加常数不会改变候选间分差。范围归一化也不等于概率校准。
- 修复：比较候选间的分差和权重，分别说明融合尺度与校准。
- 依据：[Elastic RRF 文档](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion) 的基于名次方法；分差抵消是本报告独立代数检查，不是厂商性能结论。
- 验证：给词法分数统一加 1000，融合排序不变；RRF 的常数 10/60 均复算为 B、C、A、D；截到 top-1 后出现同分，文档 ID 只是 tie-break。

### R4. yes/no 归一化分数不等于校准后的相关概率

- 原位置：`04-search/hybrid-and-reranking.md:80`。已有公式，但没有把两个标签内的条件概率与完整词表概率质量、经验相关率分开。
- 修复：补词表中 yes=0.10、no=0.01 时条件分数为 0.909，而二者总质量只有 0.11；阈值需用独立标注数据验证。
- 依据：[Qwen3-Reranker-0.6B 官方模型卡代码](https://huggingface.co/Qwen/Qwen3-Reranker-0.6B)：取两个 token logits 后重新 log-softmax。
- 验证：复算 logistic(2)=0.880797、0.10/0.11=10/11。没有声称这些例子来自真实模型输出。

### R5. Lucene 与教学 BM25 不能无条件只差 2.2 倍

- 原位置：`04-search/tfidf-and-bm25.md:98`。因去掉 `(k1+1)` 就断定完整 Lucene 分数必为本例的 1/2.2，忽略真实字段统计、长度编码和其他权重。
- 修复：仅在其余输入和约定相同、只移除该常数的比较中成立；自身排序不变不代表固定阈值或跨通道加权结果不变。
- 依据：[Lucene 8.0 LUCENE-8563](https://lucene.apache.org/core/8_0_0/changes/Changes.html)、[Lucene 10.3.1 BM25Similarity 源码](https://github.com/apache/lucene/blob/releases/lucene/10.3.1/lucene/core/src/java/org/apache/lucene/search/similarities/BM25Similarity.java) 中的长度解码及字段统计。
- 验证：词法分数 A=2/B=1，另一通道 A=0/B=0.6；原和排序 A 优先，词法除 2.2 后 B 优先。未运行 Lucene。

### R6. HNSW 的 M 和 ef 不是笼统的度数/访问总数

- 原位置：`04-search/vector-indexes.md:104`。把 M 写成每层统一最大连接数；参数越大质量/recall 必然越好也过强。
- 修复：以 pgvector v0.8.7 为明确实现，普通层 m、底层 2m；ef 是候选列表宽度，不是最终 K 或累计访问节点数；效果需测。
- 依据：[pgvector v0.8.7 hnsw.h](https://github.com/pgvector/pgvector/blob/v0.8.7/src/hnsw.h)、[同版本 HNSW 文档](https://github.com/pgvector/pgvector/tree/v0.8.7#hnsw)。源码的 `HnswGetLayerM` 明确区分底层。
- 验证：m=16 时底层容量 32，核对默认 m=16、ef_construction=64、ef_search=40；未把此参数说明泛化到所有库。

### R7. 基准阈值、版本与训练暴露不能缺条件

- 原位置：`07-evaluation/benchmark-protocols.md:13`、`:15`。无配置的“前沿模型超过 90%”、将 `release_v6` 称作整体“最新”，以及早于训练截止就判为非 unseen，均超出给定证据。
- 修复：用“在当前模型/协议下不能区分”作为换基准理由；`release_v6` 只作明确版本例子；日期早于 cutoff 既不能证明见过，也不能保证没见过。
- 依据：[LiveCodeBench 官方仓库](https://github.com/LiveCodeBench/LiveCodeBench)：核对 v6 的 1,055 题及 2023-05 至 2025-04 区间。MMLU 的无来源百分比直接删除，没有用另一个无配置百分比替换。
- 验证：版本/日期与官方 README 对照；未尝试从发布日期推断任何模型训练集。

### R8. SWE-bench Verified 停报不等于“做满”

- 原位置：`07-evaluation/benchmark-protocols.md:16`、`10-agents/scenarios.md:13` / `:22` / `:34`、`10-agents/review.md:26` / `:82`。把停止报告简化为接近饱和，并把代码任务说成每一步都有客观正确性反馈。
- 修复：改为测试缺陷及污染使解释受限；代码测试提供的是覆盖范围内的证据，不替代需求、安全和 diff 审查。删去未经证实的全行业“现在多看 Pro”。
- 依据：[OpenAI 2026-02-23 原公告](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)。没有把对困难题子集的缺陷比例泛化为全部题目比例。
- 验证：逐条对照公告原因和正文限定；不是 benchmark 实测。

### R9. τ 版本影响范围与 pass^k 聚合顺序

- 原位置：`10-agents/scenarios.md:26`。τ³ v1.0.1 的不可比说明范围过宽；原有 0.9^8 算式需要避免被搬成异质任务整体公式。
- 修复：版本修复影响限定为 `banking_knowledge`；其他域未受影响。保留同任务独立重复 0.9^8≈0.43，明确任务间先各算再平均。
- 依据：[Sierra 官方仓库版本说明](https://github.com/sierra-research/tau2-bench)、[τ-bench 原论文 §3](https://arxiv.org/html/2406.12045v1)。
- 验证：成功概率 0.5/1 的两个任务，平均 pass^2=0.625，而平均成功率平方=0.5625。原指标定义并非错误，新增的是防误用条件。

### R10. 只读工具也能外传；prompt 不是执行权限边界

- 原位置：`10-agents/patterns.md:49`、`10-agents/scenarios.md:30`。只读搜索被描述成主要只是取错资料，副作用确认被当成主要安全保障。
- 修复：搜索 query、URL 等也可能泄露信息；执行层校验资源、凭据、外发目标、动作范围；高风险或超出授权动作确认具体参数。正文规则不能替代执行隔离。
- 依据：[OWASP Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)，尤其 Agent-Specific Defenses、Least Privilege 及 guardrail 限制。
- 验证：做了数据流威胁分析与文档对照；**没有实际攻击或宣称已经测试某个 agent 安全**。

### R11. 幂等键需要服务端支持和重试复用

- 原位置：`10-agents/patterns.md:49`。只写“用幂等键避免重复操作”，缺执行语义。
- 修复：后端支持时对同一操作重试复用同一 key；不支持时先核实完成状态，不能仅生成字符串便承诺不会重复。
- 依据：[Stripe 官方 idempotency 文档](https://docs.stripe.com/api/idempotent_requests) 展示服务端保存/识别 key 的必要性，并有参数、保留期和 API 版本条件；没有把 Stripe 的具体保留期套给所有工具。
- 验证：接口契约逻辑核对；未调用有副作用的服务。

### R12. 级联有更多信息不保证更准、更便宜

- 原位置：`10-agents/review.md:61`。“先看到小模型答案所以判断更准”并不必然成立，检查器也会被骗。
- 修复：写清检查器/路由开销和升级率；在至多升级一次、无重试的模型下，级联为 `C_A+v+u*C_B`，路由为 `r+(1-u)*C_A+u*C_B`；两方案的 u 不必相同。
- 依据：[RouteLLM 论文](https://arxiv.org/abs/2406.18665) 作为质量—成本评估背景；上述成本式是对明确事件计费的独立推导，不声称由论文证明级联优势。
- 验证：执行正文四请求成本例子的全部断言；没有跑 RouteLLM 模型或用纸面式子判定实际优胜方案。

### R13. thinking 配置有模型/模式和单请求边界

- 原位置：`10-agents/model-choice.md:64`。泛化了 adaptive thinking 支持、effort 范围和不设预算；`max_tokens` 易与整个工具循环预算混淆。
- 修复：限定支持该模式的模型，effort 取值看模型；`output_config.effort` 与该模式下不手设 `budget_tokens`；`max_tokens` 是单请求 thinking+answer 上限，摘要可见长度不是实际思考用量。
- 依据：[Claude 官方 thinking / steering / cost 文档](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost)。
- 验证：对照字段和返回用量语义；未发出付费 API 请求。

### R14. Structured outputs 不是每个响应都保证 schema 合格

- 原位置：`10-agents/prompting.md:68`。无条件“保证格式”遗漏拒绝、截断和传输异常。
- 修复：使用支持的 schema 子集，先检查完成状态，分别处理拒绝/截断/传输错误，然后解析和验证；语义正确性仍另评。
- 依据：[Claude 官方 structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) 的拒绝及 `max_tokens` 例外。
- 验证：官方契约对照和双语限定词回归；不是实际 API 错误注入测试。

### R15. 缓存命中与删除后的重建必须继续守权限

- 原位置：`02-memory/memory-lifecycle.md:149` 之后。原生命周期说明没有充分展开缓存绕过与异步重建复活的风险。
- 修复：应用答案/检索缓存与 KV cache 分开；query-only key 可能跨用户泄露；命名空间含身份/等价权限域及来源/权限版本，但命中后仍检查当前 ACL/删除状态。TTL 是新鲜度，不等于即时撤权。补 t1 读 v7、t2 删除、t3 拒绝旧 writer、t4 恢复备份先重放 tombstone 的时序，区分禁止读取和物理清除。
- 依据：[RFC 9111 §7](https://www.rfc-editor.org/rfc/rfc9111.html#section-7) 的持久缓存泄露和敏感信息风险。版本/tombstone 时序是本轮提出的工程防护例子，**不是声称 RFC 规定了某个记忆数据库实现**。
- 验证：执行已有记忆示例并加用户、scope、known_at、半开有效期、当前删除状态测试；**没有真实缓存、备份恢复或异步写入集成测试**。

### R16. 多 agent 的内容量不等于累计用量/账单

- 原位置：`10-agents/single-vs-multi-agent.md:74` / `:80` / `:83`。每段只计一次被解释成“有缓存”，漏掉缓存读取费用、逐次 usage 及输入/输出单价差。
- 修复：53k/71k 明确为按上下文计一次的内容量；34% 是内容量增幅，不是费用增幅；实际需逐次累加 usage。
- 依据：[Claude 官方 prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) 分别记录 cache write/read/uncached input。未在正文固定时效性单价。
- 验证：独立核对两个求和式；没有计费实测。

### R17. 多 agent 概率乘法需要独立性与条件概率

- 原位置：`10-agents/single-vs-multi-agent.md:85` / `:93` / `:99`。子问题独立不等于模型错误独立；d 未写成“已找到事实后的丢失率”；把玩具模型唯一收益来源泛化成所有拆分收益。
- 修复：写明成功事件独立同分布、d 是条件概率、协调者不再引入错误；结论限定到事实保留模型。同错同对时，每项 0.9、全对仍为 0.9，不是 0.729；“单 agent 一致”也需始终维持那次决定。
- 依据：独立事件乘法的直接计算；可对照 [τ-bench §3 的 i.i.d. trial 限定](https://arxiv.org/html/2406.12045v1)，不能把该论文当作本例各 agent 错误独立的证据。
- 验证：复算 0.806954491、0.625026375、临界 d=1/19，并验证完全相关反例。

### R18. 并行时延算例遗漏了摘要生成耗时

- 原位置：`10-agents/single-vs-multi-agent.md:73` / `:79` / `:95`。列出子 agent 交回摘要，但 60/160 秒没有给摘要生成分配时间。
- 修复：不改现有图，而在正文显式声明该简化；每份摘要另用 s 秒，独立并行加 s，顺序拆分加 3s；s=10 时为 70/190 秒。网络、队列、重试仍未建模。
- 依据：根据本页时序独立复算；不是任何生产系统测量。缓存文档的性能说明也不能证明摘要可以零时延生成。
- 验证：70/190 算术及正文假设回归。图标记原样保留；图自身的注释是否也应体现该假设，交主 agent，见待办。

## 3. 已复核、未另改正文的关键点

- **McNemar**：同一批样本的二元结果用 discordant pairs；(60,40) 的 exact p=0.0568879336409808，(20,0) 为 2/2^20，(10,6) 为 0.454498291015625。核对 [statsmodels](https://www.statsmodels.org/stable/generated/statsmodels.stats.contingency_tables.mcnemar.html)，测试还枚举小样本零假设分布交叉验证。
- **Paired bootstrap**：保留同一 query 的旧/新配对。8 条差值均值 0.05，固定种子 4,000 次的教学 percentile 区间为约 [-0.05,0.15]；不能推出稳定提升或等价。核对 [SciPy bootstrap](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html)。原页已提示用户聚类、有限样本和输出随机性边界，未为“简洁”删除。
- **Off-policy / IPS**：保持 positivity、已知/可识别曝光概率、选择过程等条件，不把未曝光当负样本。p=0.1 的单次贡献期望 1、方差 9；权重截到 4 后期望 0.4、方差 1.44。对照 [Recommendations as Treatments](https://arxiv.org/html/1602.05352) 的选择偏差和 IPS 讨论；测试不证明真实日志满足识别假设。
- **对比学习**：运行稳定 log-sum-exp 示例及温度梯度有限差分；增加候选会改变 softmax 概率，即使原来那对 embedding 未改变。没有把均匀几何分布等同检索相关性。
- **评分 token 概率**：原文 0.80 的等级总质量、3.28 的未归一化加权和、4.1 的条件均值均复算。回查 [G-Eval §3.1](https://arxiv.org/html/2303.16634v3) 的采样设置及当时 logprobs 限制；没有把离散等级条件均值称为客观质量。
- **版本敏感的 agent 接口**：抽查 [MCP Skills 扩展](https://modelcontextprotocol.io/extensions/skills/overview)、[Agent Skills specification](https://agentskills.io/specification)、[A2A release](https://github.com/a2aproject/A2A/releases)。清单/摘要/摘要校验不自动赋予执行权限；`allowed-tools` 的 host 支持条件保留。
- **其他局部一手核查**：[MemoryAgentBench v4](https://arxiv.org/html/2507.05257v4) 相关多跳结果和冲突处理设定；[DR Tulu](https://arxiv.org/html/2511.19399v3) 的 evolving rubrics；[PyTorch reproducibility](https://docs.pytorch.org/docs/2.14/notes/randomness.html) 的跨环境非保证；[反馈循环模拟](https://arxiv.org/html/1710.11214v1) 与 [NIST Privacy Framework](https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.01162020.pdf) 的数据控制条目。这些均为相关段落核对，不是整篇论文的全面复审。

## 4. 实际验证结果

专属文件：`site/tests/test_review_retrieval_eval_20261016.py`。

在指定仓库 workdir 执行：

```bash
python3 -m unittest discover -s site/tests -p 'test_review_retrieval_eval_20261016.py' -v
```

最终结果：**16 tests，全部通过，0.117 秒**。其中 12 对正文的 **30 个 Python code blocks** 执行完成，并比较中英文 AST；另覆盖上述 κ、McNemar、bootstrap、IPS、记忆过滤、条件概率、融合尺度、对比梯度、pass^k 和多 agent 假设。

第一次运行有 1 个失败：新测试中独立两比例 CI 半宽的手填期望常数写成 0.076866210；准确值为 0.0768659924804201。修正的是**本次新增测试的期望值**，不是修改正文来迎合测试；随后 16 项全通过。

另外已执行：

- `git diff --check`，限定本人内容目录及专属测试/报告：通过。
- 静态比较 26 个已改正文与 c0a75c1：标题、显式锚点、widget/paper-figure 标记全部保留。
- `single-vs-multi-agent` 双语草稿标识回归：通过。

测试中有数学反例和文案契约断言；它们不是用户研究、校准性能评估或生产安全证明。未运行全站测试、构建和浏览器检查。

## 5. 本轮改动文件

以下每项分别修改 `.md` 与 `.en.md`，共 26 个正文文件：

1. `01-data-and-feedback/data-as-supervision`
2. `02-memory/memory-lifecycle`
3. `04-search/hybrid-and-reranking`
4. `04-search/tfidf-and-bm25`
5. `04-search/vector-indexes`
6. `07-evaluation/benchmark-protocols`
7. `07-evaluation/llm-as-a-judge/calibration`
8. `10-agents/model-choice`
9. `10-agents/patterns`
10. `10-agents/prompting`
11. `10-agents/review`
12. `10-agents/scenarios`
13. `10-agents/single-vs-multi-agent`

新增：

- `site/tests/test_review_retrieval_eval_20261016.py`
- `site/reviews/2026-10-16/retrieval-eval.md`

## 6. 待办与交接

1. **来源核对补记**：本组未能取回 `data-as-supervision` 引用的 TRL v1.16.0 固定版本文档。主审随后取回该 tag 的 [sft_trainer.py](https://github.com/huggingface/trl/blob/v1.16.0/trl/trainer/sft_trainer.py#L868-L889)，确认 assistant-only loss 的模板替换与结束标记检查；又读了 [get_training_chat_template](https://github.com/huggingface/trl/blob/v1.16.0/trl/chat_template_utils.py#L1005-L1050)，其 Qwen3 示例保留工具调用前的 thinking block。独立的 Jinja 文件仍未成功取回，没有执行 tokenizer 或模型，也没有逐个核验全部模型模板；不把这个补记当作整页所有版本声明的运行验证。
2. **剩余正文**：按第 1 节列出的 24 个 diff-only 与 10 个未读文件安排下一轮；尤其 eval-observability 草稿和 judge scoring/criteria。不能将本报告视作这些正文已放行。
3. **已读但来源仍有空白**：single-vs-multi-agent 的多篇论文全部数字、最新版本和发表状态，以及 memory README 的全部旧基准来源，仍需定点核查；本轮不再扩展。
4. **主 agent 的视觉项**：`step-subagent-timeline` 仍沿用 60/160 秒简化数值；正文已解释遗漏摘要生成耗时，但需要主 agent 判断图/交互的独立可读性是否也要加说明。没有改共享 widget 实现或图资源。其余图像仅保留标记，未独立视觉验收。
5. **主 agent 集成项**：统一运行全站 tests/build、链接/锚点及中英渲染检查。重点看新增长段落/公式排版；本轮没有碰根导航和 chronology。
6. **实现层验证不在本轮**：缓存隔离、撤权/删除竞态、备份恢复、工具出站权限、幂等重试、结构化输出异常分支，都仍需真实服务测试；专属数学/文本回归不能替代。

本轮高风险 pass 到此停止编辑，待主 agent 汇总；未宣称全部范围独立来源验证完成。
