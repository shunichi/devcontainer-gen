import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";
import { init, type TemplateName } from "../src/init.js";

vi.mock("node:child_process", () => ({
  execSync: (cmd: string) => {
    if (cmd === "node -v") return "v22.14.0\n";
    if (cmd === "ruby -v") return "ruby 3.4.5 (2025-01-01) [x86_64-linux]\n";
    throw new Error(`Command not found: ${cmd}`);
  },
}));

function generateToTmp(
  template: TemplateName,
  name?: string,
): Record<string, unknown> {
  const output = path.join(
    os.tmpdir(),
    `devcontainer-gen-init-test-${template}-${Date.now()}.yml`,
  );
  init({ template, name, output });
  const content = fs.readFileSync(output, "utf-8");
  return yaml.load(content) as Record<string, unknown>;
}

describe("init", () => {
  describe("node template", () => {
    it("generates valid YAML with detected node version", () => {
      const config = generateToTmp("node", "test-app");
      expect((config.project as Record<string, unknown>).name).toBe("test-app");
      const languages = config.languages as Record<string, Record<string, unknown>>;
      expect(languages.node.version).toBe("22");
      expect(languages.ruby).toBeUndefined();
    });

    it("uses current directory name when name is not specified", () => {
      const config = generateToTmp("node");
      expect((config.project as Record<string, unknown>).name).toBe(
        path.basename(process.cwd()),
      );
    });

    it("includes container_env with NODE_OPTIONS", () => {
      const config = generateToTmp("node", "test-app");
      const env = config.container_env as Record<string, string>;
      expect(env.NODE_OPTIONS).toBe(
        "--max-old-space-size=4096 --dns-result-order=ipv4first",
      );
    });
  });

  describe("firebase template", () => {
    it("includes firebase_tools in tools", () => {
      const config = generateToTmp("firebase", "fb-app");
      const tools = config.tools as Record<string, string>;
      expect(tools.firebase_tools).toBe("13");
    });

    it("includes Firebase allowed_domains", () => {
      const config = generateToTmp("firebase", "fb-app");
      const domains = config.allowed_domains as Array<Record<string, unknown>>;
      expect(domains.some((d) => d.group === "Firebase / Google")).toBe(true);
    });

    it("includes system_packages with JRE", () => {
      const config = generateToTmp("firebase", "fb-app");
      expect(config.system_packages).toContain("default-jre-headless");
    });
  });

  describe("rails template", () => {
    it("includes ruby and node languages with detected versions", () => {
      const config = generateToTmp("rails", "rails-app");
      const languages = config.languages as Record<string, Record<string, unknown>>;
      expect(languages.ruby.version).toBe("3.4.5");
      expect(languages.node.version).toBe("22");
    });

    it("includes postgres and redis services", () => {
      const config = generateToTmp("rails", "rails-app");
      const services = config.services as Record<string, Record<string, unknown>>;
      expect(services.db).toBeDefined();
      expect(services.redis).toBeDefined();
    });

    it("sets user to dev", () => {
      const config = generateToTmp("rails", "rails-app");
      expect((config.container as Record<string, unknown>).user).toBe("dev");
    });

    it("includes DATABASE_CONFIG and REDIS_URL in container_env", () => {
      const config = generateToTmp("rails", "rails-app");
      const env = config.container_env as Record<string, string>;
      expect(env.DATABASE_CONFIG).toBe("config/database.devcontainer.yml");
      expect(env.REDIS_URL).toBe("redis://redis:6379/1");
    });
  });
});
