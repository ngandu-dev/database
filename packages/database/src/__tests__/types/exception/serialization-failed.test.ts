import { describe, expect, it } from "vitest";

import { SerializationFailed } from "../../../types/exception/serialization-failed";

describe("SerializationFailed parity", () => {
  it("creates a message describing the serialized type and error", () => {
    const exception = SerializationFailed.new(NaN, "json", "Inf and NaN cannot be JSON encoded");

    expect(exception.message).toContain('Could not convert Node type "');
    expect(exception.message).toContain('" to "json".');
    expect(exception.message).toContain(
      "An error was triggered by the serialization: Inf and NaN cannot be JSON encoded",
    );
  });
});
