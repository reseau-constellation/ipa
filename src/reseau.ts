import { isValidAddress } from "@orbitdb/core";

import { Semaphore } from "@chriscdn/promise-semaphore";
import { multiaddr } from "@multiformats/multiaddr";
import { TypedEmitter } from "tiny-typed-emitter";
import { pipe } from "it-pipe";
import { pushable } from "it-pushable";
import {
  suivreFonctionImbriquée,
  suivreDeFonctionListe,
  uneFois,
} from "@constl/utils-ipa";
import { peerIdFromString } from "@libp2p/peer-id";
import { anySignal } from "any-signal";
import pRetry, { AbortError } from "p-retry";
import {
  CLEF_N_CHANGEMENT_COMPTES,
  schémaStructureBdCompte,
} from "@/client.js";
import { estUnContrôleurConstellation } from "./accès/utils.js";
import { PROTOCOLE_CONSTELLATION } from "./const.js";
import { appelerLorsque } from "./utils.js";
import type { Constellation, Signature } from "@/client.js";
import type { GossipsubMessage } from "@chainsafe/libp2p-gossipsub";
import type { Pushable } from "it-pushable";

import type {
  Connection,
  Libp2pEvents,
  PeerId,
  PeerUpdate,
  Stream,
} from "@libp2p/interface";
import type {
  infoRésultat,
  résultatObjectifRecherche,
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaRetourFonctionRechercheParProfondeur,
} from "@/types.js";
import { cacheRechercheParProfondeur, cacheSuivi } from "@/décorateursCache.js";

export type infoDispositif = {
  idLibp2p: string;
  idDispositif: string;
  idCompte: string;
  clefPublique: string;
  signatures: { id: string; publicKey: string };
  nChangementsCompte: number;
};

export type statutDispositif = {
  infoDispositif: infoDispositif;
  vuÀ?: number;
};

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

export interface infoMembre {
  idCompte: string;
  protocoles: string[];
  dispositifs: infoDispositif[];
}

export interface statutMembre {
  infoMembre: infoMembre;
  vuÀ?: number;
}

export interface résultatRechercheSansScore<T extends infoRésultat> {
  id: string;
  objectif: résultatObjectifRecherche<T>;
  confiance: number;
  qualité: number;
}

export type MessageDirecte =
  | MessageDirecteRequêteRejoindreCompte
  | MessageDirecteSalut
  | MessageDirecteTexte;

export type ContenuMessageSalut = {
  contenu: {
    idLibp2p: string;
    idDispositif: string;
    idCompte: string;
    clefPublique: string;
    signatures: { id: string; publicKey: string };
    nChangementsCompte: number;
  };
  signature: Signature;
};

export type MessageDirecteRequêteRejoindreCompte = {
  type: "Je veux rejoindre ce compte";
  contenu: ContenuMessageRejoindreCompte;
};

export type MessageDirecteSalut = {
  type: "Salut !";
  contenu: ContenuMessageSalut;
};

export type ContenuMessageRejoindreCompte = {
  idDispositif: string;
  empreinteVérification: string;
};

export type MessageDirecteTexte = {
  type: "texte";
  contenu: { message: string };
};


const DÉLAI_SESOUVENIR_MEMBRES_EN_LIGNE = 1000 * 60 * 60 * 24 * 30; // 1 mois
const N_DÉSIRÉ_SOUVENIR_MEMBRES_EN_LIGNE = 50;

type ÉvénementsRéseau = {
  changementConnexions: () => void;
  messageDirecte: (args: { de: string; message: MessageDirecte }) => void;
  changementMembresBloqués: () => void;
  membreVu: () => void;
};

const attendreSuccès = async <T>({
  f,
  n = 5,
  t = 100,
  signal,
}: {
  f: () => Promise<T>;
  n?: number;
  t?: number;
  signal?: AbortSignal;
}): Promise<T> => {
  const résultat = await f();
  if (résultat || n <= 0 || signal?.aborted) return résultat;
  await new Promise((résoudre) => setTimeout(résoudre, t));
  return await attendreSuccès({ f, n: n - 1, t: t * 2, signal });
};

export class Réseau {
  client: Constellation;
  verrouFlux: Semaphore;

  dispositifsEnLigne: {
    [key: string]: statutDispositif;
  };

