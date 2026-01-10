// src/ui/SettingsModalManager.ts

import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { SettingsManager } from "../managers/SettingsManager";

export class SettingsModalManager {
  private settingsManager: SettingsManager;
  private settingsEditor: EditorView | null = null;
  private currentEditingKey: string | null = null;
  private pendingChanges: Map<string, string> = new Map();
  private onTemplatesChanged: () => void;

  constructor(
    settingsManager: SettingsManager,
    onTemplatesChanged: () => void
  ) {
    this.settingsManager = settingsManager;
    this.onTemplatesChanged = onTemplatesChanged;
    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
    // Settings modal controls
    document.getElementById("settings-close")?.addEventListener("click", () => {
      this.hideSettingsModal();
    });

    document
      .getElementById("settings-modal")
      ?.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).id === "settings-modal") {
          this.hideSettingsModal();
        }
      });

    document
      .getElementById("save-settings-btn")
      ?.addEventListener("click", () => {
        this.saveAllChanges();
      });

    document
      .getElementById("cancel-settings-btn")
      ?.addEventListener("click", () => {
        this.hideSettingsModal();
      });

    document
      .getElementById("add-template-btn")
      ?.addEventListener("click", () => {
        this.showAddTemplateModal();
      });

    document
      .getElementById("reset-template-btn")
      ?.addEventListener("click", () => {
        this.resetCurrentTemplate();
      });

    document
      .getElementById("delete-template-btn")
      ?.addEventListener("click", () => {
        this.deleteCurrentTemplate();
      });

    // Add template modal controls
    document
      .getElementById("add-template-close")
      ?.addEventListener("click", () => {
        this.hideAddTemplateModal();
      });

    document
      .getElementById("confirm-add-template-btn")
      ?.addEventListener("click", () => {
        this.confirmAddTemplate();
      });

    document
      .getElementById("cancel-add-template-btn")
      ?.addEventListener("click", () => {
        this.hideAddTemplateModal();
      });
  }

  showSettingsModal(): void {
    this.pendingChanges.clear();
    this.currentEditingKey = null;
    this.renderTemplateList();

    const modal = document.getElementById("settings-modal");
    modal?.classList.add("show");
  }

  hideSettingsModal(): void {
    const modal = document.getElementById("settings-modal");
    modal?.classList.remove("show");

    if (this.settingsEditor) {
      this.settingsEditor.destroy();
      this.settingsEditor = null;
    }
  }

  private renderTemplateList(): void {
    const listContainer = document.getElementById("template-list");
    if (!listContainer) return;

    listContainer.innerHTML = "";
    const templates = this.settingsManager.getAllTemplates();

    templates.forEach((template) => {
      const item = document.createElement("div");
      item.className = "template-list-item";
      if (this.currentEditingKey === template.key) {
        item.classList.add("active");
      }

      const nameSpan = document.createElement("span");
      nameSpan.className = "template-list-name";
      nameSpan.textContent = template.name;

      const badge = document.createElement("span");
      badge.className = template.isCustom
        ? "template-badge custom"
        : "template-badge default";
      badge.textContent = template.isCustom ? "Custom" : "Default";

      item.appendChild(nameSpan);
      item.appendChild(badge);

      item.onclick = () => this.selectTemplate(template.key);
      listContainer.appendChild(item);
    });
  }

  private selectTemplate(key: string): void {
    // Save current editor content before switching
    if (this.currentEditingKey && this.settingsEditor) {
      const content = this.settingsEditor.state.doc.toString();
      this.pendingChanges.set(this.currentEditingKey, content);
    }

    this.currentEditingKey = key;
    this.renderTemplateList();
    this.loadTemplateIntoEditor(key);
    this.updateEditorControls(key);
  }

  private loadTemplateIntoEditor(key: string): void {
    const template = this.settingsManager
      .getAllTemplates()
      .find((t) => t.key === key);
    if (!template) return;

    const content = this.pendingChanges.get(key) || template.code;

    const container = document.getElementById("template-editor-container");
    if (!container) return;

    // Destroy existing editor
    if (this.settingsEditor) {
      this.settingsEditor.destroy();
    }

    // Clear container
    container.innerHTML = "";

    // Create new editor
    const startState = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        EditorView.lineWrapping,
        history(),
        cpp(),
        oneDark,
        EditorState.tabSize.of(2),
      ],
    });

    this.settingsEditor = new EditorView({
      state: startState,
      parent: container,
    });

    // Update name input
    const nameInput = document.getElementById(
      "template-name-input"
    ) as HTMLInputElement;
    if (nameInput) {
      nameInput.value = template.name;
    }
  }

  private updateEditorControls(key: string): void {
    const template = this.settingsManager
      .getAllTemplates()
      .find((t) => t.key === key);
    if (!template) return;

    const resetBtn = document.getElementById("reset-template-btn");
    const deleteBtn = document.getElementById("delete-template-btn");

    if (template.isCustom && !this.isDefaultTemplate(key)) {
      // Fully custom template - show delete button
      if (deleteBtn) deleteBtn.style.display = "inline-block";
      if (resetBtn) resetBtn.style.display = "none";
    } else if (template.isCustom) {
      // Modified default template - show reset button
      if (resetBtn) resetBtn.style.display = "inline-block";
      if (deleteBtn) deleteBtn.style.display = "none";
    } else {
      // Unmodified default template - show neither
      if (resetBtn) resetBtn.style.display = "none";
      if (deleteBtn) deleteBtn.style.display = "none";
    }
  }

  private isDefaultTemplate(key: string): boolean {
    return ["csharp", "cpp", "python", "java"].includes(key);
  }

  private resetCurrentTemplate(): void {
    if (!this.currentEditingKey) return;

    if (confirm(`Reset "${this.currentEditingKey}" template to default?`)) {
      this.settingsManager.resetTemplate(this.currentEditingKey);
      this.pendingChanges.delete(this.currentEditingKey);
      this.loadTemplateIntoEditor(this.currentEditingKey);
      this.updateEditorControls(this.currentEditingKey);
      this.renderTemplateList();
    }
  }

  private deleteCurrentTemplate(): void {
    if (!this.currentEditingKey) return;

    if (confirm(`Delete template "${this.currentEditingKey}"?`)) {
      this.settingsManager.deleteCustomTemplate(this.currentEditingKey);
      this.pendingChanges.delete(this.currentEditingKey);

      const nextKey = this.settingsManager.getAllTemplates()[0]?.key;
      if (nextKey) {
        this.selectTemplate(nextKey);
      } else {
        this.currentEditingKey = null;
        if (this.settingsEditor) {
          this.settingsEditor.destroy();
          this.settingsEditor = null;
        }
      }

      this.renderTemplateList();
    }
  }

  private saveAllChanges(): void {
    // Save current editor content
    if (this.currentEditingKey && this.settingsEditor) {
      const content = this.settingsEditor.state.doc.toString();
      this.pendingChanges.set(this.currentEditingKey, content);
    }

    // Apply all pending changes
    this.pendingChanges.forEach((code, key) => {
      this.settingsManager.updateTemplate(key, code);
    });

    this.hideSettingsModal();
    this.onTemplatesChanged();
    console.log("Template settings saved!");
  }

  private showAddTemplateModal(): void {
    const modal = document.getElementById("add-template-modal");
    modal?.classList.add("show");

    // Clear inputs
    const keyInput = document.getElementById(
      "new-template-key"
    ) as HTMLInputElement;
    const nameInput = document.getElementById(
      "new-template-name"
    ) as HTMLInputElement;
    const errorDiv = document.getElementById("add-template-error");

    if (keyInput) keyInput.value = "";
    if (nameInput) nameInput.value = "";
    if (errorDiv) errorDiv.style.display = "none";
  }

  private hideAddTemplateModal(): void {
    const modal = document.getElementById("add-template-modal");
    modal?.classList.remove("show");
  }

  private confirmAddTemplate(): void {
    const keyInput = document.getElementById(
      "new-template-key"
    ) as HTMLInputElement;
    const nameInput = document.getElementById(
      "new-template-name"
    ) as HTMLInputElement;
    const errorDiv = document.getElementById("add-template-error");

    const key = keyInput?.value.trim().toLowerCase();
    const name = nameInput?.value.trim();

    if (!key || !name) {
      if (errorDiv) {
        errorDiv.textContent = "Please fill in all fields";
        errorDiv.style.display = "block";
      }
      return;
    }

    if (!/^[a-z0-9-]+$/.test(key)) {
      if (errorDiv) {
        errorDiv.textContent =
          "Key must contain only lowercase letters, numbers, and hyphens";
        errorDiv.style.display = "block";
      }
      return;
    }

    const success = this.settingsManager.addCustomTemplate(
      key,
      name,
      "// Your template code here\n"
    );

    if (!success) {
      if (errorDiv) {
        errorDiv.textContent = "A template with this key already exists";
        errorDiv.style.display = "block";
      }
      return;
    }

    this.hideAddTemplateModal();
    this.renderTemplateList();
    this.selectTemplate(key);
  }
}
