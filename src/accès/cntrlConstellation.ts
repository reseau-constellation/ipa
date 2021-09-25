import ensureAddress from "orbit-db-access-controllers/src/utils/ensure-ac-address";

import OrbitDB, {
  FeedStore,
  isValidAddress,
  entréeBD,
  identityProvider,
} from "orbit-db";
import AccessController from "orbit-db-access-controllers/src/access-controller-interface";
import { v4 as uuidv4 } from "uuid";

import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  élémentBdListe,
} from "../client";
import GestionnaireAccès, { suivreBdAccès } from "./gestionnaireUtilisateurs";
import accesseurBdOrbite from "./accesseurBdOrbite";
import { MODÉRATEUR, MEMBRE, rôles } from "./consts";
import { entréeBDAccès, infoUtilisateur } from "./types";

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

export const nomType = "controlleur-constellation";

export interface OptionsContrôleurConstellation {
  premierMod?: string;
  adresseBd?: string;
  nom?: string;
}

interface OptionsInitContrôleurConstellation
  extends OptionsContrôleurConstellation {
  premierMod: string;
  nom: string;
}

export default class ContrôleurConstellation extends AccessController {
  bd?: FeedStore;
  nom: string;
  _orbitdb: OrbitDB;
  _premierMod: string;
  adresseBd?: string;
  idRequète: string;
  gestRôles: GestionnaireAccès;

  constructor(orbitdb: OrbitDB, options: OptionsInitContrôleurConstellation) {
    super();
    this._orbitdb = orbitdb;
    this._premierMod = options.premierMod;
    this.adresseBd = options.adresseBd;
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
    return this.bd!.address;
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
    const fFinale = () => {
      const mods: infoUtilisateur[] = Object.keys(
        this.gestRôles._rôlesUtilisateurs[MODÉRATEUR]
      ).map((m) => {
        return {
          idBdRacine: m,
          rôle: MODÉRATEUR,
        };
      });
      const idsMods = mods.map((m) => m.idBdRacine);
      const membres: infoUtilisateur[] = Object.keys(
        this.gestRôles._rôlesUtilisateurs[MEMBRE]
      )
        .map((m) => {
          return {
            idBdRacine: m,
            rôle: MEMBRE,
          } as infoUtilisateur;
        })
        .filter((m) => !idsMods.includes(m.idBdRacine));

      const utilisateurs: infoUtilisateur[] = [...mods, ...membres];
      f(utilisateurs);
    };
    this.gestRôles.on("misÀJour", fFinale);
    fFinale();
    const fOublier = () => {
      this.gestRôles.off("misÀJour", fFinale);
    };
    return fOublier;
  }

  async suivreIdsOrbiteAutoriséesÉcriture(
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    const fFinale = () => {
      f([...this.gestRôles._rôles.MEMBRE, ...this.gestRôles._rôles.MODÉRATEUR]);
    };
    this.gestRôles.on("misÀJour", fFinale);
    fFinale();
    const fOublier = () => {
      this.gestRôles.off("misÀJour", fFinale);
    };
    return fOublier;
  }

  async canAppend(
    entry: entréeBD<entréeBDAccès>,
    identityProvider: identityProvider
  ): Promise<boolean> {
    const vraiSiSigValide = async () =>
      await identityProvider.verifyIdentity(entry.identity);

    const estAutorisé = await this.estAutorisé(entry.identity.id);

    if (estAutorisé) {
      return await vraiSiSigValide();
    }
    return false;
  }

  async _miseÀJourBdAccès(): Promise<void> {
    let éléments: entréeBDAccès[] = this.bd!.iterator({ limit: -1 })
      .collect()
      .map((x: élémentBdListe<entréeBDAccès>) => x.payload.value);

    éléments = [{ rôle: MODÉRATEUR, id: this._premierMod }, ...éléments];

    await this.gestRôles.ajouterÉléments(éléments);
  }

  async close(): Promise<void> {
    await accesseurBdOrbite.fermerBd(
      this._orbitdb,
      this.bd!.id,
      this.idRequète
    );
    await this.gestRôles.fermer();
  }

  async load(address: string): Promise<void> {
    const addresseValide = isValidAddress(address);

    let adresseFinale;
    if (addresseValide) {
      adresseFinale = address;
    } else {
      adresseFinale = this._orbitdb.determineAddress(
        ensureAddress(address),
        "feed",
        this._createOrbitOpts(addresseValide)
      );
    }

    this.bd = (await accesseurBdOrbite.ouvrirBd(
      this._orbitdb,
      adresseFinale,
      this.idRequète
    )) as FeedStore;

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
      this.adresseBd ||
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

  async grant(rôle: typeof rôles[number], id: string): Promise<void> {
    if (!rôles.includes(rôle)) {
      throw new Error(`Erreur: Le rôle ${rôle} n'existe pas.`);
    }
    if (this.gestRôles._rôles[rôle].includes(id)) {
      return;
    }
    try {
      const entry: entréeBDAccès = { rôle, id };

      await this.bd!.add(entry);
      await this._miseÀJourBdAccès();
    } catch (_e) {
      const e = _e as Error;
      if (e.toString().includes("not append entry"))
        throw new Error(
          `Erreur : Le rôle ${rôle} ne peut pas être octroyé à ${id}.`
        );
      throw e;
    }
  }

  async revoke(rôle: typeof rôles[number], id: string): Promise<void> {
    const élément = this.bd!.iterator({ limit: -1 })
      .collect()
      .find(
        (e: élémentBdListe<entréeBDAccès>) =>
          e.payload.value.rôle === rôle && e.payload.value.id === id
      );
    if (!élément)
      throw new Error(`Erreur : Le rôle ${rôle} n'existait pas pour ${id}.`);
    const empreinte = élément.hash;
    await this.bd!.remove(empreinte);
    await this._miseÀJourBdAccès();
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
