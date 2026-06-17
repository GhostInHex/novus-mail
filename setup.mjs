/**
 * Corsair agent-setup provisioning script.
 *
 * Follows the @corsair-dev/app provisioning + tenant flow end-to-end:
 *   1. Create (or reuse) a Corsair instance
 *   2. Install plugins with managed OAuth
 *   3. Create (or reuse) a "dev" tenant
 *   4. Create an MCP API key for the tenant
 *   5. Print the MCP URL + secret and write them to .env
 */

import { createClient, claudeMcpServerConfig } from "@corsair-dev/app";
import { readFileSync, writeFileSync, existsSync } from "fs";

// ── load .env manually (no dotenv dep) ────────────────────────────────────────
function loadEnv(path = ".env") {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const [key, ...rest] = line.trim().split("=");
    if (key && !key.startsWith("#")) out[key] = rest.join("=");
  }
  return out;
}

function appendOrReplaceEnv(path, vars) {
  let content = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const [key, value] of Object.entries(vars)) {
    const re = new RegExp(`^${key}=.*$`, "m");
    const line = `${key}=${value}`;
    if (re.test(content)) {
      content = content.replace(re, line);
    } else {
      content += (content.endsWith("\n") ? "" : "\n") + line + "\n";
    }
  }
  writeFileSync(path, content);
}

// ── main ──────────────────────────────────────────────────────────────────────
const env = loadEnv(".env");
const apiKey = env.CORSAIR_DEV_KEY;
if (!apiKey) throw new Error("CORSAIR_DEV_KEY not found in .env");

const corsair = createClient({ apiKey });

const INSTANCE_NAME = "corsair-hackathon";
const TENANT_ID = "dev";
const MCP_KEY_NAME = "hackathon";

// ── 1. Find or create instance ─────────────────────────────────────────────
console.log("→ Looking up instances…");
const { instances } = await corsair.instances.list();
let instance = instances.find((i) => i.name === INSTANCE_NAME);

if (instance) {
  console.log(`  ✓ Reusing existing instance: ${instance.id} (${instance.name})`);
} else {
  console.log(`  + Creating instance "${INSTANCE_NAME}"…`);
  instance = await corsair.instances.create({ name: INSTANCE_NAME });
  console.log(`  ✓ Created: ${instance.id}`);
}

const inst = corsair.instance(instance.id);

// ── 2. Install plugins with managed OAuth ──────────────────────────────────
const PLUGINS = [
  { id: "github", opts: { authType: "oauth_2", useManaged: true, mode: "cautious" } },
  { id: "slack",  opts: { authType: "oauth_2", useManaged: true, mode: "cautious" } },
  { id: "linear", opts: { authType: "oauth_2", useManaged: true, mode: "cautious" } },
  { id: "notion", opts: { authType: "oauth_2", useManaged: true, mode: "cautious" } },
];

console.log("\n→ Installing plugins…");
for (const { id, opts } of PLUGINS) {
  const result = await inst.plugins.upsert(id, opts);
  const status = result.created ? "installed" : "already installed";
  console.log(`  ✓ ${id}: ${status}`);
}

// ── 3. Create or reuse tenant ──────────────────────────────────────────────
console.log("\n→ Provisioning tenant…");
let tenantId;
try {
  const existing = await inst.tenant(TENANT_ID).get();
  tenantId = existing.id;
  console.log(`  ✓ Reusing existing tenant: ${tenantId}`);
} catch {
  const t = await inst.tenants.create(TENANT_ID);
  tenantId = t.id;
  console.log(`  + Created tenant: ${tenantId}`);
}

const tenant = inst.tenant(tenantId);

// ── 4. Create MCP key ──────────────────────────────────────────────────────
console.log("\n→ Creating MCP API key…");
const key = await tenant.mcpKeys.create(MCP_KEY_NAME);
console.log(`  ✓ MCP key created: ${key.keyPrefix}…`);
console.log(`  ✓ MCP URL: ${key.mcpHttpUrl}`);

// ── 5. Get connect link so the user can authenticate plugins ──────────────
console.log("\n→ Creating connect link for plugin auth…");
const link = await tenant.connectLink.create();
console.log(`  ✓ Connect link: ${link.url}`);

// ── 6. Build Claude MCP config ─────────────────────────────────────────────
const mcpConfig = claudeMcpServerConfig({ url: key.mcpHttpUrl, apiKey: key.secret });

// ── 7. Persist to .env ─────────────────────────────────────────────────────
appendOrReplaceEnv(".env", {
  CORSAIR_INSTANCE_ID: instance.id,
  CORSAIR_TENANT_ID: tenantId,
  CORSAIR_MCP_URL: key.mcpHttpUrl,
  CORSAIR_MCP_KEY: key.secret,
  CORSAIR_CONNECT_LINK: link.url,
});
console.log("\n→ Saved to .env: CORSAIR_INSTANCE_ID, CORSAIR_TENANT_ID, CORSAIR_MCP_URL, CORSAIR_MCP_KEY, CORSAIR_CONNECT_LINK");

// ── 8. Print Claude Code MCP config snippet ────────────────────────────────
console.log("\n─────────────────────────────────────────────────────────────────");
console.log("Claude Code MCP config (add to ~/.claude/settings.json or .claude/settings.json):");
console.log(JSON.stringify({
  mcpServers: {
    corsair: mcpConfig,
  }
}, null, 2));

console.log("\n─────────────────────────────────────────────────────────────────");
console.log("Agent SDK usage:");
console.log(`
  import { claudeMcpServerConfig } from "@corsair-dev/app";

  const corsairMcp = {
    url: "${key.mcpHttpUrl}",
    apiKey: process.env.CORSAIR_MCP_KEY,
  };

  // Claude Agents SDK
  const stream = query({
    prompt: "...",
    options: {
      mcpServers: { corsair: claudeMcpServerConfig(corsairMcp) },
    },
  });
`);

console.log("─────────────────────────────────────────────────────────────────");
console.log("\n✅ NEXT STEP: Visit the connect link above to authenticate plugins.");
console.log(`   ${link.url}\n`);
