import type { AbstractPlatform } from "../platforms/abstract-platform";
import { AbstractAsset } from "./abstract-asset";
import { NamespaceAlreadyExists } from "./exception/namespace-already-exists";
import { SequenceAlreadyExists } from "./exception/sequence-already-exists";
import { SequenceDoesNotExist } from "./exception/sequence-does-not-exist";
import { TableAlreadyExists } from "./exception/table-already-exists";
import { TableDoesNotExist } from "./exception/table-does-not-exist";
import type { UnqualifiedNameParser } from "./name/parser/unqualified-name-parser";
import { Parsers } from "./name/parsers";
import { SchemaConfig } from "./schema-config";
import { Sequence } from "./sequence";
import { Table } from "./table";

export class Schema extends AbstractAsset {
  private readonly namespaces: Record<string, string> = {};
  private readonly tables: Record<string, Table> = {};
  private readonly sequences: Record<string, Sequence> = {};

  constructor(
    tables: Table[] = [],
    sequences: Sequence[] = [],
    private readonly schemaConfig: SchemaConfig = new SchemaConfig(),
    namespaces: string[] = [],
  ) {
    super(schemaConfig.getName() ?? "");

    for (const namespace of namespaces) {
      this.createNamespace(namespace);
    }

    for (const table of tables) {
      this.addTable(table);
    }

    for (const sequence of sequences) {
      this.addSequence(sequence);
    }
  }

  public getSchemaConfig(): SchemaConfig {
    return this.schemaConfig;
  }

  public getName(): string {
    return super.getName();
  }

  public createNamespace(namespace: string): void {
    if (this.hasNamespace(namespace)) {
      throw NamespaceAlreadyExists.new(namespace);
    }

    this.namespaces[namespace.toLowerCase()] = namespace;
  }

  public hasNamespace(namespace: string): boolean {
    return Object.hasOwn(this.namespaces, namespace.toLowerCase());
  }

  public getNamespaces(): string[] {
    return Object.values(this.namespaces);
  }

  public createTable(name: string): Table {
    const table = new Table(name, [], [], [], this.schemaConfig.getDefaultTableOptions());
    this.addTable(table);
    return table;
  }

  public addTable(table: Table): void {
    const namespaceName = table.getNamespaceName();
    if (namespaceName !== null && !this.hasNamespace(namespaceName)) {
      this.createNamespace(namespaceName);
    }

    const key = getSchemaAssetKey(table.getName());
    if (Object.hasOwn(this.tables, key)) {
      throw TableAlreadyExists.new(table.getName());
    }

    table.setSchemaConfig(this.schemaConfig);
    this.tables[key] = table;
  }

  public hasTable(name: string): boolean {
    return Object.hasOwn(this.tables, getSchemaAssetKey(name));
  }

  public getTable(name: string): Table {
    const key = getSchemaAssetKey(name);
    const table = this.tables[key];

    if (table === undefined) {
      throw TableDoesNotExist.new(name);
    }

    return table;
  }

  public getTables(): Table[] {
    return Object.values(this.tables);
  }

  public dropTable(name: string): void {
    delete this.tables[getSchemaAssetKey(name)];
  }

  public createSequence(name: string, allocationSize = 1, initialValue = 1): Sequence {
    const sequence = new Sequence(name, allocationSize, initialValue);
    this.addSequence(sequence);
    return sequence;
  }

  public addSequence(sequence: Sequence): void {
    const namespaceName = sequence.getNamespaceName();
    if (namespaceName !== null && !this.hasNamespace(namespaceName)) {
      this.createNamespace(namespaceName);
    }

    const key = getSchemaAssetKey(sequence.getName());
    if (Object.hasOwn(this.sequences, key)) {
      throw SequenceAlreadyExists.new(sequence.getName());
    }

    this.sequences[key] = sequence;
  }

  public hasSequence(name: string): boolean {
    return Object.hasOwn(this.sequences, getSchemaAssetKey(name));
  }

  public getSequence(name: string): Sequence {
    const key = getSchemaAssetKey(name);
    const sequence = this.sequences[key];

    if (sequence === undefined) {
      throw SequenceDoesNotExist.new(name);
    }

    return sequence;
  }

  public getSequences(): Sequence[] {
    return Object.values(this.sequences);
  }

  public dropSequence(name: string): void {
    delete this.sequences[getSchemaAssetKey(name)];
  }

  public renameTable(oldName: string, newName: string): this {
    const table = this.getTable(oldName);
    const oldKey = getSchemaAssetKey(oldName);
    const newKey = getSchemaAssetKey(newName);

    if (oldKey === newKey) {
      (table as unknown as { _setName(name: string): void })._setName(newName);
      return this;
    }

    if (Object.hasOwn(this.tables, newKey)) {
      throw TableAlreadyExists.new(newName);
    }

    delete this.tables[oldKey];

    try {
      (table as unknown as { _setName(name: string): void })._setName(newName);
      table.setSchemaConfig(this.schemaConfig);
      this.tables[newKey] = table;
    } catch (error) {
      (table as unknown as { _setName(name: string): void })._setName(oldName);
      this.tables[oldKey] = table;
      throw error;
    }

    return this;
  }

  public toSql(platform: AbstractPlatform): string[] {
    const sql: string[] = [];

    if (platform.supportsSchemas()) {
      for (const namespace of this.getNamespaces()) {
        sql.push(platform.getCreateSchemaSQL(namespace));
      }
    }

    for (const sequence of this.getSequences()) {
      sql.push(platform.getCreateSequenceSQL(sequence));
    }

    sql.push(...platform.getCreateTablesSQL(this.getTables()));

    return sql;
  }

  public toDropSql(platform: AbstractPlatform): string[] {
    const sql: string[] = [];

    for (const sequence of this.getSequences()) {
      sql.push(platform.getDropSequenceSQL(sequence.getQuotedName(platform)));
    }

    sql.push(...platform.getDropTablesSQL(this.getTables()));

    return sql;
  }

  protected getNameParser(): UnqualifiedNameParser {
    return Parsers.getUnqualifiedNameParser();
  }

  protected setName(_name: unknown): void {}

  protected _addTable(table: Table): void {
    this.addTable(table);
  }

  protected _addSequence(sequence: Sequence): void {
    this.addSequence(sequence);
  }
}

function getSchemaAssetKey(name: string): string {
  return normalizeAssetName(name).toLowerCase();
}

function normalizeAssetName(name: string): string {
  return name
    .split(".")
    .map((part) => part.replaceAll(/[`"[\]]/g, ""))
    .join(".");
}
