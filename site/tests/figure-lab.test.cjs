const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {F} = require(path.join(__dirname, '../static/figure-lab.js'));

const last = list => list[list.length - 1];
const round = (values, digits = 3) => values.map(v => Number(v.toFixed(digits)));

/* Each figure must end where its note's worked example ends. */
test('dual encoder: softmax [0.665, 0.245, 0.090], loss 0.408, gradients [-0.335, 0.245, 0.090]', () => {
  const end = last(F.contrastive([2, 1, 0]));
  assert.deepEqual(round(end.p), [0.665, 0.245, 0.09]);
  assert.equal(Number(end.loss.toFixed(3)), 0.408);
  assert.deepEqual(round(end.grad), [-0.335, 0.245, 0.09]);
});

test('embedding swap: mixed spaces flip to [0, 1], rebuilt index returns [1, 0]', () => {
  const frames = F.embeddingSwap();
  assert.deepEqual(frames.map(f => f.scores), [[1, 0], [1, 0], [0, 1], [1, 0]]);
  assert.equal(frames[2].top, 'B');
});

test('RRF with k = 10: B → C → A → D, keyword only A → B → C, top 1 ties A and B', () => {
  const full = last(F.rrf([['A', 'B', 'C'], ['B', 'C', 'D']]));
  assert.equal(full.order, 'B → C → A → D');
  assert.deepEqual(Object.values(full.totals).map(v => Number(v.toFixed(4))), [0.1742, 0.1603, 0.0909, 0.0769]);
  assert.equal(last(F.rrf([['A', 'B', 'C'], []])).order, 'A → B → C');
  assert.equal(last(F.rrf([['A'], ['B']])).order, 'A = B');
});

test('retrieval metrics: 1, 1/3, 1/3, 1/2; with relevant {C}, recall becomes 1', () => {
  const frames = F.retrievalMetrics();
  assert.deepEqual(frames[1].hits, ['C']);
  assert.deepEqual(last(frames).values, {hit: '1', precision: '1/3', recall: '1', rr: '1/2'});
});

test('PQ: code [1, 1] is 2, code [2, 1] is 14', () => {
  assert.deepEqual(last(F.pq()).results, [[[1, 1], 2], [[2, 1], 14]]);
});

test('ViT: embeddings and the [2, 3, 4, 5] collision', () => {
  const end = last(F.vitPatches());
  assert.deepEqual(end.patches, [[1, 2, 5, 6], [3, 4, 7, 8], [9, 10, 13, 14], [11, 12, 15, 16]]);
  assert.deepEqual(end.embeddings, [[3.5, 1], [5.5, 1], [11.5, 1], [13.5, 1]]);
  assert.deepEqual(end.otherEmbedding, [3.5, 1]);
});

test('Qwen merge: 400 → 100, 800 → 200, 1600 → 400', () => {
  for (const [h, w, before, after] of [[280, 280, 400, 100], [280, 560, 800, 200], [560, 560, 1600, 400]]) {
    const end = last(F.qwenMerge(h, w));
    assert.deepEqual([end.ph * end.pw, end.mh * end.mw], [before, after]);
  }
});

test('Q-Former masks match the note: ITG rows 0 and 3', () => {
  const itg = F.qformerMask('itg')[0].mask;
  assert.deepEqual(itg[0], [true, true, false, false, false]);
  assert.deepEqual(itg[3], [true, true, true, true, false]);
  assert.ok(F.qformerMask('itm')[0].mask.flat().every(Boolean));
  assert.deepEqual(F.qformerMask('itc')[0].mask[0], [true, true, false, false, false]);
});

test('flow matching: position 4, velocity 8, loss 4, one Euler step to 4.6', () => {
  const end = last(F.flow(2, 10, 0.25, 6, 0.1));
  assert.deepEqual([end.position, end.velocity, end.loss, end.next], [4, 8, 4, 4.6]);
});

test('every frame has both captions and the English ones carry no Chinese', () => {
  const runs = [F.contrastive(), F.embeddingSwap(), F.rrf([['A', 'B', 'C'], ['B', 'C', 'D']]), F.rrf([['A', 'B', 'C'], []]), F.rrf([['A'], ['B']]),
    F.retrievalMetrics(), F.pq(), F.vitPatches(), F.qwenMerge(280, 560), F.qformerMask('itc'), F.qformerMask('itm'), F.qformerMask('itg'), F.flow()];
  for (const frames of runs) for (const frame of frames) {
    assert.ok(frame.zh && frame.en);
    assert.doesNotMatch(frame.en, /[　-〿一-鿿＀-￯]/, frame.en);
  }
});
