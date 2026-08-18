import { afterEach, beforeEach, expect } from "vitest";

import type { Connection } from "../../../connection";
import { NotSupported } from "../../../platforms/exception/not-supported";
import { ForeignKeyConstraint } from "../../../schema/foreign-key-constraint";
import { Index } from "../../../schema/index";
import { IndexedColumn } from "../../../schema/index/indexed-column";
import { Identifier } from "../../../schema/name/identifier";
import { OptionallyQualifiedName } from "../../../schema/name/optionally-qualified-name";
import { Parsers } from "../../../schema/name/parsers";
import { UnqualifiedName } from "../../../schema/name/unqualified-name";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Schema } from "../../../schema/schema";
import type { Table } from "../../../schema/table";
import {
  type FunctionalTarget,
  createFunctionalConnection,
  createFunctionalConnectionBundle,
  resolveFunctionalTarget,
} from "./functional-connection-factory";

export type FunctionalTestCase = {
  connection(): Connection;
  createConnection(): Promise<Connection>;
  dropAndCreateTable(table: Table): Promise<void>;
  dropTableIfExists(name: string): Promise<void>;
  dropSchemaIfExists(schemaName: UnqualifiedName): Promise<void>;
  getTarget(): FunctionalTarget;
  markConnectionNotReusable(): void;
  assertOptionallyQualifiedNameEquals(
    expected: OptionallyQualifiedName,
    actual: OptionallyQualifiedName,
  ): void;
  toQuotedOptionallyQualifiedName(name: OptionallyQualifiedName): OptionallyQualifiedName;
  assertUnqualifiedNameEquals(expected: UnqualifiedName, actual: UnqualifiedName): void;
  toQuotedUnqualifiedName(name: UnqualifiedName): UnqualifiedName;
  assertUnqualifiedNameListEquals(expected: UnqualifiedName[], actual: UnqualifiedName[]): void;
  assertUnqualifiedNameListContainsUnquotedName(
    needle: string,
    haystack: Iterable<UnqualifiedName>,
  ): void;
  assertUnqualifiedNameListContainsQuotedName(
    needle: string,
    haystack: Iterable<UnqualifiedName>,
  ): void;
  assertUnqualifiedNameListNotContainsUnquotedName(
    needle: string,
    haystack: Iterable<UnqualifiedName>,
  ): void;
  unqualifiedNameListContains(
    needle: UnqualifiedName,
    haystack: Iterable<UnqualifiedName>,
  ): boolean;
  assertOptionallyQualifiedNameListContainsUnquotedName(
    needleName: string,
    needleQualifier: string | null,
    haystack: Iterable<OptionallyQualifiedName>,
  ): void;
  optionallyQualifiedNameListContains(
    needle: OptionallyQualifiedName,
    haystack: Iterable<OptionallyQualifiedName>,
  ): boolean;
  toQuotedUnqualifiedNameList(names: UnqualifiedName[]): UnqualifiedName[];
  toQuotedIndexedColumn(column: IndexedColumn): IndexedColumn;
  assertIndexedColumnListEquals(expected: IndexedColumn[], actual: IndexedColumn[]): void;
  toQuotedIndexedColumnList(indexedColumns: IndexedColumn[]): IndexedColumn[];
  assertIndexEquals(expected: Index, actual: Index): void;
  toQuotedIndex(index: Index): Index;
  assertIndexListEquals(expected: Index[], actual: Index[]): void;
  toQuotedIndexList(indexes: Index[]): Index[];
  assertPrimaryKeyConstraintEquals(
    expected: PrimaryKeyConstraint,
    actual: PrimaryKeyConstraint | null,
  ): void;
  toQuotedPrimaryKeyConstraint(constraint: PrimaryKeyConstraint): PrimaryKeyConstraint;
  assertForeignKeyConstraintEquals(
    expected: ForeignKeyConstraint,
    actual: ForeignKeyConstraint,
  ): void;
  toQuotedForeignKeyConstraint(constraint: ForeignKeyConstraint): ForeignKeyConstraint;
  assertForeignKeyConstraintListEquals(
    expected: ForeignKeyConstraint[],
    actual: ForeignKeyConstraint[],
  ): void;
  toQuotedForeignKeyConstraintList(constraints: ForeignKeyConstraint[]): ForeignKeyConstraint[];
  toQuotedIdentifier(identifier: Identifier): Identifier;
};

