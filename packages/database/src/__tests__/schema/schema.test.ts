import { beforeAll, describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import type { AbstractSchemaManager } from "../../schema/abstract-schema-manager";
import { OptionallyUnqualifiedNamedObjectSet } from "../../schema/collections/optionally-unqualified-named-object-set";
import { UnqualifiedNamedObjectSet } from "../../schema/collections/unqualified-named-object-set";
import { Column } from "../../schema/column";
import { ColumnDiff } from "../../schema/column-diff";
import { ColumnEditor } from "../../schema/column-editor";
import { ComparatorConfig } from "../../schema/comparator-config";
import { NamespaceAlreadyExists } from "../../schema/exception/namespace-already-exists";
import { SequenceAlreadyExists } from "../../schema/exception/sequence-already-exists";
import { SequenceDoesNotExist } from "../../schema/exception/sequence-does-not-exist";
import { TableAlreadyExists } from "../../schema/exception/table-already-exists";
import { TableDoesNotExist } from "../../schema/exception/table-does-not-exist";
import { ForeignKeyConstraint } from "../../schema/foreign-key-constraint";
import { Deferrability } from "../../schema/foreign-key-constraint/deferrability";
import { MatchType } from "../../schema/foreign-key-constraint/match-type";
import { ReferentialAction } from "../../schema/foreign-key-constraint/referential-action";
import { ForeignKeyConstraintEditor } from "../../schema/foreign-key-constraint-editor";
import { Index } from "../../schema/index";
import { IndexType } from "../../schema/index/index-type";
import { IndexEditor } from "../../schema/index-editor";
import { IntrospectingSchemaProvider } from "../../schema/introspection/introspecting-schema-provider";
import { OptionallyQualifiedName } from "../../schema/name/optionally-qualified-name";
import {
  UnquotedIdentifierFolding,
  foldUnquotedIdentifier,
} from "../../schema/name/unquoted-identifier-folding";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { PrimaryKeyConstraintEditor } from "../../schema/primary-key-constraint-editor";
import { Schema } from "../../schema/schema";
import { SchemaConfig } from "../../schema/schema-config";
import { SchemaDiff } from "../../schema/schema-diff";
import { Sequence } from "../../schema/sequence";
import { SequenceEditor } from "../../schema/sequence-editor";
import { Table } from "../../schema/table";
import { TableDiff } from "../../schema/table-diff";
import { TableEditor } from "../../schema/table-editor";
import { UniqueConstraint } from "../../schema/unique-constraint";
import { UniqueConstraintEditor } from "../../schema/unique-constraint-editor";
import { ViewEditor } from "../../schema/view-editor";
import { registerBuiltInTypes } from "../../types/register-built-in-types";
import { Types } from "../../types/types";

class NamedItem {
  public constructor(private readonly name: string) {}

  public getName(): string {
    return this.name;
  }
}

class OptionalNamedItem {
  public constructor(private readonly name: string | null) {}

  public getObjectName(): string | null {
    return this.name;
  }
}

describe("Schema API surface parity batch", () => {
  it("adds Doctrine-style ColumnDiff getters and change detectors", () => {
    const oldColumn = new Column("id", Types.INTEGER, { autoincrement: false, comment: "old" });
    const newColumn = new Column("id", Types.INTEGER, { autoincrement: true, comment: "new" });
    const diff = new ColumnDiff(oldColumn, newColumn, ["autoincrement", "comment"]);

    expect(diff.getOldColumn()).toBe(oldColumn);
    expect(diff.getNewColumn()).toBe(newColumn);
    expect(diff.hasAutoIncrementChanged()).toBe(true);
    expect(diff.hasCommentChanged()).toBe(true);
    expect(diff.hasLengthChanged()).toBe(false);
    expect(diff.countChangedProperties()).toBeGreaterThanOrEqual(2);
  });

  it("adds Doctrine-style TableDiff getters and mutators", () => {
    const oldTable = new Table("users");
    oldTable.addColumn("id", Types.INTEGER);

    const newTable = new Table("users");
    newTable.addColumn("user_id", Types.INTEGER);

    const oldColumn = new Column("id", Types.INTEGER);
    const newColumn = new Column("user_id", Types.INTEGER);
    const renamedColumnDiff = new ColumnDiff(oldColumn, newColumn, []);

    const addedIndex = new Index("idx_users_email", ["email"]);
    const droppedIndex = new Index("idx_users_name", ["name"]);
    const droppedForeignKey = new ForeignKeyConstraint(
      ["role_id"],
      "roles",
      ["id"],
      "fk_users_roles",
    );

    const diff = new TableDiff(oldTable, newTable, {
      addedColumns: [new Column("email", Types.STRING)],
      changedColumns: [renamedColumnDiff],
      droppedColumns: [oldColumn],
      addedIndexes: [addedIndex],
      droppedIndexes: [droppedIndex],
      droppedForeignKeys: [droppedForeignKey],
      renamedIndexes: { idx_old: new Index("idx_new", ["email"]) },
    });

    expect(diff.getOldTable()).toBe(oldTable);
    expect(diff.getAddedColumns()).toHaveLength(1);
    expect(diff.getChangedColumns()).toHaveLength(1);
    expect(diff.getModifiedColumns()).toHaveLength(0);
    expect(diff.getRenamedColumns()).toEqual({ id: newColumn });
    expect(diff.getDroppedColumns()).toHaveLength(1);
    expect(diff.getAddedIndexes()).toHaveLength(1);
    expect(diff.getDroppedIndexes()).toHaveLength(1);
    expect(diff.getRenamedIndexes()).toHaveProperty("idx_old");
    expect(diff.getDroppedForeignKeys()).toHaveLength(1);
    expect(diff.getDroppedForeignKeyConstraintNames()).toEqual(["fk_users_roles"]);
    expect(diff.isEmpty()).toBe(false);

    diff.unsetAddedIndex(addedIndex);
    diff.unsetDroppedIndex(droppedIndex);

    expect(diff.getAddedIndexes()).toHaveLength(0);
    expect(diff.getDroppedIndexes()).toHaveLength(0);
  });

  it("adds Doctrine-style collection ObjectSet aliases", () => {
    const set = new UnqualifiedNamedObjectSet<NamedItem>();
    expect(set.isEmpty()).toBe(true);

    set.add(new NamedItem("Users"));
    expect(set.isEmpty()).toBe(false);
    expect(set.get("users")?.getName()).toBe("Users");
    expect([...set.getIterator()].map((item) => item.getName())).toEqual(["Users"]);

    set.modify("users", () => new NamedItem("Accounts"));
    expect(set.get("accounts")?.getName()).toBe("Accounts");
    expect(set.toList().map((item) => item.getName())).toEqual(["Accounts"]);

    set.remove("accounts");
    expect(set.get("accounts")).toBeNull();
  });

  it("adds Doctrine-style optional collection aliases", () => {
    const set = new OptionallyUnqualifiedNamedObjectSet<OptionalNamedItem>();
    set.add(new OptionalNamedItem("fk_users_roles"));
    set.add(new OptionalNamedItem(null));

    expect(set.get("FK_USERS_ROLES")?.getObjectName()).toBe("fk_users_roles");
    expect(set.toList()).toHaveLength(2);
    expect([...set.getIterator()]).toHaveLength(2);

    set.modify("fk_users_roles", () => new OptionalNamedItem("fk_users_profiles"));
    expect(set.get("fk_users_roles")).toBeNull();
    expect(set.get("fk_users_profiles")?.getObjectName()).toBe("fk_users_profiles");

    set.remove("fk_users_profiles");
    expect(set.toList()).toHaveLength(1);
  });

  it("adds Sequence mutator aliases and auto-increment detection", () => {
    const table = new Table("users");
    table.addColumn("id", Types.INTEGER, { autoincrement: true });
    table.setPrimaryKey(["id"]);

    const sequence = new Sequence("users_id_seq");
    sequence.setAllocationSize(10).setInitialValue(5);

    expect(sequence.getAllocationSize()).toBe(10);
    expect(sequence.getInitialValue()).toBe(5);
    expect(sequence.isAutoIncrementsFor(table)).toBe(true);
  });

  it("adds SequenceEditor and ViewEditor unquoted-name helpers", () => {
    const sequence = new SequenceEditor()
      .setUnquotedName("users_id_seq", "app")
      .setAllocationSize(5)
      .create();
    const view = new ViewEditor()
      .setUnquotedName("active_users", "app")
      .setSQL("SELECT 1")
      .create();

    expect(sequence.getName()).toBe("app.users_id_seq");
    expect(view.getName()).toBe("app.active_users");
  });

  it("adds ColumnEditor quoted/unquoted and platform-option helper setters", () => {
    const quoted = new ColumnEditor()
      .setQuotedName("age")
      .setTypeName(Types.INTEGER)
      .setMinimumValue(0)
      .setMaximumValue(130)
      .create();

    const unquoted = new ColumnEditor()
      .setUnquotedName("status")
      .setTypeName(Types.STRING)
      .setEnumType("App\\\\Enum\\\\Status")
      .setDefaultConstraintName("df_users_status")
      .create();

    expect(quoted.getName()).toBe("age");
    expect(quoted.isQuoted()).toBe(true);
    expect(quoted.getPlatformOption("min")).toBe(0);
    expect(quoted.getPlatformOption("max")).toBe(130);
    expect(quoted.getMinimumValue()).toBe(0);
    expect(quoted.getMaximumValue()).toBe(130);

    expect(unquoted.getName()).toBe("status");
    expect(unquoted.isQuoted()).toBe(false);
    expect(unquoted.getEnumType()).toBe("App\\\\Enum\\\\Status");
    expect(unquoted.getDefaultConstraintName()).toBe("df_users_status");
    expect(unquoted.getPlatformOption("default_constraint_name")).toBe("df_users_status");
  });

  it("adds IndexEditor quoted/unquoted name and column helper setters", () => {
    const quoted = new IndexEditor()
      .setQuotedName("idx_users_email")
      .setQuotedColumnNames("email")
      .setType(IndexType.UNIQUE)
      .create();
    const unquoted = new IndexEditor()
      .setUnquotedName("idx_users_role")
      .setUnquotedColumnNames("role_id")
      .create();
    const generic = new IndexEditor().setName("idx_users_id").setColumnNames("id").create();

    expect(quoted.isQuoted()).toBe(true);
    expect(quoted.getColumns()).toEqual(["email"]);
    expect(quoted.getQuotedColumns(new MySQLPlatform())).toEqual(["`email`"]);
    expect(unquoted.getName()).toBe("idx_users_role");
    expect(unquoted.getColumns()).toEqual(["role_id"]);
    expect(generic.getName()).toBe("idx_users_id");
  });

  it("adds ComparatorConfig immutable Datazen-style getters and withers", () => {
    const base = new ComparatorConfig({
      detectColumnRenames: false,
      detectIndexRenames: true,
      reportModifiedIndexes: false,
    });
    const next = base.withDetectRenamedColumns(true).withReportModifiedIndexes(true);

    expect(base.getDetectRenamedColumns()).toBe(false);
    expect(base.getDetectRenamedIndexes()).toBe(true);
    expect(base.getReportModifiedIndexes()).toBe(false);
    expect(next.getDetectRenamedColumns()).toBe(true);
    expect(next.getDetectRenamedIndexes()).toBe(true);
    expect(next.getReportModifiedIndexes()).toBe(true);
    expect(next.isDetectColumnRenamesEnabled()).toBe(true);
    expect(next.isDetectIndexRenamesEnabled()).toBe(true);
  });

  it("adds UniqueConstraintEditor quoted/unquoted helpers and clustered setter", () => {
    const unique = new UniqueConstraintEditor()
      .setQuotedName("uniq_users_email")
      .setQuotedColumnNames("email")
      .setIsClustered(true)
      .create();
    const nonClustered = new UniqueConstraintEditor()
      .setUnquotedName("uniq_users_name")
      .setUnquotedColumnNames("name")
      .setIsClustered(false)
      .create();

    expect(unique.getObjectName()).toBe('"uniq_users_email"');
    expect(unique.getColumnNames()).toEqual(["email"]);
    expect(unique.isClustered()).toBe(true);
    expect(nonClustered.getObjectName()).toBe("uniq_users_name");
    expect(nonClustered.isClustered()).toBe(false);
  });

  it("adds PrimaryKeyConstraintEditor quoted/unquoted helper setters", () => {
    const quoted = new PrimaryKeyConstraintEditor()
      .setQuotedName("pk_users")
      .setQuotedColumnNames("id")
      .setIsClustered(false)
      .create();
    const unquoted = new PrimaryKeyConstraintEditor()
      .setUnquotedName("pk_accounts")
      .setUnquotedColumnNames("account_id")
      .setIsClustered(true)
      .create();

    expect(quoted.getObjectName()).toBe('"pk_users"');
    expect(quoted.getColumnNames()).toEqual(['"id"']);
    expect(unquoted.getObjectName()).toBe("pk_accounts");
    expect(unquoted.getColumnNames()).toEqual(["account_id"]);
    expect(unquoted.isClustered()).toBe(true);
  });

  it("adds TableEditor public API aliases for names, columns, indexes and constraints", () => {
    const editor = new TableEditor()
      .setUnquotedName("users", "app")
      .setComment("Users table")
      .setConfiguration({ ignoredInPort: true })
      .setColumns(
        new Column("id", Types.INTEGER),
        new Column("email", Types.STRING, { length: 190 }),
        new Column("role_id", Types.INTEGER),
      )
      .setIndexes(new Index("idx_users_role", ["role_id"]), new Index("idx_users_email", ["email"]))
      .setUniqueConstraints(new UniqueConstraint("uniq_users_email", ["email"]))
      .setForeignKeyConstraints(
        new ForeignKeyConstraint(["role_id"], "roles", ["id"], "fk_users_role"),
      );

    editor.modifyColumnByUnquotedName("email", (columnEditor) => {
      columnEditor.setName("email_address").setComment("login address");
    });
    editor.renameColumnByUnquotedName("role_id", "account_role_id");
    editor.dropColumnByUnquotedName("email_address");

    editor.renameIndexByUnquotedName("idx_users_role", "idx_users_account_role");
    editor.dropIndexByUnquotedName("idx_users_email");

    editor.addPrimaryKeyConstraint(new PrimaryKeyConstraint("pk_users", ["id"], false));
    editor.dropPrimaryKeyConstraint();
    editor.addPrimaryKeyConstraint(new PrimaryKeyConstraint("pk_users", ["id"], false));

    editor.dropUniqueConstraintByUnquotedName("uniq_users_email");
    editor.dropForeignKeyConstraintByUnquotedName("fk_users_role");

    const table = editor.create();

    expect(table.getName()).toBe("app.users");
    expect(table.getOption("comment")).toBe("Users table");
    expect(table.getColumns().map((column) => column.getName())).toEqual(["id", "account_role_id"]);
    expect(table.getIndexes().map((index) => index.getName())).toContain("idx_users_account_role");
    expect(table.getIndexes().map((index) => index.getName())).not.toContain("idx_users_email");
    expect(table.getPrimaryKey().getColumns()).toEqual(["id"]);
    expect(table.getForeignKeys()).toHaveLength(0);
  });

  it("renames columns through TableEditor and updates index/constraint column references", () => {
    const editor = new TableEditor()
      .setName("users")
      .setColumns(new Column("role_id", Types.INTEGER))
      .setIndexes(new Index("idx_users_role", ["role_id"]))
      .setPrimaryKeyConstraint(new PrimaryKeyConstraint("pk_users_role", ["role_id"], false))
      .setUniqueConstraints(new UniqueConstraint("uniq_users_role", ["role_id"]))
      .setForeignKeyConstraints(
        new ForeignKeyConstraint(["role_id"], "roles", ["id"], "fk_users_role"),
      );

    editor.renameColumn("role_id", "account_role_id");

    const table = editor.create();

    expect(table.getColumn("account_role_id").getName()).toBe("account_role_id");
    expect(table.getIndex("idx_users_role").getColumns()).toEqual(["account_role_id"]);
    expect(table.getPrimaryKey().getColumns()).toEqual(["account_role_id"]);
    const uniqueConstraint = table
      .getUniqueConstraints()
      .find((constraint) => constraint.getObjectName() === "uniq_users_role");
    expect(uniqueConstraint?.getColumnNames()).toEqual(["account_role_id"]);
    expect(table.getForeignKeys()[0]?.getColumns()).toEqual(["account_role_id"]);
  });

  it("adds Table public API parity helpers for unique constraints, comments, renames and aliases", () => {
    const table = new Table("users");
    table.addColumn("id", Types.INTEGER);
    table.addColumn("email", Types.STRING, { length: 190 });
    table.addColumn("role_id", Types.INTEGER);
    table.addIndex(["email"], "idx_users_email");
    table.addForeignKeyConstraint("roles", ["role_id"], ["id"], {}, "fk_users_roles");

    table.addUniqueConstraint(new UniqueConstraint("uniq_users_email", ["email"]));
    expect(table.hasUniqueConstraint("uniq_users_email")).toBe(true);
    expect(table.getUniqueConstraint("uniq_users_email").getColumnNames()).toEqual(["email"]);
    expect(table.getUniqueConstraints()).toHaveLength(1);
    expect(table.columnsAreIndexed(["email"])).toBe(true);

    table.addPrimaryKeyConstraint(new PrimaryKeyConstraint("pk_users", ["id"], false));
    expect(table.getPrimaryKeyConstraint()?.getColumnNames()).toEqual(["id"]);

    table.renameIndex("idx_users_email", "idx_users_login_email");
    expect(table.hasIndex("idx_users_login_email")).toBe(true);

    table.modifyColumn("email", { comment: "login email" });
    expect(table.getColumn("email").getComment()).toBe("login email");

    table.renameColumn("role_id", "account_role_id");
    expect(table.getForeignKey("fk_users_roles").getColumns()).toEqual(["account_role_id"]);
    expect(table.getRenamedColumns()).toEqual({ account_role_id: "role_id" });

    table.setComment("Users table");
    expect(table.getComment()).toBe("Users table");

    table.setSchemaConfig(new SchemaConfig().setMaxIdentifierLength(30));

    table.dropForeignKey("fk_users_roles");
    expect(table.getForeignKeys()).toHaveLength(0);

    table.removeUniqueConstraint("uniq_users_email");
    expect(table.getUniqueConstraints()).toHaveLength(0);

    table.addUniqueConstraint(new UniqueConstraint("uniq_users_email_2", ["email"]));
    table.dropUniqueConstraint("uniq_users_email_2");
    expect(table.getUniqueConstraints()).toHaveLength(0);

    table.dropPrimaryKey();
    expect(table.getPrimaryKeyConstraint()).toBeNull();
  });

  it("preserves unique constraints when creating a table through TableEditor", () => {
    const table = new TableEditor()
      .setName("users")
      .setColumns(new Column("id", Types.INTEGER), new Column("email", Types.STRING))
      .setUniqueConstraints(new UniqueConstraint("uniq_users_email", ["email"]))
      .create();

    expect(table.hasUniqueConstraint("uniq_users_email")).toBe(true);
    expect(table.getUniqueConstraints()).toHaveLength(1);
  });

  it("adds Index public API parity getters and helpers", () => {
    const index = new Index("idx_users_email", ["email"], true, false, ["clustered"], {
      lengths: [10],
      where: "email IS NOT NULL",
    });
    const other = new Index("idx_users_email_partial", ["email"], false, false, [], {
      where: "email IS NOT NULL",
    });

    expect(index.getType()).toBe(IndexType.UNIQUE);
    expect(index.isClustered()).toBe(true);
    expect(index.getPredicate()).toBe("email IS NOT NULL");
    expect(index.getIndexedColumns()[0]?.getColumnName().toString()).toBe("email");
    expect(index.getIndexedColumns()[0]?.getLength()).toBe(10);
    expect(index.overrules(other)).toBe(true);

    index.removeFlag("clustered");
    expect(index.isClustered()).toBe(false);
  });

  it("adds ForeignKeyConstraint public API parity getters and aliases", () => {
    const platform = new MySQLPlatform();
    const foreignKey = new ForeignKeyConstraint(
      ["role_id"],
      "app.roles",
      ["id"],
      "fk_users_roles",
      {
        deferrable: true,
        deferred: true,
        match: "FULL",
        onDelete: "CASCADE",
        onUpdate: "RESTRICT",
      },
    );

    expect(foreignKey.getReferencedTableName().toString()).toBe("app.roles");
    expect(foreignKey.getLocalColumns()).toEqual(["role_id"]);
    expect(foreignKey.getReferencedColumnNames()).toEqual(["id"]);
    expect(foreignKey.getUnquotedLocalColumns()).toEqual(["role_id"]);
    expect(foreignKey.getUnquotedForeignColumns()).toEqual(["id"]);
    expect(foreignKey.getUnqualifiedForeignTableName()).toBe("roles");
    expect(foreignKey.getQuotedForeignTableName(platform)).toBe("app.roles");
    expect(foreignKey.getMatchType()).toBe(MatchType.FULL);
    expect(foreignKey.getOnDeleteAction()).toBe(ReferentialAction.CASCADE);
    expect(foreignKey.getOnUpdateAction()).toBe(ReferentialAction.RESTRICT);
    expect(foreignKey.getDeferrability()).toBe(Deferrability.DEFERRED);
    expect(foreignKey.intersectsIndexColumns(new Index("idx_users_role", ["role_id"]))).toBe(true);
  });

  it("adds Datazen-style enum toSQL helpers for FK match/deferrability", () => {
    expect(Deferrability.toSQL(Deferrability.DEFERRED)).toBe("INITIALLY DEFERRED");
    expect(MatchType.toSQL(MatchType.FULL)).toBe("FULL");
    expect(ReferentialAction.toSQL(ReferentialAction.CASCADE)).toBe("CASCADE");
  });

  it("adds ForeignKeyConstraintEditor quoted/unquoted helper setters", () => {
    const platform = new MySQLPlatform();
    const foreignKey = new ForeignKeyConstraintEditor()
      .setQuotedName("fk_users_roles")
      .setQuotedReferencingColumnNames("role_id")
      .setQuotedReferencedTableName("roles", "app")
      .setQuotedReferencedColumnNames("id")
      .setOnDeleteAction(ReferentialAction.CASCADE)
      .setDeferrability(Deferrability.DEFERRED)
      .create();

    expect(foreignKey.getName()).toBe("fk_users_roles");
    expect(foreignKey.getQuotedLocalColumns(platform)).toEqual(["`role_id`"]);
    expect(foreignKey.getQuotedForeignTableName(platform)).toBe("`app`.`roles`");
    expect(foreignKey.getQuotedForeignColumns(platform)).toEqual(["`id`"]);
    expect(foreignKey.getOnDeleteAction()).toBe(ReferentialAction.CASCADE);
    expect(foreignKey.getDeferrability()).toBe(Deferrability.DEFERRED);

    const unquoted = new ForeignKeyConstraintEditor()
      .setUnquotedName("fk_users_profiles")
      .setUnquotedReferencingColumnNames("profile_id")
      .setUnquotedReferencedTableName("profiles", "app")
      .setUnquotedReferencedColumnNames("id")
      .create();

    expect(unquoted.getName()).toBe("fk_users_profiles");
    expect(unquoted.getForeignTableName()).toBe("app.profiles");
    expect(unquoted.getColumns()).toEqual(["profile_id"]);
  });

  it("adds SchemaDiff getters and empty-check aliases", () => {
    const oldTable = new Table("users");
    const newTable = new Table("users");
    const nonEmptyDiff = new TableDiff(oldTable, newTable, {
      addedColumns: [new Column("id", Types.INTEGER)],
    });
    const emptyDiff = new TableDiff(new Table("roles"), new Table("roles"));

    const diff = new SchemaDiff({
      createdSchemas: ["app"],
      droppedSchemas: ["legacy"],
      createdTables: [new Table("accounts")],
      alteredTables: [nonEmptyDiff, emptyDiff],
      droppedTables: [new Table("logs")],
      createdSequences: [new Sequence("accounts_id_seq")],
      alteredSequences: [new Sequence("orders_id_seq")],
      droppedSequences: [new Sequence("legacy_id_seq")],
    });

    expect(diff.getCreatedSchemas()).toEqual(["app"]);
    expect(diff.getDroppedSchemas()).toEqual(["legacy"]);
    expect(diff.getCreatedTables()).toHaveLength(1);
    expect(diff.getAlteredTables()).toEqual([nonEmptyDiff]);
    expect(diff.getDroppedTables()).toHaveLength(1);
    expect(diff.getCreatedSequences()).toHaveLength(1);
    expect(diff.getAlteredSequences()).toHaveLength(1);
    expect(diff.getDroppedSequences()).toHaveLength(1);
    expect(diff.isEmpty()).toBe(false);
    expect(diff.hasChanges()).toBe(true);

    const onlyEmptyAlteredTables = new SchemaDiff({ alteredTables: [emptyDiff] });
    expect(onlyEmptyAlteredTables.getAlteredTables()).toHaveLength(0);
    expect(onlyEmptyAlteredTables.isEmpty()).toBe(true);
  });

  it("adds SchemaConfig.toTableConfiguration() and identifier folding enum alias", () => {
    const config = new SchemaConfig().setMaxIdentifierLength(30);
    const tableConfig = config.toTableConfiguration();

    expect(tableConfig.getMaxIdentifierLength()).toBe(30);
    expect(foldUnquotedIdentifier(UnquotedIdentifierFolding.UPPER, "app_users")).toBe("APP_USERS");
    expect(
      UnquotedIdentifierFolding.foldUnquotedIdentifier(
        UnquotedIdentifierFolding.LOWER,
        "App_Users",
      ),
    ).toBe("app_users");
    expect(
      UnquotedIdentifierFolding.foldUnquotedIdentifier(UnquotedIdentifierFolding.NONE, "App_Users"),
    ).toBe("App_Users");
  });

  it("adds Schema rename and SQL generation helpers", () => {
    const schema = new Schema([], [], new SchemaConfig().setName("app"));
    const users = schema.createTable("users");
    users.addColumn("id", Types.INTEGER);
    users.setPrimaryKey(["id"]);

    expect(schema.getName()).toBe("app");

    schema.renameTable("users", "accounts");

    expect(schema.hasTable("users")).toBe(false);
    expect(schema.hasTable("accounts")).toBe(true);
    expect(schema.getTable("accounts").getColumn("id").getName()).toBe("id");

    const platform = new MySQLPlatform();
    const createSql = schema.toSql(platform);
    expect(createSql).toHaveLength(1);
    expect(createSql[0]).toContain("CREATE TABLE accounts");
    expect(createSql[0]).toContain("PRIMARY KEY (id)");
    expect(schema.toDropSql(platform)).toEqual(["DROP TABLE accounts"]);
  });

  it("adds IntrospectingSchemaProvider public API methods with delegation and fallbacks", async () => {
    const introspectedTable = new Table("app.users");
    introspectedTable.addColumn("id", Types.INTEGER);
    introspectedTable.setPrimaryKey(["id"], "pk_users");
    introspectedTable.addIndex(["id"], "idx_users_id");
    introspectedTable.addForeignKeyConstraint("roles", ["id"], ["id"], {}, "fk_users_roles");
    introspectedTable.addOption("engine", "InnoDB");

    const schemaManager = {
      createSchema: async () => new Schema([new Table("users")]),
      listTableNames: async () => ["app.users", "roles"],
      listTables: async () => [new Table("app.users"), new Table("roles")],
      listViews: async () => [],
      listDatabases: async () => ["main"],
      listSchemaNames: async () => ["app"],
      introspectTable: async (tableName: string) =>
        tableName === "app.users" ? introspectedTable : new Table(tableName),
    } as unknown as AbstractSchemaManager;

    const provider = new IntrospectingSchemaProvider(schemaManager);

    expect((await provider.getAllDatabaseNames()).map((name) => name.toString())).toEqual(["main"]);
    expect((await provider.getAllSchemaNames()).map((name) => name.toString())).toEqual(["app"]);
    expect((await provider.getAllTableNames()).map((name) => name.toString())).toEqual([
      "app.users",
      "roles",
    ]);
    expect((await provider.getAllTables()).map((table) => table.getName())).toEqual([
      "app.users",
      "roles",
    ]);
    expect(
      (await provider.getColumnsForTable("app", "users")).map((column) => column.getName()),
    ).toEqual(["id"]);
    expect(
      (await provider.getIndexesForTable("app", "users")).map((index) => index.getName()),
    ).toEqual(["pk_users", "idx_users_id"]);
    expect(await provider.getPrimaryKeyConstraintForTable("app", "users")).not.toBeNull();
    expect(
      (await provider.getForeignKeyConstraintsForTable("app", "users")).map((fk) => fk.getName()),
    ).toEqual(["fk_users_roles"]);
    expect(await provider.getOptionsForTable("app", "users")).toEqual({ engine: "InnoDB" });
    expect(await provider.getAllViews()).toEqual([]);
    expect(await provider.getAllSequences()).toEqual([]);
    expect((await provider.createSchema()).getTables()).toHaveLength(1);
  });
});

describe("Schema (Doctrine SchemaTest parity, unified scope)", () => {
  beforeAll(() => {
    registerBuiltInTypes();
  });

  it("adds and retrieves tables", () => {
    const table = createTable("public.foo");
    const schema = new Schema([table]);

    expect(schema.hasTable("public.foo")).toBe(true);
    expect(schema.getTables()).toEqual([table]);
    expect(schema.getTable("public.foo")).toBe(table);
  });

  it("matches tables case-insensitively", () => {
    const table = createTable("Foo");
    const schema = new Schema([table]);

    expect(schema.hasTable("foo")).toBe(true);
    expect(schema.hasTable("FOO")).toBe(true);
    expect(schema.getTable("foo")).toBe(table);
    expect(schema.getTable("FOO")).toBe(table);
  });

  it("throws for unknown table", () => {
    const schema = new Schema();
    expect(() => schema.getTable("unknown")).toThrow(TableDoesNotExist);
  });

  it("throws when the same table is added twice", () => {
    const table = createTable("foo");
    expect(() => new Schema([table, table])).toThrow(TableAlreadyExists);
  });

  it("renames tables", () => {
    const schema = new Schema([createTable("foo")]);

    schema.renameTable("foo", "bar");

    expect(schema.hasTable("foo")).toBe(false);
    expect(schema.hasTable("bar")).toBe(true);
    expect(schema.getTable("bar").getName()).toBe("bar");
  });

  it("drops tables", () => {
    const schema = new Schema([createTable("foo")]);

    schema.dropTable("foo");

    expect(schema.hasTable("foo")).toBe(false);
  });

  it("creates tables and preserves parsed object names", () => {
    const schema = new Schema();

    const table = schema.createTable("foo");

    expect(table.getObjectName()).toEqual(OptionallyQualifiedName.unquoted("foo"));
    expect(schema.hasTable("foo")).toBe(true);
  });

  it("adds and retrieves sequences", () => {
    const sequence = new Sequence("a_seq");
    const schema = new Schema([], [sequence]);

    expect(schema.hasSequence("a_seq")).toBe(true);
    expect(schema.getSequence("a_seq")).toBe(sequence);
    expect(schema.getSequences()).toEqual([sequence]);
  });

  it("matches sequences case-insensitively", () => {
    const sequence = new Sequence("a_Seq");
    const schema = new Schema([], [sequence]);

    expect(schema.hasSequence("a_seq")).toBe(true);
    expect(schema.hasSequence("A_SEQ")).toBe(true);
    expect(schema.getSequence("a_seq")).toBe(sequence);
    expect(schema.getSequence("A_SEQ")).toBe(sequence);
  });

  it("throws for unknown sequence", () => {
    const schema = new Schema();
    expect(() => schema.getSequence("unknown")).toThrow(SequenceDoesNotExist);
  });

  it("creates sequences with allocation and initial values", () => {
    const schema = new Schema();

    const sequence = schema.createSequence("a_seq", 10, 20);

    expect(sequence.getObjectName()).toEqual(OptionallyQualifiedName.unquoted("a_seq"));
    expect(sequence.getAllocationSize()).toBe(10);
    expect(sequence.getInitialValue()).toBe(20);
    expect(schema.hasSequence("a_seq")).toBe(true);
  });

  it("drops sequences", () => {
    const schema = new Schema([], [new Sequence("a_seq")]);

    schema.dropSequence("a_seq");

    expect(schema.hasSequence("a_seq")).toBe(false);
  });

  it("throws when the same sequence is added twice", () => {
    const sequence = new Sequence("a_seq");
    expect(() => new Schema([], [sequence, sequence])).toThrow(SequenceAlreadyExists);
  });

  it("creates and tracks namespaces (case-insensitive lookups)", () => {
    const schema = new Schema([], [], new SchemaConfig().setName("public"));

    expect(schema.hasNamespace("foo")).toBe(false);

    schema.createNamespace("foo");

    expect(schema.hasNamespace("foo")).toBe(true);
    expect(schema.hasNamespace("FOO")).toBe(true);
    expect(schema.getNamespaces()).toEqual(["foo"]);
  });

  it("throws on duplicate namespace creation", () => {
    const schema = new Schema();
    schema.createNamespace("foo");

    expect(() => schema.createNamespace("foo")).toThrow(NamespaceAlreadyExists);
  });

  it("respects explicit schema name and basic SQL generation helpers", () => {
    const schema = new Schema([], [], new SchemaConfig().setName("app"));
    const table = schema.createTable("users");
    table.addColumn("id", Types.INTEGER);
    table.setPrimaryKey(["id"]);

    expect(schema.getName()).toBe("app");

    const sql = schema.toSql(new MySQLPlatform());
    expect(sql.some((statement) => statement.includes("CREATE TABLE users"))).toBe(true);
  });

  it("supports quoted table lookup aliases like `hasTable('`foo`')`", () => {
    const schema = new Schema([createTable("foo")]);

    expect(schema.hasTable("`foo`")).toBe(true);
    expect(schema.hasTable('"foo"')).toBe(true);
    expect(schema.getTable("[foo]").getName()).toBe("foo");
  });

  it("creates namespaces implicitly when adding qualified tables/sequences", () => {
    const schema = new Schema();

    schema.createTable("app.users");
    schema.createSequence("audit.seq");

    expect(schema.hasNamespace("app")).toBe(true);
    expect(schema.hasNamespace("audit")).toBe(true);
    expect(schema.getNamespaces()).toEqual(["app", "audit"]);
  });

  it.skip(
    "covers Doctrine deprecation matrix for qualified/unqualified name ambiguity and default namespace rules (PHP deprecation harness specific)",
  );

  it.skip(
    "covers deep-clone semantics for schema graphs (PHP clone semantics differ from JS/Node)",
  );

  it("enforces max identifier length on auto-generated table indexes via SchemaConfig", () => {
    const schema = new Schema([], [], new SchemaConfig().setMaxIdentifierLength(12));
    const table = schema.createTable("users");
    table.addColumn("really_long_email_column_name", Types.STRING);

    const index = table.addIndex(["really_long_email_column_name"]);

    expect(index.getName().length).toBeLessThanOrEqual(12);
  });
});

function createTable(name: string): Table {
  return Table.editor()
    .setName(name)
    .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
    .create();
}
