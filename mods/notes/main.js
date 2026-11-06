import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, EditorState, Editor, TextView } from "gpui-base";
import { spaces, theme, settings, run } from "herdr";

export default class Notes extends View {
  init() {
    this.pads = new Map();
    this.preview = false;
    const space = spaces().find(s => s.active);
    if (space) this.pad(space);
  }

  pad(space) {
    if (this.pads.has(space.id)) return this.pads.get(space.id);
    const key = `space:${space.id}`;
    const pad = { text: localStorage.getItem(key) ?? "", status: "Autosaved locally", revision: 0 };
    pad.editor = EditorState.new({
      language: "markdown", value: pad.text, font_family: settings().font,
      font_size: 13, line_numbers: false, folding: false, soft_wrap: true,
    });
    pad.editor.on("change", (_e, cx) => {
      pad.text = pad.editor.value();
      const revision = ++pad.revision;
      try {
        localStorage.setItem(key, pad.text);
        pad.status = "Saving…";
        cx.spawn(async (cx) => {
          try {
            await localStorage.flush();
            if (revision === pad.revision) pad.status = "Autosaved locally";
          } catch (error) {
            pad.status = `Save failed: ${error}`;
          }
          cx.notify();
        });
      } catch (error) {
        pad.status = `Save failed: ${error}`;
      }
      cx.notify();
    });
    this.pads.set(space.id, pad);
    return pad;
  }

  render(cx) {
    const t = theme(), space = spaces().find(s => s.active);
    if (!space) return div().size_full().p(16).text_color(t.muted).child("Open a space to keep notes.");
    const pad = this.pads.get(space.id);
    if (!pad) {
      cx.spawn(async (cx) => { this.pad(space); cx.notify(); });
      return div().size_full().p(16).text_color(t.muted).child("Opening notes…");
    }
    const tasks = pad.text.match(/^\s*[-*+] \[[ xX]\] /gm) ?? [];
    const done = tasks.filter(line => /\[[xX]\]/.test(line)).length;
    const mode = (label, preview) => div().id(`notes-${label}`).px(9).py(5).rounded(6)
      .bg(this.preview === preview ? t.selected : t.chrome)
      .text_color(this.preview === preview ? t.foreground : t.muted).cursor_pointer()
      .hover(s => s.bg(t.hover)).on_click((_e, cx) => { this.preview = preview; cx.notify(); }).child(label);
    return v_flex().size_full().min_w(0).min_h(0).rounded(10).border_1().border_color(t.border)
      .bg(t.background).text_color(t.foreground).text_size(12).overflow_hidden()
      .child(h_flex().h(44).flex_none().px(12).gap(8).items_center().bg(t.chrome)
        .border_b(1).border_color(t.border)
        .child(svg("mods/notes/note.svg").size(16).text_color(t.accent))
        .child(div().font_semibold().child("Notes"))
        .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(space.name))
        .child(div().id("notes-close").px(5).py(3).rounded(5).cursor_pointer().text_color(t.muted)
          .hover(s => s.bg(t.hover)).on_click(() => run("layout.hide", { id: "panel" })).child("×")))
      .child(h_flex().h(42).flex_none().px(10).gap(4).items_center().bg(t.chrome)
        .child(mode("Write", false)).child(mode("Preview", true)))
      .child(div().flex_1().min_h(0).min_w(0).p(12)
        .child(this.preview
          ? TextView.markdown(`notes-preview-${space.id}`, pad.text || "*Your notes will appear here.*")
            .size_full().selectable(true).scrollable(true)
          : Editor.new(pad.editor).size_full()))
      .child(h_flex().flex_none().px(12).py(9).gap(8).border_t(1).border_color(t.border)
        .child(div().flex_1().text_size(10.5).text_color(t.dim).child(pad.status))
        .child(div().text_size(10.5).text_color(t.muted).child(tasks.length ? `${done}/${tasks.length} tasks` : "Markdown · - [ ] todo")));
  }

  async close() {
    await localStorage.flush();
  }
}
