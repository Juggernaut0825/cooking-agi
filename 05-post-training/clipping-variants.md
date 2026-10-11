# 同样是 clipping，为什么梯度不一样？

**中文** · [English](clipping-variants.en.md)

> 最近核对：2026-10-10 · 进阶阅读 · 先读：[PPO clipping](rlhf/ppo-clipping.md)

一个 token 的概率已经涨了不少，下一次更新还要不要继续推它？不同方法的答案并不相同：有的停下来，有的仍然更新、只是限制权重，还有的逐渐减弱影响。

只想先分清区别，读前面的表和三个例子就够了。公式与 CPU 检查可以按需展开。这里讨论策略更新中的 clipping，不是图文模型 CLIP，也不是 gradient clipping。

## 先看裁剪发生在哪儿 {#where-to-clip}

固定一条已采样回答和它的前缀，令 $\rho=\pi_\theta(a\mid s)/\pi_b(a\mid s)$。$\pi_b$ 是生成数据的 behavior policy，不是 Reference；advantage $A$ 在本次求导中固定。

| 方法 | 主要改哪里 | 读代码时看什么 |
| --- | --- | --- |
| PPO / 常见 GRPO | 沿 advantage 方向走得够远后，截平这一项 | `min` 选中了哪条分支 |
| DAPO 的 Clip-Higher | 分别设置上下阈值 | 不是同时放宽两边 |
| Dual-clip PPO | 再限制负 advantage 的极端惩罚 | 第二个 `max` 只用于 $A<0$ |
| CISPO | 限制乘在 log-prob 前的权重 | 权重要 `detach`，log-prob 不能断梯度 |
| SAPO | 平滑地减弱远离当前采样策略的更新 | 求导后的权重，不只是目标函数值 |
| GSPO | 先汇总成回答级比值，再裁剪 | mask、长度归一化和裁剪粒度 |

[DAPO](dapo.md)和 [GSPO](policy-ratios.md)已有完整小例子。这里补另外三个容易混淆的做法；它们不是必须依次学会、依次替换的升级路线。

## Dual-clip：降低概率，也别一次推得太猛 {#dual-clip}

假设旧策略给某个动作 2% 的概率，当前策略给 10%，所以 $\rho=5$；它的 $A=-1$。普通 PPO 仍保留 $-5$ 这一项，要把升高的概率压下去。比值很大时，这个纠正也可能很大。

