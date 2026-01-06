// src/utils/codeFormatter.ts

import * as beautify from "js-beautify";
import { EDITOR_CONFIG } from "../constants";

export function shouldFormat(path: string | null): boolean {
  return path !== null && path.endsWith(".cs");
}

export function formatCode(code: string): string {
  return beautify.js_beautify(code, {
    indent_size: EDITOR_CONFIG.tabSize,
    indent_char: " ",
    max_preserve_newlines: 2,
    preserve_newlines: true,
    keep_array_indentation: false,
    break_chained_methods: false,
    brace_style: "collapse",
    space_before_conditional: true,
    unescape_strings: false,
    jslint_happy: false,
    end_with_newline: false,
    wrap_line_length: 0,
    comma_first: false,
    indent_empty_lines: false,
  });
}
