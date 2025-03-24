import { once } from "events";
import { DatabaseEvents, isValidAddress, type OrbitDB } from "@orbitdb/core";

import { TypedSet } from "@constl/bohr-db";
import { TypedEmitter } from "tiny-typed-emitter";
import { MEMBRE, MODÉRATEUR } from "@/accès/consts.js";
import { GestionnaireOrbite, gestionnaireOrbiteGénéral } from "@/orbite.js";
import { appelerLorsque } from "@/utils.js";
import { ContrôleurConstellation as générerContrôleurConstellation } from "./cntrlConstellation.js";
import type { schémaFonctionOublier, schémaFonctionSuivi } from "@/types.js";

import type { objRôles, élémentBdAccès } from "@/accès/types.js";

type ContrôleurConstellation = Awaited<
  ReturnType<ReturnType<typeof générerContrôleurConstellation>>
>;

export const suivreBdAccès = async (
  bd: TypedSet<élémentBdAccès>,
  f: schémaFonctionSuivi<élémentBdAccès[]>,
): Promise<schémaFonctionOublier> => {
  const fFinale = async () => {
    const éléments = await bd.all();

    await f(éléments.map((é) => é.value));
  };

  bd.events.setMaxListeners(100);
  const oublier = appelerLorsque({
    émetteur: bd.events as TypedEmitter<DatabaseEvents>,
    événement: "update",
    f: fFinale,
  });
  await fFinale();
  return oublier;
};

type ÉvénementsAccèsUtilisateur = {
  initialisé: (args: { accès: ContrôleurConstellation }) => void;
};

class AccèsUtilisateur {
  orbite: GestionnaireOrbite;
  idBd: string;

  accès?: ContrôleurConstellation;
  fOublierBd?: schémaFonctionOublier;
  oublierSuivi?: schémaFonctionOublier;
  signaleurArrêt: AbortController;
  événements: TypedEmitter<ÉvénementsAccèsUtilisateur>;

  constructor(orbite: OrbitDB, idBd: string) {
    this.orbite = gestionnaireOrbiteGénéral.obtGestionnaireOrbite({ orbite });
    this.idBd = idBd;

    this.événements = new TypedEmitter<ÉvénementsAccèsUtilisateur>();
    this.signaleurArrêt = new AbortController();
    this.initialiser();
  }

  async initialiser(): Promise<void> {
    const { bd, fOublier } = await this.orbite.ouvrirBd({
      id: this.idBd,
      signal: this.signaleurArrêt.signal,
    });
    this.fOublierBd = fOublier;

    const accès = bd.access as ContrôleurConstellation;

    this.accès = accès;
    this.événements.emit("initialisé", { accès });
  }

  async initialisé(): Promise<{ accès: ContrôleurConstellation }> {
    if (this.accès) return { accès: this.accès };
    return new Promise((résoudre) =>
      this.événements.once("initialisé", résoudre),
    );
  }

  async suivreAccès({
    f,
  }: {
    f: schémaFonctionSuivi<{ autorisés: string[] }>;
  }): Promise<schémaFonctionOublier> {
    const { accès } = await this.initialisé();
    // await f({autorisés: [accès.write]});
    return await suivreBdAccès(accès.bd, async (éléments) => {
      return await f({
        autorisés: [accès.write, ...éléments.map((é) => é.id)],
      });
    });
  }

  async fermer() {
    this.signaleurArrêt.abort();
    if (this.oublierSuivi) await this.oublierSuivi();
    await this.fOublierBd?.();
  }
}

export class GestionnaireAccès extends TypedEmitter<{ misÀJour: () => void }> {
  _rôles: objRôles;
  _rôlesIdOrbite: objRôles;
  _rôlesUtilisateurs: {
    [idCompte: string]: string[];
  };
  _accèsUtilisateur: {
    [idCompte: string]: {
      accès: AccèsUtilisateur;
      rôles: Set<string>;
    };
  };
  fsOublier: schémaFonctionOublier[];

  _miseÀJourEnCours: boolean;
  orbite: OrbitDB;

  constructor(orbite: OrbitDB) {
    super();
    this.setMaxListeners(100);

    this._rôles = {
      [MODÉRATEUR]: new Set<string>(),
      [MEMBRE]: new Set<string>(),
    };
    this._rôlesIdOrbite = {
      [MODÉRATEUR]: new Set<string>(),
      [MEMBRE]: new Set<string>(),
    };
    this._rôlesUtilisateurs = {};
    this._accèsUtilisateur = {};

    this._miseÀJourEnCours = false;
    this.fsOublier = [];
    this.orbite = orbite;
  }

  async àJour(): Promise<void> {
    if (this._miseÀJourEnCours) await once(this, "misÀJour");
  }

  async estUnMembre(id: string): Promise<boolean> {
    await this.àJour();
    return this._rôles[MEMBRE].has(id);
  }

  async estUnModérateur(id: string): Promise<boolean> {
    await this.àJour();
    return this._rôles[MODÉRATEUR].has(id);
  }

  async estAutorisé(id: string): Promise<boolean> {
    return (await this.estUnModérateur(id)) || (await this.estUnMembre(id));
  }

  async ajouterÉléments(éléments: élémentBdAccès[]): Promise<void> {
    this._miseÀJourEnCours = true;

    await Promise.allSettled(
      éléments.map(async (élément) => {
        const { rôle, id } = élément;
        if (isValidAddress(id)) {
          if (this._accèsUtilisateur[id]) {
            this._accèsUtilisateur[id].rôles.add(rôle);
          } else {
            const accèsUtilisateur = new AccèsUtilisateur(this.orbite, id);
            this._accèsUtilisateur[id] = {
              accès: accèsUtilisateur,
              rôles: new Set([rôle]),
            };
            const fOublierAccèsUtilisateur = await accèsUtilisateur.suivreAccès(
              {
                f: ({ autorisés }) => {
                  this._rôlesUtilisateurs[id] = autorisés;
                  this._mettreRôlesÀJour();
                },
              },
            );
            this.fsOublier.push(fOublierAccèsUtilisateur);
          }
        } else {
          this._rôlesIdOrbite[rôle].add(id);
          this._mettreRôlesÀJour();
        }
      }),
    );

    this._mettreRôlesÀJour();
    this._miseÀJourEnCours = false;
    this.emit("misÀJour");
  }

  _mettreRôlesÀJour(): void {
    const _rôles: objRôles = {
      MODÉRATEUR: new Set<string>(),
      MEMBRE: new Set<string>(),
    };
    for (const [rôle, ids] of Object.entries(this._rôlesIdOrbite)) {
      const ensembleRôle = _rôles[rôle as keyof objRôles];
      ids.forEach((id) => {
        ensembleRôle.add(id);
      });
    }

    for (const [idCompte, idsDispositifs] of Object.entries(
      this._rôlesUtilisateurs,
    )) {
      for (const rôle of this._accèsUtilisateur[idCompte].rôles.values()) {
        const ensembleRôle = _rôles[rôle as keyof objRôles];
        idsDispositifs.forEach((id) => {
          ensembleRôle.add(id);
        });
      }
    }
    this._rôles = _rôles;
  }

  async fermer(): Promise<void> {
    await Promise.allSettled(this.fsOublier.map((f) => f()));
  }
}
