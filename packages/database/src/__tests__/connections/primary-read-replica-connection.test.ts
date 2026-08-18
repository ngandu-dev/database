import { describe, expect, it } from "vitest";

import type { Driver } from "../../driver";
import type {
  ExceptionConverter,
  ExceptionConverterContext,
} from "../../driver/api/exception-converter";
import { ArrayResult } from "../../driver/array-result";
import type { Connection as DriverConnection } from "../../driver/connection";
import { DriverManager } from "../../driver-manager";
import { DriverException } from "../../exception/driver-exception";
import { MySQLPlatform } from "../../platforms/mysql-platform";

class NoopExceptionConverter implements ExceptionConverter {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    return new DriverException("driver error", {
      cause: error,
      driverName: "primary-replica-spy",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
    });
  }
}

class SpyPhysicalConnection implements DriverConnection {
  public readonly querySql: string[] = [];
  public readonly execSql: string[] = [];
  public beginCalls = 0;
  public commitCalls = 0;
  public rollbackCalls = 0;
  public closeCalls = 0;

  constructor(public readonly role: string) {}

  public async prepare(sql: string) {
    return {
      bindValue: () => undefined,
      execute: async () => {
        this.execSql.push(sql);
        return new ArrayResult([], [], 1);
      },
    };
  }

  public async query(sql: string) {
    this.querySql.push(sql);
    return new ArrayResult([{ value: this.role }], ["value"], 1);
  }

  public quote(value: string): string {
    return `[${this.role}:${value}]`;
  }

  public async exec(sql: string): Promise<number | string> {
    this.execSql.push(sql);
    return 1;
  }

  public async lastInsertId(): Promise<number | string> {
    return 1;
  }

  public async beginTransaction(): Promise<void> {
    this.beginCalls += 1;
  }

  public async commit(): Promise<void> {
    this.commitCalls += 1;
  }

  public async rollBack(): Promise<void> {
    this.rollbackCalls += 1;
  }

  public async getServerVersion(): Promise<string> {
    return "8.0.36";
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }

  public getNativeConnection(): unknown {
    return { role: this.role };
  }
}

class SpyDriver implements Driver {
  public readonly connectParams: Array<Record<string, unknown>> = [];
  public readonly connections: SpyPhysicalConnection[] = [];
  private readonly converter = new NoopExceptionConverter();

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    this.connectParams.push(params);
    const role = String(params.role ?? `conn-${this.connections.length + 1}`);
    const connection = new SpyPhysicalConnection(role);
    this.connections.push(connection);
    return connection;
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }

  public getDatabasePlatform(): MySQLPlatform {
    return new MySQLPlatform();
  }
}

function createPrimaryReplicaConnection(driver: SpyDriver, keepReplica = false) {
  return DriverManager.getPrimaryReadReplicaConnection({
    driverInstance: driver,
    keepReplica,
    primary: { role: "primary" },
    replica: [{ role: "replica" }],
  });
}

