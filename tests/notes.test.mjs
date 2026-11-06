import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const parser = readFileSync(new URL("../mods/notes/markdown.js", import.meta.url), "utf8").replace(/export /g, "");
const source = readFileSync(new URL("../mods/notes/main.js", import.meta.url), "utf8")
  .replace(/^import .*;\n/gm, "").replace("export default class Notes", "class Notes");

function setup({ store = new Map(), files = new Map(), settings = {} } = {}) {
  let changed, readGate;
  let active = { id: "one", name: "First space", active: true };
  let rendering = false, failWrites = false, writeGate, clipboard, flushError, flushGate;
  const tasks = [], timers = [], elements = new Map(), writes = [];
  const cx = {
    notify() { assert.equal(rendering, false, "notify must run outside render"); },
    stop_propagation() {}, sleep: async () => {}, write_to_clipboard(value) { clipboard = value; },
    spawn(fn) { tasks.push(fn(cx)); },
    timer: { after(_ms, fn) {
      const timer = { cancelled: false, cancel() { this.cancelled = true; }, fn };
      timers.push(timer); return timer;
    } },
  };
  const chain = () => {
    const element = { handlers: {}, nodes: [], styles: {} };
    const proxy = new Proxy(element, { get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        if (key === "id") elements.set(args[0], proxy);
        else if (key === "when" && args[0]) args[1](proxy);
        else if (key === "child") target.nodes.push(args[0]);
        else if (key === "children") target.nodes.push(...args[0]);
        else if (key.startsWith("on_")) target.handlers[key] = args.at(-1);
        else target.styles[key] = args[0];
        return proxy;
      };
    } });
    return proxy;
  };
  const input = ({ value = "" } = {}) => {
    assert.equal(rendering, false, "native text states must be created outside render");
    return {
      text: value, handlers: {}, value() { return this.text; },
      set_value(value) { this.text = value; },
      on(event, handler) { this.handlers[event] = handler; },
      set_soft_wrap() {}, set_selected_range(range) { this.selection = range; }, focus() {},
    };
  };
  const context = vm.createContext({
    View: class {}, div: chain, svg: chain, v_flex: chain, h_flex: chain,
    TextView: { markdown: chain }, Textarea: { new: () => chain().id("raw-editor") }, Input: { new: chain }, Checkbox: { new: chain },
    TextareaState: { new: input }, InputState: { new: input },
    localStorage: {
      getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value),
      removeItem: key => store.delete(key), flush: async () => { if (flushGate) await flushGate; if (flushError) throw flushError; },
    },
    spaces: () => [active], settings: () => settings, theme: () => ({}), run() {},
    window: () => ({ platform: "macos" }), home: () => "/home/test",
    exec: async () => ({ code: 0 }),
    watchFolder: () => new Promise(resolve => { changed = resolve; }),
    readTextFile: async path => { if (readGate) await readGate; return files.get(path) ?? null; },
    writeTextFile: async (path, text, expected) => {
      if (writeGate) await writeGate;
      if (failWrites) throw new Error("disk unavailable");
      assert.equal(files.get(path) ?? null, expected, "file changed externally");
      files.set(path, text); writes.push({ path, text });
    },
  });
  const { Notes, blocks, toggleTask } = vm.runInContext(`${parser}\n${source}\n({ Notes, blocks, toggleTask })`, context);
  const view = new Notes();
  view.init({}, cx);
  return {
    view, cx, store, files, tasks, writes, elements, blocks, toggleTask, get clipboard() { return clipboard; },
    select(id) { active = { id, name: id, active: true }; },
    changed() { changed([path]); }, gateRead(promise) { readGate = promise; },
    failWrites(value) { failWrites = value; }, gate(promise) { writeGate = promise; },
    failFlush(error) { flushError = error; }, gateFlush(promise) { flushGate = promise; },
    async settle() {
      for (let count = 0; count !== tasks.length;) { count = tasks.length; await Promise.race([Promise.all(tasks), new Promise(resolve => setImmediate(resolve))]); }
    },
    async saveTimers() { for (const timer of timers.splice(0)) if (!timer.cancelled) timer.fn(cx); await this.settle(); },
    render() {
      rendering = true;
      try { return view.render(cx); }
      finally { rendering = false; }
    },
  };
}

const path = "/home/test/Library/Application Support/Herdr/notes/one.md";

test("migrates legacy Markdown into a real file without changing the original backup", async () => {
  const text = "# Plan\n\n- [ ] Next thing\n";
  const app = setup({ store: new Map([["space:one", text]]) });
  await app.settle();
  assert.equal(app.files.get(path), text);
  assert.equal(app.store.get("space:one"), text);
  const restored = setup({ store: app.store, files: app.files });
  await restored.settle();
  assert.equal(restored.view.pads.get("one").text, text);
});

