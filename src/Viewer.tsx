import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { Case, Run, ViewMode } from "./types";
const Stage = lazy(() => import("./Stage"));
export default function Viewer({ item }: { item: Case }) {
  const [runs, setRuns] = useState<Run[]>([]),
    [compare, setCompare] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [cursors, setCursors] = useState([0, 0]),
    [playing, setPlaying] = useState([false, false]),
    [mode, setMode] = useState<ViewMode>("final"),
    [selected, setSelected] = useState(""),
    [reset, setReset] = useState(0),
    [showCamera, setShowCamera] = useState(false),
    [followCamera, setFollowCamera] = useState(false);
  const variants = useMemo(
    () => item.variants.slice(0, compare ? 2 : 1),
    [item, compare],
  );
  useEffect(() => {
    const controller = new AbortController();
    setRuns([]);
    setError("");
    setPlaying([false, false]);
    setCursors([0, 0]);
    setSelected("");
    Promise.all(
      variants.map(async (v) => {
        const res = await fetch(v.url, { signal: controller.signal });
        if (!res.ok)
          throw Error(
            "The recorded trajectory could not be loaded. Please try again.",
          );
        const bytes = await res.arrayBuffer();
        const hash = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (x) => x.toString(16).padStart(2, "0"),
        ).join("");
        if (hash !== v.sha256)
          throw Error("The assembly could not be loaded. Please try again.");
        const run = JSON.parse(new TextDecoder().decode(bytes)) as Run;
        if (run.version !== 1 || !run.states["0"])
          throw Error("Unsupported trajectory format.");
        const gr = await fetch(run.geometry.url, { signal: controller.signal });
        if (!gr.ok) throw Error("Geometry could not be loaded.");
        const buffer = await gr.arrayBuffer();
        const gh = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
          (x) => x.toString(16).padStart(2, "0"),
        ).join("");
        if (gh !== run.geometry.sha256)
          throw Error("The assembly could not be loaded. Please try again.");
        run.parts.forEach((p) => {
          p.positions = new Float32Array(
            buffer,
            p.positionOffset,
            p.positionCount,
          );
          p.indices = new Uint32Array(buffer, p.indexOffset, p.indexCount);
        });
        return run;
      }),
    )
      .then(setRuns)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [variants, attempt]);
  useEffect(() => {
    if (!playing.some(Boolean) || mode !== "trajectory") return;
    const timer = setInterval(
      () =>
        setCursors((old) =>
          old.map((n, i) =>
            playing[i] && runs[i] ? Math.min(n + 1, runs[i].calls.length) : n,
          ),
        ),
      650,
    );
    return () => clearInterval(timer);
  }, [playing, runs, mode]);
  useEffect(() => {
    setPlaying((old) =>
      old.map((p, i) => p && !!runs[i] && cursors[i] < runs[i].calls.length),
    );
  }, [cursors, runs]);
  const seek = (i: number, n: number) => {
    setMode("trajectory");
    setCursors((old) => old.map((v, j) => (i === j ? n : v)));
    setPlaying((old) => old.map((v, j) => (i === j ? false : v)));
  };
  return (
    <div className="viewer" data-testid="viewer">
      <div className="viewer-header">
        <div>
          <span className="status-dot" /> INTERACTIVE REPLAY{" "}
          <span className="viewer-case">/ {item.title}</span>
        </div>
        <button
          className="text-button"
          onClick={() => {
            setReset((n) => n + 1);
            setSelected("");
            setFollowCamera(false);
          }}
        >
          ↺ Reset view
        </button>
      </div>
      <div className="viewport-wrap">
        {error ? (
          <div className="load-state" role="alert">
            {error}
            <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
          </div>
        ) : runs.length ? (
          <Suspense
            fallback={<div className="load-state">Preparing 3D view…</div>}
          >
            <Stage
              showCamera={showCamera}
              followCamera={followCamera}
              runs={runs}
              cursors={cursors}
              mode={mode}
              selected={selected}
              reset={reset}
              onSelect={setSelected}
              fallback={item.thumbnail}
            />
          </Suspense>
        ) : (
          <div className="load-state">
            <span className="spinner" />
            Loading the assembly…
          </div>
        )}
        <div className="stage-note">
          {followCamera
            ? "AGENT CAMERA · TURN OFF FOLLOW TO EXPLORE"
            : "DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A PART"}
        </div>
        <div
          className="axis-legend"
          aria-label="World axes: X red, Y green, Z blue"
        >
          <span>X</span>
          <span>Y</span>
          <span>Z ↑</span>
        </div>
        {compare && (
          <div className="pane-labels">
            {variants.map((v) => (
              <span key={v.id}>{v.label}</span>
            ))}
          </div>
        )}
      </div>
      <div className="view-controls">
        <div className="segmented" aria-label="Display mode">
          {(
            ["initial", "trajectory", "final", "truth", "overlay"] as ViewMode[]
          ).map((v) => (
            <button
              key={v}
              aria-pressed={mode === v}
              onClick={() => {
                setMode(v);
                setPlaying([false, false]);
              }}
            >
              {
                {
                  initial: "Initial",
                  trajectory: "Trajectory",
                  final: "Agent result",
                  truth: "Ground truth",
                  overlay: "Overlay",
                }[v]
              }
            </button>
          ))}
        </div>
        {item.variants.length > 1 && (
          <label className="compare-toggle">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
            />{" "}
            Compare agents
          </label>
        )}
        <label className="compare-toggle">
          <input
            type="checkbox"
            checked={showCamera}
            onChange={(e) => setShowCamera(e.target.checked)}
          />{" "}
          Show agent camera
        </label>
        <label className="compare-toggle">
          <input
            type="checkbox"
            checked={followCamera}
            onChange={(e) => setFollowCamera(e.target.checked)}
          />{" "}
          Follow agent camera
        </label>
        <label className="part-select">
          Highlight{" "}
          <select
            aria-label="Highlight part"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">All parts</option>
            {runs[0]?.parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={"tracks " + (compare ? "two" : "")}>
        {runs.map((run, i) => {
          const call = run.calls[cursors[i] - 1],
            v = variants[i];
          return (
            <div className="track" key={v.id}>
              <div className="track-heading">
                <strong>{v.label}</strong>
                <span>
                  Part accuracy {(v.PA * 100).toFixed(1)}%{" "}
                  <span className={v.SR ? "success" : "partial"}>
                    {v.SR ? "Complete" : "Incomplete"}
                  </span>
                </span>
              </div>
              <div className="timeline">
                <button
                  aria-label={`Previous step ${i + 1}`}
                  onClick={() => seek(i, Math.max(0, cursors[i] - 1))}
                >
                  ‹
                </button>
                <button
                  aria-label={`${playing[i] ? "Pause" : "Play"} trajectory ${i + 1}`}
                  onClick={() => {
                    setMode("trajectory");
                    if (cursors[i] === run.calls.length)
                      setCursors((old) => old.map((n, j) => (j === i ? 0 : n)));
                    setPlaying((old) => old.map((v, j) => (j === i ? !v : v)));
                  }}
                >
                  {playing[i] ? "Ⅱ" : "▶"}
                </button>
                <input
                  aria-label={`Trajectory step ${i + 1}`}
                  type="range"
                  min="0"
                  max={run.calls.length}
                  value={cursors[i]}
                  onChange={(e) => seek(i, +e.target.value)}
                />
                <button
                  aria-label={`Next step ${i + 1}`}
                  onClick={() =>
                    seek(i, Math.min(run.calls.length, cursors[i] + 1))
                  }
                >
                  ›
                </button>
                <span>
                  {cursors[i]} / {run.calls.length}
                </span>
              </div>
              <details className="call-details">
                <summary>
                  {mode === "trajectory"
                    ? call
                      ? `${String(cursors[i]).padStart(3, "0")} · ${call.name}`
                      : "000 · Initial state"
                    : "Explore the timeline to see the agent’s actions"}{" "}
                  <span>Tool call</span>
                </summary>
                <pre>{JSON.stringify(call?.arguments ?? {}, null, 2)}</pre>
              </details>
            </div>
          );
        })}
      </div>
      {(mode === "overlay" || followCamera) && (
        <p className="viewer-footnote">
          {mode === "overlay" ? "Teal outline: target assembly. " : ""}
          {followCamera
            ? "Following the agent’s camera. Turn off Follow to explore freely."
            : ""}
        </p>
      )}
    </div>
  );
}
