import type { AbstractPlatform } from "../platforms/abstract-platform";

export interface DefaultExpression {
  toSQL(platform: AbstractPlatform): string;
}
