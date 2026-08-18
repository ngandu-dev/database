import type { Result as DriverResult } from "../driver/result";
import type { Statement as DriverStatement } from "../driver/statement";
import { ParameterType } from "../parameter-type";
import { Converter } from "./converter";
import { Result } from "./result";

export class DriverStatementWrapper implements DriverStatement {
  constructor(
    private readonly statement: DriverStatement,
    private readonly converter: Converter,
  ) {}

  public bindValue(
    param: string | number,
    value: unknown,
    type: ParameterType = ParameterType.STRING,
  ): void {
    this.statement.bindValue(param, value, type);
  }

  public async execute(): Promise<DriverResult> {
    const result = await this.statement.execute();
    return new Result(result, this.converter);
  }
}
