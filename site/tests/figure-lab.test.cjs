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

test('audio framing: 32,000 samples, 400 / 160 → 198 frames, last at 31,520, 80 left', () => {
  const end = last(F.audioFrames(32000, 400, 160));
  assert.deepEqual([end.count, end.lastStart, end.tail], [198, 31520, 80]);
});

test('VL2 layout: 210 + 1 + 1204 = 1415, 43 more than 7 × 196', () => {
  const end = last(F.vl2Layout(2, 3));
  assert.deepEqual([end.globalTokens, end.separator, end.local, end.total, end.naive], [210, 1, 1204, 1415, 1372]);
  assert.equal(last(F.vl2Layout(1, 1)).total, 421);
});

test('M-RoPE: the note\'s four cells, and the two derived ones marked as not given', () => {
  const cells = last(F.mrope(7, 2, 3)).cells;
  const pick = (r, c) => cells.find(x => x.r === r && x.c === c);
  assert.deepEqual([[0, 0], [0, 1], [0, 2], [1, 0]].map(([r, c]) => { const x = pick(r, c); return [x.t, x.h, x.w, x.given]; }),
    [[7, 7, 7, true], [7, 7, 8, true], [7, 7, 9, true], [7, 8, 7, true]]);
  assert.deepEqual([pick(1, 1).given, pick(1, 2).given], [false, false]);
});

test('perplexity windows: 3 + 2 = 5 scored targets', () => {
  const end = last(F.pplWindows());
  assert.deepEqual(end.windows.map(w => w.scored.length), [3, 2]);
});

test('IVF: the nearest centroid is A, but the nearest point is in B', () => {
  const end = last(F.ivf());
  assert.equal(end.order[0], 'A');
  assert.deepEqual([end.one.k, end.two.k], ['A', 'B']);
  assert.ok(end.two.d < end.one.d);
});

test('every frame has both captions and the English ones carry no Chinese', () => {
  const runs = [F.contrastive(), F.embeddingSwap(), F.rrf([['A', 'B', 'C'], ['B', 'C', 'D']]), F.rrf([['A', 'B', 'C'], []]), F.rrf([['A'], ['B']]),
    F.retrievalMetrics(), F.pq(), F.vitPatches(), F.qwenMerge(280, 560), F.qformerMask('itc'), F.qformerMask('itm'), F.qformerMask('itg'), F.flow(),
    F.funnel(), F.bleu('the bus leaves'), F.bleu('the bus leaves at nine'), F.renorm(), F.winRate(), F.slices(), F.staircase(), F.skills(), F.agentPatterns(),
    F.audioFrames(), F.vl2Layout(), F.mrope(), F.pplWindows(), F.ivf()];
  for (const frames of runs) for (const frame of frames) {
    assert.ok(frame.zh && frame.en);
    assert.doesNotMatch(frame.en, /[　-〿一-鿿＀-￯]/, frame.en);
  }
});

test('best-of-2: A 0.25, B 0.39, C 0.36', () => {
  assert.deepEqual(last(F.bestOfN()).picked, {A: 0.25, B: 0.39, C: 0.36});
});

test('Bradley–Terry: a shift keeps 0.731, a scale gives 0.881', () => {
  assert.deepEqual(F.btScale().map(f => [f.gap, f.prob]), [[1, 0.731], [1, 0.731], [2, 0.881], [2, 0.881]]);
});

test('DAPO: response mean 2, token mean 2.5, rank means 2, W/N scaling 2.5', () => {
  const end = last(F.tokenMean());
  assert.deepEqual([end.responseMean, end.tokenMean, end.ddp], [2, 2.5, 2.5]);
  assert.deepEqual(end.scaled, [0.5, 4.5]);
});

test('KL penalty: log-ratios 0.47 / -0.9163, shaped 0.906 / 1.1833, KL 0.1927, objective 0.9615', () => {
  const end = last(F.klPenalty());
  assert.deepEqual([end.logRatio, end.shaped, end.kl, end.objective], [[0.47, -0.9163], [0.906, 1.1833], 0.1927, 0.9615]);
});

test('behavior ratio: b = [2/3, 1/3], 0.75 against b, 1.25 against the raw 0.2', () => {
  const end = last(F.behaviorRatio());
  assert.deepEqual([end.behavior, end.right, end.wrong], [[0.6667, 0.3333], 0.75, 1.25]);
});

test('chunked prefill: budget 6 gives 4, 4, 2; budget 12 gives 10', () => {
  assert.deepEqual(F.chunkedPrefill(6)[0].chunks, [4, 4, 2]);
  assert.deepEqual(F.chunkedPrefill(12)[0].chunks, [10]);
  assert.ok(last(F.chunkedPrefill(6)).done);
});

