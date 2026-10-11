# 按目标找路线

**中文** · [English](choose-your-path.en.md)

先选一件你最近想做到的事：看懂一个模型、准备技术面、搭个项目，或者安排接下来的求职准备。不用把整个站读完再开始。

<nav class="study-route goal-route" aria-label="按目标选择阅读路线">
<a href="#getting-started"><small>先建立理解</small><strong>我刚开始学 ML / LLM</strong><span>从一个预测问题，到 Transformer</span></a>
<a href="#interviews"><small>准备技术面</small><strong>我需要复习和练代码</strong><span>基础问答、ML Coding、算法，各练各的</span></a>
<a href="#research"><small>读懂研究</small><strong>我想看懂论文和实验</strong><span>机制、比较条件、复现与局限</span></a>
<a href="#projects"><small>动手做东西</small><strong>我想搭一个能用的项目</strong><span>先跑通，再讨论设计与取舍</span></a>
<a href="#topics"><small>只看感兴趣的</small><strong>我只想补一个专题</strong><span>后训练、评估、RAG、多模态、推理……</span></a>
<a href="#applications"><small>安排求职准备</small><strong>我想理一理准备的顺序</strong><span>岗位方向、项目追问和面试复盘</span></a>
</nav>

每条路线都有起点，也有可以先停下来的地方。会的直接跳过，不熟的再补。这些笔记主要贴近 ML / LLM 和 MLE / research 岗位，不是所有岗位通用的面试大纲。

## 刚开始学：先弄懂一次计算 {#getting-started}

会一点 Python 就能开始。向量和梯度不熟，先读[从线性模型到神经网络](../00-foundations/from-linear-to-neural.md)，不用先学完全部数学。

1. [Tokenization](../00-foundations/core/tokenization.md)：一句话怎样变成模型的输入。
2. [Transformer 图解](../00-foundations/transformer-lab.md)：沿着一小段输入，看 Attention、FFN 和残差怎样接起来。
3. [训练基础](pretraining/README.md)：预测错了以后，loss 怎样让参数发生变化。

**先做到这一步就好：**拿一句短句，能讲清输入、预测、loss 和更新；不需要背出每个矩阵的全部公式。想用代码确认，再做 [PyTorch 小实验](../00-foundations/pytorch/README.md)。模型家族、MoE 和分布式训练可以晚一点读。

## 准备技术面：先找出自己卡在哪 {#interviews}

先看岗位描述和已经收到的面试说明，不要因为标题都叫 MLE，就默认每一轮考的一样。还没有具体面试，也可以拿一道概念题、一个小实现试试。

1. **说不清原理**：去 [ML / LLM 基础问答](../interview/basics/README.md)。试着不看笔记回答，再用一个例子解释。
2. **原理懂，代码写不出来**：去 [ML Coding](ml-exercises/README.md)。重点核对 shape、mask、梯度和边界条件。
3. **写题慢或方法想不到**：去 [Python](../interview/python.md) 和 [LeetCode 方法](../interview/leetcode.md)，按方法练，不按题号背。

**先做到这一步就好：**独立完成一个小题，解释为什么这样做，再换一个输入检查。需要系统设计时，接着练 [Feed / RAG / Memory](system-design/README.md)；项目追问另看[准备什么](../career/prepare.md)。不用为了某一轮面试同时补完所有路线。

## 读研究：弄清它到底改了什么 {#research}

适合已经知道 Transformer 大致怎么工作，想读模型报告或准备研究项目讨论的人。Research Scientist 和 Research Engineer 的要求也因团队而异，这条路线只是帮助你读懂和讨论工作，不代表读完就满足某个岗位门槛。

1. [架构组件](../00-foundations/deep-dives/README.md)：先找到论文改的是哪个部件，不熟的机制单独补。
2. [模型家族](../00-foundations/model-families/README.md)：带着同一组问题比较设计，而不是记版本名字。
3. [评估基础](../07-evaluation/README.md)：看比较对象、数据、指标和消融，分清结果支持什么。

