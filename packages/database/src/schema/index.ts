import type { AbstractPlatform } from "../platforms/abstract-platform";
import { AbstractAsset } from "./abstract-asset";
import { InvalidState } from "./exception/invalid-state";
import { Identifier } from "./identifier";
import { IndexType } from "./index/index-type";
import { IndexedColumn } from "./index/indexed-column";
import { IndexEditor } from "./index-editor";
import type { UnqualifiedNameParser } from "./name/parser/unqualified-name-parser";
import { Parsers } from "./name/parsers";
import { UnqualifiedName } from "./name/unqualified-name";

export class Index extends AbstractAsset {
  private readonly columns: Identifier[] = [];
  private readonly unique: boolean;
  private readonly primary: boolean;
  private readonly flags = new Set<string>();

  constructor(
    name: string | null,
    columns: string[],
    isUnique = false,
    isPrimary = false,
    flags: string[] = [],
    private readonly options: Record<string, unknown> = {},
  ) {
    super(name ?? "");

    this.unique = isUnique || isPrimary;
    this.primary = isPrimary;

    for (const column of columns) {
      this._addColumn(column);
    }

    for (const flag of flags) {
      this.flags.add(flag.toLowerCase());
    }
  }

  public getColumns(): string[] {
    return this.columns.map((column) => column.getName());
  }

  public getObjectName(): UnqualifiedName {
    const parsableName = this.isQuoted()
      ? `"${this.getName().replaceAll('"', '""')}"`
      : this.getName();
    return this.getNameParser().parse(parsableName);
  }

  public getQuotedColumns(platform: AbstractPlatform): string[] {
    const lengths = Array.isArray(this.options.lengths) ? this.options.lengths : [];

    return this.columns.map((column, index) => {
      const length = lengths[index];
      const quoted = column.getQuotedName(platform);

      if (typeof length === "number") {
        return `${quoted}(${length})`;
      }

      return quoted;
    });
  }

  public getUnquotedColumns(): string[] {
    return this.getColumns().map((column) => column.replaceAll(/[`"[\]]/g, ""));
  }

  public getIndexedColumns(): IndexedColumn[] {
    if (this.columns.length === 0) {
      throw InvalidState.indexHasInvalidColumns(this.getName());
    }

    const parser = Parsers.getUnqualifiedNameParser();
    const lengths = Array.isArray(this.options.lengths) ? this.options.lengths : [];

    return this.columns.map((column, index) => {
      const rawLength = lengths[index];
      const length = parseIndexedColumnLength(rawLength);

      if (this.primary && length !== null) {
        throw InvalidState.indexHasInvalidColumns(this.getName());
      }

      try {
        const parsableName = column.isQuoted()
          ? `"${column.getName().replaceAll('"', '""')}"`
          : column.getName();
        return new IndexedColumn(parser.parse(parsableName), length);
      } catch {
        throw InvalidState.indexHasInvalidColumns(this.getName());
      }
    });
  }

  public getType(): IndexType {
    const hasFulltext = this.hasFlag("fulltext");
    const hasSpatial = this.hasFlag("spatial");
    const conflictingTypeMarkers =
      Number(this.unique) + Number(hasFulltext) + Number(hasSpatial) > 1;
    if (conflictingTypeMarkers) {
      throw InvalidState.indexHasInvalidType(this.getName());
    }

    if (this.unique) {
      return IndexType.UNIQUE;
    }

    if (this.hasFlag("fulltext")) {
      return IndexType.FULLTEXT;
    }

    if (this.hasFlag("spatial")) {
      return IndexType.SPATIAL;
    }

    return IndexType.REGULAR;
  }

  public isClustered(): boolean {
    return this.hasFlag("clustered");
  }

  public getPredicate(): string | null {
    const predicate = this.readOption("where");
    if (predicate === undefined || predicate === null) {
      return null;
    }

    if (typeof predicate === "string") {
      if (predicate.length === 0) {
        throw InvalidState.indexHasInvalidPredicate(this.getName());
      }

      return predicate;
    }

    return null;
  }

  public isSimpleIndex(): boolean {
    return !this.primary && !this.unique;
  }

  public isUnique(): boolean {
    return this.unique;
  }

  public isPrimary(): boolean {
    return this.primary;
  }

  public hasColumnAtPosition(name: string, pos = 0): boolean {
    const normalized = normalizeIdentifier(name);
    return normalizeIdentifier(this.getColumns()[pos] ?? "") === normalized;
  }

