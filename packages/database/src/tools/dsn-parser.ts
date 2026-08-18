import type { Driver } from "../driver";
import { MalformedDsnException } from "../exception/malformed-dsn-exception";

export type DsnSchemeMappingValue = string | (new () => Driver);
export type DsnSchemeMapping = Record<string, DsnSchemeMappingValue>;
export type DsnConnectionParams = Record<string, unknown>;

interface ParsedDsnUrl {
  host?: string;
  pass?: string;
  path?: string;
  port?: number;
  query?: string;
  scheme?: string;
  user?: string;
}

const DEFAULT_SCHEME_ALIASES: Record<string, string> = {
  pdo_pgsql: "pg",
  pdo_sqlite: "sqlite3",
  pgsql: "pg",
  postgres: "pg",
  postgresql: "pg",
  sqlite: "sqlite3",
};

export class DsnParser {
  constructor(private readonly schemeMapping: DsnSchemeMapping = {}) {}

  public parse(dsn: string): DsnConnectionParams {
    const parsed = this.parseUrl(this.normalizeSqliteDsn(dsn));
    const params: DsnConnectionParams = {};

    if (parsed.scheme !== undefined) {
      const driver = this.parseDatabaseUrlScheme(parsed.scheme);
      if (typeof driver === "string") {
        params.driver = driver;
      } else {
        params.driverClass = driver;
      }
    }

    if (parsed.host !== undefined) {
      params.host = parsed.host;
    }

    if (parsed.port !== undefined) {
      params.port = parsed.port;
    }

    if (parsed.user !== undefined) {
      params.user = parsed.user;
    }

    if (parsed.pass !== undefined) {
      params.password = parsed.pass;
    }

    const pathResolved = this.parseDatabaseUrlPath(parsed, params);
    return this.parseDatabaseUrlQuery(parsed, pathResolved);
  }

  private normalizeSqliteDsn(dsn: string): string {
    return dsn.replace(/^((?:pdo-)?sqlite3?):\/\/\//, "$1://localhost/");
  }

  private parseUrl(url: string): ParsedDsnUrl {
    try {
      const parsedUrl = new URL(url);
      return {
        host: this.decodeRawUrlComponent(parsedUrl.hostname),
        pass:
          parsedUrl.password === "" ? undefined : this.decodeRawUrlComponent(parsedUrl.password),
        path:
          parsedUrl.pathname === "" ? undefined : this.decodeRawUrlComponent(parsedUrl.pathname),
        port: parsedUrl.port === "" ? undefined : Number.parseInt(parsedUrl.port, 10),
        query:
          parsedUrl.search === ""
            ? undefined
            : this.decodeRawUrlComponent(parsedUrl.search.slice(1)),
        scheme: this.decodeRawUrlComponent(parsedUrl.protocol.slice(0, -1)),
        user:
          parsedUrl.username === "" ? undefined : this.decodeRawUrlComponent(parsedUrl.username),
      };
    } catch {
      throw new MalformedDsnException();
    }
  }

  private parseDatabaseUrlPath(
    parsed: ParsedDsnUrl,
    params: DsnConnectionParams,
  ): DsnConnectionParams {
    if (parsed.path === undefined) {
      return params;
    }

    const path =
      params.host === undefined ? parsed.path : this.normalizeDatabaseUrlPath(parsed.path);

    if (typeof params.driver !== "string") {
      return this.parseRegularDatabaseUrlPath(path, params);
    }

    if (params.driver.includes("sqlite")) {
      return this.parseSqliteDatabaseUrlPath(path, params);
    }

    return this.parseRegularDatabaseUrlPath(path, params);
  }

  private normalizeDatabaseUrlPath(path: string): string {
    return path.startsWith("/") ? path.slice(1) : path;
  }

  private parseDatabaseUrlQuery(
    parsed: ParsedDsnUrl,
    params: DsnConnectionParams,
  ): DsnConnectionParams {
    if (parsed.query === undefined) {
      return params;
    }

    const queryParams: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(parsed.query)) {
      queryParams[key] = value;
    }

    return {
      ...params,
      ...queryParams,
    };
  }

  private parseRegularDatabaseUrlPath(
    path: string,
    params: DsnConnectionParams,
  ): DsnConnectionParams {
    return {
      ...params,
      dbname: path,
    };
  }

  private parseSqliteDatabaseUrlPath(
    path: string,
    params: DsnConnectionParams,
  ): DsnConnectionParams {
    if (path === ":memory:") {
      return {
        ...params,
        memory: true,
      };
    }

    return {
      ...params,
      path,
    };
  }

  private parseDatabaseUrlScheme(scheme: string): DsnSchemeMappingValue {
    const driver = scheme.replaceAll("-", "_");
    return this.schemeMapping[driver] ?? DEFAULT_SCHEME_ALIASES[driver] ?? driver;
  }

  private decodeRawUrlComponent(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      throw new MalformedDsnException();
    }
  }
}
