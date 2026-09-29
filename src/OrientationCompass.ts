import { Camera, Quaternion, Vector3 } from "three";

/** An independent DOM compass projected from the active camera orientation. */
export function mountCompass(
  host: HTMLElement,
  select: (direction: Vector3) => void,
) {
  const root = document.createElement("div");
  root.className = "orientation-compass";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "View orientation");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("aria-hidden", "true");
  root.append(svg);
  const ends = ["X", "Y", "Z"].flatMap((axis, index) =>
    [-1, 1].map((sign) => {
      const vector = new Vector3().setComponent(index, sign);
      const button = document.createElement("button");
      const label = `${sign > 0 ? "+" : "−"}${axis}`;
      button.type = "button";
      button.className = `compass-axis axis-${axis.toLowerCase()} ${sign < 0 ? "back-axis" : ""}`;
      button.textContent = sign > 0 ? axis : "";
      button.setAttribute("aria-label", `View from ${label}`);
      button.title = `View from ${label} (free view)`;
      button.onclick = () => select(vector.clone());
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      line.setAttribute("x1", "50");
      line.setAttribute("y1", "50");
      line.setAttribute("class", `axis-${axis.toLowerCase()}`);
      svg.append(line);
      root.append(button);
      return { vector, button, line, projected: new Vector3() };
    }),
  );
  host.append(root);
  const inverse = new Quaternion();
  return {
    root,
    update(camera: Camera) {
      inverse.copy(camera.quaternion).invert();
      for (const end of ends)
        end.projected.copy(end.vector).applyQuaternion(inverse);
      [...ends]
        .sort((a, b) => a.projected.z - b.projected.z)
        .forEach((end, order) => {
          let x = 50 + end.projected.x * 33;
          let y = 50 - end.projected.y * 33;
          if (end.projected.z < -0.94) {
            x += 15;
            y += 15;
          }
          end.button.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
          end.button.style.zIndex = String(order + 1);
          end.button.style.opacity = end.projected.z < 0 ? "0.55" : "1";
          end.line.setAttribute("x2", String(x));
          end.line.setAttribute("y2", String(y));
          end.line.style.opacity = end.projected.z < 0 ? "0.25" : "0.7";
        });
    },
    dispose() {
      root.remove();
    },
  };
}
