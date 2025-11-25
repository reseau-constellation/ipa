import {
  faisRien,
  ignorerNonDéfinis,
  suivreFonctionImbriquée,
} from "@constl/utils-ipa";
import { cacheSuivi } from "../cache.js";
import { ServiceDonnéesNébuleuse } from "./services.js";
import { MODÉRATRICE, estContrôleurNébuleuse } from "./compte/accès/index.js";
import type { Libp2pEvents } from "@libp2p/interface";
import type { JSONSchemaType } from "ajv";
import type { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import type { PartielRécursif } from "@/v2/types.js";
import type { Oublier, Suivi } from "../types.js";
import type { ServicesLibp2pCrabe } from "./libp2p/libp2p.js";
import type { ServicesNécessairesCompte } from "./compte/compte.js";

// Types connexions
export type ConnexionLibp2p = { pair: string; adresses: string[] };

// Types structure

export type StructureRéseau = {
  [idCompte: string]: string;
};

export const schémaRéseau: JSONSchemaType<PartielRécursif<StructureRéseau>> = {
  type: "object",
};

export type ServicesNécessairesRéseau<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> = ServicesNécessairesCompte<L> & { réseau: ServiceRéseau<L> };

export class ServiceRéseau<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> extends ServiceDonnéesNébuleuse<"réseau", StructureRéseau, L> {
  constructor({
    nébuleuse,
  }: {
    nébuleuse: Nébuleuse<ServicesNécessairesRéseau<L>>;
  }) {
    super({
      clef: "réseau",
      nébuleuse,
      dépendances: ["compte", "hélia", "libp2p"],
      options: {
        schéma: schémaRéseau,
      },
    });
  }

  // Cycle de vie
  async démarrer(): Promise<unknown> {
    return await super.démarrer();
  }

  async fermer(): Promise<void> {
    return await super.fermer();
  }

  // Méthodes publiques

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

      const pairsEtConnexions = pairs.map((p) => {
        const pair = p.toString();
        const adresses = connexions
          .filter(
            (c) => c.remotePeer.toString() === pair && c.status !== "closed",
          )
          .map((a) => a.remoteAddr.toString());
        return { pair, adresses };
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
  async suivreConnexionsDispositifs(): Promise<Oublier> {}

  @cacheSuivi
  async suivreConnexionsComptes(): Promise<Oublier> {}

  @cacheSuivi
  async suivreDispositifs({
    f,
    idCompte,
  }: {
    f: Suivi<{ idDispositif: string; statut: "invité" | "accepté" }[]>;
    idCompte?: string;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    const info: {
      autorisés: string[];
      infos: statutDispositif[];
      idCompte?: string;
    } = { autorisés: [], infos: [] };

    const fSuivi = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: Suivi<string[] | undefined>;
    }): Promise<Oublier> => {
      info.idCompte = id;

      // Suivre les dispositifs autorisés sur ce compte
      const { bd, oublier } = await orbite.ouvrirBd({
        id,
        type: "keyvalue",
      });
      const accès = bd.access;
      if (!estContrôleurNébuleuse(accès)) {
        await oublier();
        return faisRien;
      }
      const oublierAutorisés = await accès.suivreDispositifsAutorisées(
        async (a) => {
          await fSuivreBd(
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
            info.infos
              .map((i) => i.infoDispositif)
              .find((i) => i.idDispositif === idDispositif)?.idCompte ===
            info.idCompte
              ? "accepté"
              : "invité",
        })),
      );
    };

    const compte = this.service("compte");
    const fOublierDispositifsAutorisés = await suivreFonctionImbriquée({
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

    const fOublierInfosDispositifs = await this.suivreConnexionsDispositifs({
      f: async (x) => {
        info.infos = x;
        return await fFinale();
      },
    });

    return async () => {
      await Promise.allSettled([
        fOublierDispositifsAutorisés(),
        fOublierInfosDispositifs(),
      ]);
    };
  }

  @cacheSuivi
  async suivreComptes(): Promise<Oublier> {}

  @cacheSuivi
  async suivreConfiance(): Promise<Oublier> {}
}
