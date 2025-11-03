// check-updates.mjs
import fs from "fs";
import path from "path";
import { ProxyAgent } from "undici";

const proxyUrl = process.env.HTTP_PROXY || "http://127.0.0.1:10808";
const agent = new ProxyAgent(proxyUrl);

const files = {
  "dark_modern.json":
    "https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-defaults/themes/dark_modern.json",
  "dark_plus.json":
    "https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-defaults/themes/dark_plus.json",
  "dark_vs.json":
    "https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-defaults/themes/dark_vs.json"
};

const stateFile = "./etag-state.json";
let state = {};
if (fs.existsSync(stateFile)) {
  state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
}

async function checkAndDownload(name, url) {
  const res = await fetch(url, { method: "HEAD", dispatcher: agent });
  if (!res.ok) {
    console.error(`❌ Failed to fetch headers for ${url}: ${res.status}`);
    return false;
  }

  const etag = res.headers.get("etag");
  const lastModified = res.headers.get("last-modified");
  const prev = state[url];
  const current = { etag, lastModified };

  let updated = false;
  if (!prev) {
    console.log(`📥 First time tracking ${name}`);
    updated = true;
  } else if (
    (etag && prev.etag !== etag) ||
    (lastModified && prev.lastModified !== lastModified)
  ) {
    console.log(`🔄 File updated: ${name}`);
    updated = true;
  } else {
    console.log(`✅ No change: ${name}`);
  }

  if (updated) {
    const fileRes = await fetch(url, { dispatcher: agent });
    if (!fileRes.ok) {
      console.error(`❌ Failed to download ${url}: ${fileRes.status}`);
    } else {
      const text = await fileRes.text();
      const themesDir = path.join(process.cwd(), "themes");
      if (!fs.existsSync(themesDir)) {
        fs.mkdirSync(themesDir);
      }
      fs.writeFileSync(path.join(themesDir, name), text, "utf-8");
      console.log(`📂 Saved latest ${name} to themes/`);
    }
  }

  state[url] = current;
  return updated;
}

async function main() {
  let anyUpdated = false;
  for (const [name, url] of Object.entries(files)) {
    const updated = await checkAndDownload(name, url);
    if (updated) anyUpdated = true;
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

  if (anyUpdated) {
    console.log("\n⚡ Some theme files were updated. Please re-run:");
    console.log("   npx @vscode/vsce package");
  } else {
    console.log("\n✨ All theme files are up to date.");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
