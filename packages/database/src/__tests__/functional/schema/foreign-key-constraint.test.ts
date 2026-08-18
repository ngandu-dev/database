import { describe, expect, it } from "vitest";

import { AbstractMySQLPlatform } from "../../../platforms/abstract-mysql-platform";
import { AbstractPlatform } from "../../../platforms/abstract-platform";
import { DB2Platform } from "../../../platforms/db2-platform";
import { MySQL80Platform } from "../../../platforms/mysql80-platform";
import { OraclePlatform } from "../../../platforms/oracle-platform";
import { PostgreSQLPlatform } from "../../../platforms/postgresql-platform";
import { SQLitePlatform } from "../../../platforms/sqlite-platform";
import { SQLServerPlatform } from "../../../platforms/sqlserver-platform";
import { Column } from "../../../schema/column";
import { ForeignKeyConstraint } from "../../../schema/foreign-key-constraint";
import { ReferentialAction } from "../../../schema/foreign-key-constraint/referential-action";
import { ForeignKeyConstraintEditor } from "../../../schema/foreign-key-constraint-editor";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Schema/ForeignKeyConstraintTest", () => {
  const functional = useFunctionalTestCase();

  it("unnamed foreign key constraint introspection", async () => {
    await functional.dropTableIfExists("users");
    await functional.dropTableIfExists("roles");
    await functional.dropTableIfExists("teams");

    const roles = buildSingleIdTable("roles");
    const teams = buildSingleIdTable("teams");
    const users = Table.editor()
      .setUnquotedName("users")
      .setColumns(
        Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("role_id").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("team_id").setTypeName(Types.INTEGER).create(),
      )
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
      .setForeignKeyConstraints(
        ForeignKeyConstraint.editor()
          .setUnquotedReferencingColumnNames("role_id")
          .setUnquotedReferencedTableName("roles")
          .setUnquotedReferencedColumnNames("id")
          .create(),
        ForeignKeyConstraint.editor()
          .setUnquotedReferencingColumnNames("team_id")
          .setUnquotedReferencedTableName("teams")
          .setUnquotedReferencedColumnNames("id")
          .create(),
      )
      .create();

    const schemaManager = await functional.connection().createSchemaManager();
    await schemaManager.createTable(roles);
    await schemaManager.createTable(teams);
    await schemaManager.createTable(users);

    const table = await schemaManager.introspectTableByUnquotedName("users");
    expect(table.getForeignKeys()).toHaveLength(2);
  });

  it("column introspection", async () => {
    await functional.dropTableIfExists("users");
    await functional.dropTableIfExists("roles");
    await functional.dropTableIfExists("teams");

    const roles = Table.editor()
      .setUnquotedName("roles")
      .setColumns(
        Column.editor().setUnquotedName("r_id1").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("r_id2").setTypeName(Types.INTEGER).create(),
      )
      .setPrimaryKeyConstraint(
        PrimaryKeyConstraint.editor().setUnquotedColumnNames("r_id1", "r_id2").create(),
      )
      .create();

    const teams = Table.editor()
      .setUnquotedName("teams")
      .setColumns(
        Column.editor().setUnquotedName("t_id1").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("t_id2").setTypeName(Types.INTEGER).create(),
      )
      .setPrimaryKeyConstraint(
        PrimaryKeyConstraint.editor().setUnquotedColumnNames("t_id1", "t_id2").create(),
      )
      .create();

    const foreignKeyConstraints = [
      ForeignKeyConstraint.editor()
        .setUnquotedName("fk_roles")
        .setUnquotedReferencingColumnNames("role_id1", "role_id2")
        .setUnquotedReferencedTableName("roles")
        .setUnquotedReferencedColumnNames("r_id1", "r_id2")
        .create(),
      ForeignKeyConstraint.editor()
        .setUnquotedName("fk_teams")
        .setUnquotedReferencingColumnNames("team_id1", "team_id2")
        .setUnquotedReferencedTableName("teams")
        .setUnquotedReferencedColumnNames("t_id1", "t_id2")
        .create(),
    ];

    const users = Table.editor()
      .setUnquotedName("users")
      .setColumns(
        Column.editor().setUnquotedName("u_id1").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("u_id2").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("role_id1").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("role_id2").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("team_id1").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("team_id2").setTypeName(Types.INTEGER).create(),
      )
      .setForeignKeyConstraints(...foreignKeyConstraints)
      .setPrimaryKeyConstraint(
        PrimaryKeyConstraint.editor().setUnquotedColumnNames("u_id1", "u_id2").create(),
      )
      .create();

    const schemaManager = await functional.connection().createSchemaManager();
    await schemaManager.createTable(roles);
    await schemaManager.createTable(teams);
    await schemaManager.createTable(users);

    const table = await schemaManager.introspectTable("users");
    const actualConstraints = table.getForeignKeys();
    expect(actualConstraints).toHaveLength(2);

    for (const expected of foreignKeyConstraints) {
      const actual = actualConstraints.find((candidate) =>
        hasSameColumnMapping(candidate, expected),
      );

      expect(actual).toBeDefined();
      if (actual === undefined) {
        continue;
      }

      functional.assertOptionallyQualifiedNameEquals(
        expected.getReferencedTableName(),
        actual.getReferencedTableName(),
      );
      expect(actual.getReferencingColumnNames()).toEqual(expected.getReferencingColumnNames());
      expect(actual.getReferencedColumnNames()).toEqual(expected.getReferencedColumnNames());
    }
  });

  for (const action of referentialActions()) {
    it(`ON UPDATE introspection ${action}`, async ({ skip }) => {
      const platform = functional.connection().getDatabasePlatform();
      if (!platformSupportsOnUpdateAction(platform, action)) {
        skip();
      }

      await testReferentialActionIntrospection(
        functional,
        action,
        (editor, updatedAction) => {
          editor.setOnUpdateAction(updatedAction);
        },
        (constraint) => constraint.getOnUpdateAction(),
      );
    });
  }

  for (const action of referentialActions()) {
    it(`ON DELETE introspection ${action}`, async ({ skip }) => {
      const platform = functional.connection().getDatabasePlatform();
      if (!platformSupportsOnDeleteAction(platform, action)) {
        skip();
      }

      await testReferentialActionIntrospection(
        functional,
        action,
        (editor, deletedAction) => {
          editor.setOnDeleteAction(deletedAction);
        },
        (constraint) => constraint.getOnDeleteAction(),
      );
    });
  }

  for (const { name, options, expectedOptions } of deferrabilityOptionsProvider()) {
    it(`deferrability introspection ${name}`, async ({ skip }) => {
      const platform = functional.connection().getDatabasePlatform();
      if (platform instanceof SQLitePlatform) {
        skip();
      }

      if (!(platform instanceof PostgreSQLPlatform) && !(platform instanceof OraclePlatform)) {
        skip();
      }

      await functional.dropTableIfExists("users");
      await functional.dropTableIfExists("roles");

      const roles = buildSingleIdTable("roles");
      const users = Table.editor()
        .setUnquotedName("users")
        .setColumns(
          Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
          Column.editor().setUnquotedName("role_id").setTypeName(Types.INTEGER).create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .setForeignKeyConstraints(
          new ForeignKeyConstraint(["role_id"], "roles", ["id"], "", options),
        )
        .create();

      const schemaManager = await functional.connection().createSchemaManager();
      await schemaManager.createTable(roles);
      await schemaManager.createTable(users);

      const table = await schemaManager.introspectTable("users");
      const constraints = table.getForeignKeys();
      expect(constraints).toHaveLength(1);

      const constraint = constraints[0]!;
      const actualOptions = pickKnownBooleanOptions(constraint.getOptions(), expectedOptions);
      expect(actualOptions).toEqual(expectedOptions);
    });
  }
});

