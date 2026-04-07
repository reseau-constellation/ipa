import {
  attendreStabilité,
  effacerPropriétésNonDéfinies,
  ignorerNonDéfinis,
  suivreDeFonctionListe,
  suivreFonctionImbriquée,
  traduire,
  uneFois,
} from "@constl/utils-ipa";
import deepEqual from "deep-equal";
import md5 from "crypto-js/md5.js";
import Base64 from "crypto-js/enc-base64url.js";
import { v4 as uuidv4 } from "uuid";
import { utils } from "xlsx";
import { எண்ணிக்கை as எண்ணிக்கை_வகை } from "ennikkai";
import { isElectronMain, isNode } from "wherearewe";
import axios from "axios";
import { typedNested, type TypedNested } from "@constl/bohr-db";
import gjv from "geojson-validation";
import { cholqij } from "@/dates.js";
import { Tableaux } from "../tableaux.js";
import { cacheSuivi } from "../nébuleuse/cache.js";
import {
  enleverPréfixes,
  idcEtFichierValide,
  justeDéfinis,
  obtIdIndex,
  sauvegarderDonnéesExportées,
} from "../utils.js";
import { estContrôleurNébuleuse } from "../nébuleuse/services/compte/accès/contrôleurNébuleuse.js";
import type { CatégorieBaseVariables } from "../variables.js";
import type { DagCborEncodable } from "@orbitdb/core";
import type { JSONSchemaType } from "ajv";
import type { BookType, WorkBook } from "xlsx";
import type { ErreurDonnée, FonctionValidation } from "../règles.js";
import type {
  DonnéesRangéeTableau,
  DonnéesRangéeTableauAvecId,
  InfoColonne,
  InfoColonneAvecCatégorie,
} from "../tableaux.js";
import type { Oublier, Suivi } from "../nébuleuse/types.js";
import type { PartielRécursif, TraducsTexte } from "../types.js";
import type { DonnéesFichierBdExportées } from "../utils.js";

let எண்ணிக்கை: எண்ணிக்கை_வகை | undefined = undefined;
const obtEnnikkai = () => {
  if (!எண்ணிக்கை) எண்ணிக்கை = new எண்ணிக்கை_வகை({});
  return எண்ணிக்கை;
};

// Types données tableaux

export type DonnéesTableauExportées = {
  nomTableau: string;
  données: DonnéesRangéeTableau[];
  documentsMédias: Set<string>;
};

// Types conversions

export type DonnéeImportation =
  | string
  | number
  | null
  | boolean
  | DonnéeImportation[]
  | { [key: string]: DonnéeImportation }
  | Date
  | Uint8Array
  | undefined;

export type DonnéesRangéeTableauÀImporter = {
  [clef: string]: DonnéeImportation;
};

export type ConversionColonne<T extends ConversionDonnées = ConversionDonnées> =
  {
    colonne: string;
    typeCatégorie?: "simple" | "liste";
    conversion: T;
  };

export type ConversionDonnées =
  | ConversionDonnéesNumérique
  | ConversionDonnéesChaîne
  | ConversionDonnéesFichier
  | ConversionDonnéesAudio
  | ConversionDonnéesVidéo
  | ConversionDonnéesImage
  | ConversionDonnéesBooléen
  | ConversionDonnéesChaîneNonTraductible
  | ConversionDonnéesHoroDatage
  | ConversionDonnéesIntervaleTemps
  | ConversionDonnéesGéojson;

export type ConversionDonnéesNumérique = {
  type: "numérique";
  opération?: OpérationConversionNumérique | OpérationConversionNumérique[];
  systèmeNumération?: string;
};

export type OpérationConversionNumérique = {
  op: "+" | "-" | "/" | "*" | "^";
  val: number;
};

export type ConversionDonnéesChaîne = {
  type: "chaîne";
  langue?: string;
};

export type ConversionDonnéesFichiers =
  | ConversionDonnéesFichier
  | ConversionDonnéesAudio
  | ConversionDonnéesImage
  | ConversionDonnéesVidéo;

export type ConversionDonnéesFichier = {
  type: "fichier";
  baseChemin?: string;
};

export type ConversionDonnéesAudio = Omit<ConversionDonnéesFichier, "type"> & {
  type: "audio";
};

