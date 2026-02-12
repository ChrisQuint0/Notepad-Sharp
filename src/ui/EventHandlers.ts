// src/ui/EventHandlers.ts

import { SettingsManager } from "../managers/SettingsManager";

interface EventCallbacks {
  onNewFile: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onCloseActiveTab: () => void;
  onSwitchNextTab: () => void;
  onRenameActiveTab: () => void;
  onShowSettings: () => void;
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
    document
      .getElementById("btn-new")
      ?.addEventListener("click", () => this.callbacks.onNewFile());

    document
      .getElementById("btn-open")
      ?.addEventListener("click", () => this.callbacks.onOpenFile());

    document
      .getElementById("btn-save")
      ?.addEventListener("click", () => this.callbacks.onSaveFile());

    document
      .getElementById("btn-settings")
      ?.addEventListener("click", () => this.callbacks.onShowSettings());
  }

  private setupModalHandlers(): void {
    // No runner modal handlers (feature removed)
  }

  private setupDropdownHandlers(): void {
    // View dropdown
    document.getElementById("btn-view")?.addEventListener("click", (e) => {
      e.stopPropagation();
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
        ",": () => this.callbacks.onShowSettings(),
      };

      const handler = shortcuts[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    });
  }
}
