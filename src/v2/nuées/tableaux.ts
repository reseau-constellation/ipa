import {
  faisRien,
  ignorerNonDéfinis,
  suivreDeFonctionListe,
  traduire,
} from "@constl/utils-ipa";
import { Tableaux } from "../tableaux.js";
import type { AccesseurService } from "../recherche/types.js";
import type { DonnéesRangéeTableauAvecId } from "../bds/tableaux.js";
import type { PartielRécursif, TraducsTexte } from "../types.js";
import type { Suivi, Oublier } from "../nébuleuse/types.js";
import type { FiltresBds, Héritage, Nuées, ValeurAscendance } from "./nuées.js";
import type {
  DifférenceTableaux,
  InfoColonne,
  InfoColonneAvecCatégorie,
  ServicesNécessairesTableaux,
} from "../tableaux.js";
import type { FonctionValidation, RègleColonne } from "../règles.js";
import type { Bds } from "../bds/bds.js";

// Types filtres

export type FiltresDonnées = {
  exclureAvecDifférencesTableaux?: DifférenceTableaux["type"][];
  exclureAvecErreursDonnées?: boolean;
};

// Types données et exportation

export type DonnéesRangéeNuée = {
  idBd: string;
  données: DonnéesRangéeTableauAvecId;
};

export type DonnéesTableauNuéeExportées = {
  nomTableau: string;
  données: DonnéesRangéeNuée[];
  documentsMédias: Set<string>;
};

export type ServicesNécessairesTableauxNuées = ServicesNécessairesTableaux & {
  bds: Bds;
  nuées: Nuées;
};

export class TableauxNuées extends Tableaux {
  service: AccesseurService<ServicesNécessairesTableauxNuées>;

  constructor({
    service,
  }: {
    service: AccesseurService<ServicesNécessairesTableauxNuées>;
  }) {
    super({ service });
    this.service = service;
  }

  // Noms

  async suivreNoms({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<TraducsTexte>;
  }): Promise<Oublier> {
    return await this.service("nuées").suivreDeParents<TraducsTexte>({
      idNuée: idStructure,
      f: async (noms) =>
        await f(Object.assign({}, ...noms.map(({ val }) => val))),
      fParents: async ({ idNuée, f }) =>
        await super.suivreNoms({
          idStructure: idNuée,
          idTableau,
          f: ignorerNonDéfinis(f),
        }),
    });
  }

  // Colonnes

  async suivreSourceColonnes({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<ValeurAscendance<InfoColonne[]>[]>;
  }): Promise<Oublier> {
    return await this.service("nuées").suivreDeParents<InfoColonne[]>({
      idNuée: idStructure,
      f,
      fParents: async ({ idNuée, f }) =>
        await super.suivreColonnes({
          idStructure: idNuée,
          idTableau,
          f: ignorerNonDéfinis(f),
        }),
    });
  }

  async suivreColonnes({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<InfoColonne[] | undefined>;
  }): Promise<Oublier> {
    return await this.suivreSourceColonnes({
      idStructure,
      idTableau,
      f: async (colonnes) => await f(colonnes.map((c) => c.val).flat()),
    });
  }

  // Règles

  async suivreRègles({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<RègleColonne[]>;
  }): Promise<Oublier> {
    const enleverDupliquées = (règles: RègleColonne[]): RègleColonne[] => {
      // Nécessaire pour dédupliquer les règles provonenant des variables,
      // lesquelles seront présentes sur chacune des nuées ascendantes.
      const déjàVues = new Set<string>();

      return règles.filter((r) => {
        if (déjàVues.has(r.règle.id)) return false;
        déjàVues.add(r.règle.id);
        return true;
      });
    };

    return await this.service("nuées").suivreDeParents<RègleColonne[]>({
      idNuée: idStructure,
      f: async (règles) => {
        await f(enleverDupliquées(règles.map((r) => r.val).flat()));
      },
      fParents: async ({ idNuée, f }) =>
        await super.suivreRègles({
          idStructure: idNuée,
          idTableau,
          f,
        }),
    });
  }

  // Données

