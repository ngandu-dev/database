import { NotSupported } from "../platforms/exception/not-supported";
import { AbstractSchemaManager } from "./abstract-schema-manager";
import type { Column } from "./column";
import type { ForeignKeyConstraint } from "./foreign-key-constraint";
import type { Index } from "./index";
import { View } from "./view";

export class DB2SchemaManager extends AbstractSchemaManager {
  protected getListTableNamesSQL(): string {
    return "SELECT TABNAME FROM SYSCAT.TABLES WHERE TYPE = 'T' AND TABSCHEMA = CURRENT SCHEMA ORDER BY TABNAME";
  }

  protected getListViewNamesSQL(): string {
    return "SELECT VIEWNAME FROM SYSCAT.VIEWS WHERE VIEWSCHEMA = CURRENT SCHEMA ORDER BY VIEWNAME";
  }

  public override async listDatabases(): Promise<string[]> {
    throw NotSupported.new("DB2SchemaManager.listDatabases");
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
}
