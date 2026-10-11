const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {createRequire} = require("node:module");

const testPath = path.join(__dirname, "bert-story-behavior.cjs");
const runtimePath = path.join(__dirname, "../static/bert-story.js");
const original = fs.readFileSync(runtimePath, "utf8");
const behavior = fs.readFileSync(testPath, "utf8");
const localRequire = createRequire(testPath);

function run(runtime) {
  const interceptedFilesystem = {
    ...fs,
    readFileSync(filename, ...args) {
      return path.resolve(String(filename)) === path.resolve(runtimePath)
        ? runtime : fs.readFileSync(filename, ...args);
    }
  };
  const runTest = new Function("require", "__dirname", "process", behavior);
  runTest(name => name === "node:fs" ? interceptedFilesystem : localRequire(name),
    __dirname, {stdout: {write() {}}});
}

run(original);
process.stdout.write("PASS unchanged runtime against generated-markup harness\n");
const mutations = [
  ["empty root markup", /root\.innerHTML = `[\s\S]*?`;/, 'root.innerHTML = "";'],
  ["missing token label", 'data-token-label></span>', 'data-missing-label></span>'],
  ["missing token controls", 'data-token="${index}"', 'data-missing-token="${index}"'],
  ["missing task controls", 'data-task="${value}"', 'data-missing-task="${value}"'],
  ["missing play control", '<button type="button" data-play>${text.play}</button>', ""],
  ["broken token render selector", 'querySelectorAll("[data-token]")', 'querySelectorAll("[data-missing-token]")'],
  ["broken delegated event", 'root.addEventListener("click"', 'root.addEventListener("unused-click"'],
  ["token click ignores selection", 'query = Number(control.dataset.token);', 'query = 2;'],
  ["task click ignores selection", 'task = control.dataset.task;', 'task = "mlm";'],
  ["classification query reset missing", 'query = task === "classify" ? 0 : 2;', 'query = 2;'],
  ["context connections ignore query", 'const end = step === 2 ? 50 + query * 100 : start;', 'const end = start;'],
  ["output highlights missing", 'element.classList.toggle("is-output",', 'element.classList.toggle("not-output",'],
  ["broken accessible panel relation", 'aria-controls="${panelId}"', 'aria-controls="missing-panel"'],
  ["live-region semantics missing", 'aria-live="polite"', 'data-not-live="polite"'],
  ["timer is never cleared", 'if (timer !== null) clearInterval(timer);', ""],
  ["manual controls do not stop playback", '} else {\n        stop();', '} else {'],
  ["playback never stops at final step", 'if (step === 3) stop();', ""],
  ["hidden document does not stop playback", 'if (document.hidden) stop();', ""],
  ["offscreen widget does not stop playback", 'if (!entries[0].isIntersecting) stop();', ""],
  ["second widget is not observed", ').observe(root);', ').observe(instance === 0 ? root : document);']
];

for (const [name, search, replacement] of mutations) {
  const mutated = original.replace(search, replacement);
  assert.notEqual(mutated, original, `Stale mutation: ${name}`);
  let failure;
  try { run(mutated); } catch (error) { failure = error; }
  assert.ok(failure, `MUTATION SURVIVED: ${name}`);
  assert.ok(["AssertionError", "TypeError"].includes(failure.name),
    `Unexpected failure for ${name}: ${failure.stack}`);
  process.stdout.write(`KILLED ${name}: ${failure.name}: ${failure.message.split("\n")[0]}\n`);
}
process.stdout.write(`BERT mutation checks: ${mutations.length}/${mutations.length} rejected\n`);
