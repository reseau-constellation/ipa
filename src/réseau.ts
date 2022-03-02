import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";
import OrbitDB from "orbit-db";

import { PeersResult } from "ipfs-core-types/src/swarm";
import { Message as MessagePubSub } from "ipfs-core-types/src/pubsub";
import { EventEmitter } from "events";
import Semaphore from "@chriscdn/promise-semaphore";

import ContrôleurConstellation from "@/accès/cntrlConstellation";
import ClientConstellation, { Signature } from "@/client";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaRetourFonctionRecherche,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuivreQualitéRecherche,
  schémaFonctionSuivreConfianceRecherche,
  infoAuteur,
  résultatObjectifRecherche,
  faisRien,
} from "@/utils";
import { élémentBdListeDonnées } from "@/tableaux";
import { ÉlémentFavoris } from "@/favoris";
import { élémentDonnées } from "@/valid";
import { rechercherProfilSelonActivité, rechercherTous } from "@/recherche";
import obtStockageLocal from "@/stockageLocal";

export interface infoDispositif {
  idSFIP: string;
  idOrbite: string;
  idCompte: string;
  clefPublique: string;
  signatures: { id: string; publicKey: string };
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
  pronfondeur: number;
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
  idBd: string;
  membres: infoMembre[];
  dispositifs: infoDispositif[];
}

export interface résultatRechercheSansScore<T extends résultatObjectifRecherche> {
  id: string;
  objectif: T;
  confiance: number;
  qualité: number;

}

export interface résultatRecherche<T extends résultatObjectifRecherche> extends résultatRechercheSansScore<T> {
  score: number;
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
  signature: Signature;
  valeur: ValeurMessage;
}

interface ValeurMessage {
  type: string;
  contenu: ContenuMessage;
}

interface ContenuMessage {
  [key: string]: unknown;
}

interface ValeurMessageSalut extends ValeurMessage {
  type: "Salut !";
  contenu: ContenuMessageSalut;
}

interface ContenuMessageSalut extends ContenuMessage {
  idSFIP: string;
  idOrbite: string;
  idCompte: string;
  clefPublique: string;
  signatures: { id: string; publicKey: string };
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

const verrouAjouterMembre = new Semaphore();
const INTERVALE_SALUT = 1000 * 60;
const FACTEUR_ATÉNUATION_CONFIANCE = 0.8;
const FACTEUR_ATÉNUATION_BLOQUÉS = 0.9;
const CONFIANCE_DE_COAUTEUR = 0.9;
const CONFIANCE_DE_FAVORIS = 0.7;

const verrou = new Semaphore();

export default class Réseau extends EventEmitter {
  client: ClientConstellation;
  idBd: string;
  bloquésPrivés: Set<string>;

  dispositifsEnLigne: {
    [key: string]: statutDispositif;
  };

  fsOublier: schémaFonctionOublier[];
  fOublierMembres: { [key: string]: schémaFonctionOublier };

  constructor(client: ClientConstellation, idBd: string) {
    super();

    this.client = client;
    this.idBd = idBd;

    this.bloquésPrivés = new Set();

    this.dispositifsEnLigne = {};
    this.fOublierMembres = {};
    this.fsOublier = [
      () => Object.values(this.fOublierMembres).forEach((f) => f()),
    ];

    // N'oublions pas de nous ajouter nous-mêmes
    this.recevoirSalut({
      idSFIP: this.client.idNodeSFIP!.id,
      idOrbite: this.client.orbite!.identity.id,
      idCompte: this.client.idBdCompte!,
      clefPublique: this.client.orbite!.identity.publicKey,
      signatures: this.client.orbite!.identity.signatures,
    });
  }

  async initialiser(): Promise<void> {
    const idSFIP = this.client.idNodeSFIP!.id;
    await this.client.sfip!.pubsub.subscribe(
      `${this.client.sujet_réseau}-${idSFIP}`,
      (msg: MessagePubSub) => this.messageReçu(msg, true)
    );

    await this.client.sfip!.pubsub.subscribe(
      this.client.sujet_réseau,
      (msg: MessagePubSub) => this.messageReçu(msg, false)
    );

    for (const é of ["peer:connect", "peer:disconnect"]) {
      // @ts-ignore
      this.client.sfip!.libp2p.connectionManager.on(é, () => {
        this.emit("changementConnexions");
      });
    }

    const x = setInterval(() => {
      this.direSalut();
    }, INTERVALE_SALUT);
    this.fsOublier.push(() => clearInterval(x));

    this.direSalut();
  }

  async envoyerMessage(msg: Message, idSFIP?: string): Promise<void> {
    const sujet = idSFIP
      ? `${this.client.sujet_réseau}-${idSFIP}`
      : this.client.sujet_réseau;
    const msgBinaire = Buffer.from(JSON.stringify(msg));
    await this.client.sfip!.pubsub.publish(sujet, msgBinaire);
  }

  async direSalut(à?: string): Promise<void> {
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
    const signature = await this.client.signer(JSON.stringify(valeur));
    const message: Message = {
      signature,
      valeur,
    };
    await this.envoyerMessage(message, à);
  }

  async messageReçu(msg: MessagePubSub, personnel: boolean): Promise<void> {
    const messageJSON = JSON.parse(msg.data.toString());

    const { valeur, signature } = messageJSON;

    // Ignorer les messages de nous-mêmes
    if (signature.clefPublique === this.client.orbite!.identity.publicKey) {
      return;
    }

    // Assurer que la signature est valide (message envoyé par détenteur de idOrbite)
    const signatureValide = await this.client.vérifierSignature(
      signature,
      JSON.stringify(valeur)
    );
    if (!signatureValide) return;

    const contenu = valeur.contenu as ContenuMessage;
    const { clefPublique } = contenu;

    // S'assurer que idOrbite est la même que celle sur la signature
    if (clefPublique !== signature.clefPublique) return;

    switch (valeur.type) {

      case "Salut !": {
        const contenuSalut = contenu as ContenuMessageSalut

        this.recevoirSalut(contenuSalut);

        if (!personnel) this.direSalut(contenuSalut.idSFIP);  // Renvoyer le message, si ce n'était pas déjà fait
        break;
      }
      default: console.error(`Message inconnu: ${valeur.type}`)
    }
  }