test('continuous batching: 8 rounds with 6 empty slots, or 5 rounds with none', () => {
  const fixed = last(F.continuousBatching(false)), refill = last(F.continuousBatching(true));
  assert.deepEqual(fixed.schedule.map(r => r.join('')), ['AB', 'AB', 'B', 'B', 'B', 'C', 'C', 'C']);
  assert.deepEqual([fixed.total, fixed.empty, refill.total, refill.empty, refill.start], [8, 6, 5, 0, 3]);
});

test('L1 vs L2 with a = 0.4, λ = 0.5: L2 ≈ 0.267, L1 = 0, slopes +0.1 / -0.9', () => {
  const end = last(F.l1L2());
  assert.deepEqual([end.l2, end.l1, end.right, end.left], [0.267, 0, 0.1, -0.9]);
});

test('BCE vs MSE at z = 10: BCE gradient ≈ 0.99995, MSE ≈ 4.54e-5', () => {
  const end = last(F.bceVsMse());
  assert.equal(Number(end.bce.toFixed(5)), 0.99995);
  assert.equal(Number(end.mse.toExponential(2)), 4.54e-5);
});

test('AdamW 1.96 vs Adam + L2 ≈ 1.9', () => {
  const end = last(F.adamwL2());
  assert.deepEqual([end.adamw, end.m, end.v, end.mHat, end.vHat, end.adamL2], [1.96, 0.04, 0.00016, 0.4, 0.16, 1.9]);
});

test('packing: 5 targets in a stream, 4 once EOS → C is masked', () => {
  const frames = F.packingMasks();
  assert.equal(frames[1].scored, 5);
  assert.deepEqual(last(frames).loss, [1, 1, 0, 1, 1]);
  assert.equal(last(frames).scored, 4);
  assert.deepEqual(last(frames).block[3], [false, false, false, true, false, false]);
});

test('tensor-parallel backward: [3, 3] + [6, 0] = [9, 3]', () => {
  const end = last(F.tpBackward());
  assert.deepEqual([end.Y, end.parts, end.dX], [[9, 6], [[3, 3], [6, 0]], [9, 3]]);
});

test('BPE: 20 → 15 → 10 symbols, rair encodes as rai r', () => {
  const frames = F.bpeMerges();
  assert.deepEqual(frames.map(f => f.symbols), [20, 20, 15, 15, 10, 10]);
  assert.deepEqual(last(frames).encoding.map(e => e.join(' ')), ['r a i r', 'ra i r', 'rai r']);
});

test('SwiGLU: h = [0, 1.4621], y ≈ -1.4621, gate gradient 1.5', () => {
  const end = last(F.swiglu());
  assert.deepEqual([end.h, end.y, end.gradU, end.gradG], [[0, 1.4621], -1.4621, 0, 1.5]);
});

test('depth merge: averaging gives 2, the stored sums give 3', () => {
  const end = last(F.depthMerge());
  assert.deepEqual([end.naive, end.merged, end.full], [2, 3, 3]);
});

test('expert budget: 196,608 active three ways, 221,184 with an extra shared expert', () => {
  const end = last(F.expertBudget());
  assert.deepEqual([end.coarse.lit, end.fine.lit, end.sharedSwap.lit, end.extra.lit], [196608, 196608, 196608, 221184]);
  assert.equal(end.coarse.total, 786432);
  assert.equal(end.increase, 0.125);
});

test('verifier ceiling: 46 pass, 87.0% right, ceilings 100 / 97.1 / 87.0 / 69.0', () => {
  const frames = F.verifierCeiling(0.10), end = last(frames);
  assert.equal(frames[1].kept, 46);
  assert.equal(Number((end.precision * 100).toFixed(1)), 87);
  assert.equal(end.right, 87);
  assert.deepEqual(end.ceilings.map(c => Number((c.value * 100).toFixed(1))), [100, 97.1, 87, 69]);
});

test('time horizon: slope -0.74, 2 h at 50%, 33 min at 80%, then 34 h and 108 h beyond the task range', () => {
  const frames = F.timeHorizon();
  assert.equal(Number(frames[1].run.slope.toFixed(2)), -0.74);
  assert.equal(Number(frames[2].run.h50.toFixed(2)), 2);
  assert.equal(Math.round(frames[3].run.h80 * 60), 33);
  assert.equal(Math.round(frames[4].run.h50), 34);
  assert.equal(Math.round(last(frames).run.h50), 108);
});

