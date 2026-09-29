import { test, expect } from "@playwright/test";
test("scene playback, part selection, reference and independent agent timelines", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?case=assemblybench-7355");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "Next step 1", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "Trajectory step 1" }),
  ).toHaveValue("1");
  await page.getByRole("button", { name: "Play trajectory 1" }).click();
  await expect
    .poll(() =>
      page.getByRole("slider", { name: "Trajectory step 1" }).inputValue(),
    )
    .not.toBe("1");
  await page.getByRole("button", { name: "Pause trajectory 1" }).click();
  await page.getByLabel("Highlight part").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await page.getByLabel("Compare agents").check();
  await expect(page.locator(".track")).toHaveCount(2);
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "Next step 2", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "Trajectory step 2" }),
  ).toHaveValue("1");
  await expect(
    page.getByRole("slider", { name: "Trajectory step 1" }),
  ).toHaveValue("0");
  await page.getByRole("button", { name: "Ground truth", exact: true }).click();
  await page.getByRole("button", { name: "↺ Reset view" }).click();
  expect(errors).toEqual([]);
});
test("gallery selection stays in sync with Try and is immediately followed by it", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".case-card")).toHaveCount(12);
  await page.locator(".case-card").nth(1).click();
  await expect(page.locator("#try-case")).toHaveValue("fantastic-00-00017");
  await expect(page.locator("#assembly-viewer canvas")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(
    await page.locator("#gallery").evaluate((el) => el.nextElementSibling?.id),
  ).toBe("try");
  await expect(page.locator(".prompt-panel pre")).toContainText(
    "fantastic-00-00017",
  );
  await expect(
    page.getByRole("link", { name: "Open scene ↗", exact: true }),
  ).toHaveAttribute("href", /3DWebAgent\/\?episode=.*initial\.episode\.zip/);
  await page.locator("#try-case").selectOption("assemblybench-7355");
  await expect(page.locator(".case-card.active")).toContainText("7355");
  await expect(page.locator("#assembly-viewer canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("deep link, terms and citation remain accessible", async ({ page }) => {
  await page.goto("/?case=assemblybench-7355");
  await expect(page.locator("#try-case")).toHaveValue("assemblybench-7355");
  await expect(page.locator(".citation pre")).toContainText(
    "@article{zhang2026assemblyworld",
  );
  await page.goto("/asset-terms.html");
  await expect(
    page.getByRole("heading", {
      name: "Asset terms & attribution",
      exact: true,
    }),
  ).toBeVisible();
});
test("clear fallback when WebGL is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).includes("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText(
    "Interactive 3D is unavailable",
  );
});
test("all twelve successful examples expose their complete recorded timeline", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "chrome",
    "Full catalog smoke test runs in Chrome",
  );
  const catalog = await (await page.request.get("/catalog.json")).json();
  expect(catalog.cases).toHaveLength(12);
  for (const c of catalog.cases.filter(
    (item: { variants: { SR: number }[] }) => item.variants[0].SR === 1,
  )) {
    await page.goto(`/?case=${c.id}`);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 80000 });
    const slider = page.getByRole("slider", { name: "Trajectory step 1" });
    await expect(slider).toHaveAttribute("max", String(c.variants[0].calls));
    await slider.fill(String(c.variants[0].calls));
    await expect(slider).toHaveValue(String(c.variants[0].calls));
    await expect(page.locator(".call-details summary")).not.toContainText(
      "Initial state",
    );
  }
});

test("dataset tabs, paper examples, author links and unpublished paper", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".case-card")).toHaveCount(12);
  await expect(page.locator(".case-card").nth(0)).toContainText("APPLARO");
  await expect(page.locator(".case-card").nth(1)).toContainText("00/00017");
  await expect(page.locator(".case-card").nth(2)).toContainText("1047");
  for (const name of [
    "PartNet",
    "IKEA-Manual",
    "AssemblyBench",
    "Fantastic Breaks",
  ]) {
    await page
      .locator("#gallery")
      .getByRole("tab", { name, exact: true })
      .click();
    await expect(page.locator(".case-card")).toHaveCount(
      { PartNet: 3, "IKEA-Manual": 3, AssemblyBench: 3, "Fantastic Breaks": 3 }[
        name
      ]!,
    );
    await expect(page.locator(".case-card").first()).toContainText(name);
  }
  await page
    .locator("#gallery")
    .getByRole("tab", { name: "PartNet", exact: true })
    .press("Home");
  await expect(
    page.getByRole("tab", { name: "All", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".case-card")).toHaveCount(12);
  await expect(page.locator(".authors a")).toHaveCount(8);
  await expect(page.locator(".affiliations a")).toHaveCount(4);
  await expect(
    page.locator(".hero-actions .unavailable").first(),
  ).toContainText("Paper");
  await expect(
    page.locator(".hero-actions .unavailable").first(),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator('a[href*="paper.pdf"]')).toHaveCount(0);
  await expect(
    page.locator('.hero-actions a[href$="AssemblyWorldBench-Results"]'),
  ).toBeVisible();
});

