import { Type } from "@ngandu-dev/database/types";

import { type JsonValue, normalizeJson } from "./json";

type ColumnType = Parameters<typeof Type.lookupName>[0];

interface ColumnLike {
  getName(): string;
  getType(): ColumnType;
  getNotnull(): boolean;
  getDefault(): unknown;
  getLength(): number | null;
  getPrecision(): number | null;
  getScale(): number;
  getUnsigned(): boolean;
  getFixed(): boolean;
  getAutoincrement(): boolean;
  getComment(): string;
  getValues(): string[];
  getCharset(): string | null;
  getCollation(): string | null;
  getPlatformOptions(): Record<string, unknown>;
}

interface IndexLike {
  getName(): string;
  getColumns(): string[];
  getType(): unknown;
  isUnique(): boolean;
  isPrimary(): boolean;
  getFlags(): string[];
  getPredicate(): string | null;
  getOptions(): Record<string, unknown>;
}

interface ForeignKeyLike {
  getName(): string;
  getLocalColumns(): string[];
  getForeignTableName(): string;
  getForeignColumns(): string[];
  onUpdate(): string | null;
  onDelete(): string | null;
  getOptions(): Record<string, unknown>;
}

interface TableLike {
  getName(): string;
  getComment(): string | null;
  getColumns(): ColumnLike[];
  getPrimaryKeyColumns(): string[];
  getIndexes(): IndexLike[];
  getForeignKeys(): ForeignKeyLike[];
  getOptions(): Record<string, unknown>;
}

export function serializeTable(table: TableLike): Record<string, JsonValue> {
  return normalizeJson({
    table: table.getName(),
    comment: table.getComment(),
    columns: table.getColumns().map((column) => ({
      name: column.getName(),
      datazen_type: Type.lookupName(column.getType()),
      nullable: !column.getNotnull(),
      default: column.getDefault(),
      length: column.getLength(),
      precision: column.getPrecision(),
      scale: column.getScale(),
      unsigned: column.getUnsigned(),
      fixed: column.getFixed(),
      autoincrement: column.getAutoincrement(),
      comment: column.getComment(),
      values: column.getValues(),
      charset: column.getCharset(),
      collation: column.getCollation(),
      platform_options: column.getPlatformOptions(),
    })),
    primary_key: table.getPrimaryKeyColumns(),
    indexes: table.getIndexes().map((index) => ({
      name: index.getName(),
      columns: index.getColumns(),
      type: index.getType(),
      unique: index.isUnique(),
      primary: index.isPrimary(),
      flags: index.getFlags(),
      predicate: index.getPredicate(),
      options: index.getOptions(),
    })),
    foreign_keys: table.getForeignKeys().map((foreignKey) => ({
      name: foreignKey.getName(),
      columns: foreignKey.getLocalColumns(),
      referenced_table: foreignKey.getForeignTableName(),
      referenced_columns: foreignKey.getForeignColumns(),
      on_update: foreignKey.onUpdate(),
      on_delete: foreignKey.onDelete(),
      options: foreignKey.getOptions(),
    })),
    options: table.getOptions(),
  }) as Record<string, JsonValue>;
}
