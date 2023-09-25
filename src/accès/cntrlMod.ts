import {
  IPFSBlockStorage,
  ComposedStorage,
  LRUStorage,
  type Storage,
  type Identities,
  type OrbitDB,
  Entry,
} from "@orbitdb/core";
import * as Block from "multiformats/block";
import * as dagCbor from "@ipld/dag-cbor";
import { sha256 } from "multiformats/hashes/sha2";
import { base58btc } from "multiformats/bases/base58";

import GestionnaireAccès from "@/accès/gestionnaireUtilisateurs.js";
import { MODÉRATEUR, rôles } from "@/accès/consts.js";
import type { élémentBdAccès } from "@/accès/types.js";
import { pathJoin } from "./utils.js";

const type = "contrôleur-accès-constellation";

const codec = dagCbor;
const hasher = sha256;
const hashStringEncoding = base58btc;

export interface OptionsContrôleurAccèsConstellation {
  premierMod?: string;
}

const PremierModérateur = async ({
  storage,
  type,
  params,
}: {
  storage: Storage;
  type: string;
  params: { write: string };
}) => {
  const manifest = {
    type,
    ...params,
  };
  const { cid, bytes } = await Block.encode({ value: manifest, codec, hasher });
  const hash = cid.toString(hashStringEncoding);
  await storage.put(hash, bytes);
  return hash;
};

const ContrôleurAccès =
  ({ write, storage }: { write?: string; storage?: Storage } = {}) =>
  async ({
    orbitdb,
    identities,
    address,
  }: {
    orbitdb: OrbitDB;
    identities: Identities;
    address?: string;
  }) => {
    storage =
      storage ||
      (await ComposedStorage(
        await LRUStorage({ size: 1000 }),
        await IPFSBlockStorage({ ipfs: orbitdb.ipfs, pin: true })
      ));
    write = write || orbitdb.identity.id;

    let dernierAppel = Date.now();
    const gestAccès = new GestionnaireAccès(orbitdb);

    if (address) {
      const manifestBytes = await storage.get(
        address.replaceAll("/contrôleur-accès-constellation/", "")
      );
      const { value } = await Block.decode({
        bytes: manifestBytes,
        codec,
        hasher,
      });
      ({ write } = value as { write: string });
    } else {
      address = await PremierModérateur({
        storage,
        type,
        params: { write: write! },
      });
      address = pathJoin("/", type, address);
    }

    // Ajouter le premier modérateur
    await gestAccès.ajouterÉléments([{ id: write!, rôle: MODÉRATEUR }]);

    const canAppend = async (
      entry: Entry<élémentBdAccès>
    ): Promise<boolean> => {
      // Pour l'instant, on ne peut qu'ajouter des membres
      if (entry.payload.op !== "PUT" || !entry.payload.value) return false;

      const { rôle, id: idAjout } = entry.payload.value;

      const rôleValide = rôles.includes(rôle);

      const writerIdentity = await identities.getIdentity(entry.identity);
      if (!writerIdentity) {
        return false;
      }
      const { id } = writerIdentity;
      const estUnMod = estUnModérateurPatient(id);

      if (
        rôleValide &&
        (await estUnMod) &&
        identities.verifyIdentity(writerIdentity)
      ) {
        if (rôle === MODÉRATEUR) {
          await gestAccès.ajouterÉléments([{ id: idAjout, rôle: MODÉRATEUR }]);
          dernierAppel = Date.now();
        }
        return true;
      }
      return false;
    };

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
    };

    return {
      type,
      address,
      write,
      canAppend,
    };
  };

ContrôleurAccès.type = type;
export default ContrôleurAccès;
