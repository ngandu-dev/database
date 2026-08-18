import { AbstractException } from "../../abstract-exception";

export class PortWithoutHost extends AbstractException {
  public static new(): PortWithoutHost {
    return new PortWithoutHost("Connection port specified without the host");
  }
}
