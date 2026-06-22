import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import specUp from "spec-up";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const specIconSource = path.join(repoRoot, "public", "spec", "x401-icon.svg");
const specIconOutput = path.join(repoRoot, "www", "spec", "x401-icon.svg");

async function copySpecAssets() {
  await mkdir(path.dirname(specIconOutput), { recursive: true });
  await cp(specIconSource, specIconOutput);
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