  async suivreDonnées({
    idStructure,
    idTableau,
    f,
    héritage,
    filtresBds,
    filtresDonnées = { exclureAvecDifférencesTableaux: ["variableColonne"] },
    clefsSelonVariables,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<DonnéesRangéeNuée[]>;
    héritage?: Héritage;
    filtresBds?: FiltresBds;
    filtresDonnées?: FiltresDonnées;
    clefsSelonVariables?: boolean;
  }): Promise<Oublier> {
    const bds = this.service("bds");

    const suivreBds = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: Suivi<string[]>;
    }) =>
      await suivreDeFonctionListe({
        fListe: async ({ fSuivreRacine }) =>
          await this.service("nuées").suivreBds({
            idNuée: idStructure,
            f: fSuivreRacine,
            héritage,
            filtres: filtresBds,
          }),
        fBranche: async ({ id: idBd, fSuivreBranche }) => {
          if (filtresDonnées?.exclureAvecDifférencesTableaux) {
            return await this.suivreDifférencesAvecTableau({
              tableau: {
                idStructure: idBd,
                idTableau,
              },
              tableauRéf: {
                idStructure,
                idTableau,
              },
              f: async (différences) => {
                if (
                  différences.some((d) =>
                    filtresDonnées.exclureAvecDifférencesTableaux?.includes(
                      d.type,
                    ),
                  )
                )
                  await fSuivreBranche(undefined);
                else await fSuivreBranche(idBd);
              },
            });
          } else {
            await fSuivreBranche(idBd);
            return faisRien;
          }
        },
        f: fSuivreRacine,
      });

    return await suivreDeFonctionListe({
      fListe: suivreBds,
      fBranche: async ({
        id: idBd,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: Suivi<DonnéesRangéeNuée[]>;
      }) => {
        const info: {
          données?: DonnéesRangéeNuée[];
          règles?: FonctionValidation[];
        } = {};

        const fFinale = async () => {
          const { données, règles } = info;
          if (données) {
            if (filtresDonnées.exclureAvecErreursDonnées && règles) {
              const idsDonnéesErronnées = règles
                .map((r) => r(données.map((d) => d.données)))
                .flat()
                .map((e) => e.id);
              return await fSuivreBranche(
                données.filter(
                  (d) => !idsDonnéesErronnées.includes(d.données.id),
                ),
              );
            } else {
              return await fSuivreBranche(données);
            }
          }
        };

        if (filtresDonnées?.exclureAvecErreursDonnées) {
          await this.suivreValidateursDonnées({
            idStructure,
            idTableau,
            f: async (règles) => {
              info.règles = règles;
              await fFinale();
            },
            résolveurDonnéesCatégorie: bds.tableaux.suivreDonnées.bind(
              bds.tableaux,
            ),
          });
        }

        const oublierDonnées = await bds.tableaux.suivreDonnées({
          idStructure: idBd,
          idTableau,
          f: async (données) => {
            info.données = données.map((d) => ({ idBd, données: d }));
            await fFinale();
          },
          clefsSelonVariables,
        });
        return async () => {
          await oublierDonnées();
        };
      },
      f,
    });
  }

  // Exportation

  async suivreDonnéesExportation({
    idStructure,
    idTableau,
    langues,
    f,
    héritage,
    filtresBds,
    filtresDonnées,
  }: {
    idStructure: string;
    idTableau: string;
    langues?: string[];
    f: Suivi<DonnéesTableauNuéeExportées>;
    héritage?: Héritage;
    filtresBds?: FiltresBds;
    filtresDonnées?: FiltresDonnées;
  }): Promise<Oublier> {
    const variables = this.service("variables");

    const info: {
      nomsTableau?: { [clef: string]: string };
      nomsVariables?: { [idVar: string]: TraducsTexte };
      colonnes?: InfoColonneAvecCatégorie[];
      données?: DonnéesRangéeNuée[];
      traducs?: { [clef: string]: PartielRécursif<TraducsTexte> };
    } = {};
    const fsOublier: Oublier[] = [];

    const fFinale = async () => {
      const { colonnes, données, nomsTableau, nomsVariables, traducs } = info;

      if (colonnes && données && (!langues || (nomsTableau && nomsVariables))) {
        const nomsColonnes: { [idColonne: string]: string } =
          Object.fromEntries(
            colonnes?.map((c) => {
              const nomVar =
                langues && c.variable && nomsVariables?.[c.variable]
                  ? traduire(nomsVariables[c.variable], langues) || c.id
                  : c.id;
              return [c, nomVar];
            }),
          );
        const documentsMédias: Set<string> = new Set();

        const donnéesFormattées: DonnéesRangéeNuée[] = await Promise.all(
          données.map(async ({ idBd, données: { données, id } }) => {
            const donnéesFormattées = await this.formaterÉlément({
              élément: données,
              documentsMédias,
              colonnes,
              langues,
              traducs,
            });
            return {
              idBd,
              données: {
                id,
                données: Object.fromEntries(
                  Object.entries(donnéesFormattées).map(([idCol, données]) => [
                    nomsColonnes[idCol] || this.modifierIdColonne,
                    données,
                  ]),
                ),
              },
            };
          }),
        );

        const nomTableau =
          langues && nomsTableau
            ? traduire(nomsTableau, langues) || idTableau
            : idTableau;

        return await f({
          nomTableau,
          données: donnéesFormattées,
          documentsMédias,
        });
      }
    };

    const oublierTraducs = await this.suivreTraductionsValeurs({
      idStructure,
      idTableau,
      f: async (traducs) => {
        info.traducs = traducs;
        await fFinale();
      },
    });
    fsOublier.push(oublierTraducs);

    if (langues) {
      const oublierNomsTableaux = await this.suivreNoms({
        idStructure,
        idTableau,
        f: async (noms) => {
          info.nomsTableau = noms;
          await fFinale();
        },
      });
      fsOublier.push(oublierNomsTableaux);

      const oublierNomsVariables = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }) =>
          this.suivreVariables({ idStructure, idTableau, f: fSuivreRacine }),
        f: async (noms: { idVar: string; noms: TraducsTexte }[]) => {
          info.nomsVariables = Object.fromEntries(
            noms.map((n) => [n.idVar, n.noms]),
          );
          await fFinale();
        },
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: Suivi<{
            idVar: string;
            noms?: TraducsTexte;
          }>;
        }): Promise<Oublier> => {
          return await variables.suivreNoms({
            idVariable: id,
            f: async (noms) => await fSuivreBranche({ idVar: id, noms }),
          });
        },
      });
      fsOublier.push(oublierNomsVariables);
    }

    const oublierColonnes = await this.suivreCatégoriesColonnes({
      idStructure,
      idTableau,
      f: async (cols) => {
        info.colonnes = cols;
        await fFinale();
      },
    });
    fsOublier.push(oublierColonnes);

    const oublierDonnées = await this.suivreDonnées({
      idStructure,
      idTableau,
      héritage,
      filtresBds,
      filtresDonnées,
      f: async (données) => {
        info.données = données;
        await fFinale();
      },
    });
    fsOublier.push(oublierDonnées);

    return async () => {
      Promise.allSettled(fsOublier.map((f) => f()));
    };
  }
}
