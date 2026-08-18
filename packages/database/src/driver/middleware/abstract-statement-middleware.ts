import { ParameterType } from "../../parameter-type";
import type { Result } from "../result";
import type { Statement as DriverStatement } from "../statement";

export abstract class AbstractStatementMiddleware implements DriverStatement {
  constructor(private readonly wrappedStatement: DriverStatement) {}

  public bindValue(param: string | number, value: unknown, type?: ParameterType): void {
    this.wrappedStatement.bindValue(param, value, type);
  }

  public execute(): Promise<Result> {
    return this.wrappedStatement.execute();
  }
}
