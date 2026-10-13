# DFS / BFS: recursive or iterative?

[中文](traversal.md) · **English** · [Pattern map](../leetcode.en.md)

> Reading time: ~11 min · Last reviewed: 2026-10

Tree and graph problems often begin with a simple question: which node should we visit next? Depth-first search (DFS) follows one branch before returning; breadth-first search (BFS) visits nodes one step from the start, then two steps away.

Recursion versus iteration is a separate choice. DFS can use recursion or an explicit stack; BFS usually uses a queue. “DFS means recursion, BFS means loops” isn't the definition.

## 1. Walk the same graph first

Start with this small tree, visiting each node's children from left to right:

```text
        A
       / \
      B   C
     / \   \
    D   E   F
```

- DFS: A → B → D. D has no children, so return to B for E. Only after finishing B's branch do we visit C and F. The order is **A B D E C F**.
- BFS: visit A, then B and C on the next level, then D, E, and F. The order is **A B C D E F**.

The first difference comes after B: DFS continues down to D; BFS visits C on B's level first. You can step through the trace below, but the two routes above show the distinction without interacting. “Discovered” means a node has been registered; “processing” means examining its neighbors.

<div class="traversal-lab" data-traversal-lab data-language="en">
<p>Without JavaScript: A connects to B, C; B to D, E; C to F. DFS discovery order is A B D E C F; BFS order is A B C D E F.</p>
</div>

Try the cycle to see `visited` prevent repeated exploration when an edge leads back to a known node. The chain and wide tree compare how much work a stack or queue holds; this is a teaching trace, not a benchmark.

## 2. Recursive DFS: the call stack remembers where to return

An adjacency list maps each node to its neighbors. For the tree above, `graph["A"]` is `["B", "C"]`. Use integer or string nodes; a missing key means no outgoing edges. Each function starts from a valid vertex `start` and explores only the part reachable from it.

```python
def dfs_recursive(graph, start):
    seen = set()
    order = []

    def visit(node):
        seen.add(node)
        order.append(node)
        for neighbor in graph.get(node, []):
            if neighbor not in seen:
                visit(neighbor)

    visit(start)
    return order
```

Calling `visit("B")` pauses A's unfinished call. Only after B, D, and E have been processed does execution return to A and continue with C. The call stack remembers where to resume.

Register a node in `seen` on entry. If B has an edge back to A, it can then skip another call to `visit("A")`. Waiting until an entire branch finishes before marking nodes could allow a cycle to recurse indefinitely.

- **Strength:** tree recursion, postorder aggregation, and backtracking map naturally to function inputs and outputs.
- **Cost:** calls have overhead and Python limits recursion depth. For deep chains, iteration is usually safer than just raising that limit.
- **Tree example:** maximum depth is `1 + max(left depth, right depth)`; an empty tree returns 0. Define the return value before coding.

### Explaining this DFS aloud

Describe what the code does rather than stopping at “I use recursion”:

> I mark a node as visited when I enter it, then recursively visit each unvisited neighbor. The call stack remembers where to resume after each recursive call returns. Marking nodes on entry prevents cycles from causing repeated visits.

For a follow-up about recursion versus iteration:

> I can replace the recursive calls with an explicit stack. That avoids Python's recursion-depth limit, but it doesn't eliminate the memory needed to keep track of pending work.

An **explicit stack** is one you manage yourself; the **call stack** holds function calls. Explain which one remembers where execution paused, rather than only saying that one version uses functions and the other uses a loop.

## 3. Iterative DFS: manage the pending work yourself

For the same tree, use a list as a stack: pop the last node, process it, and push its children. To visit the left child first, push the right child first and the left child second. A stack is last in, first out.

| Just processed | Stack, with the next item on the right | Next action |
| --- | --- | --- |
| A | `[C, B]` | Pop B |
| B | `[C, E, D]` | Pop D |
| D | `[C, E]` | Pop E |
| E | `[C]` | B's branch is complete; move to C |

This suffices for a tree without cycles or shared children. General graphs need duplicate handling. A simple stack that marks nodes on push finds all reachable nodes, but doesn't necessarily produce the same search tree as recursive DFS. Don't substitute it blindly when ancestry or entry/exit timing matters.

<details class="interview" markdown="1">
<summary>Further detail: how can iteration match recursive DFS on a general graph?</summary>

Each stack frame must remember both its node and how far through its neighbors it has reached. That reproduces the pause-and-return behavior of recursion:

