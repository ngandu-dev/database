import type { Connection } from "./connection";
import type { Statement as DriverStatement } from "./driver/statement";
import { ParameterType } from "./parameter-type";
import type { AbstractPlatform } from "./platforms/abstract-platform";
import type { QueryParameterTypes, QueryParameters, QueryScalarParameterType } from "./query";
import { Result } from "./result";
import { Type } from "./types/type";

export class Statement {
  private readonly params = new Map<string | number, unknown>();
  private readonly types = new Map<string | number, QueryScalarParameterType>();
  private readonly platform: AbstractPlatform;

  constructor(
    private readonly conn: Connection,
    private readonly stmt: DriverStatement,
    private readonly sql: string,
  ) {
    this.platform = conn.getDatabasePlatform();
  }

  public bindValue(
    param: string | number,
    value: unknown,
    type: QueryScalarParameterType = ParameterType.STRING,
  ): void {
    this.params.set(param, value);
    this.types.set(param, type);

    let bindingType: ParameterType;
    let convertedValue = value;

    if (typeof type === "string" && !this.isParameterType(type)) {
      const datazenType = Type.getType(type);
      convertedValue = datazenType.convertToDatabaseValue(value, this.platform);
      bindingType = datazenType.getBindingType();
    } else if (type instanceof Type) {
      convertedValue = type.convertToDatabaseValue(value, this.platform);
      bindingType = type.getBindingType();
    } else {
      bindingType = type;
    }

    try {
      this.stmt.bindValue(param, convertedValue, bindingType);
    } catch (error) {
      throw this.conn.convertException(error, "bindValue");
    }
  }

  public async executeQuery<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<
    Result<T>
  > {
    return (await this.execute()) as Result<T>;
  }

  public async executeStatement(): Promise<number | string> {
    return (await this.execute()).rowCount();
  }

  public getSQL(): string {
    return this.sql;
  }

  public getWrappedStatement(): DriverStatement {
    return this.stmt;
  }

  private async execute(): Promise<Result> {
    try {
      return new Result(await this.stmt.execute(), this.conn);
    } catch (error) {
      const [params, types] = this.getBoundParameters();
      throw this.conn.convertExceptionDuringQuery(error, this.sql, params, types);
    }
  }

  private getBoundParameters(): [QueryParameters, QueryParameterTypes] {
    let hasNamed = false;
    let hasPositional = false;

    for (const key of this.params.keys()) {
      if (typeof key === "number") {
        hasPositional = true;
      } else {
        hasNamed = true;
      }
    }

    if (!hasNamed) {
      const params: unknown[] = [];
      const types: QueryScalarParameterType[] = [];

      for (const [key, value] of this.params) {
        if (typeof key === "number") {
          params[key] = value;
        }
      }

      for (const [key, value] of this.types) {
        if (typeof key === "number") {
          types[key] = value;
        }
      }

      return [params, types];
    }

    if (!hasPositional) {
      const params: Record<string, unknown> = {};
      const types: Record<string, QueryScalarParameterType> = {};

      for (const [key, value] of this.params) {
        if (typeof key === "string") {
          params[key] = value;
        }
      }

      for (const [key, value] of this.types) {
        if (typeof key === "string") {
          types[key] = value;
        }
      }

      return [params, types];
    }

    const mixedParams: Record<string, unknown> = {};
    const mixedTypes: Record<string, QueryScalarParameterType> = {};

    for (const [key, value] of this.params) {
      mixedParams[String(key)] = value;
    }

    for (const [key, value] of this.types) {
      mixedTypes[String(key)] = value;
    }

    return [mixedParams, mixedTypes];
  }

  private isParameterType(value: string): value is ParameterType {
    return (
      value === ParameterType.NULL ||
      value === ParameterType.INTEGER ||
      value === ParameterType.STRING ||
      value === ParameterType.LARGE_OBJECT ||
      value === ParameterType.BOOLEAN ||
      value === ParameterType.BINARY ||
      value === ParameterType.ASCII
    );
  }
}
