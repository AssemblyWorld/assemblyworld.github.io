# AssemblyWorld research website

Interactive project page for **AssemblyWorld: Rethinking 3D Assembly with General-Purpose Agents**.

Published at https://assemblyworld.github.io/. Independent Vite / React / TypeScript / Three.js application; pnpm manages frontend dependencies. GitHub Actions builds and deploys static GitHub Pages artifacts.

## Develop

```sh
pnpm install --frozen-lockfile
python3 scripts/fetch_assets.py
pnpm dev
```

`assets.lock.json` pins a checksummed release. Geometry and initial episodes are stored in release assets, never Git. The build copies only cases marked `publish: true` in `public/catalog.json`. It excludes the local catalog and all non-cleared assets, including when they exist locally.

```sh
pnpm check:assets
pnpm build
pnpm preview
pnpm exec playwright install chromium webkit
pnpm test
```

The tests expect a server on port 5173 (or `SITE_URL`). The Chrome project uses installed Google Chrome. WebKit and mobile WebKit are browser-engine coverage, not a claim of physical iPhone or Safari.app testing. The full 12-case smoke test requires private source exports and is skipped for remote `SITE_URL` runs.

## Content and public release

The section order is Overview → Contributions → Gallery → Try with Your Agent → How It Works → Results → Resources. Gallery and Try share the selected case. The hero and expanded gallery reuse one active WebGL viewer. Optional agent comparison renders two scenes in the same WebGL context with a shared external camera and independent cursors; follow mode uses each run’s recorded camera.

Twelve real research examples (three per source) have a local export selection in `scripts/selection.json`. The second public asset release contains **twelve examples across all four sources**. The first three match the paper interaction figure: APPLARO bench, fracture 00/00017, and industrial assembly 1047, using their original paper runs (76, 49 and 62 calls). Three additional examples support matched agent comparison. Research display permission for PartNet, IKEA-Manual and Fantastic Breaks was explicitly confirmed by the project owner; see `docs/asset-clearance.md`. Do not infer permission from existing files or public third-party hosting. See `public/asset-terms.html` and preserved source notices. No original dataset is relicensed by this website.

Main result values and author order were checked against the current author manuscript. `public/publication.json` deliberately has a null paper URL until the arXiv version is available. The manuscript PDF is not included in the current website deployment. No acceptance or arXiv identifier is claimed. Keep manuscript and displayed metrics synchronized in future releases. The citation intentionally uses `@misc` until formal publication metadata exists.

## Rebuild local research assets

The exporter is an independent uv project. It consumes explicit artifact paths and imports no sibling source. It requires the original results directory and preparation/evaluation/reference caches.

```sh
uv sync --locked
uv run python scripts/export_cases.py --agent-root /absolute/path/to/assembly-world-agent
pnpm dev
# Generate real rendered thumbnails using isolated Chrome:
node scripts/preview.mjs
```

Open `http://127.0.0.1:5173/?preview=local` for all twelve cases. The local catalog is never staged to production. Restart Vite after adding new public files. `scripts/export_cases.py` currently fixes the curated selection and release clearance flags; clearance is recorded in `docs/asset-clearance.md`. Do not publish the local-only catalog.

### Display format 1

- Catalog: source dataset and revision, sample identity, reference condition, initial archive hash, variants, final PA/SR/SCD and source episode hash.
- Each run JSON: part IDs and offsets into a little-endian binary geometry buffer, recorded calls, exact action-state poses, ground-truth poses, evaluation alignment and validation evidence.
- Geometry: original compiled triangles, body-local positions in float32 and indices in uint32; no mesh decimation. Each buffer and JSON has a SHA-256 hash verified in the browser.
- Poses: position followed by **xyzw** quaternion; source MuJoCo wxyz is converted explicitly. Native MuJoCo 3.12.0 restores each saved state without stepping physics or executing tools.
- Alignment: `display_position = R * recorded_position + t * scale_divisor`, where R/t are the exact published evaluator alignment. The same R is applied to orientations. Ground truth is in the evaluator target frame. Per-run inverse pose checks are below 1e-10. Final metrics are copied from records whose episode checksums match; they are not recomputed in the webpage.
- Playback: initial state plus every recorded tool call. Read-only calls may repeat a state. No interpolation. Ground-truth overlays do not change agent state. Independent runs are never matched by call index.
- Initial episodes and selected source reference pages are copied unchanged and checksummed. Answers and final trajectories are not embedded in initial episodes or copied prompts.

Release creation uses `python3 scripts/bundle_assets.py`; upload `.local/media-v2.tar.gz` under the immutable tag named in `assets.lock.json`. Update both tag/URL and lock for subsequent releases; never silently replace a published archive. CI verifies checksum and per-case integrity before building.

## Validation

Playwright covers scene loading, all twelve local timelines, selection synchronization, one-context comparison, independent playback cursors, highlighting, ground truth, WebGL fallback, deep links and mobile overflow. `scripts/check_assets.py` verifies initial archives, asset hashes, geometry index ranges, call/state consistency and normalized quaternions. Real browser previews and local export audits are intentionally retained in `.local/` for review and excluded from Git.

The website does not host inference. Copied prompts use the live 3DWebAgent environment and the selected **initial** episode URL. Connection instructions link to the current 3DWebAgent README.

## Camera playback and links

Every recorded camera position and target is transformed using the same evaluation alignment as the parts. Its up vector is rotated too. Follow mode preserves the source renderer’s 38-degree vertical field of view and 4:3 viewport, with letterboxing; it re-renders the geometry rather than claiming pixel-identical observations. Each comparison pane follows its own timeline and camera. Free orbit has scene-scaled minimum/maximum distances; it never edits recorded camera data. Camera helpers show location and direction without drawing a full-length frustum over the model.

Author links were checked against personal/institutional pages on 2026-09-29. Yeying Fan uses the available ResearchGate profile (matching the orthodontic assembly publications) because no verified personal homepage, Google Scholar profile or LinkedIn page was found. The benchmark Hugging Face destination is retained as coming soon at the owner's request. Results point to the public dataset page; downloading that dataset currently requires access approval.
