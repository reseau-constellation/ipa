import {
  attendreStabilité,
  suivreFonctionImbriquée,
  suivreDeFonctionListe,
  faisRien,
  ignorerNonDéfinis,
  uneFois,
} from "@constl/utils-ipa";

import { Semaphore } from "@chriscdn/promise-semaphore";
import {
  type InfoColAvecCatégorie,
  différenceTableaux,
  élémentBdListeDonnées,
  élémentDonnées,
} from "@/tableaux.js";
import {
  TraducsTexte,
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaStatut,
  élémentsBd,
} from "@/types.js";

import { Constellation } from "@/client.js";
import type { JSONSchemaType } from "ajv";
import type { erreurValidation, règleColonne, règleExiste } from "@/valid.js";
import { cacheSuivi } from "@/décorateursCache.js";
import { ContrôleurConstellation as générerContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import { ComposanteClientListe } from "@/v2/nébuleuse/services.js";

export interface infoScore {
  accès?: number;
  couverture?: number;
  valide?: number;
  licence?: number;
  total: number;
}


export const schémaInfoTableau: JSONSchemaType<{ clef: string }> = {
  type: "object",
  properties: {
    clef: { type: "string" },
  },
  required: ["clef"],
};
export const schémaBdTableauxDeBd: JSONSchemaType<{
  [idTableau: string]: { clef: string };
}> = {
  type: "object",
  additionalProperties: schémaInfoTableau,
  required: [],
};

const schémaBdPrincipale: JSONSchemaType<string> = { type: "string" };
const schémaStructureBdNuées: JSONSchemaType<string> = { type: "string" };

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

export class BDs extends ComposanteClientListe<string> {
  verrouBdUnique: Semaphore;

  constructor({ client }: { client: Constellation }) {
    super({ client, clef: "bds", schémaBdPrincipale });
    this.verrouBdUnique = new Semaphore();
  }

  @cacheSuivi
  async suivreParent({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<{ id: string } | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idBd,
      f: async (bd) => {
        const copiéDe = await bd.get("copiéDe");
        await f(copiéDe);
      },
      type: "nested",
      schéma: schémaStructureBdBd,
    });
  }

  @cacheSuivi
  async rechercherBdsParMotsClefs({
    motsClefs,
    f,
    idCompte,
  }: {
    motsClefs: string[];
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreBds({ f: fSuivreRacine, idCompte });
    };

    const fCondition = async (
      id: string,
      fSuivreCondition: (état: boolean) => void,
    ): Promise<schémaFonctionOublier> => {
      const fFinaleSuivreCondition = (motsClefsBd: string[]) => {
        const état = motsClefs.every((m) => motsClefsBd.includes(m));
        fSuivreCondition(état);
      };
      return await this.suivreMotsClefsBd({
        idBd: id,
        f: fFinaleSuivreCondition,
      });
    };
    return await this.client.suivreBdsSelonCondition({ fListe, fCondition, f });
  }

  @cacheSuivi
  async rechercherBdsParNuée({
    idNuée,
    f,
    idCompte,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreBds({ f: fSuivreRacine, idCompte });
    };

    const fCondition = async (
      id: string,
      fSuivreCondition: (état: boolean) => void,
    ): Promise<schémaFonctionOublier> => {
      const fFinaleSuivreCondition = async (nuéesBd?: string[]) => {
        fSuivreCondition(!!nuéesBd && nuéesBd.includes(idNuée));
      };
      return await this.suivreNuéesBd({
        idBd: id,
        f: fFinaleSuivreCondition,
      });
    };
    return await this.client.suivreBdsSelonCondition({ fListe, fCondition, f });
  }

  @cacheSuivi
  async suivreClefTableauParId({
    idBd,
    idTableau,
    f,
  }: {
    idBd: string;
    idTableau: string;
    f: schémaFonctionSuivi<string | undefined>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (tableaux: infoTableauAvecId[]) => {
      const infoTableau = tableaux.find((t) => t.id === idTableau);
      await f(infoTableau?.clef);
    };
    return await this.suivreTableauxBd({ idBd, f: fFinale });
  }

  @cacheSuivi
  async suivreBdUnique({
    schéma,
    idNuéeUnique,
    f,
  }: {
    schéma: schémaSpécificationBd;
    idNuéeUnique: string;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    const clefStockageLocal = "bdUnique: " + idNuéeUnique;

    const déjàCombinées = new Set();

    const fFinale = async (bds: string[]): Promise<void> => {
      let idBd: string;

      await this.verrouBdUnique.acquire(idNuéeUnique);
      try {
        const idBdLocale = await this.client.obtDeStockageLocal({
          clef: clefStockageLocal,
        });

        switch (bds.length) {
          case 0: {
            if (idBdLocale) {
              idBd = idBdLocale;
            } else {
              idBd = await this.créerBdDeSchéma({ schéma });
              await this.client.sauvegarderAuStockageLocal({
                clef: clefStockageLocal,
                val: idBd,
              });
            }
            break;
          }
          case 1: {
            idBd = bds[0];
            await this.client.sauvegarderAuStockageLocal({
              clef: clefStockageLocal,
              val: idBd,
            });
            if (idBdLocale && idBd !== idBdLocale) {
              await this.combinerBds({ idBdBase: idBd, idBd2: idBdLocale });
              await this.effacerBd({ idBd: idBdLocale });
            }
            break;
          }
          default: {
            if (idBdLocale) bds = [...new Set([...bds, idBdLocale])];
            idBd = bds.sort()[0];
            await this.client.sauvegarderAuStockageLocal({
              clef: clefStockageLocal,
              val: idBd,
            });

            for (const bd of bds.slice(1)) {
              if (déjàCombinées.has(bd)) continue;

              déjàCombinées.add(bd);
              await this.combinerBds({ idBdBase: idBd, idBd2: bd });
              await this.effacerBd({ idBd: bd });
            }

            break;
          }
        }
      } finally {
        this.verrouBdUnique.release(idNuéeUnique);
      }
      await f(idBd);
    };

    const fOublier = await this.rechercherBdsParNuée({
      idNuée: idNuéeUnique,
      f: fFinale,
    });

    return fOublier;
  }

  @cacheSuivi
  async suivreIdTableauParClefDeBdUnique({
    schémaBd,
    idNuéeUnique,
    clefTableau,
    f,
  }: {
    schémaBd: schémaSpécificationBd;
    idNuéeUnique: string;
    clefTableau: string;
    f: schémaFonctionSuivi<string | undefined>;
  }): Promise<schémaFonctionOublier> {
    const fRacine = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (nouvelIdBdCible: string) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreBdUnique({
        schéma: schémaBd,
        idNuéeUnique,
        f: fSuivreRacine,
      });
    };

    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<string | undefined>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreIdTableauParClef({
        idBd: id,
        clef: clefTableau,
        f: fSuivreBd,
      });
    };
    return await suivreFonctionImbriquée<string>({
      fRacine,
      f,
      fSuivre,
    });
  }

  @cacheSuivi
  async suivreDonnéesDeTableauUnique<T extends élémentBdListeDonnées>({
    schémaBd,
    idNuéeUnique,
    clefTableau,
    f,
  }: {
    schémaBd: schémaSpécificationBd;
    idNuéeUnique: string;
    clefTableau: string;
    f: schémaFonctionSuivi<élémentDonnées<T>[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (données?: élémentDonnées<T>[]) => {
      return await f(données || []);
    };

    const fSuivreDonnéesDeTableau = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<élémentDonnées<T>[]>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux.suivreDonnées({
        idTableau: id,
        f: fSuivreBd,
      });
    };

    const fSuivreTableau = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: schémaFonctionSuivi<string>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreIdTableauParClefDeBdUnique({
        schémaBd,
        idNuéeUnique,
        clefTableau,
        f: async (idTableau?: string) => {
          if (idTableau) await fSuivreRacine(idTableau);
        },
      });
    };

    return await suivreFonctionImbriquée({
      fRacine: fSuivreTableau,
      f: fFinale,
      fSuivre: fSuivreDonnéesDeTableau,
    });
  }

  async ajouterÉlémentÀTableauUnique<T extends élémentBdListeDonnées>({
    schémaBd,
    idNuéeUnique,
    clefTableau,
    vals,
  }: {
    schémaBd: schémaSpécificationBd;
    idNuéeUnique: string;
    clefTableau: string;
    vals: T | T[];
  }): Promise<string[]> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClefDeBdUnique({
          schémaBd,
          idNuéeUnique,
          clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      },
    );
    return await this.client.tableaux.ajouterÉlément({
      idTableau: idTableau,
      vals,
    });
  }

  async modifierÉlémentDeTableauUnique({
    vals,
    schémaBd,
    idNuéeUnique,
    clefTableau,
    idÉlément,
  }: {
    vals: { [key: string]: élémentsBd | undefined };
    schémaBd: schémaSpécificationBd;
    idNuéeUnique: string;
    clefTableau: string;
    idÉlément: string;
  }): Promise<void> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClefDeBdUnique({
          schémaBd,
          idNuéeUnique,
          clefTableau,
          f: (id?: string) => {
            if (id) fSuivi(id);
          },
        });
      },
      (x) => !!x,
    );

    return await this.client.tableaux.modifierÉlément({
      idTableau: idTableau,
      vals,
      idÉlément,
    });
  }

  async effacerÉlémentDeTableauUnique({
    schémaBd,
    idNuéeUnique,
    clefTableau,
    idÉlément,
  }: {
    schémaBd: schémaSpécificationBd;
    idNuéeUnique: string;
    clefTableau: string;
    idÉlément: string;
  }): Promise<void> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClefDeBdUnique({
          schémaBd,
          idNuéeUnique,
          clefTableau,
          f: (id?: string) => {
            if (id) fSuivi(id);
          },
        });
      },
      (x) => !!x,
    );

    return await this.client.tableaux.effacerÉlément({
      idTableau: idTableau,
      idÉlément,
    });
  }

  @cacheSuivi
  async suivreDonnéesDeTableauParClef<T extends élémentBdListeDonnées>({
    idBd,
    clefTableau,
    f,
  }: {
    idBd: string;
    clefTableau: string;
    f: schémaFonctionSuivi<élémentDonnées<T>[]>;
  }): Promise<schémaFonctionOublier> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClef({
          idBd,
          clef: clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      },
      (x) => !!x,
    );
    return await this.client.tableaux.suivreDonnées({
      idTableau,
      f,
    });
  }

  async ajouterÉlémentÀTableauParClef<T extends élémentBdListeDonnées>({
    idBd,
    clefTableau,
    vals,
  }: {
    idBd: string;
    clefTableau: string;
    vals: T | T[];
  }): Promise<string[]> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClef({
          idBd,
          clef: clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      },
    );
    return await this.client.tableaux.ajouterÉlément({
      idTableau,
      vals,
    });
  }

  async modifierÉlémentDeTableauParClef({
    idBd,
    clefTableau,
    idÉlément,
    vals,
  }: {
    idBd: string;
    clefTableau: string;
    idÉlément: string;
    vals: { [key: string]: élémentsBd | undefined };
  }): Promise<void> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClef({
          idBd,
          clef: clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      },
    );
    return await this.client.tableaux.modifierÉlément({
      idTableau,
      vals,
      idÉlément,
    });
  }

  async effacerÉlémentDeTableauParClef({
    idBd,
    clefTableau,
    idÉlément,
  }: {
    idBd: string;
    clefTableau: string;
    idÉlément: string;
  }): Promise<void> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClef({
          idBd,
          clef: clefTableau,
          f: ignorerNonDéfinis(fSuivi),
        });
      },
    );
    this.client.tableaux.effacerÉlément({
      idTableau,
      idÉlément,
    });
  }

  @cacheSuivi
  async suivreNomsTableau({
    idBd,
    idTableau,
    f,
  }: {
    idBd: string;
    idTableau: string;
    f: schémaFonctionSuivi<TraducsTexte>;
  }): Promise<schémaFonctionOublier> {
    const noms: {
      deTableau: TraducsTexte;
      deNuées: TraducsTexte[];
    } = {
      deNuées: [],
      deTableau: {},
    };
    const fFinale = async () =>
      await f(Object.assign({}, ...noms.deNuées, noms.deTableau));
    const fOublierTableau = await this.client.tableaux.suivreNomsTableau({
      idTableau,
      f: async (nomsTableau) => {
        noms.deTableau = nomsTableau;
        await fFinale();
      },
    });

    const fOublierNuée = await suivreFonctionImbriquée({
      fRacine: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: schémaFonctionSuivi<string | undefined>;
      }) => {
        return await this.suivreClefTableauParId({
          idBd,
          idTableau,
          f: fSuivreRacine,
        });
      },
      fSuivre: async ({
        id: clefTableau,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<TraducsTexte[]>;
      }) => {
        return await suivreDeFonctionListe({
          fListe: async ({
            fSuivreRacine,
          }: {
            fSuivreRacine: schémaFonctionSuivi<string[]>;
          }) => {
            return await this.suivreNuéesBd({
              idBd,
              f: fSuivreRacine,
            });
          },
          fBranche: async ({
            id: idNuée,
            fSuivreBranche,
          }: {
            id: string;
            fSuivreBranche: schémaFonctionSuivi<TraducsTexte>;
          }) => {
            return await this.client.nuées.suivreNomsTableauNuée({
              idNuée,
              clefTableau,
              f: fSuivreBranche,
            });
          },
          f: fSuivreBd,
        });
      },
      f: async (deNuées?: TraducsTexte[]) => {
        noms.deNuées = deNuées || [];
        return await fFinale();
      },
    });

    return async () => {
      await Promise.allSettled([fOublierTableau(), fOublierNuée()]);
    };
  }

  @cacheSuivi
  async suivreScoreAccèsBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<number | undefined>;
  }): Promise<schémaFonctionOublier> {
    // À faire
    f(Number.parseInt(idBd));
    return faisRien;
  }

  @cacheSuivi
  async suivreScoreCouvertureBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<number | undefined>;
  }): Promise<schémaFonctionOublier> {
    type scoreTableau = { numérateur: number; dénominateur: number };

    const fFinale = async (branches: scoreTableau[]) => {
      const numérateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.numérateur,
        0,
      );
      const dénominateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.dénominateur,
        0,
      );
      await f(dénominateur === 0 ? undefined : numérateur / dénominateur);
    };

    const fBranche = async ({
      id: idTableau,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<scoreTableau>;
    }): Promise<schémaFonctionOublier> => {
      const info: { cols?: InfoColAvecCatégorie[]; règles?: règleColonne[] } =
        {};

      const fFinaleBranche = async () => {
        const { cols, règles } = info;

        if (cols !== undefined && règles !== undefined) {
          const colsÉligibles = cols.filter(
            (c) =>
              c.catégorie &&
              ["numérique", "catégorique"].includes(c.catégorie.catégorie),
          );

          const dénominateur = colsÉligibles.length;
          const numérateur = colsÉligibles.filter((c) =>
            règles.some(
              (r) => r.règle.règle.type !== "catégorie" && r.colonne === c.id,
            ),
          ).length;
          await fSuivreBranche({ numérateur, dénominateur });
        }
      };

      const fOublierCols =
        await this.client.tableaux.suivreColonnesEtCatégoriesTableau({
          idTableau,
          f: async (cols) => {
            info.cols = cols;
            await fFinaleBranche();
          },
        });

      const fOublierRègles = await this.client.tableaux.suivreRègles({
        idTableau,
        f: async (règles) => {
          info.règles = règles;
          await fFinaleBranche();
        },
      });

      return async () => {
        await fOublierCols();
        await fOublierRègles();
      };
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({
        idBd,
        f: (tableaux) => fSuivreRacine(tableaux.map((x) => x.id)),
      });
    };

    return await suivreDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  @cacheSuivi
  async suivreScoreValideBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<number | undefined>;
  }): Promise<schémaFonctionOublier> {
    type scoreTableau = { numérateur: number; dénominateur: number };

    const fFinale = async (branches: scoreTableau[]) => {
      const numérateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.numérateur,
        0,
      );
      const dénominateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.dénominateur,
        0,
      );
      await f(dénominateur === 0 ? undefined : numérateur / dénominateur);
    };

    const fBranche = async ({
      id: idTableau,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<scoreTableau>;
    }): Promise<schémaFonctionOublier> => {
      const info: {
        données?: élémentDonnées<élémentBdListeDonnées>[];
        cols?: InfoColAvecCatégorie[];
        erreurs?: erreurValidation[];
      } = {};

      const fFinaleBranche = () => {
        const { données, erreurs, cols } = info;
        if (
          données !== undefined &&
          erreurs !== undefined &&
          cols !== undefined
        ) {
          const colsÉligibles = cols.filter(
            (c) =>
              c.catégorie &&
              ["numérique", "catégorique"].includes(c.catégorie.catégorie),
          );

          const déjàVus: { id: string; idColonne: string }[] = [];
          const nCellulesÉrronnées = erreurs
            .map((e) => {
              return {
                id: e.id,
                idColonne: e.erreur.règle.colonne,
              };
            })
            .filter((x) => {
              const déjàVu = déjàVus.find(
                (y) => y.id === x.id && y.idColonne === x.idColonne,
              );
              if (déjàVu) {
                return false;
              } else {
                déjàVus.push(x);
                return true;
              }
            }).length;

          const dénominateur = données
            .map(
              (d) =>
                colsÉligibles.filter((c) => d.données[c.id] !== undefined)
                  .length,
            )
            .reduce((a, b) => a + b, 0);

          const numérateur = dénominateur - nCellulesÉrronnées;

          fSuivreBranche({ numérateur, dénominateur });
        }
      };

      const fOublierDonnées = await this.client.tableaux.suivreDonnées({
        idTableau,
        f: (données) => {
          info.données = données;
          fFinaleBranche();
        },
      });

      const fOublierErreurs = await this.client.tableaux.suivreValidDonnées({
        idTableau,
        f: (erreurs) => {
          info.erreurs = erreurs;
          fFinaleBranche();
        },
      });

      const fOublierColonnes =
        await this.client.tableaux.suivreColonnesEtCatégoriesTableau({
          idTableau,
          f: (cols) => {
            info.cols = cols;
            fFinaleBranche();
          },
        });

      return async () => {
        await fOublierDonnées();
        await fOublierErreurs();
        await fOublierColonnes();
      };
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({
        idBd,
        f: (tableaux) => fSuivreRacine(tableaux.map((t) => t.id)),
      });
    };

    return await suivreDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  @cacheSuivi
  async suivreQualitéBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<infoScore>;
  }): Promise<schémaFonctionOublier> {
    const info: {
      accès?: number;
      couverture?: number;
      valide?: number;
      licence?: number;
    } = {};

    const fFinale = async () => {
      const { accès, couverture, valide, licence } = info;
      const score: infoScore = {
        // Score impitoyable de 0 pour BDs sans licence
        total: licence
          ? ((accès || 0) + (couverture || 0) + (valide || 0)) / 3
          : 0,
        accès,
        couverture,
        valide,
        licence,
      };
      await f(score);
    };

    const oublierAccès = await this.suivreScoreAccèsBd({
      idBd,
      f: async (accès) => {
        info.accès = accès;
        await fFinale();
      },
    });
    const oublierCouverture = await this.suivreScoreCouvertureBd({
      idBd,
      f: async (couverture) => {
        info.couverture = couverture;
        await fFinale();
      },
    });
    const oublierValide = await this.suivreScoreValideBd({
      idBd,
      f: async (valide) => {
        info.valide = valide;
        await fFinale();
      },
    });

    const oublierLicence = await this.suivreLicenceBd({
      idBd,
      f: async (licence) => {
        info.licence = licence ? 1 : 0;
        await fFinale();
      },
    });
    return async () => {
      await Promise.allSettled([
        oublierAccès,
        oublierCouverture,
        oublierValide,
        oublierLicence,
      ]);
    };
  }
}
