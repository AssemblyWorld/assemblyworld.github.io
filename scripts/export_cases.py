"""Export immutable episode records to website display format 1.

Independent CLI: accepts an explicit results/data root; never imports sibling code.
No simulation steps or agent operations are executed. Original meshes are retained.
"""
import argparse
import hashlib
import json
import shutil
import tempfile
import zipfile
from pathlib import Path

import mujoco as mj
import numpy as np
from scipy.spatial.transform import Rotation

ROOT = Path(__file__).resolve().parents[1]
SYSTEMS = {"gpt-6-astra": "GPT-6 Astra", "claude-fable-5-1": "Claude Fable 5.1"}
SELECTION = [
    ("ikea-manualbook", "Bench/applaro", "APPLARO bench", True),
    ("fantastic-breaks-none", "00/00017", "Fracture 00/00017", True),
    ("assemblybench-manualbook", "1047", "Industrial assembly 1047", True),
    ("assemblybench-manualbook", "7355", "Industrial assembly 7355", True),
    ("assemblybench-manualbook", "1386", "Industrial assembly 1386", True),
    ("ikea-manualbook", "Chair/falholmen", "FALHOLMEN chair", True),
    ("ikea-manualbook", "Chair/jokkmokk", "JOKKMOKK chair", True),
    ("partnet-final-image", "23890", "PartNet object 23890", True),
    ("partnet-final-image", "40074", "PartNet object 40074", True),
    ("partnet-final-image", "23814", "PartNet object 23814", True),
    ("fantastic-breaks-none", "05/05005", "Fracture 05/05005", True),
    ("fantastic-breaks-none", "19/19003", "Fracture 19/19003", True),
]
DATASETS = {
    "assemblybench-manualbook": ("AssemblyBench", "Industrial", "Assembly manual"),
    "ikea-manualbook": ("IKEA-Manual", "Furniture", "Assembly manual"),
    "partnet-final-image": ("PartNet", "Furniture", "Assembled-object image"),
    "fantastic-breaks-none": ("Fantastic Breaks", "Fracture", "No visual reference"),
}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(",", ":"), allow_nan=False))


def read_archive(path):
    with zipfile.ZipFile(path) as archive:
        files = {n: archive.read(n) for n in archive.namelist()}
    manifest = json.loads(files["manifest.json"])
    assert manifest["version"] == 1 and manifest["engine"] == mj.__version__ == "3.12.0"
    assert set(files) == {"manifest.json", *manifest["hashes"]}
    for name, digest in manifest["hashes"].items():
        assert hashlib.sha256(files[name]).hexdigest() == digest, name
    return manifest, files


