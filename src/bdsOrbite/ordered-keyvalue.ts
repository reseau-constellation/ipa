/**
 * @namespace Databases-OrderedKeyValue
 * @memberof module:Databases
 * @description
 * Key-Value database.
 *
 * @augments module:Databases~Database
 */
import {
  type AccessController,
  Database,
  type Identity,
  type Storage,
} from "@orbitdb/core";
import type { IPFS } from "ipfs-core";

const type = "ordered-keyvalue" as const;

/**
 * Defines an OrderedKeyValue database.
 * @return {module:Databases.Databases-OrderedKeyValue} A OrderedKeyValue function.
 * @memberof module:Databases
 */
const OrderedKeyValue =
  () =>
  async ({
    ipfs,
    identity,
    address,
    name,
    access,
    directory,
    meta,
    headsStorage,
    entryStorage,
    indexStorage,
    referencesCount,
    syncAutomatically,
    onUpdate,
  }: {
    ipfs: IPFS;
    identity?: Identity;
    address: string;
    name?: string;
    access?: AccessController;
    directory?: string;
    meta?: object;
    headsStorage?: Storage;
    entryStorage?: Storage;
    indexStorage?: Storage;
    referencesCount?: number;
    syncAutomatically?: boolean;
    onUpdate?: () => void;
  }) => {
    const database = await Database({
      ipfs,
      identity,
      address,
      name,
      access,
      directory,
      meta,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
      syncAutomatically,
      onUpdate,
    });

    const { addOperation, log } = database;

    /**
     * Stores a key/value pair to the store.
     * @function
     * @param {string} key The key to store.
     * @param {*} value The value to store.
     * @return {string} The hash of the new oplog entry.
     * @memberof module:Databases.Databases-OrderedKeyValue
     * @instance
     */
    const put = async (
      key: string,
      value: unknown,
      position?: number,
    ): Promise<string> => {
      return addOperation({ op: "PUT", key, value: { value, position } });
    };

    const move = async (key: string, position: number): Promise<string> => {
      return addOperation({ op: "MOVE", key, value: position });
    };

    /**
     * Deletes a key/value pair from the store.
     * @function
     * @param {string} key The key of the key/value pair to delete.
     * @memberof module:Databases.Databases-OrderedKeyValue
     * @instance
     */
    const del = async (key: string): Promise<string> => {
      return addOperation({ op: "DEL", key, value: null });
    };

    /**
     * Gets a value from the store by key.
     * @function
     * @param {string} key The key of the value to get.
     * @return {{value: *, position: number}} The value corresponding to key or null.
     * @memberof module:Databases.Databases-OrderedKeyValue
     * @instance
     */
    const get = async (
      key: string,
    ): Promise<{ value: unknown; position: number } | undefined> => {
      for await (const entry of log.traverse()) {
        const { op, key: k, value } = entry.payload;
        if (op === "PUT" && k === key) {
          return value as { value: unknown; position: number };
        } else if (op === "DEL" && k === key) {
          return undefined;
        }
      }
      return undefined;
    };

    /**
     * Iterates over keyvalue pairs.
     * @function
     * @param {Object} [filters={}] Various filters to apply to the iterator.
     * @param {string} [filters.amount=-1] The number of results to fetch.
     * @yields [string, string, string] The next key/value as key/value/hash.
     * @memberof module:Databases.Databases-OrderedKeyValue
     * @instance
     */
    const iterator = async function* ({
      amount,
    }: { amount?: number } = {}): AsyncGenerator<
      {
        key: string;
        value: unknown;
        position: number;
        hash: string;
      },
      void,
      unknown
    > {
      const keys: { [key: string]: boolean } = {};
      const positions: { [key: string]: number } = {};

      let count = 0;
      for await (const entry of log.traverse()) {
        const { op, key, value } = entry.payload;
        if (!key) return;

        // Le nombre de données
        let n = 0;

        if (op === "PUT" && !keys[key]) {
          keys[key] = true;
          const putValue = value as { value: unknown; position?: number };
          count++;
          n++;
          const hash = entry.hash;
          const position =
            positions[key] !== undefined
              ? positions[key]
              : putValue.position !== undefined
              ? putValue.position
              : n;
          yield { key, value: putValue.value, position, hash };
        } else if (op === "MOVE" && !keys[key]) {
          positions[key] = value as number;
        } else if (op === "DEL" && !keys[key]) {
          keys[key] = true;
        }
        if (amount !== undefined && count >= amount) {
          break;
        }
      }
    };

    /**
     * Returns all key/value pairs.
     * @function
     * @return [][string, string, string] An array of key/value pairs as
     * key/value/hash entries.
     * @memberof module:Databases.Databases-OrderedKeyValue
     * @instance
     */
    const all = async () => {
      const values: { key: string; value: unknown; hash: string }[] = [];
      for await (const entry of iterator()) {
        const { position, key, value, hash } = entry;
        values.splice(position, 0, { key, value, hash });
      }
      return values;
    };

    return {
      ...database,
      type,
      put,
      set: put, // Alias for put()
      del,
      move,
      get,
      iterator,
      all,
    };
  };

OrderedKeyValue.type = type;

export default OrderedKeyValue;
