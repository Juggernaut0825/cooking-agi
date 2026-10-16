# Perception, robots, and driving: from pixels to actions

[中文](README.md) · **English**

> Reading time: ~2 min · Draft, pending review

Seeing a cup and picking it up are different problems. Where is it? How should the arm move? What else on the table might get in the way? Driving raises similar questions about roads, vehicles and pedestrians. The three series cover perception and geometry, autonomous driving, and robot learning. A system may use separate modules or learn several tasks jointly; the organization here is a way to learn the material, not a prescribed architecture.

> **Draft, pending review.** The site owner has not reviewed this note yet; facts, emphasis and wording may change. Check the primary sources linked in the text before relying on it.

## Three series

| Series | Notes | What it answers | Where to start |
| --- | --- | --- | --- |
| [Perception & geometry](perception/README.en.md) | 5 | How a 3D point becomes a pixel, how to track objects, detection, segmentation and geometry foundation models in 2026, 3D reconstruction and neural rendering | Note 1, [How a 3D point becomes a pixel](perception/camera-geometry.en.md) |
| [Autonomous driving](driving/README.en.md) | 3 | How surround cameras become a bird's-eye view, how to forecast others and plan for yourself, why end-to-end models need closed-loop evaluation | Note 1, [From surround cameras to BEV and occupancy](driving/bev-occupancy.en.md) |
| [Robot learning](robot-learning/README.en.md) | 2 | How to learn actions from demonstrations, how VLA models output actions, whether what is learned in simulation carries over to real robots | Note 1, [Learning actions from demonstrations](robot-learning/imitation.en.md) |

If camera geometry is new to you, start with how a 3D point becomes a pixel. For driving, follow that with object detection, then BEV, prediction and planning. If you already work with vision models and want to understand action learning, start with imitation learning and VLAs. Each route links to the background it needs. Notes are numbered separately within each series; cross-series references use titles.

## How this connects to the rest of the site

- Visual representations: [ViT](../03-multimodal-learning/vit.en.md), [CLIP](../03-multimodal-learning/clip.en.md), [VLM designs](../03-multimodal-learning/vlm-designs.en.md).
- Control and learning: [Planning & LQR](../05-post-training/deep-rl/planning-and-control.en.md), [Model-based RL](../05-post-training/deep-rl/model-based.en.md), [Imitation & rewards](../05-post-training/deep-rl/imitation-and-rewards.en.md).
- How world models serve robots and cars as simulators and evaluators: [this note in the Frontier block](../11-frontier/world-models/robotics-driving.en.md).

For the history behind these approaches, follow the [robots and autonomy branch of the technology chronicle](../learn/technology-timeline.en.md?field=applications&track=robotics).
