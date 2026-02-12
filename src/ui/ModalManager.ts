// src/ui/ModalManager.ts

import type { OutputType } from "../types";

export class ModalManager {
  // Keep a minimal API for displaying messages to the user
  displayOutput(text: string, type: OutputType = "success"): void {
    const outputDisplay = document.getElementById("code-output");
    if (outputDisplay) {
      outputDisplay.className = `output-display output-${type}`;
      outputDisplay.textContent = text;
    } else {
      // Fallback to console if UI element removed
      console.log(`[${type}] ${text}`);
    }
  }
}
