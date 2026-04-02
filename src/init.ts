import { execSync } from "node:child_process";
import { basename } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import yaml from "js-yaml";
import type { DevcontainerConfig, MountConfig } from "./types.js";

export type TemplateName = "node" | "firebase" | "rails";

export interface InitOptions {
  template: TemplateName;
  name?: string;
  output: string;
  postgresVersion?: string;
  redisVersion?: string;
}

export function detectNodeVersion(): string {
  try {
    const output = execSync("node -v", { encoding: "utf-8" }).trim();
    const match = output.match(/^v(\d+)/);
    return match ? match[1] : "22";
  } catch {
    return "22";
  }
}

export function detectPnpmVersion(): string {
  try {
    const output = execSync("pnpm -v", { encoding: "utf-8" }).trim();
    const match = output.match(/^(\d+\.\d+\.\d+)/);
    if (match) return match[1];
  } catch {
    // pnpm not installed, fall through
  }
  return "10";
}

/** pnpm-lock.yaml の importers からワークスペースパッケージのパスを取得 */
export function detectPnpmImporters(): string[] {
  const lockfilePath = "pnpm-lock.yaml";
  if (!existsSync(lockfilePath)) return ["."];
  try {
    const content = readFileSync(lockfilePath, "utf-8");
    const lockfile = yaml.load(content) as Record<string, unknown>;
    const importers = lockfile?.importers as Record<string, unknown> | undefined;
    if (!importers) return ["."];
    return Object.keys(importers);
  } catch {
    return ["."];
  }
}

/** importers のパスから node_modules のマウント設定を生成 */
function nodeModuleMounts(importers: string[]): MountConfig[] {
  return importers.map((dir) => {
    const rel = dir === "." ? "" : `${dir}/`;
    const name = dir === "."
      ? "node-modules"
      : `${dir.replace(/\//g, "-")}-node-modules`;
    return { name, target: `/workspace/${rel}node_modules` };
  });
}

export function detectRubyVersion(): string {
  try {
    const output = execSync("ruby -v", { encoding: "utf-8" }).trim();
    const match = output.match(/^ruby (\d+\.\d+\.\d+)/);
    return match ? match[1] : "3.4.5";
  } catch {
    return "3.4.5";
  }
}

function resolveProjectName(name?: string): string {
  return name ?? basename(process.cwd());
}

function nodeTemplate(
  projectName: string,
  nodeVersion: string,
  pnpmVersion: string,
  importers: string[],
): DevcontainerConfig {
  return {
    project: { name: projectName },
    container: {
      user: "node",
      timezone: "Asia/Tokyo",
      firewall_mode: "restrict",
      editor: "code",
    },
    languages: {
      node: {
        version: nodeVersion,
        package_manager: "pnpm",
        pnpm_version: pnpmVersion,
      },
    },
    tools: {
      git_delta: "0.18.2",
      zsh_in_docker: "1.2.0",
    },
    vscode: {
      extensions: ["eamodio.gitlens", "anthropic.claude-code"],
      settings: {
        "terminal.integrated.defaultProfile.linux": "zsh",
        "debug.javascript.autoAttachFilter": "disabled",
      },
    },
    mounts: [
      { name: "pnpm-store", target: "/workspace/.pnpm-store" },
      ...nodeModuleMounts(importers),
    ],
    container_env: {
      NODE_OPTIONS: "--max-old-space-size=4096 --dns-result-order=ipv4first",
    },
    lifecycle: {
      post_create: "pnpm install",
    },
  };
}

function firebaseTemplate(
  projectName: string,
  nodeVersion: string,
  pnpmVersion: string,
  importers: string[],
): DevcontainerConfig {
  return {
    project: { name: projectName },
    container: {
      user: "node",
      timezone: "Asia/Tokyo",
      firewall_mode: "restrict",
      editor: "code",
    },
    languages: {
      node: {
        version: nodeVersion,
        package_manager: "pnpm",
        pnpm_version: pnpmVersion,
      },
    },
    tools: {
      git_delta: "0.18.2",
      zsh_in_docker: "1.2.0",
      firebase_tools: "13",
    },
    system_packages: ["default-jre-headless"],
    vscode: {
      extensions: ["eamodio.gitlens", "anthropic.claude-code"],
      settings: {
        "terminal.integrated.defaultProfile.linux": "zsh",
        "debug.javascript.autoAttachFilter": "disabled",
      },
    },
    mounts: [
      { name: "pnpm-store", target: "/workspace/.pnpm-store" },
      ...nodeModuleMounts(importers),
      { name: "firebase-emulators-cache", target: "/home/node/.cache/firebase/emulators" },
      { name: "firebase-config", target: "/home/node/.config/configstore" },
    ],
    container_env: {
      NODE_OPTIONS: "--max-old-space-size=4096 --dns-result-order=ipv4first",
      FIREBASE_CONFIG_OPTS: "--config /workspace/firebase.devcontainer.json",
    },
    allowed_domains: [
      {
        group: "Firebase / Google",
        domains: [
          "googleapis.com",
          "google.com",
          "firebaseio.com",
          "firebaseapp.com",
          "gstatic.com",
          "googleusercontent.com",
          "cloudfunctions.net",
          "run.app",
          "appspot.com",
        ],
      },
    ],
    ports: [
      { port: 3000, label: "Dev Server", on_auto_forward: "notify" },
      { port: 4000, label: "Firebase Emulator UI", on_auto_forward: "notify" },
      { port: 5100, label: "Functions Emulator", on_auto_forward: "silent" },
      { port: 54400, label: "Emulator Hub", on_auto_forward: "silent" },
      { port: 55002, label: "Hosting Emulator", on_auto_forward: "silent" },
      { port: 58080, label: "Firestore Emulator", on_auto_forward: "silent" },
      { port: 59099, label: "Auth Emulator", on_auto_forward: "silent" },
      { port: 59499, label: "Tasks Emulator", on_auto_forward: "silent" },
    ],
    lifecycle: {
      post_create: "pnpm install",
      post_start_extra:
        'jq \'(.emulators[].host) = "0.0.0.0"\' firebase.json > firebase.devcontainer.json',
    },
  };
}

