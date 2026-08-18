import { ParameterType } from "../parameter-type";
import { AbstractPlatform } from "../platforms/abstract-platform";
import { Type } from "./type";

export class SimpleArrayType extends Type {
  public getSQLDeclaration(column: Record<string, unknown>, platform: AbstractPlatform): string {
    return platform.getClobTypeDeclarationSQL(column);
  }

  public convertToDatabaseValue(value: unknown, _platform: AbstractPlatform): string | null {
    if (!Array.isArray(value) || value.length === 0) {
      return null;
    }

    return value.map((item) => String(item)).join(",");
  }

  public convertToNodeValue(value: unknown, _platform: AbstractPlatform): string[] {
    if (value === null || value === "") {
      return [];
    }

    return String(value).split(",");
  }

  public getBindingType(): ParameterType {
    return ParameterType.STRING;
  }
}
