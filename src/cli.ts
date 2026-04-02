#!/usr/bin/env node
import { generate } from "./generator.js";
import { init, type TemplateName } from "./init.js";

function printUsage(): void {
  console.log(`Usage:
  devcontainer-gen [config-file] [options]    Generate devcontainer files (default: devcontainer-gen.yml)
  devcontainer-gen init [options]             Generate a config YAML

Generate options:
  -o, --output-dir <dir>   Output directory (default: .devcontainer)

Init options:
  -t, --template <type>    Template: node, firebase, rails (required)
  -n, --name <name>        Project name (default: current directory name)
  -o, --output <file>      Output file (default: devcontainer-gen.yml)
  --postgres <version>     PostgreSQL version (default: 18, rails only)
  --redis <version>        Redis version (default: 7, rails only)

Common options:
  -h, --help               Show help`);
}

const VALID_TEMPLATES = ["node", "firebase", "rails"] as const;

function parseInitArgs(args: string[]): {
  template: TemplateName;
  name?: string;
  output: string;
  postgresVersion?: string;
  redisVersion?: string;
} {
  let template: TemplateName | undefined;
  let name: string | undefined;
  let output = "devcontainer-gen.yml";
  let postgresVersion: string | undefined;
  let redisVersion: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-t" || arg === "--template") {
      const val = args[++i];
      if (!val || !VALID_TEMPLATES.includes(val as TemplateName)) {
        console.error(
          `Error: --template must be one of: ${VALID_TEMPLATES.join(", ")}`,
        );
        process.exit(1);
      }
      template = val as TemplateName;
    } else if (arg === "-n" || arg === "--name") {
      name = args[++i];
      if (!name) {
        console.error("Error: --name requires a value");
        process.exit(1);
      }
    } else if (arg === "-o" || arg === "--output") {
      output = args[++i];
      if (!output) {
        console.error("Error: --output requires a value");
        process.exit(1);
      }
    } else if (arg === "--postgres") {
      postgresVersion = args[++i];
      if (!postgresVersion) {
        console.error("Error: --postgres requires a value");
        process.exit(1);
      }
    } else if (arg === "--redis") {
      redisVersion = args[++i];
      if (!redisVersion) {
        console.error("Error: --redis requires a value");
        process.exit(1);
      }
    } else {
      console.error(`Error: unknown option: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  if (!template) {
    console.error("Error: --template is required");
    printUsage();
    process.exit(1);
  }

  return { template, name, output, postgresVersion, redisVersion };
}

function parseGenerateArgs(args: string[]): {
  configPath: string;
  outputDir: string;
} {
  let configPath = "";
  let outputDir = ".devcontainer";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--output-dir") {
      outputDir = args[++i];
      if (!outputDir) {
        console.error("Error: --output-dir requires a value");
        process.exit(1);
      }
    } else if (!arg.startsWith("-")) {
      configPath = arg;
    } else {
      console.error(`Error: unknown option: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  if (!configPath) {
    configPath = "devcontainer-gen.yml";
  }

  return { configPath, outputDir };
}

const args = process.argv.slice(2);

if (args.includes("-h") || args.includes("--help")) {
  printUsage();
  process.exit(0);
}

if (args[0] === "init") {
  const options = parseInitArgs(args.slice(1));
  try {
    await init(options);
    console.log(`Generated config: ${options.output}`);
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
} else {
  const { configPath, outputDir } = parseGenerateArgs(args);
  try {
    await generate(configPath, outputDir);
    console.log(`Generated devcontainer files in: ${outputDir}`);
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
