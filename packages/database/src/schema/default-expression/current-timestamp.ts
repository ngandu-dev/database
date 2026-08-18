import type { AbstractPlatform } from "../../platforms/abstract-platform";
import { DefaultExpression } from "../default-expression";

export class CurrentTimestamp implements DefaultExpression {
  public toSQL(platform: AbstractPlatform): string {
    return platform.getCurrentTimestampSQL();
  }
}
