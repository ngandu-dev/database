import { describe, expect, it } from "vitest";

import { MalformedDsnException } from "../../exception/malformed-dsn-exception";

describe("MalformedDsnException", () => {
  it("provides a Datazen-style static factory", () => {
    const error = MalformedDsnException.new();

    expect(error).toBeInstanceOf(MalformedDsnException);
    expect(error.message).toBe("Malformed database connection URL");
  });
});