[Dual-clip PPO 原论文的算法部分](https://arxiv.org/html/1912.09729v3)再给负 advantage 的目标加一个下限。取演示值 $c=3$，目标从 $-5$ 变成 $\max(-5,-3)=-3$；此时这一项进入平坦区。$A>0$ 时不加这层限制。

<details markdown="1">
<summary>为什么是 max，不是再取一次 min？</summary>

先记普通 PPO 的最大化目标为 $J_{\rm PPO}$，则：

$$
J_{\rm dual}=\begin{cases}
\max(J_{\rm PPO},cA),&A<0,\\
J_{\rm PPO},&A\geq0,
\end{cases}\qquad c>1.
$$

$A$ 为负，$cA$ 也是负数。取 `max` 是不让目标继续向负无穷掉；写成 `min` 反而没有达到这个目的。代码最小化 $-J$ 时，符号与选择操作也要一起换。

</details>

它处理的是一种极端权重，不会修复错误 reward 或无限陈旧的数据。论文场景是游戏中的分布式 RL；不能把该场景的效果直接当成语言模型上的保证。

## CISPO：权重到顶了，梯度还能继续走 {#cispo}

仍用一个 token。旧概率 0.5、当前概率 0.7，$\rho=1.4$，$A=1$。PPO 上界设为 1.2 时，这一项已经平了。[MiniMax-M1 §3.1](https://arxiv.org/html/2506.13585v1#S3.SS1)的 CISPO 则把裁剪后的比值当作固定权重，再乘当前 log-prob。

为便于对比，**我们自选上界 1.2，并且不设有效下界**。本例对当前 log-prob 的目标梯度仍是 $+1.2$，而不是 0：涨得再多，权重不再跟着增大，但更新没有因为越过这条线就停止。

<details markdown="1">
<summary>detach 到底放在哪里？</summary>

$$
J_{\rm CISPO}=\operatorname{sg}(\hat\rho)A\log\pi_\theta(a\mid s),
\qquad
\hat\rho=\operatorname{clip}(\rho,0,1.2).
$$

所以 $\partial J/\partial\log\pi_\theta=\hat\rho A$。`sg` 表示 stop-gradient；不是把整个乘积都 detach。没有这一步，未达上界时还会多出权重自身的导数。不能用“前向数值看着一样”来验证实现。

</details>

这是局部目标，不是完整 CISPO trainer。原文还采用组相对 advantage 和有效 token 聚合。裁剪改变了权重；这里也没有补偿完整的前缀分布变化，不能称为无偏的整条轨迹 IS。$A=0$、action mask 或数值下溢仍可能让梯度为零，“不因越界丢掉 token”不等于“每个 token 永远有信号”。

## SAPO：不突然关掉，而是逐渐减弱 {#sapo}

这里的 SAPO 指 [Soft Adaptive Policy Optimization v2](https://arxiv.org/html/2511.20347v2#S3)。它使用平滑函数替代硬裁剪，并允许正负 advantage 使用不同的 $\tau$。这个 $\tau$ 控制更新衰减的快慢，**不是生成时的采样温度**。

<details markdown="1">
<summary>目标函数与真正的梯度权重</summary>

令 $p=\sigma(\tau(\rho-1))$，单项最大化目标和梯度为：

$$
J_{\rm SAPO}=\frac{4}{\tau}pA,
\qquad
\frac{\partial J}{\partial\log\pi_\theta}
=\underbrace{4p(1-p)}_{w(\rho)}\rho A.
$$

$w$ 在 $\rho=1$ 时等于 1；偏离时减小。**$w$ 和完整系数 $w\rho A$ 不是一回事**：前者不超过 1，不代表后者的绝对值也不超过 1。近似的序列级解释有额外假设，不能把这个逐 token 公式直接说成 GSPO。

</details>

取教学参数 $\tau=2$、$A=1$：$\rho=1$ 时，目标对 log-prob 的梯度是 1；$\rho=1.4$ 时约为 1.1979。它相对未衰减的 1.4 变弱了，但没有在 1.2 处突然变成零。极端比值下，浮点 sigmoid 仍可能饱和；“平滑”不保证永远有可用梯度，也不是严格的 KL 约束。

## 用同一个输入检查梯度 {#gradient-check}

下面比较的是**最大化目标对选中 log-prob 的局部导数**。最小化 loss 时取负号；之后还要反传过 log-softmax 和整个模型。不同方法的原始 loss 值不能当作一把质量尺子。

| 固定 $A=1,\rho=1.4$ | 局部导数 |
| --- | --- |
| PPO，上界 1.2 | 0 |
| Dual-clip，$c=3$ | 0，正 advantage 分支没变 |
| CISPO，上界 1.2 | 1.2 |
| SAPO，$\tau=2$ | 约 1.1979 |

<details markdown="1">
<summary>在 CPU 上运行这个对照</summary>

示例假设输入是同形状的有限数值，省略 mask、归约、KL、rollout 和优化器；函数本身没有做完整的输入检查，不是可直接投入训练的 loss API。比值取温和范围，避免把指数溢出混入这次机制演示。

```python
import math
import torch

def local_surrogates(log_prob, old_log_prob, advantage):
    fixed_advantage = advantage.detach()
    ratio = (log_prob - old_log_prob.detach()).exp()
    ordinary = torch.minimum(
        ratio * fixed_advantage,
        ratio.clamp(0.8, 1.2) * fixed_advantage,
    )
    dual = torch.where(
        fixed_advantage < 0,
        torch.maximum(ordinary, 3.0 * fixed_advantage),
        ordinary,
    )
    capped_weight = ratio.clamp(0.0, 1.2).detach()
    smooth = 2.0 * torch.sigmoid(2.0 * (ratio - 1.0))
    return {
        "ppo": ordinary,
        "dual": dual,
        "cispo": capped_weight * fixed_advantage * log_prob,
        "sapo": smooth * fixed_advantage,
    }

current = torch.tensor(math.log(0.7), dtype=torch.float64, requires_grad=True)
old = torch.tensor(math.log(0.5), dtype=torch.float64)
advantage = torch.tensor(1.0, dtype=torch.float64)
terms = local_surrogates(current, old, advantage)
derivatives = {
    name: torch.autograd.grad(term, current, retain_graph=True)[0].item()
    for name, term in terms.items()
}
assert derivatives["ppo"] == derivatives["dual"] == 0
assert math.isclose(derivatives["cispo"], 1.2)
assert math.isclose(derivatives["sapo"], 1.197894300513649, rel_tol=1e-12)
```

想试负 advantage，就把当前概率改为 0.1、旧概率改为 0.02、优势改为 −1，并去掉针对上一组数字的三个断言。PPO 和 Dual-clip 的目标分别为 −5、−3；对当前 log-prob 的导数分别为 −5、0。自动化测试另覆盖两种符号、零 advantage、多个比值和断梯度位置。

</details>

## 换算法前，先记下这些数 {#diagnostics}

- 正负 advantage 分开看：哪一边的 ratio 尾部更长？哪些位置真正进入平坦区？
- 除了“是否被 clip”，记录更新系数的分布。CISPO 的权重到顶比例，不等于 PPO 的零梯度比例。
- 保持数据、生成预算、mask、loss reduction 和评估一致。一次同时改五个开关，很难解释改善来自哪儿。
- 同时查 reward、长度、KL 和失败样本。训练曲线更平滑，并不等于答案更可靠。

本页只验证局部公式与 CPU 梯度，不报告模型效果或 GPU 吞吐。继续看[异步轨迹的旧数据问题](async-policy-learning.md)，或回到[后训练总览](README.md)选择自己的阅读路线。
