import { AbstractPlatform } from "../platforms/abstract-platform";
import { formatDateByPattern, parseDateByPattern } from "./date-time-util";
import { InvalidFormat } from "./exception/invalid-format";
import { InvalidType } from "./exception/invalid-type";
import { Type } from "./type";

export class DateTimeType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getDateTimeTypeDeclarationSQL(column);
  }

  public convertToDatabaseValue(value: unknown, platform: AbstractPlatform): string | null {
    if (value === null) {
      return null;
    }

    if (value instanceof Date) {
      return formatDateByPattern(value, platform.getDateTimeFormatString());
    }

    throw InvalidType.new(value, this.constructor.name, ["null", "Date"]);
  }

  public convertToNodeValue(value: unknown, platform: AbstractPlatform): Date | null {
    if (value === null || value instanceof Date) {
      return value;
    }

    const input = String(value);
    const parsedByFormat = parseDateByPattern(input, platform.getDateTimeFormatString());
    if (parsedByFormat !== null) {
      return parsedByFormat;
    }

    const parsed = new Date(input);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }

    throw InvalidFormat.new(input, this.constructor.name, platform.getDateTimeFormatString());
  }
}
