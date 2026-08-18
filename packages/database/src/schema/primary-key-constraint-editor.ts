import { UnqualifiedName } from "./name/unqualified-name";
import { PrimaryKeyConstraint } from "./primary-key-constraint";

export class PrimaryKeyConstraintEditor {
  private name: string | null = null;
  private columnNames: string[] = [];
  private clustered = true;

  public setName(name: string | null): this {
    this.name = name;
    return this;
  }

  public setUnquotedName(name: string): this {
    return this.setName(name);
  }

  public setQuotedName(name: string): this {
    return this.setName(`"${name}"`);
  }

  public setColumnNames(...columnNames: string[]): this {
    this.columnNames = [...columnNames];
    return this;
  }

  public setUnquotedColumnNames(...columnNames: string[]): this {
    return this.setColumnNames(...columnNames);
  }

  public setQuotedColumnNames(...columnNames: string[]): this {
    return this.setColumnNames(...columnNames.map((columnName) => `"${columnName}"`));
  }

  public addColumnName(columnName: string | UnqualifiedName): this {
    this.columnNames.push(typeof columnName === "string" ? columnName : columnName.toString());
    return this;
  }

  public setIsClustered(clustered: boolean): this {
    this.clustered = clustered;
    return this;
  }

  public create(): PrimaryKeyConstraint {
    return new PrimaryKeyConstraint(this.name, this.columnNames, this.clustered);
  }
}
