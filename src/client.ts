import { IPFS as SFIP } from "ipfs";
import { IDResult } from "ipfs-core-types/src/root";
import { ImportCandidate } from "ipfs-core-types/src/utils";
import deepEqual from "deep-equal";

import OrbitDB from "orbit-db";
import Store from "orbit-db-store";
import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";

import AccessController from "orbit-db-access-controllers/src/access-controller-interface";
import { EventEmitter, once } from "events";
import { v4 as uuidv4 } from "uuid";
import Semaphore from "@chriscdn/promise-semaphore";

import initOrbite from "@/orbitdb";
import initSFIP from "@/ipfs";
import Épingles from "@/épingles";
import Profil from "@/profil";
import BDs from "@/bds";
import Tableaux from "@/tableaux";
import Variables from "@/variables";
import Réseau from "@/réseau";
import Favoris from "@/favoris";
import Projets from "@/projets";
import MotsClefs from "@/motsClefs";
import Automatisations from "@/automatisation";

import {
  adresseOrbiteValide,
  schémaFonctionSuivi,
  schémaFonctionOublier,
  faisRien,
  uneFois,
  élémentsBd,
  toBuffer,
} from "@/utils";
import obtStockageLocal from "@/stockageLocal";
import ContrôleurConstellation, {
  OptionsContrôleurConstellation,
  nomType as nomTypeContrôleurConstellation,
} from "@/accès/cntrlConstellation";
import { objRôles, infoUtilisateur } from "@/accès/types";
import { MEMBRE, MODÉRATEUR, rôles } from "@/accès/consts";

type schémaFonctionRéduction<T, U> = (branches: T) => U;

export type infoAccès = {
  idBdCompte: string;
  rôle: keyof objRôles;
};

export interface Signature {
  signature: string;
  clefPublique: string;
}

const verrouOuvertureBd = new Semaphore();

export interface optsConstellation {
  compte?: string;
  sujetRéseau?: string;
  orbite?: optsOrbite;
}

type optsOrbite = OrbitDB | optsInitOrbite;

type optsInitOrbite = {
  dossier?: string;
  sfip?: optsInitSFIP;
};

type optsInitSFIP = {
  sfip?: SFIP;
  dossier?: string;
};

type bdOuverte<T extends Store> = { bd: T; idsRequètes: string[] };

type typeÉlémentsBdCompteClient = string;

export default class ClientConstellation extends EventEmitter {
  _opts: optsConstellation;
  optionsAccès?: { [key: string]: unknown };
  bdCompte?: KeyValueStore<typeÉlémentsBdCompteClient>;
  _bds: { [key: string]: bdOuverte<Store> };
  orbite?: OrbitDB;
  sfip?: SFIP;
  idNodeSFIP?: IDResult;
  épingles?: Épingles;
  profil?: Profil;
  bds?: BDs;
  tableaux?: Tableaux;
  variables?: Variables;
  réseau?: Réseau;
  favoris?: Favoris;
  projets?: Projets;
  motsClefs?: MotsClefs;
  automatisations?: Automatisations;
  _oublierNettoyageBdsOuvertes?: schémaFonctionOublier;

  prêt: boolean;
  idBdCompte?: string;
  sujet_réseau: string;

  constructor(opts: optsConstellation = {}) {
    super();
    this._opts = opts;

    this._bds = {};
    this.prêt = false;
    this.sujet_réseau = opts.sujetRéseau || "réseau-constellation";
  }

  async initialiser(): Promise<void> {
    const { sfip, orbite } = await this._générerSFIPetOrbite();
    this.sfip = sfip;
    this.orbite = orbite;

    this.idNodeSFIP = await this.sfip!.id();

    const optionsAccèsRacine = {
      type: "controlleur-constellation",
      premierMod: this.orbite!.identity.id,
      nom: "racine",
    };

    this.idBdCompte = this._opts.compte;
    if (!this.idBdCompte) {
      this.idBdCompte = await this.créerBdIndépendante(
        "kvstore",
        optionsAccèsRacine,
        "racine"
      );
    }
    this.épingles = new Épingles(this);
    this._oublierNettoyageBdsOuvertes = this._lancerNettoyageBdsOuvertes();

    await this.initialiserBds();

    this.prêt = true;
    this.emit("prêt");
  }

  async _générerSFIPetOrbite(): Promise<{ sfip: SFIP; orbite: OrbitDB }> {
    const { orbite } = this._opts;

    let sfipFinale: SFIP;
    let orbiteFinale: OrbitDB;

    const _générerSFIP = async (opts?: optsInitSFIP): Promise<SFIP> => {
      if (opts?.sfip) {
        return opts.sfip;
      } else {
        return await initSFIP(opts?.dossier);
      }
    };

    if (orbite) {
      if (orbite instanceof OrbitDB) {
        sfipFinale = orbite._ipfs;
        orbiteFinale = orbite;
      } else {
        sfipFinale = await _générerSFIP(orbite.sfip);
        orbiteFinale = await initOrbite(sfipFinale, orbite.dossier);
      }
    } else {
      sfipFinale = await _générerSFIP();
      orbiteFinale = await initOrbite(sfipFinale);
    }

    return { sfip: sfipFinale, orbite: orbiteFinale };
  }

