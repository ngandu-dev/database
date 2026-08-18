import { describe, expect, it } from "vitest";

import { AbstractPlatform } from "../../platforms/abstract-platform";
import { Column } from "../../schema/column";
import { IncomparableNames } from "../../schema/exception/incomparable-names";
import { InvalidIndexDefinition } from "../../schema/exception/invalid-index-definition";
import { Deferrability } from "../../schema/foreign-key-constraint/deferrability";
import { MatchType } from "../../schema/foreign-key-constraint/match-type";
import { ReferentialAction } from "../../schema/foreign-key-constraint/referential-action";
import { IndexType } from "../../schema/index/index-type";
import { IndexedColumn } from "../../schema/index/indexed-column";
import { ForeignKeyConstraintColumnMetadataProcessor } from "../../schema/introspection/metadata-processor/foreign-key-constraint-column-metadata-processor";
import { IndexColumnMetadataProcessor } from "../../schema/introspection/metadata-processor/index-column-metadata-processor";
import { PrimaryKeyConstraintColumnMetadataProcessor } from "../../schema/introspection/metadata-processor/primary-key-constraint-column-metadata-processor";
import { SequenceMetadataProcessor } from "../../schema/introspection/metadata-processor/sequence-metadata-processor";
import { ViewMetadataProcessor } from "../../schema/introspection/metadata-processor/view-metadata-processor";
import { DatabaseMetadataRow } from "../../schema/metadata/database-metadata-row";
import { ForeignKeyConstraintColumnMetadataRow } from "../../schema/metadata/foreign-key-constraint-column-metadata-row";
import { IndexColumnMetadataRow } from "../../schema/metadata/index-column-metadata-row";
import { PrimaryKeyConstraintColumnRow } from "../../schema/metadata/primary-key-constraint-column-row";
import { SchemaMetadataRow } from "../../schema/metadata/schema-metadata-row";
import { SequenceMetadataRow } from "../../schema/metadata/sequence-metadata-row";
import { TableColumnMetadataRow } from "../../schema/metadata/table-column-metadata-row";
import { TableMetadataRow } from "../../schema/metadata/table-metadata-row";
import { ViewMetadataRow } from "../../schema/metadata/view-metadata-row";
import { GenericName } from "../../schema/name/generic-name";
import { Identifier as SchemaNameIdentifier } from "../../schema/name/identifier";
import { OptionallyQualifiedName } from "../../schema/name/optionally-qualified-name";
import { GenericNameParser } from "../../schema/name/parser/generic-name-parser";
import { OptionallyQualifiedNameParser } from "../../schema/name/parser/optionally-qualified-name-parser";
import { UnqualifiedNameParser } from "../../schema/name/parser/unqualified-name-parser";
import { Parsers } from "../../schema/name/parsers";
import { UnqualifiedName } from "../../schema/name/unqualified-name";
import { UnquotedIdentifierFolding } from "../../schema/name/unquoted-identifier-folding";
import { TransactionIsolationLevel } from "../../transaction-isolation-level";
import { Types } from "../../types/types";

class TestPlatform extends AbstractPlatform {
  constructor(private readonly folding: UnquotedIdentifierFolding) {
    super();
  }

  public getUnquotedIdentifierFolding(): UnquotedIdentifierFolding {
    return this.folding;
  }

  public getLocateExpression(string: string, substring: string, start?: string | null): string {
    return `LOCATE(${substring}, ${string}${start ? `, ${start}` : ""})`;
  }

  public getDateDiffExpression(date1: string, date2: string): string {
    return `DATEDIFF(${date1}, ${date2})`;
  }

  public getSetTransactionIsolationSQL(level: TransactionIsolationLevel): string {
    return `SET TRANSACTION ISOLATION LEVEL ${level}`;
  }
}

