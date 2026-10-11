const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {StoryElement} = require("./bert-story-dom.cjs");
const {storyState} = require("../static/bert-story.js");

const initial = storyState();
assert.deepEqual(initial.inputs, ["[CLS]", "the", "[MASK]", "is", "cold", "[SEP]"]);
assert.deepEqual(initial.outputs, [2]);
assert.equal(initial.query, 2);

for (const step of [0, 1, 2, 3]) {
  for (const query of [0, 1, 2, 3, 4, 5]) {
    for (const task of ["mlm", "classify", "tag"]) {
      const state = storyState(step, task, query);
      assert.equal(state.step, step);
      assert.equal(state.query, query);
      assert.equal(state.inputs[2], task === "mlm" ? "[MASK]" : "tea");
      assert.equal(state.inputs[4], "cold");
      assert.deepEqual(state.positions, [0, 1, 2, 3, 4, 5]);
      assert.deepEqual(state.segments, [0, 0, 0, 0, 0, 0]);
      assert.deepEqual(state.visible, [0, 1, 2, 3, 4, 5]);
      assert.deepEqual(state.outputs, {mlm: [2], classify: [0], tag: [1, 2, 3, 4]}[task]);
    }
  }
}

initial.inputs[2] = "changed";
initial.outputs.push(0);
assert.equal(storyState().inputs[2], "[MASK]");
assert.deepEqual(storyState().outputs, [2]);

for (const args of [[-1], [4], [0.5], [NaN], [0, "unknown"], [0, "mlm", -1],
                    [0, "mlm", 6], [0, "mlm", 1.5], ["0"], [0, "mlm", "4"]]) {
  assert.throws(() => storyState(...args), RangeError);
}
const source = fs.readFileSync(path.join(__dirname, "../static/bert-story.js"), "utf8");

function renderedStories(languages, withObserver = true) {
  const document = new StoryElement("document");
  document.innerHTML = languages.map(language => `<div data-bert-story data-lang="${language}"></div>`).join("");
  const timers = new Map();
  const observers = [];
  let nextTimer = 1;
  const context = {
    document,
    setInterval(callback, delay) {
      assert.equal(delay, 3200);
      const timer = nextTimer++;
      timers.set(timer, callback);
      return timer;
    },
    clearInterval(timer) { timers.delete(timer); }
  };
  if (withObserver) {
    context.IntersectionObserver = class {
      constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
      observe(target) { this.targets.add(target); }
    };
  }
  vm.runInNewContext(source, context);
  return {
    document, timers, observers,
    tick() {
      for (const [timer, callback] of [...timers]) {
        if (timers.has(timer)) callback();
      }
    },
    visibility(hidden) {
      document.hidden = hidden;
      document.dispatch("visibilitychange", {});
    },
    intersection(root, isIntersecting) {
      const matches = observers.filter(observer => observer.targets.has(root));
      assert.equal(matches.length, 1, "Each BERT root must be observed once");
      matches[0].callback([{target: root, isIntersecting}]);
    },
    stories: document.querySelectorAll("[data-bert-story]").map(root => {
      const node = selector => {
        const matches = root.querySelectorAll(selector);
        assert.equal(matches.length, 1, `Expected one generated BERT node: ${selector}`);
        return matches[0];
      };
      return {
        root, node,
        read: selector => node(selector).textContent,
        token: index => node(`[data-token="${index}"]`).querySelector("[data-token-label]").textContent,
        click(key, value) { node(value === undefined ? `[data-${key}]` : `[data-${key}="${value}"]`).click(); }
      };
    })
  };
}

function assertPressed(story, key, selected) {
  for (const button of story.root.querySelectorAll(`[data-${key}]`)) {
    assert.equal(button.getAttribute("aria-pressed"), String(button.dataset[key] === String(selected)));
  }
}

function assertStep(story, step) {
  assert.equal(story.root.dataset.step, String(step));
  assert.equal(story.read("[data-step-number]"), `0${step + 1}`);
  assertPressed(story, "step", step);
  assert.equal(story.node("[data-previous]").disabled, step === 0);
  assert.equal(story.node("[data-next]").disabled, step === 3);
  assert.equal(story.node("[data-tasks]").hidden, step !== 3);
  assert.equal(story.node("[data-vector-inspector]").hidden, step !== 1);
}

function assertOutputs(story, expected) {
  const outputs = story.root.querySelectorAll("[data-hidden]")
    .filter(element => element.classList.contains("is-output")).map(element => Number(element.dataset.hidden));
  assert.deepEqual(outputs, expected);
}

function assertConnections(story, query = null) {
  const connections = story.node("[data-connections]");
  const paths = connections.querySelectorAll("path");
  const circles = connections.querySelectorAll("circle");
  assert.equal(paths.length, 6);
  assert.equal(circles.length, 6);
  paths.forEach((element, index) => {
    const start = 50 + index * 100;
    const end = query === null ? start : 50 + query * 100;
    assert.equal(element.getAttribute("d"), `M ${start} 0 C ${start} 38, ${end} 38, ${end} 76`);
    assert.equal(circles[index].getAttribute("cx"), String(start));
    assert.equal(circles[index].getAttribute("cy"), "0");
  });
}

