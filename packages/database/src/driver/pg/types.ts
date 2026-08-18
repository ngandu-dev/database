export interface PgFieldLike {
  name: string;
}

export interface PgQueryResultLike {
  rows?: unknown[];
  rowCount?: number | null;
  fields?: PgFieldLike[];
}

export interface PgQueryableLike {
  query(sql: string, parameters?: unknown[]): Promise<PgQueryResultLike> | PgQueryResultLike;
}

export interface PgPoolClientLike extends PgQueryableLike {
  release?(): void;
}

export interface PgPoolLike extends PgQueryableLike {
  connect?(): Promise<PgPoolClientLike> | PgPoolClientLike;
  end?(): Promise<void> | void;
}

export interface PgConnectionParams extends Record<string, unknown> {
  client?: PgPoolLike | PgPoolClientLike;
  connection?: PgPoolClientLike;
  pool?: PgPoolLike;
  ownsClient?: boolean;
  ownsPool?: boolean;
}
