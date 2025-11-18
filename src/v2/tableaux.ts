import { TypedNested } from "@constl/bohr-db";
import { JSONSchemaType } from "ajv";
import { DagCborEncodable } from "@orbitdb/core";
import { v4 as uuidv4 } from "uuid";
import {
  adresseOrbiteValide,
  attendreStabilité,
  faisRien,
  idcValide,
  suivreDeFonctionListe,
  suivreFonctionImbriquée,
  traduire,
  uneFois,
} from "@constl/utils-ipa";
import { BookType, WorkBook, utils } from "xlsx";
import {
  Nested,
  NestedDatabaseType,
  asSplitKey,
  joinKey,
} from "@orbitdb/nested-db";
import { NestedObjectToMap, NestedValueObject } from "node_modules/@orbitdb/nested-db/dist/types.js";
import { cacheSuivi } from "./crabe/cache.js";
import { ServicesConstellation } from "./constellation.js";
import { Oublier, Suivi } from "./crabe/types.js";
import { PartielRécursif, TraducsTexte } from "./types.js";
import { brancheBd } from "./crabe/services/services.js";
import { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import { mapÀObjet } from "./crabe/utils.js";
import {
  RègleColonne,
  RègleVariable,
  RègleVariableAvecId,
  schémaRègleColonne,
} from "./règles.js";
import { CatégorieBaseVariables, CatégorieVariables } from "./variables.js";
import {
  DonnéesFichierBdExportées,
  sauvegarderDonnéesExportées,
} from "./utils.js";
import { typer } from "./crabe/services/orbite/orbite.js";

// Types tableaux

export type StructureTableau = {
  noms: TraducsTexte;
  colonnes: { [id: string]: Omit<InfoColonne, "id"> };
  données: string;
  règles: {
    [idRègle: string]: RègleColonne;
  };
};

export const schémaTableau: JSONSchemaType<
  PartielRécursif<StructureTableau>
> & { nullable: true } = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    noms: {
      type: "object",
      additionalProperties: {
        type: "string",
      },
      nullable: true,
      required: [],
    },
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
      additionalProperties: schémaRègleColonne,
      nullable: true,
    },
  },
  required: [],
  nullable: true,
};

export type StructureDonnéesTableau = {
  [id: string]: { [clef: string]: DagCborEncodable };
};

export const schémaDonnéesTableau: JSONSchemaType<
  PartielRécursif<StructureDonnéesTableau>
> & { nullable: true } = {
  type: "object",
  additionalProperties: {
    type: "object",
    additionalProperties: true,
    required: [],
  },
  nullable: true,
  required: [],
};

export type InfoTableau = { clef: string; id: string };

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

// Types données tableaux

export type InfoColonne = {
  id: string;
  variable?: string;
  index?: boolean;
};

export type InfoColonneAvecCatégorie = InfoColonne & {
  catégorie?: CatégorieVariables;
};

export interface DonnéesRangéeTableauAvecId<
  T extends DonnéesRangéeTableau = DonnéesRangéeTableau,
> {
  données: T;
  id: string;
}

export type DonnéesRangéeTableau = {
  [key: string]: DagCborEncodable;
};

export type DonnéesTableauExportées = {
  nomTableau: string;
  données: DonnéesRangéeTableau[];
  fichiersSFIP: Set<string>;
};

export type ConversionDonnées =
  | ConversionDonnéesNumérique
  | ConversionDonnéesDate
  | ConversionDonnéesChaîne;

