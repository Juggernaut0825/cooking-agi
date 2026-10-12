import math


def q_update(current, reward, next_values, discount, rate, terminated=False):
    if not 0 <= discount <= 1 or not 0 < rate <= 1:
        raise ValueError("Invalid discount or learning rate")
    if not all(math.isfinite(value) for value in (current, reward, *next_values)):
        raise ValueError("Values must be finite")
    if not terminated and not next_values:
        raise ValueError("A nonterminal transition needs next-action values")
    target = reward if terminated else reward + discount * max(next_values)
    return current + rate * (target - current)


def dpo_loss(logp_chosen, logp_rejected, logref_chosen, logref_rejected, beta=1.0):
    values = (logp_chosen, logp_rejected, logref_chosen, logref_rejected, beta)
    if not all(math.isfinite(value) for value in values) or beta <= 0:
        raise ValueError("Use finite log-probabilities and positive beta")
    margin = beta * ((logp_chosen - logref_chosen) - (logp_rejected - logref_rejected))
    if not math.isfinite(margin):
        raise ValueError("Margin overflow")
    return max(0.0, -margin) + math.log1p(math.exp(-abs(margin)))


def clipped_surrogate(ratio, advantage, epsilon=0.2):
    if not all(math.isfinite(value) for value in (ratio, advantage, epsilon)):
        raise ValueError("Use finite values")
    if ratio < 0 or not 0 <= epsilon < 1:
        raise ValueError("Invalid ratio or clipping interval")
    clipped = min(1 + epsilon, max(1 - epsilon, ratio))
    return min(ratio * advantage, clipped * advantage)


def rollout_budget(prompts, group_size, output_length, retained_groups):
    counts = (prompts, group_size, output_length, retained_groups)
    if any(type(count) is not int or count < 0 for count in counts):
        raise ValueError("Counts must be nonnegative integers")
    if group_size == 0 or retained_groups > prompts:
        raise ValueError("Invalid group size or retained group count")
    generated = prompts * group_size * output_length
    retained = retained_groups * group_size * output_length
    return {"generated": generated, "retained": retained, "excluded": generated - retained}


def run_examples():
    print(f"Q nonterminal: {q_update(2, 1, [3, 4], .9, .5):.1f}")
    print(f"Q terminal: {q_update(2, 1, [], .9, .5, True):.1f}")
    print(f"PPO surrogate: {clipped_surrogate(1.3, 2):.1f}")
    print(f"DPO pair: {dpo_loss(math.log(.6), math.log(.4), math.log(.5), math.log(.5)):.4f}")
    print(f"DPO counterexample: {dpo_loss(math.log(.15), math.log(.05), math.log(.2), math.log(.2)):.4f}")
    print(rollout_budget(64, 8, 2048, 16))


if __name__ == "__main__":
    run_examples()
