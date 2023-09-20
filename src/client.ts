import type { IPFS as SFIP } from "ipfs-core";
import type { IDResult } from "ipfs-core-types/src/root";
import type { ImportCandidate } from "ipfs-core-types/src/utils";
import deepEqual from "deep-equal";
import { எண்ணிக்கை } from "ennikkai";
import {type OrbitDB} from "@orbitdb/core";

import type Store from "orbit-db-store";
import type FeedStore from "orbit-db-feedstore";
import type KeyValueStore from "orbit-db-kvstore";

import type AccessController from "orbit-db-access-controllers/src/access-controller-interface.js";
import type IPFSAccessController from "orbit-db-access-controllers/src/ipfs-access-controller.js";
import type { objRôles, infoUtilisateur } from "@/accès/types.js";
import Licences from "@/licences.js";
import { EventEmitter, once } from "events";
import { v4 as uuidv4 } from "uuid";
import Semaphore from "@chriscdn/promise-semaphore";
import indexedDbStream from "indexed-db-stream";

import { suivreBdDeFonction } from "@constl/utils-ipa";

import { enregistrerContrôleurs } from "@/accès/index.js";
import Épingles from "@/epingles.js";
import Profil from "@/profil.js";
import BDs from "@/bds.js";
import Tableaux from "@/tableaux.js";
import Variables from "@/variables.js";
import Réseau from "@/reseau.js";
import { Encryption, EncryptionLocalFirst } from "@/encryption.js";
import Favoris from "@/favoris.js";
import Projets from "@/projets.js";
import MotsClefs from "@/motsClefs.js";
import Nuées from "@/nuée.js";
import Recherche from "@/recherche/index.js";
import type { ContenuMessageRejoindreCompte } from "@/reseau.js";
import Automatisations from "@/automatisation.js";

import { cacheSuivi } from "@/décorateursCache.js";

import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaRetourFonctionRechercheParProfondeur,
  élémentsBd,
  PasNondéfini,
} from "@/types.js";
import {
  adresseOrbiteValide,
  faisRien,
  uneFois,
  toBuffer,
  ignorerNonDéfinis,
  sauvegarderFichierZip,
} from "@constl/utils-ipa";
import obtStockageLocal, { exporterStockageLocal } from "@/stockageLocal.js";
import ContrôleurConstellation, {
  OptionsContrôleurConstellation,
  nomType as nomTypeContrôleurConstellation,
} from "@/accès/cntrlConstellation.js";

import { MEMBRE, MODÉRATEUR, rôles } from "@/accès/consts.js";
import Base64 from "crypto-js/enc-base64.js";
import sha256 from "crypto-js/sha256.js";
import md5 from "crypto-js/md5.js";
import JSZip from "jszip";
import { isElectronMain, isNode } from "wherearewe";
import { JSONSchemaType } from "ajv";
import {
  gestionnaireOrbiteGénéral,
  type GestionnaireOrbite,
} from "@/orbite.js";

type schémaFonctionRéduction<T, U> = (branches: T) => U;

const estOrbiteDB = (x: unknown): x is OrbitDB => {
  const xCommeOrbite = (x as OrbitDB)
  return xCommeOrbite.id && xCommeOrbite.open && xCommeOrbite.stop && xCommeOrbite.ipfs
}

export type infoAccès = {
  idCompte: string;
  rôle: keyof objRôles;
};

export interface Signature {
  signature: string;
  clefPublique: string;
}

export interface optsConstellation {
  compte?: string;
  sujetRéseau?: string;
  orbite?: optsOrbite;
  protocoles?: string[];
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

export type structureBdCompte = {
  protocoles?: string;

  profil?: string;
  motsClefs?: string;
  variables?: string;
  bds?: string;
  projets?: string;
  nuées?: string;
  favoris?: string;

  réseau?: string;
  automatisations?: string;
};
export const schémaStructureBdCompte: JSONSchemaType<structureBdCompte> = {
  type: "object",
  properties: {
    protocoles: { type: "string", nullable: true },

    profil: { type: "string", nullable: true },
    motsClefs: { type: "string", nullable: true },
    variables: { type: "string", nullable: true },
    bds: { type: "string", nullable: true },
    projets: { type: "string", nullable: true },
    nuées: { type: "string", nullable: true },
    favoris: { type: "string", nullable: true },

    réseau: { type: "string", nullable: true },
    automatisations: { type: "string", nullable: true },
  },
  required: [],
};

export type structureBdProtocoles = {
  [idDispositif: string]: string[];
};
export const schémaStructureBdProtocoles: JSONSchemaType<structureBdProtocoles> =
  {
    type: "object",
    additionalProperties: {
      type: "array",
      items: {
        type: "string",
      },
    },
    required: [],
  };

export type structureNomsDispositifs = {
  [idDispositif: string]: { nom?: string; type?: string };
};
export const schémaStructureNomsDispositifs: JSONSchemaType<structureNomsDispositifs> =
  {
    type: "object",
    additionalProperties: {
      type: "object",
      properties: {
        nom: { type: "string", nullable: true },
        type: { type: "string", nullable: true },
      },
    },
    required: [],
  };

const DÉLAI_EXPIRATION_INVITATIONS = 1000 * 60 * 5; // 5 minutes

export class ClientConstellation extends EventEmitter {
  _opts: optsConstellation;
  optionsAccès?: { [key: string]: unknown };
  bdCompte?: KeyValueStore<structureBdCompte>;
  orbite?: GestionnaireOrbite;
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
  nuées?: Nuées;
  licences?: Licences;

  _orbiteExterne: boolean;
  _sfipExterne: boolean;

  prêt: boolean;
  idCompte?: string;
  encryption: Encryption;
  sujet_réseau: string;
  motsDePasseRejoindreCompte: { [key: string]: number };
  ennikkai: எண்ணிக்கை;

  verrouObtIdBd: Semaphore;

  constructor(opts: optsConstellation = {}) {
    super();
    enregistrerContrôleurs();
    this._opts = opts;

    this.prêt = false;
    this.sujet_réseau = opts.sujetRéseau || "réseau-constellation";
    this.motsDePasseRejoindreCompte = {};

    this.verrouObtIdBd = new Semaphore();

    this._orbiteExterne = this._sfipExterne = false;

    this.encryption = new EncryptionLocalFirst();
    this.ennikkai = new எண்ணிக்கை({});
  }

  async initialiser(): Promise<void> {
    const { sfip, orbite } = await this._générerSFIPetOrbite();
    this.sfip = sfip;
    this.orbite = gestionnaireOrbiteGénéral.obtGestionnaireOrbite({ orbite });

    this.idNodeSFIP = await this.sfip!.id();

    const optionsAccèsRacine = {
      type: "controlleur-constellation",
      premierMod: this.orbite!.identity.id,
      nom: "racine",
    };

    this.idCompte =
      this._opts.compte ||
      (await this.obtDeStockageLocal({
        clef: "idCompte",
        parCompte: false,
      })) ||
      undefined;
    if (!this.idCompte) {
      this.idCompte = await this.créerBdIndépendante({
        type: "kvstore",
        optionsAccès: optionsAccèsRacine,
        nom: "racine",
      });
      await this.sauvegarderAuStockageLocal({
        clef: "idCompte",
        val: this.idCompte,
        parCompte: false,
      });
    }
    this.épingles = new Épingles({ client: this });

    await this.initialiserCompte();

    this.prêt = true;
    this.emit("prêt");
  }

