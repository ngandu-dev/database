import { InvalidViewDefinition } from "./exception/invalid-view-definition";
import { View } from "./view";

export class ViewEditor {
  private name: string | null = null;
  private sql = "";

  public setName(name: string): this {
    this.name = name;
    return this;
  }

  public setQuotedName(name: string, schemaName: string | null = null): this {
    this.name = schemaName === null ? `"${name}"` : `"${schemaName}"."${name}"`;
    return this;
  }

  public setUnquotedName(name: string, schemaName: string | null = null): this {
    this.name = schemaName === null ? name : `${schemaName}.${name}`;
    return this;
  }

  public setSQL(sql: string): this {
    this.sql = sql;
    return this;
  }

  public create(): View {
    if (this.name === null) {
      throw InvalidViewDefinition.nameNotSet();
    }

    if (this.sql.length === 0) {
      throw InvalidViewDefinition.sqlNotSet(this.name);
    }

    return new View(this.name, this.sql);
  }
}
