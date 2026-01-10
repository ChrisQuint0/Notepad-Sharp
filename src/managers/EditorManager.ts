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
import { Compartment } from "@codemirror/state";

import { TabManager } from "./TabManager";
import { SettingsManager } from "./SettingsManager";
import { FileService } from "../services/FileService";
import { PistonService } from "../services/PistonService";
import { TemplateService } from "../services/TemplateService";
import { TabRenderer } from "../ui/TabRenderer";
import { ModalManager } from "../ui/ModalManager";
import { SettingsModalManager } from "../ui/SettingsModalManager";
import { EventHandlers } from "../ui/EventHandlers";

import { EDITOR_CONFIG } from "../constants";
import type { TemplateType } from "../types";
import { getLanguageExtension, getLanguageId } from "../utils/languageDetector";
import { expectsInput, extractFileName } from "../utils/helpers";
import { getThemeExtension } from "../utils/themeUtils";
import { bracketMatching } from "@codemirror/language";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { foldGutter, foldKeymap } from "@codemirror/language";

export class EditorManager {
  private tabManager: TabManager;
  private settingsManager: SettingsManager;
  private fileService: FileService;
  private pistonService: PistonService;
  private templateService: TemplateService;
  private tabRenderer: TabRenderer;
  private modalManager: ModalManager;
  private settingsModalManager: SettingsModalManager;
  private eventHandlers: EventHandlers;

  private editorView: EditorView;
  private languageConf: Compartment;
  private themeConf: Compartment;

