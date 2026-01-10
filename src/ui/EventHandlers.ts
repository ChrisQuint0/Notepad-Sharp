// src/ui/EventHandlers.ts

import type { TemplateType } from "../types";

interface EventCallbacks {
  onNewFile: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onRunCode: () => void;
  onShowRunnerModal: () => void;
  onHideRunnerModal: () => void;
  onToggleInput: () => void;
  onClearOutput: () => void;
  onInsertTemplate: (type: TemplateType) => void;
  onCloseActiveTab: () => void;
  onSwitchNextTab: () => void;
  onHideCSharpWarning: () => void;
}

export class EventHandlers {
  private callbacks: EventCallbacks;

  constructor(callbacks: EventCallbacks) {
    this.callbacks = callbacks;
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
      .getElementById("btn-run")
      ?.addEventListener("click", () => this.callbacks.onShowRunnerModal());
  }

  private setupModalHandlers(): void {
    // Runner modal
    document
      .getElementById("modal-close")
      ?.addEventListener("click", () => this.callbacks.onHideRunnerModal());

    document.getElementById("runner-modal")?.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).id === "runner-modal") {
        this.callbacks.onHideRunnerModal();
      }
    });

    document
      .getElementById("toggle-input")
      ?.addEventListener("click", () => this.callbacks.onToggleInput());

    document
      .getElementById("btn-clear-output")
      ?.addEventListener("click", () => this.callbacks.onClearOutput());

    document
      .getElementById("btn-run-code")
      ?.addEventListener("click", () => this.callbacks.onRunCode());

    // C# Warning modal
    document
      .getElementById("csharp-warning-close")
      ?.addEventListener("click", () => this.callbacks.onHideCSharpWarning());
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
        if (templateType) {
          this.callbacks.onInsertTemplate(templateType);
        }
      });
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener("keydown", (e) => {
      // Escape key
      if (e.key === "Escape") {
        const modal = document.getElementById("runner-modal");
        if (modal?.classList.contains("show")) {
          e.preventDefault();
          this.callbacks.onHideRunnerModal();
          return;
        }
      }

      // Alt+N - Run code
      if (e.altKey && e.key === "n") {
        e.preventDefault();
        this.callbacks.onShowRunnerModal();
        return;
      }

      // Ctrl shortcuts
      if (!e.ctrlKey) return;

      const shortcuts: Record<string, () => void> = {
        "3": () => this.callbacks.onInsertTemplate("csharp"),
        "4": () => this.callbacks.onInsertTemplate("cpp"),
        "5": () => this.callbacks.onInsertTemplate("python"),
        "6": () => this.callbacks.onInsertTemplate("java"),
        s: () => this.callbacks.onSaveFile(),
        o: () => this.callbacks.onOpenFile(),
        n: () => this.callbacks.onNewFile(),
        w: () => this.callbacks.onCloseActiveTab(),
        Tab: () => this.callbacks.onSwitchNextTab(),
      };

      const handler = shortcuts[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    });
  }
}
