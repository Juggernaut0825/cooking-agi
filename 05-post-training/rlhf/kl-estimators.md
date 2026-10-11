# KL 的三种估计：数值接近，梯度未必相同

**中文** · [English](kl-estimators.en.md)

> 最近审阅：2026-10 · 前置：[Reference 与 Critic](reference-and-critic.md)；推导部分用到期望和对数

训练日志里的 `kl` 有时是负数，有时用了一个保证非负的公式。它们是不是有一个写错了？先别看变量名，先看三件事：**比较哪两个分布、样本来自哪里、这个数只是记录还是参与更新。**

只想看懂日志，可以先读前 3 节。要实现 loss，再读后面的采样与梯度；不用一开始就把所有推导记住。

## 1. 先约定方向，再谈公式 {#direction}

固定一个 prompt 和前缀，设当前策略的下一 token 分布为 $q$，参照分布为 $p$。这里估计的是：

$$
D_{\rm KL}(q\|p)=\mathbb E_{x\sim q}\left[\log\frac{q(x)}{p(x)}\right].
$$

先假设有限词表上两者都严格为正，定义 $r(x)=p(x)/q(x)$。注意比值是 **参照除以当前策略**，不是 PPO 的 current / old。下面的 $k_1,k_2,k_3$ 是常见命名，不同代码库仍可能用别的名字。

| 估计式 | 单个样本能否为负？ | 在 $x\sim q$ 下的期望 |
| --- | --- | --- |
| $k_1=-\log r$ | 能 | 正好是 KL |
| $k_2=\tfrac12(\log r)^2$ | 不能 | 一般有偏；两分布接近时可作局部近似 |
| $k_3=r-1-\log r$ | 不能 | 在上述支持集条件下正好是 KL |

单条样本不是完整分布。$k_1$ 为负，不违反 KL 非负；一批样本的均值也可能因采样波动暂时为负。$k_3$ 非负也不意味着它在每个任务上都方差最小。

## 2. 用两个 token，把数算一遍 {#two-tokens}

设 $q=[0.8,0.2]$，$p=[0.5,0.5]$。这只是为了把整个词表手算完，不代表实际模型只有两个 token。

<div class="worked-table" markdown="1">

| token | $q$ | $k_1$ | $k_2$ | $k_3$ |
| --- | --- | --- | --- | --- |
| A | 0.8 | 0.4700 | 0.1105 | 0.0950 |
| B | 0.2 | −0.9163 | 0.4198 | 0.5837 |

</div>

按采样概率 0.8、0.2 加权，$k_1$ 和 $k_3$ 的期望都是约 0.1927；$k_2$ 约 0.1723。不能把两行直接各算一半——那相当于换了采样分布。

<figure class="worked-update" lang="zh-CN" id="sample-and-mean">
  <figcaption>只看 k₁ · 单条为负，与整体 KL 非负并不矛盾。</figcaption>
  <ol>
    <li><small>抽到 A · 概率 0.8</small><strong>+ 0.4700</strong><span>当前策略比 Reference 更偏向 A。</span></li>
    <li><small>抽到 B · 概率 0.2</small><strong>− 0.9163</strong><span>当前策略给 B 的概率反而更低。</span></li>
    <li><small>按当前策略加权</small><strong>平均 ≈ 0.1927</strong><span>0.8 × 0.4700 + 0.2 × (−0.9163)。</span></li>
  </ol>
</figure>

```python
import math

def kl_sample_terms(log_current, log_reference):
    if not all(math.isfinite(value) and value <= 0
               for value in (log_current, log_reference)):
        raise ValueError("Expected finite log-probabilities no greater than zero")
    log_ratio = log_reference - log_current
    return (-log_ratio, 0.5 * log_ratio ** 2,
            math.expm1(log_ratio) - log_ratio)

current = [0.8, 0.2]
reference = [0.5, 0.5]
terms = [kl_sample_terms(math.log(policy), math.log(anchor))
         for policy, anchor in zip(current, reference)]
means = [math.fsum(probability * row[column]
                   for probability, row in zip(current, terms))
         for column in range(3)]
assert math.isclose(means[0], means[2], abs_tol=1e-12)
print([round(value, 4) for value in means])
```