def export_run(archive, metrics, cache):
    assert sha(archive) == metrics["episode_sha256"]
    manifest, files = read_archive(archive)
    with tempfile.TemporaryDirectory() as directory:
        if manifest.get("model"):
            binary = Path(directory) / "model.mjb"
            binary.write_bytes(files["world/model.mjb"])
            model = mj.MjModel.from_binary_path(str(binary))
        else:
            model = mj.MjModel.from_xml_string(files["world/model.xml"].decode(),
                assets={k[6:]: v for k, v in files.items() if k.startswith("world/")})
    data = mj.MjData(model)
    parts, bodies = [], []
    assert len(manifest["objects"]) == len(cache["part_ids"])
    for obj, pid in zip(manifest["objects"], cache["part_ids"]):
        assert obj["name"] == f"Part {pid}"
        body = mj.mj_name2id(model, mj.mjtObj.mjOBJ_BODY, obj["id"])
        assert body > 0 and model.body_geomnum[body] == 1 and model.body_parentid[body] == 0
        geom = model.body_geomadr[body]
        assert model.geom_type[geom] == mj.mjtGeom.mjGEOM_MESH
        mesh = model.geom_dataid[geom]
        va, vn = model.mesh_vertadr[mesh], model.mesh_vertnum[mesh]
        fa, fn = model.mesh_faceadr[mesh], model.mesh_facenum[mesh]
        quat = np.roll(model.geom_quat[geom], -1)
        vertices = Rotation.from_quat(quat).apply(model.mesh_vert[va:va+vn]) + model.geom_pos[geom]
        parts.append(dict(id=obj["id"], name=obj["name"], sourceId=pid,
            positions=vertices.ravel().tolist(), indices=model.mesh_face[fa:fa+fn].ravel().tolist()))
        bodies.append(body)
    rows = [json.loads(l) for l in files["frames.jsonl"].splitlines()]
    binary = np.frombuffer(files["frames.bin"], dtype="<f8").reshape(len(rows), manifest["stateSize"])
    assert np.isfinite(binary).all()
    # The published evaluator aligns prediction/divisor to target/divisor.
    align = np.array(metrics["alignment"]["rotation"])
    shift = np.array(metrics["alignment"]["translation"]) * metrics["scale_divisor"]
    states, cameras, maximum_error = {}, {}, 0.0
    for row, state in zip(rows, binary):
        if row["kind"] == "trace":
            continue
        mj.mj_setState(model, data, state, mj.mjtState(manifest["stateSpec"]))
        mj.mj_forward(model, data)
        poses = []
        for body in bodies:
            rot = align @ data.xmat[body].reshape(3, 3)
            pos = align @ data.xpos[body] + shift
            poses.append([*pos.tolist(), *Rotation.from_matrix(rot).as_quat().tolist()])
            maximum_error = max(maximum_error, float(np.max(np.abs(align.T @ (pos-shift)-data.xpos[body]))))
            assert np.allclose(align.T @ Rotation.from_quat(poses[-1][3:]).as_matrix(), data.xmat[body].reshape(3,3), atol=1e-10)
        states[str(row["index"])] = poses
        camera = row["camera"]
        cameras[str(row["index"])] = dict(
            position=(align @ np.asarray(camera["position"]) + shift).tolist(),
            target=(align @ np.asarray(camera["target"]) + shift).tolist(),
            up=(align @ np.array([0., 0., 1.])).tolist(), fov=38)
    assert str(metrics["state_index"]) in states
    assert int(max(states, key=int)) == metrics["state_index"]
    calls = [{k: c[k] for k in ("index", "name", "arguments", "state_index", "status", "timestamp")}
        for c in map(json.loads, files["calls.jsonl"].splitlines())]
    assert all(str(c["state_index"]) in states for c in calls)
    gt = [[*cache["gt_poses"][pid][:3], *np.roll(cache["gt_poses"][pid][3:], -1).tolist()] for pid in cache["part_ids"]]
    return dict(version=1, parts=parts, states=states, cameras=cameras, calls=calls, groundTruth=gt,
        finalState=metrics["state_index"], alignment=dict(rotation=align.tolist(), translation=shift.tolist()),
        validation=dict(archiveSHA256=sha(archive), restoredStates=len(states), inversePoseMaxError=maximum_error,
            geometry="full compiled triangles in body-local coordinates", interpolation="none", quaternion="xyzw"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent-root", type=Path, required=True)
    args = ap.parse_args()
    root = args.agent_root.resolve()
    catalog, audits = [], []
    out = ROOT / "public/media/v2"
    for block, sid, title, publish in SELECTION:
        slug = block.split("-")[0] + "-" + sid.replace("/", "-").lower()
        target = out / slug
        target.mkdir(parents=True, exist_ok=True)
        variants = []
        featured = (block, sid) in [("ikea-manualbook", "Bench/applaro"), ("fantastic-breaks-none", "00/00017"), ("assemblybench-manualbook", "1047")]
        collection = {"ikea-manualbook": "ikea-manual", "fantastic-breaks-none": "fantastic-breaks", "assemblybench-manualbook": "assemblybench"}.get(block) if featured else "assemblyworldbench"
        first_input = None
        for system, label in SYSTEMS.items():
            if system != "gpt-6-astra" and (featured or (block != "assemblybench-manualbook" and sid != "Chair/falholmen")):
                continue
            run = root / "results" / collection / system / block
            sample = run / "samples" / sid.replace("/", "--")
            inp = json.loads((sample / "input.json").read_text())
            initial = root / inp["initial_path"]
            assert sha(initial) == inp["sha256"]
            cache_dir = initial.parent / "cache" / initial.name.removesuffix(".episode.zip")
            if not (cache_dir / "evaluation.json").exists() and block == "fantastic-breaks-none":
                cache_dir = root / "data/assemblyworldbench/fantastic-breaks-none/fantastic-breaks" / initial.parent.name / "cache" / initial.name.removesuffix(".episode.zip")
            cache = json.loads((cache_dir / "evaluation.json").read_text())
            assert cache["key"]["initial_sha256"] == inp["sha256"]
            assert cache["key"]["identity"]["revision"] == inp["revision"]
            assert cache["key"]["sample_id"] == sid
            if first_input:
                assert first_input["sha256"] == inp["sha256"], "Comparison requires identical initial archive"
                assert first_input["manual"] == inp["manual"], "Comparison requires identical references"
            metrics = next(json.loads(l) for l in (run / ("evaluation/chamfer-v2/metrics.jsonl" if featured and block == "fantastic-breaks-none" else "evaluation/metrics.jsonl")).read_text().splitlines() if json.loads(l)["sample_id"] == sid)
            payload = export_run(sample / "final.episode.zip", metrics, cache)
            geometry = bytearray()
            for part in payload["parts"]:
                positions = np.asarray(part.pop("positions"), dtype="<f4")
                indices = np.asarray(part.pop("indices"), dtype="<u4")
                part["positionOffset"], part["positionCount"] = len(geometry), len(positions)
                geometry.extend(positions.tobytes())
                part["indexOffset"], part["indexCount"] = len(geometry), len(indices)
                geometry.extend(indices.tobytes())
            geometry_path = target / f"{system}.bin"
            geometry_path.write_bytes(geometry)
            payload["geometry"] = dict(url=f"/media/v2/{slug}/{system}.bin", sha256=sha(geometry_path))
            run_path = target / f"{system}.json"
            write(run_path, payload)
            audits.append(dict(case=slug, system=system, **payload["validation"]))
            variants.append(dict(id=system, label=label, url=f"/media/v2/{slug}/{system}.json", sha256=sha(run_path),
                runId=f"{collection}/{system}/{block}/{sid}", PA=metrics["PA"], SR=metrics["SR"], SCD=metrics["SCD"],
                episodeSHA256=metrics["episode_sha256"], calls=len(payload["calls"])))
            if first_input is None:
                first_input = inp
                initial_manifest, initial_files = read_archive(initial)
                assert initial_files["calls.jsonl"].strip() == b""
                shutil.copyfile(initial, target / "initial.episode.zip")
                mode = inp.get("manual", {}).get("reference_mode", "none" if block.endswith("-none") else "manualbook")
                refs = sample / inp["manual_directory"].split("/")[-1] if "manual_directory" in inp and mode != "none" else cache_dir / "reference" / mode
                pages = []
                if mode != "none":
                    ref = json.loads((refs / "pages.json").read_text())
                    assert ref["revision"] == inp["revision"]
                    for page in ref["pages"]:
                        source = refs / page["file"]
                        assert sha(source) == page.get("image_sha256", page.get("sha256"))
                        shutil.copyfile(source, target / page["file"])
                        pages.append(page["file"])
                page_html = ''.join(f'<figure><img src="{p}" alt="Reference page {i+1}" loading="lazy"><figcaption>Page {i+1}</figcaption></figure>' for i,p in enumerate(pages))
                (target / "reference.html").write_text(f'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{title} — reference</title><style>body{{font:18px system-ui;max-width:900px;margin:40px auto;padding:20px}}img{{max-width:100%}}figure{{margin:30px 0}}</style><h1>{title}</h1><p>Original reference pages used in this run. Source: {cache["key"]["identity"]["dataset"]}, revision {inp["revision"]}. For non-commercial research. <a href="/asset-terms.html">Asset terms and attribution</a>.</p>{page_html or "<p>This task has no visual reference.</p>"}</html>')
        dataset, domain, reference = DATASETS[block]
        catalog.append(dict(id=slug, title=title, dataset=dataset, domain=domain, reference=reference, sampleId=sid,
            parts=first_input["parts"], revision=first_input["revision"], source=f'https://huggingface.co/datasets/{cache["key"]["identity"]["dataset"]}',
            publish=publish, featured=featured, licenseStatus="Non-commercial research; original source terms retained; research display permission confirmed by project owner on 2026-09-29", clearanceEvidence="docs/asset-clearance.md",
            initial=f"/media/v2/{slug}/initial.episode.zip", initialSHA256=first_input["sha256"],
            manual=f"/media/v2/{slug}/reference.html", thumbnail=f"/media/v2/{slug}/preview.png", variants=variants))
        print(slug, len(variants), flush=True)
    write(ROOT / "public/catalog.local.json", dict(version=1, cases=catalog))
    write(ROOT / "public/catalog.json", dict(version=1, cases=[c for c in catalog if c["publish"]]))
    write(ROOT / ".local/export-audit.json", audits)
    write(ROOT / "scripts/selection.json", [{k:v for k,v in c.items() if k not in ("variants",)} for c in catalog])


if __name__ == "__main__":
    main()
