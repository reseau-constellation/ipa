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
import * as Block from "multiformats/block";
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "multiformats/hashes/sha2";
import * as dagCbor from "@ipld/dag-cbor";
import { mandatOrbite } from "../../orbite/mandat.js";
import { MODÉRATRICE, rôles } from "./consts.js";
import { AccèsParComptes } from "./compte.js";
import { Rôle } from "./types.js";

const type = "contrôleur-accès-constellation";

const codec = dagCbor;
const hasher = sha256;
const hashStringEncoding = base58btc;

const premierModérateur = async ({
  stockage,
  type,
  params,
}: {
  stockage: Storage;
  type: string;
  params: { écriture: string };
}) => {
  const manifest = {
    type,
    ...params,
  };
  const { cid, bytes } = await Block.encode({ value: manifest, codec, hasher });
  const hash = cid.toString(hashStringEncoding);
  await stockage.put(hash, bytes);
  return hash;
};

const ContrôleurAccès =
  ({
    écriture,
    storage: stockage,
  }: { écriture?: string; storage?: Storage } = {}) =>
  async ({
    orbitdb,
    identities,
    address,
  }: {
    orbitdb: OrbitDB;
    identities: IdentitiesType;
    address?: string;
  }) => {
    orbitdb = mandatOrbite(orbitdb);

    const stockageFinal =
      stockage ??
      (await ComposedStorage(
        await LRUStorage({ size: 1000 }),
        await IPFSBlockStorage({ ipfs: orbitdb.ipfs, pin: true }),
      ));
    écriture = écriture ?? orbitdb.identity.id;

    const accès = new AccèsParComptes(orbitdb);

    if (address) {
      const octetsManifest = await stockageFinal.get(
        address.replaceAll("/contrôleur-accès-constellation/", ""),
      );
      const { value } = await Block.decode({
        bytes: octetsManifest,
        codec,
        hasher,
      });
      ({ écriture } = value as { écriture: string });
    } else {
      address = await premierModérateur({
        stockage: stockageFinal,
        type,
        params: { écriture },
      });
      address = `${type}/${address}`;
    }

    // Ajouter la première modératrice
    await accès.autoriser({ id: écriture, rôle: MODÉRATRICE });
    await accès.àJour();

    const canAppend = async (entry: LogEntry): Promise<boolean> => {
      // Pour l'instant, on ne peut qu'ajouter (et non révoquer) des membres
      if (entry.payload.op !== "PUT" || !entry.payload.value) return false;

      const { key: idAjout, value: rôle } = entry.payload as {
        key: string;
        value: Rôle;
      };

      const rôleValide = rôles.includes(rôle as Rôle);

      if (!rôleValide) return false;

      const identitéSignataire = await identities.getIdentity(entry.identity);
      if (!identitéSignataire) {
        return false;
      }
      const { id } = identitéSignataire;

      if (
        // Vérifier l'identité
        (await identities.verifyIdentity(identitéSignataire)) &&
        // Vérifier que la signataire est une modératrice
        (await seraÉventuellementUneModératrice(id, entry))
      ) {
        // Si on a ajouté une modératrice, elle aussi pourra ajouter d'autres membres ou modératrices
        if (rôle === MODÉRATRICE) {
          await accès.autoriser({ id: idAjout, rôle: MODÉRATRICE });
        }

        // Qu'il s'agisse d'un membre ou d'une modératrice, on accepte la demande d'édition des données
        return true;
      }

      return false;
    };

    // Cette fonction est nécessaire dans le cas où on n'a pas encore reçu les
    // entrées qui approuveront la signataire en tant que modératrice
    const seraÉventuellementUneModératrice = async (
      id: string,
      entry: LogEntry,
    ): Promise<boolean> => {
      if (await accès.estUneModératrice(id)) return true;

      const prochains = entry.next;

      // On itère à travers les entrées précédentes
      for (const prochain of prochains) {
        const octets = await stockageFinal.get(prochain);
        const prochaineEntrée = await Entry.decode(octets);
        const prochaineValide = await canAppend(prochaineEntrée);

        if (prochaineValide) {
          if (await accès.estUneModératrice(id)) return true;
        }
      }
      return false;
    };

    return {
      type,
      address,
      écriture,
      canAppend,
    };
  };

ContrôleurAccès.type = type;
export { ContrôleurAccès };
