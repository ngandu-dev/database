import { readFileSync } from "node:fs";

import { Configuration } from "../../../configuration";
import { Connection } from "../../../connection";
import type { ConnectionParams } from "../../../driver-manager";
import { DriverManager } from "../../../driver-manager";

export type FunctionalDriver = "mssql" | "mysql2" | "pg" | "sqlite3";
export type FunctionalPlatformTarget = "mariadb" | "mysql" | "postgresql" | "sqlite3" | "sqlserver";

export type FunctionalTarget = {
  driver: FunctionalDriver;
  platform: FunctionalPlatformTarget;
};

type FunctionalConnectionBundle = {
  connection: Connection;
  target: FunctionalTarget;
};

type FunctionalConfigProfile = {
  connection?: Record<string, unknown>;
  privilegedConnection?: Record<string, unknown>;
  driver?: string;
  platform?: string;
  serverVersion?: string;
};

type FunctionalConfigFile = FunctionalConfigProfile & {
  targets?: Record<string, FunctionalConfigProfile>;
};

const PLATFORM_TO_DRIVER: Record<string, FunctionalTarget> = {
  mariadb: { driver: "mysql2", platform: "mariadb" },
  mssql: { driver: "mssql", platform: "sqlserver" },
  mysql: { driver: "mysql2", platform: "mysql" },
  mysql2: { driver: "mysql2", platform: "mysql" },
  pg: { driver: "pg", platform: "postgresql" },
  pgsql: { driver: "pg", platform: "postgresql" },
  postgresql: { driver: "pg", platform: "postgresql" },
  sqlite: { driver: "sqlite3", platform: "sqlite3" },
  sqlite3: { driver: "sqlite3", platform: "sqlite3" },
  sqlserver: { driver: "mssql", platform: "sqlserver" },
};

export function resolveFunctionalTarget(): FunctionalTarget {
  const requested =
    process.env.DATAZEN_FUNCTIONAL_PLATFORM ?? process.env.DATAZEN_FUNCTIONAL_DRIVER ?? "sqlite3";
  const normalized = requested.trim().toLowerCase();
  const target = PLATFORM_TO_DRIVER[normalized];

  if (target === undefined) {
    throw new Error(
      `Unsupported DATAZEN_FUNCTIONAL_PLATFORM/DATAZEN_FUNCTIONAL_DRIVER "${requested}". ` +
        `Supported values: ${Object.keys(PLATFORM_TO_DRIVER).sort().join(", ")}`,
    );
  }

  return target;
}

export async function createFunctionalConnection(): Promise<Connection> {
  const target = resolveFunctionalTarget();

  switch (target.driver) {
    case "sqlite3":
      return createSQLite3Connection("default", undefined, "direct");
    case "mysql2":
      return createMySQL2Connection(target, "default", undefined, "direct");
    case "pg":
      return createPgConnection(target, "default", undefined, "direct");
    case "mssql":
      return createMSSQLConnection(target);
  }
}

export async function createFunctionalConnectionWithConfiguration(
  configuration: Configuration,
): Promise<Connection> {
  const target = resolveFunctionalTarget();

  switch (target.driver) {
    case "sqlite3":
      return createSQLite3Connection("default", configuration, "direct");
    case "mysql2":
      return createMySQL2Connection(target, "default", configuration, "direct");
    case "pg":
      return createPgConnection(target, "default", configuration, "direct");
    case "mssql":
      return createMSSQLConnection(target, "default", configuration);
  }
}

export async function createPrivilegedFunctionalConnection(): Promise<Connection> {
  const target = resolveFunctionalTarget();

  switch (target.driver) {
    case "sqlite3":
      return createSQLite3Connection("privileged");
    case "mysql2":
      return createMySQL2Connection(target, "privileged");
    case "pg":
      return createPgConnection(target, "privileged");
    case "mssql":
      return createMSSQLConnection(target, "privileged");
  }
}

export async function createFunctionalConnectionBundle(): Promise<FunctionalConnectionBundle> {
  const target = resolveFunctionalTarget();

  switch (target.driver) {
    case "sqlite3":
      return {
        connection: await createSQLite3Connection(),
        target,
      };
    case "mysql2":
      return {
        connection: await createMySQL2Connection(target),
        target,
      };
    case "pg":
      return {
        connection: await createPgConnection(target),
        target,
      };
    case "mssql":
      return {
        connection: await createMSSQLConnection(target),
        target,
      };
  }
}

export type FunctionalConnectionRole = "default" | "privileged";
export type FunctionalConnectionMode = "direct" | "pool";

