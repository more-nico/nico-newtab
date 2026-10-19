#!/usr/bin/env node
// Local WebDAV stand-in for developing the 坚果云 sync UI without a real
// account. It implements just enough of RFC 4918 for Nico: PROPFIND, MKCOL,
// PUT, GET and a bounded set of conditional-write headers, plus CORS so the
// Vite preview page can call it.
//
//   npm run mock:webdav
//   Server URL  http://127.0.0.1:8787/dav
//   Account     demo@example.com
//   App password demo-app-password
//
// The files live under .cache/mock-webdav/ (git-ignored) so a second run keeps
// what the previous run uploaded. Environment variables can override the port,
// credentials, root and data directory.
import { createServer } from "node:http";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const DATA_DIR = resolve(process.env.MOCK_WEBDAV_DIR ?? ".cache/mock-webdav");
const USER = process.env.MOCK_WEBDAV_USER ?? "demo@example.com";
const PASSWORD = process.env.MOCK_WEBDAV_PASSWORD ?? "demo-app-password";
/** The WebDAV root below is `/dav` by default, matching the Nutstore path shape. */
const ROOT_PREFIX = process.env.MOCK_WEBDAV_ROOT ?? "/dav";
const MAX_BODY_BYTES = 64 * 1024 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, GET, PUT, PROPFIND, MKCOL, DELETE",
  "Access-Control-Allow-Headers":
    "Authorization, Depth, Content-Type, If-Match, If-None-Match",
  "Access-Control-Expose-Headers": "ETag, Last-Modified, Content-Length",
  "Access-Control-Max-Age": "600",
};

function send(response, status, body = "", headers = {}) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    ...CORS,
    ...headers,
  });
  response.end(body);
}

function authorized(request) {
  const header = request.headers.authorization ?? "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString(
    "utf8",
  );
  const split = decoded.indexOf(":");
  if (split < 0) return false;
  return (
    decoded.slice(0, split) === USER && decoded.slice(split + 1) === PASSWORD
  );
}

/** Maps a request path onto the data directory; null when it escapes the root. */
function fileFor(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const parts = decoded.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) return null;
  const full = resolve(DATA_DIR, ...parts);
  if (full !== DATA_DIR && !full.startsWith(DATA_DIR + sep)) return null;
  return full;
}

function isRootPath(urlPath) {
  const trimmed = urlPath.replace(/\/+$/, "");
  return trimmed === ROOT_PREFIX || trimmed === "";
}

