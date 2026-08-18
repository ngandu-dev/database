import type { ServerVersionProvider } from "../server-version-provider";
import type { Result } from "./result";
import type { Statement } from "./statement";

export interface Connection extends ServerVersionProvider {
  prepare(sql: string): Promise<Statement>;
  query(sql: string): Promise<Result>;
  quote(value: string): string;
  exec(sql: string): Promise<number | string>;
  lastInsertId(): Promise<number | string>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollBack(): Promise<void>;
  getNativeConnection(): unknown;
}