  async recevoirSalut(message: ContenuMessageSalut): Promise<void> {
    const dispositifValid = await this._validerInfoMembre(message)
    if (!dispositifValid) return
    this.dispositifsEnLigne[message.idOrbite] = {
      infoDispositif: message,
      vuÀ: new Date().getTime(),
    };

    this.emit("membreVu");
  }

  async _validerInfoMembre(info: infoDispositif): Promise<boolean> {
    const { idCompte, signatures, clefPublique, idOrbite } = info;

    if (!(idCompte && signatures && clefPublique && idOrbite)) return false;

    const sigIdValide = await this.client.vérifierSignature(
      {
        signature: signatures.id,
        clefPublique: clefPublique,
      },
      idOrbite
    );

    const sigClefPubliqueValide = await this.client.vérifierSignature(
      {
        signature: signatures.publicKey,
        clefPublique: idOrbite,
      },
      clefPublique + signatures.id
    );

    if (!OrbitDB.isValidAddress(idCompte)) return false;
    const { bd: bdCompte, fOublier } = await this.client.ouvrirBd(idCompte);
    if (!(bdCompte.access instanceof ContrôleurConstellation)) return false;
    const bdCompteValide = bdCompte.access.estAutorisé(idOrbite);

    fOublier();
    return sigIdValide && sigClefPubliqueValide && bdCompteValide;
  }

  async faireConfianceAuMembre(idBdCompte: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<statutConfianceMembre>
    >(this.idBd);
    await bd.set(idBdCompte, "FIABLE");
    fOublier();
  }

  async suivreFiables(
    f: schémaFonctionSuivi<string[]>,
    idBdCompte?: string
  ): Promise<schémaFonctionOublier> {
    idBdCompte = idBdCompte || this.client.idBdCompte!;

    const fFinale = (membres: typeÉlémentsBdRéseau[]): void => {
      const bloqués = membres
        .filter((m) => m.statut === "FIABLE")
        .map((m) => m.idBdCompte);
      f(bloqués);
    };

    return await this.client.suivreBdListeDeClef<typeÉlémentsBdRéseau>(
      idBdCompte,
      "réseau",
      fFinale
    );
  }

  async _initaliserBloquésPrivés(): Promise<void> {
    const stockageLocal = await obtStockageLocal();
    const bloquésPrivésChaîne = stockageLocal.getItem("membresBloqués");
    if (bloquésPrivésChaîne) {
      JSON.parse(bloquésPrivésChaîne).forEach((b: string) =>
        this.bloquésPrivés.add(b)
      );
      this.emit("changementMembresBloqués");
    }
  }

  async _sauvegarderBloquésPrivés(): Promise<void> {
    const stockageLocal = await obtStockageLocal();
    const bloqués = [...this.bloquésPrivés];

    stockageLocal.setItem("membresBloqués", JSON.stringify(bloqués));
  }

  async bloquerMembre(idBdCompte: string, privé = false): Promise<void> {
    if (privé) {
      this.bloquésPrivés.add(idBdCompte);
      await this._sauvegarderBloquésPrivés();
    } else {
      const { bd, fOublier } = await this.client.ouvrirBd<
        KeyValueStore<statutConfianceMembre>
      >(this.idBd);
      await bd.set(idBdCompte, "BLOQUÉ");
      fOublier();
    }
    this.emit("changementMembresBloqués");
  }

  async débloquerMembre(idBdCompte: string): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<statutConfianceMembre>
    >(this.idBd);
    if (
      Object.keys(ClientConstellation.obtObjetdeBdDic(bd)).includes(idBdCompte)
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

  async suivreBloquésPubliques(
    f: schémaFonctionSuivi<string[]>,
    idBdCompte?: string
  ): Promise<schémaFonctionOublier> {
    idBdCompte = idBdCompte || this.client.idBdCompte!;

    const fFinale = (membres: typeÉlémentsBdRéseau[]): void => {
      const bloqués = membres
        .filter((m) => m.statut === "BLOQUÉ")
        .map((m) => m.idBdCompte);
      f(bloqués);
    };

    return await this.client.suivreBdListeDeClef<typeÉlémentsBdRéseau>(
      idBdCompte,
      "réseau",
      fFinale
    );
  }

  async suivreBloqués(
    f: schémaFonctionSuivi<infoBloqué[]>,
    idBdRacine?: string
  ): Promise<schémaFonctionOublier> {
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
      await this.suivreBloquésPubliques((blqs: string[]) => {
        bloquésPubliques = blqs;
        fFinale();
      }, idBdRacine)
    );

    if (idBdRacine === this.client.idBdCompte) {
      await this._initaliserBloquésPrivés();
      this.on("changementMembresBloqués", fFinale);
      fsOublier.push(() => this.off("changementMembresBloqués", fFinale));
      fFinale();
    }

    return () => {
      fsOublier.forEach((f) => f());
    };
  }

