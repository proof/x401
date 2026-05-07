import fs from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import specUp from "spec-up";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const nodeModulesDir = path.join(repoRoot, "node_modules");
const siteSourceDir = path.join(repoRoot, "public", "site");
const demoSourceDir = path.join(repoRoot, "public", "demo");
const builtSpecDir = path.join(repoRoot, "www", "spec");
const mermaidDistDir = path.join(nodeModulesDir, "mermaid", "dist");
const port = Number(process.env.PORT ?? 4011);

process.chdir(repoRoot);

const htmlRoots = [
  { prefix: "/spec", dir: builtSpecDir },
  { prefix: "/demo", dir: demoSourceDir },
  { prefix: "/", dir: siteSourceDir },
];

const liveReloadClient = `
<script>
(() => {
  const source = new EventSource("/__site_events");
  source.addEventListener("reload", () => {
    window.location.reload();
  });
})();
</script>`;

async function buildSpec() {
  await specUp({ nowatch: true });
}

function injectLiveReload(html) {
  if (html.includes("/__site_events")) {
    return html;
  }

  if (html.includes("</body>")) {
    return html.replace("</body>", `${liveReloadClient}\n  </body>`);
  }

  return `${html}\n${liveReloadClient}`;
}

function resolveMountedPath(prefix, dir, requestPath) {
  let relativePath = "";

  if (prefix === "/") {
    relativePath = requestPath === "/" ? "" : requestPath.replace(/^\/+/, "");
  } else if (requestPath === prefix || requestPath === `${prefix}/`) {
    relativePath = "";
  } else if (requestPath.startsWith(`${prefix}/`)) {
    relativePath = requestPath.slice(prefix.length + 1);
  } else {
    return null;
  }

  const resolvedPath = path.resolve(dir, decodeURIComponent(relativePath));
  if (resolvedPath !== dir && !resolvedPath.startsWith(`${dir}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
}

async function resolveHtmlFile(filePath) {
  let candidate = filePath;
  let details;

  try {
    details = await stat(candidate);
  } catch {
    return null;
  }

  if (details.isDirectory()) {
    candidate = path.join(candidate, "index.html");
  } else if (path.extname(candidate) !== ".html") {
    return null;
  }

  try {
    const fileDetails = await stat(candidate);
    if (!fileDetails.isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  return candidate;
}

async function collectDirectories(rootDir) {
  const directories = [rootDir];
  const entries = await readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    directories.push(...(await collectDirectories(path.join(rootDir, entry.name))));
  }

  return directories;
}

function watchDirectoryTree(rootDir, onChange) {
  const watchers = new Map();
  let syncTimer = null;
  let closed = false;

  const syncWatchers = async () => {
    if (closed) {
      return;
    }

    const directories = new Set(await collectDirectories(rootDir));

    for (const [watchedDir, watcher] of watchers) {
      if (directories.has(watchedDir)) {
        continue;
      }

      watcher.close();
      watchers.delete(watchedDir);
    }

    for (const directory of directories) {
      if (watchers.has(directory)) {
        continue;
      }

      try {
        const watcher = fs.watch(directory, (_eventType, filename) => {
          const changedPath = filename
            ? path.join(directory, filename.toString())
            : directory;

          onChange(changedPath);
          scheduleSync();
        });

        watcher.on("error", () => {
          scheduleSync();
        });

        watchers.set(directory, watcher);
      } catch (error) {
        console.error(`[site:watch] failed to watch ${directory}:`, error);
      }
    }
  };

  const scheduleSync = () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      void syncWatchers();
    }, 75);
  };

  void syncWatchers();

  return () => {
    closed = true;
    clearTimeout(syncTimer);

    for (const watcher of watchers.values()) {
      watcher.close();
    }

    watchers.clear();
  };
}

await buildSpec();

const app = express();
const reloadClients = new Set();
let reloadTimer = null;

function broadcastReload(changedPath) {
  const relativePath = path.relative(repoRoot, changedPath) || changedPath;
  console.log(`[site:watch] reloading for ${relativePath}`);

  for (const client of reloadClients) {
    client.write(`event: reload\ndata: ${Date.now()}\n\n`);
  }
}

function scheduleReload(changedPath) {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    broadcastReload(changedPath);
  }, 120);
}

app.get("/__site_events", (_req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write("retry: 1000\n\n");

  reloadClients.add(res);

  res.on("close", () => {
    reloadClients.delete(res);
  });
});

app.use(async (req, res, next) => {
  if (req.path === "/__site_events") {
    next();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }

  for (const root of htmlRoots) {
    const mountedPath = resolveMountedPath(root.prefix, root.dir, req.path);
    if (!mountedPath) {
      continue;
    }

    const htmlFile = await resolveHtmlFile(mountedPath);
    if (!htmlFile) {
      continue;
    }

    const html = await readFile(htmlFile, "utf8");
    res.type("html").send(injectLiveReload(html));
    return;
  }

  next();
});

app.use("/spec", express.static(builtSpecDir));
app.use("/demo", express.static(demoSourceDir));
app.use("/vendor/mermaid", express.static(mermaidDistDir));
app.use(express.static(siteSourceDir));

const stopWatchingSite = watchDirectoryTree(siteSourceDir, scheduleReload);
const stopWatchingDemo = watchDirectoryTree(demoSourceDir, scheduleReload);

const server = app.listen(port, () => {
  console.log(`[site:watch] listening at http://localhost:${port}`);
});

function shutdown() {
  stopWatchingSite();
  stopWatchingDemo();
  clearTimeout(reloadTimer);

  for (const client of reloadClients) {
    client.end();
  }

  reloadClients.clear();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
