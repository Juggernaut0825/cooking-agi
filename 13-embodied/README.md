# 感知、机器人与自动驾驶：从像素到动作

**中文** · [English](README.en.md)

> 阅读时间：约 2 分钟 · 草稿，待审核

看见一个杯子，和把杯子拿起来，中间还差不少事：杯子在哪，手该往哪走，会不会碰到桌上的其他东西？自动驾驶也有类似的问题，只是对象换成了道路、车辆和行人。这里分成三个系列，分别讲感知与几何、自动驾驶、机器人学习。具体系统可以把这些任务拆成多个模块，也可以联合学习；这个目录是为了方便理解，并不是要求所有系统长成同一种架构。

> **待审核草稿。** 这一篇还没有经过站主审阅，事实、取舍和措辞都可能修改；引用前请回到文中链接的一手资料核对。

## 三个系列

| 系列 | 篇数 | 回答什么 | 从哪篇开始 |
| --- | --- | --- | --- |
| [感知与几何](perception/README.md) | 5 | 三维点怎样变成像素，怎样跟踪目标，2026 年的检测、分割和几何基础模型，三维重建与神经渲染 | 第 1 篇 [一个三维点怎样变成像素](perception/camera-geometry.md) |
| [自动驾驶](driving/README.md) | 3 | 环视相机怎样变成鸟瞰图，怎样预测别人、规划自己，端到端模型为什么要闭环评测 | 第 1 篇 [从环视相机到鸟瞰图（BEV）与占用](driving/bev-occupancy.md) |
| [机器人学习](robot-learning/README.md) | 2 | 怎样从示范里学动作，VLA 模型怎样输出动作，仿真里学到的能不能搬到真机 | 第 1 篇 [从示范中学动作](robot-learning/imitation.md) |

如果还不熟悉相机几何，先从“三维点怎样变成像素”开始。想看自动驾驶，可以接着读目标检测，再进入 BEV、预测与规划；已经做过视觉模型、想了解机器人动作学习，可以直接读模仿学习和 VLA。每条路线都能独立进入，需要补的背景会在文中链接出来。各系列分别从第 1 篇编号，跨系列引用用篇名区分。

## 和站内其他内容的关系

- 视觉表示：[ViT](../03-multimodal-learning/vit.md)、[CLIP](../03-multimodal-learning/clip.md)、[VLM 的几种设计](../03-multimodal-learning/vlm-designs.md)。
- 控制与学习：[规划与 LQR](../05-post-training/deep-rl/planning-and-control.md)、[Model-based RL](../05-post-training/deep-rl/model-based.md)、[模仿与奖励](../05-post-training/deep-rl/imitation-and-rewards.md)。
- 世界模型怎样给机器人和汽车当仿真器和评测器：[前沿板块的这一篇](../11-frontier/world-models/robotics-driving.md)。

想先看这些路线怎么发展，可以在[技术编年史](../learn/technology-timeline.md?field=applications&track=robotics)里沿着机器人与自主系统这条分支读。