describe("Schema name + introspection parity (best effort)", () => {
  it("ports IndexedColumn semantics from Doctrine", () => {
    const column = new IndexedColumn(UnqualifiedName.quoted("email"), 64);

    expect(column.getColumnName().toString()).toBe('"email"');
    expect(column.getLength()).toBe(64);

    expect(() => new IndexedColumn("email", 0)).toThrow(InvalidIndexDefinition);
  });

  it("ports name value objects and identifier folding semantics", () => {
    const lowerPlatform = new TestPlatform(UnquotedIdentifierFolding.LOWER);

    const unquoted = SchemaNameIdentifier.unquoted("Users");
    const quoted = SchemaNameIdentifier.quoted("Users");

    expect(unquoted.toNormalizedValue(UnquotedIdentifierFolding.LOWER)).toBe("users");
    expect(quoted.toNormalizedValue(UnquotedIdentifierFolding.LOWER)).toBe("Users");
    expect(unquoted.toSQL(lowerPlatform)).toBe('"users"');
    expect(quoted.toSQL(lowerPlatform)).toBe('"Users"');
    expect(SchemaNameIdentifier.quoted('a"b').toString()).toBe('"a""b"');
    expect(
      SchemaNameIdentifier.unquoted("Users").equals(
        SchemaNameIdentifier.unquoted("users"),
        UnquotedIdentifierFolding.LOWER,
      ),
    ).toBe(true);

    const generic = new GenericName(
      SchemaNameIdentifier.unquoted("public"),
      SchemaNameIdentifier.unquoted("users"),
    );
    expect(generic.toString()).toBe("public.users");
    expect(generic.toSQL(lowerPlatform)).toBe('"public"."users"');

    const unqualified = UnqualifiedName.unquoted("Users");
    expect(
      unqualified.equals(UnqualifiedName.unquoted("users"), UnquotedIdentifierFolding.LOWER),
    ).toBe(true);

    const name1 = OptionallyQualifiedName.unquoted("users", "public");
    const name2 = OptionallyQualifiedName.unquoted("USERS", "PUBLIC");
    expect(name1.equals(name2, UnquotedIdentifierFolding.LOWER)).toBe(true);
    expect(() =>
      OptionallyQualifiedName.unquoted("users").equals(
        OptionallyQualifiedName.unquoted("users", "public"),
        UnquotedIdentifierFolding.NONE,
      ),
    ).toThrow(IncomparableNames);
  });

  it("ports Doctrine-style name parser behavior", () => {
    const genericParser = new GenericNameParser();
    const parsed = genericParser.parse('[app].`Users`."Email"');

    expect(parsed.getIdentifiers().map((identifier) => identifier.toString())).toEqual([
      '"app"',
      '"Users"',
      '"Email"',
    ]);

    const optionallyQualified = new OptionallyQualifiedNameParser(genericParser).parse("app.users");
    expect(optionallyQualified.getQualifier()?.toString()).toBe("app");
    expect(optionallyQualified.getUnqualifiedName().toString()).toBe("users");

    const unqualified = new UnqualifiedNameParser(genericParser).parse("users");
    expect(unqualified.toString()).toBe("users");

    expect(Parsers.getGenericNameParser()).toBe(Parsers.getGenericNameParser());
    expect(Parsers.getUnqualifiedNameParser()).toBe(Parsers.getUnqualifiedNameParser());
    expect(Parsers.getOptionallyQualifiedNameParser()).toBe(
      Parsers.getOptionallyQualifiedNameParser(),
    );
  });

  it("ports metadata row DTO semantics", () => {
    const column = new Column("email", Types.STRING);

    expect(new DatabaseMetadataRow("appdb").getDatabaseName()).toBe("appdb");
    expect(new SchemaMetadataRow("public").getSchemaName()).toBe("public");

    const tableColumnRow = new TableColumnMetadataRow("public", "users", column);
    expect(tableColumnRow.getSchemaName()).toBe("public");
    expect(tableColumnRow.getTableName()).toBe("users");
    expect(tableColumnRow.getColumn()).toBe(column);

    const indexRow = new IndexColumnMetadataRow(
      "public",
      "users",
      "idx_users_email",
      IndexType.UNIQUE,
      true,
      "email IS NOT NULL",
      "email",
      32,
    );
    expect(indexRow.getIndexName()).toBe("idx_users_email");
    expect(indexRow.getType()).toBe(IndexType.UNIQUE);
    expect(indexRow.isClustered()).toBe(true);
    expect(indexRow.getPredicate()).toBe("email IS NOT NULL");
    expect(indexRow.getColumnLength()).toBe(32);

    const pkRow = new PrimaryKeyConstraintColumnRow("public", "users", "pk_users", true, "id");
    expect(pkRow.getConstraintName()).toBe("pk_users");
    expect(pkRow.isClustered()).toBe(true);

    const tableRow = new TableMetadataRow("public", "users", { engine: "InnoDB" });
    expect(tableRow.getOptions()).toEqual({ engine: "InnoDB" });
    expect(tableRow.getOptions()).not.toBe(tableRow.getOptions());

    const sequenceRow = new SequenceMetadataRow("public", "users_seq", 10, 1, 5);
    expect(sequenceRow.getSequenceName()).toBe("users_seq");
    expect(sequenceRow.getCacheSize()).toBe(5);

    const viewRow = new ViewMetadataRow("public", "v_users", "SELECT 1");
    expect(viewRow.getViewName()).toBe("v_users");
    expect(viewRow.getDefinition()).toBe("SELECT 1");

    const fkWithIdFallback = new ForeignKeyConstraintColumnMetadataRow(
      "public",
      "users",
      null,
      "fk_users_roles",
      "public",
      "roles",
      MatchType.SIMPLE,
      ReferentialAction.NO_ACTION,
      ReferentialAction.CASCADE,
      true,
      false,
      "role_id",
      "id",
    );
    expect(fkWithIdFallback.getId()).toBe("fk_users_roles");

    expect(
      () =>
        new ForeignKeyConstraintColumnMetadataRow(
          "public",
          "users",
          null,
          null,
          "public",
          "roles",
          MatchType.SIMPLE,
          ReferentialAction.NO_ACTION,
          ReferentialAction.CASCADE,
          false,
          false,
          "role_id",
          "id",
        ),
    ).toThrowError("Either the id or name must be set to a non-null value.");
  });

  it("ports metadata processors to build schema objects", () => {
    const indexProcessor = new IndexColumnMetadataProcessor();
    const indexEditor = indexProcessor.initializeEditor(
      new IndexColumnMetadataRow(
        null,
        "users",
        "idx_users_email",
        IndexType.UNIQUE,
        true,
        "email IS NOT NULL",
        "email",
        16,
      ),
    );
    indexProcessor.applyRow(
      indexEditor,
      new IndexColumnMetadataRow(
        null,
        "users",
        "idx_users_email",
        IndexType.UNIQUE,
        true,
        "email IS NOT NULL",
        "email",
        16,
      ),
    );
    const index = indexEditor.create();
    expect(index.isUnique()).toBe(true);
    expect(index.getOption("clustered")).toBe(true);
    expect(index.getOption("where")).toBe("email IS NOT NULL");

    const pkProcessor = new PrimaryKeyConstraintColumnMetadataProcessor();
    const pkEditor = pkProcessor.initializeEditor(
      new PrimaryKeyConstraintColumnRow(null, "users", null, true, "id"),
    );
    pkProcessor.applyRow(
      pkEditor,
      new PrimaryKeyConstraintColumnRow(null, "users", null, true, "id"),
    );
    const primaryKey = pkEditor.create();
    expect(primaryKey.isClustered()).toBe(true);
    expect(primaryKey.getColumnNames()).toEqual(['"id"']);

    const fkProcessor = new ForeignKeyConstraintColumnMetadataProcessor("public");
    const fkRow1 = new ForeignKeyConstraintColumnMetadataRow(
      "public",
      "users",
      1,
      "fk_users_roles",
      "public",
      "roles",
      MatchType.SIMPLE,
      ReferentialAction.CASCADE,
      ReferentialAction.RESTRICT,
      true,
      false,
      "role_id",
      "id",
    );
    const fkRow2 = new ForeignKeyConstraintColumnMetadataRow(
      "public",
      "users",
      1,
      "fk_users_roles",
      "public",
      "roles",
      MatchType.SIMPLE,
      ReferentialAction.CASCADE,
      ReferentialAction.RESTRICT,
      true,
      false,
      "tenant_id",
      "tenant_id",
    );
    const fkEditor = fkProcessor.initializeEditor(fkRow1);
    fkProcessor.applyRow(fkEditor, fkRow1);
    fkProcessor.applyRow(fkEditor, fkRow2);
    const fk = fkEditor.create();
    expect(fk.getForeignTableName()).toBe('"roles"');
    expect(fk.getReferencingColumnNames()).toEqual(["role_id", "tenant_id"]);
    expect(fk.getReferencedColumnNames()).toEqual(["id", "tenant_id"]);
    expect(fk.onUpdate()).toBe(ReferentialAction.CASCADE);
    expect(fk.onDelete()).toBeNull();
    expect(fk.getOption("match")).toBe(MatchType.SIMPLE);
    expect(fk.getOption("deferrability")).toBe(Deferrability.DEFERRABLE);

    const sequence = new SequenceMetadataProcessor().createObject(
      new SequenceMetadataRow("public", "users_seq", 10, 1, 7),
    );
    expect(sequence.getName()).toBe("public.users_seq");
    expect(sequence.getAllocationSize()).toBe(10);
    expect(sequence.getCacheSize()).toBe(7);

    const view = new ViewMetadataProcessor().createObject(
      new ViewMetadataRow("public", "v_users", "SELECT * FROM users"),
    );
    expect(view.getName()).toBe("public.v_users");
    expect(view.getSql()).toBe("SELECT * FROM users");
  });
});
