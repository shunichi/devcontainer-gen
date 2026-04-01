import { execSync } from "node:child_process";
import { basename } from "node:path";
import { writeFileSync } from "node:fs";
import yaml from "js-yaml";
import type { DevcontainerConfig } from "./types.js";

export type TemplateName = "node" | "firebase" | "rails";

export interface InitOptions {
  template: TemplateName;
  name?: string;
  output: string;
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
): DevcontainerConfig {
  return {
    project: { name: projectName },
    container: {
      user: "node",
      timezone: "Asia/Tokyo",
      firewall_mode: "restrict",
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
      extensions: ["anthropic.claude-code"],
      settings: {
        "terminal.integrated.defaultProfile.linux": "zsh",
        "debug.javascript.autoAttachFilter": "disabled",
      },
    },
    mounts: [
      { name: "pnpm-store", target: "/workspace/.pnpm-store" },
      { name: "node-modules", target: "/workspace/node_modules" },
    ],
    container_env: {
      NODE_OPTIONS: "--max-old-space-size=4096 --dns-result-order=ipv4first",
    },
    lifecycle: {
      post_create: "pnpm install",
    },
    dockerfile: {
      pre_create_dirs: [".pnpm-store", "node_modules"],
    },
  };
}

function firebaseTemplate(
  projectName: string,
  nodeVersion: string,
  pnpmVersion: string,
): DevcontainerConfig {
  return {
    project: { name: projectName },
    container: {
      user: "node",
      timezone: "Asia/Tokyo",
      firewall_mode: "restrict",
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
      extensions: ["anthropic.claude-code"],
      settings: {
        "terminal.integrated.defaultProfile.linux": "zsh",
        "debug.javascript.autoAttachFilter": "disabled",
      },
    },
    mounts: [
      { name: "pnpm-store", target: "/workspace/.pnpm-store" },
      { name: "node-modules", target: "/workspace/node_modules" },
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
    dockerfile: {
      pre_create_dirs: [".pnpm-store", "node_modules"],
    },
  };
}

function railsTemplate(
  projectName: string,
  rubyVersion: string,
  nodeVersion: string,
  pnpmVersion: string,
): DevcontainerConfig {
  return {
    project: { name: projectName },
    container: {
      user: "dev",
      timezone: "Asia/Tokyo",
      firewall_mode: "restrict",
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
        image: "postgres:18",
        environment: {
          POSTGRES_USER: "root",
          POSTGRES_PASSWORD: "password",
        },
        volumes: ["pgdata:/var/lib/postgresql/data"],
        ports: ["15432:5432"],
      },
      redis: {
        image: "redis:7",
        volumes: ["redis-data:/data"],
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
    dockerfile: {
      pre_create_dirs: [".pnpm-store", "node_modules", "vendor/bundle"],
    },
  };
}

const TEMPLATE_BUILDERS: Record<
  TemplateName,
  (projectName: string, nodeVersion: string, pnpmVersion: string, rubyVersion: string) => DevcontainerConfig
> = {
  node: (name, nodeVer, pnpmVer) => nodeTemplate(name, nodeVer, pnpmVer),
  firebase: (name, nodeVer, pnpmVer) => firebaseTemplate(name, nodeVer, pnpmVer),
  rails: (name, nodeVer, pnpmVer, rubyVer) => railsTemplate(name, rubyVer, nodeVer, pnpmVer),
};

export async function init(options: InitOptions): Promise<void> {
  const projectName = resolveProjectName(options.name);
  const nodeVersion = detectNodeVersion();
  const pnpmVersion = detectPnpmVersion();
  const rubyVersion = options.template === "rails" ? detectRubyVersion() : "";

  const builder = TEMPLATE_BUILDERS[options.template];
  const config = builder(projectName, nodeVersion, pnpmVersion, rubyVersion);

  const yamlStr = yaml.dump(config, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
    noRefs: true,
    sortKeys: false,
  });

  writeFileSync(options.output, yamlStr, "utf-8");
}