test("existing Markdown files take precedence over legacy local storage", async () => {
  const app = setup({ store: new Map([["space:one", "Old"]]), files: new Map([[path, "Edited externally"]]) });
  await app.settle();
  assert.equal(app.view.pads.get("one").text, "Edited externally");
  assert.equal(app.writes.length, 0);
});

test("first opening another space schedules one load, without native states during render", async () => {
  const app = setup();
  await app.settle();
  const first = app.view.pads.get("one");
  app.select("two"); app.render(); app.render();
  await app.settle();
  assert.equal(app.view.pads.get("two").loading, false);
  assert.equal(app.writes.filter(w => w.path.endsWith("/two.md")).length, 1);
  app.select("one"); app.render();
  assert.equal(app.view.pads.get("one"), first);
});

test("one retained editor contains the entire note, saves to its space, and auto-previews on blur", async () => {
  const text = "# Title\n\nOriginal paragraph\n\n- [ ] Todo\n";
  const app = setup({ files: new Map([[path, text]]) });
  await app.settle();
  const pad = app.view.pads.get("one");
  app.render();
  app.elements.get("notes-document").handlers.on_click({}, app.cx);
  assert.equal(pad.input.value(), text);
  assert.equal(pad.input.selection.start, text.length);
  assert.equal(pad.editing, true);
  app.render();
  const input = pad.input;
  app.select("two");
  input.text = text + "\nAnother thought\n"; input.handlers.change({}, app.cx);
  input.handlers.blur({}, app.cx);
  assert.equal(pad.editing, false);
  await app.saveTimers();
  assert.equal(app.files.get(path), text + "\nAnother thought\n");
  assert.equal(app.files.has(path.replace("one.md", "two.md")), false);
  app.view.begin(pad, app.cx);
  assert.equal(pad.input, input, "reopening must preserve the editor and its undo state");
});

test("clicking outside previews without changing Markdown or adding separators", async () => {
  const text = "## A heading\n\nText with trailing whitespace  \n\n- [ ] Task\n";
  const app = setup({ files: new Map([[path, text]]) }); await app.settle();
  const pad = app.view.pads.get("one");
  app.view.begin(pad, app.cx); app.render();
  app.elements.get("notes-document").handlers.on_mouse_down_out({}, app.cx);
  assert.equal(pad.editing, false);
  assert.equal(pad.text, text);
  assert.equal(app.writes.length, 0);
});

test("clickable checkboxes preserve surrounding source and ignore fenced code", async () => {
  const text = "# Plan\n\n```md\n- [ ] Example only\n```\n\n- [ ] Real task\n";
  const app = setup({ files: new Map([[path, text]]) });
  await app.settle();
  const task = app.blocks(text).find(b => b.type === "task");
  assert.equal(app.blocks(text).filter(b => b.type === "task").length, 1);
  app.render();
  app.elements.get(`task-${task.start}`).handlers.on_change(true, app.cx);
  await app.saveTimers();
  assert.equal(app.files.get(path), text.replace("- [ ] Real task", "- [x] Real task"));
  assert.equal(app.toggleTask(app.files.get(path), { ...task, text: "- [x] Real task\n" }), text);
});

test("file-save failures preserve a recoverable local draft, and Retry can save it", async () => {
  const app = setup(); await app.settle();
  app.failWrites(true);
  const pad = app.view.pads.get("one");
  app.view.change(pad, "Unsaved draft", app.cx);
  await app.saveTimers();
  assert.match(pad.error, /disk unavailable/);
  assert.equal(JSON.parse(app.store.get("draft:one")).text, "Unsaved draft");
  app.failWrites(false); app.view.save(pad, app.cx); await app.settle();
  assert.equal(app.files.get(path), "Unsaved draft");
  assert.equal(app.store.has("draft:one"), false);
});

test("recovers a pending draft and refuses to overwrite a conflicting external edit", async () => {
  const draft = JSON.stringify({ text: "Recovered draft", base: "Original" });
  const app = setup({ store: new Map([["draft:one", draft]]), files: new Map([[path, "Original"]]) });
  await app.settle(); assert.equal(app.files.get(path), "Recovered draft");
  const conflict = setup({ store: new Map([["draft:one", draft]]), files: new Map([[path, "External edit"]]) });
  await conflict.settle();
  const pad = conflict.view.pads.get("one");
  assert.match(pad.error, /changed outside Herdr/);
  conflict.view.save(pad, conflict.cx); await conflict.settle();
  assert.equal(conflict.files.get(path), "External edit");
  assert.equal(pad.text, "Recovered draft");
});

