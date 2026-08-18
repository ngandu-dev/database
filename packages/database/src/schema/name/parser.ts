import type { Name } from "../name";

export interface Parser<TName extends Name = Name> {
  parse(input: string): TName;
}
