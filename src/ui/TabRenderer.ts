// src/ui/TabRenderer.ts

import type { Tab } from "../types";

export class TabRenderer {
  private onTabClick: (tabId: number) => void;
  private onTabClose: (tabId: number) => Promise<void>;
  private onTabRename: (tabId: number, newName: string) => Promise<void>;
  private onTabReorder:
    | ((sourceId: number, targetIndex: number) => void)
    | null = null;
  private onNewTab?: () => void;
  private editingTabId: number | null = null;
  private draggedTabId: number | null = null;
  private draggedEl: HTMLElement | null = null;

  constructor(
    onTabClick: (tabId: number) => void,
    onTabClose: (tabId: number) => Promise<void>,
    onTabRename: (tabId: number, newName: string) => Promise<void>,
    onTabReorder?: (sourceId: number, targetIndex: number) => void,
    onNewTab?: () => void,
  ) {
    this.onTabClick = onTabClick;
    this.onTabClose = onTabClose;
    this.onTabRename = onTabRename;
    this.onTabReorder = onTabReorder ?? null;
    this.onNewTab = onNewTab;
  }

  render(tabs: Tab[], activeTabId: number | null): void {
    const tabBar = document.getElementById("tab-bar");
    if (!tabBar) return;

    tabBar.innerHTML = "";

    tabs.forEach((tab) => {
      const tabEl = this.createTabElement(tab, activeTabId);
      tabBar.appendChild(tabEl);
    });

    if (this.onNewTab) {
      const newTabBtn = document.createElement("button");
      newTabBtn.className = "new-tab-btn";
      newTabBtn.textContent = "+";
      newTabBtn.title = "New Tab (Ctrl+N)";
      newTabBtn.onclick = () => {
        if (this.onNewTab) this.onNewTab();
      };
      tabBar.appendChild(newTabBtn);
    }

    // Allow dropping on empty space (append to end)
    tabBar.ondragover = (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      // If we've been dragging a tab, and hovering over empty area, move it to the end for visual feedback
      if (this.draggedEl && this.draggedEl.parentElement === tabBar) {
        // ensure it's last
        tabBar.appendChild(this.draggedEl);
      }
    };

    tabBar.ondrop = (e) => {
      e.preventDefault();
      const data = e.dataTransfer?.getData("text/plain");
      // If data is missing, try to use stored draggedTabId
      const draggedId = data ? parseInt(data, 10) : this.draggedTabId;
      if (draggedId == null) return;
      const children = Array.from(tabBar.children) as HTMLElement[];
      // Find the index of the dragged element in current DOM order
      const draggedIndex = children.findIndex(
        (c) =>
          parseInt(c.getAttribute("data-tab-id") || "-1", 10) === draggedId,
      );
      const insertIndex = draggedIndex === -1 ? children.length : draggedIndex;
      if (this.onTabReorder) this.onTabReorder(draggedId, insertIndex);
    };
  }

  public startRenaming(tabId: number): void {
    const tabBar = document.getElementById("tab-bar");
    if (!tabBar) return;

    const tabEl = tabBar.querySelector(
      `[data-tab-id="${tabId}"]`,
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
      } else {
        // Just restore the original name without saving
        nameSpan.style.display = "";
        input.remove();
      }

      this.editingTabId = null;
    };

