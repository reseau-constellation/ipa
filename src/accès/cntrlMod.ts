import type {OrbitDB} from "@orbitdb/core";
import type identityProvider from "orbit-db-identity-provider";
import * as Block from 'multiformats/block'
import * as dagCbor from '@ipld/dag-cbor'
import { sha256 } from 'multiformats/hashes/sha2'
import { base58btc } from 'multiformats/bases/base58'

import GestionnaireAccès from "@/accès/gestionnaireUtilisateurs.js";
import { MODÉRATEUR, rôles } from "@/accès/consts.js";
import type { élémentBdAccès } from "@/accès/types.js";

const type = "controlleur-accès-constellation";

const codec = dagCbor
const hasher = sha256
const hashStringEncoding = base58btc

export interface OptionsContrôleurAccèsConstellation {
  premierMod?: string;
}

interface OptionsInitContrôleurAccèsConstellation
  extends OptionsContrôleurAccèsConstellation {
  premierMod: string;
}

const PremierModérateur = async ({ storage, type, params }) => {
  const manifest = {
    type,
    ...params
  }
  const { cid, bytes } = await Block.encode({ value: manifest, codec, hasher })
  const hash = cid.toString(hashStringEncoding)
  await storage.put(hash, bytes)
  return hash
}

const ContrôleurAccès = ({ write, storage } : { write?: string, storage?: Storage } = { }) => async ({ 
  orbitdb, identities, address 
}: { orbitdb: OrbitDB, identities, address?: string}) => {

  storage = storage || await ComposedStorage(
    await LRUStorage({ size: 1000 }),
    await IPFSBlockStorage({ ipfs: orbitdb.ipfs, pin: true })
  )
  write = write || [orbitdb.identity.id]

  let dernierAppel = Date.now();
  const gestAccès = new GestionnaireAccès(orbitdb);

  if (address) {
    const manifestBytes = await storage.get(address.replaceAll('/controlleur-accès-constellation/', ''))
    const { value } = await Block.decode({ bytes: manifestBytes, codec, hasher })
    write = value.write
  } else {
    address = await AccessControlList({ storage, type, params: { write } })
    address = pathJoin('/', type, address)
  }

  // Ajouter le premier modérateur
  await gestAccès.ajouterÉléments([
    { id: write, rôle: MODÉRATEUR },
  ]);

  const canAppend = async (
    entry: LogEntry<élémentBdAccès>,
    identityProvider: identityProvider
  ): Promise<boolean> => {
    const idÉlément = entry.identity.id;
    const { rôle, id: idAjout } = entry.payload.value;
    const estUnMod = estUnModérateurPatient(idÉlément);
    const rôleValide = rôles.includes(rôle);

    const validSig = async () =>
      identityProvider.verifyIdentity(entry.identity);

    if (rôleValide && (await estUnMod) && (await validSig())) {
      if (rôle === MODÉRATEUR) {
        await gestAccès.ajouterÉléments([
          { id: idAjout, rôle: MODÉRATEUR },
        ]);
        dernierAppel = Date.now();
      }
      return true;
    }
    return false;
  }

  // À faire : vérifier si toujours nécessaire sur bd-orbite 1,0
  const estUnModérateurPatient = async (id: string): Promise<boolean> => {
    const PATIENCE = 1000;

    if (await gestAccès.estUnModérateur(id)) return true;

    return new Promise((résoudre) => {
      const partirCrono = () => {
        setTimeout(async () => {
          const estAutorisé = await gestAccès.estUnModérateur(id);
          if (estAutorisé) {
            résoudre(true);
          } else {
            const maintenant = Date.now();
            if (maintenant - dernierAppel > PATIENCE) {
              résoudre(false);
            } else {
              partirCrono();
            }
          }
        }, 100);
      };
      partirCrono();
    });
  }

  return {
    type,
    address,
    write,
    canAppend,
  }

}

ContrôleurAccès.type = type
export default ContrôleurAccès
