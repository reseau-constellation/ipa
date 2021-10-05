declare module "orbit-db-access-controllers/src/access-controller-interface" {
  import { EventEmitter } from "events";
  export default class AccessController extends EventEmitter {
    get type(): string;
    get address(): string;
    canAppend(entry: any, identityProvider: any): Promise<boolean>;
    write: string[];
  }
}
declare module "orbit-db-access-controllers/src/utils/ensure-ac-address";
