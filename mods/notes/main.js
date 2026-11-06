import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextareaState, Textarea, TextView, InputState, Input, Checkbox } from "gpui-base";
import { spaces, theme, settings, home, window, exec, readTextFile, writeTextFile } from "herdr";
import { blocks, toggleTask } from "./markdown.js";

export default class Notes extends View {
  init(_props, cx) {
    this.pads = new Map();
    this.menu = false;
    this.appearance = false;
    this.prefs = JSON.parse(localStorage.getItem("appearance") ?? "{}");
    this.fontInput = InputState.new({ placeholder: "Follow Herdr", value: this.prefs.font ?? "" });
    this.fontInput.on("change", (_e, cx) => this.preference("font", this.fontInput.value().trim(), cx));
    const platform = window()?.platform;
    this.platform = platform;
    this.dir = `${home()}${platform === "macos" ? "/Library/Application Support/Herdr/notes" : platform === "windows" ? "/AppData/Local/Herdr/notes" : "/.local/share/herdr/notes"}`;
    this.directory = this.prepareDirectory();
    const space = spaces().find(s => s.active);
    if (space) this.load(space, cx);
  }

  async prepareDirectory() {
    const result = this.platform === "windows"
      ? await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `[System.IO.Directory]::CreateDirectory('${this.dir.replace(/'/g, "''")}') | Out-Null`])
      : await exec("mkdir", ["-p", this.dir]);
    if (result.code !== 0) throw new Error(result.stderr || "Could not create the notes folder");
  }

  load(space, cx) {
    const pad = { path: `${this.dir}/${encodeURIComponent(space.id)}.md`, loading: true, text: "", disk: null, error: null };
    this.pads.set(space.id, pad);
    cx.spawn(async (cx) => {
      try {
        await this.directory;
        pad.disk = await readTextFile(pad.path);
        const legacy = localStorage.getItem(`space:${space.id}`);
        const draft = JSON.parse(localStorage.getItem(`draft:${space.id}`) ?? "null");
        pad.text = pad.disk ?? legacy ?? "";
        if (draft && draft.text !== pad.disk) {
          pad.text = draft.text;
          if (draft.base !== pad.disk) {
            pad.disk = draft.base;
            pad.error = "The file changed outside Herdr. Your draft is kept locally; merge it before retrying.";
          }
        }
        pad.id = space.id;
        pad.loading = false;
        if (!pad.error && pad.disk !== pad.text) this.save(pad, cx);
      } catch (error) {
        pad.loading = false;
        pad.error = String(error);
      }
      cx.notify();
    });
    return pad;
  }

  change(pad, text, cx) {
    pad.text = text;
    try {
      localStorage.setItem(`draft:${pad.id}`, JSON.stringify({ text, base: pad.disk }));
    } catch (error) {
      pad.error = `Local backup failed: ${error}`;
    }
    pad.timer?.cancel();
    pad.timer = cx.timer.after(350, cx => this.save(pad, cx));
    cx.notify();
  }

  save(pad, cx) {
    if (pad.saving || !pad.id) return;
    pad.saving = true;
    cx.spawn(async (cx) => {
      try {
        while (pad.disk !== pad.text) {
          const text = pad.text;
          await writeTextFile(pad.path, text, pad.disk);
          pad.disk = text;
          if (pad.text === text) localStorage.removeItem(`draft:${pad.id}`);
          else localStorage.setItem(`draft:${pad.id}`, JSON.stringify({ text: pad.text, base: text }));
        }
        pad.error = null;
      } catch (error) {
        pad.error = `Could not save: ${error}. Your draft is kept locally.`;
      }
      pad.saving = false;
      cx.notify();
    });
  }

  begin(pad, cx) {
    if (!pad.id || pad.editing) return;
    if (!pad.input) {
      pad.input = TextareaState.new({ value: pad.text, placeholder: "Start writing…" });
      pad.input.set_soft_wrap(true);
      pad.input.set_selected_range({ start: pad.text.length, end: pad.text.length });
      pad.input.on("change", (_e, cx) => {
        if (pad.editing) this.change(pad, pad.input.value(), cx);
      });
      pad.input.on("blur", (_e, cx) => this.finish(pad, cx));
    } else if (pad.input.value() !== pad.text) pad.input.set_value(pad.text);
    pad.editing = true;
    pad.input.focus();
    cx.notify();
  }

  finish(pad, cx) {
    if (!pad.editing) return;
    pad.editing = false;
    cx.notify();
  }

  preference(name, value, cx) {
    this.prefs[name] = value;
    localStorage.setItem("appearance", JSON.stringify(this.prefs));
    cx.notify();
  }

  reveal(pad, cx) {
    cx.spawn(async (cx) => {
      try {
        if (pad.disk === null) throw new Error("The file has not been saved yet");
        const result = this.platform === "macos"
          ? await exec("open", ["-R", pad.path])
          : this.platform === "windows"
            ? await exec("explorer.exe", [`/select,${pad.path.replace(/\//g, "\\")}`])
            : await exec("xdg-open", [this.dir]);
        if (result.code !== 0) throw new Error(result.stderr || "Could not reveal the file");
      } catch (error) { pad.error = String(error); }
      cx.notify();
    });
  }

  section(pad, block, t, size) {
    let content;
    if (block.type === "heading") {
      const level = block.text.match(/^\s*(#+)/)[1].length;
      content = div().pt(level === 1 ? 10 : 6).pb(3).font_semibold()
        .text_size(size + (level === 1 ? 8 : level === 2 ? 4 : 2))
        .text_color(t.foreground)
        .child(block.text.replace(/^\s*#+\s+/, "").trimEnd());
    } else if (block.type === "task") {
      const match = block.text.match(/^(\s*[-*+] \[)([ xX])\] (.*)/);
      const checked = match[2] !== " ";
      content = h_flex().items_start().gap(9).py(2)
        .child(Checkbox.new(`task-${pad.id}-${block.start}`).id(`task-${block.start}`).checked(checked)
          .accessibility_label(match[3]).mt(3).size(15).flex_none().rounded(4)
          .border_1().border_color(checked ? t.accent : t.input).bg(checked ? t.accent : t.background)
          .text_color(t.background).text_size(12).items_center().justify_center().flex().cursor_pointer()
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_change((_checked, cx) => {
            cx.stop_propagation(); this.finish(pad, cx); this.change(pad, toggleTask(pad.text, block), cx);
          }).child(checked ? "✓" : ""))
        .child(div().flex_1().min_w(0).text_color(checked ? t.dim : t.foreground)
          .child(TextView.markdown(`task-label-${pad.id}-${block.start}`, checked ? `~~${match[3]}~~` : match[3]).selectable(false)));
    } else {
      content = div().min_w(0)
        .when(block.type === "code", el => el.rounded(6).text_color(t.muted))
        .when(block.type === "quote", el => el.pl(12).border_l(2).border_color(t.accent).text_color(t.muted))
        .child(TextView.markdown(`note-block-${pad.id}-${block.start}`,
          block.type === "quote" ? block.text.replace(/^ {0,3}> ?/gm, "") : block.text).selectable(false)
          .on_link_click((url, cx) => { cx.open_url(url); cx.stop_propagation(); }));
    }
    return div().min_w(0).py(3).child(content);
  }

  render(cx) {
    const t = theme(), space = spaces().find(s => s.active), s = settings();
    if (!space) return div().size_full().p(18).text_color(t.muted).child("Open a space to keep notes.");
    const pad = this.pads.get(space.id) ?? this.load(space, cx);
    const size = this.prefs.size ?? s.ui_font_size ?? s.font_size ?? 14;
    const leading = this.prefs.leading ?? 1.6;
    const font = this.prefs.font || s.ui_font_family || "Geist";
    const button = (id, label, action, selected = false) => div().id(id).px(7).py(4).rounded(6).cursor_pointer()
      .when(selected, el => el.bg(t.selected)).text_color(selected ? t.foreground : t.muted)
      .hover(el => el.bg(t.hover).text_color(t.foreground)).on_click(action).child(label);
    const document = pad.loading
      ? div().text_color(t.dim).child("Opening your notebook…")
      : pad.editing
        ? Textarea.new(pad.input).size_full().font_family(font).text_size(size).line_height(`${size * leading}px`)
          .on_key_down((e, cx) => {
            if (e.key === "escape" || e.keystroke === "cmd-enter") { this.finish(pad, cx); cx.stop_propagation(); }
          })
        : v_flex().id("notes-reading").size_full().min_w(0).gap(5).overflow_y_scrollbar().cursor_text()
          .when(Boolean(pad.text.trim()), el => el.children(blocks(pad.text).map(b => this.section(pad, b, t, size))))
          .when(!pad.text.trim(), el => el.child(div().text_color(t.dim).child("Start writing…")));
    const closeMenu = cx => { this.menu = false; this.appearance = false; cx.notify(); };
    const menuRow = (id, label, action) => div().id(id).w_full().px(12).py(8).rounded(5).cursor_pointer()
      .text_size(12).text_color(t.foreground).hover(el => el.bg(t.hover)).on_click(action).child(label);
    return v_flex().relative().size_full().min_w(0).min_h(0).rounded(10)
      .bg(t.background).text_color(t.foreground).font_family(font).text_size(size).line_height(`${size * leading}px`).overflow_hidden()
      .on_mouse_down_out((_e, cx) => { if (this.menu) closeMenu(cx); })
      .child(h_flex().h(36).flex_none().px(24).gap(9).items_center()
        .child(div().text_size(12).font_semibold().child("Notes"))
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.dim).child(space.name))
        .when(Boolean(pad.saving), el => el.child(div().text_size(10).text_color(t.dim).child("Saving…")))
        .child(button("notes-menu", "…", (_e, cx) => {
          this.menu = !this.menu; if (!this.menu) this.appearance = false; cx.notify();
        }, this.menu).accessibility_label("Notes menu").tooltip("Appearance and file actions")))
      .when(Boolean(pad.error), el => el.child(v_flex().px(24).py(10).gap(6).text_size(11).text_color(t.ansi1)
        .child(pad.error).child(button("notes-retry", "Retry", (_e, cx) => {
          if (pad.id) this.save(pad, cx);
          else { this.directory = this.prepareDirectory(); this.load(space, cx); }
        }))))
      .child(div().id("notes-document").flex_1().min_h(0).min_w(0).px(28).pt(24).pb(28)
        .on_click((_e, cx) => { if (this.menu) closeMenu(cx); this.begin(pad, cx); })
        .on_mouse_down_out((_e, cx) => this.finish(pad, cx)).child(document))
      .when(this.menu, el => el.child(v_flex().id("notes-menu-body").absolute().top(34).right(12).w(252)
        .p(6).gap(2).rounded(8).bg(t.popover).border_1().border_color(t.border).shadow_md()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(menuRow("notes-appearance", "Appearance", (_e, cx) => { this.appearance = !this.appearance; cx.notify(); }))
        .when(this.appearance, el => el.child(v_flex().px(6).py(8).gap(9)
          .child(h_flex().gap(5).items_center().text_size(11)
            .child(button("font-herdr", "Follow Herdr", (_e, cx) => {
              this.fontInput.set_value(""); this.preference("font", "", cx);
              this.preference("size", null, cx); this.preference("leading", null, cx);
            }))
            .child(button("font-smaller", "A−", (_e, cx) => this.preference("size", Math.max(11, size - 1), cx)))
            .child(div().text_color(t.muted).child(String(size)))
            .child(button("font-larger", "A+", (_e, cx) => this.preference("size", Math.min(24, size + 1), cx))))
          .child(Input.new(this.fontInput).h(30).px(8).rounded(5).border_1().border_color(t.input).bg(t.background).text_size(12))
          .child(div().text_size(10).text_color(t.dim).child("Font family · empty follows Herdr"))
          .child(h_flex().gap(3).text_size(10).children([[1.4, "Compact"], [1.6, "Normal"], [1.85, "Roomy"]].map(([value, label]) =>
            button(`leading-${value}`, label, (_e, cx) => this.preference("leading", value, cx), leading === value))))))
        .child(menuRow("notes-reveal", "Reveal file", (_e, cx) => { closeMenu(cx); this.reveal(pad, cx); }))
        .child(menuRow("notes-copy-path", "Copy path", (_e, cx) => { cx.write_to_clipboard(pad.path); closeMenu(cx); }))
        .child(div().px(12).py(6).text_size(10).text_color(t.dim).truncate().tooltip(pad.path)
          .child(pad.path.replace(this.dir, "…/Herdr/notes")))));
  }

  async close() {
    await localStorage.flush();
  }
}
