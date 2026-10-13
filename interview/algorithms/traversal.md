# DFS / BFS：递归和迭代到底差在哪

**中文** · [English](traversal.en.md) · [方法地图](../leetcode.md)

> 阅读时间：约 11 分钟 · 最近审阅：2026-10

树和图的题经常要先回答一个问题：接下来去看哪个节点？深度优先搜索会先沿一条分支往下走，走完再回来；广度优先搜索则先看离起点一步的节点，再看两步的。

递归还是循环，是另一个问题。DFS 既可以递归写，也可以自己维护一个栈；BFS 通常用队列写。别把“DFS 就是递归、BFS 就是循环”当成定义。

## 1. 先用同一张图走一遍

先看这棵小树，约定同一节点的孩子按从左到右访问：

```text
        A
       / \
      B   C
     / \   \
    D   E   F
```

- DFS：从 A 到 B，再到 D。D 没有孩子，回到 B 看 E；B 这一支走完，才回去看 C、F。顺序是 **A B D E C F**。
- BFS：先看 A，再看同一层的 B、C，最后才是 D、E、F。顺序是 **A B C D E F**。

分歧出现在 B 之后：DFS 接着往下看 D，BFS 先把和 B 同层的 C 看完。下面可以逐步播放；不操作，光看上面这两条路线也能理解区别。“发现”表示已经登记这个节点，“处理”表示正在查看它的邻居。

<div class="traversal-lab" data-traversal-lab data-language="zh">
<p>无 JavaScript 也能读：A 连 B、C；B 连 D、E；C 连 F。DFS 的首次访问顺序是 A B D E C F；BFS 是 A B C D E F。</p>
</div>

想再试一个变化，可以切到“有环”：一条边把你带回已经来过的节点，`visited` 就负责阻止重复探索。“长链”和“宽树”则用来比较栈与队列会存多少东西，不是性能测试。

## 2. Recursive DFS：让调用栈记住回来去哪

代码里用邻接表（adjacency list）存图，也就是字典里每个节点对应一个邻居列表。例如上图中，`graph["A"]` 是 `["B", "C"]`。节点用整数或字符串；字典里没有的节点视为没有出边。下面都从一个有效起点 `start` 出发，只访问它能到达的部分。

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

调用 `visit("B")` 时，A 的函数还没执行完，只是暂停在那里。B 和它下面的 D、E 全部处理完，程序才回到 A，继续访问 C。调用栈替我们记住了“刚才走到哪，下次从哪继续”。

`seen` 要在进入节点时就登记。比如有一条 B → A 的边，B 看到 A 已经来过，就不会再次调用 `visit("A")`。如果等整条分支走完才登记，环可能让递归永远走不出来。

- **好处**：写树的递归、后序汇总、回溯很自然；函数的输入输出就是子问题。
- **代价**：有调用开销，也受 Python 递归深度限制。长链别只靠调大限制，改迭代通常更稳。
- **树题怎么想**：最大深度是 `1 + max(左子树深度, 右子树深度)`，空树是 0。先定义返回值，再填代码。

### 用英语解释这段 DFS

可以结合上面的代码这样讲，而不是只说 “I use recursion”：

> I mark a node as visited when I enter it, then recursively visit each unvisited neighbor. The call stack remembers where to resume after each recursive call returns. Marking nodes on entry prevents cycles from causing repeated visits.

被追问递归和迭代的区别时，接着说：

> I can replace the recursive calls with an explicit stack. That avoids Python's recursion-depth limit, but it doesn't eliminate the memory needed to keep track of pending work.

这里 **explicit stack** 是自己维护的栈；**call stack** 是函数调用使用的栈。说明白“谁来保存暂停的位置”，比只说一个用函数、一个用循环更具体。

## 3. Iterative DFS：自己管理那一摞任务

还是上面的树。现在不用函数调用帮忙记，而是用一个列表当栈：每次拿出最后一个节点，处理它，再放入它的孩子。想先看左孩子，就先放右孩子，后放左孩子——因为栈是后进先出。

| 刚处理完 | 栈里还剩什么，右端先取 | 下一步 |
| --- | --- | --- |
| A | `[C, B]` | 取 B |
| B | `[C, E, D]` | 取 D |
| D | `[C, E]` | 取 E |
| E | `[C]` | B 这一支结束，转去 C |

对没有环和共享孩子的树，这样已经够用。但一般图里，同一节点可能从多条路到达，需要额外处理重复。用“入栈时标记”的简单栈可以找出所有可达节点，却不一定得到和递归 DFS 一样的搜索树；涉及祖先关系、进入和退出时机时，不能直接替换。

<details class="interview" markdown="1">
<summary>进阶：一般图里，怎样和递归保持完全相同的顺序？</summary>