export type ConversionDonnéesNumérique = {
  type: "numérique";
  opération?: OpérationConversionNumérique | OpérationConversionNumérique[];
  systèmeNumération?: string;
};
export type OpérationConversionNumérique = {
  op: "+" | "-" | "/" | "*" | "^";
  val: number;
};
export type ConversionDonnéesDate = {
  type: "horoDatage";
  système: string;
  format: string;
};
export type ConversionDonnéesChaîne = {
  type: "chaîne";
  langue: string;
};

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
    const compte = this.service("compte");
    const orbite = this.service("orbite");

    const { bd: bdStructure, oublier: oublierStructure } =
      await orbite.ouvrirBd({ id: idStructure });
    const adresseAccèsStructure = bdStructure.access.address;
    await oublierStructure();

    const optionsAccès = { écriture: adresseAccèsStructure };

    const { bd, oublier: oublierBd } = await compte.créerObjet({
      type: "nested",
      optionsAccès,
    });
    const idBdDonnées = bd.address;
    await oublierBd();
    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    await tableau.set("données", idBdDonnées);

    await oublier();
    return idTableau;
  }

  async copierTableau({
    idStructure,
    idTableau,
    copierDonnées = true,
  }: {
    idStructure: string;
    idTableau: string;
    copierDonnées?: boolean;
  }): Promise<string> {
    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    const idNouveauTableau = await this.créerTableau({
      idStructure,
      idTableau: uuidv4(),
    });

    const { tableau: nouveauTableau, oublier: oublierNouveauTableau } =
      await this.ouvrirTableau({ idStructure, idTableau: idNouveauTableau });

    // Copier les noms
    const noms = mapÀObjet(await tableau.get("noms"));
    if (noms)
      await this.sauvegarderNoms({
        idStructure,
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

    // Copier les données
    if (copierDonnées) {
      const { données: bdDonnées, oublier: oublierDonnées } =
        await this.ouvrirDonnéesTableau({ idStructure, idTableau });
      const données = mapÀObjet(await bdDonnées.all());
      await oublierDonnées();

      if (données) {
        const { données: nouvelleBdDonnées, oublier: oublierNouvellesDonnées } =
          await this.ouvrirDonnéesTableau({
            idStructure,
            idTableau: idNouveauTableau,
          });
        await nouvelleBdDonnées.put(données);
        await oublierNouvellesDonnées();
      }
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

    // Effacer la bd Orbite avec les données du tableau
    const idDonnées = await this.obtIdDonnées({ idStructure, idTableau });

    if (idDonnées) await orbite.effacerBd({ id: idDonnées });

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

  async ouvrirDonnéesTableau({
    idStructure,
    idTableau,
  }: {
    idStructure: string;
    idTableau: string;
  }): Promise<{
    données: TypedNested<StructureDonnéesTableau>;
    oublier: Oublier;
  }> {
    const idBdDonnées = await this.obtIdDonnées({ idStructure, idTableau });
    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: idBdDonnées,
      type: "nested",
    });
    return {
      données: typer({
        bd,
        schéma: schémaDonnéesTableau,
      }) as TypedNested<StructureDonnéesTableau>,
      oublier,
    };
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
  }: {
    idStructure: string;
    idTableau: string;
    idVariable?: string;
    idColonne?: string;
  }): Promise<string> {
    await this.confirmerPermission({ idStructure });

    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });

    idColonne = idColonne || uuidv4();
    const élément = {
      variable: idVariable,
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

      return await variables.suivreCatégorieVariable({
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

  async ajouterRègleTableau<R extends RègleVariable = RègleVariable>({
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
    const règleAvecId: RègleVariableAvecId<R> = {
      id,
      règle,
    };

    const élément: RègleColonne = {
      règle: règleAvecId,
      source: { type: "tableau", id: idStructure },
      colonne: idColonne,
    };
    await tableau.put(`règles/${id}`, élément);

    await oublier();

    return id;
  }

  async effacerRègleTableau({
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
    const dicRègles: { tableau?: RègleColonne[]; variable?: RègleColonne[] } =
      {};
    const fFinale = async () => {
      if (!dicRègles.tableau || !dicRègles.variable) return;
      return await f([...dicRègles.tableau, ...dicRègles.variable]);
    };

    // Suivre les règles spécifiées dans le tableau
    const fFinaleRèglesTableau = async (règles: {
      [id: string]: RègleColonne;
    }) => {
      dicRègles.tableau = Object.values(règles);
      return await fFinale();
    };

    const oublierRèglesTableau = await this.suivreTableau({
      idStructure,
      idTableau,
      f: (tableau) => fFinaleRèglesTableau(tableau.règles) || {},
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
      return await this.service("variables").suivreRèglesVariable({
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
    const fOublier = async () => {
      await oublierRèglesTableau();
      await oublierRèglesVariable();
    };

    return fOublier;
  }

  // Données
  async obtIdDonnées({
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
    const idDonnées = await tableau.get("données");
    await oublier();

    if (!idDonnées) throw new Error();
    return idDonnées;
  }

  async effacerÉlément({
    idStructure,
    idTableau,
    idÉlément,
  }: {
    idStructure: string;
    idTableau: string;
    idÉlément: string;
  }) {
    const idDonnées = await this.obtIdDonnées({ idStructure, idTableau });
    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: idDonnées,
      type: "nested",
    });
    const bdTypée = typer({
      bd,
      schéma: schémaDonnéesTableau,
    }) as TypedNested<StructureDonnéesTableau>;

    await bdTypée.del(idÉlément);
    await oublier();
  }

  @cacheSuivi
  async suivreDonnées<T extends DonnéesRangéeTableau>({
    idStructure,
    idTableau,
    f,
    clefsSelonVariables = false,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<DonnéesRangéeTableauAvecId<T>[]>;
    clefsSelonVariables?: boolean;
  }): Promise<Oublier> {
    const info: {
      données?: { [id: string]: T };
      variablesColonnes?: { [key: string]: string | undefined };
    } = {};

    const fFinale = async () => {
      const { données, variablesColonnes } = info;

      if (données && variablesColonnes) {
        const donnéesFinales: DonnéesRangéeTableauAvecId<T>[] = Object.entries(
          données,
        ).map(([id, élément]): DonnéesRangéeTableauAvecId<T> => {
          const données: T = clefsSelonVariables
            ? Object.keys(élément).reduce((acc: T, elem: string) => {
                // Convertir au nom de la variable si souhaité
                const idVar = variablesColonnes[elem];
                (acc as DonnéesRangéeTableau)[idVar || elem] = élément[elem];
                return acc;
              }, {} as T)
            : élément;

          return { données, id };
        });
        await f(donnéesFinales);
      }
    };

    const oublierColonnes = await this.suivreColonnes({
      idStructure,
      idTableau,
      f: async (colonnes) => {
        info.variablesColonnes = Object.fromEntries(
          (colonnes || []).map((c) => [c.id, c.variable]),
        );
        await fFinale();
      },
    });

    const oublierDonnées = await suivreFonctionImbriquée({
      fRacine: async ({fSuivreRacine}) =>  this.suivreTableau({
        idStructure,
        idTableau,
        f: async (tableau) => await fSuivreRacine(tableau.données)
      }),
      fSuivre: async ({id: idDonnées, fSuivreBd}) => await this.service("orbite").suivreDonnéesBd({
        id: idDonnées,
        type: "nested",
        schéma: schémaDonnéesTableau,
        f: fSuivreBd,
      }),
      f: async (données?: NestedObjectToMap<StructureDonnéesTableau>) => {
        if (données)
          info.données = mapÀObjet(données) as { [id: string]: T } | undefined; // Il faudrait implémenter un schéma dynamique selon T
        await fFinale();
      },
    });

    return async () => {
      await oublierDonnées();
      await oublierColonnes();
    };
  }

  // Exportation

  async suivreDonnéesExportation({
    idStructure,
    idTableau,
    langues,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    langues?: string[];
    f: Suivi<DonnéesTableauExportées>;
  }): Promise<Oublier> {
    const variables = this.service("variables");

    const info: {
      nomsTableau?: { [clef: string]: string };
      nomsVariables?: { [idVar: string]: TraducsTexte };
      colonnes?: InfoColonneAvecCatégorie[];
      données?: DonnéesRangéeTableauAvecId[];
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
          Object.keys(d).reduce((acc: DonnéesRangéeTableau, idCol: string) => {
            const idVar = colonnes.find((c) => c.id === idCol)?.variable;
            if (!idVar)
              throw new Error(
                `Colonne avec id ${idCol} non trouvée parmis les colonnes :\n${JSON.stringify(
                  colonnes,
                  undefined,
                  2,
                )}.`,
              );
            const nomVar =
              langues && nomsVariables?.[idVar]
                ? traduire(nomsVariables[idVar], langues) || idCol
                : idCol;
            acc[nomVar] = d[idCol];
            return acc;
          }, {}),
        );

        const idCourtTableau = idTableau.split("/").pop()!;
        const nomTableau =
          langues && nomsTableau
            ? traduire(nomsTableau, langues) || idCourtTableau
            : idCourtTableau;

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
      const fOublierNomsTableaux = await this.suivreNoms({
        idTableau,
        f: async (noms) => {
          info.nomsTableau = noms;
          await fFinale();
        },
      });
      fsOublier.push(fOublierNomsTableaux);

      const fOublierNomsVariables = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }) => this.suivreVariables({ idTableau, f: fSuivreRacine }),
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
          return await variables.suivreNomsVariable({
            idVariable: id,
            f: async (noms) => await fSuivreBranche({ idVar: id, noms }),
          });
        },
      });
      fsOublier.push(fOublierNomsVariables);
    }

    const fOublierColonnes = await this.suivreColonnesEtCatégoriesTableau({
      idTableau,
      f: async (cols) => {
        info.colonnes = cols;
        await fFinale();
      },
    });
    fsOublier.push(fOublierColonnes);

    const fOublierDonnées = await this.suivreDonnées({
      idTableau,
      f: async (données) => {
        info.données = données;
        await fFinale();
      },
    });
    fsOublier.push(fOublierDonnées);

    return async () => {
      Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  async exporterDonnées({
    idStructure,
    idTableau,
    langues,
    doc,
    nomFichier,
    patience = 500,
  }: {
    idStructure: string;
    idTableau: string;
    langues?: string[];
    doc?: WorkBook;
    nomFichier?: string;
    patience?: number;
  }): Promise<DonnéesFichierBdExportées> {
    /* Créer le document si nécessaire */
    doc = doc || utils.book_new();

    const données = await uneFois(
      async (
        fSuivi: Suivi<{
          nomTableau: string;
          données: DonnéesRangéeTableau[];
          fichiersSFIP: Set<string>;
        }>,
      ): Promise<Oublier> => {
        return await this.suivreDonnéesExportation({
          idStructure,
          idTableau,
          langues,
          f: fSuivi,
        });
      },
      attendreStabilité(patience),
    );

    /* Créer le tableau */
    const tableau = utils.json_to_sheet(données.données);

    /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
    utils.book_append_sheet(doc, tableau, données.nomTableau.slice(0, 30));

    nomFichier = nomFichier || données.nomTableau;
    return { doc, fichiersSFIP: données.fichiersSFIP, nomFichier };
  }

  async sauvegarderDonnéesExportées({
    idStructure,
    idTableau,
    langues,
    doc,
    nomFichier,
    patience = 500,
    formatDoc,
    dossier = "",
    inclureDocuments = true,
  }: {
    idStructure: string;
    idTableau: string;
    langues?: string[];
    doc?: WorkBook;
    nomFichier?: string;
    patience?: number;
    formatDoc: BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
  }): Promise<string> {
    const hélia = this.service("hélia");

    const donnéesExportées = await this.exporterDonnées({
      idStructure,
      idTableau,
      langues,
      doc,
      nomFichier,
      patience,
    });

    return await sauvegarderDonnéesExportées({
      données: donnéesExportées,
      formatDoc,
      dossier,
      inclureDocuments,
      obtItérableAsyncSFIP: hélia.obtItérableAsyncSFIP.bind(hélia),
    });
  }

  async formaterÉlément({
    é,
    colonnes,
    fichiersSFIP,
    langues,
    traducs,
  }: {
    é: DonnéesRangéeTableau;
    colonnes: InfoColonneAvecCatégorie[];
    fichiersSFIP: Set<string>;
    langues?: string[];
    traducs?: TraducsTexte;
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
            return traduire(traducs || {}, langues || []) || v;
          }
          return v;
        default:
          return;
      }
    };

    for (const col of Object.keys(é)) {
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
}
