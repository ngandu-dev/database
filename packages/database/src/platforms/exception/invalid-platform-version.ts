import type { PlatformException } from "./platform-exception";

export class InvalidPlatformVersion extends Error implements PlatformException {
  constructor(version: string, expectedFormat: string) {
    super(
      `Invalid platform version "${version}" specified. The platform version has to be specified in the format: "${expectedFormat}".`,
    );
    this.name = "InvalidPlatformVersion";
    Object.setPrototypeOf(this, InvalidPlatformVersion.prototype);
  }

  public static new(version: string, expectedFormat: string): InvalidPlatformVersion {
    return new InvalidPlatformVersion(version, expectedFormat);
  }
}
