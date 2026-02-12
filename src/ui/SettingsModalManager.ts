// src/ui/SettingsModalManager.ts

import { SettingsManager } from "../managers/SettingsManager";
import { AVAILABLE_THEMES, getThemeExtension } from "../utils/themeUtils";

export class SettingsModalManager {
  private settingsManager: SettingsManager;
  private onThemeChanged: (theme: string) => void;
  private _currentActiveTab: "appearance" = "appearance";

  constructor(
    settingsManager: SettingsManager,
    onThemeChanged: (theme: string) => void,
  ) {
    this.settingsManager = settingsManager;
    this.onThemeChanged = onThemeChanged;

    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
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

    const appearanceTab = document.getElementById("settings-tab-appearance");
    appearanceTab?.addEventListener("click", () =>
      this.switchTab("appearance"),
    );
  }

  showSettingsModal(): void {
    this._currentActiveTab = "appearance";
    this.switchTab("appearance");
    this.setupThemeChangeHandler();
    this.loadThemeSettings();

    const modal = document.getElementById("settings-modal");
    modal?.classList.add("show");
  }

  private setupThemeChangeHandler(): void {
    const themeSelect = document.getElementById(
      "theme-select",
    ) as HTMLSelectElement;
    if (!themeSelect) return;

    const newSelect = themeSelect.cloneNode(true) as HTMLSelectElement;
    themeSelect.parentNode?.replaceChild(newSelect, themeSelect);

    newSelect.addEventListener("change", (e: Event) => {
      const select = e.target as HTMLSelectElement;
      if (typeof this.onThemeChanged === "function") {
        this.onThemeChanged(select.value);
      }
    });
  }

  hideSettingsModal(): void {
    const modal = document.getElementById("settings-modal");
    modal?.classList.remove("show");
  }

  private switchTab(tab: "appearance"): void {
    this._currentActiveTab = tab;
    const appearanceTab = document.getElementById("settings-tab-appearance");
    const appearancePanel = document.getElementById("appearance-panel");
    appearanceTab?.classList.add("active");
    if (appearancePanel) appearancePanel.style.display = "block";
  }

  private loadThemeSettings(): void {
    const themeSelect = document.getElementById(
      "theme-select",
    ) as HTMLSelectElement;
    if (!themeSelect) return;

    themeSelect.innerHTML = "";
    const currentTheme = this.settingsManager.getTheme();

    const darkThemes = AVAILABLE_THEMES.filter((t) => t.type === "dark");
    const lightThemes = AVAILABLE_THEMES.filter((t) => t.type === "light");

    const darkGroup = document.createElement("optgroup");
    darkGroup.label = "Dark Themes";
    darkThemes.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name;
      darkGroup.appendChild(option);
    });
    themeSelect.appendChild(darkGroup);

    const lightGroup = document.createElement("optgroup");
    lightGroup.label = "Light Themes";
    lightThemes.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name;
      lightGroup.appendChild(option);
    });
    themeSelect.appendChild(lightGroup);

    themeSelect.value = currentTheme;
  }

  private saveAllChanges(): void {
    const themeSelect = document.getElementById(
      "theme-select",
    ) as HTMLSelectElement;
    if (themeSelect) {
      this.settingsManager.setTheme(themeSelect.value);
    }

    this.hideSettingsModal();
  }
}