  _lancerNettoyageBdsOuvertes(): schémaFonctionOublier {
    const fNettoyer = async () => {
      await Promise.all(
        Object.keys(this._bds).map(async (id) => {
          const { bd, idsRequètes } = this._bds[id];
          if (!idsRequètes.length) {
            delete this._bds[id];
            await bd.close();
          }
        })
      );
    };
    const i = setInterval(fNettoyer, 1000 * 60 * 5);
    return () => clearInterval(i);
  }

  async initialiserBds(): Promise<void> {
    const { bd } = await this.ouvrirBd<
      KeyValueStore<typeÉlémentsBdCompteClient>
    >(this.idBdCompte!);
    this.bdCompte = bd;

    const accès = this.bdCompte.access as unknown as ContrôleurConstellation;
    this.optionsAccès = {
      type: "controlleur-constellation",
      adresseBd: accès.bd!.id,
    };

    const idBdProfil = await this.obtIdBd("compte", this.bdCompte, "kvstore");
    this.profil = new Profil(this, idBdProfil!);

    const idBdBDs = await this.obtIdBd("bds", this.bdCompte, "feed");
    this.bds = new BDs(this, idBdBDs!);

    this.tableaux = new Tableaux(this);

    const idBdVariables = await this.obtIdBd(
      "variables",
      this.bdCompte,
      "feed"
    );
    this.variables = new Variables(this, idBdVariables!);

    const idBdRéseau = await this.obtIdBd("réseau", this.bdCompte, "kvstore");
    this.réseau = new Réseau(this, idBdRéseau!);
    await this.réseau.initialiser();

    const idBdFavoris = await this.obtIdBd("favoris", this.bdCompte, "kvstore");
    this.favoris = new Favoris(this, idBdFavoris!);

    const idBdProjets = await this.obtIdBd("projets", this.bdCompte, "feed");
    this.projets = new Projets(this, idBdProjets!);

    const idBdMotsClefs = await this.obtIdBd(
      "motsClefs",
      this.bdCompte,
      "feed"
    );
    this.motsClefs = new MotsClefs(this, idBdMotsClefs!);

    const idBdAuto = await this.obtIdBd(
      "automatisations",
      this.bdCompte,
      "feed"
    );
    this.automatisations = new Automatisations(this, idBdAuto!);
    await this.automatisations.initialiser();

    for (const idBd in [
      idBdProfil,
      idBdBDs,
      idBdVariables,
      idBdRéseau,
      idBdFavoris,
      idBdProjets,
      idBdMotsClefs,
      idBdAuto,
    ]) {
      this.épingles!.épinglerBd(idBd, false, false);
    }
  }

  async signer(message: string): Promise<Signature> {
    const id = this.orbite!.identity;
    const signature = await this.orbite!.identity.provider.sign(id, message);
    const clefPublique = this.orbite!.identity.publicKey;
    return { signature, clefPublique };
  }

  async vérifierSignature(
    signature: Signature,
    message: string
  ): Promise<boolean> {
    if (!signature || !signature.clefPublique || !signature.signature) {
      return false;
    }
    return await this.orbite!.identity.provider.verify(
      signature.signature,
      signature.clefPublique,
      message
    );
  }

  async suivreDispositifs(
    f: schémaFonctionSuivi<string[]>,
    idBdCompte?: string
  ): Promise<schémaFonctionOublier> {
    if (!this.bdCompte) await once(this, "prêt");
    idBdCompte = idBdCompte || this.bdCompte!.id;
    const { bd, fOublier } = await this.ouvrirBd(idBdCompte);
    const accès = bd.access;

    const typeAccès = (accès.constructor as unknown as AccessController).type;
    if (typeAccès === "ipfs") {
      f(accès.write);
      fOublier();
      return faisRien;
    } else if (typeAccès === "controlleur-constellation") {
      const fFinale = () => {
        const mods = (accès as unknown as ContrôleurConstellation).gestRôles
          ._rôles[MODÉRATEUR];
        f(mods);
      };
      accès.on("misÀJour", fFinale);
      fFinale();
      fOublier();
      return () => {
        accès.off("misÀJour", fFinale);
      };
    } else {
      fOublier();
      return faisRien;
    }
  }

  async ajouterDispositif(identité: string): Promise<void> {
    if (!this.bdCompte) await once(this, "prêt");
    const accès = this.bdCompte!.access as unknown as ContrôleurConstellation;
    accès.grant(MODÉRATEUR, identité);
  }

  async enleverDispositif(identité: string): Promise<void> {
    if (!this.bdCompte) await once(this, "prêt");
    const accès = this.bdCompte!.access as unknown as ContrôleurConstellation;
    await accès.revoke(MODÉRATEUR, identité);
  }

