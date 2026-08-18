export function nameToString(value: unknown, unnamed = "<unnamed>"): string {
  if (value === null || value === undefined) {
    return unnamed;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    const candidate = value as { toString?: () => string };
    if (typeof candidate.toString === "function") {
      return candidate.toString();
    }
  }

  return String(value);
}

export function previousObjectNameToString(previous: unknown): string {
  if (typeof previous === "object" && previous !== null) {
    const candidate = previous as { getObjectName?: () => unknown };
    if (typeof candidate.getObjectName === "function") {
      return nameToString(candidate.getObjectName());
    }
  }

  return "<unknown>";
}

export function attachCause<T extends Error>(error: T, cause?: unknown): T {
  if (cause !== undefined) {
    Object.defineProperty(error, "cause", {
      configurable: true,
      enumerable: false,
      value: cause,
      writable: true,
    });
  }

  return error;
}
