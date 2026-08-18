import { Configuration } from "../configuration";
import { Connection } from "../connection";
import type { Driver } from "../driver";
import type { Connection as DriverConnection } from "../driver/connection";
import type { QueryParameterTypes, QueryParameters } from "../query";
import type { Statement } from "../statement";

type OverrideParams = Record<string, unknown>;

export interface PrimaryReadReplicaConnectionParams extends Record<string, unknown> {
  primary: OverrideParams;
  replica: OverrideParams[];
  keepReplica?: boolean;
}

type NamedConnection = "primary" | "replica";

export class PrimaryReadReplicaConnection extends Connection {
  protected connections: Record<NamedConnection, DriverConnection | null> = {
    primary: null,
    replica: null,
  };

  protected keepReplica = false;

  constructor(
    params: PrimaryReadReplicaConnectionParams,
    driver: Driver,
    configuration: Configuration = new Configuration(),
  ) {
    if (params.primary === undefined || params.replica === undefined) {
      throw new TypeError("primary or replica configuration missing");
    }

    if (!Array.isArray(params.replica) || params.replica.length === 0) {
      throw new TypeError("You have to configure at least one replica.");
    }

    const normalizedParams: PrimaryReadReplicaConnectionParams = {
      ...params,
      primary: { ...params.primary },
      replica: params.replica.map((replica) => ({ ...replica })),
    };

    if (typeof params.driver === "string") {
      normalizedParams.primary.driver = params.driver;

      normalizedParams.replica = normalizedParams.replica.map((replica) => ({
        ...replica,
        driver: params.driver,
      }));
    }

    super(normalizedParams, driver, configuration);

    this.keepReplica = Boolean(params.keepReplica);
  }

  public isConnectedToPrimary(): boolean {
    const current = this.getWrappedDriverConnection();

    return current !== null && current === this.connections.primary;
  }

  public override async connect(): Promise<DriverConnection>;
  public async connect(connectionName: string | null): Promise<DriverConnection>;
  public override async connect(connectionName?: string | null): Promise<DriverConnection> {
    if (connectionName !== undefined && connectionName !== null) {
      throw new TypeError(
        "Passing a connection name as first argument is not supported anymore. Use ensureConnectedToPrimary()/ensureConnectedToReplica() instead.",
      );
    }

    return super.connect();
  }

  public async ensureConnectedToPrimary(): Promise<void> {
    await this.performConnect("primary");
  }

  public async ensureConnectedToReplica(): Promise<void> {
    await this.performConnect("replica");
  }

  public override async executeStatement(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<number> {
    await this.ensureConnectedToPrimary();

    return super.executeStatement(sql, params, types);
  }

  public override async beginTransaction(): Promise<void> {
    await this.ensureConnectedToPrimary();

    await super.beginTransaction();
  }

  public override async commit(): Promise<void> {
    await this.ensureConnectedToPrimary();

    await super.commit();
  }

  public override async rollBack(): Promise<void> {
    await this.ensureConnectedToPrimary();

    await super.rollBack();
  }

  public override async createSavepoint(savepoint: string): Promise<void> {
    await this.ensureConnectedToPrimary();

    await super.createSavepoint(savepoint);
  }

  public override async releaseSavepoint(savepoint: string): Promise<void> {
    await this.ensureConnectedToPrimary();

    await super.releaseSavepoint(savepoint);
  }

  public override async rollbackSavepoint(savepoint: string): Promise<void> {
    await this.ensureConnectedToPrimary();

    await super.rollbackSavepoint(savepoint);
  }

  public override async prepare(sql: string): Promise<Statement> {
    await this.ensureConnectedToPrimary();

    return super.prepare(sql);
  }

  public override async close(): Promise<void> {
    const current = this.getWrappedDriverConnection();
    const uniqueConnections = new Set<DriverConnection>();

    if (this.connections.primary !== null) {
      uniqueConnections.add(this.connections.primary);
    }

    if (this.connections.replica !== null) {
      uniqueConnections.add(this.connections.replica);
    }

    if (current !== null) {
      await super.close();
      uniqueConnections.delete(current);
    }

    for (const connection of uniqueConnections) {
      const closableConnection = connection as DriverConnection & { close?: () => Promise<void> };
      await closableConnection.close?.();
    }

    this.connections = { primary: null, replica: null };
    this.resetConnectionState();
  }

  protected override async performConnect(connectionName?: string): Promise<DriverConnection> {
    const requestedConnectionChange = connectionName !== undefined;
    const requestedName = (connectionName ?? "replica") as string;

    if (requestedName !== "primary" && requestedName !== "replica") {
      throw new TypeError("Invalid option to connect(), only primary or replica allowed.");
    }

    // If we have a connection open, and this is not an explicit connection
    // change request, then abort right here, because we are already done.
    // This prevents writes to the replica in case of "keepReplica" option enabled.
    const current = this.getWrappedDriverConnection();
    if (current !== null && !requestedConnectionChange) {
      return current;
    }

    let selectedConnectionName = requestedName as NamedConnection;
    let forcePrimaryAsReplica = false;

    if (this.getTransactionNestingLevel() > 0) {
      selectedConnectionName = "primary";
      forcePrimaryAsReplica = true;
    }

    const existing = this.connections[selectedConnectionName];
    if (existing !== null) {
      this.setWrappedDriverConnection(existing);

      if (forcePrimaryAsReplica && !this.keepReplica) {
        this.connections.replica = existing;
      }

      return existing;
    }

    if (selectedConnectionName === "primary") {
      const primaryConnection = await this.connectTo("primary");
      this.connections.primary = primaryConnection;
      this.setWrappedDriverConnection(primaryConnection);

      // Set replica connection to primary to avoid invalid reads
      if (!this.keepReplica) {
        this.connections.replica = primaryConnection;
      }

      return primaryConnection;
    }

    const replicaConnection = await this.connectTo("replica");
    this.connections.replica = replicaConnection;
    this.setWrappedDriverConnection(replicaConnection);

    return replicaConnection;
  }

  protected async connectTo(connectionName: NamedConnection): Promise<DriverConnection> {
    const params = this.getParams() as PrimaryReadReplicaConnectionParams;
    const primaryParams = params.primary;

    const connectionParams =
      connectionName === "primary"
        ? primaryParams
        : this.chooseReplicaConnectionParameters(primaryParams, params.replica);

    try {
      return await this.getDriver().connect(connectionParams);
    } catch (error) {
      throw this.convertException(error, "connect");
    }
  }

  protected chooseReplicaConnectionParameters(
    primary: OverrideParams,
    replicas: OverrideParams[],
  ): OverrideParams {
    const replica = replicas[Math.floor(Math.random() * replicas.length)] ?? replicas[0];
    const params = { ...(replica ?? {}) };

    if (params.charset === undefined && primary.charset !== undefined) {
      params.charset = primary.charset;
    }

    return params;
  }
}