  constructor() {
    // Initialize services and managers
    this.tabManager = new TabManager();
    this.settingsManager = new SettingsManager();
    this.fileService = new FileService();
    this.pistonService = new PistonService();
    this.templateService = new TemplateService(this.settingsManager);
    this.modalManager = new ModalManager();
    this.settingsModalManager = new SettingsModalManager(
      this.settingsManager,
      () => this.handleTemplatesChanged(),
      (theme) => this.handleThemeChanged(theme)
    );

    // Initialize tab renderer
    this.tabRenderer = new TabRenderer(
      (id) => this.switchToTab(id),
      (id) => this.closeTab(id),
      (id, newName) => this.renameTab(id, newName)
    );

    // Initialize event handlers (pass settingsManager for dropdown updates)
    this.eventHandlers = new EventHandlers(
      {
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
        onHideCSharpWarning: () => this.modalManager.hideCSharpWarningModal(),
        onRenameActiveTab: () => this.renameActiveTab(),
        onShowSettings: () => this.settingsModalManager.showSettingsModal(),
      },
      this.settingsManager
    );

    // Initialize editor
    this.languageConf = new Compartment();
    this.themeConf = new Compartment();
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
    // Get the current theme from settings
    const currentTheme = this.settingsManager.getTheme();
    const themeExtension = getThemeExtension(currentTheme);

    const startState = EditorState.create({
      doc: "",
      extensions: [
        lineNumbers(),
        foldGutter(),
        EditorView.lineWrapping,
        history(),
        keymap.of([
          ...defaultKeymap,
          ...foldKeymap,
          indentWithTab,
          { key: "Mod-z", run: undo },
          { key: "Mod-y", run: redo },
        ]),
        bracketMatching(),
        indentationMarkers(),
        this.languageConf.of([]),
        this.themeConf.of(themeExtension),
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
  // Editor State Save/Restore
  // ========================================================================

  private saveEditorState(): void {
    const activeTab = this.tabManager.getActiveTab();
    if (!activeTab) return;

    const cursorPosition = this.editorView.state.selection.main.head;
    const scrollTop = this.editorView.scrollDOM.scrollTop;

    this.tabManager.updateTabEditorState(
      activeTab.id,
      cursorPosition,
      scrollTop
    );
  }

  private restoreEditorState(tabId: number): void {
    const tab = this.tabManager.findTabById(tabId);
    if (!tab) return;

    // Restore cursor position
    if (tab.cursorPosition !== undefined) {
      const pos = Math.min(
        tab.cursorPosition,
        this.editorView.state.doc.length
      );
      this.editorView.dispatch({
        selection: { anchor: pos },
        scrollIntoView: true,
      });
    }

    // Restore scroll position (with a small delay to ensure DOM is ready)
    if (tab.scrollTop !== undefined) {
      requestAnimationFrame(() => {
        this.editorView.scrollDOM.scrollTop = tab.scrollTop || 0;
      });
    }
  }

  // ========================================================================
  // Tab Operations
  // ========================================================================

  public createNewTab(
    name: string = EDITOR_CONFIG.defaultFileName,
    path: string | null = null,
    content: string = ""
  ): void {
    // Save current tab state before creating new tab
    this.saveEditorState();

    const tab = this.tabManager.createTab(name, path, content);
    this.updateEditorContent(tab.content);
    this.updateLanguage(tab.path);
    this.renderTabs();
    this.updateTitle(tab.name);

    // New tabs start at position 0
    this.restoreEditorState(tab.id);
  }

  public switchToTab(tabId: number): void {
    // Save current tab state before switching
    this.saveEditorState();

    if (!this.tabManager.switchToTab(tabId)) return;

    const tab = this.tabManager.getActiveTab();
    if (!tab) return;

    this.updateEditorContent(tab.content);
    this.updateLanguage(tab.path);
    this.renderTabs();
    this.updateTitle(tab.name);

    // Restore the saved state for this tab
    this.restoreEditorState(tabId);
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
          this.restoreEditorState(newActiveTab.id);
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
    // Save current tab state before switching
    this.saveEditorState();

    this.tabManager.switchToNextTab();
    const activeTab = this.tabManager.getActiveTab();
    if (activeTab) {
      this.updateEditorContent(activeTab.content);
      this.updateLanguage(activeTab.path);
      this.renderTabs();
      this.updateTitle(activeTab.name);
      this.restoreEditorState(activeTab.id);
    }
  }

  public renameActiveTab(): void {
    const activeTabId = this.tabManager.getActiveTabId();
    if (activeTabId !== null) {
      // Prevent saving editor state when just renaming
      this.tabRenderer.startRenaming(activeTabId);
    }
  }

  public async renameTab(tabId: number, newName: string): Promise<void> {
    try {
      const tab = this.tabManager.findTabById(tabId);
      if (!tab) return;

      // If tab has a file path, rename the actual file
      if (tab.path) {
        const newPath = this.fileService.getNewPath(tab.path, newName);
        await this.fileService.renameFile(tab.path, newPath);

        // Update tab with new path and name
        this.tabManager.updateTabPath(tabId, newPath, newName);

        // Update language highlighting if extension changed
        this.updateLanguage(newPath);
      } else {
        // Just rename the tab (unsaved file)
        this.tabManager.updateTabName(tabId, newName);

        // Update language highlighting based on new name
        this.updateLanguage(newName);
      }

      this.renderTabs();

      // Update title if this is the active tab
      if (this.tabManager.getActiveTabId() === tabId) {
        this.updateTitle(newName);
      }

      console.log("File renamed successfully!");
    } catch (error) {
      console.error("Error renaming file:", error);
      console.error(
        `Failed to rename file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      // Re-render to restore original name
      this.renderTabs();
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

  public insertTemplate(templateType: string): void {
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

  private handleTemplatesChanged(): void {
    // Refresh the template dropdown
    this.eventHandlers.refreshTemplateDropdown();
    console.log("Templates updated and dropdown refreshed!");
  }

  private handleThemeChanged(theme: string): void {
    console.log("Theme changed to:", theme);

    // Save the theme
    this.settingsManager.setTheme(theme);

    // Update the editor theme
    const themeExtension = getThemeExtension(theme);
    this.editorView.dispatch({
      effects: this.themeConf.reconfigure(themeExtension),
    });

    console.log("Editor theme updated!");
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
