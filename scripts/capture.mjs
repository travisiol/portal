// Headless Chrome + SwiftShader renders the WebGL scenes without a GPU.
// Usage: node scripts/capture.mjs [baseUrl] [outDir]
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3459";
const out = process.argv[3] ?? path.resolve("captures");
mkdirSync(out, { recursive: true });
const chrome = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const shots = [
  ["home-1440", `${base}/`, 1440, 1600],
  ["bridge-1440", `${base}/bridge`, 1440, 1300],
  ["routes-1440", `${base}/routes`, 1440, 1400],
  ["network-1440", `${base}/network`, 1440, 1000],
  ["token-1440", `${base}/token`, 1440, 1100],
  ["dashboard-1440", `${base}/dashboard`, 1440, 1200],
  ["portal-idle", `${base}/dev/portal?phase=idle`, 1300, 820],
  ["portal-building", `${base}/dev/portal?phase=building`, 1300, 820],
  ["portal-open", `${base}/dev/portal?crossing=0.3`, 1300, 820],
  ["portal-through", `${base}/dev/portal?crossing=0.53`, 1300, 820],
  ["portal-arrived", `${base}/dev/portal?crossing=0.95`, 1300, 820],
  ["portal-usdc", `${base}/dev/portal?crossing=0.25&glyph=usdc&source=base`, 1300, 820],
];

for (const [name, url, w, h] of shots) {
  const file = path.join(out, `${name}.png`);
  execFileSync(chrome, [
    "--headless=new",
    "--no-first-run",
    `--user-data-dir=${path.join(process.env.TMP ?? out, "portal-shot")}`,
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--hide-scrollbars",
    `--window-size=${w},${h}`,
    "--virtual-time-budget=30000",
    `--screenshot=${file}`,
    url,
  ], { stdio: "ignore", timeout: 120_000 });
  console.log("captured", file);
}
