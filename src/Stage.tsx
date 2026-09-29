import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Run, Pose, ViewMode } from "./types";
const COLORS = [
  "#de784e",
  "#5e88aa",
  "#c5a667",
  "#63978d",
  "#9a7fa7",
  "#9aaa68",
  "#c48893",
  "#7d9da7",
];
type Props = {
  runs: Run[];
  cursors: number[];
  mode: ViewMode;
  selected: string;
  reset: number;
  onSelect: (id: string) => void;
  fallback: string;
};
export default function Stage(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const [error, setError] = useState("");
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
    } catch {
      setError(
        "Interactive 3D is unavailable in this browser. You can still explore the preview and research resources.",
      );
      return;
    }
    setError("");
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor("#f0f0e9");
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D assembly. Drag to orbit, scroll to zoom, click a part to highlight.",
    );
    renderer.domElement.setAttribute("role", "img");
    el.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.001, 10000);
    camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    const geometries: THREE.BufferGeometry[] = [],
      materials: THREE.Material[] = [];
    const scenes = props.runs.map((run) => {
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0xa9adb9, 2.5));
      const light = new THREE.DirectionalLight(0xffffff, 3.2);
      light.position.set(3, -4, 6);
      scene.add(light);
      const fill = new THREE.DirectionalLight(0xcbddec, 1.2);
      fill.position.set(-3, 2, 1);
      scene.add(fill);
      const meshes = run.parts.map((part, i) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(part.positions, 3),
        );
        geo.setIndex(
          new THREE.BufferAttribute(new Uint32Array(part.indices), 1),
        );
        geo.computeVertexNormals();
        geometries.push(geo);
        const mat = new THREE.MeshStandardMaterial({
          color: COLORS[i % COLORS.length],
          roughness: 0.63,
          metalness: 0.12,
          side: THREE.DoubleSide,
        });
        materials.push(mat);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData.id = part.id;
        scene.add(mesh);
        return mesh;
      });
      const ghosts = meshes.map((mesh) => {
        const mat = new THREE.MeshBasicMaterial({
          color: "#146f69",
          wireframe: true,
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
        });
        materials.push(mat);
        const g = new THREE.Mesh(mesh.geometry, mat);
        scene.add(g);
        return g;
      });
      return { scene, meshes, ghosts };
    });
    const apply = (mesh: THREE.Mesh, pose: Pose) => {
      mesh.position.fromArray(pose);
      mesh.quaternion.fromArray(pose, 3);
    };
    const home = () => {
      const bounds = new THREE.Box3(),
        mode = latest.current.mode;
      props.runs.forEach((run, i) => {
        const choices =
          mode === "initial"
            ? [run.states["0"]]
            : mode === "trajectory"
              ? [
                  run.states["0"],
                  run.states[String(run.finalState)],
                  run.groundTruth,
                ]
              : mode === "truth"
                ? [run.groundTruth]
                : [run.states[String(run.finalState)], run.groundTruth];
        for (const poses of choices) {
          scenes[i].meshes.forEach((m, j) => {
            apply(m, poses[j]);
            m.updateMatrixWorld();
            bounds.expandByObject(m, true);
          });
        }
      });
      const center = bounds.getCenter(new THREE.Vector3()),
        radius = Math.max(
          bounds.getSize(new THREE.Vector3()).length() / 2,
          0.1,
        );
      controls.target.copy(center);
      const aspect = Math.max(
        el.clientWidth / Math.max(el.clientHeight, 1) / props.runs.length,
        0.4,
      );
      const dist =
        (radius / Math.sin(THREE.MathUtils.degToRad(17.5))) *
        Math.max(1, 1 / aspect) *
        1.08;
      camera.position
        .copy(center)
        .add(
          new THREE.Vector3(1.25, -1.7, 1.1).normalize().multiplyScalar(dist),
        );
      camera.near = radius / 1000;
      camera.far = dist * 100;
      camera.updateProjectionMatrix();
      controls.update();
    };
    home();
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let down = [0, 0];
    const start = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    const pick = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const pane = Math.min(
        scenes.length - 1,
        Math.floor(((e.clientX - rect.left) / rect.width) * scenes.length),
      );
      const width = rect.width / scenes.length;
      pointer.set(
        ((e.clientX - rect.left - pane * width) / width) * 2 - 1,
        1 - (2 * (e.clientY - rect.top)) / rect.height,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(scenes[pane].meshes)[0];
      latest.current.onSelect(hit?.object.userData.id ?? "");
    };
    renderer.domElement.addEventListener("pointerdown", start);
    renderer.domElement.addEventListener("pointerup", pick);
    let frame = 0,
      lastReset = props.reset,
      lastMode = props.mode,
      width = 0,
      height = 0;
    const draw = () => {
      const p = latest.current;
      const w = el.clientWidth,
        h = el.clientHeight;
      if (w !== width || h !== height) {
        width = w;
        height = h;
        renderer.setSize(w, h, false);
        camera.aspect = w / scenes.length / h;
        camera.updateProjectionMatrix();
      }
      if (p.reset !== lastReset || p.mode !== lastMode) {
        lastReset = p.reset;
        lastMode = p.mode;
        home();
      }
      controls.update();
      renderer.setScissorTest(true);
      scenes.forEach(({ scene, meshes, ghosts }, i) => {
        const run = p.runs[i],
          call = run.calls[p.cursors[i] - 1];
        const state =
          p.mode === "initial"
            ? "0"
            : p.mode === "final" || p.mode === "overlay"
              ? String(run.finalState)
              : String(call?.state_index ?? 0);
        const poses = p.mode === "truth" ? run.groundTruth : run.states[state];
        meshes.forEach((m, j) => {
          apply(m, poses[j]);
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.emissive.set(
            p.selected === run.parts[j].id ? "#46331c" : "#000000",
          );
          mat.opacity = p.selected && p.selected !== run.parts[j].id ? 0.32 : 1;
          mat.transparent = mat.opacity < 1;
          apply(ghosts[j], run.groundTruth[j]);
          ghosts[j].visible = p.mode === "overlay";
        });
        const x = Math.floor((i * w) / scenes.length),
          pw = Math.floor(((i + 1) * w) / scenes.length) - x;
        renderer.setViewport(x, 0, pw, h);
        renderer.setScissor(x, 0, pw, h);
        renderer.render(scene, camera);
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      controls.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [props.runs]);
  return (
    <div className="stage" ref={host}>
      {error && (
        <div className="fallback">
          <img src={props.fallback} alt="Assembly preview" />
          <p role="status">{error}</p>
        </div>
      )}
    </div>
  );
}