    // Only save on Enter key
    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        await finishEditing(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        await finishEditing(false);
      }
    });

    // Click outside to cancel (not save)
    const handleClickOutside = async (e: MouseEvent) => {
      if (!input.contains(e.target as Node)) {
        await finishEditing(false);
        document.removeEventListener("mousedown", handleClickOutside);
      }
    };

    // Use mousedown instead of click, and add a small delay to avoid immediate trigger
    setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    // Prevent tab from losing focus when clicking input
    input.addEventListener("mousedown", (e) => e.stopPropagation());
    input.addEventListener("click", (e) => e.stopPropagation());
  }

  private createTabElement(
    tab: Tab,
    activeTabId: number | null,
  ): HTMLButtonElement {
    const tabEl = document.createElement("button");
    tabEl.className = this.getTabClasses(tab, activeTabId);
    tabEl.setAttribute("tabindex", "-1");
    tabEl.setAttribute("data-tab-id", tab.id.toString());
    // Use custom pointer-based dragging for consistent behavior across hosts
    tabEl.draggable = false;
    tabEl.onclick = () => {
      // Don't switch tabs if we're editing
      if (this.editingTabId === null) {
        this.onTabClick(tab.id);
      }
    };

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

    // Pointer (mouse) based drag implementation for reliable reordering
    tabEl.addEventListener("mousedown", (e) => {
      // Only left button
      if (e.button !== 0) return;
      // Avoid starting drag when renaming input is active
      if (this.editingTabId !== null) return;

      // If user clicked the close button, don't initiate dragging — allow native click to close
      const target = e.target as HTMLElement;
      if (target && target.closest && target.closest(".tab-close")) return;

      const tabBar = document.getElementById("tab-bar");
      if (!tabBar) return;

      let dragging = false;
      const startX = e.clientX;
      const startY = e.clientY;
      const sourceId = tab.id;
      const placeholder = document.createElement("div");
      placeholder.className = "tab-placeholder";
      placeholder.style.width = `${tabEl.getBoundingClientRect().width}px`;
      placeholder.style.height = `${tabEl.getBoundingClientRect().height}px`;

      const onMouseMove = (mv: MouseEvent) => {
        const dx = Math.abs(mv.clientX - startX);
        const dy = Math.abs(mv.clientY - startY);
        // start drag after small threshold to allow click
        if (!dragging && (dx > 6 || dy > 6)) {
          dragging = true;
          this.draggedTabId = sourceId;
          this.draggedEl = tabEl;
          tabEl.classList.add("dragging");
          // insert placeholder where the tab was
          tabBar.insertBefore(placeholder, tabEl);
          // set dragged element to position absolute to follow cursor
          const rect = tabEl.getBoundingClientRect();
          tabEl.style.position = "absolute";
          tabEl.style.top = `${rect.top - tabBar.getBoundingClientRect().top}px`;
          tabEl.style.left = `${rect.left - tabBar.getBoundingClientRect().left}px`;
          tabEl.style.width = `${rect.width}px`;
          tabEl.style.zIndex = "1000";
          tabBar.appendChild(tabEl);
        }

        if (dragging) {
          // move the dragged element with the cursor
          const barRect = tabBar.getBoundingClientRect();
          tabEl.style.left = `${mv.clientX - barRect.left - tabEl.getBoundingClientRect().width / 2}px`;

          // determine insertion point by midpoint of children (excluding dragged element)
          const all = Array.from(
            tabBar.querySelectorAll(".tab"),
          ) as HTMLElement[];
          const children = all.filter((c) => c !== tabEl);
          let inserted = false;

          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const crect = child.getBoundingClientRect();
            const midpoint = crect.left + crect.width / 2;
            if (mv.clientX < midpoint) {
              if (placeholder.nextSibling !== child)
                tabBar.insertBefore(placeholder, child);
              inserted = true;
              break;
            }
          }

          // If not inserted, place placeholder at the end (after all children)
          if (!inserted) {
            // Determine last non-dragged child
            const last = children[children.length - 1];
            if (last) {
              if (placeholder.nextSibling !== last.nextSibling)
                tabBar.insertBefore(placeholder, last.nextSibling);
            } else {
              // no other tabs, just ensure placeholder is first
              if (tabBar.firstChild !== placeholder)
                tabBar.insertBefore(placeholder, tabBar.firstChild);
            }
          }
        }
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        if (!dragging) {
          // Not a drag — let the native click event fire (so close button clicks work reliably)
          return;
        }

        // place the dragged element where the placeholder is
        tabEl.classList.remove("dragging");
        tabEl.style.position = "";
        tabEl.style.top = "";
        tabEl.style.left = "";
        tabEl.style.width = "";
        tabEl.style.zIndex = "";

        tabBar.insertBefore(tabEl, placeholder);
        placeholder.remove();

        this.draggedTabId = null;
        this.draggedEl = null;

        if (this.onTabReorder) {
          // compute index among tab elements
          const tabs = Array.from(
            tabBar.querySelectorAll(".tab"),
          ) as HTMLElement[];
          const newIndex = tabs.findIndex(
            (c) =>
              parseInt(c.getAttribute("data-tab-id") || "-1", 10) === sourceId,
          );
          if (newIndex !== -1) this.onTabReorder(sourceId, newIndex);
        }
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp, { once: true });
    });

    tabEl.addEventListener("dragenter", (e) => {
      // mark allowed drop when entering
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    });

    return tabEl;
  }

  private getTabClasses(tab: Tab, activeTabId: number | null): string {
    const classes = ["tab"];
    if (tab.id === activeTabId) classes.push("active");
    if (tab.modified) classes.push("modified");
    return classes.join(" ");
  }
}
