# AGI 学习笔记

**学 ML / LLM、准备技术面试，少花一点找资料的时间。**

[**在线阅读 →**](https://tianyi-zhang-02.github.io/cooking-agi/index.zh.html) · [English](README.md) · [幕后](contributors.md) · [加入我们](CONTRIBUTING.md)

[![Build](https://github.com/tianyi-zhang-02/cooking-agi/actions/workflows/site.yml/badge.svg?branch=main)](https://github.com/tianyi-zhang-02/cooking-agi/actions/workflows/site.yml)

<a href="https://tianyi-zhang-02.github.io/cooking-agi/index.zh.html"><img src=".github/media/promo.zh.webp" width="100%" alt="29 秒看一遍网站：可交互的图、中英切换、250+ 篇笔记、编年史之树和阅读记录"></a>

这里整理了中英文的 ML / LLM 学习笔记、代码练习和项目拆解，免费开放。刚入门，可以跟着例子补基础；准备面试，可以按岗位集中复习；只对某个方向感兴趣，也可以直接选读。

最初整理这些，是因为我自己准备面试时，资料散在课程、论文和一堆收藏里。希望把它们串起来，让没有相关背景的人也能找到起点，不必先花很久搜资料。

**语言切换：**网站首次打开默认英文。顶部的 **中文 / EN** 可以切换同一篇笔记，浏览器会记住选择。中文保留常用英文术语，方便对照；直接打开中文链接，就会显示中文版。

**v1.0 正在准备中。** 这次主要做[学习台](interview/dashboard.md)：安排学习、记录进度、导出备份。见[版本进展](community/updates.md)和[后续计划](community/roadmap.md)。CV、自动驾驶、边缘部署、仿真与机器人仍在征集内容，尚未形成完整课程。

## 从哪里开始

| 你的需求 | 阅读入口 | 建议起点 |
| --- | --- | --- |
| 刚接触 ML | [起步路线](interview/speedrun-start.md) | 从一次预测、loss 和参数更新学起。需要时先补 Python。 |
| 想系统学习 | [按计划学习](interview/study-plan.md) | 按前置知识安排顺序，边读边练。 |
| 面试前集中复习 | [快速复习](interview/speedrun.md) | 按岗位和可用时间，选最需要补的内容。 |
| 已有基础，查漏补缺 | [代码练习](interview/coding-checks.md) · [岗位指南](interview/ai-roles-prep.md) | 先试着独立实现、解释，再回看不熟的部分。 |
| 按兴趣选读 | [专题入口](learn/choose-your-path.md#topics) · [编年史](learn/technology-timeline.md) | 按兴趣读原理，或了解技术的发展过程。 |

按你对这个主题的熟悉程度来选就好。比如做了多年系统，第一次接触 RL，仍然可以从起步路线读起。

### 怎么用这些笔记

1. **选内容。** [面试准备](interview/README.md)分为快速复习和按计划学习；[阅读路线](learn/choose-your-path.md)还有研究、项目和专题入口。
2. **读讲解，做练习。** 先看例子和图，再按需要读推导、实现与方案比较。各章的详细程度还不完全一致，我们会继续补。
3. **记录进度。** 在文章上方的「学习记录」里标记状态、写备注，在[我的学习台](interview/dashboard.md)安排后续学习。无需注册或 fork，记录保存在当前浏览器；换设备前可以[导出 JSON 备份](interview/study-plan.md#backups)。

路线中的小时数是有效学习时间的估计，可以拆成多次，也不要求每天打卡。

### 各个板块放什么

- **[基础与原理](learn/README.md)**：模型结构、训练方法、评估与推理。刚接触语言模型，可以先看[学习导读](00-foundations/study-guide.md)。
- **[面试准备](interview/README.md)**：ML / LLM 基础问答、ML Coding、Python 和算法练习。
- **[工程实践](practice/README.md)**：拆解推荐、RAG 和后训练系统，理解数据、训练、服务与评估怎么配合。
- **[编年史](learn/technology-timeline.md)**：电力、芯片、网络、软件与 AI 的重要进展，以及它们之间的联系。
- **[求职记录](career/README.md)**：实习和 new-grad 求职中的准备、选择与复盘。

图解会直接展示主要过程；交互部分用来调整条件、比较结果，不操作也能读懂。

## 内容地图

想直接看文章，可以从这几组开始：

- **模型怎么工作**：[Transformer 交互图解](https://tianyi-zhang-02.github.io/cooking-agi/00-foundations/transformer-lab.html) · [BERT](00-foundations/core/bert.md) · [CLIP 与多模态](03-multimodal-learning/clip.md)。
- **模型怎么学**：[训练基础](learn/pretraining/README.md) · [Deep RL](05-post-training/deep-rl/README.md) · [Post-training](05-post-training/README.md) · [LLM-as-a-Judge](07-evaluation/llm-as-a-judge/README.md)。
- **模型怎么用起来**：[推理](learn/inference/README.md) · [搜索与检索](04-search/README.md) · [Agents 与工具](10-agents/README.md)。

想动手练习，可以直接去 [ML Coding](learn/ml-exercises/README.md)、[Python](interview/python.md)、[算法方法](interview/leetcode.md)或[系统设计](learn/system-design/README.md)。

部分内容仍在补充和核对，进度见[内容覆盖与待办](learn/coverage.md)。“已写”不等于“已审核”；文中的小实验也不等于完整模型或 benchmark 的复现。

## 加入我们！

发现错误、内容过时，或者有一段没看懂，都欢迎告诉我们。不用先找到答案，才能提问题。

- **提反馈：**开一个 [issue](https://github.com/tianyi-zhang-02/cooking-agi/issues/new?template=note-feedback.yml)，选择内容纠错、信息过时、解释不清、想加主题或网站问题，附上相关段落。有公开来源或版本号更好。Issue 是公开的，请勿附私人备份、公司资料或未脱敏的日志。
- **参与修改：**小改动可以直接提 PR；新文章或目录调整，先开[内容提案](https://github.com/tianyi-zhang-02/cooking-agi/issues/new?template=proposal.yml)。流程见[贡献指南](CONTRIBUTING.md)、[写作规范](EDITORIAL.md)和[板块审核人](community/README.md)。常规合并需要非作者的相关 CODEOWNER 审核，并通过自动检查。AI 可以辅助起草和初审，但需要说明用法、人工核对，不能代替正式批准或事实验证。
- **分享给朋友：**如果笔记对你有帮助，欢迎把链接发给同学，或正在找工、转方向的朋友。不用公开公司或求职结果。贡献者会列在[幕后](contributors.md)，是否参与、是否标注地图位置，都由自己决定。

这些是我们根据自身经验整理的学习笔记，不是官方课程，目前更偏 ML / LLM 和 MLE / research 方向。选题有主观性，也难免有遗漏和过时之处。我们只使用公开资料，鼓励用自己的话解释，不收录公司的非公开面试信息，不预测原题，也不保证 offer。

**笔记会一直免费，不设付费章节或付费备考路线。** 原创代码采用 MIT，原创笔记采用 CC BY 4.0。欢迎按许可使用和改编，请保留署名、来源和许可说明，并标注修改；第三方素材仍遵循原许可。我们不为他人修改、转载的版本背书，保证与责任范围以[许可条款](LICENSE.md)为准。

## 本地阅读与检查

这个仓库包含笔记、例子和静态站点源码，不需要数据库。在仓库根目录运行，建议使用 Python 3.12：

```bash
python3 -m pip install markdown pygments numpy
python3 site/build.py --serve
```

打开 <http://localhost:8000>。只想构建、不启动预览，可以运行 `python3 site/build.py`，结果在 `_site/`。

<details markdown="1">
<summary>提交前的检查</summary>

```bash
python3 site/collaboration.py
python3 -m unittest discover -s site/tests
python3 site/leakcheck.py
python3 site/paritycheck.py --strict
python3 site/build.py
```

部分实验还需要 PyTorch，依赖写在对应章节；没有安装时，相关测试会明确跳过。收藏、最近阅读和阅读位置只保存在这个浏览器里，不会上传。

</details>

## 为什么整理这些

我从学术研究转向企业里的 ML 工作时，花了不少时间找资料、补基础。整理笔记的过程，也让我发现了一些以前以为自己懂了、其实讲不清楚的问题。

做这个站，是想把这些材料分享出来，让刚开始的人少走一点弯路，也让有经验的人方便查漏补缺。它不能替代完整的学习和动手实践；我们不熟悉的方向，会推荐更合适的资料，也欢迎做不同领域的朋友来补充。说不定一起整理之后，还能发现一些有意思的联系。

希望能帮你少开几个 tab，少花一点找资料的时间，学完也有空做点别的喜欢的事。
