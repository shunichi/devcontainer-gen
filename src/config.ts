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
  if (!config.container?.base_image) {
    throw new Error("container.base_image is required");
  }
  if (!config.container?.user) {
    throw new Error("container.user is required");
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
      claude_code: "latest",
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
  };
}

function buildContext(config: DevcontainerConfig): TemplateContext {
  const hasServices =
    config.services != null && Object.keys(config.services).length > 0;
  const serviceNames = hasServices ? Object.keys(config.services!) : [];

  // Node.js がベースイメージに含まれるかどうか
  const baseHasNode = config.container.base_image.startsWith("node:");

  // languages.node があるがベースイメージに Node がない場合、インストールが必要
  const needsNodeInstall =
    config.languages?.node != null && !baseHasNode;

  // user_exists が明示されていなければベースイメージから推定
  const userExists =
    config.container.user_exists ?? baseHasNode;

  return {
    ...config,
    hasServices,
    serviceNames,
    needsNodeInstall,
    userExists,
  };
}
