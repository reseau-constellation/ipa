import { எண்ணிக்கை } from "ennikkai";
import indexedDbStream from "indexed-db-stream";
import {
  suivreDeFonctionListe,
  sauvegarderFichierZip,
} from "@constl/utils-ipa";
import { ERREUR_INIT_IPA_DÉJÀ_LANCÉ } from "@constl/mandataire";

import sha256 from "crypto-js/sha256.js";
import { randomBytes } from "@noble/hashes/utils";
import bs58 from "bs58";

import JSZip from "jszip";
import { isElectronMain, isNode } from "wherearewe";
import { TypedEmitter } from "tiny-typed-emitter";
import { Automatisations } from "@/automatisation.js";
import { Licences } from "@/licences.js";
import { Réseau } from "@/reseau.js";

import { Protocoles } from "./protocoles.js";
import type {
  Jsonifiable,
  PartielRécursif,
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaRetourFonctionRechercheParProfondeur,
  élémentsBd,
} from "@/types.js";
import type { ÉpingleCompte } from "@/favoris.js";
import type { Helia } from "helia";
import type { JSONSchemaType } from "ajv";
import type { Libp2p } from "@libp2p/interface";
import type { ServiceConstellation } from "./v2/nébuleuse/services.js";
import type { ServicesLibp2p } from "@/sfip/index.js";
import type { ContenuMessageRejoindreCompte } from "@/reseau.js";
import type { createOrbitDB, OrbitDB } from "@orbitdb/core";
import type { structureBdProfil } from "@/profil.js";
import type {
  type GestionnaireOrbite,
  gestionnaireOrbiteGénéral,
} from "@/orbite.js";
import { Tableaux } from "@/tableaux.js";
import { Nuées } from "@/nuées.js";
import { Recherche } from "@/recherche/index.js";
import { Projets } from "@/projets.js";
import { Favoris, TOUS } from "@/favoris.js";
import { Épingles } from "@/epingles.js";
import { MotsClefs } from "@/motsClefs.js";
import { Variables } from "@/variables.js";
import { Profil, schémaStructureBdProfil } from "@/profil.js";
import { BDs } from "@/bds.js";
import stockageLocal, { exporterStockageLocal } from "@/stockageLocal.js";

type schémaFonctionRéduction<T, U> = (branches: T) => U;

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

export type structureBdCompte = {
  protocoles: string;
  nomsDispositifs: string;

  profil: structureBdProfil;
  motsClefs: string;
  variables: string;
  bds: string;
  projets: string;
  nuées: string;
  favoris: string;

  réseau?: string;
  automatisations?: string;
};

export const schémaStructureBdCompte: JSONSchemaType<
  PartielRécursif<structureBdCompte>
