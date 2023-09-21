import AccessControllers from "orbit-db-access-controllers";

import {isValidAddress, type OrbitDB} from "@orbitdb/core";
import type FeedStore from "orbit-db-feedstore";
import type { IdentityProvider } from "orbit-db-identity-provider";
import { v4 as uuidv4 } from "uuid";

import type { schémaFonctionSuivi, schémaFonctionOublier } from "@/types.js";
import GestionnaireAccès, {
  suivreBdAccès,
} from "@/accès/gestionnaireUtilisateurs.js";

import { MODÉRATEUR, MEMBRE, rôles } from "@/accès/consts.js";
import type { élémentBdAccès, infoUtilisateur } from "@/accès/types.js";
import path from "path";
import { GestionnaireOrbite, gestionnaireOrbiteGénéral } from "@/orbite.js";

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

const ensureAddress = (address: string) => {
  const suffix = address.toString().split("/").pop();
  return suffix === "_access" ? address : path.join(address, "/_access");
};

export const nomType = "controlleur-constellation";

export interface OptionsContrôleurConstellation {
  premierMod?: string;
  address?: string;
  nom?: string;
}

interface OptionsInitContrôleurConstellation
  extends OptionsContrôleurConstellation {
  premierMod: string;
  nom: string;
}

const ContrôleurConstellation = ({}: {}) => async ({ orbitdb: OrbitDB, identities, address, name }) => {
  const canAppend = async (entry) => {

  }
  
  return {
    type: nomType,
    address,
    write,
    canAppend
  }
}

ContrôleurConstellation.type = nomType;
export default ContrôleurConstellation;

class ContrôleurConstellation_ extends AccessControllers.AccessController {
  bd?: FeedStore<élémentBdAccès>;
  _gestionnaireOrbite: GestionnaireOrbite;
  fOublierBd?: schémaFonctionOublier;
  nom: string;
  _orbitdb: OrbitDB;
  _premierMod: string;
  _adresseBd?: string;
  idRequète: string;
  gestRôles: GestionnaireAccès;

  constructor(orbitdb: OrbitDB, options: OptionsInitContrôleurConstellation) {
    super();
    this._orbitdb = orbitdb;
    this._gestionnaireOrbite = gestionnaireOrbiteGénéral.obtGestionnaireOrbite({
      orbite: orbitdb,
    });

    this._premierMod = options.premierMod;
    this._adresseBd = options.address;
    this.nom = options.nom;

    this.idRequète = uuidv4();
    this.gestRôles = new GestionnaireAccès(this._orbitdb);
    this.gestRôles.on("misÀJour", () => this.emit("misÀJour"));
  }

  static get type(): string {
    return nomType;
  }

  // return address of AC (in this case orbitdb address of AC)
  get address(): string {
    return this.bd!.id;
  }

  async estUnMembre(id: string): Promise<boolean> {
    return await this.gestRôles.estUnMembre(id);
  }

  async estUnModérateur(id: string): Promise<boolean> {
    return await this.gestRôles.estUnModérateur(id);
  }

  async estAutorisé(id: string): Promise<boolean> {
    return await this.gestRôles.estAutorisé(id);
  }

