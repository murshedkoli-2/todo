import mongoose from "mongoose";
import { isDnsFailure, resolveSrvUri } from "@/lib/mongoSrv";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Missing environment variable: "MONGODB_URI". ' +
      "Set it in .env.local (development) or in your hosting provider's environment variables."
  );
}

/** Cached across hot reloads in dev and across invocations in serverless. */
interface MongooseCache {
  conn: mongoose.Connection | null;
  promise: Promise<mongoose.Connection> | null;
  /** Seedlist URI derived after an SRV lookup failure, reused on reconnect. */
  resolvedUri: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache =
  global.__mongooseCache ?? { conn: null, promise: null, resolvedUri: null };
global.__mongooseCache = cached;

const MONGOOSE_OPTIONS: mongoose.ConnectOptions = {
  bufferCommands: false, // Fail fast rather than queueing while disconnected
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  // Retryable writes need a replica set; Atlas has one, and it makes the
  // transactional balance updates in `withTransaction` resilient to failover.
  retryWrites: true,
};

/**
 * Connects, falling back to a manual SRV lookup when the driver's own DNS
 * resolution fails.
 *
 * `mongodb+srv://` needs SRV and TXT records that some networks and serverless
 * runtimes cannot resolve, producing `querySrv ECONNREFUSED` even though plain
 * A-record lookups work. Rather than patching Node's global resolver — the
 * previous workaround, which changed DNS for every outbound request in the
 * process — the lookup is redone through a dedicated resolver and the URI is
 * rebuilt as a seedlist. See `mongoSrv.ts`.
 */
async function connect(): Promise<mongoose.Connection> {
  const uri = cached.resolvedUri ?? MONGODB_URI!;

  try {
    const instance = await mongoose.connect(uri, MONGOOSE_OPTIONS);
    return instance.connection;
  } catch (error) {
    const canRetry =
      !cached.resolvedUri && uri.startsWith("mongodb+srv://") && isDnsFailure(error);
    if (!canRetry) throw error;

    console.warn(
      "SRV lookup for MONGODB_URI failed; retrying with a manually resolved " +
        "seedlist. Configure the non-SRV connection string to avoid this."
    );

    const seedlistUri = await resolveSrvUri(MONGODB_URI!);
    // Cached so later reconnects skip the failing lookup entirely.
    cached.resolvedUri = seedlistUri;

    const instance = await mongoose.connect(seedlistUri, MONGOOSE_OPTIONS);
    return instance.connection;
  }
}

async function dbConnect(): Promise<mongoose.Connection> {
  if (cached.conn && cached.conn.readyState === 1) return cached.conn;

  // Drop a stale handle so the next call reconnects rather than using a socket
  // the driver has already given up on.
  if (cached.conn && cached.conn.readyState !== 1) {
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) cached.promise = connect();

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null; // Allow a retry on the next request
    throw error;
  }

  return cached.conn;
}

export default dbConnect;
