import type { Type } from "../type";
import { TypesException } from "./types-exception";

export class TypeAlreadyRegistered extends TypesException {
  public static new(type: Type): TypeAlreadyRegistered {
    const className = type.constructor.name || "AnonymousType";
    return new TypeAlreadyRegistered(
      `Type "${className}" is already registered under another name.`,
    );
  }
}
