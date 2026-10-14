import postgres from "postgres";
import { env } from "../config/env";
import { isPglite } from "../db/client";

function preflight(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    console.error("✗ DATABASE_URL is not a valid URL.");
    process.exit(1);
  }

  const problems: string[] = [];
  const warnings: string[] = [];

  if (url.password.includes("[") || url.password.toUpperCase().includes("YOUR-PASSWORD")) {
    problems.push("Password is still the literal placeholder. Replace [YOUR-PASSWORD].");
  }
  if (url.port === "6543") {
    warnings.push(
      "Port 6543 is the transaction pooler; postgres.js uses prepared statements. Use session pooler 5432.",
    );
  }
  if (!raw.includes("sslmode")) {
    warnings.push("No sslmode in URL. postgres.js leaves SSL off unless sslmode is set. Append ?sslmode=require");
  }
  if (url.hostname.endsWith(".supabase.co")) {
    warnings.push(
      "Direct Supabase host is IPv6-only and will not resolve from most hosts. Use the *.pooler.supabase.com session pooler.",
    );
  }

  console.log(`  host      ${url.hostname}:${url.port || 5432}`);
  console.log(`  database  ${url.pathname.replace("/", "")}`);
  console.log(`  user      ${url.username}`);
  console.log(`  password  ${"*".repeat(8)} (${url.password.length} chars, hidden)`);

  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  if (problems.length > 0) {
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
}

async function main() {
  const usingPglite = isPglite;

  console.log(`\nDATABASE_URL source: ${process.env.DATABASE_URL ? ".env.local / shell" : "not set — falling back to default"}`);
  console.log(`  driver     ${usingPglite ? "PGlite (local file database)" : "postgres (remote server)"}`);

  if (usingPglite) {
    console.error(
      "\n✗ Using PGlite (embedded file database), not a remote server.\n  Migrations would run against a local file, not Supabase.\n  Set DATABASE_URL to a postgresql:// URL, or set USE_PGLITE=true to stay local.",
    );
    process.exit(1);
  }

  console.log("\nPreflight:");
  preflight(env.DATABASE_URL);

  console.log("\nConnecting (timeout 15s)...");
  const sql = postgres(env.DATABASE_URL, { connect_timeout: 15, max: 1 });

  try {
    const [info] = await sql`SELECT current_database() AS db, current_user AS usr, version() AS ver`;
    console.log(`\n✅ Connected`);
    console.log(`  database  ${info.db}`);
    console.log(`  user      ${info.usr}`);
    console.log(`  server    ${info.ver.split(" ").slice(0, 2).join(" ")}`);

    const [tables] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'
    `;
    const [users] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM users
    `.catch(() => [{ n: -1 }]);

    console.log(`\n  tables    ${tables.n}`);
    console.log(`  users     ${users.n === -1 ? "table missing — run pnpm db:migrate" : users.n}`);

    if (tables.n === 0) {
      console.log("\n⚠ Database is empty. Next: pnpm db:migrate && pnpm db:seed");
    } else if (users.n > 0) {
      console.log("\n✅ Schema and seed data present. Login with admin / Admin@123");
    } else {
      console.log("\n⚠ Tables exist but no users. Next: pnpm db:seed");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n✗ Connection failed:\n  ${msg}`);
    if (msg.includes("password authentication failed")) {
      console.error("  → Password is wrong. Reset it in Supabase → Project Settings → Database.");
    } else if (msg.includes("ENOTFOUND") || msg.includes("getaddrinfo")) {
      console.error("  → Host does not resolve. Use the pooler host, not the direct db.*.supabase.co host.");
    } else if (msg.includes("ECONNREFUSED") || msg.includes("timeout")) {
      console.error("  → Port unreachable. Session pooler is 5432; check the region in the hostname.");
    } else if (msg.includes("SSL") || msg.includes("ssl")) {
      console.error("  → Append ?sslmode=require to the URL.");
    }
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();