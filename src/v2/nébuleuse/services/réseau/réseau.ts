import {
  faisRien,
  ignorerNonDéfinis,
  suivreFonctionImbriquée,
} from "@constl/utils-ipa";
import { TypedEmitter } from "tiny-typed-emitter";
import PQueue from "p-queue";
import { anySignal } from "any-signal";
import { peerIdFromString } from "@libp2p/peer-id";
import { lpStream, type LengthPrefixedStream } from "@libp2p/utils";
import { peerSet } from "@libp2p/peer-collections";
import {
  ajouterPréfixes,
  enleverPréfixes,
  enleverPréfixesEtOrbite,
} from "@/v2/utils.js";
import { cacheRechercheParProfondeur, cacheSuivi } from "../../cache.js";
import {
  PROTOCOLE_NÉBULEUSE,
  FACTEUR_ATÉNUATION_CONFIANCE_NÉGATIVE,
  FACTEUR_ATÉNUATION_CONFIANCE_POSITIVE,
} from "../consts.js";
import { ServiceDonnéesAppli } from "../services.js";
import { MODÉRATRICE, estContrôleurNébuleuse } from "../compte/accès/index.js";
import {
  appelerLorsque,
  combinerConfiances,
  générerCodeSecret,
  générerRésolveur,
  obtEmpreinteCode,
  vérifierProfondeur,
  type FonctionRésolveur,
  type Résolveur,
} from "../utils.js";
import { estErreurAvortée } from "../../utils.js";
import { STATUTS } from "../../appli/consts.js";
import {
  ACCEPTATION_INVITATION_REJOINDRE_COMPTE,
  ACCEPTATION_REQUÊTE_REJOINDRE_COMPTE,
  IDENTITÉ_COMPTE,
} from "./messages.js";
import type {
  MessageAcceptationInvitationRejoindreCompte,
  MessageAcceptationRequêteRejoindreCompte,
  MessageIdentitéCompte,
  MessageRéseau,
  MessageRéseauAvecExpéditeur,
} from "./messages.js";
import type { ServicesNécessairesDonnées } from "../services.js";
import type { Libp2pEvents, Stream } from "@libp2p/interface";
import type { JSONSchemaType } from "ajv";
import type {
  OptionsAppli,
  ServicesAppli,
} from "@/v2/nébuleuse/appli/appli.js";
import type { PartielRécursif } from "@/v2/types.js";
import type { Oublier, RetourRechercheProfondeur, Suivi } from "../../types.js";
import type { ServiceAppli } from "../../appli/services.js";

// Types connexions

export type ConnexionLibp2p = {
  pair: string;
  adresses: string[];
  depuis: number;
};

export type ConnexionDispositif = {
  idDispositif: string;
  pair: ConnexionLibp2p;
};

export type ConnexionCompte = {
  idCompte: string;
  dispositifs: ConnexionDispositif[];
};

// Types dispositifs
export type DispositifCompte = {
  idDispositif: string;
  statut: "invité" | "accepté";
};

// Types relations

export type FonctionRésolveurConfianceRéseau = FonctionRésolveur<
  { de: string },
  RelationImmédiate[]
>;
export type RésolveurConfianceRéseau = Résolveur<
  { de: string },
  RelationImmédiate[]
>;

export type CompteBloqué = { idCompte: string; privé: boolean };

export type RelationRéseau = {
  de: string;
  pour: string;
  confiance: number;
  profondeur: number;
};

export type RelationImmédiate = { idCompte: string; confiance: number };

export type CompteRéseau = {
  idCompte: string;
  confiance: number;
  profondeur: number;
};

export type InfosPair = {
  idPair: string;
  idDispositif?: string;
  idCompte?: string;
};

// Constantes

const CLEF_COMPTES_BLOQUÉS = "comptes bloqués";

const FIABLE = "FIABLE";

const BLOQUÉ = "BLOQUÉ";

const ÉVÉNEMENTS = {
  BLOQUÉ_PRIVÉ: "changement bloqués privé",
  MESSAGE_RÉSEAU: "message réseau",
  IDENTIFICATION_COMPTE: "identification compte",
} as const;

// Ajout dispositifs

export type RequêteRejoindreCompte = {
  idDispositif: string;
  codeSecret: string;
};

export type InvitationRejoindreCompte = {
  idCompte: string;
  idPair: string;
  codeSecret: string;
};

// Types structure

export type StructureRéseau = {
  [idCompte: string]: typeof FIABLE | typeof BLOQUÉ;
};

export const schémaRéseau: JSONSchemaType<PartielRécursif<StructureRéseau>> & {
  nullable: true;
} = {
  type: "object",
  additionalProperties: {
    type: "string",
  },
  nullable: true,
};

export type ServicesNécessairesRéseau = ServicesNécessairesDonnées<{
  réseau: StructureRéseau;
}>;

type RetourDémarrageRéseau = { oublier: Oublier };

export const RÉSOLVEUR_CONFIANCE = "résolveur confiance";

export class ServiceRéseau extends ServiceDonnéesAppli<
  "réseau",
  StructureRéseau,
  ServicesAppli,
  RetourDémarrageRéseau
