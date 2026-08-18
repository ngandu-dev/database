import { AbstractPlatform } from "../platforms/abstract-platform";
import { formatDateByPattern, parseDateByPattern } from "./date-time-util";
import { InvalidFormat } from "./exception/invalid-format";
import { InvalidType } from "./exception/invalid-type";
import { Type } from "./type";

export class DateTimeTzType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getDateTimeTzTypeDeclarationSQL(column);
  }

  public convertToDatabaseValue(value: unknown, platform: AbstractPlatform): string | null {
    if (value === null) {
      return null;
    }

    if (value instanceof Date) {
      return formatDateByPattern(value, platform.getDateTimeTzFormatString());
    }

    throw InvalidType.new(value, this.constructor.name, ["null", "Date"]);
  }

  public convertToNodeValue(value: unknown, platform: AbstractPlatform): Date | null {
    if (value === null || value instanceof Date) {
      return value;
    }

    const input = String(value);
    const parsed = parseDateByPattern(input, platform.getDateTimeTzFormatString());
    if (parsed !== null) {
      return parsed;
    }

    throw InvalidFormat.new(input, this.constructor.name, platform.getDateTimeTzFormatString());
  }
}
