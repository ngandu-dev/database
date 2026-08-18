import type { AbstractPlatform } from "../platforms/abstract-platform";

export interface Name {
  toSQL(platform: AbstractPlatform): string;
  toString(): string;
}
