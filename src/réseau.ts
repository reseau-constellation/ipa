import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";
import OrbitDB from "orbit-db";

import { PeersResult } from "ipfs-core-types/src/swarm";
import { Message as MessagePubSub } from "ipfs-core-types/src/pubsub";
import { EventEmitter } from "events";
import Semaphore from "@chriscdn/promise-semaphore";

import ContrôleurConstellation from "@/accès/cntrlConstellation";
import ClientConstellation, {
  Signature,
} from "@/client";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaFonctionRecherche,
  infoAuteur,
  élémentsBd,
} from "@/utils"
import { élémentBdListeDonnées } from "@/tableaux"
import { élémentDonnées } from "@/valid";
import {
  rechercherProfilSelonActivité
} from "@/recherche";

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
  dispositifs: []
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



export interface infoMembre {
  idBdCompte: string;
  dispositifs: infoDispositif[];
}

export interface statutMembre {
  infoMembre: infoMembre;
  maConfiance: number;
  confianceMonRéseau: number;
  vuÀ?: number;
}

export interface infoRéplications {
  idBd: string;
  membres: statutMembre[];
  dispositifs: statutDispositif[];
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
  fChangerN: schémaFonctionChangerNRecherche
}

const verrouAjouterMembre = new Semaphore();
const INTERVALE_SALUT = 1000 * 60;
const FACTEUR_ATÉNUATION_CONFIANCE = 0.8;
const FACTEUR_ATÉNUATION_BLOQUÉS = 0.9;

const verrou = new Semaphore()

export default class Réseau extends EventEmitter {
  client: ClientConstellation;
  idBd: string;
  dispositifsEnLigne: {
    [key: string]: statutDispositif;
  };

  fsOublier: schémaFonctionOublier[];
  fOublierMembres: { [key: string]: schémaFonctionOublier };

