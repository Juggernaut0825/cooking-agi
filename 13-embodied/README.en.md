# Perception, robots, and driving: from pixels to actions

[中文](README.md) · **English**

> Reading time: ~3 min · Draft, pending review

A camera captures a frame; a car has to decide where to drive, a robot arm where to reach. In between are several steps: recover the things in 3D from the pixels, keep track of them, predict what they will do next, and choose an action. **This block follows that chain in three short series: perception and geometry, autonomous driving, and robot learning.**

> **Draft, pending review.** The site owner has not reviewed this note yet; facts, emphasis and wording may change. Check the primary sources linked in the text before relying on it.

## Three series

| Series | What it answers | Where to start |
| --- | --- | --- |
| [Perception & geometry](perception/README.en.md) | How a 3D point becomes a pixel, how to track objects, detection, segmentation and geometry foundation models in 2026, 3D reconstruction and neural rendering | [How a 3D point becomes a pixel](perception/camera-geometry.en.md) |
| [Autonomous driving](driving/README.en.md) | How surround cameras become a bird's-eye view, how to forecast others and plan for yourself, why end-to-end models need closed-loop evaluation | [From surround cameras to BEV and occupancy](driving/bev-occupancy.en.md) |
| [Robot learning](robot-learning/README.en.md) | How to learn actions from demonstrations, how VLA models output actions, whether what is learned in simulation carries over to real robots | [Learning actions from demonstrations](robot-learning/imitation.en.md) |

## How this connects to the rest of the site

- Visual representations: [ViT](../03-multimodal-learning/vit.en.md), [CLIP](../03-multimodal-learning/clip.en.md), [VLM designs](../03-multimodal-learning/vlm-designs.en.md).
- Control and learning: [Planning & LQR](../05-post-training/deep-rl/planning-and-control.en.md), [Model-based RL](../05-post-training/deep-rl/model-based.en.md), [Imitation & rewards](../05-post-training/deep-rl/imitation-and-rewards.en.md).
- How world models serve robots and cars as simulators and evaluators: [this note in the Frontier block](../11-frontier/world-models/robotics-driving.en.md).

This block covers the knowledge these roles need; it does not collect any company's interview questions or hiring process. Fast-moving facts (deployment scale, which model weights are open) carry a date and a source, and numbers that vendors report about themselves are marked as self-reported.
