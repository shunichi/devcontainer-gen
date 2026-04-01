import fs from "node:fs";
import yaml from "js-yaml";
import type { DevcontainerConfig, TemplateContext } from "./types.js";

export function loadConfig(configPath: string): TemplateContext {
  const raw = fs.readFileSync(configPath, "utf-8");
  const config = yaml.load(raw) as DevcontainerConfig;

  validate(config);
  return buildContext(applyDefaults(config));
}

function validate(config: DevcontainerConfig): void {
  if (!config.project?.name) {
    throw new Error("project.name is required");
  }
  if (!config.container?.user) {
    throw new Error("container.user is required");
  }
  if (!config.languages?.node && !config.languages?.ruby) {
    throw new Error(
      "At least one of languages.node or languages.ruby is required",
    );
  }
  if (!config.vscode?.extensions) {
    throw new Error("vscode.extensions is required");
  }
}

function applyDefaults(config: DevcontainerConfig): DevcontainerConfig {
  return {
    ...config,
    container: {
      timezone: "Asia/Tokyo",
      firewall_mode: "restrict",
      ...config.container,
    },
    tools: {
      git_delta: "0.18.2",
      zsh_in_docker: "1.2.0",
      ...config.tools,
    },
    mounts: config.mounts ?? [],
    ports: config.ports ?? [],
    allowed_domains: config.allowed_domains ?? [],
    container_env: config.container_env ?? {},
    lifecycle: config.lifecycle ?? {},
    system_packages: config.system_packages ?? [],
    dockerfile: config.dockerfile ?? {},
  };
}

/**
 * languages からベースイメージを決定する。
 * - Ruby がある場合: ruby:{version}-bookworm（Node は nodesource で追加）
 * - Node のみの場合: node:{version}-bookworm
 */
function resolveBaseImage(config: DevcontainerConfig): string {
  if (config.languages?.ruby) {
    return `ruby:${config.languages.ruby.version}-bookworm`;
  }
  return `node:${config.languages!.node!.version}-bookworm`;
}

function buildContext(config: DevcontainerConfig): TemplateContext {
  const baseImage = resolveBaseImage(config);

  const hasServices =
    config.services != null && Object.keys(config.services).length > 0;
  const serviceNames = hasServices ? Object.keys(config.services!) : [];

  // Ruby ベースの場合、Node は nodesource でインストールが必要
  const needsNodeInstall =
    config.languages?.ruby != null && config.languages?.node != null;

  // Node ベースイメージには既存の node ユーザーがある
  const userExists = !config.languages?.ruby;

  return {
    ...config,
    baseImage,
    hasServices,
    serviceNames,
    needsNodeInstall,
    userExists,
  };
}
