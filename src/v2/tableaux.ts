import { TypedNested, typedNested } from "@constl/bohr-db";
import { JSONSchemaType } from "ajv";
import { DagCborEncodable } from "@orbitdb/core";
import { v4 as uuidv4 } from "uuid";
import {
  adresseOrbiteValide,
  attendreStabilité,
  faisRien,
  idcValide,
  suivreDeFonctionListe,
  traduire,
  uneFois,
} from "@constl/utils-ipa";
import { BookType, WorkBook, utils } from "xlsx";
import { cacheSuivi } from "@/décorateursCache.js";
import { Constellation, ServicesConstellation } from "./constellation.js";
import { Oublier, Suivi } from "./crabe/types.js";
import { PartielRécursif, TraducsTexte } from "./types.js";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import { mapÀObjet } from "./crabe/utils.js";
import { RègleColonne, schémaRègleColonne } from "./valid.js";
import { CatégorieBaseVariables, CatégorieVariables } from "./variables.js";
import {
  DonnéesFichierBdExportées,
  sauvegarderDonnéesExportées,
} from "./utils.js";

// Types tableaux

export type StructureTableau = {
  type: "tableau";
  noms: TraducsTexte;
  colonnes: { [id: string]: Omit<InfoColonne, "id"> };
  données: { [id: string]: { [clef: string]: DagCborEncodable } };
  règles: {
    [idRègle: string]: RègleColonne;
  };
};

export const schémaTableau: JSONSchemaType<PartielRécursif<StructureTableau>> =
  {
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
          required: [],
        },
        nullable: true,
        required: [],
      },
      données: {
        type: "object",
        additionalProperties: {
          type: "object",
          additionalProperties: true,
          required: [],
        },
        nullable: true,
        required: [],
      },
      règles: schémaRègleColonne,
    },
    required: [],
  };

export type InfoTableau = { clef: string; id: string };

// Types données tableaux

export type InfoColonne = {
  id: string;
  variable?: string;
  index?: boolean;
};

export type InfoColonneAvecCatégorie = InfoColonne & {
  catégorie?: CatégorieVariables;
};

export interface DonnéesFileTableauAvecId<
  T extends DonnéesFileTableau = DonnéesFileTableau,
> {
  données: T;
  id: string;
}

export type DonnéesFileTableau = {
  [key: string]: DagCborEncodable;
};

export type DonnéesTableauExportées = {
  nomTableau: string;
  données: DonnéesFileTableau[];
  fichiersSFIP: Set<string>;
};

export type ConversionDonnées =
  | ConversionDonnéesNumérique
  | ConversionDonnéesDate
  | ConversionDonnéesChaîne;

