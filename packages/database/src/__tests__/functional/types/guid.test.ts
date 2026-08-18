import { beforeEach, describe, expect, it } from "vitest";

import { Column } from "../../../schema/column";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Types/GuidTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("guid_table")
        .setColumns(Column.editor().setUnquotedName("guid").setTypeName(Types.GUID).create())
        .create(),
    );
  });

  it("insert and select", async () => {
    const guid = "7c620eda-ea79-11eb-9a03-0242ac130003";

    expect(await functional.connection().insert("guid_table", { guid })).toBe(1);

    const value = await functional.connection().fetchOne("SELECT guid FROM guid_table");
    expect(typeof value).toBe("string");
    expect(String(value).toLowerCase()).toBe(guid.toLowerCase());
  });
});
