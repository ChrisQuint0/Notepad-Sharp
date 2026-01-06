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
using System.Text;

class Program {
  static void Main() {
    int n = int.Parse(Console.ReadLine());
    
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
  // Helper Methods
  // ------------------------------------------------------------------------

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
      case "cpp":
      case "c":
      case "h":
        return [cpp()];
      case "txt":
      case "md":
        return [];
      default:
        return [cpp()];
    }
  }

  private extractFileName(path: string): string {
    return path.split(/[/\\]/).pop() || EDITOR_CONFIG.defaultFileName;
  }

  private async confirmClose(tabName: string): Promise<boolean> {
    return await tauriConfirm(
      `Your changes will be lost if you don't save them.`,
      {
        title: `Close ${tabName}?`,
        kind: "warning",
      }
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
    this.setupKeyboardShortcuts();
  }

  private setupButtonHandlers(): void {
    document.getElementById("btn-new")?.addEventListener("click", () => {
      this.createNewTab();
    });

    document.getElementById("btn-open")?.addEventListener("click", () => {
      this.openFile();
    });

    document.getElementById("btn-save")?.addEventListener("click", () => {
      this.saveFile();
    });
  }

  private setupDropdownHandlers(): void {
    document.getElementById("btn-templates")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const dropdown = document.querySelector(".dropdown-content");
      dropdown?.classList.toggle("show");
    });

    document.addEventListener("click", () => {
      const dropdown = document.querySelector(".dropdown-content");
      dropdown?.classList.remove("show");
    });

    document.querySelectorAll(".dropdown-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const templateType = (e.target as HTMLElement).getAttribute(
          "data-template"
        ) as TemplateType;
        if (templateType) {
          this.insertTemplate(templateType);
        }
      });
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener("keydown", (e) => {
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
