import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

// Create the editor
let currentFilePath: string | null = null;

const startState = EditorState.create({
  doc: "// Welcome to Notepad#\n// Start typing your C# code here...\n\n",
  extensions: [
    lineNumbers(),
    EditorView.lineWrapping,
    keymap.of(defaultKeymap),
    cpp(),
    oneDark,
    EditorState.tabSize.of(2),
  ],
});

const view = new EditorView({
  state: startState,
  parent: document.getElementById("editor-container")!,
});

// Open file
document.getElementById("btn-open")?.addEventListener("click", async () => {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "All Files", extensions: ["*"] },
        { name: "C# Files", extensions: ["cs"] },
        { name: "Text Files", extensions: ["txt"] },
      ],
    });

    if (selected && typeof selected === "string") {
      const contents = await readTextFile(selected);
      currentFilePath = selected;

      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: contents,
        },
      });

      document.title = `Notepad# - ${selected.split("\\").pop()}`;
    }
  } catch (error) {
    console.error("Error opening file:", error);
  }
});

// Save file
document.getElementById("btn-save")?.addEventListener("click", async () => {
  try {
    let filePath = currentFilePath;

    if (!filePath) {
      const selected = await save({
        filters: [
          { name: "All Files", extensions: ["*"] },
          { name: "C# Files", extensions: ["cs"] },
          { name: "Text Files", extensions: ["txt"] },
        ],
      });

      if (selected && typeof selected === "string") {
        filePath = selected;
        currentFilePath = selected;
      }
    }

    if (filePath) {
      const content = view.state.doc.toString();
      await writeTextFile(filePath, content);
      document.title = `Notepad# - ${filePath.split("\\").pop()}`;
      console.log("File saved successfully!");
    }
  } catch (error) {
    console.error("Error saving file:", error);
  }
});

// New file
document.getElementById("btn-new")?.addEventListener("click", () => {
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: "",
    },
  });
  currentFilePath = null;
  document.title = "Notepad#";
});

console.log("Notepad# initialized");