  async rejoindreCompte(idBdCompte: string): Promise<void> {
    if (!adresseOrbiteValide(idBdCompte)) {
      throw new Error(`Adresse compte ${idBdCompte} non valide`);
    }

    // Attendre de recevoir la permission d'écrire à idBdCompte
    let autorisé: boolean;
    const { bd, fOublier } = await this.ouvrirBd(idBdCompte);
    const accès = bd.access as ContrôleurConstellation;
    const oublierPermission = await accès.suivreIdsOrbiteAutoriséesÉcriture(
      (autorisés: string[]) =>
        (autorisé = autorisés.includes(this.orbite!.identity.id))
    );
    await new Promise<void>((résoudre) => {
      const x = setInterval(() => {
        if (autorisé) {
          oublierPermission();
          clearInterval(x);
          fOublier();
          résoudre();
        }
      }, 10);
    });

    // Là on peut y aller
    this.idBdCompte = idBdCompte;
    await this.initialiserBds();
    this.emit("compteChangé");
  }

  async donnerAccès(
    idBd: string,
    identité: string,
    rôle: keyof objRôles = MEMBRE
  ): Promise<void> {
    if (!adresseOrbiteValide(identité)) {
      throw new Error(`Identité ${identité} non valide.`);
    }

    const { bd, fOublier } = await this.ouvrirBd(idBd);
    const accès = bd.access;
    const typeAccès = (accès.constructor as unknown as AccessController).type;
    if (typeAccès === nomTypeContrôleurConstellation) {
      (accès as unknown as ContrôleurConstellation).grant(rôle, identité);
    }
    fOublier();
  }

  async suivreIdBdCompte(
    f: schémaFonctionSuivi<string>
  ): Promise<schémaFonctionOublier> {
    const fFinale = () => {
      if (this.idBdCompte) f(this.idBdCompte);
    };
    this.on("compteChangé", fFinale);
    fFinale();
    return () => this.off("compteChangé", fFinale);
  }

  async obtIdSFIP(): Promise<IDResult> {
    if (!this.idNodeSFIP) await once(this, "prêt");
    return this.idNodeSFIP!;
  }

  async obtIdOrbite(): Promise<string> {
    if (!this.orbite) await once(this, "prêt");
    return this.orbite!.identity.id;
  }

  async copierContenuBdListe<T extends élémentsBd = élémentsBd>(
    bdBase: KeyValueStore<string>,
    nouvelleBd: KeyValueStore<string>,
    clef: string
  ): Promise<void> {
    const idBdListeInit = bdBase.get(clef);
    if (typeof idBdListeInit !== "string") return;

    const { bd: bdListeInit, fOublier: fOublierInit } = await this.ouvrirBd<
      FeedStore<T>
    >(idBdListeInit);

    const idNouvelleBdListe = nouvelleBd.get(clef);
    if (!idNouvelleBdListe) throw "La nouvelle BD n'existait pas";

    const { bd: nouvelleBdListe, fOublier: fOublierNouvelle } =
      await this.ouvrirBd<FeedStore<T>>(idNouvelleBdListe);

    const données = ClientConstellation.obtÉlémentsDeBdListe(bdListeInit);
    await Promise.all(
      données.map(async (d) => {
        await nouvelleBdListe.add(d);
      })
    );
    fOublierInit();
    fOublierNouvelle();
  }

  async combinerBds<T extends élémentsBd = élémentsBd>(
    idBdBase: string,
    idBd2: string
  ): Promise<void> {
    const { bd: bdBase, fOublier: fOublierBase } = await this.ouvrirBd(
      idBdBase
    );
    const { bd: bd2, fOublier: fOublier2 } = await this.ouvrirBd(idBd2);
    if (bd2.type !== bdBase.type) {
      throw new Error("Les BDs doivent être du même type");
    }

    switch (bdBase.type) {
      case "keyvalue":
        await this.combinerBdsDict(
          bdBase as KeyValueStore<T>,
          bd2 as KeyValueStore<T>
        );
        break;

      case "feed":
        await this.combinerBdsListe(
          bdBase as FeedStore<T>,
          bd2 as FeedStore<T>
        );
        break;

      default:
        throw new Error(`Type de BD ${bdBase.type} non supporté.`);
    }

    fOublierBase();
    fOublier2();
  }

  async combinerBdsDict<T extends élémentsBd = élémentsBd>(
    bdBase: KeyValueStore<T>,
    bd2: KeyValueStore<T>
  ): Promise<void> {
    const contenuBd2 = ClientConstellation.obtObjetdeBdDic(bd2);

    for (const [c, v] of Object.entries(contenuBd2)) {
      const valBdBase = bdBase.get(c);
      if (valBdBase === v) {
        continue;
      } else if (valBdBase === undefined) {
        await bdBase.put(c, v as T);
      } else if (adresseOrbiteValide(valBdBase) && adresseOrbiteValide(v)) {
        await this.combinerBds(valBdBase as string, v as string);
      }
    }
  }

