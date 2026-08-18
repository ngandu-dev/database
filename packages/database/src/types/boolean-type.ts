import { ParameterType } from "../parameter-type";
import { AbstractPlatform } from "../platforms/abstract-platform";
import { Type } from "./type";

export class BooleanType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getBooleanTypeDeclarationSQL(column);
  }

  public convertToDatabaseValue(value: unknown, platform: AbstractPlatform): unknown {
    return platform.convertBooleansToDatabaseValue(value);
  }

  public convertToNodeValue(value: unknown, platform: AbstractPlatform): boolean | null {
    return platform.convertFromBoolean(value);
  }

  public getBindingType(): ParameterType {
    return ParameterType.BOOLEAN;
  }
}