> {
  événements: TypedEmitter<{
    démarré: (args: { oublier: Oublier }) => void;
    [ÉVÉNEMENTS.BLOQUÉ_PRIVÉ]: (bloqués: Set<string>) => void;
    [ÉVÉNEMENTS.MESSAGE_RÉSEAU]: (message: MessageRéseauAvecExpéditeur) => void;
    [ÉVÉNEMENTS.IDENTIFICATION_COMPTE]: (args: {
      idPair: string;
      idDispositif: string;
      idCompte: string;
    }) => void;
  }>;
  flux: {
    intrants: Map<string, { soujacent: Stream; flux: LengthPrefixedStream }>;
    sortants: Map<string, { soujacent: Stream; flux: LengthPrefixedStream }>;
  };

  signaleurArrêt: AbortController;

  bloquésPrivé: Set<string>;

  résolutionsConfiance: Map<string, RésolveurConfianceRéseau>;

  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesRéseau;
    options: OptionsAppli;
  }) {
    super({
      clef: "réseau",
      services,
      dépendances: [
        "compte",
        "orbite",
        "hélia",
        "libp2p",
        "stockage",
        "journal",
      ],
      options,
    });

    this.bloquésPrivé = new Set();
    this.événements = new TypedEmitter();
    this.résolutionsConfiance = new Map();

    this.flux = { intrants: new Map(), sortants: new Map() };

    this.signaleurArrêt = new AbortController();
  }

  // Cycle de vie

  async démarrer(): Promise<{ oublier: Oublier }> {
    // Réinitialiser le signaleur, mais uniquement si nécessaire.
    if (this.signaleurArrêt.signal.aborted)
      this.signaleurArrêt = new AbortController();

    await this.restaurerBloquésPrivé();
    type ServicePotentiellementAvecRésolveurConfiance = ServiceAppli & {
      [RÉSOLVEUR_CONFIANCE]?: RésolveurConfianceRéseau;
    };

    for (const [clef, service] of Object.entries(this.services)) {
      const serviceAvecRésolveur =
        service as ServicePotentiellementAvecRésolveurConfiance;
      if (serviceAvecRésolveur[RÉSOLVEUR_CONFIANCE]) {
        this.inscrireRésolutionConfiance({
          clef,
          résolution: serviceAvecRésolveur[RÉSOLVEUR_CONFIANCE].bind(service),
        });
      }
    }

    const libp2p = await this.service("libp2p").libp2p();
    const orbite = this.service("orbite");

    const signal = this.signaleurArrêt.signal;

    const traiterIdentitéCompte = async ({
      message,
      idPair,
    }: {
      message: MessageIdentitéCompte;
      idPair: string;
    }) => {
      const { idCompte, signature, idDispositif } = message;

      const signatureValide = await orbite.vérifierSignature({
        signature,
        message: idDispositif,
      });
      if (!signatureValide) return;

      await libp2p.peerStore.merge(peerIdFromString(idPair), {
        metadata: {
          idDispositif: new TextEncoder().encode(idDispositif),
          idCompte: new TextEncoder().encode(idCompte),
        },
      });

      // libp2p.addEventListener("peer:update") ne semble pas fonctionner pour une modification locale
      // ...donc on utilise notre propre gestionnaire d'événements
      this.événements.emit(ÉVÉNEMENTS.IDENTIFICATION_COMPTE, {
        idCompte,
        idDispositif,
        idPair,
      });
    };

    await libp2p
      .handle(
        PROTOCOLE_NÉBULEUSE,
        async (flux, connexion) => {
          const idPair = connexion.remotePeer.toString();
          console.log(`handle ${idPair} reçu par ${libp2p.peerId.toString()}`);
          const fluxPl = lpStream(flux);
          this.flux.intrants.set(idPair, { soujacent: flux, flux: fluxPl });
          flux.addEventListener("close", () =>
            this.flux.intrants.delete(idPair),
          );

          while (true) {
            try {
              const octets = await fluxPl.read({
                signal: this.signaleurArrêt.signal,
              });

              const message = JSON.parse(
                new TextDecoder().decode(octets.slice()),
              ) as MessageRéseau;
              console.log({ message });
              if (message.type === IDENTITÉ_COMPTE) {
                await traiterIdentitéCompte({ message, idPair });
              }
              this.événements.emit(ÉVÉNEMENTS.MESSAGE_RÉSEAU, {
                message,
                expéditeur: idPair,
              });
            } catch (e) {
              if (e.name === "UnexpectedEOFError" || estErreurAvortée(e)) {
                break;
              }
              // Circulez, rien à voir
              this.service("journal").écrire({
                message: "Erreur réseautage " + e.toString(),
              });
            }
          }
        },
        {
          runOnLimitedConnection: true,
          signal,
        },
      )
      .catch((e) => {
        if (!estErreurAvortée(e)) throw e;
      });

    const envoyerMesIdentifiants = this.envoyerMesIdentifiants.bind(this);

    const salués = peerSet();
    // github.com/libp2p/js-libp2p-example-protocol-and-stream-muxing/commit/a9a393336f60a6b093e2d8ec7f9daab9fbdcd693
    const idTopologie = await libp2p
      .register(
        PROTOCOLE_NÉBULEUSE,
        {
          async onConnect(peerId, conn) {
            console.log(
              `onConnect - ${peerId.toString()} connecté à ${libp2p.peerId.toString()} sur ${conn.remoteAddr.toString()}`,
            );
            if (salués.has(peerId)) return;

            salués.add(peerId);

            conn.addEventListener("remoteCloseWrite", () =>
              console.log("✘ remoteCloseWrite", peerId.toString()),
            );
            conn.addEventListener("close", () =>
              console.log("✘ close", peerId.toString()),
            );
            await envoyerMesIdentifiants({
              idPair: peerId.toString(),
            });
          },
          async onDisconnect(peerId) {
            console.log(
              `✘ pair ${peerId.toString()} déconnecté de ${libp2p.peerId.toString()}`,
            );
            // this.lorsqueDispositifDéconnecté(peerId);
          },
          notifyOnLimitedConnection: true,
        },
        { signal },
      )
      .catch((e) => {
        if (!estErreurAvortée(e)) throw e;
      });

    const oublier = async () => {
      if (idTopologie) libp2p.unregister(idTopologie);
      await libp2p.unhandle([PROTOCOLE_NÉBULEUSE]);
    };
    this.estDémarré = { oublier };

    return await super.démarrer();
  }

  async fermer(): Promise<void> {
    const { oublier } = await this.démarré();
    this.statut = STATUTS.FERMETURE_EN_COURS;

    this.bloquésPrivé.clear();

    this.signaleurArrêt.abort();

    for (const clef of this.résolutionsConfiance.keys()) {
      await this.désinscrireRésolutionConfiance({ clef });
    }

    await Promise.allSettled(
      [...this.flux.intrants.values()].map(({ soujacent: flux }) =>
        flux.close(),
      ),
    );

    await Promise.allSettled(
      [...this.flux.sortants.values()].map(({ soujacent: flux }) =>
        flux.close(),
      ),
    );

    await oublier();

    return await super.fermer();
  }

  inscrireRésolutionConfiance({
    clef,
    résolution,
  }: {
    clef: string;
    résolution: FonctionRésolveurConfianceRéseau;
  }) {
    this.résolutionsConfiance.set(clef, générerRésolveur(résolution));
  }

  async désinscrireRésolutionConfiance({
    clef,
  }: {
    clef: string;
  }): Promise<void> {
    const résolveur = this.résolutionsConfiance.get(clef);
    await résolveur?.fermer();
    this.résolutionsConfiance.delete(clef);
  }

  // Gestion info pairs

  async obtDispositifIdPair({
    idPair,
  }: {
    idPair: string;
  }): Promise<string | undefined> {
    const libp2p = await this.service("libp2p").libp2p();
    const infoPair = await libp2p.peerStore.get(peerIdFromString(idPair));
    const idDispositif = infoPair.metadata.get("idDispositif");
    return idDispositif ? new TextDecoder().decode(idDispositif) : undefined;
  }

  async obtIdPairDispositif({
    idDispositif,
  }: {
    idDispositif: string;
  }): Promise<string | undefined> {
    const libp2p = await this.service("libp2p").libp2p();
    const infosPairs = await libp2p.peerStore.all();
    for (const pair of infosPairs) {
      const dispositif = pair.metadata.get("idDispositif");
      if (dispositif && new TextDecoder().decode(dispositif) === idDispositif)
        return pair.id.toString();
    }
    return undefined;
  }

  async suivreDispositifIdPair({
    idPair,
    f,
  }: {
    idPair: string;
    f: Suivi<string | undefined>;
  }): Promise<Oublier> {
    const fFinale = async ({ idPair: idPairIdentifié }: { idPair: string }) => {
      if (idPairIdentifié === idPair) {
        const idDispositif = await this.obtDispositifIdPair({ idPair });
        await f(idDispositif);
      }
    };
    const oublier = appelerLorsque({
      émetteur: this.événements,
      événement: ÉVÉNEMENTS.IDENTIFICATION_COMPTE,
      f: fFinale,
    });
    await fFinale({ idPair });
    return oublier;
  }

  async suivreInfosPairs({ f }: { f: Suivi<InfosPair[]> }): Promise<Oublier> {
    const libp2p = await this.service("libp2p").libp2p();
    const fFinale = async () => {
      const infos: {
        idPair: string;
        idDispositif?: string;
        idCompte?: string;
      }[] = [];
      for (const pair of await libp2p.peerStore.all()) {
        const idDispositif = pair.metadata.get("idDispositif");
        const idCompte = pair.metadata.get("idCompte");

        infos.push({
          idPair: pair.id.toString(),
          idDispositif: idDispositif
            ? new TextDecoder().decode(idDispositif)
            : undefined,
          idCompte: idCompte ? new TextDecoder().decode(idCompte) : undefined,
        });
      }
      await f(infos);
    };
    const oublier = appelerLorsque({
      émetteur: this.événements,
      événement: ÉVÉNEMENTS.IDENTIFICATION_COMPTE,
      f: fFinale,
    });
    await fFinale();
    return oublier;
  }

  async annoncerIdCompte() {
    const libp2p = await this.service("libp2p").libp2p();
    const pairsConnectés = libp2p.getPeers();

    // C'est pas grave si on n'arrive pas à passer le message à tout le monde
    await Promise.allSettled(
      pairsConnectés.map(
        async (p) =>
          await this.envoyerMesIdentifiants({ idPair: p.toString() }),
      ),
    );
  }

  async envoyerMesIdentifiants({ idPair }: { idPair: string }) {
    const orbite = this.service("orbite");
    const compte = this.service("compte");

    const idCompte = await compte.obtIdCompte();
    const idDispositif = await compte.obtIdDispositif();

    const identifiantsCompte: MessageIdentitéCompte = {
      type: IDENTITÉ_COMPTE,
      idCompte,
      idDispositif,
      signature: await orbite.signer({ message: idDispositif }),
    };

    await this.envoyerMessageAuPair({
      idPair,
      message: identifiantsCompte,
    });
  }

  // Suivi connexions

  @cacheSuivi
  async suivreConnexionsLibp2p({
    f,
  }: {
    f: Suivi<ConnexionLibp2p[]>;
  }): Promise<Oublier> {
    const libp2p = await this.service("libp2p").libp2p();

    const fFinale = async () => {
      const pairs = libp2p.getPeers();
      const connexions = libp2p.getConnections();

      const pairsEtConnexions: ConnexionLibp2p[] = pairs.map((p) => {
        const pair = p.toString();
        const connexionsAuPair = connexions.filter(
          (c) => c.remotePeer.toString() === pair && c.status !== "closed",
        );
        const adresses = connexionsAuPair.map((c) => c.remoteAddr.toString());
        const depuis = Math.min(
          ...connexionsAuPair.map((c) => c.timeline.open),
        );
        return { pair, adresses, depuis };
      });
      return await f(pairsEtConnexions);
    };

    const événements: (keyof Libp2pEvents)[] = [
      "peer:connect",
      "peer:disconnect",
      "peer:update",
    ];
    événements.map((é) => libp2p.addEventListener(é, fFinale));

    await fFinale();
    return async () => {
      événements.map((é) => libp2p.removeEventListener(é, fFinale));
    };
  }

  @cacheSuivi
  async suivreConnexionsDispositifs({
    f,
  }: {
    f: Suivi<ConnexionDispositif[]>;
  }): Promise<Oublier> {
    const libp2pÀDispositif = (
      connexionsLibp2p: ConnexionLibp2p[],
      infosPairs: {
        idCompte?: string;
        idDispositif?: string;
        idPair: string;
      }[],
    ): ConnexionDispositif[] => {
      const connexions: ConnexionDispositif[] = [];
      for (const connexionLibp2p of connexionsLibp2p) {
        const { idDispositif } =
          infosPairs.find(({ idPair }) => idPair === connexionLibp2p.pair) ||
          {};
        if (idDispositif)
          connexions.push({ idDispositif, pair: connexionLibp2p });
      }
      return connexions;
    };
    const info: {
      connexions?: ConnexionLibp2p[];
      infosPairs?: {
        idCompte?: string;
        idDispositif?: string;
        idPair: string;
      }[];
    } = {};
    const fFinale = async () => {
      const { infosPairs, connexions } = info;
      if (connexions && infosPairs)
        await f(libp2pÀDispositif(connexions, infosPairs));
    };
    const oublierIdDispositif = await this.suivreInfosPairs({
      f: async (infos) => {
        info.infosPairs = infos;
        await fFinale();
      },
    });
    const oublierConnexionsLibp2p = await this.suivreConnexionsLibp2p({
      f: async (connexions) => {
        info.connexions = connexions;
        await fFinale();
      },
    });
    return async () => {
      await Promise.allSettled([
        oublierIdDispositif(),
        oublierConnexionsLibp2p(),
      ]);
    };
  }

  @cacheSuivi
  async suivreConnexionsComptes({
    f,
  }: {
    f: Suivi<ConnexionCompte[]>;
  }): Promise<Oublier> {
    const infos: {
      connexionsDispositifs?: ConnexionDispositif[];
      pairs?: InfosPair[];
    } = {};
    const fFinale = async () => {
      const { connexionsDispositifs, pairs } = infos;

      const connexions: ConnexionCompte[] = [];
      if (connexionsDispositifs && pairs) {
        for (const connexionDispositif of connexionsDispositifs) {
          const { idCompte } =
            pairs.find(
              ({ idDispositif }) =>
                idDispositif === connexionDispositif.idDispositif,
            ) || {};
          if (idCompte) {
            let connexionCompte = connexions.find(
              (c) => c.idCompte === idCompte,
            );
            if (!connexionCompte) {
              connexionCompte = {
                idCompte,
                dispositifs: [],
              };
              connexions.push(connexionCompte);
            }
            connexionCompte.dispositifs.push(connexionDispositif);
          }
        }
      }
      await f(connexions);
    };

    const oublierConnexionsPairs = await this.suivreInfosPairs({
      f: async (pairs) => {
        infos.pairs = pairs;
        await fFinale();
      },
    });

    const oublierConnexionsDispositifs = await this.suivreConnexionsDispositifs(
      {
        f: async (connexions) => {
          infos.connexionsDispositifs = connexions;
          await fFinale();
        },
      },
    );

    return async () => {
      await Promise.allSettled([
        oublierConnexionsPairs(),
        oublierConnexionsDispositifs(),
      ]);
    };
  }

  @cacheSuivi
  async suivreDispositifsCompte({
    f,
    idCompte,
  }: {
    f: Suivi<DispositifCompte[]>;
    idCompte?: string;
  }): Promise<Oublier> {
    const compte = this.service("compte");
    const orbite = this.service("orbite");

    const info: {
      autorisés: string[];
      infos: InfosPair[];
      idCompte?: string;
    } = { autorisés: [], infos: [] };

    const monPair: InfosPair = {
      idPair: await compte.obtIdLibp2p(),
      idDispositif: await compte.obtIdDispositif(),
    };
    const oublierMonCompte = await compte.suivreIdCompte({
      f: async (idCompte) => {
        monPair.idCompte = idCompte;
        await fFinale();
      },
    });

    const fSuivi = async ({
      id,
      fSuivre,
    }: {
      id: string;
      fSuivre: Suivi<string[] | undefined>;
    }): Promise<Oublier> => {
      // Enlever les préfixes après avoir sauvegardé dans `info.idCompte`.
      info.idCompte = id;
      id = enleverPréfixes(id);

      // Suivre les dispositifs autorisés sur ce compte
      const { bd, oublier } = await orbite.ouvrirBd({
        id,
        signal: this.signaleurArrêt.signal,
      });
      const accès = bd.access;
      if (!estContrôleurNébuleuse(accès)) {
        await oublier();
        return faisRien;
      }
      const oublierAutorisés = await accès.suivreDispositifsAutorisées(
        async (a) => {
          await fSuivre(
            a.filter((u) => u.rôle === MODÉRATRICE).map((u) => u.idDispositif),
          );
        },
      );
      return async () => {
        await oublierAutorisés();
        await oublier();
      };
    };

    const fFinale = async () => {
      if (!info.idCompte) return;

      return await f(
        info.autorisés.map((idDispositif) => ({
          idDispositif,
          statut:
            info.infos.find((i) => i.idDispositif === idDispositif)
              ?.idCompte === info.idCompte
              ? "accepté"
              : "invité",
        })),
      );
    };

    const oublierDispositifsAutorisés = await suivreFonctionImbriquée({
      fRacine: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (nouvelIdBdCible?: string | undefined) => Promise<void>;
      }): Promise<Oublier> => {
        if (idCompte) {
          await fSuivreRacine(idCompte);
          return faisRien;
        } else {
          return await compte.suivreIdCompte({ f: fSuivreRacine });
        }
      },
      f: ignorerNonDéfinis(async (x: string[]) => {
        info.autorisés = x;
        return await fFinale();
      }),
      fSuivre: fSuivi,
    });

    const oublierInfosDispositifs = await this.suivreInfosPairs({
      f: async (x) => {
        info.infos = [...x, monPair];
        return await fFinale();
      },
    });

    return async () => {
      await Promise.allSettled([
        oublierMonCompte(),
        oublierDispositifsAutorisés(),
        oublierInfosDispositifs(),
      ]);
    };
  }

  @cacheRechercheParProfondeur
  async suivreComptes({
    f,
    profondeur: profonfeurInitiale,
  }: {
    f: Suivi<CompteRéseau[]>;
    profondeur?: number;
  }): Promise<RetourRechercheProfondeur> {
    const compte = this.service("compte");
    const info: {
      pairs: InfosPair[];
      comptes: CompteRéseau[];
      monCompte: string;
    } = { pairs: [], comptes: [], monCompte: await compte.obtIdCompte() };

    const fFinale = async () => {
      const comptes: CompteRéseau[] = [
        {
          idCompte: info.monCompte,
          profondeur: 0,
          confiance: 1,
        },
        ...info.pairs
          .map(({ idCompte }) => idCompte)
          .filter((idCompte): idCompte is string => !!idCompte)
          .map((idCompte) => ({
            idCompte,
            confiance: 0,
            profondeur: Infinity,
          })),
        ...info.comptes,
      ];
      await f(comptes);
    };

    const oublierMonCompte = await compte.suivreIdCompte({
      f: async (idCompte) => {
        info.monCompte = idCompte;
        await fFinale();
      },
    });

    const oublierInfoPairs = await this.suivreInfosPairs({
      f: async (pairs) => {
        info.pairs = pairs;
        await fFinale();
      },
    });

    const { profondeur, oublier: oublierComptesRéseau } =
      await this.suivreComptesRéseau({
        f: async (comptes) => {
          info.comptes = comptes;
          await fFinale();
        },
        profondeur: profonfeurInitiale,
      });

    return {
      profondeur,
      oublier: async () => {
        await Promise.allSettled([
          oublierInfoPairs(),
          oublierComptesRéseau(),
          oublierMonCompte(),
        ]);
      },
    };
  }

  // Gestion manuelle du réseau

  async faireConfianceAuCompte({
    idCompte,
  }: {
    idCompte: string;
  }): Promise<void> {
    await this.débloquerCompte({ idCompte });
    idCompte = enleverPréfixesEtOrbite(idCompte);

    const bdRéseau = await this.bd();
    await bdRéseau.set(enleverPréfixesEtOrbite(idCompte), FIABLE);
  }

  async nePlusFaireConfianceAuCompte({
    idCompte,
  }: {
    idCompte: string;
  }): Promise<void> {
    const bdRéseau = await this.bd();
    idCompte = enleverPréfixesEtOrbite(idCompte);
    if ((await bdRéseau.get(idCompte)) === FIABLE) await bdRéseau.del(idCompte);
  }

  async bloquerCompte({
    idCompte,
    privé = false,
  }: {
    idCompte: string;
    privé?: boolean;
  }): Promise<void> {
    const bdRéseau = await this.bd();
    idCompte = enleverPréfixesEtOrbite(idCompte);

    if (privé) {
      await this.débloquerCompte({ idCompte }); // Enlever du régistre publique s'il y est déjà
      this.bloquésPrivé.add(idCompte);
      await this.sauvegarderBloquésPrivé();
    } else {
      await bdRéseau.set(idCompte, BLOQUÉ);
    }
  }

  async débloquerCompte({ idCompte }: { idCompte: string }): Promise<void> {
    const bdRéseau = await this.bd();
    idCompte = enleverPréfixesEtOrbite(idCompte);

    if ((await bdRéseau.get(idCompte)) === BLOQUÉ) await bdRéseau.del(idCompte);

    if (this.bloquésPrivé.has(idCompte)) {
      this.bloquésPrivé.delete(idCompte);
      await this.sauvegarderBloquésPrivé();
    }
  }

  async effacerConfiances(): Promise<void> {
    const bdRéseau = await this.bd();
    const comptes = Object.keys(await bdRéseau.all());
    await Promise.all(comptes.map((c) => bdRéseau.del(c)));
  }

  private async sauvegarderBloquésPrivé() {
    const stockage = this.service("stockage");

    const bloqués = [...this.bloquésPrivé];

    await stockage.sauvegarderItem({
      clef: CLEF_COMPTES_BLOQUÉS,
      valeur: JSON.stringify(bloqués),
    });

    this.événements.emit(ÉVÉNEMENTS.BLOQUÉ_PRIVÉ, this.bloquésPrivé);
  }

  private async restaurerBloquésPrivé(): Promise<void> {
    const stockage = this.service("stockage");
    const journal = this.service("journal");

    const bloquésPrivéChaîne = await stockage.obtenirItem({
      clef: CLEF_COMPTES_BLOQUÉS,
    });

    if (bloquésPrivéChaîne) {
      try {
        JSON.parse(bloquésPrivéChaîne).forEach((b: string) =>
          this.bloquésPrivé.add(b),
        );
        this.événements.emit(ÉVÉNEMENTS.BLOQUÉ_PRIVÉ, this.bloquésPrivé);
      } catch (e) {
        // C'est pas si grave que ça
        journal.écrire({
          message:
            "Erreur restauration comptes bloqués privés : " + e.toString(),
        });
      }
    }
  }

  @cacheSuivi
  async suivreComptesFiables({
    f,
    idCompte,
  }: {
    f: Suivi<string[]>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreBd({
      idCompte,
      f: async (statuts) => {
        statuts ??= {};
        await f(
          Object.keys(statuts)
            .filter((id) => statuts[id] === FIABLE)
            .map((id) => ajouterPréfixes(id, "/nébuleuse/compte")),
        );
      },
    });
  }

  @cacheSuivi
  async suivreComptesBloqués({
    f,
    idCompte,
  }: {
    f: Suivi<CompteBloqué[]>;
    idCompte?: string;
  }): Promise<Oublier> {
    const compte = this.service("compte");

    const bloqués: { publiques: string[]; privés: string[] } = {
      publiques: [],
      privés: [],
    };

    const fFinale = async () => {
      // Si un compte est par erreur bloqué de manière privée et publique en même temps,
      // on va le montrer en tant que publique
      const privés = bloqués.privés.filter(
        (c) => !bloqués.publiques.includes(c),
      );
      return await f([
        ...privés.map((c) => ({ idCompte: c, privé: true })),
        ...bloqués.publiques.map((c) => ({ idCompte: c, privé: false })),
      ]);
    };

    const oublierPubliques = await this.suivreBd({
      idCompte,
      f: async (statuts) => {
        statuts ??= {};
        bloqués.publiques = Object.keys(statuts)
          .filter((id) => statuts[id] === BLOQUÉ)
          .map((id) => ajouterPréfixes(id, "/nébuleuse/compte"));
        await fFinale();
      },
    });

    const oublierPrivés = await suivreFonctionImbriquée({
      fRacine: async ({ fSuivreRacine }) =>
        await compte.suivreIdCompte({ f: fSuivreRacine }),
      fSuivre: async ({
        id,
        fSuivre,
      }: {
        id: string;
        fSuivre: Suivi<Set<string> | undefined>;
      }) => {
        if (!idCompte || idCompte === id) {
          const oublier = appelerLorsque({
            émetteur: this.événements,
            événement: ÉVÉNEMENTS.BLOQUÉ_PRIVÉ,
            f: fSuivre,
          });

          await fSuivre(this.bloquésPrivé);
          return oublier;
        } else {
          // Si le compte ne correspond pas à notre compte, on ne peut pas deviner
          // les comptes bloqués de manière privée
          await fSuivre(undefined);
          return faisRien;
        }
      },
      f: async (bloquésPrivé) => {
        bloqués.privés = Array.from(bloquésPrivé || []).map((id) =>
          ajouterPréfixes(id, "/nébuleuse/compte"),
        );
        await fFinale();
      },
    });

    return async () => {
      await oublierPubliques();
      await oublierPrivés();
    };
  }

  // Méthodes réseau ambiant

  @cacheRechercheParProfondeur
  async suivreComptesRéseau({
    f,
    profondeur,
    idCompte,
  }: {
    f: Suivi<CompteRéseau[]>;
    profondeur?: number;
    idCompte?: string;
  }): Promise<RetourRechercheProfondeur> {
    const résoudreConfiances = (confiances: number[]): number => {
      // Priorité au niveau de confiance spécifié explicitement
      if (confiances.includes(1)) return 1;
      if (confiances.includes(-1)) return -1;

      return combinerConfiances(confiances);
    };

    return await this.suivreRelationsRéseau({
      f: async (relations) => {
        const profondeurMax = Math.max(
          ...relations.map((r) => r.profondeur).filter((p) => p !== Infinity),
        );
        const comptes: {
          [id: string]: { confiances: number[]; profondeur: number };
        } = {};
        const ajouterConfiance = ({
          pour,
          confiance,
          profondeur,
        }: {
          pour: string;
          confiance: number;
          profondeur: number;
        }) => {
          if (comptes[pour]) {
            // On garde la profondeur moindre initiale
            comptes[pour].confiances.push(confiance);
          } else {
            comptes[pour] = {
              confiances: [confiance],
              profondeur,
            };
          }
        };

        for (let p = 0; p <= profondeurMax; p++) {
          const relationsP = relations.filter((r) => r.profondeur === p);
          for (const { pour, de, confiance, profondeur } of relationsP) {
            if (p === 0) {
              ajouterConfiance({ pour, confiance, profondeur });
            } else {
              const confianceCompteSource = résoudreConfiances(
                comptes[de].confiances,
              );

              // On ignore les relations des comptes auxquels nous ne faisons pas confiance
              if (confianceCompteSource > 0) {
                const confianceTransitive =
                  confianceCompteSource *
                  confiance *
                  (confiance > 0
                    ? FACTEUR_ATÉNUATION_CONFIANCE_POSITIVE
                    : FACTEUR_ATÉNUATION_CONFIANCE_NÉGATIVE);
                ajouterConfiance({
                  confiance: confianceTransitive,
                  pour,
                  profondeur,
                });
              }
            }
          }
        }

        const finaux = Object.entries(comptes).map(
          ([idCompte, { profondeur, confiances }]) => ({
            idCompte,
            profondeur: profondeur,
            confiance: résoudreConfiances(confiances),
          }),
        );

        return await f(finaux);
      },
      profondeur,
      idCompte,
    });
  }

  @cacheRechercheParProfondeur
  async suivreRelationsRéseau({
    f,
    profondeur,
    idCompte,
  }: {
    f: Suivi<RelationRéseau[]>;
    profondeur?: number;
    idCompte?: string;
  }): Promise<RetourRechercheProfondeur> {
    const suivreRelationsRéseauCompte = async ({
      f,
      profondeur,
      idCompte,
    }: {
      f: Suivi<RelationRéseau[]>;
      profondeur?: number;
      idCompte: string;
    }): Promise<RetourRechercheProfondeur> => {
      const contrôleurSignal = new AbortController();

      const relationsImmédiates: {
        [idCompte: string]: {
          relations: RelationImmédiate[];
          oublier?: Oublier;
        };
      } = {
        [idCompte]: {
          relations: [],
        },
      };

      const queue = new PQueue({ concurrency: 1 });

      const fFinale = async () => {
        const profondeurs = résoudreProfondeurs();
        const relations: RelationRéseau[] = Object.entries(relationsImmédiates)
          .map(([id, { relations }]) =>
            relations
              .filter((r) => r.idCompte !== id)
              .map((r) => ({
                de: id,
                pour: r.idCompte,
                confiance: r.confiance,
                profondeur: profondeurs[id],
              })),
          )
          .flat();
        await f(relations);
      };

      const résoudreProfondeurs = (): { [idCompte: string]: number } => {
        // Le compte initial a une profondeur de 0
        const profondeurs: { [idCompte: string]: number } = { [idCompte]: 0 };

        // Trouve la profondeur du parent immédiat d'un compte dans le réseau
        const profondeurParent = (id: string): number | undefined => {
          const parent = Object.keys(profondeurs).find((idAutre) =>
            relationsImmédiates[idAutre].relations.find(
              (r) => r.idCompte === id,
            ),
          );
          return parent ? profondeurs[parent] : undefined;
        };

        const àRésoudre = new Set(
          Object.keys(relationsImmédiates).filter(
            (id) => profondeurs[id] === undefined,
          ),
        );
        while (àRésoudre.size) {
          let progrès = false;
          for (const id of àRésoudre.values()) {
            const p = profondeurParent(id);
            if (p !== undefined) {
              progrès = true;
              profondeurs[id] = p + 1;
              àRésoudre.delete(id);
            }
          }
          if (!progrès) {
            // On ignore les relations éventuellement déconnectées du compte initial de la recherche
            break;
          }
        }
        return profondeurs;
      };

      const mettreÀJour = () => {
        const tâche = async () => {
          // Calculer profondeurs des comptes suivis
          const parProfondeur: { [idCompte: string]: number } =
            résoudreProfondeurs();
          const ceuxDontOnVeutSuivreLesRelations = Object.keys(
            parProfondeur,
            // `profondeur !== undefined` est déjà assuré par `cacheRechercheParProfondeur` mais on met ça ici pour les types TS
          ).filter((id) => parProfondeur[id] < (profondeur ?? Infinity) - 1);

          // Oublier les comptes trop profonds (en raison de déconnexion de lien de confiance ou bien de changement de profondeur)
          const ceuxDontOnVeutOublierLesRelations = Object.keys(
            relationsImmédiates,
          ).filter(
            (id) =>
              !ceuxDontOnVeutSuivreLesRelations.includes(id) && id !== idCompte,
          );
          await Promise.allSettled(
            ceuxDontOnVeutOublierLesRelations.map((id) =>
              relationsImmédiates[id].oublier?.(),
            ),
          );
          if (this.signaleurArrêt.signal.aborted) return;

          // Ajouter les nouveaux comptes à suivre
          const àSuivre = [
            ...new Set(
              ceuxDontOnVeutSuivreLesRelations
                .map((id) =>
                  relationsImmédiates[id].relations
                    .filter((r) => r.confiance >= 0)
                    .map((r) => r.idCompte),
                )
                .flat(),
            ),
          ].filter((id) => !relationsImmédiates[id]);

          await Promise.all(
            àSuivre.map(async (id) => {
              relationsImmédiates[id] = {
                relations: [],
              };
              const oublierSuivi = await this.suivreRelationsImmédiates({
                idCompte: id,
                f: async (relations) => {
                  relationsImmédiates[id].relations = relations;
                  mettreÀJour();
                  await fFinale();
                },
              });
              relationsImmédiates[id].oublier = async () => {
                delete relationsImmédiates[id];
                await oublierSuivi();
              };
            }),
          );
          await fFinale();
        };

        if (!contrôleurSignal.signal.aborted) queue.add(tâche);
      };

      const oublierRelationsInitiale = await this.suivreRelationsImmédiates({
        idCompte,
        f: async (relations) => {
          relationsImmédiates[idCompte].relations = relations;
          mettreÀJour();
          await fFinale();
        },
      });
      relationsImmédiates[idCompte].oublier = oublierRelationsInitiale;

      const oublier = async () => {
        contrôleurSignal.abort();
        queue.clear();
        if (queue.pending) await queue.onIdle();
        await Promise.allSettled(
          Object.values(relationsImmédiates).map((r) => r.oublier()),
        );
      };

      const changerProfondeur = async (p: number) => {
        vérifierProfondeur(p);
        if (profondeur !== p) {
          profondeur = p;
          mettreÀJour();
        }
      };

      return { oublier, profondeur: changerProfondeur };
    };

    if (idCompte)
      return await suivreRelationsRéseauCompte({ f, profondeur, idCompte });
    else {
      const compte = this.service("compte");
      const journal = this.service("journal");

      // Ici on a un peu de code manuel pour rendre `suivreFonctionImbriquée` compatible avec une fonction qui rend
      // `RetourRechercheProfondeur`.
      let _changerProfondeur:
        RetourRechercheProfondeur["profondeur"] | undefined = undefined;
      const changerProfondeur: RetourRechercheProfondeur["profondeur"] = async (
        p: number,
      ) => {
        if (_changerProfondeur) await _changerProfondeur(p);
        profondeur = p;
      };

      const oublierImbriquée = await suivreFonctionImbriquée({
        fRacine: async ({ fSuivreRacine }) =>
          await compte.suivreIdCompte({ f: fSuivreRacine }),
        fSuivre: async ({ id, fSuivre }) => {
          const retour = await suivreRelationsRéseauCompte({
            f: fSuivre,
            profondeur,
            idCompte: id,
          });
          _changerProfondeur = retour.profondeur;
          _changerProfondeur(profondeur ?? Infinity);
          return retour.oublier;
        },
        f: ignorerNonDéfinis(f),
        journal: journal.écrire.bind(journal),
      });

      return { oublier: oublierImbriquée, profondeur: changerProfondeur };
    }
  }

  @cacheSuivi
  async suivreRelationsImmédiates({
    f,
    idCompte,
  }: {
    f: Suivi<RelationImmédiate[]>;
    idCompte?: string;
  }): Promise<Oublier> {
    const compte = this.service("compte");
    const suivreRelationsCompte = async ({
      id,
      fSuivre,
    }: {
      id: string;
      fSuivre: Suivi<RelationImmédiate[]>;
    }): Promise<Oublier> => {
      const confiances: {
        bloqués?: string[];
        fiables?: string[];
        inférés: {
          [clef: string]: {
            idCompte: string;
            confiance: number;
          }[];
        };
      } = { inférés: {} };

      const fFinale = async () => {
        const relationsFiables = (confiances.fiables ?? []).map((c) => ({
          idCompte: c,
          confiance: 1,
        }));
        const relationsBloquées = (confiances.bloqués ?? []).map((c) => ({
          idCompte: c,
          confiance: -1,
        }));

        // On priorise les relations explicites
        const inférés = Object.values(confiances.inférés)
          .flat()
          .filter(
            (c) =>
              !confiances.fiables?.includes(c.idCompte) &&
              !confiances.bloqués?.includes(c.idCompte),
          );
        const comptesInférés = [...new Set(inférés.map((x) => x.idCompte))];
        const relationsInférées = comptesInférés.map((c) => {
          const confiancesComptes = inférés
            .filter((i) => i.idCompte === c)
            .map((i) => i.confiance);
          return {
            idCompte: c,
            confiance:
              1 - confiancesComptes.reduce((total, c) => (1 - c) * total, 1),
          };
        });

        return await fSuivre([
          ...relationsFiables,
          ...relationsInférées,
          ...relationsBloquées,
        ]);
      };

      const oublierConfiances: Oublier[] = [];
      for (const [clef, résolution] of this.résolutionsConfiance.entries()) {
        oublierConfiances.push(
          await résolution({
            de: id,
            f: async (x) => {
              confiances.inférés[clef] = x;
              await fFinale();
            },
          }),
        );
      }
      const oublierBloqués = await this.suivreComptesBloqués({
        idCompte,
        f: async (bloqués) => {
          confiances.bloqués = bloqués.map((b) => b.idCompte);
          await fFinale();
        },
      });
      const oublierFiables = await this.suivreComptesFiables({
        idCompte,
        f: async (fiables) => {
          confiances.fiables = fiables;
          await fFinale();
        },
      });

      return async () => {
        await oublierBloqués();
        await oublierFiables();
        await Promise.allSettled(oublierConfiances.map((f) => f()));
      };
    };

    return await suivreFonctionImbriquée({
      fRacine: async ({ fSuivreRacine }) => {
        if (idCompte) {
          await fSuivreRacine(idCompte);
          return faisRien;
        } else {
          return await compte.suivreIdCompte({ f: fSuivreRacine });
        }
      },
      fSuivre: suivreRelationsCompte,
      f: ignorerNonDéfinis(f),
    });
  }

  async suivreConfianceCompte({
    idCompte,
    f,
    idCompteDépart,
  }: {
    idCompte: string;
    f: Suivi<number | undefined>;
    idCompteDépart?: string;
  }): Promise<RetourRechercheProfondeur> {
    /*
    Note : Ne PAS envelopper cette fonction avec un `@cacheRechercheParProfondeur` !
    Elle retourne un nombre, pas une liste de résultats, et ça va bien sûr planter
    si on essaie de l'envelopper.
    */
    return await this.suivreComptesRéseau({
      f: async (comptes) =>
        await f(comptes.find((c) => c.idCompte === idCompte)?.confiance),
      idCompte: idCompteDépart,
    });
  }

  // Messages

  async obtFluxPair({
    idPair,
    signal,
  }: {
    idPair: string;
    signal?: AbortSignal;
  }): Promise<{ soujacent: Stream; flux: LengthPrefixedStream }> {
    const fluxExistant = this.flux.sortants.get(idPair);

    if (fluxExistant) {
      console.log(
        `✨ flux existant vers ${idPair} pour ${await this.service("compte").obtIdLibp2p()}`,
        fluxExistant?.soujacent.status,
        fluxExistant?.soujacent.readStatus,
        fluxExistant?.soujacent.writeStatus,
        fluxExistant?.soujacent.remoteReadStatus,
        fluxExistant?.soujacent.remoteWriteStatus,
      );
      return fluxExistant;
    } else {
      // console.log(`✨ nouveau flux vers ${idPair} pour ${await this.service("compte").obtIdLibp2p()}`)
      const libp2p = await this.service("libp2p").libp2p();
      const signalCombiné = anySignal([
        this.signaleurArrêt.signal,
        ...(signal ? [signal] : []),
      ]);

      try {
        const flux = await libp2p.dialProtocol(
          peerIdFromString(idPair),
          PROTOCOLE_NÉBULEUSE,
          { signal: signalCombiné },
        );
        const fluxPl = lpStream(flux);
        this.flux.sortants.set(idPair, { soujacent: flux, flux: fluxPl });
        flux.addEventListener("close", () => this.flux.sortants.delete(idPair));
        // flux.addEventListener("remoteCloseWrite", () => flux.close());

        return { soujacent: flux, flux: fluxPl };
      } finally {
        signalCombiné.clear();
      }
    }
  }

  async envoyerMessageAuPair({
    message,
    idPair,
    signal,
  }: {
    message: MessageRéseau;
    idPair: string;
    signal?: AbortSignal;
  }) {
    try {
      const { flux } = await this.obtFluxPair({ idPair, signal });
      const messageBinaire = new TextEncoder().encode(JSON.stringify(message));
      await flux.write(messageBinaire, { signal });
    } catch (e) {
      throw new Error(
        `Impossible de se connecter au pair ${idPair}.` + e.toString(),
        { cause: e },
      );
    }
  }

  async envoyerMessageAuDispositif({
    message,
    idDispositif,
    signal,
  }: {
    message: MessageRéseau;
    idDispositif: string;
    signal?: AbortSignal;
  }) {
    const idPair = await this.obtIdPairDispositif({ idDispositif });
    if (!idPair)
      throw new Error(`Le dispositif ${idDispositif} n'a pas été vu en ligne.`);
    return await this.envoyerMessageAuPair({ message, idPair, signal });
  }

  async envoyerMessageAuCompte({
    message,
    idCompte,
    signal,
  }: {
    message: MessageRéseau;
    idCompte: string;
    signal?: AbortSignal;
  }) {
    const compte = this.service("compte");
    const journal = this.service("journal");

    const idsDispositifs = await compte.obtDispositifsAutorisés({
      idCompte,
      signal,
    });

    if (!idsDispositifs.length)
      throw new Error(
        `Le compte ${idCompte} n'a pas été retrouvé sur le réseau.`,
      );

    const résultats = await Promise.allSettled(
      idsDispositifs.map((idDispositif) =>
        this.envoyerMessageAuDispositif({ idDispositif, message, signal }),
      ),
    );

    const échecs = résultats.filter((r) => r.status === "rejected");
    if (échecs.length)
      journal.écrire({
        message: `Le message n'a pas pu être délivré à tous les dispositifs du compte ${idCompte}. Détails: ${échecs.map((é) => é.reason)}`,
      });

    if (!résultats.some((r) => r.status === "fulfilled"))
      throw new Error(
        `Le message n'a pu être envoyé à aucun des dispositifs du compte ${idCompte}.`,
      );
  }

  async suivreMessages({
    f,
  }: {
    f: Suivi<MessageRéseauAvecExpéditeur>;
  }): Promise<Oublier> {
    this.événements.on(ÉVÉNEMENTS.MESSAGE_RÉSEAU, f);
    return async () => {
      this.événements.off(ÉVÉNEMENTS.MESSAGE_RÉSEAU, f);
    };
  }

  // Dispositifs

  async générerRequêteRejoindreCompte({
    signal,
  }: {
    signal?: AbortSignal;
  } = {}): Promise<RequêteRejoindreCompte> {
    const compte = this.service("compte");
    const idDispositif = await compte.obtIdDispositif();
    const requête: RequêteRejoindreCompte = {
      idDispositif,
      codeSecret: générerCodeSecret(),
    };

    const signalFinal = anySignal([
      this.signaleurArrêt.signal,
      ...(signal ? [signal] : []),
    ]);

    const oublierMessages = await this.suivreMessages({
      f: async ({ message }) => {
        if (message.type !== ACCEPTATION_REQUÊTE_REJOINDRE_COMPTE) return;
        const { empreinteCode, idCompte } = message;
        const empreinteRéférence = obtEmpreinteCode({
          codeSecret: requête.codeSecret,
          identifiant: idCompte,
        });

        if (empreinteCode === empreinteRéférence) {
          await oublierMessages();
          compte
            .rejoindreCompte({ idCompte, signal: signalFinal })
            .then(async () => await this.annoncerIdCompte())
            .catch((e) => {
              if (!estErreurAvortée(e)) throw e;
            })
            .finally(() => signalFinal.clear());
        }
      },
    });
    signalFinal.addEventListener("abort", () => oublierMessages());

    return requête;
  }

  async accepterRequêteRejoindreCompte({
    requête,
  }: {
    requête: RequêteRejoindreCompte;
  }): Promise<void> {
    const { idDispositif, codeSecret } = requête;

    const compte = this.service("compte");

    const idCompte = await compte.obtIdCompte();
    await compte.ajouterDispositif({ idDispositif });

    const message: MessageAcceptationRequêteRejoindreCompte = {
      type: ACCEPTATION_REQUÊTE_REJOINDRE_COMPTE,
      idCompte,
      empreinteCode: obtEmpreinteCode({ codeSecret, identifiant: idCompte }),
    };
    await this.envoyerMessageAuDispositif({ idDispositif, message });
  }

  async générerInvitationRejoindreCompte(): Promise<InvitationRejoindreCompte> {
    const compte = this.service("compte");

    const idCompte = await compte.obtIdCompte();
    const idPair = await compte.obtIdLibp2p();

    const invitation: InvitationRejoindreCompte = {
      idCompte,
      idPair,
      codeSecret: générerCodeSecret(),
    };

    const oublierMessages = await this.suivreMessages({
      f: async ({ message }) => {
        if (message.type !== ACCEPTATION_INVITATION_REJOINDRE_COMPTE) return;
        const { empreinteCode, idDispositif } = message;

        const empreinteRéférence = obtEmpreinteCode({
          codeSecret: invitation.codeSecret,
          identifiant: idDispositif,
        });

        if (empreinteCode === empreinteRéférence) {
          await compte.ajouterDispositif({ idDispositif });
          oublierMessages();
        }
      },
    });
    return invitation;
  }

  async rejoindreCompteParInvitation({
    invitation,
  }: {
    invitation: InvitationRejoindreCompte;
  }): Promise<void> {
    const compte = this.service("compte");
    const idDispositif = await compte.obtIdDispositif();

    const { idCompte, idPair, codeSecret } = invitation;

    const message: MessageAcceptationInvitationRejoindreCompte = {
      type: ACCEPTATION_INVITATION_REJOINDRE_COMPTE,
      idDispositif,
      empreinteCode: obtEmpreinteCode({
        codeSecret,
        identifiant: idDispositif,
      }),
    };
    await this.envoyerMessageAuPair({ idPair, message });

    await compte.rejoindreCompte({ idCompte });
    await this.annoncerIdCompte();
  }
}

export const serviceRéseau =
  () =>
  ({
    options,
    services,
  }: {
    options: OptionsAppli;
    services: ServicesNécessairesRéseau;
  }) =>
    new ServiceRéseau({ options, services });
