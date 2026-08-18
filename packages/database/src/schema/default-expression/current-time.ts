import type { AbstractPlatform } from "../../platforms/abstract-platform";
import { DefaultExpression } from "../default-expression";

export class CurrentTime implements DefaultExpression {
  public toSQL(platform: AbstractPlatform): string {
    return platform.getCurrentTimeSQL();
  }
}
