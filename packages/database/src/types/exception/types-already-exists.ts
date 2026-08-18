import { TypesException } from "./types-exception";

export class TypesAlreadyExists extends TypesException {
  public static new(name: string): TypesAlreadyExists {
    return new TypesAlreadyExists(`Type "${name}" already exists.`);
  }
}
