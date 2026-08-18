import { AbstractPlatform } from "../platforms/abstract-platform";
import { convertJsonToDatabaseValue, convertJsonToNodeValue } from "./json-type-convert";
import { Type } from "./type";

export class JsonType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getJsonTypeDeclarationSQL(column);
  }

  public convertToDatabaseValue(value: unknown, _platform: AbstractPlatform): string | null {
    return convertJsonToDatabaseValue(value);
  }

  public convertToNodeValue(value: unknown, _platform: AbstractPlatform): unknown {
    return convertJsonToNodeValue(value);
  }
}