export async function createFunctionalDriverManagerParams(
  role: FunctionalConnectionRole = "default",
  mode: FunctionalConnectionMode = "direct",
): Promise<ConnectionParams> {
  const target = resolveFunctionalTarget();

  switch (target.driver) {
    case "sqlite3":
      return createSQLite3DriverManagerParams(role, mode);
    case "mysql2":
      return createMySQL2DriverManagerParams(target, role, mode);
    case "pg":
      return createPgDriverManagerParams(target, role, mode);
    case "mssql":
      return createMSSQLDriverManagerParams(target, role);
  }
}

async function createSQLite3Connection(
  role: FunctionalConnectionRole = "default",
  configuration?: Configuration,
  _mode: FunctionalConnectionMode = "direct",
): Promise<Connection> {
  return DriverManager.getConnection(
    await createSQLite3DriverManagerParams(role, _mode),
    configuration,
  );
}

async function createMySQL2Connection(
  target: FunctionalTarget,
  role: FunctionalConnectionRole = "default",
  configuration?: Configuration,
  mode: FunctionalConnectionMode = "pool",
): Promise<Connection> {
  return DriverManager.getConnection(
    await createMySQL2DriverManagerParams(target, role, mode),
    configuration,
  );
}

async function createPgConnection(
  target: FunctionalTarget,
  role: FunctionalConnectionRole = "default",
  configuration?: Configuration,
  mode: FunctionalConnectionMode = "pool",
): Promise<Connection> {
  return DriverManager.getConnection(
    await createPgDriverManagerParams(target, role, mode),
    configuration,
  );
}

async function createMSSQLConnection(
  target: FunctionalTarget,
  role: FunctionalConnectionRole = "default",
  configuration?: Configuration,
): Promise<Connection> {
  return DriverManager.getConnection(
    await createMSSQLDriverManagerParams(target, role),
    configuration,
  );
}

async function createSQLite3DriverManagerParams(
  role: FunctionalConnectionRole = "default",
  _mode: FunctionalConnectionMode = "direct",
): Promise<ConnectionParams> {
  const sqliteModule = await importOptional("sqlite3", { driver: "sqlite3", platform: "sqlite3" });
  const sqlite3 = (sqliteModule.default ?? sqliteModule) as {
    Database: new (
      filename: string,
      callback: (error: Error | null) => void,
    ) => { close?: (callback: (error: Error | null) => void) => void };
  };
  const sqliteFile = readEnv("sqlite3", "FILE", ":memory:", role);
  const client = await new Promise<object>((resolve, reject) => {
    const db = new sqlite3.Database(sqliteFile, (error) => {
      if (error !== null) {
        reject(error);
        return;
      }

      resolve(db as object);
    });
  });

  return {
    client: client as Record<string, unknown>,
    dbname: sqliteFile,
    driver: "sqlite3",
    path: sqliteFile,
    ownsClient: true,
    ...readCommonConnectionOverrides({ driver: "sqlite3", platform: "sqlite3" }, role),
  };
}

async function createMySQL2DriverManagerParams(
  target: FunctionalTarget,
  role: FunctionalConnectionRole = "default",
  mode: FunctionalConnectionMode = "pool",
): Promise<ConnectionParams> {
  const mysql2 = await importOptional("mysql2/promise", target);
  const mysqlModule = mysql2.default ?? mysql2;
  const charset = readEnv(target.platform, "CHARSET", "utf8mb4", role);
  const collation = readEnv(target.platform, "COLLATION", "utf8mb4_general_ci", role);

  const config = {
    bigNumberStrings: false,
    charset,
    database: readEnv(target.platform, "DATABASE", "datazen", role),
    host: readEnv(target.platform, "HOST", "127.0.0.1", role),
    jsonStrings: true,
    password: readEnv(
      target.platform,
      "PASSWORD",
      role === "privileged" ? "root" : "datazen",
      role,
    ),
    port: readNumberEnv(target.platform, "PORT", target.platform === "mariadb" ? 3307 : 3306, role),
    supportBigNumbers: true,
    user: readEnv(target.platform, "USER", role === "privileged" ? "root" : "datazen", role),
  };

  if (mode === "direct") {
    if (typeof mysqlModule.createConnection !== "function") {
      throw new Error('The "mysql2/promise" module does not expose createConnection().');
    }

    const connection = await mysqlModule.createConnection(config);

    return {
      charset,
      collation,
      database: config.database,
      dbname: config.database,
      host: config.host,
      connection,
      driver: "mysql2",
      ownsClient: true,
      password: config.password,
      port: config.port,
      user: config.user,
      ...readCommonConnectionOverrides(target, role),
    };
  }

  if (typeof mysqlModule.createPool !== "function") {
    throw new Error('The "mysql2/promise" module does not expose createPool().');
  }

  const pool = mysqlModule.createPool(config);

  return {
    charset,
    collation,
    database: config.database,
    dbname: config.database,
    host: config.host,
    driver: "mysql2",
    ownsPool: true,
    password: config.password,
    pool,
    port: config.port,
    user: config.user,
    ...readCommonConnectionOverrides(target, role),
  };
}