export type ConversionDonnéesImage = Omit<ConversionDonnéesFichier, "type"> & {
  type: "image";
};

export type ConversionDonnéesVidéo = Omit<ConversionDonnéesFichier, "type"> & {
  type: "vidéo";
};

export type ConversionDonnéesBooléen = {
  type: "booléen";
};

export type ConversionDonnéesChaîneNonTraductible = {
  type: "chaîneNonTraductible";
};

export type ConversionDonnéesHoroDatage = {
  type: "horoDatage";
  détails?: {
    système: string;
    format?: string;
  };
};

export type ConversionDonnéesIntervaleTemps = {
  type: "intervaleTemps";
};

export type ConversionDonnéesGéojson = {
  type: "géojson";
};

// Types structure

export type ÉlémentDonnéesTableau = { [clef: string]: DagCborEncodable };

export type StructureDonnéesTableau = {
  [id: string]: ÉlémentDonnéesTableau;
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

// Tableaux

export class TableauxBds extends Tableaux {
  async créerTableau({
    idStructure,
    idTableau,
  }: {
    idStructure: string;
    idTableau: string;
  }): Promise<string> {
    await super.créerTableau({ idStructure, idTableau });

    const compte = this.service("compte");
    const orbite = this.service("orbite");

    const { bd: bdStructure, oublier: oublierStructure } =
      await orbite.ouvrirBd({ id: enleverPréfixes(idStructure) });

    if (!estContrôleurNébuleuse(bdStructure.access))
      throw new Error(`Type d'accès ${bdStructure.access.type} non reconnu.`);

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
    idStructureDestinataire,
    copierDonnées = true,
  }: {
    idStructure: string;
    idTableau: string;
    idStructureDestinataire?: string;
    copierDonnées?: boolean;
  }): Promise<string> {
    idStructureDestinataire ??= idStructure;

    const idNouveauTableau = await super.copierTableau({
      idStructure,
      idTableau,
      idStructureDestinataire,
    });

    // Copier les données
    if (copierDonnées) {
      const { données: bdDonnées, oublier: oublierDonnées } =
        await this.ouvrirDonnéesTableau({ idStructure, idTableau });
      const données = await bdDonnées.all();
      await oublierDonnées();

      if (données) {
        const { données: nouvelleBdDonnées, oublier: oublierNouvellesDonnées } =
          await this.ouvrirDonnéesTableau({
            idStructure: idStructureDestinataire,
            idTableau: idNouveauTableau,
          });
        await nouvelleBdDonnées.insert(données);
        await oublierNouvellesDonnées();
      }
    }

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
    const idDonnées = await this.obtIdDonnées({
      idStructure,
      idTableau,
      attendre: false,
    });

    if (idDonnées) await orbite.effacerBd({ id: idDonnées });

    // Effacer la référence au tableau
    await super.effacerTableau({ idStructure, idTableau });
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
      données: typedNested<StructureDonnéesTableau>({
        db: bd,
        schema: schémaDonnéesTableau,
      }),
      oublier,
    };
  }

  // Données
  async obtIdDonnées(args: {
    idStructure: string;
    idTableau: string;
    attendre: true;
  }): Promise<string>;
  async obtIdDonnées(args: {
    idStructure: string;
    idTableau: string;
  }): Promise<string>;
  async obtIdDonnées(args: {
    idStructure: string;
    idTableau: string;
    attendre: false;
  }): Promise<string | undefined>;
  async obtIdDonnées({
    idStructure,
    idTableau,
    attendre = true,
  }: {
    idStructure: string;
    idTableau: string;
    attendre?: boolean;
  }): Promise<string | undefined> {
    if (attendre) {
      return await uneFois((f) =>
        this.suivreIdDonnées({
          idStructure,
          idTableau,
          f: (id) => ignorerNonDéfinis(f)(id),
        }),
      );
    }
    const { tableau, oublier } = await this.ouvrirTableau({
      idStructure,
      idTableau,
    });
    const idDonnées = await tableau.get("données");
    await oublier();

    return idDonnées;
  }

  async suivreIdDonnées({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<string | undefined>;
  }): Promise<Oublier> {
    return await this.suivreTableau({
      idStructure,
      idTableau,
      f: async (tableau) => await f(tableau?.données),
    });
  }

  async ajouterÉléments({
    idStructure,
    idTableau,
    éléments,
  }: {
    idStructure: string;
    idTableau: string;
    éléments: ÉlémentDonnéesTableau[];
  }): Promise<string[]> {
    await this.confirmerPermission({ idStructure });

    const { données, oublier } = await this.ouvrirDonnéesTableau({
      idStructure,
      idTableau,
    });

    const ids = await Promise.all(
      éléments.map(async (val) => {
        const id = uuidv4();
        await données.put(id, val);
        return id;
      }),
    );

    await oublier();

    return ids;
  }

  async modifierÉlément({
    idStructure,
    idTableau,
    vals,
    idÉlément,
  }: {
    idStructure: string;
    idTableau: string;
    vals: Partial<ÉlémentDonnéesTableau>;
    idÉlément: string;
  }): Promise<void> {
    await this.confirmerPermission({ idStructure });

    const { données, oublier } = await this.ouvrirDonnéesTableau({
      idStructure,
      idTableau,
    });

    const précédent = await données.get(idÉlément);
    if (!précédent) throw new Error(`Id élément ${idÉlément} n'existe pas.`);

    const élément = Object.assign({}, précédent, vals);

    await Promise.all(
      Object.keys(vals).map(async (c: string) => {
        if (vals[c] === undefined) {
          delete élément[c];
          await données.del(`${idÉlément}/${c}`);
          delete précédent[c];
        }
      }),
    );

    if (!deepEqual(élément, précédent)) {
      await données.insert(idÉlément, élément);
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
    const { données, oublier } = await this.ouvrirDonnéesTableau({
      idStructure,
      idTableau,
    });

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
    const orbite = this.service("orbite");

    const info: {
      données?: { [id: string]: T };
      variablesColonnes?: { [key: string]: string | undefined };
    } = {};

    const fFinale = async () => {
      const { données, variablesColonnes } = info;

      if (données && variablesColonnes) {
        // Enlever les données qui ne sont pas dans les colonnes
        const donnéesFinales: DonnéesRangéeTableauAvecId<T>[] = Object.entries(
          données,
        ).map(([id, élément]): DonnéesRangéeTableauAvecId<T> => {
          élément = Object.fromEntries(
            Object.entries(élément).filter(([col, _val]) =>
              Object.keys(variablesColonnes).includes(col),
            ),
          ) as T;

          // Si désiré, convertir les colonnes en nom de variable
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
          f: async (tableau) => await fSuivreRacine(tableau?.données),
        }),
      fSuivre: async ({ id: idDonnées, fSuivre }) =>
        orbite.suivreDonnéesBdEmboîtée({
          id: idDonnées,
          schéma: schémaDonnéesTableau,
          f: fSuivre,
        }),
      f: async (données?: PartielRécursif<StructureDonnéesTableau>) => {
        if (données) info.données = données as { [id: string]: T } | undefined; // Il faudrait implémenter un schéma dynamique selon T
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
      idTableau: string;
    };
    à: {
      idStructure: string;
      idTableau: string;
    };
    patience?: number;
  }): Promise<string[]> {
    const pDonnéesTableauSource = uneFois(
      async (fSuivi: Suivi<DonnéesRangéeTableauAvecId[]>) => {
        return await this.suivreDonnées({
          ...de,
          f: fSuivi,
        });
      },
      attendreStabilité(patience),
    );
    const pDonnéesTableauDestinataire = uneFois(
      async (fSuivi: Suivi<DonnéesRangéeTableauAvecId[]>) => {
        return await this.suivreDonnées({ ...à, f: fSuivi });
      },
      attendreStabilité(patience),
    );
    const pColsTableauDestinataire = uneFois(
      async (fSuivi: Suivi<InfoColonne[]>) => {
        return await this.suivreColonnes({
          ...à,
          f: ignorerNonDéfinis(fSuivi),
        });
      },
      attendreStabilité(patience),
    );

    const [
      donnéesTableauSource,
      donnéesTableauDestinataire,
      colsTableauDestinataire,
    ] = await Promise.all([
      pDonnéesTableauSource,
      pDonnéesTableauDestinataire,
      pColsTableauDestinataire,
    ]);

    const colonnes = await uneFois(
      async (fSuivi: Suivi<InfoColonne[]>) =>
        await this.suivreColonnes({
          ...à,
          f: ignorerNonDéfinis(fSuivi),
        }),
    );
    const index = colonnes.filter((c) => c.index).map((c) => c.id);
    const identiques = (
      élément1: DonnéesRangéeTableau,
      élément2: DonnéesRangéeTableau,
    ) => {
      if (index.length)
        return obtIdIndex(élément1, index) === obtIdIndex(élément2, index);
      return deepEqual(élément1, élément2);
    };

    const élémentsÀAjouter = [];
    for (const nouvelÉlément of donnéesTableauSource) {
      const existant = donnéesTableauDestinataire.find((d) =>
        identiques(d.données, nouvelÉlément.données),
      );

      if (existant) {
        const àAjouter: DonnéesRangéeTableau = {};
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
            ...à,
            idÉlément: existant.id,
          });
          élémentsÀAjouter.push(Object.assign({}, existant.données, àAjouter));
        }
      } else {
        élémentsÀAjouter.push(nouvelÉlément.données);
      }
    }
    return await this.ajouterÉléments({
      ...à,
      éléments: élémentsÀAjouter,
    });
  }

  // Validation

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
      données?: DonnéesRangéeTableauAvecId[];
      règles?: FonctionValidation[];
    } = {};

    const fFinale = async () => {
      if (!info.données || !info.règles) return;

      const erreurs: ErreurDonnée[] = [];
      for (const r of info.règles) {
        const nouvellesErreurs = r(info.données);
        erreurs.push(...nouvellesErreurs);
      }
      await f(erreurs);
    };

    const oublierValidateursDonnées = await this.suivreValidateursDonnées({
      idStructure,
      idTableau,
      f: async (validateurs) => {
        info.règles = validateurs;
        await fFinale();
      },
      résolveurDonnéesCatégorie: this.suivreDonnées.bind(this),
    });

    const oublierDonnées = await this.suivreDonnées({
      idStructure,
      idTableau,
      f: async (données) => {
        info.données = données;
        await fFinale();
      },
    });

    const oublier = async () => {
      await oublierValidateursDonnées();
      await oublierDonnées();
    };
    return oublier;
  }

  // Empreintes

  async suivreEmpreinteTête({
    idStructure,
    idTableau,
    f,
  }: {
    idStructure: string;
    idTableau: string;
    f: Suivi<string>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    return await suivreFonctionImbriquée({
      fRacine: async ({ fSuivreRacine }) =>
        await this.suivreTableau({
          idStructure,
          idTableau,
          f: async (tableau) => await fSuivreRacine(tableau?.données),
        }),
      fSuivre: async ({ id: idDonnées, fSuivre }) =>
        await orbite.suivreEmpreinteTêteBd({ idBd: idDonnées, f: fSuivre }),
      f: ignorerNonDéfinis(f),
    });
  }

  // Importation

  async importerDonnées({
    idStructure,
    idTableau,
    données,
    patience = 100,
  }: {
    idStructure: string;
    idTableau: string;
    données: DonnéesRangéeTableau[];
    patience?: number;
  }): Promise<void> {
    const donnéesTableau = await uneFois(
      async (fSuivi: Suivi<DonnéesRangéeTableauAvecId[]>) => {
        return await this.suivreDonnées({ idStructure, idTableau, f: fSuivi });
      },
      attendreStabilité(patience),
    );

    const nouveaux: DonnéesRangéeTableau[] = [];
    for (const élément of données) {
      if (!donnéesTableau.some((x) => deepEqual(x.données, élément))) {
        nouveaux.push(élément);
      }
    }

    const àEffacer: string[] = [];
    for (const élément of donnéesTableau) {
      if (!données.some((x) => deepEqual(x, élément.données))) {
        àEffacer.push(élément.id);
      }
    }

    for (const id of àEffacer) {
      await this.effacerÉlément({ idStructure, idTableau, idÉlément: id });
    }
    console.log(nouveaux, àEffacer);
    await this.ajouterÉléments({ idStructure, idTableau, éléments: nouveaux });
  }

  async convertirDonnées({
    données,
    conversions,
    traductions = {},
  }: {
    données: DonnéesRangéeTableauÀImporter[];
    conversions: ConversionColonne[];
    traductions?: { [clef: string]: TraducsTexte };
  }): Promise<{
    converties: DonnéesRangéeTableau[];
    traductions: { [clef: string]: TraducsTexte };
  }> {
    if (!conversions.length)
      return {
        // @ts-expect-error Le type de `effacerPropriétésNonDéfinies` exclut `null`
        converties: données.map(effacerPropriétésNonDéfinies),
        traductions: {},
      };

    const hélia = this.service("hélia");

    const convertirRangée = async (
      rangée: DonnéesRangéeTableauÀImporter,
    ): Promise<DonnéesRangéeTableau> => {
      const convertie: DonnéesRangéeTableau = {};

      for (const colonne of Object.keys(rangée)) {
        const valeur = rangée[colonne];

        const conversionColonne = conversions.find(
          (c) => c.colonne === colonne,
        );
        if (!conversionColonne) continue;

        const valeurColonne = await convertirValeur({
          valeur,
          conversion: conversionColonne,
        });
        if (valeurColonne !== undefined) convertie[colonne] = valeurColonne;
      }

      return convertie;
    };

    const appliquerOpérationsNumériques = ({
      val,
      ops,
    }: {
      val: number;
      ops: OpérationConversionNumérique | OpérationConversionNumérique[];
    }): number => {
      ops = Array.isArray(ops) ? ops : [ops];

      let valFinale = val;
      for (const op of ops) {
        switch (op.op) {
          case "+":
            valFinale = valFinale + op.val;
            break;
          case "-":
            valFinale = valFinale - op.val;
            break;
          case "*":
            valFinale = valFinale * op.val;
            break;
          case "/":
            valFinale = valFinale / op.val;
            break;
          case "^":
            valFinale = valFinale ** op.val;
            break;
          default:
            throw new Error(op.op);
        }
      }
      return valFinale;
    };

    const estContenuFichier = (
      x: unknown,
    ): x is { contenu: Uint8Array; nomFichier: string } => {
      if (typeof x !== "object") return false;
      const { contenu, nomFichier } = x as {
        contenu: Uint8Array;
        nomFichier: string;
      };
      return contenu instanceof Uint8Array && typeof nomFichier === "string";
    };
    const cacheFichiers = new Map<string, string>();
    const résoudreFichier = async ({
      chemin,
      conversion,
    }: {
      chemin: string;
      conversion?: ConversionDonnéesFichiers;
    }): Promise<string | undefined> => {
      try {
        new URL(chemin);
        if (cacheFichiers.has(chemin)) return cacheFichiers.get(chemin);

        const contenuFichier = (await axios.get(chemin)).data;
        const composantesUrl = chemin.split("/");
        const nomFichier = composantesUrl.pop() || composantesUrl.pop();
        if (!nomFichier) throw new Error("Nom de fichier manquant.");

        const idc = await hélia.ajouterFichierÀSFIP({
          contenu: contenuFichier,
          nomFichier,
        });

        cacheFichiers.set(chemin, idc);
        return idc;
      } catch {
        // Rien à faire;
      }

      if (isNode || isElectronMain) {
        const fs = await import("fs");
        const path = await import("path");

        const cheminAbsolut = path.isAbsolute(chemin)
          ? chemin
          : conversion?.baseChemin
            ? path.resolve(conversion.baseChemin, chemin)
            : chemin;

        if (cacheFichiers.has(cheminAbsolut))
          return cacheFichiers.get(cheminAbsolut);

        if (!fs.existsSync(cheminAbsolut)) return;

        const contenuFichier = fs.readFileSync(cheminAbsolut);

        const idc = await hélia.ajouterFichierÀSFIP({
          contenu: contenuFichier,
          nomFichier: path.basename(cheminAbsolut),
        });

        cacheFichiers.set(chemin, idc);

        return idc;
      }

      return undefined;
    };

    const convertirValeur = async ({
      valeur,
      conversion,
    }: {
      valeur: DonnéeImportation;
      conversion: ConversionColonne;
    }): Promise<DagCborEncodable | undefined> => {
      const typeCatégorie = conversion.typeCatégorie || "simple";
      if (typeCatégorie === "simple") {
        return await convertirValeurSimple({
          valeur,
          conversion: conversion.conversion,
        });
      } else {
        let valeurListe: DonnéeImportation[];

        if (!Array.isArray(valeur)) {
          if (typeof valeur === "string") {
            try {
              const valeurJSON = JSON.parse(valeur) as DagCborEncodable;
              valeurListe = Array.isArray(valeurJSON)
                ? valeurJSON
                : [valeurJSON];
            } catch {
              valeurListe = [valeur];
            }
          } else {
            valeurListe = [valeur];
          }
        } else {
          valeurListe = valeur;
        }
        return justeDéfinis(
          await Promise.all(
            valeurListe.map(
              async (val) =>
                await convertirValeurSimple({
                  valeur: val,
                  conversion: conversion.conversion,
                }),
            ),
          ),
        );
      }
    };

    const nouvellesTraductions: { [clef: string]: TraducsTexte } = {};
    const convertirValeurSimple = async ({
      valeur,
      conversion,
    }: {
      valeur: DonnéeImportation;
      conversion: ConversionDonnées;
    }): Promise<DagCborEncodable | undefined> => {
      const catégorie: CatégorieBaseVariables = conversion.type;

      switch (catégorie) {
        case "audio":
        case "image":
        case "vidéo":
        case "fichier": {
          const conversionFichier =
            conversion.type === "fichier" ||
            conversion.type === "audio" ||
            conversion.type === "image" ||
            conversion.type === "vidéo"
              ? conversion
              : undefined;
          if (typeof valeur === "string") {
            if (idcEtFichierValide(valeur)) return valeur;
            return résoudreFichier({
              chemin: valeur,
              conversion: conversionFichier,
            });
          } else if (estContenuFichier(valeur)) {
            const idc = await hélia.ajouterFichierÀSFIP(valeur);
            return idc;
          }
          return undefined;
        }

        case "booléen": {
          if (typeof valeur === "boolean") return valeur;
          else if (typeof valeur === "number")
            return valeur === 1 ? true : valeur === 0 ? false : undefined;
          else if (typeof valeur === "string")
            return valeur.toLowerCase() === "vrai"
              ? true
              : valeur.toLowerCase() === "faux"
                ? false
                : undefined;
          return undefined;
        }

        case "chaîneNonTraductible":
          return valeur === undefined
            ? undefined
            : typeof valeur === "object"
              ? JSON.stringify(valeur)
              : String(valeur);

        case "chaîne": {
          const conversionChaîne =
            conversion.type === "chaîne" ? conversion : undefined;

          if (valeur === undefined) return undefined;
          valeur =
            typeof valeur === "object"
              ? JSON.stringify(valeur)
              : String(valeur);

          const traductionsÀJour = Object.assign(
            {},
            traductions,
            nouvellesTraductions,
          );
          if (conversionChaîne?.langue) {
            const { langue } = conversionChaîne;
            let clef = Object.entries(traductionsÀJour).find(
              ([_clef, traducs]) => traducs[langue] === valeur,
            )?.[0];
            if (!clef) {
              // On utilise md5 au lieu de uuidv4 en raison de la concurrence avec des conversions parallèles de données
              clef =
                valeur.length <= 24 ? valeur : Base64.stringify(md5(valeur));
              nouvellesTraductions[clef] = { [langue]: valeur };
            }
            return clef;
          } else if (Object.keys(traductionsÀJour).includes(valeur))
            return valeur;
          else {
            const clef = Object.entries(traductionsÀJour).find(
              ([_clef, traducs]) =>
                Object.values(traducs).find((texte) => texte === valeur),
            )?.[0];
            return clef ? clef : valeur;
          }
        }

        case "numérique": {
          const conversionNumérique =
            conversion?.type === "numérique" ? conversion : undefined;
          let valNumérique: number | undefined = undefined;

          const { opération, systèmeNumération } = conversionNumérique || {};

          if (typeof valeur === "number") {
            valNumérique = valeur;
          } else if (typeof valeur === "string") {
            try {
              if (systèmeNumération) {
                valNumérique = obtEnnikkai().எண்ணுக்கு({
                  உரை: valeur,
                  மொழி: systèmeNumération,
                });
              } else {
                valNumérique = Number(valeur);
                if (isNaN(valNumérique)) {
                  valNumérique = obtEnnikkai().எண்ணுக்கு({
                    உரை: valeur,
                  });
                }
              }
            } catch {
              // Rien à faire...
              valNumérique = undefined;
            }
          }

          if (valNumérique !== undefined && opération) {
            valNumérique = appliquerOpérationsNumériques({
              val: valNumérique,
              ops: opération,
            });
          }
          return valNumérique;
        }

        case "horoDatage": {
          const conversionHoroDatage =
            conversion?.type === "horoDatage" ? conversion : undefined;
          if (cholqij.dateValide(valeur)) {
            return valeur;
          } else if (
            conversionHoroDatage?.détails &&
            typeof valeur === "string"
          ) {
            const date = cholqij.lireDate({
              val: valeur,
              ...conversionHoroDatage.détails,
            });
            return {
              système: "dateJS",
              val: date.getTime(),
            };
          } else if (valeur instanceof Date) {
            return {
              système: "dateJS",
              val: valeur.getTime(),
            };
          } else if (typeof valeur === "number" || typeof valeur === "string") {
            const date = new Date(valeur);
            return isNaN(date.getTime())
              ? undefined
              : {
                  système: "dateJS",
                  val: date.getTime(),
                };
          }
          return undefined;
        }

        case "intervaleTemps": {
          try {
            const valObjet =
              typeof valeur === "string" ? JSON.parse(valeur) : valeur;
            if (Array.isArray(valObjet) && valObjet.length === 2) {
              const dates = justeDéfinis(
                await Promise.all(
                  valObjet.map(
                    async (v) =>
                      await convertirValeurSimple({
                        valeur: v,
                        conversion: { type: "horoDatage" },
                      }),
                  ),
                ),
              );
              if (dates.length === 2) return dates;
            }
          } catch {
            return undefined;
          }
          return undefined;
        }

        case "géojson": {
          if (typeof valeur === "string") {
            try {
              valeur = JSON.parse(valeur);
            } catch {
              return undefined;
            }
          }
          if (
            typeof valeur !== "object" ||
            valeur instanceof Date ||
            Array.isArray(valeur)
          )
            return undefined;

          return gjv.valid(valeur) ? (valeur as DagCborEncodable) : undefined;
        }

        default:
          return undefined;
      }
    };

    const converties = await Promise.all(données.map(convertirRangée));
    return { converties, traductions: nouvellesTraductions };
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
      traducs?: { [clef: string]: Partial<TraducsTexte> };
    } = {};
    const fsOublier: Oublier[] = [];

    const fFinale = async () => {
      const { colonnes, données, nomsTableau, nomsVariables, traducs } = info;

      if (colonnes && données && (!langues || (nomsTableau && nomsVariables))) {
        const documentsMédias: Set<string> = new Set();

        let donnéesFormattées = await Promise.all(
          données.map((d) =>
            this.formaterÉlément({
              élément: d.données,
              documentsMédias,
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

              const nomVar =
                idVar && langues && nomsVariables?.[idVar]
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
    docu,
    nomFichier,
    patience = 500,
  }: {
    idStructure: string;
    idTableau: string;
    langues?: string[];
    docu?: WorkBook;
    nomFichier?: string;
    patience?: number;
  }): Promise<DonnéesFichierBdExportées> {
    /* Créer le document si nécessaire */
    docu = docu || utils.book_new();

    const données = await uneFois(
      async (
        fSuivi: Suivi<{
          nomTableau: string;
          données: DonnéesRangéeTableau[];
          documentsMédias: Set<string>;
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
    utils.book_append_sheet(docu, tableau, données.nomTableau.slice(0, 30));

    nomFichier = nomFichier || données.nomTableau;
    return { docu, documentsMédias: données.documentsMédias, nomFichier };
  }

  async exporterDonnéesÀFichier({
    idStructure,
    idTableau,
    langues,
    nomFichier,
    patience = 500,
    formatDocu,
    dossier = "",
    inclureDocuments = true,
    dossierMédias,
  }: {
    idStructure: string;
    idTableau: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
    formatDocu: BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
    dossierMédias?: string;
  }): Promise<string> {
    const hélia = this.service("hélia");

    const donnéesExportées = await this.exporterDonnées({
      idStructure,
      idTableau,
      langues,
      nomFichier,
      patience,
    });

    return await sauvegarderDonnéesExportées({
      données: donnéesExportées,
      formatDocu,
      dossier,
      inclureDocuments,
      obtItérableAsyncSFIP: hélia.obtItérableAsyncSFIP.bind(hélia),
      dossierMédias,
    });
  }
}
