import path from "path";
import toBuffer from "it-to-buffer";
import { write as xlsxWrite, utils as xlsxUtils } from "xlsx";

type ContrôleurConstellation = Awaited<
  ReturnType<ReturnType<typeof générerContrôleurConstellation>>
>;

import {
  adresseOrbiteValide,
  attendreStabilité,
  suivreDeFonctionListe,
  traduire,
  uneFois,
  zipper,
} from "@constl/utils-ipa";
import { schémaStructureBdNoms } from "@/types.js";
import { estUnContrôleurConstellation } from "./accès/utils.js";
import { ComposanteClientListe } from "./v2/nébuleuse/services.js";
import { INSTALLÉ, TOUS, résoudreDéfauts } from "./favoris.js";
import { conversionsTypes } from "./v2/utils.js";
import type { TypedKeyValue, TypedSet } from "@constl/bohr-db";
import type { JSONSchemaType } from "ajv";
import type {
  PartielRécursif,
  TraducsTexte,
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaStatut,
  structureBdNoms,
} from "@/types.js";
import type { Constellation } from "@/client.js";
import type { donnéesBdExportation, schémaCopiéDe } from "./bds.js";
import type { ÉpingleFavorisAvecId, ÉpingleProjet } from "./favoris.js";
import type xlsx from "xlsx";
import type { objRôles } from "@/accès/types.js";
import type { ContrôleurConstellation as générerContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import { cacheSuivi } from "@/décorateursCache.js";

const schémaStructureBdMotsClefsdeProjet: JSONSchemaType<string> = {
  type: "string",
};
const schémaStuctureBdsDeProjet: JSONSchemaType<string> = { type: "string" };

export interface donnéesProjetExportation {
  nomProjet: string;
  bds: donnéesBdExportation[];
}

export interface donnéesProjetExportées {
  docs: { doc: xlsx.WorkBook; nom: string }[];
  fichiersSFIP: Set<string>;
  nomFichier: string;
}

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

const schémaBdPrincipale: JSONSchemaType<string> = { type: "string" };

export class Projets extends ComposanteClientListe<string> {
  constructor({ client }: { client: Constellation }) {
    super({ client, clef: "projets", schémaBdPrincipale: schémaBdPrincipale });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisAvecId<ÉpingleProjet>;
    f: schémaFonctionSuivi<Set<string>>;
  }): Promise<schémaFonctionOublier> {
    const épinglerBase = await this.client.favoris.estÉpingléSurDispositif({
      dispositifs: épingle.épingle.base || "TOUS",
    });
    const épinglerBds = épingle.épingle.bds;

    const info: {
      base?: (string | undefined)[];
      bds?: (string | undefined)[];
    } = {};
    const fFinale = async () => {
      return await f(
        new Set(
          Object.values(info)
            .flat()
            .filter((x) => !!x) as string[],
        ),
      );
    };

    const fsOublier: schémaFonctionOublier[] = [];
    if (épinglerBase) {
      const fOublierBase = await this.client.suivreBd({
        id: épingle.idObjet,
        type: "keyvalue",
        schéma: schémaStructureBdProjet,
        f: async (bd) => {
          try {
            const contenuBd = await bd.allAsJSON();
            if (épinglerBase)
              info.base = [
                épingle.idObjet,
                contenuBd.descriptions,
                contenuBd.noms,
                contenuBd.bds,
                contenuBd.motsClefs,
                contenuBd.image,
              ];
          } catch {
            return; // Si la structure n'est pas valide.
          }
          await fFinale();
        },
      });
      fsOublier.push(fOublierBase);
    }

    if (épinglerBds) {
      const fOublierBds = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }) => {
          return await this.suivreBdsProjet({
            idProjet: épingle.idObjet,
            f: fSuivreRacine,
          });
        },
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: schémaFonctionSuivi<string[]>;
        }) => {
          return this.client.bds.suivreRésolutionÉpingle({
            épingle: {
              idObjet: id,
              épingle: épinglerBds,
            },
            f: (idcs) => fSuivreBranche([...idcs]),
          });
        },
        f: async (idcs: string[]) => {
          info.bds = idcs;
          await fFinale();
        },
      });

      fsOublier.push(fOublierBds);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }


  async suivreDonnéesExportation({
    idProjet,
    langues,
    f,
  }: {
    idProjet: string;
    langues?: string[];
    f: schémaFonctionSuivi<donnéesProjetExportation>;
  }): Promise<schémaFonctionOublier> {
    const info: {
      nomsProjet?: TraducsTexte;
      données?: donnéesBdExportation[];
    } = {};
    const fsOublier: schémaFonctionOublier[] = [];

    const fFinale = async () => {
      const { nomsProjet, données } = info;
      if (!données) return;

      const idCourt = idProjet.split("/").pop()!;
      const nomProjet =
        nomsProjet && langues
          ? traduire(nomsProjet, langues) || idCourt
          : idCourt;
      return await f({
        nomProjet,
        bds: données,
      });
    };

    const fOublierDonnées = await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: string[]) => Promise<void>;
      }) => {
        return await this.suivreBdsProjet({ idProjet, f: fSuivreRacine });
      },
      f: async (données: donnéesBdExportation[]) => {
        info.données = données;
        await fFinale();
      },
      fBranche: async ({
        id,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<donnéesBdExportation>;
      }): Promise<schémaFonctionOublier> => {
        return await this.client.bds.suivreDonnéesExportation({
          idBd: id,
          langues,
          f: fSuivreBranche,
        });
      },
    });
    fsOublier.push(fOublierDonnées);

    if (langues) {
      const fOublierNomsProjet = await this.suivreNomsProjet({
        idProjet,
        f: async (noms) => {
          info.nomsProjet = noms;
          await fFinale();
        },
      });
      fsOublier.push(fOublierNomsProjet);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  async exporterDonnées({
    idProjet,
    langues,
    nomFichier,
    patience = 500,
  }: {
    idProjet: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
  }): Promise<donnéesProjetExportées> {
    const données = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<donnéesProjetExportation>,
      ): Promise<schémaFonctionOublier> => {
        return await this.suivreDonnéesExportation({
          idProjet,
          langues,
          f: fSuivi,
        });
      },
      attendreStabilité(patience),
    );

    nomFichier = nomFichier || données.nomProjet;

    const fichiersSFIP = new Set<string>();
    données.bds.forEach((bd) => {
      bd.tableaux.forEach((t) =>
        t.fichiersSFIP.forEach((x) => fichiersSFIP.add(x)),
      );
    });

    return {
      docs: données.bds.map((donnéesBd) => {
        const doc = xlsxUtils.book_new();
        for (const tableau of donnéesBd.tableaux) {
          /* Créer le tableau */
          const tableauXLSX = xlsxUtils.json_to_sheet(tableau.données);

          /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
          xlsxUtils.book_append_sheet(
            doc,
            tableauXLSX,
            tableau.nomTableau.slice(0, 30),
          );
        }
        return { doc, nom: donnéesBd.nomBd };
      }),
      fichiersSFIP,
      nomFichier,
    };
  }

  async exporterProjetÀFichier({
    idProjet,
    langues,
    nomFichier,
    patience = 500,
    formatDoc,
    dossier = "",
    inclureDocuments = true,
  }: {
    idProjet: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
    formatDoc: xlsx.BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
  }): Promise<string> {
    const donnéesExportées = await this.exporterDonnées({
      idProjet,
      langues,
      nomFichier,
      patience,
    });
    return await this.documentDonnéesÀFichier({
      données: donnéesExportées,
      formatDoc,
      dossier,
      inclureDocuments,
    });
  }

  async documentDonnéesÀFichier({
    données,
    formatDoc,
    dossier = "",
    inclureDocuments = true,
  }: {
    données: donnéesProjetExportées;
    formatDoc: xlsx.BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
  }): Promise<string> {
    const { docs, fichiersSFIP, nomFichier } = données;

    const bookType: xlsx.BookType = conversionsTypes[formatDoc] || formatDoc;

    const fichiersDocs = docs.map((d) => {
      return {
        nom: `${d.nom}.${formatDoc}`,
        octets: xlsxWrite(d.doc, { bookType, type: "buffer" }),
      };
    });
    const fichiersDeSFIP = inclureDocuments
      ? await Promise.all(
          [...fichiersSFIP].map(async (fichier) => {
            return {
              nom: fichier.replace("/", "-"),
              octets: await toBuffer(
                await this.client.obtItérableAsyncSFIP({ id: fichier }),
              ),
            };
          }),
        )
      : [];
    await zipper(fichiersDocs, fichiersDeSFIP, path.join(dossier, nomFichier));
    return path.join(dossier, nomFichier);
  }

  async effacerProjet({ idProjet }: { idProjet: string }): Promise<void> {
    // D'abord effacer l'entrée dans notre liste de projets
    await this.enleverDeMesProjets({ idProjet });
    await this.client.favoris.désépinglerFavori({ idObjet: idProjet });

    // Et puis maintenant aussi effacer les données et le projet lui-même
    const { bd: bdProjet, fOublier } = await this.client.ouvrirBdTypée({
      id: idProjet,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    const contenuBd = await bdProjet.all();
    for (const item of contenuBd) {
      if (typeof item.value === "string" && adresseOrbiteValide(item.value))
        await this.client.effacerBd({ id: item.value });
    }
    await fOublier();

    await this.client.effacerBd({ id: idProjet });
  }
}
