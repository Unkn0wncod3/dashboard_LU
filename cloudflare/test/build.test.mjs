import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cloudflareDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(cloudflareDirectory, "dist");

test("build contains frontend data and Cloudflare hardening", async () => {
  await Promise.all([
    access(join(outputDirectory, "index.html")),
    access(join(outputDirectory, "map.html")),
    access(join(outputDirectory, "overview.html")),
    access(join(outputDirectory, "category.html")),
    access(join(outputDirectory, "data", "maengel.json")),
    access(join(outputDirectory, "data", "statistik_minimal.json")),
    access(join(outputDirectory, "_headers")),
  ]);

  const html = await readFile(join(outputDirectory, "index.html"), "utf8");
  assert.match(html, /assets\/cloudflare-runtime\.js/);
});

