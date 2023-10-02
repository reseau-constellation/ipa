import { isValidAddress } from "@orbitdb/core";

import type { PeersResult } from "ipfs-core-types/src/swarm";
import type { Message as MessagePubSub } from "@libp2p/interface-pubsub";
import type { Libp2p, Libp2pEvents } from "libp2p";

import { EventEmitter } from "events";
import sum from "lodash/sum.js";
import Semaphore from "@chriscdn/promise-semaphore";

import générerContrôleurConstellation from "@/accès/cntrlConstellation.js";
import ClientConstellation, {
  Signature,
  infoAccès,
  schémaStructureBdCompte,
} from "@/client.js";
import type {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaRetourFonctionRechercheParN,
  schémaRetourFonctionRechercheParProfondeur,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuivreQualitéRecherche,
  schémaFonctionSuivreConfianceRecherche,
  infoRésultatRecherche,
  infoAuteur,
  infoRésultat,
  résultatObjectifRecherche,
  résultatRecherche,
  schémaFonctionSuiviRecherche,
} from "@/types.js";
import { faisRien } from "@constl/utils-ipa";
import type { infoScore } from "@/bds.js";
import type { élémentBdListeDonnées, élémentDonnées } from "@/tableaux.js";
import type {
  ÉlémentFavoris,
  ÉlémentFavorisAvecObjet,
  épingleDispositif,
} from "@/favoris.js";
import type { erreurValidation } from "@/valid.js";
import { rechercherProfilsSelonActivité } from "@/recherche/profil.js";
import { rechercherTous } from "@/recherche/utils.js";
import {
  cacheRechercheParNRésultats,
  cacheRechercheParProfondeur,
  cacheSuivi,
} from "@/décorateursCache.js";
import { v4 as uuidv4 } from "uuid";
import { ComposanteClientDic } from "./composanteClient.js";
import { JSONSchemaType } from "ajv";
import { suivreBdDeFonction } from "@constl/utils-ipa";
import { estUnContrôleurConstellation } from "./accès/utils.js";

type clefObjet = "bds" | "variables" | "motsClefs" | "projets" | "nuées";

type ContrôleurConstellation = Awaited<
  ReturnType<ReturnType<typeof générerContrôleurConstellation>>
>;

export type infoDispositif = {
  idSFIP: string;
  idDispositif: string;
  idCompte: string;
  clefPublique: string;
  signatures: { id: string; publicKey: string };
  encryption?: { type: string; clefPublique: string };
};

export type statutDispositif = {
  infoDispositif: infoDispositif;
  vuÀ?: number;
};

export type élémentBdMembres = {
  idCompte: string;
  dispositifs: string[];
};

export type itemRechercheProfondeur = {
  profondeur: number;
} & { [key: string]: unknown };

export type infoMembreRéseau = {
  idCompte: string;
  profondeur: number;
  confiance: number;
};

export type infoRelation = {
  de: string;
  pour: string;
  confiance: number;
  profondeur: number;
};

export interface infoConfiance {
  idCompte: string;
  confiance: number;
}

export interface infoBloqué {
  idCompte: string;
  privé: boolean;
}

export interface infoMembre {
  idCompte: string;
  protocoles: string[];
  dispositifs: infoDispositif[];
}

export interface statutMembre {
  infoMembre: infoMembre;
  vuÀ?: number;
}

export interface infoRéplications {
  membres: statutMembre[];
  dispositifs: (épingleDispositif & {
    idDispositif: string;
    idCompte?: string;
    vuÀ?: number;
  })[];
}

export interface résultatRechercheSansScore<T extends infoRésultat> {
  id: string;
  objectif: résultatObjectifRecherche<T>;
  confiance: number;
  qualité: number;
}

export type élémentDeMembre<T extends élémentBdListeDonnées> = {
  idCompte: string;
  élément: élémentDonnées<T>;
};

export type élémentDeMembreAvecValid<T extends élémentBdListeDonnées> =
  élémentDeMembre<T> & {
    valid: erreurValidation[];
  };

export type bdDeMembre = {
  idCompte: string;
  bd: string;
};

interface Message {
  encrypté: boolean;
  données: string | DonnéesMessage;
  destinataire?: string;
}

export interface MessageEncrypté extends Message {
  encrypté: true;
  clefPubliqueExpéditeur: string;
  données: string;
}

export interface MessageNonEncrypté extends Message {
  encrypté: false;
  données: DonnéesMessage;
}

export interface DonnéesMessage {
  signature: Signature;
  valeur: ValeurMessage;
}

export interface ValeurMessage {
  type: string;
  contenu: ContenuMessage;
}

export interface ContenuMessage {
  [key: string]: unknown;
}

export interface ValeurMessageSalut extends ValeurMessage {
  type: "Salut !";
  contenu: ContenuMessageSalut;
}

export interface ContenuMessageSalut extends ContenuMessage {
  idSFIP: string;
  idDispositif: string;
  idCompte: string;
  clefPublique: string;
  signatures: { id: string; publicKey: string };
  encryption?: { type: string; clefPublique: string };
}

export interface ValeurMessageRequèteRejoindreCompte extends ValeurMessage {
  type: "Je veux rejoindre ce compte";
  contenu: ContenuMessageRejoindreCompte;
}

export interface ContenuMessageRejoindreCompte extends ContenuMessage {
  idDispositif: string;
  empreinteVérification: string;
}

export type statutConfianceMembre = "FIABLE" | "BLOQUÉ" | "NEUTRE";

type structureBdPrincipaleRéseau = {
  [idCompte: string]: statutConfianceMembre;
};

const schémaBdPrincipaleRéseau: JSONSchemaType<structureBdPrincipaleRéseau> = {
  type: "object",
  additionalProperties: {
    type: "string",
  },
  required: [],
};

const INTERVALE_SALUT = 1000 * 10;
const FACTEUR_ATÉNUATION_CONFIANCE = 0.8;
const FACTEUR_ATÉNUATION_BLOQUÉS = 0.9;
const CONFIANCE_DE_COAUTEUR = 0.9;
const CONFIANCE_DE_FAVORIS = 0.7;
const DÉLAI_SESOUVENIR_MEMBRES_EN_LIGNE = 1000 * 60 * 60 * 24 * 30;
const N_DÉSIRÉ_SOUVENIR_MEMBRES_EN_LIGNE = 50;

const obtChaîneIdSFIPClient = (client: ClientConstellation): string => {
  return client.idNodeSFIP!.id.toCID().toString();
};

export default class Réseau extends ComposanteClientDic<structureBdPrincipaleRéseau> {
  client: ClientConstellation;
  bloquésPrivés: Set<string>;
  _fermé: boolean;

  dispositifsEnLigne: {
    [key: string]: statutDispositif;
  };

  fsOublier: schémaFonctionOublier[];
  événements: EventEmitter;

  constructor({ client }: { client: ClientConstellation }) {
    super({
      client,
      clef: "réseau",
      schémaBdPrincipale: schémaBdPrincipaleRéseau,
    });

    this.client = client;

    this.bloquésPrivés = new Set();

    this.dispositifsEnLigne = {};
    this.fsOublier = [];
    this._fermé = false;
    this.événements = new EventEmitter();
  }

  async initialiser(): Promise<void> {
    const promesses: { [clef: string]: Promise<void> } = {};
    await this.client.sfip!.pubsub.subscribe(
      this.client.sujet_réseau,
      (msg: MessagePubSub) => {
        const id = uuidv4();
        try {
          const promesse = this.messageReçu({ msg });
          promesses[id] = promesse;
          promesse.then(() => {
            delete promesses[id];
          });
        } catch (e) {
          console.error(e.toString());
          console.error(e.stack.toString());
        }
      }
    );
    this.fsOublier.push(async () => {
      await this.client.sfip!.pubsub.unsubscribe(this.client.sujet_réseau);
      await Promise.all(Object.values(promesses));
    });

    // @ts-expect-error Pas inclus dans les types de SFIP
    const libp2p: Libp2p = this.client.sfip!.libp2p;

    const fSuivreConnexions = () => {
      this.événements.emit("changementConnexions");
    };

    const événements: (keyof Libp2pEvents)[] = [
      "peer:discovery",
      // @ts-expect-error erreur dans les types SFIP
      "peer:connect",
      // @ts-expect-error erreur dans les types SFIP
      "peer:disconnect",
    ];
    for (const é of événements) {
      libp2p.addEventListener(é, fSuivreConnexions);
    }
    this.fsOublier.push(
      ...événements.map((é) => {
        return async () => libp2p.removeEventListener(é, fSuivreConnexions);
      })
    );

    const intervale = setInterval(() => {
      this.direSalut({});
    }, INTERVALE_SALUT);
    this.fsOublier.unshift(async () => clearInterval(intervale));

    await this.direSalut({});
  }

  async épingler() {
    await this.client.épingles?.épinglerBd({
      id: await this.obtIdBd(),
      récursif: false,
      fichiers: false,
    });
  }

  async envoyerMessageAuDispositif({
    msg,
    idSFIP,
  }: {
    msg: Message;
    idSFIP?: string;
  }): Promise<void> {
    if (idSFIP) {
      msg.destinataire = idSFIP;
    }
    const sujet = this.client.sujet_réseau;

    const msgBinaire = Buffer.from(JSON.stringify(msg));
    await this.client.sfip!.pubsub.publish(sujet, msgBinaire);
  }

