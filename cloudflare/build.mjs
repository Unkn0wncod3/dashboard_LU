import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cloudflareDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = dirname(cloudflareDirectory);
const webDirectory = join(projectDirectory, "web");
const dataDirectory = join(projectDirectory, "maengelmelder_daten");
const outputDirectory = join(cloudflareDirectory, "dist");

const requiredFiles = [
  join(webDirectory, "index.html"),
  join(dataDirectory, "maengel.json"),
  join(dataDirectory, "statistik_minimal.json"),
];

for (const path of requiredFiles) {
  await readFile(path);
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(join(outputDirectory, "data"), { recursive: true });
await cp(webDirectory, outputDirectory, { recursive: true });
await cp(join(dataDirectory, "maengel.json"), join(outputDirectory, "data", "maengel.json"));
await cp(join(dataDirectory, "statistik_minimal.json"), join(outputDirectory, "data", "statistik_minimal.json"));
await cp(
  join(cloudflareDirectory, "assets", "cloudflare-runtime.js"),
  join(outputDirectory, "assets", "cloudflare-runtime.js"),
);
await cp(join(cloudflareDirectory, "assets", "_headers"), join(outputDirectory, "_headers"));

const indexPath = join(outputDirectory, "index.html");
const indexHtml = await readFile(indexPath, "utf8");
const runtimeTag = '<script src="/assets/cloudflare-runtime.js" defer></script>';
if (!indexHtml.includes("</body>")) {
  throw new Error("Cloudflare-Build abgebrochen: web/index.html enthält kein schließendes body-Element.");
}
if (indexHtml.includes(runtimeTag)) {
  throw new Error("Cloudflare-Build abgebrochen: Runtime-Skript ist bereits im Quell-Frontend eingebunden.");
}
await writeFile(indexPath, indexHtml.replace("</body>", `${runtimeTag}\n</body>`), "utf8");

console.log(`Cloudflare-Paket erstellt: ${outputDirectory}`);

