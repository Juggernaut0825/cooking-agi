# 数据到模型：交付的不只是一个 checkpoint

**中文** · [English](data-to-model.en.md)

> 原创教学拆解 · 核对：2026-10-11。接着[资料搜索系统](README.md)往下走；本页没有宣称训练出新模型。

用户搜不到一篇相关资料，可能是资料没入库，也可能是切块丢了标题、向量不适合这个领域，或者评估只收了很好搜的题。先把这些情况分开，才知道该修 pipeline 还是训练模型。

## 1 · 接入：先留下能追溯的记录 {#ingestion}

文档至少带 `document_id`、`revision`、来源、内容时间、到达时间和访问范围。图片还需要处理后的尺寸、processor 版本等信息；行为事件则要有 event ID、request ID 与发生时间。具体保留哪些原文和身份字段，受权限、用途与保留期限约束，不是记录越多越好。

| 情况 | 要处理什么 | 不处理会怎样 |
| --- | --- | --- |
| 同一事件被重试发送 | 按稳定 event ID 幂等去重 | 一次点击被当成多次反馈 |
| 文档更新 | revision 与替换关系 | 搜索结果和引用落到不同版本 |
| 删除或撤回权限 | tombstone / 权限事件及传播确认 | 主库删了，旧索引或 cache 还在返回 |
| 解析失败 | 错误类型、重试与隔离队列 | 静默丢掉某类文档，数据分布改变 |

小项目里一张带版本的表就能做很多事。引入消息队列后，也仍要定义重复、乱序、晚到与重放，不能靠“用了 Kafka”代替数据语义。

## 2 · 特征：当时真的知道吗？ {#point-in-time}

假设 10:00 要预测用户是否会点开资料。一条行为发生于 09:58，却到 10:02 才进入系统。离线用今天的完整日志回放时，不能让 10:00 的样本用上这条当时不可用的信息。

下面把时间写成分钟整数，便于手算；真实系统还要统一时区、时钟和晚到规则。示例查询同一用户的一项特征，选择事件时间和可用时间都不晚于查询时刻的最新记录：

```python
def feature_as_of(records, entity, query_time):
    eligible = [
        record for record in records
        if record["entity"] == entity
        and record["event_at"] <= query_time
        and record["available_at"] <= query_time
    ]
    return max(eligible, key=lambda record: (record["event_at"], record["available_at"]), default=None)


records = [
    {"entity": "user-a", "event_at": 590, "available_at": 591, "value": 2},
    {"entity": "user-a", "event_at": 598, "available_at": 602, "value": 3},
]
assert feature_as_of(records, "user-a", 600)["value"] == 2
assert feature_as_of(records, "user-a", 603)["value"] == 3
```

