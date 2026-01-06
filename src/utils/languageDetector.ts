// src/utils/languageDetector.ts

import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { LANGUAGE_IDS } from "../constants";

export function getLanguageId(filePath: string | null): string {
  if (!filePath) return "";
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return LANGUAGE_IDS[ext] || "";
}

export function getLanguageExtension(filePath: string | null) {
  if (!filePath) return [];
  const ext = filePath.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "cs":
      return [cpp()];
    case "cpp":
      return [cpp()];
    case "c":
      return [cpp()];
    case "h":
      return [cpp()];
    case "py":
      return [cpp()];
    case "java":
      return [java()];
    default:
      return [];
  }
}
