import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import {
  defaultKeymap,
  history,
  undo,
  redo,
  indentWithTab,
} from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { oneDark } from "@codemirror/theme-one-dark";
import { open, save, confirm as tauriConfirm } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Compartment } from "@codemirror/state";
import * as beautify from "js-beautify";

// ============================================================================
// Types & Interfaces
// ============================================================================

interface Tab {
  id: number;
  name: string;
  path: string | null;
  content: string;
  savedContent: string;
  modified: boolean;
}

type TemplateType = "csharp" | "cpp" | "python" | "java";

interface FileFilter {
  name: string;
  extensions: string[];
}

interface PistonExecuteRequest {
  language: string;
  version: string;
  files: Array<{
    content: string;
    name?: string; // ← ADD THIS
  }>;
  stdin?: string;
  compile_timeout?: number;
  run_timeout?: number;
}

interface PistonExecuteResponse {
  language: string;
  version: string;
  compile?: {
    stdout: string;
    stderr: string;
    code: number;
    output: string;
  };
  run: {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: string | null;
    output: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const FILE_FILTERS: FileFilter[] = [
  { name: "All Files", extensions: ["*"] },
  { name: "C# Files", extensions: ["cs"] },
  { name: "C++ Files", extensions: ["cpp", "c", "h"] },
  { name: "Python Files", extensions: ["py"] },
  { name: "Java Files", extensions: ["java"] },
  { name: "Text Files", extensions: ["txt", "md"] },
];

const CODE_TEMPLATES: Record<TemplateType, string> = {
  csharp: `using System;
using System.Linq;
using System.Collections.Generic;

class Program {
  static void Main() {
    int n = int.Parse(Console.ReadLine());
    Console.WriteLine("You entered: " + n);
  }
}`,

  cpp: `#include <bits/stdc++.h>
using namespace std;

#define ll long long
#define pb push_back
#define all(x) x.begin(), x.end()
#define MOD 1000000007

int main() {
  ios_base::sync_with_stdio(false);
  cin.tie(NULL);
  
  
  return 0;
}`,

  python: `import sys
input = sys.stdin.readline

def main():
  

if __name__ == "__main__":
  main()`,

  java: `import java.util.*;
import java.io.*;

public class Main {
  public static void main(String[] args) {
    
  }
}`,
};

const EDITOR_CONFIG = {
  tabSize: 2,
  defaultFileName: "Untitled",
  welcomeMessage:
    "// Welcome to Notepad#\n// Start typing your code here...\n\n",
};

const PISTON_API = {
  baseUrl: "https://emkc.org/api/v2/piston",
};

const LANGUAGE_IDS: Record<string, string> = {
  cs: "csharp",
  cpp: "cpp",
  c: "c",
  py: "python",
  java: "java",
  js: "javascript",
};

// ============================================================================
// Editor Manager Class
// ============================================================================

class EditorManager {
  private tabs: Tab[] = [];
  private activeTabId: number | null = null;
  private nextTabId: number = 1;
  private editorView: EditorView;
  private languageConf: Compartment;

  constructor() {
    this.languageConf = new Compartment();
    this.editorView = this.createEditor();
    this.initializeUI();
    this.createNewTab(
      EDITOR_CONFIG.defaultFileName,
      null,
      EDITOR_CONFIG.welcomeMessage
    );
  }

  private showCSharpWarningModal(): void {
    const modal = document.getElementById("csharp-warning-modal");
    modal?.classList.add("show");
  }

  private hideCSharpWarningModal(): void {
    const modal = document.getElementById("csharp-warning-modal");
    modal?.classList.remove("show");
  }

  // ------------------------------------------------------------------------
  // Editor Initialization
  // ------------------------------------------------------------------------

  private createEditor(content: string = ""): EditorView {
    const startState = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        EditorView.lineWrapping,
        history(),
        keymap.of([
          ...defaultKeymap,
          indentWithTab,
          { key: "Mod-z", run: undo },
          { key: "Mod-y", run: redo },
        ]),
        this.languageConf.of([]),
        oneDark,
        EditorState.tabSize.of(EDITOR_CONFIG.tabSize),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.handleContentChange();
          }
        }),
      ],
    });

    return new EditorView({
      state: startState,
      parent: document.getElementById("editor-container")!,
    });
  }

  private handleContentChange(): void {
    if (this.activeTabId === null) return;

    const activeTab = this.findTabById(this.activeTabId);
    if (!activeTab) return;

    const currentContent = this.editorView.state.doc.toString();
    activeTab.content = currentContent;
    activeTab.modified = currentContent !== activeTab.savedContent;
    this.renderTabs();
  }

  // ------------------------------------------------------------------------
  // Tab Management
  // ------------------------------------------------------------------------

  public createNewTab(
    name: string = EDITOR_CONFIG.defaultFileName,
    path: string | null = null,
    content: string = ""
  ): Tab {
    const tab: Tab = {
      id: this.nextTabId++,
      name,
      path,
      content,
      savedContent: content,
      modified: false,
    };

    this.tabs.push(tab);
    this.switchToTab(tab.id);
    return tab;
  }

  public switchToTab(tabId: number): void {
    const tab = this.findTabById(tabId);
    if (!tab) return;

    this.saveCurrentTabContent();
    this.activeTabId = tabId;
    this.updateEditorContent(tab.content);
    this.updateLanguage(tab.path);
    this.renderTabs();
    this.updateTitle(tab.name);
  }

  public async closeTab(tabId: number): Promise<void> {
    const tabIndex = this.tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = this.tabs[tabIndex];

    if (tab.modified && !(await this.confirmClose(tab.name))) {
      return;
    }

    this.tabs.splice(tabIndex, 1);

    if (tab.id === this.activeTabId) {
      this.handleActiveTabClosed(tabIndex);
    } else {
      this.renderTabs();
    }
  }

  private handleActiveTabClosed(closedIndex: number): void {
    if (this.tabs.length > 0) {
      const newActiveTab = this.tabs[Math.max(0, closedIndex - 1)];
      this.switchToTab(newActiveTab.id);
    } else {
      this.createNewTab();
    }
  }

  public closeActiveTab(): void {
    if (this.activeTabId !== null) {
      this.closeTab(this.activeTabId);
    }
  }

  public switchToNextTab(): void {
    if (this.tabs.length <= 1) return;

    const currentIndex = this.tabs.findIndex((t) => t.id === this.activeTabId);
    const nextIndex = (currentIndex + 1) % this.tabs.length;
    this.switchToTab(this.tabs[nextIndex].id);
  }

  // ------------------------------------------------------------------------
  // File Operations
  // ------------------------------------------------------------------------

  public async openFile(): Promise<void> {
    try {
      const selected = await open({
        multiple: false,
        filters: FILE_FILTERS,
      });

      if (selected && typeof selected === "string") {
        const contents = await readTextFile(selected);
        const fileName = this.extractFileName(selected);
        this.createNewTab(fileName, selected, contents);
      }
    } catch (error) {
      console.error("Error opening file:", error);
    }
  }

  public async saveFile(): Promise<void> {
    if (this.activeTabId === null) return;

    const activeTab = this.findTabById(this.activeTabId);
    if (!activeTab) return;

    try {
      let filePath = activeTab.path;

      if (!filePath) {
        filePath = await this.promptSaveLocation();
        if (!filePath) return;

        activeTab.path = filePath;
        activeTab.name = this.extractFileName(filePath);
      }

      const content = this.editorView.state.doc.toString();
      await writeTextFile(filePath, content);

      activeTab.modified = false;
      activeTab.content = content;
      activeTab.savedContent = content;

      this.updateLanguage(filePath);
      this.renderTabs();
      this.updateTitle(activeTab.name);

      console.log("File saved successfully!");
    } catch (error) {
      console.error("Error saving file:", error);
    }
  }

  private async promptSaveLocation(): Promise<string | null> {
    const selected = await save({ filters: FILE_FILTERS });
    return selected && typeof selected === "string" ? selected : null;
  }

  // ------------------------------------------------------------------------
  // Template Operations
  // ------------------------------------------------------------------------

  public insertTemplate(templateType: TemplateType): void {
    const template = CODE_TEMPLATES[templateType];
    if (!template) return;

    const currentPos = this.editorView.state.selection.main.head;

    this.editorView.dispatch({
      changes: {
        from: currentPos,
        to: currentPos,
        insert: template,
      },
      selection: { anchor: currentPos + template.length },
    });

    this.markActiveTabModified();
  }

  // ------------------------------------------------------------------------
  // Code Formatting
  // ------------------------------------------------------------------------

  public formatCode(): void {
    if (this.activeTabId === null) return;

    const activeTab = this.findTabById(this.activeTabId);
    if (!activeTab || !this.shouldFormat(activeTab.path)) {
      console.log("Auto-format only works for .cs files");
      return;
    }

    const currentCode = this.editorView.state.doc.toString();
    const formatted = this.beautifyCode(currentCode);

    if (formatted !== currentCode) {
      this.editorView.dispatch({
        changes: {
          from: 0,
          to: this.editorView.state.doc.length,
          insert: formatted,
        },
      });

      activeTab.content = formatted;
      console.log("Code formatted!");
    }
  }

  private shouldFormat(path: string | null): boolean {
    return path !== null && path.endsWith(".cs");
  }

  private beautifyCode(code: string): string {
    return beautify.js_beautify(code, {
      indent_size: EDITOR_CONFIG.tabSize,
      indent_char: " ",
      max_preserve_newlines: 2,
      preserve_newlines: true,
      keep_array_indentation: false,
      break_chained_methods: false,
      brace_style: "collapse",
      space_before_conditional: true,
      unescape_strings: false,
      jslint_happy: false,
      end_with_newline: false,
      wrap_line_length: 0,
      comma_first: false,
      indent_empty_lines: false,
    });
  }

  // ------------------------------------------------------------------------
  // UI Updates
  // ------------------------------------------------------------------------

  private renderTabs(): void {
    const tabBar = document.getElementById("tab-bar");
    if (!tabBar) return;

    tabBar.innerHTML = "";

    this.tabs.forEach((tab) => {
      const tabEl = this.createTabElement(tab);
      tabBar.appendChild(tabEl);
    });
  }

  private createTabElement(tab: Tab): HTMLButtonElement {
    const tabEl = document.createElement("button");
    tabEl.className = this.getTabClasses(tab);
    tabEl.setAttribute("tabindex", "-1");
    tabEl.onclick = () => this.switchToTab(tab.id);

    const nameSpan = document.createElement("span");
    nameSpan.className = "tab-name";
    nameSpan.textContent = tab.name;

    const closeBtn = document.createElement("span");
    closeBtn.className = "tab-close";
    closeBtn.innerHTML = "×";
    closeBtn.onclick = async (e) => {
      e.stopPropagation();
      await this.closeTab(tab.id);
    };

    tabEl.appendChild(nameSpan);
    tabEl.appendChild(closeBtn);

    return tabEl;
  }

  private getTabClasses(tab: Tab): string {
    const classes = ["tab"];
    if (tab.id === this.activeTabId) classes.push("active");
    if (tab.modified) classes.push("modified");
    return classes.join(" ");
  }

  private updateTitle(tabName: string): void {
    document.title = `Notepad# - ${tabName}`;
  }

  // ------------------------------------------------------------------------
  // Code Runner Modal
  // ------------------------------------------------------------------------

  private showRunnerModal(): void {
    const modal = document.getElementById("runner-modal");
    if (modal) {
      modal.classList.add("show");
    }
  }

  private hideRunnerModal(): void {
    const modal = document.getElementById("runner-modal");
    if (modal) {
      modal.classList.remove("show");
    }
  }

  private toggleInputSection(): void {
    const inputTextarea = document.getElementById(
      "code-input"
    ) as HTMLTextAreaElement;
    const toggleBtn = document.getElementById("toggle-input");

    if (inputTextarea && toggleBtn) {
      inputTextarea.classList.toggle("collapsed");
      toggleBtn.classList.toggle("collapsed");

      toggleBtn.textContent = inputTextarea.classList.contains("collapsed")
        ? "▶"
        : "▼";
    }
  }

  private clearOutput(): void {
    const outputDisplay = document.getElementById("code-output");
    if (outputDisplay) {
      outputDisplay.innerHTML =
        '<div class="output-placeholder">Click "Run Code" to see output</div>';
    }
  }

  private displayOutput(
    text: string,
    type: "running" | "success" | "error" = "success"
  ): void {
    const outputDisplay = document.getElementById("code-output");
    if (outputDisplay) {
      outputDisplay.className = `output-display output-${type}`;
      outputDisplay.textContent = text;
    }
  }

  // ------------------------------------------------------------------------
  // Code Execution
  // ------------------------------------------------------------------------

  private getLanguageId(filePath: string | null): string {
    if (!filePath) return "";
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    return LANGUAGE_IDS[ext] || "";
  }

  private async runCode(): Promise<void> {
    if (this.activeTabId === null) {
      this.displayOutput("No active file to run!", "error");
      return;
    }

    const activeTab = this.findTabById(this.activeTabId);
    if (!activeTab) {
      this.displayOutput("Could not find active tab!", "error");
      return;
    }

    const language = this.getLanguageId(activeTab.path);
    if (!language) {
      this.displayOutput(
        "Unsupported file type! Supported: .cs, .cpp, .c, .py, .java, .js",
        "error"
      );
      return;
    }

    if (language === "csharp") {
      this.showCSharpWarningModal();
      return;
    }

    const inputTextarea = document.getElementById(
      "code-input"
    ) as HTMLTextAreaElement;

    const runButton = document.getElementById(
      "btn-run-code"
    ) as HTMLButtonElement;
    if (runButton) {
      runButton.disabled = true;
      runButton.textContent = "Running...";
    }

    this.displayOutput("Executing code...", "running");

    try {
      const code = this.editorView.state.doc.toString();
      const stdin = inputTextarea?.value || "";

      if (this.expectsInput(code) && !stdin.trim()) {
        this.displayOutput(
          "This program is waiting for input.\n\nPlease provide input in the Input box before running.",
          "error"
        );
        return;
      }

      const result = await this.executeWithPiston(language, code, stdin);
      this.displayPistonResult(result);
    } catch (error) {
      console.error("Code execution error:", error);
      this.displayOutput(
        `Error: ${
          error instanceof Error ? error.message : "Failed to execute code"
        }`,
        "error"
      );
    } finally {
      if (runButton) {
        runButton.disabled = false;
        runButton.textContent = "Run Code";
      }
    }
  }

  // Piston for other languages
  private async executeWithPiston(
    language: string,
    code: string,
    stdin: string
  ): Promise<PistonExecuteResponse> {
    const formattedStdin = stdin
      ? stdin.endsWith("\n")
        ? stdin
        : stdin + "\n"
      : "";

    const isCSharp = language === "csharp";

    const payload: PistonExecuteRequest = {
      language,
      version: "*",
      files: [{ name: "Program.cs", content: code }],
      stdin: formattedStdin || undefined,
      compile_timeout: 20000,
      run_timeout: isCSharp ? 20000 : 5000,
    };

    const response = await fetch(`${PISTON_API.baseUrl}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Piston error:", err);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  private displayPistonResult(result: PistonExecuteResponse): void {
    let output = "";
    let type: "success" | "error" = "success";

    if (result.run.signal === "SIGKILL") {
      type = "error";
      output = "⚠️ Program terminated (timeout or waiting for input)\n";
      if (result.run.stdout) output += `\nOutput:\n${result.run.stdout}`;
    } else if (result.compile && result.compile.code !== 0) {
      type = "error";
      output = "❌ Compilation Failed\n\n";
      output += result.compile.stderr || result.compile.output || "";
    } else if (result.run.code === 0 || result.run.code === null) {
      type = "success";
      output =
        result.run.stdout ||
        result.run.output ||
        "✓ Program executed successfully (No output)";
    } else {
      type = "error";
      output = `❌ Runtime Error (Exit Code: ${result.run.code})\n\n`;
      if (result.run.stderr) output += result.run.stderr;
      if (result.run.stdout) output += `\nOutput:\n${result.run.stdout}`;
    }

    this.displayOutput(output, type);
  }

  // ------------------------------------------------------------------------
  // Helper Methods
  // ------------------------------------------------------------------------

  private expectsInput(code: string): boolean {
    return /Console\.ReadLine\s*\(/.test(code);
  }

  private findTabById(id: number): Tab | undefined {
    return this.tabs.find((t) => t.id === id);
  }

  private saveCurrentTabContent(): void {
    if (this.activeTabId === null) return;
    const currentTab = this.findTabById(this.activeTabId);
    if (currentTab) {
      currentTab.content = this.editorView.state.doc.toString();
    }
  }

  private updateEditorContent(content: string): void {
    this.editorView.dispatch({
      changes: {
        from: 0,
        to: this.editorView.state.doc.length,
        insert: content,
      },
    });
  }

  private updateLanguage(filePath: string | null): void {
    const langExtension = this.getLanguageExtension(filePath);
    this.editorView.dispatch({
      effects: this.languageConf.reconfigure(langExtension),
    });
  }

  private getLanguageExtension(filePath: string | null) {
    if (!filePath) return [];
    const ext = filePath.split(".").pop()?.toLowerCase();

    switch (ext) {
      case "cs":
        return [cpp()];
      case "cpp":
        return [cpp()];
      case "c":
        return [cpp()];
      case "h":
        return [cpp()];
      case "java":
        return [java()];
      case "py":
        return [cpp()];
      default:
        return [];
    }
  }

  private extractFileName(path: string): string {
    return path.split(/[/\\]/).pop() || EDITOR_CONFIG.defaultFileName;
  }

  private async confirmClose(tabName: string): Promise<boolean> {
    return await tauriConfirm(
      `Your changes will be lost if you don't save them.`,
      { title: `Close ${tabName}?`, kind: "warning" }
    );
  }

  private markActiveTabModified(): void {
    if (this.activeTabId === null) return;
    const activeTab = this.findTabById(this.activeTabId);
    if (activeTab) {
      activeTab.modified = true;
      this.renderTabs();
    }
  }

  // ------------------------------------------------------------------------
  // Event Handlers
  // ------------------------------------------------------------------------

  private initializeUI(): void {
    this.setupButtonHandlers();
    this.setupDropdownHandlers();
    this.setupModalHandlers();
    this.setupKeyboardShortcuts();
    document
      .getElementById("csharp-warning-close")
      ?.addEventListener("click", () => this.hideCSharpWarningModal());
  }

  private setupButtonHandlers(): void {
    document
      .getElementById("btn-new")
      ?.addEventListener("click", () => this.createNewTab());
    document
      .getElementById("btn-open")
      ?.addEventListener("click", () => this.openFile());
    document
      .getElementById("btn-save")
      ?.addEventListener("click", () => this.saveFile());
    document
      .getElementById("btn-run")
      ?.addEventListener("click", () => this.showRunnerModal());
  }

  private setupModalHandlers(): void {
    document
      .getElementById("modal-close")
      ?.addEventListener("click", () => this.hideRunnerModal());
    document.getElementById("runner-modal")?.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).id === "runner-modal") {
        this.hideRunnerModal();
      }
    });
    document
      .getElementById("toggle-input")
      ?.addEventListener("click", () => this.toggleInputSection());
    document
      .getElementById("btn-clear-output")
      ?.addEventListener("click", () => this.clearOutput());
    document
      .getElementById("btn-run-code")
      ?.addEventListener("click", () => this.runCode());
  }

  private setupDropdownHandlers(): void {
    document.getElementById("btn-templates")?.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelector(".dropdown-content")?.classList.toggle("show");
    });
    document.addEventListener("click", () => {
      document.querySelector(".dropdown-content")?.classList.remove("show");
    });
    document.querySelectorAll(".dropdown-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const templateType = (e.target as HTMLElement).getAttribute(
          "data-template"
        ) as TemplateType;
        if (templateType) this.insertTemplate(templateType);
      });
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const modal = document.getElementById("runner-modal");
        if (modal?.classList.contains("show")) {
          e.preventDefault();
          this.hideRunnerModal();
          return;
        }
      }

      if (!e.ctrlKey) return;

      const shortcuts: Record<string, () => void> = {
        "3": () => this.insertTemplate("csharp"),
        "4": () => this.insertTemplate("cpp"),
        "5": () => this.insertTemplate("python"),
        "6": () => this.insertTemplate("java"),
        s: () => {
          this.formatCode();
          this.saveFile();
        },
        o: () => this.openFile(),
        n: () => this.createNewTab(),
        w: () => this.closeActiveTab(),
        Tab: () => this.switchToNextTab(),
      };

      if (e.altKey && e.key === "n") {
        e.preventDefault();
        this.showRunnerModal();
        return;
      }

      const handler = shortcuts[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    });
  }
}

// ============================================================================
// Application Entry Point
// ============================================================================

new EditorManager();
console.log("Notepad# initialized successfully");