  async suivreRelationsImmédiates(
    idBdCompte: string,
    f: schémaFonctionSuivi<infoConfiance[]>
  ): Promise<schémaFonctionOublier> {
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
      const tous = [
        ...comptes.suivis,
        ...comptes.favoris,
        ...comptes.coauteursBds,
        ...comptes.coauteursProjets,
        ...comptes.coauteursMotsClefs,
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
      await this.suivreBloqués(
        (blqs: infoBloqué[]) => (bloqués = blqs.map((b) => b.idBdCompte)),
        idBdCompte
      )
    );

    fsOublier.push(
      await this.client.suivreBdListeDeClef<string>(
        idBdCompte,
        "réseau.membresBloqués",
        (membres: string[]) => {
          comptes.suivis = membres.map((m) => {
            return { idBdCompte: m, confiance: 1 };
          });
          fFinale();
        }
      )
    );

    const inscrireSuiviAuteurs = async (
      fListe: (
        fSuivreRacine: (é: string[]) => Promise<void>
      ) => Promise<schémaFonctionOublier>,
      confiance: number
    ) => {
      fsOublier.push(
        await this.client.suivreBdsDeFonctionListe(
          fListe,
          (membres: string[]) => {
            comptes.favoris = membres.map((idBdCompte) => {
              return { idBdCompte, confiance };
            });
            fFinale();
          },
          async (id: string, fSuivi: schémaFonctionSuivi<infoAuteur[]>) => {
            return await this.client.suivreAuteurs(id, fSuivi);
          }
        )
      );
    };

    const fSuivreFavoris = async (
      fSuivreRacine: (é: string[]) => Promise<void>
    ) => {
      return await this.client.favoris!.suivreFavoris(
        (favoris) => fSuivreRacine(Object.keys(favoris)),
        idBdCompte
      );
    };
    await inscrireSuiviAuteurs(fSuivreFavoris, CONFIANCE_DE_FAVORIS);

    const fSuivreBds = async (
      fSuivreRacine: (é: string[]) => Promise<void>
    ) => {
      return await this.client.bds!.suivreBds(
        (bds) => fSuivreRacine(bds),
        idBdCompte
      );
    };
    await inscrireSuiviAuteurs(fSuivreBds, CONFIANCE_DE_COAUTEUR);

    const fSuivreProjets = async (
      fSuivreRacine: (é: string[]) => Promise<void>
    ) => {
      return await this.client.projets!.suivreProjets(
        (projets) => fSuivreRacine(projets),
        idBdCompte
      );
    };
    await inscrireSuiviAuteurs(fSuivreProjets, CONFIANCE_DE_COAUTEUR);

    const fSuivreVariables = async (
      fSuivreRacine: (é: string[]) => Promise<void>
    ) => {
      return await this.client.variables!.suivreVariables(
        (variables) => fSuivreRacine(variables),
        idBdCompte
      );
    };
    await inscrireSuiviAuteurs(fSuivreVariables, CONFIANCE_DE_COAUTEUR);

    const fSuivreMotsClefs = async (
      fSuivreRacine: (é: string[]) => Promise<void>
    ) => {
      return await this.client.projets!.suivreProjets(
        (projets) => fSuivreRacine(projets),
        idBdCompte
      );
    };
    await inscrireSuiviAuteurs(fSuivreMotsClefs, CONFIANCE_DE_COAUTEUR);

    return () => {
      fsOublier.forEach((f) => f());
    };
  }

  async suivreRelationsConfiance(
    idCompteDébut: string,
    f: schémaFonctionSuivi<infoRelation[]>,
    profondeur = 0
  ): Promise<schémaRetourFonctionRecherche> {
    let listeRelations: infoRelation[] = [];
    const dicInfoSuiviRelations: {
      [key: string]: {
        fOublier: schémaFonctionOublier;
        demandéePar: Set<string>;
      };
    } = {};
    const fsOublierÉvénements: { [key: string]: schémaFonctionOublier } = {};

    const fFinale = () => f(listeRelations);

    const événementsChangementProfondeur = new EventEmitter();

    const onNeSuitPasEncore = (idBdCompte: string): boolean => {
      return !dicInfoSuiviRelations[idBdCompte];
    };

    const onVeutOublier = (
      idBdCompte: string,
      idBdCompteDemandeur: string
    ): void => {
      const { fOublier, demandéePar } = dicInfoSuiviRelations[idBdCompte];
      demandéePar.delete(idBdCompteDemandeur);

      if (!demandéePar.size) {
        fOublier();
        const plusDemandées = listeRelations.filter((r) => r.de === idBdCompte);
        listeRelations = listeRelations.filter((r) => r.de !== idBdCompte);

        plusDemandées.forEach((r) => onVeutOublier(r.pour, r.de));
        delete dicInfoSuiviRelations[idBdCompte];
      }
    };

    const onVeutSuivre = async (
      idBdCompte: string,
      idBdCompteDemandeur: string,
      profondeurActuelle: number
    ): Promise<void> => {
      if (!dicInfoSuiviRelations[idBdCompte]) {
        const fOublier = await this.suivreRelationsImmédiates(
          idBdCompte,
          async (relations: infoConfiance[]) =>
            await fSuivreRelationsImmédiates(
              relations,
              idBdCompte,
              profondeurActuelle
            )
        );
        const demandéePar = new Set<string>();
        dicInfoSuiviRelations[idBdCompte] = { fOublier, demandéePar };
      }
      dicInfoSuiviRelations[idBdCompte].demandéePar.add(idBdCompteDemandeur);
    };

    const fSuivreRelationsImmédiates = async (
      relations: infoConfiance[],
      de: string,
      profondeurActuelle: number
    ) => {
      const nouvelles = relations.filter((r) =>
        onNeSuitPasEncore(r.idBdCompte)
      );
      const obsolètes = listeRelations.filter(
        (r) =>
          r.de === de && !relations.map((r) => r.idBdCompte).includes(r.pour)
      );

      listeRelations = listeRelations.filter((r) => r.de !== de);
      relations.forEach((r) =>
        listeRelations.push({
          de,
          pronfondeur: profondeurActuelle,
          pour: r.idBdCompte,
          confiance: r.confiance,
        })
      );
      fFinale();
      obsolètes.forEach((o) => onVeutOublier(o.pour, de));

      const ajusterProfondeur = async () => {
        if (profondeurActuelle < profondeur) {
          await Promise.all(
            nouvelles.map((n) =>
              onVeutSuivre(n.idBdCompte, de, profondeurActuelle + 1)
            )
          );
        } else if (profondeurActuelle > profondeur) {
          relations.forEach((r) => onVeutOublier(r.idBdCompte, de));
        }
      };

      await ajusterProfondeur();
      événementsChangementProfondeur.on("changé", ajusterProfondeur);
      if (fsOublierÉvénements[de]) fsOublierÉvénements[de]();
      fsOublierÉvénements[de] = () =>
        événementsChangementProfondeur.off("changé", ajusterProfondeur);
    };

    await onVeutSuivre(idCompteDébut, "", 0);

    const fOublier = () => {
      Object.values(dicInfoSuiviRelations).forEach((r) => r.fOublier());
    };

    const fChangerProfondeur = (p: number) => {
      profondeur = p;
      événementsChangementProfondeur.emit("changé");
    };

    return { fOublier, fChangerProfondeur };
  }