test('evaluator rank: Pearson 0.98, Spearman 0.9, MMRV 0.04, picks D over E, top-3 Spearman 0.5', () => {
  const end = last(F.evaluatorRank());
  assert.equal(Number(end.pearson.toFixed(2)), 0.98);
  assert.equal(Number(end.spearman.toFixed(2)), 0.9);
  assert.equal(Number(end.mmrv.toFixed(2)), 0.04);
  assert.equal(end.picked, 'D');
  assert.equal(end.best, 'E');
  assert.equal(Number(end.top3.toFixed(2)), 0.5);
});

test('MCTS visits: L, L, R, R, R, R gives N = (2, 4) and pi = (0.33, 0.67), (0.2, 0.8) at tau 0.5', () => {
  const frames = F.mctsVisits();
  assert.deepEqual(frames.slice(1, 7).map(f => f.pick), [0, 0, 1, 1, 1, 1]);
  assert.deepEqual(round(frames[3].score, 2), [0.48, 0.57]);
  const end = last(frames);
  assert.deepEqual(end.N, [2, 4]);
  assert.deepEqual(round(end.pi1, 2), [0.33, 0.67]);
  assert.deepEqual(round(end.pi05, 2), [0.2, 0.8]);
});

test('lambda return: 0.8, 1.72, 1.044, 0.695; lambda 0 gives 0.45, lambda 1 gives 1.393; a wrong fall gives -0.225', () => {
  const frames = F.lambdaReturn();
  assert.deepEqual(frames[4].R.map(x => Number(x.toFixed(3))), [0.695, 1.044, 1.72, 0.8]);
  assert.equal(Number(frames[5].lam0.toFixed(3)), 0.45);
  assert.equal(Number(frames[5].lam1.toFixed(3)), 1.393);
  const end = frames[frames.length - 1];
  assert.equal(Number(end.R[0].toFixed(3)), -0.225);
  assert.equal(end.R[1], -1);
});

test('reliance groups: AI 0.80; teams 0.70, 0.80, 0.85, 0.825, 0.80, 0.76; chance agreement in L 0.53', () => {
  const frames = F.relianceGroups(), end = last(frames);
  assert.equal(Number(frames[1].overall.toFixed(3)), 0.8);
  assert.equal(frames[2].shown, 3);
  assert.deepEqual(end.policies.map(p => Number(p.acc.toFixed(3))), [0.7, 0.8, 0.85, 0.825, 0.8, 0.76]);
  assert.equal(Number(end.agree.toFixed(3)), 0.53);
  assert.equal(end.shown, 6);
});

test('judge sampling: q 0.87, corrected 0.90 ± 2.6, MDE 5.3, Wilson 64–95%, 1,480 calls, slice MDE 7.4, drift still 0.870', () => {
  const frames = F.judgeSampling(), end = last(frames);
  assert.equal(Number(frames[1].q.toFixed(3)), 0.87);
  assert.deepEqual([frames[1].cells.tp, frames[1].cells.fp].map(x => Number(x.toFixed(3))), [0.855, 0.015]);
  assert.equal(Number(frames[2].pHat.toFixed(3)), 0.9);
  assert.equal(Number((frames[2].half * 100).toFixed(1)), 2.6);
  assert.equal(Number((frames[3].mdeAll * 100).toFixed(1)), 5.3);
  assert.equal(frames[4].sliceN, 20);
  assert.deepEqual([frames[4].lo, frames[4].hi].map(x => Math.round(x * 100)), [64, 95]);
  assert.equal(Number((frames[4].move * 100).toFixed(1)), 0.6);
  assert.equal(frames[5].strat + frames[5].rest, 1480);
  assert.equal(Number((frames[5].sliceMde * 100).toFixed(1)), 7.4);
  assert.equal(end.q2.toFixed(3), '0.870');
  assert.equal(end.cells.t, 0.75);
});

test('subagent timeline: 130 s, 60 s, 160 s; 53k vs 71k (+34%), longest 20.5k; 0.729, 0.807, 0.625, d* 5.3%', () => {
  const frames = F.subagentTimeline(), end = last(frames);
  assert.deepEqual(end.time, {single: 130, parallel: 60, chained: 160});
  assert.deepEqual([end.tokens.single, end.tokens.lead, end.tokens.sub, end.tokens.multi], [53, 9.5, 20.5, 71]);
  assert.equal(Math.round(end.rise * 100), 34);
  assert.equal(Number(frames[3].pSingle.toFixed(3)), 0.729);
  assert.deepEqual(frames[3].pMulti.map(x => Number(x.toFixed(3))), [0.807, 0.625]);
  assert.equal(Number((frames[3].dStar * 100).toFixed(1)), 5.3);
  assert.equal(end.chained.filter(b => b.lane === 'lead').length, 4);
});