test("dragging leaves the recorded camera and preserves the timeline", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await page.getByLabel("Show agent camera", { exact: true }).check();
  await page.getByRole("button", { name: "Next step 1", exact: true }).click();
  await page.getByLabel("Follow agent camera", { exact: true }).check();
  await expect(page.locator(".stage-note")).toContainText("AGENT CAMERA");
  const slider = page.getByRole("slider", { name: "Trajectory step 1" });
  await slider.fill("20");
  await expect(slider).toHaveValue("20");
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const before = await canvas.evaluate((el: HTMLCanvasElement) =>
    el.toDataURL(),
  );
  await canvas.hover();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width * 0.4,
    bounds.y + bounds.height * 0.4,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.6,
    bounds.y + bounds.height * 0.5,
    { steps: 5 },
  );
  await page.mouse.up();
  if (!isMobile) await page.mouse.wheel(0, 5000);
  await page.waitForTimeout(150);
  expect(
    (await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL())) ===
      before,
  ).toBe(false);
  await expect(
    page.getByRole("switch", { name: "Follow agent camera", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "↺ Reset view" }).click();
  await expect(
    page.getByLabel("Follow agent camera", { exact: true }),
  ).not.toBeChecked();
  await expect(slider).toHaveValue("20");
});

test("free-view zoom reaches finite minimum and maximum distances", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Mobile WebKit does not implement mouse wheel input");
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await page
    .getByRole("switch", { name: "Follow agent camera", exact: true })
    .uncheck();
  await canvas.hover();
  for (const delta of [-100000, 100000]) {
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(350);
    const bound = await canvas.evaluate((el: HTMLCanvasElement) =>
      el.toDataURL(),
    );
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(350);
    expect(
      (await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL())) ===
        bound,
    ).toBe(true);
  }
  await expect(
    page.getByRole("slider", { name: "Trajectory step 1" }),
  ).toHaveValue("0");
});

test("research page omits internal provenance and remains readable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".provenance")).toHaveCount(0);
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(
    /provenance|SHA-256|checksum|assembly-evaluation|global rigid alignment|source-balanced/i,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Next step 1", exact: true }).click();
  await page.locator(".call-details summary").click();
  await expect(page.locator(".call-details pre")).toBeVisible();
  await expect(page.locator(".call-details small")).toHaveCount(0);
});

test("single top viewer, successful horizontal selector and five dataset result tabs", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#assembly-viewer canvas")).toBeVisible();
  await expect(page.locator(".case-card")).toHaveCount(12);
  await expect(page.locator(".case-card.partial")).toHaveCount(0);
  expect(
    await page
      .locator(".cards")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBe(true);
  await expect(page.locator(".result-tabs [aria-selected=true]")).toHaveText(
    "AssemblyWorldBench",
  );
  await expect(page.locator("#paper-table")).toContainText("59.40");
  for (const [dataset, value] of [
    ["PartNet", "76.45"],
    ["IKEA-Manual", "93.27"],
    ["AssemblyBench", "78.32"],
    ["Fantastic Breaks", "91.67"],
  ]) {
    await page
      .locator(".result-tabs")
      .getByRole("tab", { name: String(dataset), exact: true })
      .click();
    await expect(page.locator("#paper-table")).toContainText(String(value));
  }
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("camera switches default on and orientation compass selects a free axis view", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Show agent camera", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Follow agent camera", exact: true }),
  ).toBeChecked();
  await expect(page.locator(".axis-legend")).toHaveCount(0);
  const z = page.getByRole("button", { name: "View from +Z", exact: true });
  await z.click();
  await expect(
    page.getByRole("switch", { name: "Follow agent camera", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("slider", { name: "Trajectory step 1" }),
  ).toHaveValue("0");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(
    page.locator('.hero-actions a[href$="AssemblyWorldBench"]'),
  ).toHaveText("Benchmark ↗");
  await expect(
    page.locator(
      '.nav-code[href="https://github.com/AssemblyWorld/assembly-world-agent"]',
    ),
  ).toHaveCount(1);
});

test("concise hero and camera frame follow the active viewport", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".hero h2 br")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Explore in 3D ↓", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Research contributions" }),
  ).toHaveCount(0);
  await expect(page.locator(".gallery-toolbar")).toContainText("12 assemblies");
  await expect(page.locator(".citation pre")).toContainText(
    "journal = {arXiv preprint arXiv:YYMM.NNNNN}",
  );
  await expect(page.locator(".citation pre")).toContainText(
    "url = {https://assemblyworld.github.io/}",
  );
  await expect(page.locator(".camera-frame")).toBeVisible();
  const frame = (await page.locator(".camera-frame").boundingBox())!;
  expect(frame.width / frame.height).toBeCloseTo(4 / 3, 2);
  await page
    .getByRole("switch", { name: "Follow agent camera", exact: true })
    .uncheck();
  await expect(page.locator(".camera-frame")).toBeHidden();
  await page.locator(".paper-pending").first().focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
});

test("Code is a pending agent-repository button and a click keeps camera follow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").click({ position: { x: 180, y: 150 } });
  await expect(
    page.getByRole("switch", { name: "Follow agent camera", exact: true }),
  ).toBeChecked();
  const code = page.getByRole("button", { name: "Code", exact: true });
  await expect(code).toHaveAttribute("aria-disabled", "true");
  await expect(code).toHaveAttribute(
    "data-repository",
    "https://github.com/AssemblyWorld/assembly-world-agent",
  );
  await code.focus();
  await expect(page.locator("#code-coming")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Environment code ↗", exact: true }),
  ).toHaveCount(0);
});

test("touch dragging exits camera follow", async ({
  page,
  browserName,
}, info) => {
  test.skip(
    browserName !== "chromium" || info.project.name !== "chrome",
    "Native touch dispatch uses Chrome CDP",
  );
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const box = (await page.locator("canvas").boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width * 0.45,
    y = box.y + box.height * 0.45;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 5; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + i * 15, y: y + i * 4 }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(
    page.getByRole("switch", { name: "Follow agent camera", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("slider", { name: "Trajectory step 1" }),
  ).toHaveValue("0");
  await cdp.detach();
});
