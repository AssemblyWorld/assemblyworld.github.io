import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mountCompass } from "./OrientationCompass";
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
  showCamera: boolean;
  followCamera: boolean;
  onSelect: (id: string) => void;
  fallback: string;
  onFreeView: () => void;
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
    renderer.setClearColor("#eeedf4");
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
      // Keep helpers fixed in the recorded world frame (Z up).
      const worldBounds = new THREE.Box3();
      meshes.forEach((mesh, j) => {
        mesh.position.fromArray(run.groundTruth[j]);
        mesh.quaternion.fromArray(run.groundTruth[j], 3);
        mesh.updateMatrixWorld();
        worldBounds.expandByObject(mesh, true);
      });
      const extent = Math.max(
        worldBounds.getSize(new THREE.Vector3()).length(),
        0.1,
      );
      const grid = new THREE.GridHelper(extent * 12, 96, 0xa9b3c4, 0xdce1e8);
      grid.rotation.x = Math.PI / 2;
      grid.position.z = worldBounds.min.z - extent * 0.005;
      const gridCenter = worldBounds.getCenter(new THREE.Vector3());
      grid.position.x = gridCenter.x;
      grid.position.y = gridCenter.y;
      scene.add(grid);
      geometries.push(grid.geometry);
      materials.push(
        ...(Array.isArray(grid.material) ? grid.material : [grid.material]),
      );
      const recordedCamera = new THREE.PerspectiveCamera(38, 4 / 3, 0.01, 1);
      const helper = new THREE.CameraHelper(recordedCamera);
      helper.setColors(
        ...([0x965518, 0x965518, 0xa9752c, 0x965518, 0x965518].map(
          (c) => new THREE.Color(c),
        ) as [THREE.Color, THREE.Color, THREE.Color, THREE.Color, THREE.Color]),
      );
      scene.add(helper);
      return { scene, meshes, ghosts, recordedCamera, helper };
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
      if (latest.current.showCamera && !latest.current.followCamera) {
        props.runs.forEach((run, i) => {
          const state =
            mode === "final" || mode === "overlay"
              ? run.finalState
              : mode === "initial"
                ? 0
                : (run.calls[latest.current.cursors[i] - 1]?.state_index ?? 0);
          bounds.expandByPoint(
            new THREE.Vector3().fromArray(run.cameras[String(state)].position),
          );
        });
      }
      const contextRadius = Math.max(
        bounds.getSize(new THREE.Vector3()).length() / 2,
        radius,
      );
      if (latest.current.showCamera && !latest.current.followCamera)
        bounds.getCenter(center);
      controls.target.copy(center);
      const aspect = Math.max(
        el.clientWidth / Math.max(el.clientHeight, 1) / props.runs.length,
        0.4,
      );
      const dist =
        (contextRadius / Math.sin(THREE.MathUtils.degToRad(17.5))) *
        Math.max(1, 1 / aspect) *
        1.08;
      camera.position
        .copy(center)
        .add(
          new THREE.Vector3(1.25, -1.7, 1.1).normalize().multiplyScalar(dist),
        );
      controls.minDistance = radius * 0.8;
      controls.maxDistance = dist * 3;
      camera.fov = 35;
      camera.up.set(0, 0, 1);
      camera.near = radius / 1000;
      camera.far = dist * 100;
      camera.updateProjectionMatrix();
      controls.update();
    };
    home();
    let pendingDirection: THREE.Vector3 | null = null;
    const compasses = scenes.map((_, i) => {
      const compass = mountCompass(el, (direction) => {
        pendingDirection = direction;
        latest.current.onFreeView();
      });
      compass.root.style.left = `calc(${(i * 100) / scenes.length}% + 10px)`;
      return compass;
    });
    const cameraFrames = scenes.map(() => {
      const frame = document.createElement("div");
      frame.className = "camera-frame";
      frame.setAttribute("aria-hidden", "true");
      el.append(frame);
      return frame;
    });
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
      if (latest.current.followCamera) {
        const paneHeight = Math.min(rect.height, (width * 3) / 4);
        const paneWidth = (paneHeight * 4) / 3;
        const left = pane * width + (width - paneWidth) / 2;
        const top = (rect.height - paneHeight) / 2;
        const px = e.clientX - rect.left - left,
          py = e.clientY - rect.top - top;
        if (px < 0 || px > paneWidth || py < 0 || py > paneHeight) return;
        pointer.set((px / paneWidth) * 2 - 1, 1 - (py / paneHeight) * 2);
      }
      ray.setFromCamera(
        pointer,
        latest.current.followCamera ? scenes[pane].recordedCamera : camera,
      );
      const hit = ray.intersectObjects(scenes[pane].meshes)[0];
      latest.current.onSelect(hit?.object.userData.id ?? "");
    };
    renderer.domElement.addEventListener("pointerdown", start);
    renderer.domElement.addEventListener("pointerup", pick);
    let frame = 0,
      lastReset = props.reset,
      lastMode = props.mode,
      lastShow = props.showCamera,
      lastFollow = props.followCamera,
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
      if (
        p.reset !== lastReset ||
        p.mode !== lastMode ||
        p.showCamera !== lastShow ||
        p.followCamera !== lastFollow
      ) {
        lastShow = p.showCamera;
        lastFollow = p.followCamera;
        lastReset = p.reset;
        lastMode = p.mode;
        home();
      }
      if (pendingDirection && !p.followCamera) {
        const distance = camera.position.distanceTo(controls.target);
        camera.position
          .copy(controls.target)
          .addScaledVector(pendingDirection, distance);
        camera.up.set(
          0,
          Math.abs(pendingDirection.z) > 0.9 ? 1 : 0,
          Math.abs(pendingDirection.z) > 0.9 ? 0 : 1,
        );
        camera.lookAt(controls.target);
        controls.update();
        pendingDirection = null;
      }
      controls.enabled = !p.followCamera;
      if (controls.enabled) controls.update();
      renderer.setScissorTest(true);
      scenes.forEach(({ scene, meshes, ghosts, recordedCamera, helper }, i) => {
        const run = p.runs[i],
          call = run.calls[p.cursors[i] - 1];
        const state =
          p.mode === "initial"
            ? "0"
            : p.mode === "final" || p.mode === "overlay"
              ? String(run.finalState)
              : String(call?.state_index ?? 0);
        const recorded = run.cameras[state];
        recordedCamera.position.fromArray(recorded.position);
        recordedCamera.up.fromArray(recorded.up);
        recordedCamera.lookAt(new THREE.Vector3().fromArray(recorded.target));
        recordedCamera.fov = recorded.fov;
        recordedCamera.near = 0.01;
        recordedCamera.far = p.followCamera
          ? 1000
          : Math.max(
              0.1,
              recordedCamera.position.distanceTo(
                new THREE.Vector3().fromArray(recorded.target),
              ) * 0.18,
            );
        recordedCamera.updateProjectionMatrix();
        recordedCamera.updateMatrixWorld();
        helper.update();
        helper.visible = p.showCamera && !p.followCamera;
        compasses[i].update(p.followCamera ? recordedCamera : camera);
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
        renderer.clear();
        cameraFrames[i].hidden = !p.followCamera;
        if (p.followCamera) {
          const vh = Math.min(h, (pw * 3) / 4),
            vw = (vh * 4) / 3;
          Object.assign(cameraFrames[i].style, {
            left: `${x + (pw - vw) / 2}px`,
            top: `${(h - vh) / 2}px`,
            width: `${vw}px`,
            height: `${vh}px`,
          });
          renderer.setViewport(x + (pw - vw) / 2, (h - vh) / 2, vw, vh);
          renderer.setScissor(x + (pw - vw) / 2, (h - vh) / 2, vw, vh);
          renderer.render(scene, recordedCamera);
        } else renderer.render(scene, camera);
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      controls.dispose();
      compasses.forEach((compass) => compass.dispose());
      cameraFrames.forEach((frame) => frame.remove());
      scenes.forEach(({ helper }) => helper.dispose());
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
