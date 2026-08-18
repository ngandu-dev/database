import { PlatformException } from "./platform-exception";

export class NoColumnsSpecifiedForTable extends Error implements PlatformException {
  constructor(tableName: string) {
    super(`No columns specified for table "${tableName}".`);
    this.name = "NoColumnsSpecifiedForTable";
    Object.setPrototypeOf(this, NoColumnsSpecifiedForTable.prototype);
  }

  public static new(tableName: string): NoColumnsSpecifiedForTable {
    return new NoColumnsSpecifiedForTable(tableName);
  }
}
