# Notes

Keep a Markdown pad beside your terminals in Herdr. The familiar default interface stays in place, with a Notes button beside Files and Changes. Opening it reveals a quiet editor for the active space, a reading preview, and a small save/task status footer. Each space has its own local pad.

![Notes](preview.png)

## What you see

Left to right, use the default Herdr arrangement: a 268px spaces/agents sidebar, the terminal work area, and an optional right panel. The left sidebar has a 46px brand row, equal-weight spaces and agents lists (90px minimum each), and a 69px footer. The center has a 42px tab bar, a work area with 8px padding and gaps, and a 28px status bar. Terminal cards have 10px corners, 1px borders and focus outlines, and 30px headers.

The right panel starts at 400px, resizes between 280px and 900px, and shows one of Files, Changes or Notes. It starts closed unless restored by the tab bar's per-space panel memory. The Notes button is always available; Files and Changes respect Herdr's existing panel preferences.

Notes uses the current theme's background, chrome, foreground, muted, dim, accent, selected, hover and border colors. Do not pin a theme or change the person's fonts. The Notes card has 10px corners and a 1px border. Its 44px header holds a 16px outline document icon, the title Notes, a truncated space name, and a close button. A 42px strip below holds Write and Preview buttons. The content area has 12px padding. The editor uses 13px monospace text, wraps long lines, and omits line numbers and folding. The footer has 12px horizontal and 9px vertical padding, with 10.5px save and task text. The rest of the panel uses 12px text.

The included screenshot is a crop of the real rendered right panel, using a disposable Demo project pad. It shows a heading, a short paragraph, a three-item checklist and a scratchpad paragraph. Demo content does not appear in a new installed pad. Supply the same image as `layouts/notes.png` for the settings picker.

## How it behaves

Click Notes to select and show the right panel. Click it again, or the Notes card's ×, to close the panel. Files and Changes select their existing panels in the same place. Drag the panel boundary to resize it. The chosen panel or closed state is remembered separately for each space.

Write is the initial mode. Every editor change immediately updates local storage for that editor's space. The footer shows Saving… until the storage flush resolves, then Autosaved locally. A synchronous storage error or a failed flush shows Save failed with the error, while keeping the draft in the editor. Do not require a save shortcut. Write/Preview selection lasts for the mod instance and is shared across spaces in that instance.

Preview renders the Markdown and allows text selection and scrolling. It shows a short hint for an empty pad. Edit task markers in Write mode; preview checkboxes are not connected to the pad. Count task lines and completed markers in the footer, or show Markdown · - [ ] todo when there are none. A new space gets an empty pad; a tab change within a space keeps that space's pad. With no active space, show Open a space to keep notes.

Keep inherited tab behavior: selecting and closing tabs, the new-tab popup, right-click menus, double-click rename, tab reordering by press/release, wheel navigation and native window controls. Hover gives controls the theme's hover background. No new keybindings are installed.

Agent statuses retain the shipped visual behavior. Working tabs have a native rotating spinner using the working color; blocked and done tabs have a small dot in their status color. Idle tabs have no activity marker. The shipped agent and space lists keep their original status display and navigation. Notes does not change any agent state or send terminal input.

## Built from

Create `layouts/notes.json` as a personal clone of Herdr 0.1.13's main layout, with `cloned_from` metadata and `preview: layouts/notes.png`. Preserve the main tree: root row → sidebar column and work column; sidebar → brand, sidebar-lists (spaces, agents), sidebar-footer; work → tabs, work-body row, status; work-body → main active-tab block and panel column; panel → panel-body stack. The stack contains files, changes and the added notes block. Keep the default active child files and panel hidden flag. Set the panel's starting width to 400px.

Use the shipped workspace-chrome, spaces, agents, pane, files, changes, workspace-status, new-menu and menu mods and their existing assets. Replace only the tab bar's content with `notes-tabs`. Add `mods/notes/` containing main.js, mod.json and note.svg. Both custom mods have place none, so only the layout places them. Neither requires props. Add `mods/notes-tabs/` as a clone of the shipped tabs mod, including its four Windows button SVGs, and preserve clone metadata. Rewrite that clone's own Windows asset paths to its new folder.

