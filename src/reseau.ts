import { isValidAddress } from "@orbitdb/core";

import { Semaphore } from "@chriscdn/promise-semaphore";
import { multiaddr } from "@multiformats/multiaddr";
import { sum } from "lodash-es";
import { TypedEmitter } from "tiny-typed-emitter";
import { pipe } from "it-pipe";
import { pushable } from "it-pushable";
import { GossipsubMessage } from "@chainsafe/libp2p-gossipsub";
import {
  faisRien,
  suivreFonctionImbriquée,
  suivreDeFonctionListe,
  uneFois,
} from "@constl/utils-ipa";
import { JSONSchemaType } from "ajv";
import { peerIdFromString } from "@libp2p/peer-id";
import { anySignal } from "any-signal";
import pRetry, { AbortError } from "p-retry";
import {
  CLEF_N_CHANGEMENT_COMPTES,
  Constellation,
  Signature,
  infoAccès,
  schémaStructureBdCompte,
} from "@/client.js";
import {
  cacheRechercheParNRésultats,
  cacheRechercheParProfondeur,
  cacheSuivi,
} from "@/décorateursCache.js";
import { rechercherProfilsSelonActivité } from "@/recherche/profil.js";
import { rechercherTous } from "@/recherche/utils.js";
import { ComposanteClientDic } from "./composanteClient.js";
import { estUnContrôleurConstellation } from "./accès/utils.js";
import { PROTOCOLE_CONSTELLATION } from "./const.js";
import { appelerLorsque } from "./utils.js";
import type { Pushable } from "it-pushable";

import type { ÉpingleFavoris, ÉpingleFavorisAvecId } from "@/favoris.js";
import type { infoScore } from "@/bds.js";
import type {
  Connection,
  Libp2pEvents,
  PeerId,
  PeerUpdate,
  Stream,
} from "@libp2p/interface";
import type { élémentBdListeDonnées, élémentDonnées } from "@/tableaux.js";
import type {
  infoAuteur,
  infoRésultat,
  infoRésultatRecherche,
  résultatObjectifRecherche,
  résultatRecherche,
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaFonctionSuivreConfianceRecherche,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuivreQualitéRecherche,
  schémaRetourFonctionRechercheParN,
  schémaRetourFonctionRechercheParProfondeur,
} from "@/types.js";
import type { erreurValidation } from "@/valid.js";

type clefObjet = "bds" | "variables" | "motsClefs" | "projets" | "nuées";