  async combinerBdsListe<T extends élémentsBd = élémentsBd>(
    bdBase: FeedStore<{ [key: string]: T }>,
    bd2: FeedStore<{ [key: string]: T }>,
    index: string[]
  ): Promise<void>;
  async combinerBdsListe<T extends élémentsBd = élémentsBd>(
    bdBase: FeedStore<T>,
    bd2: FeedStore<T>
  ): Promise<void>;
  async combinerBdsListe<T extends élémentsBd = élémentsBd>(
    bdBase: FeedStore<{ [key: string]: T }>,
    bd2: FeedStore<{ [key: string]: T }>,
    index?: string[]
  ): Promise<void> {
    const contenuBdBase = ClientConstellation.obtÉlémentsDeBdListe(
      bdBase,
      false
    );
    const contenuBd2 = ClientConstellation.obtÉlémentsDeBdListe(bd2, false);
    type élémentBdObjet = { [key: string]: T };

    for (const é of contenuBd2) {
      const valBd2 = é.payload.value;

      if (index) {
        if (typeof valBd2 !== "object") throw new Error();
        const existant = contenuBdBase.find(
          (x) =>
            typeof x.payload.value === "object" &&
            index.every(
              (i) =>
                (x as LogEntry<élémentBdObjet>).payload.value[i] ===
                (valBd2 as élémentBdObjet)[i]
            )
        );

        if (!existant) {
          // Si pas d'existant, ajouter le nouvel élément
          await bdBase.add(valBd2);
        } else {
          const valExistant = existant.payload.value;

          // Si existant, combiner et mettre à jour seulement si différents
          if (!deepEqual(valExistant, valBd2)) {
            const combiné = Object.assign({}, valExistant);
            for (const [c, v] of Object.entries(valBd2)) {
              if (combiné[c] === undefined) {
                combiné[c] = v;
              } else if (!deepEqual(combiné[c], v)) {
                if (adresseOrbiteValide(combiné[c]) && adresseOrbiteValide(v)) {
                  await this.combinerBds(combiné[c] as string, v as string);
                }
              }
            }
            await bdBase.remove(existant.hash);
            await bdBase.add(combiné);
          }
        }
      } else {
        if (!contenuBdBase.some((x) => deepEqual(x.payload.value, valBd2))) {
          await bdBase.add(valBd2);
        }
      }
    }
  }

  async suivreBd<T extends Store>(
    id: string,
    f: schémaFonctionSuivi<T>,
    événements: string[] = ["write", "replicated", "ready"]
  ): Promise<schémaFonctionOublier> {
    const { bd, fOublier } = await this.ouvrirBd<T>(id);

    const fFinale = () => f(bd);
    for (const é of événements) {
      bd.events.on(é, fFinale);
    }

    fFinale();
    const oublier = () => {
      événements.forEach((é) => {
        bd.events.off(é, fFinale);
      });
      fOublier();
    };
    return oublier;
  }

  async suivreBdDeFonction<T>(
    fRacine: (
      fSuivreRacine: (nouvelIdBdCible: string) => Promise<void>
    ) => Promise<schémaFonctionOublier>,
    f: schémaFonctionSuivi<T | undefined>,
    fSuivre: (
      id: string,
      fSuivreBd: schémaFonctionSuivi<T | undefined>
    ) => Promise<schémaFonctionOublier>
  ): Promise<schémaFonctionOublier> {
    let oublierFSuivre: schémaFonctionOublier | undefined;
    let idBdCible: string | undefined;
    let premièreFois = true;

    const oublierRacine = await fRacine(async (nouvelIdBdCible: string) => {
      if (nouvelIdBdCible === undefined && premièreFois) {
        premièreFois = false;
        f(undefined);
      }
      if (nouvelIdBdCible !== idBdCible) {
        idBdCible = nouvelIdBdCible;
        if (oublierFSuivre) oublierFSuivre();

        if (idBdCible) {
          oublierFSuivre = await fSuivre(idBdCible, f);
        } else {
          f(undefined);
          oublierFSuivre = undefined;
        }
      }
    });
    return () => {
      oublierRacine();
      if (oublierFSuivre) oublierFSuivre();
    };
  }

  async suivreBdDeClef<T>(
    id: string,
    clef: string,
    f: schémaFonctionSuivi<T | undefined>,
    fSuivre: (
      id: string,
      fSuivreBd: schémaFonctionSuivi<T>
    ) => Promise<schémaFonctionOublier>
  ): Promise<schémaFonctionOublier> {
    const fRacine = async (
      fSuivreRacine: (nouvelIdBdCible: string) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      const fSuivreBdRacine = async (bd: KeyValueStore<string>) => {
        const nouvelIdBdCible = bd.get(clef);
        fSuivreRacine(nouvelIdBdCible);
      };
      return await this.suivreBd(id, fSuivreBdRacine);
    };
    return await this.suivreBdDeFonction<T>(fRacine, f, fSuivre);
  }

