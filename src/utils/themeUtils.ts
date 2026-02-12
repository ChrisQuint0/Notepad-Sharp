// src/utils/themeUtils.ts

import { Extension } from "@codemirror/state";
// Only keep Dracula (dark) and GitHub Light (light)
import { dracula, githubLight } from "@uiw/codemirror-themes-all";

export interface ThemeOption {
  id: string;
  name: string;
  type: "light" | "dark";
  extension: Extension;
}

export const AVAILABLE_THEMES: ThemeOption[] = [
  { id: "dracula", name: "Dracula", type: "dark", extension: dracula },
  {
    id: "githubLight",
    name: "GitHub Light",
    type: "light",
    extension: githubLight,
  },
];

export function getThemeExtension(themeId: string): Extension {
  const theme = AVAILABLE_THEMES.find((t) => t.id === themeId);
  if (!theme) {
    // Fallback to Dracula if missing
    return dracula;
  }
  return theme.extension;
}

export function getThemeType(themeId: string): "light" | "dark" {
  const theme = AVAILABLE_THEMES.find((t) => t.id === themeId);
  return theme ? theme.type : "dark";
}

export function getThemeName(themeId: string): string {
  const theme = AVAILABLE_THEMES.find((t) => t.id === themeId);
  return theme ? theme.name : "One Dark (Default)";
}
