// src/ui/EventHandlers.ts

import { SettingsManager } from "../managers/SettingsManager";

interface EventCallbacks {
  onNewFile: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onRunCode: () => void;
  onShowRunnerModal: () => void;
  onHideRunnerModal: () => void;
  onToggleInput: () => void;
  onClearOutput: () => void;
  onInsertTemplate: (type: string) => void;
  onCloseActiveTab: () => void;
  onSwitchNextTab: () => void;
  onHideCSharpWarning: () => void;
  onRenameActiveTab: () => void;
  onShowSettings: () => void;
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
      .getElementById("btn-run")
      ?.addEventListener("click", () => this.callbacks.onShowRunnerModal());

    document
      .getElementById("btn-settings")
      ?.addEventListener("click", () => this.callbacks.onShowSettings());
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

      // Regenerate dropdown content with current templates
      this.updateTemplateDropdown();

      document.querySelector(".dropdown-content")?.classList.toggle("show");
    });

    document.addEventListener("click", () => {
      document.querySelector(".dropdown-content")?.classList.remove("show");
    });

    // Delegate event handling for dropdown items
    document
      .querySelector(".dropdown-content")
      ?.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const item = target.closest(".dropdown-item") as HTMLElement;
        if (item) {
          const templateType = item.getAttribute("data-template");
          if (templateType) {
            this.callbacks.onInsertTemplate(templateType);
          }
        }
      });
  }

  private updateTemplateDropdown(): void {
    const dropdownContent = document.querySelector(".dropdown-content");
    if (!dropdownContent) return;

    // Clear existing items
    dropdownContent.innerHTML = "";

    // Get all templates from SettingsManager
    const templates = this.settingsManager.getAllTemplates();

    // Create dropdown items for each template
    templates.forEach((template) => {
      const item = document.createElement("button");
      item.className = "dropdown-item";
      item.setAttribute("data-template", template.key);

      const nameSpan = document.createElement("span");
      nameSpan.textContent = template.name;

      item.appendChild(nameSpan);

      // Add keyboard shortcut hint for default templates
      if (template.key === "csharp") {
        const shortcut = document.createElement("span");
        shortcut.className = "shortcut";
        shortcut.textContent = "Ctrl+3";
        item.appendChild(shortcut);
      } else if (template.key === "cpp") {
        const shortcut = document.createElement("span");
        shortcut.className = "shortcut";
        shortcut.textContent = "Ctrl+4";
        item.appendChild(shortcut);
      } else if (template.key === "python") {
        const shortcut = document.createElement("span");
        shortcut.className = "shortcut";
        shortcut.textContent = "Ctrl+5";
        item.appendChild(shortcut);
      } else if (template.key === "java") {
        const shortcut = document.createElement("span");
        shortcut.className = "shortcut";
        shortcut.textContent = "Ctrl+6";
        item.appendChild(shortcut);
      }

      dropdownContent.appendChild(item);
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
        ",": () => this.callbacks.onShowSettings(), // Ctrl+, for settings
      };

      const handler = shortcuts[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    });
  }

  // Public method to refresh dropdown (called after template changes)
  public refreshTemplateDropdown(): void {
    this.updateTemplateDropdown();
  }
}