  async _générerSFIPetOrbite(): Promise<{ sfip: SFIP; orbite: OrbitDB }> {
    const { orbite } = this._opts;

    let sfipFinale: SFIP;
    let orbiteFinale: OrbitDB;

    const _générerSFIP = async (opts?: optsInitSFIP): Promise<SFIP> => {
      if (opts?.sfip) {
        this._sfipExterne = true;
        return opts.sfip;
      } else {
        const initSFIP = (await import("@/sfip/index.js")).default;
        return await initSFIP(opts?.dossier);
      }
    };

    if (orbite) {
      if (estOrbiteDB(orbite)) {
        this._sfipExterne = this._orbiteExterne = true;
        sfipFinale = orbite.ipfs;
        orbiteFinale = orbite;
      } else {
        // Éviter d'importer la configuration BD Orbite si pas nécessaire
        const initOrbite = (await import("@/orbite.js")).default;
        sfipFinale = await _générerSFIP(orbite.sfip);
        orbiteFinale = await initOrbite({
          sfip: sfipFinale,
          dossierOrbite: orbite.dossier,
        });
      }
    } else {
      sfipFinale = await _générerSFIP();
      const initOrbite = (await import("@/orbite.js")).default;
      orbiteFinale = await initOrbite({ sfip: sfipFinale });
    }

    return { sfip: sfipFinale, orbite: orbiteFinale };
  }

  async initialiserCompte(): Promise<void> {
    const { bd } = await this.ouvrirBd<structureBdCompte>({
      id: this.idCompte!,
      type: "kvstore",
      schéma: schémaStructureBdCompte,
    });
    this.bdCompte = bd;

    const accès = this.bdCompte.access as unknown as ContrôleurConstellation;
    this.optionsAccès = {
      type: "controlleur-constellation",
      address: accès.bd!.id,
    };

    // Protocoles
    const idBdProtocoles = await this.obtIdBd({
      nom: "protocoles",
      racine: this.bdCompte,
      type: "kvstore",
    });
    if (idBdProtocoles) {
      const { bd: bdProtocoles, fOublier: fOublierBdProtocoles } =
        await this.ouvrirBd<{ [clef: string]: string[] }>({
          id: idBdProtocoles,
          type: "kvstore",
        });
      const idDispositif = await this.obtIdDispositif();
      const protocolesExistants = bdProtocoles.get(idDispositif) || [];
      const listesÉgales = (a: Array<string>, b: Array<string>) =>
        a.length === b.length && [...a].every((v) => b.includes(v));
      if (
        !this._opts.protocoles ||
        !listesÉgales(protocolesExistants, this._opts.protocoles)
      ) {
        if (this._opts.protocoles)
          await bdProtocoles.put(idDispositif, this._opts.protocoles);
        else await bdProtocoles.del(idDispositif);
      }
      await fOublierBdProtocoles();
    } else {
      console.warn("Bd protocoles non détectée.");
    }

    // Bds orbite internes
    this.profil = new Profil({ client: this });

    this.motsClefs = new MotsClefs({ client: this });

    this.tableaux = new Tableaux({ client: this });

    this.variables = new Variables({ client: this });

    this.bds = new BDs({ client: this });

    this.projets = new Projets({ client: this });

    this.nuées = new Nuées({ client: this });

    this.réseau = new Réseau({ client: this });
    await this.réseau.initialiser();

    this.favoris = new Favoris({ client: this });

    this.automatisations = new Automatisations({ client: this });

    this.recherche = new Recherche({ client: this });

    this.licences = new Licences({ client: this });
    await this.épingler();
  }

  async épingler() {
    await this.épingles!.épinglerBd({ id: await this.obtIdCompte() }); // Celle-ci doit être récursive et inclure les fichiers
    await Promise.all(
      [
        this.profil,
        this.automatisations,
        this.bds,
        this.variables,
        this.projets,
        this.nuées,
        this.motsClefs,
        this.réseau,
        this.favoris,
      ].map(async (x) => x && (await x.épingler()))
    );
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

  @cacheSuivi
  async suivreDispositifs({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fSuivi = async ({
      id,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<string[] | undefined>;
    }): Promise<schémaFonctionOublier> => {
      const { bd, fOublier } = await this.ouvrirBd({ id, type: "kvstore" });
      const accès = bd.access;

      const typeAccès = (accès.constructor as unknown as AccessController).type;
      if (typeAccès === "ipfs") {
        await f((accès as IPFSAccessController).write);
        await fOublier();
        return faisRien;
      } else if (typeAccès === "controlleur-constellation") {
        const fFinale = async () => {
          const mods = (accès as unknown as ContrôleurConstellation).gestRôles
            ._rôles[MODÉRATEUR];
          await f(mods);
        };
        accès.on("misÀJour", fFinale);
        fFinale();
        return async () => {
          accès.off("misÀJour", fFinale);
          await fOublier();
        };
      } else {
        await fOublier();
        return faisRien;
      }
    };
    return await suivreBdDeFonction({
      fRacine: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (nouvelIdBdCible?: string | undefined) => Promise<void>;
      }): Promise<schémaFonctionOublier> => {
        if (idCompte) {
          await fSuivreRacine(idCompte);
          return faisRien;
        } else {
          return await this.suivreIdCompte({ f: fSuivreRacine });
        }
      },
      f: ignorerNonDéfinis(f),
      fSuivre: fSuivi,
    });
  }

  async nommerDispositif({
    idDispositif,
    nom,
    type,
  }: {
    idDispositif?: string;
    nom: string;
    type: string;
  }): Promise<void> {
    const idDispositifFinal = idDispositif || (await this.obtIdDispositif());

    const idBdNomsDispositifs = await this.obtIdBd({
      nom: "nomsDispositifs",
      racine: await this.obtIdCompte(),
      type: "kvstore",
    });
    const { bd: bdNomsDispositifs, fOublier } = await this.ouvrirBd<{
      [clef: string]: { nom: string; type: string };
    }>({ id: idBdNomsDispositifs!, type: "kvstore" });
    await bdNomsDispositifs.set(idDispositifFinal, { nom, type });
    await fOublier();
  }

  async suivreNomsDispositifs({
    idCompte,
    f,
  }: {
    idCompte?: string;
    f: schémaFonctionSuivi<structureNomsDispositifs>;
  }): Promise<schémaFonctionOublier> {
    const idCompteFinal = idCompte || (await this.obtIdCompte());
    return await this.suivreBdDicDeClef({
      id: idCompteFinal,
      schéma: schémaStructureNomsDispositifs,
      clef: "nomsDispositifs",
      f,
    });
  }

