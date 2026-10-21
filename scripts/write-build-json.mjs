// Writes public/build.json = { sha } so the admin can tell when a publish is live.
// In GitHub Actions GITHUB_SHA is the pushed commit; locally it's "local".
import { writeFileSync } from "node:fs";

const sha = process.env.GITHUB_SHA || "local";
writeFileSync(new URL("../public/build.json", import.meta.url), JSON.stringify({ sha }) + "\n");
console.log(`[build.json] sha=${sha}`);
