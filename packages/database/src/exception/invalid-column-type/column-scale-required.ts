import { InvalidColumnType } from "../invalid-column-type";

export class ColumnScaleRequired extends InvalidColumnType {
  public static new(): ColumnScaleRequired {
    return new ColumnScaleRequired("Column scale is not specified");
  }
}
