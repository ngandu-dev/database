import { AbstractPlatform } from "../platforms/abstract-platform";
import { InvalidType } from "./exception/invalid-type";
import { Type } from "./type";

export class DateIntervalType extends Type {
  public static readonly FORMAT = "%RP%YY%MM%DDT%HH%IM%SS";

  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getStringTypeDeclarationSQL({
      ...column,
      length: 255,
    });
  }

  public convertToDatabaseValue(value: unknown, _platform: AbstractPlatform): string | null {
    if (value === null) {
      return null;
    }

    if (typeof value === "string") {
      return value;
    }

    throw InvalidType.new(value, this.constructor.name, ["null", "string"]);
  }

  public convertToNodeValue(value: unknown, _platform: AbstractPlatform): string | null {
    if (value === null) {
      return null;
    }

    return String(value);
  }
}
