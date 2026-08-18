import { InvalidParameterException } from "../../exception/invalid-parameter-exception";
import { Parser } from "../../sql/parser";
import type { Visitor } from "../../sql/parser/visitor";
import type { Connection as DriverConnection } from "../connection";
import { IdentityColumnsNotSupported } from "../exception/identity-columns-not-supported";
import type { Result as DriverResult } from "../result";
import type { Statement as DriverStatement } from "../statement";
import { Result as PgResult } from "./result";
import { PgStatement } from "./statement";
import type { PgPoolClientLike, PgPoolLike, PgQueryResultLike, PgQueryableLike } from "./types";

export class PgConnection implements DriverConnection {
  private readonly parser = new Parser(false);
  private transactionClient: PgPoolClientLike | null = null;
  private inTransaction = false;
  private baseClientErrorListener: ((error: unknown) => void) | null = null;
  private transactionClientErrorListener: ((error: unknown) => void) | null = null;

  constructor(
    private readonly client: PgPoolLike | PgPoolClientLike,
    private readonly ownsClient: boolean,
    private readonly pooledClient = true,
  ) {
    if (!this.pooledClient) {
      this.attachBaseClientErrorListener(client);
    }
  }

  public async prepare(sql: string): Promise<DriverStatement> {
    return new PgStatement(this, sql);
  }

  public async query(sql: string): Promise<DriverResult> {
    const payload = await this.getQueryable().query(sql);
    return this.toDriverResult(payload);
  }

  public quote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  public async exec(sql: string): Promise<number | string> {
    const payload = await this.getQueryable().query(sql);
    return typeof payload.rowCount === "number" ? payload.rowCount : 0;
  }

  public async lastInsertId(): Promise<number | string> {
    throw IdentityColumnsNotSupported.new();
  }

