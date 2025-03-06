import {
  ComposedStorage,
  Entry,
  IPFSBlockStorage,
  LRUStorage,
  type IdentitiesType,
  type LogEntry,
  type OrbitDB,
  type Storage,
} from "@orbitdb/core";

import * as dagCbor from "@ipld/dag-cbor";
import { base58btc } from "multiformats/bases/base58";
import * as Block from "multiformats/block";
import { sha256 } from "multiformats/hashes/sha2";

import { MODÉRATEUR, rôles } from "@/accès/consts.js";
import { GestionnaireAccès } from "@/accès/gestionnaireUtilisateurs.js";
import { pathJoin } from "./utils.js";
import type { élémentBdAccès } from "@/accès/types.js";

const type = "contrôleur-accès-constellation";

const codec = dagCbor;
const hasher = sha256;
const hashStringEncoding = base58btc;

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
    identities: IdentitiesType;
    address?: string;
  }) => {
    storage =
      storage ??
      (await ComposedStorage(
        await LRUStorage({ size: 1000 }),
        await IPFSBlockStorage({ ipfs: orbitdb.ipfs, pin: true }),
      ));
    write = write ?? orbitdb.identity.id;

    const gestAccès = new GestionnaireAccès(orbitdb);

    if (address) {
      const manifestBytes = await storage.get(
        address.replaceAll("/contrôleur-accès-constellation/", ""),
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
        params: { write },
      });
      address = pathJoin("/", type, address);
    }

    // Ajouter le premier modérateur
    await gestAccès.ajouterÉléments([{ id: write, rôle: MODÉRATEUR }]);

    const canAppend = async (entry: LogEntry): Promise<boolean> => {
      // Pour l'instant, on ne peut qu'ajouter des membres
      if (entry.payload.op !== "ADD" || !entry.payload.value) return false;

      const { rôle, id: idAjout } = entry.payload.value as élémentBdAccès;

      const rôleValide = rôles.includes(rôle);

      const writerIdentity = await identities.getIdentity(entry.identity);
      if (!writerIdentity) {
        return false;
      }
      const { id } = writerIdentity;

      if (
        rôleValide &&
        (await seraÉventuellementUnModérateur(id, entry)) &&
        (await identities.verifyIdentity(writerIdentity))
      ) {
        if (rôle === MODÉRATEUR) {
          await gestAccès.ajouterÉléments([{ id: idAjout, rôle: MODÉRATEUR }]);
        }
        return true;
      }
      return false;
    };

    const seraÉventuellementUnModérateur = async (
      id: string,
      entry: LogEntry,
    ): Promise<boolean> => {
      if (await gestAccès.estUnModérateur(id)) return true;

      const prochains = entry.next;

      for (const prochain of prochains) {
        const octets = await storage!.get(prochain);
        const prochaineEntrée = await Entry.decode(octets);
        const prochaineValide = await canAppend(prochaineEntrée);

        if (prochaineValide) {
          if (await gestAccès.estUnModérateur(id)) return true;
        }
      }
      return false;
    };

    return {
      type,
      address,
      write,
      canAppend,
    };
  };

ContrôleurAccès.type = type;
export { ContrôleurAccès };
