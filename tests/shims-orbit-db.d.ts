declare module "orbit-db" {
  import { EventEmitter } from "events";
  import IPFS from "ipfs";

  import { AccessController } from "orbit-db-access-controllers/src/access-controller-interface";

  type identity = {
    id: string;
    publicKey: string;
    signatures: {
      id: string;
      publicKey: string;
    };
    provider: {
      verify(signature: string, publicKey: string, message: string);
      sign(id: identity, message: string);
    };
  };
  export type entréeBD<T> = {
    identity: identity;
    payload: {
      value: T;
    };
  };

  export class identityProvider {
    verifyIdentity(identity: identity): Promise<boolean>;
  }

  export default class OrbitDB {
    static createInstance(
      ipfs: any,
      options: { [key: string]: any }
    ): Promise<OrbitDB>;
    identity: identity;
    _ipfs: IPFS;
    determineAddress(
      name: string,
      type: string,
      options?: ?{ [key: string]: any }
    );
    isValidAddress(address: string): boolean;
    open(address: string, options?: ?{ [key: string]: any }): Promise<Store>;
    kvstore(string, options?: ?{ [key: string]: any }): Promise<KeyValueStore>;
    keyvalue(string, options?: ?{ [key: string]: any }): Promise<KeyValueStore>;
    feed(string, options?: ?{ [key: string]: any }): Promise<FeedStore>;
    eventlog(string, options?: ?{ [key: string]: any }): Promise<Store>;
    counter(string, options?: ?{ [key: string]: any }): Promise<Store>;
    docstore(string, options?: ?{ [key: string]: any }): Promise<Store>;
    stop(): Promise<void>;
  }

  class Log {
    heads: Entry[];
  }

  class Entry {
    hash: string;
  }

  export class Store {
    id: string;
    address: string;
    type: string;
    events: EventEmitter;
    access: AccessController;
    index: { [key: string]: entréeBD };
    drop(): Promise<void>;
    load(): Promise<void>;
    close(): Promise<void>;
    _oplog: Log;
  }

  export class KeyValueStore extends Store {
    put(key: string, value: any): Promise<string>;
    set(key: string, value: any): Promise<string>;
    get(key: string): Promise<any>;
    del(key: string): Promise<string>;
    all: { [key: string]: any };
  }

  class Iterator {
    collect(): any[];
  }

  export interface élémentFeedStore<T> {
    hash: string;
    payload: {
      value: T;
    };
  }

  export class FeedStore extends Store {
    add(any): Promise<string>;
    get(hash: string): Promise<any>;
    remove(hash: string): Promise<string>;
    iterator(options: FeedStoreIteratorOptions): Iterator<élémentFeedStore>;
  }

  export class AccessControllers {
    static addAccessController(options: { [key: string]: any }): void;
  }

  export function isValidAddress(address: string): boolean;
}
