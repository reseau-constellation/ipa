/**
 * @namespace Databases-KeyValue
 * @memberof module:Databases
 * @description
 * Key-Value database.
 *
 * @augments module:Databases~Database
 */
import { Database }from '@orbitdb/core'
import type { IPFS } from 'ipfs-core';

const type = 'listeOrdonnée'

/**
 * Defines an KeyValue database.
 * @return {module:Databases.Databases-KeyValue} A KeyValue function.
 * @memberof module:Databases
 */
const KeyValue = () => async ({ 
    ipfs, identity, address, name, access, directory, meta, headsStorage, entryStorage, indexStorage, referencesCount, syncAutomatically, onUpdate 
}: {
    ipfs: IPFS
}) => {
  const database = await Database({ ipfs, identity, address, name, access, directory, meta, headsStorage, entryStorage, indexStorage, referencesCount, syncAutomatically, onUpdate })

  const { addOperation, log } = database

  const add = async (value: any, position?: number): Promise<string> => {
    return addOperation({ op: 'ADD', key: null, value: { value, position } })
  }

  const move = async (hash: string, position: number) => {
    return addOperation({ op: 'MOVE', key: null, value: { hash, position }})
  }


  const del = async (hash: string): Promise<string> => {
    return addOperation({ op: 'DEL', key: null, value: hash })
  }

  const iterator = async function * ({ amount }: { amount?: number } = {}) {
    const effacés: Set<string> = new Set();
    
    let count = 0
    for await (const entry of log.traverse()) {
      const { op, hash, value } = entry.payload

      if (op === 'ADD' && !effacés.has(hash)) {
        count++
        const hash = entry.hash
        vals[hash] = true
        yield { value, position, hash }
      } else if (op === 'MOVE' && !effacés.has(hash)) {
        yield { value, position, hash }
      } else if (op === 'DEL' && !effacés.has(hash)) {
        effacés.add(hash);
      }
      if (amount && count >= amount) {
        break
      }
    }
  }

  const all = async (): Promise<{
    value: any;
    position: number;
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
    move,
    del,
    iterator,
    all
  }
}

KeyValue.type = type

export default KeyValue