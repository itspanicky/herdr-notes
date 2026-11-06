# Herdr Notes

Quiet Margin: one continuous Markdown note per space, beside Files and Changes. Click anywhere in the page to write; click away to see it formatted automatically. No mode toggle, paragraph boxes or add-block controls.

<img src="preview.png" alt="Herdr Notes with theme-colored Markdown headings and tasks" width="412">

## Use

Click **Notes** beside Files and Changes to open or close the sidebar. To assign Option+Shift+N on macOS, add `"layout:notes": { "alt-shift-n": "notes-tabs.toggle-notes" }` alongside the existing sections in `~/.config/herdr-app/keys.json`. It selects Notes when another panel is open, and closes it when Notes is already shown. Click the note to edit the whole document. The first edit starts with the cursor at the end so you can add a thought immediately. Later edits reuse the same native text control. Click outside the page, press Escape, or use the platform modifier plus Enter to return to formatted reading. All edits autosave; there is no Save button.

Open **… → Appearance** to set a font family, size (11–24px), and Compact/Normal/Roomy line spacing. **Follow Herdr** resets those overrides. By default, Notes uses Herdr's terminal font and size (JetBrains Mono by default). Choose **Preview style → Zen** for neutral headings or **Markdown colors** for theme-based heading, checkbox, quote and code accents. Zen is the default. Both use the same font in the source editor; these colors apply to the formatted preview. The 36px header has only Notes, the space name and the menu; there is no permanent footer, document icon, Aa button or close button. Close the panel with its Notes tab-bar button.

In the formatted view, task checkboxes update the Markdown directly. Clicking text anywhere else opens the same whole-note editor. Headings and paragraphs are never separate editing targets. This is automatic preview when you leave the editor. Cursor-based live preview, where only the active line shows source, is not implemented: Herdr 0.1.13 exposes neither a cursor-position getter nor a selection-change event to mods. The source editor supports normal text selection, native editing and soft wrapping. Task-list continuation and a formatting toolbar are not implemented.

The same **…** menu contains **Clear note**, **Undo clear**, **Reveal file**, **Copy path**, and an abbreviated path with the full path in its tooltip. Clear note empties the current space’s note after saving an undo backup to disk, with no confirmation. Undo clear restores it, including after a mod reload, and keeps anything written since the clear. The Markdown file remains in place. There is one undo backup per space, replaced by the next successful clear. Saving status appears only during a file write, and failures stay visible beside Retry.

## Install

Built and checked with Herdr desktop 0.1.13. This is a personal copy of the default layout with two custom mods; the other panels remain Herdr's shipped mods. Read `RECIPE.md` and the source before installing.

Copy `layouts/notes.json` and `layouts/notes.png` into your Herdr home's `layouts/` folder, and `mods/notes/` and `mods/notes-tabs/` into its `mods/` folder. The default home is `~/.config/herdr-app`. Do not replace existing names: rename incoming files/mods and update references if there is a collision. Existing users of this repository can replace their own prior Notes files after backing up their data.

```sh
herdr-app check ~/.config/herdr-app/mods/notes
herdr-app check ~/.config/herdr-app/mods/notes-tabs
herdr-app do layout.switch '{"name":"notes"}'
```

## Storage and recovery

Notes are user data, separate from layout configuration. Each space gets a Markdown file named with its encoded space ID:

- macOS: `~/Library/Application Support/Herdr/notes/`
- Linux: `~/.local/share/herdr/notes/`
- Windows: `~/AppData/Local/Herdr/notes/`

The macOS path is verified in the running app. Linux and Windows have platform branches but have not been runtime-tested. The mod creates the directory with `mkdir` on macOS/Linux or PowerShell on Windows. Revealing a file uses Finder/Explorer, or opens the folder with `xdg-open` on Linux. These are the only external programs Notes invokes. Markdown links use the native renderer; Notes has no cloud service or sync.

On first opening a space, an existing Markdown file takes precedence. Otherwise its previous local-storage pad is copied into a new file. The old pad is retained unchanged. Migration is lazy: opening a space migrates its pad.

Edits get an immediate local recovery draft and a file save after 350ms of inactivity. Writes are serialized and atomic, and require the expected previous file contents. An external edit is not overwritten. On failure, the draft remains in the editor and local storage; Retry repeats the guarded save. Conflicts require manually merging the external file and draft. The native folder watcher reloads externally edited files into clean notes, including an open source editor. If you have unsaved local changes, it keeps your draft and shows a conflict instead. A watcher failure is shown in the panel.

Fonts and recovery state stay in Herdr-managed local storage. Different space IDs mean different files, even for the same folder. Renaming a space does not change its file path. The host's text-file read limit is 1 MiB.

To return to the default layout, run `herdr-app do layout.switch '{"name":"main"}'`. Layout switching does not delete notes. Back up the notes directory and Herdr's local storage before removing either.

## Validation

```sh
node --test tests/notes.test.mjs
```

Twenty-one tests exercise the actual Notes class with mocked controls and file storage: migration, restoration, space isolation, safe creation, continuous editing, automatic preview, task changes, failures, draft recovery, conflict protection, overlapping saves appearance preferences, reversible clearing, backup failures and edits during clearing, live file updates and concurrent local/external edits. Native runtime checks and disposable demo screenshots also verify the formatted view, full-note text control and font menu. Physical keyboard input and an app restart are not automated.

The preview uses disposable demo text and is cropped to exclude private workspace content. Neither live notes nor personal settings are in this repository.

## Attribution

`layouts/notes.json` and `mods/notes-tabs/` derive from Herdr 0.1.13's `main` layout and `tabs` mod. Other shipped mods and assets remain dependencies supplied by Herdr. `mods/notes/` is the added Notes panel.
