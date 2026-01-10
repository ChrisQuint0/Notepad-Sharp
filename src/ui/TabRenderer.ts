// src/ui/TabRenderer.ts

import type { Tab } from "../types";

export class TabRenderer {
  private onTabClick: (tabId: number) => void;
  private onTabClose: (tabId: number) => Promise<void>;
  private onTabRename: (tabId: number, newName: string) => Promise<void>;
  private editingTabId: number | null = null;

  constructor(
    onTabClick: (tabId: number) => void,
    onTabClose: (tabId: number) => Promise<void>,
    onTabRename: (tabId: number, newName: string) => Promise<void>
  ) {
    this.onTabClick = onTabClick;
    this.onTabClose = onTabClose;
    this.onTabRename = onTabRename;
  }

  render(tabs: Tab[], activeTabId: number | null): void {
    const tabBar = document.getElementById("tab-bar");
    if (!tabBar) return;

    tabBar.innerHTML = "";

    tabs.forEach((tab) => {
      const tabEl = this.createTabElement(tab, activeTabId);
      tabBar.appendChild(tabEl);
    });
  }

  public startRenaming(tabId: number): void {
    const tabBar = document.getElementById("tab-bar");
    if (!tabBar) return;

    const tabEl = tabBar.querySelector(
      `[data-tab-id="${tabId}"]`
    ) as HTMLElement;
    if (!tabEl) return;

    this.editingTabId = tabId;
    const nameSpan = tabEl.querySelector(".tab-name") as HTMLElement;
    if (!nameSpan) return;

    const currentName = nameSpan.textContent || "";

    // Create input element
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tab-name-input";
    input.value = currentName;

    // Replace span with input
    nameSpan.style.display = "none";
    nameSpan.parentElement?.insertBefore(input, nameSpan);

    // Focus and select all text
    input.focus();
    input.select();

    // Handle input events
    const finishEditing = async (save: boolean) => {
      if (this.editingTabId === null) return;

      const newName = input.value.trim();

      if (save && newName && newName !== currentName) {
        await this.onTabRename(tabId, newName);
      }

      this.editingTabId = null;
    };

    input.addEventListener("blur", () => finishEditing(true));
    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await finishEditing(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        await finishEditing(false);
      }
    });

    // Prevent tab from losing focus when clicking input
    input.addEventListener("mousedown", (e) => e.stopPropagation());
  }

  private createTabElement(
    tab: Tab,
    activeTabId: number | null
  ): HTMLButtonElement {
    const tabEl = document.createElement("button");
    tabEl.className = this.getTabClasses(tab, activeTabId);
    tabEl.setAttribute("tabindex", "-1");
    tabEl.setAttribute("data-tab-id", tab.id.toString());
    tabEl.onclick = () => this.onTabClick(tab.id);

    // Add double-click handler
    tabEl.ondblclick = (e) => {
      e.stopPropagation();
      this.startRenaming(tab.id);
    };

    const nameSpan = document.createElement("span");
    nameSpan.className = "tab-name";
    nameSpan.textContent = tab.name;

    const closeBtn = document.createElement("span");
    closeBtn.className = "tab-close";
    closeBtn.innerHTML = "×";
    closeBtn.onclick = async (e) => {
      e.stopPropagation();
      await this.onTabClose(tab.id);
    };

    tabEl.appendChild(nameSpan);
    tabEl.appendChild(closeBtn);

    return tabEl;
  }

  private getTabClasses(tab: Tab, activeTabId: number | null): string {
    const classes = ["tab"];
    if (tab.id === activeTabId) classes.push("active");
    if (tab.modified) classes.push("modified");
    return classes.join(" ");
  }
}
