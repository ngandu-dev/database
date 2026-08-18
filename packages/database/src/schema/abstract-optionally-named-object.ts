import { AbstractAsset } from "./abstract-asset";
import { OptionallyNamedObject } from "./optionally-named-object";

export abstract class AbstractOptionallyNamedObject
  extends AbstractAsset
  implements OptionallyNamedObject<string>
{
  private hasName: boolean;

  constructor(name: string | null) {
    super(name ?? "");
    this.hasName = name !== null && name.length > 0;
  }

  public getObjectName(): string | null {
    if (!this.hasName) {
      return null;
    }

    return this.getName();
  }

  protected setName(name: string | null): void {
    if (name === null || name.length === 0) {
      this.hasName = false;
      this._setName("");
      return;
    }

    this.hasName = true;
    this._setName(name);
  }
}
