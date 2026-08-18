import type { AbstractPlatform } from "../platforms/abstract-platform";
import { AbstractAsset } from "./abstract-asset";
import { InvalidState } from "./exception/invalid-state";
import { Deferrability } from "./foreign-key-constraint/deferrability";
import { MatchType } from "./foreign-key-constraint/match-type";
import { ReferentialAction } from "./foreign-key-constraint/referential-action";
import { ForeignKeyConstraintEditor } from "./foreign-key-constraint-editor";
import { Identifier } from "./identifier";
import { Index } from "./index";
import { OptionallyQualifiedName } from "./name/optionally-qualified-name";
import type { UnqualifiedNameParser } from "./name/parser/unqualified-name-parser";
import { Parsers } from "./name/parsers";
import { UnqualifiedName } from "./name/unqualified-name";

export class ForeignKeyConstraint extends AbstractAsset {
  private readonly localColumns: Identifier[];
  private readonly foreignColumns: Identifier[];

  constructor(
    localColumnNames: string[],
    private readonly foreignTableName: string,
    foreignColumnNames: string[],
    name: string | null = null,
    private readonly options: Record<string, unknown> = {},
    private localTableName: string | null = null,
  ) {
    super(name ?? "");
    this.localColumns = localColumnNames.map((columnName) => new Identifier(columnName));
    this.foreignColumns = foreignColumnNames.map((columnName) => new Identifier(columnName));
  }

  public getLocalTableName(): string | null {
    return this.localTableName;
  }

  public getObjectName(): UnqualifiedName | null {
    const name = this.getName();
    if (name.length === 0) {
      return null;
    }

    const parsableName = this.isQuoted() ? `"${name.replaceAll('"', '""')}"` : name;
    return this.getNameParser().parse(parsableName);
  }

  public setLocalTableName(localTableName: string): this {
    this.localTableName = localTableName;
    return this;
  }

  public getForeignTableName(): string {
    return this.foreignTableName;
  }

  public getReferencedTableName(): OptionallyQualifiedName {
    try {
      return Parsers.getOptionallyQualifiedNameParser().parse(this.foreignTableName);
    } catch {
      throw InvalidState.foreignKeyConstraintHasInvalidReferencedTableName(this.getName());
    }
  }

  public getColumns(): string[] {
    return validateForeignKeyColumnNames(
      this.localColumns.map((column) => formatIdentifierName(column)),
      () => InvalidState.foreignKeyConstraintHasInvalidReferencingColumnNames(this.getName()),
    );
  }

  public getReferencingColumnNames(): string[] {
    return this.getColumns();
  }

  public getLocalColumns(): string[] {
    return this.getColumns();
  }

  public getQuotedLocalColumns(platform: AbstractPlatform): string[] {
    return this.localColumns.map((column) => column.getQuotedName(platform));
  }

  public getForeignColumns(): string[] {
    return validateForeignKeyColumnNames(
      this.foreignColumns.map((column) => formatIdentifierName(column)),
      () => InvalidState.foreignKeyConstraintHasInvalidReferencedColumnNames(this.getName()),
    );
  }

  public getReferencedColumnNames(): string[] {
    return this.getForeignColumns();
  }

  public getUnquotedLocalColumns(): string[] {
    return this.getLocalColumns().map((column) => this.trimQuotes(column));
  }

  public getUnquotedForeignColumns(): string[] {
    return this.getForeignColumns().map((column) => this.trimQuotes(column));
  }

  public getUnqualifiedForeignTableName(): string {
    const name = this.foreignTableName.split(".").at(-1) ?? this.foreignTableName;
    return this.trimQuotes(name).toLowerCase();
  }

  public getQuotedForeignTableName(platform: AbstractPlatform): string {
    return new Identifier(this.foreignTableName).getQuotedName(platform);
  }

  public getQuotedForeignColumns(platform: AbstractPlatform): string[] {
    return this.foreignColumns.map((column) => column.getQuotedName(platform));
  }

  public onUpdate(): string | null {
    return normalizeReferentialActionString(this.options.onUpdate);
  }

  public onDelete(): string | null {
    return normalizeReferentialActionString(this.options.onDelete);
  }

  public getOnUpdateAction(): ReferentialAction {
    return parseReferentialAction(this.options.onUpdate, () =>
      InvalidState.foreignKeyConstraintHasInvalidOnUpdateAction(this.getName()),
    );
  }

