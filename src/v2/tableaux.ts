import { v4 as uuidv4 } from "uuid";
import {
  adresseOrbiteValide,
  faisRien,
  idcValide,
  suivreDeFonctionListe,
  traduire,
} from "@constl/utils-ipa";
import { asSplitKey, joinKey } from "@orbitdb/nested-db";
import { cacheSuivi } from "./crabe/cache.js";
import { brancheBd } from "./crabe/services/services.js";
import { mapÀObjet } from "./crabe/utils.js";
import {
  générerFonctionValidation,
  schémaSpécificationRègleColonne,
} from "./règles.js";
import { typer } from "./crabe/services/orbite/orbite.js";
import { schémaTraducsTexte } from "./schémas.js";
import type { DonnéesRangéeTableauAvecId } from "./bds/tableaux.js";
import type { DagCborEncodable } from "@orbitdb/core";
import type { TypedNested } from "@constl/bohr-db";
import type { JSONSchemaType } from "ajv";
import type { NestedValueObject } from "node_modules/@orbitdb/nested-db/dist/types.js";
import type { ServicesConstellation } from "./constellation.js";
import type { Oublier, Suivi } from "./crabe/types.js";
import type { PartielRécursif, TraducsTexte } from "./types.js";
import type { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import type {
  DétailsRègleBornesDynamiqueColonne,
  DétailsRègleBornesDynamiqueVariable,
  DétailsRègleValeurCatégoriqueDynamique,
  ErreurRègle,
  ErreurRègleBornesColonneInexistante,
  ErreurRègleBornesVariableNonPrésente,
  ErreurRègleCatégoriqueColonneInexistante,
  RègleBornes,
  RègleColonne,
  RègleValeurCatégorique,
  RègleVariable,
  RègleVariableAvecId,
  ErreurColonne,
  ErreurColonneVariableDédoublée,
  SpécificationRègleColonne,
  FonctionValidation,
} from "./règles.js";
import type {
  CatégorieBaseVariables,
  CatégorieVariables,
} from "./variables.js";

// Types éléments

export type DonnéesRangéeTableau = {
  [key: string]: DagCborEncodable;
};

// Types scores

export type ScoreCouvertureTableau = {
  numérateur: number;
  dénominateur: number;
};

// Types tableaux

export type StructureTableau = {
  noms: TraducsTexte;
  colonnes: { [id: string]: Omit<InfoColonne, "id"> };
  données: string;
  règles: {
    [idRègle: string]: SpécificationRègleColonne;
  };
  traducs: { [clef: string]: TraducsTexte };
};

export const schémaTableau: JSONSchemaType<
  PartielRécursif<StructureTableau>
> & { nullable: true } = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    noms: schémaTraducsTexte,
    colonnes: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          id: { type: "string", nullable: true },
          variable: {
            type: "string",
            nullable: true,
          },
          index: {
            type: "boolean",
            nullable: true,
          },
        },
        nullable: true,
        required: [],
      },
      nullable: true,
      required: [],
    },
    données: {
      type: "string",
      nullable: true,
    },
    règles: {
      type: "object",
      additionalProperties: schémaSpécificationRègleColonne,
      nullable: true,
    },
    traducs: {
      type: "object",
      additionalProperties: schémaTraducsTexte,
      nullable: true,
    },
  },
  required: [],
  nullable: true,
};

type StructureAvecTableau = { tableaux: { [clef: string]: StructureTableau } };
const schémaStructureAvecTableau: JSONSchemaType<
  PartielRécursif<StructureAvecTableau>
> = {
  type: "object",
  properties: {
    tableaux: {
      type: "object",
      additionalProperties: schémaTableau,
      nullable: true,
    },
    nullable: true,
  },
};

// Types colonnes

export type InfoColonne = {
  id: string;
  variable?: string;
  index?: boolean;
};

export type InfoColonneAvecCatégorie = InfoColonne & {
  catégorie?: CatégorieVariables;
};

// Types comparaisons tableaux

export type DifférenceTableaux =
  | DifférenceVariableColonne
  | DifférenceIndexColonne
  | DifférenceColonneManquante
  | DifférenceColonneSupplémentaire;

