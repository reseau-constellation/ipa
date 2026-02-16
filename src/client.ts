import { எண்ணிக்கை } from "ennikkai";
import { sauvegarderFichierZip } from "@constl/utils-ipa";

import sha256 from "crypto-js/sha256.js";
import { randomBytes } from "@noble/hashes/utils";
import bs58 from "bs58";

import JSZip from "jszip";
import { isElectronMain, isNode } from "wherearewe";
import { TypedEmitter } from "tiny-typed-emitter";

import { Protocoles } from "./protocoles.js";
import type { ÉpingleCompte } from "@/favoris.js";
import type { Helia } from "helia";
import type { JSONSchemaType } from "ajv";
import type { Libp2p } from "@libp2p/interface";
import type { ServicesLibp2p } from "@/sfip/index.js";
import type { ContenuMessageRejoindreCompte } from "@/reseau.js";
import type { createOrbitDB, OrbitDB } from "@orbitdb/core";
import type { type GestionnaireOrbite } from "@/orbite.js";
import { TOUS } from "@/favoris.js";
import { Épingles } from "@/epingles.js";
import { exporterStockageLocal } from "@/stockageLocal.js";

type ÉvénementsClient<T extends ServicesLibp2p = ServicesLibp2p> = {
  comptePrêt: (args: { idCompte: string }) => void;
  erreurInitialisation: (args: Error) => void;
  sfipEtOrbitePrêts: (args: {
    sfip: Helia<Libp2p<T>>;
    orbite: GestionnaireOrbite;
  }) => void;
};

export interface Signature {
  signature: string;
  clefPublique: string;
}

export interface optsConstellation<T extends ServicesLibp2p = ServicesLibp2p> {
  dossier?: string;
  domaines?: string[];
  pairsParDéfaut?: string[];
  sujetRéseau?: string;
  protocoles?: string[];
  orbite?: optsOrbite<T>;
  messageVerrou?: string;
}

export type optsInitOrbite<T extends ServicesLibp2p = ServicesLibp2p> = Omit<
  Parameters<typeof createOrbitDB>[0],
  "ipfs" | "directory"
> & {
  directory?: string;
  ipfs?: Helia<Libp2p<T>>;
};

export type optsOrbite<T extends ServicesLibp2p = ServicesLibp2p> =
  | OrbitDB<T>
  | optsInitOrbite<T>;

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

const join = async (...args: string[]) => {
  if (isNode || isElectronMain) {
    // Utiliser l'application native
    const { join } = await import("path");
    return join(...args);
  } else {
    return args.join("/");
  }
};

export class Constellation<T extends ServicesLibp2p = ServicesLibp2p> {
  événements: TypedEmitter<ÉvénementsClient<T>>;

  épingles: Épingles;

  erreurInitialisation?: Error;
  _orbiteExterne: boolean;
  _sfipExterne: boolean;

  idCompte?: string;
  sujet_réseau: string;
  motsDePasseRejoindreCompte: { [key: string]: number };
  ennikkai: எண்ணிக்கை;

  _intervaleVerrou?: NodeJS.Timeout;
  signaleurArrêt: AbortController;

  constructor(opts: optsConstellation<T> = {}) {
    this.événements = new TypedEmitter<ÉvénementsClient<T>>();
    this.signaleurArrêt = new AbortController();

    this.sujet_réseau = opts.sujetRéseau || "réseau-constellation";
    this.motsDePasseRejoindreCompte = {};

    this._orbiteExterne = this._sfipExterne = false;

    this.ennikkai = new எண்ணிக்கை({});

    this.épingles = new Épingles({ client: this });

    this.protocoles = new Protocoles({
      client: this,
      protocoles: this._opts.protocoles,
    });

    this._initialiser();
  }

  async _initialiser(): Promise<void> {
    const épingle: ÉpingleCompte = {
      type: "compte",
      base: TOUS,
      profil: {
        type: "profil",
        base: TOUS,
        fichiers: TOUS,
      },
      favoris: TOUS,
    };
    await this.épinglerCompte({
      idCompte: this.idCompte,
      options: épingle,
    });
  }

  async générerInvitationRejoindreCompte(): Promise<{
    idCompte: string;
    codeSecret: string;
  }> {
    const idCompte = await this.obtIdCompte();
    const codeSecret = bs58.encode(randomBytes(6 * 3)).slice(0, 6);
    this.motsDePasseRejoindreCompte[codeSecret] = Date.now();
    const idDispositif = await this.obtIdDispositif();
    return { idCompte, codeSecret: `${idDispositif}:${codeSecret}` };
  }

  async révoquerInvitationRejoindreCompte({
    codeSecret,
  }: {
    codeSecret?: string;
  }): Promise<void> {
    if (codeSecret) {
      const codeSecretOriginal = codeSecret.split(":")[1];
      delete this.motsDePasseRejoindreCompte[codeSecretOriginal];
    } else {
      this.motsDePasseRejoindreCompte = {};
    }
  }

  async considérerRequêteRejoindreCompte({
    requête,
  }: {
    requête: ContenuMessageRejoindreCompte;
  }): Promise<void> {
    const { idDispositif, empreinteVérification } = requête;
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
    await this.réseau.envoyerDemandeRejoindreCompte({
      codeSecret,
    });
    await this.rejoindreCompte({
      idCompte,
    });
  }

  async obtIdentitéOrbite(): Promise<OrbitDB["identity"]> {
    const { orbite } = await this.attendreSfipEtOrbite();
    return orbite.identity;
  }

  // Exportation compte

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
      const zip = new JSZip();
      ajouterDossierÀZip({
        dossier: await this.dossier(),
        zip,
      });

      await sauvegarderFichierZip({ fichierZip: zip, nomFichier });
    } else if (indexedDB?.databases) {
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
              }),
            ),
          );
        }
      };
      const fichierZip = new JSZip();

      const indexedDbDatabases = await indexedDB.databases();
      const dossierZipIndexe = fichierZip.folder("bdIndexe");
      if (!dossierZipIndexe) throw new Error("Erreur Bd Indexe...");
      indexedDbDatabases.forEach((bd) => {
        sauvegarderBdIndexeÀZip({ bd, zip: dossierZipIndexe });
      });
      fichierZip.file(
        "stockageLocal",
        JSON.stringify(await exporterStockageLocal(await this.dossier())),
      );

      await sauvegarderFichierZip({ fichierZip, nomFichier });
    } else {
      throw new Error("Sauvegarde non implémentée.");
    }
  }

  async rétablirDispositif({
    données,
  }: {
    données: Parameters<JSZip["loadAsync"]>[0];
  }): Promise<void> {
    const dossier = await this.dossier();
    await this.effacer();
    const zip = JSZip.loadAsync(données);
    if (isNode || isElectronMain) {
      throw new Error("Non implémenté");
    } else {
      throw new Error("Non implémenté");
    }
  }
}
