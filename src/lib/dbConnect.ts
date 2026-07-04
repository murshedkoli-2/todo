import "@/lib/dnsPatch";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Missing environment variable: "MONGODB_URI". ' +
    'Please set it in .env.local (development) or in your hosting provider environment variables (production).'
  );
}

/** Cached connection — reused across hot-reloads in dev and across requests in serverless. */
interface MongooseCache {
  conn: mongoose.Connection | null;
  promise: Promise<mongoose.Connection> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.__mongooseCache ?? { conn: null, promise: null };
global.__mongooseCache = cached;

const MONGOOSE_OPTIONS: mongoose.ConnectOptions = {
  bufferCommands: false,          // Fail fast — don't queue commands when disconnected
  maxPoolSize: 10,                // Connection pool — good for serverless
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
};

async function dbConnect(): Promise<mongoose.Connection> {
  // Return cached connection if healthy
  if (cached.conn && cached.conn.readyState === 1) {
    return cached.conn;
  }

  // Reset stale connection
  if (cached.conn && cached.conn.readyState !== 1) {
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI!, MONGOOSE_OPTIONS)
      .then((m) => m.connection);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // Allow retry on next request
    throw err;
  }

  return cached.conn;
}

export default dbConnect;
