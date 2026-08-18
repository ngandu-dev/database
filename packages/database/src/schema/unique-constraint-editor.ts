import { UniqueConstraint } from "./unique-constraint";

export class UniqueConstraintEditor {
  private name: string | null = null;
  private columnNames: string[] = [];
  private flags: string[] = [];
  private options: Record<string, unknown> = {};

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

  public setUnquotedColumnNames(firstColumnName: string, ...otherColumnNames: string[]): this {
    return this.setColumnNames(firstColumnName, ...otherColumnNames);
  }

  public setQuotedColumnNames(firstColumnName: string, ...otherColumnNames: string[]): this {
    return this.setColumnNames(
      `"${firstColumnName}"`,
      ...otherColumnNames.map((columnName) => `"${columnName}"`),
    );
  }

  public setFlags(...flags: string[]): this {
    this.flags = [...flags];
    return this;
  }

  public setIsClustered(isClustered: boolean): this {
    const normalizedFlags = this.flags.filter((flag) => flag.toLowerCase() !== "clustered");
    if (isClustered) {
      normalizedFlags.push("clustered");
    }

    this.flags = normalizedFlags;
    return this;
  }

  public setOptions(options: Record<string, unknown>): this {
    this.options = { ...options };
    return this;
  }

  public create(): UniqueConstraint {
    return new UniqueConstraint(this.name ?? "", this.columnNames, this.flags, this.options);
  }
}