  public spansColumns(columnNames: string[]): boolean {
    const ownColumns = this.getColumns();
    if (ownColumns.length !== columnNames.length) {
      return false;
    }

    return ownColumns.every((column, index) => {
      const other = columnNames[index];
      if (other === undefined) {
        return false;
      }

      return normalizeIdentifier(column) === normalizeIdentifier(other);
    });
  }

  public isFulfilledBy(index: Index): boolean {
    if (this.columns.length !== index.columns.length) {
      return false;
    }

    if (!samePartialIndex(this, index)) {
      return false;
    }

    if (!hasSameColumnLengths(this.options, index.options)) {
      return false;
    }

    if (this.isUnique() && !index.isUnique()) {
      return false;
    }

    if (this.isPrimary() && !index.isPrimary()) {
      return false;
    }

    return this.spansColumns(index.getColumns());
  }

  public addFlag(flag: string): this {
    this.flags.add(flag.toLowerCase());
    return this;
  }

  public hasFlag(flag: string): boolean {
    return this.flags.has(flag.toLowerCase());
  }

  public getFlags(): string[] {
    return [...this.flags];
  }

  public removeFlag(flag: string): void {
    this.flags.delete(flag.toLowerCase());
  }

  public hasOption(name: string): boolean {
    return this.readOption(name) !== undefined;
  }

  public getOption(name: string): unknown {
    return this.readOption(name);
  }

  public getOptions(): Record<string, unknown> {
    return { ...this.options };
  }

  public overrules(other: Index): boolean {
    if (other.isPrimary()) {
      return false;
    }

    if (this.isSimpleIndex() && other.isUnique()) {
      return false;
    }

    return (
      this.spansColumns(other.getColumns()) &&
      (this.isPrimary() || this.isUnique()) &&
      this.getPredicate() === other.getPredicate()
    );
  }

  public static editor(): IndexEditor {
    return new IndexEditor();
  }

  public edit(): IndexEditor {
    return Index.editor()
      .setName(this.getName())
      .setColumns(...this.getColumns())
      .setIsUnique(this.unique)
      .setIsPrimary(this.primary)
      .setFlags(...this.getFlags())
      .setOptions(this.getOptions());
  }

  protected getNameParser(): UnqualifiedNameParser {
    return Parsers.getUnqualifiedNameParser();
  }

  protected _addColumn(column: string): void {
    const existingIndex = this.columns.findIndex((existing) => existing.getName() === column);
    const identifier = new Identifier(column);

    if (existingIndex === -1) {
      this.columns.push(identifier);
      return;
    }

    this.columns[existingIndex] = identifier;
  }

  private readOption(name: string): unknown {
    if (Object.hasOwn(this.options, name)) {
      return this.options[name];
    }

    const lower = name.toLowerCase();
    if (Object.hasOwn(this.options, lower)) {
      return this.options[lower];
    }

    return undefined;
  }
}

function normalizeIdentifier(identifier: string): string {
  return identifier.replaceAll(/[`"[\]]/g, "").toLowerCase();
}

function parseIndexedColumnLength(rawLength: unknown): number | null {
  if (rawLength === undefined || rawLength === null) {
    return null;
  }

  if (typeof rawLength === "number") {
    return rawLength;
  }

  if (typeof rawLength === "string" && rawLength.trim().length > 0) {
    const coerced = Number.parseInt(rawLength, 10);
    if (Number.isFinite(coerced)) {
      return coerced;
    }
  }

  return null;
}

function samePartialIndex(left: Index, right: Index): boolean {
  const leftHasPredicate = left.hasOption("where");
  const rightHasPredicate = right.hasOption("where");

  if (leftHasPredicate && rightHasPredicate) {
    return left.getOption("where") === right.getOption("where");
  }

  return !leftHasPredicate && !rightHasPredicate;
}

function hasSameColumnLengths(
  leftOptions: Record<string, unknown>,
  rightOptions: Record<string, unknown>,
): boolean {
  const leftLengths = nonNullLengthsByIndex(leftOptions.lengths);
  const rightLengths = nonNullLengthsByIndex(rightOptions.lengths);

  if (leftLengths.size !== rightLengths.size) {
    return false;
  }

  for (const [index, length] of leftLengths) {
    if (rightLengths.get(index) !== length) {
      return false;
    }
  }

  return true;
}

function nonNullLengthsByIndex(rawLengths: unknown): Map<number, number> {
  const result = new Map<number, number>();
  if (!Array.isArray(rawLengths)) {
    return result;
  }

  for (const [index, rawLength] of rawLengths.entries()) {
    const length = parseIndexedColumnLength(rawLength);
    if (length !== null) {
      result.set(index, length);
    }
  }

  return result;
}