  async suivreBdDic<T extends élémentsBd>(
    id: string,
    f: schémaFonctionSuivi<{ [key: string]: T }>
  ): Promise<schémaFonctionOublier> {
    const fFinale = async (bd: KeyValueStore<T>) => {
      const valeurs = bd ? ClientConstellation.obtObjetdeBdDic<T>(bd) : {};
      f(valeurs);
    };
    return await this.suivreBd(id, fFinale);
  }

  async suivreBdDicDeClef<T extends élémentsBd>(
    id: string,
    clef: string,
    f: schémaFonctionSuivi<{ [key: string]: T }>
  ): Promise<schémaFonctionOublier> {
    const fFinale = async (valeurs?: { [key: string]: T }) => {
      f(valeurs || {});
    };
    const fSuivre = async (
      id: string,
      fSuivreBd: schémaFonctionSuivi<{ [key: string]: T }>
    ) => {
      return await this.suivreBdDic(id, fSuivreBd);
    };
    return await this.suivreBdDeClef(id, clef, fFinale, fSuivre);
  }

  static obtObjetdeBdDic<T extends élémentsBd>(
    bd: KeyValueStore<T>
  ): { [key: string]: T } {
    const valeurs = bd.all;
    return Object.fromEntries(
      Object.keys(valeurs).map((x) => {
        return [x, valeurs[x]];
      })
    );
  }

  async suivreBdListeDeClef<T extends élémentsBd>(
    id: string,
    clef: string,
    f: schémaFonctionSuivi<T[]>,
    renvoyerValeur?: true
  ): Promise<schémaFonctionOublier>;

  async suivreBdListeDeClef<T extends élémentsBd>(
    id: string,
    clef: string,
    f: schémaFonctionSuivi<LogEntry<T>[]>,
    renvoyerValeur: false
  ): Promise<schémaFonctionOublier>;

  async suivreBdListeDeClef<T extends élémentsBd>(
    id: string,
    clef: string,
    f: schémaFonctionSuivi<T[]>,
    renvoyerValeur?: true
  ): Promise<schémaFonctionOublier>;
  async suivreBdListeDeClef<T extends élémentsBd>(
    id: string,
    clef: string,
    f: schémaFonctionSuivi<LogEntry<T>[]>,
    renvoyerValeur: false
  ): Promise<schémaFonctionOublier>;
  async suivreBdListeDeClef<T extends élémentsBd>(
    id: string,
    clef: string,
    f: schémaFonctionSuivi<T[] | LogEntry<T>[]>,
    renvoyerValeur?: boolean
  ): Promise<schémaFonctionOublier>;
  async suivreBdListeDeClef<T extends élémentsBd>(
    id: string,
    clef: string,
    f: schémaFonctionSuivi<T[] | LogEntry<T>[]>,
    renvoyerValeur = true
  ): Promise<schémaFonctionOublier> {
    // À faire : très laid en raison de contraintes Typescript...peut-être existe-il une meilleure façon ?
    if (renvoyerValeur) {
      const fFinale = async (valeurs?: T[]) => {
        f(valeurs || []);
      };
      const fSuivre = async (
        id: string,
        fSuivreBd: schémaFonctionSuivi<T[]>
      ) => {
        return await this.suivreBdListe(id, fSuivreBd, renvoyerValeur);
      };

      return await this.suivreBdDeClef(id, clef, fFinale, fSuivre);
    } else {
      const fFinale = async (valeurs?: LogEntry<T>[]) => {
        f(valeurs || []);
      };
      const fSuivre = async (
        id: string,
        fSuivreBd: schémaFonctionSuivi<LogEntry<T>[]>
      ) => {
        return await this.suivreBdListe(id, fSuivreBd, renvoyerValeur);
      };

      return await this.suivreBdDeClef(
        id,
        clef,
        fFinale as unknown as (
          x?: élémentsBd
        ) => Promise<schémaFonctionOublier>,
        fSuivre as unknown as (
          id: string,
          fSuivreBd: schémaFonctionSuivi<élémentsBd[]>
        ) => Promise<schémaFonctionOublier>
      );
    }
  }

  async suivreBdListe<T extends élémentsBd>(
    id: string,
    f: schémaFonctionSuivi<T[]>,
    renvoyerValeur?: true
  ): Promise<schémaFonctionOublier>;

  async suivreBdListe<T extends élémentsBd>(
    id: string,
    f: schémaFonctionSuivi<LogEntry<T>[]>,
    renvoyerValeur: false
  ): Promise<schémaFonctionOublier>;

  async suivreBdListe<T extends élémentsBd>(
    id: string,
    f: schémaFonctionSuivi<T[] | LogEntry<T>[]>,
    renvoyerValeur = true
  ): Promise<schémaFonctionOublier> {
    return await this.suivreBd(id, async (bd: FeedStore<T>) => {
      const éléments = ClientConstellation.obtÉlémentsDeBdListe(
        bd,
        renvoyerValeur
      );
      f(éléments);
    });
  }

  static obtÉlémentsDeBdListe<T extends élémentsBd>(
    bd: FeedStore<T>,
    renvoyerValeur?: true
  ): T[];

