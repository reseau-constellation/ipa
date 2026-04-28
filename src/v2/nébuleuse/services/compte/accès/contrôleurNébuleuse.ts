/* Fortement inspirée du contrôleur Orbit-DB de 3Box
MIT License

Copyright (c) 2019 3Box Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import * as Block from "multiformats/block";
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "multiformats/hashes/sha2";
import * as dagCbor from "@ipld/dag-cbor";

import { ComposedStorage, IPFSBlockStorage, LRUStorage } from "@orbitdb/core";

import { v4 as uuidv4 } from "uuid";
import PQueue from "p-queue";
import { estErreurAvortée } from "@/v2/nébuleuse/utils.js";
import { mandatOrbite } from "../../orbite/mandat.js";
import { appelerLorsque } from "../../utils.js";
import { MODÉRATRICE, rôles } from "./consts.js";
import { ContrôleurAccès } from "./contrôleurModératrices.js";
import { AccèsParComptes } from "./compte.js";
import type {
  DagCborEncodable,
  KeyValueDatabase,
  IdentitiesType,
  LogEntry,
  OrbitDB,
  Storage,
  Identity,
} from "@orbitdb/core";
import type { AccèsDispositif, AccèsUtilisateur, Rôle } from "./types.js";
import type { Oublier, Suivi } from "@/v2/nébuleuse/types.js";

export const nomType = "contrôleur-nébuleuse";

export interface OptionsContrôleurNébuleuse {
  écriture?: string;
  adresse?: string;
  nom?: string;
}

const codec = dagCbor;
const hasher = sha256;
const hashStringEncoding = base58btc;

const ManifestContrôleurNébuleuse = async ({
  stockage,
  type,
  params,
  signal,
}: {
  stockage: Storage;
  type: string;
  params: { nom: string; adresseBdAccès: string; écriture: string };
  signal?: AbortSignal;
}) => {
  const manifest = {
    type,
    ...params,
  };
  const { cid, bytes } = await Block.encode({ value: manifest, codec, hasher });
  const hash = cid.toString(hashStringEncoding);
  await stockage.put(hash, bytes, signal);
  return hash;
};

const ContrôleurNébuleuse =
  ({
    écriture,
    nom,
    storage: stockage,
  }: {
    écriture?: string;
    nom?: string;
    storage?: Storage;
  } = {}) =>
  async ({
    orbitdb,
    identities,
    address,
    signal,
  }: {
    orbitdb: OrbitDB;
    identities: IdentitiesType;
    address?: string;
    signal?: AbortSignal;
  }) => {
    nom = nom || uuidv4();
    stockage ??= await ComposedStorage(
      await LRUStorage({ size: 1000 }),
      await IPFSBlockStorage({ ipfs: orbitdb.ipfs, pin: true }),
    );

    orbitdb = mandatOrbite(orbitdb);

    let adresseBdAccès: string;

    let bdAccès: KeyValueDatabase;

    if (écriture?.startsWith(`/${nomType}/`) && !address) {
      address = écriture;
    }

    if (address) {
      const manifestBytes = await stockage.get(
        address.replaceAll(`/${nomType}/`, ""),
        signal,
      );
      const { value } = await Block.decode({
        bytes: manifestBytes,
        codec,
        hasher,
      });
      ({ écriture, nom, adresseBdAccès } = value as {
        écriture: string;
        nom: string;
        adresseBdAccès: string;
      });

      bdAccès = (await orbitdb.open(adresseBdAccès, {
        type: "keyvalue",
        signal,
      })) as KeyValueDatabase;
    } else {
      écriture ??= orbitdb.identity.id;
      bdAccès = (await orbitdb.open(
        nom, // Je pense qu'on peut faire ça, tant que le nom reste unique...
        {
          type: "keyvalue",
          AccessController: ContrôleurAccès({ écriture, storage: stockage }),
          signal,
        },
      )) as KeyValueDatabase;
      adresseBdAccès = bdAccès.address;
      address = await ManifestContrôleurNébuleuse({
        stockage,
        type: nomType,
        params: { écriture, nom, adresseBdAccès },
        signal,
      });
      address = `/${nomType}/${address}`;
    }

    const accès = new AccèsParComptes({ orbite: orbitdb, signal });
    const queue = new PQueue({ concurrency: 1 });

    const mettreAccèsÀJour = async () => {
      const dynamiques = (await bdAccès.all()).map(({ key, value }) => ({
        rôle: value as Rôle,
        id: key,
      }));
      const autorisations: { rôle: Rôle; id: string }[] = [
        { rôle: MODÉRATRICE, id: écriture! },
        ...dynamiques,
      ];

      await Promise.all(autorisations.map((x) => accès.autoriser(x)));
    };

    const oublierBdAccès = appelerLorsque({
      émetteur: bdAccès.events,
      événement: "update",
      f: () => queue.add(mettreAccèsÀJour),
    });

    // Actualiser avec les accès initiaux
    queue.add(mettreAccèsÀJour);

    const àJour = async () => {
      await queue.onIdle();
      await accès.àJour();
    };

    const estAutorisé = async (id: string): Promise<boolean> => {
      await àJour();
      return await accès.estAutorisé(id);
    };

    const estUneModératrice = async (id: string): Promise<boolean> => {
      await àJour();
      return await accès.estUneModératrice(id);
    };

    const estUnMembre = async (id: string): Promise<boolean> => {
      await àJour();
      return await accès.estUnMembre(id);
    };

    const canAppend = async (
      entry: LogEntry<DagCborEncodable>,
    ): Promise<boolean> => {
      let identitéÉcrivain: Identity;
      try {
        identitéÉcrivain = await identities.getIdentity(entry.identity, signal);
      } catch (e) {
        if (e.toString().includes("AbortError")) return false;
        throw e;
      }
      if (!identitéÉcrivain) {
        return false;
      }

      const { id } = identitéÉcrivain;

      // Pour implémenter la révocation des permissions, garder compte ici
      // des entrées approuvées par utilisatrice
      if (
        (await identities.verifyIdentity(identitéÉcrivain)) &&
        (await estAutorisé(id))
      ) {
        return true;
      }

      return false;
    };

    const autoriser = async (rôle: Rôle, id: string): Promise<void> => {
      if (!rôles.includes(rôle)) {
        throw new Error(`Erreur: Le rôle ${rôle} n'existe pas.`);
      }

      if (await accès.existeDéjà({ id, rôle })) return;

      try {
        await bdAccès.put(id, rôle);
      } catch (_e) {
        const e = _e as Error;
        if (e.toString().includes("not append entry")) {
          throw new Error(
            `Erreur : Le rôle ${rôle} ne peut pas être octroyé à ${id}.`,
          );
        }
        throw e;
      }
    };

    const révoquer = async (
      _rôle: (typeof rôles)[number],
      _id: string,
    ): Promise<void> => {
      throw new Error(
        "C'est très difficile à implémenter...avez-vous des idées ?",
      );
    };

    const close = async () => {
      await oublierBdAccès();

      // Le mandataire s'assure que la base de données d'accès n'est pas fermée si elle est partagée avec d'autres bds.
      await bdAccès.close();

      await accès.fermer();
    };

    const drop = async () => {
      // Désactivée pour l'instant. Si nous avons plus qu'une bd qui partagent le même contrôleur,
      // la destruction de la bd du contrôleur pourrait causer des ennuis.
      // await bd.drop();
    };

    const utilisateursAutorisés = async (): Promise<AccèsUtilisateur[]> => {
      await àJour();
      return accès.utilisateurs;
    };

    const suivreUtilisateursAutorisés = async (
      f: Suivi<AccèsUtilisateur[]>,
    ): Promise<Oublier> => {
      const oublier = appelerLorsque({
        émetteur: accès.événements,
        événement: "misÀJour",
        f: async () => await f(accès.utilisateurs),
      });

      await f(accès.utilisateurs);
      return oublier;
    };

    const dispositifsAutorisés = async (): Promise<AccèsDispositif[]> => {
      await àJour();
      return accès.dispositifs;
    };

    const suivreDispositifsAutorisées = async (
      f: Suivi<AccèsDispositif[]>,
    ): Promise<Oublier> => {
      const oublier = appelerLorsque({
        émetteur: accès.événements,
        événement: "misÀJour",
        f: async () => await f(await dispositifsAutorisés()),
      });
      await f(accès.dispositifs);

      return oublier;
    };

    return {
      // Propriétés nécessaires pour OrbitDB
      type: nomType,
      address,
      canAppend,
      close,
      drop,

      // Propriétés spécifiques
      nom,
      adresseBdAccès,
      écriture,
      autoriser,
      révoquer,
      utilisateursAutorisés,
      dispositifsAutorisés,
      suivreUtilisateursAutorisés,
      suivreDispositifsAutorisées,
      accès,
      estAutorisé,
      estUnMembre,
      estUneModératrice,
      bd: bdAccès,
    };
  };

ContrôleurNébuleuse.type = nomType;
export { ContrôleurNébuleuse };

export const estContrôleurNébuleuse = (
  x: unknown,
): x is InstanceContrôleurNébuleuse => {
  return (x as InstanceContrôleurNébuleuse).type === nomType;
};

export type InstanceContrôleurNébuleuse = Awaited<
  ReturnType<ReturnType<typeof ContrôleurNébuleuse>>
>;
