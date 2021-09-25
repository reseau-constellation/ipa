import OrbitDB, { FeedStore, isValidAddress } from "orbit-db";
import { EventEmitter, once } from "events";
import { v4 as uuidv4 } from "uuid";

import accesseurBdOrbite from "./accesseurBdOrbite";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  élémentBdListe,
} from "../client";
import { MODÉRATEUR, MEMBRE, rôles } from "./consts";
import { entréeBDAccès, objRôles } from "./types";

import ContrôleurConstellation from "./cntrlConstellation";

const événementsSuiviBd = ["ready", "write", "replicated"];

export const suivreBdAccès = async (
  bd: FeedStore,
  f: schémaFonctionSuivi<entréeBDAccès[]>
): Promise<schémaFonctionOublier> => {
  const fFinale = () => {
    const éléments: entréeBDAccès[] = bd
      .iterator({ limit: -1 })
      .collect()
      .map((e: élémentBdListe<entréeBDAccès>) => e.payload.value);
    f(éléments);
  };

  bd.events.setMaxListeners(100);
  for (const é of événementsSuiviBd) {
    bd.events.on(é, fFinale);
  }
  fFinale();
  const oublier = () => {
    événementsSuiviBd.forEach((é) => {
      bd.events.off(é, fFinale);
    });
  };
  return oublier;
};

class AccèsUtilisateur extends EventEmitter {
  orbite: OrbitDB;
  idBd: string;
  bd?: FeedStore;
  idBdAccès?: string;
  bdAccès?: FeedStore;
  oublierSuivi?: schémaFonctionOublier;
  autorisés: string[];
  accès?: ContrôleurConstellation;
  idRequète: string;
  prêt: boolean;

  constructor(orbite: OrbitDB, idBd: string) {
    super();
    this.orbite = orbite;
    this.idBd = idBd;

    this.autorisés = [];
    this.idRequète = uuidv4();
    this.prêt = false;
  }

  async initialiser(): Promise<void> {
    this.bd = (await accesseurBdOrbite.ouvrirBd(
      this.orbite,
      this.idBd,
      this.idRequète
    )) as FeedStore;

    this.accès = this.bd.access as unknown as ContrôleurConstellation;
    this.bdAccès = this.accès.bd!;
    this.idBdAccès = this.bdAccès.id;

    this.oublierSuivi = await suivreBdAccès(
      this.bdAccès,
      async (éléments: entréeBDAccès[]) => {
        await this._miseÀJour(éléments);
      }
    );
    this.prêt = true;
  }

  async _miseÀJour(éléments: entréeBDAccès[]) {
    const autorisés: string[] = [];
    éléments = [
      {
        id: this.accès!._premierMod,
        rôle: MODÉRATEUR,
      },
      ...éléments,
    ];
    éléments.forEach((é) => {
      autorisés.push(é.id);
    });
    this.autorisés = autorisés;
    this.emit("misÀJour");
  }

  async fermer() {
    if (this.oublierSuivi) this.oublierSuivi();
    if (this.prêt)
      await accesseurBdOrbite.fermerBd(this.orbite, this.idBd, this.idRequète);
  }
}

export default class GestionnaireAccès extends EventEmitter {
  _rôles: objRôles;
  _rôlesIdOrbite: objRôles;
  _rôlesUtilisateurs: {
    [key in typeof rôles[number]]: {
      [key: string]: AccèsUtilisateur;
    };
  };
  _miseÀJourEnCours: boolean;
  orbite: OrbitDB;

  constructor(orbite: OrbitDB) {
    super();
    this._rôles = { [MODÉRATEUR]: [], [MEMBRE]: [] };
    this._rôlesIdOrbite = { [MODÉRATEUR]: [], [MEMBRE]: [] };
    this._rôlesUtilisateurs = { [MODÉRATEUR]: {}, [MEMBRE]: {} };

    this._miseÀJourEnCours = false;
    this.orbite = orbite;
  }

  async estUnMembre(id: string): Promise<boolean> {
    if (this._miseÀJourEnCours) await once(this, "misÀJour");
    return this._rôles[MEMBRE].includes(id);
  }

  async estUnModérateur(id: string): Promise<boolean> {
    if (this._miseÀJourEnCours) await once(this, "misÀJour");
    return this._rôles[MODÉRATEUR].includes(id);
  }

  async estAutorisé(id: string): Promise<boolean> {
    return (await this.estUnModérateur(id)) || (await this.estUnMembre(id));
  }

  async ajouterÉléments(éléments: entréeBDAccès[]): Promise<void> {
    this._miseÀJourEnCours = true;
    await Promise.all(
      éléments.map(async (élément) => {
        const { rôle, id } = élément;

        if (isValidAddress(id)) {
          if (!this._rôlesUtilisateurs[rôle][id]) {
            const objAccèsUtilisateur = new AccèsUtilisateur(this.orbite, id);
            objAccèsUtilisateur.on("misÀJour", () => this._mettreRôlesÀJour());
            this._rôlesUtilisateurs[rôle][id] = objAccèsUtilisateur;
            await objAccèsUtilisateur.initialiser();
          }
        } else {
          if (!this._rôlesIdOrbite[rôle].includes(id)) {
            this._rôlesIdOrbite[rôle].push(id);
            this._mettreRôlesÀJour();
          }
        }
      })
    );

    this._miseÀJourEnCours = false;
    this._mettreRôlesÀJour();
    this.emit("misÀJour");
  }

  _mettreRôlesÀJour(): void {
    const _rôles: objRôles = { MODÉRATEUR: [], MEMBRE: [] };

    for (const [rôle, ids] of Object.entries(this._rôlesIdOrbite)) {
      const listeRôle = _rôles[rôle as keyof objRôles];
      ids.forEach((id) => {
        if (!listeRôle.includes(id)) listeRôle.push(id);
      });
    }

    for (const [rôle, utl] of Object.entries(this._rôlesUtilisateurs)) {
      const listeRôle = _rôles[rôle as keyof objRôles];
      Object.values(utl).forEach((u) => {
        u.autorisés.forEach((id) => {
          if (!listeRôle.includes(id)) listeRôle.push(id);
        });
      });
    }

    this._rôles = _rôles;
  }

  async fermer(): Promise<void> {
    const utilisateurs = Object.values(this._rôlesUtilisateurs)
      .map((l) => Object.values(l))
      .flat();
    await Promise.all(utilisateurs.map((u) => u.fermer()));
  }
}
