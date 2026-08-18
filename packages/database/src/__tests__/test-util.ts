import type { Connection } from "../connection";
import type { AbstractPlatform } from "../platforms/abstract-platform";
import { createPrivilegedFunctionalConnection } from "./functional/_helpers/functional-connection-factory";

/**
 * TestUtil is a class with static utility methods used during tests.
 *
 * This mirrors Doctrine's test helper mental model where shared test-only
 * query generation and bootstrap utilities live outside FunctionalTestCase.
 */
export class TestUtil {
  public static async getPrivilegedConnection(): Promise<Connection> {
    return createPrivilegedFunctionalConnection();
  }

  public static generateResultSetQuery(
    columnNames: string[],
    rows: unknown[][],
    platform: AbstractPlatform,
  ): string {
    return rows
      .map((row) =>
        platform.getDummySelectSQL(
          row
            .map((value, index) => {
              const columnName = columnNames[index] ?? `c${index + 1}`;
              const sqlValue =
                typeof value === "string" ? platform.quoteStringLiteral(value) : String(value);

              return `${sqlValue} ${platform.quoteSingleIdentifier(columnName)}`;
            })
            .join(", "),
        ),
      )
      .join(" UNION ALL ");
  }
}
