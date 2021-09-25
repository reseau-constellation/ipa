import { FeedStore, élémentFeedStore, isValidAddress } from "orbit-db";
import { PeersResult } from "ipfs-core-types/src/swarm";
import { Message as MessagePubSub } from "ipfs-core-types/src/pubsub";
import { EventEmitter } from "events";
import Semaphore from "@chriscdn/promise-semaphore";
import ContrôleurConstellation from "./accès/cntrlConstellation";

import ClientConstellation, {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  élémentBdListe,
  Signature,
} from "./client";
import { infoAuteur } from "./bds";

import { élémentDonnées, élémentBdListeDonnées } from "./valid";

export type infoMembre = {
  idSFIP: string;
  idOrbite: string;
  idBdRacine: string;
  clefPublique: string;
  signatures: { id: string; publicKey: string };
};

export interface schémaBd {
  licence: string;
  motsClefs?: string[];
  tableaux: {
    cols: {
      idVariable: string;
      idColonne: string;
      indexe?: boolean;
    }[];
    idUnique?: string;
  }[];
}

export type infoMembreEnLigne = infoMembre & {
  vuÀ?: number;
};

export type infoRéplication = {
  idBd: string;
  idBdRacine: string;
  idOrbite: string;
  vuÀ?: number;
};

export type infoDispositifEnLigne = {
  info: infoMembre;
  vuÀ: number;
};

export type élémentDeMembre<T extends élémentBdListeDonnées> = {
  idBdAuteur: string;
  élément: élémentDonnées<T>;
};

export type bdDeMembre = {
  idBdAuteur: string;
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
  idBdRacine: string;
  clefPublique: string;
  signatures: { id: string; publicKey: string };
}

const verrouAjouterMembre = new Semaphore();
const INTERVALE_SALUT = 1000 * 60;

export default class Réseau extends EventEmitter {
  client: ClientConstellation;
  idBd: string;
  dispositifsEnLigne: {
    [key: string]: infoDispositifEnLigne;
  };
  fOublierMembres: { [key: string]: schémaFonctionOublier };
  oublierSalut?: schémaFonctionOublier;

  constructor(client: ClientConstellation, id: string) {
    super();

    this.client = client;
    this.idBd = id;
    this.dispositifsEnLigne = {};
    this.fOublierMembres = {};

    // N'oublions pas de nous ajouter nous-mêmes
    this.ajouterMembre({
      idSFIP: this.client.idNodeSFIP!.id,
      idOrbite: this.client.orbite!.identity.id,
      clefPublique: this.client.orbite!.identity.publicKey,
      signatures: this.client.orbite!.identity.signatures,
      idBdRacine: this.client.bdRacine!.id,
    });
    this._nettoyerListeMembres();
  }

  async initialiser(): Promise<void> {
    const idSFIP = this.client.idNodeSFIP!.id;
    await this.client.sfip!.pubsub.subscribe(
      `${this.client.SUJET_RÉSEAU}-${idSFIP}`,
      (msg: MessagePubSub) => this.messageReçu(msg, true)
    );

    await this.client.sfip!.pubsub.subscribe(
      this.client.SUJET_RÉSEAU,
      (msg: MessagePubSub) => this.messageReçu(msg, false)
    );

    for (const é of ["peer:connect", "peer:disconnect"]) {
      //@ts-ignore
      this.client.sfip!.libp2p.connectionManager.on(é, () => {
        this.emit("changementConnexions");
      });
    }

    const x = setInterval(() => {
      this.direSalut();
    }, INTERVALE_SALUT);
    this.oublierSalut = () => clearInterval(x);

    this.direSalut();
  }

