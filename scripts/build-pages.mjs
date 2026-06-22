import { cp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSpec } from "./render-spec.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "www");
const headersFile = path.join(repoRoot, "_headers");

process.chdir(repoRoot);

await rm(outputDir, { recursive: true, force: true });
await renderSpec({ nowatch: true });

await writeFile(
  path.join(outputDir, "index.html"),
  `<!doctype html>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="0; url=./spec/" />
<title>x401 Specification</title>
<p>Redirecting to <a href="./spec/">the x401 specification</a>.</p>
`,
);
await writeFile(path.join(outputDir, "_redirects"), "/  /spec/  302\n");
await cp(headersFile, path.join(outputDir, "_headers"));
await writeFile(path.join(outputDir, ".nojekyll"), "");
