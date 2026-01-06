// src/services/TemplateService.ts

import { CODE_TEMPLATES } from "../constants";
import type { TemplateType } from "../types";

export class TemplateService {
  getTemplate(templateType: TemplateType): string | null {
    return CODE_TEMPLATES[templateType] || null;
  }

  getAllTemplateTypes(): TemplateType[] {
    return Object.keys(CODE_TEMPLATES) as TemplateType[];
  }
}
