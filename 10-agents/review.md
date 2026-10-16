# Agents：复习题

**中文** · [English](review.en.md)

> 阅读时间：约 3 分钟 · 难度：进阶 · 最近审阅：2026-10

## 面试常见问题

<details class="interview" markdown="1">
<summary>Workflow 和 agent 有什么区别？什么时候不该用 agent？</summary>

workflow 用事先写好的代码路径串起模型和工具；agent 让模型自己决定流程和工具。步骤能事先列出来、没有验证信号、或者做错一步代价很高（发送、付款、删除）时，都不该直接用 agent：先写成 workflow，或者在关键步骤加人工确认。

</details>

<details class="interview" markdown="1">
<summary>一个 agent 由哪几部分组成？</summary>

模型（决定下一步）、工具（对外界动手）、循环（结果回到模型）、停止条件（做完或预算用完），再加上存放中间状态的上下文或记忆。ReAct 的「想一步、做一步」是这个循环最常见的形式。

</details>

<details class="interview" markdown="1">
<summary>为什么写代码是 agent 最成熟的场景之一？</summary>

因为不少编程步骤能得到编译器、测试和静态检查的可重复反馈，适合在受限环境里迭代；这不是说每一步都有完整的正确性判据。测试通过后仍要查需求、安全和 diff，沙箱也要限制凭据与网络。客服和个人助理同样可以检查部分状态与规则，但开放式结果往往还需要人工判断。

</details>

<details class="interview" markdown="1">
<summary>怎么评估一个客服 agent 的可靠性？</summary>

不能只看单次成功率，要看同一个任务独立重复多次是否全都做对，比如 τ-bench 的 pass^k（k 次全部成功的概率）。还要检查是否遵守政策、工具调用是否正确、复杂情况有没有转人工，并看完整的运行轨迹而不只是最终回答。

</details>

<details class="interview" markdown="1">
<summary>什么时候用 frontier API，什么时候自己 serve 开源模型？</summary>

先看能力：在自己的评估集上开源模型不达标，就用 frontier。数据有严格边界时，先核对 API 的地域、保留策略、合同和私有连接能否满足，满足不了再考虑自部署。流量大且稳定、已有闲置算力或需要深度定制时，自部署可能更划算、更可控，但要把闲置容量、运维和维护时间一起算；没有通用的流量界线。量小或不确定时，先用 API 把质量和成本测出来。实际上常常混用：路由、级联、蒸馏、兜底。

</details>

<details class="interview" markdown="1">
<summary>为什么单步准确率上的小差距，在 agent 里会被放大？</summary>

若各步独立、任何一步出错都无法恢复，错误会沿步骤累积：每步 95% 做对，20 步全对只有约 36%；每步 99% 做对，约 82%。真实任务里错误会相关，也可能重试或恢复，所以这道乘法只是提醒：要做端到端评估，并记录失败发生在哪一步。

</details>

<details class="interview" markdown="1">
<summary>什么是 reward hacking？举两个例子。</summary>

模型优化的是你实际给的奖励，而不是你心里想要的目标，两者一有偏差，它就会钻空子。OpenAI 的划船游戏里，奖励是沿途的道具，agent 就原地转圈刷道具，比跑完比赛得分还高。LLM 里也一样：拿「测试通过」当奖励，agent 可能去改测试；RLHF 里奖励模型偏爱长回答或附和用户，策略模型就会学着写得更长、更会讨好。

</details>

<details class="interview" markdown="1">
<summary>级联和路由都是在小模型和 frontier 模型之间分配请求，区别在哪？</summary>

级联先让小模型回答，再由检查器决定是否升级；多看了答案不保证判断更准，检查器也可能被流畅的错误答案骗过。请求前路由则只用生成前的信息选模型。按一次升级、无重试的简化设置，级联成本是 $C_A+v+uC_B$，路由成本是 $r+(1-u)C_A+uC_B$，其中 $u$ 是交给 B 的比例，$v$、$r$ 分别是检查和路由成本；两种方案的 $u$ 未必相同。升级会增加串行等待，路由也有误派与补救成本。质量和端到端延迟都要实测，不能由结构名保证。见[四条请求的算例](model-choice.md#routing-example)。

</details>

## 自检

<div class="taste-check">
  <strong>如果真的理解了，你应该能解释：</strong>
  <ol>
    <li>workflow 和 agent 的分界线在哪里，各自的代价是什么？</li>
    <li>为什么「有没有验证信号」是判断一个场景适不适合 agent 的关键？</li>
    <li>一个会读网页的 agent，为什么要把网页内容当数据而不是指令？</li>
    <li>自己 serve 的成本为什么有一块固定的底？什么情况下它会比 API 便宜？</li>
    <li>除了成本，还有哪些因素会决定用 frontier API 还是开源模型？</li>
  </ol>
</div>

## 参考资料

- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)：workflow 与 agent 的区分和常见结构
- [ReAct](https://arxiv.org/abs/2210.03629)：推理与行动交替
- [SWE-bench](https://arxiv.org/abs/2310.06770)：用真实 issue 评估代码修改；Verified 的评分缺陷、污染问题和 OpenAI 转向推荐 Pro 的出处，见[不同场景怎么评估](scenarios.md)
- [τ-bench](https://arxiv.org/abs/2406.12045)：带政策约束的工具与对话，以及 pass^k；后续的 [τ²-bench](https://arxiv.org/abs/2506.07982) 加入用户也要动手的 dual control，仓库截至 2026-10 已发布 τ³-bench
- [WebArena](https://arxiv.org/abs/2307.13854)
- [OSWorld](https://arxiv.org/abs/2404.07972)
- [Not what you've signed up for](https://arxiv.org/abs/2302.12173)：indirect prompt injection
- [FrugalGPT](https://arxiv.org/abs/2305.05176)：模型级联
- [RouteLLM](https://arxiv.org/abs/2406.18665)：强弱模型之间的路由
- [vLLM / PagedAttention](https://arxiv.org/abs/2309.06180)
- [SGLang](https://arxiv.org/abs/2312.07104)
