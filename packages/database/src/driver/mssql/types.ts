export interface MSSQLRequestLike {
  input(name: string, type: unknown, value: unknown): MSSQLRequestLike;
  input(name: string, value: unknown): MSSQLRequestLike;
  query(sql: string): Promise<unknown>;
}

export interface MSSQLTransactionLike {
  begin(): Promise<void> | void;
  commit(): Promise<void> | void;
  rollback(): Promise<void> | void;
  request(): MSSQLRequestLike;
}

export interface MSSQLPoolLike {
  request(): MSSQLRequestLike;
  transaction(): MSSQLTransactionLike;
  close?(): Promise<void> | void;
}

export interface MSSQLConnectionParams extends Record<string, unknown> {
  client?: MSSQLPoolLike;
  connection?: MSSQLPoolLike;
  pool?: MSSQLPoolLike;
  ownsClient?: boolean;
  ownsPool?: boolean;
}
