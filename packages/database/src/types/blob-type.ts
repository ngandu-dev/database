import { ParameterType } from "../parameter-type";
import { AbstractPlatform } from "../platforms/abstract-platform";
import { ValueNotConvertible } from "./exception/value-not-convertible";
import { Type } from "./type";
import { Types } from "./types";

export class BlobType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getBlobTypeDeclarationSQL(column);
  }

  public convertToNodeValue(
    value: unknown,
    _platform: AbstractPlatform,
  ): string | Uint8Array | null {
    if (value === null) {
      return null;
    }

    if (typeof value === "string" || value instanceof Uint8Array) {
      return value;
    }

    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }

    throw ValueNotConvertible.new(value, Types.BLOB);
  }

  public getBindingType(): ParameterType {
    return ParameterType.LARGE_OBJECT;
  }
}
