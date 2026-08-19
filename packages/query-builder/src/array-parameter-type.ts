import { ParameterType } from "./parameter-type";

export enum ArrayParameterType {
  INTEGER = "ARRAY_INTEGER",
  STRING = "ARRAY_STRING",
  ASCII = "ARRAY_ASCII",
  BINARY = "ARRAY_BINARY",
}

export namespace ArrayParameterType {
  /**
   * Maps ArrayParameterType to corresponding ParameterType.
   */
  export function toElementParameterType(type: ArrayParameterType): ParameterType {
    switch (type) {
      case ArrayParameterType.INTEGER:
        return ParameterType.INTEGER;
      case ArrayParameterType.STRING:
        return ParameterType.STRING;
      case ArrayParameterType.ASCII:
        return ParameterType.ASCII;
      case ArrayParameterType.BINARY:
        return ParameterType.BINARY;
    }
  }
}
