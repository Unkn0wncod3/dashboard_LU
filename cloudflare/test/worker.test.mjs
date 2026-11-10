import assert from "node:assert/strict";
import test from "node:test";

import worker from "../worker.js";

const assets = new Map([
  ["/", ["<h1>Dashboard</h1>", "text/html"]],
  ["/data/maengel.json", ['{"maengel":[]}', "application/json"]],
  ["/data/statistik_minimal.json", ['{"anzahl_maengel":0}', "application/json"]],
]);

const env = {
  ASSETS: {
    async fetch(request) {
      const entry = assets.get(new URL(request.url).pathname);
      return entry ? new Response(entry[0], { headers: { "Content-Type": entry[1] } }) : new Response("", { status: 404 });
    },
  },
};

test("serves published JSON data through the API", async () => {
  const response = await worker.fetch(new Request("https://dashboard.example/api/maengel"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { maengel: [] });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
});

test("blocks direct access to internal data assets", async () => {
  const response = await worker.fetch(new Request("https://dashboard.example/data/maengel.json"), env);
  assert.equal(response.status, 404);
});

test("marks the Cloudflare version as a static snapshot", async () => {
  const response = await worker.fetch(new Request("https://dashboard.example/api/aktualisierungsstatus"), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "nicht_verfuegbar");
});

test("does not run an external data import on Cloudflare", async () => {
  const response = await worker.fetch(new Request("https://dashboard.example/api/aktualisieren", { method: "POST" }), env);
  assert.equal(response.status, 501);
});

test("passes normal pages through to Cloudflare Static Assets", async () => {
  const response = await worker.fetch(new Request("https://dashboard.example/"), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<h1>Dashboard</h1>");
});

