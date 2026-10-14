# Pointers, windows, and binary search: justify the move

[中文](pointers-and-search.md) · **English** · [Pattern map](../leetcode.en.md)

> Reading time: ~12 min · Last reviewed: 2026-10

The code for these problems is often short. The harder question is why moving one boundary is safe: what have we ruled out, and could the move skip an answer? A short trace makes the boundary rules easier to understand than memorizing them in isolation.

## 1. Two pointers: order eliminates combinations

Find two values in the sorted array `[1, 3, 5, 8, 12]` that sum to 11. Trying every pair works, but sorted order lets us eliminate several pairs at once. Start `left` and `right` at opposite ends:

| Current pair | Sum | Why the next move is safe |
| --- | --- | --- |
| 1 and 12 | 13, too large | 1 is the smallest remaining value. Every other partner makes the sum larger, so discard 12 |
| 1 and 8 | 9, too small | 8 is the largest remaining value. Every other partner makes the sum smaller, so discard 1 |
| 3 and 8 | 11 | Return their positions |

<!-- widget:algo-two-pointers -->

Each move eliminates an endpoint that **cannot belong to a remaining solution**. Sorted order is what makes that argument work.

```python
def sorted_pair(values, target):
    left, right = 0, len(values) - 1
    while left < right:
        total = values[left] + values[right]
        if total == target:
            return [left, right]
        if total < target:
            left += 1
        else:
            right -= 1
    return None
```

The result is `[1, 3]`, using zero-based indices. Together the pointers make at most n−1 inward moves: O(n) time and O(1) auxiliary space. This doesn't work directly on unsorted input. Sorting also requires preserving original positions if the problem asks for them; a [hash map](hash-and-prefix.en.md) is another option.

Two pointers don't have to start at opposite ends. For in-place deduplication, **read/write pointers** scan the input and track where to write the next retained value. In `[1, 1, 3]`, skip writing the second 1, then write 3 at index 1. Only the first two entries, `[1, 3]`, belong to the result; stale values beyond them don't matter.

## 2. Sliding windows: maintain a valid interval

A substring must be contiguous: we cannot skip a character in the middle. To find the longest substring without repeats, let `[left, right]` be the current window and keep its characters in a set. Trace `"abba"`:

| New character | What changes | Valid window afterward | Best length |
| --- | --- | --- | --- |
| a at index 0 | No duplicate; add it | `a` | 1 |
| b at index 1 | Still unique; extend | `ab` | 2 |
| b at index 2 | Remove a; b still repeats. Remove the old b too | `b` | 2 |
| a at index 3 | No a in the current window; add it | `ba` | 2 |

<!-- widget:algo-sliding-window -->

We don't clear the whole window when a duplicate appears. Remove characters from the left only until the new character can be added safely. What remains is the **longest valid substring ending at this position**.

```python
def longest_unique_window(text):
    window = set()
    left = best = 0
    for right, character in enumerate(text):
        while character in window:
            window.remove(text[left])
            left += 1
        window.add(character)
        best = max(best, right - left + 1)
    return best
```

The `while` matters: removing one character may not be enough. Update the answer only after restoring uniqueness. Assuming average O(1) set operations, each boundary traverses the input once, giving average O(n) time and O(min(n, alphabet size)) auxiliary space.

When explaining this aloud, state the condition the window maintains instead of reading every line:

> I maintain a sliding window with no repeated characters. If the next character is already in the window, I move the left boundary until that duplicate is removed, then add the new character. Each character is added and removed at most once, so the algorithm takes O(n) time on average, assuming average O(1) set operations.

“No repeated characters” is the invariant here. Keep the average-time assumption for set operations in the complexity explanation.

### Replace repeated removals with one jump

The first version is already sufficient. If we also remember each character's last position, we can jump directly past the previous occurrence:

```python
def longest_unique(text):
    last_seen = {}
    left = best = 0
    for right, character in enumerate(text):
        left = max(left, last_seen.get(character, -1) + 1)
        last_seen[character] = right
        best = max(best, right - left + 1)
    return best
```

`last_seen` covers the entire processed prefix, not just the current window. At the final a, its previous occurrence at index 0 is already outside the window: `left` is 2. Moving back to 1 would incorrectly count `"bba"`. The `max` prevents that backward move.

Both versions have the same asymptotic time and space bounds. The first exposes the shrinking process; the second uses a saved position to skip the individual removals. Understanding the first makes the `max` in the second much less mysterious.

## 3. Not every subarray problem supports a window

Now change the goal: find the shortest contiguous subarray of positive values `[2, 1, 4, 3]` whose sum is at least 7.

