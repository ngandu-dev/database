import type { Visitor } from "./visitor";

export interface SQLParser {
  parse(sql: string, visitor: Visitor): void;
}
