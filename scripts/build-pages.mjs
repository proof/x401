import { cp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSpec } from "./render-spec.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "www");
const headersFile = path.join(repoRoot, "_headers");
const latestDir = path.join(outputDir, "spec", "latest");

process.chdir(repoRoot);

const { version } = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
const { specs = [] } = JSON.parse(await readFile(path.join(repoRoot, "specs.json"), "utf8"));

await rm(outputDir, { recursive: true, force: true });
await renderSpec({ nowatch: true });

const currentVersionDir = path.join(outputDir, "spec", version);
const renderedBySpecUp = specs.some(
  (spec) => path.resolve(repoRoot, spec.output_path ?? "") === currentVersionDir,
);
if (!renderedBySpecUp) {
  await cp(latestDir, currentVersionDir, { recursive: true });
}

await writeFile(
  path.join(outputDir, "index.html"),
  `<!doctype html>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="0; url=/spec/latest/" />
<title>x401 Specification</title>
<p>Redirecting to <a href="/spec/latest/">the x401 specification</a>.</p>
`,
);
await writeFile(
  path.join(outputDir, "404.html"),
  `<!doctype html>
<meta charset="utf-8" />
<title>x401: Not Found</title>
<p>Not found. See <a href="/spec/latest/">the latest x401 specification</a>.</p>
`,
);
await writeFile(
  path.join(outputDir, "_redirects"),
  "/         /spec/latest/  302\n/spec     /spec/latest/  302\n/spec/    /spec/latest/  302\n",
);
await cp(headersFile, path.join(outputDir, "_headers"));
await writeFile(path.join(outputDir, ".nojekyll"), "");
