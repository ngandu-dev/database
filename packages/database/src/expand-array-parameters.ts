import { ArrayParameterType } from "./array-parameter-type";
import { MissingNamedParameter } from "./array-parameters/exception/missing-named-parameter";
import { MissingPositionalParameter } from "./array-parameters/exception/missing-positional-parameter";
import type {
  QueryParameterType,
  QueryParameterTypes,
  QueryParameters,
  QueryScalarParameterType,
} from "./query";
import type { Visitor } from "./sql/parser/visitor";

export class ExpandArrayParameters implements Visitor {
  private originalParameterIndex: number = 0;
  private readonly convertedSQL: string[] = [];
  private readonly convertedParameters: unknown[] = [];
  private readonly convertedTypes: QueryScalarParameterType[] = [];

  constructor(
    private readonly parameters: QueryParameters,
    private readonly types: QueryParameterTypes,
  ) {}

  public acceptPositionalParameter(_sql: string): void {
    const index: number = this.originalParameterIndex;
    if (!Object.hasOwn(this.parameters, index)) {
      throw MissingPositionalParameter.new(index);
    }

    this.acceptParameter(index, (this.parameters as unknown[])[index]);
    this.originalParameterIndex += 1;
  }

  public acceptNamedParameter(sql: string): void {
    const name = sql.slice(1);
    if (!Object.hasOwn(this.parameters, name)) {
      throw MissingNamedParameter.new(name);
    }

    this.acceptParameter(name, (this.parameters as Record<string, unknown>)[name]);
  }

  public acceptOther(sql: string): void {
    this.convertedSQL.push(sql);
  }

  public acceptEscapedQuestionMark(_sql: string): void {
    // Preserve the DBAL escaped question mark token across this parse pass so a
    // later driver-specific placeholder conversion pass can still distinguish it
    // from a real positional placeholder.
    this.convertedSQL.push("??");
  }

  public getSQL(): string {
    return this.convertedSQL.join("");
  }

  public getParameters(): unknown[] {
    return this.convertedParameters;
  }

  public getTypes(): QueryScalarParameterType[] {
    return this.convertedTypes;
  }

  private acceptParameter(key: number | string, value: unknown): void {
    const type = this.readType(key);
    if (type === undefined) {
      this.convertedSQL.push("?");
      this.convertedParameters.push(value);
      return;
    }

    if (!this.isArrayParameterType(type)) {
      this.appendTypedParameter([value], type);
      return;
    }

    const values = value as unknown[];
    if (values.length === 0) {
      this.convertedSQL.push("NULL");
      return;
    }

    this.appendTypedParameter(values, ArrayParameterType.toElementParameterType(type));
  }

  private readType(key: number | string): QueryParameterType | undefined {
    if (Array.isArray(this.types)) {
      if (typeof key !== "number" || !Object.hasOwn(this.types, key)) {
        return undefined;
      }

      return this.types[key];
    }

    if (!Object.hasOwn(this.types, key)) {
      return undefined;
    }

    return (this.types as Record<string, QueryParameterType>)[String(key)];
  }

  private appendTypedParameter(values: unknown[], type: QueryScalarParameterType): void {
    this.convertedSQL.push(new Array(values.length).fill("?").join(", "));

    let index = this.convertedParameters.length;
    for (const value of values) {
      this.convertedParameters.push(value);
      this.convertedTypes[index] = type;
      index += 1;
    }
  }

  private isArrayParameterType(type: QueryParameterType): type is ArrayParameterType {
    return (
      type === ArrayParameterType.INTEGER ||
      type === ArrayParameterType.STRING ||
      type === ArrayParameterType.ASCII ||
      type === ArrayParameterType.BINARY
    );
  }
}
