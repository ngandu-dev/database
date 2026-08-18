import { ParameterType } from "../../parameter-type";
import type { Result as DriverResult } from "../result";
import type { Statement as DriverStatement } from "../statement";
import type { MSSQLConnection } from "./connection";

type MSSQLTypedParameter = {
  typeHint: "varbinary" | "varchar";
  value: unknown;
  length?: number;
};

export class MSSQLStatement implements DriverStatement {
  private readonly parameters: Record<string, MSSQLTypedParameter | unknown> = {};

  constructor(
    private readonly connection: MSSQLConnection,
    private readonly sql: string,
  ) {}

  public bindValue(
    param: string | number,
    value: unknown,
    type: ParameterType = ParameterType.STRING,
  ): void {
    const normalizedValue = this.normalizeParameterValue(value, type);

    if (typeof param === "number") {
      this.parameters[`p${param}`] = normalizedValue;
      return;
    }

    const name = param.startsWith(":") || param.startsWith("@") ? param.slice(1) : param;
    this.parameters[name] = normalizedValue;
  }

  public async execute(): Promise<DriverResult> {
    return this.connection.executePrepared(this.sql, this.parameters);
  }

  private normalizeParameterValue(value: unknown, type: ParameterType): unknown {
    if (value === null) {
      if (type === ParameterType.BINARY || type === ParameterType.LARGE_OBJECT) {
        return this.wrapVarBinary(null);
      }

      return null;
    }

    if (type !== ParameterType.BINARY && type !== ParameterType.LARGE_OBJECT) {
      if (type === ParameterType.ASCII && typeof value === "string") {
        return this.wrapVarchar(value, Math.max(value.length, 1));
      }

      return value;
    }

    if (Buffer.isBuffer(value)) {
      return value;
    }

    if (typeof value === "string") {
      return this.wrapVarBinary(Buffer.from(value));
    }

    if (value instanceof Uint8Array) {
      return this.wrapVarBinary(Buffer.from(value));
    }

    if (value instanceof ArrayBuffer) {
      return this.wrapVarBinary(Buffer.from(new Uint8Array(value)));
    }

    return this.wrapVarBinary(value);
  }

  private wrapVarBinary(value: unknown): MSSQLTypedParameter {
    return { typeHint: "varbinary", value };
  }

  private wrapVarchar(value: unknown, length?: number): MSSQLTypedParameter {
    return { length, typeHint: "varchar", value };
  }
}