async function testReferentialActionIntrospection(
  functional: ReturnType<typeof useFunctionalTestCase>,
  action: ReferentialAction,
  setter: (editor: ForeignKeyConstraintEditor, action: ReferentialAction) => void,
  getter: (constraint: ForeignKeyConstraint) => ReferentialAction,
): Promise<void> {
  await functional.dropTableIfExists("users");
  await functional.dropTableIfExists("roles");

  const roles = buildSingleIdTable("roles");

  const foreignKeyEditor = ForeignKeyConstraint.editor()
    .setUnquotedReferencingColumnNames("role_id")
    .setUnquotedReferencedTableName("roles")
    .setUnquotedReferencedColumnNames("id");
  setter(foreignKeyEditor, action);

  const users = Table.editor()
    .setUnquotedName("users")
    .setColumns(
      Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
      Column.editor()
        .setUnquotedName("role_id")
        .setTypeName(Types.INTEGER)
        .setNotNull(false)
        .create(),
    )
    .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
    .setForeignKeyConstraints(foreignKeyEditor.create())
    .create();

  const schemaManager = await functional.connection().createSchemaManager();
  await schemaManager.createTable(roles);
  await schemaManager.createTable(users);

  const constraints = await schemaManager.listTableForeignKeys("users");
  expect(constraints).toHaveLength(1);
  expect(getter(constraints[0]!)).toBe(action);
}

