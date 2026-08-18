import type { Type } from "../type";
import { TypesException } from "./types-exception";

export class TypeNotRegistered extends TypesException {
  public static new(type: Type): TypeNotRegistered {
    const className = type.constructor.name || "AnonymousType";
    return new TypeNotRegistered(`Type "${className}" is not registered.`);
  }
}
