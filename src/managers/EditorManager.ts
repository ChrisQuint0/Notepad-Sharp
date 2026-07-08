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
import { TabRenderer } from "../ui/TabRenderer";
import { ModalManager } from "../ui/ModalManager";
import { EventHandlers } from "../ui/EventHandlers";

import { EDITOR_CONFIG, ZOOM_CONFIG } from "../constants";
import { getLanguageExtension } from "../utils/languageDetector";
import { extractFileName } from "../utils/helpers";
import { getThemeExtension } from "../utils/themeUtils";
import { getThemeType } from "../utils/themeUtils";
import { bracketMatching } from "@codemirror/language";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { foldGutter, foldKeymap } from "@codemirror/language";

export class EditorManager {
  private tabManager: TabManager;
  private settingsManager: SettingsManager;
  private fileService: FileService;
  private tabRenderer: TabRenderer;
  private modalManager: ModalManager;
  private eventHandlers: EventHandlers;

  private editorView: EditorView;
  private languageConf: Compartment;
  private themeConf: Compartment;
  private currentZoom: number = ZOOM_CONFIG.default;
  private tabStates: Map<number, EditorState>;

  constructor() {
    // Initialize services and managers
    this.tabManager = new TabManager();
    this.settingsManager = new SettingsManager();
    this.fileService = new FileService();
    this.modalManager = new ModalManager();

    // Initialize tab renderer
    this.tabRenderer = new TabRenderer(
      (id) => this.switchToTab(id),
      (id) => this.closeTab(id),
      (id, newName) => this.renameTab(id, newName),
      (sourceId: number, targetIndex: number) =>
        this.handleTabReorder(sourceId, targetIndex),
      () => this.createNewTab(),
    );

    // Initialize event handlers
    this.eventHandlers = new EventHandlers({
      onNewFile: () => this.createNewTab(),
      onOpenFile: () => this.openFile(),
      onSaveFile: () => this.saveFile(),
      onCloseActiveTab: () => this.closeActiveTab(),
      onSwitchNextTab: () => this.switchToNextTab(),
      onRenameActiveTab: () => this.renameActiveTab(),
      onInsertCSharpTemplate: () => this.insertCSharpTemplate(),
      onToggleTheme: () => this.toggleTheme(),
      onZoomIn: () => this.zoomIn(),
      onZoomOut: () => this.zoomOut(),
    });

    // Initialize editor
    this.languageConf = new Compartment();
    this.themeConf = new Compartment();
    this.tabStates = new Map();
    this.editorView = new EditorView({
      state: this.createEditorState("", null),
      parent: document.getElementById("editor-container")!,
    });

    // Initialize UI
    this.eventHandlers.initialize();

    // Set theme toggle icon according to current theme
    const currentTheme = this.settingsManager.getTheme();
    this.updateThemeToggleButton(currentTheme);
    this.applyThemeClass(currentTheme);

    // Restore previously open tabs if any, otherwise create initial tab
    try {
      const { tabs: savedTabs, activeIndex } =
        this.settingsManager.getOpenTabs();
      if (savedTabs && savedTabs.length > 0) {
        this.tabManager.loadTabs(savedTabs, activeIndex);
        const active = this.tabManager.getActiveTab();
        if (active) {
          this.loadTabIntoView(active.id);
        }
      } else {
        this.createNewTab(
          EDITOR_CONFIG.defaultFileName,
          null,
          EDITOR_CONFIG.welcomeMessage,
        );
      }
    } catch (err) {
      console.error("Error restoring open tabs:", err);
      this.createNewTab(
        EDITOR_CONFIG.defaultFileName,
        null,
        EDITOR_CONFIG.welcomeMessage,
      );
    }

    // Save tabs when the window is closed/reloaded
    window.addEventListener("beforeunload", () => {
      this.saveEditorState();
      this.saveOpenTabs();
    });

    // Load saved zoom level
    this.loadZoomLevel();
  }

  // ========================================================================
  // Editor Initialization
  // ========================================================================

