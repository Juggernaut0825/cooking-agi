# Frontier: first pin down what is meant

[中文](README.md) · **English**

> Reading time: ~3 min · Last reviewed: 2026-10

Can a model predict what an action will do before choosing it? Does spending more time on inference produce better answers? Can we trace how a model reaches an answer? These notes explore the methods behind those questions, with worked examples and a closer look at the experiments.

## Why a separate block

These research directions are still developing, and the same name can cover different methods. Dreamer trains a policy in a learned environment model. I-JEPA learns representations of image regions. An interactive video model generates frames in response to actions. All may appear in discussions of “world models,” but their prediction targets and uses differ.

Each series explains a method through examples, then examines what its experiments establish. Time-sensitive claims include dates and sources; articles marked “pending review” are still drafts. Pick a series below to follow the question that interests you.

| A claim you read | Ask first |
| --- | --- |
| "X is a world model" | What does it predict, in what space, conditioned on what, and what is it used for? |
| "AI is improving itself" | Which object changes, who decides the change, and what signal accepts it? |
| "We measured an N-fold speed-up" | Who measured it, in what unit, with how much human intervention, and did compute grow at the same time? |

## Six series

1. [World models: what the term means now](world-models/README.en.md). From Dreamer training a policy inside imagination, to JEPA predicting representations, to video you can act in and models that evaluate robot policies, ending with whether they actually understand physics.
2. [Recursive self-improvement: first ask what changes](self-improvement/README.en.md). Separate changing weights, changing code, speeding up research, and self-generated data; see why the verifier sets the ceiling, and how "AI speeding up AI" is measured today.
3. [Reasoning models and test-time compute: when thinking longer helps](test-time-compute/README.en.md) (draft, pending review). Sampling and voting, verifiers, how long chains of thought are trained, and how to compare at equal compute.
4. [Training agents with RL: from single answers to multi-step tasks](agentic-rl/README.en.md) (draft, pending review). Where environments and rewards come from, how they get gamed, and which tokens receive gradient in a multi-step episode.
5. [Mechanistic interpretability: opening the model to see how it computes](interpretability/README.en.md) (draft, pending review). Probes, superposition, sparse autoencoders and circuits: what each can and cannot show.
6. [Diffusion language models: denoising a whole block instead of left to right](diffusion-lm/README.en.md) (draft, pending review). What masked diffusion trains, how it relates to BERT's MLM, and why parallel decoding is not automatically faster.

## Worth reading first

The world-model series builds on [Model-based RL](../05-post-training/deep-rl/model-based.en.md) and [Planning & LQR](../05-post-training/deep-rl/planning-and-control.en.md); the new Deep RL note [Which model to learn](../05-post-training/deep-rl/model-types.en.md) is also a good way in. The self-improvement series uses the [Deep RL notation](../05-post-training/deep-rl/README.en.md) and basic ideas from [Evaluation](../07-evaluation/README.en.md). None of these is a hard prerequisite; come back to them when a term is unfamiliar.
