import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { zipSync } from "fflate";

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
console.log(`Extension package: ${path}`);
