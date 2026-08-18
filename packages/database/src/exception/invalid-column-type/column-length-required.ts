import type { AbstractPlatform } from "../../platforms/abstract-platform";
import { InvalidColumnType } from "../invalid-column-type";

export class ColumnLengthRequired extends InvalidColumnType {
  public static new(platform: AbstractPlatform, type: string): ColumnLengthRequired {
    return new ColumnLengthRequired(
      `${ColumnLengthRequired.describePlatform(platform)} requires the length of a ${type} column to be specified`,
    );
  }

  private static describePlatform(platform: AbstractPlatform): string {
    return platform.constructor.name || "AbstractPlatform";
  }
}
