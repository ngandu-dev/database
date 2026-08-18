export interface SQLite3RunContextLike {
  changes?: number;
  lastID?: number;
}

export interface SQLite3DatabaseLike {
  all?(
    sql: string,
    parameters: unknown[],
    callback: (error: Error | null, rows?: unknown[]) => void,
  ): void;
  exec?(sql: string, callback: (error: Error | null) => void): void;
  run?(
    sql: string,
    parameters: unknown[],
    callback?: (this: SQLite3RunContextLike, error: Error | null) => void,
  ): void;
  close?(callback: (error: Error | null) => void): void;
}

export interface SQLite3ConnectionParams extends Record<string, unknown> {
  client?: SQLite3DatabaseLike;
  connection?: SQLite3DatabaseLike;
  database?: SQLite3DatabaseLike | string;
  path?: string;
  memory?: boolean;
  ownsClient?: boolean;
}