示例假定上游已经去重，且这是单项特征；相同时间的修订、TTL 和缺失策略另需定义。[Feast 的 point-in-time join](https://docs.feast.dev/getting-started/concepts/point-in-time-joins)可帮助理解按历史时点取特征，但“当时何时可用”需要数据本身记录并由 pipeline 正确处理，不是打开一个开关就自动解决。

## 3 · 样本：日志不等于标签 {#labels}

用户没点一篇文章，可能没看到、标题没吸引他、已经知道答案，也可能确实不相关。负例怎么构建，要配合曝光、位置、观察窗口和任务定义。没有曝光的候选与展示后明确拒绝的候选，不宜直接混成同一种负例。

| 样本类型 | 能提供什么信息 | 仍然缺什么 |
| --- | --- | --- |
| 点击与停留 | 对展示内容的行为反应 | 是否真正解决问题；位置与展示偏差 |
| 人工相关性标注 | 按 rubric 判断 query–document | 标注一致性与覆盖范围 |
| 合成 query / teacher 分数 | 扩大候选监督 | teacher 偏差、数据重复、分数校准 |
| 明确“不相关”反馈 | 相对清楚的拒绝信号 | 用户是否误操作，反馈是否晚到 |

对训练、开发和测试按文档来源、时间或 query family 做合适隔离。同一 PDF 的相邻段落随机分到两边，可能只是测“记没记住文档”。去重后的样本量、标签比例、缺失情况和来源变化，应该成为每次数据交付的一部分。

## 4 · 模型：先做能定位问题的 baseline {#training}

先检查关键词检索，再加 dense retrieval；两者的错误可能互补。带截图的问题可以试 [SigLIP](../../03-multimodal-learning/siglip.md) 这类图文 encoder，但不是把图片向量硬塞进任意文本向量空间。各路先产生候选，再以明确方法融合或重排。

训练 retriever 时，检查 positive、negative 与 false negative；训练引用行为的 SFT，则检查 chat template、target mask 和有效 token 权重。它们不是同一种监督。分别见[双塔](../../04-search/dual-encoder.md)和[数据到 batch](../post-training/data-pipeline.md)。

GPU 放不下时，先把权重、optimizer、激活和临时内存分别列出来，再比较 [DDP / FSDP2 / ZeRO](../../06-systems/training-frameworks.md)。扩卡之前，用固定小 batch 比较 loss 与一次更新；扩卡之后，再检查数据重复、分母和梯度累积。先把错的目标跑得更快，最后只会更快得到一个不合适的模型。

## 5 · Checkpoint：继续训练和上线不是一回事 {#checkpoint}

| 用途 | 要保存 / 关联的内容 | 验收动作 |
| --- | --- | --- |
| 继续这次训练 | 模型、optimizer、scheduler、RNG、数据游标、更新步、配置与数据版本 | 中断后恢复，比较样本与更新轨迹 |
| 推理部署 | 权重 / adapter、基座、模型配置、tokenizer / processor、模板、精度、运行依赖 | 在实际加载路径做固定输入回归 |
| 复现实验判断 | 代码 revision、环境、数据划分、指标定义、选择 checkpoint 的依据 | 别人能重跑同一项比较 |

训练 checkpoint 可能是分片文件，推理引擎未必能直接加载；adapter 也要匹配基座。导出、量化或合并以后，要重新验收实际部署产物，不能只引用训练时那份分数。更细的恢复测试见[保存与恢复](../post-training/checkpoint-and-resume.md)。

## 6 · 索引：向量对得上版本吗？ {#index}

假设旧 encoder A 和新 encoder B 都输出 768 维。维度相同，只说明形状能接上，不说明坐标含义相同。用 B 编 query、拿 A 的文档向量做 ANN，可能完全没有预期的匹配关系。

因此一次发布要关联模型与 index：

```json
{
  "release": "search-demo-v2",
  "query_encoder": "encoder-b",
  "document_encoder": "encoder-b",
  "processor": "processor-b",
  "index": "index-b-snapshot-17",
  "document_snapshot": "documents-17",
  "ranking_config": "ranking-4",
  "evaluation_report": "eval-search-demo-v2"
}
```

这是教学 manifest，不是任何 registry 的标准配置；实际版本应能解析到不可变 revision 或内容 hash。某些双塔本来就使用不同的 query / document encoders，这时记录的是**经过共同训练或验证的兼容组合**，不是强制两边文件相同。

重建可以在旁路完成，抽查覆盖率、删除、权限与检索质量，再切换读流量。回滚时把兼容组合一起退回；只退 query encoder，往往是不完整的回滚。

## 7 · 评估：模型分数和系统结果分别看 {#evaluation}

固定 query 和候选资格规则，再分开检查：相关文档有没有入库、是否被召回、是否被排到前面、摘要是否用对证据。只给最后一个答案分数，没法判断该修哪个模块。

| 层次 | 最小检查 | 不该怎么解释 |
| --- | --- | --- |
| 数据 / index | 覆盖率、新鲜度、删除与权限 | 覆盖更多不等于相关性更高 |
| 召回 | 固定预算下的 Recall@k，按语言、query 类型切片 | 不能靠无限增大 k 获得免费收益 |
| 排序 | NDCG 等排序指标、失败案例 | 标签和候选池变了，分数不可直接横比 |
| 生成 | 支持性、引用、拒答与任务完成 | 格式正确不等于答案有依据 |
| 成本 | 延迟、显存、编码量、训练和索引更新成本 | 不只数一次模型 forward |

先约定发布门槛，再看结果；测试集留给最终比较。样本小就报告不确定性与失败明细，不把多答对一道包装成稳定提升。下一篇继续看[如何上线、监控与回流](serving-and-feedback.md)。
