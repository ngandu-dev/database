import { AbstractPlatform } from "../platforms/abstract-platform";
import { Type } from "./type";

export class SmallFloatType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getSmallFloatDeclarationSQL(column);
  }

  public convertToNodeValue(value: unknown, _platform: AbstractPlatform): number | null {
    if (value === null) {
      return null;
    }

    return Number(value);
  }
}
