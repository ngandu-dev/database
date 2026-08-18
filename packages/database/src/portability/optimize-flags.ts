import { AbstractPlatform } from "../platforms/abstract-platform";
import { DB2Platform } from "../platforms/db2-platform";
import { OraclePlatform } from "../platforms/oracle-platform";
import { SQLServerPlatform } from "../platforms/sqlserver-platform";
import { Connection } from "./connection";

export class OptimizeFlags {
  private readonly platformMasks: Array<{ mask: number; platform: new () => AbstractPlatform }> = [
    { mask: 0, platform: DB2Platform },
    { mask: Connection.PORTABILITY_EMPTY_TO_NULL, platform: OraclePlatform },
    { mask: 0, platform: SQLServerPlatform },
  ];

  public apply(platform: AbstractPlatform, flags: number): number {
    for (const platformMask of this.platformMasks) {
      if (platform instanceof platformMask.platform) {
        return flags & ~platformMask.mask;
      }
    }

    return flags;
  }
}
