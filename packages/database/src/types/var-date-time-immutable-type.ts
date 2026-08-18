import { AbstractPlatform } from "../platforms/abstract-platform";
import { DateTimeImmutableType } from "./date-time-immutable-type";
import { ValueNotConvertible } from "./exception/value-not-convertible";

export class VarDateTimeImmutableType extends DateTimeImmutableType {
  public convertToNodeValue(value: unknown, _platform: AbstractPlatform): Date | null {
    if (value === null || value instanceof Date) {
      return value;
    }

    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.valueOf())) {
      throw ValueNotConvertible.new(value, Date.name);
    }

    return parsed;
  }
}
