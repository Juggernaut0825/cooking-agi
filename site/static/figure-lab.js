/* Chapter figures: small steppers and diagrams for the study notes.
   Loaded by app.js after algo-lab.js, only on pages with a [data-widget^="step-"]
   figure, and drawn with the same stepper and vocabulary (window.AlgoLab).

   As in algo-lab.js, each figure replays the worked example written in its note:
   a pure builder returns the frames (state + captions in both languages), the
   drawing only shows the current frame, and the last frame ends on the note's
   own result. The builders are exported for Node so tests can check that. */
(function (scope) {
  'use strict';

  /* ---------------------------------------------------------------- frames (pure) */
  const F = {};
  function frames(list) {
    list.forEach((frame, i) => { if (!frame.zh || !frame.en) throw Error('caption ' + i); });
    return list;
  }
  const fixed = (x, digits) => x.toFixed(digits);
  const signed = (x, digits) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(digits);

  /* 04-search/dual-encoder §3: one positive, two comparisons, scores [2, 1, 0], temperature 1. */
  F.contrastive = function (scores = [2, 1, 0]) {
    const exps = scores.map(Math.exp), total = exps.reduce((a, b) => a + b, 0);
    const p = exps.map(e => e / total), loss = -Math.log(p[0]);
    const grad = p.map((x, j) => x - (j === 0 ? 1 : 0));
    const state = stage => ({stage, scores, exps, total, p, loss, grad});
    return frames([
      {...state(0), zh: `温度先取 1。一个正例、两个对照，分数是 [${scores.join(', ')}]。`,
        en: `Temperature 1 for now. One positive and two comparisons, with scores [${scores.join(', ')}].`},
      {...state(1), zh: `先取指数：${exps.map(e => fixed(e, 2)).join('、')}，加起来 ${fixed(total, 2)}。`,
        en: `Exponentiate: ${exps.map(e => fixed(e, 2)).join(', ')}, which add up to ${fixed(total, 2)}.`},
      {...state(2), zh: `每个除以总和就是 softmax：约 [${p.map(x => fixed(x, 3)).join(', ')}]，三个加起来是 1。`,
        en: `Divide each by the total to get the softmax: about [${p.map(x => fixed(x, 3)).join(', ')}], summing to 1.`},
      {...state(3), zh: `损失只看正例：−log ${fixed(p[0], 3)} ≈ ${fixed(loss, 3)}。正例的概率越接近 1，损失越接近 0。`,
        en: `The loss looks only at the positive: −log ${fixed(p[0], 3)} ≈ ${fixed(loss, 3)}. The closer its probability gets to 1, the closer the loss gets to 0.`},
      {...state(4), zh: `梯度是 p − 1[j = 正例]，约为 [${grad.map(g => signed(g, 3)).join(', ')}]。梯度下降抬高正例、压低对照，得分高的那个对照被压得更用力。`,
        en: `The gradient is p − 1[j = positive], about [${grad.map(g => signed(g, 3)).join(', ')}]. Descent raises the positive and lowers the comparisons, pushing harder on the higher-scoring one.`},
      {...state(4), done: true, zh: '这是把三个分数当成独立变量时的方向。真正的 encoder 共用参数，一次更新不保证每个分数都这样变；对原始分数还要再乘 1/τ。',
        en: 'That is the direction if the three scores were independent. A real encoder shares parameters, so one update need not move every score this way; gradients for the raw scores carry another factor of 1/τ.'}
    ]);
  };

  /* 04-search/embedding-models: a new model that only rotates everything by 90 degrees. */
  F.embeddingSwap = function () {
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
    const oldQ = [1, 0], oldA = [1, 0], oldB = [0, 1], newQ = [0, 1], newA = [0, 1], newB = [-1, 0];
    const make = (query, queryKind, a, b, docKind, extra) => {
      const scores = [dot(query, a), dot(query, b)];
      return {query, queryKind, docs: [{name: 'A', at: a}, {name: 'B', at: b}], docKind, scores, top: scores[0] >= scores[1] ? 'A' : 'B', ...extra};
    };
    return frames([
      {...make(oldQ, 'old', oldA, oldB, 'old'), zh: '旧系统：问题向量 (1, 0)，正确文档 A 是 (1, 0)，文档 B 是 (0, 1)。点积分别是 1 和 0，A 排第一。',
        en: 'Old system: the query is (1, 0), the right document A is (1, 0), and B is (0, 1). Dot products 1 and 0: A ranks first.'},
      {...make(newQ, 'new', newA, newB, 'new'), zh: '新模型只是把所有向量一起转了 90 度。在它自己的空间里：(0, 1) 对新 A (0, 1) 得 1，对新 B (−1, 0) 得 0，检索没变。',
        en: 'The new model merely rotates every vector by 90 degrees. In its own space, (0, 1) scores 1 against the new A (0, 1) and 0 against the new B (−1, 0): retrieval is unchanged.'},
      {...make(newQ, 'new', oldA, oldB, 'old', {bad: true}), zh: '只上线新的 query encoder，继续查旧索引：新问题 (0, 1) 对旧 A 得 0，对旧 B 得 1，排序反了。维度都一样，坐标却对不上。',
        en: 'Ship only the new query encoder and keep the old index: the new query (0, 1) scores 0 against the old A and 1 against the old B. The ranking flips; same dimension, different coordinates.'},
      {...make(newQ, 'new', newA, newB, 'new', {done: true}), zh: '用新模型把文档重新编码、重建索引，分数回到 [1, 0]。换 embedding 模型，查询和索引要一起换。',
        en: 'Re-encode the documents with the new model and rebuild the index: the scores return to [1, 0]. Changing the embedding model means changing the query side and the index together.'}
    ]);
  };

  /* 04-search/hybrid-and-reranking: Reciprocal Rank Fusion with k = 10. */
  F.rrf = function (lists, k = 10) {
    const [keyword, dense] = lists, docs = ['A', 'B', 'C', 'D'];
    const parts = Object.fromEntries(docs.map(d => [d, [0, 0]]));
    const label = (d, rank) => ({doc: d, rank, frac: `1/${k + rank}`});
    const snapshot = () => Object.fromEntries(docs.map(d => [d, parts[d].slice()]));
    const total = d => parts[d][0] + parts[d][1];
    const list = [{lists, parts: snapshot(), stage: 0,
      zh: `两路检索各自返回名次。RRF 不看原始分数，每个名次贡献 1/(k + 名次)，这里 k = ${k}。`,
      en: `Each source returns its own ranking. RRF ignores raw scores: each rank contributes 1/(k + rank), with k = ${k} here.`}];
    keyword.forEach((d, i) => { parts[d][0] += 1 / (k + i + 1); });
    list.push({lists, parts: snapshot(), stage: 1,
      zh: `关键词这一路：${keyword.map((d, i) => `${d} 得 1/${k + i + 1}`).join('，')}。`,
      en: `Keyword list: ${keyword.map((d, i) => `${d} gets 1/${k + i + 1}`).join(', ')}.`});
    if (dense.length) {
      dense.forEach((d, i) => { parts[d][1] += 1 / (k + i + 1); });
      list.push({lists, parts: snapshot(), stage: 2,
        zh: `向量这一路：${dense.map((d, i) => `${d} 得 1/${k + i + 1}`).join('，')}。同时出现在两路的文档，两份贡献相加。`,
        en: `Dense list: ${dense.map((d, i) => `${d} gets 1/${k + i + 1}`).join(', ')}. A document in both lists adds both contributions.`});
    } else {
      list.push({lists, parts: snapshot(), stage: 2,
        zh: '向量这一路关掉了：没有它，D 根本进不了候选集。',
        en: 'The dense source is switched off: without it, D never enters the candidate set.'});
    }
    const ranked = docs.filter(d => total(d) > 0).sort((a, b) => total(b) - total(a) || a.localeCompare(b));
    const groups = [];
    ranked.forEach(d => { const last = groups[groups.length - 1]; if (last && Math.abs(total(last[0]) - total(d)) < 1e-12) last.push(d); else groups.push([d]); });
    const order = groups.map(g => g.join(' = ')).join(' → ');
    const tie = groups.some(g => g.length > 1);
    list.push({lists, parts: snapshot(), stage: 3, done: true, order, groups,
      totals: Object.fromEntries(ranked.map(d => [d, total(d)])),
      zh: tie ? `融合结果：${groups.map(g => g.join('、')).join(' → ')}${groups[0].length > 1 ? ' 并列' : ''}。每路只取前 1，B 失去了关键词第二名那一份支持。融合器只能用实际拿到的结果。`
        : `融合结果：${groups.map(g => g.join('')).join(' → ')}。` + (dense.length ? `${ranked[0]} 收到两路支持，即使 A 在关键词里排第一，也没有赢。` : '融合器只能用实际拿到的结果，调大 k 也不会让没召回的 D 出现。'),
      en: tie ? `Fused: ${groups.map(g => g.join(' and ')).join(' → ')}${groups[0].length > 1 ? ' tie' : ''}. With top 1 from each source, B loses its second-place keyword contribution. Fusion can use only what it receives.`
        : `Fused: ${groups.map(g => g.join('')).join(' → ')}.` + (dense.length ? ` ${ranked[0]} has support from both lists; A is first in keyword search and still does not win.` : ' Fusion can use only what it receives; a larger k cannot bring back D, which was never retrieved.')});
    return frames(list);
  };

  /* 04-search/rag-evidence §3: relevant {A, C, E}, top 3 returned [B, C, D]. */
  F.retrievalMetrics = function () {
    const returned = ['B', 'C', 'D'];
    const base = {returned, relevant: ['A', 'C', 'E']};
    const shown = n => ['hit', 'precision', 'recall', 'rr'].slice(0, n);
    return frames([
      {...base, stage: 0, metrics: [], zh: '一个查询，完整标注的相关文档是 {A, C, E}；系统返回的前 3 篇是 [B, C, D]。',
        en: 'For one query, the fully labeled relevant set is {A, C, E}; the system returns [B, C, D] as its top 3.'},
      {...base, stage: 1, metrics: [], hits: ['C'], zh: '只有排第 2 的 C 是相关的；B、D 不在标注集合里。',
        en: 'Only C, at rank 2, is relevant; B and D are not in the labeled set.'},
      {...base, stage: 2, metrics: shown(1), hits: ['C'], zh: 'Hit@3 = 1：前 3 篇里至少命中了一篇。',
        en: 'Hit@3 = 1: at least one of the top 3 is relevant.'},
      {...base, stage: 3, metrics: shown(2), hits: ['C'], zh: 'Precision@3 = 1/3：返回的 3 篇里有 1 篇相关。',
        en: 'Precision@3 = 1/3: one of the 3 returned documents is relevant.'},
      {...base, stage: 4, metrics: shown(3), hits: ['C'], missed: ['A', 'E'], zh: 'Recall@3 = 1/3：3 篇相关文档只找回 1 篇，A 和 E 没进前 3。',
        en: 'Recall@3 = 1/3: of the 3 relevant documents, only 1 was found; A and E did not make the top 3.'},
      {...base, stage: 5, metrics: shown(4), hits: ['C'], missed: ['A', 'E'], zh: 'Reciprocal rank = 1/2：第一篇相关文档排在第 2。MRR 是多个查询的平均，不是这一个数的别名。',
        en: 'Reciprocal rank = 1/2: the first relevant document is at rank 2. MRR averages this over many queries; it is not another name for one query’s value.'},
      {returned, relevant: ['C'], stage: 6, metrics: shown(4), hits: ['C'], done: true, values: {hit: '1', precision: '1/3', recall: '1', rr: '1/2'},
        zh: '把相关集合改成 {C}：Precision 仍是 1/3，Recall 变成 1。两者这次相同只是巧合。',
        en: 'Change the relevant set to {C}: precision stays at 1/3, while recall becomes 1. They matched before only by coincidence.'}
    ]);
  };

  /* 04-search/vector-indexes: product quantization with asymmetric distance. */
  F.pq = function () {
    const query = [[1, 2], [3, 4]];
    const codebooks = [[[0, 0], [1, 1], [4, 4]], [[0, 0], [3, 3], [5, 5]]];
    const sq = (a, b) => a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0);
    const table = codebooks.map((book, m) => book.map(center => sq(query[m], center)));
    const lookup = code => code.map((c, m) => table[m][c]);
    const base = {query, codebooks, table};
    const sum = code => lookup(code).reduce((a, b) => a + b, 0);
    return frames([
      {...base, stage: 0, zh: '查询向量 [1, 2, 3, 4] 切成两段：[1, 2] 和 [3, 4]。每一段单独量化。',
        en: 'Split the query [1, 2, 3, 4] into two parts, [1, 2] and [3, 4]. Each part is quantized on its own.'},
      {...base, stage: 1, zh: '每段各有一本 3 个码字的码本。库里的向量不存原值，只存每段用了第几个码字。',
        en: 'Each part has its own codebook of 3 codewords. A stored vector keeps only the index of the codeword chosen for each part.'},
      {...base, stage: 2, zh: `先为这个查询算一张表：第一段到三个码字的距离是 ${table[0].join('、')}，第二段是 ${table[1].join('、')}（都是平方距离）。`,
        en: `First build a table for this query: the first part is ${table[0].join(', ')} from the three codewords, the second ${table[1].join(', ')} (squared distances).`},
      {...base, stage: 3, code: [1, 1], picks: lookup([1, 1]), total: sum([1, 1]), zh: `编码 [1, 1] 代表重建向量 [1, 1, 3, 3]。不用还原它，直接查表相加：${lookup([1, 1]).join(' + ')} = ${sum([1, 1])}。`,
        en: `Code [1, 1] stands for the reconstruction [1, 1, 3, 3]. No need to rebuild it: look up and add, ${lookup([1, 1]).join(' + ')} = ${sum([1, 1])}.`},
      {...base, stage: 4, code: [2, 1], picks: lookup([2, 1]), total: sum([2, 1]), zh: `编码 [2, 1]：${lookup([2, 1]).join(' + ')} = ${sum([2, 1])}。`,
        en: `Code [2, 1]: ${lookup([2, 1]).join(' + ')} = ${sum([2, 1])}.`},
      {...base, stage: 5, done: true, results: [[[1, 1], sum([1, 1])], [[2, 1], sum([2, 1])]], zh: '每条向量只存两个编号；扫描时每条只做两次查表和一次加法。比较两个和，[1, 1] 这条更近（2 < 14）。',
        en: 'Each stored vector is just two indices; scanning costs two lookups and one addition per vector. Comparing the sums, [1, 1] is the nearer one (2 < 14).'}
    ]);
  };

  /* 03-multimodal-learning/vit: a made-up 4 x 4 single-channel image, 2 x 2 patches. */
  F.vitPatches = function () {
    const image = Array.from({length: 4}, (_, r) => Array.from({length: 4}, (_, c) => 1 + 4 * r + c));
    const patches = [];
    for (let top = 0; top < 4; top += 2) for (let left = 0; left < 4; left += 2) {
      patches.push([image[top][left], image[top][left + 1], image[top + 1][left], image[top + 1][left + 1]]);
    }
    const weights = [[0.25, 0.25, 0.25, 0.25], [-0.5, 0.5, -0.5, 0.5]];
    const project = patch => weights.map(row => row.reduce((sum, w, i) => sum + w * patch[i], 0));
    const embeddings = patches.map(project);
    const other = [2, 3, 4, 5];
    const base = {image, patches, weights, embeddings};
    const vec = v => `[${v.join(', ')}]`;
    return frames([
      {...base, stage: 0, zh: '一张自拟的 4×4 单通道小图（不是训练结果），切成 4 个 2×2 小块。',
        en: 'A made-up 4×4 single-channel image (not a trained result), cut into four 2×2 patches.'},
      {...base, stage: 1, current: 0, flat: 1, zh: `左上块按行展平：${vec(patches[0])}。`,
        en: `Flatten the top-left patch row by row: ${vec(patches[0])}.`},
      {...base, stage: 2, flat: 4, zh: `从左上到右下依次展平，得到 4 个 token、每个 4 个数：${patches.map(vec).join('、')}。`,
        en: `Flatten all four from top-left to bottom-right: 4 tokens of 4 numbers each, ${patches.map(vec).join(', ')}.`},
      {...base, stage: 3, flat: 4, current: 0, projected: 1, zh: `人为选两个投影：块内均值、右列均值减左列均值。左上块变成 ${vec(embeddings[0])}。真实模型会自己学权重。`,
        en: `Choose two projections by hand: the patch mean, and the right-column mean minus the left-column mean. The top-left patch becomes ${vec(embeddings[0])}. A real model learns its weights.`},
      {...base, stage: 4, flat: 4, projected: 4, zh: `同一组权重用在每一块上：${embeddings.map(vec).join('、')}。`,
        en: `The same weights apply to every patch: ${embeddings.map(vec).join(', ')}.`},
      {...base, stage: 5, flat: 4, projected: 4, done: true, other, otherEmbedding: project(other), zh: `限制也在这里：${vec(other)} 也输出 ${vec(project(other))}，和左上块一样。后面的注意力没法从这两个数里找回被丢掉的差异。`,
        en: `Here is the limit: ${vec(other)} also gives ${vec(project(other))}, the same as the top-left patch. Later attention cannot recover the lost difference from these two numbers.`}
    ]);
  };

  /* 03-multimodal-learning/qwen-vl: 14-pixel patches, then 2 x 2 spatial merge. */
  F.qwenMerge = function (height, width) {
    const ph = height / 14, pw = width / 14, mh = height / 28, mw = width / 28;
    const base = {height, width, ph, pw, mh, mw};
    return frames([
      {...base, stage: 0, zh: `处理后的图片是 ${height} × ${width}（高 × 宽），都能被 28 整除。`,
        en: `The processed image is ${height} × ${width} (height × width), both divisible by 28.`},
      {...base, stage: 1, zh: `按 14 像素切块：${ph} × ${pw} = ${ph * pw} 个 patch。`,
        en: `Cut into 14-pixel patches: ${ph} × ${pw} = ${ph * pw} patches.`},
      {...base, stage: 2, zh: `相邻 2×2 个 patch 合成一个视觉位置：${mh} × ${mw} = ${mh * mw}。`,
        en: `Merge each 2×2 group of neighboring patches into one visual position: ${mh} × ${mw} = ${mh * mw}.`},
      {...base, stage: 3, done: true, zh: `所以 N = H/28 · W/28 = ${mh * mw}。长度随图片尺寸变化；公式不含文字、边界标记和视频的时间维，以 processor 实际输出为准。`,
        en: `So N = H/28 · W/28 = ${mh * mw}. The length follows the image size; the formula leaves out text, boundary markers and video time, so check what the processor actually outputs.`}
    ]);
  };

  /* 03-multimodal-learning/blip-and-q-former: the note's visibility_mask, 2 queries + 3 text positions. */
  F.qformerMask = function (objective, queries = 2, texts = 3) {
    const total = queries + texts, mask = [];
    for (let row = 0; row < total; row++) {
      const rowQuery = row < queries, line = [];
      for (let col = 0; col < total; col++) {
        const colQuery = col < queries;
        line.push(objective === 'itm' ? true : objective === 'itc' ? rowQuery === colQuery : rowQuery ? colQuery : colQuery || col <= row);
      }
      mask.push(line);
    }
    const captions = {
      itc: ['ITC：query 和文本各看各的，两块互不可见。先分别编码，再比较图文相似度。',
        'ITC: queries and text see only themselves; the two blocks are invisible to each other. Encode separately, then compare.'],
      itm: ['ITM：全部可见。query 和文本充分交互，用来判断这对图文是否匹配。',
        'ITM: everything is visible. Queries and text interact fully to decide whether the image and text match.'],
      itg: ['ITG：query 只看 query；文本看全部 query，以及自己和之前的文本。q1 那行只有两个 query 可见，t2 那行能看两个 query 和 t1、t2，不能偷看后面的字。',
        'ITG: queries see only queries; text sees every query plus itself and earlier text. Row q1 sees just the two queries; row t2 sees both queries and t1, t2, never later words.']
    };
    return frames([{objective, mask, queries, texts, zh: captions[objective][0], en: captions[objective][1]}]);
  };

  /* 03-multimodal-learning/image-generation: one-dimensional flow matching. */
  F.flow = function (noise = 2, target = 10, time = 0.25, predicted = 6, step = 0.1) {
    const position = (1 - time) * noise + time * target, velocity = target - noise;
    const loss = (predicted - velocity) ** 2, next = Math.round((position + step * predicted) * 1e9) / 1e9;
    const base = {noise, target, time, position, velocity, predicted, loss, next};
    return frames([
      {...base, stage: 0, zh: `一维的例子：噪声 ε = ${noise}，目标 z = ${target}。`,
        en: `A one-dimensional example: noise ε = ${noise}, target z = ${target}.`},
      {...base, stage: 1, zh: '训练用的路径是一条直线：x_t = (1 − t)ε + t·z，t 从 0 走到 1。',
        en: 'Training uses a straight path: x_t = (1 − t)ε + t·z, with t going from 0 to 1.'},
      {...base, stage: 2, zh: `在 t = ${time} 时，位置是 ${1 - time}×${noise} + ${time}×${target} = ${position}。`,
        en: `At t = ${time}, the position is ${1 - time}×${noise} + ${time}×${target} = ${position}.`},
      {...base, stage: 3, zh: `目标速度 u = z − ε = ${velocity}：沿这条直线，每单位时间要走 ${velocity}。`,
        en: `The target velocity is u = z − ε = ${velocity}: along this line, it covers ${velocity} per unit of time.`},
      {...base, stage: 4, zh: `模型预测 ${predicted}，平方误差 (${predicted} − ${velocity})² = ${loss}。这是速度回归，不是对 token 做交叉熵。`,
        en: `The model predicts ${predicted}; squared error (${predicted} − ${velocity})² = ${loss}. This is velocity regression, not cross-entropy over tokens.`},
      {...base, stage: 5, done: true, zh: `生成时按预测速度走一步 Euler，步长 ${step}：${position} + ${step}×${predicted} = ${next}。真实模型处理高维张量，速度也随位置和时间变化。`,
        en: `At generation time, take one Euler step of size ${step} with the predicted velocity: ${position} + ${step}×${predicted} = ${next}. Real models work on high-dimensional tensors, and the velocity varies with position and time.`}
    ]);
  };

  /* 07-evaluation/evaluation-stack §3: nested success conditions, 100 → 55. */
  F.funnel = function () {
    const stages = [
      ['固定测试集', 'Fixed test set', 100],
      ['必要证据进入候选集', 'Necessary evidence reaches the candidate set', 80],
      ['必要证据保留在最终上下文', 'Necessary evidence survives context selection', 70],
      ['关键主张均有支持', 'Key claims are supported', 60],
      ['同时完整回答了问题', 'The question is also answered completely', 55]];
    const rate = i => {
      const r = stages[i][2] / stages[i - 1][2] * 100;
      const exact = Math.abs(r * 10 - Math.round(r * 10)) < 1e-9;
      const text = exact ? String(Math.round(r * 10) / 10) : r.toFixed(1);
      return {zh: (exact ? ' ' : '约 ') + text + '%', en: (exact ? '' : 'about ') + text + '%'};
    };
    const rates = stages.map((_, i) => (i ? rate(i) : null));
    const list = [{stages, rates, shown: 1, zh: '固定的 100 道测试题。下面每一步，只在通过上一步的题里继续数。',
      en: 'A fixed set of 100 test questions. Each stage below counts only the questions that passed the stage before.'}];
    for (let i = 1; i < stages.length; i++) {
      const drop = stages[i - 1][2] - stages[i][2];
      list.push({stages, rates, shown: i + 1, current: i,
        zh: `${stages[i][0]}：剩 ${stages[i][2]} 题，相对上一步${rates[i].zh}，掉了 ${drop} 题。`,
        en: `${stages[i][1]}: ${stages[i][2]} remain, ${rates[i].en} of the previous stage; ${drop} drop out.`});
    }
    list.push({stages, rates, shown: stages.length, done: true,
      zh: '端到端成功率是 55/100 = 0.55，不是最后一行的 55/60。0.8 × (70/80) × (60/70) × (55/60) = 0.55 能成立，是因为每一层都只在上一层里数。',
      en: 'End-to-end success is 55/100 = 0.55, not the last row’s 55/60. 0.8 × (70/80) × (60/70) × (55/60) = 0.55 holds because each stage counts only within the one before.'});
    return frames(list);
  };

  /* 07-evaluation/text-metrics: teaching BLEU-2 with clipped counts and a brevity penalty. */
  F.bleu = function (candidate, reference = 'the bus leaves at ten') {
    const ref = reference.split(' '), cand = candidate.split(' ');
    const grams = (words, n) => words.slice(0, words.length - n + 1).map((_, i) => words.slice(i, i + n).join(' '));
    const clipped = n => {
      const budget = {};
      grams(ref, n).forEach(g => { budget[g] = (budget[g] || 0) + 1; });
      return grams(cand, n).map(g => { const ok = (budget[g] || 0) > 0; if (ok) budget[g] -= 1; return {gram: g, ok}; });
    };
    const uni = clipped(1), bi = clipped(2);
    const m1 = uni.filter(g => g.ok).length, m2 = bi.filter(g => g.ok).length;
    const p1 = m1 / uni.length, p2 = m2 / bi.length;
    const bp = Math.exp(Math.min(0, 1 - ref.length / cand.length));
    const score = bp * Math.exp((Math.log(p1) + Math.log(p2)) / 2);
    const base = {ref, cand, uni, bi, m1, m2, p1, p2, bp, score};
    const bpText = bp === 1 ? '1' : fixed(bp, 4);
    const short = cand.length < ref.length;
    return frames([
      {...base, stage: 0, zh: `参考：${reference}（${ref.length} 个词）。候选：${candidate}（${cand.length} 个词）。`,
        en: `Reference: ${reference} (${ref.length} words). Candidate: ${candidate} (${cand.length} words).`},
      {...base, stage: 1, zh: `unigram：${m1}/${uni.length} 个词能在参考里找到（每个词最多按参考中的次数算），p1 = ${m1}/${uni.length}。`,
        en: `Unigrams: ${m1} of ${uni.length} words are found in the reference (each counted at most as often as the reference has it), p1 = ${m1}/${uni.length}.`},
      {...base, stage: 2, zh: `bigram：${m2}/${bi.length} 个相邻词对能对上，p2 = ${m2}/${bi.length}。`,
        en: `Bigrams: ${m2} of ${bi.length} adjacent pairs match, p2 = ${m2}/${bi.length}.`},
      {...base, stage: 3, zh: short ? `候选只有 ${cand.length} 个词，参考有 ${ref.length} 个：长度惩罚 BP = exp(1 − ${ref.length}/${cand.length}) ≈ ${bpText}。` : `长度和参考一样，不罚：BP = ${bpText}。`,
        en: short ? `The candidate has ${cand.length} words against ${ref.length}: brevity penalty BP = exp(1 − ${ref.length}/${cand.length}) ≈ ${bpText}.` : `Same length as the reference, so no penalty: BP = ${bpText}.`},
      {...base, stage: 4, done: true,
        zh: short ? `BLEU-2 = BP × √(p1·p2) ≈ ${fixed(score, 4)}。两阶都全对，只因为说得太短，分数不是 1。` : `BLEU-2 = √(${fixed(p1, 1)} × ${fixed(p2, 2)}) ≈ ${fixed(score, 4)}。时间错了，分数却比上一句高；若任务是查发车时间，字段正确率才是直接指标。`,
        en: short ? `BLEU-2 = BP × √(p1·p2) ≈ ${fixed(score, 4)}. Both orders match perfectly; only the shortness keeps it from 1.` : `BLEU-2 = √(${fixed(p1, 1)} × ${fixed(p2, 2)}) ≈ ${fixed(score, 4)}. The time is wrong, yet it outscores the short answer; if departure time is the task, field accuracy is the direct measure.`}
    ]);
  };

  /* 07-evaluation/llm-as-a-judge/probability-scores: raw vocabulary mass vs the 1–5 labels. */
  F.renorm = function () {
    const labels = [[3, 0.08], [4, 0.56], [5, 0.16]], other = 0.20;
    const mass = labels.reduce((a, [, p]) => a + p, 0);
    const raw = labels.reduce((a, [k, p]) => a + k * p, 0);
    const scaled = labels.map(([k, p]) => [k, p / mass]);
    const round = x => Math.round(x * 1e6) / 1e6;
    const base = {labels, other, mass: round(mass), raw: round(raw), scaled: scaled.map(([k, p]) => [k, round(p)]), mean: round(raw / mass)};
    return frames([
      {...base, stage: 0, zh: '整个词表上的原始概率：3 分 0.08、4 分 0.56、5 分 0.16，1、2 分为 0，其余 0.20 落在别的 token 上。',
        en: 'Raw probabilities over the whole vocabulary: rating 3 has 0.08, 4 has 0.56, 5 has 0.16, 1 and 2 have zero, and other tokens hold the remaining 0.20.'},
      {...base, stage: 1, zh: `直接加权：3×0.08 + 4×0.56 + 5×0.16 = ${base.raw}。那 0.20 不贡献任何分数，把均分往下拉了。`,
        en: `The raw weighted sum: 3×0.08 + 4×0.56 + 5×0.16 = ${base.raw}. The 0.20 contributes no score and drags the mean down.`},
      {...base, stage: 2, zh: `只看评分标签：0.08 + 0.56 + 0.16 = ${base.mass}。`,
        en: `Keep only the rating labels: 0.08 + 0.56 + 0.16 = ${base.mass}.`},
      {...base, stage: 3, zh: `各自除以 ${base.mass}：${base.scaled.map(([, p]) => p).join('、')}，加起来才是 1。`,
        en: `Divide each by ${base.mass}: ${base.scaled.map(([, p]) => p).join(', ')}, which now sum to 1.`},
      {...base, stage: 4, done: true, zh: `条件均分 = ${base.raw} / ${base.mass} = ${base.mean}，意思是“已知输出落在 1–5 之间”。${base.mass} 这个质量也要一起记下来。`,
        en: `Conditional mean = ${base.raw} / ${base.mass} = ${base.mean}, given that the output is a 1–5 label. Keep the ${base.mass} on record too.`}
    ]);
  };

  /* 07-evaluation/llm-as-a-judge/scoring: one convention for the win-rate denominator. */
  F.winRate = function () {
    const counts = [['a', 8], ['b', 6], ['tie', 4], ['bad', 1], ['unknown', 1]];
    const tiles = counts.flatMap(([kind, n]) => Array(n).fill(kind));
    const base = {tiles};
    return frames([
      {...base, stage: 0, zh: '20 道独立任务：A 胜 8、B 胜 6、tie 4、both_bad 1、unknown 1。',
        en: '20 independent tasks: A wins 8, B wins 6, tie 4, both_bad 1, unknown 1.'},
      {...base, stage: 1, out: ['unknown'], zh: 'unknown 先进入弃权统计，不放进胜率。',
        en: 'unknown goes into the abstention count, not the win rate.'},
      {...base, stage: 2, out: ['unknown', 'bad'], zh: 'both_bad 记为任务失败：两个都不合格时，谁“更好”没有意义。',
        en: 'both_bad counts as a task failure: when both fail, “better” means nothing.'},
      {...base, stage: 3, out: ['unknown', 'bad'], zh: '质量胜率只在剩下的 18 条上算：8 + 6 + 4。',
        en: 'The quality win rate uses the remaining 18: 8 + 6 + 4.'},
      {...base, stage: 4, out: ['unknown', 'bad'], half: true, zh: 'tie 各算一半：A 的分子是 8 + 0.5 × 4 = 10。',
        en: 'Each tie counts half: A’s numerator is 8 + 0.5 × 4 = 10.'},
      {...base, stage: 5, out: ['unknown', 'bad'], half: true, done: true, zh: 'W_A = 10/18 ≈ 55.6%。这只是一种约定；报告时要同时写出 20 条总任务、1 条弃权和 1 条双方失败。',
        en: 'W_A = 10/18 ≈ 55.6%. This is one convention; report it with the 20 tasks, 1 abstention and 1 both_bad.'}
    ]);
  };

  /* 07-evaluation/ablation-and-slices: a weighted average that hides a regression. */
  F.slices = function () {
    const groups = [['历史充分', 'Rich history', 0.8, 0.60, 0.66], ['历史稀疏', 'Sparse history', 0.2, 0.50, 0.30]];
    const avg = i => Math.round(groups.reduce((a, g) => a + g[2] * g[3 + i], 0) * 1e6) / 1e6;
    const parts = groups.map(g => Math.round(g[2] * (g[4] - g[3]) * 1e6) / 1e6);
    const base = {groups, before: avg(0), after: avg(1), parts};
    return frames([
      {...base, stage: 0, zh: `旧版本：历史充分的人占 80%，得 0.60；历史稀疏的占 20%，得 0.50。加权平均 ${base.before}。柱宽是权重，柱高是得分。`,
        en: `Baseline: rich history is 80% of users at 0.60; sparse history is 20% at 0.50. Weighted average ${base.before}. Width is weight, height is score.`},
      {...base, stage: 1, zh: '新版本：充分组升到 0.66，稀疏组跌到 0.30。',
        en: 'Candidate: the rich group rises to 0.66, the sparse group falls to 0.30.'},
      {...base, stage: 2, zh: `各组对平均分的贡献 = 权重 × 变化：0.8 × (+0.06) = +${parts[0].toFixed(3)}，0.2 × (−0.20) = −${Math.abs(parts[1]).toFixed(3)}。`,
        en: `Each group moves the average by weight × change: 0.8 × (+0.06) = +${parts[0].toFixed(3)}, 0.2 × (−0.20) = −${Math.abs(parts[1]).toFixed(3)}.`},
      {...base, stage: 3, done: true, zh: `合起来平均分从 ${base.before} 涨到 ${base.after}，可稀疏组掉了 0.20。这不证明原因，只告诉我们该往哪儿查。`,
        en: `Together the average rises from ${base.before} to ${base.after}, while the sparse group lost 0.20. This does not establish a cause; it shows where to look.`}
    ]);
  };

  /* 10-agents/model-choice §7: resending the whole history on every call. */
  F.staircase = function (b = 1000, a = 200, k = 4) {
    const inputs = Array.from({length: k}, (_, i) => b + a * i);
    const total = inputs.reduce((x, y) => x + y, 0);
    const list = [];
    for (let i = 1; i <= k; i++) {
      list.push({b, a, k, inputs, shown: i, running: inputs.slice(0, i).reduce((x, y) => x + y, 0),
        zh: i === 1 ? `第 1 次调用：初始内容 ${b} token。` : `第 ${i} 次调用：把全部历史重发一遍，输入 ${inputs[i - 1]} token（${b} + ${i - 1} × ${a}）。`,
        en: i === 1 ? `Call 1: the initial ${b} tokens.` : `Call ${i}: resend the whole history, ${inputs[i - 1]} input tokens (${b} + ${i - 1} × ${a}).`});
    }
    list.push({b, a, k, inputs, shown: k, running: total, split: true,
      zh: `四次一共 ${total} = ${k} × ${b} + ${a} × ${k} × ${k - 1} / 2 = ${k * b} + ${a * k * (k - 1) / 2}。蓝色每次都要重发；橙色的历史越积越多，按调用次数的平方增长。`,
      en: `${total} in total = ${k} × ${b} + ${a} × ${k} × ${k - 1} / 2 = ${k * b} + ${a * k * (k - 1) / 2}. The blue part is resent every time; the orange history keeps piling up and grows with the square of the call count.`});
    list.push({b, a, k, inputs, shown: k, running: total, split: true, done: true,
      zh: '用了摘要、窗口、检索或缓存，账就变了：不是所有 agent 的成本都平方增长。输出和工具返回也要另算。',
      en: 'Summaries, windows, retrieval or caching change the bill: not every agent’s cost grows quadratically. Outputs and tool results need their own accounting.'});
    return frames(list);
  };

  /* 10-agents/tools-and-skills §5: loading skills on demand vs all at once (assumed token counts). */
  F.skills = function () {
    const catalog = 12 * 90, procedure = 1800, reference = 600;
    const lazy = [['catalog', catalog], ['procedure', procedure], ['reference', reference]];
    const eager = [['catalog', catalog], ['procedure', 12 * procedure], ['reference', reference]];
    const sum = parts => parts.reduce((a, [, n]) => a + n, 0);
    const base = {lazy, eager, lazyTotal: sum(lazy), eagerTotal: sum(eager)};
    const n = x => x.toLocaleString('en-US');
    return frames([
      {...base, stage: 0, lazyShown: 1, zh: `先只放 12 份 Skill 的名称和简介：12 × 90 = ${n(catalog)} token。没用到的 Skill 也占这一份。`,
        en: `Start with just the names and descriptions of 12 skills: 12 × 90 = ${n(catalog)} tokens. Unused skills still cost this much.`},
      {...base, stage: 1, lazyShown: 2, zh: `选中一份，再读它的完整步骤：+${n(procedure)}。`,
        en: `One is selected; read its full procedure: +${n(procedure)}.`},
      {...base, stage: 2, lazyShown: 3, zh: `需要时才打开参考段落：+${n(reference)}，合计 ${n(base.lazyTotal)}。`,
        en: `Open the reference excerpt only when needed: +${n(reference)}, ${n(base.lazyTotal)} in total.`},
      {...base, stage: 3, lazyShown: 3, eagerShown: true, zh: `如果一开始就把 12 份正文都读进来：${n(catalog)} + 12 × ${n(procedure)} + ${n(reference)} = ${n(base.eagerTotal)}。`,
        en: `Load all 12 procedures up front instead: ${n(catalog)} + 12 × ${n(procedure)} + ${n(reference)} = ${n(base.eagerTotal)}.`},
      {...base, stage: 4, lazyShown: 3, eagerShown: true, done: true, zh: '这些是假设的 token 数，不是实测节省比例，也不是整次请求的账单：工具可能返回长文，后续多轮也可能反复携带已加载的内容。',
        en: 'These are assumed counts, neither a measured saving nor the whole bill: a tool may return a long document, and later turns may carry loaded material again.'}
    ]);
  };

  /* 10-agents/patterns: the table's six structures, one small diagram each. */
  F.agentPatterns = function () {
    return frames([{zh: '从左上到右下，对应上表的六行。它们可以组合，也不是从低级到高级的排行；要看实际执行了什么。',
      en: 'Left to right, top to bottom: the six rows of the table. They combine freely and are not a ranking; what matters is what actually runs.'}]);
  };

  /* 03-multimodal-learning/omni-streaming: 2 s of 16 kHz audio, 25 ms windows, 10 ms hops, no padding. */
  F.audioFrames = function (samples = 32000, windowSize = 400, hop = 160) {
    const count = samples < windowSize ? 0 : 1 + Math.floor((samples - windowSize) / hop);
    const lastStart = (count - 1) * hop, tail = samples - (lastStart + windowSize);
    const base = {samples, windowSize, hop, count, lastStart, tail};
    const n = x => x.toLocaleString('en-US');
    return frames([
      {...base, stage: 0, view: 'head', windows: [], zh: `2 秒、16 kHz 的单通道音频：${n(samples)} 个样本。波形的每个采样点不是一个 token。`,
        en: `Two seconds of 16 kHz mono audio: ${n(samples)} samples. A waveform sample is not a model token.`},
      {...base, stage: 1, view: 'head', windows: [0], zh: `第 1 帧：25 ms 窗口，覆盖样本 0–${windowSize}。`,
        en: `Frame 1: a 25 ms window over samples 0–${windowSize}.`},
      {...base, stage: 2, view: 'head', windows: [0, 1], zh: `第 2 帧往后挪 10 ms（${hop} 个样本），覆盖 ${hop}–${hop + windowSize}；和上一帧重叠 ${windowSize - hop} 个样本。`,
        en: `Frame 2 moves 10 ms (${hop} samples) to cover ${hop}–${hop + windowSize}, overlapping the previous frame by ${windowSize - hop} samples.`},
      {...base, stage: 3, view: 'head', windows: [0, 1, 2, 3], zh: `每 ${hop} 个样本起一帧，一直滑到末尾。`,
        en: `A new frame starts every ${hop} samples, all the way to the end.`},
      {...base, stage: 4, view: 'tail', windows: [count - 2, count - 1], zh: `最后一个完整窗口从 ${n(lastStart)} 开始、到 ${n(lastStart + windowSize)} 结束；剩下 ${tail} 个样本不够一窗，不补零就不算。`,
        en: `The last full window runs from ${n(lastStart)} to ${n(lastStart + windowSize)}; the remaining ${tail} samples cannot fill a window and, without padding, are not counted.`},
      {...base, stage: 5, view: 'head', windows: [0, 1, 2, 3], done: true, zh: `所以是 1 + ⌊(${n(samples)} − ${windowSize}) / ${hop}⌋ = ${count} 帧。编码器之后还会下采样（2.5 约 40 ms、3 约 80 ms 一个表征），帧数又不等于表征数。`,
        en: `Hence 1 + ⌊(${n(samples)} − ${windowSize}) / ${hop}⌋ = ${count} frames. The encoder then downsamples (about 40 ms per representation in 2.5, 80 ms in 3), so frames are not representations either.`}
    ]);
  };

  /* 03-multimodal-learning/vlm-designs: DeepSeek-VL2 sequence length for r x c local tiles. */
  F.vl2Layout = function (rows = 2, cols = 3) {
    const globalTokens = 14 * 14 + 14, separator = 1, local = 14 * rows * (14 * cols + 1);
    const total = globalTokens + separator + local, naive = (rows * cols + 1) * 196;
    const base = {rows, cols, globalTokens, separator, local, total, naive, markers: 14 + 14 * rows};
    return frames([
      {...base, stage: 0, zh: '每一块的视觉特征从 27×27 合并成 14×14 = 196 个位置。',
        en: 'Each tile’s visual features merge from 27×27 to 14×14 = 196 positions.'},
      {...base, stage: 1, zh: '全局视图：14×14，再在 14 行的每行末尾加一个行尾标记，共 196 + 14 = 210。',
        en: 'The global view: 14×14 plus a row-end marker on each of its 14 rows, 196 + 14 = 210.'},
      {...base, stage: 2, zh: '全局视图和局部块之间放 1 个视图分隔符。',
        en: 'One view separator goes between the global view and the local tiles.'},
      {...base, stage: 3, zh: `局部块排成 ${rows} 行 ${cols} 列：拼成 ${14 * rows} × ${14 * cols} 的网格，每行末尾也加标记，共 ${14 * rows} × ${14 * cols + 1} = ${local}。`,
        en: `The local tiles sit in ${rows} rows and ${cols} columns: a ${14 * rows} × ${14 * cols} grid with a marker ending each row, ${14 * rows} × ${14 * cols + 1} = ${local}.`},
      {...base, stage: 4, done: true, zh: `合计 210 + 1 + ${local} = ${total}，不是 ${rows * cols + 1} × 196 = ${naive}。差的 ${total - naive} 个是结构标记：14 + 1 + ${14 * rows}。`,
        en: `Total 210 + 1 + ${local} = ${total}, not ${rows * cols + 1} × 196 = ${naive}. The ${total - naive} extra positions are structure: 14 + 1 + ${14 * rows}.`}
    ]);
  };

  /* 03-multimodal-learning/qwen-vl: M-RoPE (time, height, width) for a 2 x 3 merged grid starting at 7. */
  F.mrope = function (start = 7, rows = 2, cols = 3) {
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({r, c, t: start, h: start + r, w: start + c, given: r === 0 || c === 0});
    const base = {start, rows, cols, cells};
    return frames([
      {...base, stage: 0, focus: null, zh: `图片从位置 ${start} 开始，合并后的网格是 ${rows} 行 ${cols} 列。每个视觉位置有三个序号：(时间, 高度, 宽度)。`,
        en: `The image starts at position ${start}; the merged grid has ${rows} rows and ${cols} columns. Each visual position has three numbers: (time, height, width).`},
      {...base, stage: 1, focus: 't', zh: `时间：一张静态图只有一个时刻，六个位置都是 ${start}。`,
        en: `Time: a still image is a single moment, so all six positions have ${start}.`},
      {...base, stage: 2, focus: 'w', zh: `宽度：同一行从左到右是 ${start}、${start + 1}、${start + 2}。`,
        en: `Width: along a row, left to right, ${start}, ${start + 1}, ${start + 2}.`},
      {...base, stage: 3, focus: 'h', zh: `高度：上一行是 ${start}，下一行是 ${start + 1}。`,
        en: `Height: the top row has ${start}, the bottom row ${start + 1}.`},
      {...base, stage: 4, focus: null, done: true, zh: '静态图时间相同、行列不同。文本 token 的三个轴用同一个值，但不同的文本 token 位置并不相同。（灰色两格是按同一规律推出的，表里没列。）',
        en: 'A still image shares time but not row or column. A text token uses one value on all three axes, yet different text tokens get different positions. (The two grey cells follow the same pattern; the table does not list them.)'}
    ]);
  };

  /* 07-evaluation/text-metrics: perplexity with a 4-token window over 6 tokens, no BOS. */
  F.pplWindows = function () {
    const tokens = ['A', 'B', 'C', 'D', 'E', 'F'];
    const windows = [{from: 0, to: 3, context: [0], scored: [1, 2, 3]}, {from: 2, to: 5, context: [2, 3], scored: [4, 5]}];
    const base = {tokens, windows};
    return frames([
      {...base, stage: 0, zh: '测试序列有 6 个 token，模型一次只能读 4 个。不加 BOS：第一个 A 没有前文，不计分。',
        en: 'The test sequence has 6 tokens, and the model reads only 4 at a time. No BOS: the first token, A, has no context and is not scored.'},
      {...base, stage: 1, active: 0, zh: '窗口 1 读 A B C D：A 只作上下文，B、C、D 计分，共 3 个目标。',
        en: 'Window 1 reads A B C D: A is context only; B, C and D are scored, 3 targets.'},
      {...base, stage: 2, active: 1, zh: '窗口 2 读 C D E F：C、D 再读一遍当前文，但不再计分；E、F 计分，共 2 个目标。',
        en: 'Window 2 reads C D E F: C and D are read again as context but not scored again; E and F are scored, 2 targets.'},
      {...base, stage: 3, done: true, zh: '整段一共计 5 个目标，不是 6 个，也不是两个窗口长度之和 8。步长更小，目标能看到更多前文，但 forward 次数更多；窗口长度、步长、BOS/EOS 和文档边界都要记下来。',
        en: '5 targets in total, not 6, and not 8 (the two window lengths). A smaller stride gives targets more context at the cost of more forward passes; record window length, stride, BOS/EOS and document boundaries.'}
    ]);
  };

  /* 04-search/vector-indexes: IVF with nprobe 1 vs 2 (an illustrative 2-D layout; the note gives no coordinates). */
  F.ivf = function () {
    const groups = {
      A: [[110, 96], [128, 150], [150, 104], [172, 138], [204, 112], [122, 122], [160, 76], [140, 172]],
      B: [[288, 136], [350, 92], [384, 152], [412, 112], [430, 146], [372, 70], [398, 124], [340, 168]],
      C: [[500, 200], [530, 176], [556, 214], [522, 232], [486, 226]]
    };
    const query = [252, 128];
    const mean = pts => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const centroids = Object.fromEntries(Object.entries(groups).map(([k, pts]) => [k, mean(pts)]));
    // the layout must actually make the note's point: every point belongs to its nearest centroid,
    // the query's nearest centroid is A, and the true nearest point lives in B
    for (const [k, pts] of Object.entries(groups)) for (const p of pts) {
      const own = Object.entries(centroids).sort((x, y) => dist(p, x[1]) - dist(p, y[1]))[0][0];
      if (own !== k) throw Error('point ' + p + ' is nearer centroid ' + own);
    }
    const order = Object.keys(centroids).sort((x, y) => dist(query, centroids[x]) - dist(query, centroids[y]));
    const best = keys => keys.flatMap(k => groups[k].map(p => ({k, p, d: dist(query, p)}))).sort((x, y) => x.d - y.d)[0];
    const one = best(order.slice(0, 1)), two = best(order.slice(0, 2)), all = best(Object.keys(groups));
    if (order[0] !== 'A' || all.k !== 'B' || one.k !== 'A' || two.p !== all.p) throw Error('layout does not show the miss');
    const base = {groups, query, centroids, order, one, two};
    return frames([
      {...base, stage: 0, zh: '库里的向量先被分成几个簇，每个簇有一个中心（×），各自保存自己的列表。',
        en: 'The stored vectors are first split into clusters, each with a center (×) and its own list.'},
      {...base, stage: 1, zh: '查询 q 来了：先比较它到各个簇中心的距离，A 的中心最近。',
        en: 'A query q arrives: compare it with each cluster center first; A’s center is the nearest.'},
      {...base, stage: 2, probe: 1, zh: 'nprobe = 1：只扫描簇 A，在里面找到的最近点并不是全库最近的那个。',
        en: 'nprobe = 1: scan only cluster A. The nearest point found there is not the nearest in the whole collection.'},
      {...base, stage: 3, probe: 2, zh: 'nprobe = 2：再扫描簇 B，找到更近的点；它就在 B 靠近 q 的边上。',
        en: 'nprobe = 2: also scan cluster B and find a closer point, sitting on B’s edge near q.'},
      {...base, stage: 4, probe: 2, done: true, zh: '簇中心最近，不代表簇内一定有最近的点。多查几个簇能减少遗漏，但更慢。100 万条分 1000 个簇、查 10 个，约扫 1 万条；这只是粗略比例，不是加速倍数。',
        en: 'The closest center need not own the closest point. Probing more clusters misses less but costs more. With 1,000,000 vectors in 1000 clusters, probing 10 scans about 10,000: a rough ratio, not a speedup.'}
    ]);
  };

  /* 05-post-training/rejection-sampling#best-of-n: best-of-2 with p = (0.5, 0.3, 0.2) and a scorer that ranks C > B > A. */
  F.bestOfN = function () {
    const names = ['A', 'B', 'C'], p = [0.5, 0.3, 0.2], rank = {A: 0, B: 1, C: 2};
    const r = x => Math.round(x * 1e6) / 1e6;
    const cells = names.flatMap((second, row) => names.map((first, col) => ({row, col, first, second, area: r(p[col] * p[row]),
      winner: rank[first] >= rank[second] ? first : second})));
    const win = name => r(cells.filter(c => c.winner === name).reduce((a, c) => a + c.area, 0));
    const base = {names, p, cells, picked: {A: win('A'), B: win('B'), C: win('C')}};
    return frames([
      {...base, stage: 0, zh: '只生成 1 份时，A、B、C 出现的概率是 0.5、0.3、0.2；评分器的排序是 C > B > A。',
        en: 'With one draw, A, B and C come up with probability 0.5, 0.3 and 0.2; the scorer ranks C > B > A.'},
      {...base, stage: 1, zh: '独立抽两份：第一份定列，第二份定行。每格面积是两次概率之积，9 格合计 1。',
        en: 'Two independent draws: the first picks the column, the second the row. Each cell’s area is the product of the two probabilities, and the nine cells add up to 1.'},
      {...base, stage: 2, focus: 'A', zh: '只有两份都是 A，A 才会被选中：0.5 × 0.5 = 0.25。',
        en: 'A is picked only when both draws are A: 0.5 × 0.5 = 0.25.'},
      {...base, stage: 3, focus: 'C', zh: '只要出现 C 就选 C。不含 C 的是左上 0.8 × 0.8 的方块，所以 C 胜出的概率是 1 − 0.64 = 0.36，不是 0.2 + 0.2 = 0.4：CC 那一格不能算两次。',
        en: 'Whenever C appears, C is picked. The no-C region is the 0.8 × 0.8 block at the top left, so C wins with 1 − 0.64 = 0.36, not 0.2 + 0.2 = 0.4: the CC cell must not be counted twice.'},
      {...base, stage: 4, focus: 'B', zh: '剩下的 AB、BA、BB 三格归 B：0.15 + 0.15 + 0.09 = 0.39。',
        en: 'The remaining cells, AB, BA and BB, go to B: 0.15 + 0.15 + 0.09 = 0.39.'},
      {...base, stage: 5, done: true, zh: '若 C 恰好是评分器看不出的错误答案，从生成 1 份变成 2 份，选中它的概率就从 0.2 升到 0.36。评分器准不准和采样预算要一起看。',
        en: 'If C is a wrong answer that fools the scorer, going from one draw to two raises its chance of being picked from 0.2 to 0.36. Scorer quality and the sampling budget have to be checked together.'}
    ]);
  };

  /* 05-post-training/where-preferences-come-from §4: Bradley–Terry sees only the gap, so a shift is free and a scale is not. */
  F.btScale = function () {
    const sigma = x => 1 / (1 + Math.exp(-x));
    const state = (a, b, stage, extra = {}) => ({stage, a, b, gap: a - b, prob: Math.round(sigma(a - b) * 1000) / 1000, ...extra});
    return frames([
      {...state(2, 1, 0), zh: '奖励模型给 A 打 2 分、B 打 1 分。Bradley–Terry 只把分差 1 送进 sigmoid：A 胜出的概率是 σ(1) ≈ 0.731。',
        en: 'The reward model gives A 2 and B 1. Bradley–Terry feeds only the gap of 1 into the sigmoid: A is preferred with probability σ(1) ≈ 0.731.'},
      {...state(12, 11, 1), zh: '两者都加 10，变成 12 和 11：分差仍是 1，曲线上的点不动，概率还是 0.731。',
        en: 'Add 10 to both, giving 12 and 11. The gap is still 1, the point on the curve stays put, and the probability is still 0.731.'},
      {...state(4, 2, 2), zh: '改成把 2 和 1 都乘 2，变成 4 和 2：分差变成 2，概率升到 σ(2) ≈ 0.881。',
        en: 'Instead, multiply 2 and 1 by 2, giving 4 and 2. The gap becomes 2 and the probability rises to σ(2) ≈ 0.881.'},
      {...state(4, 2, 3, {ghost: 1, done: true}), zh: '平移不影响这个模型，缩放会影响。“只有分差进入公式”不等于分数的尺度可以随便定。',
        en: 'A shared shift changes nothing; scaling does. “Only the gap enters the formula” does not make the scale arbitrary.'}
    ]);
  };

  /* 05-post-training/dapo: response mean vs token mean, then the same gap across two ranks and the W/N fix. */
  F.tokenMean = function () {
    const rows = [{values: [1, 1, 999], valid: [true, true, false]}, {values: [3, 3, 3, 3, 3, 3], valid: Array(6).fill(true)}];
    const valid = rows.map(row => row.values.filter((_, i) => row.valid[i]));
    const sums = valid.map(v => v.reduce((a, b) => a + b, 0)), counts = valid.map(v => v.length);
    const N = counts[0] + counts[1], W = rows.length;
    const means = sums.map((s, i) => s / counts[i]);
    const responseMean = (means[0] + means[1]) / 2, tokenMean = (sums[0] + sums[1]) / N;
    const scaled = sums.map(s => s * W / N), ddp = (scaled[0] + scaled[1]) / 2;
    const base = {rows, sums, counts, means, N, W, responseMean, tokenMean, scaled, ddp};
    return frames([
      {...base, stage: 0, zh: '短回答有 2 个有效 token，每个的值是 1；第三格 999 是 padding，要 mask 掉。长回答有 6 个有效 token，每个是 3。',
        en: 'The short response has 2 valid tokens worth 1 each; the third cell, 999, is padding and is masked out. The long response has 6 valid tokens worth 3 each.'},
      {...base, stage: 1, zh: `先在每条回答里平均（${means[0]} 和 ${means[1]}），再对回答平均：(1 + 3)/2 = ${responseMean}。两条回答各占一半，短回答的每个 token 权重 1/4，长回答的只有 1/12。`,
        en: `Average within each response (${means[0]} and ${means[1]}), then across responses: (1 + 3)/2 = ${responseMean}. Each response gets half the weight, so a short-response token weighs 1/4 and a long-response token only 1/12.`},
      {...base, stage: 2, zh: `把 8 个有效 token 放在一起平均：(2×1 + 6×3)/8 = ${tokenMean}。每个 token 权重 1/8，长回答一共占 6/8。这是换了权重，不是修正了除法。`,
        en: `Pool all 8 valid tokens: (2×1 + 6×3)/8 = ${tokenMean}. Each token weighs 1/8, so the long response carries 6/8 in total. This changes the weighting; it does not fix a division.`},
      {...base, stage: 3, zh: `放到两张卡上：rank 0 的局部均值是 ${means[0]}，rank 1 是 ${means[1]}。直接平均两个局部均值，又回到 ${responseMean}，不是全局 token 均值 ${tokenMean}。`,
        en: `Split across two devices: rank 0’s local mean is ${means[0]} and rank 1’s is ${means[1]}. Averaging the two local means gives ${responseMean} again, not the global token mean ${tokenMean}.`},
      {...base, stage: 4, done: true, zh: `每个 rank 把局部和乘 W/N = ${W}/${N}：${sums[0]} → ${scaled[0]}，${sums[1]} → ${scaled[1]}。DDP 再平均：(${scaled[0]} + ${scaled[1]})/2 = ${ddp}，和单卡的 token 均值一样。`,
        en: `Each rank multiplies its local sum by W/N = ${W}/${N}: ${sums[0]} → ${scaled[0]} and ${sums[1]} → ${scaled[1]}. DDP then averages: (${scaled[0]} + ${scaled[1]})/2 = ${ddp}, the same as the single-device token mean.`}
    ]);
  };

  /* 05-post-training/rlhf/reference-and-critic §3: per-answer KL terms can be negative; their weighted mean cannot. */
  F.klPenalty = function () {
    const ref = [0.5, 0.5], actor = [0.8, 0.2], reward = 1, beta = 0.2;
    const r4 = x => Math.round(x * 1e4) / 1e4;
    const logRatio = actor.map((q, i) => Math.log(q / ref[i]));
    const shaped = logRatio.map(l => reward - beta * l);
    const kl = actor.reduce((a, q, i) => a + q * logRatio[i], 0);
    const objective = actor.reduce((a, q, i) => a + q * shaped[i], 0);
    const base = {ref, actor, reward, beta, logRatio: logRatio.map(r4), shaped: shaped.map(r4), kl: r4(kl), objective: r4(objective),
      weighted: actor.map((q, i) => r4(q * logRatio[i]))};
    return frames([
      {...base, stage: 0, zh: '只有 A、B 两个回答。Reference 各给 0.5，Actor 给 0.8 和 0.2；两条的奖励都是 1，β = 0.2。',
        en: 'Only two answers, A and B. The reference gives each 0.5, the Actor 0.8 and 0.2; both rewards are 1, and β = 0.2.'},
      {...base, stage: 1, zh: `逐条算 log(π_θ/π_ref)：A 是 +${fixed(base.logRatio[0], 4)}，B 是 ${fixed(base.logRatio[1], 4).replace('-', '−')}。单条的 log-ratio 可以是负数。`,
        en: `Per answer, log(π_θ/π_ref) is +${fixed(base.logRatio[0], 4)} for A and ${fixed(base.logRatio[1], 4).replace('-', '−')} for B. A single log-ratio can be negative.`},
      {...base, stage: 2, zh: `惩罚后回报 = 1 − β × log-ratio：A 降到 ${fixed(base.shaped[0], 4)}，B 反而升到 ${fixed(base.shaped[1], 4)}，因为 Actor 给 B 的概率比参照低。`,
        en: `Shaped return = 1 − β × log-ratio: A drops to ${fixed(base.shaped[0], 4)}, while B rises to ${fixed(base.shaped[1], 4)}, because the Actor gives B less probability than the reference does.`},
      {...base, stage: 3, zh: `按 Actor 的概率加权：0.8 × ${fixed(base.logRatio[0], 4)} + 0.2 × (${fixed(base.logRatio[1], 4).replace('-', '−')}) ≈ ${fixed(base.kl, 4)}。加权后的期望才是 KL，它不会是负数。`,
        en: `Weight by the Actor’s probabilities: 0.8 × ${fixed(base.logRatio[0], 4)} + 0.2 × (${fixed(base.logRatio[1], 4).replace('-', '−')}) ≈ ${fixed(base.kl, 4)}. The weighted expectation is the KL, and it is never negative.`},
      {...base, stage: 4, done: true, zh: `总目标 0.8 × ${fixed(base.shaped[0], 4)} + 0.2 × ${fixed(base.shaped[1], 4)} ≈ ${fixed(base.objective, 4)}，等于 1 − 0.2 × ${fixed(base.kl, 4)}，仍低于不加惩罚时的 1。`,
        en: `The objective is 0.8 × ${fixed(base.shaped[0], 4)} + 0.2 × ${fixed(base.shaped[1], 4)} ≈ ${fixed(base.objective, 4)}, which equals 1 − 0.2 × ${fixed(base.kl, 4)} and stays below the unpenalized 1.`}
    ]);
  };

  /* 05-post-training/post-training-infrastructure: the ratio's denominator is the distribution that actually sampled. */
  F.behaviorRatio = function () {
    const raw = [0.8, 0.2], temperature = 2, fresh = 0.25;
    const powered = raw.map(p => Math.pow(p, 1 / temperature)), total = powered.reduce((a, b) => a + b, 0);
    const behavior = powered.map(p => p / total);
    const r = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
    const base = {raw, temperature, fresh, powered: powered.map(x => r(x)), total: r(total), behavior: behavior.map(x => r(x, 4)),
      right: r(fresh / behavior[1], 4), wrong: r(fresh / raw[1], 4)};
    return frames([
      {...base, stage: 0, zh: '模型原始的分布是 [0.8, 0.2]。',
        en: 'The model’s raw distribution is [0.8, 0.2].'},
      {...base, stage: 1, zh: `温度 2 等于把 logit 除以 2，也就是每一项取 p^(1/2)：${fixed(base.powered[0], 3)} 和 ${fixed(base.powered[1], 3)}，合计 ${fixed(base.total, 3)}。`,
        en: `Temperature 2 halves the logits, which raises each probability to the power 1/2: ${fixed(base.powered[0], 3)} and ${fixed(base.powered[1], 3)}, totalling ${fixed(base.total, 3)}.`},
      {...base, stage: 2, zh: '归一化后，实际的采样分布是 b = [2/3, 1/3]。这批数据是按它采出来的。',
        en: 'Normalized, the actual sampling distribution is b = [2/3, 1/3]. That is what generated this batch.'},
      {...base, stage: 3, zh: `新模型给第二个动作 0.25。相对实际的行为分布，比率是 0.25 / (1/3) = ${base.right}，小于 1：这个动作变得更不容易被选。`,
        en: `The new model gives the second action 0.25. Against the actual behavior, the ratio is 0.25 / (1/3) = ${base.right}, below 1: the action has become less likely.`},
      {...base, stage: 4, done: true, zh: `若错用原始的 0.2 作分母，就得到 0.25 / 0.2 = ${base.wrong}，大于 1，连增减方向都反了。先确认引擎返回的 logprob 是哪一种分布。`,
        en: `Using the raw 0.2 as the denominator gives 0.25 / 0.2 = ${base.wrong}, above 1: the direction flips. Check which distribution an engine’s logprob refers to.`}
    ]);
  };

  /* 06-systems/llm-serving: chunked prefill, decode first, a fixed number of positions per round. */
  F.chunkedPrefill = function (budget = 6, prompt = 10, decoding = 2) {
    const chunks = [];
    for (let left = prompt; left > 0;) { const take = Math.min(left, budget - decoding); chunks.push(take); left -= take; }
    const rounds = chunks.map((take, i) => ({decode: decoding, take, left: prompt - chunks.slice(0, i + 1).reduce((a, b) => a + b, 0)}));
    const base = {budget, prompt, decoding, chunks, rounds};
    const list = [{...base, shown: 0, zh: `${decoding} 个老请求正在 decode，每轮各要 1 个位置；新来一个 ${prompt}-token 的 prompt。每轮最多 ${budget} 个位置，先排 decode。`,
      en: `${decoding} requests are decoding and need one position each per round; a ${prompt}-token prompt arrives. Each round allows ${budget} positions, decode first.`}];
    rounds.forEach((round, i) => {
      const last = i === rounds.length - 1;
      list.push({...base, shown: i + 1, done: last,
        zh: last ? (rounds.length === 1
          ? `预算改成 ${budget}：一轮就处理完 ${decoding} + ${round.take}。新请求更早开始，但这一轮更重，正在等下一个 token 的用户可能会感到停顿。这是轮数算例，不是毫秒数。`
          : `第 ${i + 1} 轮：${decoding} + ${round.take}，prefill 完成，新请求这时才有机会给出首 token。老请求每一轮都在前进。`)
          : `第 ${i + 1} 轮：decode 占 ${decoding} 个，剩下 ${round.take} 个给新 prompt，还剩 ${round.left}。`,
        en: last ? (rounds.length === 1
          ? `Budget ${budget}: one round handles ${decoding} + ${round.take}. The new request starts sooner, but this round is heavier, and users waiting for their next token may notice a pause. This counts rounds, not milliseconds.`
          : `Round ${i + 1}: ${decoding} + ${round.take}. Prefill is done, and only now can the new request produce its first token. The existing requests advanced every round.`)
          : `Round ${i + 1}: decode takes ${decoding} and the remaining ${round.take} go to the prompt; ${round.left} left.`});
    });
    return frames(list);
  };

  /* 06-systems/inference-frameworks: static batching vs refilling a slot as soon as a request finishes. */
  F.continuousBatching = function (refill) {
    const need = {A: 2, B: 5, C: 3}, slots = 2, schedule = [];
    const left = {...need}, waiting = ['C'];
    let running = ['A', 'B'];
    while (running.length) {
      schedule.push([...running]);
      running.forEach(k => { left[k] -= 1; });
      running = running.filter(k => left[k] > 0);
      if (refill || !running.length) while (running.length < slots && waiting.length) running.push(waiting.shift());
    }
    const empty = schedule.reduce((a, round) => a + slots - round.length, 0);
    const start = schedule.findIndex(round => round.includes('C')) + 1;
    const base = {need, slots, schedule, total: schedule.length, empty, start, refill};
    return frames([
      {...base, shown: 0, zh: 'A、B 已完成 prefill，还要生成 2 个和 5 个 token；C 在排队，需要 3 个。每轮最多 2 条请求，各出 1 个 token。',
        en: 'A and B have finished prefill and need 2 and 5 more tokens; C waits and needs 3. Each round fits two requests, one token each.'},
      {...base, shown: 2, zh: '第 1–2 轮：A、B 一起生成，A 在第 2 轮结束。',
        en: 'Rounds 1–2: A and B run together; A finishes in round 2.'},
      {...base, shown: 5, zh: refill ? '每轮补位：A 一结束，C 第 3 轮就补进来，第 3–5 轮跑 B 和 C。' : '等整批结束才补位：第 3–5 轮只有 B，另一个位置空着，C 还在等。',
        en: refill ? 'Refilling: as soon as A finishes, C takes its slot in round 3; rounds 3–5 run B and C.' : 'Waiting for the whole batch: in rounds 3–5 only B runs, one slot sits empty, and C keeps waiting.'},
      ...(refill ? [] : [{...base, shown: 8, zh: 'B 结束后 C 才进来，第 6–8 轮只有 C。', en: 'C enters only after B finishes; rounds 6–8 run C alone.'}]),
      {...base, shown: schedule.length, done: true,
        zh: refill ? `B 和 C 都在第 5 轮结束，一共 ${schedule.length} 轮。8 轮对 5 轮是这个假设下的排程差别，不是实测的加速比。` : `一共 ${schedule.length} 轮，其中 ${empty} 个“轮 × 位置”空着。`,
        en: refill ? `B and C both finish in round 5: ${schedule.length} rounds in total. Eight versus five is a scheduling result under these assumptions, not a measured speedup.` : `${schedule.length} rounds in total, with ${empty} slot-rounds left empty.`}
    ]);
  };

  /* 00-foundations/deep-dives/generalization: ½(w − a)² with a = 0.4, plus squared L2 or L1 with λ = 0.5. */
  F.l1L2 = function (a = 0.4, lambda = 0.5) {
    const r = x => Math.round(x * 1000) / 1000;
    const l2 = a / (1 + lambda), l1 = Math.sign(a) * Math.max(Math.abs(a) - lambda, 0);
    const right = r(-a + lambda), left = r(-a - lambda);
    const base = {a, lambda, l2: r(l2), l1: r(l1), right, left,
      curves: {data: w => (w - a) ** 2 / 2, l2: w => (w - a) ** 2 / 2 + lambda / 2 * w * w, l1: w => (w - a) ** 2 / 2 + lambda * Math.abs(w)}};
    return frames([
      {...base, stage: 0, curve: 'data', zh: `把数据损失简化成 ½(w − ${a})²，最低点在 a = ${a}。`,
        en: `Reduce the data loss to ½(w − ${a})², which is lowest at a = ${a}.`},
      {...base, stage: 1, curve: 'l2', zh: `加平方 L2 惩罚 (${lambda}/2)w²：还是一条光滑的抛物线，最低点移到 ${a}/(1 + ${lambda}) ≈ ${base.l2}。L2 的拉力 λw 越靠近 0 越小，拉不到 0。`,
        en: `Add squared L2, (${lambda}/2)w²: still a smooth parabola, now lowest at ${a}/(1 + ${lambda}) ≈ ${base.l2}. Its pull λw fades near 0, so it never gets there.`},
      {...base, stage: 2, curve: 'l1', zh: `换成 L1 惩罚 ${lambda}|w|：0 处出现一个尖角。0 右边的斜率是 −${a} + ${lambda} = +${right}，左边是 −${a} − ${lambda} = −${Math.abs(left)}。`,
        en: `Switch to L1, ${lambda}|w|: a kink appears at 0. The slope just right of 0 is −${a} + ${lambda} = +${right}; just left, −${a} − ${lambda} = −${Math.abs(left)}.`},
      {...base, stage: 3, curve: 'l1', zh: `两边都往上走，最低点就停在尖角上：软阈值 max(${a} − ${lambda}, 0) = 0。`,
        en: `Both sides rise away from 0, so the minimum sits on the kink: the soft threshold max(${a} − ${lambda}, 0) = 0.`},
      {...base, stage: 4, curve: 'both', done: true, zh: `L1 得到 0，平方 L2 约 ${base.l2}。精确的零只说明 |a| ≤ λ，不说明这个特征在业务上没用。`,
        en: `L1 gives 0, squared L2 about ${base.l2}. An exact zero only says |a| ≤ λ, not that the feature is useless.`}
    ]);
  };

  /* 00-foundations/deep-dives/activation-and-initialization: z = 10, y = 0 under BCE and under MSE on the probability. */
  F.bceVsMse = function (z = 10) {
    const p = 1 / (1 + Math.exp(-z)), slope = p * (1 - p);
    const sci = x => { const e = Math.floor(Math.log10(x)); return `${(x / 10 ** e).toFixed(2)} × 10${String(e).replace('-', '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`; };
    const base = {z, p, slope, mseOuter: p, bceOuter: 1 / (1 - p), mse: p * slope, bce: p,
      text: {p: p.toFixed(5), slope: sci(slope), mse: sci(p * slope), bceOuter: Math.round(1 / (1 - p)).toLocaleString('en-US'), bce: p.toFixed(5),
        ratio: Math.round(1 / slope).toLocaleString('en-US')}};
    const T = base.text;
    return frames([
      {...base, stage: 0, zh: `z = ${z}，y = 0：p = σ(${z}) ≈ ${T.p}。模型很自信，却错了。`,
        en: `z = ${z}, y = 0: p = σ(${z}) ≈ ${T.p}. Confident, and wrong.`},
      {...base, stage: 1, zh: `sigmoid 在这里的局部斜率 p(1 − p) ≈ ${T.slope}，这就是“饱和”。两种 loss 往回传时都要乘它。`,
        en: `The sigmoid’s local slope here is p(1 − p) ≈ ${T.slope}; that is the saturation. Both losses pass back through it.`},
      {...base, stage: 2, zh: `对概率用 MSE ½(p − y)²：dL/dp ≈ ${T.p}，再乘斜率，≈ ${T.mse}，梯度几乎没了。`,
        en: `MSE on the probability, ½(p − y)²: dL/dp ≈ ${T.p}; times the slope gives ≈ ${T.mse}, almost nothing.`},
      {...base, stage: 3, zh: `BCE −log(1 − p)：dL/dp = 1/(1 − p) ≈ ${T.bceOuter}，正好抵掉那个很小的斜率，乘积就是 p − y ≈ ${T.bce}。`,
        en: `BCE, −log(1 − p): dL/dp = 1/(1 − p) ≈ ${T.bceOuter}, which cancels the tiny slope; the product is p − y ≈ ${T.bce}.`},
      {...base, stage: 4, done: true, zh: `同一个饱和的 sigmoid：BCE 对 logit 的梯度接近 1，MSE 只有约 ${T.mse}，相差约 2.2 万倍。实际训练直接从 logits 算（BCEWithLogitsLoss）。`,
        en: `The same saturated sigmoid: the BCE gradient on the logit is close to 1, the MSE one only about ${T.mse}, roughly 22,000 times smaller. In practice compute from logits (BCEWithLogitsLoss).`}
    ]);
  };

  /* 00-foundations/deep-dives/optimizers: fresh state, θ = 2, zero data gradient, η = 0.1, λ = 0.2. */
  F.adamwL2 = function () {
    const theta = 2, eta = 0.1, lambda = 0.2, b1 = 0.9, b2 = 0.999, eps = 1e-8;
    const r = x => Math.round(x * 1e6) / 1e6;
    const adamw = r(theta * (1 - eta * lambda));
    const g = lambda * theta, m = (1 - b1) * g, v = (1 - b2) * g * g, mHat = m / (1 - b1), vHat = v / (1 - b2);
    const step = eta * mHat / (Math.sqrt(vHat) + eps), adamL2 = theta - step;
    const base = {theta, eta, lambda, adamw, g: r(g), m: r(m), v: r(v), mHat: r(mHat), vHat: r(vHat), root: r(Math.sqrt(vHat)), step: r(step), adamL2: r(adamL2)};
    return frames([
      {...base, stage: 0, zh: '全新状态 m = v = 0，θ = 2，数据梯度为 0，η = 0.1，λ = 0.2，β₁ = 0.9，β₂ = 0.999。',
        en: 'Fresh state m = v = 0, θ = 2, data gradient 0, η = 0.1, λ = 0.2, β₁ = 0.9, β₂ = 0.999.'},
      {...base, stage: 1, zh: `AdamW：Adam 那部分只看数据梯度 0，两个矩都是 0，不动；衰减单独做：2 × (1 − 0.1 × 0.2) = ${adamw}。`,
        en: `AdamW: the Adam part sees only the zero data gradient, so both moments stay 0 and nothing moves; decay happens separately: 2 × (1 − 0.1 × 0.2) = ${adamw}.`},
      {...base, stage: 2, zh: `Adam + L2：把 λθ = ${base.g} 当成梯度送进去。m₁ = 0.1 × ${base.g} = ${base.m}，v₁ = 0.001 × ${base.g}² = ${base.v}。`,
        en: `Adam + L2: feed λθ = ${base.g} in as the gradient. m₁ = 0.1 × ${base.g} = ${base.m}, v₁ = 0.001 × ${base.g}² = ${base.v}.`},
      {...base, stage: 3, zh: `偏差修正：m̂ = ${base.m}/(1 − 0.9) = ${base.mHat}，v̂ = ${base.v}/(1 − 0.999) = ${base.vHat}，√v̂ = ${base.root}。`,
        en: `Bias correction: m̂ = ${base.m}/(1 − 0.9) = ${base.mHat}, v̂ = ${base.v}/(1 − 0.999) = ${base.vHat}, √v̂ = ${base.root}.`},
      {...base, stage: 4, zh: `更新量 0.1 × ${base.mHat}/${base.root} = ${base.step}，θ 走到约 ${base.adamL2}。`,
        en: `The step is 0.1 × ${base.mHat}/${base.root} = ${base.step}, so θ reaches about ${base.adamL2}.`},
      {...base, stage: 5, done: true, zh: `${adamw} 对约 ${base.adamL2}：同一个 λ，不是同一个更新。L2 那一项被它自己的尺度除掉了，所以第一步的步长约等于 η。`,
        en: `${adamw} versus about ${base.adamL2}: the same λ, a different update. The L2 term is divided by its own scale, so the first step has size about η.`}
    ]);
  };

  /* 00-foundations/deep-dives/pretraining-pipeline: two documents packed into one row; attention masks vs loss masks. */
  F.packingMasks = function () {
    const tokens = ['A', 'B', 'EOS', 'C', 'D', 'EOS'], doc = [1, 1, 1, 2, 2, 2];
    const targets = tokens.slice(0, -1).map((tok, i) => ({from: tok, to: tokens[i + 1], cross: doc[i] !== doc[i + 1]}));
    const causal = tokens.map((_, q) => tokens.map((_, k) => k <= q));
    const block = tokens.map((_, q) => tokens.map((_, k) => k <= q && doc[k] === doc[q]));
    const base = {tokens, doc, targets, causal, block};
    const scored = mask => targets.filter((t, i) => mask[i]).length;
    const all = targets.map(() => 1), loss = targets.map(t => (t.cross ? 0 : 1));
    return frames([
      {...base, stage: 0, mask: null, loss: all, zh: '两篇文档拼成一行。每个位置预测下一个 token：A→B、B→EOS、EOS→C、C→D、D→EOS，共 5 项。',
        en: 'Two documents packed into one row. Each position predicts the next token: A→B, B→EOS, EOS→C, C→D, D→EOS, five in all.'},
      {...base, stage: 1, mask: 'causal', loss: all, scored: scored(all), zh: '连续 token 流：普通 causal mask，C 那一行能看到 A、B、EOS 和它自己。EOS 只是提示边界，不会切断 attention。5 项都计分。',
        en: 'Continuous stream: an ordinary causal mask lets row C see A, B, EOS and itself. EOS marks the boundary but does not cut attention. All five are scored.'},
      {...base, stage: 2, mask: 'block', loss: all, zh: '独立文档 packing：块对角 causal mask，C 只看得到 C，D 只看 C 和 D。',
        en: 'Independent-document packing: a block-diagonal causal mask, so C sees only C and D sees C and D.'},
      {...base, stage: 3, mask: 'block', loss: all, focus: 2, zh: '但 attention mask 管不到 EOS→C：EOS 那一行只看得到文档 1，却被要求预测文档 2 的 C。',
        en: 'The attention mask does not touch EOS→C: the EOS row sees only document 1, yet must predict document 2’s C.'},
      {...base, stage: 4, mask: 'block', loss, focus: 2, scored: scored(loss), done: true, zh: '用 loss mask 把这一项置 0：本例独立文档、不设 BOS 时计分 4 项，连续流是 5 项。attention mask 管“能看谁”，loss mask 管“哪项算分”。',
        en: 'Zero that term with the loss mask: four scored targets here, against five for the continuous stream. The attention mask decides what can be seen; the loss mask decides what is scored.'}
    ]);
  };

  /* 06-systems/tensor-parallel: backward through the two-rank FFN with loss = output.sum(). */
  F.tpBackward = function () {
    const X = [2, -1];
    const A = [[[1, 0], [1, 1]], [[-1, 2], [0, 0]]], B = [[[1, 2], [0, 1]], [[1, 0], [2, 1]]];
    const vecMat = (v, M) => M[0].map((_, j) => v.reduce((a, x, i) => a + x * M[i][j], 0));
    const T = M => M[0].map((_, j) => M.map(row => row[j]));
    const pre = A.map(Ai => vecMat(X, Ai)), act = pre.map(h => h.map(x => Math.max(0, x)));
    const Z = act.map((h, i) => vecMat(h, B[i])), Y = Z[0].map((z, j) => z + Z[1][j]);
    const G = Y.map(() => 1);
    const back = B.map(Bi => vecMat(G, T(Bi)));
    const relu = pre.map(h => h.map(x => (x > 0 ? 1 : 0)));
    const D = back.map((b, i) => b.map((x, j) => x * relu[i][j]));
    const parts = D.map((d, i) => vecMat(d, T(A[i])));
    const dX = parts[0].map((p, j) => p + parts[1][j]);
    const base = {X, pre, relu, Y, G, back, D, parts, dX, mean: dX.map(x => x / 2)};
    const v = a => `[${a.join(', ').replace(/-/g, '−')}]`;
    return frames([
      {...base, stage: 0, zh: `前向回顾：两卡的 pre-activation 是 ${v(pre[0])} 和 ${v(pre[1])}，ReLU 只放行 rank 0 的第 1 个通道、rank 1 的第 2 个通道；AllReduce 后输出 ${v(Y)}。`,
        en: `Forward recap: the pre-activations are ${v(pre[0])} and ${v(pre[1])}; ReLU passes channel 1 on rank 0 and channel 2 on rank 1; after the AllReduce the output is ${v(Y)}.`},
      {...base, stage: 1, zh: `取 loss = output.sum()，G = ${v(G)}。因为 Y = Z₀ + Z₁，两卡收到的是同一个 G，不是各拿一半。`,
        en: `With loss = output.sum(), G = ${v(G)}. Since Y = Z₀ + Z₁, both ranks receive the same G, not half each.`},
      {...base, stage: 2, zh: `穿过第二层：G B₀ᵀ = ${v(back[0])}，G B₁ᵀ = ${v(back[1])}。`,
        en: `Through the second layer: G B₀ᵀ = ${v(back[0])} and G B₁ᵀ = ${v(back[1])}.`},
      {...base, stage: 3, zh: `乘 ReLU 的导数：D₀ = ${v(D[0])}，D₁ = ${v(D[1])}。权重梯度 ∇Bᵢ、∇Aᵢ 到这里都能在本卡算完。`,
        en: `Times the ReLU derivative: D₀ = ${v(D[0])} and D₁ = ${v(D[1])}. The weight gradients ∇Bᵢ and ∇Aᵢ can now finish on each rank.`},
      {...base, stage: 4, zh: `回到输入：D₀A₀ᵀ = ${v(parts[0])}，D₁A₁ᵀ = ${v(parts[1])}，各是一条路径的贡献。`,
        en: `Back to the input: D₀A₀ᵀ = ${v(parts[0])} and D₁A₁ᵀ = ${v(parts[1])}, one path’s contribution each.`},
      {...base, stage: 5, done: true, zh: `AllReduce 求和：${v(parts[0])} + ${v(parts[1])} = ${v(dX)}，和单卡一样。这是同一次计算的两条路径相加，不能像数据并行那样取平均（那会得到 ${v(base.mean)}）。`,
        en: `Sum with an AllReduce: ${v(parts[0])} + ${v(parts[1])} = ${v(dX)}, matching a single device. These are two paths of one computation, so do not average as in data parallelism (that would give ${v(base.mean)}).`}
    ]);
  };

  /* 00-foundations/deep-dives/tokenizer-algorithms: two BPE merges on rain ×3 and rail ×2, then encode rair. */
  F.bpeMerges = function () {
    const corpus = [['rain', 3], ['rail', 2]];
    const count = words => {
      const pairs = new Map();
      words.forEach(([symbols, n]) => symbols.slice(0, -1).forEach((sym, i) => { const k = sym + ' ' + symbols[i + 1]; pairs.set(k, (pairs.get(k) || 0) + n); }));
      return pairs;
    };
    const merge = (symbols, [a, b]) => { const out = []; for (let i = 0; i < symbols.length; i++) { if (symbols[i] === a && symbols[i + 1] === b) { out.push(a + b); i++; } else out.push(symbols[i]); } return out; };
    const symbolsOf = words => words.reduce((acc, [symbols, n]) => acc + symbols.length * n, 0);
    let words = corpus.map(([w, n]) => [w.split(''), n]);
    const vocab = [...new Set(words.flatMap(([s]) => s))];
    const snap = () => words.map(([s, n]) => [[...s], n]);
    const states = [{words: snap(), pairs: count(words), symbols: symbolsOf(words), vocab: [...vocab]}];
    const rules = [];
    for (let round = 0; round < 2; round++) {
      const pairs = count(words);
      const best = [...pairs.entries()].sort((x, y) => y[1] - x[1])[0][0].split(' ');
      rules.push(best);
      words = words.map(([s, n]) => [merge(s, best), n]);
      vocab.push(best.join(''));
      states.push({words: snap(), pairs: count(words), symbols: symbolsOf(words), vocab: [...vocab], rule: best});
    }
    let encoded = 'rair'.split('');
    const encoding = [[...encoded]];
    rules.forEach(rule => { encoded = merge(encoded, rule); encoding.push([...encoded]); });
    const pairList = map => [...map.entries()].map(([k, n]) => [k, n]);
    const base = {rules, encoding};
    return frames([
      {...base, ...states[0], table: pairList(states[0].pairs), stage: 0, zh: '按出现次数计：rain 3 次、rail 2 次，先切成单个字母，一共 20 个符号。不跨字符串合并。',
        en: 'Count by occurrences: rain 3 times and rail twice, each split into letters, 20 symbols in all. No merges across strings.'},
      {...base, ...states[0], table: pairList(states[0].pairs), stage: 1, pick: 'r a', zh: '数相邻对，要乘上出现次数：(r, a) 5、(a, i) 5、(i, n) 3、(i, l) 2。并列时按约定先选 (r, a)。',
        en: 'Count adjacent pairs, weighted by occurrences: (r, a) 5, (a, i) 5, (i, n) 3, (i, l) 2. On a tie, the stated rule picks (r, a).'},
      {...base, ...states[1], table: pairList(states[0].pairs), stage: 2, zh: '第 1 轮：r + a → ra。语料剩 15 个符号；词表加入 ra，r 和 a 仍保留。',
        en: 'Round 1: r + a → ra. The corpus drops to 15 symbols; ra joins the vocabulary, and r and a stay.'},
      {...base, ...states[1], table: [['a i', 0], ...pairList(states[1].pairs)], stage: 3, gone: 'a i', pick: 'ra i', zh: '重新统计：(a, i) 从 5 变成 0，因为 a 已经并进 ra 里；新的对 (ra, i) 有 5 次。沿用旧表，就会去合并一个已经不存在的对。',
        en: 'Recount: (a, i) falls from 5 to 0, because a now sits inside ra; the new pair (ra, i) has 5. Reusing the old table would merge a pair that no longer exists.'},
      {...base, ...states[2], table: [['a i', 0], ...pairList(states[1].pairs)], stage: 4, pick: 'ra i', zh: '第 2 轮：ra + i → rai。rain 变成 rai n，rail 变成 rai l，语料剩 10 个符号。',
        en: 'Round 2: ra + i → rai. rain becomes rai n and rail becomes rai l; 10 symbols remain.'},
      {...base, ...states[2], table: [['a i', 0], ...pairList(states[1].pairs)], stage: 5, done: true, zh: '编码新字符串 rair：按学到的顺序先 r + a，再 ra + i，得到 rai r。词表里不需要有完整的 rair。',
        en: 'Encode the new string rair: apply r + a, then ra + i, in the learned order, giving rai r. The vocabulary never needs all of rair.'}
    ]);
  };

  /* 00-foundations/core/ffn-and-gates: SwiGLU with g = [0, 1], u = [3, 2], W_d = [1, −1]. */
  F.swiglu = function () {
    const g = [0, 1], u = [3, 2], Wd = [1, -1];
    const silu = z => z / (1 + Math.exp(-z));
    const sig = z => 1 / (1 + Math.exp(-z));
    const dsilu = z => sig(z) * (1 + z * (1 - sig(z)));
    const r = x => Math.round(x * 1e4) / 1e4;
    const act = g.map(silu), h = act.map((a, i) => a * u[i]), y = h.reduce((a, x, i) => a + x * Wd[i], 0);
    const delta = Wd[0];
    const base = {g, u, Wd, act: act.map(r), h: h.map(r), y: r(y), delta, gradU: r(delta * act[0]), gradG: r(delta * u[0] * dsilu(g[0]))};
    return frames([
      {...base, stage: 0, zh: '只看两个中间维度。投影之后，gate 分支 g = [0, 1]，内容分支 u = [3, 2]。',
        en: 'Two hidden dimensions only. After projection, the gate branch is g = [0, 1] and the content branch is u = [3, 2].'},
      {...base, stage: 1, zh: `gate 分支过 SiLU(z) = z·σ(z)：SiLU(0) = 0，SiLU(1) ≈ ${fixed(base.act[1], 4)}。`,
        en: `The gate branch goes through SiLU(z) = z·σ(z): SiLU(0) = 0 and SiLU(1) ≈ ${fixed(base.act[1], 4)}.`},
      {...base, stage: 2, zh: `逐元素相乘：h = [0 × 3, ${fixed(base.act[1], 4)} × 2] = [0, ${fixed(base.h[1], 4)}]。第一维被乘成了 0。`,
        en: `Multiply elementwise: h = [0 × 3, ${fixed(base.act[1], 4)} × 2] = [0, ${fixed(base.h[1], 4)}]. The first dimension becomes 0.`},
      {...base, stage: 3, zh: `W_d = [1, −1] 把两维压回一个数：y = 0 − ${fixed(base.h[1], 4)} ≈ −${fixed(base.h[1], 4)}。`,
        en: `W_d = [1, −1] maps both back to one number: y = 0 − ${fixed(base.h[1], 4)} ≈ −${fixed(base.h[1], 4)}.`},
      {...base, stage: 4, zh: '反向传到第一维。若损失就是 y，传到 h 的梯度 δ = W_d，第一维的 δ = 1。内容分支的梯度 = δ × SiLU(0) = 0。',
        en: 'Backpropagate into dimension 1. If the loss is y itself, the gradient reaching h is δ = W_d, so δ = 1 in dimension 1. The content gradient is δ × SiLU(0) = 0.'},
      {...base, stage: 5, done: true, zh: `gate 的梯度 = δ × u × SiLU′(0) = 1 × 3 × 0.5 = ${base.gradG}。前向输出是 0，gate 仍在学，下一步就可能打开。门不是永久的开关。`,
        en: `The gate gradient is δ × u × SiLU′(0) = 1 × 3 × 0.5 = ${base.gradG}. The forward output was 0, yet the gate still learns and may open on the next step. It is not a permanent switch.`}
    ]);
  };

  /* 00-foundations/deep-dives/attention-residuals: a depth softmax split into two batches, merged with the stored sums. */
  F.depthMerge = function () {
    const batches = [[0], [4, 4, 4]], scores = [[0], [0, 0, 0]];
    const local = batches.map((values, b) => {
      const m = Math.max(...scores[b]), w = scores[b].map(s => Math.exp(s - m)), l = w.reduce((a, x) => a + x, 0);
      return {m, l, out: values.reduce((a, v, i) => a + w[i] * v, 0) / l};
    });
    const naive = (local[0].out + local[1].out) / 2;
    const merged = (local[0].l * local[0].out + local[1].l * local[1].out) / (local[0].l + local[1].l);
    const all = batches.flat(), full = all.reduce((a, v) => a + v, 0) / all.length;
    const base = {batches, local, naive, merged, full};
    return frames([
      {...base, stage: 0, zh: '同一个 token 有 4 个深度来源，score 全是 0，value 是 0、4、4、4。为了省中间存储，分两批算：第一批 {0}，第二批 {4, 4, 4}。',
        en: 'One token has four depth sources, all with score 0 and values 0, 4, 4, 4. To save intermediate storage, split them into two batches: {0} and {4, 4, 4}.'},
      {...base, stage: 1, zh: '第一批单独做 softmax：只有一个来源，权重 1，输出 0。记下最大值 0、指数和 1。',
        en: 'Softmax over batch 1 alone: one source with weight 1, output 0. Record the max 0 and the exponential sum 1.'},
      {...base, stage: 2, zh: '第二批：三个来源各占 1/3，输出 4。记下最大值 0、指数和 3。',
        en: 'Batch 2: three sources at 1/3 each, output 4. Record the max 0 and the exponential sum 3.'},
      {...base, stage: 3, zh: `直接平均两批的输出：(0 + 4)/2 = ${naive}。两批的分母不同，这样算把只有 1 份权重的第一批，当成和第二批一样重。`,
        en: `Averaging the two outputs gives (0 + 4)/2 = ${naive}. The batches had different denominators, so this treats batch 1, with one unit of weight, as heavy as batch 2.`},
      {...base, stage: 4, zh: `按保存的指数和加权：(1 × 0 + 3 × 4)/(1 + 3) = ${merged}。`,
        en: `Weight by the stored exponential sums: (1 × 0 + 3 × 4)/(1 + 3) = ${merged}.`},
      {...base, stage: 5, done: true, zh: `核对：4 个来源一起做 softmax，每个权重 1/4，(0 + 4 + 4 + 4)/4 = ${full}。分批时带上最大值和指数和，结果就和全量一致。`,
        en: `Check: one softmax over all four sources gives each weight 1/4, and (0 + 4 + 4 + 4)/4 = ${full}. Carry the max and the exponential sum, and batching matches the full result.`}
    ]);
  };

  /* 00-foundations/moe/fine-grained-and-shared: one parameter budget, cut finer, then with a shared expert. */
  F.expertBudget = function () {
    const d = 128, budget = (f, routed, active, shared = 0) => {
      const per = 3 * d * f;
      return {f, per, routed, active, shared, total: per * (routed + shared), lit: per * (active + shared)};
    };
    const coarse = budget(256, 8, 2), fine = budget(64, 32, 8), sharedSwap = budget(64, 31, 7, 1), extra = budget(64, 32, 8, 1);
    const n = x => x.toLocaleString('en-US');
    const base = {d, coarse, fine, sharedSwap, extra, increase: extra.lit / fine.lit - 1};
    return frames([
      {...base, cfg: coarse, stage: 0, zh: `d = 128、f = 256 的 SwiGLU expert，每个有 3 × 128 × 256 = ${n(coarse.per)} 个权重。8 个一共 ${n(coarse.total)}；每个 token 激活 2 个，${n(coarse.lit)}。`,
        en: `A SwiGLU expert with d = 128 and f = 256 holds 3 × 128 × 256 = ${n(coarse.per)} weights. Eight make ${n(coarse.total)}; each token activates two, or ${n(coarse.lit)}.`},
      {...base, cfg: {...fine, active: 0, lit: 0}, stage: 1, zh: `把每个 expert 的 f 缩到 64：每个 ${n(fine.per)} 个权重，一共 32 个。总参数仍是 ${n(fine.total)}。`,
        en: `Shrink each expert’s f to 64: ${n(fine.per)} weights apiece, 32 experts. The total stays ${n(fine.total)}.`},
      {...base, cfg: fine, stage: 2, zh: `每个 token 改为激活 8 个小 expert：8 × ${n(fine.per)} = ${n(fine.lit)}，和 2 个大 expert 一样。`,
        en: `Each token now activates eight small experts: 8 × ${n(fine.per)} = ${n(fine.lit)}, the same as two large ones.`},
      {...base, cfg: sharedSwap, stage: 3, zh: `把其中 1 个改成 shared，所有 token 都经过它；routed 只再选 7 个。总数 31 + 1、激活 7 + 1，账不变。`,
        en: 'Make one of them shared, so every token passes through it, and route only seven more. 31 + 1 in total, 7 + 1 active: the budget is unchanged.'},
      {...base, cfg: extra, stage: 4, done: true, zh: `如果保留 8 个 routed、再额外加 1 个 shared：激活 9 × ${n(fine.per)} = ${n(extra.lit)}，多了 ${Math.round(base.increase * 1000) / 10}%。共享专家也要算钱；这样比，收益里混进了多出来的计算。`,
        en: `Keep eight routed and add a shared one on top: 9 × ${n(fine.per)} = ${n(extra.lit)} active, ${Math.round(base.increase * 1000) / 10}% more. Shared experts cost compute too, and the comparison now mixes design with extra compute.`}
    ]);
  };


  /* 11-frontier/self-improvement/generate-verify-train §5: 40 of 100 solutions are right; the tests
     accept every right one and a share f of the wrong ones; fine-tuning copies what passes. */
  F.verifierCeiling = function (f = 0.10) {
    const ceiling = x => 40 / (40 + 60 * x);
    const leaked = Math.round(60 * f), kept = 40 + leaked, precision = ceiling(f);
    const right = Math.round(precision * 100);
    const ceilings = [0, 0.02, 0.10, 0.30].map(x => ({f: x, value: ceiling(x)}));
    const pct = x => (x * 100).toFixed(1) + '%';
    const base = {f, leaked, kept, precision, right, ceilings};
    return frames([
      {...base, stage: 0, zh: '教学例子：一批题上，模型写出的 100 份解答里有 40 份真正正确，60 份是错的。',
        en: 'A teaching example: of 100 solutions the model writes for a batch of problems, 40 are actually right and 60 are wrong.'},
      {...base, stage: 1, zh: `测试接受全部 40 份正确解，也放过了 ${Math.round(f * 100)}% 的错解：60 × ${f} = ${leaked} 份。通过测试的一共 ${kept} 份。`,
        en: `The tests accept all 40 right solutions and also let ${Math.round(f * 100)}% of the wrong ones through: 60 × ${f} = ${leaked}. In all, ${kept} pass.`},
      {...base, stage: 2, zh: `通过的 ${kept} 份里真正正确的是 40 / ${kept} ≈ ${pct(precision)}。按这套测试筛一轮，真实正确率最多从 40% 涨到这里，gap 约 ${Math.round(precision * 100 - 40)} 个百分点。`,
        en: `Of the ${kept} that pass, 40 / ${kept} ≈ ${pct(precision)} are right. One round of filtering with these tests can lift true accuracy from 40% to at most this, a gap of about ${Math.round(precision * 100 - 40)} points.`},
      {...base, stage: 3, zh: `在这 ${kept} 份上微调，并假设新模型原样学下它们的分布：100 份新解里 ${right} 份正确，${100 - right} 份错但能过测试。测试显示的通过率是 100%。`,
        en: `Fine-tune on these ${kept} and assume the new model copies their distribution exactly: of 100 new solutions, ${right} are right and ${100 - right} are wrong but pass. The tests report 100%.`},
      {...base, stage: 4, zh: `再转一轮：测试对两类一视同仁，全部接受，分布不变，gap = 0。真实正确率停在 ${right}%，测试一直显示 100%。`,
        en: `Go round again: the tests treat both kinds alike and accept everything, so the distribution does not move and the gap is 0. True accuracy stays at ${right}% while the tests keep showing 100%.`},
      {...base, stage: 5, done: true, zh: `能抬高上限的是验证器：错解放过率 0、2%、10%、30% 时，上限分别是 ${ceilings.map(c => pct(c.value)).join('、')}。`,
        en: `What raises the ceiling is the verifier: with 0, 2%, 10% and 30% of wrong solutions let through, the ceiling is ${ceilings.map(c => pct(c.value)).join(', ')}.`}
    ]);
  };

  /* 11-frontier/self-improvement/measuring §2: four task groups, 10 runs each; fit logit(p) as a line
     in log2(time); the 50% horizon is where it crosses zero. */
  F.timeHorizon = function () {
    const xs = [-2, 0, 2, 4];
    const fit = counts => {
      const ps = counts.map(c => c / 10), ys = ps.map(p => Math.log(p / (1 - p)));
      const mx = xs.reduce((a, b) => a + b, 0) / 4, my = ys.reduce((a, b) => a + b, 0) / 4;
      const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
      const icpt = my - slope * mx, at = q => (Math.log(q / (1 - q)) - icpt) / slope;
      return {counts, ps, ys, slope, icpt, x50: at(0.5), x80: at(0.8), h50: 2 ** at(0.5), h80: 2 ** at(0.8)};
    };
    const first = fit([9, 7, 3, 1]), strong = fit([9, 8, 7, 6]), plus = fit([9, 8, 7, 7]);
    const base = {xs, longest: 4};
    return frames([
      {...base, run: first, stage: 0, zh: '教学例子：一个模型在人类用时 15 分钟、1 小时、4 小时、16 小时的四组任务上各跑 10 次，成功 9、7、3、1 次。横轴是对数时间。',
        en: 'A teaching example: a model runs 10 times on each of four task groups that take humans 15 minutes, 1 hour, 4 hours and 16 hours, succeeding 9, 7, 3 and 1 times. The x-axis is log time.'},
      {...base, run: first, stage: 1, zh: `把成功率换成 logit，四个点几乎落在一条直线上。最小二乘斜率约 ${first.slope.toFixed(2)}（用时每翻一倍）。`,
        en: `Turn the success rates into logits and the four points fall almost on a line. The least-squares slope is about ${first.slope.toFixed(2)} per doubling of task time.`},
      {...base, run: first, stage: 2, zh: `曲线在 1 小时和 4 小时之间穿过 50%，交点是 ${first.h50.toFixed(0)} 小时：两者的几何中点，不是算术中点 2.5 小时。`,
        en: `The curve crosses 50% between 1 hour and 4 hours, at ${first.h50.toFixed(0)} hours: their geometric midpoint, not the arithmetic 2.5 hours.`},
      {...base, run: first, stage: 3, zh: `同一条曲线上找 80%：约 ${(first.h80 * 60).toFixed(0)} 分钟。要求更高的成功率，能承担的任务就短得多。`,
        en: `On the same curve, 80% falls at about ${(first.h80 * 60).toFixed(0)} minutes. Ask for a higher success rate and the tasks it can take on get much shorter.`},
      {...base, run: strong, stage: 4, zh: `换一个更强的模型：成功 9、8、7、6 次，四组都过半。50% 的点只能沿直线外推，落在约 ${strong.h50.toFixed(0)} 小时，已经在最长的 16 小时任务之外。`,
        en: `Now a stronger model: 9, 8, 7 and 6 successes, every group above half. The 50% point can only be extrapolated along the line and lands at about ${strong.h50.toFixed(0)} hours, beyond the longest 16-hour tasks.`},
      {...base, run: plus, stage: 5, done: true, zh: `16 小时组只多成功 1 次，读数就从约 ${strong.h50.toFixed(0)} 小时跳到约 ${plus.h50.toFixed(0)} 小时。超出任务范围的读数很不稳，METR 也提醒 16 小时以上不可靠。`,
        en: `One more success in the 16-hour group moves the reading from about ${strong.h50.toFixed(0)} hours to about ${plus.h50.toFixed(0)}. Readings past the task range are unstable; METR likewise warns that results above 16 hours are unreliable.`}
    ]);
  };

  /* 11-frontier/world-models/robotics-driving §3: five made-up policies, real success R vs the world model's R̂. */
  F.evaluatorRank = function () {
    const names = ['A', 'B', 'C', 'D', 'E'], R = [0.10, 0.25, 0.45, 0.70, 0.80], P = [0.05, 0.20, 0.30, 0.55, 0.50];
    const mean = v => v.reduce((a, b) => a + b, 0) / v.length;
    const pearson = (a, b) => { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0;
      a.forEach((x, i) => { sab += (x - ma) * (b[i] - mb); saa += (x - ma) ** 2; sbb += (b[i] - mb) ** 2; });
      return sab / Math.sqrt(saa * sbb); };
    const ranks = v => v.map(x => 1 + v.filter(y => y > x).length);
    const spearman = (a, b) => { const ra = ranks(a), rb = ranks(b), n = a.length;
      return 1 - 6 * ra.reduce((s, r, i) => s + (r - rb[i]) ** 2, 0) / (n * (n * n - 1)); };
    const mmrv = names.reduce((s, _, i) => s + Math.max(0, ...names.map((__, j) => ((P[i] < P[j]) !== (R[i] < R[j]) ? Math.abs(R[i] - R[j]) : 0))), 0) / names.length;
    const top = ix => ix.reduce((b, i) => (P[i] > P[b] ? i : b), ix[0]);
    const best = R.indexOf(Math.max(...R)), picked = top([0, 1, 2, 3, 4]);
    const base = {names, R, P, rReal: ranks(R), rModel: ranks(P), pearson: pearson(R, P), spearman: spearman(R, P), mmrv,
      picked: names[picked], best: names[best], top3: spearman(R.slice(2), P.slice(2))};
    return frames([
      {...base, stage: 0, zh: '五个推杯子策略的真机成功率（编的）：A 0.10、B 0.25、C 0.45、D 0.70、E 0.80。最好的是 E。',
        en: 'Real-robot success rates for five cup-pushing policies (made up): A 0.10, B 0.25, C 0.45, D 0.70, E 0.80. E is the best.'},
      {...base, stage: 1, zh: '世界模型给出的预测：0.05、0.20、0.30、0.55、0.50。整体偏低，而且 D 和 E 的顺序反了。',
        en: 'The world model predicts 0.05, 0.20, 0.30, 0.55 and 0.50. It runs low overall, and D and E come out in the wrong order.'},
      {...base, stage: 2, zh: `Pearson 相关约 ${base.pearson.toFixed(2)}，Spearman ${base.spearman.toFixed(1)}，MMRV ${base.mmrv.toFixed(2)}：三个指标都很好看。`,
        en: `Pearson is about ${base.pearson.toFixed(2)}, Spearman ${base.spearman.toFixed(1)} and MMRV ${base.mmrv.toFixed(2)}: all three look good.`},
      {...base, stage: 3, zh: `按模型分数挑最好的，挑中的是 ${base.picked}；真机上 ${base.best} 比它高 10 个百分点。`,
        en: `Pick the best by the model's score and you get ${base.picked}; on the real robot, ${base.best} is 10 points better.`},
      {...base, stage: 4, done: true, zh: `相关性主要来自 A、B 这些差策略和好策略的大差距。只看真正要选的 C、D、E，Spearman 降到 ${base.top3.toFixed(1)}。`,
        en: `Most of the correlation comes from the wide gap between weak policies like A and B and the strong ones. Among C, D and E, the ones you actually choose between, Spearman drops to ${base.top3.toFixed(1)}.`}
    ]);
  };

  /* 05-post-training/deep-rl/planning-and-learning §2: a one-level tree, priors (0.6, 0.4), values (0.2, 0.6), c = 1. */
  F.mctsVisits = function () {
    const P = [0.6, 0.4], v = [0.2, 0.6], c = 1, N = [0, 0], W = [0, 0], list = [];
    const snap = extra => ({P, v, N: N.slice(), Q: N.map((n, i) => (n ? W[i] / n : 0)), ...extra});
    list.push(snap({sim: 0, zh: '根节点有 L、R 两个动作。网络先验 P = (0.6, 0.4)，对两个子节点的估值 v = (0.2, 0.6)；取 c = 1，没访问过的边 Q = 0。',
      en: 'The root has two actions, L and R. The network prior is P = (0.6, 0.4) and its values for the two children are v = (0.2, 0.6); take c = 1 and Q = 0 for an unvisited edge.'}));
    for (let sim = 1; sim <= 6; sim++) {
      const total = N[0] + N[1];
      const score = [0, 1].map(i => (N[i] ? W[i] / N[i] : 0) + c * P[i] * Math.sqrt(total) / (1 + N[i]));
      const pick = score[1] > score[0] ? 1 : 0;
      N[pick] += 1; W[pick] += v[pick];
      const name = pick ? 'R' : 'L', f2 = x => x.toFixed(2);
      const why = total === 0 ? t2('两边加分都是 0，平局时选先验大的 L。', 'Both bonuses are 0; on a tie, take L, which has the larger prior.')
        : t2(`L 的分数 ${f2(score[0])}，R 的分数 ${f2(score[1])}，选 ${name}。`, `L scores ${f2(score[0])} and R scores ${f2(score[1])}, so ${name} is chosen.`);
      list.push(snap({sim, score, pick, zh: `第 ${sim} 次模拟：${why.zh}`, en: `Simulation ${sim}: ${why.en}`}));
    }
    const pi = tau => { const w = N.map(n => n ** (1 / tau)), s = w[0] + w[1]; return w.map(x => x / s); };
    list.push(snap({sim: 6, done: true, pi1: pi(1), pi05: pi(0.5),
      zh: `6 次模拟后访问次数是 (${N.join(', ')})。按 π ∝ N 得到 (${pi(1).map(x => x.toFixed(2)).join(', ')})，τ = 0.5 时是 (${pi(0.5).map(x => x.toFixed(1)).join(', ')})。先验 (0.6, 0.4) 被搜索改成了更偏向 R 的标签。`,
      en: `After six simulations the visit counts are (${N.join(', ')}). π ∝ N gives (${pi(1).map(x => x.toFixed(2)).join(', ')}), and τ = 0.5 gives (${pi(0.5).map(x => x.toFixed(1)).join(', ')}). Search has turned the prior (0.6, 0.4) into a label that favours R.`}));
    return frames(list);
  };
  function t2(zh, en) { return {zh, en}; }


  /* 11-frontier/world-models/dreamer §4: three imagined steps, γ = 0.9, λ = 0.5 (teaching values). */
  F.lambdaReturn = function (gamma = 0.9, lambda = 0.5) {
    const r = [null, 0, 0, 1], c = [null, 1, 1, 1], v = [0.6, 0.5, 0.6, 0.8];
    const run = (rr, cc, lam) => {
      const R = [null, null, null, v[3]];
      for (let t = 2; t >= 0; t--) R[t] = rr[t + 1] + gamma * cc[t + 1] * ((1 - lam) * v[t + 1] + lam * R[t + 1]);
      return R;
    };
    const R = run(r, c, lambda), f3 = x => (Math.round(x * 1000) / 1000).toString();
    const lam0 = run(r, c, 0)[0], lam1 = run(r, c, 1)[0];
    const wrong = run([null, 0, -1, 1], [null, 1, 0, 1], lambda);
    const base = {r, c, v, gamma, lambda, lam0, lam1};
    const upTo = k => R.map((x, t) => (t >= k ? x : null));
    return frames([
      {...base, R: upTo(4), stage: 0, zh: '从回放里的真实状态 s0 出发，模型想象出 3 步。每一步有预测奖励 r、继续标志 c，critic 给出价值 v。只有到达目标区的 s3 拿到奖励 1。',
        en: 'Start from a real replayed state s0; the model imagines three steps. Each step has a predicted reward r and continue flag c, and the critic gives a value v. Only s3, in the goal zone, earns a reward of 1.'},
      {...base, R: upTo(3), stage: 1, zh: '从最后一步往回算。末端没有更多想象，直接用 critic：R3 = v3 = 0.8。',
        en: 'Work backwards from the last step. With no more imagination, use the critic directly: R3 = v3 = 0.8.'},
      {...base, R: upTo(2), stage: 2, zh: `R2 = r3 + γ·c3·[(1−λ)·v3 + λ·R3] = 1 + 0.9 × 0.8 = ${f3(R[2])}。`,
        en: `R2 = r3 + γ·c3·[(1−λ)·v3 + λ·R3] = 1 + 0.9 × 0.8 = ${f3(R[2])}.`},
      {...base, R: upTo(1), stage: 3, zh: `R1 = 0 + 0.9 × (0.5 × 0.6 + 0.5 × 1.72) = ${f3(R[1])}：一半信 critic 的 v2，一半信后面想象出来的回报。`,
        en: `R1 = 0 + 0.9 × (0.5 × 0.6 + 0.5 × 1.72) = ${f3(R[1])}: half trusts the critic's v2, half the imagined return behind it.`},
      {...base, R: upTo(0), stage: 4, zh: `R0 = 0.9 × (0.5 × 0.5 + 0.5 × 1.044) ≈ ${f3(R[0])}。优势 = R0 − v0 ≈ +${f3(R[0] - v[0])}，actor 会稍微提高“推 1 cm”的概率。`,
        en: `R0 = 0.9 × (0.5 × 0.5 + 0.5 × 1.044) ≈ ${f3(R[0])}. The advantage R0 − v0 ≈ +${f3(R[0] - v[0])}, so the actor nudges up the probability of "push 1 cm".`},
      {...base, R: upTo(0), stage: 5, zh: `换 λ：λ = 0 时只信 critic，R0 = ${f3(lam0)}；λ = 1 时只信想象出的奖励，R0 ≈ ${f3(lam1)}。λ = 0.5 落在两者之间。`,
        en: `Change λ: at λ = 0 it trusts only the critic, R0 = ${f3(lam0)}; at λ = 1 it trusts only the imagined rewards, R0 ≈ ${f3(lam1)}. λ = 0.5 sits in between.`},
      {...base, R: wrong.map(x => x), wrong: true, stage: 6, done: true, zh: `如果模型在第 2 步误报“杯子掉了”（r2 = −1，c2 = 0）：R1 = −1，R0 = ${f3(wrong[0])}，优势变成 ${f3(wrong[0] - v[0])}。actor 学会躲开一个其实安全的动作：它只看得到模型给的数字。`,
        en: `If the model wrongly predicts at step 2 that the cup fell (r2 = −1, c2 = 0): R1 = −1, R0 = ${f3(wrong[0])}, and the advantage becomes ${f3(wrong[0] - v[0])}. The actor learns to avoid a move that is actually safe: it sees only the model's numbers.`}
    ]);
  };

  // up to three decimals, at least two, as the notes write them: 0.80, 0.825, 0.53
  function short(x) { const v = (Math.round(x * 1000) / 1000).toFixed(3); return v.endsWith('0') ? v.slice(0, -1) : v; }

  /* 06-systems/decision-support §4: confidence groups H (60% of cases, AI 0.95) and L (40%, AI 0.575), the person
     at 0.70 in both (teaching numbers). Team accuracy = Σ P(g)·[r_g·a_g + (1 − r_g)·h_g], six reliance policies. */
  F.relianceGroups = function (share = [0.6, 0.4], ai = [0.95, 0.575], person = 0.70) {
    const team = (r, a) => share.reduce((sum, p, g) => sum + p * (r[g] * a[g] + (1 - r[g]) * person), 0);
    const overall = team([1, 1], ai), flat = [overall, overall];
    const policies = [['person', [0, 0], ai], ['ai', [1, 1], ai], ['signal', [1, 0], ai], ['over', [1, 0.5], ai], ['under', [2 / 3, 0], ai], ['flat', [1, 0], flat]]
      .map(([id, r, a]) => ({id, r, a, acc: team(r, a)}));
    const [, , best, over, under, blind] = policies.map(p => p.acc);
    const agree = ai[1] * person + (1 - ai[1]) * (1 - person);
    const hPart = share[0] * ai[0], lPart = share[1] * person, h = short(person);
    const pts = x => String(Math.round(x * 1000) / 10);
    const at = shown => ({share, person, policies, overall, shown, now: shown - 1});
    return frames([
      {...at(1), zh: `教学数字。按 AI 显示的把握把案例分成两组：高把握组 H 占 ${pts(share[0])}%，低把握组 L 占 ${pts(share[1])}%。柱宽是占比，柱高是这组的准确率。人单独判断，两组都是 ${h}。`,
        en: `Teaching numbers. Split the cases by the confidence the AI displays: a high-confidence group H with ${pts(share[0])}% of cases and a low-confidence group L with ${pts(share[1])}%. Width is the share, height the accuracy in that group. The person alone is ${h} in both.`},
      {...at(2), zh: `只靠 AI：H 组 ${ai[0]}，L 组 ${ai[1]}。面积相加就是总体准确率：${share[0]}×${ai[0]} + ${share[1]}×${ai[1]} = ${short(overall)}。`,
        en: `AI only: ${ai[0]} in H, ${ai[1]} in L. The areas add up to overall accuracy: ${share[0]}×${ai[0]} + ${share[1]}×${ai[1]} = ${short(overall)}.`},
      {...at(3), zh: `高把握照做，低把握自己判断：${share[0]}×${ai[0]} + ${share[1]}×${h} = ${short(hPart)} + ${short(lPart)} = ${short(best)}，高于两条基线。L 组里人比 AI 准，把握信号正好把这组挑了出来。`,
        en: `Follow when confident, decide alone when not: ${share[0]}×${ai[0]} + ${share[1]}×${h} = ${short(hPart)} + ${short(lPart)} = ${short(best)}, above both lines. In L the person beats the AI, and the confidence signal picks out exactly that group.`},
      {...at(4), zh: `过度依赖：低把握时也照做一半。${short(hPart)} + ${share[1]}×(0.5×${ai[1]} + 0.5×${h}) = ${short(over)}，比 AI 多出的 ${pts(best - overall)} 个点只剩 ${pts(over - overall)} 个。`,
        en: `Over-reliance: also follow half of the low-confidence advice. ${short(hPart)} + ${share[1]}×(0.5×${ai[1]} + 0.5×${h}) = ${short(over)}; the ${pts(best - overall)}-point gain over the AI shrinks to ${pts(over - overall)}.`},
      {...at(5), zh: `依赖不足：高把握时也推翻三分之一。${share[0]}×(⅔×${ai[0]} + ⅓×${h}) + ${short(lPart)} = ${short(under)}，退回到 AI 单独的水平，等于没加人。`,
        en: `Under-reliance: also override a third of the confident advice. ${share[0]}×(⅔×${ai[0]} + ⅓×${h}) + ${short(lPart)} = ${short(under)}, back to the AI alone, as if no person were involved.`},
      {...at(6), zh: `同样按把握做，但把握信号没有信息：AI 在两组都是 ${short(overall)}。${share[0]}×${short(overall)} + ${share[1]}×${h} = ${short(blind)}，团队低于 AI 单独。`,
        en: `The same rule with a confidence signal that carries no information, the AI at ${short(overall)} in both groups: ${share[0]}×${short(overall)} + ${share[1]}×${h} = ${short(blind)}, below the AI alone.`},
      {...at(6), now: 2, agree, done: true,
        zh: `同意不等于依赖。第三种做法在 L 组完全自己判断（r = 0），仍有 ${ai[1]}×${h} + ${short(1 - ai[1])}×${short(1 - person)} = ${short(agree)} 的案例和 AI 一致：二选一时，两边都错也算一致。要分开依赖和碰巧一致，得先记下人的初判。`,
        en: `Agreement is not reliance. The third policy judges L entirely alone (r = 0), yet ${ai[1]}×${h} + ${short(1 - ai[1])}×${short(1 - person)} = ${short(agree)} of those cases agree with the AI: in a binary choice, both being wrong also counts. Telling reliance from coincidence needs the person's initial judgement.`}
    ]);
  };

  /* 07-evaluation/eval-observability §5–6 (made-up teaching numbers): a judge with s = 0.95, t = 0.85 on a true pass
     rate p = 0.90, 1% of 100,000 requests judged a day; a slice with 2% of traffic; then the judge drifts to t = 0.75. */
  F.judgeSampling = function ({s = 0.95, t = 0.85, p = 0.90, traffic = 100000, rate = 0.01, slice = 0.02, sliceRate = 0.25,
    sliceFall = [0.90, 0.60], passed = 17, drift = [0.75, 0.886]} = {}) {
    const z = 1.96, power = 0.84, j = s + t - 1;
    const pct = (x, d = 0) => (x * 100).toFixed(d) + '%', pt = x => (x * 100).toFixed(1);
    const cells = (pp, tt) => ({p: pp, t: tt, tp: s * pp, fn: (1 - s) * pp, fp: (1 - tt) * (1 - pp), tn: tt * (1 - pp)});
    const now = cells(p, t), q = now.tp + now.fp, n = Math.round(traffic * rate);
    const se = m => Math.sqrt(q * (1 - q) / m) / j, mde = m => (z + power) * Math.SQRT2 * se(m);
    const pHat = (q + t - 1) / j, raw = Math.sqrt(q * (1 - q) / n), half = z * se(n), mdeAll = mde(n);
    const sliceN = Math.round(traffic * slice * rate);
    const wilson = (k, m) => {
      const f = k / m, d = 1 + z * z / m, c = (f + z * z / (2 * m)) / d, w = z / d * Math.sqrt(f * (1 - f) / m + z * z / (4 * m * m));
      return [c - w, c + w];
    };
    const [lo, hi] = wilson(passed, sliceN), fall = Math.round((sliceFall[0] - sliceFall[1]) * 100), move = slice * (sliceFall[0] - sliceFall[1]);
    const strat = Math.round(traffic * slice * sliceRate), rest = Math.round(traffic * (1 - slice) * rate);
    const sliceHalf = z * se(strat), sliceMde = mde(strat);
    const [t2, p2] = drift, later = cells(p2, t2), q2 = later.tp + later.fp;
    const base = {s, t, p, q, n, pHat, half, mdeAll, slice, sliceN, passed, lo, hi, sliceFall, move, strat, rest, sliceHalf, sliceMde, t2, p2, q2};
    const calls = (strat + rest).toLocaleString('en-US');
    return frames([
      {...base, stage: 0, view: 'overall', cells: now,
        zh: `教学用的虚构数字。按人工标准，线上回答 ${pct(p)} 合格、${pct(1 - p)} 不合格。左边方块的宽度就是流量份额。`,
        en: `Made-up teaching numbers. By the human standard, ${pct(p)} of production answers pass and ${pct(1 - p)} fail. Widths in the square on the left are shares of traffic.`},
      {...base, stage: 1, view: 'overall', cells: now, judged: true,
        zh: `judge 放过合格回答的 s = ${s}、不合格回答的 1 − t = ${short(1 - t)}：${s}×${short(p)} = ${short(now.tp)}，加上 ${short(1 - t)}×${short(1 - p)} = ${short(now.fp)}，judge 看到的通过率 q = ${short(q)}。`,
        en: `The judge passes s = ${s} of good answers and 1 − t = ${short(1 - t)} of bad ones: ${s}×${short(p)} = ${short(now.tp)} plus ${short(1 - t)}×${short(1 - p)} = ${short(now.fp)}, so the judge sees q = ${short(q)}.`},
      {...base, stage: 2, view: 'overall', cells: now, judged: true,
        zh: `用已知的 s、t 反解：p̂ = (${short(q)} + ${t} − 1)/${short(j)} = ${short(pHat)}。每天评 ${n.toLocaleString('en-US')} 条，SE = ${raw.toFixed(4)}/${short(j)} = ${se(n).toFixed(4)}，95% 区间是 ${pct(pHat)} ± ${pt(half)} 个百分点。`,
        en: `Invert with the known s and t: p̂ = (${short(q)} + ${t} − 1)/${short(j)} = ${short(pHat)}. With ${n.toLocaleString('en-US')} judged a day, SE = ${raw.toFixed(4)}/${short(j)} = ${se(n).toFixed(4)}, so the 95% interval is ${pct(pHat)} ± ${pt(half)} points.`},
      {...base, stage: 3, view: 'overall', cells: now, judged: true,
        zh: `日环比要有八成把握报警：MDE ≈ ${(z + power).toFixed(1)} × ${Math.SQRT2.toFixed(3)} × ${se(n).toFixed(4)} ≈ ${pt(mdeAll)} 个百分点。真实通过率得从 ${pct(p)} 掉到 ${pct(p - mdeAll, 1)}。`,
        en: `For a day-over-day alarm with 80% power, MDE ≈ ${(z + power).toFixed(1)} × ${Math.SQRT2.toFixed(3)} × ${se(n).toFixed(4)} ≈ ${pt(mdeAll)} points: the true pass rate has to fall from ${pct(p)} to ${pct(p - mdeAll, 1)}.`},
      {...base, stage: 4, view: 'slice', cells: now, judged: true,
        zh: `换成占流量 ${pct(slice)} 的切片：${pct(rate)} 抽样每天只评 ${sliceN} 条。${passed}/${sliceN} 通过时，Wilson 区间是 ${pct(lo)} 到 ${pct(hi)}。切片从 ${pct(sliceFall[0])} 跌到 ${pct(sliceFall[1])}，整体只降 ${slice} × ${fall} = ${pt(move)} 个点。`,
        en: `Now a slice with ${pct(slice)} of traffic: at ${pct(rate)} sampling only ${sliceN} are judged a day. With ${passed} of ${sliceN} passing, the Wilson interval runs from ${pct(lo)} to ${pct(hi)}. The slice falls from ${pct(sliceFall[0])} to ${pct(sliceFall[1])}, yet the overall rate drops only ${slice} × ${fall} = ${pt(move)} points.`},
      {...base, stage: 5, view: 'slice', cells: now, judged: true,
        zh: `对这个切片单独抽 ${pct(sliceRate)}：${strat} + ${rest} = ${calls} 次 judge 调用，切片的 MDE 降到约 ${pt(sliceMde)} 个百分点，${fall} 个点的下跌看得见了。`,
        en: `Sample this slice separately at ${pct(sliceRate)}: ${strat} + ${rest} = ${calls} judge calls a day, and the slice's MDE drops to about ${pt(sliceMde)} points, so a ${fall}-point fall now shows.`},
      {...base, stage: 6, view: 'overall', cells: later, judged: true, done: true,
        zh: `一个月后 judge 换了版本，t 从 ${t} 降到 ${t2}；真实通过率同时降到 ${pct(p2, 1)}。judge 看到 ${s}×${p2} + ${short(1 - t2)}×${short(1 - p2)} ≈ ${q2.toFixed(3)}，曲线是平的。只有用锚点集分开重测 s 和 t，才看得出 t 变了。`,
        en: `A month later the judge changes version and t drops from ${t} to ${t2}, while the true pass rate falls to ${pct(p2, 1)}. The judge sees ${s}×${p2} + ${short(1 - t2)}×${short(1 - p2)} ≈ ${q2.toFixed(3)}: a flat curve. Only re-measuring s and t separately on an anchor set shows that t moved.`}
    ]);
  };

  /* 10-agents/single-vs-multi-agent §5 (teaching numbers): three independent subquestions, 4 tool calls each at
     10 s and 4k tokens; a 3k fixed prompt per context, a 2k answer, 0.5k briefs, 1k summaries, 10 s to plan and to synthesise. */
  F.subagentTimeline = function ({subs = 3, calls = 4, step = 10, ret = 4, prompt = 3, answer = 2, brief = 0.5, summary = 1,
    s1 = 0.90, s2 = 0.95, drops = [0.02, 0.10]} = {}) {
    const names = ['A', 'B', 'C'].slice(0, subs);
    const block = (lane, start, kind) => ({lane, start, end: start + step, kind});
    const single = Array.from({length: subs * calls}, (_, k) => block('single', k * step, 'tool'));
    single.push(block('single', subs * calls * step, 'step'));
    const parallel = [block('lead', 0, 'step')];
    names.forEach(lane => { for (let k = 0; k < calls; k++) parallel.push(block(lane, step + k * step, 'tool')); });
    parallel.push(block('lead', step + calls * step, 'step'));
    const chained = [block('lead', 0, 'step')], phases = [step];
    let clock = step;
    names.forEach(lane => {
      for (let k = 0; k < calls; k++) chained.push(block(lane, clock + k * step, 'tool'));
      clock += calls * step; phases.push(calls * step);
      chained.push(block('lead', clock, 'step'));
      clock += step; phases.push(step);
    });
    const end = list => Math.max(...list.map(b => b.end));
    const time = {single: end(single), parallel: end(parallel), chained: end(chained)};
    const tokens = {single: prompt + subs * calls * ret + answer, lead: prompt + subs * brief + subs * summary + answer, sub: prompt + brief + calls * ret + summary};
    tokens.multi = tokens.lead + subs * tokens.sub;
    const rise = tokens.multi / tokens.single - 1;
    const cube = x => x ** subs, pSingle = cube(s1), pMulti = drops.map(d => cube(s2 * (1 - d))), dStar = 1 - s1 / s2;
    const k = x => `${x}k`, pc = x => `${Math.round(x * 100)}%`;
    const base = {names, single, parallel, chained, time, tokens, rise, pSingle, pMulti, dStar, drops, s1, s2};
    return frames([
      {...base, stage: 0, zh: `教学数字：查 A、B、C 三家图书馆的节假日规则，每家要 ${calls} 次工具调用，每次 ${step} 秒、返回 ${k(ret)} token。单 agent 依次做完 ${subs * calls} 次，再用 ${step} 秒写答案：${subs * calls}×${step} + ${step} = ${time.single} 秒。Token 是 ${prompt} + ${subs * calls}×${ret} + ${answer} = ${k(tokens.single)}，全在一个上下文里。`,
        en: `Teaching numbers: find the holiday rules of libraries A, B and C, ${calls} tool calls each, every call ${step} s and ${k(ret)} tokens back. The single agent runs all ${subs * calls} in a row, then spends ${step} s on the answer: ${subs * calls}×${step} + ${step} = ${time.single} s. Tokens: ${prompt} + ${subs * calls}×${ret} + ${answer} = ${k(tokens.single)}, all in one context.`},
      {...base, stage: 1, zh: `拆开：协调者规划 ${step} 秒，三个子 agent 各做 ${calls} 次调用、同时进行，协调者再汇总 ${step} 秒：${step} + ${calls}×${step} + ${step} = ${time.parallel} 秒。不是 ${time.single} 秒的三分之一，因为规划和汇总没法并行。`,
        en: `Split it: the lead plans for ${step} s, three subagents run ${calls} calls each at the same time, and the lead synthesises for ${step} s: ${step} + ${calls}×${step} + ${step} = ${time.parallel} s. Not a third of ${time.single} s, because planning and synthesis cannot run in parallel.`},
      {...base, stage: 2, zh: `Token 账：协调者 ${prompt} + ${subs * brief} + ${subs * summary} + ${answer} = ${k(tokens.lead)}，每个子 agent ${prompt} + ${brief} + ${calls * ret} + ${summary} = ${k(tokens.sub)}，三个共 ${k(subs * tokens.sub)}。合计 ${k(tokens.multi)}，比单 agent 多约 ${pc(rise)}；最长的单个上下文却从 ${k(tokens.single)} 降到 ${k(tokens.sub)}。`,
        en: `The token bill: the lead uses ${prompt} + ${subs * brief} + ${subs * summary} + ${answer} = ${k(tokens.lead)}, each subagent ${prompt} + ${brief} + ${calls * ret} + ${summary} = ${k(tokens.sub)}, ${k(subs * tokens.sub)} for all three. That is ${k(tokens.multi)} in all, about ${pc(rise)} more than the single agent, yet the longest single context falls from ${k(tokens.single)} to ${k(tokens.sub)}.`},
      {...base, stage: 3, zh: `答对要三个关键事实都保住。单 agent 在长上下文里每个保住 ${s1.toFixed(2)}：${s1}³ = ${pSingle.toFixed(3)}。子 agent 是 ${s2}，但摘要以概率 d 漏掉它：d = ${pc(drops[0])} 时 ${pMulti[0].toFixed(3)}，d = ${pc(drops[1])} 时 ${pMulti[1].toFixed(3)}。持平点 d* = 1 − ${s1.toFixed(2)}/${s2} ≈ ${(dStar * 100).toFixed(1)}%。`,
        en: `A right answer needs all three key facts. The single agent keeps each with ${s1.toFixed(2)} in its long context: ${s1}³ = ${pSingle.toFixed(3)}. A subagent keeps it with ${s2}, but its summary drops it with probability d: ${pMulti[0].toFixed(3)} at d = ${pc(drops[0])}, ${pMulti[1].toFixed(3)} at d = ${pc(drops[1])}. They break even at d* = 1 − ${s1.toFixed(2)}/${s2} ≈ ${(dStar * 100).toFixed(1)}%.`},
      {...base, stage: 4, done: true, zh: `让子问题先后依赖：A → B → C。并行宽度变成 1：${phases.join(' + ')} = ${time.chained} 秒，比单 agent 慢 ${time.chained - time.single} 秒。并行只在子问题互相独立时省时间；规划和汇总始终串行。`,
        en: `Make the subquestions sequential, A → B → C. The parallel width drops to 1: ${phases.join(' + ')} = ${time.chained} s, ${time.chained - time.single} s slower than the single agent. Parallelism saves time only when the subquestions are independent; planning and synthesis stay serial.`}
    ]);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = {F, frames};
  if (typeof document === 'undefined' || !scope.AlgoLab) return;

  /* ---------------------------------------------------------------- page */
  const {stepper, V, s, t} = scope.AlgoLab;
  const LANG = (scope.SITE && scope.SITE.lang) === 'en' ? 'en' : 'zh';
  const FIGURES = {};
  const cell = (svg, x, y, w, ht, text = '', cls = 'algo-val') => {
    const rect = s('rect', {x, y, width: w, height: ht, rx: 6, class: 'algo-cell'});
    const label = s('text', {x: x + w / 2, y: y + ht / 2 + 5, 'text-anchor': 'middle', class: cls, text});
    svg.append(rect, label);
    return {rect, label, set(value, state = '') { label.textContent = value; rect.setAttribute('class', 'algo-cell' + (state ? ' ' + state : '')); }};
  };
  const show = (node, on) => node.classList.toggle('is-hidden', !on);

  FIGURES['step-contrastive'] = name => stepper(name, F.contrastive(), {height: 250, readouts: f => [['Σ e^s', f.stage >= 1 ? fixed(f.total, 2) : '—'], [t('损失 L', 'loss L'), f.stage >= 3 ? `−log ${fixed(f.p[0], 3)} ≈ ${fixed(f.loss, 3)}` : '—', f.stage >= 3 ? 'key' : '']], setup(svg) {
    const xs = [200, 312, 424], w = 96, ht = 28;
    const heads = [t('正例', 'positive'), t('对照 1', 'comparison 1'), t('对照 2', 'comparison 2')];
    heads.forEach((head, j) => V.text(svg, xs[j] + w / 2, 30, head, 'algo-head', 'middle'));
    const rowY = [46, 92, 138, 194];
    const labels = [t('分数 s', 'score s'), 'e^s', 'softmax p', t('梯度 ∂L/∂z', 'gradient ∂L/∂z')];
    const rows = rowY.map((y, r) => {
      const name = V.text(svg, 30, y + 19, labels[r], 'algo-head');
      return {name, cells: xs.map(x => cell(svg, x, y, w, ht))};
    });
    const bars = xs.map(x => { const bar = s('rect', {x, y: 170, width: 0, height: 6, rx: 3, class: 'algo-bar'}); svg.append(bar); return bar; });
    const arrows = xs.map(() => { const path = s('path', {class: 'algo-edge'}); svg.append(path); return path; });
    return frame => {
      const {stage} = frame;
      rows[0].cells.forEach((c, j) => c.set(String(frame.scores[j]), j === 0 && stage === 0 ? 'is-keep' : ''));
      rows[1].cells.forEach((c, j) => c.set(stage >= 1 ? fixed(frame.exps[j], 2) : '', stage === 1 ? 'is-look' : ''));
      rows[2].cells.forEach((c, j) => c.set(stage >= 2 ? fixed(frame.p[j], 3) : '', stage === 3 && j === 0 ? 'is-keep' : stage === 2 ? 'is-look' : ''));
      rows[3].cells.forEach((c, j) => c.set(stage >= 4 ? signed(frame.grad[j], 3) : '', stage >= 4 ? (j === 0 ? 'is-look' : 'is-change') : ''));
      rows.forEach((row, r) => row.name.classList.toggle('is-dim', stage < [0, 1, 2, 4][r]));
      bars.forEach((bar, j) => { bar.setAttribute('width', stage >= 2 ? frame.p[j] * w : 0); bar.setAttribute('class', 'algo-bar' + (j === 0 && stage >= 3 ? ' is-now' : '')); });
      arrows.forEach((path, j) => {
        const x = xs[j] + w + 10, mid = rowY[3] + ht / 2, len = 8 + Math.abs(frame.grad[j]) * 40;
        // descent moves against the gradient: a negative gradient raises the score
        const up = frame.grad[j] < 0;
        path.setAttribute('d', up ? `M${x} ${mid + len / 2} L${x} ${mid - len / 2} M${x - 5} ${mid - len / 2 + 6} L${x} ${mid - len / 2} L${x + 5} ${mid - len / 2 + 6}`
          : `M${x} ${mid - len / 2} L${x} ${mid + len / 2} M${x - 5} ${mid + len / 2 - 6} L${x} ${mid + len / 2} L${x + 5} ${mid + len / 2 - 6}`);
        path.setAttribute('class', 'algo-edge ' + (up ? 'is-look-line' : 'is-change') + (stage >= 4 ? '' : ' is-hidden'));
      });
    };
  }});

  FIGURES['step-embedding-swap'] = name => stepper(name, F.embeddingSwap(), {height: 250, readouts: f => { const kind = k => (k === 'old' ? t('旧', 'old') : t('新', 'new')); return [[t('查询', 'query'), `${kind(f.queryKind)} encoder`], [t('索引', 'index'), `${kind(f.docKind)} ${t('文档向量', 'document vectors')}`], ['q · A', String(f.scores[0])], ['q · B', String(f.scores[1])], [t('排第一', 'ranks first'), `${f.top} ${f.bad ? '✗' : '✓'}`, f.bad ? 'bad' : 'good']]; }, setup(svg) {
    const cx = 160, cy = 128, unit = 82;
    const P = ([x, y]) => [cx + x * unit, cy - y * unit];
    svg.append(
      s('line', {x1: cx - unit - 24, y1: cy, x2: cx + unit + 24, y2: cy, class: 'algo-edge'}),
      s('line', {x1: cx, y1: cy - unit - 24, x2: cx, y2: cy + unit + 24, class: 'algo-edge'}),
      s('circle', {cx, cy, r: unit, class: 'algo-ghost'}));
    const arrow = name + '-arrow';
    svg.append(V.markers(arrow));
    const query = s('line', {x1: cx, y1: cy, class: 'algo-edge is-look-line', 'marker-end': `url(#${arrow}-blue)`});
    const queryLabel = V.text(svg, 0, 0, '', 'algo-strong', 'middle');
    svg.append(query);
    const docs = ['A', 'B'].map(() => {
      const dot = s('circle', {r: 8, class: 'algo-cell'});
      const label = V.text(svg, 0, 0, '', 'algo-strong', 'middle');
      svg.append(dot);
      return {dot, label};
    });
    return frame => {
      const [qx, qy] = P(frame.query);
      query.setAttribute('x2', cx + (qx - cx) * 0.9); query.setAttribute('y2', cy + (qy - cy) * 0.9);
      // a vertical query is labelled on its left, a horizontal one above; documents sit right of / below their dot
      const vertical = frame.query[0] === 0;
      queryLabel.setAttribute('x', vertical ? qx - 46 : qx - 6); queryLabel.setAttribute('y', vertical ? qy + 18 : qy - 16);
      queryLabel.textContent = `q (${frame.queryKind === 'old' ? t('旧', 'old') : t('新', 'new')})`;
      docs.forEach((doc, i) => {
        const [x, y] = P(frame.docs[i].at);
        doc.dot.setAttribute('cx', x); doc.dot.setAttribute('cy', y);
        const winner = frame.top === frame.docs[i].name;
        doc.dot.setAttribute('class', 'algo-cell ' + (frame.bad && winner ? 'is-bad' : winner ? 'is-keep' : ''));
        const onY = frame.docs[i].at[0] === 0;
        doc.label.setAttribute('x', onY ? x + 44 : x); doc.label.setAttribute('y', onY ? y + 5 : y + 30);
        doc.label.textContent = `${frame.docs[i].name} (${frame.docKind === 'old' ? t('旧', 'old') : t('新', 'new')})`;
      });
    };
  }});

  FIGURES['step-rrf'] = name => stepper(name, {modes: [
    {id: 'both', zh: '两路各取前 3', en: 'Top 3 from both', frames: F.rrf([['A', 'B', 'C'], ['B', 'C', 'D']])},
    {id: 'keyword', zh: '只保留关键词前 3', en: 'Keyword top 3 only', frames: F.rrf([['A', 'B', 'C'], []])},
    {id: 'top1', zh: '两路各取前 1', en: 'Top 1 from both', frames: F.rrf([['A'], ['B']])}
  ]}, {height: 236, readouts: f => [[t('融合后', 'fused order'), f.done ? f.order : '—', f.done ? 'good' : '']], setup(svg) {
    const colX = [30, 150], chipW = 100, chipH = 30, rowY = [52, 92, 132];
    V.text(svg, colX[0], 36, t('关键词', 'keyword'), 'algo-head');
    V.text(svg, colX[1], 36, t('向量', 'dense'), 'algo-head');
    const chips = colX.map(x => rowY.map(y => cell(svg, x, y, chipW, chipH, '', 'algo-note')));
    const docs = ['A', 'B', 'C', 'D'], barX = 330, scale = 1300, docY = d => 52 + docs.indexOf(d) * 40;
    const bars = Object.fromEntries(docs.map(d => {
      V.text(svg, 300, docY(d) + 20, d, 'algo-strong');
      const kw = s('rect', {x: barX, y: docY(d) + 6, width: 0, height: 18, rx: 3, class: 'algo-bar'});
      const dense = s('rect', {x: barX, y: docY(d) + 6, width: 0, height: 18, rx: 3, class: 'algo-bar is-tall'});
      const value = V.text(svg, barX, docY(d) + 20, '', 'algo-note');
      svg.append(kw, dense);
      return [d, {kw, dense, value}];
    }));
    return frame => {
      colX.forEach((_, c) => rowY.forEach((_, r) => {
        const doc = frame.lists[c][r];
        const counted = doc && frame.stage >= c + 1;
        chips[c][r].set(doc ? `#${r + 1} ${doc}${counted ? `  1/${10 + r + 1}` : ''}` : '—', !doc ? 'is-out' : counted ? (c ? 'is-change' : 'is-look') : '');
      }));
      docs.forEach(d => {
        const [a, b] = frame.parts[d], bar = bars[d];
        bar.kw.setAttribute('width', a * scale);
        bar.dense.setAttribute('x', barX + a * scale); bar.dense.setAttribute('width', b * scale);
        bar.value.setAttribute('x', barX + (a + b) * scale + 8);
        bar.value.textContent = a + b ? fixed(a + b, 4) : (frame.stage >= 2 ? '0' : '');
      });
    };
  }});

  FIGURES['step-retrieval-metrics'] = name => stepper(name, F.retrievalMetrics(), {height: 230, setup(svg) {
    V.text(svg, 30, 36, t('标注的相关文档', 'labeled relevant'), 'algo-head');
    V.text(svg, 30, 126, t('返回的前 3 篇', 'returned top 3'), 'algo-head');
    const relevant = [0, 1, 2].map(i => cell(svg, 30 + i * 56, 46, 46, 34));
    const returned = [0, 1, 2].map(i => cell(svg, 30 + i * 56, 136, 46, 34));
    [0, 1, 2].forEach(i => V.text(svg, 53 + i * 56, 188, '#' + (i + 1), 'algo-idx', 'middle'));
    const names = {hit: 'Hit@3', precision: 'Precision@3', recall: 'Recall@3', rr: 'Reciprocal rank'};
    const notes = {hit: t('至少命中一篇', 'at least one hit'), precision: t('1 篇相关 / 返回 3 篇', '1 relevant / 3 returned'),
      recall: t('找回 1 篇 / 相关 3 篇', '1 found / 3 relevant'), rr: t('第一篇相关在第 2 位', 'first hit at rank 2')};
    const values = {hit: '1', precision: '1/3', recall: '1/3', rr: '1/2'};
    const rows = Object.keys(names).map((key, i) => {
      const y = 40 + i * 44;
      const label = V.text(svg, 270, y + 22, names[key], 'algo-strong');
      const value = cell(svg, 430, y, 60, 32);
      const note = V.text(svg, 504, y + 21, '', 'algo-note');
      return {key, label, value, note};
    });
    return frame => {
      relevant.forEach((c, i) => {
        const doc = frame.relevant[i];
        c.set(doc || '', !doc ? 'is-out' : (frame.missed || []).includes(doc) ? 'is-change' : (frame.hits || []).includes(doc) ? 'is-keep' : '');
      });
      returned.forEach((c, i) => {
        const doc = frame.returned[i], hit = (frame.hits || []).includes(doc);
        c.set(doc, frame.stage >= 1 ? (hit ? 'is-keep' : 'is-out') : '');
      });
      rows.forEach(row => {
        const on = frame.metrics.includes(row.key);
        const value = frame.values ? frame.values[row.key] : values[row.key];
        row.value.set(on ? value : '', on ? (frame.done && row.key === 'recall' ? 'is-change' : 'is-look') : '');
        row.label.classList.toggle('is-dim', !on);
        row.note.textContent = on && !frame.done ? notes[row.key] : on && row.key === 'recall' ? t('相关只有 C', 'only C is relevant') : '';
      });
    };
  }});

  FIGURES['step-pq'] = name => stepper(name, F.pq(), {height: 250, readouts: f => (f.done ? f.results.map(([code, total]) => [t(`编码 [${code.join(', ')}]`, `code [${code.join(', ')}]`), `${f.table[0][code[0]]} + ${f.table[1][code[1]]} = ${total}`, total === 2 ? 'good' : ''])
      : [[t('编码', 'code'), f.code ? `[${f.code.join(', ')}]` : '—'], [t('查表相加', 'lookups added'), f.code ? `${f.picks.join(' + ')} = ${f.total}` : '—', f.code ? 'key' : '']]), setup(svg) {
    V.text(svg, 30, 34, t('查询', 'query'), 'algo-head');
    const q = [1, 2, 3, 4].map((v, i) => cell(svg, 90 + i * 44 + (i >= 2 ? 18 : 0), 14, 38, 30, String(v)));
    const tables = [0, 1].map(m => {
      const x0 = 30 + m * 300;
      const head = V.text(svg, x0, 82, t(`第 ${m + 1} 段码本`, `codebook ${m + 1}`), 'algo-head');
      const rows = [0, 1, 2].map(c => {
        const y = 92 + c * 34;
        const id = V.text(svg, x0, y + 20, '#' + c, 'algo-note');
        const center = cell(svg, x0 + 28, y, 86, 28, '', 'algo-note');
        const dist = cell(svg, x0 + 124, y, 70, 28);
        return {center, dist};
      });
      return {head, rows};
    });
    return frame => {
      q.forEach((c, i) => c.set(String(frame.query[Math.floor(i / 2)][i % 2]), frame.stage === 0 ? (i < 2 ? 'is-look' : 'is-change') : ''));
      tables.forEach((tab, m) => {
        tab.head.classList.toggle('is-dim', frame.stage < 1);
        tab.rows.forEach((row, c) => {
          const picked = frame.code && frame.code[m] === c;
          row.center.set(frame.stage >= 1 ? `[${frame.codebooks[m][c].join(', ')}]` : '', picked ? 'is-look' : '');
          row.dist.set(frame.stage >= 2 ? `d = ${frame.table[m][c]}` : '', picked ? 'is-keep' : frame.stage === 2 ? 'is-change' : '');
        });
      });
    };
  }});

  FIGURES['step-vit-patches'] = name => stepper(name, F.vitPatches(), {height: 236, setup(svg) {
    const size = 30, x0 = 24, y0 = 34;
    V.text(svg, x0, 22, t('图片', 'image'), 'algo-head');
    const pix = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const x = x0 + c * size + (c >= 2 ? 8 : 0), y = y0 + r * size + (r >= 2 ? 8 : 0);
      pix.push({r, c, ...cell(svg, x, y, size - 3, size - 3, String(1 + 4 * r + c), 'algo-note')});
    }
    const patchOf = (r, c) => Math.floor(r / 2) * 2 + Math.floor(c / 2);
    const seqX = 200, w = 30;
    V.text(svg, seqX, 22, t('展平后的 4 个 token', '4 flattened tokens'), 'algo-head');
    const seq = [0, 1, 2, 3].map(p => [0, 1, 2, 3].map(i => cell(svg, seqX + i * (w + 3), y0 + p * 36, w, 28, '', 'algo-note')));
    const embX = 420;
    V.text(svg, embX, 22, t('均值', 'mean'), 'algo-head');
    V.text(svg, embX + 66, 22, t('右 − 左', 'right − left'), 'algo-head');
    const emb = [0, 1, 2, 3].map(p => [0, 1].map(i => cell(svg, embX + i * 66, y0 + p * 36, 58, 28)));
    const arrows = [0, 1, 2, 3].map(p => V.text(svg, 352, y0 + p * 36 + 19, '', 'algo-note', 'middle'));
    const extra = [0, 1, 2, 3].map(i => cell(svg, seqX + i * (w + 3), 196, w, 28, '', 'algo-note'));
    const extraEmb = [0, 1].map(i => cell(svg, embX + i * 66, 196, 58, 28));
    const extraArrow = V.text(svg, 352, 215, '', 'algo-note', 'middle');
    return frame => {
      pix.forEach(px => {
        const p = patchOf(px.r, px.c);
        px.set(px.label.textContent, frame.current === p ? 'is-look' : frame.stage >= 1 && (frame.flat || 0) > p ? 'is-out' : '');
      });
      seq.forEach((row, p) => row.forEach((c, i) => c.set((frame.flat || 0) > p ? String(frame.patches[p][i]) : '', frame.current === p ? 'is-look' : '')));
      emb.forEach((row, p) => row.forEach((c, i) => c.set((frame.projected || 0) > p ? String(frame.embeddings[p][i]) : '', frame.done && p === 0 ? 'is-bad' : (frame.projected || 0) > p ? 'is-keep' : '')));
      arrows.forEach((a, p) => { a.textContent = (frame.projected || 0) > p ? '→' : ''; });
      extra.forEach((c, i) => c.set(frame.done ? String(frame.other[i]) : '', frame.done ? 'is-change' : 'is-hidden'));
      extraEmb.forEach((c, i) => c.set(frame.done ? String(frame.otherEmbedding[i]) : '', frame.done ? 'is-bad' : 'is-hidden'));
      extraArrow.textContent = frame.done ? '→' : '';
    };
  }});

  FIGURES['step-qwen-merge'] = name => stepper(name, {modes: [[280, 280], [280, 560], [560, 560]].map(([hh, ww]) => (
    {id: `${hh}x${ww}`, zh: `${hh} × ${ww}`, en: `${hh} × ${ww}`, frames: F.qwenMerge(hh, ww)}))}, {height: 270, readouts: f => [[t('14 像素 patch', '14-px patches'), f.stage >= 1 ? `${f.ph} × ${f.pw} = ${f.ph * f.pw}` : '—'], [t('2×2 合并后', 'after the 2×2 merge'), f.stage >= 2 ? `${f.mh} × ${f.mw} = ${f.mh * f.mw}` : '—', f.stage >= 2 ? 'key' : ''], ['N = H/28 · W/28', f.stage >= 3 ? String(f.mh * f.mw) : '—', f.done ? 'good' : '']], setup(svg) {
    const scale = 176 / 560, x0 = 30, y0 = 16;
    const box = s('rect', {x: x0, y: y0, rx: 4, class: 'algo-cell'});
    const fine = s('g', {class: 'algo-grid-fine'}), coarse = s('g', {class: 'algo-grid-coarse'});
    const group = s('rect', {x: x0, y: y0, width: 28 * scale, height: 28 * scale, class: 'algo-band'});
    svg.append(box, fine, coarse, group);
    const size = V.text(svg, x0, 0, '', 'algo-note');
    let drawn = '';
    const grid = (node, step, hh, ww) => {
      node.textContent = '';
      for (let x = step; x < ww; x += step) node.append(s('line', {x1: x0 + x * scale, y1: y0, x2: x0 + x * scale, y2: y0 + hh * scale}));
      for (let y = step; y < hh; y += step) node.append(s('line', {x1: x0, y1: y0 + y * scale, x2: x0 + ww * scale, y2: y0 + y * scale}));
    };
    return frame => {
      const key = frame.height + 'x' + frame.width;
      if (drawn !== key) {
        box.setAttribute('width', frame.width * scale); box.setAttribute('height', frame.height * scale);
        grid(fine, 14, frame.height, frame.width); grid(coarse, 28, frame.height, frame.width);
        drawn = key;
      }
      show(fine, frame.stage >= 1); show(coarse, frame.stage >= 2); show(group, frame.stage === 2);
      size.textContent = `${frame.height} × ${frame.width} px`;
      size.setAttribute('y', y0 + frame.height * scale + 18);
    };
  }});

  FIGURES['step-qformer-masks'] = name => stepper(name, {modes: ['itc', 'itm', 'itg'].map(objective => (
    {id: objective, zh: objective.toUpperCase(), en: objective.toUpperCase(), frames: F.qformerMask(objective)}))}, {height: 236, setup(svg) {
    const labels = ['q1', 'q2', 't1', 't2', 't3'], size = 34, x0 = 230, y0 = 46;
    labels.forEach((label, i) => {
      V.text(svg, x0 + i * size + size / 2, y0 - 10, label, 'algo-head', 'middle');
      V.text(svg, x0 - 12, y0 + i * size + size / 2 + 5, label, 'algo-head', 'end');
    });
    V.text(svg, 30, 64, t('行 = 谁在读', 'row = reader'), 'algo-note');
    V.text(svg, 30, 86, t('列 = 被读的位置', 'column = position read'), 'algo-note');
    const legend = [[t('可见', 'visible'), 'is-keep'], [t('不可见', 'hidden'), 'is-cross']];
    legend.forEach(([text, cls], i) => {
      svg.append(s('rect', {x: 30, y: 116 + i * 26, width: 16, height: 16, rx: 3, class: 'algo-cell ' + cls}));
      V.text(svg, 54, 129 + i * 26, text, 'algo-note');
    });
    svg.append(s('line', {x1: x0 + 2 * size, y1: y0 - 2, x2: x0 + 2 * size, y2: y0 + 5 * size + 2, class: 'algo-edge algo-dash'}),
      s('line', {x1: x0 - 2, y1: y0 + 2 * size, x2: x0 + 5 * size + 2, y2: y0 + 2 * size, class: 'algo-edge algo-dash'}));
    const cells = labels.map((_, r) => labels.map((_, c) => {
      const rect = s('rect', {x: x0 + c * size + 2, y: y0 + r * size + 2, width: size - 4, height: size - 4, rx: 4, class: 'algo-cell'});
      svg.append(rect);
      return rect;
    }));
    const title = V.text(svg, 440, 64, '', 'algo-strong');
    return frame => {
      cells.forEach((row, r) => row.forEach((rect, c) => rect.setAttribute('class', 'algo-cell ' + (frame.mask[r][c] ? 'is-keep' : 'is-cross'))));
      title.textContent = {itc: t('图文对比', 'contrastive'), itm: t('图文匹配', 'matching'), itg: t('看图生成', 'generation')}[frame.objective];
    };
  }});

  FIGURES['step-flow-matching'] = name => stepper(name, F.flow(), {height: 210, readouts: f => [['x_t', f.stage >= 2 ? String(f.done ? f.next : f.position) : '—'], [t('目标速度 u', 'target velocity u'), f.stage >= 3 ? String(f.velocity) : '—'], [t('预测速度 v̂', 'predicted v̂'), f.stage >= 4 ? String(f.predicted) : '—'], [t('平方误差', 'squared error'), f.stage >= 4 ? `(${f.predicted} − ${f.velocity})² = ${f.loss}` : '—', f.stage >= 4 ? 'bad' : ''], [t('走一步之后', 'after one step'), f.done ? `${f.position} → ${f.next}` : '—', f.done ? 'good' : '']], setup(svg) {
    const x0 = 50, unit = 44, y = 160, X = v => x0 + v * unit;
    svg.append(s('line', {x1: X(0), y1: y, x2: X(12), y2: y, class: 'algo-edge'}));
    for (let v = 0; v <= 12; v++) {
      svg.append(s('line', {x1: X(v), y1: y - 4, x2: X(v), y2: y + 4, class: 'algo-edge'}));
      V.text(svg, X(v), y + 20, String(v), 'algo-idx', 'middle');
    }
    const path = s('line', {y1: y, y2: y, class: 'algo-edge is-change algo-dash'});
    svg.append(path);
    const noise = s('circle', {cy: y, r: 8, class: 'algo-cell is-look'});
    const target = s('circle', {cy: y, r: 8, class: 'algo-cell is-keep'});
    svg.append(noise, target);
    const noiseLabel = V.text(svg, 0, y - 16, '', 'algo-strong', 'middle');
    const targetLabel = V.text(svg, 0, y - 16, '', 'algo-strong', 'middle');
    const marker = V.pointer(svg, 'x_t', 'p-blue', {y: y - 10, up: false});
    const arrow = name + '-arrow';
    svg.append(V.markers(arrow));
    const u = s('line', {class: 'algo-edge is-keep', 'marker-end': `url(#${arrow})`});
    const v = s('line', {class: 'algo-edge is-change', 'marker-end': `url(#${arrow})`});
    svg.append(u, v);
    const uLabel = V.text(svg, 0, 0, '', 'algo-note'), vLabel = V.text(svg, 0, 0, '', 'algo-note');
    const vScale = 20;
    return frame => {
      noise.setAttribute('cx', X(frame.noise)); target.setAttribute('cx', X(frame.target));
      noiseLabel.setAttribute('x', X(frame.noise)); noiseLabel.textContent = `ε = ${frame.noise}`;
      targetLabel.setAttribute('x', X(frame.target)); targetLabel.textContent = `z = ${frame.target}`;
      path.setAttribute('x1', X(frame.noise)); path.setAttribute('x2', X(frame.target)); show(path, frame.stage >= 1);
      const at = frame.done ? frame.next : frame.position;
      marker.at(X(at), frame.stage < 2, -28);
      const start = X(frame.position);
      [[u, uLabel, frame.velocity, 56, frame.stage >= 3, `u = ${frame.velocity}`], [v, vLabel, frame.predicted, 84, frame.stage >= 4, `v̂ = ${frame.predicted}`]].forEach(([line, label, value, yy, on, text]) => {
        line.setAttribute('x1', start); line.setAttribute('x2', start + value * vScale); line.setAttribute('y1', yy); line.setAttribute('y2', yy);
        show(line, on && !frame.done);
        label.setAttribute('x', start + value * vScale + 10); label.setAttribute('y', yy + 4); label.textContent = on && !frame.done ? text : '';
      });
    };
  }});

  FIGURES['step-eval-funnel'] = name => stepper(name, F.funnel(), {height: 250, readouts: f => [[t('端到端成功率', 'end-to-end success'), f.done ? '55 / 100 = 0.55' : '—', f.done ? 'good' : ''], [t('最后一行的通过率', 'last row’s pass rate'), f.done ? t('55 / 60，不是端到端', '55 / 60, not end to end') : '—', f.done ? 'bad' : '']], setup(svg) {
    const x0 = 24, unit = 4.4, rowH = 42;
    const rows = F.funnel()[0].stages.map((stage, i) => {
      const y = 14 + i * rowH;
      const label = V.text(svg, x0, y + 12, t(stage[0], stage[1]), 'algo-head');
      const ghost = s('rect', {x: x0, y: y + 18, height: 16, rx: 3, class: 'algo-ghost'});
      const bar = s('rect', {x: x0, y: y + 18, height: 16, rx: 3, class: 'algo-bar'});
      svg.append(ghost, bar);
      const count = V.text(svg, 0, y + 31, '', 'algo-strong');
      const rate = V.text(svg, 616, y + 31, '', 'algo-note', 'end');
      return {label, ghost, bar, count, rate, n: stage[2], prev: i ? F.funnel()[0].stages[i - 1][2] : stage[2]};
    });
    return frame => {
      rows.forEach((row, i) => {
        const on = i < frame.shown;
        row.label.classList.toggle('is-dim', !on);
        row.bar.setAttribute('width', on ? row.n * unit : 0);
        row.ghost.setAttribute('width', on ? row.prev * unit : 0);
        row.bar.setAttribute('class', 'algo-bar' + (frame.current === i || frame.done && i === rows.length - 1 ? ' is-now' : ''));
        row.count.setAttribute('x', x0 + row.n * unit + 8);
        row.count.textContent = on ? String(row.n) : '';
        row.rate.textContent = on && i ? frame.rates[i][LANG] : '';
      });
    };
  }});

  FIGURES['step-bleu'] = name => stepper(name, {modes: [
    {id: 'short', zh: 'the bus leaves', en: 'the bus leaves', frames: F.bleu('the bus leaves')},
    {id: 'wrong', zh: 'the bus leaves at nine', en: 'the bus leaves at nine', frames: F.bleu('the bus leaves at nine')}
  ]}, {height: 236, readouts: f => [['p1', f.stage >= 1 ? `${f.m1}/${f.uni.length}` : '—'], ['p2', f.stage >= 2 ? `${f.m2}/${f.bi.length}` : '—'], ['BP', f.stage >= 3 ? (f.bp === 1 ? '1' : fixed(f.bp, 4)) : '—'], ['BLEU-2', f.stage >= 4 ? `≈ ${fixed(f.score, 4)}` : '—', f.stage >= 4 ? 'key' : '']], setup(svg) {
    const x0 = 100, gap = 8, width = word => word.length * 9 + 18;
    V.text(svg, 20, 42, t('参考', 'reference'), 'algo-head');
    V.text(svg, 20, 94, t('候选', 'candidate'), 'algo-head');
    V.text(svg, 20, 146, 'bigram', 'algo-head');
    const layer = s('g');
    svg.append(layer);
    let drawn = null, refCells = [], candCells = [], biCells = [];
    const chips = (words, y, cls) => {
      let x = x0;
      return words.map(word => { const c = cell(layer, x, y, width(word), 30, word, cls); x += width(word) + gap; return c; });
    };
    return frame => {
      if (drawn !== frame.cand.join(' ')) {
        layer.textContent = '';
        refCells = chips(frame.ref, 22, 'algo-note');
        candCells = chips(frame.cand, 74, 'algo-note');
        biCells = chips(frame.bi.map(g => g.gram), 126, 'algo-note');
        drawn = frame.cand.join(' ');
      }
      refCells.forEach(c => c.set(c.label.textContent, ''));
      candCells.forEach((c, i) => c.set(c.label.textContent, frame.stage >= 1 ? (frame.uni[i].ok ? 'is-keep' : 'is-bad') : ''));
      biCells.forEach((c, i) => c.set(c.label.textContent, frame.stage >= 2 ? (frame.bi[i].ok ? 'is-keep' : 'is-bad') : 'is-hidden'));
    };
  }});

  FIGURES['step-judge-renorm'] = name => stepper(name, F.renorm(), {height: 236, readouts: f => [[t('直接加权', 'raw weighted sum'), f.stage >= 1 ? String(f.raw) : '—', f.stage === 1 ? 'bad' : ''], [t('评分标签总质量', 'rating-label mass'), f.stage >= 2 ? String(f.mass) : '—'], [t('条件均分', 'conditional mean'), f.stage >= 4 ? `${f.raw} / ${f.mass} = ${f.mean}` : '—', f.stage >= 4 ? 'good' : '']], setup(svg) {
    const x0 = 24, full = 520;
    V.text(svg, x0, 30, t('整个词表上的概率', 'probability over the vocabulary'), 'algo-head');
    const kinds = ['3', '4', '5', 'other'];
    const segs = kinds.map(() => { const r = s('rect', {y: 40, height: 34, class: 'algo-cell'}); const v = s('text', {y: 62, 'text-anchor': 'middle', class: 'algo-note'}); const k = s('text', {y: 92, 'text-anchor': 'middle', class: 'algo-idx'}); svg.append(r, v, k); return {r, v, k}; });
    const head2 = V.text(svg, x0, 124, t('只看 1–5 分，再除以 0.8', 'labels 1–5 only, divided by 0.8'), 'algo-head');
    const segs2 = [0, 1, 2].map(() => { const r = s('rect', {y: 134, height: 34, class: 'algo-cell is-keep'}); const v = s('text', {y: 156, 'text-anchor': 'middle', class: 'algo-note'}); const k = s('text', {y: 186, 'text-anchor': 'middle', class: 'algo-idx'}); svg.append(r, v, k); return {r, v, k}; });
    return frame => {
      const values = [...frame.labels.map(([, p]) => p), frame.other];
      let x = x0;
      segs.forEach((seg, i) => {
        const w = values[i] * full, isOther = i === 3;
        seg.r.setAttribute('x', x); seg.r.setAttribute('width', w - 2);
        seg.r.setAttribute('class', 'algo-cell ' + (isOther ? (frame.stage >= 2 ? 'is-cross is-out' : 'is-cross') : frame.stage >= 1 ? 'is-look' : ''));
        seg.v.setAttribute('x', x + w / 2); seg.v.textContent = fixed(values[i], 2);
        seg.k.setAttribute('x', x + w / 2); seg.k.textContent = isOther ? t('其他 token', 'other tokens') : t(`${kinds[i]} 分`, `rating ${kinds[i]}`);
        x += w;
      });
      head2.classList.toggle('is-dim', frame.stage < 3);
      let x2 = x0;
      segs2.forEach((seg, i) => {
        const p = frame.scaled[i][1], w = frame.stage >= 3 ? p * full : 0;
        seg.r.setAttribute('x', x2); seg.r.setAttribute('width', Math.max(0, w - 2));
        seg.v.setAttribute('x', x2 + w / 2); seg.v.textContent = frame.stage >= 3 ? String(p) : '';
        seg.k.setAttribute('x', x2 + w / 2); seg.k.textContent = frame.stage >= 3 ? t(`${frame.scaled[i][0]} 分`, `rating ${frame.scaled[i][0]}`) : '';
        x2 += w;
      });
    };
  }});

  FIGURES['step-win-rate'] = name => stepper(name, F.winRate(), {height: 200, readouts: f => { const out = f.out || []; return [[t('弃权', 'abstained'), out.includes('unknown') ? '1' : '—'], [t('双方失败', 'both bad'), out.includes('bad') ? '1' : '—'], [t('分母', 'denominator'), f.stage >= 3 ? '8 + 6 + 4 = 18' : '—'], [t('A 的分子', 'A’s numerator'), f.half ? '8 + 0.5 × 4 = 10' : '—'], ['W_A', f.done ? '10 / 18 ≈ 55.6%' : '—', f.done ? 'good' : '']]; }, setup(svg) {
    const size = 26, gap = 4, x0 = 20, y0 = 30;
    const glyph = {a: 'A', b: 'B', tie: '=', bad: '✗', unknown: '?'};
    const tiles = F.winRate()[0].tiles.map((kind, i) => ({kind, ...cell(svg, x0 + i * (size + gap), y0, size, size, glyph[kind], 'algo-note')}));
    const legend = V.text(svg, 616, 96, t('A 胜 · B 胜 · = 平 · ✗ 都不行 · ? 不确定', 'A wins · B wins · = tie · ✗ both bad · ? unknown'), 'algo-idx', 'end');
    return frame => {
      const out = frame.out || [];
      tiles.forEach(tile => {
        const gone = out.includes(tile.kind);
        const cls = gone ? 'is-out' : tile.kind === 'a' ? 'is-look' : tile.kind === 'b' ? 'is-change' : tile.kind === 'tie' ? (frame.half ? 'is-keep' : '') : tile.kind === 'bad' ? 'is-bad' : 'algo-ghost';
        tile.set(glyph[tile.kind], cls);
      });
    };
  }});

  FIGURES['step-weighted-slices'] = name => stepper(name, F.slices(), {height: 236, readouts: f => [[t('加权平均', 'weighted average'), f.stage >= 1 ? `${f.before} → ${f.after}` : String(f.before), f.stage >= 1 ? 'good' : ''], [t('充分组的贡献', 'rich group moves it'), f.stage >= 2 ? `+${f.parts[0].toFixed(3)}` : '—'], [t('稀疏组的贡献', 'sparse group moves it'), f.stage >= 2 ? `−${Math.abs(f.parts[1]).toFixed(3)}` : '—', f.stage >= 2 ? 'bad' : '']], setup(svg) {
    const base = 206, unit = 240, x0 = 40, total = 380;
    svg.append(s('line', {x1: x0 - 6, y1: base, x2: x0 + total + 6, y2: base, class: 'algo-edge'}));
    let x = x0;
    const cols = F.slices()[0].groups.map(group => {
      const w = group[2] * total, col = {x, w};
      col.old = s('rect', {x: x + 3, width: w - 6, class: 'algo-ghost'});
      col.now = s('rect', {x: x + 3, width: w - 6, rx: 3, class: 'algo-cell is-look'});
      svg.append(col.now, col.old);
      col.label = V.text(svg, x + w / 2, base + 18, `${t(group[0], group[1])} · ${Math.round(group[2] * 100)}%`, 'algo-head', 'middle');
      col.value = V.text(svg, x + w + 8, 0, '', 'algo-strong');
      col.part = V.text(svg, x + w / 2, base - 14, '', 'algo-strong', 'middle');
      x += w;
      return col;
    });
    const avg = s('line', {x1: x0, x2: x0 + total, class: 'algo-edge algo-dash'});
    svg.append(avg);
    return frame => {
      cols.forEach((col, i) => {
        const g = frame.groups[i], before = g[3], after = g[4];
        const show = frame.stage >= 1 ? after : before;
        col.now.setAttribute('y', base - show * unit); col.now.setAttribute('height', show * unit);
        col.now.setAttribute('class', 'algo-cell ' + (frame.stage >= 1 ? (after < before ? 'is-bad' : 'is-keep') : 'is-look'));
        col.old.setAttribute('y', base - before * unit); col.old.setAttribute('height', before * unit);
        col.old.classList.toggle('is-hidden', frame.stage < 1);
        col.value.setAttribute('y', base - show * unit + 14);
        col.value.textContent = frame.stage >= 1 ? `${before.toFixed(2)} → ${after.toFixed(2)}` : before.toFixed(2);
        col.part.textContent = frame.stage >= 2 ? (frame.parts[i] > 0 ? '+' : '−') + Math.abs(frame.parts[i]).toFixed(3) : '';
      });
      const value = frame.stage >= 1 && frame.stage !== 2 ? frame.after : frame.stage === 2 ? frame.after : frame.before;
      avg.setAttribute('y1', base - value * unit); avg.setAttribute('y2', base - value * unit);
    };
  }});

  FIGURES['step-context-staircase'] = name => stepper(name, F.staircase(), {height: 236, readouts: f => [[t('累计输入', 'total input'), String(f.running), f.split ? 'key' : ''], [t('拆开看', 'split'), f.split ? `${f.k} × ${f.b} + ${f.a} × ${f.k}(${f.k} − 1)/2 = ${f.k * f.b} + ${f.a * f.k * (f.k - 1) / 2}` : '—']], setup(svg) {
    const base = 206, unit = 0.088, w = 70, xs = [60, 170, 280, 390];
    svg.append(s('line', {x1: 40, y1: base, x2: 480, y2: base, class: 'algo-edge'}));
    const bars = xs.map((x, i) => {
      const fixedPart = s('rect', {x, width: w, rx: 3, class: 'algo-bar'});
      const history = s('rect', {x, width: w, rx: 3, class: 'algo-bar is-tall'});
      svg.append(fixedPart, history);
      const value = V.text(svg, x + w / 2, 0, '', 'algo-strong', 'middle');
      V.text(svg, x + w / 2, base + 18, t(`第 ${i + 1} 次`, `call ${i + 1}`), 'algo-head', 'middle');
      return {fixedPart, history, value};
    });
    return frame => {
      bars.forEach((bar, i) => {
        const on = i < frame.shown, v = frame.inputs[i], hist = v - frame.b;
        bar.fixedPart.setAttribute('y', base - frame.b * unit); bar.fixedPart.setAttribute('height', on ? frame.b * unit : 0);
        bar.history.setAttribute('y', base - v * unit); bar.history.setAttribute('height', on ? hist * unit : 0);
        bar.fixedPart.setAttribute('class', 'algo-bar' + (on && (i === frame.shown - 1 || frame.split) ? ' is-now' : ''));
        bar.history.setAttribute('class', 'algo-bar is-tall' + (on && (i === frame.shown - 1 || frame.split) ? ' is-now' : ''));
        bar.value.setAttribute('y', base - v * unit - 8); bar.value.textContent = on ? String(v) : '';
      });
    };
  }});

  FIGURES['step-skill-loading'] = name => stepper(name, F.skills(), {height: 220, setup(svg) {
    const x0 = 24, scale = 500 / 23280;
    const cls = {catalog: 'algo-bar', procedure: 'algo-bar is-tall', reference: 'algo-cell is-keep'};
    const row = (y, label) => {
      V.text(svg, x0, y - 8, label, 'algo-head');
      const segs = ['catalog', 'procedure', 'reference'].map(kind => { const r = s('rect', {y, height: 24, rx: 3, class: cls[kind]}); svg.append(r); return r; });
      const total = V.text(svg, 0, y + 17, '', 'algo-strong');
      return {segs, total};
    };
    const lazy = row(44, t('按需加载', 'on demand')), eager = row(112, t('一开始全部读入', 'everything up front'));
    const legend = [['catalog', t('简介', 'descriptions')], ['procedure', t('完整步骤', 'procedures')], ['reference', t('参考段落', 'reference')]];
    legend.forEach(([kind, text], i) => {
      svg.append(s('rect', {x: x0 + i * 150, y: 168, width: 14, height: 14, rx: 3, class: cls[kind]}));
      V.text(svg, x0 + i * 150 + 20, 180, text, 'algo-note');
    });
    const draw = (bar, parts, shown) => {
      let x = x0;
      parts.forEach(([, n], i) => {
        const w = i < shown ? Math.max(2, n * scale) : 0;
        bar.segs[i].setAttribute('x', x); bar.segs[i].setAttribute('width', w);
        x += w;
      });
      const sum = parts.slice(0, shown).reduce((a, [, n]) => a + n, 0);
      bar.total.setAttribute('x', x + 8); bar.total.textContent = shown ? sum.toLocaleString('en-US') : '';
    };
    return frame => {
      draw(lazy, frame.lazy, frame.lazyShown);
      draw(eager, frame.eager, frame.eagerShown ? 3 : 0);
    };
  }});

  FIGURES['step-agent-patterns'] = name => stepper(name, F.agentPatterns(), {height: 268, setup(svg) {
    const arrow = name + '-arrow';
    svg.append(V.markers(arrow));
    const box = (x, y, w, label, dashed) => {
      w = Math.max(w, label.length * 7.4 + 14);
      svg.append(s('rect', {x, y, width: w, height: 26, rx: 6, class: dashed ? 'algo-cell algo-ghost' : 'algo-cell'}));
      V.text(svg, x + w / 2, y + 17, label, 'algo-note', 'middle');
      return {l: x, r: x + w, cy: y + 13, cx: x + w / 2, t: y, b: y + 26};
    };
    const link = (x1, y1, x2, y2, curve) => svg.append(s('path', {d: curve ? `M${x1} ${y1} Q${(x1 + x2) / 2} ${curve} ${x2} ${y2}` : `M${x1} ${y1} L${x2} ${y2}`, class: 'algo-edge', 'marker-end': `url(#${arrow})`}));
    const panel = (col, row, title) => {
      const x = 8 + col * 210, y = 8 + row * 130;
      svg.append(s('rect', {x, y, width: 200, height: 122, rx: 10, class: 'algo-ghost'}));
      V.text(svg, x + 12, y + 20, title, 'algo-strong');
      return {x, y};
    };
    let p = panel(0, 0, 'Prompt chaining');
    let a = box(p.x + 10, p.y + 56, 52, 'LLM'), b = box(p.x + 74, p.y + 56, 52, t('检查', 'check')), c = box(p.x + 138, p.y + 56, 52, 'LLM');
    link(a.r, a.cy, b.l - 2, b.cy); link(b.r, b.cy, c.l - 2, c.cy);
    p = panel(1, 0, 'Routing');
    a = box(p.x + 10, p.y + 60, 56, t('分类', 'route'));
    [0, 1, 2].forEach(i => { const d = box(p.x + 118, p.y + 32 + i * 30, 72, t(`路径 ${i + 1}`, `path ${i + 1}`)); link(a.r, a.cy, d.l - 2, d.cy); });
    p = panel(2, 0, 'Parallelization');
    a = box(p.x + 8, p.y + 60, 44, t('拆分', 'split'));
    const out = box(p.x + 136, p.y + 60, 56, t('汇总', 'merge'));
    [0, 1, 2].forEach(i => { const d = box(p.x + 70, p.y + 32 + i * 30, 46, 'LLM'); link(a.r, a.cy, d.l - 2, d.cy); link(d.r, d.cy, out.l - 2, out.cy); });
    p = panel(0, 1, 'Orchestrator-workers');
    a = box(p.x + 8, p.y + 60, 52, t('编排', 'plan'));
    const merge = box(p.x + 140, p.y + 60, 52, t('汇总', 'merge'));
    [0, 1, 2].forEach(i => { const d = box(p.x + 74, p.y + 32 + i * 30, 52, 'worker', true); link(a.r, a.cy, d.l - 2, d.cy); link(d.r, d.cy, merge.l - 2, merge.cy); });
    p = panel(1, 1, 'Evaluator-optimizer');
    a = box(p.x + 8, p.y + 60, 64, t('生成', 'generate')); b = box(p.x + 118, p.y + 60, 64, t('评价', 'evaluate'));
    link(a.r, a.cy - 4, b.l - 2, b.cy - 4, p.y + 44); link(b.l, b.cy + 6, a.r + 2, a.cy + 6, p.y + 104);
    V.text(svg, p.x + 100, p.y + 44, t('草稿', 'draft'), 'algo-idx', 'middle');
    V.text(svg, p.x + 100, p.y + 114, t('反馈', 'feedback'), 'algo-idx', 'middle');
    p = panel(2, 1, 'Agent');
    a = box(p.x + 10, p.y + 52, 48, 'LLM'); b = box(p.x + 92, p.y + 52, 64, t('环境', 'environment'));
    link(a.r, a.cy - 4, b.l - 2, b.cy - 4, p.y + 36); link(b.l, b.cy + 6, a.r + 2, a.cy + 6, p.y + 96);
    V.text(svg, (a.r + b.l) / 2, p.y + 38, t('行动', 'act'), 'algo-idx', 'middle');
    V.text(svg, (a.r + b.l) / 2 + 14, p.y + 104, t('反馈', 'feedback'), 'algo-idx', 'middle');
    link(a.cx, a.b, a.cx, p.y + 112);
    V.text(svg, a.cx - 6, p.y + 112, t('停', 'stop'), 'algo-idx', 'end');
    return () => {};
  }});

  FIGURES['step-audio-frames'] = name => stepper(name, F.audioFrames(), {height: 236, readouts: f => [[t('窗口', 'window'), `${f.windowSize} ${t('个样本', 'samples')} · 25 ms`], [t('步长', 'hop'), `${f.hop} ${t('个样本', 'samples')} · 10 ms`], [t('帧数', 'frames'), f.done ? String(f.count) : '—', f.done ? 'good' : '']], setup(svg) {
    const x0 = 30, x1 = 610, samples = 32000, span = 960, zoom = (x1 - x0) / span;
    V.text(svg, x0, 22, t('整段：2 秒', 'whole clip: 2 s'), 'algo-head');
    svg.append(s('rect', {x: x0, y: 30, width: x1 - x0, height: 14, rx: 3, class: 'algo-cell'}));
    const region = s('rect', {y: 28, height: 18, class: 'algo-band'});
    const linkL = s('line', {y1: 46, y2: 74, class: 'algo-edge algo-dash'}), linkR = s('line', {y1: 46, y2: 74, class: 'algo-edge algo-dash'});
    svg.append(region, linkL, linkR);
    V.text(svg, x1, 22, '32,000', 'algo-idx', 'end');
    svg.append(s('line', {x1: x0, y1: 200, x2: x1, y2: 200, class: 'algo-edge'}));
    const ticks = [0, 1, 2, 3, 4, 5, 6].map(i => {
      const x = x0 + i * 160 * zoom;
      svg.append(s('line', {x1: x, y1: 196, x2: x, y2: 204, class: 'algo-edge'}));
      return V.text(svg, x, 220, '', 'algo-idx', 'middle');
    });
    const wins = [0, 1, 2, 3].map(() => {
      const rect = s('rect', {height: 24, rx: 5, class: 'algo-cell is-look'});
      const label = s('text', {'text-anchor': 'middle', class: 'algo-note'});
      svg.append(rect, label);
      return {rect, label};
    });
    const tail = s('rect', {y: 78, height: 112, class: 'algo-cell is-cross'});
    svg.append(tail);
    const tailLabel = V.text(svg, 0, 70, '', 'algo-note', 'middle');
    return frame => {
      const offset = frame.view === 'tail' ? samples - span : 0;
      const rx = x0 + offset / samples * (x1 - x0), rw = Math.max(4, span / samples * (x1 - x0));
      region.setAttribute('x', rx); region.setAttribute('width', rw);
      linkL.setAttribute('x1', rx); linkL.setAttribute('x2', x0); linkR.setAttribute('x1', rx + rw); linkR.setAttribute('x2', x1);
      ticks.forEach((tick, i) => { tick.textContent = (offset + i * 160).toLocaleString('en-US'); });
      wins.forEach((win, i) => {
        const k = frame.windows[i];
        const on = k != null;
        const start = on ? k * frame.hop : 0, x = x0 + (start - offset) * zoom, y = 78 + i * 28;
        win.rect.setAttribute('x', x); win.rect.setAttribute('y', y); win.rect.setAttribute('width', frame.windowSize * zoom);
        win.rect.setAttribute('class', 'algo-cell ' + (on ? (i === frame.windows.length - 1 && !frame.done ? 'is-change' : 'is-look') : 'is-hidden'));
        win.label.setAttribute('x', x + frame.windowSize * zoom / 2); win.label.setAttribute('y', y + 17);
        win.label.textContent = on ? `${t('帧', 'frame')} ${k + 1}: ${start.toLocaleString('en-US')}–${(start + frame.windowSize).toLocaleString('en-US')}` : '';
      });
      const showTail = frame.view === 'tail';
      const tx = x0 + (frame.samples - frame.tail - offset) * zoom;
      tail.setAttribute('x', tx); tail.setAttribute('width', frame.tail * zoom);
      tail.classList.toggle('is-hidden', !showTail);
      tailLabel.setAttribute('x', tx + frame.tail * zoom / 2);
      tailLabel.textContent = showTail ? t(`剩 ${frame.tail}`, `${frame.tail} left`) : '';
    };
  }});

  FIGURES['step-vl2-layout'] = name => stepper(name, F.vl2Layout(), {height: 268, readouts: f => [[t('全局视图', 'global view'), f.stage >= 1 ? '196 + 14 = 210' : '14 × 14 = 196'], [t('分隔符', 'separator'), f.stage >= 2 ? '1' : '—'], [t('局部块', 'local tiles'), f.stage >= 3 ? `28 × 43 = ${f.local}` : '—'], [t('合计', 'total'), f.done ? String(f.total) : '—', f.done ? 'good' : ''], [t('只算 7 × 196', 'counting 7 × 196'), f.done ? String(f.naive) : '—', f.done ? 'bad' : '']], setup(svg) {
    const unit = 6, y0 = 40;
    const block = (x, rows, cols, tile) => {
      const g = s('g');
      g.append(s('rect', {x, y: y0, width: cols * unit, height: rows * unit, class: 'algo-cell'}));
      const fine = s('g', {class: 'algo-grid-fine'}), coarse = s('g', {class: 'algo-grid-coarse'});
      for (let c = 1; c < cols; c++) (c % tile ? fine : coarse).append(s('line', {x1: x + c * unit, y1: y0, x2: x + c * unit, y2: y0 + rows * unit}));
      for (let r = 1; r < rows; r++) (r % tile ? fine : coarse).append(s('line', {x1: x, y1: y0 + r * unit, x2: x + cols * unit, y2: y0 + r * unit}));
      const markers = s('g');
      for (let r = 0; r < rows; r++) markers.append(s('rect', {x: x + cols * unit + 1, y: y0 + r * unit + 0.5, width: unit - 1, height: unit - 1, class: 'algo-cell is-change'}));
      g.append(fine, coarse, markers);
      svg.append(g);
      return {g, markers};
    };
    const global = block(30, 14, 14, 14), local = block(178, 28, 42, 14);
    const sep = s('rect', {x: 150, y: y0, width: unit + 2, height: 14 * unit, rx: 2, class: 'algo-cell is-change'});
    svg.append(sep);
    const gLabel = V.text(svg, 30, y0 + 14 * unit + 18, '', 'algo-note');
    const sLabel = V.text(svg, 154, y0 + 14 * unit + 18, '', 'algo-note', 'middle');
    const lLabel = V.text(svg, 178, y0 + 28 * unit + 18, '', 'algo-note');
    V.text(svg, 30, 26, t('全局视图', 'global view'), 'algo-head');
    const localHead = V.text(svg, 178, 26, '', 'algo-head');
    return frame => {
      show(global.g, true); show(global.markers, frame.stage >= 1);
      show(sep, frame.stage >= 2); show(local.g, frame.stage >= 3);
      gLabel.textContent = frame.stage === 0 ? '14 × 14 = 196' : '196 + 14 = 210';
      sLabel.textContent = frame.stage >= 2 ? '+1' : '';
      lLabel.textContent = frame.stage >= 3 ? `28 × 43 = ${frame.local}` : '';
      localHead.textContent = frame.stage >= 3 ? t(`局部块 ${frame.rows} × ${frame.cols}`, `local tiles ${frame.rows} × ${frame.cols}`) : '';
    };
  }});

  FIGURES['step-mrope'] = name => stepper(name, F.mrope(), {height: 220, setup(svg) {
    const x0 = 220, w = 122, ht = 52, gap = 10, y0 = 40;
    const tspans = (x, y, values) => {
      const node = s('text', {x, y, 'text-anchor': 'middle', class: 'algo-val'});
      const parts = ['(', values[0], ', ', values[1], ', ', values[2], ')'].map((v, i) => s('tspan', {class: ['', 'mr-t', '', 'mr-h', '', 'mr-w', ''][i], text: String(v)}));
      node.append(...parts);
      svg.append(node);
      return {node, t: parts[1], h: parts[3], w: parts[5]};
    };
    svg.append(s('rect', {x: 24, y: y0 + 30, width: 150, height: ht, rx: 7, class: 'algo-cell'}));
    V.text(svg, 99, y0 + 22, t('文本 token', 'text token'), 'algo-head', 'middle');
    const text = tspans(99, y0 + 61, ['n', 'n', 'n']);
    const cells = F.mrope()[0].cells.map(cell => {
      const x = x0 + cell.c * (w + gap), y = y0 + cell.r * (ht + gap);
      const rect = s('rect', {x, y, width: w, height: ht, rx: 7, class: 'algo-cell'});
      svg.append(rect);
      return {cell, rect, label: tspans(x + w / 2, y + 31, [cell.t, cell.h, cell.w])};
    });
    [['mr-t', t('时间 t', 'time t')], ['mr-h', t('高度 h', 'height h')], ['mr-w', t('宽度 w', 'width w')]].forEach(([cls, label], i) => {
      V.text(svg, x0 + i * 120, 200, '■ ' + label, 'algo-note ' + cls);
    });
    return frame => {
      const dim = (part, axis) => part.classList.toggle('mr-dim', Boolean(frame.focus) && frame.focus !== axis);
      cells.forEach(({cell, rect, label}) => {
        rect.setAttribute('class', 'algo-cell' + (!cell.given ? ' is-out' : ''));
        ['t', 'h', 'w'].forEach(axis => dim(label[axis], axis));
        label.node.classList.toggle('is-dim', !cell.given && !frame.done);
      });
      ['t', 'h', 'w'].forEach(axis => dim(text[axis], axis));
    };
  }});

  FIGURES['step-ppl-windows'] = name => stepper(name, F.pplWindows(), {height: 216, readouts: f => [[t('窗口 1 计分', 'window 1 scores'), f.stage >= 1 ? '3' : '—'], [t('窗口 2 计分', 'window 2 scores'), f.stage >= 2 ? '2' : '—'], [t('合计目标', 'targets in total'), f.done ? '3 + 2 = 5' : '—', f.done ? 'good' : '']], setup(svg) {
    const size = 56, gap = 10, x0 = (640 - (6 * size + 5 * gap)) / 2, y = 82;
    const xs = i => x0 + i * (size + gap);
    const cells = F.pplWindows()[0].tokens.map((tok, i) => cell(svg, xs(i), y, size, size, tok));
    const marks = cells.map((_, i) => V.text(svg, xs(i) + size / 2, y + size + 18, '', 'algo-idx', 'middle'));
    const bracket = (from, to, yy, up, label) => {
      const x1 = xs(from), x2 = xs(to) + size, d = up ? 8 : -8;
      const path = s('path', {d: `M${x1} ${yy + d} L${x1} ${yy} L${x2} ${yy} L${x2} ${yy + d}`, class: 'algo-edge'});
      const text = V.text(svg, (x1 + x2) / 2, up ? yy - 8 : yy + 18, label, 'algo-head', 'middle');
      svg.append(path);
      return {path, text};
    };
    const b1 = bracket(0, 3, 68, true, t('窗口 1', 'window 1')), b2 = bracket(2, 5, 168, false, t('窗口 2', 'window 2'));
    return frame => {
      const active = frame.active != null ? frame.windows[frame.active] : null;
      cells.forEach((c, i) => {
        let state = '';
        if (active) state = active.scored.includes(i) ? 'is-keep' : active.context.includes(i) ? 'is-look' : 'is-out';
        else if (frame.done) state = i === 0 ? 'is-out' : 'is-keep';
        else if (frame.stage === 0 && i === 0) state = 'is-out';
        c.set(frame.tokens[i], state);
        marks[i].textContent = active ? (active.scored.includes(i) ? t('计分', 'scored') : active.context.includes(i) ? t('上下文', 'context') : '') : frame.done && i > 0 ? t('计分', 'scored') : '';
      });
      [b1, b2].forEach((b, k) => {
        const on = frame.active === k || frame.done;
        b.path.setAttribute('class', 'algo-edge' + (frame.active === k ? ' is-keep' : '') + (on ? '' : ' is-out'));
        b.text.classList.toggle('is-dim', !on);
      });
    };
  }});

  FIGURES['step-ivf'] = name => stepper(name, F.ivf(), {height: 262, readouts: f => [['nprobe', f.probe ? String(f.probe) : '—'], [t('扫描的簇', 'clusters scanned'), f.probe ? f.order.slice(0, f.probe).join(', ') : '—'], [t('找到的最近点', 'nearest found'), f.stage >= 3 ? t('在 B，全库最近', 'in B, the true nearest') : f.stage >= 2 ? t('在 A，不是全库最近', 'in A, not the true nearest') : '—', f.stage >= 3 ? 'good' : f.stage >= 2 ? 'bad' : '']], setup(svg) {
    const base = F.ivf()[0];
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const regions = {}, dots = {}, cross = {};
    Object.entries(base.groups).forEach(([k, pts]) => {
      const c = base.centroids[k], r = Math.max(...pts.map(p => dist(p, c))) + 14;
      regions[k] = s('circle', {cx: c[0], cy: c[1], r, class: 'algo-ghost'});
      svg.append(regions[k]);
    });
    const lines = Object.keys(base.groups).map(k => { const line = s('line', {x1: base.query[0], y1: base.query[1], x2: base.centroids[k][0], y2: base.centroids[k][1], class: 'algo-edge algo-dash'}); svg.append(line); return [k, line]; });
    const found = [0, 1].map(() => { const line = s('line', {x1: base.query[0], y1: base.query[1], class: 'algo-edge'}); svg.append(line); return line; });
    Object.entries(base.groups).forEach(([k, pts]) => {
      dots[k] = pts.map(p => { const dot = s('circle', {cx: p[0], cy: p[1], r: 5, class: 'algo-cell'}); svg.append(dot); return {p, dot}; });
      const [cx, cy] = base.centroids[k];
      cross[k] = s('path', {d: `M${cx - 6} ${cy - 6} L${cx + 6} ${cy + 6} M${cx + 6} ${cy - 6} L${cx - 6} ${cy + 6}`, class: 'algo-edge'});
      svg.append(cross[k]);
      V.text(svg, cx, cy - Math.max(...base.groups[k].map(p => dist(p, base.centroids[k]))) - 22, t(`簇 ${k}`, `cluster ${k}`), 'algo-head', 'middle');
    });
    const q = s('circle', {cx: base.query[0], cy: base.query[1], r: 7, class: 'algo-cell is-look'});
    svg.append(q);
    V.text(svg, base.query[0], base.query[1] + 24, 'q', 'algo-strong', 'middle');
    return frame => {
      const scanned = frame.probe ? frame.order.slice(0, frame.probe) : [];
      lines.forEach(([k, line]) => line.setAttribute('class', 'algo-edge algo-dash' + (frame.stage === 1 ? (k === frame.order[0] ? ' is-look-line' : '') : ' is-hidden')));
      Object.entries(dots).forEach(([k, list]) => list.forEach(({p, dot}) => {
        const isOne = p === frame.one.p && frame.stage >= 2, isTwo = p === frame.two.p && frame.stage >= 3;
        dot.setAttribute('class', 'algo-cell ' + (isTwo ? 'is-keep' : isOne ? 'is-change' : scanned.includes(k) ? 'is-look' : frame.probe ? 'is-out' : ''));
      }));
      Object.entries(regions).forEach(([k, region]) => region.setAttribute('class', 'algo-ghost' + (frame.probe && !scanned.includes(k) ? ' is-out' : '')));
      [[found[0], frame.one, frame.stage >= 2, frame.stage >= 3], [found[1], frame.two, frame.stage >= 3, false]].forEach(([line, hit, on, faded]) => {
        line.setAttribute('x2', hit.p[0]); line.setAttribute('y2', hit.p[1]);
        line.setAttribute('class', 'algo-edge ' + (line === found[1] ? 'is-keep' : 'is-change') + (on ? '' : ' is-hidden') + (faded ? ' is-out' : ''));
      });
    };
  }});

  FIGURES['step-best-of-n'] = name => stepper(name, F.bestOfN(), {height: 250, readouts: f => [['P(A)', f.stage >= 2 ? '0.5² = 0.25' : '—'], ['P(C)', f.stage >= 3 ? '1 − 0.8² = 0.36' : '—', f.stage >= 3 ? 'key' : ''], ['P(B)', f.stage >= 4 ? '0.15 + 0.15 + 0.09 = 0.39' : '—'], [t('C 被选中', 'C picked'), f.done ? '0.2 → 0.36' : '—', f.done ? 'bad' : '']], setup(svg) {
    const base = F.bestOfN()[0], size = 230, x0 = 54, y0 = 40;
    const tone = {A: 'is-look', B: 'is-keep', C: 'is-bad'};
    const offsets = base.p.reduce((acc, p) => [...acc, acc[acc.length - 1] + p], [0]);
    const grid = s('g');
    svg.append(grid);
    V.text(grid, x0 + size / 2, y0 - 22, t('第一份', 'first draw'), 'algo-head', 'middle');
    V.text(grid, x0 - 30, y0 + size / 2, t('第二份', 'second'), 'algo-head', 'middle');
    base.names.forEach((n, i) => {
      V.text(grid, x0 + (offsets[i] + base.p[i] / 2) * size, y0 - 6, n, 'algo-idx', 'middle');
      V.text(grid, x0 - 10, y0 + (offsets[i] + base.p[i] / 2) * size + 4, n, 'algo-idx', 'end');
    });
    const cells = base.cells.map(c => ({...c, ...cell(grid, x0 + offsets[c.col] * size + 1, y0 + offsets[c.row] * size + 1, base.p[c.col] * size - 2, base.p[c.row] * size - 2, '', 'algo-small')}));
    const noC = s('rect', {x: x0, y: y0, width: 0.8 * size, height: 0.8 * size, rx: 4, class: 'algo-edge algo-dash', fill: 'none'});
    svg.append(noC);
    const bx = 330, bw = 290;
    const bars = [[t('只生成 1 份', 'one draw'), 70], ['best-of-2', 160]].map(([label, y]) => {
      const head = V.text(svg, bx, y - 10, label, 'algo-head');
      const segs = base.names.map(() => cell(svg, 0, y, 10, 34, '', 'algo-note'));
      return {head, segs, y};
    });
    const place = (bar, values, on) => {
      let x = bx;
      bar.segs.forEach((seg, i) => {
        const w = values[i] * bw;
        seg.rect.setAttribute('x', x); seg.rect.setAttribute('width', Math.max(0, w - 3));
        seg.label.setAttribute('x', x + w / 2);
        seg.set(on ? `${base.names[i]} ${values[i]}` : '', on ? tone[base.names[i]] : 'is-hidden');
        x += w;
      });
      bar.head.classList.toggle('is-hidden', !on);
    };
    return frame => {
      show(grid, frame.stage >= 1);
      const colored = {A: frame.stage >= 2, C: frame.stage >= 3, B: frame.stage >= 4};
      cells.forEach(c => c.set(frame.stage >= 1 ? String(c.area) : '', frame.stage < 1 ? 'is-hidden' : colored[c.winner] ? tone[c.winner] + (frame.focus === c.winner ? ' is-now' : '') : ''));
      show(noC, frame.stage === 3);
      place(bars[0], base.p, true);
      place(bars[1], base.names.map(n => frame.picked[n]), Boolean(frame.done));
    };
  }});

  FIGURES['step-bt-scale'] = name => stepper(name, F.btScale(), {height: 236, readouts: f => [['r_A / r_B', `${f.a} / ${f.b}`], [t('分差', 'gap'), String(f.gap), f.stage === 2 ? 'key' : ''], ['P(A ≻ B)', String(f.prob), f.done ? 'key' : '']], setup(svg) {
    const lx = 30, lw = 270, ly = 120, at = v => lx + v / 13 * lw;
    svg.append(s('line', {x1: lx, y1: ly, x2: lx + lw, y2: ly, class: 'algo-edge'}));
    [0, 5, 10].forEach(v => V.text(svg, at(v), ly + 20, String(v), 'algo-idx', 'middle'));
    V.text(svg, lx, 40, t('奖励分数', 'reward scores'), 'algo-head');
    const dot = label => { const c = s('circle', {r: 9, cy: ly, class: 'algo-cell is-look'}); const tx = V.text(svg, 0, ly - 16, label, 'algo-strong', 'middle'); svg.append(c); return {c, tx}; };
    const A = dot('A'), B = dot('B');
    const bracket = s('line', {y1: ly + 34, y2: ly + 34, class: 'algo-edge is-keep'});
    svg.append(bracket);
    const gapText = V.text(svg, 0, ly + 52, '', 'algo-note', 'middle');
    const cx = 350, cw = 260, cy = 40, ch = 150, gx = g => cx + (g + 3) / 6 * cw, py = p => cy + ch - p * ch;
    V.text(svg, cx, 30, t('σ(分差) = A 胜出的概率', 'σ(gap) = P(A preferred)'), 'algo-head');
    svg.append(s('line', {x1: cx, y1: cy + ch, x2: cx + cw, y2: cy + ch, class: 'algo-edge'}));
    [-2, 0, 1, 2].forEach(g => V.text(svg, gx(g), cy + ch + 18, String(g), 'algo-idx', 'middle'));
    const pts = Array.from({length: 61}, (_, i) => -3 + i * 0.1).map(g => `${gx(g).toFixed(1)},${py(1 / (1 + Math.exp(-g))).toFixed(1)}`);
    svg.append(s('polyline', {points: pts.join(' '), class: 'algo-edge', fill: 'none'}));
    const ghost = s('circle', {r: 6, class: 'algo-ghost'});
    const point = s('circle', {r: 7, class: 'algo-cell is-bad'});
    svg.append(ghost, point);
    const pText = V.text(svg, 0, 0, '', 'algo-strong');
    return frame => {
      [[A, frame.a], [B, frame.b]].forEach(([d, v]) => { d.c.setAttribute('cx', at(v)); d.tx.setAttribute('x', at(v)); });
      bracket.setAttribute('x1', at(frame.b)); bracket.setAttribute('x2', at(frame.a));
      gapText.setAttribute('x', (at(frame.a) + at(frame.b)) / 2); gapText.textContent = t(`分差 ${frame.gap}`, `gap ${frame.gap}`);
      point.setAttribute('cx', gx(frame.gap)); point.setAttribute('cy', py(frame.prob));
      pText.setAttribute('x', gx(frame.gap) - 70); pText.setAttribute('y', py(frame.prob) - 10); pText.textContent = `σ(${frame.gap}) ≈ ${frame.prob}`;
      ghost.setAttribute('cx', gx(1)); ghost.setAttribute('cy', py(0.731)); show(ghost, Boolean(frame.ghost));
    };
  }});

  FIGURES['step-token-mean'] = name => stepper(name, F.tokenMean(), {height: 236, readouts: f => [[t('按回答平均', 'response mean'), f.stage >= 1 ? `(1 + 3)/2 = ${f.responseMean}` : '—'], [t('按 token 平均', 'token mean'), f.stage >= 2 ? `20/8 = ${f.tokenMean}` : '—', f.stage >= 2 ? 'key' : ''], [t('两卡均值再平均', 'mean of rank means'), f.stage >= 3 ? `(1 + 3)/2 = ${f.responseMean}` : '—', f.stage >= 3 ? 'bad' : ''], [t('局部和 × W/N', 'local sum × W/N'), f.done ? `(${f.scaled[0]} + ${f.scaled[1]})/2 = ${f.ddp}` : '—', f.done ? 'good' : '']], setup(svg) {
    const base = F.tokenMean()[0], size = 44, gap = 6, x0 = 110, ys = [40, 130];
    const labels = [t('短回答', 'short'), t('长回答', 'long')];
    const rows = base.rows.map((row, r) => {
      const name = V.text(svg, 20, ys[r] + 28, labels[r], 'algo-head');
      const cells = row.values.map((v, i) => cell(svg, x0 + i * (size + gap), ys[r], size, size, String(v), 'algo-val'));
      const weights = row.values.map((_, i) => V.text(svg, x0 + i * (size + gap) + size / 2, ys[r] + size + 16, '', 'algo-idx', 'middle'));
      const box = s('rect', {x: x0 - 8, y: ys[r] - 8, width: row.values.length * (size + gap) + 10, height: size + 30, rx: 8, class: 'algo-edge algo-dash', fill: 'none'});
      svg.append(box);
      const rank = V.text(svg, x0 - 8, ys[r] - 14, `rank ${r}`, 'algo-idx');
      const side = V.text(svg, x0 + 6 * (size + gap) + 12, ys[r] + 28, '', 'algo-strong');
      return {name, cells, weights, box, rank, side, row};
    });
    return frame => {
      rows.forEach((r, ri) => {
        r.cells.forEach((c, i) => c.set(String(r.row.values[i]), r.row.valid[i] ? (frame.stage >= 1 ? 'is-look' : '') : 'is-cross is-out'));
        r.weights.forEach((w, i) => { w.textContent = !r.row.valid[i] ? '' : frame.stage === 1 ? (ri === 0 ? '1/4' : '1/12') : frame.stage === 2 ? '1/8' : ''; });
        show(r.box, frame.stage >= 3); show(r.rank, frame.stage >= 3);
        r.side.textContent = frame.stage === 1 || frame.stage === 3 ? t(`均值 ${frame.means[ri]}`, `mean ${frame.means[ri]}`)
          : frame.stage >= 4 ? `${frame.sums[ri]} × ${frame.W}/${frame.N} = ${frame.scaled[ri]}` : '';
      });
    };
  }});

  FIGURES['step-kl-penalty'] = name => stepper(name, F.klPenalty(), {height: 250, readouts: f => [[t('B 的 log-ratio', 'B’s log-ratio'), f.stage >= 1 ? '−0.9163' : '—', f.stage >= 1 ? 'bad' : ''], [t('B 惩罚后回报', 'B’s shaped return'), f.stage >= 2 ? '1.1833' : '—'], ['KL', f.stage >= 3 ? '≈ 0.1927' : '—', f.stage >= 3 ? 'key' : ''], [t('总目标', 'objective'), f.done ? '≈ 0.9615 < 1' : '—', f.done ? 'good' : '']], setup(svg) {
    const base = F.klPenalty()[0], x0 = 230, w = 120, h = 32, gap = 10;
    const rowNames = ['π_ref', 'π_θ', 'log(π_θ/π_ref)', t('惩罚后回报', 'shaped return'), t('× π_θ（求 KL）', '× π_θ (for KL)')];
    ['A', 'B'].forEach((n, j) => V.text(svg, x0 + j * (w + gap) + w / 2, 26, n, 'algo-head', 'middle'));
    const rows = rowNames.map((label, i) => {
      const y = 38 + i * (h + 8);
      const head = V.text(svg, x0 - 12, y + 21, label, 'algo-head', 'end');
      return {head, cells: [0, 1].map(j => cell(svg, x0 + j * (w + gap), y, w, h, '', 'algo-note'))};
    });
    const sum = V.text(svg, x0 + 2 * (w + gap) + 8, 38 + 4 * (h + 8) + 21, '', 'algo-strong');
    const sign = x => (x < 0 ? '−' : '') + Math.abs(x).toFixed(4);
    return frame => {
      const values = [base.ref.map(String), base.actor.map(String), base.logRatio.map(x => (x > 0 ? '+' : '') + sign(x)), base.shaped.map(x => x.toFixed(4)), base.weighted.map(sign)];
      const visible = [true, true, frame.stage >= 1, frame.stage >= 2, frame.stage >= 3];
      rows.forEach((row, i) => {
        row.head.classList.toggle('is-dim', !visible[i]);
        row.cells.forEach((c, j) => {
          const state = !visible[i] ? 'is-hidden' : i === 2 && j === 1 ? 'is-bad' : i === 3 ? (j === 0 ? 'is-change' : 'is-keep') : i === 4 ? 'is-look' : '';
          c.set(visible[i] ? values[i][j] : '', state);
        });
      });
      sum.textContent = frame.stage >= 3 ? `= ${base.kl.toFixed(4)}` : '';
    };
  }});

  FIGURES['step-behavior-ratio'] = name => stepper(name, F.behaviorRatio(), {height: 250, readouts: f => [[t('实际采样分布 b', 'behavior b'), f.stage >= 2 ? '[2/3, 1/3]' : '—'], [t('对的比率', 'right ratio'), f.stage >= 3 ? `0.25 / (1/3) = ${f.right}` : '—', f.stage >= 3 ? 'good' : ''], [t('错用原始概率', 'raw denominator'), f.done ? `0.25 / 0.2 = ${f.wrong}` : '—', f.done ? 'bad' : '']], setup(svg) {
    const base = F.behaviorRatio()[0], floor = 210, unit = 170, bw = 80, groups = [70, 310];
    svg.append(s('line', {x1: 40, y1: floor, x2: 600, y2: floor, class: 'algo-edge'}));
    const bars = groups.map((gx, i) => {
      V.text(svg, gx + bw, floor + 20, t(`动作 ${i + 1}`, `action ${i + 1}`), 'algo-head', 'middle');
      const raw = s('rect', {x: gx, width: bw, rx: 3, class: 'algo-cell is-look'});
      const beh = s('rect', {x: gx + bw + 8, width: bw, rx: 3, class: 'algo-cell is-keep'});
      svg.append(raw, beh);
      const rawText = V.text(svg, gx + bw / 2, 0, '', 'algo-note', 'middle');
      const behText = V.text(svg, gx + bw * 1.5 + 8, 0, '', 'algo-note', 'middle');
      const tag1 = V.text(svg, gx + bw / 2, floor - 6, 'p', 'algo-idx', 'middle');
      const tag2 = V.text(svg, gx + bw * 1.5 + 8, floor - 6, 'b', 'algo-idx', 'middle');
      return {raw, beh, rawText, behText, tag2};
    });
    const marker = s('line', {x1: groups[1] - 14, x2: groups[1] + 2 * bw + 22, class: 'algo-edge is-bad'});
    svg.append(marker);
    const markerText = V.text(svg, groups[1] + 2 * bw + 28, 0, t('新模型 0.25', 'new model 0.25'), 'algo-strong');
    const note = V.text(svg, 40, 30, '', 'algo-note');
    return frame => {
      bars.forEach((b, i) => {
        const p = base.raw[i], q = base.behavior[i];
        b.raw.setAttribute('y', floor - p * unit); b.raw.setAttribute('height', p * unit);
        b.rawText.setAttribute('y', floor - p * unit + 18); b.rawText.textContent = frame.stage === 1 ? `√${p}≈${base.powered[i]}` : String(p);
        b.beh.setAttribute('y', floor - q * unit); b.beh.setAttribute('height', frame.stage >= 2 ? q * unit : 0);
        b.behText.setAttribute('y', floor - q * unit + 18); b.behText.textContent = frame.stage >= 2 ? (i ? '1/3' : '2/3') : '';
        show(b.tag2, frame.stage >= 2);
      });
      const y = floor - base.fresh * unit;
      marker.setAttribute('y1', y); marker.setAttribute('y2', y); show(marker, frame.stage >= 3);
      markerText.setAttribute('y', y + 4); show(markerText, frame.stage >= 3);
      note.textContent = frame.stage === 1 ? t(`合计 ${base.total}，各项再除以它`, `total ${base.total}; divide each by it`) : '';
    };
  }});

  FIGURES['step-chunked-prefill'] = name => stepper(name, {modes: [6, 12].map(budget => ({id: 'b' + budget, zh: `预算 ${budget}`, en: `budget ${budget}`, frames: F.chunkedPrefill(budget)}))},
    {height: 236, readouts: f => { const r = f.rounds[f.shown - 1]; return [[t('本轮 decode', 'decode this round'), r ? String(r.decode) : '—'], [t('本轮 prefill', 'prefill this round'), r ? String(r.take) : '—'], [t('prompt 还剩', 'prompt left'), r ? String(r.left) : String(f.prompt)], [t('几轮后能出首 token', 'rounds to first token'), f.done ? String(f.rounds.length) : '—', f.done ? 'key' : '']]; }, setup(svg) {
    const size = 34, gap = 4, x0 = 110;
    V.text(svg, 20, 34, 'prompt', 'algo-head');
    const strip = Array.from({length: 10}, (_, i) => cell(svg, x0 + i * (size + gap), 14, size, size, String(i + 1), 'algo-small'));
    const layer = s('g');
    svg.append(layer);
    let drawn = null, rows = [];
    return frame => {
      if (drawn !== frame.budget) {
        layer.textContent = '';
        rows = frame.rounds.map((_, r) => ({
          head: V.text(layer, 20, 92 + r * (size + 14) + 22, t(`第 ${r + 1} 轮`, `round ${r + 1}`), 'algo-head'),
          cells: Array.from({length: frame.budget}, (_, i) => cell(layer, x0 + i * (size + gap), 92 + r * (size + 14), size, size, '', 'algo-small'))}));
        drawn = frame.budget;
      }
      let done = 0;
      rows.forEach((row, r) => {
        const on = r < frame.shown, round = frame.rounds[r];
        row.head.classList.toggle('is-dim', !on);
        row.cells.forEach((c, i) => {
          if (!on) return c.set('', 'algo-ghost');
          if (i < round.decode) return c.set('D' + (i + 1), 'is-look');
          if (i < round.decode + round.take) return c.set(String(done + i - round.decode + 1), 'is-keep');
          c.set('', 'is-out');
        });
        if (on) done += round.take;
      });
      strip.forEach((c, i) => c.set(String(i + 1), i < done ? 'is-keep' : ''));
    };
  }});

  FIGURES['step-continuous-batching'] = name => stepper(name, {modes: [false, true].map(refill => ({id: refill ? 'refill' : 'static', zh: refill ? '每轮补位' : '等整批结束', en: refill ? 'refill each round' : 'wait for the batch', frames: F.continuousBatching(refill)}))},
    {height: 200, readouts: f => [[t('总轮数', 'rounds'), f.done ? String(f.total) : '—', f.done ? 'key' : ''], [t('空着的位置', 'empty slot-rounds'), f.done ? String(f.empty) : '—', f.done && f.empty ? 'bad' : ''], [t('C 从第几轮开始', 'C starts in round'), f.shown >= f.start ? String(f.start) : '—']], setup(svg) {
    const size = 50, gap = 6, x0 = 110, tone = {A: 'is-look', B: 'is-keep', C: 'is-change'};
    Array.from({length: 8}, (_, r) => V.text(svg, x0 + r * (size + gap) + size / 2, 26, String(r + 1), 'algo-idx', 'middle'));
    V.text(svg, 20, 26, t('轮次', 'round'), 'algo-head');
    const slots = [0, 1].map(k => {
      V.text(svg, 20, 40 + k * (size + gap) + 31, t(`位置 ${k + 1}`, `slot ${k + 1}`), 'algo-head');
      return Array.from({length: 8}, (_, r) => cell(svg, x0 + r * (size + gap), 40 + k * (size + gap), size, size, '', 'algo-val'));
    });
    return frame => {
      slots.forEach((row, k) => row.forEach((c, r) => {
        const round = frame.schedule[r];
        if (!round) return c.set('', 'is-hidden');
        if (r >= frame.shown) return c.set('', 'algo-ghost');
        const who = round[k];
        c.set(who || '', who ? tone[who] : 'is-cross is-out');
      }));
    };
  }});

  FIGURES['step-l1-l2'] = name => stepper(name, F.l1L2(), {height: 250, readouts: f => [[t('不加惩罚', 'no penalty'), 'w* = 0.4'], [t('平方 L2', 'squared L2'), f.stage >= 1 ? `w ≈ ${f.l2}` : '—'], [t('0 右侧斜率', 'slope right of 0'), f.stage >= 2 ? '+0.1' : '—'], ['L1', f.stage >= 3 ? 'w = 0' : '—', f.stage >= 3 ? 'key' : '']], setup(svg) {
    const base = F.l1L2()[0], x0 = 70, w = 500, y0 = 30, h = 170;
    const X = v => x0 + (v + 0.2) / 0.8 * w, Y = v => y0 + h - v / 0.3 * h;
    svg.append(s('line', {x1: x0, y1: y0 + h, x2: x0 + w, y2: y0 + h, class: 'algo-edge'}));
    svg.append(s('line', {x1: X(0), y1: y0, x2: X(0), y2: y0 + h, class: 'algo-edge algo-dash'}));
    [-0.2, 0, 0.2, 0.4, 0.6].forEach(v => V.text(svg, X(v), y0 + h + 18, String(v), 'algo-idx', 'middle'));
    V.text(svg, x0 + w, y0 + h + 34, 'w', 'algo-head', 'end');
    const path = fn => s('polyline', {points: Array.from({length: 81}, (_, i) => -0.2 + i * 0.01).map(v => `${X(v).toFixed(1)},${Y(fn(v)).toFixed(1)}`).join(' '), fill: 'none'});
    const curves = {data: path(base.curves.data), l2: path(base.curves.l2), l1: path(base.curves.l1)};
    Object.values(curves).forEach(c => svg.append(c));
    const mins = {data: [base.a, base.curves.data(base.a)], l2: [base.l2, base.curves.l2(base.l2)], l1: [0, base.curves.l1(0)]};
    const dots = Object.fromEntries(Object.entries(mins).map(([k, [mx, my]]) => { const c = s('circle', {r: 6, cx: X(mx), cy: Y(my), class: 'algo-cell ' + (k === 'l1' ? 'is-bad' : k === 'l2' ? 'is-keep' : 'is-look')}); svg.append(c); return [k, c]; }));
    const labels = {data: V.text(svg, X(0.45), Y(0.05), t('数据损失', 'data loss'), 'algo-note'), l2: V.text(svg, X(0.45), Y(0.115), '+ L2', 'algo-strong'), l1: V.text(svg, X(0.45), Y(0.27), '+ L1', 'algo-strong')};
    const slopes = [[0.06, base.right, '+0.1'], [-0.06, base.left, '−0.9']].map(([dx, k, label]) => {
      const y = base.curves.l1(0), line = s('line', {x1: X(0), y1: Y(y), x2: X(dx * 2), y2: Y(y + k * dx * 2), class: 'algo-edge is-keep'});
      svg.append(line);
      return {line, text: V.text(svg, X(dx * 2.6), Y(y + k * dx * 2.4) + 4, label, 'algo-strong', 'middle')};
    });
    return frame => {
      const on = {data: true, l2: frame.stage === 1 || frame.curve === 'both', l1: frame.stage >= 2};
      Object.entries(curves).forEach(([k, c]) => c.setAttribute('class', 'algo-edge' + (on[k] ? (k === 'data' && frame.stage >= 1 ? ' algo-dash' : '') : ' is-hidden')));
      Object.entries(dots).forEach(([k, d]) => show(d, on[k] && (k !== 'l1' || frame.stage >= 3)));
      Object.entries(labels).forEach(([k, l]) => show(l, on[k]));
      slopes.forEach(sl => { show(sl.line, frame.stage === 2 || frame.stage === 3); show(sl.text, frame.stage === 2 || frame.stage === 3); });
    };
  }});

  FIGURES['step-bce-vs-mse'] = name => stepper(name, F.bceVsMse(), {height: 236, readouts: f => [['p', f.text.p], ['dp/dz', f.stage >= 1 ? f.text.slope : '—'], [t('MSE 对 z 的梯度', 'MSE ∂L/∂z'), f.stage >= 2 ? f.text.mse : '—', f.stage >= 2 ? 'bad' : ''], [t('BCE 对 z 的梯度', 'BCE ∂L/∂z'), f.stage >= 3 ? f.text.bce : '—', f.stage >= 3 ? 'good' : '']], setup(svg) {
    const T = F.bceVsMse()[0].text, xs = [130, 300, 450], widths = [160, 140, 170], h = 34;
    const row = (y, name, values) => ({name: V.text(svg, 20, y + 22, name, 'algo-head'), values, cells: values.map((v, i) => cell(svg, xs[i], y, widths[i], h, v, 'algo-note'))});
    const fwd = row(20, t('前向', 'forward'), ['z = 10, y = 0', `p ≈ ${T.p}`, `dp/dz ≈ ${T.slope}`]);
    ['dL/dp', '× dp/dz', '= dL/dz'].forEach((label, i) => V.text(svg, xs[i] + widths[i] / 2, 96, label, 'algo-idx', 'middle'));
    const mse = row(108, 'MSE', [`p ≈ ${T.p}`, T.slope, T.mse]);
    const bce = row(160, 'BCE', [`1/(1 − p) ≈ ${T.bceOuter}`, T.slope, `p − y ≈ ${T.bce}`]);
    return frame => {
      fwd.cells.forEach((c, i) => { const on = i < 2 || frame.stage >= 1; c.set(on ? fwd.values[i] : '', !on ? 'is-hidden' : i === 2 ? 'is-look' : ''); });
      [[mse, 2, 'is-bad'], [bce, 3, 'is-keep']].forEach(([r, stage, last]) => {
        const on = frame.stage >= stage;
        r.name.classList.toggle('is-dim', !on);
        r.cells.forEach((c, i) => c.set(on ? r.values[i] : '', !on ? 'is-hidden' : i === 2 ? last : i === 1 ? 'is-look' : ''));
      });
    };
  }});

  FIGURES['step-adamw-l2'] = name => stepper(name, F.adamwL2(), {height: 200, readouts: f => [['AdamW θ₁', f.stage >= 1 ? String(f.adamw) : '—', f.stage >= 1 ? 'good' : ''], ['m̂ / √v̂', f.stage >= 3 ? `${f.mHat} / ${f.root}` : '—'], ['Adam + L2 θ₁', f.stage >= 4 ? `≈ ${f.adamL2}` : '—', f.stage >= 4 ? 'key' : '']], setup(svg) {
    const base = F.adamwL2()[0], w = 82, gap = 6, x0 = 112;
    const heads = ['g', 'm₁', 'v₁', 'm̂', '√v̂', t('更新', 'update'), 'θ₁'];
    heads.forEach((hd, i) => V.text(svg, x0 + i * (w + gap) + w / 2, 26, hd, 'algo-idx', 'middle'));
    const lane = (y, name, values, stageOf) => ({name: V.text(svg, 20, y + 22, name, 'algo-head'), values, stageOf, cells: values.map((_, i) => cell(svg, x0 + i * (w + gap), y, w, 34, '', 'algo-small'))});
    const adamw = lane(36, 'AdamW', ['0', '0', '0', '0', '0', '× 0.98', String(base.adamw)], [1, 1, 1, 1, 1, 1, 1]);
    const l2 = lane(90, 'Adam + L2', [String(base.g), String(base.m), String(base.v), String(base.mHat), String(base.root), `−${base.step}`, `≈ ${base.adamL2}`], [2, 2, 2, 3, 3, 4, 4]);
    return frame => {
      [adamw, l2].forEach(ln => {
        ln.name.classList.toggle('is-dim', frame.stage < ln.stageOf[0]);
        ln.cells.forEach((c, i) => { const on = frame.stage >= ln.stageOf[i]; c.set(on ? ln.values[i] : '', !on ? 'algo-ghost' : i === 6 ? (ln === adamw ? 'is-keep' : 'is-change') : ''); });
      });
    };
  }});

  FIGURES['step-packing-masks'] = name => stepper(name, F.packingMasks(), {height: 300, readouts: f => [[t('C 那一行能看到', 'row C can see'), f.mask === 'causal' ? 'A B EOS C' : f.mask === 'block' ? 'C' : '—'], ['EOS → C', f.stage >= 4 ? t('不计分', 'masked') : t('计分', 'scored'), f.stage >= 3 ? (f.stage >= 4 ? 'good' : 'bad') : ''], [t('计分的目标', 'scored targets'), f.scored ? String(f.scored) : '—', f.done ? 'key' : '']], setup(svg) {
    const base = F.packingMasks()[0], size = 30, gap = 3, x0 = 120, y0 = 40;
    base.tokens.forEach((tok, i) => {
      V.text(svg, x0 + i * (size + gap) + size / 2, y0 - 8, tok, 'algo-idx', 'middle');
      V.text(svg, x0 - 8, y0 + i * (size + gap) + 20, tok, 'algo-idx', 'end');
    });
    V.text(svg, x0 - 50, y0 - 24, t('query ↓  key →', 'query ↓  key →'), 'algo-head');
    const grid = base.tokens.map((_, q) => base.tokens.map((_, k) => cell(svg, x0 + k * (size + gap), y0 + q * (size + gap), size, size, '', 'algo-small')));
    const ty = y0 + 6 * (size + gap) + 26;
    V.text(svg, 20, ty + 22, t('预测目标', 'targets'), 'algo-head');
    const tw = 70;
    const targets = base.targets.map((tg, i) => cell(svg, x0 + i * (tw + 6), ty, tw, 34, `${tg.from}→${tg.to}`, 'algo-small'));
    return frame => {
      const mask = frame.mask ? frame[frame.mask] : null;
      grid.forEach((row, q) => row.forEach((c, k) => c.set('', !mask ? 'algo-ghost' : mask[q][k] ? (frame.focus === q ? 'is-now is-look' : 'is-look') : '')));
      targets.forEach((c, i) => {
        const tg = base.targets[i], scored = frame.loss[i];
        c.set(`${tg.from}→${tg.to}${frame.stage >= 4 && !scored ? ' · 0' : ''}`, !scored ? 'is-cross is-out' : frame.focus === i ? 'is-bad' : frame.stage >= 1 ? 'is-keep' : '');
      });
    };
  }});

  FIGURES['step-tp-backward'] = name => stepper(name, F.tpBackward(), {height: 300, readouts: f => [['G', '[1, 1]'], ['D₀ / D₁', f.stage >= 3 ? '[3, 0] / [0, 3]' : '—'], [t('两条路径', 'two paths'), f.stage >= 4 ? '[3, 3] / [6, 0]' : '—'], ['∇X', f.done ? '[9, 3]' : '—', f.done ? 'good' : '']], setup(svg) {
    const base = F.tpBackward()[0], w = 150, h = 32, xs = [200, 380];
    const v = a => `[${a.join(', ').replace(/-/g, '−')}]`;
    xs.forEach((x, r) => V.text(svg, x + w / 2, 24, `rank ${r}`, 'algo-head', 'middle'));
    const rows = [['pre-activation', base.pre, 0], ['G', [base.G, base.G], 1], ['G Bᵢᵀ', base.back, 2], [t('ReLU 导数', 'ReLU mask'), base.relu, 3], ['Dᵢ', base.D, 3], ['Dᵢ Aᵢᵀ', base.parts, 4]]
      .map(([label, values, stage], i) => {
        const y = 34 + i * (h + 8);
        return {stage, values, head: V.text(svg, xs[0] - 14, y + 21, label, 'algo-head', 'end'), cells: xs.map(x => cell(svg, x, y, w, h, '', 'algo-note'))};
      });
    const sy = 34 + 6 * (h + 8) + 6;
    const sum = cell(svg, xs[0], sy, xs[1] + w - xs[0], h + 4, '', 'algo-strong');
    const sumHead = V.text(svg, xs[0] - 14, sy + 23, 'AllReduce', 'algo-head', 'end');
    return frame => {
      rows.forEach(row => {
        const on = frame.stage >= row.stage;
        row.head.classList.toggle('is-dim', !on);
        row.cells.forEach((c, r) => c.set(on ? v(row.values[r]) : '', !on ? 'algo-ghost' : row.stage === frame.stage ? 'is-look' : ''));
      });
      sumHead.classList.toggle('is-dim', !frame.done);
      sum.set(frame.done ? `${v(base.parts[0])} + ${v(base.parts[1])} = ${v(base.dX)}` : '', frame.done ? 'is-keep' : 'algo-ghost');
    };
  }});

  FIGURES['step-bpe-merges'] = name => stepper(name, F.bpeMerges(), {height: 250, readouts: f => [[t('本轮合并', 'merge'), f.stage === 2 ? 'r + a → ra' : f.stage === 4 ? 'ra + i → rai' : '—'], [t('语料符号', 'symbols'), String(f.symbols)], [t('词表', 'vocabulary'), String(f.vocab.length)], ['rair', f.done ? 'rai r' : '—', f.done ? 'key' : '']], setup(svg) {
    const layer = s('g'), table = s('g');
    svg.append(layer, table);
    const chip = (g, x, y, text, cls) => { const w = text.length * 12 + 22; const c = cell(g, x, y, w, 32, text, 'algo-val'); c.set(text, cls); return w; };
    return frame => {
      layer.textContent = ''; table.textContent = '';
      const rows = frame.done ? [...frame.words.map(([sy, n]) => [sy, `×${n}`]), [frame.encoding[2], 'rair']] : frame.words.map(([sy, n]) => [sy, `×${n}`]);
      rows.forEach(([symbols, tag], r) => {
        const y = 24 + r * 46;
        V.text(layer, 20, y + 21, tag, 'algo-head');
        let x = 70;
        symbols.forEach(sym => { x += chip(layer, x, y, sym, sym.length > 1 ? 'is-keep' : '') + 6; });
      });
      V.text(table, 400, 22, t('相邻对 · 次数', 'pair · count'), 'algo-head');
      if (frame.stage >= 1) frame.table.forEach(([pair, n], i) => {
        const y = 32 + i * 38, key = pair.replace(' ', ', ');
        const c = cell(table, 400, y, 190, 30, `(${key})  ${n}`, 'algo-note');
        c.set(`(${key})  ${n}`, pair === frame.gone ? 'is-cross is-out' : pair === frame.pick ? 'is-now is-look' : '');
      });
    };
  }});

  FIGURES['step-swiglu'] = name => stepper(name, F.swiglu(), {height: 280, readouts: f => [['h', f.stage >= 2 ? `[0, ${f.h[1]}]` : '—'], ['y', f.stage >= 3 ? `≈ ${f.y}` : '—'], ['∂L/∂u₁', f.stage >= 4 ? '0' : '—', f.stage >= 4 ? 'bad' : ''], ['∂L/∂g₁', f.done ? String(f.gradG) : '—', f.done ? 'key' : '']], setup(svg) {
    const base = F.swiglu()[0], w = 120, h = 32, xs = [170, 300];
    xs.forEach((x, i) => V.text(svg, x + w / 2, 24, t(`第 ${i + 1} 维`, `dim ${i + 1}`), 'algo-head', 'middle'));
    const rows = [['g', base.g.map(String), 0], ['SiLU(g)', base.act.map(x => (x ? fixed(x, 4) : '0')), 1], ['u', base.u.map(String), 0], ['h = SiLU(g) ⊙ u', base.h.map(x => (x ? fixed(x, 4) : '0')), 2]]
      .map(([label, values, stage], i) => {
        const y = 34 + i * (h + 8);
        return {stage, values, head: V.text(svg, xs[0] - 14, y + 21, label, 'algo-head', 'end'), cells: xs.map(x => cell(svg, x, y, w, h, '', 'algo-note'))};
      });
    const yy = 34 + 4 * (h + 8) + 6;
    const out = cell(svg, xs[1] + w + 30, 34 + 3 * (h + 8), 130, h, '', 'algo-note');
    const outHead = V.text(svg, xs[1] + w + 95, 34 + 3 * (h + 8) - 8, 'y = W_d h', 'algo-idx', 'middle');
    const gu = cell(svg, xs[0], yy, 200, h, '', 'algo-note'), gg = cell(svg, xs[0], yy + h + 8, 200, h, '', 'algo-note');
    const guHead = V.text(svg, xs[0] - 14, yy + 21, '∂L/∂u₁', 'algo-head', 'end'), ggHead = V.text(svg, xs[0] - 14, yy + h + 29, '∂L/∂g₁', 'algo-head', 'end');
    return frame => {
      rows.forEach(row => { const on = frame.stage >= row.stage; row.head.classList.toggle('is-dim', !on); row.cells.forEach((c, i) => c.set(on ? row.values[i] : '', !on ? 'algo-ghost' : row.stage === 2 && i === 0 ? 'is-out' : row.stage === frame.stage ? 'is-look' : '')); });
      out.set(frame.stage >= 3 ? `≈ ${fixed(base.y, 4).replace('-', '−')}` : '', frame.stage >= 3 ? 'is-look' : 'algo-ghost'); show(outHead, frame.stage >= 3);
      gu.set(frame.stage >= 4 ? '1 × SiLU(0) = 0' : '', frame.stage >= 4 ? 'is-bad' : 'is-hidden'); guHead.classList.toggle('is-hidden', frame.stage < 4);
      gg.set(frame.done ? '1 × 3 × 0.5 = 1.5' : '', frame.done ? 'is-keep' : 'is-hidden'); ggHead.classList.toggle('is-hidden', !frame.done);
    };
  }});

  FIGURES['step-depth-merge'] = name => stepper(name, F.depthMerge(), {height: 230, readouts: f => [[t('第一批', 'batch 1'), f.stage >= 1 ? 'out 0 · ℓ 1' : '—'], [t('第二批', 'batch 2'), f.stage >= 2 ? 'out 4 · ℓ 3' : '—'], [t('合并', 'merged'), f.stage >= 4 ? '3 ✓' : f.stage === 3 ? '2 ✗' : '—', f.stage >= 4 ? 'good' : f.stage === 3 ? 'bad' : '']], setup(svg) {
    const size = 48, gap = 8, xs = [60, 190];
    const boxes = [[xs[0], 1], [xs[1], 3]].map(([x, n], b) => {
      svg.append(s('rect', {x: x - 10, y: 24, width: n * (size + gap) + 12, height: size + 44, rx: 10, class: 'algo-edge algo-dash', fill: 'none'}));
      V.text(svg, x - 6, 16, t(`第 ${b + 1} 批`, `batch ${b + 1}`), 'algo-head');
      return F.depthMerge()[0].batches[b].map((value, i) => ({chip: cell(svg, x + i * (size + gap), 34, size, size, String(value), 'algo-val'), weight: V.text(svg, x + i * (size + gap) + size / 2, 34 + size + 22, '', 'algo-idx', 'middle')}));
    });
    const stats = [xs[0], xs[1]].map(x => V.text(svg, x - 6, 150, '', 'algo-note'));
    const merged = cell(svg, 430, 70, 150, 40, '', 'algo-strong');
    V.text(svg, 505, 60, t('合并后的输出', 'merged output'), 'algo-head', 'middle');
    return frame => {
      boxes.forEach((chips, b) => chips.forEach(({chip, weight}) => {
        chip.set(chip.label.textContent, frame.stage >= b + 1 ? 'is-look' : '');
        weight.textContent = frame.done ? '1/4' : frame.stage >= b + 1 ? (b === 0 ? '1' : '1/3') : '';
      }));
      stats.forEach((c, b) => { c.textContent = frame.stage >= b + 1 ? `m 0 · ℓ ${b ? 3 : 1} · out ${b ? 4 : 0}` : ''; });
      merged.set(frame.stage === 3 ? '(0 + 4)/2 = 2' : frame.stage >= 4 ? '(1·0 + 3·4)/4 = 3' : '', frame.stage === 3 ? 'is-bad' : frame.stage >= 4 ? 'is-keep' : 'algo-ghost');
    };
  }});

  FIGURES['step-expert-budget'] = name => stepper(name, F.expertBudget(), {height: 210, readouts: f => [[t('每个 expert', 'per expert'), f.cfg.per.toLocaleString('en-US')], [t('expert 总参数', 'expert params'), f.stage === 4 ? '—' : f.cfg.total.toLocaleString('en-US')], [t('每个 token 激活', 'active per token'), f.cfg.lit ? f.cfg.lit.toLocaleString('en-US') : '—', f.done ? 'bad' : f.stage >= 2 ? 'good' : ''], [t('相对第一行', 'vs. first row'), f.done ? '+12.5%' : f.cfg.lit ? '+0%' : '—', f.done ? 'bad' : '']], setup(svg) {
    const x0 = 40, total = 512, y = 50, h = 80, layer = s('g');
    svg.append(layer);
    V.text(svg, x0, 36, t('面积 = 参数量', 'area = parameters'), 'algo-head');
    return frame => {
      layer.textContent = '';
      const cfg = frame.cfg, n = cfg.routed + (frame.stage === 4 ? 0 : cfg.shared), w = total / (cfg.f === 256 ? 8 : 32);
      for (let i = 0; i < n; i++) {
        const isShared = frame.stage === 3 && i === 0;
        const lit = isShared || (cfg.active && (frame.stage === 3 ? i >= 1 && i <= cfg.active : i < cfg.active));
        const r = s('rect', {x: x0 + i * w + 1, y, width: w - 2, height: h, rx: 3, class: 'algo-cell' + (isShared ? ' is-change' : lit ? ' is-keep' : '')});
        layer.append(r);
      }
      if (frame.stage === 4) {
        layer.append(s('rect', {x: x0 + total + 12, y, width: w - 2, height: h, rx: 3, class: 'algo-cell is-bad'}));
        V.text(layer, x0 + total + 12 + w / 2, y + h + 18, 'shared', 'algo-idx', 'middle');
      }
      if (frame.stage === 3) V.text(layer, x0 + w / 2, y + h + 18, 'shared', 'algo-idx', 'middle');
      V.text(layer, x0, y + h + 40, cfg.f === 256 ? t('8 个 expert，f = 256', '8 experts, f = 256') : t(`${cfg.routed} 个 routed${cfg.shared ? ` + ${cfg.shared} 个 shared` : ''}，f = 64`, `${cfg.routed} routed${cfg.shared ? ` + ${cfg.shared} shared` : ''}, f = 64`), 'algo-note');
    };
  }});

  FIGURES['step-verifier-ceiling'] = name => stepper(name, F.verifierCeiling(), {height: 250, readouts: f => [
    [t('通过测试', 'pass the tests'), f.stage >= 1 ? `${f.kept} / 100` : '—'],
    [t('其中真正正确', 'actually right'), f.stage >= 2 ? (f.precision * 100).toFixed(1) + '%' : '—', f.stage >= 2 ? 'key' : ''],
    [t('测试显示', 'tests report'), f.stage >= 3 ? '100%' : '—', f.stage >= 3 ? 'bad' : ''],
    [t('真实正确率', 'true accuracy'), f.stage >= 3 ? `${f.right}%` : '40%', f.stage >= 4 ? 'key' : '']], setup(svg) {
    const size = 17, gap = 3, x0 = 34, y0 = 34;
    const grid = s('g');
    svg.append(grid);
    const head = V.text(svg, x0, 22, '', 'algo-head');
    const cells = Array.from({length: 100}, (_, i) => {
      const r = s('rect', {x: x0 + (i % 10) * (size + gap), y: y0 + Math.floor(i / 10) * (size + gap), width: size, height: size, rx: 3, class: 'algo-cell'});
      grid.append(r);
      return r;
    });
    const legend = [['is-keep', t('正确', 'right')], ['is-change', t('错，但过了测试', 'wrong, passes')], ['is-bad', t('错，被拦下', 'wrong, rejected')]].map(([cls, label], i) => {
      const g = s('g');
      g.append(s('rect', {x: 270, y: 44 + i * 26, width: 14, height: 14, rx: 3, class: 'algo-cell ' + cls}));
      V.text(g, 292, 56 + i * 26, label, 'algo-note');
      svg.append(g);
      return g;
    });
    const bx = 270, bw = 300, bars = [0, 1, 2, 3].map(i => {
      const y = 70 + i * 36;
      return {label: V.text(svg, bx, y - 6, '', 'algo-note'), back: (() => { const r = s('rect', {x: bx, y, width: bw, height: 12, rx: 3, class: 'algo-ghost'}); svg.append(r); return r; })(),
        bar: (() => { const r = s('rect', {x: bx, y, width: 0, height: 12, rx: 3, class: 'algo-bar'}); svg.append(r); return r; })()};
    });
    return frame => {
      const {stage} = frame;
      cells.forEach((rect, i) => {
        let cls;
        if (stage <= 2) cls = i < 40 ? 'is-keep' : (stage >= 1 && i < 40 + frame.leaked) ? 'is-change' : stage >= 1 ? 'is-bad is-out' : 'is-bad';
        else cls = i < frame.right ? 'is-keep' : 'is-change';
        rect.setAttribute('class', 'algo-cell ' + cls);
      });
      head.textContent = stage <= 2 ? t('第一轮：模型写出的 100 份解', 'round 1: the model’s 100 solutions') : t('微调后：新模型的 100 份解', 'after fine-tuning: 100 new solutions');
      show(grid, true);
      legend.forEach((g, i) => show(g, stage < 5 && (i < 2 || stage <= 2)));
      bars.forEach((b, i) => {
        const c = frame.ceilings[i], on = stage >= 5;
        b.label.textContent = on ? `${t('放过错解', 'wrong let through')} ${Math.round(c.f * 100)}% → ${t('上限', 'ceiling')} ${(c.value * 100).toFixed(1)}%` : '';
        b.bar.setAttribute('width', on ? c.value * bw : 0);
        b.bar.setAttribute('class', 'algo-bar' + (on && c.f === frame.f ? ' is-now' : ''));
        show(b.back, on);
      });
    };
  }});

  FIGURES['step-time-horizon'] = name => stepper(name, F.timeHorizon(), {height: 262, readouts: f => [
    [t('成功次数', 'successes'), f.run.counts.join(' · ')],
    [t('斜率', 'slope'), f.stage >= 1 ? f.run.slope.toFixed(2) : '—'],
    [t('50% 时间跨度', '50% horizon'), f.stage >= 2 ? `${f.run.h50.toFixed(0)} ${t('小时', 'h')}` : '—', f.stage >= 4 ? 'bad' : f.stage >= 2 ? 'key' : ''],
    [t('80% 时间跨度', '80% horizon'), f.stage === 3 ? `${(f.run.h80 * 60).toFixed(0)} ${t('分钟', 'min')}` : '—']], setup(svg) {
    const px0 = 60, pw = 540, py0 = 30, ph = 170, xmin = -3, xmax = 8;
    const X = x => px0 + (x - xmin) / (xmax - xmin) * pw, Y = p => py0 + (1 - p) * ph;
    const beyond = s('rect', {x: X(4), y: py0, width: X(xmax) - X(4), height: ph, class: 'algo-reach is-bad-band'});
    svg.append(beyond);
    const beyondLabel = V.text(svg, X(6), py0 + 16, t('超出最长任务', 'beyond the longest tasks'), 'algo-warn', 'middle');
    svg.append(s('line', {x1: px0, y1: Y(0), x2: px0 + pw, y2: Y(0), class: 'algo-edge'}), s('line', {x1: px0, y1: Y(0), x2: px0, y2: Y(1), class: 'algo-edge'}));
    [[-2, t('15 分钟', '15 min')], [0, t('1 小时', '1 h')], [2, t('4 小时', '4 h')], [4, t('16 小时', '16 h')], [6, t('64 小时', '64 h')], [8, t('256 小时', '256 h')]].forEach(([x, label]) => V.text(svg, X(x), Y(0) + 18, label, 'algo-idx', 'middle'));
    [0, 0.5, 0.8, 1].forEach(p => V.text(svg, px0 - 8, Y(p) + 4, String(p), 'algo-idx', 'end'));
    const half = s('line', {x1: px0, x2: px0 + pw, y1: Y(0.5), y2: Y(0.5), class: 'algo-edge algo-dash'}), eighty = s('line', {x1: px0, x2: px0 + pw, y1: Y(0.8), y2: Y(0.8), class: 'algo-edge algo-dash'});
    const curve = s('polyline', {class: 'algo-edge is-look-line', fill: 'none'}), drop = s('line', {class: 'algo-edge is-change'}), drop80 = s('line', {class: 'algo-edge is-keep'});
    svg.append(half, eighty, curve, drop, drop80);
    const dots = [0, 1, 2, 3].map(() => { const c = s('circle', {r: 6, class: 'algo-cell is-look'}); svg.append(c); return c; });
    const mark = V.text(svg, 0, 0, '', 'algo-strong', 'middle');
    return frame => {
      const run = frame.run, sig = x => 1 / (1 + Math.exp(-(run.icpt + run.slope * x)));
      dots.forEach((c, i) => { c.setAttribute('cx', X(frame.xs[i])); c.setAttribute('cy', Y(run.ps[i])); });
      curve.setAttribute('points', Array.from({length: 111}, (_, k) => xmin + k / 10).map(x => `${X(x).toFixed(1)},${Y(sig(x)).toFixed(1)}`).join(' '));
      show(curve, frame.stage >= 1);
      show(half, frame.stage >= 2); show(eighty, frame.stage === 3);
      const x50 = Math.min(xmax, run.x50);
      drop.setAttribute('x1', X(x50)); drop.setAttribute('x2', X(x50)); drop.setAttribute('y1', Y(0.5)); drop.setAttribute('y2', Y(0));
      show(drop, frame.stage >= 2);
      drop80.setAttribute('x1', X(run.x80)); drop80.setAttribute('x2', X(run.x80)); drop80.setAttribute('y1', Y(0.8)); drop80.setAttribute('y2', Y(0));
      show(drop80, frame.stage === 3);
      mark.setAttribute('x', X(x50)); mark.setAttribute('y', Y(0.5) - 10);
      mark.textContent = frame.stage >= 2 ? `≈ ${run.h50.toFixed(0)} ${t('小时', 'h')}` : '';
      show(beyond, frame.stage >= 4); show(beyondLabel, frame.stage >= 4);
    };
  }});

  FIGURES['step-evaluator-rank'] = name => stepper(name, F.evaluatorRank(), {height: 250, readouts: f => [
    ['Pearson', f.stage >= 2 ? f.pearson.toFixed(2) : '—', f.stage >= 2 ? 'good' : ''],
    ['Spearman', f.stage >= 2 ? (f.done ? `${f.spearman.toFixed(1)} → ${t('前三', 'top 3')} ${f.top3.toFixed(1)}` : f.spearman.toFixed(1)) : '—', f.done ? 'bad' : f.stage >= 2 ? 'good' : ''],
    ['MMRV', f.stage >= 2 ? f.mmrv.toFixed(2) : '—'],
    [t('按模型挑中', 'model picks'), f.stage >= 3 ? `${f.picked} ✗（${t('真机最好', 'best on robot')} ${f.best}）` : '—', f.stage >= 3 ? 'bad' : '']], setup(svg) {
    const lx = 150, rx = 470, y0 = 48, gap = 36;
    V.text(svg, lx, 26, t('真机成功率', 'real success rate'), 'algo-head', 'middle');
    const rightHead = V.text(svg, rx, 26, t('世界模型预测', 'world-model prediction'), 'algo-head', 'middle');
    const base = F.evaluatorRank()[0];
    const left = base.names.map(() => cell(svg, lx - 60, 0, 120, 26, '', 'algo-small'));
    const right = base.names.map(() => cell(svg, rx - 60, 0, 120, 26, '', 'algo-small'));
    const links = base.names.map(() => { const l = s('line', {class: 'algo-edge'}); svg.append(l); return l; });
    return frame => {
      base.names.forEach((n, i) => {
        const yl = y0 + (frame.rReal[i] - 1) * gap, yr = y0 + (frame.rModel[i] - 1) * gap;
        const swapped = (n === 'D' || n === 'E');
        left[i].rect.setAttribute('y', yl); left[i].label.setAttribute('y', yl + 18);
        left[i].set(`${n}  ${frame.R[i].toFixed(2)}`, frame.stage >= 3 && n === frame.best ? 'is-keep' : '');
        right[i].rect.setAttribute('y', yr); right[i].label.setAttribute('y', yr + 18);
        right[i].set(frame.stage >= 1 ? `${n}  ${frame.P[i].toFixed(2)}` : '', frame.stage < 1 ? 'is-hidden' : frame.stage >= 3 && n === frame.picked ? 'is-bad' : '');
        links[i].setAttribute('x1', lx + 60); links[i].setAttribute('y1', yl + 13); links[i].setAttribute('x2', rx - 60); links[i].setAttribute('y2', yr + 13);
        links[i].setAttribute('class', 'algo-edge' + (frame.stage < 1 ? ' is-hidden' : swapped ? ' is-bad' : frame.done && i < 2 ? ' is-out' : ''));
      });
      show(rightHead, frame.stage >= 1);
    };
  }});

  FIGURES['step-mcts-visits'] = name => stepper(name, F.mctsVisits(), {height: 250, readouts: f => [
    ['N(L), N(R)', `${f.N[0]}, ${f.N[1]}`],
    [t('这次选中', 'chosen'), f.pick == null ? '—' : (f.pick ? 'R' : 'L')],
    [t('先验 P', 'prior P'), '0.6, 0.4'],
    [t('搜索标签 π', 'search target π'), f.done ? `${f.pi1.map(x => x.toFixed(2)).join(', ')}` : '—', f.done ? 'key' : '']], setup(svg) {
    const root = [200, 40], kids = [[105, 150], [295, 150]], w = 170, h = 54;
    const edges = kids.map(([x, y]) => { const l = s('line', {x1: root[0], y1: root[1] + 14, x2: x, y2: y - h / 2, class: 'algo-edge'}); svg.append(l); return l; });
    svg.append(s('circle', {cx: root[0], cy: root[1], r: 14, class: 'algo-cell is-look'}));
    V.text(svg, root[0], root[1] + 4, 's', 'algo-strong', 'middle');
    const boxes = kids.map(([x, y], i) => {
      const rect = s('rect', {x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 8, class: 'algo-cell'});
      svg.append(rect);
      const l1 = V.text(svg, x, y - 6, `${i ? 'R' : 'L'} · P ${i ? 0.4 : 0.6} · v ${i ? 0.6 : 0.2}`, 'algo-note', 'middle');
      const l2 = V.text(svg, x, y + 14, '', 'algo-strong', 'middle');
      const score = V.text(svg, x, y + h / 2 + 18, '', 'algo-idx', 'middle');
      return {rect, l1, l2, score};
    });
    const bx = 420, bw = 170;
    V.text(svg, bx, 40, t('先验 P 与搜索标签 π', 'prior P vs search target π'), 'algo-head');
    const rows = [['L', 0], ['R', 1]].map(([n, i]) => {
      const y = 62 + i * 70;
      V.text(svg, bx, y + 10, n, 'algo-strong');
      const pr = s('rect', {x: bx + 18, y, width: 0.6 * bw, height: 12, rx: 3, class: 'algo-ghost'});
      const pi = s('rect', {x: bx + 18, y: y + 18, width: 0, height: 12, rx: 3, class: 'algo-bar'});
      svg.append(pr, pi);
      const lp = V.text(svg, bx + 18 + bw + 6, y + 10, '', 'algo-idx'), lq = V.text(svg, bx + 18 + bw + 6, y + 28, '', 'algo-idx');
      return {pr, pi, lp, lq};
    });
    return frame => {
      boxes.forEach((b, i) => {
        b.l2.textContent = `N ${frame.N[i]} · Q ${frame.N[i] ? frame.Q[i].toFixed(1) : '0'}`;
        b.rect.setAttribute('class', 'algo-cell' + (frame.pick === i ? ' is-change' : frame.done && i === 1 ? ' is-keep' : ''));
        b.score.textContent = frame.score ? `${t('分数', 'score')} ${frame.score[i].toFixed(2)}` : '';
        edges[i].setAttribute('class', 'algo-edge' + (frame.pick === i ? ' is-change' : ''));
      });
      rows.forEach((r, i) => {
        r.pr.setAttribute('width', [0.6, 0.4][i] * bw);
        r.lp.textContent = `P ${[0.6, 0.4][i]}`;
        r.pi.setAttribute('width', frame.done ? frame.pi1[i] * bw : 0);
        r.lq.textContent = frame.done ? `π ${frame.pi1[i].toFixed(2)}` : '';
      });
    };
  }});

  FIGURES['step-lambda-return'] = name => stepper(name, F.lambdaReturn(), {height: 236, readouts: f => [
    ['γ, λ', '0.9, 0.5'],
    ['R0', f.R[0] == null ? '—' : String(Math.round(f.R[0] * 1000) / 1000), f.wrong ? 'bad' : f.stage >= 4 ? 'key' : ''],
    [t('优势 R0 − v0', 'advantage R0 − v0'), f.R[0] == null ? '—' : (f.R[0] - 0.6 >= 0 ? '+' : '') + String(Math.round((f.R[0] - 0.6) * 1000) / 1000), f.wrong ? 'bad' : f.stage >= 4 ? 'good' : ''],
    [t('λ = 0 / λ = 1', 'λ = 0 / λ = 1'), f.stage >= 5 ? `${Math.round(f.lam0 * 1000) / 1000} / ${Math.round(f.lam1 * 1000) / 1000}` : '—']], setup(svg) {
    const xs = [90, 230, 370, 510], y = 96;
    V.text(svg, 20, 30, 'R^λ', 'algo-head');
    const nodes = xs.map((x, i) => {
      const circle = s('circle', {cx: x, cy: y, r: 24, class: 'algo-cell'});
      svg.append(circle);
      V.text(svg, x, y + 5, 's' + i, 'algo-strong', 'middle');
      const R = V.text(svg, x, 40, '', 'algo-strong', 'middle');
      const facts = V.text(svg, x, y + 46, '', 'algo-note', 'middle');
      const val = V.text(svg, x, y + 66, '', 'algo-idx', 'middle');
      return {circle, R, facts, val};
    });
    xs.slice(0, 3).forEach((x, i) => svg.append(s('line', {x1: x + 26, y1: y, x2: xs[i + 1] - 26, y2: y, class: 'algo-edge'})));
    const back = xs.slice(0, 3).map((x, i) => { const p = s('path', {d: `M${xs[i + 1] - 10} 52 Q${(x + xs[i + 1]) / 2} 66 ${x + 10} 52`, class: 'algo-edge is-change'}); svg.append(p); return p; });
    return frame => {
      nodes.forEach((n, i) => {
        const rr = i === 2 && frame.wrong ? -1 : frame.r[i], cc = i === 2 && frame.wrong ? 0 : frame.c[i];
        n.facts.textContent = i === 0 ? t('起点（真实）', 'start (real)') : `r ${rr} · c ${cc}`;
        n.val.textContent = `v ${frame.v[i]}`;
        n.R.textContent = frame.R[i] == null ? '' : String(Math.round(frame.R[i] * 1000) / 1000);
        const now = frame.stage >= 1 && frame.stage <= 4 && i === 4 - frame.stage;
        n.circle.setAttribute('class', 'algo-cell' + (frame.wrong && i === 2 ? ' is-bad' : now ? ' is-change' : frame.R[i] != null && frame.stage >= 1 ? ' is-keep' : ''));
      });
      back.forEach((p, i) => p.classList.toggle('is-hidden', !(frame.R[i] != null && frame.stage >= 2)));
    };
  }});

  FIGURES['step-reliance-groups'] = name => stepper(name, F.relianceGroups(), {height: 300, readouts: f => {
    const diff = x => (Math.abs(x) < 1e-9 ? '0' : (x > 0 ? '+' : '−') + short(Math.abs(x)));
    const tone = x => (Math.abs(x) < 1e-9 ? '' : x > 0 ? 'good' : 'bad');
    if (f.agree != null) return [[t('L 组采纳 AI 的比例', 'L: share adopting the AI'), 'r = 0'], [t('L 组和 AI 一致的比例', 'L: share agreeing with the AI'), short(f.agree), 'bad']];
    const acc = f.policies[f.now].acc;
    return [[t('团队准确率', 'team accuracy'), short(acc), 'key'],
      [t('比人单独', 'vs person alone'), diff(acc - f.person), tone(acc - f.person)],
      [t('比 AI 单独', 'vs AI alone'), f.now >= 1 ? diff(acc - f.overall) : '—', f.now >= 1 ? tone(acc - f.overall) : '']];
  }, setup(svg) {
    const first = F.relianceGroups()[0], share = first.share;
    const x0 = 70, colW = 76, gap = 14, base = 246, unit = 190, Y = v => base - v * unit, right = x0 + 6 * colW + 5 * gap;
    // English names take two lines so neighbouring columns do not collide
    const names = [['只靠人', 'person\nonly'], ['只靠 AI', 'AI\nonly'], ['按把握', 'follow\nsignal'], ['过度依赖', 'over-\nreliance'], ['依赖不足', 'under-\nreliance'], ['信号没信息', 'no-info\nsignal']];
    const frac = r => (Math.abs(r - 2 / 3) < 1e-9 ? '⅔' : String(r));
    [['is-look', t('照 AI 的建议', 'follow the AI')], ['is-keep', t('人自己判断', 'person decides')]].forEach(([cls, label], i) => {
      svg.append(s('rect', {x: x0 + i * 150, y: 14, width: 14, height: 14, rx: 3, class: 'algo-cell ' + cls}));
      V.text(svg, x0 + i * 150 + 20, 26, label, 'algo-note');
    });
    svg.append(s('line', {x1: x0 + 300, y1: 21, x2: x0 + 320, y2: 21, class: 'algo-edge is-change'}));
    V.text(svg, x0 + 326, 26, t('团队准确率', 'team accuracy'), 'algo-note');
    svg.append(s('line', {x1: x0 - 6, y1: base, x2: right + 6, y2: base, class: 'algo-edge'}));
    [...new Set([0, first.person, first.overall, ...first.policies[1].a])].forEach(v => V.text(svg, x0 - 10, Y(v) + 4, v ? short(v) : '0', 'algo-idx', 'end'));
    const cols = first.policies.map((pol, i) => {
      const x = x0 + i * (colW + gap), g = s('g');
      svg.append(g);
      [0, 1].forEach(k => {
        const from = x + (k ? share[0] * colW : 0), w = share[k] * colW, wAi = pol.r[k] * w;
        if (wAi > 2) g.append(s('rect', {x: from + 1, y: Y(pol.a[k]), width: wAi - 2, height: pol.a[k] * unit, rx: 2, class: 'algo-cell is-look'}));
        if (w - wAi > 2) g.append(s('rect', {x: from + wAi + 1, y: Y(first.person), width: w - wAi - 2, height: first.person * unit, rx: 2, class: 'algo-cell is-keep'}));
        V.text(g, wAi >= w - wAi ? from + wAi / 2 : from + wAi + (w - wAi) / 2, base - 8, k ? 'L' : 'H', 'algo-idx', 'middle');
      });
      g.append(s('line', {x1: x - 4, x2: x + colW + 4, y1: Y(pol.acc), y2: Y(pol.acc), class: 'algo-edge is-change'}));
      const lines = t(...names[i]).split('\n'), below = base + 18 + 14 * (lines.length - 1);
      lines.forEach((line, n) => V.text(g, x + colW / 2, base + 18 + 14 * n, line, 'algo-head', 'middle'));
      V.text(g, x + colW / 2, below + 16, `r ${frac(pol.r[0])}, ${frac(pol.r[1])}`, 'algo-idx', 'middle');
      return {g, value: V.text(g, x + colW / 2, below + 34, short(pol.acc), 'algo-strong', 'middle')};
    });
    const refs = [[first.person, t('人单独', 'person')], [first.overall, t('AI 单独', 'AI')]].map(([v, label]) => {
      const g = s('g');
      g.append(s('line', {x1: x0 - 6, x2: right + 6, y1: Y(v), y2: Y(v), class: 'algo-edge algo-dash'}));
      V.text(g, right + 10, Y(v) + 4, label, 'algo-note');
      svg.append(g);
      return g;
    });
    const lx = x0 + 2 * (colW + gap) + share[0] * colW, lw = share[1] * colW;
    const agree = s('g');
    agree.append(s('line', {x1: lx + 1, x2: lx + lw - 1, y1: 0, y2: 0, class: 'algo-edge is-bad algo-dash'}));
    const agreeText = V.text(agree, lx + lw / 2, 0, '', 'algo-strong', 'middle');
    svg.append(agree);
    return frame => {
      cols.forEach((c, i) => {
        show(c.g, i < frame.shown);
        c.value.setAttribute('class', i === frame.now ? 'algo-strong' : 'algo-note');
      });
      show(refs[1], frame.shown >= 2);
      show(agree, frame.agree != null);
      if (frame.agree != null) {
        agree.firstChild.setAttribute('y1', Y(frame.agree)); agree.firstChild.setAttribute('y2', Y(frame.agree));
        agreeText.setAttribute('y', Y(frame.agree) + 15); agreeText.textContent = short(frame.agree);
      }
    };
  }});

  FIGURES['step-judge-sampling'] = name => stepper(name, F.judgeSampling(), {height: 290, readouts: f => {
    const pct = (x, d = 0) => (x * 100).toFixed(d) + '%', pt = x => (x * 100).toFixed(1), pts = t(' 个百分点', ' points');
    const truth = [t('真实通过率', 'true pass rate'), pct(f.p)], corrected = [t('校正后 p̂', 'corrected p̂'), `${pct(f.pHat)} ± ${pt(f.half)}`];
    return [
      [truth, ['q', '—']],
      [truth, [t('judge 通过率 q', 'judge pass rate q'), `${short(f.cells.tp)} + ${short(f.cells.fp)} = ${short(f.q)}`, 'key']],
      [['q', short(f.q)], [...corrected, 'key']],
      [corrected, [t('日环比 MDE', 'day-over-day MDE'), `≈ ${pt(f.mdeAll)}${pts}`, 'key']],
      [[t('切片每天评判', 'slice judged a day'), String(f.sliceN)], ['Wilson', `${pct(f.lo)}–${pct(f.hi)}`, 'bad'], [t('整体变化', 'overall change'), `−${pt(f.move)}${pts}`, 'bad']],
      [[t('每天 judge 调用', 'judge calls a day'), `${f.strat} + ${f.rest} = ${(f.strat + f.rest).toLocaleString('en-US')}`], [t('切片 MDE', 'slice MDE'), `≈ ${pt(f.sliceMde)}${pts}`, 'good']],
      [['t', `${f.t} → ${f.t2}`, 'bad'], [t('真实通过率', 'true pass rate'), `${pct(f.p)} → ${pct(f.p2, 1)}`, 'bad'], ['q', `${short(f.q)} → ${f.q2.toFixed(3)}`, 'key']]
    ][f.stage];
  }, setup(svg) {
    const sx = 34, sy = 44, side = 170, cx0 = 300, cw = 230, cy0 = 44, ch = 150, xm = cx0 + cw / 2, x1 = cx0 + cw;
    const pct = x => (x * 100).toFixed(1).replace(/\.0$/, '') + '%', pt = x => (x * 100).toFixed(1), four = x => String(Math.round(x * 10000) / 10000);
    const scale = {overall: [0.80, 0.95], slice: [0.50, 1.00]}, tickSets = {overall: [0.80, 0.85, 0.90, 0.95], slice: [0.5, 0.6, 0.7, 0.8, 0.9, 1]};
    V.text(svg, sx, 26, t('人工标准 × judge 判定', 'human label × judge verdict'), 'algo-head');
    const box = {};
    ['tp', 'fn', 'fp', 'tn'].forEach(k => { box[k] = s('rect', {rx: 2, class: 'algo-cell'}); svg.append(box[k]); });
    const tpText = V.text(svg, 0, 0, '', 'algo-strong', 'middle'), fpText = V.text(svg, sx + side + 6, 0, '', 'algo-note');
    const passText = V.text(svg, 0, sy + side + 18, '', 'algo-head', 'middle'), failText = V.text(svg, 0, sy + side + 18, '', 'algo-head', 'middle');
    const legend = s('g');
    [['is-look', t('judge 判通过', 'judge passes')], ['', t('judge 判不通过', 'judge fails')]].forEach(([cls, label], i) => {
      legend.append(s('rect', {x: sx + i * 118, y: sy + side + 32, width: 14, height: 14, rx: 3, class: 'algo-cell ' + cls}));
      V.text(legend, sx + i * 118 + 20, sy + side + 44, label, 'algo-note');
    });
    svg.append(legend);
    const head = V.text(svg, cx0, 26, '', 'algo-head');
    svg.append(s('line', {x1: cx0, y1: cy0, x2: cx0, y2: cy0 + ch, class: 'algo-edge'}), s('line', {x1: cx0, y1: cy0 + ch, x2: x1, y2: cy0 + ch, class: 'algo-edge'}));
    V.text(svg, x1, cy0 + ch + 16, t('天 →', 'days →'), 'algo-idx', 'end');
    const ticks = Array.from({length: 6}, () => V.text(svg, cx0 - 6, 0, '', 'algo-idx', 'end'));
    const band = s('rect', {class: 'algo-band'}), marker = s('line', {x1: xm, x2: xm, y1: cy0, y2: cy0 + ch, class: 'algo-edge algo-dash'});
    const trueLine = s('polyline', {class: 'algo-edge algo-dash'}), sliceLine = s('polyline', {class: 'algo-edge is-change'}), judgeLine = s('polyline', {class: 'algo-edge is-look-line'});
    const bracket = s('path', {class: 'algo-edge'});
    svg.append(band, marker, trueLine, sliceLine, judgeLine, bracket);
    const bandText = V.text(svg, cx0 + 6, 0, '', 'algo-idx'), bracketText = V.text(svg, xm + 20, 0, '', 'algo-idx');
    const ends = {truth: V.text(svg, x1 + 6, 0, '', 'algo-note'), judge: V.text(svg, x1 + 6, 0, '', 'algo-note'), slice: V.text(svg, x1 + 6, 0, '', 'algo-note')};
    const notes = [V.text(svg, xm + 6, cy0 + 14, t('judge 换版本', 'judge update'), 'algo-note'), V.text(svg, xm + 6, cy0 + 32, '', 'algo-strong')];
    const put = (r, x, y, w, h, cls) => {
      [['x', x], ['y', y], ['width', Math.max(0, w)], ['height', Math.max(0, h)]].forEach(([k, v]) => r.setAttribute(k, v));
      r.setAttribute('class', 'algo-cell' + (cls ? ' ' + cls : ''));
    };
    return frame => {
      const c = frame.cells, wP = c.p * side, xf = sx + wP + 1, wf = side - wP - 1, judged = Boolean(frame.judged);
      put(box.tp, sx, sy, wP - 1, judged ? frame.s * side - 1 : side, judged ? 'is-look' : '');
      put(box.fn, sx, sy + frame.s * side + 1, wP - 1, (1 - frame.s) * side - 1, judged ? '' : 'is-hidden');
      put(box.fp, xf, sy, wf, judged ? (1 - c.t) * side - 1 : side, judged ? 'is-look' : '');
      put(box.tn, xf, sy + (1 - c.t) * side + 1, wf, c.t * side - 1, judged ? '' : 'is-hidden');
      tpText.setAttribute('x', sx + wP / 2); tpText.setAttribute('y', sy + frame.s * side / 2 + 5);
      tpText.textContent = judged ? four(c.tp) : '';
      fpText.setAttribute('y', sy + (1 - c.t) * side / 2 + 4);
      fpText.textContent = judged ? four(c.fp) : '';
      passText.setAttribute('x', sx + wP / 2); passText.textContent = `${t('合格', 'pass')} ${pct(c.p)}`;
      failText.setAttribute('x', sx + wP + (side - wP) / 2); failText.textContent = `${t('不合格', 'fail')} ${pct(1 - c.p)}`;
      show(legend, judged);

      const view = frame.view, [lo, hi] = scale[view], Y = v => cy0 + (hi - v) / (hi - lo) * ch, st = frame.stage;
      head.textContent = view === 'slice' ? t(`每天的通过率：占流量 ${pct(frame.slice)} 的切片`, `daily pass rate: a ${pct(frame.slice)} slice`) : t('每天的通过率：整体', 'daily pass rate: overall');
      ticks.forEach((node, i) => { const v = tickSets[view][i]; node.textContent = v == null ? '' : pct(v); node.setAttribute('y', v == null ? 0 : Y(v) + 4); });
      const path = (a, b) => `${cx0},${Y(a)} ${xm},${Y(a)} ${xm},${Y(b)} ${x1},${Y(b)}`;
      const after = st === 3 ? frame.p - frame.mdeAll : st >= 4 && st <= 5 ? frame.p - frame.move : st === 6 ? frame.p2 : frame.p;
      trueLine.setAttribute('points', path(frame.p, after));
      ends.truth.setAttribute('y', Y(after) + 4);
      ends.truth.textContent = `${view === 'slice' ? t('整体', 'overall') : t('真实', 'true')} ${pct(after)}`;
      const judgeOn = st === 1 || st === 2 || st === 6, later = st === 6 ? frame.q2 : frame.q;
      show(judgeLine, judgeOn);
      judgeLine.setAttribute('points', path(frame.q, later));
      ends.judge.setAttribute('y', Y(later) + 4);
      ends.judge.textContent = judgeOn ? `judge ${st === 6 ? pt(later) + '%' : pct(later)}` : '';
      show(sliceLine, view === 'slice');
      sliceLine.setAttribute('points', path(frame.sliceFall[0], frame.sliceFall[1]));
      ends.slice.setAttribute('y', Y(frame.sliceFall[1]) + 4);
      ends.slice.textContent = view === 'slice' ? `${t('切片', 'slice')} ${pct(frame.sliceFall[1])}` : '';
      const range = st === 2 || st === 3 ? [frame.pHat - frame.half, frame.pHat + frame.half] : st === 4 ? [frame.lo, frame.hi] : st === 5 ? [frame.sliceFall[0] - frame.sliceHalf, frame.sliceFall[0] + frame.sliceHalf] : null;
      if (range) put(band, cx0 + 1, Y(range[1]), (st === 2 ? cw : cw / 2) - 2, Y(range[0]) - Y(range[1]), '');
      band.setAttribute('class', 'algo-band' + (range ? '' : ' is-hidden'));
      bandText.textContent = st === 2 || st === 3 ? `p̂ ${pct(frame.pHat)} ± ${pt(frame.half)}` : st === 4 ? `${frame.passed}/${frame.sliceN} → ${Math.round(frame.lo * 100)}%–${Math.round(frame.hi * 100)}%`
        : st === 5 ? `p̂ ${pct(frame.sliceFall[0])} ± ${pt(frame.sliceHalf)}` : '';
      if (range) bandText.setAttribute('y', st === 4 ? Y(range[0]) - 8 : st === 5 ? Y(range[1]) - 5 : Y(range[1]) + 13);
      const drop = st === 3 ? [frame.p, frame.p - frame.mdeAll, frame.mdeAll] : st === 5 ? [frame.sliceFall[0], frame.sliceFall[0] - frame.sliceMde, frame.sliceMde] : null;
      show(bracket, Boolean(drop));
      if (drop) {
        const ya = Y(drop[0]), yb = Y(drop[1]);
        bracket.setAttribute('d', `M${xm + 6} ${ya} h8 M${xm + 10} ${ya} V${yb} M${xm + 6} ${yb} h8`);
        bracketText.setAttribute('y', (ya + yb) / 2 + 4);
      }
      bracketText.textContent = drop ? `MDE ${pt(drop[2])}` : '';
      show(marker, st === 6);
      notes.forEach(n => show(n, st === 6));
      notes[1].textContent = `${t('锚点集：', 'anchor set: ')}t ${frame.t} → ${frame.t2}`;
    };
  }});

  FIGURES['step-subagent-timeline'] = name => stepper(name, F.subagentTimeline(), {height: 270, readouts: f => {
    const k = x => `${x}k`, pc = x => `${Math.round(x * 100)}%`;
    if (f.stage === 3) return [[t('单 agent', 'single agent'), `${f.s1}³ = ${f.pSingle.toFixed(3)}`],
      [t(`多 agent，d = ${pc(f.drops[0])}`, `multi, d = ${pc(f.drops[0])}`), f.pMulti[0].toFixed(3), 'good'],
      [t(`多 agent，d = ${pc(f.drops[1])}`, `multi, d = ${pc(f.drops[1])}`), f.pMulti[1].toFixed(3), 'bad'],
      [t('持平点 d*', 'break-even d*'), `≈ ${(f.dStar * 100).toFixed(1)}%`, 'key']];
    const {time, tokens} = f;
    return [
      f.stage === 4 ? [t('墙钟时间（先后依赖）', 'wall clock, sequential'), `${time.single} s → ${time.chained} s`, 'bad']
        : [t('墙钟时间', 'wall clock'), f.stage >= 1 ? `${time.single} s → ${time.parallel} s` : `${time.single} s`, f.stage === 1 ? 'good' : ''],
      [t('Token', 'tokens'), f.stage >= 2 ? `${k(tokens.single)} → ${k(tokens.multi)}` + t(`（+${pc(f.rise)}）`, ` (+${pc(f.rise)})`) : k(tokens.single), f.stage === 2 ? 'bad' : ''],
      [t('最长上下文', 'longest context'), f.stage >= 2 ? `${k(tokens.single)} → ${k(tokens.sub)}` : k(tokens.single), f.stage === 2 ? 'good' : '']];
  }, setup(svg) {
    const first = F.subagentTimeline()[0], X = sec => 100 + 3 * sec, bh = 22, axisY = 212, k = x => `${x}k`, pc = x => `${Math.round(x * 100)}%`;
    const top = {single: 34, lead: 88};
    first.names.forEach((n, i) => { top[n] = 118 + 30 * i; });
    const laneText = [['single', t('单 agent', 'single agent')], ['lead', t('协调者', 'lead')], ...first.names.map(n => [n, t(`子 agent ${n}`, `sub ${n}`)])]
      .map(([lane, label]) => ({lane, node: V.text(svg, 16, top[lane] + 15, label, 'algo-head')}));
    svg.append(s('line', {x1: X(0), y1: axisY, x2: X(170), y2: axisY, class: 'algo-edge'}));
    for (let sec = 0; sec <= 160; sec += 20) {
      svg.append(s('line', {x1: X(sec), x2: X(sec), y1: axisY, y2: axisY + 4, class: 'algo-edge'}));
      V.text(svg, X(sec), axisY + 17, String(sec), 'algo-idx', 'middle');
    }
    V.text(svg, X(170), axisY + 17, t('秒', 's'), 'algo-idx', 'middle');
    [['is-look', t('工具调用（10 秒）', 'tool call (10 s)')], ['is-change', t('规划、汇总、写答案（各 10 秒）', 'plan, synthesise, answer (10 s each)')]].forEach(([cls, label], i) => {
      svg.append(s('rect', {x: X(0) + i * 170, y: axisY + 30, width: 14, height: 14, rx: 3, class: 'algo-cell ' + cls}));
      V.text(svg, X(0) + i * 170 + 20, axisY + 42, label, 'algo-note');
    });
    const layer = (list, ghost) => {
      const g = s('g');
      list.forEach(b => g.append(s('rect', {x: X(b.start) + 1.5, y: top[b.lane], width: 3 * (b.end - b.start) - 3, height: bh, rx: 4,
        class: 'algo-cell ' + (ghost ? 'algo-ghost' : b.kind === 'tool' ? 'is-look' : 'is-change')})));
      svg.append(g);
      return g;
    };
    const single = layer(first.single), ghost = layer(first.parallel, true), parallel = layer(first.parallel), chained = layer(first.chained);
    const ends = Object.fromEntries(Object.keys(top).map(lane => [lane, V.text(svg, 0, top[lane] + 15, '', 'algo-note')]));
    const marker = s('line', {x1: X(first.time.parallel), x2: X(first.time.parallel), y1: top.lead - 6, y2: axisY, class: 'algo-edge algo-dash'});
    svg.append(marker);
    const markerText = V.text(svg, X(first.time.parallel), top.lead - 12, t(`并行时 ${first.time.parallel} 秒`, `${first.time.parallel} s in parallel`), 'algo-note', 'middle');
    const inset = s('g'), ix = 290, barX = 496, barW = 100;
    inset.append(s('rect', {x: ix, y: top.lead - 6, width: 320, height: axisY - top.lead - 2, rx: 8, class: 'algo-cell'}));
    V.text(inset, ix + 12, top.lead + 14, t('三个事实都保住的概率', 'chance all three facts survive'), 'algo-head');
    [[t('单 agent', 'single'), first.pSingle, ''], ...first.drops.map((d, i) => [t(`多 agent，d = ${pc(d)}`, `multi, d = ${pc(d)}`), first.pMulti[i], first.pMulti[i] > first.pSingle ? 'is-keep' : 'is-bad'])]
      .forEach(([label, value, cls], i) => {
        const y = top.lead + 38 + i * 26;
        V.text(inset, ix + 12, y, label, 'algo-note');
        V.text(inset, barX - 8, y, value.toFixed(3), 'algo-strong', 'end');
        inset.append(s('rect', {x: barX, y: y - 11, width: value * barW, height: 14, rx: 3, class: 'algo-cell ' + cls}));
      });
    inset.append(s('line', {x1: barX + first.pSingle * barW, x2: barX + first.pSingle * barW, y1: top.lead + 20, y2: top.lead + 98, class: 'algo-edge algo-dash'}));
    svg.append(inset);
    return frame => {
      const st = frame.stage, {time, tokens} = frame;
      show(parallel, st >= 1 && st <= 3); show(ghost, st === 4); show(chained, st === 4);
      [single, parallel].forEach(g => g.classList.toggle('is-out', st === 3));
      laneText.forEach(({lane, node}) => node.classList.toggle('is-dim', st === 0 && lane !== 'single'));
      show(inset, st === 3); show(marker, st === 4); show(markerText, st === 4);
      const label = (lane, sec, text) => { ends[lane].setAttribute('x', X(sec) + 6); ends[lane].textContent = text; };
      Object.values(ends).forEach(node => { node.textContent = ''; });
      if (st === 0) label('single', time.single, `${time.single} s · ${k(tokens.single)}`);
      if (st === 1 || st === 4) label('single', time.single, `${time.single} s`);
      if (st === 1) label('lead', time.parallel, `${time.parallel} s`);
      if (st === 4) label('lead', time.chained, `${time.chained} s`);
      if (st === 2) {
        label('single', time.single, k(tokens.single));
        label('lead', time.parallel, k(tokens.lead));
        frame.names.forEach(n => label(n, Math.max(...frame.parallel.filter(b => b.lane === n).map(b => b.end)), k(tokens.sub)));
      }
    };
  }});

  for (const [name, build] of Object.entries(FIGURES)) build(name);
})(typeof window === 'undefined' ? globalThis : window);
