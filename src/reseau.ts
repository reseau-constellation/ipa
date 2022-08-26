import KeyValueStore from "orbit-db-kvstore";
import OrbitDB from "orbit-db";

import { PeersResult } from "ipfs-core-types/src/swarm";
import { Message as MessagePubSub } from "ipfs-core-types/src/pubsub";
import { EventEmitter } from "events";
import sum from "lodash/sum";
import Semaphore from "@chriscdn/promise-semaphore";

import ContrôleurConstellation from "@/accès/cntrlConstellation";
import ClientConstellation, { Signature, infoAccès } from "@/client";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaRetourFonctionRecherche,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuivreQualitéRecherche,
  schémaFonctionSuivreConfianceRecherche,
  infoRésultatRecherche,
  infoAuteur,
  infoRésultat,
  infoRésultatVide,
  résultatObjectifRecherche,
  résultatRecherche,
  faisRien,
} from "@/utils";
import { infoScore } from "@/bds";
import { élémentBdListeDonnées } from "@/tableaux";
import {
  ÉlémentFavoris,
  ÉlémentFavorisAvecObjet,
  épingleDispositif,
} from "@/favoris";
import { élémentDonnées } from "@/valid";
import { rechercherProfilSelonActivité } from "@/recherche/profil";
import { rechercherTous } from "@/recherche/utils";

export interface infoDispositif {
  idSFIP: string;
  idOrbite: string;
  idCompte: string;
  clefPublique: string;
  signatures: { id: string; publicKey: string };
  encryption?: { type: string; clefPublique: string };
}

export interface statutDispositif {
  infoDispositif: infoDispositif;
  vuÀ?: number;
}

export interface élémentBdMembres {
  idBdCompte: string;
  dispositifs: [];
}

export interface infoMembreRéseau {
  idBdCompte: string;
  profondeur: number;
  confiance: number;
}

export interface infoRelation {
  de: string;
  pour: string;
  confiance: number;
  profondeur: number;
}

export interface infoConfiance {
  idBdCompte: string;
  confiance: number;
}

export interface infoBloqué {
  idBdCompte: string;
  privé: boolean;
}

export interface infoMembre {
  idBdCompte: string;
  dispositifs: infoDispositif[];
}

export interface statutMembre {
  infoMembre: infoMembre;
  vuÀ?: number;
}

export interface infoRéplications {
  membres: statutMembre[];
  dispositifs: (épingleDispositif & { idDispositif: string; vuÀ?: number })[];
}

export interface résultatRechercheSansScore<T extends infoRésultat> {
  id: string;
  objectif: résultatObjectifRecherche<T>;
  confiance: number;
  qualité: number;
}

export type élémentDeMembre<T extends élémentBdListeDonnées> = {
  idBdCompte: string;
  élément: élémentDonnées<T>;
};

export type bdDeMembre = {
  idBdCompte: string;
  bd: string;
};

interface Message {
  encrypté: boolean;
  données: string | DonnéesMessage;
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
  idOrbite: string;
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
  idOrbite: string;
  codeSecret: string;
}

export interface réponseSuivreRecherche {
  fOublier: schémaFonctionOublier;
  fChangerN: (n: number) => void;
}

export type statutConfianceMembre = "FIABLE" | "BLOQUÉ" | "NEUTRE";
export type typeÉlémentsBdRéseau = {
  idBdCompte: string;
  statut: statutConfianceMembre;
};

const INTERVALE_SALUT = 1000 * 60;
const FACTEUR_ATÉNUATION_CONFIANCE = 0.8;
const FACTEUR_ATÉNUATION_BLOQUÉS = 0.9;
const CONFIANCE_DE_COAUTEUR = 0.9;
const CONFIANCE_DE_FAVORIS = 0.7;
const DÉLAI_SESOUVENIR_MEMBRES_EN_LIGNE = 1000 * 60 * 60 * 24 * 30;
const N_DÉSIRÉ_SOUVENIR_MEMBRES_EN_LIGNE = 50;

export default class Réseau extends EventEmitter {
  client: ClientConstellation;
  idBd: string;
  bloquésPrivés: Set<string>;

  dispositifsEnLigne: {
    [key: string]: statutDispositif;
  };

  fsOublier: schémaFonctionOublier[];

  constructor({ client, id }: { client: ClientConstellation; id: string }) {
    super();

    this.client = client;
    this.idBd = id;

    this.bloquésPrivés = new Set();

    this.dispositifsEnLigne = {};
    this.fsOublier = [];
  }

  async initialiser(): Promise<void> {
    const idSFIP = this.client.idNodeSFIP!.id;
    await this.client.sfip!.pubsub.subscribe(
      `${this.client.sujet_réseau}-${idSFIP}`,
      (msg: MessagePubSub) => this.messageReçu({ msg, personnel: true })
    );

    await this.client.sfip!.pubsub.subscribe(
      this.client.sujet_réseau,
      (msg: MessagePubSub) => this.messageReçu({ msg, personnel: false })
    );

    for (const é of ["peer:connect", "peer:disconnect"]) {
      // @ts-ignore
      this.client.sfip!.libp2p.connectionManager.on(é, () => {
        this.emit("changementConnexions");
      });
    }

    const x = setInterval(() => {
      this.direSalut({});
    }, INTERVALE_SALUT);
    this.fsOublier.push(() => clearInterval(x));

    this.direSalut({});
  }

  async envoyerMessageAuDispositif({
    msg,
    idSFIP,
  }: {
    msg: Message;
    idSFIP?: string;
  }): Promise<void> {
    const sujet = idSFIP
      ? `${this.client.sujet_réseau}-${idSFIP}`
      : this.client.sujet_réseau;
    const msgBinaire = Buffer.from(JSON.stringify(msg));
    await this.client.sfip!.pubsub.publish(sujet, msgBinaire);
  }

