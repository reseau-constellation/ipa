import {
  type OrbitDB,
  IPFSBlockStorage,
  LRUStorage,
  ComposedStorage,
  Identities,
  Storage,
  Entry,
} from "@orbitdb/core";
import { v4 as uuidv4 } from "uuid";
import * as Block from "multiformats/block";
import * as dagCbor from "@ipld/dag-cbor";
import { sha256 } from "multiformats/hashes/sha2";
import { base58btc } from "multiformats/bases/base58";

import type { schémaFonctionSuivi, schémaFonctionOublier } from "@/types.js";
import GestionnaireAccès, {
  suivreBdAccès,
} from "@/accès/gestionnaireUtilisateurs.js";

import { MODÉRATEUR, MEMBRE, rôles } from "@/accès/consts.js";
import type { élémentBdAccès, infoUtilisateur } from "@/accès/types.js";
import { FeedStoreTypé, gestionnaireOrbiteGénéral } from "@/orbite.js";
import { EventEmitter } from "events";
import ContrôleurAccès from "./cntrlMod.js";
import { pathJoin } from "./utils.js";
import { JSONSchemaType } from "ajv";

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

export const nomType = "contrôleur-constellation";

export interface OptionsContrôleurConstellation {
  write?: string;
  address?: string;
  nom?: string;
}

const codec = dagCbor;
const hasher = sha256;
const hashStringEncoding = base58btc;

const schémaBdAccès: JSONSchemaType<élémentBdAccès> = {
  type: "object",
  properties: {
    rôle: {
      type: "string",
    },
    id: {
      type: "string",
    },
  },
  required: ["rôle", "id"],
};