```python
def dfs_iterative(graph, start):
    seen = {start}
    order = [start]
    frames = [(start, iter(graph.get(start, [])))]
    while frames:
        node, neighbors = frames[-1]
        neighbor = next(neighbors, None)
        if neighbor is None:
            frames.pop()
        elif neighbor not in seen:
            seen.add(neighbor)
            order.append(neighbor)
            frames.append((neighbor, iter(graph.get(neighbor, []))))
    return order
```

`iter` lets us consume neighbors one at a time; `next(neighbors, None)` returns None when exhausted, so None cannot be a node here. Popping a finished frame returns to the previous level, just like returning from a function.

With the same neighbor order, this preserves recursive DFS discovery order and provides places to add entry/exit operations. It avoids Python's recursion-depth limit, but still needs an explicit stack. Replacing calls with a loop doesn't eliminate that memory.

</details>

## 4. BFS: a queue processes increasing distances

A queue is first in, first out. After A adds B and C, any new nodes B discovers must wait behind C.

| Just processed | Queue, with the next item on the left | Newly discovered distances |
| --- | --- | --- |
| A | `[B, C]` | B and C are 1 step away |
| B | `[C, D, E]` | D and E are 2 steps away |
| C | `[D, E, F]` | F is 2 steps away |

Every node at distance 1 is processed before any node at distance 2. In Python, use `deque.popleft()` for the queue front; repeated list `pop(0)` calls shift the remaining elements.

```python
from collections import deque

def bfs_distances(graph, start):
    distances = {start: 0}
    queue = deque([start])
    while queue:
        node = queue.popleft()
        for neighbor in graph.get(node, []):
            if neighbor not in distances:
                distances[neighbor] = distances[node] + 1
                queue.append(neighbor)
    return distances
```

`distances` records both distance and discovery. **Register on enqueue**: if B and C both point to D, B's registration prevents C from enqueuing D again. To return a path rather than just a distance, also store `parent[neighbor] = node` and reconstruct backward from the goal.

BFS finds minimum-edge paths because, at first discovery, no shorter route can remain unexplored. But fewer edges need not mean lower cost: A → C might cost 10, while A → B → C costs 1 per edge, totaling 2. Unequal edge weights require an appropriate weighted shortest-path algorithm. [Princeton's explanation of DFS, BFS, and shortest paths](https://algs4.cs.princeton.edu/41graph/)

## 5. Complexity and tradeoffs

| Method | Time | Auxiliary space, excluding output | Natural use |
| --- | --- | --- | --- |
| Recursive DFS on a tree | O(n) | O(h) call stack | Postorder computation, path backtracking |
| Frame-based iterative DFS on a tree | O(n) | O(h) explicit stack | Deep trees, entry/exit control |
| BFS on a tree | O(n) | O(w) queue | Levels, nearest equal-cost target |
| DFS / BFS on a general graph | O(V + E) | O(V) | Reachability, equal-cost shortest paths |

h is height; w is maximum layer width. General-graph space includes visited, but not the O(V+E) input adjacency list. The examples also return O(V) order or distance data. Tree-specific code can omit visited; cyclic graphs cannot. For a single reachable component, V and E refer to the explored portion.

A grid is also a graph: cells are vertices, up/down/left/right moves are edges. Flood fill on an R×C grid usually costs O(RC) time and worst-case O(RC) auxiliary space. Marking cells in place can replace visited but mutates input.

## 6. Practice the same method in different forms

- [Maximum Depth of Binary Tree](https://leetcode.com/problems/maximum-depth-of-binary-tree/): recursive return values, then rewrite with BFS.
- [Binary Tree Level Order Traversal](https://leetcode.com/problems/binary-tree-level-order-traversal/): capture `len(queue)` at each level and process exactly that many nodes.
- [Number of Islands](https://leetcode.com/problems/number-of-islands/): each new unvisited land cell starts a component flood fill.

<details class="interview" markdown="1">
<summary>Why doesn't DFS guarantee a shortest path? Does replacing recursion with a loop help?</summary>

DFS may reach the goal through a long branch before checking a one-edge alternative. An explicit stack changes the implementation, not the depth-first ordering. Use BFS for minimum steps with equal edge costs.

</details>

<details class="interview" markdown="1">
<summary>When is global visited valid, and when isn't it?</summary>

Reachability needs each node processed once. Enumerating all simple paths needs path-local membership with backtracking because distinct paths can be distinct answers. If a state includes keys or remaining budget, visited must include those too.

</details>

## 7. Further explanations

[Hello Algo: graph traversal](https://www.hello-algo.com/chapter_graph/graph_traversal/) (Chinese, with an English edition available) illustrates how nodes, queues, and visited records change. When reviewing, first explain where pending nodes are stored, which is taken next, and when it is marked. The code follows from those choices.
