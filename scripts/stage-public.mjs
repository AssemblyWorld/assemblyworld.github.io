import fs from "node:fs/promises";
import path from "node:path";
const catalog = JSON.parse(await fs.readFile("public/catalog.json", "utf8"));
for (const c of catalog.cases)
  if (!c.publish) throw Error(`Uncleared public asset: ${c.id}`);
await fs.mkdir("dist", { recursive: true });
for (const name of [
  "catalog.json",
  "publication.json",
  "logo.svg",
  "asset-terms.html",
  "social.png",
  "robots.txt",
  "sitemap.xml",
  "404.html",
]) {
  await fs.copyFile(path.join("public", name), path.join("dist", name));
}
await fs.cp("public/licenses", "dist/licenses", { recursive: true });
for (const c of catalog.cases) {
  const dir = path.dirname(c.initial.slice(1));
  if (!/^media\/v[0-9]+\/[a-z0-9-]+$/.test(dir))
    throw Error("Unsafe case path");
  await fs.cp(path.join("public", dir), path.join("dist", dir), {
    recursive: true,
  });
}
console.log(
  `Staged ${catalog.cases.length} cleared cases. Local-only previews excluded.`,
);