  async envoyerMessageAuMembre({
    msg,
    idCompte,
    encrypté = true,
  }: {
    msg: ValeurMessage;
    idCompte: string;
    encrypté?: boolean;
  }): Promise<void> {
    const signature = await this.client.signer({
      message: JSON.stringify(msg),
    });

    const msgSigné: DonnéesMessage = {
      signature,
      valeur: msg,
    };

    const maintenant = Date.now();

    const dispositifsMembre = Object.values(this.dispositifsEnLigne)
      .filter((d) => d.infoDispositif.idCompte === idCompte)
      .filter((d) => d.vuÀ && maintenant - d.vuÀ < INTERVALE_SALUT + 1000 * 30);
    if (!dispositifsMembre.length)
      throw new Error(
        `Aucun dispositif présentement en ligne pour membre ${idCompte}`
      );
    await Promise.all(
      dispositifsMembre.map(async (d) => {
        const { idSFIP, encryption } = d.infoDispositif;
        if (encrypté) {
          // Arrêter si le dispositif n'a pas la même encryption que nous
          if (encryption?.type !== this.client.encryption.nom) return;

          const msgEncrypté = this.client.encryption.encrypter({
            message: JSON.stringify(msgSigné),
            clefPubliqueDestinataire: encryption.clefPublique,
          });
          const msgPourDispositif: MessageEncrypté = {
            encrypté: true,
            clefPubliqueExpéditeur: this.client.encryption.clefs.publique,
            données: msgEncrypté,
          };
          await this.envoyerMessageAuDispositif({
            msg: msgPourDispositif,
            idSFIP,
          });
        } else {
          const msgPourDispositif: MessageNonEncrypté = {
            encrypté: false,
            données: msgSigné,
          };
          await this.envoyerMessageAuDispositif({
            msg: msgPourDispositif,
            idSFIP,
          });
        }
      })
    );
  }

  async direSalut({ à }: { à?: string }): Promise<void> {
    const valeur: ValeurMessageSalut = {
      type: "Salut !",
      contenu: {
        idSFIP: obtChaîneIdSFIPClient(this.client),
        idDispositif: this.client.orbite!.identity.id,
        clefPublique: this.client.orbite!.identity.publicKey,
        signatures: this.client.orbite!.identity.signatures,
        idCompte: await this.client.obtIdCompte(),
      },
    };
    if (this.client.encryption) {
      valeur.contenu.encryption = {
        type: this.client.encryption.nom,
        clefPublique: this.client.encryption.clefs.publique,
      };
    }
    const signature = await this.client.signer({
      message: JSON.stringify(valeur),
    });
    const message: MessageNonEncrypté = {
      encrypté: false,
      données: {
        signature,
        valeur,
      },
    };
    try {
      await this.envoyerMessageAuDispositif({ msg: message, idSFIP: à });
    } catch (e) {
      // On peut avoir cette erreur si l'autre poste s'est déconnecté entre-temps
      if (!e.toString().includes("PublishError.InsufficientPeers")) {
        throw e;
      }
    }
  }

  async envoyerDemandeRejoindreCompte({
    idCompte,
    codeSecret,
  }: {
    idCompte: string;
    codeSecret: string;
  }): Promise<void> {
    const idDispositif = await this.client.obtIdDispositif();
    const msg: ValeurMessageRequèteRejoindreCompte = {
      type: "Je veux rejoindre ce compte",
      contenu: {
        idDispositif,
        empreinteVérification: this.client.empreinteInvitation({
          idDispositif,
          codeSecret,
        }),
      },
    };

    await this.envoyerMessageAuMembre({ msg, idCompte });
  }

  async messageReçu({ msg }: { msg: MessagePubSub }): Promise<void> {
    if (this._fermé) return;

    const messageJSON: Message = JSON.parse(new TextDecoder().decode(msg.data));
    const { encrypté, destinataire } = messageJSON;

    if (destinataire && destinataire !== obtChaîneIdSFIPClient(this.client))
      return;

    const données: DonnéesMessage = encrypté
      ? JSON.parse(
          this.client.encryption.décrypter({
            message: (messageJSON as MessageEncrypté).données,
            clefPubliqueExpéditeur: (messageJSON as MessageEncrypté)
              .clefPubliqueExpéditeur,
          })
        )
      : messageJSON.données;

    const { valeur, signature } = données;

    // Ignorer la plupart des messages de nous-mêmes
    if (
      signature.clefPublique === this.client.orbite!.identity.publicKey &&
      valeur.type !== "Salut !"
    ) {
      return;
    }

    // Assurer que la signature est valide (message envoyé par détenteur de idDispositif)
    const signatureValide = await this.client.vérifierSignature({
      signature,
      message: JSON.stringify(valeur),
    });
    if (!signatureValide) return;

    const contenu = valeur.contenu;

    switch (valeur.type) {
      case "Salut !": {
        const contenuSalut = contenu as ContenuMessageSalut;
        const { clefPublique } = contenuSalut;

        // S'assurer que idDispositif est la même que celle sur la signature
        if (clefPublique !== signature.clefPublique) return;

        await this.recevoirSalut({ message: contenuSalut });

        if (!destinataire) await this.direSalut({ à: contenuSalut.idSFIP }); // Renvoyer le message, si ce n'était pas déjà fait
        break;
      }
      case "Je veux rejoindre ce compte": {
        const contenuMessage = contenu as ContenuMessageRejoindreCompte;

        await this.client.considérerRequèteRejoindreCompte({
          requète: contenuMessage,
        });

        break;
      }
    }
    // this.écouteursMessages[valeur.type]?.(contenu);
  }

  async recevoirSalut({
    message,
  }: {
    message: ContenuMessageSalut;
  }): Promise<void> {
    const dispositifValid = await this._validerInfoMembre({ info: message });
    if (!dispositifValid) return;

    // Peut-être possible de convertir à une méthode peer.onDisconnect pour détecter vuÀ ?
    this.dispositifsEnLigne[message.idDispositif] = {
      infoDispositif: message,
      vuÀ:
        message.idDispositif === (await this.client.obtIdDispositif())
          ? undefined
          : new Date().getTime(),
    };

    this.événements.emit("membreVu");
    await this._sauvegarderDispositifsEnLigne();
  }

  _nettoyerDispositifsEnLigne(): void {
    const maintenant = new Date().getTime();
    const effaçables = Object.values(this.dispositifsEnLigne)
      .filter(
        (d) => maintenant - (d.vuÀ || 0) > DÉLAI_SESOUVENIR_MEMBRES_EN_LIGNE
      )
      .sort((a, b) => ((a.vuÀ || 0) < (b.vuÀ || 0) ? -1 : 1))
      .map((d) => d.infoDispositif.idDispositif);

    const nEffacer =
      Object.keys(this.dispositifsEnLigne).length -
      N_DÉSIRÉ_SOUVENIR_MEMBRES_EN_LIGNE;
    const àEffacer = effaçables.slice(effaçables.length - nEffacer);
    àEffacer.forEach((m) => delete this.dispositifsEnLigne[m]);
  }

  async _sauvegarderDispositifsEnLigne(): Promise<void> {
    this._nettoyerDispositifsEnLigne();
    await this.client.sauvegarderAuStockageLocal({
      clef: "dispositifsEnLigne",
      val: JSON.stringify(this.dispositifsEnLigne),
    });
  }

  async _validerInfoMembre({
    info,
  }: {
    info: infoDispositif;
  }): Promise<boolean> {
    const { idCompte, signatures, clefPublique, idDispositif } = info;

    if (!(idCompte && signatures && clefPublique && idDispositif)) return false;

    const sigIdValide = await this.client.vérifierSignature({
      signature: {
        signature: signatures.id,
        clefPublique: clefPublique,
      },
      message: idDispositif,
    });

    const sigClefPubliqueValide = await this.client.vérifierSignature({
      signature: {
        signature: signatures.publicKey,
        clefPublique: idDispositif,
      },
      message: clefPublique + signatures.id,
    });

    if (!isValidAddress(idCompte)) return false;
    const { bd: bdCompte, fOublier } = await this.client.orbite!.ouvrirBd({
      id: idCompte,
    });

    if (!estUnContrôleurConstellation(bdCompte.access)) return false;
    const bdCompteValide = (
      bdCompte.access as ContrôleurConstellation
    ).estAutorisé(idDispositif);

    await fOublier();
    return sigIdValide && sigClefPubliqueValide && bdCompteValide;
  }

