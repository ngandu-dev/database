import type { Result as DriverResult } from "../driver/result";
import type { Statement as DriverStatement } from "../driver/statement";
import { ParameterType } from "../parameter-type";
import type { Logger } from "./logger";

type BoundParameters = unknown[] | Record<string, unknown>;
type BoundTypes = unknown[] | Record<string, unknown>;

export class DriverStatementWrapper implements DriverStatement {
  private params: BoundParameters = [];
  private types: BoundTypes = [];

  constructor(
    private readonly statement: DriverStatement,
    private readonly logger: Logger,
    private readonly sql: string,
  ) {}

  public bindValue(
    param: string | number,
    value: unknown,
    type: ParameterType = ParameterType.STRING,
  ): void {
    if (typeof param === "number") {
      if (!Array.isArray(this.params)) {
        this.params = [];
        this.types = [];
      }

      this.params[param - 1] = value;
      (this.types as unknown[])[param - 1] = type;
    } else {
      if (Array.isArray(this.params)) {
        this.params = {};
        this.types = {};
      }

      const key = param.startsWith(":") || param.startsWith("@") ? param.slice(1) : param;
      (this.params as Record<string, unknown>)[key] = value;
      (this.types as Record<string, unknown>)[key] = type;
    }

    this.statement.bindValue(param, value, type);
  }

  public async execute(): Promise<DriverResult> {
    this.logger.debug(
      "Executing prepared statement: {sql} (parameters: {params}, types: {types})",
      {
        params: this.params,
        sql: this.sql,
        types: this.types,
      },
    );

    return this.statement.execute();
  }
}