function railsTemplate(
  projectName: string,
  rubyVersion: string,
  nodeVersion: string,
  pnpmVersion: string,
  postgresVersion: string,
  redisVersion: string,
): DevcontainerConfig {
  return {
    project: { name: projectName },
    container: {
      user: "dev",
      timezone: "Asia/Tokyo",
      firewall_mode: "restrict",
      editor: "code",
    },
    languages: {
      ruby: { version: rubyVersion },
      node: {
        version: nodeVersion,
        package_manager: "pnpm",
        pnpm_version: pnpmVersion,
      },
    },
    tools: {
      git_delta: "0.18.2",
      zsh_in_docker: "1.2.0",
    },
    system_packages: [
      "locales",
      "build-essential",
      "libpq-dev",
      "libvips",
    ],
    services: {
      db: {
        image: `postgres:${postgresVersion}`,
        environment: {
          POSTGRES_USER: "root",
          POSTGRES_PASSWORD: "password",
        },
        volumes: [`pgdata-${postgresVersion}:/var/lib/postgresql${parseInt(postgresVersion, 10) >= 18 ? "" : "/data"}`],
        ports: ["15432:5432"],
      },
      redis: {
        image: `redis:${redisVersion}`,
        volumes: [`redis-data-${redisVersion}:/data`],
      },
    },
    vscode: {
      extensions: [
        "eamodio.gitlens",
        "anthropic.claude-code",
        "Shopify.ruby-lsp",
        "KoichiSasada.vscode-rdbg",
      ],
      settings: {
        "terminal.integrated.defaultProfile.linux": "zsh",
        "debug.javascript.autoAttachFilter": "disabled",
      },
    },
    mounts: [
      { name: "pnpm-store", target: "/workspace/.pnpm-store" },
      { name: "node-modules", target: "/workspace/node_modules" },
      { name: "bundle-cache", target: "/usr/local/bundle" },
      { name: "vendor-bundle", target: "/workspace/vendor/bundle" },
    ],
    container_env: {
      NODE_OPTIONS: "--max-old-space-size=4096 --dns-result-order=ipv4first",
      DATABASE_CONFIG: "config/database.devcontainer.yml",
      REDIS_URL: "redis://redis:6379/1",
    },
    allowed_domains: [
      {
        group: "CopyTuner",
        domains: ["copy-tuner.sg-apps.com"],
      },
    ],
    compose: {
      app_environment: {
        RUBYOPT: "-EUTF-8",
      },
    },
    ports: [
      { port: 3000, label: "Rails", on_auto_forward: "notify" },
    ],
    lifecycle: {
      post_create: "bundle install && pnpm install",
    },
  };
}

interface TemplateParams {
  projectName: string;
  nodeVersion: string;
  pnpmVersion: string;
  rubyVersion: string;
  postgresVersion: string;
  redisVersion: string;
  importers: string[];
}

const TEMPLATE_BUILDERS: Record<
  TemplateName,
  (p: TemplateParams) => DevcontainerConfig
> = {
  node: (p) => nodeTemplate(p.projectName, p.nodeVersion, p.pnpmVersion, p.importers),
  firebase: (p) => firebaseTemplate(p.projectName, p.nodeVersion, p.pnpmVersion, p.importers),
  rails: (p) => railsTemplate(p.projectName, p.rubyVersion, p.nodeVersion, p.pnpmVersion, p.postgresVersion, p.redisVersion),
};

export async function init(options: InitOptions): Promise<void> {
  const projectName = resolveProjectName(options.name);
  const nodeVersion = detectNodeVersion();
  const pnpmVersion = detectPnpmVersion();
  const rubyVersion = options.template === "rails" ? detectRubyVersion() : "";
  const importers = (options.template === "node" || options.template === "firebase")
    ? detectPnpmImporters()
    : ["."];

  const postgresVersion = options.postgresVersion ?? "18";
  const redisVersion = options.redisVersion ?? "7";

  const builder = TEMPLATE_BUILDERS[options.template];
  const config = builder({ projectName, nodeVersion, pnpmVersion, rubyVersion, postgresVersion, redisVersion, importers });

  const yamlStr = yaml.dump(config, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
    noRefs: true,
    sortKeys: false,
  });

  writeFileSync(options.output, yamlStr, "utf-8");
}
