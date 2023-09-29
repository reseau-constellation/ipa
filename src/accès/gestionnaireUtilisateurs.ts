import { isValidAddress, type OrbitDB } from "@orbitdb/core";
import { EventEmitter, once } from "events";
import { v4 as uuidv4 } from "uuid";

import type { schémaFonctionSuivi, schémaFonctionOublier } from "@/types.js";

import { MODÉRATEUR, MEMBRE, rôles } from "@/accès/consts.js";
import type { élémentBdAccès, objRôles } from "@/accès/types.js";

import type générerContrôleurConstellation from "./cntrlConstellation.js";
import {
  FeedStoreTypé,
  GestionnaireOrbite,
  gestionnaireOrbiteGénéral,
} from "@/orbite.js";

type ContrôleurConstellation = Awaited<
  ReturnType<ReturnType<typeof générerContrôleurConstellation>>
>;

export const suivreBdAccès = async (
  bd: FeedStoreTypé<élémentBdAccès>,
  f: schémaFonctionSuivi<élémentBdAccès[]>
): Promise<schémaFonctionOublier> => {
  const fFinale = async () => {
    const éléments = await bd.all();

    await f(éléments.map((é) => é.value));
  };

  bd.events.setMaxListeners(100);
  bd.events.on("update", fFinale);
  await fFinale();
  const oublier = async () => {
    bd.events.off("update", fFinale);
  };
  return oublier;
};

class AccèsUtilisateur extends EventEmitter {
  orbite: GestionnaireOrbite;
  idBd: string;

  idBdAccès?: string;
  bdAccès?: FeedStoreTypé<élémentBdAccès>;
  fOublierBd?: schémaFonctionOublier;
  oublierSuivi?: schémaFonctionOublier;
  autorisés: string[];
  accès?: ContrôleurConstellation;
  idRequète: string;
  prêt: boolean;

  constructor(orbite: OrbitDB, idBd: string) {
    super();
    this.orbite = gestionnaireOrbiteGénéral.obtGestionnaireOrbite({ orbite });
    this.idBd = idBd;

    this.autorisés = [];
    this.idRequète = uuidv4();
    this.prêt = false;
  }

  async initialiser(): Promise<void> {
    const { bd, fOublier } = await this.orbite.ouvrirBd({ id: this.idBd });
    this.fOublierBd = fOublier;

    this.accès = bd.access as ContrôleurConstellation;
    this.bdAccès = this.accès.bd!;
    this.idBdAccès = this.bdAccès?.address;

    await this._miseÀJour([]);
    this.oublierSuivi = await suivreBdAccès(this.bdAccès, async (éléments) => {
      await this._miseÀJour(éléments);
    });

    this.prêt = true;
  }

  async _miseÀJour(éléments: élémentBdAccès[]) {
    const autorisés: string[] = [];
    éléments = [
      {
        id: this.accès!.write!,
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
    if (this.oublierSuivi) await this.oublierSuivi();
    await this.fOublierBd?.();
  }
}

export default class GestionnaireAccès extends EventEmitter {
  _rôles: objRôles;
  _rôlesIdOrbite: objRôles;
  _rôlesUtilisateurs: {
    [key in (typeof rôles)[number]]: {
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

  async ajouterÉléments(éléments: élémentBdAccès[]): Promise<void> {
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
