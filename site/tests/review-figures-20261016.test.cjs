const test = require('node:test');
const assert = require('node:assert/strict');
const {F} = require('../static/figure-lab.js');

test('verifier and planning captions retain their toy-model conditions', () => {
  const verifier = F.verifierCeiling();
  assert.match(verifier[2].en, /not guaranteed post-training accuracy/);
  assert.match(verifier[2].zh, /不是微调后模型准确率的保证/);
  assert.match(verifier[4].en, /exact-copy assumption/);
  assert.match(verifier[5].en, /accepting every correct solution/);
  const planning = F.trajectoryCost().at(-1);
  assert.match(planning.zh, /打平/);
  assert.match(planning.en, /tie-breaking rule/);
});

test('multi-agent figure states its timing, token, and independence assumptions', () => {
  const frames = F.subagentTimeline();
  assert.deepEqual(frames[0].time, {single: 130, parallel: 60, chained: 160});
  assert.match(frames[1].zh, /不计.*摘要/);
  assert.match(frames[1].en, /Summary-generation time is omitted/);
  assert.match(frames[2].zh, /不是累计 API 计费/);
  assert.match(frames[2].en, /not cumulative API billing/);
  assert.match(frames[3].zh, /独立.*概率相同/);
  assert.match(frames[3].en, /independent, identically distributed/);
  assert.match(frames[3].zh, /条件概率/);
  assert.match(frames[3].en, /conditional probability/);
});
