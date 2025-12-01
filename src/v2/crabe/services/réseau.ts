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
import { appelerLorsque } from "./utils.js";
import { TypedEmitter } from "tiny-typed-emitter";

// Types connexions

export type ConnexionLibp2p = { pair: string; adresses: string[] };

export type ConnexionDispositif = {
  idDispositif: string;
  adresses: string[];
};

export type ConnexionCompte = {
  idCompte: string;
  dispositifs;
};

// Constantes

const CLEF_COMPTES_BLOQUÉS = "comptes bloqués";

const FIABLE = "FIABLE";

const BLOQUÉ = "BLOQUÉ";

const ÉVÉNEMENT_BLOQUÉ_PRIVÉ = "changement bloqués privé";

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
  événements: TypedEmitter<{
    démarré: (args: { oublier: Oublier }) => void;
    [ÉVÉNEMENT_BLOQUÉ_PRIVÉ]: (bloqués: Set<string>) => void;
  }>;

  bloquésPrivé: Set<string>;

  constructor({
    nébuleuse,
  }: {
    nébuleuse: Nébuleuse<ServicesNécessairesRéseau<L>>;
  }) {
    super({
      clef: "réseau",
      nébuleuse,
      dépendances: ["compte", "hélia", "libp2p", "stockage", "journal"],
      options: {
        schéma: schémaRéseau,
      },
    });

    this.bloquésPrivé = new Set();
    this.événements = new TypedEmitter();
  }

  // Cycle de vie
  async démarrer(): Promise<unknown> {
    await this.restaurerBloquésPrivé();
    return await super.démarrer();
  }

  async fermer(): Promise<void> {
    return await super.fermer();
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
  async suivreConnexionsDispositifs({
    f,
  }: {
    f: Suivi<ConnexionDispositif[]>;
  }): Promise<Oublier> {}

  @cacheSuivi
  async suivreConnexionsComptes(): Promise<Oublier> {}

  @cacheSuivi
  async suivreDispositifsCompte({
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

    const oublierInfosDispositifs = await this.suivreConnexionsDispositifs({
      f: async (x) => {
        info.infos = x;
        return await fFinale();
      },
    });

    return async () => {
      await Promise.allSettled([
        oublierDispositifsAutorisés(),
        oublierInfosDispositifs(),
      ]);
    };
  }

  @cacheSuivi
  async suivreComptes({ f }: { f: Suivi<string[]> }): Promise<Oublier> {}

  @cacheSuivi
  async suivreConfiance({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: Suivi<number>;
  }): Promise<Oublier> {}


  // Comptes bloqués et de confiance

  async faireConfianceAuCompte({
    idCompte,
  }: {
    idCompte: string;
  }): Promise<void> {
    const bdRéseau = await this.bd();
    await bdRéseau.set(idCompte, FIABLE);
  }

  async neplusFaireConfianceAuCompte({
    idCompte,
  }: {
    idCompte: string;
  }): Promise<void> {
    const bdRéseau = await this.bd();
    if ((await bdRéseau.get(idCompte)) === FIABLE) await bdRéseau.del(idCompte);
  }

  async bloquerCompte({
    idCompte,
    privé = false,
  }: {
    idCompte: string;
    privé: boolean;
  }): Promise<void> {
    const bdRéseau = await this.bd();
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
    if ((await bdRéseau.get(idCompte)) === BLOQUÉ) await bdRéseau.del(idCompte);

    if (this.bloquésPrivé.has(idCompte)) {
      this.bloquésPrivé.delete(idCompte);
      await this.sauvegarderBloquésPrivé();
    }
  }

  private async sauvegarderBloquésPrivé() {
    const stockage = this.service("stockage");

    const bloqués = [...this.bloquésPrivé];

    await stockage.sauvegarderItem(
      CLEF_COMPTES_BLOQUÉS,
      JSON.stringify(bloqués),
    );

    this.événements.emit(ÉVÉNEMENT_BLOQUÉ_PRIVÉ, this.bloquésPrivé);
  }

  private async restaurerBloquésPrivé(): Promise<void> {
    const stockage = this.service("stockage");
    const journal = this.service("journal");

    const bloquésPrivéChaîne = await stockage.obtenirItem(CLEF_COMPTES_BLOQUÉS);

    if (bloquésPrivéChaîne) {
      try {
        JSON.parse(bloquésPrivéChaîne).forEach((b: string) =>
          this.bloquésPrivé.add(b),
        );
        this.événements.emit(ÉVÉNEMENT_BLOQUÉ_PRIVÉ, this.bloquésPrivé);
      } catch (e) {
        // C'est pas si grave que ça
        journal.écrire(
          "Erreur restauration comptes bloqués privés : " + e.toString(),
        );
      }
    }
  }

  @cacheSuivi
  async suivreComptesFiables({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    return await this.suivreBd({
      idCompte,
      f: async (statuts) => {
        statuts ??= {};
        await f(Object.keys(statuts).filter((id) => statuts[id] === FIABLE));
      },
    });
  }

  @cacheSuivi
  async suivreComtesBloqués({
    idCompte,
    f,
  }: {
    idCompte: string;
    f: Suivi<{ idCompte: string; privé?: boolean }[]>;
  }): Promise<Oublier> {
    const compte = this.service("compte");

    const bloqués: { publiques: string[]; privés: string[] } = {
      publiques: [],
      privés: [],
    };

    const fFinale = async () => {
      // Si un compte est par erreur bloqué de manière privée et publique en même temps, on va le montrer en tant que publique
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
        bloqués.publiques = Object.keys(statuts).filter(
          (id) => statuts[id] === BLOQUÉ,
        );
        await fFinale();
      },
    });

    const oublierPrivés = await suivreFonctionImbriquée({
      fRacine: async ({ fSuivreRacine }) =>
        await compte.suivreIdCompte({ f: fSuivreRacine }),
      fSuivre: async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: Suivi<Set<string> | undefined>;
      }) => {
        if (!idCompte || idCompte === id) {
          return appelerLorsque({
            émetteur: this.événements,
            événement: ÉVÉNEMENT_BLOQUÉ_PRIVÉ,
            f: fSuivreBd,
          });
        } else {
          // Si le compte ne correspond pas à notre compte, on ne peut pas deviner
          // les comptes bloqués de manière privée
          await fSuivreBd(undefined);
          return faisRien;
        }
      },
      f: async (bloquésPrivé) => {
        bloqués.privés = Array.from(bloquésPrivé || []);
        await fFinale();
      },
    });

    return async () => {
      await oublierPubliques();
      await oublierPrivés();
    };
  }

  // Confiance réseau


}
