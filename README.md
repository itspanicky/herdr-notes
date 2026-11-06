# Herdr Notes

A Markdown scratchpad beside Files and Changes. One autosaved pad per space, with a native editor, rendered preview, and a completed-task count.

<img src="preview.png" alt="Notes sidebar with a demo Markdown checklist" width="412">

## Install

Requires Herdr desktop; built and checked with 0.1.13. This is a personal copy of the default layout, with two custom mods. It uses the other shipped Herdr mods.

Read `RECIPE.md` and the source first. The Notes mod stores text through Herdr's local storage. It does not run programs or make network requests itself. Markdown links use Herdr's standard renderer. The inherited Files and Changes panels retain their normal filesystem and Git behavior.

Copy `layouts/notes.json` and `layouts/notes.png` into your Herdr home's `layouts/` folder, and copy `mods/notes/` and `mods/notes-tabs/` into its `mods/` folder. The default home is `~/.config/herdr-app`. Do not replace existing files or mods: if these names are taken, rename the incoming layout/mods and update their references and asset paths.

Then run:

```sh
herdr-app check ~/.config/herdr-app/mods/notes
herdr-app check ~/.config/herdr-app/mods/notes-tabs
herdr-app do layout.switch '{"name":"notes"}'
```

Click **Notes** beside Files and Changes to open or close the sidebar. Use **Write** for Markdown and **Preview** to read it. Write tasks as `- [ ] Todo` or `- [x] Done`; change the marker in Write mode to check one off. Notes save as you type, and the footer reports persistence errors.

## Storage and limits

Notes live in Herdr-managed local storage for this mod copy, keyed by space ID. They are not repository files and do not sync between computers. Spaces with different IDs have different notes even if their folders match. Switching tabs inside a space keeps the same pad. The Write/Preview choice is held for the current mod instance, rather than separately per space.

Preview is for reading; checkbox changes are made in Write mode. The task count recognizes Markdown bullet task lines starting with `-`, `*`, or `+`. It is a line-based count, so task-shaped text inside code fences also counts. Nothing is seeded into a real pad; the screenshot uses disposable demo text and is cropped to exclude private workspace content.

To return to the default layout:

```sh
herdr-app do layout.switch '{"name":"main"}'
```

Switching layouts does not delete notes. Back up your Herdr home before removing stored data.

## Validation

```sh
node --test tests/notes.test.mjs
```

The tests exercise the actual Notes class with mocked native controls and storage: fresh-instance restoration, space isolation, delayed edits after a space change, and visible storage failures. Native checks and screenshots validate loading and appearance. They do not automate physical keyboard interaction or an app restart.

## Attribution

`layouts/notes.json` and `mods/notes-tabs/` derive from the installed Herdr 0.1.13 `main` layout and `tabs` mod. Other shipped mods and their assets remain dependencies supplied by Herdr. `mods/notes/` is the added Notes panel. `RECIPE.md` describes the complete build.