  async envoyerMessage(msg: Message, idSFIP?: string): Promise<void> {
    const sujet = idSFIP
      ? `${this.client.SUJET_RÉSEAU}-${idSFIP}`
      : this.client.SUJET_RÉSEAU;
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
        idBdRacine: this.client.bdRacine!.id,
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
    if (signature.clefPublique === this.client.orbite!.identity.publicKey)
      return;

    // Assurer que la signature est valide (message envoyé par détenteur de idOrbite)
    const signatureValide = await this.client.vérifierSignature(
      signature,
      JSON.stringify(valeur)
    );
    if (!signatureValide) return;

    switch (valeur.type) {
      case "Salut !": {
        const contenu = valeur.contenu as ContenuMessageSalut;
        const { clefPublique } = contenu;

        // S'assurer que idOrbite est la même que celle sur la signature
        if (clefPublique !== signature.clefPublique) return;
        this.ajouterMembre(contenu);
        if (!personnel) this.direSalut(contenu.idSFIP);
      }
    }
  }

  async suivreConnexionsPostes(
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

  async _nettoyerListeMembres(): Promise<void> {
    const bd = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
    const éléments = ClientConstellation.obtÉlémentsDeBdListe<infoMembre>(
      bd,
      false
    );
    const déjàVus: string[] = [];
    for (const é of éléments) {
      const entrée = é.payload.value;

      // Enlever les entrées non valides (d'une ancienne version de Constellation)
      const valide = await this._validerInfoMembre(entrée);
      if (!valide) await bd.remove(é.hash);

      // Enlever les doublons (ne devraient plus se présenter avec la nouvelle version)
      const id = entrée.idOrbite;
      if (id && déjàVus.includes(id)) {
        await bd.remove(é.hash);
      } else {
        déjàVus.push(id);
      }
    }
  }

  async _validerInfoMembre(info: infoMembre): Promise<boolean> {
    const { idBdRacine, signatures, clefPublique, idOrbite } = info;
    if (!(idBdRacine && signatures && clefPublique && idOrbite)) return false;

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

    if (!isValidAddress(idBdRacine)) return false;
    const bdRacine = await this.client.ouvrirBd(idBdRacine);
    if (!(bdRacine.access instanceof ContrôleurConstellation)) return false;
    const bdRacineValide = bdRacine.access.estAutorisé(idOrbite);

    return sigIdValide && sigClefPubliqueValide && bdRacineValide;
  }

  async ajouterMembre(info: infoMembre): Promise<void> {
    if (!(await this._validerInfoMembre(info))) return;

    const _ajouterMembre = async (info: infoMembre, récursif = false) => {
      const { idOrbite, idBdRacine } = info;
      await verrouAjouterMembre.acquire(idOrbite);
      const existante = await this.client.rechercherBdListe(
        this.idBd,
        (e: élémentFeedStore<infoMembre>) =>
          e.payload.value.idOrbite === idOrbite
      );
      if (!existante) {
        const bdRacine = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
        await bdRacine.add(info);
      }
      if (!this.fOublierMembres[idBdRacine] && !récursif) {
        const f = async (membres: infoMembre[]) => {
          membres.forEach((m: infoMembre) => _ajouterMembre(m));
        };
        const fOublier = await this.client.suivreBdListeDeClef<infoMembre>(
          idBdRacine,
          "reseau",
          f
        );
        this.fOublierMembres[idBdRacine] = fOublier;
      }
      verrouAjouterMembre.release(idOrbite);
    };

    await _ajouterMembre(info, true);
    this._vu(info);
  }

  _vu(info: infoMembre): void {
    this.dispositifsEnLigne[info.idOrbite] = {
      info,
      vuÀ: new Date().getTime(),
    };
    this.emit("membreVu");
  }

  async enleverMembre(id: string): Promise<void> {
    this.fOublierMembres[id]();
    const bdMembres = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
    const entrée = bdMembres
      .iterator({ limit: -1 })
      .collect()
      .find((e: élémentBdListe) => e.payload.value === id);
    await bdMembres.remove(entrée.hash);
  }

  async suivreMembres(
    f: schémaFonctionSuivi<infoMembreEnLigne[]>
  ): Promise<schémaFonctionOublier> {
    const info: { membres: infoMembre[] } = {
      membres: [],
    };
    const fFinale = () => {
      const listeMembres = info.membres.map((m) => {
        const vuÀ = this.dispositifsEnLigne[m.idOrbite]
          ? this.dispositifsEnLigne[m.idOrbite].vuÀ
          : undefined;
        return Object.assign({ vuÀ }, m);
      });
      f(listeMembres);
    };

    const fSuivreMembres = (membres: infoMembre[]) => {
      info.membres = membres;
      fFinale();
    };
    const oublierMembres = await this.client.suivreBdListe(
      this.idBd,
      fSuivreMembres
    );

    this.on("membreVu", fFinale);
    const oublierVus = () => {
      this.off("membreVu", fFinale);
    };

    const oublier = () => {
      oublierMembres();
      oublierVus();
    };
    return oublier;
  }

  async suivreDispositifsEnLigne(
    f: schémaFonctionSuivi<infoDispositifEnLigne[]>
  ): Promise<schémaFonctionOublier> {
    const fFinale = () => {
      f(Object.values(this.dispositifsEnLigne));
    };
    this.on("membreVu", fFinale);
    fFinale();
    const fOublier = () => {
      this.off("membreVu", fFinale);
    };
    return fOublier;
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
        this.client.compte!.suivreNoms(f, id)
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
        await this.client.compte!.suivreCourriel(f, id)
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
      return await this.client.compte!.suivreImage(f, id);
    };
    return await this.client.suivreBdDeClef(
      idMembre,
      "compte",
      fFinale,
      fSuivre
    );
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
            (a) => a.idBdRacine === idMembre && a.accepté
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
      async (id: string, f: schémaFonctionSuivi<string[]>) =>
        await this.client.projets!.suivreProjetsMembre(f, id)
    );
  }

  async suivreFavorisMembre(
    idMembre: string,
    f: schémaFonctionSuivi<string[] | undefined>
  ): Promise<schémaFonctionOublier> {
    const fSuivreFavoris = async (
      id: string,
      f: schémaFonctionSuivi<string[]>
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

  async suivreBds(
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    const fBranche = async (
      id: string,
      f: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      const bds: { propres: string[]; favoris: string[] } = {
        propres: [],
        favoris: [],
      };

      const fFinale = async function () {
        const toutes = [...new Set([...bds.propres, ...bds.favoris])];
        f(toutes);
      };

      const oublierBdsPropres = await this.suivreBdsMembre(id, (propres) => {
        bds.propres = propres || [];
        fFinale();
      });

      const oublierBdsFavoris = await this.suivreFavorisMembre(
        id,
        (favoris) => {
          bds.favoris = favoris || [];
          fFinale();
        }
      );
      return () => {
        oublierBdsPropres();
        oublierBdsFavoris();
      };
    };
    const fIdBdDeBranche = (x: unknown) => (x as infoMembre).idBdRacine;
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

  async suivreRéplications(
    idBd: string,
    f: schémaFonctionSuivi<infoRéplication[]>
  ): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (éléments: infoMembreEnLigne[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreMembres(fSuivreRacine);
    };

    const fBranche = async (
      idBdRacine: string,
      fSuivreBranche: schémaFonctionSuivi<infoRéplication[]>,
      branche?: infoMembreEnLigne
    ) => {
      const fFinaleSuivreBranche = (favoris?: string[]) => {
        if (!favoris) return;
        const réplications: infoRéplication[] = favoris
          .filter((fav) => fav === idBd)
          .map((fav) => {
            return {
              idBd: fav,
              idBdRacine: branche!.idBdRacine,
              idOrbite: branche!.idOrbite,
              vuÀ: branche!.vuÀ,
            };
          });
        return fSuivreBranche(réplications);
      };
      return await this.suivreFavorisMembre(idBdRacine, fFinaleSuivreBranche);
    };

    const fIdBdDeBranche = (x: infoMembre) => x.idBdRacine;
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
    const fIdBdDeBranche = (x: unknown) => (x as infoMembre).idBdRacine;
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
            const idBdAuteur = auteurs.find((a) => a.accepté)?.idBdRacine;
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
      branche?: bdDeMembre
    ): Promise<schémaFonctionOublier> => {
      const { idBdAuteur } = branche!;

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
    if (this.oublierSalut) this.oublierSalut();
    Object.values(this.fOublierMembres).forEach((f) => f());
  }
}