for (const language of ["en", "zh"]) {
  const page = renderedStories([language]);
  const story = page.stories[0];
  for (const [key, values] of [["step", [0, 1, 2, 3]], ["token", [0, 1, 2, 3, 4, 5]],
                              ["hidden", [0, 1, 2, 3, 4, 5]], ["task", ["mlm", "classify", "tag"]]]) {
    assert.deepEqual(story.root.querySelectorAll(`[data-${key}]`).map(node => node.dataset[key]), values.map(String));
  }
  assert.equal(story.root.querySelectorAll("button").length, 16);
  for (const button of story.root.querySelectorAll("button")) {
    assert.equal(button.getAttribute("type"), "button");
    assert.ok(button.textContent.trim());
  }
  assert.equal(story.root.querySelector("[missing]"), null);
  assert.deepEqual(story.root.querySelectorAll("[missing]"), []);
  const panel = story.node('[id="bert-story-panel-0"]');
  assert.equal(panel.getAttribute("aria-live"), "polite");
  assert.equal(panel.getAttribute("aria-atomic"), "true");
  for (const button of story.root.querySelectorAll("[data-step]")) {
    assert.equal(button.getAttribute("aria-controls"), panel.getAttribute("id"));
  }
  for (const group of story.root.querySelectorAll('[role="group"]')) {
    assert.ok(group.getAttribute("aria-label"));
  }
  assert.equal(story.root.querySelectorAll('[role="group"]').length, 2);
  assert.equal(story.node("[data-connections]").getAttribute("aria-hidden"), "true");
  assert.equal(story.node("[data-connections]").getAttribute("focusable"), "false");
  assertStep(story, 0);
  assertPressed(story, "token", 2);
  assertPressed(story, "task", "mlm");
  assertOutputs(story, [2]);
  assertConnections(story);
  const inputs = ["[CLS]", "the", "[MASK]", "is", "cold", "[SEP]"];
  inputs.forEach((input, index) => {
    assert.equal(story.token(index), input);
    assert.equal(story.node(`[data-token="${index}"]`).getAttribute("aria-label"),
      `${language === "en" ? "Trace context for" : "查看上下文读取路径"} ${input} (${index})`);
    assert.equal(story.node(`[data-token="${index}"]`).classList.contains("is-masked"), index === 2);
  });
  const initialExplanation = story.read("[data-explanation]");
  story.node("[data-explanation]").click();
  assertStep(story, 0);
  assert.equal(story.read("[data-explanation]"), initialExplanation);
  const foreign = new StoryElement("button", [["data-step", "3"]]);
  story.root.dispatch("click", {target: foreign});
  assertStep(story, 0);

  story.node('[data-step="1"]').querySelector("span").click();
  assertStep(story, 1);
  story.node('[data-token="4"]').querySelector("[data-token-label]").click();
  assertStep(story, 1);
  assertPressed(story, "token", 4);
  assert.match(story.read("[data-explanation]"), /4/);
  const vectors = story.node("[data-vector-inspector]").querySelectorAll("span");
  assert.equal(vectors.length, 3);
  assert.ok(vectors[0].textContent.startsWith("cold"));
  assert.ok(vectors[1].textContent.startsWith("4"));
  assert.ok(vectors[2].textContent.startsWith("A"));
  story.click("next");
  assertStep(story, 2);
  for (const query of [0, 1, 2, 3, 4, 5]) {
    story.node(`[data-token="${query}"]`).querySelector("[data-token-label]").click();
    assertStep(story, 2);
    assertPressed(story, "token", query);
    assertOutputs(story, [query]);
    assertConnections(story, query);
    assert.equal(story.read("[data-trace]"), `${language === "en" ? "Selected query" : "正在看"}: ${inputs[query]}`);
    assert.ok(story.read("[data-explanation]").includes(inputs[query]));
    assert.equal(story.read("[data-connection-caption]"), language === "en" ? "can read both sides" : "左右两边都能读");
  }
  story.click("step", 0);
  story.click("token", 4);
  assertStep(story, 2);
  assertPressed(story, "token", 4);
  story.click("step", 0);
  const originalTitle = story.read("[data-explanation-title]");
  assert.match(originalTitle, /tea/);
  for (const task of ["classify", "tag"]) {
    story.click("step", 3);
    story.click("task", task);
    assertStep(story, 3);
    assertPressed(story, "task", task);
    assertPressed(story, "token", task === "classify" ? 0 : 2);
    assertOutputs(story, task === "classify" ? [0] : [1, 2, 3, 4]);
    assert.equal(story.node('[data-token="2"]').classList.contains("is-masked"), false);
    assert.match(story.read("[data-head-output]"), task === "classify" ? /h₀/ : /h₁.*h₄/);
    story.click("step", 0);
    assert.equal(story.token(2), "tea");
    assert.equal(story.read("[data-explanation-title]"), language === "en"
      ? "Start with the complete sentence" : "把完整句子交给模型");
    assert.match(story.read("[data-explanation]"), language === "en" ? /complete sentence/ : /完整句子/);
    assert.equal(story.read("[data-head-name]"), language === "en"
      ? {classify: "Classification head", tag: "Token-label head"}[task]
      : {classify: "分类输出层", tag: "逐词标注输出层"}[task]);
    story.click("step", 3);
    story.click("task", "mlm");
    assertPressed(story, "task", "mlm");
    assertPressed(story, "token", 2);
    assertOutputs(story, [2]);
    assert.equal(story.node('[data-token="2"]').classList.contains("is-masked"), true);
    assert.match(story.read("[data-head-output]"), /h₂.*tea/);
    story.click("step", 0);
    assert.equal(story.token(2), "[MASK]");
    assert.equal(story.read("[data-explanation-title]"), originalTitle);
    assert.match(story.read("[data-explanation]"), /\[MASK\]/);
  }

  story.click("previous");
  assertStep(story, 0);
  for (const step of [1, 2, 3]) { story.click("next"); assertStep(story, step); }
  story.click("next");
  assertStep(story, 3);
  for (const step of [2, 1, 0]) { story.click("previous"); assertStep(story, step); }

  const play = language === "en" ? "Play walkthrough" : "播放一遍";
  const pause = language === "en" ? "Pause" : "暂停";
  story.click("step", 3);
  story.click("play");
  assertStep(story, 0);
  assert.equal(page.timers.size, 1);
  assert.equal(story.read("[data-play]"), pause);
  page.visibility(false);
  page.intersection(story.root, true);
  assert.equal(page.timers.size, 1);
  for (const step of [1, 2, 3]) {
    page.tick();
    assertStep(story, step);
    assert.equal(page.timers.size, step === 3 ? 0 : 1);
    assert.equal(story.read("[data-play]"), step === 3 ? play : pause);
  }
  page.tick();
  assertStep(story, 3);
  story.click("play");
  page.tick();
  story.click("play");
  assert.equal(page.timers.size, 0);
  assert.equal(story.read("[data-play]"), play);
  page.tick();
  assertStep(story, 1);

  for (const control of [["step", 2], ["token", 4], ["previous"], ["next"]]) {
    story.click("play");
    if (control[0] === "previous") { page.tick(); page.tick(); }
    story.click(...control);
    assert.equal(page.timers.size, 0, `${control[0]} must stop playback`);
    assert.equal(story.read("[data-play]"), play);
    const stoppedStep = story.root.dataset.step;
    page.tick();
    assert.equal(story.root.dataset.step, stoppedStep);
  }

  for (const stop of [() => page.visibility(true), () => page.intersection(story.root, false)]) {
    story.click("play");
    page.tick();
    assertStep(story, 1);
    stop();
    assert.equal(page.timers.size, 0);
    assert.equal(story.read("[data-play]"), play);
    page.visibility(false);
    page.intersection(story.root, true);
    page.tick();
    assertStep(story, 1);
    assert.equal(page.timers.size, 0, "Visibility restoration must not auto-restart playback");
  }
}

