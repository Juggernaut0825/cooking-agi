# 系统设计：阅读与取舍

**中文** · [English](system-design.en.md)

> 阅读时间：约 2 分钟 · 最近审阅：2026-10

> **先读这个**：面试的形式和重点变得很快，这里的内容有时效性；这里只写公开的资源和我自己的理解，不写任何一家公司的面试题或流程。

我也还在补系统设计。这页保留我读过的公开资源和一些思考；想动手练习，可以先去[系统设计练习](../learn/system-design/README.md)，从信息流、RAG 或带记忆的助手选一个。

## 没有固定公式

我的体会是，系统设计没有一套背下来就能用的模板。练习时我会先检查两件事：**能不能解释每个选择的取舍**，以及**能不能把整个系统串起来**。这是我的准备重点，不是所有招聘方共用的评分规则。

所以从最基本的出发就行：

1. 要解决的是什么问题？成功长什么样？
2. 手里有什么数据？没有什么数据？
3. 约束是什么——规模、延迟、成本、freshness？
4. 每一步选这个方案，放弃了什么？

## 一个例子：推荐系统

比如要做推荐。先看手上有什么：

- **如果有关注、好友或互动关系**，可以先用这些关系找候选。图也不只指社交图：[PinSage](https://arxiv.org/abs/1806.01973) 用的是 Pinterest 的物品与收藏板关系，别把几种不同的数据结构混为一谈。
- **没有社交关系，但有行为记录呢？** 可以从 item–item 共现或用交互样本训练的双塔召回开始；点击、收藏本身也能形成关系，不能把“没有社交图”误读成“没有任何交互数据”。
- **连交互也很少呢？** 新物品可以先用标题、类目、多模态 embedding 等内容特征；新用户可以用其主动选择的兴趣或非个性化候选作基线。热门兜底也需要其他用户的历史，完全新建的服务不能凭空算出热门。内容、人工规则和热门都是待比较的方案，不是一定胜过复杂模型的结论。可对照 [YouTube 推荐论文（2016）§3.2–3.3](https://research.google/pubs/deep-neural-networks-for-youtube-recommendations/) 如何区分观看历史、侧信息与训练信号。

再往下每一层都是取舍：召回要多快、排序能用多大的模型、特征要多新鲜、离线指标涨了线上会不会涨、复杂度值不值得维护。把这些说清楚，比背一套架构图有用得多。

## 公开资源

通用系统设计：

- [System Design Primer](https://github.com/donnemartin/system-design-primer)：免费，覆盖面广，适合搭骨架
- [ByteByteGo](https://bytebytego.com)：Alex Xu 的《System Design Interview》系列，图多、好读
- [Designing Data-Intensive Applications，第 2 版](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781098119058/)：适合深入理解数据系统的底层取舍。Martin Kleppmann、Chris Riccomini 合著，O'Reilly，2026 年出版；可与[作者的书目](https://martin.kleppmann.com/#publications)交叉核对版本。出版社页面标注 2026 年 2 月，作者书目标注 3 月，这里不把两个日期口径混成同一个精确发布日期

ML / 推荐方向：

- [Designing Machine Learning Systems](https://huyenchip.com/books/)（Chip Huyen）
- [Evidently 的 ML system design 案例合集](https://www.evidentlyai.com/ml-system-design)：几百个真实系统的公开分享
- [Eugene Yan: system design for discovery](https://eugeneyan.com/writing/system-design-for-discovery/)：搜索与推荐系统的分层设计
- [Twitter 开源的推荐算法](https://github.com/twitter/the-algorithm)：推荐链路中的公开组件，不是完整可部署的生产系统

## 站内相关

- [搜索与检索：模型怎样找到需要的信息](../04-search/)
- [现代 AI 系统：模型只是其中一部分](../06-systems/)
- [Agents：不同场景怎么用](../10-agents/scenarios.md)
- [Evaluation：我们凭什么说系统变好了](../07-evaluation/)
- [Kubernetes 与 GPU 集群](../12-infra/kubernetes.md)：分布式训练为什么要成组调度（gang scheduling），推理服务扩容为什么不只是加副本（待审核草稿）
