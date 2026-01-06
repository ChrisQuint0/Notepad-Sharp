# Notepad-Sharp

Built for Christopher Quinto's Potato Laptop, Notepad# is a lightweight, minimalist desktop code notepad built with Vite + TypeScript + Tauri. It gives you a distraction-free UI, multi-tab editing, quick templates for common competitive-programming languages, and a simple code runner powered by the public Piston API.

## What it does

- Multi-tab editor with modified-state badges and title updates.
- Syntax highlighting via CodeMirror (C/C++, Java, basic support for other extensions).
- File open/save backed by Tauri FS + dialog plugins with language filters.
- One-click language templates (C#, C++, Python, Java) and keyboard shortcuts for each.
- “Format & Save” for `.cs` files using js-beautify.
- Code runner modal with input/output panes, basic input detection, and execution through Piston (C/C++/Java/Python/JS; C# execution is blocked and shows a warning).
- Minimal shortcuts: Ctrl+S: format+save, Ctrl+O: open, Ctrl+N: new tab, Ctrl+W: close tab, Ctrl+Tab: next tab, Alt+N: open runner, Ctrl+3/4/5/6: insert templates.

## Tech stack

- Vite + TypeScript frontend
- CodeMirror 6 for editing
- Tauri 2 (FS, dialog, http, opener plugins)
- Piston HTTP API for remote execution

## Just In Case You Want To Work On It

1. Install prerequisites: Node.js (LTS), Rust toolchain, and the Tauri 2 prerequisites for your OS.
2. Install deps: `npm install`
3. Run the desktop app in dev mode: `npm run tauri dev`
4. Build web assets: `npm run build`
5. Build the desktop bundle: `npm run tauri build`

Network access is required for code execution because Piston runs remotely; editing and file operations work offline.
