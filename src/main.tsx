import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Viewer from "./Viewer";
import type { Case } from "./types";
import "./style.css";
const ENV = "https://assemblyworld.github.io/3DWebAgent/";
const README =
  "https://github.com/AssemblyWorld/3DWebAgent#connect-through-webmcp";
const CODE = "https://github.com/AssemblyWorld/assembly-world-agent";
const DATA =
  "https://github.com/AssemblyWorld/assembly-world-agent/tree/main/benchmarks/assemblyworldbench";
const authors = [
  ["Jiahao Zhang", "1,*"],
  ["Yeying Fan", "3,*"],
  ["Moitreya Chatterjee", "2"],
  ["Suhas Lohit", "2"],
  ["Bernhard Egger", "4"],
  ["Tim K. Marks", "2"],
  ["Anoop Cherian", "2"],
  ["Stephen Gould", "1"],
];
const results = [
  ["GPT-6 Astra", 59.4],
  ["Claude Fable 5.1", 50.0],
  ["Claude Opus 5", 44.4],
  ["Qwen3.8 Max", 11.9],
  ["GPT-5.6 Sol", 11.2],
  ["Claude Sonnet 5", 7.5],
  ["GPT-5.6 Terra", 7.5],
  ["DeepSeek V4.1 Flash", 0],
] as const;
const bib = `@misc{zhang2026assemblyworld,
  title = {AssemblyWorld: Rethinking 3D Assembly with General-Purpose Agents},
  author = {Zhang, Jiahao and Fan, Yeying and Chatterjee, Moitreya and
            Lohit, Suhas and Egger, Bernhard and Marks, Tim K. and
            Cherian, Anoop and Gould, Stephen},
  year = {2026},
  url = {https://assemblyworld.github.io/}
}`;
function Copy({
  text,
  label = "Copy prompt",
}: {
  text: string;
  label?: string;
}) {
  const [state, setState] = useState("");
  useEffect(() => setState(""), [text]);
  return (
    <button
      className="button dark"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("Copied");
        } catch {
          setState("Select and copy the text below");
        }
      }}
    >
      {state || label} <span aria-hidden="true">↗</span>
    </button>
  );
}
function App() {
  const [cases, setCases] = useState<Case[]>([]),
    [selected, setSelected] = useState(""),
    [filter, setFilter] = useState("All"),
    [location, setLocation] = useState<"hero" | "gallery">("hero"),
    [error, setError] = useState("");
  const [paper, setPaper] = useState<string | undefined>();
  const local =
    new URLSearchParams(window.location.search).get("preview") === "local" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);
  useEffect(() => {
    fetch(local ? "/catalog.local.json" : "/catalog.json")
      .then((r) => {
        if (!r.ok) throw Error("Unable to load examples. Please refresh.");
        return r.json();
      })
      .then((v) => {
        setCases(v.cases);
        const id = new URLSearchParams(window.location.search).get("case");
        setSelected(
          v.cases.some((c: Case) => c.id === id) ? id : v.cases[0]?.id,
        );
      })
      .catch((e) => setError(e.message));
    fetch("/publication.json")
      .then((r) => r.json())
      .then((v) => setPaper(v.paperUrl))
      .catch(() => {});
  }, [local]);
  const item = cases.find((c) => c.id === selected);
  const choose = (id: string, scroll = false) => {
    setSelected(id);
    setLocation("gallery");
    const url = new URL(window.location.href);
    url.searchParams.set("case", id);
    history.replaceState(null, "", url);
    if (scroll)
      setTimeout(
        () =>
          document
            .getElementById("gallery-viewer")
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        60,
      );
  };
  const scene = item
    ? ENV +
      "?episode=" +
      encodeURIComponent(new URL(item.initial, window.location.origin).href)
    : "";
  const manual = item ? new URL(item.manual, window.location.origin).href : "";
  const prompt = item
    ? `Assemble ${item.title} in this browser environment:\n${scene}\n\n${item.reference === "No visual reference" ? "This task has no visual reference." : `Follow the ${item.reference.toLowerCase()} at:\n${manual}`}\n\nUse the environment's WebMCP tools to inspect and position the supplied parts. Capture the scene to check your work${item.reference === "No visual reference" ? "" : " against the reference"}. Incorporate all supplied parts and verify the connections before finishing.`
    : "";
  return (
    <>
      <a className="skip" href="#gallery">
        Skip to interactive examples
      </a>
      <header className="nav">
        <a className="brand" href="/">
          <img src="/logo.svg" alt="" />
          AssemblyWorld<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#gallery">Explore</a>
          <a href="#try">Try it</a>
          <a href="#results">Results</a>
          <a className="nav-code" href={CODE}>
            GitHub ↗
          </a>
        </nav>
      </header>
      <main>
        {local && (
          <div className="local-banner">
            LOCAL PREVIEW · Includes assets awaiting redistribution clearance.
          </div>
        )}
        <section className="hero" id="overview">
          <div className="eyebrow">
            <span /> GENERAL-PURPOSE AGENTS, MEET 3D ASSEMBLY
          </div>
          <h1>
            Assembly<span>World</span>
          </h1>
          <h2>
            Rethinking 3D Assembly
            <br className="mobile-break" /> with General-Purpose Agents
          </h2>
          <p className="hero-description">
            From scattered parts to assembled objects.
            <br />
            Explore how agents observe, act, and refine in an interactive 3D
            world.
          </p>
          <div className="authors">
            {authors.map(([name, aff]) => (
              <span key={name}>
                {name}
                <sup>{aff}</sup>
              </span>
            ))}
          </div>
          <div className="affiliations">
            <span>
              <sup>1</sup> Australian National University
            </span>
            <span>
              <sup>2</sup> Mitsubishi Electric Research Laboratories
            </span>
            <span>
              <sup>3</sup> Tsinghua University
            </span>
            <span>
              <sup>4</sup> FAU Erlangen-Nürnberg
            </span>
          </div>
          <p className="equal">* Equal contribution</p>
          <div className="hero-actions">
            {paper ? (
              <a className="button dark" href={paper}>
                Read the paper ↗
              </a>
            ) : (
              <span className="button unavailable">Paper · forthcoming</span>
            )}
            <a className="button" href={CODE}>
              Code ↗
            </a>
            <a className="button" href={DATA}>
              Benchmark ↗
            </a>
            <a className="button accent" href="#gallery">
              Explore in 3D ↓
            </a>
          </div>
          <div className="hero-scene">
            {error ? (
              <p role="alert">{error}</p>
            ) : item && location === "hero" ? (
              <Viewer key={item.id} item={item} />
            ) : item ? (
              <button
                className="hero-preview"
                onClick={() => {
                  setLocation("hero");
                  window.scrollTo({ top: 300, behavior: "smooth" });
                }}
              >
                <img
                  src={item.thumbnail}
                  alt={`${item.title} assembled result`}
                />
                <span>Explore this assembly in 3D ↗</span>
              </button>
            ) : (
              <div className="load-state">Loading examples…</div>
            )}
          </div>
          <div className="hero-caption">
            <span>Not a video. A real trajectory you can explore.</span>
            <a href="#gallery">Discover the examples ↓</a>
          </div>
        </section>
        <section
          className="contributions section"
          aria-label="Research contributions"
        >
          <article>
            <span className="number">01 / ENVIRONMENT</span>
            <h3>See. Move. Inspect.</h3>
            <p>
              Agents reason from rendered views and manipulate supplied rigid
              parts through a common tool interface. No direct access to mesh
              vertices or faces.
            </p>
          </article>
          <article>
            <span className="number">02 / BENCHMARK</span>
            <h3>One world. Many assemblies.</h3>
            <p>
              100 tasks across 80 objects from four data sources, spanning
              furniture, industrial assemblies, and fracture reconstruction.
            </p>
          </article>
          <article>
            <span className="number">03 / EVALUATION</span>
            <h3>Measure the geometry.</h3>
            <p>
              Eight agent systems, without assembly-specific fine-tuning. We
              evaluate the resulting geometry, not the agent’s claim of
              completion.
            </p>
          </article>
        </section>
        <section className="section gallery" id="gallery">
          <div className="section-heading">
            <div>
              <div className="eyebrow">EXPLORE THE WORK</div>
              <h2>Assembly, step by step.</h2>
            </div>
            <p>
              Pick an object. Orbit the scene.
              <br />
              Follow the decisions that brought its parts together.
            </p>
          </div>
          <div className="gallery-toolbar">
            <div className="filters" aria-label="Filter examples">
              {["All", "Furniture", "Industrial", "Fracture"].map((f) => (
                <button
                  key={f}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <span>
              {
                cases.filter((c) => filter === "All" || c.domain === filter)
                  .length
              }{" "}
              interactive examples
            </span>
          </div>
          <div className="cards">
            {cases
              .filter((c) => filter === "All" || c.domain === filter)
              .map((c, i) => (
                <button
                  className={"case-card " + (c.id === selected ? "active" : "")}
                  key={c.id}
                  onClick={() => choose(c.id, true)}
                  aria-pressed={c.id === selected}
                >
                  <div className="card-image">
                    <img
                      src={c.thumbnail}
                      loading="lazy"
                      alt={`${c.title}, recorded final assembly`}
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                    <span className="card-index">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="card-arrow">↗</span>
                  </div>
                  <div className="card-text">
                    <div className="card-meta">
                      {c.dataset} <span>{c.parts} parts</span>
                    </div>
                    <h3>{c.title}</h3>
                    <div className="card-bottom">
                      <span>{c.variants[0].label}</span>
                      <span
                        className={c.variants[0].SR ? "success" : "partial"}
                      >
                        {c.variants[0].SR ? "Complete" : "Residual errors"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
          </div>
          {!cases.filter((c) => filter === "All" || c.domain === filter)
            .length && (
            <p className="empty">
              Interactive examples for this domain are being prepared for public
              release. Explore the full benchmark in the resources below.
            </p>
          )}
          <p className="gallery-caption">
            Curated examples illustrate behavior, not aggregate performance.
            “Complete” means all parts pass the recorded geometric threshold.
          </p>
          {item && location === "gallery" && (
            <div id="gallery-viewer">
              <Viewer key={item.id} item={item} />
            </div>
          )}
        </section>
        <section className="section try-section" id="try">
          <div className="try-intro">
            <div className="eyebrow">YOUR AGENT. OUR WORLD.</div>
            <h2>
              Give your agent
              <br />
              something to assemble.
            </h2>
            <p>
              Copy the prompt into your agent with browser WebMCP access. Watch
              it inspect the scene, move parts, and check its work.
            </p>
            <div className="try-steps">
              <span>
                <b>1</b> Choose a scene
              </span>
              <span>
                <b>2</b> Copy the prompt
              </span>
              <span>
                <b>3</b> Let your agent explore
              </span>
            </div>
            <a className="inline-link" href={README}>
              Connect your agent: setup guide ↗
            </a>
            <p className="fine-print">
              Uses your own agent and its browser connection. Opening the scene
              alone does not start an agent.
            </p>
          </div>
          <div className="prompt-panel">
            <label htmlFor="try-case">ASSEMBLY TASK</label>
            <select
              id="try-case"
              value={selected}
              onChange={(e) => choose(e.target.value)}
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} · {c.reference}
                </option>
              ))}
            </select>
            <pre tabIndex={0}>{prompt}</pre>
            <div className="prompt-actions">
              <Copy text={prompt} />
              <a
                className="button"
                href={scene}
                target="_blank"
                rel="noreferrer"
              >
                Open scene ↗
              </a>
              {item?.reference !== "No visual reference" && (
                <a
                  className="reference-link"
                  href={manual}
                  target="_blank"
                  rel="noreferrer"
                >
                  Reference ↗
                </a>
              )}
            </div>
          </div>
        </section>
        <section className="section method" id="method">
          <div className="section-heading">
            <div>
              <div className="eyebrow">HOW IT WORKS</div>
              <h2>Reasoning becomes action.</h2>
            </div>
            <p>
              A common observation–action interface
              <br />
              connects agent decisions to a 3D environment.
            </p>
          </div>
          <div className="method-flow">
            <article>
              <span className="method-symbol">◎</span>
              <span className="number">01 / OBSERVE</span>
              <h3>Find a useful view.</h3>
              <p>
                Inspect rendered images, choose viewpoints, and consult the
                available reference.
              </p>
              <code>capture_scene</code>
            </article>
            <span className="flow-arrow">→</span>
            <article>
              <span className="method-symbol">✣</span>
              <span className="number">02 / ACT</span>
              <h3>Arrange the parts.</h3>
              <p>
                Translate and rotate parts or groups with explicit pose-editing
                tools.
              </p>
              <code>translate_objects</code>
            </article>
            <span className="flow-arrow">→</span>
            <article>
              <span className="method-symbol">↻</span>
              <span className="number">03 / REFINE</span>
              <h3>Look again. Adjust.</h3>
              <p>
                Inspect the new state, identify remaining errors, and revise the
                assembly.
              </p>
              <a href="#gallery" className="inline-link">
                Inspect real tool calls ↑
              </a>
            </article>
          </div>
        </section>
        <section className="section results" id="results">
          <div className="section-heading">
            <div>
              <div className="eyebrow">RESULTS & INSIGHTS</div>
              <h2>Structure is only the beginning.</h2>
            </div>
            <p>
              Recognizing an assembly is easier
              <br />
              than getting every part precisely into place.
            </p>
          </div>
          <div className="results-layout">
            <div className="chart">
              <div className="chart-title">
                <h3>Complete-assembly success</h3>
                <span>overall SR (%)</span>
              </div>
              {results.map(([name, score], i) => (
                <div className="bar-row" key={name}>
                  <span>{name}</span>
                  <div className="bar-track">
                    <div
                      className={i === 0 ? "bar lead" : "bar"}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <strong>{score.toFixed(1)}</strong>
                </div>
              ))}
              <p className="fine-print">
                AssemblyWorldBench · 100 tasks / 80 objects. Source-balanced
                aggregation: average reference conditions within each source,
                then average the four sources. Values rounded as in the paper.
              </p>
            </div>
            <div className="insights">
              <div className="stat-pair">
                <div>
                  <strong>
                    80.9<span>%</span>
                  </strong>
                  <span>part accuracy</span>
                </div>
                <div>
                  <strong>
                    59.4<span>%</span>
                  </strong>
                  <span>assembly success</span>
                </div>
              </div>
              <p>
                The strongest evaluated system assembles many parts correctly,
                but complete reconstruction remains harder.
              </p>
              <h3>References help; precision still matters.</h3>
              <p>
                Visual guidance improves performance for stronger systems.
                Inspection and corrections can resolve errors, yet
                plausible-looking results may still miss geometric thresholds.
              </p>
              <div className="scope-note">
                These experiments evaluate free-space geometry. They do not
                establish collision-free execution or physically stable
                assembly.
              </div>
            </div>
          </div>
        </section>
        <section className="section resources" id="resources">
          <div className="section-heading">
            <div>
              <div className="eyebrow">BUILD ON ASSEMBLYWORLD</div>
              <h2>Explore. Evaluate. Extend.</h2>
            </div>
          </div>
          <div className="resource-grid">
            <a href="https://github.com/AssemblyWorld/3DWebAgent">
              <span>01</span>
              <h3>3D environment ↗</h3>
              <p>Browser-based interaction and the episode format.</p>
            </a>
            <a href={CODE}>
              <span>02</span>
              <h3>Agent & evaluation ↗</h3>
              <p>Task preparation, reproducible runs, and geometric scoring.</p>
            </a>
            <a href={DATA}>
              <span>03</span>
              <h3>Benchmark & data ↗</h3>
              <p>Task definitions and source-specific dataset access.</p>
            </a>
          </div>
          <p>
            <a
              className="inline-link"
              href="https://huggingface.co/AssemblyWorld"
            >
              Browse the source datasets on Hugging Face ↗
            </a>
          </p>
          <div className="citation">
            <div>
              <h3>Cite this work</h3>
              <p>
                Project citation. Publication details will be updated when
                available.
              </p>
              <Copy text={bib} label="Copy BibTeX" />
            </div>
            <pre tabIndex={0}>{bib}</pre>
          </div>
        </section>
      </main>
      <footer>
        <a className="brand" href="/">
          <img src="/logo.svg" alt="" />
          AssemblyWorld.
        </a>
        <p>Assembly is a world of possibilities.</p>
        <a href="/asset-terms.html">Asset terms & attribution</a>
        <a href="https://github.com/AssemblyWorld/assemblyworld.github.io">
          Website source ↗
        </a>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
