import type { AbstractPlatform } from "../platforms/abstract-platform";
import { InvalidState } from "./exception/invalid-state";
import { InvalidUniqueConstraintDefinition } from "./exception/invalid-unique-constraint-definition";
import { Identifier } from "./identifier";
import type { UnqualifiedNameParser } from "./name/parser/unqualified-name-parser";
import { Parsers } from "./name/parsers";
import { UniqueConstraintEditor } from "./unique-constraint-editor";

export class UniqueConstraint {
  private readonly columns: Identifier[];
  private readonly flags = new Set<string>();

  constructor(
    private readonly name: string,
    columns: string[],
    flags: string[] = [],
    private readonly options: Record<string, unknown> = {},
  ) {
    if (columns.length === 0) {
      throw InvalidUniqueConstraintDefinition.columnNamesAreNotSet(name);
    }

    this.columns = columns.map((column) => new Identifier(column));
    for (const flag of flags) {
      this.flags.add(flag.toLowerCase());
    }
  }

  public getObjectName(): string | null {
    return this.name.length > 0 ? this.name : null;
  }

  public getColumnNames(): string[] {
    if (this.columns.length === 0) {
      throw InvalidState.uniqueConstraintHasEmptyColumnNames(this.name);
    }

    const parser = Parsers.getUnqualifiedNameParser();

    try {
      for (const column of this.columns) {
        parser.parse(column.getName());
      }
    } catch {
      throw InvalidState.uniqueConstraintHasInvalidColumnNames(this.name);
    }

    return this.columns.map((column) => column.getName());
  }

  public getColumns(): string[] {
    return this.getColumnNames();
  }

  public getQuotedColumns(platform: AbstractPlatform): string[] {
    return this.columns.map((column) => column.getQuotedName(platform));
  }

  public getUnquotedColumns(): string[] {
    return this.columns.map((column) => column.getName().replaceAll(/[`"[\]]/g, ""));
  }

  public isClustered(): boolean {
    return this.hasFlag("clustered");
  }

  public addFlag(flag: string): this {
    this.flags.add(flag.toLowerCase());
    return this;
  }

  public hasFlag(flag: string): boolean {
    return this.flags.has(flag.toLowerCase());
  }

  public removeFlag(flag: string): void {
    this.flags.delete(flag.toLowerCase());
  }

  public getFlags(): string[] {
    return [...this.flags];
  }

  public hasOption(name: string): boolean {
    return Object.hasOwn(this.options, name.toLowerCase());
  }

  public getOption(name: string): unknown {
    return this.options[name.toLowerCase()];
  }

  public getOptions(): Record<string, unknown> {
    return { ...this.options };
  }

  public static editor(): UniqueConstraintEditor {
    return new UniqueConstraintEditor();
  }

  public edit(): UniqueConstraintEditor {
    return UniqueConstraint.editor()
      .setName(this.getObjectName())
      .setColumnNames(...this.getColumnNames())
      .setFlags(...this.getFlags())
      .setOptions(this.getOptions());
  }

  protected addColumn(column: string): void {
    this.columns.push(new Identifier(column));
  }

  protected getNameParser(): UnqualifiedNameParser {
    return Parsers.getUnqualifiedNameParser();
  }
}