describe("PrimaryReadReplicaConnection", () => {
  it("uses replica on connect helpers until primary is explicitly requested", async () => {
    const driver = new SpyDriver();
    const connection = createPrimaryReplicaConnection(driver);

    expect(connection.isConnectedToPrimary()).toBe(false);

    await connection.ensureConnectedToReplica();
    expect(connection.isConnectedToPrimary()).toBe(false);

    await connection.ensureConnectedToPrimary();
    expect(connection.isConnectedToPrimary()).toBe(true);

    expect(driver.connectParams.map((params) => params.role)).toEqual(["replica", "primary"]);
  });

  it("does not switch to primary on executeQuery-style reads", async () => {
    const driver = new SpyDriver();
    const connection = createPrimaryReplicaConnection(driver);

    await expect(connection.fetchOne("SELECT 1")).resolves.toBe("replica");

    expect(connection.isConnectedToPrimary()).toBe(false);
    expect(driver.connectParams.map((params) => params.role)).toEqual(["replica"]);
    expect(driver.connections[0]?.querySql).toEqual(["SELECT 1"]);
  });

  it("does not switch to primary on fetchAllAssociative reads (Doctrine parity)", async () => {
    const driver = new SpyDriver();
    const connection = createPrimaryReplicaConnection(driver);

    await expect(connection.fetchAllAssociative<{ value: string }>("SELECT 1")).resolves.toEqual([
      { value: "replica" },
    ]);

    expect(connection.isConnectedToPrimary()).toBe(false);
    expect(driver.connectParams.map((params) => params.role)).toEqual(["replica"]);
  });

  it("switches to primary on write operations and stays there for later reads", async () => {
    const driver = new SpyDriver();
    const connection = createPrimaryReplicaConnection(driver);

    await expect(connection.fetchOne("SELECT 1")).resolves.toBe("replica");
    expect(connection.isConnectedToPrimary()).toBe(false);

    await expect(connection.executeStatement("UPDATE users SET active = 1")).resolves.toBe(1);
    expect(connection.isConnectedToPrimary()).toBe(true);

    await expect(connection.fetchOne("SELECT 2")).resolves.toBe("primary");

    expect(driver.connectParams.map((params) => params.role)).toEqual(["replica", "primary"]);
    expect(driver.connections[0]?.querySql).toEqual(["SELECT 1"]);
    expect(driver.connections[1]?.execSql).toEqual(["UPDATE users SET active = 1"]);
    expect(driver.connections[1]?.querySql).toEqual(["SELECT 2"]);
  });

  it("pins transactions and nested savepoints to primary", async () => {
    const driver = new SpyDriver();
    const connection = createPrimaryReplicaConnection(driver);

    await connection.beginTransaction();
    await connection.beginTransaction();
    await expect(connection.fetchOne("SELECT 1")).resolves.toBe("primary");
    await connection.commit();
    await connection.rollBack();

    expect(driver.connectParams.map((params) => params.role)).toEqual(["primary"]);
    expect(driver.connections[0]?.beginCalls).toBe(1);
    expect(driver.connections[0]?.execSql).toEqual([
      "SAVEPOINT DATAZEN_2",
      "RELEASE SAVEPOINT DATAZEN_2",
    ]);
    expect(driver.connections[0]?.rollbackCalls).toBe(1);
  });

  it("supports explicit switching helpers and keepReplica=true switching back", async () => {
    const driver = new SpyDriver();
    const connection = createPrimaryReplicaConnection(driver, true);

    await connection.ensureConnectedToReplica();
    expect(connection.isConnectedToPrimary()).toBe(false);
    await expect(connection.getNativeConnection()).resolves.toEqual({ role: "replica" });

    await connection.ensureConnectedToPrimary();
    expect(connection.isConnectedToPrimary()).toBe(true);
    await expect(connection.quote("abc")).resolves.toBe("[primary:abc]");

    await connection.ensureConnectedToReplica();
    expect(connection.isConnectedToPrimary()).toBe(false);
    await expect(connection.getNativeConnection()).resolves.toEqual({ role: "replica" });
  });

  it("with keepReplica=true stays on primary after transaction write until replica is explicitly requested", async () => {
    const driver = new SpyDriver();
    const connection = createPrimaryReplicaConnection(driver, true);

    await connection.ensureConnectedToReplica();
    expect(connection.isConnectedToPrimary()).toBe(false);

    await connection.beginTransaction();
    await connection.executeStatement("INSERT INTO users(id) VALUES (1)");
    await connection.commit();

    expect(connection.isConnectedToPrimary()).toBe(true);

    await connection.connect();
    expect(connection.isConnectedToPrimary()).toBe(true);

    await connection.ensureConnectedToReplica();
    expect(connection.isConnectedToPrimary()).toBe(false);
  });

  it("with keepReplica=true stays on primary after insert until replica is explicitly requested", async () => {
    const driver = new SpyDriver();
    const connection = createPrimaryReplicaConnection(driver, true);

    await connection.ensureConnectedToReplica();
    expect(connection.isConnectedToPrimary()).toBe(false);

    await connection.insert("users", { id: 30 });
    expect(connection.isConnectedToPrimary()).toBe(true);

    await connection.connect();
    expect(connection.isConnectedToPrimary()).toBe(true);

    await connection.ensureConnectedToReplica();
    expect(connection.isConnectedToPrimary()).toBe(false);
  });

  it("switches to primary on insert and keeps reads on primary afterwards (Doctrine parity)", async () => {
    const driver = new SpyDriver();
    const connection = createPrimaryReplicaConnection(driver);

    await connection.insert("users", { id: 30 });

    expect(connection.isConnectedToPrimary()).toBe(true);
    await expect(connection.fetchAllAssociative<{ value: string }>("SELECT 1")).resolves.toEqual([
      { value: "primary" },
    ]);
    expect(connection.isConnectedToPrimary()).toBe(true);
  });

  it("inherits charset from primary when replica charset is missing (Doctrine parity charsets)", async () => {
    for (const charset of ["utf8mb4", "latin1"]) {
      const driver = new SpyDriver();
      const connection = DriverManager.getPrimaryReadReplicaConnection({
        driverInstance: driver,
        primary: { charset, role: "primary" },
        replica: [{ role: "replica-a" }, { role: "replica-b" }],
      });

      await connection.ensureConnectedToReplica();

      expect(driver.connectParams[0]).toMatchObject({ charset });
      expect(String(driver.connectParams[0]?.role)).toMatch(/^replica-/);
      expect(connection.isConnectedToPrimary()).toBe(false);
    }
  });

  it("closes both cached connections and can reconnect", async () => {
    const driver = new SpyDriver();
    const connection = createPrimaryReplicaConnection(driver);

    await connection.ensureConnectedToReplica();
    await connection.ensureConnectedToPrimary();
    expect(connection.isConnectedToPrimary()).toBe(true);

    await connection.close();
    expect(driver.connections.map((c) => c.closeCalls)).toEqual([0, 1]);
    expect(connection.isConnectedToPrimary()).toBe(false);

    await connection.ensureConnectedToPrimary();
    expect(connection.isConnectedToPrimary()).toBe(true);
    expect(driver.connectParams.map((params) => params.role)).toEqual([
      "replica",
      "primary",
      "primary",
    ]);
  });

  it("close resets primary selection and reconnect can choose replica again", async () => {
    const driver = new SpyDriver();
    const connection = createPrimaryReplicaConnection(driver);

    await connection.ensureConnectedToPrimary();
    expect(connection.isConnectedToPrimary()).toBe(true);

    await connection.close();
    expect(connection.isConnectedToPrimary()).toBe(false);

    await connection.ensureConnectedToReplica();
    expect(connection.isConnectedToPrimary()).toBe(false);
    await expect(connection.fetchOne("SELECT 1")).resolves.toBe("replica");

    expect(driver.connectParams.map((params) => params.role)).toEqual(["primary", "replica"]);
  });

  it("close clears primary selection and reconnect to primary works (Doctrine parity)", async () => {
    const driver = new SpyDriver();
    const connection = createPrimaryReplicaConnection(driver);

    await connection.ensureConnectedToPrimary();
    expect(connection.isConnectedToPrimary()).toBe(true);

    await connection.close();
    expect(connection.isConnectedToPrimary()).toBe(false);

    await connection.ensureConnectedToPrimary();
    expect(connection.isConnectedToPrimary()).toBe(true);
    expect(driver.connectParams.map((params) => params.role)).toEqual(["primary", "primary"]);
  });
});
