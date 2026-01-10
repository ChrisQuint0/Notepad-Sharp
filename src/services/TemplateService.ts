// src/services/TemplateService.ts

import { SettingsManager } from "../managers/SettingsManager";
import type { TemplateType } from "../types";

export class TemplateService {
  private settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  getTemplate(templateType: string): string | null {
    return this.settingsManager.getTemplate(templateType) || null;
  }

  getAllTemplateTypes(): string[] {
    return this.settingsManager.getAllTemplateKeys();
  }
}