- Extending to `[2, 1, 4]` gives 7. Record length 3. Removing 2 leaves 5, so stop shrinking for now.
- Add 3: `[1, 4, 3]` sums to 8. Remove 1 and `[4, 3]` still sums to 7, improving the answer to 2.
- Removing 4 leaves 3, so stop shrinking again.

Here we **record an answer while the window satisfies the requirement, then try shortening it**. In the unique-substring problem, we first removed duplicates and then recorded a valid length. Answer-update timing follows the question, not a universal template.

Stopping is safe here because every value is positive: removing more values can only decrease the sum. For `[1, -1, 3]`, the total is 3. Removing 1 lowers it to 2, but removing −1 raises it back to 3. Stopping as soon as the sum falls below the target misses the one-element `[3]`.

Negative values don't rule out every window algorithm; they invalidate this particular expand/shrink argument. [Prefix sums plus a map](hash-and-prefix.en.md) handle counting signed subarrays with an exact sum, but that is a counting problem, not automatically a solution to the shortest-length problem.

## 4. Binary search: define the boundaries first

Binary search can find a boundary, not just an equal value. Here we want the first position `>= target` in an ascending array, returning n if no such element exists: the insertion position at the end.

Everything before `left` is known to be smaller than the target. All existing elements at or beyond `right` are at least the target. The elements in `[left, right)` remain unresolved. **The answer may equal `right`, including n; it need not be an element still inside the half-open interval.**

Find the first position at least 3 in `[1, 3, 3, 7, 9]`:

| left / right | Middle position and value | What we now know |
| --- | --- | --- |
| 0 / 5 | Index 2, value 3 | It qualifies, but an earlier position may qualify too. Set `right = 2` |
| 0 / 2 | Index 1, value 3 | Keep looking left: `right = 1` |
| 0 / 1 | Index 0, value 1 | Too small. Exclude it: `left = 1` |

<!-- widget:algo-binary-search -->

The boundaries meet at 1. The updates are intentionally asymmetric: `middle` may be the answer when its value qualifies, but is definitely too early when its value is too small.

```python
def lower_bound(values, target):
    left, right = 0, len(values)
    while left < right:
        middle = (left + right) // 2
        if values[middle] < target:
            left = middle + 1
        else:
            right = middle
    return left
```

For `[1, 2, 2, 5]`, target 2 returns 1; target 6 returns 4. O(log n) time, O(1) space. To test existence, also check `index < len(values)` and `values[index] == target`. The library equivalent is [bisect_left](https://docs.python.org/3/library/bisect.html).

“Binary search on the answer” uses the same idea: if feasibility holds for a capacity and every larger capacity, search for the first feasible one. Time is **predicate cost × number of search steps**, not automatically O(log n).

## 5. A few problems, many changed conditions

| Practice | Focus |
| --- | --- |
| [Two Sum II](https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/) | Justify discarding an endpoint; the problem returns one-based indices |
| [Longest Substring Without Repeating Characters](https://leetcode.com/problems/longest-substring-without-repeating-characters/) | Never move left backward |
| [Minimum Size Subarray Sum](https://leetcode.com/problems/minimum-size-subarray-sum/) | Positive-input assumption and answer-update timing |
| [Search Insert Position](https://leetcode.com/problems/search-insert-position/) | Empty intervals, duplicates, past-the-end results |

<details class="interview" markdown="1">
<summary>Why can a window with an inner while loop still take O(n)?</summary>

Each element enters and leaves at most once. This assumes O(1) bookkeeping per change; rescanning the window invalidates the argument.

</details>

<details class="interview" markdown="1">
<summary>Is “binary search requires a sorted array” the whole story?</summary>

No. It needs a monotone predicate separating false from true. A sorted array is just the familiar case.

</details>

## 6. Further explanations

- [EndlessCheng's videos and practice index](https://github.com/EndlessCheng/codeforces-go/blob/master/leetcode/README.md) (Chinese): follow the two-pointer, sliding-window, or binary-search lesson as needed rather than treating the whole list as required work.
- [labuladong's sliding-window explanation](https://labuladong.online/zh/algo/essential-technique/sliding-window-framework/) (Chinese): another treatment of expansion, shrinking, and answer updates. Some examples are harder; the unique-substring problem is enough to start.
- [Hello Algo: binary search](https://www.hello-algo.com/chapter_searching/binary_search/) (Chinese, with an English edition available): diagrams compare interval conventions. This note deliberately sticks to one convention so its boundary rules stay consistent.
