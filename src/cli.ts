import { generate } from "./generator.js";

function printUsage(): void {
  console.log(`Usage: tsx src/cli.ts <config-file> [options]

Options:
  -o, --output-dir <dir>  Output directory (default: .devcontainer)
  -h, --help              Show help`);
}

function parseArgs(argv: string[]): {
  configPath: string;
  outputDir: string;
} {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printUsage();
    process.exit(0);
  }

  let configPath = "";
  let outputDir = ".devcontainer";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--output-dir") {
      i++;
      outputDir = args[i];
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
    console.error("Error: config file is required");
    printUsage();
    process.exit(1);
  }

  return { configPath, outputDir };
}

const { configPath, outputDir } = parseArgs(process.argv);

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
