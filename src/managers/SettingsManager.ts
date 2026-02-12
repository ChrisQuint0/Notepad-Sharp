// src/managers/SettingsManager.ts

import { CODE_TEMPLATES } from "../constants";
import type { TemplateType } from "../types";

interface CustomTemplate {
  name: string;
  code: string;
}

interface PersistedTab {
  name: string;
  path: string | null;
  content: string;
  savedContent: string;
  modified: boolean;
  cursorPosition?: number;
  scrollTop?: number;
}

interface Settings {
  customTemplates: Record<string, CustomTemplate>;
  theme: string;
  openTabs?: PersistedTab[];
  activeTabIndex?: number | null;
}

export class SettingsManager {
  private customTemplates: Map<string, CustomTemplate>;
  private currentTheme: string;
  private openTabs: PersistedTab[] = [];
  private activeTabIndex: number | null = null;
  private storageKey = "notepad-sharp-settings";

  constructor() {
    this.customTemplates = new Map();
    this.currentTheme = "dracula"; // Default theme is now Dracula (dark)
    this.loadSettings();
    console.log("SettingsManager initialized with theme:", this.currentTheme);
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const data: Settings = JSON.parse(saved);
        if (data.customTemplates) {
          this.customTemplates = new Map(Object.entries(data.customTemplates));
        }
        if (data.theme) {
          this.currentTheme = data.theme;
          console.log("Loaded saved theme:", this.currentTheme);
        }
        if (data.openTabs) {
          this.openTabs = data.openTabs;
          this.activeTabIndex = data.activeTabIndex ?? null;
          console.log("Loaded saved open tabs:", this.openTabs.length);
        }
      } else {
        console.log(
          "No saved settings found, using default theme:",
          this.currentTheme,
        );
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  private saveSettings(): void {
    try {
      const data: Settings = {
        customTemplates: Object.fromEntries(this.customTemplates),
        theme: this.currentTheme,
        openTabs: this.openTabs.length > 0 ? this.openTabs : undefined,
        activeTabIndex: this.activeTabIndex,
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      console.log("Settings saved. Theme:", this.currentTheme);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  // Open tabs persistence
  getOpenTabs(): { tabs: PersistedTab[]; activeIndex: number | null } {
    return { tabs: [...this.openTabs], activeIndex: this.activeTabIndex };
  }

  setOpenTabs(tabs: PersistedTab[], activeIndex: number | null): void {
    this.openTabs = tabs.map((t) => ({ ...t }));
    this.activeTabIndex = activeIndex;
    this.saveSettings();
  }

  // Theme Methods
  getTheme(): string {
    console.log("getTheme called, returning:", this.currentTheme);
    return this.currentTheme;
  }

  setTheme(theme: string): void {
    console.log("setTheme called with:", theme);
    this.currentTheme = theme;
    this.saveSettings();
  }

  // Template Methods
  getTemplate(key: string): string {
    // Check custom templates first
    const custom = this.customTemplates.get(key);
    if (custom) {
      return custom.code;
    }

    // Fall back to default templates
    return CODE_TEMPLATES[key as TemplateType] || "";
  }

  getAllTemplates(): Array<{
    key: string;
    name: string;
    code: string;
    isCustom: boolean;
  }> {
    const templates: Array<{
      key: string;
      name: string;
      code: string;
      isCustom: boolean;
    }> = [];

    // Add default templates
    const defaultTemplates: Array<{ key: TemplateType; name: string }> = [
      { key: "csharp", name: "C# Template" },
      { key: "cpp", name: "C++ Template" },
      { key: "python", name: "Python Template" },
      { key: "java", name: "Java Template" },
    ];

    defaultTemplates.forEach(({ key, name }) => {
      const customTemplate = this.customTemplates.get(key);
      templates.push({
        key,
        name,
        code: customTemplate ? customTemplate.code : CODE_TEMPLATES[key],
        isCustom: !!customTemplate,
      });
    });

    // Add custom-only templates
    this.customTemplates.forEach((template, key) => {
      if (!CODE_TEMPLATES[key as TemplateType]) {
        templates.push({
          key,
          name: template.name,
          code: template.code,
          isCustom: true,
        });
      }
    });

    return templates;
  }

  updateTemplate(key: string, code: string): void {
    const existingCustom = this.customTemplates.get(key);
    const name = existingCustom?.name || this.getDefaultTemplateName(key);

    this.customTemplates.set(key, { name, code });
    this.saveSettings();
  }

  addCustomTemplate(key: string, name: string, code: string): boolean {
    if (this.customTemplates.has(key) || CODE_TEMPLATES[key as TemplateType]) {
      return false; // Key already exists
    }

    this.customTemplates.set(key, { name, code });
    this.saveSettings();
    return true;
  }

  deleteCustomTemplate(key: string): boolean {
    if (CODE_TEMPLATES[key as TemplateType]) {
      return false; // Cannot delete default templates
    }

    const deleted = this.customTemplates.delete(key);
    if (deleted) {
      this.saveSettings();
    }
    return deleted;
  }

  resetTemplate(key: string): void {
    this.customTemplates.delete(key);
    this.saveSettings();
  }

  private getDefaultTemplateName(key: string): string {
    const names: Record<string, string> = {
      csharp: "C# Template",
      cpp: "C++ Template",
      python: "Python Template",
      java: "Java Template",
    };
    return names[key] || "Custom Template";
  }
}
