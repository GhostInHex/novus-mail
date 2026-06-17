import { createClient } from "@corsair-dev/app";
const corsair = createClient({ apiKey: process.env.CORSAIR_DEV_KEY });
try {
  const { instances } = await corsair.instances.list();
  console.log("INSTANCE_COUNT:", instances?.length ?? 0);
  for (const i of instances ?? []) {
    console.log(JSON.stringify({ id: i.id, name: i.name }));
    try {
      const inst = corsair.instance(i.id);
      const { plugins } = await inst.plugins.list();
      console.log("  plugins:", (plugins ?? []).map(p => p.id ?? p.pluginId ?? JSON.stringify(p)).join(", ") || "(none)");
      const { tenants } = await inst.tenants.list();
      console.log("  tenants:", (tenants ?? []).map(t => t.id).join(", ") || "(none)");
    } catch (e) { console.log("  detail error:", e.message); }
  }
} catch (e) {
  console.log("LIST_ERROR:", e.message);
}
