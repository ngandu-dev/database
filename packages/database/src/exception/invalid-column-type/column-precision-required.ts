import { InvalidColumnType } from "../invalid-column-type";

export class ColumnPrecisionRequired extends InvalidColumnType {
  public static new(): ColumnPrecisionRequired {
    return new ColumnPrecisionRequired("Column precision is not specified");
  }
}