  async faireConfianceAuMembre({
    idCompte,
  }: {
    idCompte: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    await bd.set(idCompte, "FIABLE");
    await fOublier();
  }

  async nePlusFaireConfianceAuMembre({
    idCompte,
  }: {
    idCompte: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    if (
      Object.keys(await bd.allAsJSON()).includes(idCompte) &&
      (await bd.get(idCompte)) === "FIABLE"
    ) {
      await bd.del(idCompte);
    }
    await fOublier();
  }

  @cacheSuivi
  async suivreFiables({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (membres: {
      [key: string]: statutConfianceMembre;
    }): Promise<void> => {
      const fiables = Object.keys(membres).filter(
        (m) => membres[m] === "FIABLE"
      );
      return await f(fiables);
    };

    return await this.suivreBdPrincipale({
      idCompte,
      f: fFinale,
    });
  }

  async _initaliserBloquésPrivés(): Promise<void> {
    const bloquésPrivésChaîne = await this.client.obtDeStockageLocal({
      clef: "membresBloqués",
    });
    if (bloquésPrivésChaîne) {
      JSON.parse(bloquésPrivésChaîne).forEach((b: string) =>
        this.bloquésPrivés.add(b)
      );
      this.événements.emit("changementMembresBloqués");
    }
  }

  async _sauvegarderBloquésPrivés(): Promise<void> {
    const bloqués = [...this.bloquésPrivés];

    this.client.sauvegarderAuStockageLocal({
      clef: "membresBloqués",
      val: JSON.stringify(bloqués),
    });
  }

  async bloquerMembre({
    idCompte,
    privé = false,
  }: {
    idCompte: string;
    privé?: boolean;
  }): Promise<void> {
    if (privé) {
      await this.débloquerMembre({ idCompte }); // Enlever du régistre publique s'il y est déjà
      this.bloquésPrivés.add(idCompte);
      await this._sauvegarderBloquésPrivés();
    } else {
      const { bd, fOublier } = await this.obtBd();
      // Enlever du régistre privé s'il y existe
      await this.débloquerMembre({ idCompte });
      await bd.set(idCompte, "BLOQUÉ");
      await fOublier();
    }
    this.événements.emit("changementMembresBloqués");
  }

  async débloquerMembre({ idCompte }: { idCompte: string }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    if (
      Object.keys(await bd.allAsJSON()).includes(idCompte) &&
      (await bd.get(idCompte)) === "BLOQUÉ"
    ) {
      await bd.del(idCompte);
    }
    await fOublier();

    if (this.bloquésPrivés.has(idCompte)) {
      this.bloquésPrivés.delete(idCompte);
      await this._sauvegarderBloquésPrivés();
    }
    this.événements.emit("changementMembresBloqués");
  }

  @cacheSuivi
  async suivreBloquésPubliques({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (membres: {
      [key: string]: statutConfianceMembre;
    }): Promise<void> => {
      const bloqués = Object.keys(membres).filter(
        (m) => membres[m] === "BLOQUÉ"
      );
      return await f(bloqués);
    };

    return await this.suivreBdPrincipale({
      idCompte,
      f: fFinale,
    });
  }

  @cacheSuivi
  async suivreBloqués({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<infoBloqué[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fsOublier: schémaFonctionOublier[] = [];

    let bloquésPubliques: string[] = [];

    const fFinale = async () => {
      const listeBloqués = [
        ...new Set([
          ...[...this.bloquésPrivés].map((m) => {
            return { idCompte: m, privé: true };
          }),
          ...bloquésPubliques.map((m) => {
            return { idCompte: m, privé: false };
          }),
        ]),
      ];

      return await f(listeBloqués);
    };

    fsOublier.push(
      await this.suivreBloquésPubliques({
        f: async (blqs: string[]) => {
          bloquésPubliques = blqs;
          return await fFinale();
        },
        idCompte,
      })
    );

    if (idCompte === undefined || idCompte === this.client.idCompte) {
      await this._initaliserBloquésPrivés();
      this.événements.on("changementMembresBloqués", fFinale);
      fsOublier.push(async () => {
        this.événements.off("changementMembresBloqués", fFinale);
      });
      await fFinale();
    }

    return async () => {
      await Promise.all(fsOublier.map((f) => f()));
    };
  }

  @cacheSuivi
  async suivreRelationsImmédiates({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<infoConfiance[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    idCompte = idCompte ? idCompte : this.client.idCompte!;

    const fsOublier: schémaFonctionOublier[] = [];

    const comptes: {
      suivis: infoConfiance[];
      favoris: infoConfiance[];
      coauteursBds: infoConfiance[];
      coauteursProjets: infoConfiance[];
      coauteursVariables: infoConfiance[];
      coauteursMotsClefs: infoConfiance[];
    } = {
      suivis: [],
      favoris: [],
      coauteursBds: [],
      coauteursProjets: [],
      coauteursVariables: [],
      coauteursMotsClefs: [],
    };

    let bloqués: string[] = [];

    const fFinale = async () => {
      const tous: infoConfiance[] = [
        ...comptes.suivis,
        ...comptes.favoris,
        ...comptes.coauteursBds,
        ...comptes.coauteursProjets,
        ...comptes.coauteursVariables,
        ...comptes.coauteursMotsClefs,
        ...bloqués.map((b) => {
          return { idCompte: b, confiance: -1 };
        }),
      ];
      const membresUniques = [...new Set(tous)];
      const relations = membresUniques.map((m) => {
        const { idCompte } = m;
        if (bloqués.includes(idCompte)) {
          return { idCompte, confiance: -1 };
        }
        const points = tous
          .filter((x) => x.idCompte === idCompte)
          .map((x) => x.confiance);
        const confiance =
          1 - points.map((p) => 1 - p).reduce((total, c) => c * total, 1);
        return { idCompte, confiance };
      });
      return await f(relations);
    };

    fsOublier.push(
      await this.suivreBloqués({
        f: async (blqs: infoBloqué[]) => {
          bloqués = blqs.map((b) => b.idCompte);
          await fFinale();
        },
        idCompte: idCompte,
      })
    );

    fsOublier.push(
      await this.client.suivreBdDicDeClef({
        id: idCompte,
        clef: "réseau",
        schéma: schémaBdPrincipaleRéseau,
        f: async (membres: { [key: string]: statutConfianceMembre }) => {
          comptes.suivis = Object.entries(membres)
            .filter(([_, statut]) => statut === "FIABLE")
            .map(([id, _]) => {
              return { idCompte: id, confiance: 1 };
            });
          return await fFinale();
        },
      })
    );

    const inscrireSuiviAuteurs = async (
      fListe: (
        fSuivreRacine: (é: string[]) => Promise<void>
      ) => Promise<schémaFonctionOublier>,
      clef: keyof typeof comptes,
      confiance: number
    ) => {
      fsOublier.push(
        await this.client.suivreBdsDeFonctionListe({
          fListe,
          f: async (membres: string[]) => {
            comptes[clef] = membres.map((idCompte) => {
              return { idCompte, confiance };
            });
            return await fFinale();
          },
          fBranche: async (
            id: string,
            fSuivi: schémaFonctionSuivi<string[]>
          ) => {
            return await this.client.suivreAccèsBd({
              id,
              // Enlever nous-même de la liste des coauteurs
              f: (accès: infoAccès[]) =>
                fSuivi(
                  accès.map((a) => a.idCompte).filter((id) => id !== idCompte)
                ),
            });
          },
        })
      );
    };

    const fSuivreFavoris = async (
      fSuivreRacine: (é: string[]) => Promise<void>
    ) => {
      return await this.suivreFavorisMembre({
        idCompte: idCompte!,
        f: (favoris) => {
          return fSuivreRacine((favoris || []).map((f) => f.idObjet));
        },
      });
    };
    await inscrireSuiviAuteurs(fSuivreFavoris, "favoris", CONFIANCE_DE_FAVORIS);

    const fSuivreBds = async (
      fSuivreRacine: (é: string[]) => Promise<void>
    ) => {
      return await this.suivreBdsMembre({
        idCompte: idCompte!,
        f: (bds) => fSuivreRacine(bds || []),
      });
    };
    await inscrireSuiviAuteurs(
      fSuivreBds,
      "coauteursBds",
      CONFIANCE_DE_COAUTEUR
    );

    const fSuivreProjets = async (
      fSuivreRacine: (é: string[]) => Promise<void>
    ) => {
      return await this.suivreProjetsMembre({
        idCompte: idCompte!,
        f: (projets) => fSuivreRacine(projets || []),
      });
    };
    await inscrireSuiviAuteurs(
      fSuivreProjets,
      "coauteursProjets",
      CONFIANCE_DE_COAUTEUR
    );

    const fSuivreVariables = async (
      fSuivreRacine: (é: string[]) => Promise<void>
    ) => {
      return await this.suivreVariablesMembre({
        idCompte: idCompte!,
        f: (variables) => fSuivreRacine(variables || []),
      });
    };
    await inscrireSuiviAuteurs(
      fSuivreVariables,
      "coauteursVariables",
      CONFIANCE_DE_COAUTEUR
    );

    const fSuivreMotsClefs = async (
      fSuivreRacine: (é: string[]) => Promise<void>
    ) => {
      return await this.suivreMotsClefsMembre({
        idCompte: idCompte!,
        f: (motsClefs) => fSuivreRacine(motsClefs || []),
      });
    };
    await inscrireSuiviAuteurs(
      fSuivreMotsClefs,
      "coauteursMotsClefs",
      CONFIANCE_DE_COAUTEUR
    );

    return async () => {
      await Promise.all(fsOublier.map((f) => f()));
    };
  }

  @cacheRechercheParProfondeur
  async suivreRelationsConfiance({
    f,
    profondeur,
    idCompteDébut,
  }: {
    f: schémaFonctionSuivi<infoRelation[]>;
    profondeur: number;
    idCompteDébut?: string;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const idCompteDébutFinal =
      idCompteDébut || (await this.client.obtIdCompte());

    const dicRelations: { [clef: string]: { relations: infoConfiance[] } } = {};
    const dicOublierRelations: { [clef: string]: schémaFonctionOublier } = {};
    const verrou = new Semaphore();
    let fermer = false;

    const connectéPar = (id: string): string[] => {
      return Object.entries(dicRelations)
        .filter(([_, info]) =>
          info.relations.map((r) => r.idCompte).includes(id)
        )
        .map(([de, _]) => de);
    };

    const calcProfondeurCompte = (id: string): number => {
      if (id === idCompteDébutFinal) return 0;
      const rechercherP = ({
        ids,
        p = 1,
        déjàVues = new Set(),
      }: {
        ids: string[];
        p?: number;
        déjàVues?: Set<string>;
      }): number => {
        const connexions: string[] = ids
          .map((id_) => connectéPar(id_).filter((x) => !déjàVues.has(x)))
          .flat();
        if (connexions.includes(idCompteDébutFinal)) {
          return p;
        } else if (connexions.length) {
          déjàVues = new Set(...déjàVues, ...connexions);
          return rechercherP({
            ids: connexions,
            p: p + 1,
            déjàVues,
          });
        } else {
          return Infinity; // Indique compte qui n'est plus connecté à `idCompteDébutFinal`
        }
      };
      return rechercherP({ ids: [id] });
    };

    const fFinale = async () => {
      const relationsFinales: infoRelation[] = [];
      for (const [de, info] of Object.entries(dicRelations)) {
        for (const r of info.relations) {
          const p = calcProfondeurCompte(de) + 1;
          relationsFinales.push({
            de,
            pour: r.idCompte,
            confiance: r.confiance,
            profondeur: p,
          });
        }
      }
      return await f(relationsFinales);
    };

    const suivreRelationsImmédiates = async (
      idCompte: string
    ): Promise<void> => {
      dicRelations[idCompte] = { relations: [] };
      const fOublierRelationsImmédiates = await this.suivreRelationsImmédiates({
        f: (relations) => {
          if (dicRelations[idCompte]) {
            dicRelations[idCompte].relations = relations;
            fMiseÀJour();
          }
        },
        idCompte: idCompte,
      });
      dicOublierRelations[idCompte] = fOublierRelationsImmédiates;
    };

    const oublierRelationsImmédiates = async (
      idCompte: string
    ): Promise<void> => {
      await dicOublierRelations[idCompte]();
      delete dicOublierRelations[idCompte];
      delete dicRelations[idCompte];
    };

    const fMiseÀJour = async () => {
      if (fermer) return;
      await verrou.acquire("modification");

      const àOublier: string[] = Object.keys(dicRelations).filter(
        (r) => calcProfondeurCompte(r) >= profondeur
      );
      const àSuivre: string[] = [
        ...new Set(
          Object.entries(dicRelations)
            .filter(([de, _]) => calcProfondeurCompte(de) + 1 < profondeur)
            .map(([_, info]) => info.relations.map((r) => r.idCompte))
            .flat()
        ),
      ].filter((id) => !Object.keys(dicRelations).includes(id));
      await Promise.all(àOublier.map((id) => oublierRelationsImmédiates(id)));
      await Promise.all(àSuivre.map((id) => suivreRelationsImmédiates(id)));

      await fFinale();
      verrou.release("modification");
    };

    await suivreRelationsImmédiates(idCompteDébutFinal);

    const fChangerProfondeur = async (p: number) => {
      profondeur = p;
      await fMiseÀJour();
    };

    const fOublier = async () => {
      fermer = true;
      await Promise.all(Object.values(dicOublierRelations).map((f) => f()));
    };

    return { fOublier, fChangerProfondeur };
  }

  @cacheRechercheParProfondeur
  async suivreComptesRéseau({
    f,
    profondeur,
    idCompteDébut,
  }: {
    f: schémaFonctionSuivi<infoMembreRéseau[]>;
    profondeur: number;
    idCompteDébut?: string;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const fSuivi = async (relations: infoRelation[]) => {
      // S'ajouter soi-même
      relations.push({
        de: this.client.idCompte!,
        pour: this.client.idCompte!,
        confiance: 1,
        profondeur: 0,
      });
      const dicRelations: { [key: string]: infoRelation[] } = {};

      relations.forEach((r) => {
        if (!Object.keys(dicRelations).includes(r.pour)) {
          dicRelations[r.pour] = [];
        }
        dicRelations[r.pour].push(r);
      });

      const comptes: infoMembreRéseau[] = Object.entries(dicRelations).map(
        ([idCompte, rs]) => {
          const maRelation = rs.find((r) => r.de === this.client.idCompte);

          if (maRelation?.confiance === 1 || maRelation?.confiance === -1) {
            return {
              idCompte,
              profondeur: maRelation.pour === this.client.idCompte ? 0 : 1,
              confiance: maRelation!.confiance,
            };
          }
          const profondeurCompte = Math.min(...rs.map((r) => r.profondeur));
          const rsPositives = rs.filter((r) => r.confiance >= 0);
          const rsNégatives = rs.filter((r) => r.confiance < 0);
          const coûtNégatif =
            1 -
            rsNégatives
              .map(
                (r) =>
                  1 +
                  r.confiance *
                    Math.pow(FACTEUR_ATÉNUATION_BLOQUÉS, r.profondeur - 1)
              )
              .reduce((total, c) => c * total, 1);

          const confiance =
            1 -
            rsPositives
              .map(
                (r) =>
                  1 -
                  r.confiance *
                    Math.pow(FACTEUR_ATÉNUATION_CONFIANCE, r.profondeur - 1)
              )
              .reduce((total, c) => c * total, 1) -
            coûtNégatif;

          return {
            idCompte,
            profondeur: profondeurCompte,
            confiance,
          };
        }
      );

      return await f(comptes);
    };

    return await this.suivreRelationsConfiance({
      f: fSuivi,
      profondeur,
      idCompteDébut,
    });
  }

  async suivreComptesRéseauEtEnLigne({
    f,
    profondeur,
    idCompteDébut,
  }: {
    f: schémaFonctionSuivi<infoMembreRéseau[]>;
    profondeur: number;
    idCompteDébut?: string;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    // Ne PAS mettre cette fonction en cache ! Ça ne fonctionne pas avec les
    // tailles=Infinity de suivreConnexionsMembres
    const dicComptes: {
      réseau: infoMembreRéseau[];
      enLigne: infoMembreRéseau[];
    } = {
      réseau: [],
      enLigne: [],
    };
    const fFinale = async () => {
      const membres = [...dicComptes.réseau];
      dicComptes.enLigne.forEach((c) => {
        if (!membres.find((m) => m.idCompte === c.idCompte)) {
          membres.push(c);
        }
      });
      return await f(membres);
    };

    const fOublierComptesEnLigne = await this.suivreConnexionsMembres({
      f: async (membres: statutMembre[]) => {
        const infoMembresEnLigne: infoMembreRéseau[] = membres
          .filter((m) => m.infoMembre.idCompte !== this.client.idCompte)
          .map((m) => {
            return {
              idCompte: m.infoMembre.idCompte,
              profondeur: Infinity,
              confiance: 0,
            };
          });
        dicComptes.enLigne = infoMembresEnLigne;
        return await fFinale();
      },
    });

    const fSuivreComptesRéseau = async (comptes: infoMembreRéseau[]) => {
      dicComptes.réseau = comptes;
      return await fFinale();
    };

    const { fOublier: fOublierComptesRéseau, fChangerProfondeur } =
      await this.suivreComptesRéseau({
        f: fSuivreComptesRéseau,
        profondeur,
        idCompteDébut,
      });

    const fOublier = async () => {
      await fOublierComptesEnLigne();
      await fOublierComptesRéseau();
    };

    return { fOublier, fChangerProfondeur };
  }

  async suivreConfianceMonRéseauPourMembre({
    idCompte,
    f,
    profondeur,
    idCompteRéférence,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<number>;
    profondeur: number;
    idCompteRéférence?: string;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    /*
    Note : Ne PAS envelopper cette fonction avec un `@cacheRechercheParProfondeur` !
    Elle retourne un nombre, pas une liste de résultat, et ça va bien sûr planter
    si on essaie de l'envelopper.
    */
    const idCompteRéférenceFinal =
      idCompteRéférence || (await this.client.obtIdCompte());

    const fFinale = async (membres: infoMembreRéseau[]) => {
      const infoRecherchée = membres.find((m) => m.idCompte === idCompte);
      return await f(infoRecherchée?.confiance || 0);
    };

    return await this.suivreComptesRéseau({
      f: fFinale,
      profondeur,
      idCompteDébut: idCompteRéférenceFinal,
    });
  }

  @cacheSuivi
  async suivreConnexionsPostesSFIP({
    f,
  }: {
    f: schémaFonctionSuivi<{ adresse: string; pair: string }[]>;
  }): Promise<schémaFonctionOublier> {
    const dédédoublerConnexions = (
      connexions: PeersResult[]
    ): PeersResult[] => {
      const adrDéjàVues: string[] = [];
      const dédupliquées: PeersResult[] = [];

      // Enlever les doublons
      for (const c of connexions) {
        if (!adrDéjàVues.includes(c.peer.toCID().toString())) {
          adrDéjàVues.push(c.peer.toCID().toString());
          dédupliquées.push(c);
        }
      }

      return dédupliquées;
    };

    const fFinale = async () => {
      const connexions = await this.client.sfip!.swarm.peers();

      // Enlever les doublons (pas trop sûr ce qu'ils font ici)
      const connexionsUniques = dédédoublerConnexions(connexions);

      return await f(
        connexionsUniques.map((c) => {
          return {
            adresse: c.addr.toString(),
            pair: c.peer.toCID().toString(),
          };
        })
      );
    };

    this.événements.on("changementConnexions", fFinale);
    await fFinale();

    const oublier = async () => {
      this.événements.off("changementConnexions", fFinale);
    };
    return oublier;
  }

  @cacheSuivi
  async suivreConnexionsDispositifs({
    f,
  }: {
    f: schémaFonctionSuivi<statutDispositif[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async () => {
      return await f(Object.values(this.dispositifsEnLigne));
    };

    this.événements.on("membreVu", fFinale);
    await fFinale();

    const oublier = async () => {
      this.événements.off("membreVu", fFinale);
    };
    return oublier;
  }

  @cacheSuivi
  async suivreConnexionsMembres({
    f,
  }: {
    f: schémaFonctionSuivi<statutMembre[]>;
  }): Promise<schémaFonctionOublier> {
    type statutMembreSansProtocoles = {
      infoMembre: {
        idCompte: string;
        dispositifs: infoDispositif[];
      };
      vuÀ?: number;
    };
    const fListe = async (
      fSuivreRacine: (éléments: statutMembreSansProtocoles[]) => Promise<void>
    ) => {
      const fFinaleDispositifs = async (dispositifs: statutDispositif[]) => {
        const membres: { [key: string]: statutMembreSansProtocoles } = {};

        for (const d of dispositifs) {
          const { idCompte } = d.infoDispositif;
          if (!membres[idCompte]) {
            membres[idCompte] = {
              infoMembre: {
                idCompte: idCompte,
                dispositifs: [],
              },
            };
          }
          const { infoMembre, vuÀ } = membres[idCompte];
          infoMembre.dispositifs.push(d.infoDispositif);
          membres[idCompte].vuÀ = vuÀ
            ? d.vuÀ
              ? Math.max(vuÀ, d.vuÀ)
              : vuÀ
            : d.vuÀ;
        }
        return await fSuivreRacine(Object.values(membres));
      };
      return await this.suivreConnexionsDispositifs({ f: fFinaleDispositifs });
    };

    const fBranche = async (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<statutMembre>,
      branche: statutMembreSansProtocoles
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreProtocolesMembre({
        idCompte: id,
        f: (protocoles) => {
          fSuivreBranche({
            infoMembre: {
              ...branche.infoMembre,
              protocoles: Object.values(protocoles).flat(),
            },
            vuÀ: branche.vuÀ,
          });
        },
      });
    };

    return await this.client.suivreBdsDeFonctionListe({
      fListe,
      f,
      fBranche,
      fIdBdDeBranche: (x: statutMembreSansProtocoles) => x.infoMembre.idCompte,
      fCode: (x: statutMembreSansProtocoles) => x.infoMembre.idCompte,
    });
  }

  @cacheSuivi
  async suivreProtocolesMembre({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<{ [key: string]: string[] }>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id: idCompte || (await this.client.obtIdCompte()),
      clef: "protocoles",
      schéma: schémaStructureBdCompte,
      f,
    });
  }

  @cacheSuivi
  async suivreProtocolesDispositif({
    idDispositif,
    f,
  }: {
    idDispositif?: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const idDispositifFinal =
      idDispositif || (await this.client.obtIdDispositif());

    const fRacine = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (nouvelIdBdCible?: string | undefined) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreConnexionsDispositifs({
        f: async (dispositifs) => {
          const dispositif = dispositifs.find(
            (d) => d.infoDispositif.idDispositif === idDispositifFinal
          );
          if (dispositif) {
            const { idCompte } = dispositif.infoDispositif;
            return await fSuivreRacine(idCompte);
          } else {
            return await fSuivreRacine(undefined);
          }
        },
      });
    };

    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<{ [key: string]: string[] } | undefined>;
    }) => {
      return await this.suivreProtocolesMembre({
        f: fSuivreBd,
        idCompte: id,
      });
    };

    const fFinale = async (protocoles?: {
      [key: string]: string[];
    }): Promise<void> => {
      if (protocoles) return await f(protocoles[idDispositifFinal]);
    };

    return await suivreBdDeFonction({
      fRacine,
      f: fFinale,
      fSuivre,
    });
  }

  async rechercher<T extends infoRésultat>({
    f,
    nRésultatsDésirés,
    fRecherche,
    fConfiance,
    fQualité,
    fObjectif,
    fScore,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    nRésultatsDésirés: number;
    fRecherche: (args: {
      idCompte: string;
      fSuivi: (x: string[] | undefined) => Promise<void>;
    }) => Promise<schémaFonctionOublier>;
    fConfiance: schémaFonctionSuivreConfianceRecherche;
    fQualité: schémaFonctionSuivreQualitéRecherche;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
    fScore?: (r: résultatRechercheSansScore<T>) => number;
  }): Promise<schémaRetourFonctionRechercheParN> {
    if (!fScore) {
      fScore = (x: résultatRechercheSansScore<T>): number => {
        return (x.confiance + x.qualité + x.objectif.score) / 3;
      };
    }

    // Il y a probablement une meilleure façon de faire ça, mais pour l'instant ça passe
    fObjectif =
      fObjectif ||
      (rechercherTous() as schémaFonctionSuivreObjectifRecherche<T>);

    const résultatsParMembre: {
      [key: string]: {
        résultats: résultatRecherche<T>[];
        membre: infoMembreRéseau;
        mettreÀJour: (membre: infoMembreRéseau) => Promise<void>;
      };
    } = {};

    const fsOublierRechercheMembres: { [key: string]: schémaFonctionOublier } =
      {};

    const DÉLAI_REBOURS = 3000;
    let annulerRebours: NodeJS.Timeout;
    let profondeur = 3;
    let annuler = false;

    const ajusterProfondeur = async (p: number) => {
      profondeur = p;
      await fChangerProfondeur(p);
      if (annulerRebours) clearTimeout(annulerRebours);
    };

    const débuterReboursAjusterProfondeur = (délai = DÉLAI_REBOURS) => {
      if (annuler) return;
      if (annulerRebours) clearTimeout(annulerRebours);

      const scores = Object.values(résultatsParMembre)
        .map((r) => r.résultats)
        .flat()
        .map((r) => r.résultatObjectif.score);
      const pireScoreInclus =
        scores.length >= nRésultatsDésirés
          ? Math.min(...scores.slice(0, nRésultatsDésirés))
          : 0;

      const parProfondeur = Object.values(résultatsParMembre).reduce(
        function (r, a) {
          r[String(a.membre.profondeur)] = r[String(a.membre.profondeur)] || [];
          r[String(a.membre.profondeur)].push(...a.résultats);
          return r;
        },
        {} as {
          [key: string]: résultatRecherche<T>[];
        }
      );

      const lParProfondeur = Object.entries(parProfondeur)
        .sort((a, b) => (Number(a[0]) < Number(b[0]) ? -1 : 1))
        .map((p) => p[1]);

      const nScoresInclusParProfondeur = lParProfondeur.map(
        (rs) =>
          rs.filter((r) => r.résultatObjectif.score >= pireScoreInclus).length
      );

      const dernierTrois = nScoresInclusParProfondeur.slice(
        nScoresInclusParProfondeur.length - 3
      );
      const dernierQuatre = nScoresInclusParProfondeur.slice(
        nScoresInclusParProfondeur.length - 4
      );
      const nouvelleProfondeur = Math.max(
        3,
        sum(dernierTrois)
          ? profondeur + 1
          : sum(dernierQuatre)
          ? profondeur
          : profondeur - 1
      );

      if (nouvelleProfondeur > profondeur) {
        annulerRebours = setTimeout(
          () => ajusterProfondeur(nouvelleProfondeur),
          délai
        );
      } else if (nouvelleProfondeur < profondeur) {
        ajusterProfondeur(nouvelleProfondeur);
      }
    };

    const fFinale = async () => {
      const résultats: résultatRecherche<T>[] = Object.values(
        résultatsParMembre
      )
        .map((listeRésultats) => listeRésultats.résultats)
        .flat();
      const résultatsOrdonnés = résultats.sort((a, b) =>
        a.résultatObjectif.score < b.résultatObjectif.score ? 1 : -1
      );
      await f(résultatsOrdonnés.slice(0, nRésultatsDésirés));
      débuterReboursAjusterProfondeur();
    };

    const suivreRésultatsMembre = async (
      membre: infoMembreRéseau
    ): Promise<void> => {
      const { idCompte } = membre;

      const fListe = async (
        fSuivreRacine: (éléments: string[]) => Promise<void>
      ): Promise<schémaFonctionOublier> => {
        return await fRecherche({
          idCompte: membre.idCompte,
          fSuivi: async (résultats) => await fSuivreRacine(résultats || []),
        });
      };

      const fSuivi = async (résultats: résultatRecherche<T>[]) => {
        résultatsParMembre[idCompte].résultats = résultats;
        return await fFinale();
      };

      const fBranche = async (
        id: string,
        fSuivreBranche: schémaFonctionSuivi<résultatRecherche<T> | undefined>
      ): Promise<schémaFonctionOublier> => {
        const rés: {
          id: string;
          objectif?: infoRésultatRecherche<T>;
          confiance?: number;
          qualité?: number;
        } = {
          id,
        };
        const fFinaleSuivreBranche = async () => {
          const { objectif, confiance, qualité } = rés;
          if (objectif && confiance !== undefined && qualité !== undefined) {
            const résultatFinalBranche: résultatRecherche<T> = {
              id,
              résultatObjectif: {
                ...objectif,
                score: fScore!(rés as résultatRechercheSansScore<T>),
              },
            };
            return await fSuivreBranche(résultatFinalBranche);
          } else {
            return await fSuivreBranche(undefined);
          }
        };

        const fSuivreObjectif = async (objectif?: infoRésultatRecherche<T>) => {
          rés.objectif = objectif;
          return await fFinaleSuivreBranche();
        };
        const fOublierObjectif = await fObjectif!(
          this.client,
          id,
          fSuivreObjectif
        );

        const fSuivreConfiance = async (confiance?: number) => {
          rés.confiance = confiance;
          return await fFinaleSuivreBranche();
        };
        const fOublierConfiance = await fConfiance(id, fSuivreConfiance);

        const fSuivreQualité = async (qualité?: number) => {
          rés.qualité = qualité;
          return await fFinaleSuivreBranche();
        };
        const fOublierQualité = await fQualité(id, fSuivreQualité);

        const fOublierBranche = async () => {
          await Promise.all([
            fOublierObjectif(),
            fOublierConfiance(),
            fOublierQualité(),
          ]);
        };

        return fOublierBranche;
      };

      résultatsParMembre[idCompte] = {
        résultats: [] as résultatRecherche<T>[],
        membre,
        mettreÀJour: fFinale,
      };

      const fOublierRechercheMembre =
        await this.client.suivreBdsDeFonctionListe({
          fListe,
          f: fSuivi,
          fBranche,
        });

      fsOublierRechercheMembres[idCompte] = fOublierRechercheMembre;
    };

    const oublierRésultatsMembre = async (compte: string) => {
      await fsOublierRechercheMembres[compte]();
      delete résultatsParMembre[compte];
      delete fsOublierRechercheMembres[compte];
      await fFinale();
    };

    const verrou = new Semaphore();

    const fSuivreComptes = async (
      comptes: infoMembreRéseau[]
    ): Promise<void> => {
      await verrou.acquire("rechercher");

      comptes = comptes.filter((c) => c.confiance >= 0); // Enlever les membres bloqués

      const nouveaux = comptes.filter((c) => !résultatsParMembre[c.idCompte]);
      const clefsObsolètes = Object.keys(résultatsParMembre).filter(
        (m) => !comptes.find((c) => c.idCompte === m)
      );
      const changés = comptes.filter((c) => {
        const avant = résultatsParMembre[c.idCompte];
        return (
          avant &&
          (c.confiance !== avant.membre.confiance ||
            c.profondeur !== avant.membre.profondeur)
        );
      });

      await Promise.all(nouveaux.map(suivreRésultatsMembre));
      await Promise.all(
        changés.map(
          async (c) => await résultatsParMembre[c.idCompte].mettreÀJour(c)
        )
      );

      await Promise.all(clefsObsolètes.map((o) => oublierRésultatsMembre(o)));

      verrou.release("rechercher");
    };

    const { fChangerProfondeur, fOublier: fOublierSuivreComptes } =
      await this.suivreComptesRéseauEtEnLigne({
        f: fSuivreComptes,
        profondeur,
      });

    const fChangerN = async (nouveauN: number) => {
      const nDésirésAvant = nRésultatsDésirés;
      nRésultatsDésirés = nouveauN;
      if (nouveauN !== nDésirésAvant) {
        await fFinale();
        débuterReboursAjusterProfondeur(0);
      }
    };

    const fOublier = async () => {
      annuler = true;
      if (annulerRebours) clearTimeout(annulerRebours);
      await fOublierSuivreComptes();
      await Promise.all(
        Object.values(fsOublierRechercheMembres).map((f) => f())
      );
    };

    return { fChangerN, fOublier };
  }

  async rechercherMembres<T extends infoRésultat>({
    f,
    nRésultatsDésirés,
    fObjectif,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    nRésultatsDésirés: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fConfiance = async (
      idCompte: string,
      fSuivi: schémaFonctionSuivi<number>
    ) => {
      const { fOublier } = await this.suivreConfianceMonRéseauPourMembre({
        idCompte: idCompte,
        f: fSuivi,
        profondeur: 4,
      });
      return fOublier;
    };

    const fRecherche = async ({
      idCompte,
      fSuivi,
    }: {
      idCompte: string;
      fSuivi: schémaFonctionSuivi<[string]>;
    }): Promise<schémaFonctionOublier> => {
      await fSuivi([idCompte]); // Rien à faire parce que nous ne recherchons que le compte
      return faisRien;
    };

    const fQualité = async (
      idCompte: string,
      fSuivi: schémaFonctionSuivi<number>
    ): Promise<schémaFonctionOublier> => {
      const fRechercherSelonActivité = rechercherProfilsSelonActivité();
      return await fRechercherSelonActivité(
        this.client,
        idCompte,
        (résultat) => {
          fSuivi(résultat?.score || 0);
        }
      );
    };

    return await this.rechercher({
      f,
      nRésultatsDésirés,
      fRecherche,
      fConfiance,
      fQualité,
      fObjectif,
    });
  }

  async suivreConfianceAuteurs({
    idItem,
    clef,
    f,
  }: {
    idItem: string;
    clef: clefObjet;
    f: schémaFonctionSuivi<number>;
  }): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (auteurs: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreAuteursObjet({
        idObjet: idItem,
        clef,
        f: async (auteurs: infoAuteur[]) => {
          const idsAuteurs = auteurs
            .filter((a) => a.accepté)
            .map((a) => a.idCompte);
          return await fSuivreRacine(idsAuteurs);
        },
      });
    };

    const fBranche = async (
      idAuteur: string,
      fSuivreBranche: schémaFonctionSuivi<number>
    ): Promise<schémaFonctionOublier> => {
      const { fOublier } = await this.suivreConfianceMonRéseauPourMembre({
        idCompte: idAuteur,
        f: fSuivreBranche,
        profondeur: 4,
      });
      return fOublier;
    };

    const fFinale = async (confiances: number[]) => {
      const confiance = confiances.reduce((a, b) => a + b, 0);
      await f(confiance);
    };

    const fRéduction = (branches: number[]) => branches.flat();

    return await this.client.suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
      fRéduction,
    });
  }

  async rechercherObjets<T extends infoRésultat>({
    f,
    clef,
    nRésultatsDésirés,
    fRecherche,
    fRechercheLesMiens,
    fQualité,
    fObjectif,
    toutLeRéseau = true,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    clef: clefObjet;
    nRésultatsDésirés: number;
    fRecherche: (args: {
      idCompte: string;
      f: (bds: string[] | undefined) => void;
    }) => Promise<schémaFonctionOublier>;
    fRechercheLesMiens: (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ) => Promise<schémaFonctionOublier>;
    fQualité: schémaFonctionSuivreQualitéRecherche;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    if (!toutLeRéseau) {
      // Il y a probablement une meilleure façon de faire ça, mais pour l'instant ça passe
      const fObjectifFinal =
        fObjectif ||
        (rechercherTous() as schémaFonctionSuivreObjectifRecherche<T>);

      return await this.client.suivreBdsDeFonctionListe({
        fListe: async (
          fSuivreRacine: (éléments: string[]) => Promise<void>
        ): Promise<schémaRetourFonctionRechercheParN> => {
          return {
            fOublier: await fRechercheLesMiens(fSuivreRacine),
            fChangerN: () => Promise.resolve(),
          }; // À faire : implémenter fChangerN ?
        },
        f,
        fBranche: async (
          id: string,
          fSuivreBranche: schémaFonctionSuiviRecherche<T>
        ): Promise<schémaFonctionOublier> =>
          await fObjectifFinal(this.client, id, fSuivreBranche),
      });
    }

    const fRechercheFinale = async ({
      idCompte,
      fSuivi,
    }: {
      idCompte: string;
      fSuivi: (objets: string[] | undefined) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      const résultats: { propres: string[]; favoris: string[] } = {
        propres: [],
        favoris: [],
      };

      const fFinale = async () => {
        const tous = [...new Set([...résultats.propres, ...résultats.favoris])];
        await fSuivi(tous);
      };

      const fOublierPropres = await fRecherche({
        idCompte,
        f: async (propres) => {
          résultats.propres = propres || [];
          await fFinale();
        },
      });

      const fOublierFavoris = await this.suivreFavorisMembre({
        idCompte,
        f: async (favoris) => {
          résultats.favoris = favoris ? Object.keys(favoris) : [];
          await fFinale();
        },
      });

      return async () => {
        await fOublierPropres();
        await fOublierFavoris();
      };
    };

    const fConfiance = async (
      id: string,
      f: schémaFonctionSuivi<number>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreConfianceAuteurs({ idItem: id, clef, f });
    };

    return await this.rechercher({
      f,
      nRésultatsDésirés,
      fRecherche: fRechercheFinale,
      fConfiance,
      fQualité,
      fObjectif,
    });
  }

  async rechercherNuées<T extends infoRésultat>({
    f,
    nRésultatsDésirés,
    fObjectif,
    toutLeRéseau = true,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    nRésultatsDésirés: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fRecherche = this.suivreNuéesMembre.bind(this);
    const fQualité = async (
      id: string,
      fSuivreQualité: schémaFonctionSuivi<number>
    ) => {
      return await this.client.nuées!.suivreQualitéNuée({
        idNuée: id,
        f: fSuivreQualité,
      });
    };
    const fRechercheLesMiens = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> =>
      await this.client.nuées!.suivreNuées({ f: fSuivreRacine });

    return await this.rechercherObjets({
      f,
      clef: "nuées",
      nRésultatsDésirés,
      fRecherche,
      fRechercheLesMiens,
      fQualité,
      fObjectif,
      toutLeRéseau,
    });
  }

  async rechercherBds<T extends infoRésultat>({
    f,
    nRésultatsDésirés,
    fObjectif,
    toutLeRéseau = true,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    nRésultatsDésirés: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fRecherche = this.suivreBdsMembre.bind(this);
    const fQualité = async (
      id: string,
      fSuivreQualité: schémaFonctionSuivi<number>
    ) => {
      const fFinaleSuivreQualité = async (score: infoScore) => {
        return await fSuivreQualité(score.total);
      };
      return await this.client.bds!.suivreQualitéBd({
        idBd: id,
        f: fFinaleSuivreQualité,
      });
    };

    const fRechercheLesMiens = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> =>
      await this.client.bds!.suivreBds({ f: fSuivreRacine });

    return await this.rechercherObjets({
      f,
      clef: "bds",
      nRésultatsDésirés,
      fRecherche,
      fRechercheLesMiens,
      fQualité,
      fObjectif,
      toutLeRéseau,
    });
  }

  async rechercherVariables<T extends infoRésultat>({
    f,
    nRésultatsDésirés,
    fObjectif,
    toutLeRéseau = true,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    nRésultatsDésirés: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fRecherche = this.suivreVariablesMembre.bind(this);

    const fQualité = async (
      id: string,
      fSuivreQualité: schémaFonctionSuivi<number>
    ) => {
      return await this.client.variables!.suivreQualitéVariable({
        idVariable: id,
        f: fSuivreQualité,
      });
    };

    const fRechercheLesMiens = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> =>
      await this.client.variables!.suivreVariables({
        f: fSuivreRacine,
      });

    return await this.rechercherObjets({
      f,
      clef: "variables",
      nRésultatsDésirés,
      fRecherche,
      fRechercheLesMiens,
      fQualité,
      fObjectif,
      toutLeRéseau,
    });
  }

  async rechercherMotsClefs<T extends infoRésultat>({
    f,
    nRésultatsDésirés,
    fObjectif,
    toutLeRéseau = true,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    nRésultatsDésirés: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fRecherche = this.suivreMotsClefsMembre.bind(this);

    const fQualité = async (
      id: string,
      fSuivreQualité: schémaFonctionSuivi<number>
    ) => {
      return await this.client.motsClefs!.suivreQualitéMotClef({
        idMotClef: id,
        f: fSuivreQualité,
      });
    };

    const fRechercheLesMiens = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> =>
      await this.client.motsClefs!.suivreMotsClefs({
        f: fSuivreRacine,
      });

    return await this.rechercherObjets({
      f,
      clef: "motsClefs",
      nRésultatsDésirés,
      fRecherche,
      fRechercheLesMiens,
      fQualité,
      fObjectif,
      toutLeRéseau,
    });
  }

  async rechercherProjets<T extends infoRésultat>({
    f,
    nRésultatsDésirés,
    fObjectif,
    toutLeRéseau = true,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    nRésultatsDésirés: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fRecherche = this.suivreProjetsMembre.bind(this);

    const fQualité = async (
      id: string,
      fSuivreQualité: schémaFonctionSuivi<number>
    ) => {
      return await this.client.projets!.suivreQualitéProjet({
        idProjet: id,
        f: fSuivreQualité,
      });
    };

    const fRechercheLesMiens = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> =>
      await this.client.projets!.suivreProjets({ f: fSuivreRacine });

    return await this.rechercherObjets({
      f,
      clef: "projets",
      nRésultatsDésirés,
      fRecherche,
      fRechercheLesMiens,
      fQualité,
      fObjectif,
      toutLeRéseau,
    });
  }

  @cacheSuivi
  async suivreAuteursObjet({
    idObjet,
    clef,
    f,
  }: {
    idObjet: string;
    clef: clefObjet;
    f: schémaFonctionSuivi<infoAuteur[]>;
  }): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (éléments: infoAccès[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.suivreAccèsBd({ id: idObjet, f: fSuivreRacine });
    };
    const fBranche = async (
      idCompte: string,
      fSuivreBranche: schémaFonctionSuivi<infoAuteur[]>,
      branche: infoAccès
    ) => {
      const fFinaleSuivreBranche = async (objetsMembre?: string[]) => {
        objetsMembre = objetsMembre || [];
        return fSuivreBranche([
          {
            idCompte: branche.idCompte,
            rôle: branche.rôle,
            accepté: objetsMembre.includes(idObjet),
          },
        ]);
      };

      let fOublierBranche: schémaFonctionOublier | undefined = undefined;
      switch (clef) {
        case "motsClefs":
          fOublierBranche = await this.client.motsClefs?.suivreMotsClefs({
            f: fFinaleSuivreBranche,
            idCompte,
          });
          break;
        case "variables":
          fOublierBranche = await this.client.variables?.suivreVariables({
            f: fFinaleSuivreBranche,
            idCompte,
          });
          break;
        case "bds":
          fOublierBranche = await this.client.bds?.suivreBds({
            f: fFinaleSuivreBranche,
            idCompte,
          });
          break;
        case "nuées":
          fOublierBranche = await this.client.nuées?.suivreNuées({
            f: fFinaleSuivreBranche,
            idCompte,
          });
          break;
        case "projets":
          fOublierBranche = await this.client.projets?.suivreProjets({
            f: fFinaleSuivreBranche,
            idCompte,
          });
          break;
        default:
          throw new Error(clef);
      }

      return fOublierBranche;
    };
    const fIdBdDeBranche = (x: infoAccès) => x.idCompte;
    const fCode = (x: infoAccès) => x.idCompte;

    const fOublier = await this.client.suivreBdsDeFonctionListe({
      fListe,
      f,
      fBranche,
      fIdBdDeBranche,
      fCode,
    });

    return fOublier;
  }

  async suivreAuteursMotClef({
    idMotClef,
    f,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<infoAuteur[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreAuteursObjet({
      idObjet: idMotClef,
      clef: "motsClefs",
      f,
    });
  }

  async suivreAuteursVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<infoAuteur[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreAuteursObjet({
      idObjet: idVariable,
      clef: "variables",
      f,
    });
  }

  async suivreAuteursBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<infoAuteur[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreAuteursObjet({ idObjet: idBd, clef: "bds", f });
  }

  async suivreAuteursProjet({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<infoAuteur[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreAuteursObjet({
      idObjet: idProjet,
      clef: "projets",
      f,
    });
  }

  async suivreObjetsMembre({
    idCompte,
    fListeObjets,
    fSuivi,
  }: {
    idCompte: string;
    fListeObjets: (
      fSuivreRacine: (ids: string[]) => Promise<void>
    ) => Promise<schémaFonctionOublier>;
    fSuivi: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdsSelonCondition({
      fListe: fListeObjets,
      fCondition: async (
        id: string,
        fSuivreCondition: schémaFonctionSuivi<boolean>
      ): Promise<schémaFonctionOublier> => {
        return await this.client.suivreAccèsBd({
          id,
          f: (autorisés: infoAccès[]) =>
            fSuivreCondition(
              autorisés.map((a) => a.idCompte).includes(idCompte)
            ),
        });
      },
      f: fSuivi,
    });
  }

  @cacheSuivi
  async suivreBdsMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreObjetsMembre({
      idCompte,
      fListeObjets: async (fSuivre) =>
        await this.client.bds!.suivreBds({ f: fSuivre, idCompte }),
      fSuivi: f,
    });
  }

  @cacheSuivi
  async suivreProjetsMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<string[] | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreObjetsMembre({
      idCompte,
      fListeObjets: async (fSuivi) =>
        await this.client.projets!.suivreProjets({
          f: fSuivi,
          idCompte,
        }),
      fSuivi: f,
    });
  }

  @cacheSuivi
  async suivreFavorisMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<ÉlémentFavorisAvecObjet[]>;
  }): Promise<schémaFonctionOublier> {
    // suivreFavoris est différent parce qu'on n'a pas besoin de vérifier l'autorisation du membre
    return await this.client.favoris!.suivreFavoris({
      f,
      idCompte,
    });
  }

  @cacheSuivi
  async suivreVariablesMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<string[] | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreObjetsMembre({
      idCompte,
      fListeObjets: async (fSuivi) =>
        await this.client.variables!.suivreVariables({
          f: fSuivi,
          idCompte,
        }),
      fSuivi: f,
    });
  }

  @cacheSuivi
  async suivreMotsClefsMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<string[] | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreObjetsMembre({
      idCompte,
      fListeObjets: async (fSuivi) =>
        await this.client.motsClefs!.suivreMotsClefs({
          f: fSuivi,
          idCompte,
        }),
      fSuivi: f,
    });
  }

  @cacheSuivi
  async suivreNuéesMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<string[] | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreObjetsMembre({
      idCompte,
      fListeObjets: async (fSuivi) =>
        await this.client.nuées!.suivreNuées({
          f: fSuivi,
          idCompte,
        }),
      fSuivi: f,
    });
  }

  async suivreFavorisObjet({
    idObjet,
    f,
    profondeur,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<(ÉlémentFavorisAvecObjet & { idCompte: string })[]>;
    profondeur: number;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const fFinale = async (
      favoris: (ÉlémentFavoris & { idObjet: string; idCompte: string })[]
    ) => {
      const favorisDIntérêt = favoris.filter((f) => f.idObjet === idObjet);
      await f(favorisDIntérêt);
    };

    const fListe = async (
      fSuivreRacine: (membres: string[]) => Promise<void>
    ): Promise<schémaRetourFonctionRechercheParProfondeur> => {
      const fSuivreComptes = async (infosMembres: infoMembreRéseau[]) => {
        // On s'ajoute à la liste des favoris
        return await fSuivreRacine([
          this.client.idCompte!,
          ...infosMembres.map((i) => i.idCompte),
        ]);
      };

      return await this.suivreComptesRéseauEtEnLigne({
        f: fSuivreComptes,
        profondeur,
        idCompteDébut: this.client.idCompte!,
      });
    };

    const fBranche = async (
      idCompte: string,
      fSuivreBranche: schémaFonctionSuivi<
        (ÉlémentFavoris & { idObjet: string; idCompte: string })[] | undefined
      >
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreFavorisMembre({
        idCompte: idCompte,
        f: (favoris: (ÉlémentFavoris & { idObjet: string })[] | undefined) =>
          fSuivreBranche(
            favoris
              ? favoris.map((fav) => {
                  return { idCompte, ...fav };
                })
              : undefined
          ),
      });
    };

    return await this.client.suivreBdsDeFonctionRecherche({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  async suivreRéplications({
    idObjet,
    f,
    profondeur,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<infoRéplications>;
    profondeur: number;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const résultats: {
      connexionsMembres: statutMembre[];
      connexionsDispositifs: statutDispositif[];
      favoris: {
        favoris: ÉlémentFavoris & { idObjet: string; idCompte: string };
        dispositifs: string[];
      }[];
    } = { connexionsMembres: [], connexionsDispositifs: [], favoris: [] };

    const fFinale = async () => {
      const { connexionsMembres, favoris } = résultats;
      const idsMembres = favoris.map((fav) => fav.favoris.idCompte);
      const membres = connexionsMembres.filter((c) =>
        idsMembres.includes(c.infoMembre.idCompte)
      );

      const dispositifs: (épingleDispositif & {
        idDispositif: string;
        vuÀ?: number;
      })[] = (
        await Promise.all(
          favoris.map(async (fav) => {
            const { favoris, dispositifs } = fav;

            return await Promise.all(
              dispositifs.map(async (d) => {
                const vuÀ = résultats.connexionsDispositifs.find(
                  (c) => c.infoDispositif.idDispositif === d
                )?.vuÀ;
                const idCompte = résultats.connexionsDispositifs.find(
                  (c) => c.infoDispositif.idDispositif === d
                )?.infoDispositif.idCompte;

                const dispositifsRéplication: épingleDispositif & {
                  idDispositif: string;
                  idCompte?: string;
                  vuÀ?: number;
                } = {
                  idObjet,
                  idDispositif: d,
                  idCompte,
                  bd: await this.client.favoris!.estÉpingléSurDispositif({
                    dispositifs: favoris.dispositifs,
                    idDispositif: d,
                  }),
                  fichiers: await this.client.favoris!.estÉpingléSurDispositif({
                    dispositifs: favoris.dispositifsFichiers,
                    idDispositif: d,
                  }),
                  récursif: favoris.récursif,
                  vuÀ,
                };
                return dispositifsRéplication;
              })
            );
          })
        )
      ).flat();
      const réplications: infoRéplications = {
        membres,
        dispositifs,
      };
      return await f(réplications);
    };

    const fOublierConnexionsMembres = await this.suivreConnexionsMembres({
      f: async (connexions) => {
        résultats.connexionsMembres = connexions;
        return await fFinale();
      },
    });

    const fOublierConnexionsDispositifs =
      await this.suivreConnexionsDispositifs({
        f: async (connexions) => {
          résultats.connexionsDispositifs = connexions;
          return await fFinale();
        },
      });

    const fSuivreFavoris = async (
      favoris: {
        favoris: ÉlémentFavoris & { idObjet: string; idCompte: string };
        dispositifs: string[];
      }[]
    ) => {
      résultats.favoris = favoris;
      return await fFinale();
    };

    const fListeFavoris = async (
      fSuivreRacine: (
        favoris: (ÉlémentFavoris & { idObjet: string; idCompte: string })[]
      ) => void
    ): Promise<schémaRetourFonctionRechercheParProfondeur> => {
      return await this.suivreFavorisObjet({
        idObjet,
        f: fSuivreRacine,
        profondeur,
      });
    };

    const fBrancheFavoris = async (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<{
        favoris: ÉlémentFavoris & { idObjet: string; idCompte: string };
        dispositifs: string[];
      }>,
      branche: ÉlémentFavoris & { idObjet: string; idCompte: string }
    ): Promise<schémaFonctionOublier> => {
      const fSuivreDispositifsMembre = async (dispositifs: string[]) => {
        return await fSuivreBranche({ favoris: branche, dispositifs });
      };

      const fOublierDispositifsMembre = await this.client.suivreDispositifs({
        f: fSuivreDispositifsMembre,
        idCompte: id,
      });

      return async () => {
        await fOublierDispositifsMembre();
      };
    };

    const fIdBdDeBranche = (
      x: ÉlémentFavoris & { idObjet: string; idCompte: string }
    ) => x.idCompte;
    const fCode = (x: ÉlémentFavoris & { idObjet: string; idCompte: string }) =>
      x.idCompte;

    const { fOublier: fOublierFavoris, fChangerProfondeur } =
      await this.client.suivreBdsDeFonctionRecherche({
        fListe: fListeFavoris,
        f: fSuivreFavoris,
        fBranche: fBrancheFavoris,
        fIdBdDeBranche,
        fCode,
      });

    const fOublier = async () => {
      await fOublierFavoris();
      await fOublierConnexionsMembres();
      await fOublierConnexionsDispositifs();
    };
    return { fOublier, fChangerProfondeur };
  }

  @cacheRechercheParNRésultats
  async suivreBdsDeNuée({
    idNuée,
    f,
    nRésultatsDésirés,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const fBranche = async (
      idCompte: string,
      f: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.bds!.rechercherBdsParNuée({
        idNuée,
        f,
        idCompte,
      });
    };

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaRetourFonctionRechercheParProfondeur> => {
      return await this.suivreComptesRéseauEtEnLigne({
        f: async (résultats) =>
          await fSuivreRacine(résultats.map((r) => r.idCompte)),
        profondeur: nRésultatsDésirés,
      });
    };

    return await this.client.suivreBdsDeFonctionRecherche({
      fListe,
      f,
      fBranche,
    });
  }

  async suivreÉlémentsDeTableauxUniques<T extends élémentBdListeDonnées>({
    idNuéeUnique,
    clef,
    f,
    nBds = 100,
  }: {
    idNuéeUnique: string;
    clef: string;
    f: schémaFonctionSuivi<élémentDeMembre<T>[]>;
    nBds?: number;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const fListe = async (
      fSuivreRacine: (bds: bdDeMembre[]) => Promise<void>
    ): Promise<schémaRetourFonctionRechercheParProfondeur> => {
      const fListeListe = async (
        fSuivreRacineListe: (bds: string[]) => Promise<void>
      ): Promise<schémaRetourFonctionRechercheParProfondeur> => {
        return await this.suivreBdsDeNuée({
          idNuée: idNuéeUnique,
          f: fSuivreRacineListe,
          nRésultatsDésirés: nBds,
        });
      };

      const fBrancheListe = async (
        idBd: string,
        f: schémaFonctionSuivi<bdDeMembre | undefined>
      ): Promise<schémaFonctionOublier> => {
        return await this.suivreAuteursBd({
          idBd,
          f: async (auteurs: infoAuteur[]) => {
            const idCompte = auteurs.find((a) => a.accepté)?.idCompte;
            const infoBdDeMembre: bdDeMembre | undefined = idCompte
              ? {
                  bd: idBd,
                  idCompte,
                }
              : undefined;
            return await f(infoBdDeMembre);
          },
        });
      };
      return await this.client.suivreBdsDeFonctionRecherche({
        fListe: fListeListe,
        f: fSuivreRacine,
        fBranche: fBrancheListe,
      });
    };

    const fBranche = async (
      idBd: string,
      f: schémaFonctionSuivi<élémentDeMembre<T>[]>,
      branche: bdDeMembre
    ): Promise<schémaFonctionOublier> => {
      const { idCompte } = branche;

      const fSuivreTableaux = async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (nouvelIdBdCible: string) => Promise<void>;
      }): Promise<schémaFonctionOublier> => {
        return await this.client.bds!.suivreIdTableauParClef({
          idBd,
          clef,
          f: (idTableau?: string) => {
            if (idTableau) fSuivreRacine(idTableau);
          },
        });
      };

      const fSuivreDonnéesDeTableau = async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<élémentDeMembre<T>[]>;
      }) => {
        const fSuivreDonnéesTableauFinale = async (
          données: élémentDonnées<T>[]
        ) => {
          const donnéesMembre: élémentDeMembre<T>[] = données.map((d) => {
            return {
              idCompte,
              élément: d,
            };
          });
          return await fSuivreBd(donnéesMembre);
        };
        return await this.client.tableaux!.suivreDonnées({
          idTableau: id,
          f: fSuivreDonnéesTableauFinale,
        });
      };

      const fFinale = async (données?: élémentDeMembre<T>[]) => {
        return await f(données || []);
      };

      return await suivreBdDeFonction({
        fRacine: fSuivreTableaux,
        f: fFinale,
        fSuivre: fSuivreDonnéesDeTableau,
      });
    };

    const fIdBdDeBranche = (b: bdDeMembre) => b.bd;
    const fCode = (b: bdDeMembre) => b.bd;

    return await this.client.suivreBdsDeFonctionRecherche({
      fListe,
      f,
      fBranche,
      fIdBdDeBranche,
      fCode,
    });
  }

  async fermer(): Promise<void> {
    this._fermé = true;
    await Promise.all(this.fsOublier.map((f) => f()));
  }
}
