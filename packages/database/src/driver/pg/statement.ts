import { InvalidParameterException } from "../../exception/invalid-parameter-exception";
import { ParameterType } from "../../parameter-type";
import type { Result as DriverResult } from "../result";
import type { Statement as DriverStatement } from "../statement";
import type { PgConnection } from "./connection";

export class PgStatement implements DriverStatement {
  private readonly parameters: unknown[] = [];

  constructor(
    private readonly connection: PgConnection,
    private readonly sql: string,
  ) {}

  public bindValue(
    param: string | number,
    value: unknown,
    _type: ParameterType = ParameterType.STRING,
  ): void {
    if (typeof param !== "number") {
      throw new InvalidParameterException("The pg driver supports positional parameters only.");
    }

    this.parameters[Math.max(0, param - 1)] = value;
  }

  public async execute(): Promise<DriverResult> {
    return this.connection.executePrepared(this.sql, this.parameters);
  }
}
