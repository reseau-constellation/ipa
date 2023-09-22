/**
 * @namespace Databases-Feed
 * @memberof module:Databases
 * @description
 * Feed database.
 *
 * @augments module:Databases~Database
 */
import { type AccessController, Database, type Identity, type Storage } from '@orbitdb/core'
import type { IPFS } from 'ipfs-core';

const type = 'feed' as const

const Feed = () => async ({ 
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
    onUpdate 
}: {
    ipfs: IPFS,
    identity?: Identity,
    address: string,
    name?: string,
    access?: AccessController,
    directory?: string,
    meta?: object,
    headsStorage?: Storage,
    entryStorage?: Storage,
    indexStorage?: Storage,
    referencesCount?: number,
    syncAutomatically?: boolean,
    onUpdate?: () => void,
}) => {
  const database = await Database({ ipfs, identity, address, name, access, directory, meta, headsStorage, entryStorage, indexStorage, referencesCount, syncAutomatically, onUpdate })

  const { addOperation, log } = database

  const add = async (value: unknown): Promise<string> => {
    return addOperation({ op: 'ADD', key: null, value })
  }


  const del = async (hash: string): Promise<string> => {
    return addOperation({ op: 'DEL', key: null, value: hash })
  }

  const iterator = async function * ({ amount }: { amount?: number } = {}): AsyncGenerator<{
    value: unknown;
    hash: string;
}, void, unknown> {
    const vals: {[val: string]: boolean} = {}
    let count = 0
    for await (const entry of log.traverse()) {
      const { op, hash, value } = entry.payload

      if (op === 'ADD' && !vals[hash]) {
        count++
        const hash = entry.hash
        vals[hash] = true
        yield { value, hash }
      } else if (op === 'DEL' && !vals[hash]) {
        vals[hash] = true
      }
      if (amount !== undefined && count >= amount) {
        break
      }
    }
  }

  const all = async (): Promise<{
    value: unknown;
    hash: string;
  }[]> => {
    const values = []
    for await (const entry of iterator()) {
      values.unshift(entry)
    }
    return values
  }

  return {
    ...database,
    type,
    add,
    del,
    iterator,
    all
  }
}

Feed.type = type

export default Feed