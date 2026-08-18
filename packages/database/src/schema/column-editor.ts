import { registerBuiltInTypes } from "../types/register-built-in-types";
import { Type } from "../types/type";
import { Column } from "./column";
import { InvalidColumnDefinition } from "./exception/invalid-column-definition";

export class ColumnEditor {
  private name: string | null = null;
  private type: Type | null = null;
  private options: Record<string, unknown> = {};

  public setName(name: string): this {
    this.name = name;
    return this;
  }

  public setUnquotedName(name: string): this {
    return this.setName(name);
  }

  public setQuotedName(name: string): this {
    return this.setName(`"${name}"`);
  }

  public setType(type: Type): this {
    this.type = type;
    return this;
  }

  public setTypeName(typeName: string): this {
    registerBuiltInTypes();
    this.type = Type.getType(typeName);
    return this;
  }

  public setLength(length: number | null): this {
    this.options.length = length;
    return this;
  }

  public setPrecision(precision: number | null): this {
    this.options.precision = precision;
    return this;
  }

  public setScale(scale: number): this {
    this.options.scale = scale;
    return this;
  }

  public setUnsigned(unsigned: boolean): this {
    this.options.unsigned = unsigned;
    return this;
  }

  public setFixed(fixed: boolean): this {
    this.options.fixed = fixed;
    return this;
  }

  public setNotNull(notNull: boolean): this {
    this.options.notnull = notNull;
    return this;
  }

  public setDefaultValue(defaultValue: unknown): this {
    this.options.default = defaultValue;
    return this;
  }

  public setMinimumValue(minimumValue: unknown): this {
    this.options.min = minimumValue;
    return this;
  }

  public setMaximumValue(maximumValue: unknown): this {
    this.options.max = maximumValue;
    return this;
  }

  public setEnumType(enumType: string | null): this {
    this.options.enumType = enumType;
    return this;
  }

  public setAutoincrement(autoincrement: boolean): this {
    this.options.autoincrement = autoincrement;
    return this;
  }

  public setComment(comment: string): this {
    this.options.comment = comment;
    return this;
  }

  public setValues(values: string[]): this {
    this.options.values = [...values];
    return this;
  }

  public setCharset(charset: string | null): this {
    this.options.charset = charset;
    return this;
  }

  public setCollation(collation: string | null): this {
    this.options.collation = collation;
    return this;
  }

  public setDefaultConstraintName(defaultConstraintName: string | null): this {
    this.options.default_constraint_name = defaultConstraintName;
    return this;
  }

  public setColumnDefinition(columnDefinition: string | null): this {
    this.options.columnDefinition = columnDefinition;
    return this;
  }

  public create(): Column {
    if (this.name === null) {
      throw InvalidColumnDefinition.nameNotSpecified();
    }

    if (this.type === null) {
      throw InvalidColumnDefinition.dataTypeNotSpecified(this.name);
    }

    return new Column(this.name, this.type, this.options);
  }
}
