# Notes

Keep one continuous Markdown note beside your terminals in Herdr. Notes opens from the same tab-bar controls as Files and Changes. Click the page to write anywhere in the whole note; leaving it restores formatted Markdown automatically. The interface stays quiet: a small title, an Aa appearance menu, the page, and a useful file path. There are no paragraph boxes, add-block buttons or Write/Preview tabs.

![Notes](preview.png)

## What you see

Use the default Herdr window: a 268px spaces/agents sidebar, the terminal work area, and an optional right panel. Preserve the left sidebar's 46px brand row, equal-weight spaces and agents lists (90px minimum each), and 69px footer. The center has a 42px tab bar, a work area with 8px padding/gaps, and a 28px status bar. Terminal cards have 10px corners, 1px borders/focus outlines and 30px headers.

The right panel starts at 400px and resizes between 280px and 900px. Files, Changes and Notes share it, one shown at a time. Notes is always available; the other two follow existing panel preferences. Start the panel closed unless the tab bar restores a saved choice for that space.

The Notes card has 10px corners and a 1px border. Its 46px header contains a 16px outline document icon, a 12px semibold Notes title, an 11.5px truncated space name, transient Saving… text, Aa and ×. The page has 20px horizontal and 16px vertical padding and fills the remaining height. The bottom path strip has 15px horizontal and 9px vertical padding, 10.5px dim text, and a top border. No task-count or permanent Saved footer.

Use theme colors rather than a fixed palette. The title/icon and first-level Markdown headings use ansi5; second-level headings use ansi4; deeper headings and completed tasks use ansi6. Body text is foreground, secondary text muted/dim, and code surfaces chrome. Quotes have an ansi5 left border. Heading sizes are body size +10px for H1, +5px for H2 and +2px for the rest. The body follows Herdr's UI font/size, falling back to Geist and 14px. Default line spacing is 1.6 times body size, expressed as an explicit pixel length.

Aa expands a compact inline area: Follow Herdr, A−, the current size and A+; a text field for a custom font family; and Compact, Comfortable and Spacious spacing choices (1.4, 1.6 and 1.85). Sizes range from 11 to 24px. The preview is a crop of the real right panel with disposable Demo project text; use it as both preview.png and layouts/notes.png. Do not seed demo text into real notes.

## How it behaves

Click Notes to select/show the panel; clicking it again or × closes it. Files and Changes retain their behavior. Panel selection/closed state is remembered per space, and the edge resizes by dragging. Tabs inside the same space share a note.

The formatted page is a continuous reading surface. Click anywhere in its body to open one native multiline text control containing the entire Markdown document. Do not edit paragraphs or headings separately, add per-paragraph hover boxes, or insert separators automatically. The first entry puts the cursor at the end for quick note-taking. Reuse that text control on later entries; refresh its value only if a checkbox changed the source while reading. Text selection, normal text editing, soft wrapping and scrolling belong to the native control.

Leaving the page by clicking outside or blurring its input restores formatted Markdown. Escape or the platform modifier plus Enter also finishes editing. Keep the body full height, with no editing card or mode toolbar. Empty notes show only Start writing…. There is no rich-text formatting while typing or automatic bullet continuation.

In reading mode, native checkbox controls toggle task markers directly without opening the editor. Completed task labels are struck through. Regular text clicks edit the whole note; links open through the native URL handler and stop propagation. The Markdown parser may identify source ranges for display and checkbox offsets, but these are not separate editing regions.

Every text change immediately records a local recovery draft and schedules a file save after 350ms of inactivity. File writes are serialized; edits arriving during a write are saved afterward. Show Saving… only while writing, and show failures with Retry. On success, remove the matching recovery draft. No manual save step is required.

Click the path to reveal the file (or the folder on Linux); right-click copies the full path. The visible abbreviated path has a tooltip with the full path and both actions. Aa preferences persist independently of note text, and Follow Herdr clears the font/size/spacing overrides. Ordinary hover backgrounds apply to controls, never to individual paragraphs.

Preserve inherited tab selection, close, new-tab menu, right-click menu, double-click rename, press/release reordering, wheel navigation and platform window buttons. Working tabs have a native rotating spinner in the working color; blocked/done tabs have their colored dot; idle tabs have no activity marker. Space/agent status and navigation remain shipped behavior. Notes never changes agent status or sends terminal input. Install no new global keybindings.

## Built from

Clone the installed Herdr 0.1.13 main layout into layouts/notes.json, preserving cloned_from metadata. Set preview to layouts/notes.png. The tree is root row → sidebar column and work column; sidebar → brand, sidebar-lists (spaces/agents), sidebar-footer; work → tabs, work-body, status; work-body → main active-tab block and panel column; panel → panel-body stack with files, changes and notes children. Keep panel hidden and panel-body active files by default. Set the panel width to 400px.

Use shipped workspace-chrome, spaces, agents, pane, files, changes, workspace-status, menu and new-menu mods and their assets. Clone tabs into notes-tabs, including its four Windows button SVGs and clone metadata. Rewrite its own SVG paths. Add notes to the enabled panel IDs locally without changing shared workspace.panels. Add the Notes button with the existing panel select/show/hide behavior, preserving the tab bar's saved per-space panel map and platform chrome.

