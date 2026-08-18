import { describe, expect, it } from "vitest";

import { DriverRequired } from "../exception/driver-required";

describe("Exception (Doctrine root-level parity)", () => {
  it("builds DriverRequired message with URL exactly like Doctrine intent", () => {
    const url = "mysql://localhost";

    expect(DriverRequired.new(url).message).toBe(
      'The options "driver" or "driverClass" are mandatory if a connection URL without scheme is given to DriverManager::getConnection(). Given URL "mysql://localhost".',
    );
  });
});
