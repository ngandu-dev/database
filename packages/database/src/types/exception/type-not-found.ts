import { TypesException } from "./types-exception";

export class TypeNotFound extends TypesException {
  public static new(name: string): TypeNotFound {
    return new TypeNotFound(`Type "${name}" was not found.`);
  }
}
