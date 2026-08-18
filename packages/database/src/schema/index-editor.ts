import { InvalidIndexDefinition } from "./exception/invalid-index-definition";
import { Index } from "./index";
import { IndexType } from "./index/index-type";
import { IndexedColumn } from "./index/indexed-column";

export class IndexEditor {
  private name: string | null = null;
  private columns: string[] = [];
  private unique = false;
  private primary = false;
  private flags: string[] = [];
  private options: Record<string, unknown> = {};
  private type: IndexType | null = null;

  public setName(name: string | null): this {
    this.name = name;
    return this;
  }

  public setUnquotedName(name: string): this {
    return this.setName(name);
  }

  public setQuotedName(name: string): this {
    return this.setName(`"${name}"`);
  }

  public setColumns(...columns: Array<IndexedColumn | string>): this {
    this.columns = [];
    const options = { ...this.options };
    delete options.lengths;
    this.options = options;

    for (const column of columns) {
      this.addColumn(column);
    }

    return this;
  }

  public setColumnNames(...columnNames: string[]): this {
    return this.setColumns(...columnNames);
  }

  public setUnquotedColumnNames(...columnNames: string[]): this {
    return this.setColumns(...columnNames);
  }

  public setQuotedColumnNames(...columnNames: string[]): this {
    return this.setColumns(...columnNames.map((columnName) => `"${columnName}"`));
  }

  public setIsUnique(unique: boolean): this {
    this.unique = unique;
    return this;
  }

  public setIsPrimary(primary: boolean): this {
    this.primary = primary;
    return this;
  }

  public setType(type: IndexType): this {
    this.type = type;
    return this;
  }

  public setIsClustered(clustered: boolean): this {
    return this.setOptions({ ...this.options, clustered });
  }

  public setPredicate(predicate: string | null): this {
    const options = { ...this.options };
    if (predicate === null) {
      delete options.where;
    } else {
      options.where = predicate;
    }

    return this.setOptions(options);
  }

  public setFlags(...flags: string[]): this {
    this.flags = [...flags];
    return this;
  }

  public setOptions(options: Record<string, unknown>): this {
    this.options = { ...options };
    return this;
  }

  public addColumn(column: IndexedColumn | string): this {
    const indexed = typeof column === "string" ? new IndexedColumn(column) : column;

    this.columns.push(indexed.getColumnName().toString());

    const length = indexed.getLength();
    if (length !== null) {
      const lengths = Array.isArray(this.options.lengths) ? [...this.options.lengths] : [];
      lengths.push(length);
      this.options = { ...this.options, lengths };
    }

    return this;
  }

  public create(): Index {
    if (this.name === null || this.name.length === 0) {
      throw InvalidIndexDefinition.nameNotSet();
    }

    if (this.columns.length === 0) {
      throw InvalidIndexDefinition.columnsNotSet(this.name);
    }

    const lengths = this.options.lengths;
    if (Array.isArray(lengths)) {
      for (let index = 0; index < lengths.length; index += 1) {
        const length = lengths[index];
        if (typeof length === "number" && length <= 0) {
          throw InvalidIndexDefinition.fromNonPositiveColumnLength(
            this.columns[index] ?? "<unknown>",
            length,
          );
        }
      }
    }

    const flags = [...this.flags];
    let unique = this.unique;

    switch (this.type) {
      case IndexType.UNIQUE:
        unique = true;
        break;
      case IndexType.FULLTEXT:
        if (!flags.some((flag) => flag.toLowerCase() === "fulltext")) {
          flags.push("fulltext");
        }
        break;
      case IndexType.SPATIAL:
        if (!flags.some((flag) => flag.toLowerCase() === "spatial")) {
          flags.push("spatial");
        }
        break;
      case IndexType.REGULAR:
      case null:
        break;
    }

    return new Index(this.name, this.columns, unique, this.primary, flags, this.options);
  }
}
