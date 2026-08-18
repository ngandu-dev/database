import { registerBuiltInTypes } from "../types/register-built-in-types";
import { Type } from "../types/type";
import { AbstractAsset } from "./abstract-asset";
import { ColumnEditor } from "./column-editor";
import { UnknownColumnOption } from "./exception/unknown-column-option";
import type { UnqualifiedNameParser } from "./name/parser/unqualified-name-parser";
import { Parsers } from "./name/parsers";
import { UnqualifiedName } from "./name/unqualified-name";

export type ColumnOptions = Record<string, unknown>;

export class Column extends AbstractAsset {
  private type: Type;
  private length: number | null = null;
  private precision: number | null = null;
  private scale = 0;
  private unsigned = false;
  private fixed = false;
  private notnull = true;
  private defaultValue: unknown = null;
  private autoincrement = false;
  private values: string[] = [];
  private platformOptions: Record<string, unknown> = {};
  private columnDefinition: string | null = null;
  private comment = "";

  constructor(name: string, type: string | Type, options: ColumnOptions = {}) {
    super(name);
    registerBuiltInTypes();
    this.type = typeof type === "string" ? Type.getType(type) : type;
    this.setOptions(options);
  }

  public setOptions(options: ColumnOptions): this {
    for (const [name, value] of Object.entries(options)) {
      switch (name) {
        case "length":
          this.setLength(asNullableNumber(value));
          break;
        case "precision":
          this.setPrecision(asNullableNumber(value));
          break;
        case "scale":
          this.setScale(asNumber(value, 0));
          break;
        case "unsigned":
          this.setUnsigned(Boolean(value));
          break;
        case "fixed":
          this.setFixed(Boolean(value));
          break;
        case "notnull":
          this.setNotnull(Boolean(value));
          break;
        case "default":
          this.setDefault(value);
          break;
        case "autoincrement":
          this.setAutoincrement(Boolean(value));
          break;
        case "values":
          this.setValues(Array.isArray(value) ? value.map((item) => String(item)) : []);
          break;
        case "columnDefinition":
          this.setColumnDefinition(value === null ? null : String(value));
          break;
        case "comment":
          this.setComment(String(value));
          break;
        case "platformOptions":
          if (value && typeof value === "object" && !Array.isArray(value)) {
            this.setPlatformOptions(value as Record<string, unknown>);
            break;
          }

          this.setPlatformOptions({});
          break;
        case "charset":
        case "collation":
        case "enumType":
        case "jsonb":
        case "version":
        case "default_constraint_name":
        case "min":
        case "max":
          this.setPlatformOption(name, value);
          break;
        default:
          throw UnknownColumnOption.new(name);
      }
    }

    return this;
  }

  public setType(type: Type): this {
    this.type = type;
    return this;
  }

  public getType(): Type {
    return this.type;
  }

  public getObjectName(): UnqualifiedName {
    const parsableName = this.isQuoted()
      ? `"${this.getName().replaceAll('"', '""')}"`
      : this.getName();
    return this.getNameParser().parse(parsableName);
  }

  public setLength(length: number | null): this {
    this.length = length;
    return this;
  }

  public getLength(): number | null {
    return this.length;
  }

  public setPrecision(precision: number | null): this {
    this.precision = precision;
    return this;
  }

  public getPrecision(): number | null {
    return this.precision;
  }

  public setScale(scale: number): this {
    this.scale = scale;
    return this;
  }

  public getScale(): number {
    return this.scale;
  }

  public setUnsigned(unsigned: boolean): this {
    this.unsigned = unsigned;
    return this;
  }

  public getUnsigned(): boolean {
    return this.unsigned;
  }

  public setFixed(fixed: boolean): this {
    this.fixed = fixed;
    return this;
  }

  public getFixed(): boolean {
    return this.fixed;
  }

  public setNotnull(notnull: boolean): this {
    this.notnull = notnull;
    return this;
  }

  public getNotnull(): boolean {
    return this.notnull;
  }

  public setDefault(defaultValue: unknown): this {
    this.defaultValue = defaultValue;
    return this;
  }

  public getDefault(): unknown {
    return this.defaultValue;
  }

  public setAutoincrement(autoincrement: boolean): this {
    this.autoincrement = autoincrement;
    return this;
  }

  public getAutoincrement(): boolean {
    return this.autoincrement;
  }

  public setComment(comment: string): this {
    this.comment = comment;
    return this;
  }

  public getComment(): string {
    return this.comment;
  }

  public setValues(values: string[]): this {
    this.values = [...values];
    return this;
  }

  public getValues(): string[] {
    return [...this.values];
  }

  public setPlatformOptions(platformOptions: Record<string, unknown>): this {
    this.platformOptions = { ...platformOptions };
    return this;
  }

  public setPlatformOption(name: string, value: unknown): this {
    this.platformOptions[name] = value;
    return this;
  }

  public getPlatformOptions(): Record<string, unknown> {
    return { ...this.platformOptions };
  }

  public hasPlatformOption(name: string): boolean {
    return Object.hasOwn(this.platformOptions, name);
  }

  public getPlatformOption(name: string): unknown {
    return this.platformOptions[name];
  }

  public getCharset(): string | null {
    const value = this.platformOptions.charset;
    return typeof value === "string" ? value : null;
  }

  public getCollation(): string | null {
    const value = this.platformOptions.collation;
    return typeof value === "string" ? value : null;
  }

  public getEnumType(): string | null {
    const value = this.platformOptions.enumType;
    return typeof value === "string" ? value : null;
  }

  public getMinimumValue(): unknown {
    return this.platformOptions.min ?? null;
  }

  public getMaximumValue(): unknown {
    return this.platformOptions.max ?? null;
  }

  public getDefaultConstraintName(): string | null {
    const value = this.platformOptions.default_constraint_name;
    return typeof value === "string" ? value : null;
  }

  public setColumnDefinition(columnDefinition: string | null): this {
    this.columnDefinition = columnDefinition;
    return this;
  }

  public getColumnDefinition(): string | null {
    return this.columnDefinition;
  }

  public toArray(): Record<string, unknown> {
    return {
      autoincrement: this.autoincrement,
      columnDefinition: this.columnDefinition,
      comment: this.comment,
      default: this.defaultValue,
      fixed: this.fixed,
      length: this.length,
      name: this.getName(),
      notnull: this.notnull,
      precision: this.precision,
      scale: this.scale,
      type: this.type,
      unsigned: this.unsigned,
      values: this.values,
      ...this.platformOptions,
    };
  }

  public static editor(): ColumnEditor {
    return new ColumnEditor();
  }

  public edit(): ColumnEditor {
    return Column.editor()
      .setName(this.getName())
      .setType(this.type)
      .setLength(this.length)
      .setPrecision(this.precision)
      .setScale(this.scale)
      .setUnsigned(this.unsigned)
      .setFixed(this.fixed)
      .setNotNull(this.notnull)
      .setDefaultValue(this.defaultValue)
      .setAutoincrement(this.autoincrement)
      .setComment(this.comment)
      .setValues(this.values)
      .setCharset(this.getCharset())
      .setCollation(this.getCollation())
      .setMinimumValue(this.getMinimumValue())
      .setMaximumValue(this.getMaximumValue())
      .setEnumType(this.getEnumType())
      .setDefaultConstraintName(this.getDefaultConstraintName())
      .setColumnDefinition(this.columnDefinition);
  }

  protected getNameParser(): UnqualifiedNameParser {
    return Parsers.getUnqualifiedNameParser();
  }
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
