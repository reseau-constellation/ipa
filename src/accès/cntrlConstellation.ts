import * as dagCbor from "@ipld/dag-cbor";
import {
  ComposedStorage,
  IdentitiesType,
  IPFSBlockStorage,
  LogEntry,
  LRUStorage,
  Storage,
} from "@orbitdb/core";
import { base58btc } from "multiformats/bases/base58";
import * as Block from "multiformats/block";
import { sha256 } from "multiformats/hashes/sha2";
import { v4 as uuidv4 } from "uuid";

import { TypedSet } from "@constl/bohr-db";
import { JSONSchemaType } from "ajv";
import {
  GestionnaireAccès,
  suivreBdAccès,
} from "@/accès/gestionnaireUtilisateurs.js";
import { MEMBRE, MODÉRATEUR, rôles } from "@/accès/consts.js";
import { gestionnaireOrbiteGénéral } from "@/orbite.js";
import { ContrôleurAccès } from "./cntrlMod.js";
import { pathJoin } from "./utils.js";
import type { OrbitDB, DagCborEncodable } from "@orbitdb/core";
import type { schémaFonctionOublier, schémaFonctionSuivi } from "@/types.js";

import type { infoUtilisateur, élémentBdAccès } from "@/accès/types.js";

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

export const schémaBdAccès: JSONSchemaType<élémentBdAccès> = {
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
    identities: IdentitiesType;
    address?: string;
  }) => {
    write ??= orbitdb.identity.id;
    
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

    let bd: TypedSet<élémentBdAccès>;
    let fOublierBd: schémaFonctionOublier;

    if (write?.startsWith("/contrôleur-constellation/") && !address) {
      address = write
    }

    if (address) {
      const manifestBytes = await storage.get(
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
        type: "set",
        schéma: schémaBdAccès,
      }));
    } else {
      ({ bd, fOublier: fOublierBd } = await gestionnaireOrbite.ouvrirBdTypée({
        id: nom, // Je pense qu'on peut faire ça, tant que le nom reste unique...
        type: "set",
        schéma: schémaBdAccès,
        options: {
          AccessController: ContrôleurAccès({ write, storage })
        },
      }));
      adresseBdAccès = bd.address;
      address = await ManifestContrôleurConstellation({
        storage,
        type: nomType,
        params: { write, nom, adresseBdAccès },
      });
      address = pathJoin("/", nomType, address);
    }

    const gestRôles = new GestionnaireAccès(orbitdb);

    const fOublierSuiviBdAccès = await suivreBdAccès(
      bd, 
      async (éléments) => {
        éléments = [{ rôle: MODÉRATEUR, id: write! }, ...éléments];
        await gestRôles.ajouterÉléments(éléments);
      }
    );

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
      entry: LogEntry<DagCborEncodable>,
    ): Promise<boolean> => {
      const writerIdentity = await identities.getIdentity(entry.identity);
      if (!writerIdentity) {
        return false;
      }

      const { id } = writerIdentity;

      // Pour implémenter la révocation des permissions, garder compte ici
      // des entrées approuvées par utilisatrice
      return (
        (await identities.verifyIdentity(writerIdentity)) &&
        (await estAutorisé(id))
      );
    };

    const grant = async (
      rôle: (typeof rôles)[number],
      id: string,
    ): Promise<void> => {
      if (!rôles.includes(rôle)) {
        throw new Error(`Erreur: Le rôle ${rôle} n'existe pas.`);
      }
      if (gestRôles._rôles[rôle].has(id)) {
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
      // Désactivé pour l'instant. Si nous avons plus qu'une bd qui partage le même contrôleur,
      // la destruction de la bd du contrôleur pourrait causer des ennuis.
      // await bd.drop();
    };

    const suivreUtilisateursAutorisés = async (
      f: schémaFonctionSuivi<infoUtilisateur[]>,
    ): Promise<schémaFonctionOublier> => {
      const fFinale = async () => {
        const utilisateurs: infoUtilisateur[] = Object.entries(
          gestRôles._accèsUtilisateur,
        ).filter(([_idCompte, accès]) => accès.rôles.size > 0).map(([idCompte, accès]) => {
          return {
            idCompte,
            rôle: accès.rôles.has(MODÉRATEUR) ? MODÉRATEUR : MEMBRE
          }
        });
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
      nom,
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
export { ContrôleurConstellation };