function buildSingleIdTable(name: string): Table {
  return Table.editor()
    .setUnquotedName(name)
    .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
    .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
    .create();
}

function platformSupportsOnDeleteAction(
  platform: AbstractPlatform,
  action: ReferentialAction,
): boolean {
  return platformSupportsReferentialAction(platform, action);
}

function platformSupportsOnUpdateAction(
  platform: AbstractPlatform,
  action: ReferentialAction,
): boolean {
  if (platform instanceof OraclePlatform) {
    return false;
  }

  if (platform instanceof DB2Platform) {
    return !(
      action === ReferentialAction.CASCADE ||
      action === ReferentialAction.SET_DEFAULT ||
      action === ReferentialAction.SET_NULL
    );
  }

  return platformSupportsReferentialAction(platform, action);
}

function platformSupportsReferentialAction(
  platform: AbstractPlatform,
  action: ReferentialAction,
): boolean {
  if (
    action === ReferentialAction.RESTRICT &&
    (platform instanceof AbstractMySQLPlatform || platform instanceof SQLitePlatform)
  ) {
    return false;
  }

  if (platform instanceof SQLServerPlatform) {
    return action !== ReferentialAction.RESTRICT;
  }

  if (platform instanceof OraclePlatform) {
    return action !== ReferentialAction.SET_DEFAULT && action !== ReferentialAction.RESTRICT;
  }

  if (platform instanceof DB2Platform) {
    return action !== ReferentialAction.SET_DEFAULT;
  }

  if (platform instanceof AbstractMySQLPlatform && !(platform instanceof MySQL80Platform)) {
    return !(
      action === ReferentialAction.SET_DEFAULT ||
      action === ReferentialAction.SET_NULL ||
      action === ReferentialAction.CASCADE
    );
  }

  return true;
}

function deferrabilityOptionsProvider(): Array<{
  name: string;
  options: Record<string, boolean>;
  expectedOptions: Record<string, boolean>;
}> {
  const notDeferrable = { deferrable: false, deferred: false };
  const deferrable = { deferrable: true, deferred: false };
  const deferred = { deferrable: true, deferred: true };

  return [
    { name: "unspecified", options: {}, expectedOptions: notDeferrable },
    { name: "INITIALLY IMMEDIATE", options: { deferred: false }, expectedOptions: notDeferrable },
    { name: "INITIALLY DEFERRED", options: { deferred: true }, expectedOptions: deferred },
    { name: "NOT DEFERRABLE", options: { deferrable: false }, expectedOptions: notDeferrable },
    {
      name: "NOT DEFERRABLE INITIALLY IMMEDIATE",
      options: { deferrable: false, deferred: false },
      expectedOptions: notDeferrable,
    },
    { name: "DEFERRABLE", options: { deferrable: true }, expectedOptions: deferrable },
    {
      name: "DEFERRABLE INITIALLY IMMEDIATE",
      options: { deferrable: true, deferred: false },
      expectedOptions: deferrable,
    },
    {
      name: "DEFERRABLE INITIALLY DEFERRED",
      options: { deferrable: true, deferred: true },
      expectedOptions: deferred,
    },
  ];
}

function pickKnownBooleanOptions(
  actualOptions: Record<string, unknown>,
  expectedOptions: Record<string, boolean>,
): Record<string, boolean> {
  const output: Record<string, boolean> = {};

  for (const key of Object.keys(expectedOptions)) {
    output[key] = actualOptions[key] === true;
  }

  return output;
}

function referentialActions(): ReferentialAction[] {
  return Object.values(ReferentialAction).filter(
    (value): value is ReferentialAction => typeof value === "string",
  );
}

function hasSameColumnMapping(left: ForeignKeyConstraint, right: ForeignKeyConstraint): boolean {
  return (
    left.getReferencingColumnNames().join(",") === right.getReferencingColumnNames().join(",") &&
    left.getReferencedColumnNames().join(",") === right.getReferencedColumnNames().join(",")
  );
}
