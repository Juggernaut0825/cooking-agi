# AGI 学习笔记

**把零散的 ML / LLM 知识整理清楚，方便学习，也方便复习。**

<!-- repository-only -->

[**在线阅读 →**](https://tianyi-zhang-02.github.io/cooking-agi/index.zh.html) · [English](README.md) · [幕后](contributors.md) · [加入我们](CONTRIBUTING.md)

[![Build](https://github.com/tianyi-zhang-02/cooking-agi/actions/workflows/site.yml/badge.svg?branch=main)](https://github.com/tianyi-zhang-02/cooking-agi/actions/workflows/site.yml)

<!-- /repository-only -->

刚开始准备找工时，我的资料散在课程、论文、文档和一堆收藏里。找一份讲得清楚的材料要花时间，看完之后该接着学什么，也经常没头绪。这个站，就是从整理这些资料开始的。

这里整理了中英文的 ML / LLM 笔记、图解、代码练习和项目拆解，**免费开放，也会一直免费。** 刚入门，可以从基础学起；面试临近，可以集中复习；想了解别的方向，也能挑感兴趣的看。希望即使没有相关背景，你也能找到一个读得下去的起点。

**中文或 English 都可以。** 文章顶部的切换按钮会打开同一篇的另一种语言，中文里保留常用英文术语。网站首次打开默认英文，之后会记住你的选择；直接打开中文链接，就是中文版。

## 从哪里开始

| 你现在想做什么 | 可以从这里开始 |
| --- | --- |
| 刚接触 ML，想补基础 | [起步路线](interview/speedrun-start.md)：从一次预测、loss 和参数更新学起，也有补 Python 的入口。 |
| 想安排一段时间学习 | [按计划学习](interview/study-plan.md)：选一条路线，把阅读和练习排进自己的时间里。 |
| 快面试了，想集中复习 | [快速复习](interview/speedrun.md)：按岗位和可用时间，先补最需要的部分。 |
| 有基础，想看看哪里不熟 | [代码练习](interview/coding-checks.md) · [岗位指南](interview/ai-roles-prep.md)：先自己写、自己讲，卡住了再回看。 |
| 只是对某个方向好奇 | [专题入口](learn/choose-your-path.md#topics) · [编年史](learn/technology-timeline.md)：选一个问题读，或看看这个方向是怎么发展过来的。 |

按你对这个主题的熟悉程度选就好。做了多年系统，第一次接触 RL，也可以从入门讲解看起。

### 怎么用这些笔记

1. **先选一个想弄懂的问题。** 可以跟上面的路线，也可以从[专题目录](learn/choose-your-path.md)找，不需要从头读完整个站。
2. **跟着例子走一遍，再试着自己做。** 算一次、跑一下代码；想继续弄懂原因，再看推导和不同做法的取舍。有些章节还没讲到这么顺，我们会继续改。
3. **记下读到哪儿、下次做什么。** 文章上方的「学习记录」可以标记状态、写备注，[我的学习台](interview/dashboard.md)可以统一看计划和记录。不用注册或 fork；记录存在当前浏览器，记得[导出 JSON 备份](interview/study-plan.md#backups)，留一份副本，换设备也能带走。

路线里的小时数指实际投入学习的时间，不是每天必须完成的任务。可以拆开学，不需要连续打卡。

### 各个板块放什么

- **[基础与原理](learn/README.md)**：模型怎么工作、怎么训练、怎么评估。刚接触语言模型，可以先看[学习导读](00-foundations/study-guide.md)。
- **[面试准备](interview/README.md)**：复习 ML / LLM，练 ML Coding、Python 和常见算法方法。
- **[工程实践](practice/README.md)**：拆解推荐、RAG 和后训练系统，看数据、训练、服务与评估怎么配合。
- **[编年史](learn/technology-timeline.md)**：电力、芯片、网络、软件与 AI 的发展，以及相关原始资料。
- **[求职记录](career/README.md)**：实习和 new-grad 求职中试过的做法，以及回头看想做的调整。

图解直接展示主要过程；想换个条件、比较结果时，再试试交互部分，不需要每个按钮都点一遍。

## 内容地图

想现在就读一篇，可以从这几组里挑：

- **模型怎么工作**：[Transformer 交互图解](https://tianyi-zhang-02.github.io/cooking-agi/00-foundations/transformer-lab.html) · [BERT](00-foundations/core/bert.md) · [CLIP 与多模态](03-multimodal-learning/clip.md)。
- **模型怎么学**：[训练基础](learn/pretraining/README.md) · [Deep RL](05-post-training/deep-rl/README.md) · [Post-training](05-post-training/README.md) · [LLM-as-a-Judge](07-evaluation/llm-as-a-judge/README.md)。
- **模型怎么用起来**：[推理](learn/inference/README.md) · [搜索与检索](04-search/README.md) · [Agents 与工具](10-agents/README.md)。

想动手练习，可以直接去 [ML Coding](learn/ml-exercises/README.md)、[Python](interview/python.md)、[算法方法](interview/leetcode.md)或[系统设计](learn/system-design/README.md)。

部分内容仍在补充和核对，进度见[内容覆盖与待办](learn/coverage.md)。“已写”不等于“已审核”；文中的小实验也不等于完整模型或 benchmark 的复现。

**接下来在做：v1.0 学习台。** 重点是安排学习、记录笔记和备份进度，见[版本进展](community/updates.md)和[后续计划](community/roadmap.md)。CV、自动驾驶、边缘部署、仿真与机器人也欢迎大家参与补充，目前还不是完整课程。

## 加入我们！

哪里没讲明白、哪条信息过时了，或者你想看一个还没有的主题，都可以告诉我们。不用先找到答案，才能提问题。

- **提反馈：**开一个 [issue](https://github.com/tianyi-zhang-02/cooking-agi/issues/new?template=note-feedback.yml)，附上相关段落。内容纠错、信息过时、解释不清、想加主题、网站问题，都有对应选项。
- **一起改：**小改动直接提 PR 就好；想写新文章或调整目录，先开[内容提案](https://github.com/tianyi-zhang-02/cooking-agi/issues/new?template=proposal.yml)，方便大家商量，避免重复做。
- **分享给朋友：**如果这里的笔记帮到了你，欢迎把链接发给同学，或正在找工、转方向的朋友。不用公开公司或求职结果。也可以去[幕后](contributors.md)看看参与整理的朋友；地图位置是自愿填写的。

这些是我们一边学、一边改的笔记，不是官方课程。选题受自身经验影响，目前更偏 ML / LLM 和 MLE / research 方向，也难免有遗漏和过时的地方。我们分享公开知识和准备方法，不收录针对某家公司的面试信息或题库，也没办法预测题目、保证 offer。

<details markdown="1">
<summary>修改、审核与隐私说明</summary>

具体流程见[贡献指南](CONTRIBUTING.md)、[写作规范](EDITORIAL.md)和[板块审核人](community/README.md)。社区贡献的 PR 需要非作者的相关 CODEOWNER 审核，并通过自动检查。请使用公开资料，用自己的话解释。AI 辅助起草或初审需要说明用法、人工核对，不能代替正式批准或事实验证。

Issue 是公开的，请不要附私人进度备份、公司资料或未脱敏的日志。指出信息变化时，有公开来源或版本号更好；只是想问清楚一段讲解，不需要先准备这些。

</details>

**免费阅读，也欢迎按许可使用和改编。** 不设付费章节或付费备考路线。原创代码采用 MIT，原创笔记采用 CC BY 4.0；请保留署名、来源和许可说明，并标注修改。第三方素材仍遵循原许可。我们不为他人修改、转载的版本背书，保证与责任范围以[许可条款](LICENSE.md)为准。

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

部分实验还需要 PyTorch，依赖写在对应章节；没有安装时，相关测试会明确跳过。个人收藏清单、最近阅读和阅读位置保存在这个浏览器里。公开计数默认关闭；另行开启后，只提交后续阅读和手动收藏操作，不上传已有记录或学习备份。线上统计服务目前尚未接入。

</details>

## 为什么整理这些

从学术研究转向企业里的 ML 工作时，我常遇到一种情况：论文里看着眼熟的东西，真要自己讲、自己写，又不太会了。整理笔记帮我发现了这些缺口，公开出来，也能让别人帮忙看看哪里还没想清楚。

我希望，开始学一个方向，不必先有相关背景，也不必刚好认识能给你一份资料清单的人。这些笔记代替不了学习和练习，但可以让起步容易一点。别人讲得好的，我们就推荐；自己不熟悉的，也欢迎做这个方向的朋友来补充。不同领域的人一起整理，说不定还能看到以前没注意过的联系。

能少花一点东翻西找的时间，学完还有空做点自己喜欢的事，我就觉得这个站值得继续做下去。
