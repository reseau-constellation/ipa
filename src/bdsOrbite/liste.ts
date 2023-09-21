/**
 * @namespace Databases-List
 * @memberof module:Databases
 * @description
 * List database.
 *
 * @augments module:Databases~Database
 */
import { type AccessController, Database, type Identity }from '@orbitdb/core'
import type { IPFS } from 'ipfs-core';

const type = 'liste'

/**
 * Defines an List database.
 * @return {module:Databases.Databases-List} A List function.
 * @memberof module:Databases
 */
const KeyValue = () => async ({ 
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

  const add = async (value: any): Promise<string> => {
    return addOperation({ op: 'ADD', key: null, value })
  }


  const del = async (hash: string): Promise<string> => {
    return addOperation({ op: 'DEL', key: null, value: hash })
  }

  const iterator = async function * ({ amount }: { amount?: number } = {}) {
    const vals: {[val: string]: any} = {}
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
      if (amount && count >= amount) {
        break
      }
    }
  }

  const all = async (): Promise<{
    value: any;
    hash: any;
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

KeyValue.type = type

export default KeyValue