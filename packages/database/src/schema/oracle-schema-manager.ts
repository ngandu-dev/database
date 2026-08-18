import { AbstractSchemaManager } from "./abstract-schema-manager";
import type { Column } from "./column";
import type { ForeignKeyConstraint } from "./foreign-key-constraint";
import type { Index } from "./index";
import { Sequence } from "./sequence";
import { View } from "./view";

export class OracleSchemaManager extends AbstractSchemaManager {
  public async createDatabase(database: string): Promise<void> {
    let statement = this.platform.getCreateDatabaseSQL(database);
    const params = this.connection.getParams();
    const password = params.password;

    if (typeof password === "string" && password.length > 0) {
      statement += ` IDENTIFIED BY ${this.connection.quoteSingleIdentifier(password)}`;
    }

    await this.connection.executeStatement(statement);
    await this.connection.executeStatement(`GRANT DBA TO ${database}`);
  }

  public async dropTable(name: string): Promise<void> {
    // Oracle autoincrement/sequence cleanup is not ported yet; keep the override for API parity.
    await super.dropTable(name);
  }

  protected getListTableNamesSQL(): string {
    return "SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME";
  }

  protected getListViewNamesSQL(): string {
    return "SELECT VIEW_NAME FROM USER_VIEWS ORDER BY VIEW_NAME";
  }

  protected override normalizeName(name: string): string {
    return super.normalizeName(name);
  }

  protected override async selectTableColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    return super.selectTableColumns(databaseName, tableName);
  }

  protected override async selectTableNames(
    databaseName: string,
  ): Promise<Record<string, unknown>[]> {
    return super.selectTableNames(databaseName);
  }

  protected override async selectIndexColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    return super.selectIndexColumns(databaseName, tableName);
  }

  protected override async selectForeignKeyColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    return super.selectForeignKeyColumns(databaseName, tableName);
  }

  protected override async fetchTableOptionsByTable(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, Record<string, unknown>>> {
    return super.fetchTableOptionsByTable(databaseName, tableName);
  }

  protected override _getPortableDatabaseDefinition(database: Record<string, unknown>): string {
    return super._getPortableDatabaseDefinition(database);
  }

  protected override _getPortableSequenceDefinition(sequence: Record<string, unknown>): Sequence {
    return super._getPortableSequenceDefinition(sequence);
  }

  protected override _getPortableTableColumnDefinition(
    tableColumn: Record<string, unknown>,
  ): Column {
    return super._getPortableTableColumnDefinition(tableColumn);
  }

  protected override _getPortableTableDefinition(table: Record<string, unknown>): string {
    return super._getPortableTableDefinition(table);
  }

  protected override _getPortableTableForeignKeyDefinition(
    tableForeignKey: Record<string, unknown>,
  ): ForeignKeyConstraint {
    return super._getPortableTableForeignKeyDefinition(tableForeignKey);
  }

  protected override _getPortableTableForeignKeysList(
    rows: Record<string, unknown>[],
  ): ForeignKeyConstraint[] {
    return super._getPortableTableForeignKeysList(rows);
  }

  protected override _getPortableTableIndexesList(
    rows: Record<string, unknown>[],
    tableName: string,
  ): Index[] {
    return super._getPortableTableIndexesList(rows, tableName);
  }

  protected override _getPortableViewDefinition(view: Record<string, unknown>): View {
    return super._getPortableViewDefinition(view);
  }

  protected async dropAutoincrement(_table: string): Promise<void> {}
}
