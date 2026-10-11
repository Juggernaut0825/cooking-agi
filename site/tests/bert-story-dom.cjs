const assert = require("node:assert/strict");

function decodeText(value) {
  const entities = {amp: "&", lt: "<", gt: ">", quot: '"', apos: "'"};
  return value.replace(/&([\w#]+);/g, (entity, name) => {
    assert.ok(Object.hasOwn(entities, name), `Unsupported entity: ${entity}`);
    return entities[name];
  });
}

class StoryElement {
  constructor(tagName, attributes = []) {
    this.tagName = tagName;
    this.attributes = new Map(attributes);
    this.children = [];
    this.parentElement = null;
    this.listeners = new Map();
    this.dataset = new Proxy({}, {
      get: (target, key) => this.getAttribute(`data-${key}`) ?? undefined,
      set: (target, key, value) => { this.setAttribute(`data-${key}`, value); return true; }
    });
    this.classList = {
      contains: name => (this.getAttribute("class") || "").split(/\s+/).includes(name),
      toggle: (name, force) => {
        const names = new Set((this.getAttribute("class") || "").split(/\s+/).filter(Boolean));
        const enabled = force === undefined ? !names.has(name) : Boolean(force);
        if (enabled) names.add(name);
        else names.delete(name);
        this.setAttribute("class", [...names].join(" "));
        return enabled;
      }
    };
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  get hidden() { return this.hasAttribute("hidden"); }
  set hidden(value) { if (value) this.setAttribute("hidden", ""); else this.attributes.delete("hidden"); }
  get disabled() { return this.hasAttribute("disabled"); }
  set disabled(value) { if (value) this.setAttribute("disabled", ""); else this.attributes.delete("disabled"); }
  get textContent() {
    return this.children.map(child => typeof child === "string" ? child : child.textContent).join("");
  }
  set textContent(value) { this.replaceChildren([String(value)]); }

  replaceChildren(children) {
    for (const child of this.children) {
      if (typeof child !== "string") child.parentElement = null;
    }
    this.children = children;
    for (const child of children) {
      if (typeof child !== "string") child.parentElement = this;
    }
  }

  set innerHTML(markup) {
    const fragment = new StoryElement("fragment");
    const stack = [fragment];
    const tokens = /<\/?[a-z][^<>]*>|[^<]+/gy;
    let offset = 0;
    while (offset < markup.length) {
      const token = tokens.exec(markup);
      assert.ok(token, `Unsupported BERT markup at ${offset}`);
      offset = tokens.lastIndex;
      const value = token[0];
      if (value.startsWith("</")) {
        assert.ok(stack.length > 1, `Unexpected closing tag: ${value}`);
        assert.equal(value, `</${stack.pop().tagName}>`, "Unbalanced BERT markup");
      } else if (value.startsWith("<")) {
        const tag = /^<([a-z][\w-]*)([\s\S]*?)(\/?)>$/.exec(value);
        assert.ok(tag, `Unsupported tag: ${value}`);
        const attributes = [];
        const attributePattern = /\s+([\w:-]+)(?:="([^"]*)")?/gy;
        const attributeSource = tag[2].trimEnd();
        let attributeOffset = 0;
        while (attributeOffset < attributeSource.length) {
          const attribute = attributePattern.exec(attributeSource);
          assert.ok(attribute, `Unsupported attributes: ${attributeSource}`);
          attributes.push([attribute[1], decodeText(attribute[2] || "")]);
          attributeOffset = attributePattern.lastIndex;
        }
        const element = new StoryElement(tag[1], attributes);
        element.parentElement = stack.at(-1);
        stack.at(-1).children.push(element);
        if (!tag[3]) stack.push(element);
      } else {
        stack.at(-1).children.push(decodeText(value));
      }
    }
    assert.equal(stack.length, 1, "Unclosed BERT markup");
    this.replaceChildren(fragment.children);
  }

  matches(selector) {
    const match = /^(?:([a-z][\w-]*))?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/.exec(selector);
    assert.ok(match && (match[1] || match[2]), `Unsupported selector: ${selector}`);
    return (!match[1] || this.tagName === match[1]) &&
      (!match[2] || (this.hasAttribute(match[2]) &&
        (match[3] === undefined || this.getAttribute(match[2]) === match[3])));
  }

  querySelectorAll(selector) {
    this.matches(selector);
    const matches = [];
    for (const child of this.children) {
      if (typeof child === "string") continue;
      if (child.matches(selector)) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) {
    if (this.matches(selector)) return this;
    return this.parentElement?.closest(selector) || null;
  }
  contains(element) {
    return Boolean(element && (element === this || this.contains(element.parentElement)));
  }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  dispatch(name, event) {
    for (const listener of this.listeners.get(name) || []) listener(event);
  }
  click() {
    if (this.closest("button")?.disabled) return;
    assert.equal(this.closest("[hidden]"), null, "Cannot click a hidden BERT control");
    for (let element = this; element; element = element.parentElement) {
      element.dispatch("click", {target: this});
    }
  }
}

const fixture = new StoryElement("div");
fixture.innerHTML = '<button data-token="2" aria-pressed="false"><span data-token-label>tea &amp; cold</span></button>';
const label = fixture.querySelector("[data-token-label]");
assert.equal(label.textContent, "tea & cold");
assert.equal(label.closest("button").dataset.token, "2");
assert.equal(fixture.querySelector('[data-token="2"]'), label.parentElement);
assert.equal(label.querySelector("[data-token]"), null);
assert.equal(fixture.querySelector("[missing]"), null);
assert.deepEqual(fixture.querySelectorAll("[missing]"), []);
assert.equal(fixture.contains(label), true);
assert.equal(fixture.contains(new StoryElement("button")), false);
let clicks = 0;
fixture.addEventListener("click", event => { assert.equal(event.target, label); clicks += 1; });
label.click();
label.parentElement.disabled = true;
label.click();
assert.equal(clicks, 1);
fixture.innerHTML = "";
assert.equal(fixture.querySelector("button"), null);
assert.equal(fixture.contains(label), false);
assert.throws(() => fixture.querySelector(".unsupported > selector"), /Unsupported selector/);
assert.throws(() => { fixture.innerHTML = "<button><span></button>"; }, /Unbalanced/);

module.exports = {StoryElement};
