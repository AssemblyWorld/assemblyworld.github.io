import { test, expect } from "@playwright/test";
test("scene playback, part selection, reference and independent agent timelines", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
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
  await expect(page.locator(".case-card")).toHaveCount(3);
  await page.locator(".case-card").nth(1).click();
  await expect(page.locator("#try-case")).toHaveValue("assemblybench-1386");
  await expect(page.locator("#gallery-viewer canvas")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(
    await page.locator("#gallery").evaluate((el) => el.nextElementSibling?.id),
  ).toBe("try");
  await expect(page.locator(".prompt-panel pre")).toContainText(
    "assemblybench-1386",
  );
  await expect(
    page.getByRole("link", { name: "Open scene ↗", exact: true }),
  ).toHaveAttribute("href", /3DWebAgent\/\?episode=.*initial\.episode\.zip/);
  await page.locator("#try-case").selectOption("assemblybench-4492");
  await expect(page.locator(".case-card.active")).toContainText("4492");
  await expect(page.locator("#gallery-viewer canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("deep link, terms and citation remain accessible", async ({ page }) => {
  await page.goto("/?case=assemblybench-4492");
  await expect(page.locator("#try-case")).toHaveValue("assemblybench-4492");
  await expect(page.locator(".citation pre")).toContainText(
    "@misc{zhang2026assemblyworld",
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
test("all local examples load and expose their complete recorded timeline", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "chrome" || !!process.env.SITE_URL,
    "Local full catalog smoke test",
  );
  const catalog = await (await page.request.get("/catalog.local.json")).json();
  expect(catalog.cases).toHaveLength(12);
  for (const c of catalog.cases) {
    await page.goto(`/?preview=local&case=${c.id}`);
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
