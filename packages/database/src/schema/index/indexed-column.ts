import { InvalidIndexDefinition } from "../exception/invalid-index-definition";
import { UnqualifiedName } from "../name/unqualified-name";

export class IndexedColumn {
  private readonly columnName: UnqualifiedName;
  private readonly length: number | null;

  constructor(columnName: UnqualifiedName | string, length: number | null = null) {
    this.columnName =
      typeof columnName === "string" ? UnqualifiedName.unquoted(columnName) : columnName;
    this.length = length;

    if (this.length !== null && this.length <= 0) {
      throw InvalidIndexDefinition.fromNonPositiveColumnLength(
        this.columnName.toString(),
        this.length,
      );
    }
  }

  public getColumnName(): UnqualifiedName {
    return this.columnName;
  }

  public getLength(): number | null {
    return this.length;
  }
}
