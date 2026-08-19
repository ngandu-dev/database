import { DefaultSelectSQLBuilder } from "../sql/builder/default-select-sql-builder";
import type { SelectSQLBuilder } from "../sql/builder/select-sql-builder";
import { MySQLPlatform } from "./mysql-platform";

export class MySQL80Platform extends MySQLPlatform {
  public override createSelectSQLBuilder(): SelectSQLBuilder {
    return new DefaultSelectSQLBuilder(this, "FOR UPDATE", "SKIP LOCKED");
  }
}