function etagOf(info) {
  return `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
}

async function describe(path, urlPath) {
  try {
    const info = await stat(path);
    const collection = info.isDirectory();
    const href = urlPath.endsWith("/")
      ? urlPath
      : `${urlPath}/`.replace(/\/+/g, "/");
    const parts = [];
    if (collection)
      parts.push("<D:resourcetype><D:collection/></D:resourcetype>");
    else {
      parts.push("<D:resourcetype/>");
      parts.push(`<D:getcontentlength>${info.size}</D:getcontentlength>`);
      parts.push(`<D:getetag>${etagOf(info)}</D:getetag>`);
    }
    parts.push(
      `<D:getlastmodified>${info.mtime.toUTCString()}</D:getlastmodified>`,
    );
    return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:"><D:response><D:href>${href}</D:href><D:propstat><D:prop>${parts.join("")}</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response></D:multistatus>`;
  } catch {
    return null;
  }
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("payload too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function handle(request, response) {
  const urlPath = new URL(request.url ?? "/", "http://localhost").pathname;
  const path = fileFor(urlPath);
  if (!path) return send(response, 400, "Bad path");
  const method = request.method ?? "GET";

  if (method === "OPTIONS") return send(response, 200, "", { DAV: "1" });
  if (!authorized(request))
    return send(response, 401, "Unauthorized", {
      "WWW-Authenticate": 'Basic realm="mock-webdav"',
    });
  if (method === "PROPFIND") {
    const body =
      (await describe(path, urlPath)) ??
      (isRootPath(urlPath)
        ? '<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:"><D:response><D:href>' +
          `${ROOT_PREFIX}/</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response></D:multistatus>`
        : null);
    if (body === null) return send(response, 404, "Not found");
    return send(response, 207, body, {
      "Content-Type": "application/xml; charset=utf-8",
    });
  }
  if (method === "MKCOL") {
    try {
      const info = await stat(path);
      if (info.isDirectory()) return send(response, 405, "Already exists");
      return send(response, 409, "Not a collection");
    } catch {
      await mkdir(path, { recursive: true });
      return send(response, 201, "Created");
    }
  }
  if (method === "PUT") {
    let body;
    try {
      body = await readBody(request);
    } catch {
      return send(response, 413, "Payload too large");
    }
    let current = null;
    try {
      current = await stat(path);
    } catch {
      current = null;
    }
    const ifMatch = request.headers["if-match"];
    const ifNoneMatch = request.headers["if-none-match"];
    if (ifNoneMatch === "*" && current !== null)
      return send(response, 412, "Precondition failed: file exists");
    if (typeof ifMatch === "string") {
      if (
        current === null ||
        current.isDirectory() ||
        ifMatch !== etagOf(current)
      )
        return send(response, 412, "Precondition failed: etag mismatch");
    }
    const parentExists = await stat(resolve(path, "..")).then(
      (parent) => parent.isDirectory(),
      () => false,
    );
    // Real Nutstore does not create intermediate collections for PUT; the
    // client is expected to MKCOL them first.
    if (!parentExists)
      return send(response, 404, "Parent collection not found");
    await writeFile(path, body, "utf8");
    const info = await stat(path);
    return send(response, 201, "Created", { ETag: etagOf(info) });
  }
  if (method === "GET") {
    try {
      const info = await stat(path);
      if (info.isDirectory()) return send(response, 200, "");
      const content = await readFile(path);
      return send(response, 200, content, {
        "Content-Type": "application/json; charset=utf-8",
        ETag: etagOf(info),
        "Last-Modified": info.mtime.toUTCString(),
        "Content-Length": String(info.size),
      });
    } catch {
      // Nutstore answers 409 + AncestorsNotFound when the parent folder does
      // not exist yet; 404 only when the folder exists but the file does not.
      const parentExists = await stat(resolve(path, "..")).then(
        (parent) => parent.isDirectory(),
        () => false,
      );
      if (!parentExists)
        return send(
          response,
          409,
          '<?xml version="1.0"?><d:error xmlns:d="DAV:"><s:exception xmlns:s="http://sabredav.org/ns">AncestorsNotFound</s:exception></d:error>',
          { "Content-Type": "application/xml; charset=utf-8" },
        );
      return send(response, 404, "Not found");
    }
  }
  if (method === "DELETE") {
    try {
      await stat(path);
      await rm(path, { recursive: true, force: true });
      return send(response, 204, "");
    } catch {
      return send(response, 404, "Not found");
    }
  }
  return send(response, 405, "Method not allowed");
}

await mkdir(resolve(DATA_DIR, ...ROOT_PREFIX.split("/").filter(Boolean)), {
  recursive: true,
});
const server = createServer((request, response) => {
  handle(request, response)
    .then(() => {
      console.log(`${request.method} ${request.url} -> ${response.statusCode}`);
    })
    .catch((error) => {
      console.error(error);
      if (!response.headersSent) send(response, 500, "Internal error");
      else response.end();
    });
});
server.listen(PORT, HOST, () => {
  console.log(`Mock WebDAV: http://${HOST}:${PORT}${ROOT_PREFIX}`);
  console.log(`  account: ${USER}`);
  console.log(`  password: ${PASSWORD}`);
  console.log(`  data dir: ${DATA_DIR}`);
});
