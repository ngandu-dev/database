import { ParameterType } from "../parameter-type";
import { AbstractPlatform } from "../platforms/abstract-platform";
import { StringType } from "./string-type";

export class AsciiStringType extends StringType {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getAsciiStringTypeDeclarationSQL(column);
  }

  public getBindingType(): ParameterType {
    return ParameterType.ASCII;
  }
}
