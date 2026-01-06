// src/managers/EditorManager.ts

import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import {
  defaultKeymap,
  history,
  undo,
  redo,
  indentWithTab,
} from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { Compartment } from "@codemirror/state";

import { TabManager } from "./TabManager";
import { FileService } from "../services/FileService";
import { PistonService } from "../services/PistonService";
import { TemplateService } from "../services/TemplateService";
import { TabRenderer } from "../ui/TabRenderer";
import { ModalManager } from "../ui/ModalManager";
import { EventHandlers } from "../ui/EventHandlers";

import { EDITOR_CONFIG } from "../constants";
import type { TemplateType } from "../types";
import { getLanguageExtension, getLanguageId } from "../utils/languageDetector";
import { formatCode, shouldFormat } from "../utils/codeFormatter";
import { expectsInput, extractFileName } from "../utils/helpers";

export class EditorManager {
  private tabManager: TabManager;
  private fileService: FileService;
  private pistonService: PistonService;
  private templateService: TemplateService;
  private tabRenderer: TabRenderer;
  private modalManager: ModalManager;
  private eventHandlers: EventHandlers;

  private editorView: EditorView;
  private languageConf: Compartment;

  constructor() {
    // Initialize services and managers
    this.tabManager = new TabManager();
    this.fileService = new FileService();
    this.pistonService = new PistonService();
    this.templateService = new TemplateService();
    this.modalManager = new ModalManager();

    // Initialize tab renderer
    this.tabRenderer = new TabRenderer(
      (id) => this.switchToTab(id),
      (id) => this.closeTab(id)
    );

    // Initialize event handlers
    this.eventHandlers = new EventHandlers({
      onNewFile: () => this.createNewTab(),
      onOpenFile: () => this.openFile(),
      onSaveFile: () => this.saveFile(),
      onRunCode: () => this.runCode(),
      onShowRunnerModal: () => this.modalManager.showRunnerModal(),
      onHideRunnerModal: () => this.modalManager.hideRunnerModal(),
      onToggleInput: () => this.modalManager.toggleInputSection(),
      onClearOutput: () => this.modalManager.clearOutput(),
      onInsertTemplate: (type) => this.insertTemplate(type),
      onCloseActiveTab: () => this.closeActiveTab(),
      onSwitchNextTab: () => this.switchToNextTab(),
      onFormatAndSave: () => this.formatAndSave(),
      onHideCSharpWarning: () => this.modalManager.hideCSharpWarningModal(),
    });

    // Initialize editor
    this.languageConf = new Compartment();
    this.editorView = this.createEditor();

    // Initialize UI
    this.eventHandlers.initialize();

    // Create initial tab
    this.createNewTab(
      EDITOR_CONFIG.defaultFileName,
      null,
      EDITOR_CONFIG.welcomeMessage
    );
  }

  // ========================================================================
  // Editor Initialization
  // ========================================================================

