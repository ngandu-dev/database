import { Type } from "../../../types/type";

export class TypeWithConstructor extends Type {
  public constructor(public readonly requirement: boolean) {
    super();

    if (requirement === undefined) {
      throw new Error("requirement must be provided");
    }
  }

  public getSQLDeclaration(): string {
    return "";
  }
}