export type DifférenceVariableColonne = {
  type: "variableColonne";
  sévère: true;
  idColonne: string;
  varColTableau?: string;
  varColTableauRéf?: string;
};
export type DifférenceIndexColonne = {
  type: "indexColonne";
  sévère: true;
  idColonne: string;
  colTableauIndexée: boolean;
};
export type DifférenceColonneManquante = {
  type: "colonneManquante";
  sévère: true;
  idColonneManquante: string;
};
export type DifférenceColonneSupplémentaire = {
  type: "colonneSupplémentaire";
  sévère: false;
  idColonneSupplémentaire: string;
};

// Tableaux

export class Tableaux<L extends ServicesLibp2pCrabe> {
  service: <T extends keyof ServicesConstellation<L>>(
    service: T,
  ) => ServicesConstellation<L>[T];

  constructor({
    service,
  }: {
    service: <T extends keyof ServicesConstellation<L>>(
      service: T,
    ) => ServicesConstellation<L>[T];
  }) {
    this.service = service;
  }

  async créerTableau({
    idStructure,
    idTableau,
  }: {
    idStructure: string;
    idTableau: string;
  }): Promise<string> {
    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    // On ajoute un élément vide pour ajouter la clef du tableau à la liste de tableaux
    await tableau.set({});

    await oublier();
    return idTableau;
  }

  async copierTableau({
    idStructure,
    idTableau,
    idStructureDestinataire,
  }: {
    idStructure: string;
    idTableau: string;
    idStructureDestinataire?: string;
  }): Promise<string> {
    idStructureDestinataire ??= idStructure;

    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    const idNouveauTableau = await this.créerTableau({
      idStructure: idStructureDestinataire,
      idTableau: uuidv4(),
    });

    const { tableau: nouveauTableau, oublier: oublierNouveauTableau } =
      await this.ouvrirTableau({
        idStructure: idStructureDestinataire,
        idTableau: idNouveauTableau,
      });

    // Copier les noms
    const noms = mapÀObjet(await tableau.get("noms"));
    if (noms)
      await this.sauvegarderNoms({
        idStructure: idStructureDestinataire,
        idTableau: idNouveauTableau,
        noms,
      });

    // Copier les colonnes
    const colonnes = mapÀObjet(await tableau.get("colonnes"));
    if (colonnes) {
      await nouveauTableau.set("colonnes", colonnes);
    }

    // Copier les règles
    const règles = mapÀObjet(await tableau.get("règles"));
    if (règles) {
      await nouveauTableau.set("règles", règles);
    }

    await oublier();
    await oublierNouveauTableau();

    return idNouveauTableau;
  }

  async effacerTableau({
    idStructure,
    idTableau,
  }: {
    idStructure: string;
    idTableau: string;
  }): Promise<void> {
    const orbite = this.service("orbite");

    // Effacer la référence au tableau
    const { bd, oublier: oublierBd } = await orbite.ouvrirBd({
      id: idStructure,
      type: "nested",
    });
    const bdTypée = typer({
      bd,
      schéma: schémaStructureAvecTableau,
    }) as TypedNested<StructureAvecTableau>;
    await bdTypée.del(`tableaux/${idTableau}`);

    await oublierBd();
  }

