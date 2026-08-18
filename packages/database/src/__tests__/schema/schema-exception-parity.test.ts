import { describe, expect, it } from "vitest";

import { ObjectAlreadyExists } from "../../schema/collections/exception/object-already-exists";
import { ObjectDoesNotExist } from "../../schema/collections/exception/object-does-not-exist";
import { OptionallyUnqualifiedNamedObjectSet } from "../../schema/collections/optionally-unqualified-named-object-set";
import { UnqualifiedNamedObjectSet } from "../../schema/collections/unqualified-named-object-set";
import { ColumnEditor } from "../../schema/column-editor";
import { ColumnAlreadyExists } from "../../schema/exception/column-already-exists";
import { ColumnDoesNotExist } from "../../schema/exception/column-does-not-exist";
import { ForeignKeyDoesNotExist } from "../../schema/exception/foreign-key-does-not-exist";
import { IncomparableNames } from "../../schema/exception/incomparable-names";
import { IndexAlreadyExists } from "../../schema/exception/index-already-exists";
import { IndexDoesNotExist } from "../../schema/exception/index-does-not-exist";
import { IndexNameInvalid } from "../../schema/exception/index-name-invalid";
import { InvalidColumnDefinition } from "../../schema/exception/invalid-column-definition";
import { InvalidForeignKeyConstraintDefinition } from "../../schema/exception/invalid-foreign-key-constraint-definition";
import { InvalidIdentifier } from "../../schema/exception/invalid-identifier";
import { InvalidIndexDefinition } from "../../schema/exception/invalid-index-definition";
import { InvalidName as SchemaInvalidName } from "../../schema/exception/invalid-name";
import { InvalidPrimaryKeyConstraintDefinition } from "../../schema/exception/invalid-primary-key-constraint-definition";
import { InvalidSequenceDefinition } from "../../schema/exception/invalid-sequence-definition";
import { InvalidState } from "../../schema/exception/invalid-state";
import { InvalidTableDefinition } from "../../schema/exception/invalid-table-definition";
import { InvalidTableModification } from "../../schema/exception/invalid-table-modification";
import { InvalidTableName } from "../../schema/exception/invalid-table-name";
import { InvalidUniqueConstraintDefinition } from "../../schema/exception/invalid-unique-constraint-definition";
import { InvalidViewDefinition } from "../../schema/exception/invalid-view-definition";
import { NamespaceAlreadyExists } from "../../schema/exception/namespace-already-exists";
import { NotImplemented } from "../../schema/exception/not-implemented";
import { PrimaryKeyAlreadyExists } from "../../schema/exception/primary-key-already-exists";
import { SequenceAlreadyExists } from "../../schema/exception/sequence-already-exists";
import { SequenceDoesNotExist } from "../../schema/exception/sequence-does-not-exist";
import { TableAlreadyExists } from "../../schema/exception/table-already-exists";
import { TableDoesNotExist } from "../../schema/exception/table-does-not-exist";
import { UniqueConstraintDoesNotExist } from "../../schema/exception/unique-constraint-does-not-exist";
import { UnknownColumnOption } from "../../schema/exception/unknown-column-option";
import { UnsupportedName } from "../../schema/exception/unsupported-name";
import { UnsupportedSchema } from "../../schema/exception/unsupported-schema";
import { ForeignKeyConstraintEditor } from "../../schema/foreign-key-constraint-editor";
import { IndexEditor } from "../../schema/index-editor";
import { ExpectedDot } from "../../schema/name/parser/exception/expected-dot";
import { ExpectedNextIdentifier } from "../../schema/name/parser/exception/expected-next-identifier";
import { InvalidName as ParserInvalidName } from "../../schema/name/parser/exception/invalid-name";
import { UnableToParseIdentifier } from "../../schema/name/parser/exception/unable-to-parse-identifier";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Schema } from "../../schema/schema";
import { SequenceEditor } from "../../schema/sequence-editor";
import { Table } from "../../schema/table";
import { TableEditor } from "../../schema/table-editor";
import { UniqueConstraint } from "../../schema/unique-constraint";
import { ViewEditor } from "../../schema/view-editor";
import { Types } from "../../types/types";

class NamedStub {
  constructor(private readonly name: string) {}

  public getName(): string {
    return this.name;
  }
}

class OptionallyNamedStub {
  constructor(private readonly name: string | null) {}

  public getObjectName(): string | null {
    return this.name;
  }
}

