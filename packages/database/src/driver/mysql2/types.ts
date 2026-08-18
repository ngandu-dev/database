export interface MySQL2ExecutorLike {
  execute?(sql: string, parameters?: unknown[]): Promise<unknown> | unknown;
  query?(sql: string, parameters?: unknown[]): Promise<unknown> | unknown;
}

export interface MySQL2ConnectionLike extends MySQL2ExecutorLike {
  beginTransaction?(): Promise<void> | void;
  commit?(): Promise<void> | void;
  rollback?(): Promise<void> | void;
  release?(): void;
}

export interface MySQL2PoolLike extends MySQL2ExecutorLike {
  getConnection?(): Promise<MySQL2ConnectionLike>;
  end?(): Promise<void> | void;
}

export interface MySQL2ConnectionParams extends Record<string, unknown> {
  client?: MySQL2PoolLike | MySQL2ConnectionLike;
  connection?: MySQL2ConnectionLike;
  pool?: MySQL2PoolLike;
  ownsClient?: boolean;
  ownsPool?: boolean;
}
