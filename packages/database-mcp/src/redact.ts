const CREDENTIAL_URL_PATTERN = /([a-z][a-z0-9+.-]*:\/\/)([^\s/@]+(?::[^\s/@]*)?@)/gi;

export function redactSecrets(message: string, secrets: string[] = []): string {
  let redacted = message;
  for (const secret of [...secrets].sort((left, right) => right.length - left.length)) {
    if (secret.length > 0) {
      redacted = redacted.replaceAll(secret, "[REDACTED]");
    }
  }
  return redacted.replace(CREDENTIAL_URL_PATTERN, "$1[REDACTED]@");
}

export function safeErrorMessage(error: unknown, secrets: string[] = []): string {
  const message = extractErrorMessage(error);
  return redactSecrets(message, secrets);
}

function extractErrorMessage(error: unknown, seen = new Set<unknown>()): string {
  if (error === null || error === undefined) {
    return "Unknown error";
  }
  if (typeof error !== "object") {
    const message = String(error).trim();
    return message.length > 0 ? message : "Unknown error";
  }
  if (seen.has(error)) {
    return "Unknown error";
  }
  seen.add(error);

  const errorLike = error as {
    cause?: unknown;
    code?: unknown;
    errors?: unknown;
    message?: unknown;
    name?: unknown;
  };
  const message = typeof errorLike.message === "string" ? errorLike.message.trim() : "";
  if (message.length > 0) {
    return message;
  }

  if (Array.isArray(errorLike.errors)) {
    const messages = errorLike.errors
      .map((nestedError) => extractErrorMessage(nestedError, seen))
      .filter((nestedMessage) => nestedMessage !== "Unknown error");
    if (messages.length > 0) {
      return [...new Set(messages)].join("; ");
    }
  }

  if (errorLike.cause !== undefined) {
    const cause = extractErrorMessage(errorLike.cause, seen);
    if (cause !== "Unknown error") {
      return cause;
    }
  }

  const name =
    typeof errorLike.name === "string" && errorLike.name.trim().length > 0
      ? errorLike.name.trim()
      : "Error";
  const code =
    typeof errorLike.code === "string" && errorLike.code.trim().length > 0
      ? ` (${errorLike.code.trim()})`
      : "";
  return `${name}${code}`;
}

export function secretsFromDsn(dsn: string): string[] {
  const secrets = [dsn];
  try {
    const url = new URL(dsn);
    if (url.username.length > 0) {
      secrets.push(decodeURIComponent(url.username));
    }
    if (url.password.length > 0) {
      secrets.push(decodeURIComponent(url.password));
    }
  } catch {
    // The full malformed value is still redacted.
  }
  return secrets;
}
