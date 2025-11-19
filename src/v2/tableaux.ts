import { TypedNested } from "@constl/bohr-db";
import { JSONSchemaType } from "ajv";
import { DagCborEncodable } from "@orbitdb/core";
import { v4 as uuidv4 } from "uuid";
import {
  adresseOrbiteValide,
  attendreStabilité,
  faisRien,
  idcValide,
  ignorerNonDéfinis,
  suivreDeFonctionListe,
  suivreFonctionImbriquée,
  traduire,
  uneFois,
} from "@constl/utils-ipa";
import { BookType, WorkBook, utils } from "xlsx";
import { asSplitKey, joinKey } from "@orbitdb/nested-db";
import {
  NestedObjectToMap,
  NestedValueObject,
} from "node_modules/@orbitdb/nested-db/dist/types.js";
import md5 from "crypto-js/md5.js";
import Base64 from "crypto-js/enc-base64.js";
import deepEqual from "deep-equal";
import { cacheSuivi } from "./crabe/cache.js";
import { ServicesConstellation } from "./constellation.js";
import { Oublier, Suivi } from "./crabe/types.js";
import { PartielRécursif, TraducsTexte } from "./types.js";
import { brancheBd } from "./crabe/services/services.js";
import { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import { mapÀObjet } from "./crabe/utils.js";
import {
  DétailsRègleBornesDynamiqueColonne,
  DétailsRègleBornesDynamiqueVariable,
  DétailsRègleValeurCatégoriqueDynamique,
  ErreurRègle,
  ErreurRègleBornesColonneInexistante,
  ErreurRègleBornesVariableNonPrésente,
  ErreurRègleCatégoriqueColonneInexistante,
  ErreurDonnée,
  RègleBornes,
  RègleColonne,
  RègleValeurCatégorique,
  RègleVariable,
  RègleVariableAvecId,
  schémaSpécificationRègleColonne,
  ErreurColonne,
  ErreurColonneVariableDédoublée,
  générerFonctionValidation,
  SpécificationRègleColonne,
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
    [idRègle: string]: SpécificationRègleColonne;
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
      additionalProperties: schémaSpécificationRègleColonne,
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
    const dicRègles: { tableau?: RègleColonne[]; variable?: RègleColonne[], index?: RègleColonne[] } =
      {};
    const fFinale = async () => {
      if (!dicRègles.tableau || !dicRègles.variable) return;
      return await f([...dicRègles.tableau, ...dicRègles.variable]);
    };

    // Suivre règles index unique
    const oublierColonnes = await this.suivreColonnes({
      idStructure,
      idTableau,
      f: colonnes => {
        const colonnesIndex = (colonnes || []).filter(c=>c.index);
        dicRègles.index = colonnesIndex.map(c=>({
          règle: {
            id: uuidv4(),
            règle: {
              type: "indexUnique",
            }
          },
          source: { type: "tableau", id: idTableau },
          colonne: c.id,
        }))
      }
    })

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
    const oublier = async () => {
      await oublierColonnes();
      await oublierRèglesTableau();
      await oublierRèglesVariable();
    };

    return oublier;
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

  async ajouterÉléments({
    idStructure,
    idTableau,
    éléments
  }: {
    idStructure: string;
    idTableau: string;
    éléments
  }): Promise<string[]> {
    await this.confirmerPermission({ idStructure });

    // Éviter, autant que possible, de dédoubler des colonnes indexes
    const colsIndexe = (
      await uneFois((f: Suivi<InfoColonne[]>) =>
        this.suivreColonnes({ idStructure, idTableau, f: ignorerNonDéfinis(f) }),
      )
    )
      .filter((c) => c.index)
      .map((c) => c.id);

    const obtIdIndex = (v: {[clef: string]: DagCborEncodable}): string => {
      const valsIndex = Object.fromEntries(
        Object.entries(v).filter((x) => colsIndexe.includes(x[0])),
      );
      return Base64.stringify(md5(JSON.stringify(valsIndex)));
    };

    const { données, oublier } = await this.ouvrirDonnéesTableau({ idStructure, idTableau });
    const ids: string[] = [];
    for (const val of éléments) {
      const id = colsIndexe.length ? obtIdIndex(val) : uuidv4();
      await données.put(id, val);
      ids.push(id);
    }

    await oublier();

    return ids;
  }

  async modifierÉlément({
    idStructure,
    idTableau,
    vals,
    idÉlément,
  }: {
    idStructure: string,
    idTableau: string;
    vals: { [key: string]: élémentsBd | undefined };
    idÉlément: string;
  }): Promise<void> {
    await this.confirmerPermission({ idStructure });

    const {données, oublier} = await this.ouvrirDonnéesTableau({ idStructure, idTableau });

    const précédent = await données.get(idÉlément);
    if (!précédent) throw new Error(`Id élément ${idÉlément} n'existe pas.`);

    const élément = Object.assign({}, précédent, vals);

    Object.keys(vals).map((c: string) => {
      if (vals[c] === undefined) delete élément[c];
    });

    if (!deepEqual(élément, précédent)) {
      await données.put(idÉlément, élément);
    }
    await oublier();
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
    const { données, oublier } = await this.ouvrirDonnéesTableau({ idStructure, idTableau});

    await données.del(idÉlément);
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
      fRacine: async ({ fSuivreRacine }) =>
        this.suivreTableau({
          idStructure,
          idTableau,
          f: async (tableau) => await fSuivreRacine(tableau.données),
        }),
      fSuivre: async ({ id: idDonnées, fSuivreBd }) =>
        await this.service("orbite").suivreDonnéesBd({
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

  async combinerDonnées({
    de,
    à,
    patience = 100,
  }: {
    de: {
      idStructure: string;
      idTableau: string};
    à: {
      idStructure: string;
      idTableau: string;
    };
    patience?: number;
  }): Promise<void> {
    const [donnéesTableauSource, donnéesTableauDestinataire] = await Promise.all([
      uneFois(
        async (
          fSuivi: Suivi<DonnéesRangéeTableauAvecId[]>,
        ) => {
          return await this.suivreDonnées({
            ...de,
            f: fSuivi,
          });
        },
        attendreStabilité(patience),
      ),
      uneFois(
        async (
          fSuivi: Suivi<DonnéesRangéeTableauAvecId[]>,
        ) => {
          return await this.suivreDonnées({ ...à, f: fSuivi });
        },
        attendreStabilité(patience),
      ),
    ]);

    const colsTableauDestinataire = await uneFois(
      async (fSuivi: Suivi<InfoColonne[]>) => {
        return await this.suivreColonnes({
          ...à,
          f: ignorerNonDéfinis(fSuivi),
        });
      },
      // Il faut attendre que toutes les colonnes soient présentes
      (colonnes) =>
        !!colonnes &&
        [
          ...new Set(
            donnéesTableauDestinataire
              .map((d) => Object.keys(d.données))
              .flat(),
          ),
        ].length <= colonnes.length,
    );

    const indexes = colsTableauDestinataire.filter((c) => c.index).map((c) => c.id);
    for (const nouvelÉlément of donnéesTableauSource) {
      const existant = donnéesTableauDestinataire.find((d) =>
        indexÉlémentsÉgaux(d.données, nouvelÉlément.données, indexes),
      );

      if (existant) {
        const àAjouter: { [key: string]: élémentsBd } = {};
        for (const col of colsTableauDestinataire) {
          if (
            existant.données[col.id] === undefined &&
            nouvelÉlément.données[col.id] !== undefined
          ) {
            àAjouter[col.id] = nouvelÉlément.données[col.id];
          }
        }

        if (Object.keys(àAjouter).length) {
          await this.effacerÉlément({
            idTableau: idTableauBase,
            idÉlément: existant.id,
          });
          await this.ajouterÉlément({
            idTableau: idTableauBase,
            vals: Object.assign({}, existant.données, àAjouter),
          });
        }
      } else {
        await this.ajouterÉléments({
          ...à,
          vals: [nouvelÉlément.données],
        });
      }
    }
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
            détails: "colonneBornesInexistante",
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
            détails: "variableBornesNonPrésente",
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
            détails: "colonneCatégInexistante",
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
      return await this.suivreRègles({ idStructure, idTableau, f: fSuivreRacine });
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
  async suivreValidDonnées({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<ErreurDonnée[]>;
  }): Promise<Oublier> {
    const info: {
      données?: élémentDonnées[];
      règles?: schémaFonctionValidation[];
      colonnes?: InfoColonne[];
    } = {};
    const fFinale = async () => {
      if (!info.données || !info.règles) return;

      const erreurs: ErreurDonnée[] = [];
      for (const r of info.règles) {
        const nouvellesErreurs = r(info.données);
        erreurs.push(...nouvellesErreurs.flat());
      }
      await f(erreurs);
    };

    const fFinaleRègles = async (
      règles: { règle: RègleColonne; donnéesCatégorie?: élémentsBd[] }[],
    ) => {
      if (info.colonnes) {
        const varsÀColonnes = info.colonnes.reduce(
          (o, c) => (c.variable ? { ...o, [c.variable]: c.id } : { ...o }),
          {},
        );
        info.règles = règles.map((r) =>
          générerFonctionValidation({
            règle: r.règle,
            varsÀColonnes,
            donnéesCatégorie: r.donnéesCatégorie,
          }),
        );
        await fFinale();
      }
    };
    const fFinaleDonnées = async (données: élémentDonnées[]) => {
      info.données = données;
      await fFinale();
    };
    const oublierVarsÀColonnes = await this.suivreColonnes({
      idStructure,
      idTableau,
      f: async (cols) => {
        info.colonnes = cols
        await fFinale();
      },
    });

    const fListeRègles = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (règles: RègleColonne[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreRègles({ idStructure, idTableau, f: fSuivreRacine });
    };

    const fBrancheRègles = async ({
      fSuivreBranche,
      branche: règle,
    }: {
      fSuivreBranche: Suivi<{
        règle: RègleColonne;
        donnéesCatégorie?: élémentsBd[];
      }>;
      branche: RègleColonne;
    }): Promise<Oublier> => {
      if (
        règle.règle.règle.type === "valeurCatégorique" &&
        règle.règle.règle.détails.type === "dynamique"
      ) {
        const { structure, tableau, colonne } = règle.règle.règle.détails;
        return await this.suivreDonnées({
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
      f: fFinaleRègles,
      fBranche: fBrancheRègles,
      fIdDeBranche: (b: RègleColonne) => b.règle.id,
    });

    const oublierDonnées = await this.suivreDonnées({
      idStructure,
      idTableau,
      f: fFinaleDonnées,
    });
    const oublier = async () => {
      await oublierRègles();
      await oublierDonnées();
      await oublierVarsÀColonnes();
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
        const décompte = (colonnes).map(c=>c.variable).reduce((acc: {[idVar: string]: number}, idVariable) => {
          if (idVariable) acc[idVariable] = (acc[idVariable] || 0) + 1;
          return acc;
        }, {});
        const déjàVue = new Set<string>();
        for (const [idVariable, n] of Object.entries(décompte)) {
          if (n > 1 && déjàVue.has(idVariable)){
            const erreur: ErreurColonneVariableDédoublée = {
              type: "variableDédoublée",
              colonnes: colonnes.filter(c=>c.variable === idVariable).map(c=>c.id)
            };
            erreurs.push(erreur)
            déjàVue.add(idVariable)
          }
        }
      }
    })
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
        }) => this.suivreVariables({ idStructure, idTableau, f: fSuivreRacine }),
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
