import { AbstractPlatform } from "../platforms/abstract-platform";
import { Type } from "./type";

export class TextType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getClobTypeDeclarationSQL(column);
  }
}
