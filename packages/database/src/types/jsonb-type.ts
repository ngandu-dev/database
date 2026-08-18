import { AbstractPlatform } from "../platforms/abstract-platform";
import { JsonType } from "./json-type";

export class JsonbType extends JsonType {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getJsonbTypeDeclarationSQL(column);
  }
}
