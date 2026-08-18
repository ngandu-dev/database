import { Sequence } from "./sequence";
import { Table } from "./table";
import { TableDiff } from "./table-diff";

export interface SchemaDiffOptions {
  createdSchemas?: string[];
  droppedSchemas?: string[];
  createdTables?: Table[];
  alteredTables?: TableDiff[];
  droppedTables?: Table[];
  createdSequences?: Sequence[];
  alteredSequences?: Sequence[];
  droppedSequences?: Sequence[];
}

export class SchemaDiff {
  public readonly createdSchemas: readonly string[];
  public readonly droppedSchemas: readonly string[];
  public readonly createdTables: readonly Table[];
  public readonly alteredTables: readonly TableDiff[];
  public readonly droppedTables: readonly Table[];
  public readonly createdSequences: readonly Sequence[];
  public readonly alteredSequences: readonly Sequence[];
  public readonly droppedSequences: readonly Sequence[];

  constructor(options: SchemaDiffOptions = {}) {
    this.createdSchemas = options.createdSchemas ?? [];
    this.droppedSchemas = options.droppedSchemas ?? [];
    this.createdTables = options.createdTables ?? [];
    this.alteredTables = options.alteredTables ?? [];
    this.droppedTables = options.droppedTables ?? [];
    this.createdSequences = options.createdSequences ?? [];
    this.alteredSequences = options.alteredSequences ?? [];
    this.droppedSequences = options.droppedSequences ?? [];
  }

  public getCreatedSchemas(): readonly string[] {
    return this.createdSchemas;
  }

  public getDroppedSchemas(): readonly string[] {
    return this.droppedSchemas;
  }

  public getCreatedTables(): readonly Table[] {
    return this.createdTables;
  }

  public getAlteredTables(): readonly TableDiff[] {
    return this.alteredTables.filter((diff) => !diff.isEmpty());
  }

  public getDroppedTables(): readonly Table[] {
    return this.droppedTables;
  }

  public getCreatedSequences(): readonly Sequence[] {
    return this.createdSequences;
  }

  public getAlteredSequences(): readonly Sequence[] {
    return this.alteredSequences;
  }

  public getDroppedSequences(): readonly Sequence[] {
    return this.droppedSequences;
  }

  public hasChanges(): boolean {
    return !this.isEmpty();
  }

  public isEmpty(): boolean {
    return (
      this.createdSchemas.length === 0 &&
      this.droppedSchemas.length === 0 &&
      this.createdTables.length === 0 &&
      this.getAlteredTables().length === 0 &&
      this.droppedTables.length === 0 &&
      this.createdSequences.length === 0 &&
      this.alteredSequences.length === 0 &&
      this.droppedSequences.length === 0
    );
  }
}
