import { IPFS as SFIP } from "ipfs";
import { IDResult } from "ipfs-core-types/src/root";
import { ImportCandidate } from "ipfs-core-types/src/utils";
import deepEqual from "deep-equal";
import crypto from "crypto";

import OrbitDB from "orbit-db";
import Store from "orbit-db-store";
import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";

import AccessController from "orbit-db-access-controllers/src/access-controller-interface";
import IPFSAccessController from "orbit-db-access-controllers/src/ipfs-access-controller";
import { EventEmitter, once } from "events";
import { v4 as uuidv4 } from "uuid";
import Semaphore from "@chriscdn/promise-semaphore";

import initOrbite from "@/orbite";
import initSFIP from "@/sfip";
import Épingles from "@/epingles";
import Profil from "@/profil";
import BDs from "@/bds";
import Tableaux from "@/tableaux";
import Variables from "@/variables";
import Réseau from "@/reseau";
import { Encryption, EncryptionParDéfaut } from "@/encryption";
import Favoris from "@/favoris";
import Projets from "@/projets";
import MotsClefs from "@/motsClefs";
import Recherche from "@/recherche";
import { ContenuMessageRejoindreCompte } from "@/reseau";
import Automatisations from "@/automatisation";

import {
  adresseOrbiteValide,
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaRetourFonctionRecherche,
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
  encryption?: Encryption | boolean;
  dossierStockageLocal?: string;
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

const DÉLAI_EXPIRATION_INVITATIONS = 1000 * 60 * 5; // 5 minutes

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
  recherche?: Recherche;
  motsClefs?: MotsClefs;
  automatisations?: Automatisations;
  _oublierNettoyageBdsOuvertes?: schémaFonctionOublier;

  prêt: boolean;
  idBdCompte?: string;
  encryption: Encryption;
  sujet_réseau: string;
  motsDePasseRejoindreCompte: { [key: string]: number };

  constructor(opts: optsConstellation = {}) {
    super();
    this._opts = opts;

    this._bds = {};
    this.prêt = false;
    this.sujet_réseau = opts.sujetRéseau || "réseau-constellation";
    this.motsDePasseRejoindreCompte = {};

    this.encryption = new EncryptionParDéfaut();
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
      this.idBdCompte = await this.créerBdIndépendante({
        type: "kvstore",
        optionsAccès: optionsAccèsRacine,
        nom: "racine",
      });
    }
    this.épingles = new Épingles({ client: this });
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
    >({ id: this.idBdCompte! });
    this.bdCompte = bd;

    const accès = this.bdCompte.access as unknown as ContrôleurConstellation;
    this.optionsAccès = {
      type: "controlleur-constellation",
      adresseBd: accès.bd!.id,
    };

    const idBdProfil = await this.obtIdBd({
      nom: "compte",
      racine: this.bdCompte,
      type: "kvstore",
    });
    this.profil = new Profil({ client: this, id: idBdProfil! });

    const idBdBDs = await this.obtIdBd({
      nom: "bds",
      racine: this.bdCompte,
      type: "feed",
    });
    this.bds = new BDs({ client: this, id: idBdBDs! });

    this.tableaux = new Tableaux({ client: this });

    const idBdVariables = await this.obtIdBd({
      nom: "variables",
      racine: this.bdCompte,
      type: "feed",
    });
    this.variables = new Variables({ client: this, id: idBdVariables! });

    const idBdRéseau = await this.obtIdBd({
      nom: "réseau",
      racine: this.bdCompte,
      type: "kvstore",
    });
    this.réseau = new Réseau({ client: this, id: idBdRéseau! });
    await this.réseau.initialiser();

    const idBdFavoris = await this.obtIdBd({
      nom: "favoris",
      racine: this.bdCompte,
      type: "kvstore",
    });
    this.favoris = new Favoris({ client: this, id: idBdFavoris! });

    const idBdProjets = await this.obtIdBd({
      nom: "projets",
      racine: this.bdCompte,
      type: "feed",
    });
    this.projets = new Projets({ client: this, id: idBdProjets! });

    const idBdMotsClefs = await this.obtIdBd({
      nom: "motsClefs",
      racine: this.bdCompte,
      type: "feed",
    });
    this.motsClefs = new MotsClefs({ client: this, id: idBdMotsClefs! });

    const idBdAuto = await this.obtIdBd({
      nom: "automatisations",
      racine: this.bdCompte,
      type: "feed",
    });
    this.automatisations = new Automatisations({ client: this, id: idBdAuto! });

    this.recherche = new Recherche({ client: this });

    this.épingles!.épinglerBd({ id: idBdProfil! }); // Celle-ci doit être récursive et inclure les fichiers
    for (const idBd of [
      idBdBDs,
      idBdVariables,
      idBdRéseau,
      idBdFavoris,
      idBdProjets,
      idBdMotsClefs,
      idBdAuto,
    ]) {
      this.épingles!.épinglerBd({
        id: idBd!,
        récursif: false,
        fichiers: false,
      });
    }
  }

  async signer({ message }: { message: string }): Promise<Signature> {
    const id = this.orbite!.identity;
    const signature = await this.orbite!.identity.provider.sign(id, message);
    const clefPublique = this.orbite!.identity.publicKey;
    return { signature, clefPublique };
  }

  async vérifierSignature({
    signature,
    message,
  }: {
    signature: Signature;
    message: string;
  }): Promise<boolean> {
    if (!signature || !signature.clefPublique || !signature.signature) {
      return false;
    }
    return await this.orbite!.identity.provider.verify(
      signature.signature,
      signature.clefPublique,
      message
    );
  }

  async suivreDispositifs({
    f,
    idBdCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idBdCompte?: string;
  }): Promise<schémaFonctionOublier> {
    idBdCompte = idBdCompte || this.bdCompte!.id;
    const { bd, fOublier } = await this.ouvrirBd({ id: idBdCompte });
    const accès = bd.access;

    const typeAccès = (accès.constructor as unknown as AccessController).type;
    if (typeAccès === "ipfs") {
      f((accès as IPFSAccessController).write);
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
      return () => {
        accès.off("misÀJour", fFinale);
        fOublier();
      };
    } else {
      fOublier();
      return faisRien;
    }
  }

  async générerInvitationRejoindreCompte(): Promise<{
    idCompte: string;
    codeSecret: string;
  }> {
    if (!this.encryption)
      throw "On doit spécifier un module d'encryption au moment de l'initialisation du client afin d'automatiser les invitations.";
    const idCompte = await this.obtIdCompte();
    const codeSecret = this.encryption.clefAléatoire();
    this.motsDePasseRejoindreCompte[codeSecret] = Date.now();
    return { idCompte, codeSecret };
  }

  async considérerRequèteRejoindreCompte({
    requète,
  }: {
    requète: ContenuMessageRejoindreCompte;
  }): Promise<void> {
    const { idOrbite, codeSecret } = requète;
    const maintenant = Date.now();

    const requèteValide =
      (this.motsDePasseRejoindreCompte[codeSecret] || -Infinity) - maintenant <
      DÉLAI_EXPIRATION_INVITATIONS;
    if (requèteValide) {
      delete this.motsDePasseRejoindreCompte[codeSecret];
      await this.ajouterDispositif({ idOrbite });
    }
  }

  async ajouterDispositif({ idOrbite }: { idOrbite: string }): Promise<void> {
    if (!this.bdCompte) await once(this, "prêt");
    const accès = this.bdCompte!.access as unknown as ContrôleurConstellation;
    accès.grant(MODÉRATEUR, idOrbite);
  }

  async enleverDispositif({ idOrbite }: { idOrbite: string }): Promise<void> {
    if (!this.bdCompte) await once(this, "prêt");
    const accès = this.bdCompte!.access as unknown as ContrôleurConstellation;
    await accès.revoke(MODÉRATEUR, idOrbite);
  }

  async rejoindreCompte({ idBdCompte }: { idBdCompte: string }): Promise<void> {
    if (!adresseOrbiteValide(idBdCompte)) {
      throw new Error(`Adresse compte ${idBdCompte} non valide`);
    }

    // Attendre de recevoir la permission d'écrire à idBdCompte
    let autorisé: boolean;
    const { bd, fOublier } = await this.ouvrirBd({ id: idBdCompte });
    const accès = bd.access as ContrôleurConstellation;
    const oublierPermission = await accès.suivreIdsOrbiteAutoriséesÉcriture(
      (autorisés: string[]) =>
        (autorisé = autorisés.includes(this.orbite!.identity.id))
    );
    await new Promise<void>((résoudre) => {
      const vérifierSiAutorisé = () => {
        if (autorisé) {
          oublierPermission();
          clearInterval(x);
          fOublier();
          résoudre();
        }
      };
      const x = setInterval(() => {
        vérifierSiAutorisé();
      }, 10);
      vérifierSiAutorisé();
    });

    // Là on peut y aller
    this.idBdCompte = idBdCompte;
    await this.initialiserBds();
    this.emit("compteChangé");
  }

  async donnerAccès({
    idBd,
    identité,
    rôle = MEMBRE,
  }: {
    idBd: string;
    identité: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    if (!adresseOrbiteValide(identité)) {
      throw new Error(`Identité ${identité} non valide.`);
    }

    const { bd, fOublier } = await this.ouvrirBd({ id: idBd });
    const accès = bd.access;
    const typeAccès = (accès.constructor as unknown as AccessController).type;
    if (typeAccès === nomTypeContrôleurConstellation) {
      (accès as unknown as ContrôleurConstellation).grant(rôle, identité);
    }
    fOublier();
  }

  async suivreIdBdCompte({
    f,
  }: {
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
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

  async obtIdCompte(): Promise<string> {
    if (!this.idBdCompte) await once(this, "prêt");
    return this.idBdCompte!;
  }

  async copierContenuBdListe<T extends élémentsBd = élémentsBd>({
    bdBase,
    nouvelleBd,
    clef,
  }: {
    bdBase: KeyValueStore<string>;
    nouvelleBd: KeyValueStore<string>;
    clef: string;
  }): Promise<void> {
    const idBdListeInit = bdBase.get(clef);
    if (typeof idBdListeInit !== "string") return;

    const { bd: bdListeInit, fOublier: fOublierInit } = await this.ouvrirBd<
      FeedStore<T>
    >({ id: idBdListeInit });

    const idNouvelleBdListe = nouvelleBd.get(clef);
    if (!idNouvelleBdListe) throw "La nouvelle BD n'existait pas";

    const { bd: nouvelleBdListe, fOublier: fOublierNouvelle } =
      await this.ouvrirBd<FeedStore<T>>({ id: idNouvelleBdListe });

    const données = ClientConstellation.obtÉlémentsDeBdListe({
      bd: bdListeInit,
    });
    await Promise.all(
      données.map(async (d) => {
        await nouvelleBdListe.add(d);
      })
    );
    fOublierInit();
    fOublierNouvelle();
  }

  async combinerBds<T extends élémentsBd = élémentsBd>({
    idBdBase,
    idBd2,
  }: {
    idBdBase: string;
    idBd2: string;
  }): Promise<void> {
    const { bd: bdBase, fOublier: fOublierBase } = await this.ouvrirBd({
      id: idBdBase,
    });
    const { bd: bd2, fOublier: fOublier2 } = await this.ouvrirBd({ id: idBd2 });
    if (bd2.type !== bdBase.type) {
      throw new Error("Les BDs doivent être du même type");
    }

    switch (bdBase.type) {
      case "keyvalue":
        await this.combinerBdsDict({
          bdBase: bdBase as KeyValueStore<T>,
          bd2: bd2 as KeyValueStore<T>,
        });
        break;

      case "feed":
        await this.combinerBdsListe({
          bdBase: bdBase as FeedStore<T>,
          bd2: bd2 as FeedStore<T>,
        });
        break;

      default:
        throw new Error(`Type de BD ${bdBase.type} non supporté.`);
    }

    fOublierBase();
    fOublier2();
  }

  async combinerBdsDict<T extends élémentsBd = élémentsBd>({
    bdBase,
    bd2,
  }: {
    bdBase: KeyValueStore<T>;
    bd2: KeyValueStore<T>;
  }): Promise<void> {
    const contenuBd2 = ClientConstellation.obtObjetdeBdDic({ bd: bd2 });

    for (const [c, v] of Object.entries(contenuBd2)) {
      const valBdBase = bdBase.get(c);
      if (valBdBase === v) {
        continue;
      } else if (valBdBase === undefined) {
        await bdBase.put(c, v as T);
      } else if (adresseOrbiteValide(valBdBase) && adresseOrbiteValide(v)) {
        await this.combinerBds({
          idBdBase: valBdBase as string,
          idBd2: v as string,
        });
      }
    }
  }

  async combinerBdsListe<T extends élémentsBd = élémentsBd>({
    bdBase,
    bd2,
    index,
  }: {
    bdBase: FeedStore<{ [key: string]: T }>;
    bd2: FeedStore<{ [key: string]: T }>;
    index: string[];
  }): Promise<void>;
  async combinerBdsListe<T extends élémentsBd = élémentsBd>({
    bdBase,
    bd2,
  }: {
    bdBase: FeedStore<T>;
    bd2: FeedStore<T>;
  }): Promise<void>;
  async combinerBdsListe<T extends élémentsBd = élémentsBd>({
    bdBase,
    bd2,
    index,
  }: {
    bdBase: FeedStore<{ [key: string]: T }>;
    bd2: FeedStore<{ [key: string]: T }>;
    index?: string[];
  }): Promise<void> {
    const contenuBdBase = ClientConstellation.obtÉlémentsDeBdListe({
      bd: bdBase,
      renvoyerValeur: false,
    });
    const contenuBd2 = ClientConstellation.obtÉlémentsDeBdListe({
      bd: bd2,
      renvoyerValeur: false,
    });
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
                  await this.combinerBds({
                    idBdBase: combiné[c] as string,
                    idBd2: v as string,
                  });
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

  async suivreBd<T extends Store>({
    id,
    f,
    événements = ["write", "replicated", "ready"],
  }: {
    id: string;
    f: schémaFonctionSuivi<T>;
    événements?: string[];
  }): Promise<schémaFonctionOublier> {
    const { bd, fOublier } = await this.ouvrirBd<T>({ id });

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

  async suivreBdDeFonction<T>({
    fRacine,
    f,
    fSuivre,
  }: {
    fRacine: (args: {
      fSuivreRacine: (nouvelIdBdCible: string) => Promise<void>;
    }) => Promise<schémaFonctionOublier>;
    f: schémaFonctionSuivi<T | undefined>;
    fSuivre: (args: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<T | undefined>;
    }) => Promise<schémaFonctionOublier>;
  }): Promise<schémaFonctionOublier> {
    let oublierFSuivre: schémaFonctionOublier | undefined;
    let idBdCible: string | undefined;
    let premièreFois = true;

    const oublierRacine = await fRacine({
      fSuivreRacine: async (nouvelIdBdCible: string) => {
        if (nouvelIdBdCible === undefined && premièreFois) {
          premièreFois = false;
          f(undefined);
        }
        if (nouvelIdBdCible !== idBdCible) {
          idBdCible = nouvelIdBdCible;
          if (oublierFSuivre) oublierFSuivre();

          if (idBdCible) {
            oublierFSuivre = await fSuivre({ id: idBdCible, fSuivreBd: f });
          } else {
            f(undefined);
            oublierFSuivre = undefined;
          }
        }
      },
    });
    return () => {
      oublierRacine();
      if (oublierFSuivre) oublierFSuivre();
    };
  }

  async suivreBdDeClef<T>({
    id,
    clef,
    f,
    fSuivre,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<T | undefined>;
    fSuivre: (args: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<T>;
    }) => Promise<schémaFonctionOublier>;
  }): Promise<schémaFonctionOublier> {
    const fRacine = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (nouvelIdBdCible: string) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      const fSuivreBdRacine = async (bd: KeyValueStore<string>) => {
        const nouvelIdBdCible = bd.get(clef);
        fSuivreRacine(nouvelIdBdCible);
      };
      return await this.suivreBd({ id, f: fSuivreBdRacine });
    };
    return await this.suivreBdDeFonction<T>({ fRacine, f, fSuivre });
  }

  async suivreBdDic<T extends élémentsBd>({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: T }>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (bd: KeyValueStore<T>) => {
      const valeurs = bd ? ClientConstellation.obtObjetdeBdDic<T>({ bd }) : {};
      f(valeurs);
    };
    return await this.suivreBd({ id, f: fFinale });
  }

  async suivreBdDicDeClef<T extends élémentsBd>({
    id,
    clef,
    f,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<{ [key: string]: T }>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (valeurs?: { [key: string]: T }) => {
      f(valeurs || {});
    };
    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<{ [key: string]: T }>;
    }) => {
      return await this.suivreBdDic({ id, f: fSuivreBd });
    };
    return await this.suivreBdDeClef({ id, clef, f: fFinale, fSuivre });
  }

  static obtObjetdeBdDic<T extends élémentsBd>({
    bd,
  }: {
    bd: KeyValueStore<T>;
  }): { [key: string]: T } {
    const valeurs = bd.all;
    return Object.fromEntries(
      Object.keys(valeurs).map((x) => {
        return [x, valeurs[x]];
      })
    );
  }

  async suivreBdListeDeClef<T extends élémentsBd>({
    id,
    clef,
    f,
    renvoyerValeur,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<LogEntry<T>[]>;
    renvoyerValeur: false;
  }): Promise<schémaFonctionOublier>;
  async suivreBdListeDeClef<T extends élémentsBd>({
    id,
    clef,
    f,
    renvoyerValeur,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<T[]>;
    renvoyerValeur?: true;
  }): Promise<schémaFonctionOublier>;
  async suivreBdListeDeClef<T extends élémentsBd>({
    id,
    clef,
    f,
    renvoyerValeur,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<T[] | LogEntry<T>[]>;
    renvoyerValeur?: true;
  }): Promise<schémaFonctionOublier>;
  async suivreBdListeDeClef<T extends élémentsBd>({
    id,
    clef,
    f,
    renvoyerValeur = true,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<T[] | LogEntry<T>[]>;
    renvoyerValeur?: boolean;
  }): Promise<schémaFonctionOublier> {
    // À faire : très laid en raison de contraintes Typescript...peut-être existe-il une meilleure façon ?
    if (renvoyerValeur) {
      const fFinale = async (valeurs?: T[]) => {
        f(valeurs || []);
      };
      const fSuivre = async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<T[]>;
      }) => {
        return await this.suivreBdListe({ id, f: fSuivreBd, renvoyerValeur });
      };

      return await this.suivreBdDeClef({ id, clef, f: fFinale, fSuivre });
    } else {
      const fFinale = async (valeurs?: LogEntry<T>[]) => {
        f(valeurs || []);
      };
      const fSuivre = async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<LogEntry<T>[]>;
      }) => {
        return await this.suivreBdListe({ id, f: fSuivreBd, renvoyerValeur });
      };

      return await this.suivreBdDeClef({
        id,
        clef,
        f: fFinale as unknown as (
          x?: élémentsBd
        ) => Promise<schémaFonctionOublier>,
        fSuivre: fSuivre as unknown as ({
          id,
          fSuivreBd,
        }: {
          id: string;
          fSuivreBd: schémaFonctionSuivi<élémentsBd[]>;
        }) => Promise<schémaFonctionOublier>,
      });
    }
  }

  async suivreBdListe<T extends élémentsBd>({
    id,
    f,
    renvoyerValeur,
  }: {
    id: string;
    f: schémaFonctionSuivi<T[]>;
    renvoyerValeur?: true;
  }): Promise<schémaFonctionOublier>;

  async suivreBdListe<T extends élémentsBd>({
    id,
    f,
    renvoyerValeur,
  }: {
    id: string;
    f: schémaFonctionSuivi<LogEntry<T>[]>;
    renvoyerValeur: false;
  }): Promise<schémaFonctionOublier>;

  async suivreBdListe<T extends élémentsBd>({
    id,
    f,
    renvoyerValeur = true,
  }: {
    id: string;
    f: schémaFonctionSuivi<T[] | LogEntry<T>[]>;
    renvoyerValeur?: boolean;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBd({
      id,
      f: async (bd: FeedStore<T>) => {
        const éléments = ClientConstellation.obtÉlémentsDeBdListe({
          bd,
          renvoyerValeur,
        });
        f(éléments);
      },
    });
  }

  static obtÉlémentsDeBdListe<T extends élémentsBd>({
    bd,
    renvoyerValeur,
  }: {
    bd: FeedStore<T>;
    renvoyerValeur?: true;
  }): T[];

  static obtÉlémentsDeBdListe<T extends élémentsBd>({
    bd,
    renvoyerValeur,
  }: {
    bd: FeedStore<T>;
    renvoyerValeur: false;
  }): LogEntry<T>[];

  static obtÉlémentsDeBdListe<T extends élémentsBd>({
    bd,
    renvoyerValeur,
  }: {
    bd: FeedStore<T>;
    renvoyerValeur?: boolean;
  }): T[] | LogEntry<T>[];

  static obtÉlémentsDeBdListe<T extends élémentsBd>({
    bd,
    renvoyerValeur = true,
  }: {
    bd: FeedStore<T>;
    renvoyerValeur?: boolean;
  }): T[] | LogEntry<T>[] {
    const éléments = bd.iterator({ limit: -1 }).collect();
    if (renvoyerValeur) {
      return éléments.map((e: LogEntry<T>) => e.payload.value);
    } else {
      return éléments;
    }
  }

  obtÉlémentBdListeSelonEmpreinte<T extends élémentsBd>({
    bd,
    empreinte,
  }: {
    bd: FeedStore<T>;
    empreinte: string;
  }): élémentsBd | undefined {
    const élément = bd
      .iterator({ limit: -1 })
      .collect()
      .find((e: LogEntry<T>) => e.hash === empreinte);
    return élément?.payload.value;
  }

  async effacerÉlémentDeBdListe<T extends élémentsBd>({
    bd,
    élément,
  }: {
    bd: FeedStore<T>;
    élément: T | ((e: LogEntry<T>) => boolean);
  }): Promise<void> {
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

  async suivreTypeObjet({ idObjet, f }: {
    idObjet: string,
    f: schémaFonctionSuivi<"motClef" | "variable" | "bd" | "projet" | undefined>
  }): Promise<schémaFonctionOublier> {

    const fFinale = (vals: {[key: string]: string}): void => {
      let typeFinal = undefined as "motClef" | "variable" | "bd" | "projet" | undefined

      const { type } = vals
      if (type) {
        typeFinal = ["motClef", "variable", "bd", "projet"].includes(type) ? type as "motClef" | "variable" | "bd" | "projet" : undefined
      } else {
        if (vals.bds) typeFinal = "projet";
        else if (vals.tableaux) typeFinal = "bd";
        else if (vals.catégorie) typeFinal = "variable";
        else if (vals.nom) typeFinal = "motClef"
      }
      f(typeFinal);
    }

    const fOublier = await this.suivreBdDic({ id: idObjet, f: fFinale});
    return fOublier;
  }

  async suivreEmpreinteTêtesBdRécursive({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    const obtTêteBd = (bd: Store): string => {
      const tête = bd._oplog.heads[bd._oplog.heads.length - 1].hash;
      return tête;
    };
    const calculerEmpreinte = (texte: string) =>
      crypto.createHash("md5").update(texte).digest("hex");

    const fFinale = (têtes: string[]) => {
      f(calculerEmpreinte(têtes.sort().join()));
    };

    const fListe = async (
      fSuivreRacine: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBdsRécursives({
        idBd,
        f: (bds) => fSuivreRacine(bds),
      });
    };

    const fBranche = async (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<string>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBd({
        id,
        f: (bd) => fSuivreBranche(obtTêteBd(bd)),
      });
    };

    return await this.suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  async suivreBdsDeBdListe<T extends élémentsBd, U, V>({
    id,
    f,
    fBranche,
    fIdBdDeBranche = (b) => b as string,
    fRéduction = (branches: U[]) =>
      [...new Set(branches.flat())] as unknown as V[],
    fCode = (é) => é as string,
  }: {
    id: string;
    f: schémaFonctionSuivi<V[]>;
    fBranche: (
      id: string,
      f: schémaFonctionSuivi<U>,
      branche: T
    ) => Promise<schémaFonctionOublier | undefined>;
    fIdBdDeBranche?: (b: T) => string;
    fRéduction?: schémaFonctionRéduction<U[], V[]>;
    fCode?: (é: T) => string;
  }): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (éléments: T[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBdListe({ id, f: fSuivreRacine });
    };
    return await this.suivreBdsDeFonctionListe({
      fListe,
      f,
      fBranche,
      fIdBdDeBranche,
      fRéduction,
      fCode,
    });
  }

  async suivreBdsDeFonctionListe<T extends élémentsBd, U, V>({
    fListe,
    f,
    fBranche,
    fIdBdDeBranche = (b) => b as string,
    fRéduction = (branches: U[]) =>
      [...new Set(branches.flat())] as unknown as V[],
    fCode = (é) => é as string,
  }: {
    fListe: (
      fSuivreRacine: (éléments: T[]) => Promise<void>
    ) => Promise<schémaFonctionOublier>;
    f: schémaFonctionSuivi<V[]>;
    fBranche: (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<U>,
      branche: T
    ) => Promise<schémaFonctionOublier | undefined>;
    fIdBdDeBranche?: (b: T) => string;
    fRéduction?: schémaFonctionRéduction<U[], V[]>;
    fCode?: (é: T) => string;
  }): Promise<schémaFonctionOublier> {
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

  async suivreBdsDeFonctionRecherche<T extends élémentsBd, U, V>({
    fListe,
    f,
    fBranche,
    fIdBdDeBranche = (b) => b as string,
    fRéduction = (branches: U[]) =>
      [...new Set(branches.flat())] as unknown as V[],
    fCode = (é) => é as string,
  }: {
    fListe: (
      fSuivreRacine: (éléments: T[]) => Promise<void>
    ) => Promise<schémaRetourFonctionRecherche>;
    f: schémaFonctionSuivi<V[]>;
    fBranche: (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<U>,
      branche: T
    ) => Promise<schémaFonctionOublier | undefined>;
    fIdBdDeBranche?: (b: T) => string;
    fRéduction?: schémaFonctionRéduction<U[], V[]>;
    fCode?: (é: T) => string;
  }): Promise<{
    fOublier: schémaFonctionOublier;
    fChangerProfondeur: (p: number) => void;
  }> {
    let _fChangerProfondeur: ((p: number) => void) | undefined = undefined;
    const fChangerProfondeur = (p: number) => {
      if (_fChangerProfondeur) _fChangerProfondeur(p);
    };

    const fListeFinale = async (
      fSuivreRacine: (éléments: T[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      const { fOublier: fOublierL, fChangerProfondeur: fChangerL } =
        await fListe(fSuivreRacine);
      _fChangerProfondeur = fChangerL;
      return fOublierL;
    };

    const fOublier = await this.suivreBdsDeFonctionListe({
      fListe: fListeFinale,
      f,
      fBranche,
      fIdBdDeBranche,
      fRéduction,
      fCode,
    });
    return { fOublier, fChangerProfondeur };
  }

  async suivreBdsSelonCondition({
    fListe,
    fCondition,
    f,
  }: {
    fListe: (
      fSuivreRacine: (ids: string[]) => Promise<void>
    ) => Promise<schémaFonctionOublier>;
    fCondition: (
      id: string,
      fSuivreCondition: (état: boolean) => void
    ) => Promise<schémaFonctionOublier>;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
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

    return await this.suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  async rechercherBdListe<T extends élémentsBd>({
    id,
    f,
  }: {
    id: string;
    f: (e: LogEntry<T>) => boolean;
  }): Promise<LogEntry<T> | undefined> {
    const { bd, fOublier } = await this.ouvrirBd<FeedStore<T>>({ id });
    const élément = bd
      .iterator({ limit: -1 })
      .collect()
      .find((e: LogEntry<T>) => f(e));

    fOublier();
    return élément;
  }

  async obtFichierSFIP({
    id,
    max,
  }: {
    id: string;
    max?: number;
  }): Promise<Uint8Array | null> {
    return await toBuffer(this.sfip!.cat(id), max);
  }

  obtItérableAsyncSFIP({ id }: { id: string }): AsyncIterable<Uint8Array> {
    return this.sfip!.cat(id);
  }

  async ajouterÀSFIP({
    fichier,
  }: {
    fichier: ImportCandidate;
  }): Promise<string> {
    const résultat = await this.sfip!.add(fichier);
    return résultat.cid.toString();
  }

  async obtDeStockageLocal({ clef }: { clef: string }): Promise<string | null> {
    const clefClient = `${this.idBdCompte!.slice(
      this.idBdCompte!.length - 23,
      this.idBdCompte!.length - 8
    )} : ${clef}`;
    return (await obtStockageLocal(this._opts.dossierStockageLocal)).getItem(clefClient);
  }

  async sauvegarderAuStockageLocal({
    clef,
    val,
  }: {
    clef: string;
    val: string;
  }): Promise<void> {
    const clefClient = `${this.idBdCompte!.slice(
      this.idBdCompte!.length - 23,
      this.idBdCompte!.length - 8
    )} : ${clef}`;
    return (await obtStockageLocal(this._opts.dossierStockageLocal)).setItem(clefClient, val);
  }

  async effacerDeStockageLocal({ clef }: { clef: string }): Promise<void> {
    const clefClient = `${this.idBdCompte!.slice(
      this.idBdCompte!.length - 23,
      this.idBdCompte!.length - 8
    )} : ${clef}`;
    return (await obtStockageLocal(this._opts.dossierStockageLocal)).removeItem(clefClient);
  }

  async ouvrirBd<T extends Store>({
    id,
  }: {
    id: string;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }> {
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

  async obtIdBd({
    nom,
    racine,
    type,
    optionsAccès,
  }: {
    nom: string;
    racine: string | KeyValueStore<string>;
    type?: TStoreType;
    optionsAccès?: OptionsContrôleurConstellation;
  }): Promise<string | undefined> {
    let bdRacine: KeyValueStore<string>;
    let fOublier: schémaFonctionOublier | undefined;

    if (typeof racine === "string") {
      ({ bd: bdRacine, fOublier } = await this.ouvrirBd<KeyValueStore<string>>({
        id: racine,
      }));
    } else {
      bdRacine = racine;
    }
    const idBdCompte = bdRacine.id;

    let idBd = bdRacine.get(nom);

    const clefLocale = idBdCompte + nom;
    const idBdPrécédente = await this.obtDeStockageLocal({ clef: clefLocale });

    if (idBd && idBdPrécédente && idBd !== idBdPrécédente) {
      try {
        await this.combinerBds({ idBdBase: idBd, idBd2: idBdPrécédente });
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
        return undefined;
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
        idBd = await this.créerBdIndépendante({ type, optionsAccès });
        await bdRacine.set(nom, idBd);
      }
    }

    if (idBd)
      await this.sauvegarderAuStockageLocal({ clef: clefLocale, val: idBd });

    if (fOublier) fOublier();
    return idBd;
  }

  async créerBdIndépendante({
    type,
    optionsAccès,
    nom,
  }: {
    type: TStoreType;
    optionsAccès?: OptionsContrôleurConstellation;
    nom?: string;
  }): Promise<string> {
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

  async effacerBd({ id }: { id: string }): Promise<void> {
    const { bd } = await this.ouvrirBd({ id });
    await bd.drop();
    delete this._bds[id];
  }

  async obtOpsAccès({
    idBd,
  }: {
    idBd: string;
  }): Promise<OptionsContrôleurConstellation> {
    const { bd, fOublier } = await this.ouvrirBd({ id: idBd });
    const accès = bd.access as ContrôleurConstellation;

    fOublier();
    return {
      adresseBd: accès.bd!.id,
    };
  }

  async suivrePermission({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<typeof rôles[number] | undefined>;
  }): Promise<schémaFonctionOublier> {
    const { bd, fOublier } = await this.ouvrirBd({ id: idObjet });
    const accès = bd.access;
    const typeAccès = (accès.constructor as unknown as AccessController).type;

    if (typeAccès === "ipfs") {
      const moi = this.orbite!.identity.id;
      f(
        (accès as IPFSAccessController).write.includes(moi) ? MEMBRE : undefined
      );
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

  async suivrePermissionÉcrire({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<boolean>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (rôle?: typeof rôles[number]) => {
      f(rôle !== undefined);
    };
    return await this.suivrePermission({ idObjet: id, f: fFinale });
  }

  async suivreAccèsBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<infoAccès[]>;
  }): Promise<schémaFonctionOublier> {
    const { bd, fOublier } = await this.ouvrirBd({ id });
    const accès = bd.access;
    const typeAccès = (accès.constructor as unknown as AccessController).type;

    if (typeAccès === "ipfs") {
      const listeAccès: infoAccès[] = (accès as IPFSAccessController).write.map(
        (id) => {
          return {
            idBdCompte: id,
            rôle: MODÉRATEUR,
          };
        }
      );
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

  async suivreBdsRécursives({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const dicBds: {
      [key: string]: {
        requètes: Set<string>;
        sousBds: string[];
        fOublier: schémaFonctionOublier;
      };
    } = {};

    const fFinale = () => {
      f(Object.keys(dicBds));
    };

    const verrou = new Semaphore();

    const enleverRequètesDe = (de: string) => {
      delete dicBds[de];
      Object.keys(dicBds).forEach((id) => {
        dicBds[id].requètes.delete(de);
        if (!dicBds[id].requètes.size) {
          dicBds[id].fOublier();
        }
      });
    };

    const _suivreBdsRécursives = async (
      id: string,
      de: string
    ): Promise<void> => {
      const fSuivreBd = async (vals: élémentsBd) => {
        // Cette fonction détectera les éléments d'une liste ou d'un dictionnaire
        // (à un niveau de profondeur) qui représentent une adresse de BD Orbit.
        let l_vals: string[] = [];
        if (typeof vals === "object") {
          l_vals = Object.values(vals).filter(
            (v) => typeof v === "string"
          ) as string[];
        } else if (Array.isArray(vals)) {
          l_vals = vals;
        } else if (typeof vals === "string") {
          l_vals = [vals];
        }
        const idsOrbite = l_vals.filter((v) => adresseOrbiteValide(v));
        const nouvelles = idsOrbite.filter(
          (id_) => !dicBds[id].sousBds.includes(id_)
        );
        const obsolètes = dicBds[id].sousBds.filter(
          (id_) => !idsOrbite.includes(id_)
        );

        dicBds[id].sousBds = idsOrbite;

        obsolètes.forEach((o) => {
          dicBds[o].requètes.delete(id);
          if (!dicBds[o].requètes.size) dicBds[o].fOublier();
        });
        await Promise.all(
          nouvelles.map(async (id_) => await _suivreBdsRécursives(id_, id))
        );
        fFinale();
      };

      await verrou.acquire(id);
      if (dicBds[id]) {
        dicBds[id].requètes.add(de);
        return;
      }

      const { bd, fOublier } = await this.ouvrirBd({ id });
      const { type } = bd;
      fOublier();

      dicBds[id] = {
        requètes: new Set([de]),
        sousBds: [],
        fOublier: () => {
          fOublierSuiviBd();
          enleverRequètesDe(id);
        },
      };

      let fOublierSuiviBd: schémaFonctionOublier;
      if (type === "keyvalue") {
        fOublierSuiviBd = await this.suivreBdDic({ id, f: fSuivreBd });
      } else if (type === "feed") {
        fOublierSuiviBd = await this.suivreBdListe({ id, f: fSuivreBd });
      } else {
        fOublierSuiviBd = faisRien; // Rien à suivre mais il faut l'inclure quand même !
      }

      verrou.release(id);
      fFinale();
    };

    await _suivreBdsRécursives(idBd, "");

    const fOublier = () => {
      Object.values(dicBds).forEach((v) => v.fOublier());
    };
    return fOublier;
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
