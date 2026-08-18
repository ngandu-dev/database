import { ParameterType } from "../parameter-type";
import { AbstractPlatform } from "../platforms/abstract-platform";
import { Type } from "./type";

export class BigIntType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getBigIntTypeDeclarationSQL(column);
  }

  public convertToDatabaseValue(value: unknown, _platform: AbstractPlatform): unknown {
    if (typeof value === "bigint") {
      return value.toString();
    }

    return value;
  }

  public convertToNodeValue(
    value: unknown,
    _platform: AbstractPlatform,
  ): number | string | bigint | null {
    if (value === null || typeof value === "number" || typeof value === "bigint") {
      return value;
    }

    if (typeof value !== "string") {
      return String(value);
    }

    const asNumber = Number(value);
    if (Number.isSafeInteger(asNumber)) {
      return asNumber;
    }

    try {
      return BigInt(value);
    } catch {
      return value;
    }
  }

  public getBindingType(): ParameterType {
    return ParameterType.STRING;
  }
}
