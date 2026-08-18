import type { KeywordList } from "./keywords/keyword-list";
import { MariaDB117Keywords } from "./keywords/mariadb117-keywords";
import { MariaDB1010Platform } from "./mariadb1010-platform";

export class MariaDB110700Platform extends MariaDB1010Platform {
  protected override createReservedKeywordsList(): KeywordList {
    return new MariaDB117Keywords();
  }
}
