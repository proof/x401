import { cp, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import specUp from "spec-up";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const specIconSource = path.join(repoRoot, "public", "spec", "x401-icon.svg");
const specsConfig = path.join(repoRoot, "specs.json");

async function specOutputDirs() {
  const { specs = [] } = JSON.parse(await readFile(specsConfig, "utf8"));
  return specs.map((spec) =>
    path.resolve(repoRoot, spec.output_path || spec.spec_directory || "."),
  );
}

async function copySpecAssets() {
  for (const outputDir of await specOutputDirs()) {
    await mkdir(outputDir, { recursive: true });
    await cp(specIconSource, path.join(outputDir, "x401-icon.svg"));
  }
}

async function renderSpec(options = { nowatch: true }) {
  process.chdir(repoRoot);
  await specUp(options);
  await copySpecAssets();
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await renderSpec({ nowatch: true });
}

export { copySpecAssets, renderSpec };
