import type { QueryBuilderPlatform } from "@ngandu-dev/query-builder";
import { QueryBuilder } from "@ngandu-dev/query-builder";

import type { Connection } from "../connection";
import type { Result } from "../result";
import { ExpressionBuilder } from "./expression/expression-builder";

type AssociativeRow = Record<string, unknown>;

export class ConnectedQueryBuilder extends QueryBuilder {
  public constructor(private readonly connection: Connection) {
    super();
  }

  public override expr(): ExpressionBuilder {
    return this.connection.createExpressionBuilder();
  }

  public override sub(): ConnectedQueryBuilder {
    return new ConnectedQueryBuilder(this.connection);
  }

  public override getSQL(platform?: QueryBuilderPlatform): string {
    return super.getSQL(platform ?? this.connection.getDatabasePlatform());
  }

  public executeQuery<T extends AssociativeRow = AssociativeRow>(): Promise<Result<T>> {
    return this.connection.executeQuery<T>(this);
  }

  public executeStatement(): Promise<number> {
    return this.connection.executeStatement(this);
  }

  public async fetchAssociative<T extends AssociativeRow = AssociativeRow>(): Promise<
    T | undefined
  > {
    return (await this.executeQuery()).fetchAssociative<T>();
  }

  public async fetchNumeric<T extends unknown[] = unknown[]>(): Promise<T | undefined> {
    return (await this.executeQuery()).fetchNumeric<T>();
  }

  public async fetchOne<T = unknown>(): Promise<T | undefined> {
    return (await this.executeQuery()).fetchOne<T>();
  }

  public async fetchAllNumeric<T extends unknown[] = unknown[]>(): Promise<T[]> {
    return (await this.executeQuery()).fetchAllNumeric<T>();
  }

  public async fetchAllAssociative<T extends AssociativeRow = AssociativeRow>(): Promise<T[]> {
    return (await this.executeQuery()).fetchAllAssociative<T>();
  }

  public async fetchAllKeyValue<T = unknown>(): Promise<Record<string, T>> {
    return (await this.executeQuery()).fetchAllKeyValue<T>();
  }

  public async fetchAllAssociativeIndexed<T extends AssociativeRow = AssociativeRow>(): Promise<
    Record<string, T>
  > {
    return (await this.executeQuery()).fetchAllAssociativeIndexed<T>();
  }

  public async fetchFirstColumn<T = unknown>(): Promise<T[]> {
    return (await this.executeQuery()).fetchFirstColumn<T>();
  }
}
