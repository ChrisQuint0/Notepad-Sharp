// src/ui/EventHandlers.ts

import { SettingsManager } from "../managers/SettingsManager";

interface EventCallbacks {
  onNewFile: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onCloseActiveTab: () => void;
  onSwitchNextTab: () => void;
  onRenameActiveTab: () => void;
  onToggleTheme: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export class EventHandlers {
  private callbacks: EventCallbacks;
  private settingsManager: SettingsManager;

  constructor(callbacks: EventCallbacks, settingsManager: SettingsManager) {
    this.callbacks = callbacks;
    this.settingsManager = settingsManager;
  }

  initialize(): void {
    this.setupButtonHandlers();
    this.setupModalHandlers();
    this.setupDropdownHandlers();
    this.setupKeyboardShortcuts();
  }

  private setupButtonHandlers(): void {
    // File actions are in a dropdown now; Theme toggle is on the right
    document
      .getElementById("btn-theme-toggle")
      ?.addEventListener("click", () => this.callbacks.onToggleTheme());
  }

  private setupModalHandlers(): void {
    // No runner modal handlers (feature removed)
  }

  private setupDropdownHandlers(): void {
    // File dropdown
    document.getElementById("btn-file")?.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close other dropdowns first
      document
        .querySelectorAll(".dropdown-content")
        .forEach((d) => d.classList.remove("show"));
      document
        .querySelector(".dropdown-content.file")
        ?.classList.toggle("show");
    });

    // Delegate clicks from file dropdown to callbacks
    document
      .querySelector(".dropdown-content.file")
      ?.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const item = target.closest(".dropdown-item") as HTMLElement;
        if (!item) return;
        const action = item.getAttribute("data-action");
        if (action === "new") this.callbacks.onNewFile();
        else if (action === "open") this.callbacks.onOpenFile();
        else if (action === "save") this.callbacks.onSaveFile();
        // hide dropdown after selection
        document
          .querySelectorAll(".dropdown-content")
          .forEach((d) => d.classList.remove("show"));
      });

    // View dropdown
    document.getElementById("btn-view")?.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close other dropdowns first
      document
        .querySelectorAll(".dropdown-content")
        .forEach((d) => d.classList.remove("show"));
      document
        .querySelector(".dropdown-content.view")
        ?.classList.toggle("show");
    });

    document.addEventListener("click", () => {
      document.querySelectorAll(".dropdown-content").forEach((dropdown) => {
        dropdown.classList.remove("show");
      });
    });

    // View dropdown items
    document.getElementById("zoom-in-item")?.addEventListener("click", () => {
      this.callbacks.onZoomIn();
    });

    document.getElementById("zoom-out-item")?.addEventListener("click", () => {
      this.callbacks.onZoomOut();
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener("keydown", (e) => {
      // F2 - Rename active tab
      if (e.key === "F2") {
        e.preventDefault();
        this.callbacks.onRenameActiveTab();
        return;
      }

      // Ctrl shortcuts
      if (!e.ctrlKey) return;

      // Zoom shortcuts
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        this.callbacks.onZoomIn();
        return;
      }

      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        this.callbacks.onZoomOut();
        return;
      }

      const shortcuts: Record<string, () => void> = {
        s: () => this.callbacks.onSaveFile(),
        o: () => this.callbacks.onOpenFile(),
        n: () => this.callbacks.onNewFile(),
        w: () => this.callbacks.onCloseActiveTab(),
        Tab: () => this.callbacks.onSwitchNextTab(),
        ",": () => this.callbacks.onToggleTheme(),
      };

      const handler = shortcuts[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    });
  }
}
