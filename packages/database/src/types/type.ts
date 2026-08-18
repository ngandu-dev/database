import { ParameterType } from "../parameter-type";
import { AbstractPlatform } from "../platforms/abstract-platform";
import { TypeArgumentCountException } from "./exception/type-argument-count-exception";
import { TypeRegistry } from "./type-registry";

export abstract class Type {
  private static typeRegistry: TypeRegistry | null = null;

  public convertToDatabaseValue(value: unknown, _platform: AbstractPlatform): unknown {
    return value;
  }

  public convertToNodeValue(value: unknown, _platform: AbstractPlatform): unknown {
    return value;
  }

  public abstract getSQLDeclaration(
    column: Record<string, unknown>,
    platform: AbstractPlatform,
  ): string;

  public static getTypeRegistry(): TypeRegistry {
    Type.typeRegistry ??= new TypeRegistry();
    return Type.typeRegistry;
  }

  public static setTypeRegistry(typeRegistry: TypeRegistry): void {
    Type.typeRegistry = typeRegistry;
  }

  public static getType(name: string): Type {
    return Type.getTypeRegistry().get(name);
  }

  public static lookupName(type: Type): string {
    return Type.getTypeRegistry().lookupName(type);
  }

  public static addType(name: string, type: Type | (new () => Type)): void {
    const instance = Type.instantiateType(name, type);
    Type.getTypeRegistry().register(name, instance);
  }

  public static hasType(name: string): boolean {
    return Type.getTypeRegistry().has(name);
  }

  public static overrideType(name: string, type: Type | (new () => Type)): void {
    const instance = Type.instantiateType(name, type);
    Type.getTypeRegistry().override(name, instance);
  }

  public getBindingType(): ParameterType {
    return ParameterType.STRING;
  }

  public static getTypesMap(): Record<string, string> {
    const map = Type.getTypeRegistry().getMap();
    const output: Record<string, string> = {};

    for (const [name, type] of Object.entries(map)) {
      output[name] = type.constructor.name;
    }

    return output;
  }

  public convertToDatabaseValueSQL(sqlExpr: string, _platform: AbstractPlatform): string {
    return sqlExpr;
  }

  public convertToNodeValueSQL(sqlExpr: string, _platform: AbstractPlatform): string {
    return sqlExpr;
  }

  public getMappedDatabaseTypes(_platform: AbstractPlatform): string[] {
    return [];
  }

  private static instantiateType(name: string, type: Type | (new () => Type)): Type {
    if (type instanceof Type) {
      return type;
    }

    try {
      return new type();
    } catch (error) {
      throw TypeArgumentCountException.new(name, error);
    }
  }
}
