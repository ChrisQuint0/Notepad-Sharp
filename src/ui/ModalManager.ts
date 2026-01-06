// src/ui/ModalManager.ts

import type { OutputType } from "../types";

export class ModalManager {
  // Runner Modal
  showRunnerModal(): void {
    const modal = document.getElementById("runner-modal");
    if (modal) {
      modal.classList.add("show");
    }
  }

  hideRunnerModal(): void {
    const modal = document.getElementById("runner-modal");
    if (modal) {
      modal.classList.remove("show");
    }
  }

  // C# Warning Modal
  showCSharpWarningModal(): void {
    const modal = document.getElementById("csharp-warning-modal");
    modal?.classList.add("show");
  }

  hideCSharpWarningModal(): void {
    const modal = document.getElementById("csharp-warning-modal");
    modal?.classList.remove("show");
  }

  // Input Section Toggle
  toggleInputSection(): void {
    const inputTextarea = document.getElementById(
      "code-input"
    ) as HTMLTextAreaElement;
    const toggleBtn = document.getElementById("toggle-input");

    if (inputTextarea && toggleBtn) {
      inputTextarea.classList.toggle("collapsed");
      toggleBtn.classList.toggle("collapsed");

      toggleBtn.textContent = inputTextarea.classList.contains("collapsed")
        ? "▶"
        : "▼";
    }
  }

  // Output Display
  clearOutput(): void {
    const outputDisplay = document.getElementById("code-output");
    if (outputDisplay) {
      outputDisplay.innerHTML =
        '<div class="output-placeholder">Click "Run Code" to see output</div>';
    }
  }

  displayOutput(text: string, type: OutputType = "success"): void {
    const outputDisplay = document.getElementById("code-output");
    if (outputDisplay) {
      outputDisplay.className = `output-display output-${type}`;
      outputDisplay.textContent = text;
    }
  }

  // Run Button State
  setRunButtonState(disabled: boolean, text: string): void {
    const runButton = document.getElementById(
      "btn-run-code"
    ) as HTMLButtonElement;
    if (runButton) {
      runButton.disabled = disabled;
      runButton.textContent = text;
    }
  }
}
