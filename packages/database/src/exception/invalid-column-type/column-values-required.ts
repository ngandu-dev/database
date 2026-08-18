import type { AbstractPlatform } from "../../platforms/abstract-platform";
import { InvalidColumnType } from "../invalid-column-type";

export class ColumnValuesRequired extends InvalidColumnType {
  public static new(platform: AbstractPlatform, type: string): ColumnValuesRequired {
    return new ColumnValuesRequired(
      `${ColumnValuesRequired.describePlatform(platform)} requires the values of a ${type} column to be specified`,
    );
  }

  private static describePlatform(platform: AbstractPlatform): string {
    return platform.constructor.name || "AbstractPlatform";
  }
}
