import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { zipSync } from "fflate";

// Guard against shipping a manifest that no longer matches the sources. Adding
// a suggestion endpoint without granting it here used to ship silently, and the
// extension's own CSP then blocked every request at runtime.
const source = await readFile("src/lib/suggest.ts", "utf8");
const hosts = [
  ...new Set(
    [...source.matchAll(/url:\s*"(https:\/\/[^"]+)"/g)].map(
      (match) => new URL(match[1]).origin,
    ),
  ),
];
if (hosts.length === 0) {
  throw new Error(
    "Could not read any suggestion endpoint from src/lib/suggest.ts — did the endpoint table change shape?",
  );
}
const distManifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
const sourceManifest = JSON.parse(
  await readFile("public/manifest.json", "utf8"),
);
if (JSON.stringify(distManifest) !== JSON.stringify(sourceManifest)) {
  throw new Error(
    "dist/manifest.json does not match public/manifest.json — run `npm run build` again before packaging.",
  );
}
const granted = distManifest.host_permissions ?? [];
const connectSrc =
  distManifest.content_security_policy?.extension_pages
    ?.split("connect-src")[1]
    ?.split(";")[0]
    ?.trim()
    .split(/\s+/) ?? [];
const missing = hosts.filter(
  (host) => !granted.includes(`${host}/*`) || !connectSrc.includes(host),
);
if (missing.length > 0) {
  throw new Error(
    `Manifest does not allow every suggestion host.\n  missing: ${missing.join(", ")}\n  host_permissions: ${JSON.stringify(granted)}\n  connect-src: ${JSON.stringify(connectSrc)}\nAdd them to public/manifest.json, then rebuild.`,
  );
}
// Same guard for the Nutstore WebDAV endpoint the sync feature ships with.
const nutstoreSource = await readFile("src/lib/nutstore.ts", "utf8");
const syncServer = nutstoreSource.match(
  /NUTSTORE_SERVER_URL\s*=\s*"(https:\/\/[^"]+)"/,
)?.[1];
if (!syncServer) {
  throw new Error(
    "Could not read NUTSTORE_SERVER_URL from src/lib/nutstore.ts — did the constant move?",
  );
}
const syncOrigin = new URL(syncServer).origin;
if (!granted.includes(`${syncOrigin}/*`) || !connectSrc.includes(syncOrigin)) {
  throw new Error(
    `Manifest does not allow the Nutstore WebDAV host ${syncOrigin}.\n  host_permissions: ${JSON.stringify(granted)}\n  connect-src: ${JSON.stringify(connectSrc)}\nAdd them to public/manifest.json, then rebuild.`,
  );
}

const files = {};
async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await collect(path);
    else
      files[relative("dist", path).replaceAll("\\", "/")] = new Uint8Array(
        await readFile(path),
      );
  }
}
await collect("dist");
await mkdir("release", { recursive: true });
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const path = `release/nico-newtab-${version}.zip`;
await writeFile(path, zipSync(files, { level: 6 }));
console.log(
  `Extension package: ${path} (suggestion hosts granted: ${hosts.join(", ")}; sync host: ${syncOrigin})`,
);