In notes-tabs, preserve the existing localStorage panel map and synchronization logic. Add notes to the enabled panel IDs without mutating the shared workspace.panels preference. Add the Notes panel button with the same select/show/hide behavior as Files and Changes. Use the Notes mod's document SVG. Preserve default tab handling and window controls. It reads spaces, panes, theme, window, shared, layout and settings; calls run and openOverlay; and stores its panel selection map in localStorage. It calls the inherited tab/window commands plus layout.select, layout.show and layout.hide.

Implement Notes as a default-exported View class using gpui-kit's div/svg and gpui-base's flex builders, EditorState, Editor and TextView. Read spaces, theme and settings from herdr. Read the active space on initialization, create its editor, and retain pads in a Map keyed by space ID. On a newly selected space, create its editor from a spawned task outside render and notify. Each editor change callback must capture that pad's space key, rather than consulting the currently selected space. Use localStorage key space:<id>. Store the raw Markdown text; await localStorage.flush for the save status and in close. Track a revision per pad so an older successful flush cannot report a newer draft saved.

Use TextView.markdown for preview and a native editable Editor with language markdown, soft wrapping, line numbers off and folding off. Obtain the monospace font from settings. The only app command Notes invokes is layout.hide for its close button. It runs no external programs, issues no fetch calls and reads no project files. The inherited Files and Changes mods retain their own filesystem and Git operations. The document icon is an original stroked SVG with a folded corner and two horizontal lines. No other art is needed.

## Watch out

Read the installed Herdr AGENTS.md and generated type files before building. Use native GPUI elements, not HTML, CSS, a DOM or a web view. Built-in layouts and mods are replaced by Herdr on startup: clone them rather than editing them. Do not bundle the generated type files, personal settings, live storage or terminal captures.

Never retain a callback's context for later use. Use the context passed to each event or spawned task. Create retained editor states in initialization or a task, not repeatedly in render. No redraw timer or polling is needed. Native data updates trigger rerenders; the inherited working spinner animates natively.

Storage belongs to this mod copy on this computer. It is not a checked-in Markdown file, a cross-device sync service, a shared team note, or a pad keyed by repository folder. A differently identified space gets a different pad. Changing block identities or cloning the mod may change its storage identity; do not promise migration between those copies. Herdr persists storage in the background, so a forced termination before flush can lose the last edit. Save errors must remain visible rather than silently claiming success.

Preview checkboxes have no handler that writes back into the editor. The task count is deliberately line based: match /^\s*[-*+] \[[ xX]\] /gm, then count x/X markers. It includes task-looking lines inside code fences. There is no export, search, archive, formatting toolbar, task reordering or custom keyboard shortcut. Do not invent those controls.

The Notes mod depends on panel being the right sidebar's layout ID, and the tab bar depends on panel-body being the stack ID. Keep those IDs. Shared workspace.panels may exclude Files or Changes; always add Notes locally without changing that preference. Preserve platform window buttons and macOS traffic-light padding when cloning the tabs mod.

## Done when

- Both custom mods pass herdr-app check with the installed native runtime.
- The notes layout loads with Files, Changes and Notes in the right-panel controls, subject to existing Files/Changes preferences.
- The actual window renders the Notes header, Write/Preview strip, editor or Markdown content, and save/task footer without new mod or layout errors.
- A Markdown change is stored under its own space key, and a fresh mod instance using that storage restores it.
- A second space starts empty; an edit callback from the first space still saves to the first space after selection changes.
- A simulated storage failure leaves the draft intact and displays Save failed.
- The unit tests in tests/notes.test.mjs pass. Their native controls and storage are mocked; do not describe them as physical keyboard or process-restart testing.
- The public preview contains only disposable demo notes. The shipped layout references its own preview image, and the package has no live note data or private workspace capture.
- Switching to main returns to the default layout without ending terminals. The public package contains the layout, both custom mods, recipe and preview, with the herdr-layout topic on its repository.