test("serialized saves keep the latest text when edits arrive during a file write", async () => {
  const app = setup(); await app.settle();
  let release;
  app.gate(new Promise(resolve => { release = resolve; }));
  const pad = app.view.pads.get("one");
  app.view.change(pad, "First", app.cx); app.view.save(pad, app.cx);
  app.view.change(pad, "Latest", app.cx); app.view.save(pad, app.cx);
  release(); await app.settle();
  assert.equal(app.files.get(path), "Latest");
  assert.equal(pad.disk, "Latest");
});

test("font and line-spacing preferences persist independently of note text", async () => {
  const app = setup(); await app.settle();
  app.view.preference("font", "Geist Mono", app.cx);
  app.view.preference("size", 16, app.cx);
  app.view.preference("leading", 1.85, app.cx);
  const restored = setup({ store: app.store, files: app.files }); await restored.settle();
  assert.equal(restored.view.prefs.font, "Geist Mono");
  assert.equal(restored.view.prefs.size, 16);
  assert.equal(restored.view.prefs.leading, 1.85);
  assert.equal(app.files.get(path), "");
});


test("the raw editor inherits Herdr's terminal font and follows appearance overrides", async () => {
  const app = setup({ settings: { font_family: "JetBrains Mono", font_size: 15, ui_font_family: "Geist", ui_font_size: 13 } });
  await app.settle();
  const pad = app.view.pads.get("one");
  app.view.begin(pad, app.cx); app.render();
  assert.equal(app.elements.get("raw-editor").styles.font_family, "JetBrains Mono");
  assert.equal(app.elements.get("raw-editor").styles.text_size, 15);
  app.view.preference("font", "Georgia", app.cx);
  app.view.preference("size", 20, app.cx);
  app.render();
  assert.equal(app.elements.get("raw-editor").styles.font_family, "Georgia");
  assert.equal(app.elements.get("raw-editor").styles.text_size, 20);
});


test("the single menu exposes appearance and file actions without editing the note", async () => {
  const text = "A quiet thought";
  const app = setup({ files: new Map([[path, text]]) }); await app.settle();
  app.render();
  app.elements.get("notes-menu").handlers.on_click({}, app.cx); app.render();
  assert.equal(app.view.menu, true);
  app.elements.get("notes-appearance").handlers.on_click({}, app.cx); app.render();
  assert.equal(app.view.appearance, true);
  app.elements.get("notes-copy-path").handlers.on_click({}, app.cx);
  assert.equal(app.clipboard, path);
  assert.equal(app.view.menu, false);
  assert.equal(app.view.pads.get("one").editing, undefined);
  assert.equal(app.files.get(path), text);
  assert.equal(app.writes.length, 0);
});

test("clearing saves an undo snapshot first and restores it after a fresh instance", async () => {
  const original = "# Keep me\n\nA note with whitespace  \n";
  const app = setup({ files: new Map([[path, original]]) }); await app.settle();
  const pad = app.view.pads.get("one");
  app.view.clear(pad, app.cx); await app.settle(); await app.saveTimers();
  assert.equal(app.files.get(path), "");
  assert.equal(app.store.get("cleared:one"), original);
  assert.equal(pad.input.value(), "");
  assert.equal(pad.editing, true);
  const restored = setup({ store: app.store, files: app.files }); await restored.settle();
  restored.view.undoClear(restored.view.pads.get("one"), restored.cx);
  await restored.saveTimers();
  assert.equal(restored.files.get(path), original);
  assert.equal(restored.store.has("cleared:one"), false);
});

test("undo clear preserves text added afterward and belongs only to that space", async () => {
  const app = setup({ files: new Map([[path, "Original"]]) }); await app.settle();
  const pad = app.view.pads.get("one");
  app.view.clear(pad, app.cx); await app.settle();
  app.view.change(pad, "A new thought", app.cx);
  app.select("two"); app.render(); await app.settle();
  assert.equal(app.view.pads.get("two").cleared, null);
  app.view.undoClear(pad, app.cx); await app.saveTimers();
  assert.equal(app.files.get(path), "Original\n\nA new thought");
  assert.equal(app.view.pads.get("two").text, "");
});

