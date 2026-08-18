import { AbstractAsset } from "./abstract-asset";
import { OptionallyQualifiedName } from "./name/optionally-qualified-name";
import type { OptionallyQualifiedNameParser } from "./name/parser/optionally-qualified-name-parser";
import { Parsers } from "./name/parsers";
import { ViewEditor } from "./view-editor";

export class View extends AbstractAsset {
  constructor(
    name: string,
    private sql: string,
  ) {
    super(name);
  }

  public getSql(): string {
    return this.sql;
  }

  public getObjectName(): OptionallyQualifiedName {
    return this.getNameParser().parse(this.getName());
  }

  public static editor(): ViewEditor {
    return new ViewEditor();
  }

  public edit(): ViewEditor {
    return View.editor().setName(this.getName()).setSQL(this.sql);
  }

  protected getNameParser(): OptionallyQualifiedNameParser {
    return Parsers.getOptionallyQualifiedNameParser();
  }
}
