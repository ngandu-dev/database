import { DefaultSelectSQLBuilder } from "../sql/builder/default-select-sql-builder";
import type { SelectSQLBuilder } from "../sql/builder/select-sql-builder";
import { AbstractPlatform } from "./abstract-platform";

export class DB2Platform extends AbstractPlatform {
  public override createSelectSQLBuilder(): SelectSQLBuilder {
    return new DefaultSelectSQLBuilder(this, "WITH RR USE AND KEEP UPDATE LOCKS", null);
  }

  protected doModifyLimitQuery(query: string, limit: number | null, offset: number): string {
    if (offset > 0) {
      query += ` OFFSET ${offset} ROWS`;
    }

    if (limit !== null) {
      query += ` FETCH NEXT ${limit} ROWS ONLY`;
    }

    return query;
  }
}
