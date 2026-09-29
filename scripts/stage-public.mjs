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
await fs.cp("public/previews", "dist/previews", { recursive: true });
for (const c of catalog.cases) {
  const dir = path.dirname(c.initial.slice(1));
  if (!/^media\/v[0-9]+\/[a-z0-9-]+$/.test(dir))
    throw Error("Unsafe case path");
  await fs.cp(path.join("public", dir), path.join("dist", dir), {
    recursive: true,
  });
  const referencePath = path.join("dist", dir, "reference.html");
  const reference = await fs.readFile(referencePath, "utf8");
  const figures =
    reference.match(/<figure>[\s\S]*?<\/figure>/g)?.join("") ||
    "<p>This task has no visual reference.</p>";
  const title = c.title.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
  await fs.writeFile(
    referencePath,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Assembly reference</title><style>body{font:17px/1.6 -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#1d1d1f;max-width:900px;margin:48px auto;padding:0 24px}h1{font-size:40px;letter-spacing:-1px}a{color:#2457d6;text-decoration:none}img{max-width:100%}figure{margin:40px 0}figcaption,footer{font-size:13px;color:#6e6e73}</style></head><body><a href="/#try">← AssemblyWorld</a><h1>${title}</h1><p>Assembly reference</p>${figures}<footer><a href="/asset-terms.html">Terms & attribution</a></footer></body></html>`,
  );
}
console.log(
  `Staged ${catalog.cases.length} cleared cases. Local-only previews excluded.`,
);