export type ConversionDonnéesNumérique = {
  type: "numérique";
  opération?: opérationConversionNumérique | opérationConversionNumérique[];
  systèmeNumération?: string;
};
export type opérationConversionNumérique = {
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

// Types service tableaux

export type StuctureServiceTableaux = {
  [idTableau: string]: null;
};

export const schémaServiceTableaux: JSONSchemaType<
  PartielRécursif<StuctureServiceTableaux>
> = {
  type: "object",
  additionalProperties: {
    type: "null",
    nullable: true,
  },
};

export class Tableaux<
  L extends ServicesLibp2pCrabe,
> extends ServiceDonnéesNébuleuse<
  "tableaux",
  StuctureServiceTableaux,
  L,
  ServicesConstellation<L>
> {
  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "tableaux",
      nébuleuse,
      dépendances: ["compte", "orbite"],
      options: {
        schéma: schémaServiceTableaux,
      },
    });
  }

  async créerTableau({
    idStructure,
  }: {
    idStructure: string;
  }): Promise<string> {
    const compte = this.service("compte");
    const optionsAccès = { écriture: idStructure };

    const { bd, oublier: oublierBd } = await compte.créerObjet({
      type: "keyvalue",
      optionsAccès,
    });
    const idTableau = bd.address;
    await oublierBd();
    const { tableau, oublier } = await this.ouvrirTableau({ idTableau });

    await tableau.set("type", "tableau");

    await oublier();
    return idTableau;
  }

  async copierTableau({
    idTableau,
    idStructure,
    copierDonnées = true,
  }: {
    idTableau: string;
    idStructure: string;
    copierDonnées?: boolean;
  }): Promise<string> {
    const { tableau, oublier } = await this.ouvrirTableau({ idTableau });

    const idNouveauTableau = await this.créerTableau({ idStructure });
    const { tableau: nouveauTableau, oublier: oublierNouveauTableau } =
      await this.ouvrirTableau({ idTableau: idNouveauTableau });

    // Copier les noms
    const noms = mapÀObjet(await tableau.get("noms"));
    if (noms)
      await this.sauvegarderNomsTableau({ idTableau: idNouveauTableau, noms });

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
      const données = mapÀObjet(await tableau.get("données"));
      if (données) {
        await nouveauTableau.set("données", données);
      }
    }

    await oublier();
    await oublierNouveauTableau();

    return idNouveauTableau;
  }

  async effacerTableau({ idTableau }: { idTableau: string }): Promise<void> {
    const orbite = this.service("orbite");

    // Effacer le tableau
    await orbite.effacerBd({ id: idTableau });
  }

  async ouvrirTableau({
    idTableau,
  }: {
    idTableau: string;
  }): Promise<{ tableau: TypedNested<StructureTableau>; oublier: Oublier }> {
    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: idTableau,
      type: "nested",
    });
    return {
      tableau: typedNested<StructureTableau>({ db: bd, schema: schémaTableau }),
      oublier,
    };
  }

  // Accèss
  async confirmerPermission({
    idTableau,
  }: {
    idTableau: string;
  }): Promise<void> {
    const compte = this.service("compte");
    if (!compte.permission({ idObjet: idTableau }))
      throw new Error(
        `Permission de modification refusée pour le tableau ${idTableau}.`,
      );
  }

  // Noms
  async sauvegarderNomsTableau({
    idTableau,
    noms,
  }: {
    idTableau: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idTableau });
    const { tableau, oublier } = await this.ouvrirTableau({
      idTableau,
    });

    for (const lng in noms) {
      await tableau.set(`noms/${lng}`, noms[lng]);
    }

    await oublier();
  }

  async sauvegarderNomTableau({
    idTableau,
    langue,
    nom,
  }: {
    idTableau: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    await this.confirmerPermission({ idTableau });
    const { tableau, oublier } = await this.ouvrirTableau({
      idTableau,
    });

    await tableau.set(`noms/${langue}`, nom);
    await oublier();
  }

  async effacerNomTableau({
    idTableau,
    langue,
  }: {
    idTableau: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idTableau });
    const { tableau, oublier } = await this.ouvrirTableau({
      idTableau,
    });
    await tableau.del(`noms/${langue}`);

    await oublier();
  }

  @cacheSuivi
  async suivreNomsTableau({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: Suivi<TraducsTexte | undefined>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idTableau,
      type: "nested",
      schéma: schémaTableau,
      f: (tableau) => f(mapÀObjet(tableau.get("noms"))),
    });
  }

  // Colonnes

  async ajouterColonne({
    idTableau,
    idVariable,
    idColonne,
  }: {
    idTableau: string;
    idVariable?: string;
    idColonne?: string;
  }): Promise<string> {
    await this.confirmerPermission({ idTableau });

    const { tableau, oublier } = await this.ouvrirTableau({ idTableau });

    idColonne = idColonne || uuidv4();
    const élément = {
      variable: idVariable,
    };
    await tableau.put(`colonnes/${idColonne}`, élément);

    await oublier();
    return idColonne;
  }

  async effacerColonne({
    idTableau,
    idColonne,
  }: {
    idTableau: string;
    idColonne: string;
  }): Promise<void> {
    await this.confirmerPermission({ idTableau });

    const { tableau, oublier } = await this.ouvrirTableau({ idTableau });

    await tableau.del(`colonnes/${idColonne}`);

    await oublier();
  }

  @cacheSuivi
  async suivreColonnes({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: Suivi<InfoColonne[] | undefined>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");
    return await orbite.suivreDonnéesBd({
      id: idTableau,
      type: "nested",
      schéma: schémaTableau,
      f: async (tableau) => {
        const colonnes = mapÀObjet(tableau.get("colonnes"));
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
  async suivreColonnesEtCatégoriesTableau({
    idTableau,
    f,
  }: {
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
    idTableau,
    f,
  }: {
    idTableau: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    return await orbite.suivreDonnéesBd({
      id: idTableau,
      type: "nested",
      schéma: schémaTableau,
      f: async (tableau) => {
        const colonnes = mapÀObjet(tableau.get("colonnes"));
        await f(
          Object.values(colonnes || [])
            .map((c) => c.variable)
            .filter((v): v is string => !!v && adresseOrbiteValide(v)),
        );
      },
    });
  }

  // Données

  @cacheSuivi
  async suivreDonnées<T extends DonnéesFileTableau>({
    idTableau,
    f,
    clefsSelonVariables = false,
  }: {
    idTableau: string;
    f: Suivi<DonnéesFileTableauAvecId<T>[]>;
    clefsSelonVariables?: boolean;
  }): Promise<Oublier> {
    const info: {
      données?: { [id: string]: T };
      colonnes?: { [key: string]: string | undefined };
    } = {};

    const fFinale = async () => {
      const { données, colonnes } = info;

      if (données && colonnes) {
        const donnéesFinales: DonnéesFileTableauAvecId<T>[] = Object.entries(
          données,
        ).map(([id, élément]): DonnéesFileTableauAvecId<T> => {
          const données: T = clefsSelonVariables
            ? Object.keys(élément).reduce((acc: T, elem: string) => {
                // Convertir au nom de la variable si souhaité
                const idVar = elem === "id" ? "id" : colonnes[elem];
                (acc as DonnéesFileTableau)[idVar || elem] = élément[elem];
                return acc;
              }, {} as T)
            : élément;

          return { données, id };
        });
        await f(donnéesFinales);
      }
    };

    const oublierColonnes = await this.suivreColonnes({
      idTableau,
      f: async (colonnes) => {
        info.colonnes = Object.fromEntries(
          (colonnes || []).map((c) => [c.id, c.variable]),
        );
        await fFinale();
      },
    });

    const orbite = this.service("orbite");
    const oublierDonnées = await orbite.suivreBdTypée({
      id: idTableau,
      type: "nested",
      schéma: schémaTableau,
      f: async (tbx) => {
        const données = mapÀObjet(await tbx.get("données"));
        info.données = données as { [id: string]: T } | undefined; // Il faudrait implémenter un schéma dynamique selon T
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
    idTableau,
    langues,
    f,
  }: {
    idTableau: string;
    langues?: string[];
    f: Suivi<DonnéesTableauExportées>;
  }): Promise<Oublier> {
    const variables = this.service("variables");

    const info: {
      nomsTableau?: { [clef: string]: string };
      nomsVariables?: { [idVar: string]: TraducsTexte };
      colonnes?: InfoColonneAvecCatégorie[];
      données?: DonnéesFileTableauAvecId[];
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
          Object.keys(d).reduce((acc: DonnéesFileTableau, idCol: string) => {
            const idVar = colonnes.find((c) => c.id === idCol)?.variable;
            if (!idVar)
              throw new Error(
                `Colonnne avec id ${idCol} non trouvée parmis les colonnnes :\n${JSON.stringify(
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
      const fOublierNomsTableaux = await this.suivreNomsTableau({
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
    idTableau,
    langues,
    doc,
    nomFichier,
    patience = 500,
  }: {
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
          données: DonnéesFileTableau[];
          fichiersSFIP: Set<string>;
        }>,
      ): Promise<Oublier> => {
        return await this.suivreDonnéesExportation({
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
    idTableau,
    langues,
    doc,
    nomFichier,
    patience = 500,
    formatDoc,
    dossier = "",
    inclureDocuments = true,
  }: {
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
    é: DonnéesFileTableau;
    colonnes: InfoColonneAvecCatégorie[];
    fichiersSFIP: Set<string>;
    langues?: string[];
    traducs?: TraducsTexte;
  }): Promise<DonnéesFileTableau> {
    const élémentFinal: DonnéesFileTableau = {};

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
