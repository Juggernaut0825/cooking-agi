const test = require('node:test');
const assert = require('node:assert/strict');
const {constrain, fit, zoom, focus} = require('../static/world-grove.js');

const viewport = {width:1000, height:600};
const scene = {width:1400, height:2600};

test('fit shows the entire scene with a margin', () => {
  const camera = fit(viewport, scene);
  assert.ok(camera.x >= 0 && camera.y >= 0);
  assert.ok(camera.x + scene.width * camera.scale <= viewport.width);
  assert.ok(camera.y + scene.height * camera.scale <= viewport.height);
});

test('zoom keeps the point under the cursor when not constrained', () => {
  const camera = {scale:1, x:-200, y:-500};
  const point = {x:400, y:250};
  const result = zoom(camera, 1.35, point, viewport, scene);
  assert.ok(Math.abs((point.x - result.x) / result.scale - (point.x - camera.x) / camera.scale) < 1e-9);
  assert.ok(Math.abs((point.y - result.y) / result.scale - (point.y - camera.y) / camera.scale) < 1e-9);
});

test('pan cannot lose the tree beyond the viewport', () => {
  assert.deepEqual(constrain({scale:1, x:1e6, y:-1e6}, viewport, scene), {scale:1, x:70, y:-2070});
});

test('zoom limits are finite and reversible', () => {
  const camera = {scale:1, x:-200, y:-500};
  const point = {x:400, y:250};
  const result = zoom(zoom(camera, 1.35, point, viewport, scene), 1 / 1.35, point, viewport, scene);
  assert.ok(Math.abs(result.scale - 1) < 1e-9);
  assert.ok(Math.abs(result.x - camera.x) < 1e-9);
  assert.equal(zoom(camera, 100, point, viewport, scene).scale, 3);
  assert.equal(zoom(camera, .001, point, viewport, scene).scale, .12);
});

test('focus makes a mobile milestone readable without fitting a long tree', () => {
  const mobile = {width:360, height:480};
  const point = {x:350, y:2200};
  const result = focus(point, mobile, scene);
  assert.ok(result.scale >= .72);
  assert.ok(Math.abs(point.x * result.scale + result.x - mobile.width / 2) < 1);
  assert.ok(Math.abs(point.y * result.scale + result.y - mobile.height / 2) < 1);
});
