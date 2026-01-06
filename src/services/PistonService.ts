// services/PistonService.ts

import { PistonExecuteRequest, PistonExecuteResponse } from "../types";
import { PISTON_API } from "../constants";

export class PistonService {
  async executeCode(
    language: string,
    code: string,
    stdin: string = ""
  ): Promise<PistonExecuteResponse> {
    const formattedStdin = stdin
      ? stdin.endsWith("\n")
        ? stdin
        : stdin + "\n"
      : "";

    const isCSharp = language === "csharp";

    const payload: PistonExecuteRequest = {
      language,
      version: "*",
      files: [{ name: "Program.cs", content: code }],
      stdin: formattedStdin || undefined,
      compile_timeout: 20000,
      run_timeout: isCSharp ? 20000 : 5000,
    };

    const response = await fetch(`${PISTON_API.baseUrl}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Piston error:", err);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  formatOutput(result: PistonExecuteResponse): {
    text: string;
    type: "success" | "error";
  } {
    let output = "";
    let type: "success" | "error" = "success";

    if (result.run.signal === "SIGKILL") {
      type = "error";
      output = "Program terminated (timeout or waiting for input)\n";
      if (result.run.stdout) output += `\nOutput:\n${result.run.stdout}`;
    } else if (result.compile && result.compile.code !== 0) {
      type = "error";
      output = "Compilation Failed\n\n";
      output += result.compile.stderr || result.compile.output || "";
    } else if (result.run.code === 0 || result.run.code === null) {
      type = "success";
      output =
        result.run.stdout ||
        result.run.output ||
        "✓ Program executed successfully (No output)";
    } else {
      type = "error";
      output = `Runtime Error (Exit Code: ${result.run.code})\n\n`;
      if (result.run.stderr) output += result.run.stderr;
      if (result.run.stdout) output += `\nOutput:\n${result.run.stdout}`;
    }

    return { text: output, type };
  }
}
