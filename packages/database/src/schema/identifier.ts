import { AbstractAsset } from "./abstract-asset";
import { GenericName } from "./name/generic-name";
import type { GenericNameParser } from "./name/parser/generic-name-parser";
import { Parsers } from "./name/parsers";

export class Identifier extends AbstractAsset {
  constructor(identifier: string, quote = false) {
    super(identifier);

    if (quote && !this._quoted) {
      this._setName(`"${this.getName()}"`);
    }
  }

  public getObjectName(): GenericName {
    return this.getNameParser().parse(this.getName());
  }

  protected getNameParser(): GenericNameParser {
    return Parsers.getGenericNameParser();
  }
}