  connexionsDirectes: {
    [key: string]: Pushable<Uint8Array>;
  };

  fsOublier: schémaFonctionOublier[];

  événements: TypedEmitter<ÉvénementsRéseau>;

  constructor({ client }: { client: Constellation }) {
    super({
      client,
      clef: "réseau",
      schémaBdPrincipale: schémaBdPrincipaleRéseau,
    });

    this.client = client;

    this.dispositifsEnLigne = {};
    this.connexionsDirectes = {};

    this.événements = new TypedEmitter<ÉvénementsRéseau>();
    this.verrouFlux = new Semaphore();

    this.fsOublier = [];
  }

  async démarrer(): Promise<void> {
    const texteDispositifsVus = await this.client.obtDeStockageLocal({
      clef: "dispositifsEnLigne",
    });
    this.dispositifsEnLigne = texteDispositifsVus
      ? JSON.parse(texteDispositifsVus)
      : {};

    // Si jamais le moment de la dernière connexion n'avait pas été noté, utiliser maintenant
    Object.values(this.dispositifsEnLigne).forEach((d) => {
      if (d.vuÀ === undefined) d.vuÀ = Date.now();
    });

    const { sfip } = await this.client.attendreSfipEtOrbite();

    const libp2p = sfip.libp2p;

    const gérerProtocoleConstellation = async ({
      connection,
      stream,
    }: {
      connection: Connection;
      stream: Stream;
    }) => {
      const idPairSource = String(connection.remotePeer);

      const flux = pushable();
      pipe(stream, async (source) => {
        for await (const value of source) {
          const octets = value.subarray();
          const messageDécodé = JSON.parse(new TextDecoder().decode(octets));
          this.événements.emit("messageDirecte", {
            de: idPairSource,
            message: messageDécodé,
          });
        }
      });
      pipe(flux, stream);
      this.verrouFlux.release(idPairSource);
    };

    await libp2p.handle(PROTOCOLE_CONSTELLATION, gérerProtocoleConstellation, {
      runOnLimitedConnection: true,
    });

    this.fsOublier.push(
      await this.suivreMessagesDirectes({
        type: "Je veux rejoindre ce compte",
        f: ({ contenu }) =>
          this.client.considérerRequêteRejoindreCompte({
            requête: contenu as ContenuMessageRejoindreCompte,
          }),
      }),
    );

    this.fsOublier.push(
      await this.suivreMessagesDirectes({
        type: "Salut !",
        f: ({ contenu }) =>
          this.recevoirSalut({
            message: contenu as ContenuMessageSalut,
          }),
      }),
    );

    const fSuivreConnexions = async () => {
      this.événements.emit("changementConnexions");
    };
    const fSuivrePairConnecté = async (é: { detail: PeerId }) => {
      try {
        await this.direSalut({ idPair: é.detail.toString() });
      } catch {
        // Tant pis
      }
      const idDispositif = Object.values(this.dispositifsEnLigne).find(
        (info) => info.infoDispositif.idLibp2p === é.detail.toString(),
      )?.infoDispositif.idDispositif;
      if (idDispositif) this.dispositifsEnLigne[idDispositif].vuÀ = undefined;
    };
    const fSuivrePairDéconnecté = async (é: { detail: PeerId }) => {
      delete this.connexionsDirectes[é.detail.toString()];

      const idDispositif = Object.values(this.dispositifsEnLigne).find(
        (info) => info.infoDispositif.idLibp2p === é.detail.toString(),
      )?.infoDispositif.idDispositif;
      if (idDispositif) this.dispositifsEnLigne[idDispositif].vuÀ = Date.now();
      this.événements.emit("membreVu");
    };

    libp2p.addEventListener("peer:connect", fSuivrePairConnecté);
    libp2p.addEventListener("peer:disconnect", fSuivrePairDéconnecté);
    this.fsOublier.push(async () =>
      libp2p.removeEventListener("peer:connect", fSuivrePairConnecté),
    );
    this.fsOublier.push(async () =>
      libp2p.removeEventListener("peer:disconnect", fSuivrePairConnecté),
    );

    this.fsOublier.push(
      await this.client.suivreIdCompte({
        f: async () => {
          return libp2p
            .getPeers()
            .forEach((p) => this.direSalut({ idPair: p.toString() }));
        },
      }),
    );

    const événements: (keyof Libp2pEvents)[] = [
      "peer:connect",
      "peer:disconnect",
      "peer:update",
    ];
    for (const é of événements) {
      libp2p.addEventListener(é, fSuivreConnexions);
    }
    this.fsOublier.push(async () => {
      await Promise.allSettled(
        événements.map((é) => {
          return libp2p.removeEventListener(é, fSuivreConnexions);
        }),
      );
    });
  }

