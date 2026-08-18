import { describe, expect, it } from "vitest";

import type { Result as DriverResult } from "../../driver/result";
import type { Statement as DriverStatement } from "../../driver/statement";
import { ParameterType } from "../../parameter-type";
import { Converter } from "../../portability/converter";
import { Result as PortabilityResult } from "../../portability/result";
import { DriverStatementWrapper } from "../../portability/statement";

class DummyDriverResult implements DriverResult {
  public fetchNumeric<T = unknown>(): T[] | undefined {
    return undefined;
  }

  public fetchAssociative<T extends Record<string, unknown> = Record<string, unknown>>():
    | T
    | undefined {
    return undefined;
  }

  public fetchOne<T = unknown>(): T | undefined {
    return undefined;
  }

  public fetchAllNumeric<T = unknown>(): T[][] {
    return [];
  }

  public fetchAllAssociative<T extends Record<string, unknown> = Record<string, unknown>>(): T[] {
    return [];
  }

  public fetchFirstColumn<T = unknown>(): T[] {
    return [];
  }

  public rowCount(): number | string {
    return 0;
  }

  public columnCount(): number {
    return 0;
  }

  public free(): void {}
}

class SpyDriverStatement implements DriverStatement {
  public bindCalls: Array<{ param: string | number; type?: ParameterType; value: unknown }> = [];
  public executeCalls = 0;

  public bindValue(param: string | number, value: unknown, type?: ParameterType): void {
    this.bindCalls.push({ param, type, value });
  }

  public async execute(): Promise<DriverResult> {
    this.executeCalls += 1;
    return new DummyDriverResult();
  }
}

describe("Portability/Statement (Doctrine parity)", () => {
  it("delegates bindValue()", () => {
    const wrapped = new SpyDriverStatement();
    const statement = new DriverStatementWrapper(wrapped, new Converter(false, false, null));

    statement.bindValue("myparam", "myvalue", ParameterType.STRING);

    expect(wrapped.bindCalls).toEqual([
      { param: "myparam", type: ParameterType.STRING, value: "myvalue" },
    ]);
  });

  it("delegates execute() and wraps the result", async () => {
    const wrapped = new SpyDriverStatement();
    const statement = new DriverStatementWrapper(wrapped, new Converter(false, false, null));

    const result = await statement.execute();

    expect(wrapped.executeCalls).toBe(1);
    expect(result).toBeInstanceOf(PortabilityResult);
  });
});