  async suivreUtilisateursAutorisés(
    f: schémaFonctionSuivi<infoUtilisateur[]>
  ): Promise<schémaFonctionOublier> {
    const fFinale = async () => {
      const mods: infoUtilisateur[] = Object.keys(
        this.gestRôles._rôlesUtilisateurs[MODÉRATEUR]
      ).map((m) => {
        return {
          idCompte: m,
          rôle: MODÉRATEUR,
        };
      });
      const idsMods = mods.map((m) => m.idCompte);
      const membres: infoUtilisateur[] = Object.keys(
        this.gestRôles._rôlesUtilisateurs[MEMBRE]
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
    this.gestRôles.on("misÀJour", fFinale);
    await fFinale();
    const fOublier = async () => {
      this.gestRôles.off("misÀJour", fFinale);
    };
    return fOublier;
  }

  async suivreIdsOrbiteAutoriséesÉcriture(
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    const fFinale = async () => {
      await f([
        ...this.gestRôles._rôles.MEMBRE,
        ...this.gestRôles._rôles.MODÉRATEUR,
      ]);
    };
    this.gestRôles.on("misÀJour", fFinale);
    await fFinale();
    const fOublier = async () => {
      this.gestRôles.off("misÀJour", fFinale);
    };
    return fOublier;
  }

  async canAppend(
    entry: LogEntry<élémentBdAccès>,
    identityProvider: typeof IdentityProvider
  ): Promise<boolean> {
    const vraiSiSigValide = async () =>
      await identityProvider.verifyIdentity(entry.identity);

    const estAutorisé = await this.estAutorisé(entry.identity.id);

    if (estAutorisé) {
      // Pour implémenter la révocation des permissions, garder compte ici
      // des entrées approuvées par utilisatrice
      return await vraiSiSigValide();
    }
    return false;
  }

  async _miseÀJourBdAccès(): Promise<void> {
    let éléments = this.bd!.iterator({ limit: -1 })
      .collect()
      .map((x: LogEntry<élémentBdAccès>) => x.payload.value);

    éléments = [{ rôle: MODÉRATEUR, id: this._premierMod }, ...éléments];

    await this.gestRôles.ajouterÉléments(éléments);
  }

  async close(): Promise<void> {
    await this.fOublierBd?.();

    await this.gestRôles.fermer();
  }

  async load(adresse: string): Promise<void> {
    const addresseValide = isValidAddress(adresse);

    let adresseFinale: string;
    if (addresseValide) {
      adresseFinale = adresse;
    } else {
      adresseFinale = (
        await this._orbitdb.determineAddress(
          ensureAddress(adresse),
          "feed",
          this._createOrbitOpts(addresseValide)
        )
      ).toString();
    }

    const { bd, fOublier } =
      await this._gestionnaireOrbite.ouvrirBd<élémentBdAccès>({
        id: adresseFinale,
        type: "feed",
      });
    this.bd = bd;
    this.fOublierBd = fOublier;

    suivreBdAccès(this.bd, () => this._miseÀJourBdAccès());
  }

  _createOrbitOpts(loadByAddress = false): {
    [key: string]: string | { [key: string]: string };
  } {
    const contrôleurAccès = {
      type: "controlleur-accès-constellation",
      premierMod: this._premierMod,
    };

    return loadByAddress ? {} : { accessController: contrôleurAccès };
  }

  async save(): Promise<{ [key: string]: string }> {
    const adresse =
      this._adresseBd ||
      (await this._orbitdb.determineAddress(
        `${this.nom}/_access`,
        "feed",
        this._createOrbitOpts()
      ));

    const manifest = {
      address: adresse.toString(),
      premierMod: this._premierMod,
      nom: this.nom,
    };
    return manifest;
  }

  async grant(rôle: (typeof rôles)[number], id: string): Promise<void> {
    if (!rôles.includes(rôle)) {
      throw new Error(`Erreur: Le rôle ${rôle} n'existe pas.`);
    }
    if (this.gestRôles._rôles[rôle].includes(id)) {
      return;
    }
    try {
      const entry: élémentBdAccès = { rôle, id };
      await this.bd!.add(entry);
    } catch (_e) {
      const e = _e as Error;
      if (e.toString().includes("not append entry")) {
        throw new Error(
          `Erreur : Le rôle ${rôle} ne peut pas être octroyé à ${id}.`
        );
      }
      throw e;
    }
  }

  async revoke(rôle: (typeof rôles)[number], id: string): Promise<void> {
    // Pour implémenter la révocation des permissions, ajouter une
    // mention des modifications déjà autorisées par la personne nouvellement
    // bloquée
    const élément = this.bd!.iterator({ limit: -1 })
      .collect()
      .find(
        (e: LogEntry<élémentBdAccès>) =>
          e.payload.value.rôle === rôle && e.payload.value.id === id
      );
    if (!élément) {
      throw new Error(`Erreur : Le rôle ${rôle} n'existait pas pour ${id}.`);
    }
    const empreinte = élément.hash;
    await this.bd!.remove(empreinte);
  }

  /* Factory */
  static async create(
    orbitdb: OrbitDB,
    options: OptionsContrôleurConstellation
  ): Promise<ContrôleurConstellation> {
    if (!options.premierMod) options.premierMod = orbitdb.identity.id;
    options.nom = options.nom || uuidv4();
    return new ContrôleurConstellation(
      orbitdb,
      options as OptionsInitContrôleurConstellation
    );
  }
}
