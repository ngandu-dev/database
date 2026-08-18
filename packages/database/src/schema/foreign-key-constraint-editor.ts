import { InvalidForeignKeyConstraintDefinition } from "./exception/invalid-foreign-key-constraint-definition";
import { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Deferrability } from "./foreign-key-constraint/deferrability";
import { MatchType } from "./foreign-key-constraint/match-type";
import { ReferentialAction } from "./foreign-key-constraint/referential-action";
import { OptionallyQualifiedName } from "./name/optionally-qualified-name";
import { UnqualifiedName } from "./name/unqualified-name";

export class ForeignKeyConstraintEditor {
  private name: string | null = null;
  private referencingColumnNames: string[] = [];
  private referencedTableName: string | null = null;
  private referencedColumnNames: string[] = [];
  private options: Record<string, unknown> = {};
  private localTableName: string | null = null;

  public setName(name: string | null): this {
    this.name = name;
    return this;
  }

  public setUnquotedName(name: string): this {
    return this.setName(UnqualifiedName.unquoted(name).toString());
  }

  public setQuotedName(name: string): this {
    return this.setName(UnqualifiedName.quoted(name).toString());
  }

  public setReferencingColumnNames(...referencingColumnNames: string[]): this {
    this.referencingColumnNames = [...referencingColumnNames];
    return this;
  }

  public setUnquotedReferencingColumnNames(...referencingColumnNames: string[]): this {
    return this.setReferencingColumnNames(
      ...referencingColumnNames.map((name) => UnqualifiedName.unquoted(name).toString()),
    );
  }

  public setQuotedReferencingColumnNames(...referencingColumnNames: string[]): this {
    return this.setReferencingColumnNames(
      ...referencingColumnNames.map((name) => UnqualifiedName.quoted(name).toString()),
    );
  }

  public setReferencedTableName(referencedTableName: string | OptionallyQualifiedName): this {
    this.referencedTableName =
      typeof referencedTableName === "string"
        ? referencedTableName
        : referencedTableName.toString();
    return this;
  }

  public setUnquotedReferencedTableName(
    unqualifiedReferencedTableName: string,
    referencedTableNameQualifier: string | null = null,
  ): this {
    return this.setReferencedTableName(
      OptionallyQualifiedName.unquoted(
        unqualifiedReferencedTableName,
        referencedTableNameQualifier,
      ),
    );
  }

  public setQuotedReferencedTableName(
    unqualifiedReferencedTableName: string,
    referencedTableNameQualifier: string | null = null,
  ): this {
    return this.setReferencedTableName(
      OptionallyQualifiedName.quoted(unqualifiedReferencedTableName, referencedTableNameQualifier),
    );
  }

  public setReferencedColumnNames(...referencedColumnNames: string[]): this {
    this.referencedColumnNames = [...referencedColumnNames];
    return this;
  }

  public setUnquotedReferencedColumnNames(...referencedColumnNames: string[]): this {
    return this.setReferencedColumnNames(
      ...referencedColumnNames.map((name) => UnqualifiedName.unquoted(name).toString()),
    );
  }

  public setQuotedReferencedColumnNames(...referencedColumnNames: string[]): this {
    return this.setReferencedColumnNames(
      ...referencedColumnNames.map((name) => UnqualifiedName.quoted(name).toString()),
    );
  }

  public setOnUpdate(onUpdate: string | null): this {
    if (onUpdate === null) {
      delete this.options.onUpdate;
    } else {
      this.options.onUpdate = onUpdate;
    }

    return this;
  }

  public setOnDelete(onDelete: string | null): this {
    if (onDelete === null) {
      delete this.options.onDelete;
    } else {
      this.options.onDelete = onDelete;
    }

    return this;
  }

  public setOptions(options: Record<string, unknown>): this {
    this.options = { ...options };
    return this;
  }

  public setLocalTableName(localTableName: string | null): this {
    this.localTableName = localTableName;
    return this;
  }

  public addReferencingColumnName(columnName: string | UnqualifiedName): this {
    this.referencingColumnNames.push(
      typeof columnName === "string" ? columnName : columnName.toString(),
    );
    return this;
  }

  public addReferencedColumnName(columnName: string | UnqualifiedName): this {
    this.referencedColumnNames.push(
      typeof columnName === "string" ? columnName : columnName.toString(),
    );
    return this;
  }

  public setMatchType(matchType: MatchType): this {
    this.options.match = matchType;
    return this;
  }

  public setOnUpdateAction(onUpdate: ReferentialAction): this {
    return this.setOnUpdate(onUpdate);
  }

  public setOnDeleteAction(onDelete: ReferentialAction): this {
    return this.setOnDelete(onDelete);
  }

  public setDeferrability(deferrability: Deferrability): this {
    this.options.deferrability = deferrability;
    delete this.options.deferrable;
    delete this.options.deferred;

    if (deferrability === Deferrability.DEFERRABLE) {
      this.options.deferrable = true;
    } else if (deferrability === Deferrability.DEFERRED) {
      this.options.deferrable = true;
      this.options.deferred = true;
    } else if (deferrability === Deferrability.NOT_DEFERRABLE) {
      this.options.deferrable = false;
      this.options.deferred = false;
    }

    return this;
  }

  public create(): ForeignKeyConstraint {
    if (this.referencingColumnNames.length === 0) {
      throw InvalidForeignKeyConstraintDefinition.referencingColumnNamesNotSet(this.name);
    }

    if (this.referencedTableName === null) {
      throw InvalidForeignKeyConstraintDefinition.referencedTableNameNotSet(this.name);
    }

    if (this.referencedColumnNames.length === 0) {
      throw InvalidForeignKeyConstraintDefinition.referencedColumnNamesNotSet(this.name);
    }

    return new ForeignKeyConstraint(
      this.referencingColumnNames,
      this.referencedTableName,
      this.referencedColumnNames,
      this.name,
      this.options,
      this.localTableName,
    );
  }
}