async function createPgDriverManagerParams(
  target: FunctionalTarget,
  role: FunctionalConnectionRole = "default",
  mode: FunctionalConnectionMode = "pool",
): Promise<ConnectionParams> {
  const pg = await importOptional("pg", target);
  const PgPool = (pg.Pool ?? pg.default?.Pool) as (new (...args: unknown[]) => unknown) | undefined;
  const PgClient = (pg.Client ?? pg.default?.Client) as
    | (new (
        ...args: unknown[]
      ) => { connect?: () => Promise<unknown> })
    | undefined;

  const config = {
    database: readEnv(target.platform, "DATABASE", "datazen", role),
    host: readEnv(target.platform, "HOST", "127.0.0.1", role),
    password: readEnv(target.platform, "PASSWORD", "datazen", role),
    port: readNumberEnv(target.platform, "PORT", 5432, role),
    user: readEnv(target.platform, "USER", "datazen", role),
  };

  if (mode === "direct") {
    if (PgClient === undefined) {
      throw new Error('The "pg" module does not expose Client.');
    }

    const client = new PgClient(config);
    if (typeof client.connect === "function") {
      await client.connect();
    }

    return {
      database: config.database,
      dbname: config.database,
      host: config.host,
      client: client as Record<string, unknown>,
      driver: "pg",
      ownsClient: true,
      password: config.password,
      port: config.port,
      user: config.user,
      ...readCommonConnectionOverrides(target, role),
    };
  }

  if (PgPool === undefined) {
    throw new Error('The "pg" module does not expose Pool.');
  }

  const pool = new PgPool(config);

  return {
    database: config.database,
    dbname: config.database,
    host: config.host,
    driver: "pg",
    ownsPool: true,
    password: config.password,
    pool: pool as Record<string, unknown>,
    port: config.port,
    user: config.user,
    ...readCommonConnectionOverrides(target, role),
  };
}

async function createMSSQLDriverManagerParams(
  target: FunctionalTarget,
  role: FunctionalConnectionRole = "default",
): Promise<ConnectionParams> {
  const mssql = await importOptional("mssql", target);
  const module = (mssql.default ?? mssql) as Record<string, unknown>;
  const ConnectionPool = module.ConnectionPool as
    | (new (
        config: Record<string, unknown>,
      ) => { connect?: () => Promise<unknown> })
    | undefined;

  if (ConnectionPool === undefined) {
    throw new Error('The "mssql" module does not expose ConnectionPool.');
  }

  const pool = new ConnectionPool({
    database: readEnv(target.platform, "DATABASE", "tempdb", role),
    options: {
      encrypt: readBooleanEnv(target.platform, "ENCRYPT", false, role),
      trustServerCertificate: readBooleanEnv(
        target.platform,
        "TRUST_SERVER_CERTIFICATE",
        true,
        role,
      ),
    },
    password: readEnv(target.platform, "PASSWORD", "Datazen123!", role),
    port: readNumberEnv(target.platform, "PORT", 1433, role),
    server: readEnv(target.platform, "HOST", "127.0.0.1", role),
    user: readEnv(target.platform, "USER", "sa", role),
  });

  if (typeof pool.connect === "function") {
    await pool.connect();
  }

  return {
    database: readEnv(target.platform, "DATABASE", "tempdb", role),
    dbname: readEnv(target.platform, "DATABASE", "tempdb", role),
    driver: "mssql",
    host: readEnv(target.platform, "HOST", "127.0.0.1", role),
    ownsPool: true,
    password: readEnv(target.platform, "PASSWORD", "Datazen123!", role),
    pool: pool as Record<string, unknown>,
    port: readNumberEnv(target.platform, "PORT", 1433, role),
    user: readEnv(target.platform, "USER", "sa", role),
    ...readCommonConnectionOverrides(target, role),
  };
}

