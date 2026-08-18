import { describe, expect, it } from "vitest";

import { DriverRequired } from "../../exception/driver-required";

describe("Exception/DriverRequired (Doctrine parity)", () => {
  it("builds the doctrine-style message when created with a URL", () => {
    const url = "mysql://localhost";
    const exception = DriverRequired.new(url);

    expect(exception.message).toBe(
      'The options "driver" or "driverClass" are mandatory if a connection URL without scheme is given to DriverManager::getConnection(). Given URL "mysql://localhost".',
    );
  });
});
