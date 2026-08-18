import { PostgreSQLPlatform } from "./postgresql-platform";

export class PostgreSQL120Platform extends PostgreSQLPlatform {
  public getDefaultColumnValueSQLSnippet(): string {
    return [
      "SELECT",
      "    CASE",
      "        WHEN a.attgenerated = 's' THEN NULL",
      "        ELSE pg_get_expr(adbin, adrelid)",
      "    END",
      " FROM pg_attrdef",
      " WHERE c.oid = pg_attrdef.adrelid",
      "    AND pg_attrdef.adnum=a.attnum",
    ].join("\n");
  }
}
