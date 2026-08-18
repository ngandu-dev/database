import { AbstractAsset } from "./abstract-asset";
import { InvalidState } from "./exception/invalid-state";
import { NamedObject } from "./named-object";

export abstract class AbstractNamedObject extends AbstractAsset implements NamedObject<string> {
  public getObjectName(): string {
    const name = this.getName();
    if (name.length === 0) {
      throw InvalidState.objectNameNotInitialized();
    }

    return name;
  }

  protected setName(name: string | null): void {
    if (name === null) {
      return;
    }

    this._setName(name);
  }
}
