// src/utils/themeUtils.ts

import { oneDark } from "@codemirror/theme-one-dark";
import { Extension } from "@codemirror/state";

// Import from @uiw/codemirror-themes-all
import {
  basicLight,
  basicDark,
  dracula,
  githubLight,
  githubDark,
  materialDark,
  materialLight,
  solarizedLight,
  solarizedDark,
  vscodeDark,
  tokyoNight,
  tokyoNightStorm,
  tokyoNightDay,
  gruvboxDark,
  gruvboxLight,
  nord,
  atomone,
} from "@uiw/codemirror-themes-all";

export interface ThemeOption {
  id: string;
  name: string;
  type: "light" | "dark";
  extension: Extension;
}

export const AVAILABLE_THEMES: ThemeOption[] = [
  // Dark Themes
  {
    id: "oneDark",
    name: "One Dark (Default)",
    type: "dark",
    extension: oneDark,
  },
  { id: "atomone", name: "Atom One", type: "dark", extension: atomone },
  { id: "basicDark", name: "Basic Dark", type: "dark", extension: basicDark },
  {
    id: "vscodeDark",
    name: "VS Code Dark",
    type: "dark",
    extension: vscodeDark,
  },
  { id: "dracula", name: "Dracula", type: "dark", extension: dracula },
  {
    id: "githubDark",
    name: "GitHub Dark",
    type: "dark",
    extension: githubDark,
  },
  {
    id: "materialDark",
    name: "Material Dark",
    type: "dark",
    extension: materialDark,
  },
  {
    id: "solarizedDark",
    name: "Solarized Dark",
    type: "dark",
    extension: solarizedDark,
  },
  {
    id: "gruvboxDark",
    name: "Gruvbox Dark",
    type: "dark",
    extension: gruvboxDark,
  },
  { id: "nord", name: "Nord", type: "dark", extension: nord },
  {
    id: "tokyoNight",
    name: "Tokyo Night",
    type: "dark",
    extension: tokyoNight,
  },
  {
    id: "tokyoNightStorm",
    name: "Tokyo Night Storm",
    type: "dark",
    extension: tokyoNightStorm,
  },

  // Light Themes
  {
    id: "basicLight",
    name: "Basic Light",
    type: "light",
    extension: basicLight,
  },
  {
    id: "githubLight",
    name: "GitHub Light",
    type: "light",
    extension: githubLight,
  },
  {
    id: "materialLight",
    name: "Material Light",
    type: "light",
    extension: materialLight,
  },
  {
    id: "solarizedLight",
    name: "Solarized Light",
    type: "light",
    extension: solarizedLight,
  },
  {
    id: "gruvboxLight",
    name: "Gruvbox Light",
    type: "light",
    extension: gruvboxLight,
  },
  {
    id: "tokyoNightDay",
    name: "Tokyo Night Day",
    type: "light",
    extension: tokyoNightDay,
  },
];

export function getThemeExtension(themeId: string): Extension {
  console.log("Getting theme extension for:", themeId);
  const theme = AVAILABLE_THEMES.find((t) => t.id === themeId);
  if (!theme) {
    console.warn(`Theme "${themeId}" not found, falling back to One Dark`);
    return oneDark;
  }
  console.log("Found theme:", theme.name);
  return theme.extension;
}

export function getThemeName(themeId: string): string {
  const theme = AVAILABLE_THEMES.find((t) => t.id === themeId);
  return theme ? theme.name : "One Dark (Default)";
}
