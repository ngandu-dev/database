import { describe, it } from "vitest";

import { Column } from "../../../schema/column";
import { Table } from "../../../schema/table";
import { UniqueConstraint } from "../../../schema/unique-constraint";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Schema/UniqueConstraintTest", () => {
  const functional = useFunctionalTestCase();

  it("unnamed unique constraint", async () => {
    await functional.dropTableIfExists("users");

    const users = Table.editor()
      .setUnquotedName("users")
      .setColumns(
        Column.editor()
          .setUnquotedName("username")
          .setTypeName(Types.STRING)
          .setLength(32)
          .create(),
        Column.editor().setUnquotedName("email").setTypeName(Types.STRING).setLength(255).create(),
      )
      .setUniqueConstraints(
        UniqueConstraint.editor().setUnquotedColumnNames("username").create(),
        UniqueConstraint.editor().setUnquotedColumnNames("email").create(),
      )
      .create();

    const schemaManager = await functional.connection().createSchemaManager();
    await schemaManager.createTable(users);

    // Doctrine only verifies successful creation here because unnamed unique
    // constraint introspection coverage is still limited across vendors.
  });
});