  public async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new Error("A transaction is already active on this connection.");
    }

    if (this.transactionClient === null && this.pooledClient) {
      const pool = this.client as PgPoolLike;
      const connect = pool.connect;
      if (typeof connect !== "function") {
        throw new Error("Expected a pg pool connection with connect() support.");
      }

      const transactionClient = await connect.call(pool);
      this.transactionClient = transactionClient;
      this.attachTransactionClientErrorListener(transactionClient);
    }

    await this.getQueryable().query("BEGIN");
    this.inTransaction = true;
  }

  public async commit(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error("No active transaction to commit.");
    }

    try {
      await this.getQueryable().query("COMMIT");
    } finally {
      this.inTransaction = false;
      this.releaseTransactionClient();
    }
  }

  public async rollBack(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error("No active transaction to roll back.");
    }

    try {
      await this.getQueryable().query("ROLLBACK");
    } finally {
      this.inTransaction = false;
      this.releaseTransactionClient();
    }
  }

  public async getServerVersion(): Promise<string> {
    const result = await this.query("SHOW server_version");
    const row = result.fetchAssociative();
    result.free();

    const version =
      row !== undefined
        ? (row.server_version ?? row.serverVersion ?? row.version ?? "unknown")
        : "unknown";
    return typeof version === "string" ? version : String(version);
  }

  public async close(): Promise<void> {
    if (this.inTransaction) {
      try {
        await this.getQueryable().query("ROLLBACK");
      } catch {
        // best effort rollback during close
      } finally {
        this.inTransaction = false;
      }
    }

    this.releaseTransactionClient();
    this.detachBaseClientErrorListener();

    if (this.ownsClient && "end" in this.client && typeof this.client.end === "function") {
      await this.client.end();
    }
  }

  public getNativeConnection(): unknown {
    return this.transactionClient ?? this.client;
  }

  public async executePrepared(sql: string, parameters: unknown[]): Promise<DriverResult> {
    const convertedSql = this.convertPositionalPlaceholders(sql);
    const payload = await this.getQueryable().query(convertedSql, parameters);

    return this.toDriverResult(payload);
  }

  private getQueryable(): PgQueryableLike {
    return this.transactionClient ?? this.client;
  }

  private releaseTransactionClient(): void {
    if (this.transactionClient !== null) {
      this.detachTransactionClientErrorListener(this.transactionClient);
    }

    if (this.transactionClient?.release !== undefined) {
      this.transactionClient.release();
    }

    this.transactionClient = null;
  }

  private attachTransactionClientErrorListener(connection: PgPoolClientLike): void {
    if (this.transactionClientErrorListener !== null) {
      return;
    }

    const emitter = connection as {
      on?: (event: string, listener: (error: unknown) => void) => unknown;
    };

    if (typeof emitter.on !== "function") {
      return;
    }

    this.transactionClientErrorListener = () => {
      // Swallow asynchronous fatal client events and let the next awaited query/tx operation
      // surface the error through the DBAL exception conversion path.
    };
    emitter.on("error", this.transactionClientErrorListener);
  }

  private detachTransactionClientErrorListener(connection: PgPoolClientLike): void {
    const listener = this.transactionClientErrorListener;
    if (listener === null) {
      return;
    }

    const emitter = connection as {
      off?: (event: string, listener: (error: unknown) => void) => unknown;
      removeListener?: (event: string, listener: (error: unknown) => void) => unknown;
    };

    if (typeof emitter.off === "function") {
      emitter.off("error", listener);
    } else if (typeof emitter.removeListener === "function") {
      emitter.removeListener("error", listener);
    }

    this.transactionClientErrorListener = null;
  }

  private attachBaseClientErrorListener(connection: PgPoolClientLike): void {
    if (this.baseClientErrorListener !== null) {
      return;
    }

    const emitter = connection as {
      on?: (event: string, listener: (error: unknown) => void) => unknown;
    };

    if (typeof emitter.on !== "function") {
      return;
    }

    this.baseClientErrorListener = () => {
      // Node pg emits async fatal connection errors. Keep them on the awaited query path.
    };
    emitter.on("error", this.baseClientErrorListener);
  }

  private detachBaseClientErrorListener(): void {
    const listener = this.baseClientErrorListener;
    if (listener === null) {
      return;
    }

    const emitter = this.client as {
      off?: (event: string, listener: (error: unknown) => void) => unknown;
      removeListener?: (event: string, listener: (error: unknown) => void) => unknown;
    };

    if (typeof emitter.off === "function") {
      emitter.off("error", listener);
    } else if (typeof emitter.removeListener === "function") {
      emitter.removeListener("error", listener);
    }

    this.baseClientErrorListener = null;
  }

  private convertPositionalPlaceholders(sql: string): string {
    const parts: string[] = [];
    let index = 0;

    const visitor: Visitor = {
      acceptNamedParameter: (): void => {
        throw new InvalidParameterException(
          "The pg driver expects positional parameters after SQL compilation.",
        );
      },
      acceptOther: (fragment: string): void => {
        parts.push(fragment);
      },
      acceptPositionalParameter: (): void => {
        index += 1;
        parts.push(`$${index}`);
      },
    };

    this.parser.parse(sql, visitor);
    return parts.join("");
  }

  private toDriverResult(payload: PgQueryResultLike): DriverResult {
    const rows = this.toRows(payload);
    const firstRow = rows[0];

    return new PgResult(rows, this.toColumns(payload, firstRow), payload.rowCount ?? rows.length);
  }

  private toRows(payload: PgQueryResultLike): Array<Record<string, unknown>> {
    if (!Array.isArray(payload.rows)) {
      return [];
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const row of payload.rows) {
      if (row !== null && typeof row === "object" && !Array.isArray(row)) {
        rows.push(row as Record<string, unknown>);
      }
    }

    return rows;
  }

  private toColumns(
    payload: PgQueryResultLike,
    firstRow: Record<string, unknown> | undefined,
  ): string[] {
    if (Array.isArray(payload.fields)) {
      const names = payload.fields
        .map((field) => field?.name)
        .filter((name): name is string => typeof name === "string");
      if (names.length > 0) {
        return names;
      }
    }

    return firstRow === undefined ? [] : Object.keys(firstRow);
  }
}
