import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../mods/notes/main.js", import.meta.url), "utf8")
  .replace(/^import .*;\n/gm, "").replace("export default class Notes", "class Notes");

function setup(store = new Map()) {
  let active = { id: "one", name: "First space", active: true };
  const tasks = [];
  const cx = { notify() {}, spawn(fn) { tasks.push(fn(cx)); } };
  const chain = () => new Proxy({}, { get: () => () => chain() });
  const context = vm.createContext({
    View: class {}, div: chain, svg: chain, v_flex: chain, h_flex: chain,
    TextView: { markdown: chain }, Editor: { new: chain },
    EditorState: { new: ({ value }) => ({
      text: value, handlers: {}, value() { return this.text; },
      on(event, handler) { this.handlers[event] = handler; },
    }) },
    localStorage: {
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value), flush: async () => {},
    },
    spaces: () => [active], settings: () => ({}), theme: () => ({}), run() {},
  });
  const Notes = vm.runInContext(`${source}\nNotes`, context);
  const view = new Notes();
  view.init();
  return { view, cx, store, tasks, select(id) { active = { id, name: id, active: true }; } };
}

test("autosaves Markdown, restores on a fresh instance, and keeps spaces separate", async () => {
  const app = setup();
  const first = app.view.pads.get("one");
  first.editor.text = "# Plan\n- [ ] Write notes\n- [x] Add sidebar\n";
  first.editor.handlers.change({}, app.cx);
  await Promise.all(app.tasks);
  assert.equal(first.status, "Autosaved locally");
  assert.equal(app.store.get("space:one"), first.editor.text);
  app.select("two");
  app.view.render(app.cx);
  await Promise.all(app.tasks);
  assert.equal(app.view.pads.get("two").text, "");
  assert.equal(setup(app.store).view.pads.get("one").text, first.editor.text);
  assert.equal(app.view.pads.get("two").text, "");
});

test("an edit callback saves to its own space even after selection changes", async () => {
  const app = setup();
  const first = app.view.pads.get("one");
  app.select("two");
  first.editor.text = "Still belongs to the first space";
  first.editor.handlers.change({}, app.cx);
  await Promise.all(app.tasks);
  assert.equal(app.store.get("space:one"), first.editor.text);
  assert.equal(app.store.has("space:two"), false);
});

test("a persistence failure is visible and preserves the editor text", async () => {
  const app = setup();
  app.store.set = () => { throw new Error("disk unavailable"); };
  const first = app.view.pads.get("one");
  first.editor.text = "Unsaved draft";
  first.editor.handlers.change({}, app.cx);
  assert.match(first.status, /Save failed:.*disk unavailable/);
  assert.equal(first.text, "Unsaved draft");
});