> = {
  type: "object",
  properties: {
    protocoles: { type: "string", nullable: true },
    nomsDispositifs: { type: "string", nullable: true },

    profil: schémaStructureBdProfil,
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

export type ServicesConstellation = {
  [clef: string]: ServiceConstellation;
};
export type ServicesDéfautConstellation = {
  profil: Profil;
};

export class Constellation<T extends ServicesLibp2p = ServicesLibp2p> {
  _opts: optsConstellation<T>;
  événements: TypedEmitter<ÉvénementsClient<T>>;

  orbite?: GestionnaireOrbite;
  sfip?: Helia<Libp2p<T>>;

  épingles: Épingles;
  profil: Profil;
  bds: BDs;
  tableaux: Tableaux;
  variables: Variables;
  réseau: Réseau;
  favoris: Favoris;
  projets: Projets;
  recherche: Recherche;
  motsClefs: MotsClefs;
  automatisations: Automatisations;
  nuées: Nuées;
  licences: Licences;
  protocoles: Protocoles;

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
    this._opts = opts;

    this.événements = new TypedEmitter<ÉvénementsClient<T>>();
    this.signaleurArrêt = new AbortController();

    this.sujet_réseau = opts.sujetRéseau || "réseau-constellation";
    this.motsDePasseRejoindreCompte = {};

    this._orbiteExterne = this._sfipExterne = false;

    this.ennikkai = new எண்ணிக்கை({});

    this.épingles = new Épingles({ client: this });

    this.profil = new Profil({ client: this });

    this.motsClefs = new MotsClefs({ client: this });

    this.tableaux = new Tableaux({ client: this });

    this.variables = new Variables({ client: this });

    this.bds = new BDs({ client: this });

    this.projets = new Projets({ client: this });

    this.nuées = new Nuées({ client: this });

    this.favoris = new Favoris({ client: this });

    this.automatisations = new Automatisations({ client: this });

    this.recherche = new Recherche({ client: this });

    this.licences = new Licences({ client: this });

    this.réseau = new Réseau({ client: this });

    this.protocoles = new Protocoles({
      client: this,
      protocoles: this._opts.protocoles,
    });

    this._initialiser();
  }

  async _initialiser(): Promise<void> {
    try {
      await this.verrouillerDossier({ message: this._opts.messageVerrou });
    } catch (e) {
      this.erreurInitialisation = e;
      this.événements.emit("erreurInitialisation", e);
      return;
    }

    const { sfip, orbite } = await this._générerSFIPetOrbite();
    this.sfip = sfip;
    this.orbite = gestionnaireOrbiteGénéral.obtGestionnaireOrbite({
      orbite,
      signaleurArrêt: this.signaleurArrêt,
    });
    this.événements.emit("sfipEtOrbitePrêts", { sfip, orbite: this.orbite });

    this.idCompte =
      (await this.obtDeStockageLocal({
        clef: "idCompte",
        parCompte: false,
      })) || undefined;
    if (!this.idCompte) {
      this.idCompte = await this._créerBdCompte({ orbite });

      await this.nommerDispositif({
        type: this.détecterTypeDispositif(),
      });

      await this.sauvegarderAuStockageLocal({
        clef: "idCompte",
        val: this.idCompte,
        parCompte: false,
      });
    }

    await this._initialiserComposantes();
    this.événements.emit("comptePrêt", { idCompte: this.idCompte });

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

  async verrouillerDossier({ message }: { message?: string }): Promise<void> {
    const intervaleVerrou = 5000; // 5 millisecondes
    if (isElectronMain || isNode) {
      const fs = await import("fs");
      const fichierVerrou = await join(await this.dossier(), "VERROU");
      const maintenant = new Date();
      if (!fs.existsSync(fichierVerrou)) {
        fs.writeFileSync(fichierVerrou, message || "");
      } else {
        const infoFichier = fs.statSync(fichierVerrou);
        const modifiéÀ = infoFichier.mtime;
        const verifierSiVieux = () => {
          if (maintenant.getTime() - modifiéÀ.getTime() > intervaleVerrou) {
            fs.writeFileSync(fichierVerrou, message || "");
          } else {
            const contenuFichier = new TextDecoder().decode(
              fs.readFileSync(fichierVerrou),
            );
            try {
              const messageJSON = JSON.parse(contenuFichier);
              if (messageJSON["port"]) {
                const erreur = new Error(
                  `Ce compte est déjà ouvert en Constellation, et le serveur local est disponible sur le port ${messageJSON["port"]}. Vous pouvez soit vous connecter sur ce port, soit fermer les instances de Constellation qui ouvertes et puis vous ressayer.`,
                );
                erreur.name = ERREUR_INIT_IPA_DÉJÀ_LANCÉ;
                throw erreur;
              }
            } catch {
              //
            }
            const erreur = new Error("Constellation est déjà lancée.");
            erreur.name = ERREUR_INIT_IPA_DÉJÀ_LANCÉ;
            throw erreur;
          }
        };
        try {
          verifierSiVieux();
        } catch {
          await new Promise((résoudre) =>
            setTimeout(résoudre, intervaleVerrou),
          );
          verifierSiVieux();
        }
      }
      this._intervaleVerrou = setInterval(() => {
        try {
          fs.utimesSync(fichierVerrou, maintenant, maintenant);
        } catch {
          // On s'inquiète pas trop
        }
      }, intervaleVerrou);
    }
  }

  async spécifierMessageVerrou({
    message,
  }: {
    message: Jsonifiable;
  }): Promise<void> {
    await this.attendreInitialisée();
    if (isElectronMain || isNode) {
      const fs = await import("fs");
      const fichierVerrou = await join(await this.dossier(), "VERROU");
      const contenu = JSON.parse(fs.readFileSync(fichierVerrou).toString());
      const contenuFinal = Object.assign(contenu, message);
      fs.writeFileSync(fichierVerrou, JSON.stringify(contenuFinal));
    }
  }

  async effacerVerrou() {
    if (isElectronMain || isNode) {
      if (this._intervaleVerrou) clearInterval(this._intervaleVerrou);
      const fs = await import("fs");
      fs.rmSync(await join(await this.dossier(), "VERROU"));
    }
  }

  async signer({ message }: { message: string }): Promise<Signature> {
    const { orbite } = await this.attendreSfipEtOrbite();
    const id = orbite.identity;
    const signature = await orbite.identity.sign(id, message);
    const clefPublique = orbite.identity.publicKey;
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
    const { orbite } = await this.attendreSfipEtOrbite();
    return await orbite.identity.verify(
      signature.signature,
      signature.clefPublique,
      message,
    );
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

  async suivreBdsDeFonctionRecherche<T extends élémentsBd, U, V>({
    fListe,
    f,
    fBranche,
    fIdDeBranche = (b) => b as string,
    fRéduction = (branches: U[]) =>
      [...new Set(branches.flat())] as unknown as V[],
  }: {
    fListe: (
      fSuivreRacine: (éléments: T[]) => Promise<void>,
    ) => Promise<schémaRetourFonctionRechercheParProfondeur>;
    f: schémaFonctionSuivi<V[]>;
    fBranche: ({
      id,
      fSuivreBranche,
      branche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<U>;
      branche: T;
    }) => Promise<schémaFonctionOublier | undefined>;
    fIdDeBranche?: (b: T) => string;
    fRéduction?: schémaFonctionRéduction<U[], V[]>;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    let _fChangerProfondeur: ((p: number) => Promise<void>) | undefined =
      undefined;
    const fChangerProfondeur = async (p: number) => {
      if (_fChangerProfondeur) await _fChangerProfondeur(p);
    };

    const fListeFinale = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: T[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      const { fOublier: fOublierL, fChangerProfondeur: fChangerL } =
        await fListe(fSuivreRacine);
      _fChangerProfondeur = fChangerL;
      return fOublierL;
    };

    const fOublier = await suivreDeFonctionListe({
      fListe: fListeFinale,
      f,
      fBranche,
      fIdDeBranche,
      fRéduction,
    });
    return { fOublier, fChangerProfondeur };
  }

  async fermer(): Promise<void> {
    // Effacer fichier verrou
    await this.effacerVerrou();
  }

  async effacerDispositif(): Promise<void> {
    await this.fermer();
    if (indexedDB) {
      if (indexedDB.databases) {
        const indexedDbDatabases = await indexedDB.databases();
        await Promise.allSettled(
          indexedDbDatabases.map((bd) => {
            if (bd.name) indexedDB.deleteDatabase(bd.name);
          }),
        );
      } else {
        console.warn("On a pas pu tout effacer.");
      }
    } else {
      const fs = await import("fs");
      const stockageLocal_ = await stockageLocal(await this.dossier());
      stockageLocal_.clear();
      fs.rmdirSync(await this.dossier());
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

  async rétablirDispositif(): Promise<void> {
    await this.effacerDispositif();

    if (isNode || isElectronMain) {
      throw new Error("Non implémenté");
    } else {
      throw new Error("Non implémenté");
    }
  }
}