test("clear leaves the note intact when its durable undo backup fails", async () => {
  const app = setup({ files: new Map([[path, "Do not lose me"]]) }); await app.settle();
  app.failFlush(new Error("backup unavailable"));
  const pad = app.view.pads.get("one");
  app.view.clear(pad, app.cx); await app.settle();
  assert.equal(pad.text, "Do not lose me");
  assert.equal(app.files.get(path), "Do not lose me");
  assert.match(pad.error, /Could not clear note.*backup unavailable/);
});

test("clear aborts if the user edits while the undo snapshot is being flushed", async () => {
  const app = setup({ files: new Map([[path, "Original"]]) }); await app.settle();
  let release; app.gateFlush(new Promise(resolve => { release = resolve; }));
  const pad = app.view.pads.get("one");
  app.view.clear(pad, app.cx);
  app.view.change(pad, "Newer text", app.cx);
  release(); await app.settle(); await app.saveTimers();
  assert.equal(pad.text, "Newer text");
  assert.equal(app.files.get(path), "Newer text");
});

test("Zen and Markdown colors change preview styling and persist without changing source", async () => {
  const text = "# Title\n\n## Section\n";
  const app = setup({ files: new Map([[path, text]]) }); await app.settle();
  const pad = app.view.pads.get("one"), heading = app.blocks(text)[0];
  const palette = { foreground: "#ffffff", ansi5: "#bb88cc", ansi4: "#6688cc", ansi6: "#88bbcc" };
  assert.equal(app.view.section(pad, heading, palette, 13).nodes[0].styles.text_color, palette.foreground);
  app.view.menu = true; app.view.appearance = true; app.render();
  app.elements.get("style-markdown").handlers.on_click({}, app.cx);
  assert.equal(app.view.section(pad, heading, palette, 13).nodes[0].styles.text_color, palette.ansi5);
  const restored = setup({ store: app.store, files: app.files }); await restored.settle();
  assert.equal(restored.view.prefs.style, "markdown");
  app.elements.get("style-zen").handlers.on_click({}, app.cx);
  assert.equal(app.view.prefs.style, "zen");
  assert.equal(app.files.get(path), text);
  assert.equal(app.writes.length, 0);
});


test("external edits refresh the preview and retained editor without writing the file", async () => {
  const app = setup({ files: new Map([[path, "Original"]]) }); await app.settle();
  const pad = app.view.pads.get("one");
  app.view.begin(pad, app.cx);
  app.files.set(path, "# Agent update\n\n- [ ] Next task\n");
  app.changed(); await app.settle();
  assert.equal(pad.text, app.files.get(path));
  assert.equal(pad.disk, pad.text);
  assert.equal(pad.input.value(), pad.text);
  assert.equal(pad.editing, true);
  assert.equal(app.writes.length, 0);
  assert.equal(app.store.has("draft:one"), false);
  app.view.finish(pad, app.cx); app.render();
  assert.equal(app.blocks(pad.text)[0].type, "heading");
});

test("external edits preserve an unsaved local draft and refuse to overwrite the agent file", async () => {
  const app = setup({ files: new Map([[path, "Original"]]) }); await app.settle();
  const pad = app.view.pads.get("one");
  app.view.change(pad, "My draft", app.cx);
  app.files.set(path, "Agent update"); app.changed(); await app.settle();
  assert.equal(pad.text, "My draft");
  assert.equal(pad.disk, "Original");
  assert.match(pad.error, /changed outside Herdr/);
  await app.saveTimers();
  assert.equal(app.files.get(path), "Agent update");
  assert.equal(JSON.parse(app.store.get("draft:one")).text, "My draft");
});

test("typing while an external refresh is pending keeps the new local draft", async () => {
  const app = setup({ files: new Map([[path, "Original"]]) }); await app.settle();
  const pad = app.view.pads.get("one");
  let release; app.gateRead(new Promise(resolve => { release = resolve; }));
  app.files.set(path, "Agent update"); app.changed(); await app.settle();
  app.view.change(pad, "New local draft", app.cx);
  release(); await app.settle();
  assert.equal(pad.text, "New local draft");
  assert.equal(pad.disk, "Original");
  assert.match(pad.error, /changed outside Herdr/);
});

test("external edits refresh cached notes in their own space and handle an empty file", async () => {
  const second = path.replace("one.md", "two.md");
  const app = setup({ files: new Map([[path, "First"], [second, "Second"]]) }); await app.settle();
  app.select("two"); app.render(); await app.settle();
  app.files.set(path, "Updated first"); app.files.set(second, "");
  app.changed(); await app.settle();
  assert.equal(app.view.pads.get("one").text, "Updated first");
  assert.equal(app.view.pads.get("two").text, "");
  assert.equal(app.writes.length, 0);
});
