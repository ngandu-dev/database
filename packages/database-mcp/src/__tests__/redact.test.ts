import { describe, expect, it } from "vitest";

import { redactSecrets, safeErrorMessage, secretsFromDsn } from "../redact";

describe("redactSecrets", () => {
  it("redacts URL credentials and supplied secret values", () => {
    const dsn = "postgres://reader:very-secret@localhost/app";
    expect(redactSecrets(`Failed to connect to ${dsn}: very-secret`, [dsn, "very-secret"])).toBe(
      "Failed to connect to [REDACTED]: [REDACTED]",
    );
  });

  it("normalizes non-error values", () => {
    expect(safeErrorMessage("mysql://user:pass@localhost/db")).toBe(
      "mysql://[REDACTED]@localhost/db",
    );
  });

  it("extracts useful messages from aggregate connection errors", () => {
    const error = new AggregateError([
      new Error("connect ECONNREFUSED ::1:3306"),
      new Error("connect ECONNREFUSED 127.0.0.1:3306"),
    ]);
    expect(safeErrorMessage(error)).toBe(
      "connect ECONNREFUSED ::1:3306; connect ECONNREFUSED 127.0.0.1:3306",
    );
  });

  it("falls back to the error name and code when no message is available", () => {
    const error = Object.assign(new Error(), { code: "ECONNREFUSED" });
    expect(safeErrorMessage(error)).toBe("Error (ECONNREFUSED)");
  });

  it("extracts encoded credentials for error redaction", () => {
    expect(secretsFromDsn("postgres://reader:very%20secret@localhost/db")).toEqual([
      "postgres://reader:very%20secret@localhost/db",
      "reader",
      "very secret",
    ]);
  });
});
