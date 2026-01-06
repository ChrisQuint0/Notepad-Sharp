// src/managers/TabManager.ts

import type { Tab } from "../types";
import { EDITOR_CONFIG } from "../constants";
import { confirm as tauriConfirm } from "@tauri-apps/plugin-dialog";

export class TabManager {
  private tabs: Tab[] = [];
  private activeTabId: number | null = null;
  private nextTabId: number = 1;

  createTab(
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
    this.activeTabId = tab.id;
    return tab;
  }

  async closeTab(tabId: number): Promise<boolean> {
    const tabIndex = this.tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return false;

    const tab = this.tabs[tabIndex];

    if (tab.modified && !(await this.confirmClose(tab.name))) {
      return false;
    }

    this.tabs.splice(tabIndex, 1);

    if (tab.id === this.activeTabId) {
      this.handleActiveTabClosed(tabIndex);
    }

    return true;
  }

  private handleActiveTabClosed(closedIndex: number): void {
    if (this.tabs.length > 0) {
      const newActiveTab = this.tabs[Math.max(0, closedIndex - 1)];
      this.activeTabId = newActiveTab.id;
    } else {
      this.activeTabId = null;
    }
  }

  switchToTab(tabId: number): boolean {
    const tab = this.findTabById(tabId);
    if (!tab) return false;

    this.activeTabId = tabId;
    return true;
  }

  switchToNextTab(): void {
    if (this.tabs.length <= 1) return;

    const currentIndex = this.tabs.findIndex((t) => t.id === this.activeTabId);
    const nextIndex = (currentIndex + 1) % this.tabs.length;
    this.activeTabId = this.tabs[nextIndex].id;
  }

  findTabById(id: number): Tab | undefined {
    return this.tabs.find((t) => t.id === id);
  }

  getActiveTab(): Tab | null {
    return this.activeTabId !== null
      ? this.findTabById(this.activeTabId) || null
      : null;
  }

  getAllTabs(): Tab[] {
    return [...this.tabs];
  }

  getActiveTabId(): number | null {
    return this.activeTabId;
  }

  hasNoTabs(): boolean {
    return this.tabs.length === 0;
  }

  updateTabContent(tabId: number, content: string): void {
    const tab = this.findTabById(tabId);
    if (tab) {
      tab.content = content;
      tab.modified = content !== tab.savedContent;
    }
  }

  markTabSaved(tabId: number, content: string): void {
    const tab = this.findTabById(tabId);
    if (tab) {
      tab.content = content;
      tab.savedContent = content;
      tab.modified = false;
    }
  }

  updateTabPath(tabId: number, path: string, name: string): void {
    const tab = this.findTabById(tabId);
    if (tab) {
      tab.path = path;
      tab.name = name;
    }
  }

  markTabModified(tabId: number): void {
    const tab = this.findTabById(tabId);
    if (tab) {
      tab.modified = true;
    }
  }

  private async confirmClose(tabName: string): Promise<boolean> {
    return await tauriConfirm(
      `Your changes will be lost if you don't save them.`,
      { title: `Close ${tabName}?`, kind: "warning" }
    );
  }
}
