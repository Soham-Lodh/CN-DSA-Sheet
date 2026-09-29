/**
 * Repairs the institutional-domain gate that breaks Google sign-up with
 * "Database error saving new user":
 *   - creates public.allowed_email_domains if missing (SETUP.md section 3 SQL
 *     was only partially applied - the trigger exists but its table did not)
 *   - seeds it with the configured INSTITUTION_EMAIL_DOMAIN (default kiit.ac.in)
 *   - grants the Supabase auth role read access
 *   - verifies with the same rolled-back probe insert used by diagnose-auth.ts
 * Idempotent: safe to run repeatedly.
 * Run: npx tsx scripts/fix-auth-trigger.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

function loadEnvFile() {
  try {
    const raw = readFileSync(".env", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    console.error("Could not read .env - run from the project root.");
  }
}
loadEnvFile();

// Transaction pooler (6543) - stable, unlike the direct endpoint.
const baseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || "";
const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        baseUrl +
        (/[?&]connection_limit=/.test(baseUrl)
          ? ""
          : baseUrl.includes("?")
            ? "&connection_limit=1"
            : "?connection_limit=1"),
    },
  },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function gentle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (/Can't reach|CIRCUITBREAKER|P1001/i.test(msg)) {
      console.log("   ... pooler hiccup, waiting 20s and retrying once");
      await sleep(20_000);
      return fn();
    }
    throw e;
  }
}

const domain = (process.env.INSTITUTION_EMAIL_DOMAIN || "kiit.ac.in").toLowerCase();

async function main() {
  console.log(`Repairing domain allowlist for "${domain}"...\n`);

  console.log("1. Creating table if missing + granting auth-role read access...");
  await gentle(() =>
    prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.allowed_email_domains (
          domain TEXT PRIMARY KEY,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `)
  );
  await gentle(() =>
    prisma.$executeRawUnsafe(`
      GRANT SELECT ON public.allowed_email_domains TO supabase_auth_admin, service_role;
    `)
  );
  console.log("   done.");

  console.log("2. Seeding allowed domain(s)...");
  await gentle(() =>
    prisma.$executeRawUnsafe(
      `INSERT INTO public.allowed_email_domains (domain) VALUES ('${domain}')
       ON CONFLICT (domain) DO NOTHING`
    )
  );
  const rows = await gentle(() =>
    prisma.$queryRawUnsafe<{ domain: string }[]>(
      `SELECT domain FROM public.allowed_email_domains ORDER BY domain`
    )
  );
  console.log("   allowlist now contains:", JSON.stringify(rows.map((r) => r.domain)));

  console.log("3. Verifying with a rolled-back probe INSERT into auth.users...");
  let probeError: any = null;
  let probeOk = false;
  try {
    await gentle(() =>
      prisma.$transaction(async (tx) => {
        try {
          await tx.$executeRawUnsafe(`
            INSERT INTO auth.users
              (id, aud, role, email, encrypted_password, email_confirmed_at,
               created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
            VALUES
              (gen_random_uuid(), 'authenticated', 'authenticated',
               'oauth-probe-${Date.now()}@${domain}', '', now(), now(), now(),
               '{"provider":"google","providers":["google"]}'::jsonb, '{}'::jsonb)
          `);
          probeOk = true;
        } catch (e: any) {
          probeError = e;
        }
        // Always roll back - the probe must leave zero rows behind.
        throw new Error("__ROLLBACK_PROBE__");
      })
    );
  } catch {
    /* expected: our own rollback marker */
  }
  if (probeOk) {
    console.log("   PROBE OK - auth.users insert now passes the trigger. Sign-up is unblocked!");
    console.log("   (The transaction was rolled back; nothing was written.)");
  } else {
    console.log("   PROBE STILL FAILING:");
    console.log("   " + String(probeError?.message || probeError).slice(0, 600));
  }
}

main()
  .catch((e) => {
    console.error("Repair failed:", String(e?.message || e).slice(0, 400));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
