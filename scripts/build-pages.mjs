import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import specUp from "spec-up";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const nodeModulesDir = path.join(repoRoot, "node_modules");
const outputDir = path.join(repoRoot, "www");
const siteSourceDir = path.join(repoRoot, "public", "site");
const demoLandingPage = path.join(repoRoot, "public", "demo", "index.html");
const mermaidDistDir = path.join(nodeModulesDir, "mermaid", "dist");

process.chdir(repoRoot);

await rm(outputDir, { recursive: true, force: true });
await specUp({ nowatch: true });

const siteEntries = await readdir(siteSourceDir);

for (const entry of siteEntries) {
  await cp(path.join(siteSourceDir, entry), path.join(outputDir, entry), {
    recursive: true,
  });
}

await mkdir(path.join(outputDir, "demo"), { recursive: true });
await cp(demoLandingPage, path.join(outputDir, "demo", "index.html"));
await mkdir(path.join(outputDir, "vendor", "mermaid", "chunks"), {
  recursive: true,
});
await cp(
  path.join(mermaidDistDir, "mermaid.esm.min.mjs"),
  path.join(outputDir, "vendor", "mermaid", "mermaid.esm.min.mjs"),
);
await cp(
  path.join(mermaidDistDir, "chunks", "mermaid.esm.min"),
  path.join(outputDir, "vendor", "mermaid", "chunks", "mermaid.esm.min"),
  { recursive: true },
);
await writeFile(path.join(outputDir, ".nojekyll"), "");
