/* Algorithm lab: small step-by-step figures for the LeetCode method notes.
   Loaded by app.js only on pages that contain a [data-widget^="algo-"] figure.

   Every figure is a stepper: the algorithm runs once, up front, as a pure
   function that returns a list of frames (state + a caption in both
   languages); the drawing only shows the current frame. Moving parts (the
   pointers, the window) keep their SVG nodes so CSS can slide them between
   frames. Nothing plays by itself; the reader steps or presses play.

   The frame builders are exported for Node so tests can check that the last
   frame agrees with the answer written in the note. */
(function (scope) {
  'use strict';

  /* ---------------------------------------------------------------- frames (pure) */
  const F = {};

  // keep a frame list honest: every frame has both captions
  function frames(list) {
    list.forEach((frame, i) => { if (!frame.zh || !frame.en) throw Error('caption ' + i); });
    return list;
  }

  /* Knapsack, one item, one pass over best[]: downward (0/1) or upward (unbounded).
     The note's counterexample: item (2,5), capacity 4 -> 5 downward, 10 upward. */
  F.knapsack = function (direction, weight = 2, value = 5, capacity = 4) {
    const best = Array(capacity + 1).fill(0);
    const written = new Set();
    const list = [{best: best.slice(), written: [], zh: `只有一件 (${weight},${value})，容量 ${capacity}。best[c] 是容量不超过 c 时的最大价值，开始全是 0。`,
      en: `One item (${weight},${value}), capacity ${capacity}. best[c] is the best value within capacity c; every cell starts at 0.`}];
    const rooms = [];
    for (let c = weight; c <= capacity; c++) rooms.push(c);
    if (direction === 'down') rooms.reverse();
    rooms.forEach((room, k) => {
      const from = room - weight, read = best[from], reused = written.has(from);
      const old = best[room], next = Math.max(old, read + value);
      const order = ['先', '接着', '最后'][k === rooms.length - 1 ? 2 : Math.min(k, 1)];
      best[room] = next;
      written.add(room);
      list.push({best: best.slice(), written: [...written], room, from, reused, old, read,
        zh: reused ? `${order}算 best[${room}]：它读 best[${from}]，可这格本轮刚写成 ${read}，于是 ${read} + ${value} = ${next}。`
                   : `${order}算 best[${room}]：读 best[${from}]，这格本轮还没动过，是 ${read}，所以 best[${room}] = ${read} + ${value} = ${next}。`,
        en: reused ? `Then best[${room}]: it reads best[${from}], which this pass already set to ${read}, so ${read} + ${value} = ${next}.`
                   : `best[${room}]: read best[${from}], untouched in this pass, so ${read} + ${value} = ${next}.`});
    });
    const answer = best[capacity];
    list.push(direction === 'down'
      ? {best: best.slice(), written: [...written], answer, done: true,
         zh: `倒着走完：best[${capacity}] = ${answer}。每一格读到的都是上一轮的值，(${weight},${value}) 只用了一次。`,
         en: `Done downward: best[${capacity}] = ${answer}. Every read saw last round's value, so (${weight},${value}) was used once.`}
      : {best: best.slice(), written: [...written], answer, done: true, wrong: true,
         zh: `正着走完：best[${capacity}] = ${answer}，同一件物品被拿了两次。硬币可以重复用时这正是想要的，0/1 背包里就是错的。`,
         en: `Done upward: best[${capacity}] = ${answer}; the same item was taken twice. Right for reusable coins, wrong for 0/1 knapsack.`});
    return frames(list);
  };

  /* Sieve of Eratosthenes through N, as in the note's table (N = 30). */
  F.sieve = function (limit = 30) {
    const crossed = new Set([1]);
    const list = [{crossed: [...crossed], zh: `2 到 ${limit} 先都当作候选。1 不是质数，直接划掉。`, en: `Every number from 2 to ${limit} starts as a candidate. 1 is not prime.`}];
    for (let p = 2; p <= limit; p++) {
      if (p * p > limit) {
        list.push({crossed: [...crossed], p, stop: true,
          zh: `${p} × ${p} = ${p * p} 已经超过 ${limit}，停下。剩下没划掉的数里，不会再藏着合数。`,
          en: `${p} × ${p} = ${p * p} is past ${limit}, so stop. No composite is left unmarked.`});
        break;
      }
      if (crossed.has(p)) {
        list.push({crossed: [...crossed], p, skip: true, zh: `${p} 已经被划掉，是合数，跳过：它的倍数早被更小的质因子划过了。`,
          en: `${p} is already crossed out, so it is composite; skip it. Its multiples were handled by a smaller prime.`});
        continue;
      }
      const fresh = [], again = [];
      for (let m = p * p; m <= limit; m += p) (crossed.has(m) ? again : fresh).push(m), crossed.add(m);
      const from = p * p;
      list.push({crossed: [...crossed], p, fresh, again, from,
        zh: p === 2 ? `2 没被划掉，是质数。从 2 × 2 = 4 开始划：${fresh.join('、')}。`
          : `${p} 是质数，从 ${p} × ${p} = ${from} 开始划。新划掉 ${fresh.join('、')}${again.length ? `；${again.join('、')} 之前已经划过，再划一次也没关系` : ''}。`,
        en: p === 2 ? `2 survives, so it is prime. Cross out from 2 × 2 = 4: ${fresh.join(', ')}.`
          : `${p} is prime; start at ${p} × ${p} = ${from}. Newly crossed: ${fresh.join(', ')}${again.length ? `. ${again.join(', ')} ${again.length > 1 ? 'were' : 'was'} already gone; crossing again is harmless` : ''}.`});
    }
    const primes = [];
    for (let n = 2; n <= limit; n++) if (!crossed.has(n)) primes.push(n);
    list.push({crossed: [...crossed], primes, done: true, zh: `剩下的就是 ${limit} 以内的质数：${primes.join('、')}。`,
      en: `What is left are the primes up to ${limit}: ${primes.join(', ')}.`});
    return frames(list);
  };

  /* Sliding-window maximum with a monotonic deque: [4,1,3,5,2,5], width 3. */
  F.windowMax = function (values = [4, 1, 3, 5, 2, 5], width = 3) {
    const queue = [], maxima = [];
    const fmt = list => list.map(i => `${i}(${values[i]})`);
    const list = [{values, queue: [], maxima: [], zh: `数组 [${values.join(', ')}]，每次看连续 ${width} 个数。队列只留“还可能接班当最大值”的下标。`,
      en: `Array [${values.join(', ')}], windows of ${width}. The queue keeps only indices that could still become the maximum.`}];
    values.forEach((value, index) => {
      const expired = [], popped = [];
      while (queue.length && queue[0] <= index - width) expired.push(queue.shift());
      while (queue.length && values[queue[queue.length - 1]] <= value) popped.push(queue.pop());
      queue.push(index);
      const full = index >= width - 1;
      if (full) maxima.push(values[queue[0]]);
      const zh = [`${index}: ${value} 进来。`], en = [`${index}: ${value} arrives.`];
      if (expired.length) { zh.push(`下标 ${expired.join('、')} 已经离开窗口，从队首删。`); en.push(`Index ${expired.join(', ')} has left the window; drop it from the front.`); }
      if (popped.length) {
        zh.push(`${popped.map(i => values[i]).join('、')} 不比 ${value} 大，又更早过期，之后求最大值用不到它，从队尾删。`);
        en.push(`${popped.map(i => values[i]).join(', ')} ${popped.length > 1 ? 'are' : 'is'} no larger than ${value} and expire${popped.length > 1 ? '' : 's'} sooner, so ${popped.length > 1 ? 'they are' : 'it is'} never needed for a later maximum; drop from the back.`);
      } else if (queue.length > 1) { zh.push(`它比队尾小，将来可能接班，排到队尾。`); en.push(`It is smaller than the back, but may take over later; append it.`); }
      zh.push(`队列 [${fmt(queue).join(', ')}]，` + (full ? `窗口最大值是队首的 ${values[queue[0]]}。` : '窗口还没满。'));
      en.push(`Queue [${fmt(queue).join(', ')}]; ` + (full ? `the window maximum is the front, ${values[queue[0]]}.` : 'the window is not full yet.'));
      list.push({values, index, window: [Math.max(0, index - width + 1), index], queue: queue.slice(), expired, popped, maxima: maxima.slice(), full, zh: zh.join(''), en: en.join(' ')});
    });
    list.push({values, queue: queue.slice(), maxima: maxima.slice(), done: true, window: [values.length - width, values.length - 1],
      zh: `四个窗口的最大值依次是 ${maxima.join('、')}。每个下标最多进队一次、出队一次，总共 O(n)。`,
      en: `The window maxima are ${maxima.join(', ')}. Each index enters and leaves the queue at most once: O(n) in total.`});
    return frames(list);
  };

  /* Two pointers on a sorted array: [1,3,5,8,12], target 11. */
  F.twoPointers = function (values = [1, 3, 5, 8, 12], target = 11) {
    let left = 0, right = values.length - 1;
    const out = [];
    const list = [{values, left, right, out: [], zh: `有序数组里找两个数，和等于 ${target}。left 从最左边开始，right 从最右边开始。`,
      en: `Find two numbers in the sorted array that add up to ${target}. left starts at the far left, right at the far right.`}];
    while (left < right) {
      const a = values[left], b = values[right], sum = a + b;
      if (sum === target) {
        list.push({values, left, right, out: out.slice(), sum, found: true, zh: `${a} + ${b} = ${sum}，找到了，返回位置 ${left} 和 ${right}。`, en: `${a} + ${b} = ${sum}. Found it: return positions ${left} and ${right}.`});
        break;
      }
      if (sum > target) {
        list.push({values, left, right, out: out.slice(), sum, zh: `${a} + ${b} = ${sum}，太大。${a} 已经是剩下最小的数，换谁都只会更大，所以 ${b} 不可能配出答案。`,
          en: `${a} + ${b} = ${sum}, too large. ${a} is already the smallest left, so any partner makes it larger: ${b} can never be in an answer.`});
        out.push(right); right -= 1;
        list.push({values, left, right, out: out.slice(), zh: `排除 ${b}，right 往里走一格。`, en: `Discard ${b}; right moves in one step.`});
      } else {
        list.push({values, left, right, out: out.slice(), sum, zh: `${a} + ${b} = ${sum}，太小。${b} 已经是剩下最大的数，换谁都只会更小，所以 ${a} 不可能配出答案。`,
          en: `${a} + ${b} = ${sum}, too small. ${b} is already the largest left, so any partner makes it smaller: ${a} can never be in an answer.`});
        out.push(left); left += 1;
        list.push({values, left, right, out: out.slice(), zh: `排除 ${a}，left 往里走一格。`, en: `Discard ${a}; left moves in one step.`});
      }
    }
    return frames(list);
  };

  /* Longest substring without repeats: "abba". */
  F.slidingWindow = function (text = 'abba') {
    const chars = [...text];
    let left = 0, best = 0;
    const seen = new Set();
    const list = [{chars, left: 0, right: -1, best: 0, zh: `读 "${text}"。[left, right] 是正在看的这一段，集合记着里面有哪些字符。`,
      en: `Read "${text}". [left, right] is the stretch in view; a set remembers which characters are inside.`}];
    chars.forEach((ch, right) => {
      if (seen.has(ch)) {
        list.push({chars, left, right, best, dup: right, conflict: chars.indexOf(ch, left), zh: `位置 ${right} 的 ${ch} 重复了。不清空窗口，从左边一个个移走，直到这次加入不再重复。`,
          en: `The ${ch} at position ${right} repeats. Don't clear the window; remove from the left until adding it no longer repeats.`});
        while (seen.has(ch)) {
          const gone = chars[left];
          seen.delete(gone); left += 1;
          list.push({chars, left, right, best, dup: right, removed: left - 1, zh: seen.has(ch) ? `移走 ${gone}，仍然重复，继续。` : `移走旧的 ${gone}，现在可以放进来了。`,
            en: seen.has(ch) ? `Remove ${gone}; still a repeat, keep going.` : `Remove the old ${gone}; now it fits.`});
        }
      }
      seen.add(ch);
      best = Math.max(best, right - left + 1);
      const window = chars.slice(left, right + 1).join('');
      list.push({chars, left, right, best, zh: `放进位置 ${right} 的 ${ch}，窗口是 ${window}，目前最长 ${best}。`, en: `Add the ${ch} at position ${right}. The window is ${window}; longest so far ${best}.`});
    });
    list.push({chars, left, right: chars.length - 1, best, done: true, zh: `读完了，最长是 ${best}。left 只往右走、从不回退，每个字符最多进出一次。`,
      en: `Done: the longest is ${best}. left only moves right and never goes back, so each character enters and leaves at most once.`});
    return frames(list);
  };

  /* First position with value >= target: [1,3,3,7,9], target 3, half-open [left, right). */
  F.lowerBound = function (values = [1, 3, 3, 7, 9], target = 3) {
    let left = 0, right = values.length;
    const list = [{values, left, right, zh: `找第一个不小于 ${target} 的位置。left 左边都小于 ${target}；从 right 开始都不小于 ${target}；中间还没排除。right 先放在 ${right}，也就是数组末尾之后。`,
      en: `Find the first position whose value is at least ${target}. Left of left: smaller. From right on: at least ${target}. In between: undecided. right starts at ${right}, just past the end.`}];
    while (left < right) {
      const middle = Math.floor((left + right) / 2), v = values[middle];
      if (v >= target) {
        list.push({values, left, right, middle, zh: `middle = ${middle}，值是 ${v}，符合，但左边可能还有。它可能就是答案，所以保留：right = ${middle}。`,
          en: `middle = ${middle}, value ${v}: it qualifies, but there may be one further left. It might be the answer, so keep it: right = ${middle}.`});
        right = middle;
      } else {
        list.push({values, left, right, middle, zh: `middle = ${middle}，值是 ${v}，太小，连它一起排除：left = ${middle + 1}。`,
          en: `middle = ${middle}, value ${v}: too small, so exclude it too: left = ${middle + 1}.`});
        left = middle + 1;
      }
      list.push({values, left, right, zh: `现在 left = ${left}，right = ${right}。`, en: `Now left = ${left}, right = ${right}.`});
    }
    list.push({values, left, right, done: true, answer: left, zh: `两边在 ${left} 相遇，答案就是位置 ${left}。right = middle 和 left = middle + 1 不对称：前者碰到的可能就是答案。`,
      en: `They meet at ${left}: the answer is position ${left}. right = middle and left = middle + 1 are not symmetric; the first may be sitting on the answer.`});
    return frames(list);
  };

  /* Count subarrays summing to target with prefix sums: [1,-1,1], target 1. */
  F.prefixCount = function (values = [1, -1, 1], target = 1) {
    const freq = new Map([[0, 1]]), prefixAt = [0];
    let prefix = 0, total = 0;
    const snapshot = () => [...freq.entries()].sort((a, b) => a[0] - b[0]);
    const list = [{values, freq: snapshot(), prefix, total, prefixes: prefixAt.slice(), zh: `字典先放 {0: 1}：数组开始前的空前缀，和是 0。target = ${target}。`,
      en: `The map starts as {0: 1}: the empty prefix before the array, with sum 0. target = ${target}.`}];
    values.forEach((value, index) => {
      prefix += value;
      const want = prefix - target, hits = freq.get(want) || 0;
      const starts = prefixAt.map((p, l) => (p === want ? l : -1)).filter(l => l >= 0);
      total += hits;
      list.push({values, freq: snapshot(), prefix, total, index, want, starts, prefixes: prefixAt.slice(),
        zh: `读到 ${value}，前缀变成 ${prefix}。先查：要找前缀 ${prefix} − ${target} = ${want}，字典里有 ${hits} 个，` + (hits ? `所以以这里结尾、和为 ${target} 的子数组有 ${hits} 段，答案累计 ${total}。` : `没有能配的，答案还是 ${total}。`),
        en: `Read ${value}; the prefix becomes ${prefix}. Look up first: prefix ${prefix} − ${target} = ${want} appears ${hits} time${hits === 1 ? '' : 's'}, ` + (hits ? `so ${hits} subarray${hits === 1 ? '' : 's'} ending here sum${hits === 1 ? 's' : ''} to ${target}; total ${total}.` : `so nothing pairs up; total stays ${total}.`)});
      freq.set(prefix, (freq.get(prefix) || 0) + 1);
      prefixAt.push(prefix);
      list.push({values, freq: snapshot(), prefix, total, index, stored: prefix, prefixes: prefixAt.slice(),
        zh: `再存：前缀 ${prefix} 的次数变成 ${freq.get(prefix)}。` + (index === 0 ? '先查后存：target = 0 时，这样才不会把空子数组算进去。' : ''),
        en: `Then store: prefix ${prefix} now appears ${freq.get(prefix)} time${freq.get(prefix) === 1 ? '' : 's'}.` + (index === 0 ? ' Looking up before storing keeps the empty subarray out when target is 0.' : '')});
    });
    list.push({values, freq: snapshot(), prefix, total, done: true, prefixes: prefixAt.slice(),
      zh: `合计 ${total}：两个单独的 1，加上整段。字典存的是次数，不是一个下标。`,
      en: `Total ${total}: the two single 1s plus the whole array. The map stores counts, not one index.`});
    return frames(list);
  };

  /* House Robber [2,7,9,3,1]: best(i) = max(best(i+1), v[i] + best(i+2)). */
  F.robTable = function (values = [2, 7, 9, 3, 1]) {
    const n = values.length, best = Array(n + 2).fill(null);
    best[n] = best[n + 1] = 0;
    const list = [{kind: 'table', values, best: best.slice(), zh: `best[i] = 从位置 i 开始最多能拿多少。它依赖右边两格，所以从右往左填；越界的 best[${n}]、best[${n + 1}] 都是 0。`,
      en: `best[i] is the most you can take starting at i. It depends on the two cells to its right, so fill right to left; best[${n}] and best[${n + 1}] past the end are 0.`}];
    for (let i = n - 1; i >= 0; i--) {
      const skip = best[i + 1], take = values[i] + best[i + 2];
      best[i] = Math.max(skip, take);
      list.push({kind: 'table', values, best: best.slice(), i, skip, take,
        zh: `位置 ${i}（值 ${values[i]}）：不选，拿 best[${i + 1}] = ${skip}；选，拿 ${values[i]} + best[${i + 2}] = ${take}。取大的，best[${i}] = ${best[i]}。`,
        en: `Position ${i} (value ${values[i]}): skip it for best[${i + 1}] = ${skip}, or take it for ${values[i]} + best[${i + 2}] = ${take}. Keep the larger: best[${i}] = ${best[i]}.`});
    }
    list.push({kind: 'table', values, best: best.slice(), done: true, zh: `填完，best[0] = ${best[0]}，和记忆化算出来的一样，只是顺序反过来了。`,
      en: `Filled: best[0] = ${best[0]}, the same as the memoized search, just in the opposite order.`});
    return frames(list);
  };

  /* The note's partial call tree for best(0): best(2) is asked twice, computed once. */
  F.robMemo = function (values = [2, 7, 9, 3, 1]) {
    const table = F.robTable(values), best = table[table.length - 1].best;
    const v = values;
    const step = (on, cache, zh, en, extra = {}) => ({kind: 'tree', on, cache, zh, en, ...extra});
    return frames([
      step([], [], `从 best(0) 开始。每个位置两种选择：不选，或者选了它再跳过下一个。`, `Start at best(0). Each position has two choices: skip it, or take it and skip the next one.`),
      step(['b0', 'b1'], [], `先试“不选位置 0”，问题变成 best(1)。`, `Try skipping position 0 first; the question becomes best(1).`, {current: 'b1'}),
      step(['b0', 'b1', 'b2a'], ['b2'], `best(1) 先试“不选位置 1”，到了 best(2)：[${v.slice(2).join(', ')}] 最多拿 ${best[2]}。算完存进缓存。`,
        `best(1) skips position 1 and reaches best(2): at most ${best[2]} from [${v.slice(2).join(', ')}]. Store it.`, {current: 'b2a', value: {b2a: best[2]}}),
      step(['b0', 'b1', 'b2a', 'b3'], ['b2', 'b3'], `再试“选位置 1”：${v[1]} + best(3)，[${v.slice(3).join(', ')}] 最多 ${best[3]}，也存起来。`,
        `Then take position 1: ${v[1]} + best(3), and [${v.slice(3).join(', ')}] gives at most ${best[3]}. Store that too.`, {current: 'b3', value: {b2a: best[2], b3: best[3]}}),
      step(['b0', 'b1', 'b2a', 'b3'], ['b2', 'b3', 'b1'], `best(1) = max(${best[2]}, ${v[1]} + ${best[3]}) = ${best[1]}。`, `best(1) = max(${best[2]}, ${v[1]} + ${best[3]}) = ${best[1]}.`,
        {current: 'b1', value: {b1: best[1], b2a: best[2], b3: best[3]}}),
      step(['b0', 'b1', 'b2a', 'b3', 'b2b'], ['b2', 'b3', 'b1'], `回到 best(0)，试“选位置 0”：${v[0]} + best(2)。best(2) 刚才算过，直接从缓存拿 ${best[2]}，不用再往下展开。`,
        `Back at best(0), take position 0: ${v[0]} + best(2). best(2) is already cached: use ${best[2]} without expanding it again.`, {current: 'b2b', hit: true, value: {b1: best[1], b2a: best[2], b3: best[3], b2b: best[2]}}),
      step(['b0', 'b1', 'b2a', 'b3', 'b2b'], ['b2', 'b3', 'b1', 'b0'], `best(0) = max(${best[1]}, ${v[0]} + ${best[2]}) = ${best[0]}。`, `best(0) = max(${best[1]}, ${v[0]} + ${best[2]}) = ${best[0]}.`,
        {current: 'b0', value: {b0: best[0], b1: best[1], b2a: best[2], b3: best[3], b2b: best[2]}, done: true})
    ]);
  };

  /* The note's counterexample: 8 -> right 10 -> left 6. Local checks pass; bounds fail. */
  F.bstLocal = function () {
    return frames([
      {kind: 'local', on: ['n8', 'n10', 'n6'], zh: '只看父子：每条边，比较一次父亲和孩子。', en: 'Local check only: compare each parent with its child.'},
      {kind: 'local', on: ['n8', 'n10', 'n6'], edge: 'e1', ok: ['e1'], zh: '8 的右孩子是 10，10 > 8，这条边没问题。', en: '8’s right child is 10, and 10 > 8. This edge is fine.'},
      {kind: 'local', on: ['n8', 'n10', 'n6'], edge: 'e2', ok: ['e1', 'e2'], zh: '10 的左孩子是 6，6 < 10，这条边也没问题。', en: '10’s left child is 6, and 6 < 10. This edge is fine too.'},
      {kind: 'local', on: ['n8', 'n10', 'n6'], ok: ['e1', 'e2'], bad: 'n6', ghost: true, verdict: false,
        zh: '每一对都对，只看父子会说“是 BST”。可 6 在 8 的右子树里，它必须大于 8。这棵树不是 BST。',
        en: 'Every pair passes, so a local check says “valid”. But 6 sits in 8’s right subtree and must be greater than 8. This is not a BST.'}
    ]);
  };
  F.bstBounds = function () {
    return frames([
      {kind: 'bounds', on: ['n8'], current: 'n8', range: {n8: '(−∞, +∞)'}, zh: '根没有上下界：(−∞, +∞)。8 在范围里。', en: 'The root has no bounds: (−∞, +∞). 8 is inside.'},
      {kind: 'bounds', on: ['n8', 'n10'], current: 'n10', edge: 'e1', ok: ['e1'], range: {n8: '(−∞, +∞)', n10: '(8, +∞)'},
        zh: '往右走，下界收紧成 8：10 拿到 (8, +∞)，在范围里。', en: 'Going right raises the lower bound to 8: 10 gets (8, +∞) and is inside.'},
      {kind: 'bounds', on: ['n8', 'n10', 'n6'], current: 'n6', edge: 'e2', ok: ['e1'], bad: 'n6', range: {n8: '(−∞, +∞)', n10: '(8, +∞)', n6: '(8, 10)'},
        zh: '再往左走，上界收紧成 10：6 拿到 (8, 10)。6 不大于 8，立刻失败。', en: 'Going left lowers the upper bound to 10: 6 gets (8, 10). 6 is not above 8, so it fails at once.'},
      {kind: 'bounds', on: ['n8', 'n10', 'n6'], ok: ['e1'], bad: 'n6', ghost: true, verdict: false, range: {n8: '(−∞, +∞)', n10: '(8, +∞)', n6: '(8, 10)'},
        zh: '把祖先的范围一路带下去，就能抓住“隔代”的违规。每个节点只看一次，时间 O(n)。', en: 'Carrying ancestors’ bounds down catches violations across generations. Each node is checked once: O(n).'}
    ]);
  };

  /* Reverse 1 -> 2 -> 3 with previous / current / following. */
  F.reverseList = function (values = [1, 2, 3]) {
    const next = values.map((_, i) => (i + 1 < values.length ? i + 1 : null));
    let previous = null, current = 0;
    const name = i => (i == null ? 'None' : String(values[i]));
    const snap = extra => ({next: next.slice(), previous, current, ...extra});
    const list = [snap({zh: `${values.join(' → ')}。previous 从 None 开始，current 指向 ${values[0]}。`, en: `${values.join(' → ')}. previous starts at None; current points to ${values[0]}.`})];
    while (current != null) {
      const following = next[current];
      next[current] = previous;
      list.push(snap({following, flipped: current,
        zh: `先存 following = ${name(following)}，再把 ${values[current]} 的 next 改指向 previous（${name(previous)}）。` + (current === 0 ? '不先存的话，后面的节点就找不到了。' : ''),
        en: `Save following = ${name(following)} first, then point ${values[current]}’s next at previous (${name(previous)}).` + (current === 0 ? ' Without saving it, the rest of the list would be lost.' : '')}));
      previous = current; current = following;
      list.push(snap({following,
        zh: current == null ? `previous 移到 ${name(previous)}，current 变成 None，循环结束。` : `previous 移到 ${name(previous)}，current 移到 ${name(current)}。左边这段已经反转好。`,
        en: current == null ? `previous moves to ${name(previous)}; current becomes None, so the loop ends.` : `previous moves to ${name(previous)}, current to ${name(current)}. The part on the left is already reversed.`}));
    }
    const order = [];
    for (let i = previous; i != null; i = next[i]) order.push(values[i]);
    list.push(snap({done: true, order, zh: `返回 previous：${order.join(' → ')}。只用了三个指针，额外空间 O(1)；原链表被改掉了。`,
      en: `Return previous: ${order.join(' → ')}. Three pointers, O(1) extra space; the original list is modified.`}));
    return frames(list);
  };

  /* KMP search: "ababab" for "abab", prefix [0,0,1,2]. */
  F.kmp = function (text = 'ababab', pattern = 'abab') {
    const prefix = Array(pattern.length).fill(0);
    for (let i = 1, m = 0; i < pattern.length; i++) {
      while (m && pattern[i] !== pattern[m]) m = prefix[m - 1];
      if (pattern[i] === pattern[m]) m += 1;
      prefix[i] = m;
    }
    let matched = 0;
    const found = [];
    const list = [{text, pattern, prefix, matched, shift: 0, found: [], zh: `在 ${text} 里找 ${pattern}。前缀表是 [${prefix.join(', ')}]。matched 记“目前对上了模式的多长前缀”。`,
      en: `Find ${pattern} in ${text}. The prefix table is [${prefix.join(', ')}]. matched is how long a prefix of the pattern is lined up so far.`}];
    [...text].forEach((ch, index) => {
      const fails = [];
      while (matched && ch !== pattern[matched]) { fails.push(matched); matched = prefix[matched - 1]; }
      if (ch === pattern[matched]) matched += 1;
      const full = matched === pattern.length;
      list.push({text, pattern, prefix, index, matched, shift: index - matched + 1, found: found.slice(), compare: matched - 1,
        zh: `文本位置 ${index} 是 ${ch}，和模式第 ${matched - 1} 位对上，matched = ${matched}。` + (full ? `整段对上了，记录起点 ${index - matched + 1}。` : ''),
        en: `Text position ${index} is ${ch}; it matches pattern position ${matched - 1}, so matched = ${matched}.` + (full ? ` A full match: record start ${index - matched + 1}.` : '')});
      if (full) {
        found.push(index - matched + 1);
        const kept = prefix[matched - 1];
        matched = kept;
        list.push({text, pattern, prefix, index, matched, shift: index - matched + 1, found: found.slice(), slid: true, usedPrefix: pattern.length - 1,
          zh: `不归零：matched 退到 prefix[${pattern.length - 1}] = ${kept}。模式往右滑，已经对上的 ${pattern.slice(0, kept)} 保留，不用再比一遍。`,
          en: `Don’t reset: matched falls back to prefix[${pattern.length - 1}] = ${kept}. The pattern slides right and keeps the matched ${pattern.slice(0, kept)} without comparing it again.`});
      }
    });
    list.push({text, pattern, prefix, matched, shift: found.length ? found[found.length - 1] : text.length - matched, found: found.slice(), done: true,
      zh: `起点是 ${found.join(' 和 ')}，两次匹配是重叠的。文本指针从头到尾只往前走，总共 O(n + m)。`,
      en: `The starts are ${found.join(' and ')}, and the two matches overlap. The text pointer only ever moves forward: O(n + m) in total.`});
    return frames(list);
  };

  /* LCS table for "CAB" (rows) and "ACB" (columns). */
  F.lcs = function (a = 'CAB', b = 'ACB') {
    const L = Array.from({length: a.length + 1}, () => Array(b.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) L[i][0] = 0;
    for (let j = 0; j <= b.length; j++) L[0][j] = 0;
    const copy = () => L.map(row => row.slice());
    const list = [{table: copy(), zh: `L(i, j) 是 ${a} 前 i 个字符和 ${b} 前 j 个字符的最长公共子序列长度。空前缀那一行、一列都是 0。`,
      en: `L(i, j) is the LCS length of the first i characters of ${a} and the first j of ${b}. The empty-prefix row and column are 0.`}];
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const x = a[i - 1], y = b[j - 1];
        if (x === y) {
          L[i][j] = L[i - 1][j - 1] + 1;
          list.push({table: copy(), i, j, from: [[i - 1, j - 1]], same: true, zh: `${x} 和 ${y} 相同：在左上角的 ${L[i - 1][j - 1]} 后面接上它，得 ${L[i][j]}。`, en: `${x} equals ${y}: extend the top-left ${L[i - 1][j - 1]} by one, giving ${L[i][j]}.`});
        } else {
          const up = L[i - 1][j], left = L[i][j - 1];
          L[i][j] = Math.max(up, left);
          const from = up >= left ? (up === left ? [[i - 1, j], [i, j - 1]] : [[i - 1, j]]) : [[i, j - 1]];
          list.push({table: copy(), i, j, from, zh: `${x} 和 ${y} 不同，至少跳过一个：取上方 ${up} 和左方 ${left} 的较大值，${L[i][j]}。`, en: `${x} differs from ${y}, so skip at least one: the larger of above (${up}) and left (${left}) is ${L[i][j]}.`});
        }
      }
    }
    list.push({table: copy(), done: true, zh: `右下角是 ${L[a.length][b.length]}：${a} 和 ${b} 的最长公共子序列长度。每格只记自己的最佳长度，不记具体是哪一串。`,
      en: `The bottom-right is ${L[a.length][b.length]}: the LCS length of ${a} and ${b}. Each cell keeps only its own best length, not which subsequence.`});
    return frames(list);
  };

  /* Stock trading with cooldown, prices [1,2,3,0,2]: H = max(H, R - p), S = H + p, R = max(R, S). */
  F.cooldown = function (prices = [1, 2, 3, 0, 2]) {
    const NEG = -Infinity, show = v => (v === NEG ? '−∞' : String(v).replace('-', '−'));
    let H = NEG, S = NEG, R = 0;
    const rows = [[H, S, R]];
    const list = [{prices, rows: rows.slice(), zh: '开始前：resting = 0，holding 和 sold 不可能，记成 −∞。每天的新值只读昨天的三个数。',
      en: 'Before starting: resting = 0; holding and sold are impossible, written −∞. Each day reads only yesterday’s three numbers.'}];
    prices.forEach((p, k) => {
      const hold = H, buy = R - p, h = Math.max(hold, buy), sNew = H + p, stay = R, cool = S, r = Math.max(stay, cool);
      const via = {H: buy > hold ? 'buy' : 'hold', S: 'sell', R: cool > stay ? 'cool' : 'stay'};
      [H, S, R] = [h, sNew, r];
      rows.push([H, S, R]);
      list.push({prices, rows: rows.slice(), day: k + 1, via,
        zh: `第 ${k + 1} 天价格 ${p}：holding = max(继续持有 ${show(hold)}, 买入 ${show(rows[k][2])} − ${p}) = ${show(H)}；sold = 昨天 holding ${show(rows[k][0])} + ${p} = ${show(S)}；resting = max(${show(stay)}, 冷却 ${show(cool)}) = ${show(R)}。`,
        en: `Day ${k + 1}, price ${p}: holding = max(keep ${show(hold)}, buy ${show(rows[k][2])} − ${p}) = ${show(H)}; sold = yesterday’s holding ${show(rows[k][0])} + ${p} = ${show(S)}; resting = max(${show(stay)}, cool down ${show(cool)}) = ${show(R)}.`});
    });
    const answer = Math.max(S, R);
    list.push({prices, rows: rows.slice(), done: true, answer, zh: `最后不持有：max(sold, resting) = ${answer}。只记“最多赚多少”，分不清刚卖出和已经休息，这就是要三个状态的原因。`,
      en: `End not holding: max(sold, resting) = ${answer}. A single “best so far” cannot tell “just sold” from “rested”, which is why there are three states.`});
    return frames(list);
  };

  /* Jump Game with a reachable frontier: [2,3,1,1,4] succeeds, [3,2,1,0,4] fails. */
  F.jump = function (jumps) {
    let farthest = 0;
    const last = jumps.length - 1;
    const list = [{jumps, farthest, zh: `[${jumps.join(',')}]：每个数是从这一格最多往前跳几步。只记一个数：目前最远能到哪（farthest），开始是 0。`,
      en: `[${jumps.join(',')}]: each number is the most steps you can jump from that cell. Keep one number, the farthest reachable index; it starts at 0.`}];
    for (let index = 0; index <= last; index++) {
      if (index > farthest) {
        list.push({jumps, farthest, index, stuck: true, zh: `位置 ${index} 已经超出最远可达的 ${farthest}，过不来。到不了末尾。`, en: `Position ${index} is beyond the farthest reachable ${farthest}; it cannot be reached. The end is out of reach.`});
        list.push({jumps, farthest, done: true, ok: false, zh: `结果：不能到达。前沿一直停在 ${farthest}，后面的格子再大也用不上。`, en: `Result: cannot reach the end. The frontier stalled at ${farthest}; later cells cannot help.`});
        return frames(list);
      }
      const before = farthest;
      farthest = Math.max(farthest, index + jumps[index]);
      const grew = farthest > before;
      list.push({jumps, farthest, index, reach: index + jumps[index],
        zh: `位置 ${index} 在可达范围里，最多跳 ${jumps[index]} 步，能到 ${index + jumps[index]}。` + (grew ? `前沿扩到 ${farthest}。` : `前沿还是 ${farthest}。`),
        en: `Position ${index} is reachable and can jump ${jumps[index]}, reaching ${index + jumps[index]}. ` + (grew ? `The frontier grows to ${farthest}.` : `The frontier stays at ${farthest}.`)});
      if (farthest >= last) {
        list.push({jumps, farthest, done: true, ok: true, zh: `前沿 ${farthest} 已经盖住最后一格 ${last}，可以到达，不用再往下看。`, en: `The frontier ${farthest} already covers the last index ${last}: reachable, no need to look further.`});
        return frames(list);
      }
    }
    return frames(list);
  };

  /* Amortized append on a doubling array: 8 appends, 15 operations. */
  F.append = function (count = 8) {
    let capacity = 0, size = 0, total = 0;
    const costs = [];
    const list = [{capacity, size, costs: [], total, zh: '一个简化的动态数组：容量不够就翻倍。写入一个新元素算 1 次操作，扩容时每搬一个旧元素也算 1 次。',
      en: 'A simplified dynamic array: when it is full, double the capacity. Writing a new element costs 1; moving each old element during a resize costs 1 too.'}];
    for (let k = 1; k <= count; k++) {
      let moved = 0;
      const grew = size === capacity;
      if (grew) { moved = size; capacity = Math.max(1, capacity * 2); }
      size += 1;
      const cost = moved + 1;
      total += cost;
      costs.push(cost);
      list.push({capacity, size, costs: costs.slice(), total, moved, grew, k,
        zh: grew ? `第 ${k} 次追加：满了，容量翻到 ${capacity}，搬 ${moved} 个旧元素，再写入 1 个，这次成本 ${cost}。`
                 : `第 ${k} 次追加：还有空位，直接写入，成本 1。`,
        en: grew ? `Append ${k}: full, so the capacity doubles to ${capacity}; move ${moved} old element${moved === 1 ? '' : 's'}, then write 1. Cost ${cost}.`
                 : `Append ${k}: there is room; just write it. Cost 1.`});
    }
    list.push({capacity, size, costs: costs.slice(), total, done: true,
      zh: `第 5 次最贵，可 ${count} 次追加一共只做了 ${total} 次操作。搬运是 1 + 2 + 4 + …，加上写入，总成本仍是 O(n)，摊到每次是 O(1)。`,
      en: `Append 5 is the expensive one, yet ${count} appends cost only ${total} operations in total. Moves add up to 1 + 2 + 4 + …; with the writes, the total stays O(n), O(1) per append amortized.`});
    return frames(list);
  };

  const api = {F, frames};
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof document === 'undefined') return;

  /* ---------------------------------------------------------------- page */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const LANG = (scope.SITE && scope.SITE.lang) === 'en' ? 'en' : 'zh';
  const t = (zh, en) => (LANG === 'zh' ? zh : en);
  function attrs(node, values) {
    for (const [key, value] of Object.entries(values || {})) {
      if (value == null || value === false) continue;
      if (key === 'text') node.textContent = value;
      else if (key === 'on') for (const [type, fn] of Object.entries(value)) node.addEventListener(type, fn);
      else node.setAttribute(key, value === true ? '' : value);
    }
    return node;
  }
  const h = (tag, values, kids = []) => { const node = attrs(document.createElement(tag), values); node.append(...kids); return node; };
  const s = (tag, values, kids = []) => { const node = attrs(document.createElementNS(SVGNS, tag), values); node.append(...kids); return node; };

  /* A stepper inside the figure shell build.py emits.
     draw = setup(svg) -> update(frame, index) */
  function stepper(name, source, {width = 640, height = 220, setup}) {
    const root = document.querySelector('[data-widget="' + name + '"]');
    const body = root && root.querySelector('.widget-body');
    if (!body) return;
    body.textContent = '';
    // either a list of frames, or {modes: [{id, zh, en, frames}]} with a switch
    const modes = Array.isArray(source) ? null : source.modes;
    let list = modes ? modes[0].frames : source;
    const svg = s('svg', {viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': root.querySelector('.widget-title')?.textContent || ''});
    const update = setup(svg);
    const caption = h('p', {class: 'fig-caption algo-caption', 'aria-live': 'polite'});
    const count = h('span', {class: 'algo-count'});
    const button = (label, aria, on) => h('button', {type: 'button', class: 'tx-btn algo-btn', 'aria-label': aria, text: label, on: {click: on}});
    let index = 0, timer = null;
    const play = button('▶', t('播放', 'Play'), () => (timer ? stop() : start()));
    const prev = button('◀', t('上一步', 'Previous step'), () => { stop(); go(index - 1); });
    const next = button('▶|', t('下一步', 'Next step'), () => { stop(); go(index + 1); });
    const reset = button('↺', t('从头开始', 'Start over'), () => { stop(); go(0); });
    function go(i) {
      index = Math.max(0, Math.min(list.length - 1, i));
      update(list[index], index);
      caption.textContent = list[index][LANG];
      count.textContent = `${index + 1} / ${list.length}`;
      prev.disabled = index === 0;
      next.disabled = index === list.length - 1;
      root.classList.toggle('is-last', index === list.length - 1);
    }
    function start() {
      if (index === list.length - 1) go(0);
      play.textContent = '❚❚';
      play.setAttribute('aria-label', t('暂停', 'Pause'));
      timer = scope.setInterval(() => { if (index >= list.length - 1) stop(); else go(index + 1); }, 1300);
    }
    function stop() {
      if (timer) scope.clearInterval(timer);
      timer = null;
      play.textContent = '▶';
      play.setAttribute('aria-label', t('播放', 'Play'));
    }
    root.tabIndex = -1;
    root.addEventListener('keydown', event => {
      if (event.target.closest('button') && event.key === ' ') return;
      if (event.key === 'ArrowRight') { stop(); go(index + 1); event.preventDefault(); }
      if (event.key === 'ArrowLeft') { stop(); go(index - 1); event.preventDefault(); }
    });
    const controls = h('div', {class: 'fig-controls algo-controls'}, [reset, prev, play, next, count]);
    if (modes) {
      const group = h('div', {class: 'seg', role: 'group', 'aria-label': t('选一种', 'Choose one')});
      const buttons = modes.map((mode, i) => h('button', {type: 'button', class: 'seg-btn', 'aria-pressed': String(i === 0), text: mode[LANG], on: {click: () => {
        stop();
        buttons.forEach(other => other.setAttribute('aria-pressed', String(other === buttons[i])));
        list = mode.frames;
        update.reset?.(mode, i);
        go(0);
      }}}));
      group.append(...buttons);
      controls.prepend(group);
    }
    body.append(
      controls,
      h('div', {class: 'fig-stage'}, [h('div', {class: 'fig-scroll algo-scroll'}, [svg])]),
      h('div', {class: 'fig-foot'}, [caption]));
    go(0);
  }

  /* drawing vocabulary */
  const V = {
    // a row of boxes; returns {group, cells: [{rect, label}], x(i)}
    row(svg, values, {x = 40, y = 70, size = 42, gap = 6, index = true, cls = ''} = {}) {
      const group = s('g', {class: 'algo-row ' + cls});
      const cells = values.map((value, i) => {
        const cx = x + i * (size + gap);
        const rect = s('rect', {x: cx, y, width: size, height: size, rx: 7, class: 'algo-cell'});
        const label = s('text', {x: cx + size / 2, y: y + size / 2 + 5, class: 'algo-val', 'text-anchor': 'middle', text: String(value)});
        group.append(rect, label);
        if (index) group.append(s('text', {x: cx + size / 2, y: y + size + 16, class: 'algo-idx', 'text-anchor': 'middle', text: String(i)}));
        return {rect, label};
      });
      svg.append(group);
      return {group, cells, x: i => x + i * (size + gap) + size / 2, size, y};
    },
    // a labelled pointer below (or above) a row; moves with CSS transform
    pointer(svg, label, cls, {y = 140, up = true} = {}) {
      const group = s('g', {class: 'algo-pointer ' + cls});
      group.append(
        s('path', {d: up ? 'M0 0 L-7 11 L7 11 Z' : 'M0 0 L-7 -11 L7 -11 Z', class: 'algo-arrow'}),
        s('text', {x: 0, y: up ? 28 : -18, 'text-anchor': 'middle', class: 'algo-plabel', text: label}));
      svg.append(group);
      const text = group.querySelector('text');
      return {group, at(x, hide, lower = 0) {
        group.style.transform = `translate(${x}px, ${y}px)`;
        group.classList.toggle('is-hidden', Boolean(hide));
        text.setAttribute('y', (up ? 28 : -18) + lower);
      }};
    },
    text(svg, x, y, value, cls = 'algo-note', anchor = 'start') {
      const node = s('text', {x, y, class: cls, 'text-anchor': anchor, text: value});
      svg.append(node);
      return node;
    },
    mark(cells, i, cls, on) { if (cells[i]) cells[i].rect.classList.toggle(cls, Boolean(on)); },
    // arrowheads: id (ember), id-blue, id-bad (red)
    markers(id) {
      const marker = (suffix, cls) => s('marker', {id: id + suffix, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto'},
        [s('path', {d: 'M0 0 L10 5 L0 10 Z', class: cls})]);
      return s('defs', {}, [marker('', 'algo-arrowhead'), marker('-blue', 'algo-arrowhead is-blue'), marker('-bad', 'algo-arrowhead is-bad-head')]);
    }
  };

  /* ---------------------------------------------------------------- figures */
  const FIGURES = {};

  FIGURES['algo-sieve'] = name => stepper(name, F.sieve(30), {height: 196, setup(svg) {
    const size = 44, gap = 6, cols = 10, x0 = (640 - (cols * size + (cols - 1) * gap)) / 2;
    const cells = [];
    for (let n = 1; n <= 30; n++) {
      const col = (n - 1) % cols, rowIndex = Math.floor((n - 1) / cols);
      const x = x0 + col * (size + gap), y = 22 + rowIndex * (size + gap + 6);
      const rect = s('rect', {x, y, width: size, height: size, rx: 7, class: 'algo-cell'});
      const label = s('text', {x: x + size / 2, y: y + size / 2 + 5, 'text-anchor': 'middle', class: 'algo-val', text: String(n)});
      const strike = s('line', {x1: x + 9, y1: y + size - 9, x2: x + size - 9, y2: y + 9, class: 'algo-strike'});
      svg.append(rect, label, strike);
      cells[n] = {rect, label, strike};
    }
    return frame => {
      const crossed = new Set(frame.crossed), fresh = new Set(frame.fresh || []), again = new Set(frame.again || []), primes = new Set(frame.primes || []);
      for (let n = 1; n <= 30; n++) {
        const {rect, label, strike} = cells[n];
        rect.setAttribute('class', 'algo-cell');
        const isCrossed = crossed.has(n);
        if (frame.done && primes.has(n)) rect.classList.add('is-keep');
        else if (n === frame.p && !frame.stop) rect.classList.add(frame.skip ? 'is-cross' : 'is-look');
        else if (fresh.has(n)) rect.classList.add('is-change');
        else if (again.has(n)) rect.classList.add('is-written');
        else if (isCrossed) rect.classList.add('is-cross');
        label.classList.toggle('is-dim', isCrossed && !fresh.has(n) && !again.has(n));
        strike.classList.toggle('is-on', isCrossed);
      }
    };
  }});

  FIGURES['algo-window-max'] = name => stepper(name, F.windowMax(), {height: 236, setup(svg) {
    const values = [4, 1, 3, 5, 2, 5];
    const band = s('rect', {x: 0, y: 32, width: 0, height: 84, rx: 10, class: 'algo-band'});
    svg.append(band);
    const row = V.row(svg, values, {x: 40, y: 44, size: 44, gap: 8});
    V.text(svg, 40, 140, t('队列（下标·值）', 'Queue (index·value)'), 'algo-head');
    const slots = [0, 1, 2].map(k => {
      const x = 40 + k * 66;
      const rect = s('rect', {x, y: 152, width: 58, height: 38, rx: 7, class: 'algo-cell'});
      const label = s('text', {x: x + 29, y: 176, 'text-anchor': 'middle', class: 'algo-val'});
      svg.append(rect, label);
      return {rect, label};
    });
    const gone = V.text(svg, 250, 176, '', 'algo-warn');
    V.text(svg, 420, 28, t('窗口最大值', 'Window maxima'), 'algo-head');
    const outs = [0, 1, 2, 3].map(k => {
      const x = 420 + k * 50;
      const rect = s('rect', {x, y: 44, width: 42, height: 42, rx: 7, class: 'algo-cell is-out'});
      const label = s('text', {x: x + 21, y: 70, 'text-anchor': 'middle', class: 'algo-val'});
      svg.append(rect, label);
      return {rect, label};
    });
    return frame => {
      const [l, r] = frame.window || [0, -1];
      const left = row.x(l) - row.size / 2 - 6, right = row.x(Math.max(l, r)) + row.size / 2 + 6;
      band.setAttribute('x', left); band.setAttribute('width', frame.window ? right - left : 0);
      band.classList.toggle('is-hidden', !frame.window || !frame.full && !frame.done);
      row.cells.forEach((cell, i) => {
        cell.rect.setAttribute('class', 'algo-cell');
        if (i === frame.index) cell.rect.classList.add('is-change');
        else if (frame.queue.includes(i)) cell.rect.classList.add('is-look');
        else if (frame.index != null && i > frame.index) cell.rect.classList.add('is-out');
      });
      slots.forEach((slot, k) => {
        const i = frame.queue[k];
        slot.rect.setAttribute('class', 'algo-cell' + (i == null ? ' is-out' : k === 0 && (frame.full || frame.done) ? ' is-keep' : ' is-look'));
        slot.label.textContent = i == null ? '' : `${i}·${values[i]}`;
      });
      const removed = [...(frame.expired || []).map(i => `${i}·${values[i]} ${t('过期', 'expired')}`), ...(frame.popped || []).map(i => `${i}·${values[i]} ${t('出局', 'out')}`)];
      gone.textContent = removed.length ? t('删掉：', 'dropped: ') + removed.join(t('，', ', ')) : '';
      outs.forEach((out, k) => {
        const v = frame.maxima[k];
        out.label.textContent = v == null ? '' : v;
        out.rect.setAttribute('class', 'algo-cell' + (v == null ? ' is-out' : k === frame.maxima.length - 1 && !frame.done ? ' is-change' : ' is-keep'));
      });
    };
  }});

  // a row of values with up to three named pointers underneath
  function pointerFigure(name, list, {values, extra = 0, labels}) {
    return stepper(name, list, {height: 210, setup(svg) {
      const n = values.length + extra, size = 52, gap = 12, x0 = (640 - (n * size + (n - 1) * gap)) / 2;
      const band = s('rect', {x: 0, y: 36, width: 0, height: 92, rx: 11, class: 'algo-band is-hidden'});
      svg.append(band);
      const row = V.row(svg, values.concat(Array(extra).fill('')), {x: x0, y: 50, size, gap});
      if (extra) row.cells.slice(values.length).forEach(cell => cell.rect.classList.add('algo-ghost'));
      const pointers = labels.map(([key, label, cls], k) => [key, V.pointer(svg, label, cls, {y: 128 + k * 0})]);
      const status = V.text(svg, 320, 196, '', 'algo-strong', 'middle');
      return frame => {
        row.cells.forEach((cell, i) => {
          cell.rect.setAttribute('class', 'algo-cell' + (i >= values.length ? ' algo-ghost' : ''));
          const add = cls => cell.rect.classList.add(cls);
          let dim = false;
          if (frame.found && (i === frame.left || i === frame.right)) add('is-keep');
          else if (frame.done && frame.answer === i) add('is-keep');
          else if ((frame.out || []).includes(i)) { add('is-cross'); dim = true; }
          else if (frame.middle === i) add('is-change');
          else if (frame.removed === i) { add('is-cross'); dim = true; }
          else if (frame.conflict === i) add('is-bad');
          else if (frame.dup === i) add('is-change');
          else if (frame.lower && i < frame.left) { add('is-cross'); dim = true; }
          else if (frame.lower && i >= frame.right && i < values.length) add('is-look');
          else if (frame.windowed && (i < frame.left || frame.dup == null && i > frame.right)) { add('is-cross'); dim = i < frame.left; }
          cell.label.classList.toggle('is-dim', dim);
        });
        // pointers that share a cell sit side by side, labels stacked
        const at = {};
        pointers.forEach(([key]) => { const i = frame[key]; if (i != null && i >= 0) (at[i] = at[i] || []).push(key); });
        pointers.forEach(([key, pointer]) => {
          const i = frame[key];
          if (i == null || i < 0) { pointer.at(row.x(0), true); return; }
          const group = at[i], k = group.indexOf(key), spread = group.length > 1 ? (k - (group.length - 1) / 2) * 18 : 0;
          pointer.at(row.x(i) + spread, false, k * 15);
        });
        frame.render?.(band, row, status);
        status.textContent = frame.status || '';
      };
    }});
  }

  FIGURES['algo-two-pointers'] = name => pointerFigure(name, F.twoPointers().map(frame => Object.assign(frame, {
    status: frame.sum != null ? `${frame.values[frame.left]} + ${frame.values[frame.right]} = ${frame.sum}${frame.found ? ' ✓' : frame.sum > 11 ? ' > 11' : ' < 11'}` : ''})),
    {values: [1, 3, 5, 8, 12], labels: [['left', 'left', 'p-blue'], ['right', 'right', '']]});

  FIGURES['algo-sliding-window'] = name => pointerFigure(name, F.slidingWindow().map(frame => Object.assign(frame, {
    status: (() => {
      const inside = frame.chars.slice(frame.left, frame.dup != null ? frame.right : frame.right + 1).join('');
      const view = inside ? `${t('窗口', 'window')} "${inside}"` : t('窗口为空', 'window empty');
      const wait = frame.dup != null ? ` · ${t('等着放进', 'waiting')} ${frame.chars[frame.dup]}` : '';
      return `${view}${wait} · ${t('目前最长', 'longest')} ${frame.best}`;
    })(),
    windowed: true,
    render(band, row) {
      // while a repeat waits to come in, the window is everything before it
      const last = frame.dup != null ? frame.right - 1 : frame.right, has = last >= frame.left;
      band.classList.toggle('is-hidden', !has);
      if (has) { const l = row.x(frame.left) - row.size / 2 - 7, r = row.x(last) + row.size / 2 + 7; band.setAttribute('x', l); band.setAttribute('width', r - l); }
    },
    left: frame.right >= frame.left ? frame.left : null})),
    {values: ['a', 'b', 'b', 'a'], labels: [['left', 'left', 'p-blue'], ['right', 'right', '']]});

  FIGURES['algo-binary-search'] = name => pointerFigure(name, F.lowerBound().map(frame => Object.assign(frame, {lower: true,
    status: frame.done ? `${t('答案', 'answer')} = ${frame.answer}` : frame.middle != null ? `values[${frame.middle}] = ${frame.values[frame.middle]} ${frame.values[frame.middle] >= 3 ? '≥' : '<'} 3` : `[left, right) = [${frame.left}, ${frame.right})`})),
    {values: [1, 3, 3, 7, 9], extra: 1, labels: [['left', 'left', 'p-blue'], ['middle', 'mid', 'p-green'], ['right', 'right', '']]});

  FIGURES['algo-prefix-count'] = name => stepper(name, F.prefixCount(), {height: 246, setup(svg) {
    const values = [1, -1, 1];
    const row = V.row(svg, values, {x: 70, y: 92, size: 52, gap: 14});
    V.text(svg, 22, 184, t('前缀', 'prefix'), 'algo-head');
    const prefixLabels = [0, 1, 2, 3].map(k => V.text(svg, k === 0 ? row.x(0) - 33 : row.x(k - 1) + 33, 184, '', 'algo-note', 'middle'));
    const brackets = s('g');
    svg.append(brackets);
    const status = V.text(svg, 70, 226, '', 'algo-strong');
    V.text(svg, 420, 50, t('前缀 → 次数', 'prefix → count'), 'algo-head');
    const mapRows = [0, 1, 2].map(k => {
      const y = 62 + k * 44;
      const rect = s('rect', {x: 420, y, width: 170, height: 36, rx: 7, class: 'algo-cell'});
      const label = s('text', {x: 505, y: y + 23, 'text-anchor': 'middle', class: 'algo-val'});
      svg.append(rect, label);
      return {rect, label};
    });
    return frame => {
      row.cells.forEach((cell, i) => {
        cell.rect.setAttribute('class', 'algo-cell');
        if (frame.done) cell.rect.classList.add('is-keep');
        else if (i === frame.index) cell.rect.classList.add(frame.stored != null ? 'is-written' : 'is-change');
        else if (frame.index != null && i > frame.index) cell.rect.classList.add('is-out');
      });
      prefixLabels.forEach((label, k) => { label.textContent = k < frame.prefixes.length ? String(frame.prefixes[k]) : (frame.stored == null && k === frame.prefixes.length && frame.index === k - 1 ? String(frame.prefix) : ''); });
      brackets.textContent = '';
      (frame.starts || []).forEach((l, k) => {
        const x1 = row.x(l) - row.size / 2, x2 = row.x(frame.index) + row.size / 2, y = 78 - k * 16;
        brackets.append(s('path', {d: `M${x1} ${y + 8} V${y} H${x2} V${y + 8}`, class: 'algo-edge is-keep'}));
      });
      mapRows.forEach((r, k) => {
        const entry = frame.freq[k];
        r.label.textContent = entry ? `${entry[0]} → ${entry[1]}` : '';
        r.rect.setAttribute('class', 'algo-cell' + (!entry ? ' is-out' : entry[0] === frame.want ? ' is-look' : entry[0] === frame.stored ? ' is-change' : ''));
      });
      status.textContent = frame.done ? `${t('答案', 'answer')} = ${frame.total}` : frame.want != null ? `${t('查', 'look up')} ${frame.prefix} − 1 = ${frame.want} · ${t('累计', 'total')} ${frame.total}` : `${t('累计', 'total')} ${frame.total}`;
    };
  }});

  FIGURES['algo-rob'] = name => {
    const values = [2, 7, 9, 3, 1];
    stepper(name, {modes: [
      {id: 'memo', zh: '记忆化搜索', en: 'Memoized search', frames: F.robMemo(values)},
      {id: 'table', zh: '从右往左填表', en: 'Fill right to left', frames: F.robTable(values)}
    ]}, {height: 250, setup(svg) {
      const arrow = name + '-arrow';
      svg.append(V.markers(arrow));
      /* tree layout */
      const tree = s('g');
      const nodes = {b0: [300, 34, 'best(0)'], b1: [160, 104, 'best(1)'], b2a: [80, 176, 'best(2)'], b3: [250, 176, `${values[1]} + best(3)`], b2b: [450, 104, `${values[0]} + best(2)`]};
      const edges = [['b0', 'b1', t('不选 0', 'skip 0')], ['b1', 'b2a', t('不选 1', 'skip 1')], ['b1', 'b3', t('选 1', 'take 1')], ['b0', 'b2b', t('选 0', 'take 0')]];
      const edgeNodes = edges.map(([a, b, label]) => {
        const [x1, y1] = nodes[a], [x2, y2] = nodes[b];
        const line = s('line', {x1, y1: y1 + 16, x2, y2: y2 - 16, class: 'algo-edge'});
        const text = s('text', {x: (x1 + x2) / 2 + (x2 < x1 ? -8 : 8), y: (y1 + y2) / 2 + 4, 'text-anchor': x2 < x1 ? 'end' : 'start', class: 'algo-note', text: label});
        tree.append(line, text);
        return {a, b, line};
      });
      const boxes = {};
      for (const [id, [x, y, label]] of Object.entries(nodes)) {
        const w = label.length > 8 ? 152 : 104;
        const rect = s('rect', {x: x - w / 2, y: y - 16, width: w, height: 32, rx: 8, class: 'algo-cell'});
        const text = s('text', {x, y: y + 5, 'text-anchor': 'middle', class: 'algo-val algo-small', text: label});
        tree.append(rect, text);
        boxes[id] = {rect, text, label};
      }
      const cacheLabel = s('text', {x: 548, y: 150, class: 'algo-head', text: t('缓存', 'cache')});
      const cacheLines = [0, 1, 2, 3, 4].map(k => s('text', {x: 548, y: 172 + k * 17, class: 'algo-note'}));
      tree.append(cacheLabel, ...cacheLines);
      svg.append(tree);
      /* table layout */
      const table = s('g', {class: 'is-hidden-layer'});
      const n = values.length, size = 50, gap = 12, x0 = 70;
      const xs = i => x0 + i * (size + gap) + size / 2;
      table.append(s('text', {x: 20, y: 72, class: 'algo-head', text: t('值', 'value')}), s('text', {x: 20, y: 152, class: 'algo-head', text: 'best'}));
      const valueCells = [], bestCells = [];
      for (let i = 0; i < n + 2; i++) {
        const x = x0 + i * (size + gap);
        if (i < n) {
          table.append(s('rect', {x, y: 48, width: size, height: 38, rx: 7, class: 'algo-cell'}), s('text', {x: x + size / 2, y: 72, 'text-anchor': 'middle', class: 'algo-val', text: String(values[i])}));
        }
        const rect = s('rect', {x, y: 128, width: size, height: 38, rx: 7, class: 'algo-cell' + (i >= n ? ' algo-ghost' : '')});
        const text = s('text', {x: x + size / 2, y: 152, 'text-anchor': 'middle', class: 'algo-val'});
        const idx = s('text', {x: x + size / 2, y: 182, 'text-anchor': 'middle', class: 'algo-idx', text: String(i)});
        table.append(rect, text, idx);
        bestCells.push({rect, text});
        valueCells.push(null);
      }
      const arcSkip = s('path', {class: 'algo-edge is-change', 'marker-end': `url(#${arrow})`});
      const arcTake = s('path', {class: 'algo-edge is-change', 'marker-end': `url(#${arrow})`});
      const formula = s('text', {x: 70, y: 226, class: 'algo-strong'});
      table.append(arcSkip, arcTake, formula);
      svg.append(table);
      const update = frame => {
        const isTree = frame.kind === 'tree';
        tree.classList.toggle('is-hidden-layer', !isTree);
        table.classList.toggle('is-hidden-layer', isTree);
        if (isTree) {
          for (const [id, box] of Object.entries(boxes)) {
            box.rect.setAttribute('class', 'algo-cell' + (!frame.on.includes(id) ? ' is-out' : id === frame.current ? (frame.hit ? ' is-keep' : ' is-change') : frame.value?.[id] != null ? ' is-written' : ' is-look'));
            const v = frame.value?.[id];
            box.text.textContent = v != null && !(id === 'b2b' && !frame.hit && !frame.done) ? `${box.label} = ${id === 'b3' ? values[1] + v : id === 'b2b' ? values[0] + v : v}` : box.label;
          }
          edgeNodes.forEach(edge => edge.line.setAttribute('class', 'algo-edge' + (frame.on.includes(edge.b) ? (edge.b === frame.current ? ' is-change' : ' is-look-line') : ' is-out')));
          const names = {b2: 'best(2)', b3: 'best(3)', b1: 'best(1)', b0: 'best(0)'};
          const table0 = F.robTable(values), best = table0[table0.length - 1].best;
          const entries = frame.cache.map(key => `${names[key]} = ${best[Number(key.slice(1))]}${frame.hit && key === 'b2' ? ' ←' : ''}`);
          cacheLines.forEach((line, k) => { line.textContent = entries[k] || (k === 0 ? '—' : ''); line.classList.toggle('algo-hit', Boolean(frame.hit) && frame.cache[k] === 'b2'); });
        } else {
          bestCells.forEach((cell, i) => {
            const v = frame.best[i];
            cell.text.textContent = v == null ? '' : String(v);
            cell.rect.setAttribute('class', 'algo-cell' + (i >= n ? ' algo-ghost' : '') + (frame.done && i === 0 ? ' is-keep' : i === frame.i ? ' is-change' : i === frame.i + 1 || i === frame.i + 2 ? ' is-look' : v != null && i < n ? ' is-written' : ''));
          });
          const step = frame.i != null && !frame.done;
          for (const [arc, offset] of [[arcSkip, 1], [arcTake, 2]]) {
            arc.classList.toggle('is-hidden', !step);
            if (step) { const x1 = xs(frame.i + offset), x2 = xs(frame.i); arc.setAttribute('d', `M${x1} 124 C${x1} ${108 - offset * 10} ${x2} ${108 - offset * 10} ${x2} 124`); }
          }
          formula.textContent = frame.done ? `best[0] = ${frame.best[0]}` : step ? `best[${frame.i}] = max(${frame.skip}, ${values[frame.i]} + ${frame.best[frame.i + 2]}) = ${frame.best[frame.i]}` : '';
        }
      };
      return update;
    }});
  };

  FIGURES['algo-bst-bounds'] = name => stepper(name, {modes: [
    {id: 'local', zh: '只看父子', en: 'Parent–child only', frames: F.bstLocal()},
    {id: 'bounds', zh: '把范围带下去', en: 'Carry the bounds', frames: F.bstBounds()}
  ]}, {height: 236, setup(svg) {
    const pos = {n8: [250, 44], n10: [370, 118], n6: [300, 192]};
    const edges = {e1: ['n8', 'n10'], e2: ['n10', 'n6']};
    const lines = {};
    for (const [id, [a, b]] of Object.entries(edges)) {
      const [x1, y1] = pos[a], [x2, y2] = pos[b];
      lines[id] = s('line', {x1, y1, x2, y2, class: 'algo-edge'});
      svg.append(lines[id]);
    }
    const ghost = s('path', {d: `M${pos.n8[0] - 20} ${pos.n8[1] + 18} Q 200 150 ${pos.n6[0] - 24} ${pos.n6[1] - 6}`, class: 'algo-edge is-bad algo-dash is-hidden'});
    svg.append(ghost);
    const nodes = {}, ranges = {};
    for (const [id, [x, y]] of Object.entries(pos)) {
      const circle = s('circle', {cx: x, cy: y, r: 24, class: 'algo-cell'});
      const label = s('text', {x, y: y + 6, 'text-anchor': 'middle', class: 'algo-val', text: id.slice(1)});
      const range = s('text', {x: x + 34, y: y + 5, class: 'algo-note'});
      svg.append(circle, label, range);
      nodes[id] = circle; ranges[id] = range;
    }
    const verdict = V.text(svg, 470, 60, '', 'algo-strong');
    const checks = {e1: V.text(svg, 0, 0, '', 'algo-note'), e2: V.text(svg, 0, 0, '', 'algo-note')};
    const place = {e1: [326, 72], e2: [252, 160]};
    return frame => {
      for (const [id, circle] of Object.entries(nodes)) {
        circle.setAttribute('class', 'algo-cell' + (!frame.on.includes(id) ? ' is-out' : id === frame.bad && (frame.current === id || frame.verdict === false) ? ' is-bad' : id === frame.current ? ' is-look' : ''));
        ranges[id].textContent = frame.range?.[id] || '';
      }
      for (const [id, line] of Object.entries(lines)) {
        line.setAttribute('class', 'algo-edge' + (!frame.on.includes(edges[id][1]) ? ' is-out' : id === frame.edge ? ' is-change' : (frame.ok || []).includes(id) ? ' is-keep' : ''));
        const label = checks[id];
        label.setAttribute('x', place[id][0]); label.setAttribute('y', place[id][1]);
        label.textContent = frame.kind === 'local' && (frame.ok || []).includes(id) ? (id === 'e1' ? '10 > 8 ✓' : '6 < 10 ✓') : '';
      }
      ghost.classList.toggle('is-hidden', !frame.ghost);
      verdict.textContent = frame.verdict === false ? (frame.kind === 'local' ? t('局部检查：误判为 BST', 'local check: wrongly “valid”') : t('不是 BST ✗', 'not a BST ✗')) : '';
    };
  }});

  FIGURES['algo-reverse-list'] = name => stepper(name, F.reverseList(), {height: 206, setup(svg) {
    const values = [1, 2, 3], xs = [200, 320, 440], y = 74, noneLeft = 70, noneRight = 570;
    const arrow = name + '-arrow';
    svg.append(V.markers(arrow));
    const links = values.map(() => { const path = s('path', {class: 'algo-edge algo-link', 'marker-end': `url(#${arrow})`}); svg.append(path); return path; });
    [noneLeft, noneRight].forEach(x => svg.append(s('text', {x, y: y + 6, 'text-anchor': 'middle', class: 'algo-none', text: '∅'})));
    const boxes = values.map((v, i) => {
      const rect = s('rect', {x: xs[i] - 28, y: y - 22, width: 56, height: 44, rx: 9, class: 'algo-cell'});
      svg.append(rect, s('text', {x: xs[i], y: y + 6, 'text-anchor': 'middle', class: 'algo-val', text: String(v)}));
      return rect;
    });
    const at = i => (i == null ? null : xs[i]);
    const pointers = [['previous', 'previous', 'p-blue', 0], ['current', 'current', '', 1], ['following', 'following', 'p-green', 2]]
      .map(([key, label, cls, k]) => [key, V.pointer(svg, label, cls, {y: 112 + k * 0})]);
    const result = V.text(svg, 320, 196, '', 'algo-strong', 'middle');
    return frame => {
      links.forEach((path, i) => {
        const target = frame.next[i], x1 = xs[i];
        const x2 = target == null ? (frame.next[i] === null && (i === 0 || frame.flipped === i || frame.previous != null && i <= frame.previous) ? noneLeft : noneRight) : xs[target];
        const forward = x2 > x1, bend = forward ? -1 : 1;
        const startX = x1 + (forward ? 28 : -28), endX = x2 + (forward ? -14 : 14);
        path.setAttribute('d', `M${startX} ${y + bend * 8} Q ${(startX + endX) / 2} ${y + bend * 34} ${endX} ${y + bend * 8}`);
        path.setAttribute('class', 'algo-edge algo-link' + (frame.flipped === i ? ' is-change' : !forward && x2 !== noneRight ? ' is-keep' : ''));
        path.setAttribute('marker-end', `url(#${arrow}${frame.flipped === i ? '' : !forward ? '-blue' : '-blue'})`);
      });
      boxes.forEach((rect, i) => rect.setAttribute('class', 'algo-cell' + (frame.done ? ' is-keep' : i === frame.current ? ' is-change' : frame.previous != null && i <= frame.previous ? ' is-written' : '')));
      const spots = {};
      pointers.forEach(([key]) => { const x = at(frame[key]) ?? (key === 'previous' ? noneLeft : noneRight); (spots[x] = spots[x] || []).push(key); });
      pointers.forEach(([key, pointer]) => {
        if (key === 'following' && frame.following === undefined) { pointer.at(noneRight, true); return; }
        const x = at(frame[key]) ?? (key === 'previous' ? noneLeft : noneRight), group = spots[x], k = group.indexOf(key);
        pointer.at(x + (group.length > 1 ? (k - (group.length - 1) / 2) * 26 : 0), Boolean(frame.done && key !== 'previous'), k * 15);
      });
      result.textContent = frame.done ? frame.order.join(' → ') : '';
    };
  }});

  FIGURES['algo-kmp'] = name => stepper(name, F.kmp(), {height: 236, setup(svg) {
    const text = 'ababab', pattern = 'abab', size = 46, gap = 8, x0 = 60;
    const xAt = i => x0 + i * (size + gap);
    V.text(svg, 14, 62, t('文本', 'text'), 'algo-head');
    V.text(svg, 14, 136, t('模式', 'pattern'), 'algo-head');
    const textRow = V.row(svg, [...text], {x: x0, y: 36, size, gap});
    const pat = s('g', {class: 'algo-slide'});
    const patCells = [...pattern].map((ch, j) => {
      const rect = s('rect', {x: xAt(j), y: 112, width: size, height: size, rx: 7, class: 'algo-cell'});
      pat.append(rect, s('text', {x: xAt(j) + size / 2, y: 141, 'text-anchor': 'middle', class: 'algo-val', text: ch}));
      return rect;
    });
    svg.append(pat);
    const pointer = V.pointer(svg, 'i', 'p-blue', {y: 30, up: false});
    V.text(svg, 420, 196, 'prefix', 'algo-head');
    const prefixCells = [0, 0, 1, 2].map((v, j) => {
      const rect = s('rect', {x: 470 + j * 34, y: 180, width: 28, height: 26, rx: 5, class: 'algo-cell'});
      svg.append(rect, s('text', {x: 484 + j * 34, y: 198, 'text-anchor': 'middle', class: 'algo-note', text: String(v)}));
      return rect;
    });
    const found = V.text(svg, 60, 214, '', 'algo-strong');
    return frame => {
      pat.style.transform = `translateX(${frame.shift * (size + gap)}px)`;
      textRow.cells.forEach((cell, i) => {
        cell.rect.setAttribute('class', 'algo-cell' + ((frame.found || []).some(start => i >= start && i < start + pattern.length) && frame.done ? ' is-keep' : i === frame.index ? ' is-look' : frame.index != null && i > frame.index ? ' is-out' : ''));
      });
      patCells.forEach((rect, j) => rect.setAttribute('class', 'algo-cell' + (frame.done && frame.found.length ? ' is-keep' : j < frame.matched ? (frame.slid ? ' is-keep' : j === frame.compare ? ' is-change' : ' is-keep') : '')));
      pointer.at(frame.index == null ? textRow.x(0) : textRow.x(frame.index), frame.index == null);
      prefixCells.forEach((rect, j) => rect.setAttribute('class', 'algo-cell' + (j === frame.usedPrefix ? ' is-change' : '')));
      found.textContent = t('起点：', 'starts: ') + ((frame.found || []).length ? frame.found.join(', ') : '—') + (frame.done ? '' : ` · matched = ${frame.matched}`);
    };
  }});

  FIGURES['algo-lcs'] = name => stepper(name, F.lcs(), {height: 246, setup(svg) {
    const a = 'CAB', b = 'ACB', size = 44, gap = 6, x0 = 230, y0 = 50;
    const cx = j => x0 + j * (size + gap) + size / 2, cy = i => y0 + i * (size + gap) + size / 2;
    const arrow = name + '-arrow';
    svg.append(V.markers(arrow));
    ['∅', ...b].forEach((ch, j) => V.text(svg, cx(j), y0 - 12, ch, 'algo-head', 'middle'));
    ['∅', ...a].forEach((ch, i) => V.text(svg, x0 - 18, cy(i) + 5, ch, 'algo-head', 'middle'));
    const cells = [];
    for (let i = 0; i <= a.length; i++) {
      cells[i] = [];
      for (let j = 0; j <= b.length; j++) {
        const rect = s('rect', {x: cx(j) - size / 2, y: cy(i) - size / 2, width: size, height: size, rx: 7, class: 'algo-cell'});
        const label = s('text', {x: cx(j), y: cy(i) + 6, 'text-anchor': 'middle', class: 'algo-val'});
        svg.append(rect, label);
        cells[i][j] = {rect, label};
      }
    }
    const arcs = [0, 1].map(() => { const path = s('path', {class: 'algo-edge is-change', 'marker-end': `url(#${arrow})`}); svg.append(path); return path; });
    const pair = V.text(svg, 40, 120, '', 'algo-strong');
    return frame => {
      for (let i = 0; i <= a.length; i++) for (let j = 0; j <= b.length; j++) {
        const v = frame.table[i][j], cell = cells[i][j];
        cell.label.textContent = v == null ? '' : String(v);
        const isFrom = (frame.from || []).some(([fi, fj]) => fi === i && fj === j);
        cell.rect.setAttribute('class', 'algo-cell' + (frame.done && i === a.length && j === b.length ? ' is-keep' : i === frame.i && j === frame.j ? (frame.same ? ' is-keep' : ' is-change') : isFrom ? ' is-look' : v == null ? ' is-out' : ''));
      }
      arcs.forEach((path, k) => {
        const src = (frame.from || [])[k];
        path.classList.toggle('is-hidden', !src);
        if (!src) return;
        const [fi, fj] = src, x1 = cx(fj), y1 = cy(fi), x2 = cx(frame.j), y2 = cy(frame.i);
        const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
        path.setAttribute('d', `M${x1 + dx * 12} ${y1 + dy * 12} L${x2 - dx * 16} ${y2 - dy * 16}`);
      });
      pair.textContent = frame.i ? `${a[frame.i - 1]} vs ${b[frame.j - 1]}` : '';
    };
  }});

  FIGURES['algo-cooldown'] = name => stepper(name, F.cooldown(), {height: 236, setup(svg) {
    const show = v => (v === -Infinity ? '−∞' : String(v).replace('-', '−'));
    const arrow = name + '-arrow';
    svg.append(V.markers(arrow));
    const pos = {R: [70, 160], H: [180, 56], S: [290, 160]};
    const names = {H: 'holding', S: 'sold', R: 'resting'};
    const edgeDefs = {
      buy: [`M${pos.R[0] + 24} ${pos.R[1] - 30} Q 104 84 ${pos.H[0] - 46} ${pos.H[1] + 10}`, t('买入', 'buy'), [96, 92]],
      sell: [`M${pos.H[0] + 46} ${pos.H[1] + 10} Q 268 84 ${pos.S[0] - 22} ${pos.S[1] - 30}`, t('卖出', 'sell'), [262, 92]],
      cool: [`M${pos.S[0] - 50} ${pos.S[1] + 6} L${pos.R[0] + 52} ${pos.R[1] + 6}`, t('冷却', 'cool down'), [180, 180]],
      hold: [`M${pos.H[0] - 18} ${pos.H[1] - 24} C ${pos.H[0] - 40} ${pos.H[1] - 64} ${pos.H[0] + 40} ${pos.H[1] - 64} ${pos.H[0] + 18} ${pos.H[1] - 24}`, t('持有', 'hold'), [180, 14]],
      stay: [`M${pos.R[0] - 30} ${pos.R[1] + 18} C ${pos.R[0] - 70} ${pos.R[1] + 50} ${pos.R[0] + 10} ${pos.R[1] + 66} ${pos.R[0] + 4} ${pos.R[1] + 26}`, t('休息', 'rest'), [24, 222]]
    };
    const edges = {};
    for (const [id, [d, label, [lx, ly]]] of Object.entries(edgeDefs)) {
      edges[id] = s('path', {d, class: 'algo-edge', 'marker-end': `url(#${arrow}-blue)`});
      svg.append(edges[id], s('text', {x: lx, y: ly, 'text-anchor': 'middle', class: 'algo-note', text: label}));
    }
    const nodeValue = {};
    for (const [key, [x, y]] of Object.entries(pos)) {
      svg.append(s('rect', {x: x - 46, y: y - 24, width: 92, height: 48, rx: 10, class: 'algo-cell algo-state'}));
      svg.append(s('text', {x, y: y - 4, 'text-anchor': 'middle', class: 'algo-note', text: names[key]}));
      nodeValue[key] = s('text', {x, y: y + 15, 'text-anchor': 'middle', class: 'algo-strong'});
      svg.append(nodeValue[key]);
    }
    // the note's table, one column per day
    const cols = ['∅', 1, 2, 3, 4, 5], tx = 378, cw = 42;
    const prices = [1, 2, 3, 0, 2];
    cols.forEach((c, k) => V.text(svg, tx + k * cw + cw / 2, 40, k === 0 ? t('开始', 'start') : `${t('第', 'd')}${c}${t('天', '')}`, 'algo-head', 'middle'));
    prices.forEach((p, k) => V.text(svg, tx + (k + 1) * cw + cw / 2, 58, `p=${p}`, 'algo-idx', 'middle'));
    const cells = ['H', 'S', 'R'].map((key, r) => {
      V.text(svg, tx - 8, 92 + r * 40, key, 'algo-head', 'end');
      return cols.map((_, k) => {
        const rect = s('rect', {x: tx + k * cw + 2, y: 70 + r * 40, width: cw - 4, height: 34, rx: 6, class: 'algo-cell'});
        const label = s('text', {x: tx + k * cw + cw / 2, y: 92 + r * 40, 'text-anchor': 'middle', class: 'algo-note'});
        svg.append(rect, label);
        return {rect, label};
      });
    });
    const answer = V.text(svg, 504, 214, '', 'algo-strong', 'middle');
    return frame => {
      const last = frame.rows[frame.rows.length - 1];
      ['H', 'S', 'R'].forEach((key, r) => {
        nodeValue[key].textContent = show(last[r]);
        cells[r].forEach((cell, k) => {
          const v = frame.rows[k];
          cell.label.textContent = v ? show(v[r]) : '';
          cell.rect.setAttribute('class', 'algo-cell' + (!v ? ' is-out' : k === frame.day ? ' is-change' : frame.done && k === 5 && r > 0 && v[r] === frame.answer ? ' is-keep' : ''));
        });
      });
      for (const [id, path] of Object.entries(edges)) {
        const on = frame.via && Object.values(frame.via).includes(id);
        path.setAttribute('class', 'algo-edge' + (on ? ' is-change' : ''));
        path.setAttribute('marker-end', `url(#${arrow}${on ? '' : '-blue'})`);
      }
      answer.textContent = frame.done ? `max(sold, resting) = ${frame.answer}` : '';
    };
  }});

  FIGURES['algo-jump'] = name => stepper(name, {modes: [
    {id: 'yes', zh: '[2,3,1,1,4]', en: '[2,3,1,1,4]', frames: F.jump([2, 3, 1, 1, 4])},
    {id: 'no', zh: '[3,2,1,0,4]', en: '[3,2,1,0,4]', frames: F.jump([3, 2, 1, 0, 4])}
  ]}, {height: 220, setup(svg) {
    const arrow = name + '-arrow';
    svg.append(V.markers(arrow));
    const band = s('rect', {x: 0, y: 70, width: 0, height: 98, rx: 11, class: 'algo-band algo-reach'});
    svg.append(band);
    let row = null;
    const holder = s('g');
    svg.append(holder);
    const arc = s('path', {class: 'algo-edge is-change', 'marker-end': `url(#${arrow})`});
    svg.append(arc);
    const status = V.text(svg, 320, 204, '', 'algo-strong', 'middle');
    const draw = jumps => {
      holder.textContent = '';
      row = V.row(holder, jumps, {x: 120, y: 84, size: 56, gap: 22});
    };
    const update = frame => {
      if (!row || row.values !== frame.jumps) { draw(frame.jumps); row.values = frame.jumps; }
      const left = row.x(0) - row.size / 2 - 8, right = row.x(Math.min(frame.farthest, frame.jumps.length - 1)) + row.size / 2 + 8;
      band.setAttribute('x', left); band.setAttribute('width', right - left);
      band.classList.toggle('is-bad-band', Boolean(frame.done && !frame.ok) || Boolean(frame.stuck));
      row.cells.forEach((cell, i) => cell.rect.setAttribute('class', 'algo-cell' + (frame.done && frame.ok && i === frame.jumps.length - 1 ? ' is-keep' : i === frame.index ? (frame.stuck ? ' is-bad' : ' is-look') : i > frame.farthest ? ' is-out' : '')));
      const show = frame.reach != null && frame.reach > frame.index && !frame.done;
      arc.classList.toggle('is-hidden', !show);
      if (show) {
        const x1 = row.x(frame.index), x2 = row.x(Math.min(frame.reach, frame.jumps.length - 1)) + (frame.reach > frame.jumps.length - 1 ? 30 : 0);
        arc.setAttribute('d', `M${x1} 80 C${x1} 34 ${x2} 34 ${x2} 78`);
      }
      status.textContent = frame.done ? (frame.ok ? t('能到达 ✓', 'reachable ✓') : t('到不了 ✗', 'unreachable ✗')) : `farthest = ${frame.farthest}`;
    };
    return update;
  }});

  FIGURES['algo-append'] = name => stepper(name, F.append(8), {height: 236, setup(svg) {
    const size = 50, gap = 8, x0 = 90;
    V.text(svg, 22, 58, t('数组', 'array'), 'algo-head');
    const slots = Array.from({length: 8}, (_, i) => {
      const rect = s('rect', {x: x0 + i * (size + gap), y: 34, width: size, height: size, rx: 7, class: 'algo-cell algo-ghost'});
      const label = s('text', {x: x0 + i * (size + gap) + size / 2, y: 64, 'text-anchor': 'middle', class: 'algo-val'});
      svg.append(rect, label);
      return {rect, label};
    });
    const capText = V.text(svg, x0, 106, '', 'algo-note');
    V.text(svg, 22, 190, t('成本', 'cost'), 'algo-head');
    const unit = 20;
    const average = s('line', {x1: x0, x2: x0 + 8 * (size + gap) - gap, class: 'algo-edge algo-dash is-hidden'});
    svg.append(average);
    const bars = Array.from({length: 8}, (_, i) => {
      const x = x0 + i * (size + gap) + 12;
      const rect = s('rect', {x, y: 212, width: size - 24, height: 0, rx: 3, class: 'algo-bar'});
      const label = s('text', {x: x + (size - 24) / 2, y: 226, 'text-anchor': 'middle', class: 'algo-idx', text: String(i + 1)});
      const value = s('text', {x: x + (size - 24) / 2, y: 206, 'text-anchor': 'middle', class: 'algo-note'});
      svg.append(rect, label, value);
      return {rect, value};
    });
    const total = V.text(svg, 600, 150, '', 'algo-strong', 'end');
    const averageText = V.text(svg, x0 + 8 * (size + gap), 0, '', 'algo-note');
    return frame => {
      slots.forEach((slot, i) => {
        const allocated = i < frame.capacity, filled = i < frame.size;
        slot.label.textContent = filled ? String(i + 1) : '';
        slot.rect.setAttribute('class', 'algo-cell' + (!allocated ? ' algo-ghost' : i === frame.size - 1 && !frame.done ? ' is-look' : frame.grew && i < frame.moved ? ' is-change' : ''));
      });
      capText.textContent = `${t('容量', 'capacity')} ${frame.capacity} · ${t('已用', 'used')} ${frame.size}`;
      bars.forEach((bar, i) => {
        const c = frame.costs[i];
        const h = c ? c * unit : 0;
        bar.rect.setAttribute('y', 212 - h); bar.rect.setAttribute('height', h);
        bar.rect.setAttribute('class', 'algo-bar' + (c > 1 ? ' is-tall' : '') + (i === frame.costs.length - 1 && !frame.done ? ' is-now' : ''));
        bar.value.setAttribute('y', 209 - h);
        bar.value.textContent = c ? String(c) : '';
      });
      total.textContent = frame.costs.length ? `${t('累计', 'total')} ${frame.total} / ${frame.costs.length} ${t('次', 'appends')}` : '';
      const mean = frame.done ? frame.total / frame.costs.length : 0;
      average.setAttribute('y1', 212 - mean * unit); average.setAttribute('y2', 212 - mean * unit);
      average.classList.toggle('is-hidden', !frame.done);
      averageText.setAttribute('y', 216 - mean * unit);
      averageText.textContent = frame.done ? t(`平均 ≈ ${mean.toFixed(1)}`, `mean ≈ ${mean.toFixed(1)}`) : '';
    };
  }});

  FIGURES['algo-knapsack'] = name => stepper(name, {modes: [
    {id: 'down', zh: '倒着更新（0/1 背包）', en: 'Downward (0/1 knapsack)', frames: F.knapsack('down')},
    {id: 'up', zh: '正着更新', en: 'Upward', frames: F.knapsack('up')}
  ]}, {height: 232, setup(svg) {
    const capacity = 4, value = 5;
    const arrow = name + '-arrow';
    svg.append(V.markers(arrow));
    V.text(svg, 24, 28, t('物品 (2,5) · 容量 4', 'Item (2,5) · capacity 4'), 'algo-head');
    const row = V.row(svg, Array(capacity + 1).fill(0), {x: 152, y: 100, size: 56, gap: 14, index: false});
    row.cells.forEach((_, c) => V.text(svg, row.x(c), 176, `best[${c}]`, 'algo-note', 'middle'));
    const arc = s('path', {class: 'algo-edge is-change algo-arc', 'marker-end': `url(#${arrow})`});
    svg.append(arc);
    const warn = V.text(svg, 0, 196, t('本轮刚写过', 'set this pass'), 'algo-warn', 'middle');
    const formula = V.text(svg, 320, 220, '', 'algo-strong', 'middle');
    return frame => {
      frame.best.forEach((v, c) => { row.cells[c].label.textContent = v; });
      row.cells.forEach((cell, c) => {
        cell.rect.setAttribute('class', 'algo-cell');
        const add = cls => cell.rect.classList.add(cls);
        if (frame.done) { if (c === capacity) add(frame.wrong ? 'is-bad' : 'is-keep'); else if (frame.written.includes(c)) add('is-written'); }
        else if (c === frame.room) add('is-change');
        else if (c === frame.from) add(frame.reused ? 'is-bad' : 'is-look');
        else if (frame.written.includes(c)) add('is-written');
      });
      const step = frame.room != null && !frame.done;
      arc.classList.toggle('is-hidden', !step);
      if (step) {
        const x1 = row.x(frame.from), x2 = row.x(frame.room);
        arc.setAttribute('d', `M${x1} 94 C${x1} 46 ${x2} 46 ${x2} 94`);
        arc.classList.toggle('is-bad', Boolean(frame.reused));
        arc.setAttribute('marker-end', `url(#${arrow}${frame.reused ? '-bad' : ''})`);
      }
      warn.classList.toggle('is-hidden', !(step && frame.reused));
      if (step) warn.setAttribute('x', row.x(frame.from));
      formula.textContent = frame.done ? `best[${capacity}] = ${frame.answer} ${frame.wrong ? '✗' : '✓'}`
        : step ? `best[${frame.room}] = max(${frame.old}, best[${frame.from}] + ${value}) = max(${frame.old}, ${frame.read} + ${value}) = ${frame.best[frame.room]}` : '';
    };
  }});
  for (const [name, build] of Object.entries(FIGURES)) build(name);
  scope.AlgoLab = {stepper, V, h, s, t};
})(typeof window === 'undefined' ? globalThis : window);
