#!/usr/bin/env node
/**
 * Backfills integer minor-unit columns from the legacy float columns.
 *
 *   node scripts/migrate-money.mjs [--dry-run]
 *
 * Idempotent: every update is filtered to documents that do not already have
 * the minor-unit field, so re-running is a no-op. Safe to run while the app is
 * serving traffic — reads fall back to the legacy column until a document is
 * converted (see `readMinor` in `src/lib/money.ts`).
 *
 * The legacy columns are left in place. Drop them with `--drop-legacy` only
 * after verifying the converted values, since that step is not reversible.
 */

import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Minimal .env.local reader — avoids a dotenv dependency for one script. */
function loadEnvFile(filename) {
  try {
    const contents = readFileSync(resolve(process.cwd(), filename), "utf8");
    for (const line of contents.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match) continue;
      const [, key, rawValue = ""] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2").trim();
    }
  } catch {
    /* No env file — rely on the ambient environment. */
  }
}

loadEnvFile(".env.local");

const DRY_RUN = process.argv.includes("--dry-run");
const DROP_LEGACY = process.argv.includes("--drop-legacy");

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Add it to .env.local or the environment.");
  process.exit(1);
}

/**
 * Each entry converts one float column into its integer minor-unit twin.
 * `$round` after `$multiply` matters: 2.99 * 100 is 298.99999999999994.
 */
const CONVERSIONS = [
  { collection: "todos", from: "paymentAmount", to: "paymentAmountMinor" },
  { collection: "ledgerentries", from: "amount", to: "amountMinor" },
  { collection: "wallets", from: "balance", to: "balanceMinor" },
  { collection: "wallettxes", from: "amount", to: "amountMinor" },
];

/** Collections whose documents predate the field entirely and need a default. */
const DEFAULTS = [{ collection: "wallets", field: "balanceMinor", value: 0 }];

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });
  await client.connect();
  const db = client.db();

  console.log(`Connected to ${db.databaseName}${DRY_RUN ? " (dry run)" : ""}\n`);

  for (const { collection, from, to } of CONVERSIONS) {
    const target = db.collection(collection);

    const filter = {
      [to]: { $exists: false },
      [from]: { $type: "number" },
    };
    const count = await target.countDocuments(filter);

    if (count === 0) {
      console.log(`  ${collection}.${from} → ${to}: nothing to convert`);
      continue;
    }

    if (DRY_RUN) {
      const sample = await target.find(filter).limit(3).toArray();
      console.log(`  ${collection}.${from} → ${to}: ${count} document(s) would convert`);
      for (const document of sample) {
        console.log(
          `      ${document._id}: ${document[from]} → ${Math.round(document[from] * 100)}`
        );
      }
      continue;
    }

    const result = await target.updateMany(filter, [
      { $set: { [to]: { $round: [{ $multiply: [`$${from}`, 100] }, 0] } } },
    ]);
    console.log(`  ${collection}.${from} → ${to}: converted ${result.modifiedCount}`);
  }

  for (const { collection, field, value } of DEFAULTS) {
    const target = db.collection(collection);
    const filter = { [field]: { $exists: false } };
    const count = await target.countDocuments(filter);
    if (count === 0) continue;

    if (DRY_RUN) {
      console.log(`  ${collection}.${field}: ${count} document(s) would default to ${value}`);
    } else {
      const result = await target.updateMany(filter, { $set: { [field]: value } });
      console.log(`  ${collection}.${field}: defaulted ${result.modifiedCount} to ${value}`);
    }
  }

  if (DROP_LEGACY) {
    if (DRY_RUN) {
      console.log("\n  --drop-legacy would unset the float columns (skipped in dry run)");
    } else {
      console.log("\nDropping legacy float columns…");
      for (const { collection, from } of CONVERSIONS) {
        const result = await db
          .collection(collection)
          .updateMany({ [from]: { $exists: true } }, { $unset: { [from]: "" } });
        console.log(`  ${collection}.${from}: removed from ${result.modifiedCount}`);
      }
      // `balanceAfter` snapshots are recomputed on read and no longer written.
      const stale = await db
        .collection("wallettxes")
        .updateMany({ balanceAfter: { $exists: true } }, { $unset: { balanceAfter: "" } });
      console.log(`  wallettxes.balanceAfter: removed from ${stale.modifiedCount}`);
    }
  }

  console.log("\nDone.");
  await client.close();
}

main().catch((error) => {
  console.error("\nMigration failed:", error);
  process.exit(1);
});
