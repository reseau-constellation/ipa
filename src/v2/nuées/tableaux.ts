import {
  ignorerNonDéfinis,
  suivreDeFonctionListe,
  traduire,
} from "@constl/utils-ipa";
import { Tableaux } from "../tableaux.js";
import type {
  DonnéesRangéeTableau,
  DonnéesRangéeTableauAvecId,
} from "../bds/tableaux.js";
import type { TraducsTexte } from "../types.js";
import type { Suivi, Oublier } from "../crabe/types.js";
import type { ServicesConstellation } from "../constellation.js";
import type { FiltresBds, Héritage, Nuées, ValeurAscendance } from "./nuées.js";
import type { DifférenceTableaux, InfoColonne, InfoColonneAvecCatégorie } from "../tableaux.js";
import type { ServicesLibp2pCrabe } from "../crabe/services/libp2p/libp2p.js";
import type { RègleColonne } from "../règles.js";

// Types filtres

export type FiltresDonnées = {
  différencesTableaux?: DifférenceTableaux["type"][];
  erreursDonnées?: boolean;
}

// Types données et exportation

export type DonnéesRangéeTableauAvecIdEtContributrice = {
  données: DonnéesRangéeTableauAvecId;
  idBd: string;
};

export type DonnéesRangéeTableauAvecContributrice = {
  données: DonnéesRangéeTableau;
  idBd: string;
};

export type DonnéesTableauNuéeExportées = {
  nomTableau: string;
  données: DonnéesRangéeTableauAvecContributrice[];
  fichiersSFIP: Set<string>;
};

export class TableauxNuées<L extends ServicesLibp2pCrabe> extends Tableaux<L> {
  nuées: Nuées<L>;

  constructor({
    nuées,
    service,
  }: {
    nuées: Nuées<L>;
    service: <T extends keyof ServicesConstellation<L>>(
      service: T,
    ) => ServicesConstellation<L>[T];
  }) {
    super({ service });
    this.nuées = nuées;
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
    return await this.nuées.suivreDeParents<TraducsTexte>({
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
    return await this.nuées.suivreDeParents<InfoColonne[]>({
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

    return await this.nuées.suivreDeParents<RègleColonne[]>({
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
    filtresDonnées,
    clefsSelonVariables,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<DonnéesRangéeTableauAvecIdEtContributrice[]>;
    héritage?: Héritage;
    filtresBds?: FiltresBds;
    filtresDonnées?: FiltresDonnées;
    clefsSelonVariables?: boolean;
  }): Promise<Oublier> {
    const serviceBds = this.service("bds");

    return await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }: { fSuivreRacine: Suivi<string[]> }) =>
        await this.nuées.suivreBds({
          idNuée: idStructure,
          f: fSuivreRacine,
          héritage,
          filtres: filtresBds,
        }),
      fBranche: async ({
        id: idBd,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: Suivi<DonnéesRangéeTableauAvecIdEtContributrice[]>;
      }) =>
        await serviceBds.tableaux.suivreDonnées({
          idStructure: idBd,
          idTableau,
          f: async (données) =>
            await fSuivreBranche(données.map((d) => ({ idBd, données: d }))),
          clefsSelonVariables,
        }),
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
      données?: DonnéesRangéeTableauAvecIdEtContributrice[];
      traducs?: TraducsTexte;
    } = {};
    const fsOublier: Oublier[] = [];

    const fFinale = async () => {
      const { colonnes, données, nomsTableau, nomsVariables, traducs } = info;

      if (colonnes && données && (!langues || (nomsTableau && nomsVariables))) {
        const fichiersSFIP: Set<string> = new Set();

        let donnéesFormattées = await Promise.all(
          données.map((d) =>
            this.formaterÉlément({
              é: d.données,
              fichiersSFIP,
              colonnes,
              langues,
              traducs,
            }),
          ),
        );

        donnéesFormattées = donnéesFormattées.map((d) =>
          Object.keys(d).reduce(
            (acc: DonnéesRangéeTableau, idColonne: string) => {
              const idVar = colonnes.find((c) => c.id === idColonne)?.variable;
              if (!idVar)
                throw new Error(
                  `Colonne avec id ${idColonne} non trouvée parmis les colonnes :\n${JSON.stringify(
                    colonnes,
                    undefined,
                    2,
                  )}.`,
                );
              const nomVar =
                langues && nomsVariables?.[idVar]
                  ? traduire(nomsVariables[idVar], langues) || idColonne
                  : idColonne;
              acc[nomVar] = d[idColonne];
              return acc;
            },
            {},
          ),
        );

        const nomTableau =
          langues && nomsTableau
            ? traduire(nomsTableau, langues) || idTableau
            : idTableau;

        return await f({
          nomTableau,
          données: donnéesFormattées,
          fichiersSFIP,
        });
      }
    };

    const oublierTraducs = this.suivreTraducsValeurs({
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
