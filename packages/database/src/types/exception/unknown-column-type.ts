import { TypesException } from "./types-exception";

export class UnknownColumnType extends TypesException {
  public static new(name: string): UnknownColumnType {
    return new UnknownColumnType(
      `Unknown column type "${name}" requested. Any Datazen Type that you use has to be registered with Type.addType(). You can get a list of known types with Type.getTypesMap().`,
    );
  }
}
