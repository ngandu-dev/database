import { AbstractPlatform } from "../platforms/abstract-platform";
import { formatDateByPattern, parseDateByPattern } from "./date-time-util";
import { InvalidFormat } from "./exception/invalid-format";
import { InvalidType } from "./exception/invalid-type";
import { Type } from "./type";

export class DateType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getDateTypeDeclarationSQL(column);
  }

  public convertToDatabaseValue(value: unknown, platform: AbstractPlatform): string | null {
    if (value === null) {
      return null;
    }

    if (value instanceof Date) {
      return formatDateByPattern(value, platform.getDateFormatString());
    }

    throw InvalidType.new(value, this.constructor.name, ["null", "Date"]);
  }

  public convertToNodeValue(value: unknown, platform: AbstractPlatform): Date | null {
    if (value === null || value instanceof Date) {
      return value;
    }

    const parsed = parseDateByPattern(String(value), platform.getDateFormatString());
    if (parsed !== null) {
      return parsed;
    }

    throw InvalidFormat.new(String(value), this.constructor.name, platform.getDateFormatString());
  }
}
