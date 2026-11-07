// GENERATED from src/index.ts by build.mjs — do not edit by hand.
// ops/cdn-worker/src/index.ts
var VARIANT_KEY = /^u\/[A-Za-z0-9-]{1,64}\/(?:g\/[A-Za-z0-9-]{1,64}\/|portfolio\/)v\/[A-Za-z0-9-]{1,64}-(?:preview|thumb|poster)\.jpg$/;
var BROWSER_CACHE = "public, max-age=31536000, immutable";
var DEFAULT_EDGE_SECONDS = 30 * 24 * 60 * 60;
var SIGN_WINDOW_SECONDS = 6 * 24 * 60 * 60;
var SIGN_EXPIRES_SECONDS = 7 * 24 * 60 * 60;
function isServableKey(key) {
  return VARIANT_KEY.test(key) && !key.includes("/o/") && !key.includes("..");
}
var encoder = new TextEncoder();
function hex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(text) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}
async function hmac(key, text) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(text));
}
function s3Encode(text, keepSlash = false) {
  return encodeURIComponent(text).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).replace(keepSlash ? /%2F/g : /$^/, "/");
}
function amzDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
async function presignGet(input) {
  const host = new URL(input.endpoint).host;
  const stamp = amzDate(input.signingDate);
  const day = stamp.slice(0, 8);
  const scope = `${day}/${input.region}/s3/aws4_request`;
  const canonicalPath = s3Encode(input.path, true);
  const params = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${input.accessKeyId}/${scope}`],
    ["X-Amz-Date", stamp],
    ["X-Amz-Expires", String(input.expiresSeconds)],
    ["X-Amz-SignedHeaders", "host"],
    ...input.extraQuery ?? []
  ];
  params.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const query = params.map(([k, v]) => `${s3Encode(k)}=${s3Encode(v)}`).join("&");
  const canonicalRequest = ["GET", canonicalPath, query, `host:${host}
`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", stamp, scope, await sha256Hex(canonicalRequest)].join("\n");
  let key = await hmac(encoder.encode(`AWS4${input.secretAccessKey}`), day);
  key = await hmac(key, input.region);
  key = await hmac(key, "s3");
  key = await hmac(key, "aws4_request");
  const signature = hex(await hmac(key, stringToSign));
  return `${input.endpoint.replace(/\/+$/, "")}${canonicalPath}?${query}&X-Amz-Signature=${signature}`;
}
function signingWindowStart(now) {
  const windowMs = SIGN_WINDOW_SECONDS * 1e3;
  return new Date(Math.floor(now / windowMs) * windowMs);
}
function plain(status, cacheControl) {
  return new Response(status === 404 ? "Not found" : "Error", {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": cacheControl }
  });
}
function decodeKey(pathname) {
  try {
    return decodeURIComponent(pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}
async function handle(request, env, ctx, now = Date.now()) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const url = new URL(request.url);
  const key = decodeKey(url.pathname);
  if (!key || !isServableKey(key)) return plain(404, "public, max-age=3600");
  const cacheKey = new Request(`${url.origin}/${s3Encode(key, true)}`, { method: "GET" });
  const edge = globalThis.caches?.default;
  let response = edge ? await edge.match(cacheKey) : void 0;
  if (!response) {
    const endpoint = env.S3_ENDPOINT || `https://s3.${env.B2_REGION}.backblazeb2.com`;
    const origin = await presignGet({
      endpoint,
      path: `/${env.B2_BUCKET}/${key}`,
      region: env.B2_REGION,
      accessKeyId: env.B2_KEY_ID,
      secretAccessKey: env.B2_APPLICATION_KEY,
      signingDate: signingWindowStart(now),
      expiresSeconds: SIGN_EXPIRES_SECONDS
    });
    const edgeSeconds = Number(env.EDGE_CACHE_SECONDS) || DEFAULT_EDGE_SECONDS;
    let upstream;
    try {
      upstream = await fetch(origin, {
        cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": edgeSeconds, "404": 60, "400-403": 0, "500-599": 0 } }
      });
    } catch {
      return plain(502, "no-store");
    }
    if (upstream.status === 404 || upstream.status === 403) return plain(404, "public, max-age=60");
    if (!upstream.ok || !upstream.body) return plain(502, "no-store");
    const headers = new Headers();
    for (const name of ["Content-Type", "Content-Length", "ETag", "Last-Modified"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("Cache-Control", BROWSER_CACHE);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    headers.set("X-Origin-Cache", upstream.headers.get("CF-Cache-Status") ?? "NONE");
    response = new Response(upstream.body, { status: 200, headers });
    if (edge) ctx.waitUntil(edge.put(cacheKey, response.clone()));
  }
  const etag = response.headers.get("ETag");
  if (etag && request.headers.get("If-None-Match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": BROWSER_CACHE } });
  }
  if (request.method === "HEAD") return new Response(null, { status: 200, headers: response.headers });
  return response;
}
var index_default = {
  fetch(request, env, ctx) {
    return handle(request, env, ctx);
  }
};
export {
  index_default as default,
  handle,
  isServableKey,
  presignGet,
  s3Encode,
  signingWindowStart
};
