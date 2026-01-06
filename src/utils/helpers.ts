// src/utils/helpers.ts

import { EDITOR_CONFIG } from "../constants";

export function extractFileName(path: string): string {
  return path.split(/[/\\]/).pop() || EDITOR_CONFIG.defaultFileName;
}

export function expectsInput(code: string): boolean {
  return /Console\.ReadLine\s*\(/.test(code);
}
