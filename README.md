# Notepad-Sharp

Notepad# is a lightweight desktop code notepad built with Vite, TypeScript and Tauri. It focuses on fast, distraction-free editing with simple, familiar editor features and native file integration.

![Notepad-Sharp Preview](preview.png)

Website: https://notepad-sharp.vercel.app/

## Features

- Multi-tab editor with reorderable tabs (drag), rename, close, and per-tab cursor/scroll restore.
- Syntax highlighting via CodeMirror 6 with language support for C/C++, Java, XML and additional fallbacks (plus a C# helper integration).
- Two curated themes: **Dracula** (dark) and **GitHub Light** (light) with a toolbar theme toggle that switches the whole UI (toolbar, tabs, dropdowns, editor) between light and dark styles.
- File operations powered by Tauri: Open, Save, Rename, and native file dialogs.
- Editor niceties: undo/redo, fold gutter, indentation markers, line numbers, and zoom (font-size) controls.
- Keyboard shortcuts: `Ctrl+S` (save), `Ctrl+O` (open), `Ctrl+N` (new tab), `Ctrl+W` (close active tab), `Ctrl+Tab` (next tab), `F2` (rename tab), `Ctrl+=`/`Ctrl+-` (zoom), `Ctrl+,` (toggle theme).

## License

This project is available under the license in `LICENSE`.
