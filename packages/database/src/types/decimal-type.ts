import { AbstractPlatform } from "../platforms/abstract-platform";
import { Type } from "./type";

export class DecimalType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getDecimalTypeDeclarationSQL(column);
  }

  public convertToNodeValue(value: unknown, _platform: AbstractPlatform): string | null {
    if (value === null) {
      return null;
    }

    if (typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }

    return String(value);
  }
}
