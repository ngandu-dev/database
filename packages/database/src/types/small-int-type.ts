import { ParameterType } from "../parameter-type";
import { AbstractPlatform } from "../platforms/abstract-platform";
import { Type } from "./type";

export class SmallIntType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getSmallIntTypeDeclarationSQL(column);
  }

  public convertToNodeValue(value: unknown, _platform: AbstractPlatform): number | null {
    if (value === null) {
      return null;
    }

    return Number.parseInt(String(value), 10);
  }

  public getBindingType(): ParameterType {
    return ParameterType.INTEGER;
  }
}
