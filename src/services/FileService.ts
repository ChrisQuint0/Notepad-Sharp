// src/services/FileService.ts

import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { FILE_FILTERS } from "../constants";
import type { FileOperationResult } from "../types";
import { extractFileName } from "../utils/helpers";

export class FileService {
  async openFile(): Promise<FileOperationResult | null> {
    try {
      const selected = await open({
        multiple: false,
        filters: FILE_FILTERS,
      });

      if (selected && typeof selected === "string") {
        const content = await readTextFile(selected);
        const name = extractFileName(selected);
        return { path: selected, content, name };
      }

      return null;
    } catch (error) {
      console.error("Error opening file:", error);
      throw error;
    }
  }

  async saveFile(path: string, content: string): Promise<void> {
    try {
      await writeTextFile(path, content);
    } catch (error) {
      console.error("Error saving file:", error);
      throw error;
    }
  }

  async promptSaveLocation(): Promise<string | null> {
    try {
      const selected = await save({ filters: FILE_FILTERS });
      return selected && typeof selected === "string" ? selected : null;
    } catch (error) {
      console.error("Error prompting save location:", error);
      return null;
    }
  }
}
