/**
 * Tiny dependency-free JSON-line logger.
 *
 * One JSON object per line keeps logs greppable and ingestible by Vercel /
 * Datadog / Loki without a logging SDK. Errors are expanded to name + message
 * (+ stack outside production) so server-side failures are diagnosable while we
 * never leak internals to clients.
 */

type Level = "debug" | "info" | "warn" | "error";

type Fields = Record<string, unknown>;

const isProduction = process.env.NODE_ENV === "production";

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(isProduction ? {} : { stack: value.stack }),
    };
  }
  return value;
}

function emit(level: Level, message: string, fields?: Fields) {
  const entry: Fields = {
    level,
    time: new Date().toISOString(),
    msg: message,
  };

  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      entry[key] = serialize(value);
    }
  }

  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    line = JSON.stringify({ level, time: entry.time, msg: message, note: "unserializable fields" });
  }

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  debug: (message: string, fields?: Fields) => emit("debug", message, fields),
  info: (message: string, fields?: Fields) => emit("info", message, fields),
  warn: (message: string, fields?: Fields) => emit("warn", message, fields),
  error: (message: string, fields?: Fields) => emit("error", message, fields),
};
