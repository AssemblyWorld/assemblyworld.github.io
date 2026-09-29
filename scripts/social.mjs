import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
const logo =
  "data:image/svg+xml;base64," +
  (await fs.readFile("public/logo.svg")).toString("base64");
const preview =
  "data:image/png;base64," +
  (
    await fs.readFile("public/media/v1/assemblybench-7355/preview.png")
  ).toString("base64");
await page.setContent(
  `<html><style>*{box-sizing:border-box}body{margin:0;background:#fafbf8;font-family:Arial;color:#243530;width:1200px;height:630px;display:flex;align-items:center;padding:70px;gap:20px}.copy{width:650px;z-index:1}h1{font-size:67px;letter-spacing:-4px;margin:25px 0}h1 span{color:#536b4e}p{font-size:26px;line-height:1.4;color:#78847a}small{letter-spacing:3px;font-size:12px}.logo{width:40px}.preview{position:absolute;right:0;top:100px;width:520px;height:440px;object-fit:cover;mix-blend-mode:multiply}footer{font-size:17px;margin-top:45px;color:#536b4e}</style><div class="copy"><img class="logo" src="${logo}"><h1>Assembly<span>World</span></h1><p>Rethinking 3D Assembly<br>with General-Purpose Agents</p><small>EXPLORE REAL AGENT TRAJECTORIES IN 3D</small><footer>assemblyworld.github.io ↗</footer></div><img class="preview" src="${preview}"></html>`,
);
await page.screenshot({ path: "public/social.png" });
await browser.close();