  public getOnDeleteAction(): ReferentialAction {
    return parseReferentialAction(this.options.onDelete, () =>
      InvalidState.foreignKeyConstraintHasInvalidOnDeleteAction(this.getName()),
    );
  }

  public getMatchType(): MatchType {
    return parseMatchType(this.options.match, () =>
      InvalidState.foreignKeyConstraintHasInvalidMatchType(this.getName()),
    );
  }

  public getDeferrability(): Deferrability {
    const isDeferred = this.options.deferred !== undefined && this.options.deferred !== false;
    const isDeferrable =
      this.options.deferrable !== undefined ? this.options.deferrable !== false : isDeferred;

    if (isDeferred && !isDeferrable) {
      throw InvalidState.foreignKeyConstraintHasInvalidDeferrability(this.getName());
    }

    if (isDeferred) {
      return Deferrability.DEFERRED;
    }

    return isDeferrable ? Deferrability.DEFERRABLE : Deferrability.NOT_DEFERRABLE;
  }

  public hasOption(name: string): boolean {
    const value = this.options[name];
    return value !== undefined && value !== null;
  }

  public getOption(name: string): unknown {
    return this.options[name];
  }

  public getOptions(): Record<string, unknown> {
    return { ...this.options };
  }

  public intersectsIndexColumns(indexOrColumnNames: Index | string[]): boolean {
    const local = this.getColumns().map(normalize);
    const columnNames = Array.isArray(indexOrColumnNames)
      ? indexOrColumnNames
      : indexOrColumnNames.getColumns();
    const columns = columnNames.map(normalize);

    return columns.some((column) => local.includes(column));
  }

  public static editor(): ForeignKeyConstraintEditor {
    return new ForeignKeyConstraintEditor();
  }

  public edit(): ForeignKeyConstraintEditor {
    const editor = ForeignKeyConstraint.editor()
      .setName(this.getName())
      .setReferencingColumnNames(...this.getColumns())
      .setReferencedTableName(this.foreignTableName)
      .setReferencedColumnNames(...this.getForeignColumns())
      .setOptions(this.getOptions())
      .setLocalTableName(this.localTableName);

    editor.setOnUpdate(this.onUpdate());
    editor.setOnDelete(this.onDelete());

    return editor;
  }

  protected getNameParser(): UnqualifiedNameParser {
    return Parsers.getUnqualifiedNameParser();
  }
}

function normalize(identifier: string): string {
  return identifier.replaceAll(/[`"[\]]/g, "").toLowerCase();
}

function normalizeReferentialActionString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toUpperCase();
  if (normalized === ReferentialAction.NO_ACTION || normalized === ReferentialAction.RESTRICT) {
    return null;
  }

  return normalized;
}

function parseMatchType(value: unknown, onInvalid?: () => Error): MatchType {
  if (typeof value === "string") {
    const normalized = value.toUpperCase();
    if (normalized === MatchType.FULL) {
      return MatchType.FULL;
    }

    if (normalized === MatchType.PARTIAL) {
      return MatchType.PARTIAL;
    }

    if (normalized === MatchType.SIMPLE) {
      return MatchType.SIMPLE;
    }

    if (onInvalid !== undefined) {
      throw onInvalid();
    }
  }

  return MatchType.SIMPLE;
}

function parseReferentialAction(value: unknown, onInvalid?: () => Error): ReferentialAction {
  if (typeof value === "string") {
    const normalized = value.toUpperCase();
    for (const action of Object.values(ReferentialAction)) {
      if (normalized === action) {
        return action;
      }
    }

    if (onInvalid !== undefined) {
      throw onInvalid();
    }
  }

  return ReferentialAction.NO_ACTION;
}

function validateForeignKeyColumnNames(
  names: string[],
  errorFactory: () => InvalidState,
): string[] {
  if (names.length === 0) {
    throw errorFactory();
  }

  const parser = Parsers.getUnqualifiedNameParser();

  try {
    for (const name of names) {
      parser.parse(name);
    }
  } catch {
    throw errorFactory();
  }

  return names;
}

function formatIdentifierName(identifier: Identifier): string {
  const name = identifier.getName();
  if (!identifier.isQuoted()) {
    return name;
  }

  return `"${name.replaceAll('"', '""')}"`;
}