每层不能只存一个节点，还要记住它的邻居访问到哪了。把“节点 + 剩余邻居”一起放进栈帧（stack frame），就能模拟刚才的暂停和返回：

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

`iter` 让我们逐个读取邻居；`next(neighbors, None)` 在读完后返回 None，所以这里不能把 None 当节点。当前帧没有邻居可看，就弹出它，回到上一层。这个过程对应递归中的函数返回。

这版能保持相同邻居顺序下的递归 DFS 访问顺序，也方便在进栈或退栈时加入操作。它不受 Python 的递归层数限制，但仍然需要显式的栈空间，不是把递归改成循环就省掉了内存。

</details>

## 4. BFS：队列保证按距离一层层看

队列与栈相反，是先进先出。A 把 B、C 依次放进去后，即使 B 又发现了 D、E，新来的也得排在 C 后面。

| 刚处理完 | 队列里还剩什么，左端先取 | 新发现的距离 |
| --- | --- | --- |
| A | `[B, C]` | B、C 距起点 1 步 |
| B | `[C, D, E]` | D、E 距起点 2 步 |
| C | `[D, E, F]` | F 距起点 2 步 |

这样所有距离为 1 的节点，都会在距离为 2 的节点之前被处理。Python 用 `deque.popleft()` 取队首；不要反复用列表的 `pop(0)`，它要移动后面的元素。

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

`distances` 既记录距离，也说明一个节点有没有被发现。**入队时就登记**：假如 B 和 C 都指向 D，B 把 D 放进去后，C 再看到 D 就不用重复加入。要返回具体路径，而不只是步数，可以同时记下 `parent[neighbor] = node`，到终点后往回找。

这也是普通 BFS 能找最少步数的原因：一个节点第一次被发现时，不可能还有一条更少步数的路没来得及探索。但“步数少”不一定“代价低”。例如 A → C 只走一条边，代价却是 10；A → B → C 走两条边，代价各为 1，总共反而只要 2。边权不同时，要另选适用的最短路算法。[Princeton 的 DFS / BFS 与最短路讲解](https://algs4.cs.princeton.edu/41graph/)

## 5. 复杂度、优势和限制

| 方法 | 时间 | 辅助空间，不含输出 | 更自然的用途 |
| --- | --- | --- | --- |
| 树的递归 DFS | O(n) | O(h) 调用栈 | 后序计算、路径回溯 |
| 树的迭代 DFS，保存栈帧 | O(n) | O(h) 显式栈 | 深树，控制进入／退出 |
| 树的 BFS | O(n) | O(w) 队列 | 层序、等边代价的最近目标 |
| 一般图的 DFS / BFS | O(V + E) | O(V) | 连通性、等边代价最短路 |

h 是高度，w 是最大层宽。图的 O(V) 包括 visited；输入 adjacency list 本身 O(V+E) 另算。上面示例还返回 O(V) 的 order 或 distance。树专用写法可省 visited；不能把这个节省套到有环的图。只搜一个连通部分时，V / E 指访问到的部分。

二维网格也能当图：每个格子是节点，上下左右是邻居。R×C 网格的 flood fill 通常 O(RC) 时间、最坏 O(RC) 辅助空间；可以原地改格子代替 visited，但会修改输入。

## 6. 选几题练“换个壳还是同一个方法”

- [二叉树的最大深度](https://leetcode.com/problems/maximum-depth-of-binary-tree/)：先写清递归返回什么，再用 BFS 重写。
- [二叉树的层序遍历](https://leetcode.com/problems/binary-tree-level-order-traversal/)：每层开始记录 `len(queue)`，恰好处理这一层的节点。
- [岛屿数量](https://leetcode.com/problems/number-of-islands/)：每发现一块没访问过的陆地，就把和它相连的陆地都标记；这一整片才算一个岛。

<details class="interview" markdown="1">
<summary>DFS 为什么不保证找到最短路？递归改循环会改变这个结论吗？</summary>

DFS 可以先沿很长的支路碰到目标，即使另一个邻居一步就能到。换成显式栈只改变实现，不改变深度优先的顺序；要按步数找最近目标，用等边代价下的 BFS。

</details>

<details class="interview" markdown="1">
<summary>同一个节点，什么时候能全局 visited，什么时候不能？</summary>

只求可达性时，同一节点处理一次够了。找所有简单路径时，不同路径到同一节点可能是不同答案，要用当前路径集合并回退。状态若还有钥匙、剩余预算等，visited 的 key 也必须包含这些信息。

</details>

## 7. 换一种讲法再看

[Hello 算法：图的遍历](https://www.hello-algo.com/chapter_graph/graph_traversal/)有逐步图示，可以对着看节点、队列和访问记录如何变化。复习时不用重背两套代码，先说清楚：还没处理的节点放在哪里，下一次先拿谁，什么时候标记访问过。
