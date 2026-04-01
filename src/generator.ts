import fs from "node:fs";
import path from "node:path";
import ejs from "ejs";
import { loadConfig } from "./config.js";
import type { TemplateContext } from "./types.js";

// tsx 実行時: src/templates, ビルド後: dist/ の1つ上の src/templates
const TEMPLATES_DIR = fs.existsSync(path.join(import.meta.dirname, "templates"))
  ? path.join(import.meta.dirname, "templates")
  : path.join(import.meta.dirname, "..", "src", "templates");

/** テンプレートファイルと出力ファイルのマッピング */
const TEMPLATE_FILES = [
  { template: "devcontainer.json.ejs", output: "devcontainer.json" },
  { template: "Dockerfile.ejs", output: "Dockerfile" },
  { template: "allowed-domains.conf.ejs", output: "allowed-domains.conf" },
  { template: "dnsmasq.conf.ejs", output: "dnsmasq.conf" },
  { template: "dnsmasq-observe.conf.ejs", output: "dnsmasq-observe.conf" },
  { template: "initialize.sh.ejs", output: "initialize.sh" },
  { template: "post-start.sh.ejs", output: "post-start.sh" },
  {
    template: "cleanup-devcontainer-images.sh.ejs",
    output: "cleanup-devcontainer-images.sh",
  },
  {
    template: "cleanup-devcontainer-volumes.sh.ejs",
    output: "cleanup-devcontainer-volumes.sh",
  },
];

/** docker-compose がある場合のみ生成 */
const COMPOSE_TEMPLATE = {
  template: "docker-compose.yml.ejs",
  output: "docker-compose.yml",
};

/** 静的コピーするファイル */
const STATIC_FILES = ["init-firewall.sh", "test-firewall.sh"];

/** 実行権限を付与するファイル */
const EXECUTABLE_FILES = [
  "init-firewall.sh",
  "test-firewall.sh",
  "initialize.sh",
  "post-start.sh",
  "cleanup-devcontainer-images.sh",
  "cleanup-devcontainer-volumes.sh",
];

export async function generate(
  configPath: string,
  outputDir: string,
): Promise<void> {
  const context = loadConfig(configPath);

  fs.mkdirSync(outputDir, { recursive: true });

  // テンプレートからファイルを生成
  for (const { template, output } of TEMPLATE_FILES) {
    renderTemplate(template, output, context, outputDir);
  }

  // docker-compose.yml は services がある場合のみ
  if (context.hasServices) {
    renderTemplate(
      COMPOSE_TEMPLATE.template,
      COMPOSE_TEMPLATE.output,
      context,
      outputDir,
    );
  }

  // 静的ファイルをコピー
  for (const file of STATIC_FILES) {
    const src = path.join(TEMPLATES_DIR, file);
    const dest = path.join(outputDir, file);
    fs.copyFileSync(src, dest);
  }

  // 実行権限を付与
  for (const file of EXECUTABLE_FILES) {
    const filePath = path.join(outputDir, file);
    if (fs.existsSync(filePath)) {
      fs.chmodSync(filePath, 0o755);
    }
  }
}

function renderTemplate(
  templateName: string,
  outputName: string,
  context: TemplateContext,
  outputDir: string,
): void {
  const templatePath = path.join(TEMPLATES_DIR, templateName);
  const templateContent = fs.readFileSync(templatePath, "utf-8");
  const rendered = ejs.render(templateContent, context);
  const outputPath = path.join(outputDir, outputName);
  fs.writeFileSync(outputPath, rendered);
}