const multiple = renderedStories(["en", "zh"]);
const [english, chinese] = multiple.stories;
assert.equal(english.node('[data-step="0"]').getAttribute("aria-controls"), "bert-story-panel-0");
assert.equal(chinese.node('[data-step="0"]').getAttribute("aria-controls"), "bert-story-panel-1");
assert.equal(multiple.document.querySelectorAll('[id="bert-story-panel-0"]').length, 1);
assert.equal(multiple.document.querySelectorAll('[id="bert-story-panel-1"]').length, 1);
english.click("token", 4);
assertStep(english, 2);
assertStep(chinese, 0);
assertPressed(chinese, "token", 2);
english.click("play");
chinese.click("play");
assert.equal(multiple.timers.size, 2);
multiple.intersection(chinese.root, true);
assert.equal(multiple.timers.size, 2);
multiple.intersection(english.root, false);
assert.equal(multiple.timers.size, 1);
multiple.tick();
assertStep(english, 0);
assertStep(chinese, 1);
assert.equal(english.read("[data-play]"), "Play walkthrough");
assert.equal(chinese.read("[data-play]"), "暂停");
english.click("play");
multiple.visibility(true);
assert.equal(multiple.timers.size, 0);
assert.equal(chinese.read("[data-play]"), "播放一遍");

const fallback = renderedStories(["en"], false);
fallback.stories[0].click("play");
fallback.tick();
assertStep(fallback.stories[0], 1);
fallback.visibility(true);
assert.equal(fallback.timers.size, 0);
const empty = renderedStories([]);
assert.equal(empty.timers.size, 0);
assert.equal(empty.observers.length, 0);
assert.equal(empty.document.listeners.size, 0);
process.stdout.write("BERT walkthrough: 72 valid states, bilingual generated markup, token/task controls, accessibility attributes, playback, visibility, intersection, and instance isolation pass\n");
