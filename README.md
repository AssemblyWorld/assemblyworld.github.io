# AssemblyWorld

Interactive research website for **AssemblyWorld: Rethinking 3D Assembly with General-Purpose Agents**.

[Website](https://assemblyworld.github.io/) · [Benchmark](https://huggingface.co/datasets/AssemblyWorld/AssemblyWorldBench) · [Results](https://huggingface.co/datasets/AssemblyWorld/AssemblyWorldBench-Results)

Built with React, TypeScript, Vite and Three.js. Published through GitHub Pages.

## Development

```sh
pnpm install --frozen-lockfile
python3 scripts/fetch_assets.py
pnpm dev
```

3D assets are downloaded from the release pinned in `assets.lock.json`; they are not stored in Git.

## Validation and deployment

```sh
pnpm check:assets
pnpm build
```

With the development server running, use `pnpm test` for browser checks (Google Chrome and Playwright WebKit required). Set `SITE_URL` to test another server. Pushes to `main` build and deploy automatically.

## Content

- `src/main.tsx`: page content and citation.
- `src/result-tables.json`: result tables.
- `public/catalog.json`: interactive examples.
- `public/publication.json`: paper link.

Dataset assets retain their original terms. See [asset terms and attribution](public/asset-terms.html).
