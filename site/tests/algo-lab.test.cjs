const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {F} = require(path.join(__dirname, '../static/algo-lab.js'));

const last = list => list[list.length - 1];

/* Each figure must end where its note's worked table ends. */
test('knapsack: downward uses (2,5) once, upward reuses it', () => {
  assert.deepEqual(last(F.knapsack('down')).best, [0, 0, 5, 5, 5]);
  const up = last(F.knapsack('up'));
  assert.deepEqual([up.answer, up.wrong], [10, true]);
});

test('sieve: the primes up to 30', () => {
  assert.deepEqual(last(F.sieve(30)).primes, [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
});

test('monotonic queue: window maxima 4, 5, 5, 5', () => {
  assert.deepEqual(last(F.windowMax([4, 1, 3, 5, 2, 5], 3)).maxima, [4, 5, 5, 5]);
});

test('pointers and search: 3 + 8, "abba" gives 2, lower bound of 3 is 1', () => {
  const pair = last(F.twoPointers([1, 3, 5, 8, 12], 11));
  assert.deepEqual([pair.found, pair.left, pair.right], [true, 1, 3]);
  assert.equal(last(F.slidingWindow('abba')).best, 2);
  assert.equal(last(F.lowerBound([1, 3, 3, 7, 9], 3)).answer, 1);
});

test('prefix count: three subarrays of [1,-1,1] sum to 1', () => {
  assert.equal(last(F.prefixCount([1, -1, 1], 1)).total, 3);
});

test('house robber: table and memo both give 12, best(2) is reused', () => {
  assert.equal(last(F.robTable([2, 7, 9, 3, 1])).best[0], 12);
  const memo = F.robMemo([2, 7, 9, 3, 1]);
  assert.equal(last(memo).value.b0, 12);
  assert.ok(memo.some(frame => frame.hit), 'one frame reads best(2) from the cache');
});

test('BST: the local check is fooled, the bounds catch 6 under (8, 10)', () => {
  assert.equal(last(F.bstLocal()).verdict, false);
  const bounds = last(F.bstBounds());
  assert.deepEqual([bounds.bad, bounds.range.n6], ['n6', '(8, 10)']);
});

test('reverse list: 1 → 2 → 3 becomes 3 → 2 → 1', () => {
  assert.deepEqual(last(F.reverseList([1, 2, 3])).order, [3, 2, 1]);
});

test('KMP: prefix table [0,0,1,2], overlapping starts 0 and 2', () => {
  const end = last(F.kmp('ababab', 'abab'));
  assert.deepEqual([end.prefix, end.found], [[0, 0, 1, 2], [0, 2]]);
});

test('LCS of CAB and ACB is 2', () => {
  assert.deepEqual(last(F.lcs()).table, [[0, 0, 0, 0], [0, 0, 1, 1], [0, 1, 1, 1], [0, 1, 1, 2]]);
});

test('cooldown: [1,2,3,0,2] earns 3', () => {
  assert.equal(last(F.cooldown([1, 2, 3, 0, 2])).answer, 3);
});

test('jump game: [2,3,1,1,4] reaches, [3,2,1,0,4] stalls at 3', () => {
  assert.equal(last(F.jump([2, 3, 1, 1, 4])).ok, true);
  const stuck = last(F.jump([3, 2, 1, 0, 4]));
  assert.deepEqual([stuck.ok, stuck.farthest], [false, 3]);
});

test('amortized append: 8 appends cost 15', () => {
  const end = last(F.append(8));
  assert.deepEqual([end.costs, end.total, end.capacity], [[1, 2, 3, 1, 5, 1, 1, 1], 15, 8]);
});

test('every frame has a caption in both languages, and English has no Chinese', () => {
  const runs = [F.knapsack('down'), F.knapsack('up'), F.sieve(30), F.windowMax([4, 1, 3, 5, 2, 5], 3), F.twoPointers([1, 3, 5, 8, 12], 11),
    F.slidingWindow('abba'), F.lowerBound([1, 3, 3, 7, 9], 3), F.prefixCount([1, -1, 1], 1), F.robTable([2, 7, 9, 3, 1]), F.robMemo([2, 7, 9, 3, 1]),
    F.bstLocal(), F.bstBounds(), F.reverseList([1, 2, 3]), F.kmp(), F.lcs(), F.cooldown([1, 2, 3, 0, 2]), F.jump([2, 3, 1, 1, 4]),
    F.jump([3, 2, 1, 0, 4]), F.append(8)];
  for (const frames of runs) {
    assert.ok(frames.length >= 2);
    for (const frame of frames) {
      assert.ok(frame.zh && frame.en, JSON.stringify(frame).slice(0, 80));
      assert.doesNotMatch(frame.en, /[　-〿一-鿿＀-￯]/, frame.en);
    }
  }
});
