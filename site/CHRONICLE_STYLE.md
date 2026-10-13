# 世界树节点文风规范（2026-10-12）

读者：想知道「这件事为什么重要」的普通学习者，在手机或电脑上随手点开一颗星。
他们只看一眼标题和一句话；感兴趣才读正文；极少数人展开细节。

## 每个节点写五样东西

| 字段 | 用在哪 | 中文长度 | 英文长度 |
| --- | --- | --- | --- |
| `title` | 星点悬停、列表、面板标题 | 「名字 · 一句话」，一句话 6–12 字 | "Name · short phrase", phrase ≤ 7 words |
| `hook` | 悬停提示、年代列表里的一行 | ≤ 30 字，一句完整的话 | ≤ 16 words, one sentence |
| `body` | 面板正文 | 2–4 句，60–130 字 | 2–4 sentences, 40–80 words |
| `detail` | 面板里折叠的「细节」 | 可选；1–2 段，每段 ≤ 120 字 | optional; same paragraph count as zh, each ≤ 70 words |
| `limit` | 面板里「留下的问题」 | 1 句，≤ 45 字 | 1 sentence, ≤ 25 words |

原来有 `detail` 的节点可以保留（缩短），也可以删掉（宁缺毋滥）；原来没有的不要新增。
中英段落数必须相同（`detail` 用空行 `\n\n` 分段）。

## 怎么写

1. **先说当时卡在哪，再说它做了什么，最后给一个结果。** 结果只留最说明问题的一个数字（最多两个）。
2. **短句。** 一句一个意思，逗号别连成串。读出来要顺口，像一个懂行的朋友在讲。
3. **白话优先。** 术语能不用就不用；必须用时，第一次出现紧跟一句白话。英文术语在中文里保留原样（attention、GPU），中英文之间留空格，沿用站内习惯。
4. **具体。** 「训练快了好几倍」比「显著提升训练效率」好；「八块 GPU 训了三天半」比「计算资源有限」好。
5. **`limit` 写成自然的一句话**，说它没解决什么、留给后人什么，例如「生成时还是得一个词一个词往外吐。」不要写成免责声明。
6. **标题里的一句话用动词**，说它改变了什么：「让网络自己学看图」「翻译只靠注意力」「大模型走进对话框」。

## 不要写

- 「不是……而是……」「并不意味着」「要看的是」「值得注意的是」「需要指出」「本质上」「换句话说」「这一步」「某种意义上」「起点」式的免责（「这不是……的起点」）。
- 括号套括号；一句话里塞三个以上数字；「等」「之类」连用。
- 日期考证、版本号、预印本日期（这些留在来源里）。
- 「仍需展开」「本站」「这里收录」之类写给维护者的话。
- 英文：no "It's not X, it's Y", no "notably", "crucially", "In essence", "paved the way", "revolutionized", "game-changer". Plain, concrete, active voice. Zero Chinese characters in English fields.

## 事实

- **只用原文和它列出的来源里已有的事实**，不要新增任何事实、数字、人名或评价。可以删，不能编。
- 数字必须与原文一致（单位、量级、对比对象）。原文里有「注意这个数是集成结果」之类的限定，正文里写比赛成绩可以，但不要写错对象。
- 拿不准就删掉那句。

## 三个样例（已定稿）

**Transformer（2017）**
- title：Transformer · 翻译只靠注意力
- hook：去掉循环，让每个词直接看到整句话。
- body：2017 年以前，翻译模型得一个词一个词往下算，句子越长越慢。Transformer 把循环整个拿掉，每个词直接用注意力看整句话，训练可以并行。它在英德翻译上比此前最好的成绩高出 2 BLEU 以上，八块 GPU 训了三天半。后来的 BERT 只用它的编码器，GPT 只用解码器。
- detail：拿一句 50 个词的话来算：循环网络要串行走 50 步，注意力一层就让任意两个词直接相连。代价是每层要算 50×50 个词对，句子越长，计算量按平方涨。
- limit：生成时还是得一个词一个词往外吐；长文本的平方开销也留给了后人。
- EN title: Transformer · Translation with attention alone
- EN hook: It dropped recurrence so every word could look at the whole sentence at once.
- EN body: Before 2017, translation models processed a sentence one word at a time, so long sentences trained slowly. The Transformer removed recurrence entirely: each word uses attention to look at every other word, and training runs in parallel. It beat the previous best English–German result by more than 2 BLEU after three and a half days on eight GPUs. BERT later kept only its encoder, and GPT only its decoder.
- EN detail: Take a 50-word sentence. A recurrent network needs 50 sequential steps; one attention layer connects any two words directly. The price is 50 × 50 word pairs per layer, so cost grows with the square of the length.
- EN limit: Generation still emits one word at a time, and the quadratic cost on long inputs was left for later work.

**ChatGPT（2022）**
- title：ChatGPT · 大模型走进对话框
- hook：普通人第一次能直接和语言模型聊天、追问、改要求。
- body：2022 年 11 月，OpenAI 以研究预览的形式放出 ChatGPT。不用写代码，打开网页就能提问，还能接着追问、让它改。语言模型从论文和 API 里走出来，成了很多人每天在用的东西。
- limit：它会一本正经地答错，发布公告里就写了这一条。

**AlexNet（2012）**
- title：AlexNet · 让网络自己学看图
- hook：不再手工设计图像特征，交给卷积网络自己学。
- body：2012 年以前，图像识别要先靠人设计特征，再交给分类器。AlexNet 让网络自己学特征：八层、六千万参数，在两块游戏显卡上训了五六天。ImageNet 比赛里，它的错误率是 15.3%，第二名是 26.2%。作者说，成绩主要来自更大的网络、更多的数据和更长的训练。
- detail：能训起来靠几处改动：激活函数换成 ReLU，训练快了好几倍；用 dropout 和随机裁剪对抗过拟合；一块显卡放不下，就把网络拆到两块卡上。
- limit：它只会从一千个类别里挑一个答案，图里有什么、在哪、彼此什么关系，还管不了。