const ManifestContrôleurConstellation = async ({
  storage,
  type,
  params,
}: {
  storage: Storage;
  type: string;
  params: { nom: string; adresseBdAccès: string; write: string };
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

const ContrôleurConstellation =
  ({
    write,
    nom,
    storage,
  }: {
    write?: string;
    nom?: string;
    storage?: Storage;
  } = {}) =>
  async ({
    orbitdb,
    identities,
    address,
  }: {
    orbitdb: OrbitDB;
    identities: Identities;
    address?: string;
  }) => {
    write = write || orbitdb.identity.id;

    nom = nom || uuidv4();
    storage =
      storage ||
      (await ComposedStorage(
        await LRUStorage({ size: 1000 }),
        await IPFSBlockStorage({ ipfs: orbitdb.ipfs, pin: true }),
      ));

    // À faire : vérifier si toujours nécessaire avec bd-orbite 1,0
    const gestionnaireOrbite = gestionnaireOrbiteGénéral.obtGestionnaireOrbite({
      orbite: orbitdb,
    });

    let adresseBdAccès: string;

    let bd: FeedStoreTypé<élémentBdAccès>;
    let fOublierBd: schémaFonctionOublier;

    if (address) {
      const manifestBytes = await storage!.get(
        address.replaceAll(`/${nomType}/`, ""),
      );
      const { value } = await Block.decode({
        bytes: manifestBytes,
        codec,
        hasher,
      });
      ({ write, nom, adresseBdAccès } = value as {
        write: string;
        nom: string;
        adresseBdAccès: string;
      });
      ({ bd, fOublier: fOublierBd } = await gestionnaireOrbite.ouvrirBdTypée({
        id: adresseBdAccès,
        type: "feed",
        schéma: schémaBdAccès,
        options: {
          syncAutomatically: true,
        },
      }));
    } else {
      ({ bd, fOublier: fOublierBd } = await gestionnaireOrbite.ouvrirBdTypée({
        id: nom, // Je pense qu'on peut faire ça, tant que le nom reste unique...
        type: "feed",
        schéma: schémaBdAccès,
        options: {
          AccessController: ContrôleurAccès({ write }),
          syncAutomatically: true,
        },
      }));
      adresseBdAccès = bd.address;
      address = await ManifestContrôleurConstellation({
        storage,
        type: nomType,
        params: { write: write!, nom, adresseBdAccès },
      });
      address = pathJoin("/", nomType, address);
    }

    const événements = new EventEmitter();

    const gestRôles = new GestionnaireAccès(orbitdb);
    gestRôles.on("misÀJour", () => événements.emit("misÀJour"));

    const miseÀJourBdAccès = async (
      éléments: élémentBdAccès[],
    ): Promise<void> => {
      éléments = [{ rôle: MODÉRATEUR, id: write! }, ...éléments];
      console.log("ici", éléments);

      await gestRôles.ajouterÉléments(éléments);
    };
    const fOublierSuiviBdAccès = await suivreBdAccès(bd, miseÀJourBdAccès);

    const estAutorisé = async (id: string): Promise<boolean> => {
      return await gestRôles.estAutorisé(id);
    };

    const estUnModérateur = async (id: string): Promise<boolean> => {
      return await gestRôles.estUnModérateur(id);
    };

    const estUnMembre = async (id: string): Promise<boolean> => {
      return await gestRôles.estUnMembre(id);
    };

    const canAppend = async (
      entry: Entry<élémentBdAccès>,
    ): Promise<boolean> => {
      const writerIdentity = await identities.getIdentity(entry.identity);
      if (!writerIdentity) {
        return false;
      }

      const { id } = writerIdentity;

      // Pour implémenter la révocation des permissions, garder compte ici
      // des entrées approuvées par utilisatrice
      return (
        identities.verifyIdentity(writerIdentity) && (await estAutorisé(id))
      );
    };

    const grant = async (
      rôle: (typeof rôles)[number],
      id: string,
    ): Promise<void> => {
      if (!rôles.includes(rôle)) {
        throw new Error(`Erreur: Le rôle ${rôle} n'existe pas.`);
      }
      if (gestRôles._rôles[rôle].includes(id)) {
        return;
      }
      try {
        const entry: élémentBdAccès = { rôle, id };
        await bd.add(entry);
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

    const revoke = async (
      _rôle: (typeof rôles)[number],
      _id: string,
    ): Promise<void> => {
      throw new Error(
        "C'est très difficile à implémenter...avez-vous des idées ?",
      );
    };

    const close = async () => {
      await fOublierSuiviBdAccès();
      await fOublierBd();

      await gestRôles.fermer();
    };

    const drop = async () => {
      await bd.drop();
    };

    const suivreUtilisateursAutorisés = async (
      f: schémaFonctionSuivi<infoUtilisateur[]>,
    ): Promise<schémaFonctionOublier> => {
      const fFinale = async () => {
        const mods: infoUtilisateur[] = Object.keys(
          gestRôles._rôlesUtilisateurs[MODÉRATEUR],
        ).map((m) => {
          return {
            idCompte: m,
            rôle: MODÉRATEUR,
          };
        });
        const idsMods = mods.map((m) => m.idCompte);
        const membres: infoUtilisateur[] = Object.keys(
          gestRôles._rôlesUtilisateurs[MEMBRE],
        )
          .map((m) => {
            return {
              idCompte: m,
              rôle: MEMBRE,
            } as infoUtilisateur;
          })
          .filter((m) => !idsMods.includes(m.idCompte));

        const utilisateurs: infoUtilisateur[] = [...mods, ...membres];
        await f(utilisateurs);
      };
      gestRôles.on("misÀJour", fFinale);
      await fFinale();
      const fOublier = async () => {
        gestRôles.off("misÀJour", fFinale);
      };
      return fOublier;
    };

    const suivreIdsOrbiteAutoriséesÉcriture = async (
      f: schémaFonctionSuivi<string[]>,
    ): Promise<schémaFonctionOublier> => {
      const fFinale = async () => {
        await f([...gestRôles._rôles.MEMBRE, ...gestRôles._rôles.MODÉRATEUR]);
      };
      gestRôles.on("misÀJour", fFinale);
      await fFinale();
      const fOublier = async () => {
        gestRôles.off("misÀJour", fFinale);
      };
      return fOublier;
    };

    return {
      type: nomType,
      address,
      adresseBdAccès,
      write,
      grant,
      revoke,
      canAppend,
      close,
      drop,
      suivreUtilisateursAutorisés,
      suivreIdsOrbiteAutoriséesÉcriture,
      gestRôles,
      estAutorisé,
      estUnMembre,
      estUnModérateur,
      bd,
    };
  };

ContrôleurConstellation.type = nomType;
export default ContrôleurConstellation;