  async suivreNomDispositif({
    idCompte,
    idDispositif,
    f,
  }: {
    idDispositif: string;
    idCompte?: string;
    f: schémaFonctionSuivi<{ type?: string; nom?: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreNomsDispositifs({
      idCompte,
      f: async (noms) => {
        const nomsDispositif = noms[idDispositif];
        if (nomsDispositif) {
          return await f(nomsDispositif);
        }
      },
    });
  }

  async générerInvitationRejoindreCompte(): Promise<{
    idCompte: string;
    codeSecret: string;
  }> {
    const idCompte = await this.obtIdCompte();
    const codeSecret = this.encryption.clefAléatoire();
    this.motsDePasseRejoindreCompte[codeSecret] = Date.now();
    return { idCompte, codeSecret };
  }

  async révoquerInvitationRejoindreCompte({
    codeSecret,
  }: {
    codeSecret?: string;
  }): Promise<void> {
    if (codeSecret) {
      delete this.motsDePasseRejoindreCompte[codeSecret];
    } else {
      this.motsDePasseRejoindreCompte = {};
    }
  }

  async considérerRequèteRejoindreCompte({
    requète,
  }: {
    requète: ContenuMessageRejoindreCompte;
  }): Promise<void> {
    const { idDispositif, empreinteVérification } = requète;
    const maintenant = Date.now();

    for (const codeSecret of Object.keys(this.motsDePasseRejoindreCompte)) {
      const dateCodeSecret = this.motsDePasseRejoindreCompte[codeSecret];
      const dateValide =
        maintenant - dateCodeSecret < DÉLAI_EXPIRATION_INVITATIONS;
      if (dateValide) {
        const empreinteCorrespondante = this.empreinteInvitation({
          idDispositif,
          codeSecret,
        });
        if (empreinteCorrespondante === empreinteVérification) {
          // Empreinte code secret validé
          delete this.motsDePasseRejoindreCompte[codeSecret];
          await this.ajouterDispositif({ idDispositif });
        }
      }
    }
  }

  empreinteInvitation({
    idDispositif,
    codeSecret,
  }: {
    idDispositif: string;
    codeSecret: string;
  }): string {
    return Base64.stringify(sha256(idDispositif + codeSecret));
  }

  async demanderEtPuisRejoindreCompte({
    idCompte,
    codeSecret,
  }: {
    idCompte: string;
    codeSecret: string;
  }): Promise<void> {
    await this.réseau!.envoyerDemandeRejoindreCompte({
      idCompte,
      codeSecret,
    });
    await this.rejoindreCompte({
      idCompte,
    });
  }

  async ajouterDispositif({
    idDispositif,
  }: {
    idDispositif: string;
  }): Promise<void> {
    if (!this.bdCompte) await once(this, "prêt");
    const accès = this.bdCompte!.access as unknown as ContrôleurConstellation;
    accès.grant(MODÉRATEUR, idDispositif);
  }

  async enleverDispositif({
    idDispositif,
  }: {
    idDispositif: string;
  }): Promise<void> {
    if (!this.bdCompte) await once(this, "prêt");
    const accès = this.bdCompte!.access as unknown as ContrôleurConstellation;
    await accès.revoke(MODÉRATEUR, idDispositif);
  }

  async rejoindreCompte({ idCompte }: { idCompte: string }): Promise<void> {
    if (!adresseOrbiteValide(idCompte)) {
      throw new Error(`Adresse compte "${idCompte}" non valide`);
    }

    // Attendre de recevoir la permission d'écrire à idCompte
    let autorisé: boolean;
    const { bd, fOublier } = await this.ouvrirBd({
      id: idCompte,
      type: "kvstore",
      schéma: schémaStructureBdCompte,
    });
    const accès = bd.access as unknown as ContrôleurConstellation;
    const oublierPermission = await accès.suivreIdsOrbiteAutoriséesÉcriture(
      (autorisés: string[]) =>
        (autorisé = autorisés.includes(this.orbite!.identity.id))
    );
    await new Promise<void>((résoudre) => {
      const vérifierSiAutorisé = async () => {
        if (autorisé) {
          clearInterval(intervale);
          await oublierPermission();
          await fOublier();
          résoudre();
        }
      };
      const intervale = setInterval(() => {
        vérifierSiAutorisé();
      }, 10);
      vérifierSiAutorisé();
    });

    // Là on peut y aller
    this.idCompte = idCompte;
    await this.sauvegarderAuStockageLocal({
      clef: "idCompte",
      val: idCompte,
      parCompte: false,
    });
    await this.fermerCompte();
    await this.initialiserCompte();
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
      throw new Error(`Identité "${identité}" non valide.`);
    }

    const { bd, fOublier } = await this.ouvrirBd({ id: idBd, type: "kvstore" });
    const accès = bd.access;
    const typeAccès = (accès.constructor as unknown as AccessController).type;
    if (typeAccès === nomTypeContrôleurConstellation) {
      (accès as unknown as ContrôleurConstellation).grant(rôle, identité);
    }
    await fOublier();
  }

  @cacheSuivi
  async suivreIdCompte({
    f,
  }: {
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async () => {
      if (this.idCompte) await f(this.idCompte);
    };
    this.on("compteChangé", fFinale);
    await fFinale();
    return async () => {
      this.off("compteChangé", fFinale);
    };
  }

  async obtIdSFIP(): Promise<IDResult> {
    if (!this.idNodeSFIP) await once(this, "prêt");
    return this.idNodeSFIP!;
  }

  async obtIdDispositif(): Promise<string> {
    if (!this.orbite) await once(this, "prêt");
    return this.orbite!.identity.id;
  }

  async obtIdentitéOrbite(): Promise<OrbitDB["identity"]> {
    if (!this.orbite) await once(this, "prêt");
    return this.orbite!.identity;
  }

  async obtIdCompte(): Promise<string> {
    if (!this.idCompte) await once(this, "prêt");
    return this.idCompte!;
  }

  async copierContenuBdListe<T extends { [clef: string]: élémentsBd }>({
    bdBase,
    nouvelleBd,
    clef,
  }: {
    bdBase: KeyValueStore<T>;
    nouvelleBd: KeyValueStore<T>;
    clef: string;
  }): Promise<void> {
    const idBdListeInit = bdBase.get(clef);
    if (typeof idBdListeInit !== "string") return;

    const { bd: bdListeInit, fOublier: fOublierInit } = await this.ouvrirBd<T>({
      id: idBdListeInit,
      type: "feed",
    });

    const idNouvelleBdListe = nouvelleBd.get(clef);
    if (!idNouvelleBdListe) throw new Error("La nouvelle BD n'existait pas.");
    if (typeof idNouvelleBdListe !== "string")
      throw new Error(`${idNouvelleBdListe} n'est pas une adresse Orbite.`);

    const { bd: nouvelleBdListe, fOublier: fOublierNouvelle } =
      await this.ouvrirBd<T>({ id: idNouvelleBdListe, type: "feed" });

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

  async combinerBds({
    idBdBase,
    idBd2,
  }: {
    idBdBase: string;
    idBd2: string;
  }): Promise<void> {
    // Extraire le type
    const { bd, fOublier } = await this.ouvrirBd({ id: idBdBase });
    const type = bd.type;
    await fOublier();

    // Un peu dupliqué, à cause de TypeScript
    switch (type) {
      case "kvstore":
      case "keyvalue": {
        const { bd: bdBase, fOublier: fOublierBase } = await this.ouvrirBd({
          id: idBdBase,
          type: "keyvalue",
        });
        const { bd: bd2, fOublier: fOublier2 } = await this.ouvrirBd({
          id: idBd2,
          type: "keyvalue",
        });
        await this.combinerBdsDict({
          bdBase,
          bd2,
        });
        await fOublierBase();
        await fOublier2();
        break;
      }
      case "feed": {
        const { bd: bdBase, fOublier: fOublierBase } = await this.ouvrirBd({
          id: idBdBase,
          type: "feed",
        });
        const { bd: bd2, fOublier: fOublier2 } = await this.ouvrirBd({
          id: idBd2,
          type: "feed",
        });
        await this.combinerBdsListe({
          bdBase,
          bd2,
        });
        await fOublierBase();
        await fOublier2();
        break;
      }

      default:
        throw new Error(`Type de BD ${type} non supporté.`);
    }
  }

  async combinerBdsDict<
    T extends { [clef: string]: élémentsBd } = { [clef: string]: élémentsBd }
  >({
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
        await bdBase.put(c, v as T[typeof c]);
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
        if (typeof valBd2 !== "object")
          throw new Error(`Erreur combinaison listes : ${typeof valBd2}`);
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

  async suivreBd<
    U extends { [clef: string]: élémentsBd },
    T = KeyValueStore<U>
  >({
    id,
    f,
    type,
    schéma,
    événements = ["write", "replicated", "ready"],
  }: {
    id: string;
    f: schémaFonctionSuivi<T>;
    type: "kvstore" | "keyvalue";
    schéma?: JSONSchemaType<U>;
    événements?: string[];
  }): Promise<schémaFonctionOublier>;
  async suivreBd<U extends élémentsBd = élémentsBd, T = FeedStore<U>>({
    id,
    f,
    type,
    schéma,
    événements = ["write", "replicated", "ready"],
  }: {
    id: string;
    f: schémaFonctionSuivi<T>;
    type: "feed";
    schéma?: JSONSchemaType<U>;
    événements?: string[];
  }): Promise<schémaFonctionOublier>;
  async suivreBd({
    id,
    f,
    événements = ["write", "replicated", "ready"],
  }: {
    id: string;
    f: schémaFonctionSuivi<Store>;
    événements?: string[];
  }): Promise<schémaFonctionOublier>;
  async suivreBd<U, T extends Store>({
    id,
    f,
    type,
    schéma,
    événements = ["write", "replicated", "ready"],
  }: {
    id: string;
    f: schémaFonctionSuivi<T>;
    type?: "kvstore" | "keyvalue" | "feed";
    schéma?: JSONSchemaType<U>;
    événements?: string[];
  }): Promise<schémaFonctionOublier> {
    if (!adresseOrbiteValide(id))
      throw new Error(`Adresse "${id}" non valide.`);
    const fsOublier: schémaFonctionOublier[] = [];
    const promesses: { [clef: string]: Promise<void> | void } = {};

    let annulé = false;

    const lancerSuivi = () => {
      // Alambiqué, mais apparemment nécessaire pour TypeScript !
      (type === "feed"
        ? this.ouvrirBd({
            id,
            type,
            schéma: schéma as JSONSchemaType<Extract<U, élémentsBd>>,
          })
        : type
        ? this.ouvrirBd({
            id,
            type,
            schéma: schéma as JSONSchemaType<
              Extract<U, { [clef: string]: élémentsBd }>
            >,
          })
        : this.ouvrirBd({
            id,
          })
      )
        .then(({ bd, fOublier }) => {
          fsOublier.push(fOublier);

          const fFinale = () => {
            const idSuivi = uuidv4();
            const promesse = f(bd as T);

            const estUnePromesse = (x: unknown): x is Promise<void> => {
              return !!x && !!(x as Promise<void>).then;
            };

            if (estUnePromesse(promesse)) {
              promesses[idSuivi] = promesse;
              promesse.then(() => {
                delete promesses[idSuivi];
              });
            }
          };

          for (const é of événements) {
            bd.events.on(é, fFinale);
            fsOublier.push(async () => {
              bd.events.off(é, fFinale);
            });

            /* if (
              é === "write" &&
              bd.events.listenerCount("write") > bd.events.getMaxListeners()
            ) {
              console.log({id: bd.id, type: bd.type, n: bd.events.listenerCount("write")})
              console.log({f})
            } */
          }

          fFinale();
        })
        .catch((e) => {
          if (!annulé) {
            if (String(e).includes("ipfs unable to find")) {
              lancerSuivi();
            } else {
              throw new Error(e);
            }
          }
        });
    };

    lancerSuivi();

    const fOublier = async () => {
      annulé = true;
      await Promise.all(fsOublier.map((f) => f()));
      await Promise.all(Object.values(promesses));
    };
    return fOublier;
  }

  async suivreBdDeClef<T>({
    id,
    clef,
    f,
    fSuivre,
    type,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<T | undefined>;
    fSuivre: (args: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<T>;
    }) => Promise<schémaFonctionOublier>;
    type?: "kvstore" | "keyvalue" | "feed";
  }): Promise<schémaFonctionOublier> {
    const fRacine = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (nouvelIdBdCible: string | undefined) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      const fSuivreBdRacine = async (
        bd: KeyValueStore<Record<typeof clef, string>>
      ) => {
        const nouvelIdBdCible = bd.get(clef);
        return await fSuivreRacine(nouvelIdBdCible);
      };
      return await this.suivreBd({ id, f: fSuivreBdRacine, type: "keyvalue" });
    };
    return await suivreBdDeFonction<T>({ fRacine, f, fSuivre });
  }

  async suivreBdDic<T extends { [clef: string]: élémentsBd }>({
    id,
    schéma,
    f,
  }: {
    id: string;
    schéma?: JSONSchemaType<T>;
    f: schémaFonctionSuivi<T>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (bd: KeyValueStore<T>) => {
      const valeurs = bd
        ? ClientConstellation.obtObjetdeBdDic<T>({ bd })
        : ({} as T);
      await f(valeurs);
    };
    return await this.suivreBd({ id, type: "keyvalue", schéma, f: fFinale });
  }

  async suivreBdDicDeClef<T extends { [key: string]: élémentsBd }>({
    id,
    clef,
    schéma,
    f,
  }: {
    id: string;
    clef: string;
    schéma: JSONSchemaType<T>;
    f: schémaFonctionSuivi<T>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (valeurs?: T) => {
      await f(valeurs || ({} as T));
    };
    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<T>;
    }) => {
      return await this.suivreBdDic({ id, schéma, f: fSuivreBd });
    };
    return await this.suivreBdDeClef({
      id,
      clef,
      f: fFinale,
      fSuivre,
      type: "keyvalue",
    });
  }

  static obtObjetdeBdDic<T extends { [clef: string]: unknown }>({
    bd,
  }: {
    bd: KeyValueStore<T>;
  }): T {
    const valeurs = bd.all;
    return Object.fromEntries(
      Object.keys(valeurs).map((x) => {
        return [x, valeurs[x]];
      })
    ) as T;
  }

  async suivreBdListeDeClef<T extends élémentsBd>({
    id,
    clef,
    f,
    schéma,
    renvoyerValeur,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<LogEntry<T>[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur: false;
  }): Promise<schémaFonctionOublier>;
  async suivreBdListeDeClef<T extends élémentsBd>({
    id,
    clef,
    f,
    schéma,
    renvoyerValeur,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<T[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur?: true;
  }): Promise<schémaFonctionOublier>;
  async suivreBdListeDeClef<T extends élémentsBd>({
    id,
    clef,
    f,
    schéma,
    renvoyerValeur,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<T[] | LogEntry<T>[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur?: true;
  }): Promise<schémaFonctionOublier>;
  async suivreBdListeDeClef<T extends élémentsBd>({
    id,
    clef,
    f,
    schéma,
    renvoyerValeur = true,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<T[] | LogEntry<T>[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur?: boolean;
  }): Promise<schémaFonctionOublier> {
    // À faire : très laid en raison de contraintes Typescript...peut-être existe-il une meilleure façon ?
    if (renvoyerValeur) {
      const fFinale = async (valeurs?: T[]) => {
        await f(valeurs || []);
      };
      const fSuivre = async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<T[]>;
      }) => {
        return await this.suivreBdListe({
          id,
          f: fSuivreBd,
          schéma,
          renvoyerValeur,
        });
      };

      return await this.suivreBdDeClef({
        id,
        clef,
        f: fFinale,
        fSuivre,
        type: "feed",
      });
    } else {
      const fFinale = async (valeurs?: LogEntry<T>[]) => {
        await f(valeurs || []);
      };
      const fSuivre = async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<LogEntry<T>[]>;
      }) => {
        return await this.suivreBdListe({
          id,
          f: fSuivreBd,
          schéma,
          renvoyerValeur: false,
        });
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
        type: "feed",
      });
    }
  }

  async suivreBdListe<T extends élémentsBd>({
    id,
    f,
    schéma,
    renvoyerValeur,
  }: {
    id: string;
    f: schémaFonctionSuivi<T[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur?: true;
  }): Promise<schémaFonctionOublier>;

  async suivreBdListe<T extends élémentsBd>({
    id,
    f,
    schéma,
    renvoyerValeur,
  }: {
    id: string;
    f: schémaFonctionSuivi<LogEntry<T>[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur: false;
  }): Promise<schémaFonctionOublier>;

  async suivreBdListe<T extends élémentsBd>({
    id,
    f,
    schéma,
    renvoyerValeur = true,
  }: {
    id: string;
    f: schémaFonctionSuivi<T[] | LogEntry<T>[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur?: boolean;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBd({
      id,
      type: "feed",
      schéma,
      f: async (bd) => {
        const éléments = ClientConstellation.obtÉlémentsDeBdListe({
          bd,
          renvoyerValeur,
        });
        await f(éléments);
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

  async effacerÉlémentsDeBdListe<T extends élémentsBd>({
    bd,
    élément,
  }: {
    bd: FeedStore<T>;
    élément: T | ((e: LogEntry<T>) => boolean);
  }): Promise<void> {
    await Promise.all(
      bd
        .iterator({ limit: -1 })
        .collect()
        .map(async (e: LogEntry<T>) => {
          const àEffacer =
            typeof élément === "function"
              ? élément(e)
              : deepEqual(e.payload.value, élément);
          if (àEffacer) return await bd.remove(e.hash);
          return Promise.resolve();
        })
    );
  }

  async suivreTypeObjet({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<
      "motClef" | "variable" | "bd" | "projet" | "nuée" | undefined
    >;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (vals: { [key: string]: string }) => {
      let typeFinal = undefined as
        | "motClef"
        | "variable"
        | "bd"
        | "projet"
        | "nuée"
        | undefined;

      const { type } = vals;
      if (type) {
        typeFinal = ["motClef", "variable", "bd", "projet", "nuée"].includes(
          type
        )
          ? (type as "motClef" | "variable" | "bd" | "projet" | "nuée")
          : undefined;
      } else {
        if (vals.bds) typeFinal = "projet";
        else if (vals.tableaux) typeFinal = "bd";
        else if (vals.catégorie) typeFinal = "variable";
        else if (vals.nom) typeFinal = "motClef";
      }
      await f(typeFinal);
    };
    type structureObjet = {
      type?: string;
    };
    const schémaObjet: JSONSchemaType<structureObjet> = {
      type: "object",
      properties: {
        type: { type: "string", nullable: true },
      },
      additionalProperties: true,
    };

    const fOublier = await this.suivreBdDic({
      id: idObjet,
      schéma: schémaObjet,
      f: fFinale,
    });
    return fOublier;
  }

  @cacheSuivi
  async suivreEmpreinteTêtesBdRécursive({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    const obtTêteBd = (bd: Store): string => {
      const tête = bd._oplog.heads[bd._oplog.heads.length - 1]?.hash || "";
      return tête;
    };
    const calculerEmpreinte = (texte: string) => Base64.stringify(md5(texte));

    const fFinale = async (têtes: string[]) => {
      await f(calculerEmpreinte(têtes.sort().join()));
    };

    const fListe = async (
      fSuivreRacine: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBdsRécursives({
        idBd,
        f: async (bds) => await fSuivreRacine(bds),
      });
    };

    const fBranche = async (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<string>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBd({
        id,
        f: async (bd) => {
          const tête = obtTêteBd(bd);
          await fSuivreBranche(tête);
        },
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

  async suivreBdsDeFonctionListe<
    T extends élémentsBd,
    U extends PasNondéfini,
    V,
    W extends
      | schémaFonctionOublier
      | ({ fOublier: schémaFonctionOublier } & { [key: string]: unknown })
  >({
    fListe,
    f,
    fBranche,
    fIdBdDeBranche = (b) => b as string,
    fRéduction = (branches: U[]) =>
      [...new Set(branches.flat())] as unknown as V[],
    fCode = (é) => é as string,
  }: {
    fListe: (fSuivreRacine: (éléments: T[]) => Promise<void>) => Promise<W>;
    f: schémaFonctionSuivi<V[]>;
    fBranche: (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<U>,
      branche: T
    ) => Promise<schémaFonctionOublier | undefined>;
    fIdBdDeBranche?: (b: T) => string;
    fRéduction?: schémaFonctionRéduction<U[], V[]>;
    fCode?: (é: T) => string;
  }): Promise<W> {
    interface InterfaceBranches {
      données?: U;
      déjàÉvaluée: boolean;
      fOublier?: schémaFonctionOublier;
    }
    const arbre: { [key: string]: InterfaceBranches } = {};
    const dictBranches: { [key: string]: T } = {};

    let prêt = false; // Afin d'éviter d'appeler fFinale() avant que toutes les branches aient été évaluées 1 fois

    const fFinale = async () => {
      if (!prêt) return;

      // Arrêter si aucune des branches n'a encore donnée son premier résultat
      if (
        Object.values(arbre).length &&
        Object.values(arbre).every((x) => !x.déjàÉvaluée)
      )
        return;

      const listeDonnées = Object.values(arbre)
        .map((x) => x.données)
        .filter((d) => d !== undefined) as U[];
      const réduits = fRéduction(listeDonnées);
      await f(réduits);
    };
    const verrou = new Semaphore();

    const fSuivreRacine = async (éléments: Array<T>) => {
      await verrou.acquire("racine");
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

      await Promise.all(
        changés.map(async (c) => {
          if (arbre[c]) {
            const fOublier = arbre[c].fOublier;
            if (fOublier) await fOublier();
            delete arbre[c];
          }
        })
      );

      await Promise.all(
        disparus.map(async (d) => {
          const fOublier = arbre[d].fOublier;
          if (fOublier) await fOublier();
          delete arbre[d];
        })
      );

      await Promise.all(
        nouveaux.map(async (n: string) => {
          arbre[n] = {
            déjàÉvaluée: false,
          };
          const élément = dictÉléments[n];
          dictBranches[n] = élément;

          const idBdBranche = fIdBdDeBranche(élément);
          const fSuivreBranche = async (données: U) => {
            arbre[n].données = données;
            arbre[n].déjàÉvaluée = true;
            await fFinale();
          };
          const fOublier = await fBranche(idBdBranche, fSuivreBranche, élément);
          arbre[n].fOublier = fOublier;
        })
      );

      prêt = true;
      await fFinale();

      verrou.release("racine");
    };

    const retourRacine = await fListe(fSuivreRacine);

    let oublierBdRacine: schémaFonctionOublier;

    const fOublier = async () => {
      await oublierBdRacine();
      await Promise.all(
        Object.values(arbre).map((x) => x.fOublier && x.fOublier())
      );
    };
    if (typeof retourRacine === "function") {
      oublierBdRacine = retourRacine;
      return fOublier as W;
    } else {
      oublierBdRacine = retourRacine.fOublier;
      return Object.assign({}, retourRacine, { fOublier });
    }
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
    ) => Promise<schémaRetourFonctionRechercheParProfondeur>;
    f: schémaFonctionSuivi<V[]>;
    fBranche: (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<U>,
      branche: T
    ) => Promise<schémaFonctionOublier | undefined>;
    fIdBdDeBranche?: (b: T) => string;
    fRéduction?: schémaFonctionRéduction<U[], V[]>;
    fCode?: (é: T) => string;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    let _fChangerProfondeur: ((p: number) => Promise<void>) | undefined =
      undefined;
    const fChangerProfondeur = async (p: number) => {
      if (_fChangerProfondeur) await _fChangerProfondeur(p);
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

  async suivreBdSelonCondition({
    fRacine,
    fCondition,
    f,
  }: {
    fRacine: (
      fSuivreRacine: (id: string) => Promise<void>
    ) => Promise<schémaFonctionOublier>;
    fCondition: (
      id: string,
      fSuivreCondition: schémaFonctionSuivi<boolean>
    ) => Promise<schémaFonctionOublier>;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<string | undefined>;
    }): Promise<schémaFonctionOublier> => {
      return await fCondition(id, async (condition) => {
        fSuivreBd(condition ? id : undefined);
      });
    };
    return await suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => await fRacine(fSuivreRacine),
      f: ignorerNonDéfinis(f),
      fSuivre,
    });
  }

  async suivreBdsSelonCondition<
    T extends
      | schémaFonctionOublier
      | ({ fOublier: schémaFonctionOublier } & { [key: string]: unknown })
  >({
    fListe,
    fCondition,
    f,
  }: {
    fListe: (fSuivreRacine: (ids: string[]) => Promise<void>) => Promise<T>;
    fCondition: (
      id: string,
      fSuivreCondition: schémaFonctionSuivi<boolean>
    ) => Promise<schémaFonctionOublier>;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<T> {
    interface branche {
      id: string;
      état: boolean;
    }

    const fFinale = async (éléments: branche[]) => {
      const bdsRecherchées = éléments
        .filter((él) => él.état)
        .map((él) => él.id);
      return await f(bdsRecherchées);
    };

    const fBranche = async (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<branche>
    ): Promise<schémaFonctionOublier> => {
      const fFinaleSuivreBranche = async (état: boolean) => {
        return await fSuivreBranche({ id, état });
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
    const { bd, fOublier } = await this.ouvrirBd<T>({ id, type: "feed" });
    const élément = bd
      .iterator({ limit: -1 })
      .collect()
      .find((e: LogEntry<T>) => f(e));

    await fOublier();
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

  dossierOrbite(): string | undefined {
    let dossierOrbite: string | undefined;

    const optsOrbite = this._opts.orbite;
    if (estOrbiteDB(optsOrbite)) {
      dossierOrbite = optsOrbite.directory;
    } else {
      dossierOrbite = optsOrbite?.dossier || this.orbite?.orbite.directory;
    }
    return dossierOrbite;
  }

  dossierSFIP(): string | undefined {
    let dossierSFIP: string | undefined;

    const optsOrbite = this._opts.orbite;
    if (!estOrbiteDB(optsOrbite)) {
      dossierSFIP = optsOrbite?.sfip?.dossier;
    }
    return dossierSFIP;
  }

  obtClefStockageClient({
    clef,
    parCompte = true,
  }: {
    clef: string;
    parCompte?: boolean;
  }): string {
    return parCompte
      ? `${this.idCompte!.slice(
          this.idCompte!.length - 23,
          this.idCompte!.length - 8
        )} : ${clef}`
      : clef;
  }

  async obtDeStockageLocal({
    clef,
    parCompte = true,
  }: {
    clef: string;
    parCompte?: boolean;
  }): Promise<string | null> {
    const clefClient = this.obtClefStockageClient({ clef, parCompte });

    return (await obtStockageLocal(this.dossierOrbite())).getItem(clefClient);
  }

  async sauvegarderAuStockageLocal({
    clef,
    val,
    parCompte = true,
  }: {
    clef: string;
    val: string;
    parCompte?: boolean;
  }): Promise<void> {
    const clefClient = this.obtClefStockageClient({ clef, parCompte });
    return (await obtStockageLocal(this.dossierOrbite())).setItem(
      clefClient,
      val
    );
  }

  async effacerDeStockageLocal({
    clef,
    parCompte = true,
  }: {
    clef: string;
    parCompte: boolean;
  }): Promise<void> {
    const clefClient = this.obtClefStockageClient({ clef, parCompte });

    return (await obtStockageLocal(this.dossierOrbite())).removeItem(
      clefClient
    );
  }

  async ouvrirBd<
    U extends { [clef: string]: élémentsBd },
    T = KeyValueStore<U>
  >({
    id,
    type,
    schéma,
  }: {
    id: string;
    type: "kvstore" | "keyvalue";
    schéma?: JSONSchemaType<U>;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<U extends élémentsBd, T = FeedStore<U>>({
    id,
    type,
    schéma,
  }: {
    id: string;
    type: "feed";
    schéma?: JSONSchemaType<U>;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends Store>({
    id,
  }: {
    id: string;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<
    U,
    T extends
      | Store
      | KeyValueStore<{ [clef: string]: élémentsBd }>
      | FeedStore<élémentsBd>
  >({
    id,
    type,
    schéma,
  }: {
    id: string;
    schéma?: JSONSchemaType<U>;
    type?: "kvstore" | "keyvalue" | "feed";
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<
    U,
    T extends
      | Store
      | KeyValueStore<{ [clef: string]: élémentsBd }>
      | FeedStore<élémentsBd>
  >({
    id,
    type,
    schéma,
  }: {
    id: string;
    schéma?: JSONSchemaType<U>;
    type?: "kvstore" | "keyvalue" | "feed";
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }> {
    return await this.orbite!.ouvrirBd({ id, type, schéma });
  }

  async obtIdBd<K extends string>({
    nom,
    racine,
    type,
  }: {
    nom: K;
    racine:
      | string
      | KeyValueStore<Partial<Record<K, string>> & { [clef: string]: unknown }>;
    type?: "feed" | "keyvalue" | "kvstore";
  }): Promise<string | undefined>;
  async obtIdBd<K extends string>({
    nom,
    racine,
    type,
  }: {
    nom: K;
    racine:
      | string
      | KeyValueStore<Partial<Record<K, string>> & { [clef: string]: unknown }>;
    type?: "feed" | "keyvalue" | "kvstore";
  }): Promise<string>;
  async obtIdBd<K extends string>({
    nom,
    racine,
    type,
  }: {
    nom: K;
    racine:
      | string
      | KeyValueStore<Partial<Record<K, string>> & { [clef: string]: unknown }>;
    type?: "feed" | "keyvalue" | "kvstore";
  }): Promise<string | undefined> {
    let bdRacine: KeyValueStore<Partial<Record<K, string>>>;
    let fOublier: schémaFonctionOublier | undefined;

    if (typeof racine === "string") {
      ({ bd: bdRacine, fOublier } = await this.ouvrirBd<Record<K, string>>({
        id: racine,
        type: "kvstore",
      }));
    } else {
      bdRacine = racine;
    }

    const clefRequète = bdRacine.id + ":" + nom;
    await this.verrouObtIdBd.acquire(clefRequète);

    let idBd = bdRacine.get(nom);

    const idBdPrécédente = await this.obtDeStockageLocal({ clef: clefRequète });

    if (idBd && idBdPrécédente && idBd !== idBdPrécédente) {
      try {
        await this.combinerBds({
          idBdBase: idBd,
          idBd2: idBdPrécédente,
        });

        await this.effacerBd({ id: idBdPrécédente });
        await this.sauvegarderAuStockageLocal({ clef: clefRequète, val: idBd });
      } catch {
        // Rien à faire ; on démissionne !
      }
    }

    // Nous devons confirmer que la base de données spécifiée était du bon genre
    if (idBd && type) {
      try {
        const { fOublier } = await this.ouvrirBd({ id: idBd, type });
        await fOublier();

        this.verrouObtIdBd.release(clefRequète);
        return idBd;
      } catch {
        this.verrouObtIdBd.release(clefRequète);
        throw new Error("Bd n'existe pas : " + nom + " " + idBd);
      }
    }

    if (!idBd && type) {
      const accès = bdRacine.access as unknown as ContrôleurConstellation;
      const permission = await uneFois((f: schémaFonctionSuivi<boolean>) =>
        accès.suivreIdsOrbiteAutoriséesÉcriture(
          async (autorisés: string[]) =>
            await f(autorisés.includes(this.orbite!.identity.id))
        )
      );

      if (permission) {
        const optionsAccès = await this.obtOpsAccès({
          idBd: bdRacine.id,
        });
        idBd = await this.créerBdIndépendante({ type, optionsAccès });
        await bdRacine.set(nom, idBd);
      }
    }

    if (idBd)
      await this.sauvegarderAuStockageLocal({ clef: clefRequète, val: idBd });

    if (fOublier) await fOublier();

    this.verrouObtIdBd.release(clefRequète);
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
    return await this.orbite!.créerBdIndépendante({
      type,
      optionsAccès: Object.assign({}, this.optionsAccès, optionsAccès || {}),
      nom,
    });
  }

  async effacerBd({ id }: { id: string }): Promise<void> {
    return await this.orbite?.effacerBd({ id });
  }

  async obtOpsAccès({
    idBd,
  }: {
    idBd: string;
  }): Promise<OptionsContrôleurConstellation> {
    const { bd, fOublier } = await this.ouvrirBd({ id: idBd });
    const accès = bd.access as unknown as ContrôleurConstellation;

    await fOublier();
    return {
      address: accès.bd!.id,
      premierMod: accès._premierMod,
    };
  }

  @cacheSuivi
  async suivrePermission({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<(typeof rôles)[number] | undefined>;
  }): Promise<schémaFonctionOublier> {
    const { bd, fOublier } = await this.ouvrirBd({ id: idObjet });
    const accès = bd.access;
    const typeAccès = (accès.constructor as unknown as AccessController).type;

    if (typeAccès === "ipfs") {
      const moi = this.orbite!.identity.id;
      await f(
        (accès as IPFSAccessController).write.includes(moi) ? MEMBRE : undefined
      );
      await fOublier();
      return faisRien;
    } else if (typeAccès === nomTypeContrôleurConstellation) {
      const fFinale = async (utilisateurs: infoUtilisateur[]) => {
        const mesRôles = utilisateurs
          .filter((u) => u.idCompte === this.idCompte)
          .map((u) => u.rôle);
        const rôlePlusPuissant = mesRôles.includes(MODÉRATEUR)
          ? MODÉRATEUR
          : mesRôles.includes(MEMBRE)
          ? MEMBRE
          : undefined;
        await f(rôlePlusPuissant);
      };
      const fOublierSuivreAccès = await (
        accès as unknown as ContrôleurConstellation
      ).suivreUtilisateursAutorisés(fFinale);
      return async () => {
        await fOublierSuivreAccès();
        await fOublier();
      };
    } else {
      throw new Error(`Type d'accès ${typeAccès} non reconnu.`);
    }
  }

  @cacheSuivi
  async suivrePermissionÉcrire({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<boolean>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (rôle?: (typeof rôles)[number]) => {
      await f(rôle !== undefined);
    };
    return await this.suivrePermission({ idObjet: id, f: fFinale });
  }

  @cacheSuivi
  async suivreAccèsBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<infoAccès[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (bd: Store) => {
      const accès = bd.access;
      const typeAccès = (accès.constructor as unknown as AccessController).type;
      if (typeAccès === "ipfs") {
        const listeAccès: infoAccès[] = (
          accès as IPFSAccessController
        ).write.map((id) => {
          return {
            idCompte: id,
            rôle: MODÉRATEUR,
          };
        });
        await f(listeAccès);
      } else if (typeAccès === nomTypeContrôleurConstellation) {
        const fOublierAutorisés = await (
          accès as unknown as ContrôleurConstellation
        ).suivreUtilisateursAutorisés(f);
        return fOublierAutorisés;
      }
      return faisRien;
    };
    return await this.suivreBd({
      id,
      f: fFinale,
    });
  }

  @cacheSuivi
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

    const fFinale = async () => {
      await f(Object.keys(dicBds));
    };

    const verrou = new Semaphore();

    const enleverRequètesDe = async (de: string) => {
      delete dicBds[de];
      await Promise.all(
        Object.keys(dicBds).map(async (id) => {
          if (!dicBds[id]) return;
          dicBds[id].requètes.delete(de);
          if (!dicBds[id].requètes.size) {
            await dicBds[id].fOublier();
          }
        })
      );
    };

    // On ne suit pas automatiquement les BDs ou tableaux dont celui d'intérêt a été copié...ça pourait être très volumineu
    const clefsÀExclure = ["copiéDe"];

    const _suivreBdsRécursives = async (
      id: string,
      de: string
    ): Promise<void> => {
      const extraireÉléments = (l_vals: élémentsBd[]): string[] => {
        return l_vals
          .map((v) => {
            if (typeof v === "string") return [v];
            if (Array.isArray(v)) return v;
            if (typeof v === "object") return Object.values(v);
            return [];
          })
          .flat()
          .filter((v) => adresseOrbiteValide(v)) as string[];
      };

      const fSuivreBd = async (
        vals: { [clef: string]: élémentsBd } | élémentsBd[]
      ) => {
        // Cette fonction détectera les éléments d'une liste ou d'un dictionnaire
        // (à un niveau de profondeur) qui représentent une adresse de BD Orbit.
        let idsOrbite: string[] = [];

        if (typeof vals === "object") {
          idsOrbite = extraireÉléments(
            Object.entries(vals)
              .filter((x) => !clefsÀExclure.includes(x[0]))
              .map((x) => x[1])
          );
          idsOrbite.push(...extraireÉléments(Object.keys(vals)));
        } else if (Array.isArray(vals)) {
          idsOrbite = extraireÉléments(vals);
        } else if (typeof vals === "string") {
          idsOrbite = [vals];
        }
        const nouvelles = idsOrbite.filter(
          (id_) => !dicBds[id].sousBds.includes(id_)
        );
        const obsolètes = dicBds[id].sousBds.filter(
          (id_) => !idsOrbite.includes(id_)
        );

        dicBds[id].sousBds = idsOrbite;

        await Promise.all(
          obsolètes.map(async (o) => {
            dicBds[o].requètes.delete(id);
            if (!dicBds[o].requètes.size) await dicBds[o].fOublier();
          })
        );
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
      await fOublier();

      dicBds[id] = {
        requètes: new Set([de]),
        sousBds: [],
        fOublier: async () => {
          await fOublierSuiviBd();
          await enleverRequètesDe(id);
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

    const fOublier = async () => {
      await Promise.all(Object.values(dicBds).map((v) => v.fOublier()));
    };
    return fOublier;
  }

  async fermerCompte(): Promise<void> {
    if (this.réseau) await this.réseau.fermer();
    if (this.favoris) await this.favoris.fermer();

    if (this.automatisations) await this.automatisations.fermer();
  }

  async fermer(): Promise<void> {
    await (await obtStockageLocal(this.dossierOrbite())).fermer?.();
    await this.fermerCompte();
    if (this.épingles) await this.épingles.fermer();

    await this.orbite!.fermer({ arrêterOrbite: !this._orbiteExterne });
    if (this.sfip && !this._sfipExterne) await this.sfip.stop();
  }

  async effacerDispositif(): Promise<void> {
    await this.fermer();
    if (indexedDB) {
      if (indexedDB.databases) {
        const indexedDbDatabases = await indexedDB.databases();
        await Promise.all(
          indexedDbDatabases.map((bd) => {
            if (bd.name) indexedDB.deleteDatabase(bd.name);
          })
        );
      } else {
        console.warn("On a pas pu tout effacer.");
      }
    } else {
      const fs = await import("fs");
      const dossierOrbite = this.dossierOrbite();
      const dossierSFIP = this.dossierSFIP();
      if (dossierOrbite) fs.rmdirSync(dossierOrbite);
      if (dossierSFIP) fs.rmdirSync(dossierSFIP);
      const stockageLocal = await obtStockageLocal();
      stockageLocal.clear();
    }
  }

  async exporterDispositif({
    nomFichier,
  }: {
    nomFichier: string;
  }): Promise<void> {
    if (isNode || isElectronMain) {
      const fs = await import("fs");
      const path = await import("path");

      const ajouterDossierÀZip = ({
        dossier,
        zip,
      }: {
        dossier: string;
        zip: JSZip;
      }): void => {
        const dossiers = fs.readdirSync(dossier);
        dossiers.map((d) => {
          const stat = fs.statSync(d);
          if (stat?.isDirectory()) {
            ajouterDossierÀZip({
              dossier: path.join(dossier, d),
              zip: zip.folder(d)!,
            });
          } else {
            const fluxFichier = fs.createReadStream(path.join(dossier, d));
            zip.file(d, fluxFichier);
          }
        });
      };
      const dossierOrbite = this.dossierOrbite();
      const dossierSFIP = this.dossierSFIP();
      if (!dossierOrbite || !dossierSFIP)
        throw new Error("Constellation pas encore initialisée.");
      const donnéesStockageLocal = await exporterStockageLocal();

      const zip = new JSZip();
      ajouterDossierÀZip({
        dossier: dossierOrbite,
        zip: zip.folder("orbite")!,
      });
      ajouterDossierÀZip({ dossier: dossierSFIP, zip: zip.folder("sfip")! });
      zip.file("stockageLocal", donnéesStockageLocal);
      await sauvegarderFichierZip({ fichierZip: zip, nomFichier });
    } else if (indexedDB) {
      const sauvegarderBdIndexeÀZip = ({
        bd,
        zip,
      }: {
        bd: IDBDatabaseInfo;
        zip: JSZip;
      }) => {
        const { name: nomBd } = bd;
        if (nomBd) {
          const dossierZipBd = zip.folder(nomBd);
          if (!dossierZipBd) throw new Error(nomBd);
          const bdOuverte = indexedDB.open(nomBd).result;
          const tableauxBdIndexe = bdOuverte.objectStoreNames;
          const listeTableaux = [...Array(tableauxBdIndexe.length).keys()]
            .map((i) => tableauxBdIndexe.item(i))
            .filter((x) => !!x) as string[];
          listeTableaux.map((tbl) =>
            dossierZipBd.file(
              tbl,
              new indexedDbStream.IndexedDbReadStream({
                databaseName: nomBd,
                objectStoreName: tbl,
              })
            )
          );
        }
      };
      const fichierZip = new JSZip();

      if (indexedDB.databases) {
        const indexedDbDatabases = await indexedDB.databases();
        const dossierZipIndexe = fichierZip.folder("bdIndexe");
        if (!dossierZipIndexe) throw new Error("Erreur Bd Indexe...");
        indexedDbDatabases.forEach((bd) => {
          sauvegarderBdIndexeÀZip({ bd, zip: dossierZipIndexe });
        });
        fichierZip.file(
          "stockageLocal",
          JSON.stringify(await exporterStockageLocal())
        );
      }

      await sauvegarderFichierZip({ fichierZip, nomFichier });
    } else {
      throw new Error("Sauvegarde non implémenté.");
    }
  }

  /*
  async rétablirDispositif({
    stockageLocal,
  }: {
    stockageLocal: string;
  }): Promise<void> {
    await this.effacerDispositif();

    if (isNode || isElectronMain) {
    } else {
    }

    const donnéesStockageLocal = JSON.parse(stockageLocal);
  }*/

  static async créer(
    opts: optsConstellation = {}
  ): Promise<ClientConstellation> {
    const client = new ClientConstellation(opts);
    await client.initialiser();
    return client;
  }
}

export default ClientConstellation;