  async suivreComptesRéseau(
    idCompteDébut: string,
    f: schémaFonctionSuivi<infoMembreRéseau[]>,
    profondeur = 0
  ): Promise<schémaRetourFonctionRecherche> {
    const fSuivi = (relations: infoRelation[]) => {
      const dicRelations: { [key: string]: infoRelation[] } = {};

      relations.forEach((r) => {
        if (!Object.keys(dicRelations).includes(r.pour)) {
          dicRelations[r.pour] = [];
        }
        dicRelations[r.pour].push(r);
      });

      const comptes: infoMembreRéseau[] = Object.entries(dicRelations).map(
        ([idBdCompte, rs]) => {
          const profondeur = Math.min.apply(rs.map((r) => r.pronfondeur));
          const rsPositives = rs.filter((r) => r.confiance >= 0);
          const rsNégatives = rs.filter((r) => r.confiance < 0);
          const coûtNégatif =
            1 -
            rsNégatives
              .map(
                (r) =>
                  1 +
                  r.confiance *
                    Math.pow(FACTEUR_ATÉNUATION_BLOQUÉS, r.pronfondeur)
              )
              .reduce((total, c) => c * total, 1);

          const confiance =
            1 -
            rsPositives
              .map(
                (r) =>
                  1 -
                  r.confiance *
                    Math.pow(FACTEUR_ATÉNUATION_CONFIANCE, r.pronfondeur)
              )
              .reduce((total, c) => c * total, 1) -
            coûtNégatif;

          return {
            idBdCompte,
            profondeur,
            confiance,
          };
        }
      );

      f(comptes);
    };

    return await this.suivreRelationsConfiance(
      idCompteDébut,
      fSuivi,
      profondeur
    );
  }

  async suivreComptesRéseauEtEnLigne(
    idCompteDébut: string,
    f: schémaFonctionSuivi<infoMembreRéseau[]>,
    profondeur = 0
  ): Promise<schémaRetourFonctionRecherche> {

    const dicComptes: { réseau: infoMembreRéseau[], enLigne: infoMembreRéseau[] } = {
      réseau: [],
      enLigne: []
    }
    const fFinale = () => {
      const membres = [...dicComptes.réseau];
      dicComptes.enLigne.forEach(c=>{
        if (!membres.find(m=>m.idBdCompte === c.idBdCompte)) {
          membres.push(c);
        }
      });
      f(membres);
    }

    const fOublierComptesEnLigne = await this.suivreConnexionsMembres(
      (membres: statutMembre[]) => {
        const infoMembresEnLigne: infoMembreRéseau[] = membres.map(
          m=> {
            return {
              idBdCompte: m.infoMembre.idBdCompte,
              profondeur: -1,
              confiance: 0
            }
          }
        )
        dicComptes.enLigne = infoMembresEnLigne
        fFinale();
      }
    )

    const fSuivreComptesRéseau = (comptes: infoMembreRéseau[]) => {
      dicComptes.réseau = comptes;
      fFinale();
    }

    const { fOublier: fOublierComptesRéseau, fChangerProfondeur } = await this.suivreComptesRéseau(
      idCompteDébut, fSuivreComptesRéseau, profondeur
    )

    const fOublier = () => {
      fOublierComptesEnLigne();
      fOublierComptesRéseau();
    }

    return { fOublier, fChangerProfondeur }
  }

  async suivreConfianceMonRéseauPourMembre(
    idBdCompte: string,
    f: schémaFonctionSuivi<number>,
    profondeur = 4,
    idBdCompteRéférence?: string
  ): Promise<schémaRetourFonctionRecherche> {
    idBdCompteRéférence = idBdCompteRéférence || this.client.idBdCompte!;

    const fFinale = (membres: infoMembreRéseau[]) => {
      const infoRecherchée = membres.find((m) => m.idBdCompte === idBdCompte);
      f(infoRecherchée?.confiance || 0);
    };

    return await this.suivreComptesRéseau(
      idBdCompteRéférence,
      fFinale,
      profondeur
    );
  }

