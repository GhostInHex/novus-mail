import { spawnSync } from "node:child_process";
const suites = [
  ["scripts/verify-doop-sources.mjs"],
  ["--import", "tsx", "scripts/verify-panels.mjs"],
  ["scripts/verify-landing.mjs"],
  ["scripts/verify-workspace.mjs"],
  ["scripts/verify-dashboard-design.mjs"],
  ["scripts/verify-ui-recovery.mjs"],
  ["scripts/write-doop-report.mjs"],
];
for (const args of suites) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
