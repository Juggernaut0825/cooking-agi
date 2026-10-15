# Autonomous driving: end-to-end models and why open-loop scores mislead

[中文](end-to-end.md) · **English**

> Reading time: ~14 min · Draft, pending review

Two driving models have exactly the same L2 error in open-loop evaluation; put them in closed-loop simulation and one is over the lane line in under two seconds while the other stays steadily in its lane. **Open-loop evaluation puts the car back at the logged position at every step, so the model's own small deviations never accumulate; in closed loop, the model's deviations change what it sees next. The stronger end-to-end models get, the more they must be judged with closed-loop or near-closed-loop metrics, and before they go on the road they also need a safety case.**

> **Draft, pending review.** The site owner has not reviewed this note yet; facts, emphasis and wording may change. Check the primary sources linked in the text before relying on it.

## What "end-to-end" actually means

What they share: the gradient of the planning or driving objective can flow back into perception, and intermediate outputs are no longer required interfaces. They differ in how much structure stays inside and whether a language model takes part.

| System | Date | Input → output | Internal structure | Nature of the source |
| --- | --- | --- | --- | --- |
| [UniAD](https://arxiv.org/abs/2212.10156) | arXiv 2022-12, CVPR 2023 Best Paper | Multi-camera → planned trajectory | Tracking, mapping, motion forecasting, occupancy and planning chained by queries | Paper and [README](https://github.com/OpenDriveLab/UniAD) |
| [VAD](https://arxiv.org/abs/2303.12077) | 2023-03, ICCV 2023 | Multi-camera → planned trajectory | Vectorised scene representation | From the abstract |
| [DiffusionDrive](https://arxiv.org/abs/2411.15139) | 2024-11, CVPR 2025 Highlight | Sensors → planned trajectory | Truncated diffusion policy anchored on trajectory priors | From the abstract: NAVSIM PDMS 88.1, 45 FPS on an RTX 4090 |
| [EMMA](https://waymo.com/blog/2024/10/introducing-emma/) (Waymo) | 2024-10 | Raw camera images → trajectories, 3D objects and road graph as text | Gemini-based multimodal model, switched by task prompts | Waymo blog; stated limits: no lidar or radar, weak on long video, high inference cost; not presented as deployed |
| Waymo Foundation Model | 2025-12-09 | Camera, lidar, radar → trajectories, objects, maps, validation signals | Sensor fusion encoder plus a Gemini-trained Driving VLM; large Teachers distilled into onboard Students | [Waymo blog](https://waymo.com/blog/2025/12/demonstrably-safe-ai-for-autonomous-driving); no parameter counts |
| Tesla FSD v12–v14 | From 2023-12 | Cameras and more → vehicle controls | Tesla has published no architecture paper | Shareholder letters and talks, see below |
| [Alpamayo](https://www.nvidia.com/en-us/solutions/autonomous-vehicles/alpamayo/llm-info/) (NVIDIA) | [R1](https://arxiv.org/abs/2511.00088) 2025-10; 2 Super weights 2026-08-04 | Cameras → reasoning text and trajectory | Cosmos-Reason VLM plus a diffusion trajectory decoder; 2 Super is 32B plus a 2.3B action expert | Vendor-reported; NVIDIA says its AlpaSim score has no external definition and uses it only to compare its own models |

Tesla's statements, taken only from Tesla's own documents and talks, by date: the [Q4 2023 shareholder letter](https://digitalassets.tesla.com/tesla-contents/image/upload/IR/TSLA-Q4-2023-Update.pdf) says the V12 rollout began in late December 2023, that it uses AI to produce vehicle controls instead of hand-coded behaviour, and that it uses end-to-end training; the [Q4 2024 letter](https://digitalassets.tesla.com/tesla-contents/image/upload/IR/TSLA-Q4-2024-Update.pdf) says V13 uses higher-resolution video inputs and a redesigned controller, with 4.2 times the data (vendor-reported); the [Q4 2025 letter](https://assets-ir.tesla.com/tesla-contents/IR/TSLA-Q4-2025-Update.pdf) says FSD runs on an end-to-end foundation model trained on real-world data from both customer cars and Robotaxi; the Q1 2026 letter ([SEC copy](https://www.sec.gov/Archives/edgar/data/0001318605/000162828026026551/exhibit991.htm)) says v14.3 upgraded the RL stage for long-tail cases and improved the vision encoder in low visibility, cutting inference latency by up to 20% (vendor-reported); the Q2 2026 letter ([SEC copy](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049213/exhibit991.htm)) says a v14 lite was built for AI3 hardware, distilling the driving behaviour of AI4's v14. In the CVPR 2026 WAD talk ([video](https://www.youtube.com/watch?v=2V0ddkF1Svo), from auto-captions of the talk), Elluswamy said the inputs include cameras, maps and navigation, vehicle state and audio, and that the network runs as one copy on each of two redundant AI4 chips. In no primary source has Tesla given a layer-by-layer structure for v12–v14.

## Beyond imitation: RL and self-play

Most end-to-end models are first trained by imitation on human driving logs, and so cannot escape the compounding error from [imitation and rewards](../../05-post-training/deep-rl/imitation-and-rewards.en.md): the logs contain almost only "human in the centre of the lane" states and nothing on "how to come back after drifting". Driving has two older fixes: [ChauffeurNet](https://arxiv.org/abs/1812.03079) synthesises perturbations into the training data so the model sees off-centre states; [Codevilla et al.](https://arxiv.org/abs/1904.08980) systematically examined the dataset bias and generalisation limits of behaviour cloning in driving.

The other route is to let the model drive itself in a simulator and learn from outcomes:

- Apple's [GigaFlow](https://arxiv.org/abs/2502.03349) (ICML 2025) does RL with self-play only in a batched simulator, with no human data. The authors report 1.6 billion km simulated in total, 42 years of driving experience per hour on eight GPUs, and 17.5 years on average between incidents in simulation; state-of-the-art results on CARLA, nuPlan and Waymax, and a WOSAC realism of 0.62. Their stated limits: simulation only, with perception abstracted away.
- Some 2026 papers train without human trajectory labels, described here from their abstracts: [Scaling Self-Play](https://arxiv.org/abs/2606.19641) trains an RL teacher in simplified worlds drawn as boxes, then distils it into pixel-based policies with self-play DAgger, claiming competitive results on HUGSIM and NAVSIM v2; [DriveZero](https://arxiv.org/abs/2609.06055) distils a PPO teacher, trained in interactive worlds built from logs, into a camera-only planner, with the teacher averaging 93.57 on nuPlan's Val14, Test14-hard and Test14-random (self-reported).
- In its ICCV 2025 talk Tesla said it uses a neural world simulator to replay past failures, inject adversarial cut-ins and run closed-loop RL ([video](https://www.youtube.com/watch?v=IRu-cPkpiFk), from auto-captions of the talk). The speaker also said open-loop gains may not translate into real driving, and that evaluation is the hardest problem.

RL gets around "the logs contain no off-centre states", but brings a new problem: wherever the simulator differs from the real world, the policy may exploit it, the same thing as a planner exploiting model errors in [the model-based note](../../05-post-training/deep-rl/model-based.en.md).

## Work it once: the same open-loop score, opposite closed-loop outcomes

Everything below is a teaching setup. A straight road, lane width 3.5 m, car width 1.8 m, so the wheels touch the lane line when the car's centre is $(3.5-1.8)/2=0.85$ m off-centre, and at 1.75 m the centre itself is past the line. Speed $v=10$ m/s. In the log, the human drives straight down the lane centre. Both policies have the same small bias $\varepsilon=0.02$ rad (about 1.15°):

- **Policy A: extrapolate along the current ego heading, plus $\varepsilon$.** It looks only at the ego state, not at lane lines.
- **Policy B: look at the lane lines and pull toward the centre.** Planned heading $=\varepsilon-g\,y$, where $y$ is the car centre's offset to the left (m) and $g=0.1$ rad/m.

**Open loop**, nuScenes-style: at every frame, feed the model the logged state ($y=0$, heading 0), let it output a 3 s trajectory, and compare with the log. In this state both policies output a straight line at heading 0.02, with lateral offset $10\times t\times0.02=0.2t$: L2 errors of 0.2, 0.4 and 0.6 m at 1, 2 and 3 s, averaging 0.4 m. The next frame goes back to the logged state, and the error starts from zero again.

**Closed loop**: execute the first 0.5 s (5 m) of each plan, then replan from where the car actually is. With the small-angle approximation $\sin\theta\approx\theta$:

$$
\text{A:}\ \theta_k=\theta_{k-1}+\varepsilon,\qquad
\text{B:}\ \theta_k=\varepsilon-g\,y_{k-1},\qquad
y_k=y_{k-1}+v\,\Delta t\,\theta_k .
$$

| Time (s) | 0.5 | 1.0 | 1.5 | 2.0 | 2.5 | 3.0 |
| --- | --- | --- | --- | --- | --- | --- |
| A heading (rad) | 0.02 | 0.04 | 0.06 | 0.08 | 0.10 | 0.12 |
| A lateral offset (m) | 0.1 | 0.3 | 0.6 | 1.0 | 1.5 | 2.1 |
| B lateral offset (m) | 0.100 | 0.150 | 0.175 | 0.188 | 0.194 | 0.197 |

A's heading grows by 0.02 per step and its offset grows as $0.05\,k(k+1)$: the wheels touch the line between 1.5 s and 2.0 s, and at 3 s the car's centre is already in the next lane. B follows $y_k=0.5\,y_{k-1}+0.1$ each step and converges to $\varepsilon/g=0.2$ m, staying in its lane throughout.

| Metric | Policy A | Policy B |
| --- | --- | --- |
| Open-loop L2 (1 / 2 / 3 s) | 0.2 / 0.4 / 0.6 m | 0.2 / 0.4 / 0.6 m |
| Closed-loop lateral offset after 3 s | 2.1 m | 0.197 m |
| Wheels touch the lane line | Between 1.5 and 2.0 s | Never |

Open loop cannot tell them apart because the log contains no state with $y\neq0$; "what do you do after drifting" is never asked. Change one condition: a policy that ignores the road entirely and just extrapolates the current speed and heading has an open-loop L2 of 0 on this straight road, a perfect score. Policy A is exactly such an "ego-state extrapolator" with a small bias added.

## Why nuScenes open-loop metrics are no longer trusted

nuScenes open-loop planning evaluation compares the model's predicted ego trajectory with the logged one, reporting L2 error and collision rate at 1, 2 and 3 s. Some primary results:

- [Li et al.](https://arxiv.org/abs/2312.03031) (CVPR 2024) count 73.9% of nuScenes as straight driving; their abstract says these models rely mainly on the ego state to plan, and warns that continuing to chase this leaderboard may not yield convincing, general conclusions. They also add a metric that checks whether trajectories stay on the road (a curb-collision rate).
- The abstract of [AD-MLP](https://arxiv.org/abs/2305.10430) says an MLP that takes only past trajectory and velocity, with no images or lidar, actually lowers average L2 by about 20%; on collision rate, though, methods that use perception remain better.
- Implementations are not uniform either. UniAD's own README reports a nuScenes average L2 of 0.90 m; in the comparison table of the [SparseDrive](https://github.com/swc-17/SparseDrive) README, UniAD is listed at 0.73 m. Whether collisions are counted per step or at any step, the grid size, and which samples count as valid can all differ between papers.
- The [Bench2Drive](https://github.com/Thinklab-SJTU/Bench2Drive) README (2025-02-05) calls this metric unpersuasive, and its maintainers stopped reporting it.

## What closed-loop and near-closed-loop evaluations measure

| Evaluation | Can the car leave the log? | Do other vehicles react? | Main metric | Main limits |
| --- | --- | --- | --- | --- |
| nuScenes open loop | No, back to the log every step | Not applicable | L2, collision rate | Mostly straight driving, ego-state shortcut, inconsistent implementations |
| NAVSIM v1 | Only within one 4 s simulation | No | PDMS | Ignores compounding error and other vehicles' reactions |
| NAVSIM v2 | Stage two starts from perturbed start states | No | EPDMS | Start states are precomputed; images come from reconstruction rendering |
| nuPlan | Yes | Yes in CLS-R | CLS-R / CLS-NR / OLS | Inputs are given object states; perception is not tested |
| CARLA / Bench2Drive | Yes, drives the whole route itself | Yes, scripted | Driving score DS, success rate | Images and traffic come from a game engine |
| Learned world models | Yes | Depends on the model | Each company's own | No published fidelity metrics as of 2026-10 |

### NAVSIM: hand over one plan, simulate 4 seconds

[NAVSIM v1](https://arxiv.org/abs/2406.15349) (NeurIPS 2024 Datasets and Benchmarks track) hands the model's plan to an LQR controller, simulates it non-reactively for 4 s in a top-down view, and scores it by rules:

$$
\text{PDMS}=\text{NC}\times\text{DAC}\times\frac{5\,\text{EP}+5\,\text{TTC}+2\,\text{C}}{12}
$$

NC is no at-fault collisions, taking 0, 1/2 or 1; DAC is drivable-area compliance, 0 or 1; EP is ego progress, between 0 and 1; TTC means time-to-collision stays above its bound, and C is comfort, both 0 or 1 ([metrics documentation](https://github.com/autonomousvision/navsim/blob/main/docs/metrics.md)). Work it once: NC = DAC = 1, EP = 0.8, TTC = C = 1 gives PDMS $=(4+5+2)/12\approx0.917$, written 91.7 in papers. If, like candidate A in note 2, the car gets too close to the lead car and TTC = 0, PDMS drops to $(4+0+2)/12=0.5$; if it leaves the road and DAC = 0, it is 0 however good the rest is. The structure matches note 2: hard constraints multiply, soft terms are a weighted average.

PDMS on the paper's navtest split: human 94.8, TransFuser 84.0, UniAD 83.4, an MLP using only the ego state 65.6, constant-velocity extrapolation 20.6. Here the ego-state-only method falls clearly behind, which nuScenes L2 does not show. The paper also states its own limits: it does not simulate other vehicles' reactions, ignores compounding error, has no traffic-light or stop-sign rules, and recommends running CARLA alongside it.

Back to our example: from the logged start, A and B give the very same plan, with a lateral offset of $0.2\times4=0.8$ m after 4 s, so their PDMS is naturally the same. v1 cannot tell them apart either, which is exactly what "ignores compounding error" means.

[NAVSIM v2](https://arxiv.org/abs/2506.04218) (CoRL 2025) runs "pseudo-simulation" in two stages: stage one scores the plan as usual; stage two scores again from a set of precomputed, perturbed start states rendered with 3D Gaussian splatting, weighting each by how close its start is to the stage-one endpoint, and the two stages are multiplied. EPDMS adds driving direction and traffic lights to the multiplied terms, and lane keeping, history comfort and extended comfort to the weighted terms (weights: TTC 5, EP 5, the others 2 each); if the human in the log also violates a term, the model is not penalised on it. The abstract reports an $R^2$ of 0.8 against closed-loop results, versus 0.7 for the best open-loop metric. By this design, if stage two's start states include something like "already 0.8 m left with the nose turned", A keeps drifting while B pulls back, and only then do the lane-keeping and drivable-area terms get a chance to separate them.

### CARLA and Bench2Drive: let the car drive the whole route

The [CARLA Leaderboard 2.0](https://leaderboard.carla.org/evaluation_v2_0/) driving score is route completion times an infraction penalty, multiplying by the matching coefficient for each infraction: pedestrian collision 0.50, vehicle collision 0.60, static collision 0.65, red light 0.70, stop sign 0.80.

$$
\text{DS}=\text{RC}\times\prod_j p_j^{\,n_j}
$$

Work it once: 90% of the route completed, one vehicle collision and one red light, $\text{DS}=90\times0.60\times0.70=37.8$. Another model stops halfway with no infractions, $\text{DS}=50\times1=50$, which is higher. So read DS together with route completion and infraction counts. Version 2.1, from March 2025, changed infraction scoring, so its scores are not directly comparable with 2.0; the CARLA site shows no challenge was held in 2025.

[Bench2Drive](https://arxiv.org/abs/2406.03877) (NeurIPS 2024 Datasets and Benchmarks track) tests closed-loop abilities one by one in CARLA 0.9.15, with 220 routes across 44 scenario types; its dataset is 2 million frames from 13,638 clips. Driving scores collected in the README for v0.0.4: UniAD 38.69, VAD 38.65, TCP 51.44, DriveTransformer 60.20, SimLingo 86.55, LEAD 95.59. This is a table collected by the maintainers, and training setups may differ between methods. Spin-offs such as Bench2Drive-VL, -Speed and -Robust followed.

### Learned simulators

CARLA's images and traffic are, after all, made by a game engine; scenes reconstructed from real logs (3D Gaussian splatting, the [HUGSIM](https://arxiv.org/abs/2412.01718) family) look more real; Waymo argues that pure reconstruction breaks down once the car leaves the logged route (with no quantitative comparison), see [3D reconstruction and neural rendering](../perception/reconstruction.en.md). Generative world models try to solve both at once: the Waymo World Model (2026-02), Wayve GAIA-4 (2026-08), and Tesla's neural world simulator (from auto-captions of its talks). As of 2026-10-15 none has published fidelity metrics compared against real outcomes; what they can do in evaluation, and how policies exploit them, is covered in [world models: robots and driving](../../11-frontier/world-models/robotics-driving.en.md).

## Safety cases: what each standard covers

Evaluation scores answer "how well does it drive"; a safety case answers "why should anyone believe it is safe enough within its operational design domain". The standards below are often mentioned together. ISO standard texts are paid, and the pages also refused our automated fetch, so the ISO and SAE rows are written from the standard titles and their usual positioning, without reading the texts:

| Standard | What it covers | Relation to this note |
| --- | --- | --- |
| ISO 26262 (road vehicles, functional safety; edition 2, 2018) | Hazards caused by malfunctions of electrical and electronic systems | A sensor dies, a chip errs; Tesla said in its CVPR 2026 talk that the network runs as one copy on each of two redundant chips (from auto-captions), which in our reading belongs to this category |
| ISO 21448:2022 (safety of the intended functionality, SOTIF) | Hazards with no broken part, where the function itself is insufficient, or from foreseeable misuse | Policy A is not broken, just under-trained; in our reading it is closer to this category |
| ISO/PAS 8800:2024 (road vehicles, safety and artificial intelligence) | Safety of AI components in road vehicles | An end-to-end network is exactly such a component |
| [UL 4600](https://www.ul.com/news/ul-4600-edition-3-updates-incorporate-autonomous-trucking) (edition 3, 2023-03-17) | Built around a safety case, goal-based and not prescribing specific technology; sets no fixed road-test mileage and calls for a mix of analysis, simulation, closed-course and public-road testing | Tells you what evidence a case needs, not which model to use |
| SAE J3016 | Taxonomy of driving-automation levels 0–5 | Makes clear whether a system is driver assistance or driverless |

End-to-end models make "arguing component by component" harder: there is no module called "perception" that can produce its own test report. Waymo's approach is a separate validation layer on board, with the same base model serving as Driver, Simulator and Critic ([blog](https://waymo.com/blog/2025/12/demonstrably-safe-ai-for-autonomous-driving)); Waymo has also published its safety methodology ([Webb et al. 2020](https://arxiv.org/abs/2011.00054), [Favaro et al. 2023](https://arxiv.org/abs/2306.01917)) and crash-rate comparisons with human driving ([Kusano et al.](https://arxiv.org/abs/2312.12675)). Another approach writes "what counts as safe" as formal rules, for example [RSS](https://arxiv.org/abs/1708.06374).

## As of October 2026: deployment and public evidence

Operating on public roads is the ultimate closed-loop test. Each company's ride counts and city counts are in the [guide](README.en.md); here we list only public evidence that bears on "how it performs in closed loop".

> **As of 2026-10-15 (this changes quickly; check dates before citing)**
>
> - **Waymo's [Safety Impact](https://waymo.com/safety/impact/) (data through 2026-06):** 271.3 million rider-only miles; compared with a human driving benchmark on similar city streets, 95% fewer crashes with serious injury or worse (55 fewer) and 82% fewer injury-causing crashes. This is Waymo's own analysis (vendor-reported), a relative comparison; absolute serious-injury counts are small, and it covers only 5 mature markets. Peer-reviewed papers cited by the page include two by Kusano et al. in *Traffic Injury Prevention* (2024, 2025).
> - **The long tail exposed by recalls:** Waymo recall [26E026](https://static.nhtsa.gov/odi/rcl/2026/RCLRPT-26E026-6527.pdf) (submitted 2026-05-06, 3,791 vehicles): on higher-speed roads, the car may slow but not stop for a flooded lane. Waymo recall 26E035 (2026-06, 3,871 vehicles): it could enter a closed freeway construction zone at speed (reported, read via an [aggregator](https://vehiclesafetyrecalls.com/recall/26E035000) of NHTSA data). Zoox recall [26E044](https://static.nhtsa.gov/odi/rcl/2026/RCLRPT-26E044-2993.pdf) (submitted 2026-07-16, 105 driverless vehicles): at emergency scenes, it may not detect and respond to heavy smoke.
> - **Investigation:** NHTSA opened [PE26001](https://static.nhtsa.gov/odi/inv/2026/INOA-PE26001-10005.pdf) on 2026-01-28 after a Waymo vehicle struck a child near an elementary school in Santa Monica, with minor injuries.
> - **Tesla:** the Q2 2026 shareholder letter marks 6 metros "Ramping Unsupervised", with a safety driver still in the Bay Area; the letter shows Robotaxi miles only as a chart, without numbers.
>
> Flooded lanes, construction zones and smoke are all rare in training logs, and exactly the kind of thing open-loop L2 cannot measure.

## What to check when reading an end-to-end paper

| What to look at first | What you should find | Without it, you can NOT conclude |
| --- | --- | --- |
| Which benchmark and version | NAVSIM v1 or v2, CARLA 2.0 or 2.1 | Scores are comparable across versions |
| An ablation that removes the ego state | How far the score drops without it | The model really uses perception |
| Route completion and infraction counts in closed loop | Reported alongside DS | A high DS means good driving |
| A comparison with rule-based baselines | PDM-Closed, constant-velocity extrapolation | The learned planner is better |
| Whether numbers are self-reported or third-party | An official leaderboard or independent reproduction | The conclusion carries over to other settings |
| Whether training and test cities and routes are separated | An explicit split | It generalises to new cities |

References: [Parting with Misconceptions (PDM)](https://arxiv.org/abs/2306.07962) · [Is Ego Status All You Need](https://arxiv.org/abs/2312.03031) · [NAVSIM](https://arxiv.org/abs/2406.15349) · [NAVSIM v2](https://arxiv.org/abs/2506.04218) · [Bench2Drive](https://arxiv.org/abs/2406.03877) · [GigaFlow](https://arxiv.org/abs/2502.03349) · [DAgger](https://arxiv.org/abs/1011.0686). Previous: [motion forecasting and planning](prediction-planning.en.md); back to the [guide](README.en.md).