export type infoDispositif = {
  idLibp2p: string;
  idDispositif: string;
  idCompte: string;
  clefPublique: string;
  signatures: { id: string; publicKey: string };
  nChangementsCompte?: number;
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
  dispositifs: {
    épingle: ÉpingleFavorisAvecId;
    dispositif: {
      idDispositif: string;
      vuÀ?: number;
    };
  }[];
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

const FACTEUR_ATÉNUATION_CONFIANCE = 0.8;
const FACTEUR_ATÉNUATION_BLOQUÉS = 0.9;
const CONFIANCE_DE_COAUTEUR = 0.9;
const CONFIANCE_DE_FAVORIS = 0.7;
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

export class Réseau extends ComposanteClientDic<structureBdPrincipaleRéseau> {
  client: Constellation;
  bloquésPrivés: Set<string>;
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

    this.bloquésPrivés = new Set();

    this.dispositifsEnLigne = {};
    this.connexionsDirectes = {};

    this.événements = new TypedEmitter<ÉvénementsRéseau>();
    this.verrouFlux = new Semaphore();

    this.fsOublier = [];
  }

  async initialiser(): Promise<void> {
    const texteDispositifsVus = await this.client.obtDeStockageLocal({
      clef: "dispositifsEnLigne",
    });
    this.dispositifsEnLigne = texteDispositifsVus
      ? JSON.parse(texteDispositifsVus)
      : {};

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

  async suivreMesAdresses({
    f,
  }: {
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const { sfip } = await this.client.attendreSfipEtOrbite();
    const adressesActuelles = sfip.libp2p
      .getMultiaddrs()
      .map((a) => a.toString());
    await f(adressesActuelles);

    const fSuivi = async (é: CustomEvent<PeerUpdate>) => {
      const adresses = é.detail.peer.addresses.map((a) =>
        a.multiaddr.toString(),
      );
      await f(adresses);
    };
    sfip.libp2p.addEventListener("self:peer:update", fSuivi);
    return async () =>
      sfip.libp2p.removeEventListener("self:peer:update", fSuivi);
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

    // Sauter les anciens messages
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
        (m) => membres[m] === "FIABLE",
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
        this.bloquésPrivés.add(b),
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
        (m) => membres[m] === "BLOQUÉ",
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
      }),
    );

    if (idCompte === undefined || idCompte === this.client.idCompte) {
      await this._initaliserBloquésPrivés();
      fsOublier.push(
        appelerLorsque({
          émetteur: this.événements,
          événement: "changementMembresBloqués",
          f: fFinale,
        }),
      );
      await fFinale();
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
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
      }),
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
      }),
    );

    const inscrireSuiviAuteurs = async (
      fListe: ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (é: string[]) => Promise<void>;
      }) => Promise<schémaFonctionOublier>,
      clef: keyof typeof comptes,
      confiance: number,
    ) => {
      fsOublier.push(
        await suivreDeFonctionListe({
          fListe,
          f: async (membres: string[]) => {
            comptes[clef] = membres.map((idCompte) => {
              return { idCompte, confiance };
            });
            return await fFinale();
          },
          fBranche: async ({
            id,
            fSuivreBranche,
          }: {
            id: string;
            fSuivreBranche: schémaFonctionSuivi<string[]>;
          }) => {
            return await this.client.suivreAccèsBd({
              id,
              // Enlever nous-même de la liste des coauteurs
              f: (accès: infoAccès[]) =>
                fSuivreBranche(
                  accès.map((a) => a.idCompte).filter((id) => id !== idCompte),
                ),
            });
          },
        }),
      );
    };

    const fSuivreFavoris = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (é: string[]) => Promise<void>;
    }) => {
      return await this.suivreFavorisMembre({
        idCompte: idCompte!,
        f: (favoris) => {
          return fSuivreRacine((favoris || []).map((f) => f.idObjet));
        },
      });
    };
    await inscrireSuiviAuteurs(fSuivreFavoris, "favoris", CONFIANCE_DE_FAVORIS);

    const fSuivreBds = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (é: string[]) => Promise<void>;
    }) => {
      return await this.suivreBdsMembre({
        idCompte: idCompte!,
        f: (bds) => fSuivreRacine(bds || []),
      });
    };
    await inscrireSuiviAuteurs(
      fSuivreBds,
      "coauteursBds",
      CONFIANCE_DE_COAUTEUR,
    );

    const fSuivreProjets = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (é: string[]) => Promise<void>;
    }) => {
      return await this.suivreProjetsMembre({
        idCompte: idCompte!,
        f: (projets) => fSuivreRacine(projets || []),
      });
    };
    await inscrireSuiviAuteurs(
      fSuivreProjets,
      "coauteursProjets",
      CONFIANCE_DE_COAUTEUR,
    );

    const fSuivreVariables = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (é: string[]) => Promise<void>;
    }) => {
      return await this.suivreVariablesMembre({
        idCompte: idCompte!,
        f: (variables) => fSuivreRacine(variables || []),
      });
    };
    await inscrireSuiviAuteurs(
      fSuivreVariables,
      "coauteursVariables",
      CONFIANCE_DE_COAUTEUR,
    );

    const fSuivreMotsClefs = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (é: string[]) => Promise<void>;
    }) => {
      return await this.suivreMotsClefsMembre({
        idCompte: idCompte!,
        f: (motsClefs) => fSuivreRacine(motsClefs || []),
      });
    };
    await inscrireSuiviAuteurs(
      fSuivreMotsClefs,
      "coauteursMotsClefs",
      CONFIANCE_DE_COAUTEUR,
    );

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
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
  async suivreConnexionsPostesSFIP({
    f,
  }: {
    f: schémaFonctionSuivi<{ pair: string; adresses: string[] }[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async () => {
      const { sfip } = await this.client.attendreSfipEtOrbite();
      const pairs = sfip.libp2p.getPeers();
      const connexions = sfip.libp2p.getConnections();

      return await f(
        pairs.map((p) => {
          const pair = p.toString();
          const adresses = connexions
            .filter(
              (c) => c.remotePeer.toString() === pair && c.status !== "closed",
            )
            .map((a) => a.remoteAddr.toString());
          return { pair, adresses };
        }),
      );
    };

    const oublier = appelerLorsque({
      émetteur: this.événements,
      événement: "changementConnexions",
      f: fFinale,
    });
    await fFinale();

    return oublier;
  }

  @cacheSuivi
  async suivreConnexionsDispositifs({
    f,
  }: {
    f: schémaFonctionSuivi<statutDispositif[]>;
  }): Promise<schémaFonctionOublier> {
    const moi: statutDispositif = {
      infoDispositif: {
        idLibp2p: await this.client.obtIdLibp2p(),
        idDispositif: await this.client.obtIdDispositif(),
        idCompte: await this.client.obtIdCompte(),
        clefPublique: (await this.client.obtIdentitéOrbite()).publicKey,
        signatures: (await this.client.obtIdentitéOrbite()).signatures,
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

    return await suivreFonctionImbriquée({
      fRacine,
      f: fFinale,
      fSuivre,
    });
  }

  async rechercher<T extends infoRésultat>({
    f,
    nRésultatsDésirés = Infinity,
    fRecherche,
    fConfiance,
    fQualité,
    fObjectif,
    fScore,
  }: {
    f: schémaFonctionSuivi<résultatRecherche<T>[]>;
    fRecherche: (args: {
      idCompte: string;
      fSuivi: (x: string[] | undefined) => Promise<void>;
    }) => Promise<schémaFonctionOublier>;
    fConfiance: schémaFonctionSuivreConfianceRecherche;
    nRésultatsDésirés?: number;
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
      if (fChangerProfondeur) await fChangerProfondeur(p); // À faire : fChangerProfondeur peut être non défini
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
        },
      );

      const lParProfondeur = Object.entries(parProfondeur)
        .sort((a, b) => (Number(a[0]) < Number(b[0]) ? -1 : 1))
        .map((p) => p[1]);

      const nScoresInclusParProfondeur = lParProfondeur.map(
        (rs) =>
          rs.filter((r) => r.résultatObjectif.score >= pireScoreInclus).length,
      );

      const dernierTrois = nScoresInclusParProfondeur.slice(
        nScoresInclusParProfondeur.length - 3,
      );
      const dernierQuatre = nScoresInclusParProfondeur.slice(
        nScoresInclusParProfondeur.length - 4,
      );
      const nouvelleProfondeur = Math.max(
        3,
        sum(dernierTrois)
          ? profondeur + 1
          : sum(dernierQuatre)
            ? profondeur
            : profondeur - 1,
      );

      if (nouvelleProfondeur > profondeur) {
        annulerRebours = setTimeout(
          () => ajusterProfondeur(nouvelleProfondeur),
          délai,
        );
      } else if (nouvelleProfondeur < profondeur) {
        ajusterProfondeur(nouvelleProfondeur);
      }
    };

    const fFinale = async () => {
      const résultats: résultatRecherche<T>[] = Object.values(
        résultatsParMembre,
      )
        .map((listeRésultats) => listeRésultats.résultats)
        .flat();
      const résultatsOrdonnés = résultats.sort((a, b) =>
        a.résultatObjectif.score < b.résultatObjectif.score ? 1 : -1,
      );
      await f(résultatsOrdonnés.slice(0, nRésultatsDésirés));
      débuterReboursAjusterProfondeur();
    };

    const suivreRésultatsMembre = async (
      membre: infoMembreRéseau,
    ): Promise<void> => {
      const { idCompte } = membre;

      const fListe = async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: string[]) => Promise<void>;
      }): Promise<schémaFonctionOublier> => {
        return await fRecherche({
          idCompte: membre.idCompte,
          fSuivi: async (résultats) => await fSuivreRacine(résultats || []),
        });
      };

      const fSuivi = async (résultats: résultatRecherche<T>[]) => {
        résultatsParMembre[idCompte].résultats = résultats;
        return await fFinale();
      };

      const fBranche = async ({
        id,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<résultatRecherche<T> | undefined>;
      }): Promise<schémaFonctionOublier> => {
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
          fSuivreObjectif,
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
          await Promise.allSettled([
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

      const fOublierRechercheMembre = await suivreDeFonctionListe({
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
      comptes: infoMembreRéseau[],
    ): Promise<void> => {
      await verrou.acquire("rechercher");

      try {
        comptes = comptes.filter((c) => c.confiance >= 0); // Enlever les membres bloqués

        const nouveaux = comptes.filter((c) => !résultatsParMembre[c.idCompte]);
        const clefsObsolètes = Object.keys(résultatsParMembre).filter(
          (m) => !comptes.find((c) => c.idCompte === m),
        );
        const changés = comptes.filter((c) => {
          const avant = résultatsParMembre[c.idCompte];
          return (
            avant &&
            (c.confiance !== avant.membre.confiance ||
              c.profondeur !== avant.membre.profondeur)
          );
        });

        await Promise.allSettled(nouveaux.map(suivreRésultatsMembre));
        await Promise.allSettled(
          changés.map(
            async (c) => await résultatsParMembre[c.idCompte].mettreÀJour(c),
          ),
        );

        await Promise.allSettled(
          clefsObsolètes.map((o) => oublierRésultatsMembre(o)),
        );
      } finally {
        verrou.release("rechercher");
      }
    };

    const { fChangerProfondeur, fOublier: fOublierSuivreComptes } =
      await this.suivreComptesRéseauEtEnLigne({
        f: fSuivreComptes,
        profondeur,
      });

    const fChangerN = async (nouveauN: number = Infinity) => {
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
      await Promise.allSettled(
        Object.values(fsOublierRechercheMembres).map((f) => f()),
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
    nRésultatsDésirés?: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fConfiance = async (
      idCompte: string,
      fSuivi: schémaFonctionSuivi<number>,
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
      await fSuivi([idCompte]);
      return faisRien; // Rien à faire parce que nous ne recherchons que le compte
    };

    const fQualité = async (
      idCompte: string,
      fSuivi: schémaFonctionSuivi<number>,
    ): Promise<schémaFonctionOublier> => {
      const fRechercherSelonActivité = rechercherProfilsSelonActivité();
      return await fRechercherSelonActivité(
        this.client,
        idCompte,
        async (résultat) => {
          await fSuivi(résultat?.score || 0);
        },
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
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (auteurs: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
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

    const fBranche = async ({
      id: idAuteur,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<number>;
    }): Promise<schémaFonctionOublier> => {
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

    return await suivreDeFonctionListe({
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
    nRésultatsDésirés?: number;
    fRecherche: (args: {
      idCompte: string;
      f: (objets: string[] | undefined) => void;
    }) => Promise<schémaFonctionOublier>;
    fRechercheLesMiens: (
      fSuivreRacine: (objets: string[]) => Promise<void>,
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

      return await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }): Promise<schémaRetourFonctionRechercheParN> => {
          return {
            fOublier: await fRechercheLesMiens(fSuivreRacine),
            fChangerN: () => Promise.resolve(),
          }; // À faire : implémenter fChangerN ?
        },
        f,
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: schémaFonctionSuivi<résultatRecherche<T>>;
        }): Promise<schémaFonctionOublier> =>
          await fObjectifFinal(this.client, id, async (résultat) => {
            if (résultat)
              return await fSuivreBranche({
                id,
                résultatObjectif: résultat,
              });
          }),
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

      const clefObjetÀClef = (
        x: clefObjet,
      ): "projet" | "nuée" | "bd" | "variable" | "motClef" | undefined => {
        switch (x) {
          case "bds":
            return "bd";
          case "motsClefs":
            return "motClef";
          case "nuées":
            return "nuée";
          case "projets":
            return "projet";
          case "variables":
            return "variable";
          default:
            return undefined;
        }
      };

      const fOublierFavoris = await this.client.suivreBdsSelonCondition({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (id: string[]) => Promise<void>;
        }): Promise<schémaFonctionOublier> => {
          return await this.suivreFavorisMembre({
            idCompte,
            f: async (favoris) =>
              fSuivreRacine(
                favoris
                  .filter((fv) => fv.épingle.type === clefObjetÀClef(clef))
                  .map((fv) => fv.idObjet),
              ),
          });
        },
        fCondition: async (
          id: string,
          fSuivreCondition: schémaFonctionSuivi<boolean>,
        ): Promise<schémaFonctionOublier> => {
          return await this.client.suivreTypeObjet({
            idObjet: id,
            f: async (typeObjet) =>
              await fSuivreCondition(typeObjet === clefObjetÀClef(clef)),
          });
        },
        f: async (favoris) => {
          résultats.favoris = favoris ? favoris : [];
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
      f: schémaFonctionSuivi<number>,
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
    nRésultatsDésirés?: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fRecherche = this.suivreNuéesMembre.bind(this);
    const fQualité = async (
      id: string,
      fSuivreQualité: schémaFonctionSuivi<number>,
    ) => {
      return await this.client.nuées.suivreQualitéNuée({
        idNuée: id,
        f: fSuivreQualité,
      });
    };
    const fRechercheLesMiens = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>,
    ): Promise<schémaFonctionOublier> =>
      await this.client.nuées.suivreNuées({ f: fSuivreRacine });

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
    nRésultatsDésirés?: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fRecherche = this.suivreBdsMembre.bind(this);
    const fQualité = async (
      id: string,
      fSuivreQualité: schémaFonctionSuivi<number>,
    ) => {
      const fFinaleSuivreQualité = async (score: infoScore) => {
        return await fSuivreQualité(score.total);
      };
      return await this.client.bds.suivreQualitéBd({
        idBd: id,
        f: fFinaleSuivreQualité,
      });
    };

    const fRechercheLesMiens = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>,
    ): Promise<schémaFonctionOublier> =>
      await this.client.bds.suivreBds({ f: fSuivreRacine });

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
    nRésultatsDésirés?: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fRecherche = this.suivreVariablesMembre.bind(this);

    const fQualité = async (
      id: string,
      fSuivreQualité: schémaFonctionSuivi<number>,
    ) => {
      return await this.client.variables.suivreQualitéVariable({
        idVariable: id,
        f: fSuivreQualité,
      });
    };

    const fRechercheLesMiens = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>,
    ): Promise<schémaFonctionOublier> =>
      await this.client.variables.suivreVariables({
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
    nRésultatsDésirés?: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fRecherche = this.suivreMotsClefsMembre.bind(this);

    const fQualité = async (
      id: string,
      fSuivreQualité: schémaFonctionSuivi<number>,
    ) => {
      return await this.client.motsClefs.suivreQualitéMotClef({
        idMotClef: id,
        f: fSuivreQualité,
      });
    };

    const fRechercheLesMiens = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>,
    ): Promise<schémaFonctionOublier> =>
      await this.client.motsClefs.suivreMotsClefs({
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
    nRésultatsDésirés?: number;
    fObjectif?: schémaFonctionSuivreObjectifRecherche<T>;
    toutLeRéseau?: boolean;
  }): Promise<schémaRetourFonctionRechercheParN> {
    const fRecherche = this.suivreProjetsMembre.bind(this);

    const fQualité = async (
      id: string,
      fSuivreQualité: schémaFonctionSuivi<number>,
    ) => {
      return await this.client.projets.suivreQualitéProjet({
        idProjet: id,
        f: fSuivreQualité,
      });
    };

    const fRechercheLesMiens = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>,
    ): Promise<schémaFonctionOublier> =>
      await this.client.projets.suivreProjets({ f: fSuivreRacine });

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
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: infoAccès[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.suivreAccèsBd({ id: idObjet, f: fSuivreRacine });
    };
    const fBranche = async ({
      id: idCompte,
      fSuivreBranche,
      branche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<infoAuteur[]>;
      branche: infoAccès;
    }) => {
      const fFinaleSuivreBranche = async (objetsMembre?: string[]) => {
        objetsMembre = objetsMembre || [];

        return await fSuivreBranche([
          {
            idCompte: branche.idCompte,
            rôle: branche.rôle,
            accepté: objetsMembre.includes(idObjet),
          },
        ]);
      };

      let fOublierBranche: schémaFonctionOublier | undefined = undefined;
      // On doit appeler ça ici pour avanncer même si l'autre compte'est pas disponible.
      await fFinaleSuivreBranche();

      switch (clef) {
        case "motsClefs":
          fOublierBranche = await this.client.motsClefs.suivreMotsClefs({
            f: fFinaleSuivreBranche,
            idCompte,
          });
          break;
        case "variables":
          fOublierBranche = await this.client.variables.suivreVariables({
            f: fFinaleSuivreBranche,
            idCompte,
          });
          break;
        case "bds":
          fOublierBranche = await this.client.bds.suivreBds({
            f: fFinaleSuivreBranche,
            idCompte,
          });
          break;
        case "nuées":
          fOublierBranche = await this.client.nuées.suivreNuées({
            f: fFinaleSuivreBranche,
            idCompte,
          });
          break;
        case "projets":
          fOublierBranche = await this.client.projets.suivreProjets({
            f: fFinaleSuivreBranche,
            idCompte,
          });
          break;
        default:
          throw new Error(clef);
      }
      return fOublierBranche;
    };
    const fIdDeBranche = (x: infoAccès) => x.idCompte;

    const fOublier = await suivreDeFonctionListe({
      fListe,
      f,
      fBranche,
      fIdDeBranche,
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
  async suivreAuteursNuée({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<infoAuteur[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreAuteursObjet({
      idObjet: idNuée,
      clef: "nuées",
      f,
    });
  }
  async suivreObjetsMembre({
    idCompte,
    fListeObjets,
    fSuivi,
  }: {
    idCompte: string;
    fListeObjets: (args: {
      fSuivreRacine: (ids: string[]) => Promise<void>;
    }) => Promise<schémaFonctionOublier>;
    fSuivi: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdsSelonCondition({
      fListe: fListeObjets,
      fCondition: async (
        id: string,
        fSuivreCondition: schémaFonctionSuivi<boolean>,
      ): Promise<schémaFonctionOublier> => {
        return await this.client.suivreAccèsBd({
          id,
          f: (autorisés: infoAccès[]) =>
            fSuivreCondition(
              autorisés.map((a) => a.idCompte).includes(idCompte),
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
      fListeObjets: async ({ fSuivreRacine }) =>
        await this.client.bds.suivreBds({ f: fSuivreRacine, idCompte }),
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
      fListeObjets: async ({ fSuivreRacine }) =>
        await this.client.projets.suivreProjets({
          f: fSuivreRacine,
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
    f: schémaFonctionSuivi<ÉpingleFavorisAvecId[]>;
  }): Promise<schémaFonctionOublier> {
    // suivreFavoris est différent parce qu'on n'a pas besoin de vérifier l'autorisation du membre
    return await this.client.favoris.suivreFavoris({
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
      fListeObjets: async ({ fSuivreRacine }) =>
        await this.client.variables.suivreVariables({
          f: fSuivreRacine,
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
      fListeObjets: async ({ fSuivreRacine }) =>
        await this.client.motsClefs.suivreMotsClefs({
          f: fSuivreRacine,
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
      fListeObjets: async ({ fSuivreRacine }) =>
        await this.client.nuées.suivreNuées({
          f: fSuivreRacine,
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
    f: schémaFonctionSuivi<
      { épingle: ÉpingleFavorisAvecId; idCompte: string }[]
    >;
    profondeur: number;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const fFinale = async (
      favoris: { épingle: ÉpingleFavorisAvecId; idCompte: string }[],
    ) => {
      const favorisDIntérêt = favoris.filter(
        (f) => f.épingle.idObjet === idObjet,
      );
      await f(favorisDIntérêt);
    };

    const fListe = async (
      fSuivreRacine: (membres: string[]) => Promise<void>,
    ): Promise<schémaRetourFonctionRechercheParProfondeur> => {
      const fSuivreComptes = async (infosMembres: infoMembreRéseau[]) => {
        // On s'ajoute à la liste des comptes
        const monCompte = await this.client.obtIdCompte();
        return await fSuivreRacine([
          monCompte,
          ...infosMembres.map((i) => i.idCompte),
        ]);
      };

      return await this.suivreComptesRéseauEtEnLigne({
        f: fSuivreComptes,
        profondeur,
        idCompteDébut: this.client.idCompte!,
      });
    };

    const fBranche = async ({
      id: idCompte,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<
        { épingle: ÉpingleFavorisAvecId; idCompte: string }[] | undefined
      >;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreFavorisMembre({
        idCompte: idCompte,
        f: (favoris: ÉpingleFavorisAvecId[] | undefined) =>
          fSuivreBranche(
            favoris
              ? favoris.map((fav) => {
                  return { idCompte, épingle: fav };
                })
              : undefined,
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
        favoris: ÉpingleFavoris & { idObjet: string; idCompte: string };
        dispositifs: string[];
      }[];
    } = { connexionsMembres: [], connexionsDispositifs: [], favoris: [] };

    const fFinale = async () => {
      const { connexionsMembres, favoris } = résultats;
      const idsMembres = favoris.map((fav) => fav.favoris.idCompte);
      const membres = connexionsMembres.filter((c) =>
        idsMembres.includes(c.infoMembre.idCompte),
      );

      const dispositifs: {
        épingle: ÉpingleFavorisAvecId;
        dispositif: {
          idDispositif: string;
          idCompte?: string;
          vuÀ?: number;
        };
      }[] = (
        await Promise.all(
          favoris.map(async (fav) => {
            const { favoris, dispositifs } = fav;

            return await Promise.all(
              dispositifs.map(async (d) => {
                const vuÀ = résultats.connexionsDispositifs.find(
                  (c) => c.infoDispositif.idDispositif === d,
                )?.vuÀ;
                const idCompte = résultats.connexionsDispositifs.find(
                  (c) => c.infoDispositif.idDispositif === d,
                )?.infoDispositif.idCompte;

                const dispositifsRéplication: {
                  épingle: ÉpingleFavorisAvecId;
                  dispositif: {
                    idDispositif: string;
                    idCompte?: string;
                    vuÀ?: number;
                  };
                } = {
                  épingle: { idObjet, épingle: favoris },
                  dispositif: {
                    idDispositif: d,
                    idCompte,
                    vuÀ,
                  },
                };
                return dispositifsRéplication;
              }),
            );
          }),
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
        favoris: ÉpingleFavoris & { idObjet: string; idCompte: string };
        dispositifs: string[];
      }[],
    ) => {
      résultats.favoris = favoris;
      return await fFinale();
    };

    const fListeFavoris = async (
      fSuivreRacine: (
        favoris: { épingle: ÉpingleFavorisAvecId; idCompte: string }[],
      ) => void,
    ): Promise<schémaRetourFonctionRechercheParProfondeur> => {
      return await this.suivreFavorisObjet({
        idObjet,
        f: fSuivreRacine,
        profondeur,
      });
    };

    const fBrancheFavoris = async ({
      id,
      fSuivreBranche,
      branche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<{
        favoris: { épingle: ÉpingleFavorisAvecId; idCompte: string };
        dispositifs: string[];
      }>;
      branche: { épingle: ÉpingleFavorisAvecId; idCompte: string };
    }): Promise<schémaFonctionOublier> => {
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

    const { fOublier: fOublierFavoris, fChangerProfondeur } =
      await this.client.suivreBdsDeFonctionRecherche({
        fListe: fListeFavoris,
        f: fSuivreFavoris,
        fBranche: fBrancheFavoris,
        fIdDeBranche: (x) => x.idCompte,
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
    nRésultatsDésirés?: number;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const fBranche = async ({
      id: idCompte,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<string[]>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.bds.rechercherBdsParNuée({
        idNuée,
        f: fSuivreBranche,
        idCompte,
      });
    };

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>,
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
      fSuivreRacine: (bds: bdDeMembre[]) => Promise<void>,
    ): Promise<schémaRetourFonctionRechercheParProfondeur> => {
      const fListeListe = async (
        fSuivreRacineListe: (bds: string[]) => Promise<void>,
      ): Promise<schémaRetourFonctionRechercheParProfondeur> => {
        return await this.suivreBdsDeNuée({
          idNuée: idNuéeUnique,
          f: fSuivreRacineListe,
          nRésultatsDésirés: nBds,
        });
      };

      const fBrancheListe = async ({
        id: idBd,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<bdDeMembre | undefined>;
      }): Promise<schémaFonctionOublier> => {
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
            return await fSuivreBranche(infoBdDeMembre);
          },
        });
      };
      return await this.client.suivreBdsDeFonctionRecherche({
        fListe: fListeListe,
        f: fSuivreRacine,
        fBranche: fBrancheListe,
      });
    };

    const fBranche = async ({
      id: idBd,
      fSuivreBranche,
      branche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<élémentDeMembre<T>[]>;
      branche: bdDeMembre;
    }): Promise<schémaFonctionOublier> => {
      const { idCompte } = branche;

      const fSuivreTableaux = async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (nouvelIdBdCible: string) => Promise<void>;
      }): Promise<schémaFonctionOublier> => {
        return await this.client.bds.suivreIdTableauParClef({
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
          données: élémentDonnées<T>[],
        ) => {
          const donnéesMembre: élémentDeMembre<T>[] = données.map((d) => {
            return {
              idCompte,
              élément: d,
            };
          });
          return await fSuivreBd(donnéesMembre);
        };
        return await this.client.tableaux.suivreDonnées({
          idTableau: id,
          f: fSuivreDonnéesTableauFinale,
        });
      };

      const fFinale = async (données?: élémentDeMembre<T>[]) => {
        return await fSuivreBranche(données || []);
      };

      return await suivreFonctionImbriquée({
        fRacine: fSuivreTableaux,
        f: fFinale,
        fSuivre: fSuivreDonnéesDeTableau,
      });
    };

    const fIdDeBranche = (b: bdDeMembre) => b.bd;

    return await this.client.suivreBdsDeFonctionRecherche({
      fListe,
      f,
      fBranche,
      fIdDeBranche,
    });
  }

  async fermer(): Promise<void> {
    await Promise.allSettled(this.fsOublier.map((f) => f()));
  }
}