  private createEditor(): EditorView {
    const startState = EditorState.create({
      doc: "",
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
    const activeTab = this.tabManager.getActiveTab();
    if (!activeTab) return;

    const currentContent = this.editorView.state.doc.toString();
    this.tabManager.updateTabContent(activeTab.id, currentContent);
    this.renderTabs();
  }

  // ========================================================================
  // Tab Operations
  // ========================================================================

  public createNewTab(
    name: string = EDITOR_CONFIG.defaultFileName,
    path: string | null = null,
    content: string = ""
  ): void {
    const tab = this.tabManager.createTab(name, path, content);
    this.updateEditorContent(tab.content);
    this.updateLanguage(tab.path);
    this.renderTabs();
    this.updateTitle(tab.name);
  }

  public switchToTab(tabId: number): void {
    if (!this.tabManager.switchToTab(tabId)) return;

    const tab = this.tabManager.getActiveTab();
    if (!tab) return;

    this.updateEditorContent(tab.content);
    this.updateLanguage(tab.path);
    this.renderTabs();
    this.updateTitle(tab.name);
  }

  public async closeTab(tabId: number): Promise<void> {
    const wasActive = this.tabManager.getActiveTabId() === tabId;
    const closed = await this.tabManager.closeTab(tabId);

    if (!closed) return;

    if (wasActive) {
      if (this.tabManager.hasNoTabs()) {
        this.createNewTab();
      } else {
        const newActiveTab = this.tabManager.getActiveTab();
        if (newActiveTab) {
          this.updateEditorContent(newActiveTab.content);
          this.updateLanguage(newActiveTab.path);
          this.updateTitle(newActiveTab.name);
        }
      }
    }

    this.renderTabs();
  }

  public closeActiveTab(): void {
    const activeTabId = this.tabManager.getActiveTabId();
    if (activeTabId !== null) {
      this.closeTab(activeTabId);
    }
  }

  public switchToNextTab(): void {
    this.tabManager.switchToNextTab();
    const activeTab = this.tabManager.getActiveTab();
    if (activeTab) {
      this.updateEditorContent(activeTab.content);
      this.updateLanguage(activeTab.path);
      this.renderTabs();
      this.updateTitle(activeTab.name);
    }
  }

  // ========================================================================
  // File Operations
  // ========================================================================

  public async openFile(): Promise<void> {
    try {
      const result = await this.fileService.openFile();
      if (result) {
        this.createNewTab(result.name, result.path, result.content);
      }
    } catch (error) {
      console.error("Error opening file:", error);
    }
  }

  public async saveFile(): Promise<void> {
    const activeTab = this.tabManager.getActiveTab();
    if (!activeTab) return;

    try {
      let filePath = activeTab.path;

      if (!filePath) {
        filePath = await this.fileService.promptSaveLocation();
        if (!filePath) return;

        const fileName = extractFileName(filePath);
        this.tabManager.updateTabPath(activeTab.id, filePath, fileName);
      }

      const content = this.editorView.state.doc.toString();
      await this.fileService.saveFile(filePath, content);

      this.tabManager.markTabSaved(activeTab.id, content);
      this.updateLanguage(filePath);
      this.renderTabs();
      this.updateTitle(activeTab.name);

      console.log("File saved successfully!");
    } catch (error) {
      console.error("Error saving file:", error);
    }
  }

  // ========================================================================
  // Template Operations
  // ========================================================================

  public insertTemplate(templateType: TemplateType): void {
    const template = this.templateService.getTemplate(templateType);
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

    const activeTab = this.tabManager.getActiveTab();
    if (activeTab) {
      this.tabManager.markTabModified(activeTab.id);
      this.renderTabs();
    }
  }

  // ========================================================================
  // Code Formatting
  // ========================================================================

  public formatAndSave(): void {
    this.formatCodeInEditor();
    this.saveFile();
  }

  private formatCodeInEditor(): void {
    const activeTab = this.tabManager.getActiveTab();
    if (!activeTab || !shouldFormat(activeTab.path)) {
      console.log("Auto-format only works for .cs files");
      return;
    }

    const currentCode = this.editorView.state.doc.toString();
    const formatted = formatCode(currentCode);

    if (formatted !== currentCode) {
      this.editorView.dispatch({
        changes: {
          from: 0,
          to: this.editorView.state.doc.length,
          insert: formatted,
        },
      });

      this.tabManager.updateTabContent(activeTab.id, formatted);
      console.log("Code formatted!");
    }
  }

  // ========================================================================
  // Code Execution
  // ========================================================================

  private async runCode(): Promise<void> {
    const activeTab = this.tabManager.getActiveTab();
    if (!activeTab) {
      this.modalManager.displayOutput("No active file to run!", "error");
      return;
    }

    const language = getLanguageId(activeTab.path);
    if (!language) {
      this.modalManager.displayOutput(
        "Unsupported file type! Supported: .cs, .cpp, .c, .py, .java, .js",
        "error"
      );
      return;
    }

    if (language === "csharp") {
      this.modalManager.showCSharpWarningModal();
      return;
    }

    const inputTextarea = document.getElementById(
      "code-input"
    ) as HTMLTextAreaElement;
    const stdin = inputTextarea?.value || "";

    this.modalManager.setRunButtonState(true, "Running...");
    this.modalManager.displayOutput("Executing code...", "running");

    try {
      const code = this.editorView.state.doc.toString();

      if (expectsInput(code) && !stdin.trim()) {
        this.modalManager.displayOutput(
          "This program is waiting for input.\n\nPlease provide input in the Input box before running.",
          "error"
        );
        return;
      }

      const result = await this.pistonService.executeCode(
        language,
        code,
        stdin
      );
      const { text, type } = this.pistonService.formatOutput(result);
      this.modalManager.displayOutput(text, type);
    } catch (error) {
      console.error("Code execution error:", error);
      this.modalManager.displayOutput(
        `Error: ${
          error instanceof Error ? error.message : "Failed to execute code"
        }`,
        "error"
      );
    } finally {
      this.modalManager.setRunButtonState(false, "Run Code");
    }
  }

  // ========================================================================
  // UI Updates
  // ========================================================================

  private renderTabs(): void {
    const tabs = this.tabManager.getAllTabs();
    const activeTabId = this.tabManager.getActiveTabId();
    this.tabRenderer.render(tabs, activeTabId);
  }

  private updateTitle(tabName: string): void {
    document.title = `Notepad# - ${tabName}`;
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
    const langExtension = getLanguageExtension(filePath);
    this.editorView.dispatch({
      effects: this.languageConf.reconfigure(langExtension),
    });
  }
}
