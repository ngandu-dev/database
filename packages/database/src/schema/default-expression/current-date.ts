import type { AbstractPlatform } from "../../platforms/abstract-platform";
import { DefaultExpression } from "../default-expression";

export class CurrentDate implements DefaultExpression {
  public toSQL(platform: AbstractPlatform): string {
    return platform.getCurrentDateSQL();
  }
}