  constructor(client: ClientConstellation, idBd: string) {
    super();

    this.client = client;
    this.idBd = idBd;
    this.dispositifsEnLigne = {};
    this.fOublierMembres = {};
    this.fsOublier = [()=>Object.values(this.fOublierMembres).forEach(f=>f())];

    // N'oublions pas de nous ajouter nous-mêmes
    this.ajouterMembre({
      idSFIP: this.client.idNodeSFIP!.id,
      idOrbite: this.client.orbite!.identity.id,
      clefPublique: this.client.orbite!.identity.publicKey,
      signatures: this.client.orbite!.identity.signatures,
      idBdCompte: this.client.bdCompte!.id,
    });
    this._nettoyerListeMembres();
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

  async suivreMembresQueJeSuis(f: schémaFonctionSuivi<infoMembre>): Promise<schémaFonctionOublier> {

  }

  async rechercherMembres(
    f: schémaFonctionSuivi<string[]>,
    n: number,
    fRecherche?: schémaFonctionRecherche
  ): Promise<réponseSuivreRecherche> {
    if (!fRecherche) {
      fRecherche = rechercherProfilSelonActivité();
    }

    const fConfiance = async (idCompte: string, fSuivre: schémaFonctionSuivi<number>) => {
     return await this.suivreConfianceMonRéseauPourMembre(idCompte, fSuivre)
   }

    return await this.rechercher(f, n, fConfiance, fRecherche);
  }


  async rechercher(
    f: schémaFonctionSuivi<string[]>,
    nRésultatsDésirés: number,
    fConfiance: schémaFonctionConfiance,
    fRecherche: schémaFonctionRecherche
  ): Promise<réponseSuivreRecherche> {
    interface interfaceScores {
      scoreConfiance: number,
      scoreRecherche: number,
      scoreQualité?: number,
    }
    const dicRésultats: { [key: string]: interfaceScores } = {}

    const fScore = (x: interfaceScores): number => {
      return x.scoreConfiance * x.scoreRecherche
    }

    const envoyerRésultats = () => {
      const résultats = Object.entries(dicRésultats).sort((a,b)=>fScore(a[1]) < fScore(b[1]) ? -1 : 1).slice(0, n).map(x=>x[0])
      f(résultats)
    }

    const fChangerN = (nouveauN: number) => {
      n = nouveauN;
      envoyerRésultats();
    }

    const fSuivreComptes = async () => {
      return await this.client.suivreBdsDeFonctionListe(
        fListe,
        fSuivreObjetsDeCompte,
        fBranche
      )
    }

    const { fChangerProfondeur, fOublier } = await this.suivreComptesRéseau(
      this.client.idBdCompte!,
      fSuivreComptes
    )

    return { fChangerN, fOublier }
  }

  async suivreRelationsImmédiates(
    idCompteDébut: string,
    f: schémaFonctionSuivi<infoConfiance[]>
  ): Promise<schémaFonctionOublier> {
    idCompteDébut = idCompteDébut ? idCompteDébut : this.client.idBdCompte!;

    const fsOublier: schémaFonctionOublier[] = [];

    const comptes: {
      suivis: infoConfiance[],
      favoris: infoConfiance[],
      coauteursBds: infoConfiance[],
      coauteursProjets: infoConfiance[],
      coauteursVariables: infoConfiance[],
      coauteursMotsClefs: infoConfiance[],
    } = {
      suivis: [],
      favoris: [],
      coauteursBds: [],
      coauteursProjets: [],
      coauteursVariables: [],
      coauteursMotsClefs: [],
    }

    const fFinale = () => {
      
    }

    fsOublier.push(
      await this.client.suivreBdListe<>(this.idBd,
        (membres: string[]) => {
          comptes.suivis = membres.map(m=>{return {idBdCompte: m, confiance: 1}});
          fFinale();
        }
      )
    )

    const inscrireSuiviAuteurs = async (fListe: (fSuivreRacine: (é: string[])=>Promise<void>) => Promise<schémaFonctionOublier>, confiance: number) => {
      fsOublier.push(
        await this.client.suivreBdsDeFonctionListe(
          fListe,
          (membres: string[]) => {
            comptes.favoris = membres.map(idBdCompte=>{return {idBdCompte, confiance }});
            fFinale();
          },
          async (id: string, fSuivi: schémaFonctionSuivi<infoAuteur[]>)=>{
            return await this.client.suivreAuteurs(id, fSuivi);
          }
        )
      )
    }

    const fSuivreFavoris = async (fSuivreRacine: (é: string[])=>Promise<void>) => {
      return await this.client.favoris!.suivreFavoris((favoris) => fSuivreRacine(Object.keys(favoris)));
    };
    await inscrireSuiviAuteurs(fSuivreFavoris, CONFIANCE_DE_FAVORIS);

    const fSuivreBds = async (fSuivreRacine: (é: string[])=>Promise<void>) => {
      return await this.client.bds!.suivreBds((bds) => fSuivreRacine(bds));
    }
    await inscrireSuiviAuteurs(fSuivreBds, CONFIANCE_DE_COAUTEUR);

    const fSuivreProjets = async (fSuivreRacine: (é: string[])=>Promise<void>) => {
      return await this.client.projets!.suivreProjets((projets) => fSuivreRacine(projets));
    }
    await inscrireSuiviAuteurs(fSuivreProjets, CONFIANCE_DE_COAUTEUR);

    const fSuivreVariables = async (fSuivreRacine: (é: string[])=>Promise<void>) => {
      return await this.client.variables!.suivreVariables((variables) => fSuivreRacine(variables));
    }
    await inscrireSuiviAuteurs(fSuivreVariables, CONFIANCE_DE_COAUTEUR);

    const fSuivreMotsClefs = async (fSuivreRacine: (é: string[])=>Promise<void>) => {
      return await this.client.projets!.suivreProjets((projets) => fSuivreRacine(projets));
    }
    await inscrireSuiviAuteurs(fSuivreMotsClefs, CONFIANCE_DE_COAUTEUR);

    return () => {
      fsOublier.forEach(f=>f())
    }
  }

  async suivreRelationsConfiance(
    idCompteDébut: string,
    f: schémaFonctionSuivi<infoRelation[]>,
    profondeur = 0
  ): Promise<{ fOublier: schémaFonctionOublier, fChangerProfondeur: (p: number) => void }> {

  }

  async suivreComptesRéseau(
    idCompteDébut: string,
    f: schémaFonctionSuivi<infoMembreRéseau[]>,
    profondeur = 0
  ): Promise<{ fOublier: schémaFonctionOublier, fChangerProfondeur: (p: number) => void }> {

    const fSuivi = (relations: infoRelation[]) => {
      const dicRelations: {[key: string]: infoRelation[]} = {};

      relations.forEach(
        r => {
          if (!Object.keys(dicRelations).includes(r.pour)) {
            dicRelations[r.pour] = []
          }
          dicRelations[r.pour].push(r)
        }
      );

      const comptes: infoMembreRéseau[] = Object.entries(dicRelations).map(
        ([idBdCompte, rs]) => {
          const profondeur = Math.min.apply(rs.map(r=>r.pronfondeur));
          const rsPositives = rs.filter(r=>r.confiance >= 0);
          const rsNégatives = rs.filter(r=>r.confiance < 0);
          const coûtNégatif = 1 - rsNégatives.map(
            r => 1 + r.confiance * Math.pow(FACTEUR_ATÉNUATION_BLOQUÉS, r.pronfondeur)
          ).reduce((total, c) => c * total, 0);

          const confiance = 1 - rsPositives.map(
            r => 1 - r.confiance * Math.pow(FACTEUR_ATÉNUATION_CONFIANCE, r.pronfondeur)
          ).reduce((total, c) => c * total, 1) - coûtNégatif;

          return {
            idBdCompte, profondeur, confiance
          }
        }
      );

      f(comptes);
    }

    return await this.suivreRelationsConfiance(
      idCompteDébut,
      fSuivi,
      profondeur
    )



    const comptesRéseau = {}


    if (profondeur > 1) {
      fsOublier.push(
        await this.suivreComptesRéseau(idCompte, f, profondeur-1)
      )
    }

    const fFinale = () => {
      const comptesFinaux = []
    }

    const ajouterMembre = (membre: infoMembre) => {
      verrou.acquire(membre.idBdCompte);
      if (!comptes[membre.idBdCompte]) {
        comptes[membre.idBdCompte] = {
          idBdCompte: membre.idBdCompte,
          profondeur: 1,
          confiance: 1
        }
      }
      verrou.release(membre.idBdCompte);
    }

    const fOublier = () => {
      fsOublier.forEach(f=>f());
    }

    return { fOublier, fChangerProfondeur }
  }










  async suivreMaConfiancePourMembre(
    idBdCompte: string,
    f: schémaFonctionSuivi<-1|0|1>
  ): Promise<schémaFonctionOublier> {
    const fFinale = (vals: {[key: string]: -1 | 1}): void => {
      const confiance = vals[idBdCompte] === undefined ? 0 : vals[idBdCompte]
      f(confiance)
    }
    return await this.client.suivreBdDic(this.idBd, fFinale);
  }

  async faireConfianceAuMembre(idBdCompte: string): Promise<void> {
    await this.spécifierConfianceMembre(idBdCompte, 1);
  }

  async bloquerMembre(idBdCompte: string): Promise<void> {
    await this.spécifierConfianceMembre(idBdCompte, -1);
  }

  async spécifierConfianceMembre(
    idBdCompte: string,
    confiance: -1|0|1
  ): Promise<void> {
    const { bd: bdConfiance, fOublier } = await this.client.ouvrirBd<KeyValueStore<-1|1>>(this.idBd);
    if (confiance !== 0) {
      await bdConfiance.set(idBdCompte, confiance);
    } else {
      await bdConfiance.del(idBdCompte);
    }

    fOublier();
  }

  async suivreConfianceMonRéseauPourMembre(
    idBdCompte: string,
    f: schémaFonctionSuivi<number>,
    opts: { profondeur: number, facteur: number } = { profondeur: 4, facteur: 0.5}
  ): Promise<schémaFonctionOublier> {
    const { profondeur, facteur } = opts

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















  async _nettoyerListeMembres(): Promise<void> {
    const {bd, fOublier}= await this.client.ouvrirBd<FeedStore>(this.idBd);
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

    fOublier();
  }

  async _validerInfoMembre(info: infoMembre): Promise<boolean> {
    const { idBdCompte, signatures, clefPublique, idOrbite } = info;
    if (!(idBdCompte && signatures && clefPublique && idOrbite)) return false;

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

    if (!OrbitDB.isValidAddress(idBdCompte)) return false;
    const {bd: bdCompte, fOublier } = await this.client.ouvrirBd(idBdCompte);
    if (!(bdCompte.access instanceof ContrôleurConstellation)) return false;
    const bdCompteValide = bdCompte.access.estAutorisé(idOrbite);

    fOublier();
    return sigIdValide && sigClefPubliqueValide && bdCompteValide;
  }

  async ajouterMembre(info: infoMembre): Promise<void> {
    if (!(await this._validerInfoMembre(info))) return;

    const _ajouterMembre = async (info: infoMembre, récursif = false) => {
      const { idOrbite, idBdCompte } = info;
      await verrouAjouterMembre.acquire(idOrbite);
      const existante = await this.client.rechercherBdListe(
        this.idBd,
        (e: LogEntry<infoMembre>) => e.payload.value.idOrbite === idOrbite
      );
      if (!existante) {
        const bdCompte = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
        await bdCompte.add(info);
      }
      if (!this.fOublierMembres[idBdCompte] && !récursif) {
        const f = async (membres: infoMembre[]) => {
          membres.forEach((m: infoMembre) => _ajouterMembre(m));
        };
        const fOublier = await this.client.suivreBdListeDeClef<infoMembre>(
          idBdCompte,
          "reseau",
          f
        );
        this.fOublierMembres[idBdCompte] = fOublier;
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
    const {bd: bdMembres, fOublier } = await this.client.ouvrirBd<FeedStore<infoMembre>>(this.idBd);
    await this.client.effacerÉlémentDeBdListe(bdMembres, é=>é.payload.value.id === id)
    fOublier();
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
      idBdCompte: string,
      fSuivreBranche: schémaFonctionSuivi<infoRéplication[]>,
      branche: infoMembreEnLigne
    ) => {
      const fFinaleSuivreBranche = (favoris?: string[]) => {
        if (!favoris) return;
        const réplications: infoRéplication[] = favoris
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

    const fIdBdDeBranche = (x: infoMembre) => x.idBdCompte;
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
    this.fsOublier.forEach(f=>f());
  }
}