export function useFunctionalTestCase(): FunctionalTestCase {
  let activeConnection: Connection | null = null;
  let activeTarget: FunctionalTarget | null = null;

  beforeEach(async () => {
    const bundle = await createFunctionalConnectionBundle();
    await bundle.connection.resolveDatabasePlatform();
    activeConnection = bundle.connection;
    activeTarget = bundle.target;
  });

  afterEach(async () => {
    if (activeConnection === null) {
      return;
    }

    try {
      while (activeConnection.isTransactionActive()) {
        await activeConnection.rollBack();
      }
    } finally {
      await activeConnection.close();
      activeConnection = null;
      activeTarget = null;
    }
  });

  const getActiveConnection = (): Connection => {
    if (activeConnection === null) {
      throw new Error("Functional test connection is not initialized yet.");
    }

    return activeConnection;
  };
  const getFolding = () =>
    getActiveConnection().getDatabasePlatform().getUnquotedIdentifierFolding();
  const toQuotedIdentifier = (identifier: Identifier): Identifier => {
    if (identifier.isQuoted()) {
      return identifier;
    }

    return Identifier.quoted(identifier.toNormalizedValue(getFolding()));
  };
  const toQuotedUnqualifiedName = (name: UnqualifiedName): UnqualifiedName =>
    new UnqualifiedName(toQuotedIdentifier(name.getIdentifier()));
  const toQuotedOptionallyQualifiedName = (
    name: OptionallyQualifiedName,
  ): OptionallyQualifiedName =>
    new OptionallyQualifiedName(
      toQuotedIdentifier(name.getUnqualifiedName()),
      name.getQualifier() === null ? null : toQuotedIdentifier(name.getQualifier()),
    );
  const unqualifiedParser = () => Parsers.getUnqualifiedNameParser();
  const toQuotedUnqualifiedNameString = (name: string): string =>
    toQuotedUnqualifiedName(unqualifiedParser().parse(name)).toString();
  const toQuotedUnqualifiedNameList = (names: UnqualifiedName[]): UnqualifiedName[] =>
    names.map((name) => toQuotedUnqualifiedName(name));
  const toQuotedIndexedColumn = (column: IndexedColumn): IndexedColumn =>
    new IndexedColumn(toQuotedUnqualifiedName(column.getColumnName()), column.getLength());
  const toQuotedIndexedColumnList = (indexedColumns: IndexedColumn[]): IndexedColumn[] =>
    indexedColumns.map((indexedColumn) => toQuotedIndexedColumn(indexedColumn));
  const toQuotedIndex = (index: Index): Index => {
    const options = { ...index.getOptions() };
    delete options.lengths;

    const editor = index
      .edit()
      .setName(toQuotedUnqualifiedName(index.getObjectName()).toString())
      .setOptions(options)
      .setColumns();

    for (const indexedColumn of toQuotedIndexedColumnList(index.getIndexedColumns())) {
      editor.addColumn(indexedColumn);
    }

    return editor.create();
  };
  const toQuotedIndexList = (indexes: Index[]): Index[] =>
    indexes.map((index) => toQuotedIndex(index));
  const toQuotedPrimaryKeyConstraint = (constraint: PrimaryKeyConstraint): PrimaryKeyConstraint => {
    const name = constraint.getObjectName();

    return constraint
      .edit()
      .setName(name === null ? null : toQuotedUnqualifiedNameString(name))
      .setColumnNames(
        ...constraint
          .getColumnNames()
          .map((columnName) => toQuotedUnqualifiedNameString(columnName)),
      )
      .create();
  };
  const toQuotedForeignKeyConstraint = (constraint: ForeignKeyConstraint): ForeignKeyConstraint => {
    const name = constraint.getObjectName();

    return constraint
      .edit()
      .setName(name === null ? null : toQuotedUnqualifiedName(name).toString())
      .setReferencingColumnNames(
        ...constraint
          .getReferencingColumnNames()
          .map((columnName) => toQuotedUnqualifiedNameString(columnName)),
      )
      .setReferencedTableName(toQuotedOptionallyQualifiedName(constraint.getReferencedTableName()))
      .setReferencedColumnNames(
        ...constraint
          .getReferencedColumnNames()
          .map((columnName) => toQuotedUnqualifiedNameString(columnName)),
      )
      .create();
  };
  const toQuotedForeignKeyConstraintList = (
    constraints: ForeignKeyConstraint[],
  ): ForeignKeyConstraint[] =>
    constraints.map((constraint) => toQuotedForeignKeyConstraint(constraint));
  const unqualifiedNameListContains = (
    needle: UnqualifiedName,
    haystack: Iterable<UnqualifiedName>,
  ): boolean => {
    const folding = getFolding();

    for (const name of haystack) {
      if (name.equals(needle, folding)) {
        return true;
      }
    }

    return false;
  };
  const optionallyQualifiedNameListContains = (
    needle: OptionallyQualifiedName,
    haystack: Iterable<OptionallyQualifiedName>,
  ): boolean => {
    const folding = getFolding();
    const isNeedleQualified = needle.getQualifier() !== null;

    for (const name of haystack) {
      if ((name.getQualifier() !== null) !== isNeedleQualified) {
        continue;
      }

      try {
        if (name.equals(needle, folding)) {
          return true;
        }
      } catch {
        // Incomparable names are treated as "not contained" in the functional helper context.
      }
    }

    return false;
  };

  return {
    connection(): Connection {
      return getActiveConnection();
    },
    async createConnection(): Promise<Connection> {
      const connection = await createFunctionalConnection();
      await connection.resolveDatabasePlatform();
      return connection;
    },
    async dropAndCreateTable(table: Table): Promise<void> {
      const connection = getActiveConnection();
      const schemaManager = await connection.createSchemaManager();

      try {
        await schemaManager.dropTable(table.getQuotedName(connection.getDatabasePlatform()));
      } catch {
        // Ignore missing-table errors during functional test setup.
      }

      await schemaManager.createTable(table);
    },
    async dropTableIfExists(name: string): Promise<void> {
      try {
        await (await getActiveConnection().createSchemaManager()).dropTable(name);
      } catch {
        // best effort setup helper
      }
    },
    async dropSchemaIfExists(schemaName: UnqualifiedName): Promise<void> {
      const connection = getActiveConnection();
      const platform = connection.getDatabasePlatform();

      if (!platform.supportsSchemas()) {
        throw NotSupported.new("dropSchemaIfExists");
      }

      const folding = platform.getUnquotedIdentifierFolding();
      const normalizedSchemaName = schemaName.getIdentifier().toNormalizedValue(folding);
      const schemaManager = await connection.createSchemaManager();
      const databaseSchema = await schemaManager.introspectSchema();

      const sequencesToDrop = databaseSchema.getSequences().filter((sequence) => {
        const qualifier = sequence.getObjectName().getQualifier();
        return qualifier !== null && qualifier.toNormalizedValue(folding) === normalizedSchemaName;
      });
      const tablesToDrop = databaseSchema.getTables().filter((table) => {
        const qualifier = table.getObjectName().getQualifier();
        return qualifier !== null && qualifier.toNormalizedValue(folding) === normalizedSchemaName;
      });

      if (sequencesToDrop.length > 0 || tablesToDrop.length > 0) {
        await schemaManager.dropSchemaObjects(new Schema(tablesToDrop, sequencesToDrop));
      }

      try {
        await schemaManager.dropSchema(schemaName.toSQL(platform));
      } catch {
        // best effort cleanup when schema doesn't exist
      }
    },
    getTarget(): FunctionalTarget {
      return activeTarget ?? resolveFunctionalTarget();
    },
    markConnectionNotReusable(): void {
      // Vitest functional tests currently use a fresh connection per test, so this is a no-op
      // kept for Doctrine FunctionalTestCase API-shape parity.
    },
    assertOptionallyQualifiedNameEquals(expected, actual): void {
      expect(toQuotedOptionallyQualifiedName(actual)).toEqual(
        toQuotedOptionallyQualifiedName(expected),
      );
    },
    toQuotedOptionallyQualifiedName,
    assertUnqualifiedNameEquals(expected, actual): void {
      expect(toQuotedUnqualifiedName(actual)).toEqual(toQuotedUnqualifiedName(expected));
    },
    toQuotedUnqualifiedName,
    assertUnqualifiedNameListEquals(expected, actual): void {
      expect(toQuotedUnqualifiedNameList(actual)).toEqual(toQuotedUnqualifiedNameList(expected));
    },
    assertUnqualifiedNameListContainsUnquotedName(needle, haystack): void {
      expect(unqualifiedNameListContains(UnqualifiedName.unquoted(needle), haystack)).toBe(true);
    },
    assertUnqualifiedNameListContainsQuotedName(needle, haystack): void {
      expect(unqualifiedNameListContains(UnqualifiedName.quoted(needle), haystack)).toBe(true);
    },
    assertUnqualifiedNameListNotContainsUnquotedName(needle, haystack): void {
      expect(unqualifiedNameListContains(UnqualifiedName.unquoted(needle), haystack)).toBe(false);
    },
    unqualifiedNameListContains,
    assertOptionallyQualifiedNameListContainsUnquotedName(
      needleName,
      needleQualifier,
      haystack,
    ): void {
      expect(
        optionallyQualifiedNameListContains(
          OptionallyQualifiedName.unquoted(needleName, needleQualifier),
          haystack,
        ),
      ).toBe(true);
    },
    optionallyQualifiedNameListContains,
    toQuotedUnqualifiedNameList,
    toQuotedIndexedColumn,
    assertIndexedColumnListEquals(expected, actual): void {
      expect(toQuotedIndexedColumnList(actual)).toEqual(toQuotedIndexedColumnList(expected));
    },
    toQuotedIndexedColumnList,
    assertIndexEquals(expected, actual): void {
      expect(toQuotedIndex(actual)).toEqual(toQuotedIndex(expected));
    },
    toQuotedIndex,
    assertIndexListEquals(expected, actual): void {
      const folding = getFolding();
      const comparator = (left: Index, right: Index): number =>
        left.getObjectName().getIdentifier().toNormalizedValue(folding) <
        right.getObjectName().getIdentifier().toNormalizedValue(folding)
          ? -1
          : left.getObjectName().getIdentifier().toNormalizedValue(folding) >
              right.getObjectName().getIdentifier().toNormalizedValue(folding)
            ? 1
            : 0;

      const quotedExpected = toQuotedIndexList([...expected]).sort(comparator);
      const quotedActual = toQuotedIndexList([...actual]).sort(comparator);
      expect(quotedActual).toEqual(quotedExpected);
    },
    toQuotedIndexList,
    assertPrimaryKeyConstraintEquals(expected, actual): void {
      expect(actual).not.toBeNull();
      if (actual === null) {
        return;
      }

      let normalizedActual = actual;
      if (expected.getObjectName() === null && actual.getObjectName() !== null) {
        normalizedActual = actual.edit().setName(null).create();
      }

      expect(toQuotedPrimaryKeyConstraint(normalizedActual)).toEqual(
        toQuotedPrimaryKeyConstraint(expected),
      );
    },
    toQuotedPrimaryKeyConstraint,
    assertForeignKeyConstraintEquals(expected, actual): void {
      expect(toQuotedForeignKeyConstraint(actual)).toEqual(toQuotedForeignKeyConstraint(expected));
    },
    toQuotedForeignKeyConstraint,
    assertForeignKeyConstraintListEquals(expected, actual): void {
      expect(toQuotedForeignKeyConstraintList(actual)).toEqual(
        toQuotedForeignKeyConstraintList(expected),
      );
    },
    toQuotedForeignKeyConstraintList,
    toQuotedIdentifier,
  };
}
