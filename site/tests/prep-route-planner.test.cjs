const assert = require('node:assert/strict');
const test = require('node:test');
const planner = require('../static/prep-route-planner.js');
const noteId = 'note-0123456789abcdef';
const second = 'note-fedcba9876543210';
const third = 'note-1111111111111111';
const steps = [noteId, second, third].map((noteId, index) => ({exerciseId: 'exercise-test-' + index, noteId, title: 'Exercise ' + index, minutes: 25 + index * 10}));

test('different exercises can share one chapter without being collapsed', () => {
  const shared = steps.map(step => ({...step, noteId}));
  assert.equal(planner.selected(planner.draft(shared, '2026-10-12', {})).length, 3);
  const existing = {saved: {noteId, exerciseId: steps[0].exerciseId, status: 'planned'}};
  assert.equal(planner.selected(planner.draft(shared, '2026-10-12', existing)).length, 2);
});

test('draft spaces sessions without changing the source or existing progress', () => {
  const before = JSON.stringify(steps);
  const rows = planner.draft(steps, '2026-10-31', {});
  assert.deepEqual(rows.map(row => row.date), ['2026-10-31', '2026-11-02', '2026-11-04']);
  assert.equal(JSON.stringify(steps), before);
  assert.equal(planner.selected(rows).length, 3);
});

test('existing note sessions are skipped across languages; cancelled ones are available', () => {
  const sessions = {one: {noteId, title: '另一种语言', status: 'done'}, two: {noteId: second, status: 'cancelled'}};
  const before = JSON.stringify(sessions);
  const rows = planner.draft(steps, '2028-02-28', sessions);
  assert.equal(rows[0].selected, false);
  assert.deepEqual(planner.selected(rows).map(row => row.date), ['2028-02-28', '2028-03-01']);
  assert.equal(JSON.stringify(sessions), before);
});

test('dates and focus budgets can vary independently', () => {
  const rows = planner.draft(steps, '2026-10-12', {});
  rows[0].minutes = 10;
  rows[1].selected = false;
  rows[2].date = '2026-11-20';
  rows[2].minutes = 60;
  assert.deepEqual(planner.selected(rows).map(row => row.minutes), [10, 60]);
});

test('invalid dates, duplicate steps and oversized drafts fail before saving', () => {
  for (const date of ['2026-02-29', '2026-04-31', '', '2201-01-01']) assert.equal(planner.validDate(date), false);
  assert.equal(planner.validDate('2028-02-29'), true);
  assert.throws(() => planner.draft([steps[0], steps[0]], '2026-10-12', {}));
  assert.throws(() => planner.draft(steps, '2200-12-31', {}));
  assert.throws(() => planner.draft(Array(25).fill(steps[0]), '2026-10-12', {}));
});

test('no selection or invalid selected duration cannot be committed', () => {
  const rows = planner.draft(steps, '2026-10-12', {});
  for (const minutes of [0, -1, 2.5, 1441, NaN]) {
    rows[0].minutes = minutes;
    assert.throws(() => planner.selected(rows));
  }
  rows.forEach(row => { row.selected = false; });
  assert.throws(() => planner.selected(rows));
});

test('an unchecked invalid field is ignored and a skipped duplicate cannot be reselected', () => {
  const rows = planner.draft(steps, '2026-10-12', {existing: {noteId, status: 'planned'}});
  rows[0].selected = true;
  rows[1].selected = false;
  rows[1].date = '';
  assert.deepEqual(planner.selected(rows).map(row => row.noteId), [third]);
});
