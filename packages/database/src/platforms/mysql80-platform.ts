import { DefaultSelectSQLBuilder } from "../sql/builder/default-select-sql-builder";
import type { SelectSQLBuilder } from "../sql/builder/select-sql-builder";
import type { KeywordList } from "./keywords/keyword-list";
import { MySQL80Keywords } from "./keywords/mysql80-keywords";
import { MySQLPlatform } from "./mysql-platform";

export class MySQL80Platform extends MySQLPlatform {
  protected override createReservedKeywordsList(): KeywordList {
    return new MySQL80Keywords();
  }

  public override createSelectSQLBuilder(): SelectSQLBuilder {
    return new DefaultSelectSQLBuilder(this, "FOR UPDATE", "SKIP LOCKED");
  }
}