  static obtÉlémentsDeBdListe<T extends élémentsBd>(
    bd: FeedStore<T>,
    renvoyerValeur: false
  ): LogEntry<T>[];

  static obtÉlémentsDeBdListe<T extends élémentsBd>(
    bd: FeedStore<T>,
    renvoyerValeur?: boolean
  ): T[] | LogEntry<T>[];

  static obtÉlémentsDeBdListe<T extends élémentsBd>(
    bd: FeedStore<T>,
    renvoyerValeur = true
  ): T[] | LogEntry<T>[] {
    const éléments = bd.iterator({ limit: -1 }).collect();
    if (renvoyerValeur) {
      return éléments.map((e: LogEntry<T>) => e.payload.value);
    } else {
      return éléments;
    }
  }

  obtÉlémentBdListeSelonEmpreinte<T extends élémentsBd>(
    bd: FeedStore<T>,
    empreinte: string
  ): élémentsBd | undefined {
    const élément = bd
      .iterator({ limit: -1 })
      .collect()
      .find((e: LogEntry<T>) => e.hash === empreinte);
    return élément?.payload.value;
  }

  async effacerÉlémentDeBdListe<T extends élémentsBd>(
    bd: FeedStore<T>,
    élément: T | ((e: LogEntry<T>) => boolean)
  ): Promise<void> {
    const retrouvé = bd
      .iterator({ limit: -1 })
      .collect()
      .find((e: LogEntry<T>) =>
        typeof élément === "function"
          ? élément(e)
          : deepEqual(e.payload.value, élément)
      );

    if (retrouvé) await bd.remove(retrouvé.hash);
  }

  async suivreBdsDeBdListe<T extends élémentsBd, U, V>(
    id: string,
    f: schémaFonctionSuivi<V[]>,
    fBranche: (
      id: string,
      f: schémaFonctionSuivi<U>,
      branche: T
    ) => Promise<schémaFonctionOublier | undefined>,
    fIdBdDeBranche: (b: T) => string = (b) => b as string,
    fRéduction: schémaFonctionRéduction<U[], V[]> = (branches: U[]) =>
      [...new Set(branches.flat())] as unknown as V[],
    fCode: (é: T) => string = (é) => é as string
  ): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (éléments: T[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBdListe(id, fSuivreRacine);
    };
    return await this.suivreBdsDeFonctionListe(
      fListe,
      f,
      fBranche,
      fIdBdDeBranche,
      fRéduction,
      fCode
    );
  }

  async suivreBdsDeFonctionListe<T extends élémentsBd, U, V>(
    fListe: (
      fSuivreRacine: (éléments: T[]) => Promise<void>
    ) => Promise<schémaFonctionOublier>,
    f: schémaFonctionSuivi<V[]>,
    fBranche: (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<U>,
      branche: T
    ) => Promise<schémaFonctionOublier | undefined>,
    fIdBdDeBranche: (b: T) => string = (b) => b as string,
    fRéduction: schémaFonctionRéduction<U[], V[]> = (branches: U[]) =>
      [...new Set(branches.flat())] as unknown as V[],
    fCode: (é: T) => string = (é) => é as string
  ): Promise<schémaFonctionOublier> {
    interface InterfaceBranches {
      données?: U;
      fOublier?: schémaFonctionOublier;
    }
    const arbre: { [key: string]: InterfaceBranches } = {};
    const dictBranches: { [key: string]: T } = {};

    let prêt = false; // Afin d'éviter d'appeler fFinale() avant que toutes les branches aient été évaluées 1 fois

    const fFinale = () => {
      // if (!prêt) return;

      const listeDonnées = Object.values(arbre)
        .map((x) => x.données)
        .filter((d) => d !== undefined) as U[];
      const réduits = fRéduction(listeDonnées);
      if (!prêt) return;
      f(réduits);
    };

    const fSuivreRacine = async (éléments: Array<T>) => {
      if (éléments.some((x) => typeof fCode(x) !== "string")) {
        console.error(
          "Définir fCode si les éléments ne sont pas en format texte (chaînes)."
        );
        throw new Error(
          "Définir fCode si les éléments ne sont pas en format texte (chaînes)."
        );
      }
      const dictÉléments = Object.fromEntries(
        éléments.map((é) => [fCode(é), é])
      );
      const existants = Object.keys(arbre);
      let nouveaux = Object.keys(dictÉléments).filter(
        (é) => !existants.includes(é)
      );
      const disparus = existants.filter(
        (é) => !Object.keys(dictÉléments).includes(é)
      );
      const changés = Object.entries(dictÉléments)
        .filter((é) => {
          return !deepEqual(dictBranches[é[0]], é[1]);
        })
        .map((é) => é[0]);
      nouveaux.push(...changés);
      nouveaux = [...new Set(nouveaux)];

      for (const c of changés) {
        if (arbre[c]) {
          const fOublier = arbre[c].fOublier;
          if (fOublier) fOublier();
          delete arbre[c];
        }
      }

      for (const d of disparus) {
        const fOublier = arbre[d].fOublier;
        if (fOublier) fOublier();
        delete arbre[d];
        fFinale();
      }

      await Promise.all(
        nouveaux.map(async (n: string) => {
          arbre[n] = { données: undefined };
          const élément = dictÉléments[n];
          dictBranches[n] = élément;

          const idBdBranche = fIdBdDeBranche(élément);
          const fSuivreBranche = (données: U) => {
            arbre[n].données = données;
            fFinale();
          };
          const fOublier = await fBranche(idBdBranche, fSuivreBranche, élément);
          arbre[n].fOublier = fOublier;
        })
      );

      prêt = true;
      fFinale();
    };

    const oublierBdRacine = await fListe(fSuivreRacine);

    const oublier = () => {
      oublierBdRacine();
      Object.values(arbre).map((x) => {
        if (x.fOublier) x.fOublier();
      });
    };
    return oublier;
  }

