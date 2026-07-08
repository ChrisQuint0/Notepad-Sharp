// src/main.ts

import { EditorManager } from "./managers/EditorManager";
import { TitlebarManager } from "./ui/TitlebarManager";

// Initialize the application
new EditorManager();
new TitlebarManager();

console.log("Notepad# initialized successfully");
