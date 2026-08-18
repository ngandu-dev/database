import { Comparator as BaseComparator } from "../../schema/comparator";
import type { ComparatorConfig } from "../../schema/comparator-config";
import { Table } from "../../schema/table";
import type { TableDiff } from "../../schema/table-diff";
import { Type } from "../../types/type";
import { Types } from "../../types/types";
import type { AbstractMySQLPlatform } from "../abstract-mysql-platform";
import type { DefaultTableOptions } from "./default-table-options";

type CharsetMetadataLookup = {
  getDefaultCharsetCollation(charset: string): string | null;
};

type CollationMetadataLookup = {
  getCollationCharset(collation: string): string | null;
};

export class Comparator extends BaseComparator {
  public constructor(
    private readonly mysqlPlatform: AbstractMySQLPlatform,
    private readonly charsetMetadataProvider: CharsetMetadataLookup,
    private readonly collationMetadataProvider: CollationMetadataLookup,
    private readonly defaultTableOptions: DefaultTableOptions,
    config?: ComparatorConfig,
  ) {
    super(mysqlPlatform, config);
  }

  public override compareTables(oldTable: Table, newTable: Table): TableDiff | null {
    return super.compareTables(this.normalizeTable(oldTable), this.normalizeTable(newTable));
  }

  private normalizeTable(table: Table): Table {
    const normalized = cloneTable(table);
    const tableOptions = normalized.getOptions();

    let charset = asString(tableOptions.charset);
    let collation = asString(tableOptions.collation);

    if (charset === null && collation !== null) {
      charset = this.collationMetadataProvider.getCollationCharset(collation);
    } else if (charset !== null && collation === null) {
      collation = this.charsetMetadataProvider.getDefaultCharsetCollation(charset);
    } else if (charset === null && collation === null) {
      charset = this.defaultTableOptions.getCharset();
      collation = this.defaultTableOptions.getCollation();
    }

    for (const column of normalized.getColumns()) {
      const original = column.getPlatformOptions();
      const next = this.normalizeColumnOptions(original);

      if (this.isMariaDbJsonColumn(column)) {
        delete next.charset;
        delete next.collation;
      }

      if (charset !== null && next.charset === charset) {
        delete next.charset;
      }

      if (collation !== null && next.collation === collation) {
        delete next.collation;
      }

      if (!shallowEqualRecord(original, next)) {
        column.setPlatformOptions(next);
      }
    }

    return normalized;
  }

  private normalizeColumnOptions(options: Record<string, unknown>): Record<string, unknown> {
    const normalized = { ...options };
    const charset = asString(normalized.charset);
    const collation = asString(normalized.collation);

    if (charset !== null && collation === null) {
      normalized.collation = this.charsetMetadataProvider.getDefaultCharsetCollation(charset);
    } else if (charset === null && collation !== null) {
      normalized.charset = this.collationMetadataProvider.getCollationCharset(collation);
    }

    return normalized;
  }

  private isMariaDbJsonColumn(column: { getType(): unknown }): boolean {
    if (!this.mysqlPlatform.constructor.name.includes("MariaDB")) {
      return false;
    }

    try {
      return (
        Type.lookupName(column.getType() as Parameters<typeof Type.lookupName>[0]) === Types.JSON
      );
    } catch {
      return false;
    }
  }
}

function cloneTable(table: Table): Table {
  const editor = Table.editor()
    .setName(table.getName())
    .setColumns(...table.getColumns().map((column) => column.edit().create()))
    .setIndexes(...table.getIndexes().map((index) => index.edit().create()))
    .setForeignKeyConstraints(...table.getForeignKeys().map((fk) => fk.edit().create()))
    .setUniqueConstraints(...table.getUniqueConstraints().map((uq) => uq.edit().create()))
    .setOptions(table.getOptions());

  if (table.getComment() !== null) {
    editor.setComment(table.getComment() ?? "");
  }

  const primaryKeyConstraint = table.getPrimaryKeyConstraint();
  if (primaryKeyConstraint !== null) {
    editor.setPrimaryKeyConstraint(primaryKeyConstraint.edit().create());
  }

  const cloned = editor.create();
  const renamedColumns = table.getRenamedColumns();
  if (Object.keys(renamedColumns).length > 0) {
    (cloned as unknown as { renamedColumns: Record<string, string> }).renamedColumns = {
      ...renamedColumns,
    };
  }

  return cloned;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function shallowEqualRecord(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every(
    (key, index) => key === rightKeys[index] && Object.is(left[key], right[key]),
  );
}
