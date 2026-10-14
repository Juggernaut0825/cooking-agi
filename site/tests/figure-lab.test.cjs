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

test('evaluation funnel: 100 → 80 → 70 → 60 → 55, end-to-end 0.55', () => {
  const end = last(F.funnel());
  assert.deepEqual(end.stages.map(s => s[2]), [100, 80, 70, 60, 55]);
  assert.deepEqual(end.rates.slice(1).map(r => r.en), ['80%', '87.5%', 'about 85.7%', 'about 91.7%']);
});

test('BLEU-2: the short answer scores 0.5134, the wrong time 0.7746', () => {
  const short = last(F.bleu('the bus leaves')), wrong = last(F.bleu('the bus leaves at nine'));
  assert.deepEqual([short.p1, short.p2, Number(short.score.toFixed(4))], [1, 1, 0.5134]);
  assert.deepEqual([wrong.p1, wrong.p2, wrong.bp, Number(wrong.score.toFixed(4))], [0.8, 0.75, 1, 0.7746]);
});

test('judge scores: raw 3.28, mass 0.80, rescaled 0.1/0.7/0.2, conditional mean 4.1', () => {
  const end = last(F.renorm());
  assert.deepEqual([end.raw, end.mass, end.mean], [3.28, 0.8, 4.1]);
  assert.deepEqual(end.scaled.map(([, p]) => p), [0.1, 0.7, 0.2]);
});

test('win rate: 20 tasks, 18 in the denominator, W_A = 10/18', () => {
  const end = last(F.winRate());
  const count = kind => end.tiles.filter(t => t === kind).length;
  assert.deepEqual(['a', 'b', 'tie', 'bad', 'unknown'].map(count), [8, 6, 4, 1, 1]);
  assert.equal((count('a') + 0.5 * count('tie')) / (count('a') + count('b') + count('tie')), 10 / 18);
});

test('weighted slices: 0.58 → 0.588 from +0.048 and −0.040', () => {
  const end = last(F.slices());
  assert.deepEqual([end.before, end.after, end.parts], [0.58, 0.588, [0.048, -0.04]]);
});

test('context staircase: 1000, 1200, 1400, 1600 = 5200', () => {
  const end = last(F.staircase(1000, 200, 4));
  assert.deepEqual([end.inputs, end.running], [[1000, 1200, 1400, 1600], 5200]);
});

test('skills: 3,480 on demand vs 23,280 up front', () => {
  const end = last(F.skills());
  assert.deepEqual([end.lazyTotal, end.eagerTotal], [3480, 23280]);
});

test('every frame has both captions and the English ones carry no Chinese', () => {
  const runs = [F.contrastive(), F.embeddingSwap(), F.rrf([['A', 'B', 'C'], ['B', 'C', 'D']]), F.rrf([['A', 'B', 'C'], []]), F.rrf([['A'], ['B']]),
    F.retrievalMetrics(), F.pq(), F.vitPatches(), F.qwenMerge(280, 560), F.qformerMask('itc'), F.qformerMask('itm'), F.qformerMask('itg'), F.flow(),
    F.funnel(), F.bleu('the bus leaves'), F.bleu('the bus leaves at nine'), F.renorm(), F.winRate(), F.slices(), F.staircase(), F.skills(), F.agentPatterns()];
  for (const frames of runs) for (const frame of frames) {
    assert.ok(frame.zh && frame.en);
    assert.doesNotMatch(frame.en, /[　-〿一-鿿＀-￯]/, frame.en);
  }
});