Create mods/notes/main.js, markdown.js, mod.json (place none, title Notes) and an original note.svg (24px outline page, folded corner, two text lines). The main View uses div/svg from gpui-kit and flex, TextareaState/Textarea, TextView, InputState/Input and Checkbox from gpui-base. Read spaces, theme, settings, window and home from herdr; call run, exec, readTextFile and writeTextFile. Neither custom mod needs props.

Keep a Map of loaded pads per space ID. Each pad holds its path, raw Markdown, last disk snapshot, error/save/loading state and one lazily created native input. Loading a newly selected space starts one asynchronous file read and caches the pad immediately; native text states are created in initialization or a real edit event, never during render. The full-note input updates only its captured pad, even if the active space changes. On close, flush localStorage for recovery.

The display helper parses Markdown headings, paragraphs, quotes, tasks and fenced code while retaining source offsets. Fences close only with the same character and at least the opening length. The checkbox helper changes only its task marker's character; fenced examples remain unchanged. Use native Markdown rendering for body text, task labels and code, and themed native text for headings. These display sections have no individual edit handler or hover state. Source text, including whitespace and final newlines, is never reconstructed from rendered content.

Use actual Markdown files named encodeURIComponent(space.id) + .md. The data directory is home/Library/Application Support/Herdr/notes on macOS, home/.local/share/herdr/notes on Linux and home/AppData/Local/Herdr/notes on Windows. Create it once per mod instance using exec mkdir -p, or PowerShell Directory.CreateDirectory on Windows. Use native readTextFile/writeTextFile for reads and atomic compare-and-write saves. Writes pass the last disk snapshot as expected; null creates a new file. Reveal with open -R on macOS, explorer.exe /select on Windows, or xdg-open on the Linux directory. No shell interpolation of note text, cloud service or network fetch is needed.

Migration is lazy. Existing Markdown takes precedence over legacy localStorage space:<id>; otherwise copy the legacy value into a new file and leave that legacy key unchanged. Recovery drafts use draft:<id> with {text, base}; replay only against the matching base. A mismatched base keeps the draft visible and the original expected snapshot, so Retry cannot overwrite the conflicting external file. Appearance uses a separate local-storage key. Do not store notes in the layout/mod folder or include live data in the public package.

## Watch out

Read the installed AGENTS.md and generated type files first. Use native GPUI, not HTML/CSS/DOM or a web view. Shipped files are replaced on restart: keep personal clones. Do not package generated type files, personal settings, local storage or private screenshots. Keep the panel and panel-body layout IDs, and retain Windows controls and macOS traffic-light padding in the cloned tab bar.

An async callback runs immediately until its first await; spawning alone does not leave the render phase. Never create native text state while rendering or notify during render. Never retain a callback's context across an await; use the context given to the spawned task. Use no redraw timer. The 350ms timer is a cancellable save debounce, not an animation or poll.

A bare numeric line_height was visually wrong in this runtime: use a string with px units. Textarea fills the page and owns its scroll; do not wrap it in another scrolling document or size it as a small paragraph editor. Avoid setting its value on every render, which would disrupt selection. A native check only covers eager rendering; also show the full-note editor and font controls in the actual app.

Notes are local per-space data, not repository files or cross-device sync. Renaming a space keeps its file; a new ID gets a new file. External edits load when the mod reloads; there is no filesystem watcher in this version. Conflicts require manual merging. Local recovery reduces the risk of closing during the debounce but is not a guarantee after forced termination before its storage flush. Reads are limited to the host's 1 MiB text-file limit. Task detection is intended for ordinary bullet checklists and fenced code, not every Markdown dialect. Heading labels are native text rather than a full inline-Markdown editor.

Linux/Windows code paths have not been runtime-tested; macOS is verified. Never publish the raw app frame: crop to demo notes only. Remove temporary demo UI after checking, but retain any demo Markdown the person edited.

## Done when

- Both mods pass herdr-app check, and the actual app shows no new mod/layout errors.
- Notes opens beside Files and Changes and behaves as one continuous page with no mode toggle or paragraph controls.
- Clicking the page produces one full-height native editor containing the exact entire note. Clicking outside or blurring returns to formatted text without changing source or adding separators.
- The same input is reused when re-entering, and an edit from one space still saves to that space after selection changes.
- Clickable task controls update only their source marker; fenced task examples are preserved.
- Fonts follow Herdr by default and Aa preferences persist separately. The path reveals the real Markdown file and can be copied.
- Existing local-storage notes migrate without deleting the old key; existing files take precedence; recoverable drafts restore only against their matching base.
- File-save failures preserve the draft, and a conflicting external edit is not overwritten, including by Retry. Overlapping saves finish with the newest text.
- node --test tests/notes.test.mjs passes. The tests mock native controls and file APIs; do not claim physical keyboard or process-restart testing.
- The public package includes the layout, both custom mods, this recipe, safe preview assets and the herdr-layout topic. Switching to main restores the default layout without ending terminals.
