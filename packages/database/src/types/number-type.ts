import { AbstractPlatform } from "../platforms/abstract-platform";
import { InvalidType } from "./exception/invalid-type";
import { Type } from "./type";

export class NumberType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getDecimalTypeDeclarationSQL(column);
  }

  public convertToDatabaseValue(value: unknown, _platform: AbstractPlatform): string | null {
    if (value === null) {
      return null;
    }

    if (typeof value === "number" || typeof value === "string" || typeof value === "bigint") {
      return String(value);
    }

    throw InvalidType.new(value, this.constructor.name, ["null", "number", "string", "bigint"]);
  }

  public convertToNodeValue(value: unknown, _platform: AbstractPlatform): string | null {
    if (value === null) {
      return null;
    }

    return String(value);
  }
}
