import type { Connection } from "../connection";
import { JsonType } from "../types/json-type";
import { AbstractMySQLPlatform } from "./abstract-mysql-platform";
import type { KeywordList } from "./keywords/keyword-list";
import { MariaDBKeywords } from "./keywords/mariadb-keywords";
import { MySQLMetadataProvider } from "./mysql/mysql-metadata-provider";

export class MariaDBPlatform extends AbstractMySQLPlatform {
  public getColumnTypeSQLSnippet(tableAlias: string, databaseName: string): string {
    const subQueryAlias = `i_${tableAlias}`;
    const quotedDatabaseName = this.quoteStringLiteral(databaseName);

    return `IF(
                ${tableAlias}.DATA_TYPE = 'longtext'
                AND EXISTS(
                    SELECT * FROM information_schema.CHECK_CONSTRAINTS ${subQueryAlias}
                    WHERE ${subQueryAlias}.CONSTRAINT_SCHEMA = ${quotedDatabaseName}
                    AND ${subQueryAlias}.TABLE_NAME = ${tableAlias}.TABLE_NAME
                    AND ${subQueryAlias}.CHECK_CLAUSE = CONCAT(
                        'json_valid(\`',
                            ${tableAlias}.COLUMN_NAME,
                        '\`)'
                    )
                ),
                'json',
                ${tableAlias}.DATA_TYPE
            )`;
  }

  public override getColumnDeclarationSQL(name: string, column: Record<string, unknown>): string {
    if (column.type instanceof JsonType && this.getJsonTypeDeclarationSQL({}) === "JSON") {
      const normalized = { ...column };
      delete normalized.collation;
      delete normalized.charset;
      return super.getColumnDeclarationSQL(name, normalized);
    }

    return super.getColumnDeclarationSQL(name, column);
  }

  public override createMetadataProvider(connection: Connection): MySQLMetadataProvider {
    return new MySQLMetadataProvider(connection, this, connection.getDatabase() ?? "");
  }

  protected override createReservedKeywordsList(): KeywordList {
    return new MariaDBKeywords();
  }
}
