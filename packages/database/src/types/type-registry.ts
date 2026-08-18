import { TypeAlreadyRegistered } from "./exception/type-already-registered";
import { TypeNotFound } from "./exception/type-not-found";
import { TypeNotRegistered } from "./exception/type-not-registered";
import { TypesAlreadyExists } from "./exception/types-already-exists";
import { UnknownColumnType } from "./exception/unknown-column-type";
import { Type } from "./type";

export class TypeRegistry {
  private readonly instances: Record<string, Type> = {};
  private readonly reverseIndex = new WeakMap<Type, string>();

  constructor(instances: Record<string, Type> = {}) {
    for (const [name, type] of Object.entries(instances)) {
      this.register(name, type);
    }
  }

  public get(name: string): Type {
    const type = this.instances[name];
    if (type === undefined) {
      throw UnknownColumnType.new(name);
    }

    return type;
  }

  public lookupName(type: Type): string {
    const name = this.findTypeName(type);
    if (name === undefined) {
      throw TypeNotRegistered.new(type);
    }

    return name;
  }

  public has(name: string): boolean {
    return Object.hasOwn(this.instances, name);
  }

  public register(name: string, type: Type): void {
    if (this.has(name)) {
      throw TypesAlreadyExists.new(name);
    }

    if (this.findTypeName(type) !== undefined) {
      throw TypeAlreadyRegistered.new(type);
    }

    this.instances[name] = type;
    this.reverseIndex.set(type, name);
  }

  public override(name: string, type: Type): void {
    const original = this.instances[name];
    if (original === undefined) {
      throw TypeNotFound.new(name);
    }

    const existingName = this.findTypeName(type);
    if (existingName !== undefined && existingName !== name) {
      throw TypeAlreadyRegistered.new(type);
    }

    this.reverseIndex.delete(original);
    this.instances[name] = type;
    this.reverseIndex.set(type, name);
  }

  public getMap(): Record<string, Type> {
    return { ...this.instances };
  }

  private findTypeName(type: Type): string | undefined {
    return this.reverseIndex.get(type);
  }
}