这是标量核算，不是训练器。`expm1(z)` 在 $z$ 很小时比 `exp(z)-1` 更稳；它不能修复极端比值的溢出。实际训练应记录非有限值、检查采样支持集与精度，不能悄悄 clip 后继续称它为原来的无偏估计。

## 3. 为什么加上 $r-1$，均值却没变？ {#control-variate}

在相同支持集上：

$$
\mathbb E_q[r-1]
=\sum_xq(x)\left(\frac{p(x)}{q(x)}-1\right)
=\sum_xp(x)-\sum_xq(x)=0.
$$

所以 $k_3=k_1+(r-1)$ 加了一个零均值项。这是 control variate 的思路：期望不变，但每次采样的波动可以改变。又因为 $\log r\le r-1$，$k_3$ 逐样本非负。

$k_2$ 的理由不同。令 $z=\log r$，有 $k_3=e^z-1-z=\tfrac12z^2+O(z^3)$；当比值在重要区域接近 1 时，$k_2$ 取了局部二阶项。它不是对任意策略偏移都精确。

**支持集条件不能漏。** 若 $q$ 只保留 A、$p$ 在 A/B 上各有一半概率，$\mathbb E_q[r]=0.5$ 而不是 1。Top-k / top-p 截断后的采样分布，与原始 softmax 不是同一个分布；不能直接把“模型 log-prob”当成“实际采样 log-prob”。

<details markdown="1">
<summary>非负的 k₃，也可能比 k₁ 抖得更厉害</summary>

把当前策略改成 $q=[0.99,0.01]$，参照仍是 $p=[0.5,0.5]$。很少抽到的 B 上，$p/q=50$，所以 $k_3(B)\approx45.0880$；A 上则只有约 0.1881。

| 当前策略 q | 单样本 k₁ 的方差 | 单样本 k₃ 的方差 |
| --- | ---: | ---: |
| `[0.8, 0.2]` | 0.3075 | 0.0382 |
| `[0.99, 0.01]` | 0.2090 | 19.9583 |

这里按 $\sum_xq(x)(k(x)-\mathbb E_q[k])^2$ 精确求和，没有跑采样实验。第二行的两个估计依然都无偏，但 k₃ 会偶尔冒出很大的值。若有 $n$ 个独立同分布样本，样本均值的方差才是这里的方差除以 $n$；序列内 token 通常不能直接当作独立样本。

</details>

## 4. 旧样本会改变估计的含义 {#old-samples}

更新前按旧策略 $\mu$ 采样，更新后重算当前 $q$ 的 log-prob。此时直接平均 $k_3$，得到的是 $\mathbb E_\mu[k_3(q,p)]$，不是自动变成 $D_{\rm KL}(q\|p)$。

固定同一个前缀，若 $\mu$ 覆盖 $q$，可以写成重要性加权：

$$
D_{\rm KL}(q\|p)=\mathbb E_{x\sim\mu}\left[\frac{q(x)}{\mu(x)}k_3(x)\right].
$$

仍用上面的两个分布，若旧策略各采一半，直接均值约为 0.3394；乘上 $q/\mu=[1.6,0.4]$ 后，期望才回到约 0.1927。权重校正也可能增大方差，剪裁以后又换了估计量。

这里仅校正**给定前缀下的动作分布**。如果前缀也来自旧策略，仅补当前 token 的比值不会同时修好整条轨迹的状态分布。

## 5. 无偏的数值，不自动给出无偏的梯度 {#gradients}

若只是监控 KL，通常不需要反传。若把它放进 loss，就要继续问：采样分布是否依赖参数，哪些量被 detach？

对于 $q=q_\theta$、固定 $p$：

$$
\nabla_\theta\mathbb E_{x\sim q_\theta}[k_3(x,\theta)]
=\mathbb E_q\left[\nabla_\theta k_3+k_3\nabla_\theta\log q_\theta(x)\right].
$$

把采好的 token 固定住，只对 $k_3$ 反传，会漏掉右边第二项。一个能直接验算的反例：$q=[\sigma(\theta),1-\sigma(\theta)]$，$\theta=\log4$，$p=[0.5,0.5]$。真正 KL 的导数约为 **0.2218**；固定采样权重、只对 $k_3$ 求导，其期望却是 **0.3000**。

