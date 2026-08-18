import { AbstractPlatform } from "../platforms/abstract-platform";
import { Type } from "./type";

export class EnumType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getEnumDeclarationSQL(column);
  }
}
