const DATA_ASSETS = new Map([
  ["/api/maengel", "/data/maengel.json"],
  ["/api/statistik", "/data/statistik_minimal.json"],
]);

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; connect-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
};

function jsonResponse(payload, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...additionalHeaders,
    },
  });
}

async function serveJsonAsset(request, env, assetPath) {
  const assetUrl = new URL(assetPath, request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, { method: "GET" }));
  if (!assetResponse.ok) {
    return jsonResponse({ fehler: "Der veröffentlichte Datenstand ist nicht verfügbar." }, 503);
  }

  const headers = new Headers(assetResponse.headers);
  Object.entries(SECURITY_HEADERS).forEach(([name, value]) => headers.set(name, value));
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(assetResponse.body, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/data/")) {
      return jsonResponse({ fehler: "Nicht gefunden." }, 404);
    }

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (request.method === "GET" && DATA_ASSETS.has(url.pathname)) {
      return serveJsonAsset(request, env, DATA_ASSETS.get(url.pathname));
    }

    if (request.method === "GET" && url.pathname === "/api/aktualisierungsstatus") {
      return jsonResponse({
        status: "nicht_verfuegbar",
        modus: "statischer_cloudflare_snapshot",
        hinweis: "Der Datenstand wird beim Deployment veröffentlicht und nicht auf Cloudflare aktualisiert.",
      });
    }

    if (url.pathname === "/api/aktualisieren") {
      return jsonResponse(
        { fehler: "Eine manuelle Datenaktualisierung ist in der statischen Cloudflare-Version nicht verfügbar." },
        501,
        { Allow: "GET" },
      );
    }

    return jsonResponse({ fehler: "Unbekannter API-Endpunkt." }, 404);
  },
};

