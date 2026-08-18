import { DefaultSelectSQLBuilder } from "../sql/builder/default-select-sql-builder";
import type { SelectSQLBuilder } from "../sql/builder/select-sql-builder";
import { MariaDB1052Platform } from "./mariadb1052-platform";

export class MariaDB1060Platform extends MariaDB1052Platform {
  public override createSelectSQLBuilder(): SelectSQLBuilder {
    return new DefaultSelectSQLBuilder(this, "FOR UPDATE", "SKIP LOCKED");
  }
}
