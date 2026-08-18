import { describe, expect, it } from "vitest";

import { AbstractException as DriverAbstractException } from "../../driver/abstract-exception";
import { DriverException } from "../../exception/driver-exception";
import { Query } from "../../query";

class DriverFailure extends DriverAbstractException {}

describe("DriverException (Doctrine parity)", () => {
  it("supports doctrine-style wrapping of a driver exception with query context", () => {
    const cause = new DriverFailure("duplicate key", "23000", 1062);
    const query = new Query("INSERT INTO users (id) VALUES (?)", [1]);
    const error = new DriverException(cause, query);

    expect(error.message).toBe("An exception occurred while executing a query: duplicate key");
    expect(error.getQuery()).toBe(query);
    expect(error.getSQLState()).toBe("23000");
    expect(error.code).toBe(1062);
    expect(error.sql).toBe("INSERT INTO users (id) VALUES (?)");
    expect(error.parameters).toEqual([1]);
    expect((error as Error & { cause?: unknown }).cause).toBe(cause);
  });

  it("keeps normalized converter-based constructor path for current converters", () => {
    const cause = new Error("raw");
    const error = new DriverException("converted", {
      cause,
      code: "X",
      driverName: "mysql2",
      operation: "executeQuery",
      parameters: [1],
      sql: "SELECT 1",
      sqlState: "HY000",
    });

    expect(error.message).toBe("converted");
    expect(error.driverName).toBe("mysql2");
    expect(error.operation).toBe("executeQuery");
    expect(error.getSQLState()).toBe("HY000");
    expect(error.getQuery()).toBeNull();
    expect((error as Error & { cause?: unknown }).cause).toBe(cause);
  });
});