  async ouvrirTableau({
    idStructure,
    idTableau,
  }: {
    idStructure: string;
    idTableau: string;
  }): Promise<{ tableau: TypedNested<StructureTableau>; oublier: Oublier }> {
    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: idStructure,
      type: "nested",
    });

    const bdTypée = typer({
      bd,
      schéma: schémaStructureAvecTableau,
    }) as TypedNested<StructureAvecTableau>;

    const tableau = brancheBd<
      StructureAvecTableau,
      `tableaux/${typeof idTableau}`
    >({
      bd: bdTypée,
      clef: `tableaux/${idTableau}`,
    });

    return {
      tableau,
      oublier,
    };
  }

  async suivreTableau({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<StructureTableau>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    return await orbite.suivreDonnéesBd({
      id: idStructure,
      type: "nested",
      schéma: schémaStructureAvecTableau,
      f: async (tableau) => {
        let données: NestedValueObject | null | undefined = mapÀObjet(tableau);

        for (const k of asSplitKey(joinKey(["tableaux", idTableau]))) {
          données = données?.[k] as NestedValueObject | undefined;
          if (données === undefined) {
            données = null;
            break;
          }
        }
        await f(données as StructureTableau);
      },
    });
  }

  // Accèss

  async confirmerPermission({
    idStructure,
  }: {
    idStructure: string;
  }): Promise<void> {
    const compte = this.service("compte");
    if (!compte.permission({ idObjet: idStructure }))
      throw new Error(
        `Permission de modification refusée pour un tableau au ${idStructure}.`,
      );
  }

  // Noms
  async sauvegarderNoms({
    idStructure,
    idTableau,
    noms,
  }: {
    idStructure: string;
    idTableau: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idStructure });
    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    for (const lng in noms) {
      await tableau.set(`noms/${lng}`, noms[lng]);
    }

    await oublier();
  }

  async sauvegarderNom({
    idStructure,
    idTableau,
    langue,
    nom,
  }: {
    idStructure: string;
    idTableau: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    await this.confirmerPermission({ idStructure });
    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    await tableau.set(`noms/${langue}`, nom);
    await oublier();
  }

  async effacerNom({
    idStructure,
    idTableau,
    langue,
  }: {
    idStructure: string;
    idTableau: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idStructure });
    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });
    await tableau.del(`noms/${langue}`);

    await oublier();
  }

  @cacheSuivi
  async suivreNoms({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<TraducsTexte | undefined>;
  }): Promise<Oublier> {
    return await this.suivreTableau({
      idStructure,
      idTableau,
      f: (tableau) => f(tableau.noms),
    });
  }

  // Colonnes

  async ajouterColonne({
    idStructure,
    idTableau,
    idVariable,
    idColonne,
    index,
  }: {
    idStructure: string;
    idTableau: string;
    idVariable?: string;
    idColonne?: string;
    index?: boolean;
  }): Promise<string> {
    await this.confirmerPermission({ idStructure });

    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    idColonne = idColonne || uuidv4();
    const élément = {
      variable: idVariable,
      index,
    };
    await tableau.put(`colonnes/${idColonne}`, élément);

    await oublier();
    return idColonne;
  }

  async effacerColonne({
    idStructure,
    idTableau,
    idColonne,
  }: {
    idStructure: string;
    idTableau: string;
    idColonne: string;
  }): Promise<void> {
    await this.confirmerPermission({ idStructure });

    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    await tableau.del(`colonnes/${idColonne}`);

    await oublier();
  }

  async modifierVariableColonne({
    idStructure,
    idTableau,
    idColonne,
    idVariable,
  }: {
    idStructure: string;
    idTableau: string;
    idColonne: string;
    idVariable?: string;
  }): Promise<void> {
    await this.confirmerPermission({ idStructure });

    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    await tableau.put(`colonnes/${idColonne}`, { variable: idVariable });

    await oublier();
  }

  async modifierIndexColonne({
    idStructure,
    idTableau,
    idColonne,
    index,
  }: {
    idStructure: string;
    idTableau: string;
    idColonne: string;
    index: boolean;
  }): Promise<void> {
    await this.confirmerPermission({ idStructure });

    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    await tableau.put(`colonnes/${idColonne}`, { index });

    await oublier();
  }

  async modifierIdColonne({
    idStructure,
    idTableau,
    idColonne,
    nouvelId,
  }: {
    idStructure: string;
    idTableau: string;
    idColonne: string;
    nouvelId: string;
  }): Promise<void> {
    await this.confirmerPermission({ idStructure });

    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    const infoColonne = mapÀObjet(await tableau.get(`colonnes/${idColonne}`));
    if (infoColonne) {
      await tableau.put(`colonnes/${nouvelId}`, infoColonne);
      await tableau.del(`colonnes/${idColonne}`);
    }

    await oublier();
  }

  async réordonnerColonne({
    idStructure,
    idTableau,
    idColonne,
    position,
  }: {
    idStructure: string;
    idTableau: string;
    idColonne: string;
    position: number;
  }): Promise<void> {
    await this.confirmerPermission({ idStructure });
    throw new Error(
      `Impossible de réordonner colonne ${idColonne} de tableau ${idTableau} à position ${position} : fonctionnalité pas encore implémentée.`,
    );

    /*const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });
    await tableau.move(`colonnes/${idColonne}`, position)

    await oublier();*/
  }

  @cacheSuivi
  async suivreColonnes({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<InfoColonne[] | undefined>;
  }): Promise<Oublier> {
    return await this.suivreTableau({
      idStructure,
      idTableau,
      f: async (tableau) => {
        const colonnes = tableau.colonnes;
        if (colonnes)
          await f(
            Object.entries(colonnes).map(([id, info]) => ({
              id,
              ...info,
            })),
          );
        else await f(undefined);
      },
    });
  }

  @cacheSuivi
  async suivreInfoColonne({
    idStructure,
    idTableau,
    idColonne,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    idColonne: string;
    f: Suivi<InfoColonne | null>;
  }): Promise<Oublier> {
    return await this.suivreColonnes({
      idStructure,
      idTableau,
      f: async (cols) => {
        return await f(cols?.find((c) => c.id === idColonne) || null);
      },
    });
  }

  @cacheSuivi
  async suivreCatégoriesColonnes({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<InfoColonneAvecCatégorie[]>;
  }): Promise<Oublier> {
    const variables = this.service("variables");

    const fBranche = async ({
      fSuivreBranche,
      branche,
    }: {
      fSuivreBranche: Suivi<InfoColonneAvecCatégorie>;
      branche: InfoColonne;
    }): Promise<Oublier> => {
      const idVariable = branche.variable;
      if (!idVariable) return faisRien;

      return await variables.suivreCatégorie({
        idVariable,
        f: async (catégorie) => {
          const col = Object.assign(
            { catégorie, variable: idVariable },
            branche,
          );
          await fSuivreBranche(col);
        },
      });
    };
    const fIdDeBranche = (x: InfoColonne) => x.id;

    return await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }) =>
        await this.suivreColonnes({
          idStructure,
          idTableau,
          f: async (colonnes) => {
            return await fSuivreRacine(colonnes || []);
          },
        }),
      fBranche,
      fIdDeBranche,
      f,
    });
  }

  // Variables

  @cacheSuivi
  async suivreVariables({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    return await this.suivreTableau({
      idStructure,
      idTableau,
      f: async (tableau) => {
        await f(
          Object.values(tableau.colonnes || [])
            .map((c) => c.variable)
            .filter((v): v is string => !!v && adresseOrbiteValide(v)),
        );
      },
    });
  }

  // Règles

  async ajouterRègle<R extends RègleVariable = RègleVariable>({
    idStructure,
    idTableau,
    idColonne,
    règle,
  }: {
    idStructure: string;
    idTableau: string;
    idColonne: string;
    règle: R;
  }): Promise<string> {
    await this.confirmerPermission({ idStructure });

    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    const id = uuidv4();

    const élément: SpécificationRègleColonne = {
      règle: règle,
      colonne: idColonne,
    };
    await tableau.put(`règles/${id}`, élément);

    await oublier();

    return id;
  }

  async modifierRègle({
    idStructure,
    idTableau,
    idRègle,
    règleModifiée,
  }: {
    idStructure: string;
    idTableau: string;
    idRègle: string;
    règleModifiée: RègleVariable;
  }): Promise<void> {
    await this.confirmerPermission({ idStructure });

    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    await tableau.put(`règles/${idRègle}/règle`, règleModifiée);

    await oublier();
  }

  async effacerRègle({
    idStructure,
    idTableau,
    idRègle,
  }: {
    idStructure: string;
    idTableau: string;
    idRègle: string;
  }): Promise<void> {
    await this.confirmerPermission({ idStructure });

    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    await tableau.del(`règles/${idRègle}`);

    await oublier();
  }

  @cacheSuivi
  async suivreRègles({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<RègleColonne[]>;
  }): Promise<Oublier> {
    const dicRègles: {
      tableau?: RègleColonne[];
      variable?: RègleColonne[];
      index?: RègleColonne[];
    } = {};
    const fFinale = async () => {
      if (!dicRègles.tableau || !dicRègles.variable) return;
      return await f([...dicRègles.tableau, ...dicRègles.variable]);
    };

    // Suivre règles index unique
    const oublierColonnes = await this.suivreColonnes({
      idStructure,
      idTableau,
      f: (colonnes) => {
        const colonnesIndex = (colonnes || []).filter((c) => c.index);
        dicRègles.index = colonnesIndex.map((c) => ({
          règle: {
            id: uuidv4(),
            règle: {
              type: "indexUnique",
            },
          },
          source: { type: "tableau", idStructure, idTableau },
          colonne: c.id,
        }));
      },
    });

    // Suivre les règles spécifiées dans le tableau
    const oublierRèglesTableau = await this.suivreTableau({
      idStructure,
      idTableau,
      f: async (tableau) => {
        const règlesTableau: RègleColonne[] = Object.entries(
          tableau.règles,
        ).map(([id, règle]) => ({
          règle: { id, règle: règle.règle },
          source: { type: "tableau", idStructure, idTableau },
          colonne: règle.colonne,
        }));
        dicRègles.tableau = Object.values(règlesTableau);
        return await fFinale();
      },
    });

    // Suivre les règles spécifiées dans les variables
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: InfoColonne[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreColonnes({
        idStructure,
        idTableau,
        f: async (cols) =>
          fSuivreRacine(cols?.filter((c) => !!c.variable) || []),
      });
    };

    const fFinaleRèglesVariables = async (règles: RègleColonne[]) => {
      dicRègles.variable = règles;
      return await fFinale();
    };

    const fBranche = async ({
      id: idColonne,
      fSuivreBranche,
      branche,
    }: {
      id: string;
      fSuivreBranche: Suivi<RègleColonne[]>;
      branche: InfoColonne;
    }) => {
      const { variable: idVariable } = branche;
      if (!idVariable) {
        await fSuivreBranche([]);
        return faisRien;
      }
      const fFinaleSuivreBranche = async (règles: RègleVariableAvecId[]) => {
        const règlesColonnes: RègleColonne[] = règles.map((r) => {
          return {
            règle: r,
            source: { type: "variable", id: idVariable },
            colonne: idColonne,
          };
        });
        return await fSuivreBranche(règlesColonnes);
      };
      return await this.service("variables").suivreRègles({
        idVariable,
        f: fFinaleSuivreBranche,
      });
    };

    const oublierRèglesVariable = await suivreDeFonctionListe({
      fListe,
      f: fFinaleRèglesVariables,
      fBranche,
      fIdDeBranche: (b) => b.id,
    });

    // Tout oublier
    const oublier = async () => {
      await oublierColonnes();
      await oublierRèglesTableau();
      await oublierRèglesVariable();
    };

    return oublier;
  }

  // Validation

  @cacheSuivi
  async suivreValidRègles({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<ErreurRègle[]>;
  }): Promise<Oublier> {
    const info: {
      règles?: {
        règle: RègleColonne<RègleVariable>;
        colsTableauRéf?: InfoColonneAvecCatégorie[];
      }[];
      colonnes?: InfoColonne[];
    } = {};

    const fFinale = async () => {
      if (!info.colonnes || !info.règles) return;

      const erreurs: ErreurRègle[] = [];

      const règlesTypeBornes = info.règles
        .map((r) => r.règle)
        .filter(
          (r) => r.règle.règle.type === "bornes",
        ) as RègleColonne<RègleBornes>[];

      const règlesBornesColonnes = règlesTypeBornes.filter(
        (r) => r.règle.règle.détails.type === "dynamiqueColonne",
      ) as RègleColonne<RègleBornes<DétailsRègleBornesDynamiqueColonne>>[];

      const règlesBornesVariables = règlesTypeBornes.filter(
        (r) => r.règle.règle.détails.type === "dynamiqueVariable",
      ) as RègleColonne<RègleBornes<DétailsRègleBornesDynamiqueVariable>>[];

      const règlesCatégoriquesDynamiques = info.règles.filter(
        (r) =>
          r.règle.règle.règle.type === "valeurCatégorique" &&
          r.règle.règle.règle.détails.type === "dynamique",
      ) as {
        règle: RègleColonne<
          RègleValeurCatégorique<DétailsRègleValeurCatégoriqueDynamique>
        >;
        colsTableauRéf?: InfoColonneAvecCatégorie[];
      }[];

      for (const r of règlesBornesColonnes) {
        const colRéfRègle = info.colonnes.find(
          (c) => c.id === r.règle.règle.détails.val,
        );
        if (!colRéfRègle) {
          const erreur: ErreurRègleBornesColonneInexistante = {
            règle: r,
            type: "colonneBornesInexistante",
          };
          erreurs.push(erreur);
        }
      }

      for (const r of règlesBornesVariables) {
        const varRéfRègle = info.colonnes.find(
          (c) => c.variable === r.règle.règle.détails.val,
        );
        if (!varRéfRègle) {
          const erreur: ErreurRègleBornesVariableNonPrésente = {
            règle: r,
            type: "variableBornesNonPrésente",
          };
          erreurs.push(erreur);
        }
      }

      for (const r of règlesCatégoriquesDynamiques) {
        const colRéfRègle = r.colsTableauRéf?.find(
          (c) => c.id === r.règle.règle.règle.détails.colonne,
        );
        if (!colRéfRègle) {
          const erreur: ErreurRègleCatégoriqueColonneInexistante = {
            règle: r.règle,
            type: "colonneCatégInexistante",
          };
          erreurs.push(erreur);
        }
      }
      await f(erreurs);
    };

    const fFinaleRègles = async (
      règles: {
        règle: RègleColonne<RègleVariable>;
        colsTableauRéf?: InfoColonneAvecCatégorie[];
      }[],
    ) => {
      info.règles = règles;
      return await fFinale();
    };

    const oublierColonnes = await this.suivreColonnes({
      idStructure,
      idTableau,
      f: async (cols) => {
        info.colonnes = cols;
        return await fFinale();
      },
    });

    const fListeRègles = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (règles: RègleColonne<RègleVariable>[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreRègles({
        idStructure,
        idTableau,
        f: fSuivreRacine,
      });
    };

    const fBrancheRègles = async ({
      fSuivreBranche,
      branche: règle,
    }: {
      fSuivreBranche: Suivi<{
        règle: RègleColonne<RègleVariable>;
        colsTableauRéf?: InfoColonne[];
      }>;
      branche: RègleColonne<RègleVariable>;
    }): Promise<Oublier> => {
      if (
        règle.règle.règle.type === "valeurCatégorique" &&
        règle.règle.règle.détails.type === "dynamique"
      ) {
        const { tableau, structure } = règle.règle.règle.détails;
        return await this.suivreColonnes({
          idStructure: structure,
          idTableau: tableau,
          f: (cols) =>
            fSuivreBranche({
              règle,
              colsTableauRéf: cols,
            }),
        });
      } else {
        await fSuivreBranche({ règle });
        return faisRien;
      }
    };

    const oublierRègles = await suivreDeFonctionListe({
      fListe: fListeRègles,
      f: fFinaleRègles,
      fBranche: fBrancheRègles,
      fIdDeBranche: (b: RègleColonne<RègleVariable>) => b.règle.id,
    });

    const oublier = async () => {
      await oublierRègles();
      await oublierColonnes();
    };
    return oublier;
  }

  @cacheSuivi
  async suivreValidColonnes({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<ErreurColonne[]>;
  }): Promise<Oublier> {
    return await this.suivreColonnes({
      idStructure,
      idTableau,
      f: async (colonnes) => {
        if (!colonnes) return await f([]);

        const erreurs: ErreurColonne[] = [];
        const décompte = colonnes
          .map((c) => c.variable)
          .reduce((acc: { [idVar: string]: number }, idVariable) => {
            if (idVariable) acc[idVariable] = (acc[idVariable] || 0) + 1;
            return acc;
          }, {});
        const déjàVue = new Set<string>();
        for (const [idVariable, n] of Object.entries(décompte)) {
          if (n > 1 && déjàVue.has(idVariable)) {
            const erreur: ErreurColonneVariableDédoublée = {
              type: "variableDédoublée",
              colonnes: colonnes
                .filter((c) => c.variable === idVariable)
                .map((c) => c.id),
            };
            erreurs.push(erreur);
            déjàVue.add(idVariable);
          }
        }
      },
    });
  }

  @cacheSuivi
  async suivreValidateursDonnées({
    idStructure,
    idTableau,
    f,
    résolveurDonnéesCatégorie,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<FonctionValidation[]>;
    résolveurDonnéesCatégorie: (args: {
      idStructure: string;
      idTableau: string;
      f: Suivi<DonnéesRangéeTableauAvecId[]>;
    }) => Promise<Oublier>;
  }): Promise<Oublier> {
    type RègleAvecCatégories = {
      règle: RègleColonne;
      donnéesCatégorie?: DagCborEncodable[];
    };

    const info: {
      règles?: RègleAvecCatégories[];
      colonnes?: InfoColonne[];
    } = {};

    const fFinale = async () => {
      if (info.colonnes && info.règles) {
        const varsÀColonnes = info.colonnes.reduce(
          (o, c) => (c.variable ? { ...o, [c.variable]: c.id } : { ...o }),
          {},
        );
        const colsIndex = info.colonnes.filter((c) => c.index).map((c) => c.id);
        await f(
          info.règles.map((r) =>
            générerFonctionValidation({
              règle: r.règle,
              varsÀColonnes,
              donnéesCatégorie: r.donnéesCatégorie,
              colsIndex,
            }),
          ),
        );
      }
    };

    const oublierColonnes = await this.suivreColonnes({
      idStructure,
      idTableau,
      f: async (cols) => {
        info.colonnes = cols;
        await fFinale();
      },
    });

    const fListeRègles = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (règles: RègleColonne[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreRègles({
        idStructure,
        idTableau,
        f: fSuivreRacine,
      });
    };

    const fBrancheRègles = async ({
      fSuivreBranche,
      branche: règle,
    }: {
      fSuivreBranche: Suivi<{
        règle: RègleColonne;
        donnéesCatégorie?: DagCborEncodable[];
      }>;
      branche: RègleColonne;
    }): Promise<Oublier> => {
      if (
        règle.règle.règle.type === "valeurCatégorique" &&
        règle.règle.règle.détails.type === "dynamique"
      ) {
        const { structure, tableau, colonne } = règle.règle.règle.détails;
        return await résolveurDonnéesCatégorie({
          idStructure: structure,
          idTableau: tableau,
          f: async (données) =>
            await fSuivreBranche({
              règle,
              donnéesCatégorie: données.map((d) => d.données[colonne]),
            }),
        });
      } else {
        await fSuivreBranche({ règle });
        return faisRien;
      }
    };

    const oublierRègles = await suivreDeFonctionListe({
      fListe: fListeRègles,
      f: async (règles: RègleAvecCatégories[]) => {
        info.règles = règles;
        await fFinale();
      },
      fBranche: fBrancheRègles,
      fIdDeBranche: (b: RègleColonne) => b.règle.id,
    });

    const oublier = async () => {
      await oublierRègles();
      await oublierColonnes();
    };
    return oublier;
  }

  // Traductions

  async ajouterTraductionsValeur({
    idStructure,
    idTableau,
    clef,
    traducs,
  }: {
    idStructure: string;
    idTableau: string;
    clef: string;
    traducs: TraducsTexte;
  }): Promise<void> {
    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    await tableau.put(`traducs/${clef}`, traducs);

    await oublier();
  }

  @cacheSuivi
  async suivreTraductionsValeurs({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<{ [clef: string]: TraducsTexte }>;
  }): Promise<Oublier> {
    return await this.suivreTableau({
      idStructure,
      idTableau,
      f: async (tableau) => await f(tableau.traducs),
    });
  }

  // Comparaisons

  @cacheSuivi
  async suivreDifférencesAvecTableau({
    tableau,
    tableauRéf,
    f,
  }: {
    tableau: {
      idStructure: string;
      idTableau: string;
    };
    tableauRéf: {
      idStructure: string;
      idTableau: string;
    };
    f: Suivi<DifférenceTableaux[]>;
  }): Promise<Oublier> {
    const info: {
      colonnesTableau?: InfoColonne[];
      colonnesTableauRéf?: InfoColonne[];
    } = {};

    const fFinale = async () => {
      if (!info.colonnesTableau || !info.colonnesTableauRéf) return;

      const différences: DifférenceTableaux[] = [];

      for (const cRéf of info.colonnesTableauRéf) {
        const cCorresp = info.colonnesTableau.find((c) => c.id === cRéf.id);
        if (cCorresp) {
          if (cCorresp.variable !== cRéf.variable) {
            const dif: DifférenceVariableColonne = {
              type: "variableColonne",
              sévère: true,
              idColonne: cCorresp.id,
              varColTableau: cCorresp.variable,
              varColTableauRéf: cRéf.variable,
            };
            différences.push(dif);
          }
          if (cCorresp.index !== cRéf.index) {
            const dif: DifférenceIndexColonne = {
              type: "indexColonne",
              sévère: true,
              idColonne: cCorresp.id,
              colTableauIndexée: !!cCorresp.index,
            };
            différences.push(dif);
          }
        } else {
          const dif: DifférenceColonneManquante = {
            type: "colonneManquante",
            sévère: true,
            idColonneManquante: cRéf.id,
          };
          différences.push(dif);
        }
      }

      for (const cTableau of info.colonnesTableau) {
        const cLiée = info.colonnesTableauRéf.find((c) => c.id === cTableau.id);
        if (!cLiée) {
          const dif: DifférenceColonneSupplémentaire = {
            type: "colonneSupplémentaire",
            sévère: false,
            idColonneSupplémentaire: cTableau.id,
          };
          différences.push(dif);
        }
      }

      await f(différences);
    };

    const oublierColonnesTableau = await this.suivreColonnes({
      ...tableau,
      f: async (x) => {
        info.colonnesTableau = x;
        await fFinale();
      },
    });

    const oublierColonnesRéf = await this.suivreColonnes({
      ...tableauRéf,
      f: async (x) => {
        info.colonnesTableauRéf = x;
        await fFinale();
      },
    });

    return async () => {
      await Promise.allSettled([oublierColonnesTableau, oublierColonnesRéf]);
    };
  }

  // Éléments

  async formaterÉlément({
    élément,
    colonnes,
    fichiersSFIP,
    langues,
    traducs,
  }: {
    élément: DonnéesRangéeTableau;
    colonnes: InfoColonneAvecCatégorie[];
    fichiersSFIP: Set<string>;
    langues?: string[];
    traducs?: { [clef: string]: TraducsTexte };
  }): Promise<DonnéesRangéeTableau> {
    const élémentFinal: DonnéesRangéeTableau = {};

    const formaterValeur = async (
      v: DagCborEncodable,
      catégorie: CatégorieBaseVariables,
    ): Promise<string | number | undefined> => {
      switch (typeof v) {
        case "object": {
          return JSON.stringify(v);
        }
        case "boolean":
          return v.toString();
        case "number":
          return v;
        case "string":
          if (["audio", "image", "vidéo", "fichier"].includes(catégorie)) {
            if (idcValide(v)) fichiersSFIP.add(v);

            return v;
          } else if (catégorie === "chaîne") {
            return traduire(traducs?.[v] || {}, langues || []) || v;
          }
          return v;
        default:
          return;
      }
    };

    for (const col of Object.keys(élément)) {
      const colonne = colonnes.find((c) => c.id === col);
      if (!colonne) continue;

      const { catégorie } = colonne;

      let val: string | number | undefined = undefined;
      const élément = é[col];
      if (catégorie?.type === "simple") {
        val = await formaterValeur(élément, catégorie.catégorie);
      } else if (catégorie?.type === "liste") {
        if (Array.isArray(élément)) {
          val = JSON.stringify(
            await Promise.allSettled(
              élément.map((x) => formaterValeur(x, catégorie.catégorie)),
            ),
          );
        }
      }
      if (val !== undefined) élémentFinal[col] = val;
    }

    return élémentFinal;
  }

  // Score

  @cacheSuivi
  async suivreScoreCouverture({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<ScoreCouvertureTableau>;
  }): Promise<Oublier> {
    const info: {
      cols?: InfoColonneAvecCatégorie[];
      règles?: RègleColonne[];
    } = {};

    const fFinale = async () => {
      const { cols, règles } = info;

      if (cols !== undefined && règles !== undefined) {
        const colsÉligibles = cols.filter(
          (c) => c.catégorie?.catégorie === "numérique",
        );

        const dénominateur = colsÉligibles.length;
        const numérateur = colsÉligibles.filter((c) =>
          règles.some(
            (r) => r.règle.règle.type !== "catégorie" && r.colonne === c.id,
          ),
        ).length;
        await f({ numérateur, dénominateur });
      }
    };

    const oublierColonnes = await this.suivreCatégoriesColonnes({
      idStructure,
      idTableau,
      f: async (cols) => {
        info.cols = cols;
        await fFinale();
      },
    });

    const oublierRègles = await this.suivreRègles({
      idStructure,
      idTableau,
      f: async (règles) => {
        info.règles = règles;
        await fFinale();
      },
    });

    return async () => {
      await oublierColonnes();
      await oublierRègles();
    };
  }
}