async function importOptional(
  specifier: string,
  target: FunctionalTarget,
): Promise<Record<string, unknown>> {
  try {
    return (await import(specifier)) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Unable to load optional peer dependency "${specifier}" for functional platform ` +
        `"${target.platform}" (driver "${target.driver}"). Install it before running functional tests.`,
      { cause: error },
    );
  }
}

function readCommonConnectionOverrides(
  target: FunctionalTarget,
  _role: FunctionalConnectionRole = "default",
): Record<string, unknown> {
  const serverVersion =
    process.env.DATAZEN_FUNCTIONAL_SERVER_VERSION ??
    resolveFunctionalConfigProfile(target)?.serverVersion;

  if (serverVersion === undefined || serverVersion.trim() === "") {
    return {};
  }

  return { serverVersion };
}

export function resolveFunctionalConfigProfile(
  target: FunctionalTarget = resolveFunctionalTarget(),
): FunctionalConfigProfile | null {
  const configFilePath = process.env.DATAZEN_FUNCTIONAL_CONFIG_FILE;
  if (configFilePath === undefined || configFilePath.trim() === "") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configFilePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`Unable to read functional config file "${configFilePath}".`, { cause: error });
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Functional config file "${configFilePath}" must contain a JSON object.`);
  }

  const config = parsed as FunctionalConfigFile;
  const profile =
    (config.targets !== undefined && config.targets[target.platform] !== undefined
      ? config.targets[target.platform]
      : config) ?? null;

  if (profile === null || typeof profile !== "object" || Array.isArray(profile)) {
    return null;
  }

  if (typeof profile.platform === "string" && profile.platform.trim() !== "") {
    const declaredPlatform = profile.platform.trim().toLowerCase();
    if (declaredPlatform !== target.platform) {
      throw new Error(
        `Functional config "${configFilePath}" targets platform "${declaredPlatform}" but ` +
          `DATAZEN_FUNCTIONAL_PLATFORM resolved to "${target.platform}".`,
      );
    }
  }

  return profile;
}

function readEnv(
  platform: FunctionalPlatformTarget,
  key: string,
  fallback: string,
  role: FunctionalConnectionRole = "default",
): string {
  const platformPrefix = platform.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const rolePrefix = role === "privileged" ? "PRIVILEGED_" : "";
  const configValue = readConfigValue(platform, key, role);

  if (role === "privileged") {
    return (
      process.env[`DATAZEN_FUNCTIONAL_${platformPrefix}_${rolePrefix}${key}`] ??
      process.env[`DATAZEN_FUNCTIONAL_${rolePrefix}${key}`] ??
      configValue ??
      readEnv(platform, key, fallback, "default")
    );
  }

  return (
    process.env[`DATAZEN_FUNCTIONAL_${platformPrefix}_${key}`] ??
    process.env[`DATAZEN_FUNCTIONAL_${key}`] ??
    configValue ??
    fallback
  );
}

function readNumberEnv(
  platform: FunctionalPlatformTarget,
  key: string,
  fallback: number,
  role: FunctionalConnectionRole = "default",
): number {
  const raw = readEnv(platform, key, String(fallback), role);
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric env value for ${platform}:${key} -> "${raw}"`);
  }

  return parsed;
}

function readBooleanEnv(
  platform: FunctionalPlatformTarget,
  key: string,
  fallback: boolean,
  role: FunctionalConnectionRole = "default",
): boolean {
  const raw = readEnv(platform, key, fallback ? "true" : "false", role)
    .trim()
    .toLowerCase();

  if (["1", "true", "yes", "on"].includes(raw)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(raw)) {
    return false;
  }

  throw new Error(`Invalid boolean env value for ${platform}:${key} -> "${raw}"`);
}

function readConfigValue(
  platform: FunctionalPlatformTarget,
  key: string,
  role: FunctionalConnectionRole = "default",
): string | undefined {
  const profile = resolveFunctionalConfigProfile({
    driver: PLATFORM_TO_DRIVER[platform].driver,
    platform,
  });
  const connection = role === "privileged" ? profile?.privilegedConnection : profile?.connection;

  if (connection === undefined || connection === null || typeof connection !== "object") {
    return undefined;
  }

  const value = pickConfigConnectionValue(connection, key);
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return undefined;
}

function pickConfigConnectionValue(
  connection: Record<string, unknown>,
  envStyleKey: string,
): unknown {
  const snakeCaseKey = envStyleKey.toLowerCase();
  const camelCaseKey = snakeCaseKey.replace(/_([a-z0-9])/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );

  for (const candidate of [envStyleKey, snakeCaseKey, camelCaseKey]) {
    if (Object.hasOwn(connection, candidate)) {
      return connection[candidate];
    }
  }

  return undefined;
}
