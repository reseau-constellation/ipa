import { Database, type Identity, type Storage } from '@orbitdb/core'
import type { IPFS } from 'ipfs-core';
import { AccessController } from 'orbit-db-access-controllers';

const type = 'set' as const

const Set = () => async ({ 
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

  const put = async (value: unknown): Promise<string> => {
    return addOperation({ op: 'PUT', key: null, value })
  }

  const del = async (value: unknown): Promise<string> => {
    return addOperation({ op: 'DEL', key: null, value })
  }

  const iterator = async function * ({ amount }: { amount?: number } = {}): AsyncGenerator<{
    value: unknown;
    hash: string;
  }, void, unknown> {
    const vals: {[val: string]: unknown} = {}
    let count = 0
    for await (const entry of log.traverse()) {
      const { op, value } = entry.payload
      const key = JSON.stringify(value);

      if (op === 'PUT' && !vals[key]) {
        vals[key] = true
        count++
        const hash = entry.hash
        yield { value, hash }
      } else if (op === 'DEL' && !vals[key]) {
        vals[key] = true
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
    put,
    set: put, // Alias for put()
    del,
    iterator,
    all
  }
}

Set.type = type

export default Set