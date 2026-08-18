import { AbstractPlatform } from "../platforms/abstract-platform";
import { StringType } from "./string-type";

export class GuidType extends StringType {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getGuidTypeDeclarationSQL(column);
  }
}