  async suivreBdsSelonCondition(
    fListe: (
      fSuivreRacine: (ids: string[]) => Promise<void>
    ) => Promise<schémaFonctionOublier>,
    fCondition: (
      id: string,
      fSuivreCondition: (état: boolean) => void
    ) => Promise<schémaFonctionOublier>,
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    interface branche {
      id: string;
      état: boolean;
    }

    const fFinale = (éléments: branche[]) => {
      const bdsRecherchées = éléments
        .filter((él) => él.état)
        .map((él) => él.id);
      f(bdsRecherchées);
    };

    const fBranche = async (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<branche>
    ): Promise<schémaFonctionOublier> => {
      const fFinaleSuivreBranche = (état: boolean) => {
        fSuivreBranche({ id, état });
      };
      return await fCondition(id, fFinaleSuivreBranche);
    };

    return await this.suivreBdsDeFonctionListe(fListe, fFinale, fBranche);
  }

  async rechercherBdListe<T extends élémentsBd>(
    id: string,
    f: (e: LogEntry<T>) => boolean
  ): Promise<LogEntry<T> | undefined> {
    const { bd, fOublier } = await this.ouvrirBd<FeedStore<T>>(id);
    const élément = bd
      .iterator({ limit: -1 })
      .collect()
      .find((e: LogEntry<T>) => f(e));

    fOublier();
    return élément;
  }

  async obtFichierSFIP(id: string, max?: number): Promise<Uint8Array | null> {
    return await toBuffer(this.sfip!.cat(id), max);
  }

  obtItérableAsyncSFIP(id: string): AsyncIterable<Uint8Array> {
    return this.sfip!.cat(id);
  }

  async ajouterÀSFIP(fichier: ImportCandidate): Promise<string> {
    const résultat = await this.sfip!.add(fichier);
    return résultat.cid.toString();
  }

  async ouvrirBd<T extends Store>(
    id: string
  ): Promise<{ bd: T; fOublier: schémaFonctionOublier }> {
    if (!adresseOrbiteValide(id)) throw new Error(`Adresse ${id} non valide.`);

    // Nous avons besoin d'un verrou afin d'éviter la concurrence
    await verrouOuvertureBd.acquire(id);
    const existante = this._bds[id] as bdOuverte<T> | undefined;

    const idRequète = uuidv4();
    const fOublier = () => {
      const { idsRequètes } = this._bds[id];
      this._bds[id].idsRequètes = idsRequètes.filter(
        (id_) => id_ !== idRequète
      );
    };

    if (existante) {
      this._bds[id].idsRequètes.push(idRequète);
      verrouOuvertureBd.release(id);
      return { bd: existante.bd, fOublier };
    }
    const bd = (await this.orbite!.open(id)) as T;
    await bd.load();
    this._bds[id] = { bd, idsRequètes: [idRequète] };

    // Maintenant que la BD a été créée, on peut relâcher le verrou
    verrouOuvertureBd.release(id);
    return { bd, fOublier };
  }

  async obtIdBd(
    nom: string,
    racine: string | KeyValueStore<string>,
    type?: TStoreType,
    optionsAccès?: OptionsContrôleurConstellation
  ): Promise<string | undefined> {
    let bdRacine: KeyValueStore<string>;
    let fOublier: schémaFonctionOublier | undefined;

    if (typeof racine === "string") {
      ({ bd: bdRacine, fOublier } = await this.ouvrirBd<KeyValueStore<string>>(
        racine
      ));
    } else {
      bdRacine = racine;
    }
    const idBdCompte = bdRacine.id;

    let idBd = bdRacine.get(nom);

    const clefLocale = idBdCompte + nom;
    const idBdPrécédente = (await obtStockageLocal()).getItem(clefLocale);

    if (idBd && idBdPrécédente && idBd !== idBdPrécédente) {
      try {
        await this.combinerBds(idBd, idBdPrécédente);
      } catch {
        // Rien à faire
      }
    }

    // Nous devons confirmer que la base de données spécifiée était du bon genre
    if (idBd && type) {
      try {
        await this.orbite![type as keyof OrbitDB](idBd);
        return idBd;
      } catch {
        return;
      }
    }

    if (!idBd && type) {
      const accès = bdRacine.access as ContrôleurConstellation;
      const permission = await uneFois((f: schémaFonctionSuivi<boolean>) =>
        accès.suivreIdsOrbiteAutoriséesÉcriture((autorisés: string[]) =>
          f(autorisés.includes(this.orbite!.identity.id))
        )
      );

      if (permission) {
        idBd = await this.créerBdIndépendante(type, optionsAccès);
        await bdRacine.set(nom, idBd);
      }
    }

    if (idBd) (await obtStockageLocal()).setItem(clefLocale, idBd);

    if (fOublier) fOublier();
    return idBd;
  }

