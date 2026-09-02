export interface BinaryJsonValue {
  $binary: string;
  encoding: "base64";
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | BinaryJsonValue
  | JsonValue[]
  | { [key: string]: JsonValue };

export function normalizeJson(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "bigint") {
    return value.toString(10);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (isBinary(value)) {
    return { $binary: binaryToBuffer(value).toString("base64"), encoding: "base64" };
  }
  if (Array.isArray(value)) {
    return value.map(normalizeJson);
  }
  if (typeof value === "object") {
    const normalized: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      normalized[key] = normalizeJson(item);
    }
    return normalized;
  }
  return String(value);
}

function isBinary(value: unknown): value is ArrayBuffer | ArrayBufferView {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function binaryToBuffer(value: ArrayBuffer | ArrayBufferView): Buffer {
  if (value instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(value));
  }
  return Buffer.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
}
