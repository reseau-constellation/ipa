import {
  faisRien,
  ignorerNonDéfinis,
  suivreDeFonctionListe,
  suivreFonctionImbriquée,
} from "@constl/utils-ipa";
import { TypedEmitter } from "tiny-typed-emitter";
import { cacheRechercheParProfondeur, cacheSuivi } from "../cache.js";
import { ServiceDonnéesNébuleuse } from "./services.js";
import { MODÉRATRICE, estContrôleurNébuleuse } from "./compte/accès/index.js";
import { appelerLorsque } from "./utils.js";
import {
  FACTEUR_ATÉNUATION_CONFIANCE_NÉGATIVE,
  FACTEUR_ATÉNUATION_CONFIANCE_POSITIVE,
} from "./consts.js";
import type { Libp2pEvents } from "@libp2p/interface";
import type { JSONSchemaType } from "ajv";
import type { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import type { PartielRécursif } from "@/v2/types.js";
import type { Oublier, RetourRechercheProfondeur, Suivi } from "../types.js";
import type { ServicesLibp2pCrabe } from "./libp2p/libp2p.js";
import type { ServicesNécessairesCompte } from "./compte/compte.js";

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

// Types relations

export type RelationRéseau = {
  de: string;
  pour: string;
  confiance: number;
  profondeur: number;
};

export type RelationImmédiate = { idCompte: string; confiance: number }

// Constantes

const CLEF_COMPTES_BLOQUÉS = "comptes bloqués";

const FIABLE = "FIABLE";

const BLOQUÉ = "BLOQUÉ";

const ÉVÉNEMENT_BLOQUÉ_PRIVÉ = "changement bloqués privé";

// Types structure

export type StructureRéseau = {
  [idCompte: string]: typeof FIABLE | typeof BLOQUÉ;
};

export const schémaRéseau: JSONSchemaType<PartielRécursif<StructureRéseau>> & {
  nullable: true;
} = {
  type: "object",
  nullable: true,
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

  résolutionsConfiance: Map<
    string,
    (args: {
      de: string;
      f: Suivi<RelationImmédiate[]>;
    }) => Promise<Oublier>
  >;

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
    this.résolutionsConfiance = new Map();
  }

  // Cycle de vie

  async démarrer(): Promise<unknown> {
    await this.restaurerBloquésPrivé();
    return await super.démarrer();
  }

  async fermer(): Promise<void> {
    return await super.fermer();
  }

  async inscrireRésolutionConfiance({
    clef,
    résolution,
  }: {
    clef: string;
    résolution: (args: {
      de: string;
      f: Suivi<RelationImmédiate[]>;
    }) => Promise<Oublier>;
  }) {
    this.résolutionsConfiance.set(clef, résolution);
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
  async suivreConnexionsComptes({ f }: { f: Suivi<ConnexionCompte[]> }): Promise<Oublier> {}

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
      fSuivre,
    }: {
      id: string;
      fSuivre: Suivi<string[] | undefined>;
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

  // Gestion manuelle du réseau

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
        await f(Object.keys(statuts).filter((id) => statuts[id] === FIABLE));
      },
    });
  }

  @cacheSuivi
  async suivreComptesBloqués({
    f,
    idCompte,
  }: {
    f: Suivi<{ idCompte: string; privé?: boolean }[]>;
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
        fSuivre,
      }: {
        id: string;
        fSuivre: Suivi<Set<string> | undefined>;
      }) => {
        if (!idCompte || idCompte === id) {
          return appelerLorsque({
            émetteur: this.événements,
            événement: ÉVÉNEMENT_BLOQUÉ_PRIVÉ,
            f: fSuivre,
          });
        } else {
          // Si le compte ne correspond pas à notre compte, on ne peut pas deviner
          // les comptes bloqués de manière privée
          await fSuivre(undefined);
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

  // Méthodes réseau ambiant

  @cacheRechercheParProfondeur
  async suivreComptesParProfondeur({
    f,
    profondeur,
    idCompte,
  }: {
    f: Suivi<{ idCompte: string; confiance: number; profondeur: number }[]>;
    profondeur?: number;
    idCompte?: string;
  }): Promise<RetourRechercheProfondeur> {
    const résoudreConfiances = (confiances: number[]): number => {
      // Priorité au niveau de confiance spécifié explicitement
      if (confiances[0] === 1 || confiances[1] === -1) return confiances[0];

      const positives = confiances.filter((c) => c >= 0);
      const négatives = confiances.filter((c) => c < 0);
      const négatif =
        1 - négatives.map((x) => 1 + x).reduce((total, c) => c * total, 1);
      const positif =
        1 - positives.map((x) => 1 - x).reduce((total, c) => c * total, 1);

      return positif - négatif;
    };

    return await this.suivreRelationsRéseau({
      f: async (relations) => {
        const profondeurMax = Math.max(...relations.map((r) => r.profondeur));
        const comptes: {
          [id: string]: { confiances: number[]; profondeur: number };
        } = {};
        for (let p = 1; p <= profondeurMax; p++) {
          const relationsP = relations.filter((r) => r.profondeur === p);
          for (const { pour, de, confiance, profondeur } of relationsP) {
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
              if (comptes[pour]) {
                comptes[pour].confiances.push(confianceTransitive);
              } else {
                comptes[pour] = {
                  confiances: [confianceTransitive],
                  profondeur,
                };
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
    
    const serviceCompte = this.service("compte");

    const événements = new TypedEmitter<{ profondeur: (p: number) => void }>();

    const déjàSuivis: {[idCompteSource: string]: string[] } = {}
    const nonDupliquées = (idCompteSource: string, relations: RelationImmédiate[] ): RelationImmédiate[] => {
      déjàSuivis[idCompteSource] = relations
      
      return existe
    }

    const oublier = await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: Suivi<RelationImmédiate[]>;
      }) => {
        return await this.suivreRelationsImmédiates({
          idCompte,
          f: async relations => await fSuivreRacine(relations.filter(nonDupliquée)),
        })
      },
      fBranche: async ({
        id: idCompteBranche,
        fSuivreBranche,
        branche,
      }: {
        id: string;
        fSuivreBranche: Suivi<RelationRéseau[]>;
        branche: {
          idCompte: string;
          confiance: number;
        };
      }) => {
        const relation: RelationRéseau = {
          de: await serviceCompte.obtIdCompte(),
          pour: idCompteBranche,
          confiance: branche.confiance,
          profondeur: 0, // `f` ci-dessous ajoute `1` à chaque profondeur
        };

        // Si le compte n'est pas de confiance, on arrête ici (on ne suit pas ses relations)
        if (branche.confiance < 0) return faisRien;

        let retourSuiviBranche: RetourRechercheProfondeur | undefined = undefined;

        const lancerSuiviRelationsBranche = async (p: number) => {
          if (!retourSuiviBranche) {
            retourSuiviBranche = await this.suivreRelationsRéseau({
              idCompte: idCompteBranche,
              f: async (relations) =>
                await fSuivreBranche([relation, ...relations]),
              profondeur: p - 1,
            });
          } else {
            retourSuiviBranche.profondeur(p)
          }
        }

        const annulerSuiviRelationsBranche = async () => {
          await retourSuiviBranche?.oublier();
          retourSuiviBranche = undefined;
        }

        const changerProfondeurBranche = async (p: number) => {
          if (p > 1) {
            await lancerSuiviRelationsBranche(p)
          } else {
            await annulerSuiviRelationsBranche()
            
            // Si la profondeur est de 1, on va uniquement rendre la relation présente
            await fSuivreBranche([relation]);
          }
        }

          // `profondeur !== undefined` est éjà assuré par `cacheRechercheParProfondeur` mais on met ça ici pour les types TS
        await changerProfondeurBranche(profondeur ?? Infinity)

        const oublierÉcouterProfondeur = appelerLorsque({
          émetteur: événements,
          événement: "profondeur",
          f: async p => await changerProfondeurBranche(p - 1)
        });

        const oublierBranche = async () => {
          await oublierÉcouterProfondeur();
          await retourSuiviBranche?.oublier();
        }

        return oublierBranche;
      },
      fIdDeBranche: (x) => x.idCompte,
      f: async (relations: RelationRéseau[]) => {
        return await f(
          relations.map((r) => ({ ...r, profondeur: r.profondeur + 1 })),
        );
      },
    });

    const changerProfondeur = async (p: number) => {
      if (p !== profondeur) {
        profondeur = p;
        événements.emit("profondeur", p);
      }
    };
    return { oublier, profondeur: changerProfondeur };
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
        await Promise.all(oublierConfiances.map((f) => f()));
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

  @cacheSuivi
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
    return await this.suivreComptesParProfondeur({
      f: async (comptes) =>
        await f(
          comptes.find((c) => c.idCompte === idCompte)?.confiance,
        ),
      idCompte: idCompteDépart,
    });
  }

  // Dispositifs

  async demanderEtPuisRejoindreCompte({ idCompte }): Promise<void> {}

  async inviterÀRejoidreCompte({});
}
