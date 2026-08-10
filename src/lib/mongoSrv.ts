import { Resolver } from "dns/promises";

/**
 * Resolves a `mongodb+srv://` URI into a plain seedlist URI.
 *
 * Some networks and serverless runtimes cannot resolve the SRV and TXT records
 * Atlas relies on, which makes `mongodb+srv://` fail with `querySrv
 * ECONNREFUSED` while ordinary A-record lookups work fine.
 *
 * The previous workaround for this replaced Node's global DNS resolver with
 * 8.8.8.8 for the entire process — that changed name resolution for every
 * outbound request the app makes, not just Mongo, and swallowed its own
 * failures in empty catch blocks.
 *
 * This does the same lookup through a **dedicated** resolver instance, so
 * nothing outside this module is affected, and only when the driver's own
 * attempt has already failed. The permanent fix is still to configure a
 * non-SRV connection string; this keeps the app running until then.
 */

/** Public resolvers used only for the Mongo SRV/TXT lookup. Overridable. */
const FALLBACK_DNS_SERVERS = (process.env.MONGODB_DNS_SERVERS ?? "1.1.1.1,8.8.8.8")
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);

const DNS_FAILURE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEOUT",
  "ESERVFAIL",
  "EREFUSED",
]);

/** True when an error is a DNS resolution failure rather than a Mongo error. */
export function isDnsFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, syscall } = error as { code?: string; syscall?: string };
  if (code && DNS_FAILURE_CODES.has(code)) return true;
  return syscall === "querySrv" || syscall === "queryTxt";
}

/**
 * Performs the same two lookups the driver does for an SRV connection string
 * and rebuilds the URI from the results.
 */
export async function resolveSrvUri(srvUri: string): Promise<string> {
  const url = new URL(srvUri);
  const hostname = url.hostname;

  const resolver = new Resolver();
  resolver.setServers(FALLBACK_DNS_SERVERS);

  const [srvRecords, txtRecords] = await Promise.all([
    resolver.resolveSrv(`_mongodb._tcp.${hostname}`),
    // The TXT record carries connection options (replicaSet, authSource).
    // Its absence is legal, so a failure here is not fatal.
    resolver.resolveTxt(hostname).catch(() => [] as string[][]),
  ]);

  if (srvRecords.length === 0) {
    throw new Error(`No SRV records found for _mongodb._tcp.${hostname}`);
  }

  const seedlist = srvRecords
    .map((record) => `${record.name}:${record.port}`)
    .join(",");

  // TXT chunks are concatenated by the DNS spec before parsing.
  const txtOptions = new URLSearchParams(
    txtRecords.map((chunks) => chunks.join("")).join("&")
  );

  // SRV URIs imply TLS; a rebuilt plain URI has to say so explicitly.
  const options = new URLSearchParams(url.search);
  for (const [key, value] of txtOptions) {
    if (!options.has(key)) options.set(key, value);
  }
  if (!options.has("ssl") && !options.has("tls")) options.set("tls", "true");
  if (!options.has("authSource")) options.set("authSource", "admin");

  const credentials = url.username
    ? `${url.username}${url.password ? `:${url.password}` : ""}@`
    : "";
  const database = url.pathname && url.pathname !== "/" ? url.pathname : "";

  return `mongodb://${credentials}${seedlist}${database}?${options.toString()}`;
}