  async obtFluxDispositif({
    idDispositif,
    signal,
  }: {
    idDispositif: string;
    signal?: AbortSignal;
  }): Promise<Pushable<Uint8Array>> {
    const idLibp2pDestinataire = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreConnexionsDispositifs({
          f: async (dispositifs) => {
            const correspondant = dispositifs?.find(
              (d) => d.infoDispositif.idDispositif === idDispositif,
            );
            if (correspondant)
              return await fSuivi(correspondant.infoDispositif.idLibp2p);
          },
        });
      },
    );
    return await this.obtFluxPair({
      idPair: idLibp2pDestinataire,
      signal,
    });
  }

  async obtFluxPair({
    idPair,
    signal,
  }: {
    idPair: string;
    signal?: AbortSignal;
  }): Promise<Pushable<Uint8Array>> {
    await this.verrouFlux.acquire(idPair);
    if (this.connexionsDirectes[idPair]) {
      this.verrouFlux.release(idPair);
      return this.connexionsDirectes[idPair];
    }
    try {
      const { sfip } = await this.client.attendreSfipEtOrbite();

      const signalCombiné = anySignal([
        this.client.signaleurArrêt.signal,
        ...(signal ? [signal] : []),
      ]);

      const idPairDestinataire = peerIdFromString(idPair);

      const flux = await pRetry(async () => {
        // Double AbortError nécessaire parce que pRetry enlève l'erreur externe
        if (signalCombiné.aborted)
          throw new AbortError(new AbortError(Error("Opération annulée")));
        return await sfip.libp2p.dialProtocol(
          idPairDestinataire,
          PROTOCOLE_CONSTELLATION,
          { signal: signalCombiné, runOnLimitedConnection: true },
        );
      });
      signalCombiné.clear();
      pipe(flux, async (source) => {
        for await (const value of source) {
          const octets = value.subarray();
          const messageDécodé = JSON.parse(new TextDecoder().decode(octets));
          this.événements.emit("messageDirecte", {
            de: idPair,
            message: messageDécodé,
          });
        }
      });

      const fluxÀÉcrire = pushable();
      this.connexionsDirectes[idPair] = fluxÀÉcrire;
      pipe(fluxÀÉcrire, flux); // Pas d'await
      this.verrouFlux.release(idPair);
      return fluxÀÉcrire;
    } finally {
      this.verrouFlux.release(idPair);
    }
  }

  async envoyerMessageGossipsub({
    message,
    sujet,
  }: {
    message: unknown;
    sujet?: string;
  }): Promise<string[]> {
    sujet ??= this.client.sujet_réseau;
    const pubsub = (await this.client.attendreSfipEtOrbite()).sfip.libp2p
      .services.pubsub;

    const octetsMessage = new TextEncoder().encode(JSON.stringify(message));
    const retour = await pubsub.publish(sujet, Buffer.from(octetsMessage));
    return retour.recipients.map((r) => r.toString());
  }

  async suivreMessagesGossipsub({
    sujet,
    f,
  }: {
    sujet: string;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    const pubsub = (await this.client.attendreSfipEtOrbite()).sfip.libp2p
      .services.pubsub;
    pubsub.subscribe(sujet);

    const fÉcoutePubSub = async (évé: CustomEvent<GossipsubMessage>) => {
      const messageGs = évé.detail.msg;
      if (messageGs.topic === sujet) {
        const message = new TextDecoder().decode(messageGs.data);
        await f(message);
      }
    };
    pubsub.addEventListener("gossipsub:message", fÉcoutePubSub);

    return async () => {
      // À faire : garder compte des requêtes pour `sujet` et appeler `unsubscribe` si nécessaire
      pubsub.removeEventListener("gossipsub:message", fÉcoutePubSub);
    };
  }

  async connecterÀAdresse({ adresse }: { adresse: string }) {
    const { sfip } = await this.client.attendreSfipEtOrbite();
    await sfip.libp2p.dial(multiaddr(adresse));
  }

  async envoyerMessageAuDispositif({
    msg,
    idDispositif,
    signal,
  }: {
    msg: MessageDirecte;
    idDispositif: string;
    signal?: AbortSignal;
  }) {
    const flux = await this.obtFluxDispositif({ idDispositif, signal });
    const msgBinaire = new TextEncoder().encode(JSON.stringify(msg));
    flux.push(msgBinaire);
  }

  async envoyerMessageAuPair({
    msg,
    idPair,
    signal,
  }: {
    msg: MessageDirecte;
    idPair: string;
    signal?: AbortSignal;
  }) {
    const flux = await this.obtFluxPair({ idPair, signal });
    const msgBinaire = new TextEncoder().encode(JSON.stringify(msg));
    flux.push(msgBinaire);
  }

  async envoyerMessageAuMembre({
    msg,
    idCompte,
  }: {
    msg: MessageDirecte;
    idCompte: string;
  }): Promise<void> {
    const dispositifsMembre = Object.values(this.dispositifsEnLigne)
      .filter((d) => d.infoDispositif.idCompte === idCompte)
      .filter((d) => d.vuÀ === undefined);
    if (!dispositifsMembre.length)
      throw new Error(
        `Aucun dispositif présentement en ligne pour membre ${idCompte}`,
      );

    await Promise.allSettled(
      dispositifsMembre.map(async (d) => {
        await this.envoyerMessageAuDispositif({
          msg,
          idDispositif: d.infoDispositif.idDispositif,
        });
      }),
    );
  }

  async suivreMessagesDirectes({
    f,
    type,
    de,
  }: {
    f: schémaFonctionSuivi<MessageDirecte>;
    type?: MessageDirecte["type"] | MessageDirecte["type"][];
    de?: string;
  }): Promise<schémaFonctionOublier> {
    if (de) {
      de = await uneFois(async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreConnexionsDispositifs({
          f: async (dispositifs) => {
            const correspondant = dispositifs?.find(
              (d) => d.infoDispositif.idDispositif === de,
            );
            if (correspondant)
              return await fSuivi(correspondant.infoDispositif.idLibp2p);
          },
        });
      });
    }
    const gérerMessage = async ({
      de: messageDe,
      message,
    }: {
      de: string;
      message: MessageDirecte;
    }) => {
      if (type && !(message.type === type)) return;
      if (de && !(de === messageDe)) return;
      await f(message);
    };

    return appelerLorsque({
      émetteur: this.événements,
      événement: "messageDirecte",
      // @ts-expect-error à voir
      f: gérerMessage,
    });
  }

  async direSalut({ idPair }: { idPair: string }): Promise<void> {
    const { orbite } = await this.client.attendreSfipEtOrbite();
    const texteNChangementsCompte = await this.client.obtDeStockageLocal({
      clef: CLEF_N_CHANGEMENT_COMPTES,
      parCompte: false,
    });
    const nChangementsCompte = Number(texteNChangementsCompte) || 0;

    const contenu: ContenuMessageSalut["contenu"] = {
      idLibp2p: await this.client.obtIdLibp2p(),
      idDispositif: orbite.identity.id,
      clefPublique: orbite.identity.publicKey,
      signatures: orbite.identity.signatures,
      idCompte: await this.client.obtIdCompte(),
      nChangementsCompte: nChangementsCompte,
    };
    const signature = await this.client.signer({
      message: JSON.stringify(contenu),
    });
    const valeur: MessageDirecteSalut = {
      type: "Salut !",
      contenu: {
        contenu,
        signature,
      },
    };
    try {
      await this.envoyerMessageAuPair({ msg: valeur, idPair });
    } catch (e) {
      if (!(e instanceof AbortError)) throw e;
    }
  }

  async envoyerDemandeRejoindreCompte({
    codeSecret,
  }: {
    codeSecret: string;
  }): Promise<void> {
    const idDispositif = await this.client.obtIdDispositif();
    let idDispositifQuiInvite: string | undefined = undefined;
    let codeSecretOriginal: string | undefined = undefined;
    if (codeSecret.includes(":")) {
      [idDispositifQuiInvite, codeSecretOriginal] = codeSecret.split(":");
    } else {
      codeSecretOriginal = codeSecret;
    }
    const msg: MessageDirecteRequêteRejoindreCompte = {
      type: "Je veux rejoindre ce compte",
      contenu: {
        idDispositif,
        empreinteVérification: this.client.empreinteInvitation({
          idDispositif,
          codeSecret: codeSecretOriginal,
        }),
      },
    };

    await this.envoyerMessageAuDispositif({
      msg,
      idDispositif: idDispositifQuiInvite!,
    });
  }

  async recevoirSalut({
    message,
  }: {
    message: ContenuMessageSalut;
  }): Promise<void> {
    const { signature, contenu } = message;

    // Ignorer les messages de nous-mêmes
    const { clefPublique } = contenu;

    // Assurer que la signature est valide (message envoyé par détenteur de idDispositif)
    const signatureValide = await this.client.vérifierSignature({
      signature,
      message: JSON.stringify(contenu),
    });
    if (!signatureValide) return;

    // S'assurer que idDispositif est la même que celle sur la signature
    if (clefPublique !== signature.clefPublique) return;

    const dispositifValid = await this._validerInfoMembre({
      info: message.contenu,
    });
    if (!dispositifValid) return;

    const { idDispositif } = message.contenu;

    // Sauter les anciens messages, qui peuvent causer une régression à un ancien compte s'ils arrivent après un changement de compte
    if (
      (this.dispositifsEnLigne[idDispositif]?.infoDispositif
        .nChangementsCompte || 0) > message.contenu.nChangementsCompte
    ) {
      return;
    }
    this.dispositifsEnLigne[idDispositif] = {
      infoDispositif: message.contenu,
      vuÀ: undefined,
    };

    this.événements.emit("membreVu");
    await this._sauvegarderDispositifsEnLigne();
  }

  _nettoyerDispositifsEnLigne(): void {
    const maintenant = new Date().getTime();
    const effaçables = Object.values(this.dispositifsEnLigne)
      .filter(
        (d) => maintenant - (d.vuÀ || 0) > DÉLAI_SESOUVENIR_MEMBRES_EN_LIGNE,
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
    try {
      const { bd: bdCompte, fOublier } = await this.client.ouvrirBd({
        id: idCompte,
      });

      const bdCompteValide = await attendreSuccès({
        f: async () => {
          if (!estUnContrôleurConstellation(bdCompte.access)) return false;
          return await bdCompte.access.estAutorisé(idDispositif);
        },
        signal: this.client.signaleurArrêt.signal,
      });

      await fOublier();
      return sigIdValide && sigClefPubliqueValide && bdCompteValide;
    } catch {
      return false;
    }
  }

  @cacheRechercheParProfondeur
  async suivreRelationsConfiance({
    f,
    profondeur = Infinity,
    idCompteDébut,
  }: {
    f: schémaFonctionSuivi<infoRelation[]>;
    profondeur?: number;
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
          info.relations.map((r) => r.idCompte).includes(id),
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
      idCompte: string,
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
      idCompte: string,
    ): Promise<void> => {
      await dicOublierRelations[idCompte]();
      delete dicOublierRelations[idCompte];
      delete dicRelations[idCompte];
    };

    const fMiseÀJour = async () => {
      if (fermer) return;
      await verrou.acquire("modification");
      try {
        const àOublier: string[] = Object.keys(dicRelations).filter(
          (r) => calcProfondeurCompte(r) >= profondeur,
        );
        const àSuivre: string[] = [
          ...new Set(
            Object.entries(dicRelations)
              .filter(([de, _]) => calcProfondeurCompte(de) + 1 < profondeur)
              .map(([_, info]) => info.relations.map((r) => r.idCompte))
              .flat(),
          ),
        ].filter((id) => !Object.keys(dicRelations).includes(id));
        await Promise.allSettled(
          àOublier.map((id) => oublierRelationsImmédiates(id)),
        );
        await Promise.allSettled(
          àSuivre.map((id) => suivreRelationsImmédiates(id)),
        );

        await fFinale();
      } finally {
        verrou.release("modification");
      }
    };

    await suivreRelationsImmédiates(idCompteDébutFinal);

    const fChangerProfondeur = async (p: number) => {
      profondeur = p;
      await fMiseÀJour();
    };

    const fOublier = async () => {
      fermer = true;
      await Promise.allSettled(
        Object.values(dicOublierRelations).map((f) => f()),
      );
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
    profondeur?: number;
    idCompteDébut?: string;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const monIdCompte = await this.client.obtIdCompte();

    const fSuivi = async (relations: infoRelation[]) => {
      // S'ajouter soi-même
      relations.push({
        de: monIdCompte,
        pour: monIdCompte,
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
              confiance: maRelation.confiance,
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
                    Math.pow(FACTEUR_ATÉNUATION_BLOQUÉS, r.profondeur - 1),
              )
              .reduce((total, c) => c * total, 1);

          const confiance =
            1 -
            rsPositives
              .map(
                (r) =>
                  1 -
                  r.confiance *
                    Math.pow(FACTEUR_ATÉNUATION_CONFIANCE, r.profondeur - 1),
              )
              .reduce((total, c) => c * total, 1) -
            coûtNégatif;

          return {
            idCompte,
            profondeur: profondeurCompte,
            confiance,
          };
        },
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
    profondeur?: number;
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

    const monIdCompte = await this.client.obtIdCompte();

    const fOublierComptesEnLigne = await this.suivreConnexionsMembres({
      f: async (membres: statutMembre[]) => {
        const infoMembresEnLigne: infoMembreRéseau[] = membres
          .filter((m) => m.infoMembre.idCompte !== monIdCompte)
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
  async suivreConnexionsDispositifs({
    f,
  }: {
    f: schémaFonctionSuivi<statutDispositif[]>;
  }): Promise<schémaFonctionOublier> {
    const texteNChangementsCompte = await this.client.obtDeStockageLocal({
      clef: CLEF_N_CHANGEMENT_COMPTES,
      parCompte: false,
    });
    const nChangementsCompte = Number(texteNChangementsCompte) || 0;
    const moi: statutDispositif = {
      infoDispositif: {
        idLibp2p: await this.client.obtIdLibp2p(),
        idDispositif: await this.client.obtIdDispositif(),
        idCompte: await this.client.obtIdCompte(),
        clefPublique: (await this.client.obtIdentitéOrbite()).publicKey,
        signatures: (await this.client.obtIdentitéOrbite()).signatures,
        nChangementsCompte,
      },
    };

    const fFinale = async () => {
      return await f([...Object.values(this.dispositifsEnLigne), moi]);
    };

    const oublier = appelerLorsque({
      émetteur: this.événements,
      événement: "membreVu",
      f: fFinale,
    });
    await fFinale();

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
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: statutMembreSansProtocoles[]) => Promise<void>;
    }) => {
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
          membres[idCompte].vuÀ =
            vuÀ === undefined
              ? undefined
              : d.vuÀ === undefined
                ? undefined
                : Math.max(vuÀ, d.vuÀ);
        }
        return await fSuivreRacine(Object.values(membres));
      };
      return await this.suivreConnexionsDispositifs({ f: fFinaleDispositifs });
    };

    const fBranche = async ({
      id,
      fSuivreBranche,
      branche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<statutMembre>;
      branche: statutMembreSansProtocoles;
    }): Promise<schémaFonctionOublier> => {
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

    return await suivreDeFonctionListe({
      fListe,
      f,
      fBranche,
      fIdDeBranche: (x: statutMembreSansProtocoles) => x.infoMembre.idCompte,
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
      // @ts-expect-error Je ne sais pas pourquoi
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
            (d) => d.infoDispositif.idDispositif === idDispositifFinal,
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
      fSuivre,
    }: {
      id: string;
      fSuivre: schémaFonctionSuivi<{ [key: string]: string[] } | undefined>;
    }) => {
      return await this.suivreProtocolesMembre({
        f: fSuivre,
        idCompte: id,
      });
    };

    const fFinale = async (protocoles?: {
      [key: string]: string[];
    }): Promise<void> => {
      if (protocoles) return await f(protocoles[idDispositifFinal]);
    };

    return await suivreFonctionImbriquée({
      fRacine,
      f: fFinale,
      fSuivre,
    });
  }

  async fermer(): Promise<void> {
    await Promise.allSettled(this.fsOublier.map((f) => f()));

    // Si nous nous déconnectons, il faut noter le moment comme la dernière connexion avec les autres pairs
    Object.values(this.dispositifsEnLigne).map((d) => (d.vuÀ = Date.now()));
    await this._sauvegarderDispositifsEnLigne();
  }
}
