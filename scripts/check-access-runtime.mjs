import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";

await mkdir(".local", { recursive: true });
const output = await mkdtemp(path.resolve(".local/access-runtime-"));
try {
  const result = spawnSync(process.execPath, [
    "node_modules/typescript/bin/tsc", "--module", "NodeNext",
    "--moduleResolution", "NodeNext", "--target", "ES2022", "--skipLibCheck",
    "--outDir", output, "proxy.ts", "access/config.ts", "access/guard.ts",
  ], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("Access runtime compilation failed");
  const { default: proxy } = await import(pathToFileURL(path.join(output, "proxy.js")));
  const response = await proxy(new Request("https://augurwell.anoriaquant.dev/"));
  if (response.status !== 403) throw new Error("Anonymous request must fail closed");
  console.log("PASS: compiled Node ESM entrypoint loads and denies anonymous access");
} finally {
  await rm(output, { recursive: true, force: true });
}