describe("Schema exception parity (best effort)", () => {
  it("matches Doctrine-style exception factory messages", () => {
    expect(InvalidColumnDefinition.nameNotSpecified().message).toBe(
      "Column name is not specified.",
    );
    expect(InvalidColumnDefinition.dataTypeNotSpecified("email").message).toBe(
      "Data type is not specified for column email.",
    );

    expect(InvalidIndexDefinition.nameNotSet().message).toBe("Index name is not set.");
    expect(InvalidIndexDefinition.columnsNotSet("idx_users_email").message).toBe(
      "Columns are not set for index idx_users_email.",
    );
    expect(InvalidIndexDefinition.fromNonPositiveColumnLength("email", 0).message).toBe(
      "Indexed column length must be a positive integer, 0 given for column email.",
    );

    expect(InvalidForeignKeyConstraintDefinition.referencedTableNameNotSet(null).message).toBe(
      "Referenced table name is not set for foreign key constraint <unnamed>.",
    );
    expect(
      InvalidForeignKeyConstraintDefinition.referencingColumnNamesNotSet("fk_users_roles").message,
    ).toBe("Referencing column names are not set for foreign key constraint fk_users_roles.");
    expect(
      InvalidForeignKeyConstraintDefinition.referencedColumnNamesNotSet("fk_users_roles").message,
    ).toBe("Referenced column names are not set for foreign key constraint fk_users_roles.");

    expect(InvalidUniqueConstraintDefinition.columnNamesAreNotSet(null).message).toBe(
      "Column names are not set for unique constraint <unnamed>.",
    );
    expect(InvalidPrimaryKeyConstraintDefinition.columnNamesNotSet().message).toBe(
      "Primary key constraint column names are not set.",
    );
    expect(InvalidSequenceDefinition.nameNotSet().message).toBe("Sequence name is not set.");
    expect(InvalidSequenceDefinition.fromNegativeCacheSize(-1).message).toBe(
      "Sequence cache size must be a non-negative integer, -1 given.",
    );

    expect(
      UnsupportedSchema.sqliteMissingForeignKeyConstraintReferencedColumns(null, "users", "roles")
        .message,
    ).toBe(
      'Unable to introspect foreign key constraint <unnamed> on table "users" because the referenced column names are omitted, and the referenced table "roles" does not exist or does not have a primary key.',
    );
    expect(
      UnsupportedSchema.sqliteMissingForeignKeyConstraintReferencedColumns(
        "fk_users_roles",
        "users",
        "roles",
      ).message,
    ).toContain('constraint "fk_users_roles" on table "users"');

    expect(TableAlreadyExists.new("users").message).toBe(
      'The table with name "users" already exists.',
    );
    expect(TableDoesNotExist.new("users").message).toBe(
      'There is no table with name "users" in the schema.',
    );
    expect(SequenceAlreadyExists.new("users_seq").message).toBe(
      'The sequence "users_seq" already exists.',
    );
    expect(SequenceDoesNotExist.new("users_seq").message).toBe(
      'There exists no sequence with the name "users_seq".',
    );
    expect(NamespaceAlreadyExists.new("app").message).toBe(
      'The namespace with name "app" already exists.',
    );
    expect(UnknownColumnOption.new("foo").message).toBe(
      'The "foo" column option is not supported.',
    );
  });

  it("covers remaining schema exception factory messages", () => {
    expect(ColumnAlreadyExists.new("users", "email").message).toBe(
      'The column "email" on table "users" already exists.',
    );
    expect(ColumnDoesNotExist.new("email", "users").message).toBe(
      'There is no column with name "email" on table "users".',
    );
    expect(IndexAlreadyExists.new("idx_users_email", "users").message).toBe(
      'An index with name "idx_users_email" was already defined on table "users".',
    );
    expect(IndexDoesNotExist.new("idx_users_email", "users").message).toBe(
      'Index "idx_users_email" does not exist on table "users".',
    );
    expect(IndexNameInvalid.new("idx-users-email").message).toBe(
      'Invalid index name "idx-users-email" given, has to be [a-zA-Z0-9_].',
    );
    expect(ForeignKeyDoesNotExist.new("fk_users_roles", "users").message).toBe(
      'There exists no foreign key with the name "fk_users_roles" on table "users".',
    );
    expect(InvalidIdentifier.fromEmpty().message).toBe("Identifier cannot be empty.");
    expect(SchemaInvalidName.fromEmpty().message).toBe("Name cannot be empty.");
    expect(InvalidTableName.new("users posts").message).toBe(
      'Invalid table name specified "users posts".',
    );
    expect(NotImplemented.fromMethod("MySchemaManager", "listTables").message).toBe(
      "Class MySchemaManager does not implement method listTables().",
    );
    expect(PrimaryKeyAlreadyExists.new("users").message).toBe(
      'Primary key was already defined on table "users".',
    );
    expect(UniqueConstraintDoesNotExist.new("uniq_users_email", "users").message).toBe(
      'There exists no unique constraint with the name "uniq_users_email" on table "users".',
    );
    expect(UnsupportedName.fromNonNullSchemaName("app", "createTable").message).toBe(
      'createTable() does not accept schema names, "app" given.',
    );
    expect(UnsupportedName.fromNullSchemaName("createTable").message).toBe(
      "createTable() requires a schema name, null given.",
    );
    expect(IncomparableNames.fromOptionallyQualifiedNames("users", "app.users").message).toBe(
      "Non-equally qualified names are incomparable: users, app.users.",
    );
  });

  it("matches Doctrine-style InvalidState messages", () => {
    expect(InvalidState.objectNameNotInitialized().message).toBe(
      "Object name has not been initialized.",
    );
    expect(InvalidState.indexHasInvalidType("idx").message).toBe('Index "idx" has invalid type.');
    expect(InvalidState.uniqueConstraintHasEmptyColumnNames("uniq").message).toBe(
      'Unique constraint "uniq" has no column names.',
    );
    expect(InvalidState.tableHasInvalidPrimaryKeyConstraint("users").message).toBe(
      'Table "users" has invalid primary key constraint.',
    );
    expect(InvalidState.indexHasInvalidPredicate("idx").message).toBe(
      'Index "idx" has invalid predicate.',
    );
    expect(InvalidState.indexHasInvalidColumns("idx").message).toBe(
      'Index "idx" has invalid columns.',
    );
    expect(InvalidState.foreignKeyConstraintHasInvalidReferencedTableName("fk").message).toBe(
      'Foreign key constraint "fk" has invalid referenced table name.',
    );
    expect(InvalidState.foreignKeyConstraintHasInvalidReferencingColumnNames("fk").message).toBe(
      'Foreign key constraint "fk" has one or more invalid referencing column names.',
    );
    expect(InvalidState.foreignKeyConstraintHasInvalidReferencedColumnNames("fk").message).toBe(
      'Foreign key constraint "fk" has one or more invalid referenced column name.',
    );
    expect(InvalidState.foreignKeyConstraintHasInvalidMatchType("fk").message).toBe(
      'Foreign key constraint "fk" has invalid match type.',
    );
    expect(InvalidState.foreignKeyConstraintHasInvalidOnUpdateAction("fk").message).toBe(
      'Foreign key constraint "fk" has invalid ON UPDATE action.',
    );
    expect(InvalidState.foreignKeyConstraintHasInvalidOnDeleteAction("fk").message).toBe(
      'Foreign key constraint "fk" has invalid ON DELETE action.',
    );
    expect(InvalidState.foreignKeyConstraintHasInvalidDeferrability("fk").message).toBe(
      'Foreign key constraint "fk" has invalid deferrability.',
    );
    expect(InvalidState.uniqueConstraintHasInvalidColumnNames("uq").message).toBe(
      'Unique constraint "uq" has one or more invalid column names.',
    );
    expect(InvalidState.tableDiffContainsUnnamedDroppedForeignKeyConstraints().message).toBe(
      "Table diff contains unnamed dropped foreign key constraints",
    );
  });

  it("preserves cause on InvalidTableModification factory methods", () => {
    const previous = ObjectAlreadyExists.new("email");
    const error = InvalidTableModification.columnAlreadyExists("users", previous);

    expect(error).toBeInstanceOf(InvalidTableModification);
    expect(error.message).toBe("Column email already exists on table users.");
    expect((error as Error & { cause?: unknown }).cause).toBe(previous);

    const missing = ObjectDoesNotExist.new("idx_users_email");
    const indexMissing = InvalidTableModification.indexDoesNotExist("users", missing);
    expect(indexMissing.message).toBe("Index idx_users_email does not exist on table users.");
    expect((indexMissing as Error & { cause?: unknown }).cause).toBe(missing);

    expect(InvalidTableModification.primaryKeyConstraintAlreadyExists(null).message).toBe(
      "Primary key constraint already exists on table <unnamed>.",
    );
    expect(
      InvalidTableModification.foreignKeyConstraintReferencingColumnDoesNotExist(
        "users",
        null,
        "role_id",
      ).message,
    ).toBe(
      "Referencing column role_id of foreign key constraint <unnamed> does not exist on table users.",
    );

    expect(
      InvalidTableModification.columnDoesNotExist("users", ObjectDoesNotExist.new("name")).message,
    ).toBe("Column name does not exist on table users.");
    expect(
      InvalidTableModification.indexAlreadyExists("users", ObjectAlreadyExists.new("idx")).message,
    ).toBe("Index idx already exists on table users.");
    expect(InvalidTableModification.primaryKeyConstraintDoesNotExist("users").message).toBe(
      "Primary key constraint does not exist on table users.",
    );

    const uniqueMissing = ObjectDoesNotExist.new("uniq_users_email");
    const uniqueError = InvalidTableModification.uniqueConstraintDoesNotExist(
      "users",
      uniqueMissing,
    );
    expect(uniqueError.message).toBe(
      "Unique constraint uniq_users_email does not exist on table users.",
    );
    expect((uniqueError as Error & { cause?: unknown }).cause).toBe(uniqueMissing);

    expect(
      InvalidTableModification.uniqueConstraintAlreadyExists(
        "users",
        ObjectAlreadyExists.new("uniq_users_email"),
      ).message,
    ).toBe("Unique constraint uniq_users_email already exists on table users.");
    expect(
      InvalidTableModification.foreignKeyConstraintAlreadyExists(
        "users",
        ObjectAlreadyExists.new("fk_users_roles"),
      ).message,
    ).toBe("Foreign key constraint fk_users_roles already exists on table users.");
    expect(
      InvalidTableModification.foreignKeyConstraintDoesNotExist(
        "users",
        ObjectDoesNotExist.new("fk_users_roles"),
      ).message,
    ).toBe("Foreign key constraint fk_users_roles does not exist on table users.");
    expect(
      InvalidTableModification.indexedColumnDoesNotExist("users", "idx_users_email", "email")
        .message,
    ).toBe("Column email referenced by index idx_users_email does not exist on table users.");
    expect(
      InvalidTableModification.primaryKeyConstraintColumnDoesNotExist("users", "primary", "id")
        .message,
    ).toBe("Column id referenced by primary key constraint primary does not exist on table users.");
    expect(
      InvalidTableModification.uniqueConstraintColumnDoesNotExist(
        "users",
        "uniq_users_email",
        "email",
      ).message,
    ).toBe(
      "Column email referenced by unique constraint uniq_users_email does not exist on table users.",
    );
    expect(InvalidTableModification.columnAlreadyExists("users", new Error("boom")).message).toBe(
      "Column <unknown> already exists on table users.",
    );
  });

  it("implements Doctrine-style collection exception helpers", () => {
    const already = ObjectAlreadyExists.new("email");
    const missing = ObjectDoesNotExist.new("email");

    expect(already.message).toBe("Object email already exists.");
    expect(already.getObjectName().toString()).toBe("email");
    expect(missing.message).toBe("Object email does not exist.");
    expect(missing.getObjectName().toString()).toBe("email");
  });

  it("throws typed schema exceptions from editors and schema objects", () => {
    expect(() => new ColumnEditor().create()).toThrow(InvalidColumnDefinition);
    expect(() => new ColumnEditor().create()).toThrowError("Column name is not specified.");

    const missingTypeEditor = new ColumnEditor().setName("email");
    expect(() => missingTypeEditor.create()).toThrow(InvalidColumnDefinition);
    expect(() => missingTypeEditor.create()).toThrowError(
      "Data type is not specified for column email.",
    );

    expect(() => new IndexEditor().create()).toThrow(InvalidIndexDefinition);
    expect(() => new IndexEditor().setName("idx").create()).toThrow(InvalidIndexDefinition);
    expect(() =>
      new IndexEditor()
        .setName("idx")
        .setColumns("email")
        .setOptions({ lengths: [0] })
        .create(),
    ).toThrow(InvalidIndexDefinition);

    expect(() => new ForeignKeyConstraintEditor().create()).toThrow(
      InvalidForeignKeyConstraintDefinition,
    );
    expect(() =>
      new ForeignKeyConstraintEditor().setName("fk").setReferencingColumnNames("id").create(),
    ).toThrowError("Referenced table name is not set for foreign key constraint fk.");
    expect(() =>
      new ForeignKeyConstraintEditor().setName("fk").setReferencedTableName("roles").create(),
    ).toThrowError("Referencing column names are not set for foreign key constraint fk.");
    expect(() =>
      new ForeignKeyConstraintEditor()
        .setName("fk")
        .setReferencingColumnNames("role_id")
        .setReferencedTableName("roles")
        .create(),
    ).toThrowError("Referenced column names are not set for foreign key constraint fk.");

    expect(() => new SequenceEditor().create()).toThrow(InvalidSequenceDefinition);
    expect(() => new SequenceEditor().setName("s").setAllocationSize(-1).create()).toThrowError(
      "Sequence cache size must be a non-negative integer, -1 given.",
    );

    expect(() => new ViewEditor().create()).toThrow(InvalidViewDefinition);
    expect(() => new ViewEditor().setName("v_users").create()).toThrowError(
      "SQL is not set for view v_users.",
    );

    expect(() => new TableEditor().create()).toThrow(InvalidTableDefinition);
    expect(() => new TableEditor().setName("users").create()).toThrowError(
      "Columns are not set for table users.",
    );

    expect(() => new PrimaryKeyConstraint(null, [], false)).toThrow(
      InvalidPrimaryKeyConstraintDefinition,
    );
    expect(() => new UniqueConstraint("uniq_users_email", [])).toThrow(
      InvalidUniqueConstraintDefinition,
    );

    const schema = new Schema();
    schema.createNamespace("app");
    expect(() => schema.createNamespace("app")).toThrow(NamespaceAlreadyExists);

    const users = new Table("users");
    schema.addTable(users);
    expect(() => schema.addTable(new Table("users"))).toThrow(TableAlreadyExists);
    expect(() => schema.getTable("posts")).toThrow(TableDoesNotExist);

    schema.createSequence("users_seq");
    expect(() => schema.addSequence(schema.getSequence("users_seq"))).toThrow(
      SequenceAlreadyExists,
    );
    expect(() => schema.getSequence("missing_seq")).toThrow(SequenceDoesNotExist);

    users.addColumn("id", Types.INTEGER);
    expect(() => users.addColumn("id", Types.INTEGER)).toThrow(ColumnAlreadyExists);
    expect(() => users.getColumn("email")).toThrow(ColumnDoesNotExist);

    expect(() => users.getPrimaryKey()).toThrow(InvalidState);
    users.setPrimaryKey(["id"]);
    expect(() => users.setPrimaryKey(["id"])).toThrow(PrimaryKeyAlreadyExists);

    expect(() => users.getIndex("idx_missing")).toThrow(IndexDoesNotExist);
    expect(() => users.dropIndex("idx_missing")).toThrow(IndexDoesNotExist);

    expect(() => users.getForeignKey("fk_missing")).toThrow(ForeignKeyDoesNotExist);
    expect(() => users.removeForeignKey("fk_missing")).toThrow(ForeignKeyDoesNotExist);
  });

  it("throws Doctrine-style parser exception messages", () => {
    expect(ExpectedDot.new(3, "/").message).toBe('Expected dot at position 3, got "/".');
    expect(ExpectedNextIdentifier.new().message).toBe(
      "Unexpected end of input. Next identifier expected.",
    );
    expect(ParserInvalidName.forUnqualifiedName(2).message).toBe(
      "An unqualified name must consist of one identifier, 2 given.",
    );
    expect(ParserInvalidName.forOptionallyQualifiedName(3).message).toBe(
      "An optionally qualified name must consist of one or two identifiers, 3 given.",
    );
    expect(UnableToParseIdentifier.new(9).message).toBe("Unable to parse identifier at offset 9.");
  });

  it("collection sets use Doctrine-style collection exceptions", () => {
    const set = new UnqualifiedNamedObjectSet<NamedStub>();
    set.add(new NamedStub("users"));

    expect(() => set.add(new NamedStub("users"))).toThrow(ObjectAlreadyExists);
    expect(() => set.getByName("missing")).toThrow(ObjectDoesNotExist);
    expect(() => set.removeByName("missing")).toThrow(ObjectDoesNotExist);

    const optionalSet = new OptionallyUnqualifiedNamedObjectSet<OptionallyNamedStub>();
    optionalSet.add(new OptionallyNamedStub(null));
    optionalSet.add(new OptionallyNamedStub("uq_users_email"));

    expect(() => optionalSet.add(new OptionallyNamedStub("uq_users_email"))).toThrow(
      ObjectAlreadyExists,
    );
    expect(() => optionalSet.getByName("missing_uq")).toThrow(ObjectDoesNotExist);
  });

  it("rejects unknown column options like Doctrine", () => {
    expect(() =>
      new Table("users").addColumn("email", Types.STRING, { definitelyUnknown: true }),
    ).toThrow(UnknownColumnOption);
  });
});
