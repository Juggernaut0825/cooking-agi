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

  for (const [name, build] of Object.entries(FIGURES)) build(name);
})(typeof window === 'undefined' ? globalThis : window);
