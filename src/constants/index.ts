// src/constants/index.ts

import type { FileFilter, TemplateType, EditorConfig } from "../types";

export const FILE_FILTERS: FileFilter[] = [
  { name: "All Files", extensions: ["*"] },
  { name: "C# Files", extensions: ["cs"] },
  { name: "C++ Files", extensions: ["cpp", "c", "h"] },
  { name: "Python Files", extensions: ["py"] },
  { name: "Java Files", extensions: ["java"] },
  { name: "Text Files", extensions: ["txt", "md"] },
];

export const CODE_TEMPLATES: Record<TemplateType, string> = {
  csharp: `using System;
using System.Linq;
using System.Collections.Generic;

class Program {
  static void Main() {
    int n = int.Parse(Console.ReadLine());
    Console.WriteLine("You entered: " + n);
  }
}`,

  cpp: `#include <bits/stdc++.h>
using namespace std;

#define ll long long
#define pb push_back
#define all(x) x.begin(), x.end()
#define MOD 1000000007

int main() {
  ios_base::sync_with_stdio(false);
  cin.tie(NULL);
  
  
  return 0;
}`,

  python: `import sys
input = sys.stdin.readline

def main():
  

if __name__ == "__main__":
  main()`,

  java: `import java.util.*;
import java.io.*;

public class Main {
  public static void main(String[] args) {
    
  }
}`,
};

export const EDITOR_CONFIG: EditorConfig = {
  tabSize: 2,
  defaultFileName: "Untitled",
  welcomeMessage:
    "// Welcome to Notepad#\n// Start typing your code here...\n\n//Developed By: Christopher A. Quinto\n//https://github.com/ChrisQuint0",
};

export const PISTON_API = {
  baseUrl: "https://emkc.org/api/v2/piston",
};

export const LANGUAGE_IDS: Record<string, string> = {
  cs: "csharp",
  cpp: "cpp",
  c: "c",
  py: "python",
  java: "java",
  js: "javascript",
};

// Zoom configuration
export const ZOOM_CONFIG = {
  min: 50,
  max: 300,
  default: 100,
  step: 10,
  baseFontSize: 14,
};
