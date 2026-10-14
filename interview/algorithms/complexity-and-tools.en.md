# Complexity and Python: know what the tool does

[中文](complexity-and-tools.md) · **English** · [Pattern map](../leetcode.en.md)

> Reading time: ~9 min · Last reviewed: 2026-10

Choosing the right container usually helps more than shortening a line. Are you looking something up, counting, processing in order, or repeatedly extracting a minimum?

## 1. Complexity isn't a count of loops

A `while` inside a `for` isn't automatically O(n²). If both pointers only advance, each moves at most n times: O(n) overall. Conversely, one loop copying `values[:index]` each time copies 0, 1, …, n−1 elements in turn, O(n²) in total.

We assume constant-cost integer operations and comparisons. Very large integers, long strings, and tuple keys require accounting for arithmetic, comparison, and hashing lengths.

| Shape | Time | Reason |
| --- | --- | --- |
| One scan | O(n) | Constant work per element |
| Halve the range | O(log n) | n → n/2 → n/4 |
| Sort | O(n log n) worst case | One function call isn't constant work |
| All pairs | O(n²) | About n(n−1)/2 pairs |
| Produce and copy every subset | O(n·2ⁿ) | Count and total length of outputs matter |

## 2. Average and amortized are different

- **Average / expected:** `dict` lookup is usually O(1) under hashing assumptions. Extreme collisions can make it O(n).
- **Amortized:** an individual `list.append` can trigger an expensive resize, but a long sequence costs O(1) per append amortized.

Consider a toy dynamic array that doubles its capacity when full: 1, 2, 4, 8. Count one operation to write a new element and one for each existing element copied during a resize.

<div class="worked-table" markdown="1">

| Append number | Capacity afterward | Existing elements copied | Cost of this append |
| --- | --- | --- | --- |
| 1 | 1 | 0 | 1 |
| 2 | 2 | 1 | 2 |
| 3 | 4 | 2 | 3 |
| 4 | 4 | 0 | 1 |
| 5 | 8 | 4 | 5 |
| 6–8 | 8 | 0 | 1 each |

</div>

<!-- widget:algo-append -->

The fifth append is expensive, but all eight together cost just 15 operations. As the array grows, copying costs $1+2+4+\cdots$; including new writes, the total remains O(n). **Amortized analysis needs no random-input assumption and isn't an average of benchmark timings.** Doubling is our teaching model, not CPython's actual growth schedule.

<details markdown="1">
<summary>Check the counts in a few lines of Python</summary>

`count` is a nonnegative integer. This counts toy operations, not Python execution time.

```python
def doubling_append_costs(count):
    capacity = 0
    costs = []
    for size in range(count):
        cost = 1
        if size == capacity:
            cost += size
            capacity = max(1, capacity * 2)
        costs.append(cost)
    return costs


assert doubling_append_costs(8) == [1, 2, 3, 1, 5, 1, 1, 1]
assert sum(doubling_append_costs(8)) == 15
```

For any n > 0, fewer than 2n elements have been copied. Add n writes, and the total is below 3n, even though one append can still copy O(n) elements.

</details>

A hash table's usual O(1) lookup relies on assumptions about hash distribution instead: many colliding keys can make lookup slow. Resizing the table also has an amortized cost, but that is a separate argument, not a guarantee of fast individual lookups.

Normally exclude input space, include extra containers and recursion frames, and report output storage separately when it dominates.

## 3. Container cheat sheet

| Tool | Operations | Cost and limits |
| --- | --- | --- |
| `list` | `append` / `pop()` / `[-1]` | Amortized O(1) append and tail removal; O(1) indexing |
| `list` | `pop(0)` / `insert(0, x)` / membership | O(n); avoid it as a BFS queue |
| `dict` / `set` | Lookup, insertion, deletion | Usually average O(1); a set loses counts |
| `deque` | `append` / `popleft` | O(1) at the ends; middle indexing isn't O(1) |
| `heapq` | `heappush` / `heappop` | O(log n); minimum at `heap[0]` in O(1) |
| `heapq` | `heapify` | O(n), unlike n separate pushes |
| `bisect` | `bisect_left` / `bisect_right` | O(log n) search, but list insertion remains O(n) |

These bounds describe usual Python implementations with the assumptions above. Official APIs: [dict / set](https://docs.python.org/3/library/stdtypes.html#mapping-types-dict), [deque / Counter](https://docs.python.org/3/library/collections.html), [heapq](https://docs.python.org/3/library/heapq.html), [bisect](https://docs.python.org/3/library/bisect.html).

Tail `pop()` needn't shift later elements, but can occasionally shrink the backing array. That's why it is also marked amortized: see [CPython 3.12's `list_pop_impl` and `list_resize`](https://github.com/python/cpython/blob/v3.12.0/Objects/listobject.c). The usual cheap operation isn't a fixed-latency guarantee.

<details markdown="1">
<summary>Why is heapify O(n), rather than O(n log n)?</summary>

Bottom-up heap construction starts near the leaves, where most nodes cannot move log n levels. In a perfect binary tree with 15 nodes, 8 leaves need no sifting; 4 nodes can move at most 1 level, 2 at most 2, and the root at most 3. That's at most $4\times1+2\times2+1\times3=11$ level moves, with constant comparisons per level.

For a general heap, total work is bounded by a constant times $n\sum_{h\geq1}h/2^{h+1}$, which is O(n). Repeated `heappush` is a different process: every new element starts at the bottom and may climb to the root, giving O(n log n) worst-case total work. Use `heapify` when you already have the full collection; push individually when items arrive over time.

</details>

## 4. Functions you'll actually use

```python
from collections import Counter, defaultdict, deque
from bisect import bisect_left, bisect_right
import heapq

counts = Counter("banana")
groups = defaultdict(list)
groups["fruit"].append("pear")
queue = deque(["start"])
queue.append("next")
first = queue.popleft()
values = [1, 2, 2, 5]
left = bisect_left(values, 2)
right = bisect_right(values, 2)
heap = [5, 1, 3]
heapq.heapify(heap)
smallest = heapq.heappop(heap)
```

Results: `counts['a'] == 3`, `first == 'start'`, `left == 1`, `right == 3`. The count of 2 is `right-left == 2`; `smallest == 1`.

`enumerate(values)` supplies index and value; `zip(first, second)` stops at the shorter input by default; `sorted(values, key=...)` returns a new list; `values.sort()` mutates and returns `None`. Negating numeric priorities gives a max-heap on older Python versions. Python 3.14 also exposes [`heapify_max`, `heappush_max`, and `heappop_max`](https://docs.python.org/3.14/library/heapq.html#heapq.heapify_max); check the runtime first.

## 5. Recursion, slices, and outputs use space too

A tree shaped like a chain can need n recursive frames even without an explicit list: O(n) stack space. Only a balanced binary tree guarantees O(log n) height.

`values[left:right]` copies that slice; `''.join(parts)` allocates the output string. “In place” doesn't always mean O(1) auxiliary space: sorting may still use temporary storage internally.

## 6. Close the notes and try

<details class="interview" markdown="1">
<summary>Why can nested loops with advancing pointers take O(n)?</summary>

Count movements over the entire run. Each pointer advances at most n times. With O(1) updates, the total is O(n). Copying or summing each window adds work and changes that conclusion.

</details>

<details class="interview" markdown="1">
<summary>If bisect finds a position in O(log n), why isn't a sorted-list insertion O(log n)?</summary>

Finding a position and moving elements are separate costs. Inserting in the middle shifts the tail, taking O(n) in the worst case.

</details>

Next: [Hash maps: what should you remember?](hash-and-prefix.en.md).
