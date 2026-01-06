// src/types/index.ts

export interface Tab {
  id: number;
  name: string;
  path: string | null;
  content: string;
  savedContent: string;
  modified: boolean;
}

export type TemplateType = "csharp" | "cpp" | "python" | "java";

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface PistonExecuteRequest {
  language: string;
  version: string;
  files: Array<{
    content: string;
    name?: string;
  }>;
  stdin?: string;
  compile_timeout?: number;
  run_timeout?: number;
}

export interface PistonExecuteResponse {
  language: string;
  version: string;
  compile?: {
    stdout: string;
    stderr: string;
    code: number;
    output: string;
  };
  run: {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: string | null;
    output: string;
  };
}

export interface EditorConfig {
  tabSize: number;
  defaultFileName: string;
  welcomeMessage: string;
}

export type OutputType = "running" | "success" | "error";

export interface FileOperationResult {
  path: string;
  content: string;
  name: string;
}