  async créerBdIndépendante(
    type: TStoreType,
    optionsAccès?: OptionsContrôleurConstellation,
    nom?: string
  ): Promise<string> {
    optionsAccès = Object.assign({}, this.optionsAccès, optionsAccès || {});
    const options = {
      accessController: optionsAccès,
    };
    const bd: Store = await this.orbite![type as keyof OrbitDB](
      nom || uuidv4(),
      options
    );
    await bd.load();
    const { id } = bd;
    this._bds[id] = { bd, idsRequètes: [] };

    return id;
  }

  async effacerBd(id: string): Promise<void> {
    const { bd } = await this.ouvrirBd(id);
    await bd.drop();
    delete this._bds[id];
  }

  async obtOpsAccès(idBd: string): Promise<OptionsContrôleurConstellation> {
    const { bd, fOublier } = await this.ouvrirBd(idBd);
    const accès = bd.access as ContrôleurConstellation;

    fOublier();
    return {
      adresseBd: accès.bd!.id,
    };
  }

  async suivrePermission(
    id: string,
    f: schémaFonctionSuivi<typeof rôles[number] | undefined>
  ): Promise<schémaFonctionOublier> {
    const moi = this.orbite!.identity.id;
    const { bd, fOublier } = await this.ouvrirBd(id);
    const accès = bd.access;
    const typeAccès = (accès.constructor as unknown as AccessController).type;

    if (typeAccès === "ipfs") {
      f(accès.write.includes(moi) ? MEMBRE : undefined);
      fOublier();
      return faisRien;
    } else if (typeAccès === nomTypeContrôleurConstellation) {
      const fFinale = (utilisateurs: infoUtilisateur[]) => {
        const mesRôles = utilisateurs
          .filter((u) => u.idBdCompte === this.idBdCompte)
          .map((u) => u.rôle);
        const rôlePlusPuissant = mesRôles.includes(MODÉRATEUR)
          ? MODÉRATEUR
          : mesRôles.includes(MEMBRE)
          ? MEMBRE
          : undefined;
        f(rôlePlusPuissant);
      };
      const fOublierSuivreAccès = await (
        accès as ContrôleurConstellation
      ).suivreUtilisateursAutorisés(fFinale);
      return () => {
        fOublierSuivreAccès();
        fOublier();
      };
    } else {
      throw new Error(typeAccès);
    }
  }

  async suivrePermissionÉcrire(
    id: string,
    f: schémaFonctionSuivi<boolean>
  ): Promise<schémaFonctionOublier> {
    const fFinale = (rôle?: typeof rôles[number]) => {
      f(rôle !== undefined);
    };
    return await this.suivrePermission(id, fFinale);
  }

  async suivreAccèsBd(
    id: string,
    f: schémaFonctionSuivi<infoAccès[]>
  ): Promise<schémaFonctionOublier> {
    const { bd, fOublier } = await this.ouvrirBd(id);
    const accès = bd.access;
    const typeAccès = (accès.constructor as unknown as AccessController).type;

    if (typeAccès === "ipfs") {
      const listeAccès: infoAccès[] = accès.write.map((id) => {
        return {
          idBdCompte: id,
          rôle: MODÉRATEUR,
        };
      });
      f(listeAccès);
    } else if (typeAccès === nomTypeContrôleurConstellation) {
      const fOublierAutorisés = await (
        accès as ContrôleurConstellation
      ).suivreUtilisateursAutorisés(f);
      fOublier();
      return fOublierAutorisés;
    }
    fOublier();
    return faisRien;
  }

  async fermer(): Promise<void> {
    await Promise.all(
      Object.values(this._bds).map(async (bd) => await bd.bd.close())
    );

    if (this._oublierNettoyageBdsOuvertes) this._oublierNettoyageBdsOuvertes();
    if (this.favoris) await this.favoris.fermer();
    if (this.réseau) await this.réseau.fermer();
    if (this.automatisations) await this.automatisations.fermer();
    if (this.épingles) await this.épingles.fermer();
    if (this.orbite) await this.orbite.stop();
    if (this.sfip) await this.sfip.stop();
  }

  static async créer(
    opts: optsConstellation = {}
  ): Promise<ClientConstellation> {
    const client = new ClientConstellation(opts);
    await client.initialiser();
    return client;
  }
}
