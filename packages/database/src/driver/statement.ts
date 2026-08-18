import { ParameterType } from "../parameter-type";
import type { Result } from "./result";

export interface Statement {
  bindValue(param: string | number, value: unknown, type?: ParameterType): void;
  execute(): Promise<Result>;
}
