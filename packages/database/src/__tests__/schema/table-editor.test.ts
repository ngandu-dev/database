import { beforeAll, describe, expect, it } from "vitest";

import { Column } from "../../schema/column";
import { ColumnEditor } from "../../schema/column-editor";
import { InvalidTableDefinition } from "../../schema/exception/invalid-table-definition";
import { InvalidTableModification } from "../../schema/exception/invalid-table-modification";
import { ForeignKeyConstraint } from "../../schema/foreign-key-constraint";
import { Index } from "../../schema/index";
import { OptionallyQualifiedName } from "../../schema/name/optionally-qualified-name";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { UniqueConstraint } from "../../schema/unique-constraint";
import { registerBuiltInTypes } from "../../types/register-built-in-types";
import { Type } from "../../types/type";
import { Types } from "../../types/types";

describe("Schema/TableEditor (Doctrine parity, supported scenarios)", () => {
  beforeAll(() => {
    registerBuiltInTypes();
  });

  it("sets an unquoted name", () => {
    const table = Table.editor()
      .setUnquotedName("accounts", "public")
      .setColumns(createColumn("id", Types.INTEGER))
      .create();

    expect(table.getObjectName()).toEqual(OptionallyQualifiedName.unquoted("accounts", "public"));
  });

  it("sets a quoted name", () => {
    const table = Table.editor()
      .setQuotedName("contacts", "dbo")
      .setColumns(createColumn("id", Types.INTEGER))
      .create();

    expect(table.getObjectName()).toEqual(OptionallyQualifiedName.quoted("contacts", "dbo"));
  });

  it("sets a replacement name through edit()", () => {
    const name = OptionallyQualifiedName.unquoted("contacts");

    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .create()
      .edit()
      .setName(name.toString())
      .create();

    expect(table.getObjectName()).toEqual(name);
  });

  it("throws when name is not set", () => {
    expect(() => Table.editor().create()).toThrow(InvalidTableDefinition);
  });

  it("throws when columns are not set", () => {
    const editor = Table.editor().setUnquotedName("accounts");

    expect(() => editor.create()).toThrow(InvalidTableDefinition);
  });

  it("throws when adding an existing column", () => {
    const column = createColumn("id", Types.INTEGER);
    const editor = Table.editor().setUnquotedName("accounts").setColumns(column);

    expect(() => editor.addColumn(column)).toThrow(InvalidTableModification);
  });

  it("modifies an existing column", () => {
    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .modifyColumnByUnquotedName("id", (editor: ColumnEditor) => {
        editor.setTypeName(Types.BIGINT);
      })
      .create();

    expect(table.getColumns()).toHaveLength(1);
    expect(table.getColumns()[0]?.getName()).toBe("id");
    expect(Type.lookupName(table.getColumns()[0]!.getType())).toBe(Types.BIGINT);
  });

  it("throws when modifying a non-existing column", () => {
    const editor = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER));

    expect(() => editor.modifyColumnByUnquotedName("account_id", () => {})).toThrow(
      InvalidTableModification,
    );
  });

  it("renames a column and updates related constraints/indexes", () => {
    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER), createColumn("username", Types.STRING))
      .setIndexes(
        Index.editor()
          .setUnquotedName("idx_username")
          .setUnquotedColumnNames("id", "username")
          .create(),
      )
      .setUniqueConstraints(
        UniqueConstraint.editor().setUnquotedColumnNames("id", "username").create(),
      )
      .setForeignKeyConstraints(
        ForeignKeyConstraint.editor()
          .setUnquotedReferencingColumnNames("id", "username")
          .setUnquotedReferencedTableName("users")
          .setUnquotedReferencedColumnNames("id", "username")
          .create(),
      )
      .setPrimaryKeyConstraint(
        PrimaryKeyConstraint.editor().setUnquotedColumnNames("id", "username").create(),
      )
      .renameColumnByUnquotedName("username", "user_name")
      .create();

    expect(
      table.getColumns().map((column) => [column.getName(), Type.lookupName(column.getType())]),
    ).toEqual([
      ["id", Types.INTEGER],
      ["user_name", Types.STRING],
    ]);

    expect(table.getIndex("idx_username")).toEqual(
      Index.editor()
        .setUnquotedName("idx_username")
        .setUnquotedColumnNames("id", "user_name")
        .create(),
    );

    expect(table.getUniqueConstraints()).toHaveLength(1);
    expect(table.getUniqueConstraints()[0]?.getColumnNames()).toEqual(["id", "user_name"]);

    expect(table.getForeignKeys()).toHaveLength(1);
    expect(table.getForeignKeys()[0]?.getReferencingColumnNames()).toEqual(["id", "user_name"]);
    expect(table.getForeignKeys()[0]?.getReferencedColumnNames()).toEqual(["id", "username"]);

    expect(table.getPrimaryKeyConstraint()).not.toBeNull();
    expect(table.getPrimaryKeyConstraint()?.getColumnNames()).toEqual(["id", "user_name"]);
    expect(table.getPrimaryKeyConstraint()?.isClustered()).toBe(true);
  });

  it("throws when renaming a column to an existing name", () => {
    const editor = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER), createColumn("value", Types.STRING));

    expect(() => editor.renameColumnByUnquotedName("id", "value")).toThrow(
      InvalidTableModification,
    );
  });

  it("drops a column", () => {
    const column1 = createColumn("id", Types.INTEGER);
    const column2 = createColumn("value", Types.STRING);

    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(column1, column2)
      .dropColumnByUnquotedName("id")
      .create();

    expect(table.getColumns()).toEqual([column2]);
  });

  it("throws when dropping a non-existing column", () => {
    const editor = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER));

    expect(() => editor.dropColumnByUnquotedName("account_id")).toThrow(InvalidTableModification);
  });

  it("sets indexes", () => {
    const index = Index.editor().setUnquotedName("idx_id").setUnquotedColumnNames("id").create();

    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .setIndexes(index)
      .create();

    expect(table.getIndexes()).toEqual([index]);
  });

  it("throws when adding an existing index", () => {
    const index = Index.editor().setUnquotedName("idx_id").setUnquotedColumnNames("id").create();

    const editor = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .setIndexes(index);

    expect(() => editor.addIndex(index)).toThrow(InvalidTableModification);
  });

  it("renames an index", () => {
    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .addIndex(Index.editor().setUnquotedName("idx_id").setUnquotedColumnNames("id").create())
      .renameIndexByUnquotedName("idx_id", "idx_account_id")
      .create();

    expect(table.getIndexes()).toEqual([
      Index.editor().setUnquotedName("idx_account_id").setUnquotedColumnNames("id").create(),
    ]);
  });

  it("throws when renaming a non-existing index", () => {
    const editor = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER));

    expect(() => editor.renameIndexByUnquotedName("idx_id", "idx_account_id")).toThrow(
      InvalidTableModification,
    );
  });

  it("throws when renaming an index to an existing name", () => {
    const editor = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .setIndexes(
        Index.editor().setUnquotedName("idx_id").setUnquotedColumnNames("id").create(),
        Index.editor().setUnquotedName("idx_account_id").setUnquotedColumnNames("id").create(),
      );

    expect(() => editor.renameIndexByUnquotedName("idx_id", "idx_account_id")).toThrow(
      InvalidTableModification,
    );
  });

  it("drops an index", () => {
    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .setIndexes(Index.editor().setUnquotedName("idx_id").setUnquotedColumnNames("id").create())
      .dropIndexByUnquotedName("idx_id")
      .create();

    expect(table.getIndexes()).toEqual([]);
  });

  it("throws when dropping a non-existing index", () => {
    const editor = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER));

    expect(() => editor.dropIndexByUnquotedName("idx_id")).toThrow(InvalidTableModification);
  });

  it("adds a primary key constraint", () => {
    const primaryKeyConstraint = PrimaryKeyConstraint.editor()
      .setUnquotedColumnNames("id")
      .create();

    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .addPrimaryKeyConstraint(primaryKeyConstraint)
      .create();

    expect(table.getPrimaryKeyConstraint()).not.toBeNull();
    expect(table.getPrimaryKeyConstraint()?.getColumnNames()).toEqual(["id"]);
    expect(table.getPrimaryKeyConstraint()?.isClustered()).toBe(true);
  });

  it("supports setting a null primary key constraint", () => {
    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .setPrimaryKeyConstraint(null)
      .create();

    expect(table.getPrimaryKeyConstraint()).toBeNull();
  });

  it("throws when adding a primary key constraint when one already exists", () => {
    const primaryKeyConstraint = PrimaryKeyConstraint.editor()
      .setUnquotedColumnNames("id")
      .create();

    const editor = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .setPrimaryKeyConstraint(primaryKeyConstraint);

    expect(() => editor.addPrimaryKeyConstraint(primaryKeyConstraint)).toThrow(
      InvalidTableModification,
    );
  });

  it("drops a primary key constraint", () => {
    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
      .dropPrimaryKeyConstraint()
      .create();

    expect(table.getPrimaryKeyConstraint()).toBeNull();
  });

  it("throws when dropping a non-existing primary key constraint", () => {
    const editor = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER));

    expect(() => editor.dropPrimaryKeyConstraint()).toThrow(InvalidTableModification);
  });

  it("replaces the backing primary index when replacing the primary key constraint via edit()", () => {
    let table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .create();

    table.setPrimaryKey(["id"], "pk_id");
    expect(table.getPrimaryKeyConstraint()).not.toBeNull();
    expect(table.hasIndex("pk_id")).toBe(true);

    table = table
      .edit()
      .dropPrimaryKeyConstraint()
      .addPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
      .create();

    expect(table.hasIndex("pk_id")).toBe(false);
  });

  it("sets unique constraints", () => {
    const uniqueConstraint = UniqueConstraint.editor().setUnquotedColumnNames("id").create();

    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .setUniqueConstraints(uniqueConstraint)
      .create();

    expect(table.getUniqueConstraints()).toHaveLength(1);
    expect(table.getUniqueConstraints()[0]?.getColumnNames()).toEqual(["id"]);
  });

  it("throws when adding an existing unique constraint", () => {
    const uniqueConstraint = UniqueConstraint.editor()
      .setUnquotedName("uq_accounts_id")
      .setUnquotedColumnNames("id")
      .create();

    const editor = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .addUniqueConstraint(uniqueConstraint);

    expect(() => editor.addUniqueConstraint(uniqueConstraint)).toThrow(InvalidTableModification);
  });

  it("drops a unique constraint", () => {
    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER))
      .addUniqueConstraint(
        UniqueConstraint.editor()
          .setUnquotedName("uq_accounts_id")
          .setUnquotedColumnNames("id")
          .create(),
      )
      .dropUniqueConstraintByUnquotedName("uq_accounts_id")
      .create();

    expect(table.getUniqueConstraints()).toEqual([]);
  });

  it("throws when dropping a non-existing unique constraint", () => {
    const editor = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER));

    expect(() => editor.dropUniqueConstraintByUnquotedName("uq_accounts_id")).toThrow(
      InvalidTableModification,
    );
  });

  it("sets foreign key constraints", () => {
    const foreignKeyConstraint = ForeignKeyConstraint.editor()
      .setUnquotedName("fk_accounts_users")
      .setUnquotedReferencingColumnNames("user_id")
      .setUnquotedReferencedTableName("users")
      .setUnquotedReferencedColumnNames("id")
      .create();

    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER), createColumn("user_id", Types.INTEGER))
      .setForeignKeyConstraints(foreignKeyConstraint)
      .create();

    expect(table.getForeignKeys()).toEqual([foreignKeyConstraint]);
  });

  it("throws when adding an existing foreign key constraint", () => {
    const foreignKeyConstraint = ForeignKeyConstraint.editor()
      .setUnquotedName("fk_accounts_users")
      .setUnquotedReferencingColumnNames("user_id")
      .setUnquotedReferencedTableName("users")
      .setUnquotedReferencedColumnNames("id")
      .create();

    const editor = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("user_id", Types.INTEGER))
      .addForeignKeyConstraint(foreignKeyConstraint);

    expect(() => editor.addForeignKeyConstraint(foreignKeyConstraint)).toThrow(
      InvalidTableModification,
    );
  });

  it("drops a foreign key constraint", () => {
    const foreignKeyConstraint = ForeignKeyConstraint.editor()
      .setUnquotedName("fk_accounts_users")
      .setUnquotedReferencingColumnNames("user_id")
      .setUnquotedReferencedTableName("users")
      .setUnquotedReferencedColumnNames("id")
      .create();

    const table = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("user_id", Types.INTEGER))
      .addForeignKeyConstraint(foreignKeyConstraint)
      .dropForeignKeyConstraintByUnquotedName("fk_accounts_users")
      .create();

    expect(table.getForeignKeys()).toEqual([]);
  });

  it("throws when dropping a non-existing foreign key constraint", () => {
    const editor = Table.editor()
      .setUnquotedName("accounts")
      .setColumns(createColumn("id", Types.INTEGER));

    expect(() => editor.dropForeignKeyConstraintByUnquotedName("fk_accounts_users")).toThrow(
      InvalidTableModification,
    );
  });

  it("sets a comment", () => {
    const table = Table.editor()
      .setUnquotedName("accounts", "public")
      .setColumns(createColumn("id", Types.INTEGER))
      .setComment('This is the "accounts" table')
      .create();

    expect(table.getComment()).toBe('This is the "accounts" table');
  });
});

function createColumn(name: string, typeName: string): Column {
  return Column.editor().setUnquotedName(name).setTypeName(typeName).create();
}