  async suivreConnexionsPostesSFIP(
    f: schémaFonctionSuivi<{ addr: string; peer: string }[]>
  ): Promise<schémaFonctionOublier> {
    const dédédoublerConnexions = (
      connexions: PeersResult[]
    ): PeersResult[] => {
      const adrDéjàVues: string[] = [];
      const dédupliquées: PeersResult[] = [];
      for (const c of connexions) {
        if (!adrDéjàVues.includes(c.addr.toString())) {
          adrDéjàVues.push(c.addr.toString());
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

  async suivreConnexionsDispositifs(
    f: schémaFonctionSuivi<statutDispositif[]>
  ): Promise<schémaFonctionOublier> {

    const fFinale = () => {
      f(Object.values(this.dispositifsEnLigne))
    }

    this.on("membreVu", fFinale);
    fFinale();

    const oublier = () => {
      this.off("membreVu", fFinale);
    };
    return oublier;
  }

  async suivreConnexionsMembres(
    f: schémaFonctionSuivi<statutMembre[]>
  ): Promise<schémaFonctionOublier> {
    const fFinale = (dispositifs: statutDispositif[]) => {
      const membres: {[key: string]: statutMembre} = {}

      for (const d of dispositifs) {
        const { idCompte } = d.infoDispositif
        if (!membres[idCompte]) {
          membres[idCompte] = {
            infoMembre: {
              idBdCompte: idCompte,
              dispositifs:  [],
            }
          }
        }
        const { infoMembre, vuÀ } = membres[idCompte]
        infoMembre.dispositifs.push(d.infoDispositif)
        membres[idCompte].vuÀ = vuÀ ? (d.vuÀ ? Math.max(vuÀ, d.vuÀ) : vuÀ) : d.vuÀ
      }
      f(Object.values(membres))
    }

    return await this.suivreConnexionsDispositifs(fFinale)
  }

  async suivreNomsMembre(
    idMembre: string,
    f: schémaFonctionSuivi<{ [key: string]: string }>
  ): Promise<schémaFonctionOublier> {
    const fFinale = (noms?: { [key: string]: string }) => {
      return f(noms || {});
    };
    return await this.client.suivreBdDeClef(
      idMembre,
      "compte",
      fFinale,
      (id: string, f: schémaFonctionSuivi<{ [key: string]: string }>) =>
        this.client.profil!.suivreNoms(f, id)
    );
  }

  async suivreCourrielMembre(
    idMembre: string,
    f: schémaFonctionSuivi<string | null | undefined>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeClef(
      idMembre,
      "compte",
      f,
      async (id: string, f: schémaFonctionSuivi<string | null>) =>
        await this.client.profil!.suivreCourriel(f, id)
    );
  }

  async suivreImageMembre(
    idMembre: string,
    f: schémaFonctionSuivi<Uint8Array | null>
  ): Promise<schémaFonctionOublier> {
    const fFinale = async (image?: Uint8Array | null) => {
      return f(image || null);
    };
    const fSuivre = async (
      id: string,
      f: schémaFonctionSuivi<Uint8Array | null>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.profil!.suivreImage(f, id);
    };
    return await this.client.suivreBdDeClef(
      idMembre,
      "compte",
      fFinale,
      fSuivre
    );
  }

  async rechercher<T extends résultatObjectifRecherche>(
    f: schémaFonctionSuivi<résultatRecherche<T>[]>,
    nRésultatsDésirés: number,
    fRecherche: (
      compte: string,
      fSuivi: (x: string[]|undefined) => void
    ) => Promise<schémaFonctionOublier>,
    fConfiance: schémaFonctionSuivreConfianceRecherche,
    fQualité: schémaFonctionSuivreQualitéRecherche,
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>,
    fScore?: (r: résultatRechercheSansScore<T>) => number,
  ): Promise<réponseSuivreRecherche> {

    if (!fScore) {
      fScore = (x: résultatRechercheSansScore<T>): number => {
        return (x.confiance + x.qualité + x.objectif.score) / 3
      }
    }

    fObjectif = fObjectif || rechercherTous<T>();

    const résultatsParMembre: {
      [key: string]: {
        résultats: résultatRecherche<T>[];
        membre: infoMembreRéseau;
        fOublierRecherche: schémaFonctionOublier;
        mettreÀJour: (membre: infoMembreRéseau) => void;
      };
    } = {};

    const DÉLAI_REBOURS = 3000;
    let annuler: NodeJS.Timeout;
    let profondeur = 0;

    const ajusterProfondeur = (p: number) => {
      fChangerProfondeur(p);
      if (annuler) clearTimeout(annuler);
    }

    const débuterReboursAjusterPronfondeur = (délai = DÉLAI_REBOURS) => {
      if (annuler) clearTimeout(annuler);

      const parProfondeur = Object.values(résultatsParMembre).reduce(function (r, a) {
        r[String(a.membre.profondeur)] = r[String(a.membre.profondeur)] || [];
        r[String(a.membre.profondeur)].push(a);
        return r;
      }, Object.create(null));
      if (nouvelleProfondeur > profondeur) {
        annuler = setTimeout(() => ajusterProfondeur(nouvelleProfondeur), DÉLAI_REBOURS)
      } else if (nouvelleProfondeur < profondeur) {
        ajusterProfondeur(nouvelleProfondeur)
      }

    }

    const fFinale = () => {
      const résultats: résultatRecherche<T>[] = Object.values(résultatsParMembre).map(
        listeRésultats => listeRésultats.résultats
      ).flat();

      const résultatsOrdonnés = résultats.sort(
        (a, b) => (a.score < b.score ? -1 : 1)
      )
      f(résultatsOrdonnés.slice(0, nRésultatsDésirés));
      débuterReboursAjusterPronfondeur();
    };

    const suivreRésultatsMembre = async (
      membre: infoMembreRéseau,
    ): Promise<void> => {
      const { idBdCompte } = membre

      const fListe = async (
        fSuivreRacine: (éléments: string[]) => Promise<void>
      ): Promise<schémaFonctionOublier> => {
        return await fRecherche(membre.idBdCompte, async résultats => await fSuivreRacine(résultats || []))
      }

      const fSuivi = (résultats: résultatRecherche<T>[]) => {
        résultatsParMembre[idBdCompte].résultats = résultats
      }

      const fBranche = async (
        id: string,
        fSuivreBranche: schémaFonctionSuivi<résultatRecherche<T> | undefined>
      ): Promise<schémaFonctionOublier> => {
        const rés: { id: string, objectif?: T, confiance?: number, qualité?: number} = {
          id
        }
        const fFinaleSuivreBranche = () => {
          const { objectif, confiance, qualité } = rés
          if (objectif && confiance !== undefined && qualité !== undefined) {

            const résultatFinalBranche: résultatRecherche<T> = {
              id, objectif, confiance, qualité, score: fScore!(rés as résultatRechercheSansScore<T>)
            }
            fSuivreBranche(résultatFinalBranche)
          }
        }

        const fSuivreObjectif = (objectif?: T) => {
          rés.objectif = objectif
          fFinaleSuivreBranche();
        };
        const fOublierObjectif = await fObjectif(this.client, id, fSuivreObjectif);

        const fSuivreConfiance = (confiance?: number) => {
          rés.confiance = confiance
          fFinaleSuivreBranche();
        };
        const fOublierConfiance = await fConfiance(id, fSuivreConfiance);


        const fSuivreQualité = (confiance?: number) => {
          rés.confiance = confiance
          fFinaleSuivreBranche();
        };
        const fOublierQualité = await fQualité(this.client, id, fSuivreQualité);

        const fOublierBranche = () => {
          fOublierObjectif();
          fOublierConfiance();
          fOublierQualité();
        }

        return fOublierBranche
      }

      const fOublierRechercheMembre = await this.client.suivreBdsDeFonctionListe(
        fListe,
        fSuivi,
        fBranche
      );

      throw
      résultatsParMembre[idBdCompte] = {
        résultats: [] as résultatRecherche<T>[],
        membre,
        fOublierRecherche: fOublierRechercheMembre,
        mettreÀJour: () => fSuivi(résultatsParMembre[idBdCompte].résultats)
      };
    }

    const oublierRésultatsMembre = (compte: string) => {
      résultatsParMembre[compte]?.fOublierRecherche();
      delete résultatsParMembre[compte];
      fFinale();
    }

    const fSuivreComptes = async (comptes: infoMembreRéseau[]): Promise<void> => {

      comptes = comptes.filter((c) => c.confiance >= 0); // Enlever les membres bloqués

      const nouveaux = comptes.filter(c => !résultatsParMembre[c.idBdCompte]);
      const clefsObsolètes = Object.keys(résultatsParMembre).filter(
        (m) => !comptes.find((c) => c.idBdCompte === m)
      );
      const changés = comptes.filter(
        c => {
          const avant = résultatsParMembre[c.idBdCompte]
          return avant && (c.confiance !== avant.membre.confiance || c.profondeur !== avant.membre.profondeur)
        }
      );

      await Promise.all(nouveaux.map(suivreRésultatsMembre));
      changés.forEach(c=>résultatsParMembre[c.idBdCompte].mettreÀJour(c));

      clefsObsolètes.forEach((o) => oublierRésultatsMembre(o));
    };

    const { fChangerProfondeur, fOublier } = await this.suivreComptesRéseauEtEnLigne(
      this.client.idBdCompte!,
      fSuivreComptes
    );

    const fChangerN = (nouveauN: number) => {
      nRésultatsDésirés = nouveauN;
      débuterReboursAjusterPronfondeur(0);
    };

    return { fChangerN, fOublier };
  }


  async rechercherMembres<T extends résultatObjectifRecherche>(
    f: schémaFonctionSuivi<résultatRecherche<T>[]>,
    nRésultatsDésirés: number,
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>
  ): Promise<réponseSuivreRecherche> {

    const fConfiance = async (
      idCompte: string,
      fSuivre: schémaFonctionSuivi<number>
    ) => {
      const { fOublier } = await this.suivreConfianceMonRéseauPourMembre(idCompte, fSuivre);
      return fOublier
    };

    const fRecherche = async (
      idCompte: string,
      fSuivi: (compte: [string]) => void
    ): Promise<schémaFonctionOublier> => {
      fSuivi([idCompte])  // Rien à faire parce que nous ne recherchons que le compte
      return faisRien
    }

    return await this.rechercher(
      f,
      nRésultatsDésirés,
      fRecherche,
      fConfiance,
      rechercherProfilSelonActivité(),
      fObjectif
    );
  }

  async suivreConfianceAuteurs(
    idItem: string,
    f: schémaFonctionSuivi<number>,
  ): Promise<schémaFonctionOublier> {

    const fListe = async (
      fSuivreRacine: (auteurs: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.suivreAuteurs(idItem, fSuivreRacine);
    }

    const fBranche = async (
      idAuteur: string,
      fSuivreBranche: schémaFonctionSuivi<number>
    ): Promise<schémaFonctionOublier> => {
      const { fOublier } = await this.suivreConfianceMonRéseauPourMembre(idAuteur, fSuivreBranche);
      return fOublier;
    }

    const fFinale = (confiances: number[]) => {
      const confiance = confiances.reduce((a, b) => a + b, 0)/confiances.length;
      f(confiance);
    }

    return await this.client.suivreBdsDeFonctionListe(
      fListe,
      fFinale,
      fBranche
    )
  }

  async rechercherObjets<T extends résultatObjectifRecherche>(
    f: schémaFonctionSuivi<résultatRecherche<T>[]>,
    nRésultatsDésirés: number,
    fRecherche: (
      idCompte: string,
      fSuivi: (bds: string[]|undefined) => void
    ) => Promise<schémaFonctionOublier>,
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>
  ): Promise<réponseSuivreRecherche> {

    const fRechercheFinale = async (
      idCompte: string,
      fSuivi: (bds: string[]|undefined) => void
    ): Promise<schémaFonctionOublier> => {
      const résultats: {propres: string[], favoris: string[]} = {
        propres: [],
        favoris: [],
      }

      const fFinale = () => {
        const tous = [...new Set([...résultats.propres, ...résultats.favoris])]
        fSuivi(tous);
      }

      const fOublierPropres = await fRecherche(idCompte, propres => {
        résultats.propres = propres || [];
        fFinale();
      });

      const fOublierFavoris = await this.suivreFavorisMembre(
        idCompte,
        favoris => {
          résultats.favoris = favoris ? Object.keys(favoris) : [];
          fFinale();
        }
      );

      return () => {
        fOublierPropres();
        fOublierFavoris();
      }

    }

    const fConfiance = async (
      id: string,
      f: schémaFonctionSuivi<number>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreConfianceAuteurs(id, f)
    }

    return await this.rechercher(
      f,
      nRésultatsDésirés,
      fRechercheFinale,
      fConfiance,
      rechercherProfilSelonActivité(),
      fObjectif
    );
  }

  async rechercherBds<T extends résultatObjectifRecherche>(
    f: schémaFonctionSuivi<résultatRecherche<T>[]>,
    nRésultatsDésirés: number,
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>
  ): Promise<réponseSuivreRecherche> {
    const fRecherche = this.suivreBdsMembre.bind(this);

    return await this.rechercherObjets(
      f, nRésultatsDésirés, fRecherche, fObjectif
    );
  }

  async rechercherVariables<T extends résultatObjectifRecherche>(
    f: schémaFonctionSuivi<résultatRecherche<T>[]>,
    nRésultatsDésirés: number,
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>
  ): Promise<réponseSuivreRecherche> {

    const fRecherche = this.suivreVariablesMembre.bind(this);

    return await this.rechercherObjets(
      f, nRésultatsDésirés, fRecherche, fObjectif
    );
  }

  async rechercherMotsClefs<T extends résultatObjectifRecherche>(
    f: schémaFonctionSuivi<résultatRecherche<T>[]>,
    nRésultatsDésirés: number,
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>
  ): Promise<réponseSuivreRecherche> {

    const fRecherche = this.suivreMotsClefsMembre.bind(this);

    return await this.rechercherObjets(
      f, nRésultatsDésirés, fRecherche, fObjectif
    );
  }

  async rechercherProjets<T extends résultatObjectifRecherche>(
    f: schémaFonctionSuivi<résultatRecherche<T>[]>,
    nRésultatsDésirés: number,
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>
  ): Promise<réponseSuivreRecherche> {

    const fRecherche = this.suivreProjetsMembre.bind(this);

    return await this.rechercherObjets(
      f, nRésultatsDésirés, fRecherche, fObjectif
    );
  }

  async enleverMembre(id: string): Promise<void> {
    this.fOublierMembres[id]();
    const { bd: bdMembres, fOublier } = await this.client.ouvrirBd<
      FeedStore<infoMembre>
    >(this.idBd);
    await this.client.effacerÉlémentDeBdListe(
      bdMembres,
      (é) => é.payload.value.id === id
    );
    fOublier();
  }

  async suivreBdsMembre(
    idMembre: string,
    f: schémaFonctionSuivi<string[] | undefined>,
    vérifierAutorisation = true
  ): Promise<schémaFonctionOublier> {
    const fCondition = async (
      id: string,
      fSuivreCondition: (état: boolean) => void
    ): Promise<schémaFonctionOublier> => {
      return await this.client.bds!.suivreAuteurs(
        id,
        (auteurs: infoAuteur[]) => {
          const estUnAuteur = auteurs.some(
            (a) => a.idBdCompte === idMembre && a.accepté
          );
          fSuivreCondition(estUnAuteur);
        }
      );
    };

    const fSuivreAvecAutorisation = async (
      id: string,
      f: schémaFonctionSuivi<string[]>
    ) => {
      return await this.client.suivreBdsSelonCondition(
        async (
          fSuivreRacine: (ids: string[]) => Promise<void>
        ): Promise<schémaFonctionOublier> => {
          return await this.client.bds!.suivreBds(fSuivreRacine, id);
        },
        fCondition,
        f
      );
    };

    const fSuivreSansAutorisation = async (
      id: string,
      f: schémaFonctionSuivi<string[]>
    ) => await this.client.bds!.suivreBds(f, id);

    const fSuivreBd = vérifierAutorisation
      ? fSuivreAvecAutorisation
      : fSuivreSansAutorisation;

    return await this.client.suivreBdDeClef(idMembre, "bds", f, fSuivreBd);
  }

  async suivreProjetsMembre(
    idMembre: string,
    f: schémaFonctionSuivi<string[] | undefined>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDeClef(
      idMembre,
      "projets",
      f,
      async (id, f) =>
        await this.client.projets!.suivreProjets(f, id)
    );
  }

  async suivreFavorisMembre(
    idMembre: string,
    f: schémaFonctionSuivi<{ [key: string]: ÉlémentFavoris } | undefined>
  ): Promise<schémaFonctionOublier> {
    const fSuivreFavoris = async (
      id: string,
      f: schémaFonctionSuivi<{ [key: string]: ÉlémentFavoris }>
    ) => {
      return await this.client.favoris!.suivreFavoris(f, id);
    };
    return await this.client.suivreBdDeClef(
      idMembre,
      "favoris",
      f,
      fSuivreFavoris
    );
  }

  async suivreVariablesMembre(
    idMembre: string,
    f: schémaFonctionSuivi<string[] | undefined>
  ): Promise<schémaFonctionOublier> {
    const fSuivreVariables = async (
      id: string,
      f: schémaFonctionSuivi<string[]>
    ) => {
      return await this.client.variables!.suivreVariables(f, id);
    };
    return await this.client.suivreBdDeClef(
      idMembre,
      "variables",
      f,
      fSuivreVariables
    );
  }

  async suivreMotsClefsMembre(
    idMembre: string,
    f: schémaFonctionSuivi<string[] | undefined>
  ): Promise<schémaFonctionOublier> {
    const fSuivreMotsClefs = async (
      id: string,
      f: schémaFonctionSuivi<string[]>
    ) => {
      return await this.client.motsClefs!.suivreMotsClefs(f, id);
    };
    return await this.client.suivreBdDeClef(
      idMembre,
      "motsClefs",
      f,
      fSuivreMotsClefs
    );
  }

  async suivreRéplications(
    idObjet: string,
    f: schémaFonctionSuivi<infoRéplications[]>,
    profondeur: 5
  ): Promise<schémaRetourFonctionRecherche> {

    const fListe = async (
      fSuivreRacine: (membres: string[]) => Promise<void>
    ): Promise<schémaRetourFonctionRecherche> => {

      const fSuivreComptes = (infosMembres: infoMembreRéseau[]) => {
        fSuivreRacine(infosMembres.map(i=>i.idBdCompte))
      }

      return await this.suivreComptesRéseauEtEnLigne(
        this.client.idBdCompte!, fSuivreComptes, profondeur
      )
    }

    const fBranche = async (
      idBdCompte: string,
      fSuivreBranche: schémaFonctionSuivi<ÉlémentFavoris[]>,
    ): Promise<schémaFonctionOublier> => {
      const résultats: { dispositifs: infoDispositif[], favoris: ÉlémentFavoris[] } = {
        dispositifs: [],
        favoris: [],
      }

      const fOublierDispositifsMembre = await this.client.suivreDispositifs(
        dispositifs => résultats.dispositifs = dispositifs
      )

      const fOublierFavorisMembre = await this.suivreFavorisMembre(
        idBdCompte,
        (favoris: {[key: string]: ÉlémentFavoris} | undefined) => {
          if (favoris) {
            const lFavoris = Object.entries(favoris).filter(
              ([id, _]) => id === idObjet
            ).map(([_, info]) => {
              return {
                récursif: info.récursif,
                dispositifs: info.dispositifs,
                dispositifsFichiers: info.dispositifsFichiers,
              }
            })
            fSuivreBranche(lFavoris)
          }
        }
      )
    }


    const fSuivi = (
      favoris: ÉlémentFavoris[],
    ) => {
      favoris.map(f=>f.)
    }

    const fOublierFavoris = await this.client.suivreBdsDeFonctionListe(
      fListe,
      fSuivi,
      fBranche,
    )

    const fOublier = () => {
      fOublierFavoris();
      fOublierDispositifs();
    }

    return { fOublier, fChangerProfondeur }


    const _fListe = async (
      fSuivreRacine: (éléments: statutMembre[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreMembres(fSuivreRacine);
    };

    const _fBranche = async (
      idBdCompte: string,
      fSuivreBranche: schémaFonctionSuivi<infoRéplications[]>,
      branche: statutMembre
    ) => {
      const fFinaleSuivreBranche = (favoris?: string[]) => {
        if (!favoris) return;
        const réplications: infoRéplications[] = favoris
          .filter((fav) => fav === idBd)
          .map((fav) => {
            return {
              idBd: fav,
              idBdCompte: branche.idBdCompte,
              idOrbite: branche.idOrbite,
              vuÀ: branche.vuÀ,
            };
          });
        return fSuivreBranche(réplications);
      };
      return await this.suivreFavorisMembre(idBdCompte, fFinaleSuivreBranche);
    };


    const fCode = (x: infoMembre) => x.idOrbite;

    const oublierRéplications = await this.client.suivreBdsDeFonctionListe(
      fListe,
      f,
      fBranche,
      fIdBdDeBranche,
      undefined,
      fCode
    );

    return oublierRéplications;
  }








  async suivreBdsDeMotClefUnique(
    motClefUnique: string,
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    const fBranche = async (
      idMembre: string,
      f: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.suivreBdDeClef(
        idMembre,
        "bds",
        (bds?: string[]) => {
          f(bds || []);
        },
        async (idBdBds: string) => {
          return await this.client.bds!.rechercherBdsParMotsClefs(
            [motClefUnique],
            f,
            idBdBds
          );
        }
      );
    };
    const fIdBdDeBranche = (x: unknown) => (x as infoMembre).idBdCompte;
    const fCode = (x: unknown) => (x as infoMembre).idOrbite;

    const fListe = async (
      fSuivreRacine: (éléments: infoMembre[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreMembres((membres: infoMembreEnLigne[]) =>
        fSuivreRacine(membres)
      );
    };

    return await this.client.suivreBdsDeFonctionListe(
      fListe,
      f,
      fBranche,
      fIdBdDeBranche,
      undefined,
      fCode
    );
  }

  async suivreÉlémentsDeTableauxUniques<T extends élémentBdListeDonnées>(
    motClefUnique: string,
    idUniqueTableau: string,
    f: schémaFonctionSuivi<élémentDeMembre<T>[]>
  ): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (bds: bdDeMembre[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      const fListeListe = async (
        fSuivreRacineListe: (bds: string[]) => Promise<void>
      ): Promise<schémaFonctionOublier> => {
        return await this.suivreBdsDeMotClefUnique(
          motClefUnique,
          fSuivreRacineListe
        );
      };

      const fBrancheListe = async (
        idBd: string,
        f: schémaFonctionSuivi<bdDeMembre | undefined>
      ): Promise<schémaFonctionOublier> => {
        return await this.client.bds!.suivreAuteurs(
          idBd,
          (auteurs: infoAuteur[]) => {
            const idBdAuteur = auteurs.find((a) => a.accepté)?.idBdCompte;
            const infoBdDeMembre: bdDeMembre | undefined = idBdAuteur
              ? {
                  bd: idBd,
                  idBdAuteur,
                }
              : undefined;
            f(infoBdDeMembre);
          }
        );
      };
      return await this.client.suivreBdsDeFonctionListe(
        fListeListe,
        fSuivreRacine,
        fBrancheListe
      );
    };

    const fBranche = async (
      idBd: string,
      f: schémaFonctionSuivi<élémentDeMembre<T>[]>,
      branche: bdDeMembre
    ): Promise<schémaFonctionOublier> => {
      const { idBdAuteur } = branche;

      const fSuivreTableaux = async (
        fSuivreNouveauTableau: (nouvelIdBdCible: string) => Promise<void>
      ): Promise<schémaFonctionOublier> => {
        return await this.client.bds!.suivreTableauParIdUnique(
          idBd,
          idUniqueTableau,
          (idTableau?: string) => {
            if (idTableau) fSuivreNouveauTableau(idTableau);
          }
        );
      };

      const fSuivreDonnéesDeTableau = async (
        idTableau: string,
        fSuivreDonnées: schémaFonctionSuivi<élémentDeMembre<T>[]>
      ) => {
        const fSuivreDonnéesTableauFinale = (données: élémentDonnées<T>[]) => {
          const donnéesMembre: élémentDeMembre<T>[] = données.map((d) => {
            return {
              idBdAuteur,
              élément: d,
            };
          });
          fSuivreDonnées(donnéesMembre);
        };
        return await this.client.tableaux!.suivreDonnées(
          idTableau,
          fSuivreDonnéesTableauFinale
        );
      };

      const fFinale = (données?: élémentDeMembre<T>[]) => {
        f(données || []);
      };

      return await this.client.suivreBdDeFonction(
        fSuivreTableaux,
        fFinale,
        fSuivreDonnéesDeTableau
      );
    };

    const fIdDeBranche = (b: bdDeMembre) => b.bd;
    const fCode = (b: bdDeMembre) => b.bd;

    return await this.client.suivreBdsDeFonctionListe(
      fListe,
      f,
      fBranche,
      fIdDeBranche,
      undefined,
      fCode
    );
  }

  async fermer(): Promise<void> {
    this.fsOublier.forEach((f) => f());
  }
}