这不等于所有使用 $k_3$ 的训练都错了。算法可能明确定义一个旧数据上的 surrogate，也可能用重要性权重并保留所需梯度。要看完整目标，不能仅凭“这个 estimator 无偏”判断优化实现。[DeepSeekMath 的 GRPO 公式](https://arxiv.org/html/2402.03300v3#S4.SS1.SSS1)给出了这种非负 KL 项；这里额外拆开的是统计量与更新规则的区别。

<details markdown="1">
<summary>把三个公式都拿来做 loss，会得到什么梯度？</summary>

仍固定一个前缀、相同的有限正支持集，以及不随参数变化的 Reference。令 $s_\theta(x)=\nabla_\theta\log q_\theta(x)$。**样本来自当前策略，但反传时不对抽样操作求导**，三个单样本 loss 的导数分别为：

| 直接对哪一项反传 | 样本梯度 | 上面两 token 例子的梯度期望 |
| --- | --- | ---: |
| $k_1$ | $s_\theta$ | 0 |
| $k_2$ | $\log(q/p)s_\theta$ | 0.2218 |
| $k_3$ | $(1-p/q)s_\theta$ | 0.3000 |

为什么 k₁ 的期望是 0？因为 $\mathbb E_q[s_\theta]=\sum_x\nabla_\theta q_\theta(x)=\nabla_\theta1=0$。而完整 KL 的梯度恰好是 $\mathbb E_q[\log(q/p)s_\theta]$，所以这里 k₂ 的期望梯度与它一致。**k₂ 的数值有偏，梯度却可以对；k₁ 的数值无偏，直接反传却不给出想要的期望梯度。**

[Liu 等（2025），§5 与 Appendix C](https://arxiv.org/html/2510.01555v2)专门区分了这两种用途。这里的结论有 on-policy 和梯度路径的前提，不是让你把训练器里的 k₃ 一律换成 k₂。旧 rollout、clipping、prefix 分布和 reward shaping 都要放回完整目标里检查。尤其不能把“直接反传 k₁”和“把 detached k₁ 放进 reward”混为一谈。

下面用有限差分检查这件事。`sampling` 在两次扰动间保持不变；完整 KL 的求和权重则跟着参数变。代码只依赖 Python 标准库，复用前面的 `kl_sample_terms`。

```python
def binary_policy(parameter):
    positive = 1 / (1 + math.exp(-parameter))
    return [positive, 1 - positive]

def kl_objectives(parameter, sampling):
    policy = binary_policy(parameter)
    rows = [kl_sample_terms(math.log(value), math.log(0.5))
            for value in policy]
    exact = sum(value * math.log(value / 0.5) for value in policy)
    fixed = [sum(weight * row[column] for weight, row in zip(sampling, rows))
             for column in range(3)]
    return [exact, *fixed]

parameter = math.log(4)
sampling = binary_policy(parameter)
step = 1e-5
upper = kl_objectives(parameter + step, sampling)
lower = kl_objectives(parameter - step, sampling)
derivatives = [(high - low) / (2 * step) for high, low in zip(upper, lower)]
assert math.isclose(derivatives[0], derivatives[2], abs_tol=1e-8)
print([round(value, 4) for value in derivatives])
```

依次输出完整 KL、固定样本 k₁ / k₂ / k₃ 的导数：`[0.2218, 0.0, 0.2218, 0.3]`（浮点误差可能显示 `-0.0`）。有限 batch 的梯度还会有采样噪声，这里算的是期望，不是一次真实模型更新。

</details>

## 6. 放回训练代码，要检查什么？ {#implementation}

| 检查 | 具体问法 |
| --- | --- |
| 方向与采样 | 当前 / 参照 / old 各是谁？温度与截断是否已计入实际行为分布？ |
| 有效位置 | 只算回答 token？EOS 算不算？Padding 在统计前有没有排除？ |
| 单位 | 每个 token 平均，还是每条回答求和？长度变化会怎样影响曲线？ |
| 用途 | 监控、reward shaping，还是可微正则？Detach 在哪里？ |
| 数值 | 相同分布应为零；小偏移、极端比值和零支持都测过吗？ |

完整序列 KL 可以按链式法则拆成沿当前策略前缀分布的条件 KL 之和。任意 token 均值、旧前缀上的均值，与这个序列量不是同一个定义。

第一次实现，先用这个两 token 例子做精确求和，再去看大词表的采样曲线。比看到一个 `kl` 数字就猜“模型是不是跑偏了”可靠得多。
