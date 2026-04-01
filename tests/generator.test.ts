import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { generate } from "../src/generator.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const FIXTURES_DIR = path.join(ROOT, "tests", "fixtures");
const REFERENCE_DIR = path.join(ROOT, "tests", "references");

function getReferenceFiles(projectType: string): string[] {
  const dir = path.join(REFERENCE_DIR, projectType);
  return fs
    .readdirSync(dir)
    .filter((f) => fs.statSync(path.join(dir, f)).isFile());
}

describe.each(["firebase", "rails"])("generate %s", (projectType) => {
  const configPath = path.join(FIXTURES_DIR, `${projectType}.yml`);
  const outputDir = path.join(
    os.tmpdir(),
    `devcontainer-gen-test-${projectType}-${Date.now()}`,
  );
  const referenceDir = path.join(REFERENCE_DIR, projectType);

  beforeAll(async () => {
    await generate(configPath, outputDir);
  });

  const referenceFiles = getReferenceFiles(projectType);

  it("generates all expected files", () => {
    const generatedFiles = fs.readdirSync(outputDir);
    for (const file of referenceFiles) {
      expect(generatedFiles, `missing file: ${file}`).toContain(file);
    }
  });

  for (const file of referenceFiles) {
    it(`${file} matches reference`, () => {
      const generated = fs.readFileSync(
        path.join(outputDir, file),
        "utf-8",
      );
      const reference = fs.readFileSync(
        path.join(referenceDir, file),
        "utf-8",
      );
      expect(generated).toBe(reference);
    });
  }
});
