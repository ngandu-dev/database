import { AbstractAsset } from "./abstract-asset";
import { OptionallyQualifiedName } from "./name/optionally-qualified-name";
import type { OptionallyQualifiedNameParser } from "./name/parser/optionally-qualified-name-parser";
import { Parsers } from "./name/parsers";
import { SequenceEditor } from "./sequence-editor";
import { Table } from "./table";

export class Sequence extends AbstractAsset {
  constructor(
    name: string,
    private allocationSize: number = 1,
    private initialValue: number = 1,
    private cacheSize: number | null = null,
  ) {
    super(name);
  }

  public getAllocationSize(): number {
    return this.allocationSize;
  }

  public getInitialValue(): number {
    return this.initialValue;
  }

  public getCacheSize(): number | null {
    return this.cacheSize;
  }

  public getObjectName(): OptionallyQualifiedName {
    return this.getNameParser().parse(this.getName());
  }

  public setAllocationSize(allocationSize: number): this {
    this.allocationSize = allocationSize;
    return this;
  }

  public setInitialValue(initialValue: number): this {
    this.initialValue = initialValue;
    return this;
  }

  public isAutoIncrementsFor(table: Table): boolean {
    if (!table.hasPrimaryKey()) {
      return false;
    }

    const pkColumns = table.getPrimaryKey().getColumns();
    if (pkColumns.length !== 1) {
      return false;
    }

    const firstPkColumn = pkColumns[0];
    if (firstPkColumn === undefined) {
      return false;
    }

    const column = table.getColumn(firstPkColumn);
    if (!column.getAutoincrement()) {
      return false;
    }

    const defaultNamespace = table.getNamespaceName();
    const sequenceName = this.getShortestName(defaultNamespace);
    const tableName = table.getShortestName(defaultNamespace);
    const tableSequenceName = `${tableName}_${column.getShortestName(defaultNamespace)}_seq`;

    return sequenceName === tableSequenceName;
  }

  public static editor(): SequenceEditor {
    return new SequenceEditor();
  }

  public edit(): SequenceEditor {
    return Sequence.editor()
      .setName(this.getName())
      .setAllocationSize(this.allocationSize)
      .setInitialValue(this.initialValue)
      .setCacheSize(this.cacheSize);
  }

  protected getNameParser(): OptionallyQualifiedNameParser {
    return Parsers.getOptionallyQualifiedNameParser();
  }
}
