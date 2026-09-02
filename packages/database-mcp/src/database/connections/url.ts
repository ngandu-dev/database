export function readDsnScheme(dsn: string): string {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(dsn.trim());
  if (match?.[1] === undefined) {
    throw new Error("The database URL must include a supported scheme.");
  }
  return match[1].toLowerCase();
}

export function normalizeNetworkScheme(dsn: string, scheme: string): string {
  return dsn.replace(/^([a-z][a-z0-9+.-]*):/i, `${scheme}:`);
}

export function parseDatabaseUrl(dsn: string): URL {
  try {
    return new URL(dsn);
  } catch {
    throw new Error("The database URL is malformed.");
  }
}

export function decodeDatabasePath(pathname: string): string {
  return decodeURIComponent(pathname.replace(/^\//, ""));
}