  private createEditorState(content: string, filePath: string | null): EditorState {
    const currentTheme = this.settingsManager.getTheme();
    const themeExtension = getThemeExtension(currentTheme);
    const langExtension = getLanguageExtension(filePath);

    return EditorState.create({
      doc: content,
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
        this.languageConf.of(langExtension),
        this.themeConf.of(themeExtension),
        EditorState.tabSize.of(EDITOR_CONFIG.tabSize),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.handleContentChange();
          }
        }),
      ],
    });
  }

  private handleContentChange(): void {
    const activeTab = this.tabManager.getActiveTab();
    if (!activeTab) return;

    const currentContent = this.editorView.state.doc.toString();
    this.tabManager.updateTabContent(activeTab.id, currentContent);
    this.renderTabs();
    this.saveOpenTabs();
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
      scrollTop,
    );
    this.tabStates.set(activeTab.id, this.editorView.state);
  }

  private saveOpenTabs(): void {
    try {
      const tabs = this.tabManager.getAllTabs();
      const persisted = tabs.map((t) => ({
        name: t.name,
        path: t.path,
        content: t.content,
        savedContent: t.savedContent,
        modified: t.modified,
        cursorPosition: t.cursorPosition,
        scrollTop: t.scrollTop,
      }));

      const activeId = this.tabManager.getActiveTabId();
      const activeIndex = activeId
        ? tabs.findIndex((t) => t.id === activeId)
        : null;

      this.settingsManager.setOpenTabs(
        persisted,
        activeIndex === -1 ? null : activeIndex,
      );
    } catch (err) {
      console.error("Error saving open tabs:", err);
    }
  }

  private restoreEditorState(tabId: number): void {
    const tab = this.tabManager.findTabById(tabId);
    if (!tab) return;

    // Restore cursor position
    if (tab.cursorPosition !== undefined) {
      const pos = Math.min(
        tab.cursorPosition,
        this.editorView.state.doc.length,
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
  // Zoom Operations
  // ========================================================================

  public zoomIn(): void {
    const newZoom = Math.min(
      this.currentZoom + ZOOM_CONFIG.step,
      ZOOM_CONFIG.max,
    );
    this.setZoom(newZoom);
  }

  public zoomOut(): void {
    const newZoom = Math.max(
      this.currentZoom - ZOOM_CONFIG.step,
      ZOOM_CONFIG.min,
    );
    this.setZoom(newZoom);
  }

  private setZoom(zoomLevel: number): void {
    this.currentZoom = zoomLevel;
    const container = document.getElementById("editor-container");
    if (container) {
      const fontSize = (zoomLevel / 100) * ZOOM_CONFIG.baseFontSize;
      container.style.fontSize = `${fontSize}px`;
    }
    this.saveZoomLevel();
    console.log(
      `Zoom set to ${zoomLevel}% (${(zoomLevel / 100) * ZOOM_CONFIG.baseFontSize}px)`,
    );
  }

  private saveZoomLevel(): void {
    try {
      localStorage.setItem("notepad-sharp-zoom", this.currentZoom.toString());
    } catch (error) {
      console.error("Error saving zoom level:", error);
    }
  }

  private loadZoomLevel(): void {
    try {
      const saved = localStorage.getItem("notepad-sharp-zoom");
      if (saved) {
        const zoomLevel = parseInt(saved, 10);
        if (zoomLevel >= ZOOM_CONFIG.min && zoomLevel <= ZOOM_CONFIG.max) {
          this.setZoom(zoomLevel);
        }
      }
    } catch (error) {
      console.error("Error loading zoom level:", error);
    }
  }

  // ========================================================================
  // Tab Operations
  // ========================================================================

  public createNewTab(
    name: string = EDITOR_CONFIG.defaultFileName,
    path: string | null = null,
    content: string = "",
  ): void {
    // Save current tab state before creating new tab
    this.saveEditorState();

    const tab = this.tabManager.createTab(name, path, content);
    this.loadTabIntoView(tab.id);
    this.saveOpenTabs();
  }

  public switchToTab(tabId: number): void {
    // Save current tab state before switching
    this.saveEditorState();

    if (!this.tabManager.switchToTab(tabId)) return;

    this.loadTabIntoView(tabId);
    this.saveOpenTabs();
  }

  public async closeTab(tabId: number): Promise<void> {
    const wasActive = this.tabManager.getActiveTabId() === tabId;
    const closed = await this.tabManager.closeTab(tabId);

    if (!closed) return;
    
    this.tabStates.delete(tabId);

    if (wasActive) {
      if (this.tabManager.hasNoTabs()) {
        this.createNewTab();
      } else {
        const newActiveTab = this.tabManager.getActiveTab();
        if (newActiveTab) {
          this.loadTabIntoView(newActiveTab.id);
        }
      }
    }

    this.renderTabs();
    this.saveOpenTabs();
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
      this.loadTabIntoView(activeTab.id);
      this.saveOpenTabs();
    }
  }

  private handleTabReorder(sourceId: number, targetIndex: number): void {
    // Save state of current tab before reordering
    this.saveEditorState();

    const moved = this.tabManager.moveTab(sourceId, targetIndex);
    if (!moved) return;

    // Re-render tabs to reflect new order
    this.renderTabs();
    this.saveOpenTabs();
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

      this.modalManager.displayOutput(
        `File renamed to ${newName} successfully!`,
        "success",
      );
      console.log("File renamed successfully!");
      this.saveOpenTabs();
    } catch (error) {
      console.error("Error renaming file:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.modalManager.displayOutput(
        `Failed to rename file: ${errorMessage}`,
        "error",
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

      this.saveOpenTabs();

      this.modalManager.displayOutput(
        `File "${activeTab.name}" saved successfully!`,
        "success",
      );
      console.log("File saved successfully!");
    } catch (error) {
      console.error("Error saving file:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.modalManager.displayOutput(
        `Error saving file: ${errorMessage}`,
        "error",
      );
    }
  }

  // ========================================================================
  // (Code runner removed)

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

  private loadTabIntoView(tabId: number): void {
    const tab = this.tabManager.findTabById(tabId);
    if (!tab) return;
    
    let state = this.tabStates.get(tabId);
    if (!state) {
      state = this.createEditorState(tab.content, tab.path);
      this.tabStates.set(tabId, state);
    }
    
    this.editorView.setState(state);
    this.renderTabs();
    this.updateTitle(tab.name);
    this.restoreEditorState(tabId);
  }

  private updateLanguage(filePath: string | null): void {
    const langExtension = getLanguageExtension(filePath);
    this.editorView.dispatch({
      effects: this.languageConf.reconfigure(langExtension),
    });
    const activeTab = this.tabManager.getActiveTab();
    if (activeTab) {
      this.tabStates.set(activeTab.id, this.editorView.state);
    }
  }

  private toggleTheme(): void {
    const current = this.settingsManager.getTheme();
    const newTheme = current === "dracula" ? "githubLight" : "dracula";
    this.settingsManager.setTheme(newTheme);

    const themeExtension = getThemeExtension(newTheme);
    this.editorView.dispatch({
      effects: this.themeConf.reconfigure(themeExtension),
    });
    
    const activeTabId = this.tabManager.getActiveTabId();
    for (const [id, state] of this.tabStates.entries()) {
      if (id === activeTabId) {
        this.tabStates.set(id, this.editorView.state);
      } else {
        const tr = state.update({
          effects: this.themeConf.reconfigure(themeExtension)
        });
        this.tabStates.set(id, tr.state);
      }
    }

    this.updateThemeToggleButton(newTheme);
    this.applyThemeClass(newTheme);
  }

  private applyThemeClass(themeId: string): void {
    try {
      const type = getThemeType(themeId);
      if (type === "light") {
        document.body.classList.add("light-theme");
        document.body.classList.remove("dark-theme");
      } else {
        document.body.classList.remove("light-theme");
        document.body.classList.add("dark-theme");
      }
    } catch (err) {
      console.error("Failed to apply theme class:", err);
    }
  }

  private updateThemeToggleButton(themeId: string): void {
    const btn = document.getElementById("btn-theme-toggle");
    if (!btn) return;
    
    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    
    btn.innerHTML = themeId === "dracula" ? moonIcon : sunIcon;
  }

  // Insert a C# template at the current cursor position (or replace selection).
  private insertCSharpTemplate(): void {
    const tpl = [
      "using System;",
      "using System.Linq;",
      "using System.Collections.Generic;",
      "using System.Text;",
      "",
      "class Program {",
      "  static void Main(){",
      "    ",
      "  }",
      "}",
      "",
    ].join("\n");

    const state = this.editorView.state;
    const sel = state.selection.main;
    const from = sel.from;
    const to = sel.to;

    // Compute caret offset inside the inserted template: place after the indented blank line
    const innerIndex = tpl.indexOf("\n  \n");
    const caretOffsetInTpl = innerIndex >= 0 ? innerIndex + 3 : tpl.length;

    const insertPos = from;

    this.editorView.dispatch({
      changes: { from: from, to: to, insert: tpl },
      selection: { anchor: insertPos + caretOffsetInTpl },
      scrollIntoView: true,
    });
  }
}
