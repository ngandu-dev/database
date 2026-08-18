import { SerializationFailed } from "./exception/serialization-failed";
import { ValueNotConvertible } from "./exception/value-not-convertible";

export function convertJsonToDatabaseValue(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown serialization error";
    throw SerializationFailed.new(value, "json", message, error);
  }
}

export function convertJsonToNodeValue(value: unknown): unknown {
  if (value === null || value === "") {
    return null;
  }

  if (Buffer.isBuffer(value)) {
    return parseJson(value.toString("utf8"), value);
  }

  if (value instanceof Uint8Array) {
    return parseJson(Buffer.from(value).toString("utf8"), value);
  }

  if (Array.isArray(value) || isPlainObject(value)) {
    return value;
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return parseJson(value, value);
  }

  try {
    return parseJson(String(value), value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown parsing error";
    throw ValueNotConvertible.new(value, "json", message, error);
  }
}

function parseJson(raw: string, originalValue: unknown): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown parsing error";
    throw ValueNotConvertible.new(originalValue, "json", message, error);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
