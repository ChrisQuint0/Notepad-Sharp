import { getCurrentWindow } from "@tauri-apps/api/window";

export class TitlebarManager {
  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const appWindow = getCurrentWindow();
    const minimizeBtn = document.getElementById("titlebar-minimize");
    const maximizeBtn = document.getElementById("titlebar-maximize");
    const closeBtn = document.getElementById("titlebar-close");

    if (minimizeBtn) {
      minimizeBtn.addEventListener("click", () => {
        appWindow.minimize();
      });
    }

    if (maximizeBtn) {
      const updateMaximizeIcon = async () => {
        try {
          const isMaximized = await appWindow.isMaximized();
          if (isMaximized) {
            maximizeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 8h12v12H8z"/><path d="M16 8V4H4v12h4"/></svg>`;
          } else {
            maximizeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/></svg>`;
          }
        } catch (e) {
          console.error("Failed to check maximize state", e);
        }
      };

      updateMaximizeIcon();
      appWindow.onResized(() => {
        updateMaximizeIcon();
      });

      maximizeBtn.addEventListener("click", async () => {
        await appWindow.toggleMaximize();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        appWindow.close();
      });
    }
  }
}