  async envoyerMessageAuMembre({
    msg,
    idCompte,
    encrypté = true,
  }: {
    msg: DonnéesMessage;
    idCompte: string;
    encrypté?: boolean;
  }): Promise<void> {
    const maintenant = Date.now();
    const dispositifsMembre = Object.values(this.dispositifsEnLigne)
      .filter((d) => d.infoDispositif.idCompte === idCompte)
      .filter((d) => d.vuÀ && maintenant - d.vuÀ < INTERVALE_SALUT + 1000 * 30);
    if (!dispositifsMembre.length)
      throw `Aucun dispositif présentement en ligne pour membre ${idCompte}`;
    await Promise.all(
      dispositifsMembre.map(async (d) => {
        const { idSFIP, encryption } = d.infoDispositif;
        if (encrypté) {
          // Arrêter si le dispositif n'a pas la même encryption que nous
          if (encryption?.type !== this.client.encryption.nom) return;

          const msgEncrypté = this.client.encryption.encrypter({
            message: JSON.stringify(msg),
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
            données: msg,
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
        idSFIP: this.client.idNodeSFIP!.id,
        idOrbite: this.client.orbite!.identity.id,
        clefPublique: this.client.orbite!.identity.publicKey,
        signatures: this.client.orbite!.identity.signatures,
        idCompte: this.client.bdCompte!.id,
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
    await this.envoyerMessageAuDispositif({ msg: message, idSFIP: à });
  }

  async envoyerDemandeRejoindreCompte({
    idCompte,
    codeSecret,
  }: {
    idCompte: string;
    codeSecret: string;
  }): Promise<void> {
    const valeur: ValeurMessageRequèteRejoindreCompte = {
      type: "Je veux rejoindre ce compte",
      contenu: {
        idOrbite: await this.client.obtIdOrbite(),
        codeSecret,
      },
    };
    const signature = await this.client.signer({
      message: JSON.stringify(valeur),
    });
    const msg: DonnéesMessage = {
      signature,
      valeur,
    };

    await this.envoyerMessageAuMembre({ msg, idCompte });
  }

  async messageReçu({
    msg,
    personnel,
  }: {
    msg: MessagePubSub;
    personnel: boolean;
  }): Promise<void> {
    const messageJSON: Message = JSON.parse(msg.data.toString());

    const { encrypté } = messageJSON;
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

    // Assurer que la signature est valide (message envoyé par détenteur de idOrbite)
    const signatureValide = await this.client.vérifierSignature({
      signature,
      message: JSON.stringify(valeur),
    });
    if (!signatureValide) return;

    const contenu = valeur.contenu as ContenuMessage;
    switch (valeur.type) {
      case "Salut !": {
        const contenuSalut = contenu as ContenuMessageSalut;
        const { clefPublique } = contenuSalut;

        // S'assurer que idOrbite est la même que celle sur la signature
        if (clefPublique !== signature.clefPublique) return;

        this.recevoirSalut({ message: contenuSalut });

        if (!personnel) this.direSalut({ à: contenuSalut.idSFIP }); // Renvoyer le message, si ce n'était pas déjà fait
        break;
      }
      case "Je veux rejoindre ce compte": {
        const contenuMessage = contenu as ContenuMessageRejoindreCompte;

        this.client.considérerRequèteRejoindreCompte({
          requète: contenuMessage,
        });

        break;
      }
      default:
        console.error(`Message inconnu: ${valeur.type}`);
    }
  }

  async recevoirSalut({
    message,
  }: {
    message: ContenuMessageSalut;
  }): Promise<void> {
    const dispositifValid = await this._validerInfoMembre({ info: message });
    if (!dispositifValid) return;
    this.dispositifsEnLigne[message.idOrbite] = {
      infoDispositif: message,
      vuÀ: new Date().getTime(),
    };

    this.emit("membreVu");
    this._sauvegarderDispositifsEnLigne();
  }

  _nettoyerDispositifsEnLigne(): void {
    const maintenant = new Date().getTime();
    const effaçables = Object.values(this.dispositifsEnLigne)
      .filter(
        (d) => maintenant - (d.vuÀ || 0) > DÉLAI_SESOUVENIR_MEMBRES_EN_LIGNE
      )
      .sort((a, b) => ((a.vuÀ || 0) < (b.vuÀ || 0) ? -1 : 1))
      .map((d) => d.infoDispositif.idOrbite);

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
    const { idCompte, signatures, clefPublique, idOrbite } = info;

    if (!(idCompte && signatures && clefPublique && idOrbite)) return false;

    const sigIdValide = await this.client.vérifierSignature({
      signature: {
        signature: signatures.id,
        clefPublique: clefPublique,
      },
      message: idOrbite,
    });

    const sigClefPubliqueValide = await this.client.vérifierSignature({
      signature: {
        signature: signatures.publicKey,
        clefPublique: idOrbite,
      },
      message: clefPublique + signatures.id,
    });

    if (!OrbitDB.isValidAddress(idCompte)) return false;
    const { bd: bdCompte, fOublier } = await this.client.ouvrirBd({
      id: idCompte,
    });
    if (!(bdCompte.access instanceof ContrôleurConstellation)) return false;
    const bdCompteValide = bdCompte.access.estAutorisé(idOrbite);

    fOublier();
    return sigIdValide && sigClefPubliqueValide && bdCompteValide;
  }

  async faireConfianceAuMembre({
    idBdCompte,
  }: {
    idBdCompte: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<statutConfianceMembre>
    >({ id: this.idBd });
    await bd.set(idBdCompte, "FIABLE");
    fOublier();
  }

  async nePlusFaireConfianceAuMembre({
    idBdCompte,
  }: {
    idBdCompte: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<statutConfianceMembre>
    >({ id: this.idBd });
    if (
      Object.keys(ClientConstellation.obtObjetdeBdDic({ bd })).includes(
        idBdCompte
      ) &&
      bd.get(idBdCompte) === "FIABLE"
    ) {
      await bd.del(idBdCompte);
    }
    fOublier();
  }

  async suivreFiables({
    f,
    idBdCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idBdCompte?: string;
  }): Promise<schémaFonctionOublier> {
    idBdCompte = idBdCompte || this.client.idBdCompte!;

    const fFinale = (membres: {
      [key: string]: statutConfianceMembre;
    }): void => {
      const fiables = Object.keys(membres).filter(
        (m) => membres[m] === "FIABLE"
      );
      f(fiables);
    };

    return await this.client.suivreBdDicDeClef<statutConfianceMembre>({
      id: idBdCompte,
      clef: "réseau",
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
      this.emit("changementMembresBloqués");
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
    idBdCompte,
    privé = false,
  }: {
    idBdCompte: string;
    privé?: boolean;
  }): Promise<void> {
    if (privé) {
      await this.débloquerMembre({ idBdCompte }); // Enlever du régistre publique s'il y est déjà
      this.bloquésPrivés.add(idBdCompte);
      await this._sauvegarderBloquésPrivés();
    } else {
      const { bd, fOublier } = await this.client.ouvrirBd<
        KeyValueStore<statutConfianceMembre>
      >({ id: this.idBd });
      await bd.set(idBdCompte, "BLOQUÉ");
      fOublier();
    }
    this.emit("changementMembresBloqués");
  }

  async débloquerMembre({ idBdCompte }: { idBdCompte: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<statutConfianceMembre>
    >({ id: this.idBd });
    if (
      Object.keys(ClientConstellation.obtObjetdeBdDic({ bd })).includes(
        idBdCompte
      ) &&
      bd.get(idBdCompte) === "BLOQUÉ"
    ) {
      await bd.del(idBdCompte);
    }
    fOublier();

    if (this.bloquésPrivés.has(idBdCompte)) {
      this.bloquésPrivés.delete(idBdCompte);
      await this._sauvegarderBloquésPrivés();
    }
    this.emit("changementMembresBloqués");
  }

  async suivreBloquésPubliques({
    f,
    idBdCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idBdCompte?: string;
  }): Promise<schémaFonctionOublier> {
    idBdCompte = idBdCompte || this.client.idBdCompte!;

    const fFinale = (membres: {
      [key: string]: statutConfianceMembre;
    }): void => {
      const bloqués = Object.keys(membres).filter(
        (m) => membres[m] === "BLOQUÉ"
      );
      f(bloqués);
    };

    return await this.client.suivreBdDicDeClef<statutConfianceMembre>({
      id: idBdCompte,
      clef: "réseau",
      f: fFinale,
    });
  }

  async suivreBloqués({
    f,
    idBdCompte,
  }: {
    f: schémaFonctionSuivi<infoBloqué[]>;
    idBdCompte?: string;
  }): Promise<schémaFonctionOublier> {
    idBdCompte = idBdCompte || this.client.idBdCompte;

    const fsOublier: schémaFonctionOublier[] = [];

    let bloquésPubliques: string[] = [];

    const fFinale = () => {
      const listeBloqués = [
        ...new Set([
          ...[...this.bloquésPrivés].map((m) => {
            return { idBdCompte: m, privé: true };
          }),
          ...bloquésPubliques.map((m) => {
            return { idBdCompte: m, privé: false };
          }),
        ]),
      ];

      f(listeBloqués);
    };

    fsOublier.push(
      await this.suivreBloquésPubliques({
        f: (blqs: string[]) => {
          bloquésPubliques = blqs;
          fFinale();
        },
        idBdCompte,
      })
    );

    if (idBdCompte === this.client.idBdCompte) {
      await this._initaliserBloquésPrivés();
      this.on("changementMembresBloqués", fFinale);
      fsOublier.push(() => this.off("changementMembresBloqués", fFinale));
      fFinale();
    }

    return () => {
      fsOublier.forEach((f) => f());
    };
  }

  async suivreRelationsImmédiates({
    f,
    idBdCompte,
  }: {
    f: schémaFonctionSuivi<infoConfiance[]>;
    idBdCompte?: string;
  }): Promise<schémaFonctionOublier> {
    // console.log("suivreRelationsImmédiates", { f, idBdCompte });
    idBdCompte = idBdCompte ? idBdCompte : this.client.idBdCompte!;

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

    const fFinale = () => {
      const tous: infoConfiance[] = [
        ...comptes.suivis,
        ...comptes.favoris,
        ...comptes.coauteursBds,
        ...comptes.coauteursProjets,
        ...comptes.coauteursVariables,
        ...comptes.coauteursMotsClefs,
        ...bloqués.map((b) => {
          return { idBdCompte: b, confiance: -1 };
        }),
      ];
      const membresUniques = [...new Set(tous)];
      const relations = membresUniques.map((m) => {
        const { idBdCompte } = m;
        if (idBdCompte in bloqués) {
          return { idBdCompte, confiance: -1 };
        }
        const points = tous
          .filter((x) => x.idBdCompte === idBdCompte)
          .map((x) => x.confiance);
        const confiance =
          1 - points.map((p) => 1 - p).reduce((total, c) => c * total, 1);
        return { idBdCompte, confiance };
      });
      f(relations);
    };

    fsOublier.push(
      await this.suivreBloqués({
        f: (blqs: infoBloqué[]) => {
          bloqués = blqs.map((b) => b.idBdCompte);
          fFinale();
        },
        idBdCompte,
      })
    );

    fsOublier.push(
      await this.client.suivreBdDicDeClef<statutConfianceMembre>({
        id: idBdCompte,
        clef: "réseau",
        f: (membres: { [key: string]: statutConfianceMembre }) => {
          comptes.suivis = Object.entries(membres)
            .filter(([_, statut]) => statut === "FIABLE")
            .map(([id, _]) => {
              return { idBdCompte: id, confiance: 1 };
            });
          fFinale();
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
          f: (membres: string[]) => {
            comptes[clef] = membres.map((idBdCompte) => {
              return { idBdCompte, confiance };
            });
            fFinale();
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
                  accès
                    .map((a) => a.idBdCompte)
                    .filter((id) => id !== idBdCompte)
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
        idCompte: idBdCompte!,
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
        idCompte: idBdCompte!,
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
        idCompte: idBdCompte!,
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
        idCompte: idBdCompte!,
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
        idCompte: idBdCompte!,
        f: (motsClefs) => fSuivreRacine(motsClefs || []),
      });
    };
    await inscrireSuiviAuteurs(
      fSuivreMotsClefs,
      "coauteursMotsClefs",
      CONFIANCE_DE_COAUTEUR
    );

    return () => {
      fsOublier.forEach((f) => f());
    };
  }

  async suivreRelationsConfiance({
    f,
    profondeur = 0,
    idCompteDébut,
  }: {
    f: schémaFonctionSuivi<infoRelation[]>;
    profondeur?: number;
    idCompteDébut?: string;
  }): Promise<schémaRetourFonctionRecherche> {
    // console.log("suivreRelationsConfiance", { f, idCompteDébut });
    idCompteDébut = idCompteDébut || this.client.idBdCompte;

    const dicRelations: { [key: string]: infoRelation[] } = {};
    const dicInfoSuiviRelations: {
      [key: string]: {
        fOublier: schémaFonctionOublier;
        demandéePar: Set<string>;
      };
    } = {};
    const fsOublierÉvénements: { [key: string]: schémaFonctionOublier } = {};

    const fFinale = () => {
      const listeRelations = Object.values(dicRelations).flat();
      f(listeRelations);
    };

    const événementsChangementProfondeur = new EventEmitter();

    const onNeSuitPasEncore = (idBdCompte: string): boolean => {
      return !dicInfoSuiviRelations[idBdCompte];
    };

    const onVeutOublier = (
      idBdCompte: string,
      idBdCompteDemandeur: string
    ): void => {
      let effacer: boolean;
      if (dicInfoSuiviRelations[idBdCompte]) {
        const { fOublier, demandéePar } = dicInfoSuiviRelations[idBdCompte];
        demandéePar.delete(idBdCompteDemandeur);

        effacer = !demandéePar.size;
        if (effacer) {
          fOublier();
          delete dicInfoSuiviRelations[idBdCompte];
        }
      } else {
        effacer = true;
      }

      if (effacer) {
        const plusDemandées = dicRelations[idBdCompte] || [];
        plusDemandées.forEach((r) => onVeutOublier(r.pour, r.de));
      }
      fFinale();
    };

    const onVeutSuivre = async (
      idBdCompte: string,
      idBdCompteDemandeur: string,
      profondeurActuelle: number
    ): Promise<void> => {
      if (!dicInfoSuiviRelations[idBdCompte]) {
        const fOublier = await this.suivreRelationsImmédiates({
          f: async (relations: infoConfiance[]) => {
            return await fSuivreRelationsImmédiates(
              relations,
              idBdCompte,
              profondeurActuelle
            );
          },
          idBdCompte,
        });
        const demandéePar = new Set<string>();
        dicInfoSuiviRelations[idBdCompte] = { fOublier, demandéePar };
      }
      dicInfoSuiviRelations[idBdCompte].demandéePar.add(idBdCompteDemandeur);

      fFinale();
    };

    const fSuivreRelationsImmédiates = async (
      relations: infoConfiance[],
      de: string,
      profondeurActuelle: number
    ) => {
      const nouvelles = relations.filter((r) =>
        onNeSuitPasEncore(r.idBdCompte)
      );
      const obsolètes = (dicRelations[de] || []).filter(
        (r) => !relations.map((r) => r.idBdCompte).includes(r.pour)
      );
      dicRelations[de] = relations.map((r) => {
        return {
          de,
          profondeur: profondeurActuelle,
          pour: r.idBdCompte,
          confiance: r.confiance,
        };
      });

      fFinale();
      obsolètes.forEach((o) => onVeutOublier(o.pour, de));

      const ajusterProfondeur = async () => {
        if (profondeurActuelle < profondeur) {
          await Promise.all(
            nouvelles.map((n) =>
              onVeutSuivre(n.idBdCompte, de, profondeurActuelle + 1)
            )
          );
          dicRelations[de] = relations.map((r) => {
            return {
              de,
              profondeur: profondeurActuelle,
              pour: r.idBdCompte,
              confiance: r.confiance,
            };
          });
          fFinale();
        } else if (profondeurActuelle > profondeur) {
          relations.forEach((r) => onVeutOublier(r.idBdCompte, de));
          dicInfoSuiviRelations[de].fOublier();
          delete dicInfoSuiviRelations[de];
          delete dicRelations[de];
          fFinale();
        }
      };

      await ajusterProfondeur();
      événementsChangementProfondeur.on("changé", ajusterProfondeur);
      if (fsOublierÉvénements[de]) fsOublierÉvénements[de]();
      fsOublierÉvénements[de] = () =>
        événementsChangementProfondeur.off("changé", ajusterProfondeur);
    };

    await onVeutSuivre(idCompteDébut!, "", 0);

    const fOublier = () => {
      Object.values(dicInfoSuiviRelations).forEach((r) => r.fOublier());
    };

    const fChangerProfondeur = (p: number) => {
      profondeur = p;
      événementsChangementProfondeur.emit("changé");
    };

    return { fOublier, fChangerProfondeur };
  }

  async suivreComptesRéseau({
    f,
    profondeur = 0,
    idCompteDébut,
  }: {
    f: schémaFonctionSuivi<infoMembreRéseau[]>;
    profondeur?: number;
    idCompteDébut?: string;
  }): Promise<schémaRetourFonctionRecherche> {
    // console.log("suivreComptesRéseau", { f, idCompteDébut });
    const fSuivi = (relations: infoRelation[]) => {
      // S'ajouter soi-même
      relations.push({
        de: this.client!.idBdCompte!,
        pour: this.client!.idBdCompte!,
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
        ([idBdCompte, rs]) => {
          const maRelation = rs.find((r) => r.de === this.client.idBdCompte);

          if (maRelation?.confiance === 1 || maRelation?.confiance === -1) {
            return {
              idBdCompte,
              profondeur: 0,
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
                    Math.pow(FACTEUR_ATÉNUATION_BLOQUÉS, r.profondeur)
              )
              .reduce((total, c) => c * total, 1);

          const confiance =
            1 -
            rsPositives
              .map(
                (r) =>
                  1 -
                  r.confiance *
                    Math.pow(FACTEUR_ATÉNUATION_CONFIANCE, r.profondeur)
              )
              .reduce((total, c) => c * total, 1) -
            coûtNégatif;

          return {
            idBdCompte,
            profondeur: profondeurCompte,
            confiance,
          };
        }
      );

      f(comptes);
    };

    return await this.suivreRelationsConfiance({
      f: fSuivi,
      profondeur,
      idCompteDébut,
    });
  }

  async suivreComptesRéseauEtEnLigne({
    f,
    profondeur = 0,
    idCompteDébut,
  }: {
    f: schémaFonctionSuivi<infoMembreRéseau[]>;
    profondeur?: number;
    idCompteDébut?: string;
  }): Promise<schémaRetourFonctionRecherche> {
    // console.log("suivreComptesRéseauEtEnLigne", { f, idCompteDébut });
    const dicComptes: {
      réseau: infoMembreRéseau[];
      enLigne: infoMembreRéseau[];
    } = {
      réseau: [],
      enLigne: [],
    };
    const fFinale = () => {
      const membres = [...dicComptes.réseau];
      dicComptes.enLigne.forEach((c) => {
        if (!membres.find((m) => m.idBdCompte === c.idBdCompte)) {
          membres.push(c);
        }
      });
      f(membres);
    };

    const fOublierComptesEnLigne = await this.suivreConnexionsMembres({
      f: (membres: statutMembre[]) => {
        const infoMembresEnLigne: infoMembreRéseau[] = membres
          .filter((m) => m.infoMembre.idBdCompte !== this.client.idBdCompte)
          .map((m) => {
            return {
              idBdCompte: m.infoMembre.idBdCompte,
              profondeur: -1,
              confiance: 0,
            };
          });
        dicComptes.enLigne = infoMembresEnLigne;
        fFinale();
      },
    });

    const fSuivreComptesRéseau = (comptes: infoMembreRéseau[]) => {
      dicComptes.réseau = comptes;
      fFinale();
    };

    const { fOublier: fOublierComptesRéseau, fChangerProfondeur } =
      await this.suivreComptesRéseau({
        f: fSuivreComptesRéseau,
        profondeur,
        idCompteDébut,
      });

    const fOublier = () => {
      fOublierComptesEnLigne();
      fOublierComptesRéseau();
    };

    return { fOublier, fChangerProfondeur };
  }

  async suivreConfianceMonRéseauPourMembre({
    idBdCompte,
    f,
    profondeur = 4,
    idBdCompteRéférence,
  }: {
    idBdCompte: string;
    f: schémaFonctionSuivi<number>;
    profondeur?: number;
    idBdCompteRéférence?: string;
  }): Promise<schémaRetourFonctionRecherche> {
    /* console.log("suivreConfianceMonRéseauPourMembre", {
      idBdCompte,
      idBdCompteRéférence,
    });*/

    idBdCompteRéférence = idBdCompteRéférence || this.client.idBdCompte!;

    const fFinale = (membres: infoMembreRéseau[]) => {
      const infoRecherchée = membres.find((m) => m.idBdCompte === idBdCompte);
      f(infoRecherchée?.confiance || 0);
    };

    return await this.suivreComptesRéseau({
      f: fFinale,
      profondeur,
      idCompteDébut: idBdCompteRéférence,
    });
  }

  async suivreConnexionsPostesSFIP({
    f,
  }: {
    f: schémaFonctionSuivi<{ addr: string; peer: string }[]>;
  }): Promise<schémaFonctionOublier> {
    const dédédoublerConnexions = (
      connexions: PeersResult[]
    ): PeersResult[] => {
      const adrDéjàVues: string[] = [];
      const dédupliquées: PeersResult[] = [];

      // Enlever les doublons
      for (const c of connexions) {
        if (!adrDéjàVues.includes(c.peer)) {
          adrDéjàVues.push(c.peer);
          dédupliquées.push(c);
        }
      }

      return dédupliquées;
    };

    const fFinale = async () => {
      const connexions = await this.client.sfip!.swarm.peers();
      // Enlever les doublons (pas trop sûr ce qu'ils font ici)
      const connexionsUniques = dédédoublerConnexions(connexions);
      f(
        connexionsUniques.map((c) => {
          return { addr: c.addr.toString(), peer: c.peer.toString() };
        })
      );
    };

    this.on("changementConnexions", fFinale);
    fFinale();

    const oublier = () => {
      this.off("changementConnexions", fFinale);
    };
    return oublier;
  }

  async suivreConnexionsDispositifs({
    f,
  }: {
    f: schémaFonctionSuivi<statutDispositif[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = () => {
      f(Object.values(this.dispositifsEnLigne));
    };

    this.on("membreVu", fFinale);
    fFinale();

    const oublier = () => {
      this.off("membreVu", fFinale);
    };
    return oublier;
  }

  async suivreConnexionsMembres({
    f,
  }: {
    f: schémaFonctionSuivi<statutMembre[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (dispositifs: statutDispositif[]) => {
      const membres: { [key: string]: statutMembre } = {};

      for (const d of dispositifs) {
        const { idCompte } = d.infoDispositif;
        if (!membres[idCompte]) {
          membres[idCompte] = {
            infoMembre: {
              idBdCompte: idCompte,
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
      f(Object.values(membres));
    };

    return await this.suivreConnexionsDispositifs({ f: fFinale });
  }

  async suivreNomsMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (noms?: { [key: string]: string }) => {
      return f(noms || {});
    };
    return await this.client.suivreBdDeClef({
      id: idCompte,
      clef: "compte",
      f: fFinale,
      fSuivre: ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<{ [key: string]: string }>;
      }) => this.client.profil!.suivreNoms({ f: fSuivreBd, idBdProfil: id }),
    });
  }

  async suivreCourrielMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<string | null | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeClef({
      id: idCompte,
      clef: "compte",
      f,
      fSuivre: async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<string | null>;
      }) =>
        await this.client.profil!.suivreCourriel({
          f: fSuivreBd,
          idBdProfil: id,
        }),
    });
  }

  async suivreImageMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<Uint8Array | null>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (image?: Uint8Array | null) => {
      return f(image || null);
    };
    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<Uint8Array | null>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.profil!.suivreImage({
        f: fSuivreBd,
        idBdProfil: id,
      });
    };
    return await this.client.suivreBdDeClef({
      id: idCompte,
      clef: "compte",
      f: fFinale,
      fSuivre,
    });
  }

  async rechercher<T extends infoRésultat | infoRésultatVide>({
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
      fSuivi: (x: string[] | undefined) => void;
    }) => Promise<schémaFonctionOublier>;
    fConfiance: schémaFonctionSuivreConfianceRecherche;
    fQualité: schémaFonctionSuivreQualitéRecherche;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
    fScore?: (r: résultatRechercheSansScore<T>) => number;
  }): Promise<réponseSuivreRecherche> {
    // console.log("rechercher");
    if (!fScore) {
      fScore = (x: résultatRechercheSansScore<T>): number => {
        return (x.confiance + x.qualité + x.objectif.score) / 3;
      };
    }
    // @ts-ignore
    fObjectif = fObjectif || rechercherTous();

    const résultatsParMembre: {
      [key: string]: {
        résultats: résultatRecherche<T>[];
        membre: infoMembreRéseau;
        mettreÀJour: (membre: infoMembreRéseau) => void;
      };
    } = {};

    const fsOublierRechercheMembres: { [key: string]: schémaFonctionOublier } =
      {};

    const DÉLAI_REBOURS = 3000;
    let annulerRebours: NodeJS.Timeout;
    const profondeur = 3;

    const ajusterProfondeur = (p: number) => {
      fChangerProfondeur(p);
      if (annulerRebours) clearTimeout(annulerRebours);
    };

    const débuterReboursAjusterProfondeur = (délai = DÉLAI_REBOURS) => {
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

    const fFinale = () => {
      const résultats: résultatRecherche<T>[] = Object.values(
        résultatsParMembre
      )
        .map((listeRésultats) => listeRésultats.résultats)
        .flat();
      const résultatsOrdonnés = résultats.sort((a, b) =>
        a.résultatObjectif.score < b.résultatObjectif.score ? 1 : -1
      );
      f(résultatsOrdonnés.slice(0, nRésultatsDésirés));
      débuterReboursAjusterProfondeur();
    };

    const suivreRésultatsMembre = async (
      membre: infoMembreRéseau
    ): Promise<void> => {
      const { idBdCompte } = membre;

      const fListe = async (
        fSuivreRacine: (éléments: string[]) => Promise<void>
      ): Promise<schémaFonctionOublier> => {
        return await fRecherche({
          idCompte: membre.idBdCompte,
          fSuivi: async (résultats) => await fSuivreRacine(résultats || []),
        });
      };

      const fSuivi = (résultats: résultatRecherche<T>[]) => {
        résultatsParMembre[idBdCompte].résultats = résultats;
        fFinale();
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
        const fFinaleSuivreBranche = () => {
          const { objectif, confiance, qualité } = rés;
          if (objectif && confiance !== undefined && qualité !== undefined) {
            const résultatFinalBranche: résultatRecherche<T> = {
              id,
              résultatObjectif: {
                ...objectif,
                score: fScore!(rés as résultatRechercheSansScore<T>),
              },
            };
            fSuivreBranche(résultatFinalBranche);
          } else {
            fSuivreBranche(undefined);
          }
        };

        const fSuivreObjectif = (objectif?: infoRésultatRecherche<T>) => {
          rés.objectif = objectif;
          fFinaleSuivreBranche();
        };
        const fOublierObjectif = await fObjectif!(
          this.client,
          id,
          fSuivreObjectif
        );

        const fSuivreConfiance = (confiance?: number) => {
          rés.confiance = confiance;
          fFinaleSuivreBranche();
        };
        const fOublierConfiance = await fConfiance(id, fSuivreConfiance);

        const fSuivreQualité = (qualité?: number) => {
          rés.qualité = qualité;
          fFinaleSuivreBranche();
        };
        const fOublierQualité = await fQualité(id, fSuivreQualité);

        const fOublierBranche = () => {
          fOublierObjectif();
          fOublierConfiance();
          fOublierQualité();
        };

        return fOublierBranche;
      };

      résultatsParMembre[idBdCompte] = {
        résultats: [] as résultatRecherche<T>[],
        membre,
        mettreÀJour: () => {
          fFinale();
        },
      };

      const fOublierRechercheMembre =
        await this.client.suivreBdsDeFonctionListe({
          fListe,
          f: fSuivi,
          fBranche,
        });

      fsOublierRechercheMembres[idBdCompte] = fOublierRechercheMembre;
    };

    const oublierRésultatsMembre = (compte: string) => {
      fsOublierRechercheMembres[compte]?.();
      console.log(
        "On oublie le compte: ",
        compte,
        fsOublierRechercheMembres[compte]
      );
      delete résultatsParMembre[compte];
      delete fsOublierRechercheMembres[compte];
      fFinale();
    };

    const verrou = new Semaphore();

    const fSuivreComptes = async (
      comptes: infoMembreRéseau[]
    ): Promise<void> => {
      await verrou.acquire("rechercher");
      console.log("verrou aquis");

      comptes = comptes.filter((c) => c.confiance >= 0); // Enlever les membres bloqués

      const nouveaux = comptes.filter((c) => !résultatsParMembre[c.idBdCompte]);
      const clefsObsolètes = Object.keys(résultatsParMembre).filter(
        (m) => !comptes.find((c) => c.idBdCompte === m)
      );
      const changés = comptes.filter((c) => {
        const avant = résultatsParMembre[c.idBdCompte];
        return (
          avant &&
          (c.confiance !== avant.membre.confiance ||
            c.profondeur !== avant.membre.profondeur)
        );
      });

      console.log({ nouveaux, changés, clefsObsolètes });

      await Promise.all(nouveaux.map(suivreRésultatsMembre));
      changés.forEach((c) => résultatsParMembre[c.idBdCompte].mettreÀJour(c));

      clefsObsolètes.forEach((o) => oublierRésultatsMembre(o));

      console.log("verrou relâché");
      verrou.release("rechercher");
    };

    const { fChangerProfondeur, fOublier: fOublierSuivreComptes } =
      await this.suivreComptesRéseauEtEnLigne({
        f: fSuivreComptes,
        profondeur,
      });

    const fChangerN = (nouveauN: number) => {
      const nDésirésAvant = nRésultatsDésirés;
      nRésultatsDésirés = nouveauN;
      if (nouveauN !== nDésirésAvant) fFinale();
      débuterReboursAjusterProfondeur(0);
    };

    const fOublier = () => {
      fOublierSuivreComptes();
      Object.values(fsOublierRechercheMembres).forEach((f) => f());
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
  }): Promise<réponseSuivreRecherche> {
    // console.log("rechercherMembres");
    const fConfiance = async (
      idCompte: string,
      fSuivi: schémaFonctionSuivi<number>
    ) => {
      const { fOublier } = await this.suivreConfianceMonRéseauPourMembre({
        idBdCompte: idCompte,
        f: fSuivi,
      });
      return fOublier;
    };

    const fRecherche = async ({
      idCompte,
      fSuivi,
    }: {
      idCompte: string;
      fSuivi: (compte: [string]) => void;
    }): Promise<schémaFonctionOublier> => {
      fSuivi([idCompte]); // Rien à faire parce que nous ne recherchons que le compte
      return faisRien;
    };

    const fQualité = async (
      idCompte: string,
      fSuivi: schémaFonctionSuivi<number>
    ): Promise<schémaFonctionOublier> => {
      const fRechercherSelonActivité = rechercherProfilSelonActivité();
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
    clef: string;
    f: schémaFonctionSuivi<number>;
  }): Promise<schémaFonctionOublier> {
    // console.log("suivreConfianceAuteurs", { idItem, clef });
    const fListe = async (
      fSuivreRacine: (auteurs: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreAuteursObjet({
        idObjet: idItem,
        clef,
        f: async (auteurs: infoAuteur[]) => {
          const idsAuteurs = auteurs
            .filter((a) => a.accepté)
            .map((a) => a.idBdCompte);
          return await fSuivreRacine(idsAuteurs);
        },
      });
    };

    const fBranche = async (
      idAuteur: string,
      fSuivreBranche: schémaFonctionSuivi<number>
    ): Promise<schémaFonctionOublier> => {
      const { fOublier } = await this.suivreConfianceMonRéseauPourMembre({
        idBdCompte: idAuteur,
        f: fSuivreBranche,
      });
      return fOublier;
    };

    const fFinale = (confiances: number[]) => {
      const confiance = confiances.reduce((a, b) => a + b, 0);
      f(confiance);
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
    fQualité,
    fObjectif,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    clef: string;
    nRésultatsDésirés: number;
    fRecherche: (args: {
      idCompte: string;
      f: (bds: string[] | undefined) => void;
    }) => Promise<schémaFonctionOublier>;
    fQualité: schémaFonctionSuivreQualitéRecherche;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
  }): Promise<réponseSuivreRecherche> {
    const fRechercheFinale = async ({
      idCompte,
      fSuivi,
    }: {
      idCompte: string;
      fSuivi: (bds: string[] | undefined) => void;
    }): Promise<schémaFonctionOublier> => {
      const résultats: { propres: string[]; favoris: string[] } = {
        propres: [],
        favoris: [],
      };

      const fFinale = () => {
        const tous = [...new Set([...résultats.propres, ...résultats.favoris])];
        fSuivi(tous);
      };

      const fOublierPropres = await fRecherche({
        idCompte,
        f: (propres) => {
          résultats.propres = propres || [];
          fFinale();
        },
      });

      const fOublierFavoris = await this.suivreFavorisMembre({
        idCompte,
        f: (favoris) => {
          résultats.favoris = favoris ? Object.keys(favoris) : [];
          fFinale();
        },
      });

      return () => {
        fOublierPropres();
        fOublierFavoris();
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

  async rechercherBds<T extends infoRésultat>({
    f,
    nRésultatsDésirés,
    fObjectif,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    nRésultatsDésirés: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
  }): Promise<réponseSuivreRecherche> {
    const fRecherche = this.suivreBdsMembre.bind(this);
    const fQualité = async (
      id: string,
      fSuivreQualité: schémaFonctionSuivi<number>
    ) => {
      const fFinaleSuivreQualité = (score: infoScore) => {
        fSuivreQualité(score.total);
      };
      return await this.client.bds!.suivreScoreBd({
        id,
        f: fFinaleSuivreQualité,
      });
    };

    return await this.rechercherObjets({
      f,
      clef: "bds",
      nRésultatsDésirés,
      fRecherche,
      fQualité,
      fObjectif,
    });
  }

  async rechercherVariables<T extends infoRésultat>({
    f,
    nRésultatsDésirés,
    fObjectif,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    nRésultatsDésirés: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
  }): Promise<réponseSuivreRecherche> {
    const fRecherche = this.suivreVariablesMembre.bind(this);

    const fQualité = async (
      id: string,
      fSuivreQualité: schémaFonctionSuivi<number>
    ) => {
      return await this.client.variables!.suivreQualitéVariable({
        id,
        f: fSuivreQualité,
      });
    };

    return await this.rechercherObjets({
      f,
      clef: "variables",
      nRésultatsDésirés,
      fRecherche,
      fQualité,
      fObjectif,
    });
  }

  async rechercherMotsClefs<T extends infoRésultat>({
    f,
    nRésultatsDésirés,
    fObjectif,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    nRésultatsDésirés: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
  }): Promise<réponseSuivreRecherche> {
    const fRecherche = this.suivreMotsClefsMembre.bind(this);

    const fQualité = async (
      id: string,
      fSuivreQualité: schémaFonctionSuivi<number>
    ) => {
      return await this.client.motsClefs!.suivreQualitéMotClef({
        id,
        f: fSuivreQualité,
      });
    };

    return await this.rechercherObjets({
      f,
      clef: "motsClefs",
      nRésultatsDésirés,
      fRecherche,
      fQualité,
      fObjectif,
    });
  }

  async rechercherProjets<T extends infoRésultat>({
    f,
    nRésultatsDésirés,
    fObjectif,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    nRésultatsDésirés: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
  }): Promise<réponseSuivreRecherche> {
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

    return await this.rechercherObjets({
      f,
      clef: "projets",
      nRésultatsDésirés,
      fRecherche,
      fQualité,
      fObjectif,
    });
  }

  async suivreAuteursObjet({
    idObjet,
    clef,
    f,
  }: {
    idObjet: string;
    clef: string;
    f: schémaFonctionSuivi<infoAuteur[]>;
  }): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (éléments: infoAccès[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.suivreAccèsBd({ id: idObjet, f: fSuivreRacine });
    };
    const fBranche = async (
      idBdCompte: string,
      fSuivreBranche: schémaFonctionSuivi<infoAuteur[]>,
      branche: infoAccès
    ) => {
      const fFinaleSuivreBranche = (bdsMembre?: string[]) => {
        bdsMembre = bdsMembre || [];
        return fSuivreBranche([
          {
            idBdCompte: branche.idBdCompte,
            rôle: branche.rôle,
            accepté: bdsMembre.includes(idObjet),
          },
        ]);
      };
      return await this.client.suivreBdListeDeClef({
        id: idBdCompte,
        clef,
        f: fFinaleSuivreBranche,
      });
    };
    const fIdBdDeBranche = (x: infoAccès) => x.idBdCompte;
    const fCode = (x: infoAccès) => x.idBdCompte;

    const fOublier = this.client.suivreBdsDeFonctionListe({
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
    clef,
    fListeObjets,
    fSuivi,
  }: {
    idCompte: string;
    clef: string;
    fListeObjets: (args: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<string[]>;
    }) => Promise<schémaFonctionOublier>;
    fSuivi: schémaFonctionSuivi<string[] | undefined>;
  }): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.suivreBdDeClef({
        id: idCompte,
        clef,
        f: (ids?: string[]) => fSuivreRacine(ids || []),
        fSuivre: fListeObjets,
      });
    };
    return await this.client.suivreBdsSelonCondition({
      fListe,
      fCondition: async (
        id: string,
        fSuivreCondition: schémaFonctionSuivi<boolean>
      ): Promise<schémaFonctionOublier> => {
        return await this.client.suivreAccèsBd({
          id,
          f: (autorisés: infoAccès[]) =>
            fSuivreCondition(
              autorisés.map((a) => a.idBdCompte).includes(idCompte)
            ),
        });
      },
      f: fSuivi,
    });
  }

  async suivreBdsMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<string[] | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreObjetsMembre({
      idCompte,
      clef: "bds",
      fListeObjets: async ({ id, fSuivreBd }) =>
        await this.client.bds!.suivreBds({ f: fSuivreBd, idBdBdsCompte: id }),
      fSuivi: f,
    });
  }

  async suivreProjetsMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<string[] | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreObjetsMembre({
      idCompte,
      clef: "projets",
      fListeObjets: async ({ id, fSuivreBd }) =>
        await this.client.projets!.suivreProjets({
          f: fSuivreBd,
          idBdProjets: id,
        }),
      fSuivi: f,
    });
  }

  async suivreFavorisMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<ÉlémentFavorisAvecObjet[] | undefined>;
  }): Promise<schémaFonctionOublier> {
    // suivreFavoris est différent parce qu'on n'a pas besoin de vérifier l'autorisation du membre
    const fSuivreFavoris = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<(ÉlémentFavoris & { idObjet: string })[]>;
    }) => {
      return await this.client.favoris!.suivreFavoris({
        f: fSuivreBd,
        idBdFavoris: id,
      });
    };
    return await this.client.suivreBdDeClef({
      id: idCompte,
      clef: "favoris",
      f,
      fSuivre: fSuivreFavoris,
    });
  }

  async suivreVariablesMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<string[] | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreObjetsMembre({
      idCompte,
      clef: "variables",
      fListeObjets: async ({ id, fSuivreBd }) =>
        await this.client.variables!.suivreVariables({
          f: fSuivreBd,
          idBdVariables: id,
        }),
      fSuivi: f,
    });
  }

  async suivreMotsClefsMembre({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<string[] | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreObjetsMembre({
      idCompte,
      clef: "motsClefs",
      fListeObjets: async ({ id, fSuivreBd }) =>
        await this.client.motsClefs!.suivreMotsClefs({
          f: fSuivreBd,
          idBdMotsClefs: id,
        }),
      fSuivi: f,
    });
  }

  async suivreFavorisObjet({
    idObjet,
    f,
    profondeur = 5,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<
      (ÉlémentFavorisAvecObjet & { idBdCompte: string })[]
    >;
    profondeur?: number;
  }): Promise<schémaRetourFonctionRecherche> {
    // console.log("suivreFavorisObjet", { idObjet, f });
    const fFinale = (
      favoris: (ÉlémentFavoris & { idObjet: string; idBdCompte: string })[]
    ) => {
      const favorisDIntérêt = favoris.filter((f) => f.idObjet === idObjet);
      f(favorisDIntérêt);
    };

    const fListe = async (
      fSuivreRacine: (membres: string[]) => Promise<void>
    ): Promise<schémaRetourFonctionRecherche> => {
      const fSuivreComptes = async (infosMembres: infoMembreRéseau[]) => {
        // On s'ajoute à la liste des favoris
        return await fSuivreRacine([
          this.client.idBdCompte!,
          ...infosMembres.map((i) => i.idBdCompte),
        ]);
      };

      return await this.suivreComptesRéseauEtEnLigne({
        f: fSuivreComptes,
        profondeur,
        idCompteDébut: this.client.idBdCompte!,
      });
    };

    const fBranche = async (
      idBdCompte: string,
      fSuivreBranche: schémaFonctionSuivi<
        (ÉlémentFavoris & { idObjet: string; idBdCompte: string })[] | undefined
      >
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreFavorisMembre({
        idCompte: idBdCompte,
        f: (favoris: (ÉlémentFavoris & { idObjet: string })[] | undefined) =>
          fSuivreBranche(
            favoris
              ? favoris.map((fav) => {
                  return { idBdCompte, ...fav };
                })
              : favoris
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
    profondeur = 5,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<infoRéplications>;
    profondeur?: number;
  }): Promise<schémaRetourFonctionRecherche> {
    const résultats: {
      connexionsMembres: statutMembre[];
      connexionsDispositifs: statutDispositif[];
      favoris: {
        favoris: ÉlémentFavoris & { idObjet: string; idBdCompte: string };
        dispositifs: string[];
      }[];
    } = { connexionsMembres: [], connexionsDispositifs: [], favoris: [] };

    const fFinale = async () => {
      const { connexionsMembres, favoris } = résultats;
      const idsMembres = favoris.map((fav) => fav.favoris.idBdCompte);
      const membres = connexionsMembres.filter((c) =>
        idsMembres.includes(c.infoMembre.idBdCompte)
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
                  (c) => c.infoDispositif.idOrbite === d
                )?.vuÀ;
                const dispositifsRéplication: épingleDispositif & {
                  idDispositif: string;
                  vuÀ?: number;
                } = {
                  idObjet,
                  idDispositif: d,
                  bd: await this.client.favoris!.estÉpingléSurDispositif({
                    dispositifs: favoris.dispositifs,
                    idOrbite: d,
                  }),
                  fichiers: await this.client.favoris!.estÉpingléSurDispositif({
                    dispositifs: favoris.dispositifsFichiers,
                    idOrbite: d,
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
      f(réplications);
    };

    const fOublierConnexionsMembres = await this.suivreConnexionsMembres({
      f: (connexions) => {
        résultats.connexionsMembres = connexions;
        fFinale();
      },
    });

    const fOublierConnexionsDispositifs =
      await this.suivreConnexionsDispositifs({
        f: (connexions) => {
          résultats.connexionsDispositifs = connexions;
          fFinale();
        },
      });

    const fSuivreFavoris = (
      favoris: {
        favoris: ÉlémentFavoris & { idObjet: string; idBdCompte: string };
        dispositifs: string[];
      }[]
    ) => {
      résultats.favoris = favoris;
      fFinale();
    };

    const fListeFavoris = async (
      fSuivreRacine: (
        favoris: (ÉlémentFavoris & { idObjet: string; idBdCompte: string })[]
      ) => void
    ): Promise<schémaRetourFonctionRecherche> => {
      return await this.suivreFavorisObjet({
        idObjet,
        f: fSuivreRacine,
        profondeur,
      });
    };

    const fBrancheFavoris = async (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<{
        favoris: ÉlémentFavoris & { idObjet: string; idBdCompte: string };
        dispositifs: string[];
      }>,
      branche: ÉlémentFavoris & { idObjet: string; idBdCompte: string }
    ): Promise<schémaFonctionOublier> => {
      const fSuivreMembre = (dispositifs: string[]) => {
        fSuivreBranche({ favoris: branche, dispositifs });
      };

      const fOublierDispositifsMembre = await this.client.suivreDispositifs({
        f: fSuivreMembre,
        idBdCompte: id,
      });

      return () => {
        fOublierDispositifsMembre();
      };
    };

    const fIdBdDeBranche = (
      x: ÉlémentFavoris & { idObjet: string; idBdCompte: string }
    ) => x.idBdCompte;
    const fCode = (
      x: ÉlémentFavoris & { idObjet: string; idBdCompte: string }
    ) => x.idBdCompte;

    const { fOublier: fOublierFavoris, fChangerProfondeur } =
      await this.client.suivreBdsDeFonctionRecherche({
        fListe: fListeFavoris,
        f: fSuivreFavoris,
        fBranche: fBrancheFavoris,
        fIdBdDeBranche,
        fCode,
      });

    const fOublier = () => {
      fOublierFavoris();
      fOublierConnexionsMembres();
      fOublierConnexionsDispositifs();
    };
    return { fOublier, fChangerProfondeur };
  }

  async suivreBdsDeMotClef({
    motClefUnique,
    f,
    nRésultatsDésirés,
  }: {
    motClefUnique: string;
    f: schémaFonctionSuivi<string[]>;
    nRésultatsDésirés: number;
  }): Promise<schémaRetourFonctionRecherche> {
    const fBranche = async (
      idCompte: string,
      f: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.suivreBdDeClef({
        id: idCompte,
        clef: "bds",
        f: (bds?: string[]) => {
          f(bds || []);
        },
        fSuivre: async ({ id }: { id: string }) => {
          return await this.client.bds!.rechercherBdsParMotsClefs({
            motsClefs: [motClefUnique],
            f,
            idBdBdsCompte: id,
          });
        },
      });
    };

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaRetourFonctionRecherche> => {
      return await this.suivreComptesRéseauEtEnLigne({
        f: (résultats) => fSuivreRacine(résultats.map((r) => r.idBdCompte)),
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
    motClefUnique,
    idUniqueTableau,
    f,
    nBds = 100,
  }: {
    motClefUnique: string;
    idUniqueTableau: string;
    f: schémaFonctionSuivi<élémentDeMembre<T>[]>;
    nBds?: number;
  }): Promise<schémaRetourFonctionRecherche> {
    const fListe = async (
      fSuivreRacine: (bds: bdDeMembre[]) => Promise<void>
    ): Promise<schémaRetourFonctionRecherche> => {
      const fListeListe = async (
        fSuivreRacineListe: (bds: string[]) => Promise<void>
      ): Promise<schémaRetourFonctionRecherche> => {
        return await this.suivreBdsDeMotClef({
          motClefUnique,
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
          f: (auteurs: infoAuteur[]) => {
            const idBdCompte = auteurs.find((a) => a.accepté)?.idBdCompte;
            const infoBdDeMembre: bdDeMembre | undefined = idBdCompte
              ? {
                  bd: idBd,
                  idBdCompte,
                }
              : undefined;
            f(infoBdDeMembre);
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
      const { idBdCompte } = branche;

      const fSuivreTableaux = async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (nouvelIdBdCible: string) => Promise<void>;
      }): Promise<schémaFonctionOublier> => {
        return await this.client.bds!.suivreTableauParIdUnique({
          idBd,
          idUniqueTableau,
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
        const fSuivreDonnéesTableauFinale = (données: élémentDonnées<T>[]) => {
          const donnéesMembre: élémentDeMembre<T>[] = données.map((d) => {
            return {
              idBdCompte,
              élément: d,
            };
          });
          fSuivreBd(donnéesMembre);
        };
        return await this.client.tableaux!.suivreDonnées({
          idTableau: id,
          f: fSuivreDonnéesTableauFinale,
        });
      };

      const fFinale = (données?: élémentDeMembre<T>[]) => {
        f(données || []);
      };

      return await this.client.suivreBdDeFonction({
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
    this.fsOublier.forEach((f) => f());
  }
}