**先做到这一步就好：**用一页纸写清问题、方法、证据和一个你还不确定的地方。能跑的算例自己复算；没有算力复现完整模型，就明确自己只验证了哪一步。想深入后训练，接[原理](../05-post-training/README.md)和[实验实践](../practice/post-training/README.md)，不用先读完所有模型家族。

## 做项目：先让一条路径走通 {#projects}

没做过完整应用，先从[本站与阅读清单](../practice/web-lab/README.md)开始。它不需要 GPU：看懂构建与 CI/CD，再连起页面、API 和数据库。

已经会写基本程序，可以直接选自己想做的项目：

- [推荐系统](../practice/recommender-systems/README.md)：沿着一次请求，看召回、排序、过滤与评估。
- [RAG 知识库](../practice/rag/README.md)：从资料的版本和权限，到检索、引用和答案检查。
- [后训练实验](../practice/post-training/README.md)：从要修的错误，到 SFT、数据 batch、多卡选择、checkpoint 和发布判断。

**先做到这一步就好：**跑通一个最小例子，改一个条件，再解释结果为什么变了。比如删掉支持答案的文档，或中断训练后恢复。准备设计面试时，可以先做[系统设计题](system-design/README.md)，再用项目里的实现反过来检查自己的方案。

## 只想补一个专题，直接过去 {#topics}

不必经过前面所有路线。下面是专题入口，每个入口里再按先后顺序找文章；不是一张必修清单。

<div class="worked-table" markdown="1">

| 你关心的内容 | 从这里进入 |
| --- | --- |
| 模型基础与架构 | [核心机制](../00-foundations/core/README.md) · [组件与模型家族](../00-foundations/model-families/README.md) |
| 数据与训练 | [数据和反馈](../01-data-and-feedback/README.md) · [预训练与训练工程](pretraining/README.md) |
| 强化学习与后训练 | [Deep RL](../05-post-training/deep-rl/README.md) · [SFT / RLHF / 蒸馏](../05-post-training/README.md) |
| 评估是否可信 | [指标与实验](../07-evaluation/README.md) · [LLM-as-a-Judge](../07-evaluation/llm-as-a-judge/README.md) |
| 图片怎样接进语言模型 | [多模态](../03-multimodal-learning/README.md) |
| 检索与长期状态 | [搜索与检索](../04-search/README.md) · [记忆](../02-memory/README.md) |
| 工具与智能体 | [Agents](../10-agents/README.md) · [Personal AGI](../09-personal-agi/README.md) |
| 推理速度、成本与可靠性 | [推理](inference/README.md) · [AI 系统](../06-systems/README.md) · [模型体验](../08-model-experience/README.md) |

</div>

只想查某个词，点顶部搜索或按 `/`。中文、英文术语都可以试试。

## 求职准备：先安排眼前需要做的事 {#applications}

1. [到底要准备什么](../career/prepare.md)：按岗位和自己的短板安排精力。
2. [一次面试复盘](../career/one-interview.md)：面完留下具体问题，再调整下一轮准备。

**先做到这一步就好：**选一个近期目标，找出最需要补的一项，安排一次具体练习。想看我的经历，再读 [25–26 intern 求职](../career/journey.md)和 [26–27 new grad 求职](../career/new-grad-2026-2027.md)。经历是参考，不是必须照着走的时间表。

## 想看全貌，或以后接着读 {#all-notes}

完整目录仍然分成四块：[基础与原理](README.md)、[面试准备](../interview/README.md)、[工程实践](../practice/README.md)、[求职](../career/README.md)。同一篇文章只保留一份，路线之间用链接衔接；不会因为你从另一条路线进来，就得再读一遍相同内容。

右上角 **中文 / EN** 切换同一篇。“我的阅读”可以收藏和找回最近读过的页面，记录只在当前浏览器；换设备前可以导出收藏。内容还在继续补，哪些已写、哪些待核对，见[覆盖与待办](coverage.md)。
