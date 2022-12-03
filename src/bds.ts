import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";
import { ImportCandidate } from "ipfs-core-types/src/utils";

import { WorkBook, utils, BookType, writeFile, write as writeXLSX } from "xlsx";
import toBuffer from "it-to-buffer";
import fs from "fs";
import path from "path";
import { isBrowser, isWebWorker } from "wherearewe";
import { v4 as uuidv4 } from "uuid";

import type { InfoColAvecCatégorie } from "@/tableaux.js";
import { schémaStatut, TYPES_STATUT } from "@/utils/types.js";
import { cacheSuivi } from "@/décorateursCache.js";

import { règleColonne, élémentDonnées, erreurValidation } from "@/valid.js";
import { élémentBdListeDonnées, différenceTableaux } from "@/tableaux.js";
import ClientConstellation from "@/client.js";
import {
  traduire,
  zipper,
  schémaFonctionSuivi,
  schémaFonctionOublier,
  uneFois,
  faisRien,
} from "@/utils/index.js";
import { objRôles } from "@/accès/types.js";
import ContrôleurConstellation from "@/accès/cntrlConstellation.js";

export interface schémaSpécificationBd {
  licence: string;
  motsClefs?: string[];
  tableaux: {
    cols: {
      idVariable: string;
      idColonne: string;
      index?: boolean;
    }[];
    clef: string;
  }[];
}

export interface infoScore {
  accès?: number;
  couverture?: number;
  valide?: number;
  total: number;
}

export interface donnéesBdExportées {
  doc: WorkBook;
  fichiersSFIP: Set<{ cid: string; ext: string }>;
  nomFichier: string;
}

export type schémaCopiéDe = {
  id: string;
};

export type typeÉlémentsBdBD = string | schémaStatut | schémaCopiéDe;
export type infoTableau = {
  clef: string;
  position: number;
};

export type différenceBds =
  | différenceBDTableauExtra
  | différenceBDTableauManquant
  | différenceTableauxBds;

export type différenceBDTableauManquant = {
  clefManquante: string;
};

export type différenceBDTableauExtra = {
  clefExtra: string;
};

export type différenceTableauxBds<
  T extends différenceTableaux = différenceTableaux
> = {
  idTableau: string;
  différence: T;
};

export type infoTableauAvecId = infoTableau & { id: string };

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

export default class BDs {
  client: ClientConstellation;
  idBd: string;

  constructor({ client, id }: { client: ClientConstellation; id: string }) {
    this.client = client;
    this.idBd = id;
  }

  @cacheSuivi
  async suivreBds({
    f,
    idBdBdsCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idBdBdsCompte?: string;
  }): Promise<schémaFonctionOublier> {
    idBdBdsCompte = idBdBdsCompte || this.idBd;
    return await this.client.suivreBdListe({ id: idBdBdsCompte, f });
  }

  async créerBd({
    licence,
    ajouter = true,
  }: {
    licence: string;
    ajouter?: boolean;
  }): Promise<string> {
    const idBdBd = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès: {
        address: undefined,
        premierMod: this.client.bdCompte!.id,
      },
    });

    const { bd: bdBD, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id: idBdBd });
    await bdBD.set("type", "bd");
    await bdBD.set("licence", licence);

    const accès = bdBD.access as unknown as ContrôleurConstellation;
    const optionsAccès = { address: accès.address };

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdBD.set("noms", idBdNoms);

    const idBdDescr = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdBD.set("descriptions", idBdDescr);

    const idBdTableaux = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdBD.set("tableaux", idBdTableaux);

    const idBdMotsClefs = await this.client.créerBdIndépendante({
      type: "feed",
      optionsAccès,
    });
    await bdBD.set("motsClefs", idBdMotsClefs);

    await bdBD.set("statut", { statut: TYPES_STATUT.ACTIVE });

    if (ajouter) {
      const { bd: bdRacine, fOublier: fOublierRacine } =
        await this.client.ouvrirBd<FeedStore<string>>({ id: this.idBd });
      await bdRacine.add(idBdBd);
      fOublierRacine();
    }

    await fOublier();

    return idBdBd;
  }

  async ajouterÀMesBds({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<FeedStore<string>>({
      id: this.idBd,
    });
    await bd.add(id);
    await fOublier();
  }

  async enleverDeMesBds({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<FeedStore<string>>({
      id: this.idBd,
    });
    await this.client.effacerÉlémentDeBdListe({ bd, élément: id });
    await fOublier();
  }

  async copierBd({
    id,
    ajouterÀMesBds = true,
    copierDonnées = true,
  }: {
    id: string;
    ajouterÀMesBds?: boolean;
    copierDonnées?: boolean;
  }): Promise<string> {
    const { bd: bdBase, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id });
    const licence = bdBase.get("licence") as string;
    const idNouvelleBd = await this.créerBd({
      licence,
      ajouter: ajouterÀMesBds,
    });
    const { bd: nouvelleBd, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBd<KeyValueStore<typeÉlémentsBdBD>>({
        id: idNouvelleBd,
      });

    const idBdNoms = bdBase.get("noms") as string;
    const { bd: bdNoms, fOublier: fOublierBdNoms } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    const noms = ClientConstellation.obtObjetdeBdDic({ bd: bdNoms }) as {
      [key: string]: string;
    };
    await this.ajouterNomsBd({ id: idNouvelleBd, noms });

    const idBdDescr = bdBase.get("descriptions") as string;
    const { bd: bdDescr, fOublier: fOublierBdDescr } =
      await this.client.ouvrirBd<KeyValueStore<string>>({ id: idBdDescr });
    const descriptions = ClientConstellation.obtObjetdeBdDic({
      bd: bdDescr,
    }) as {
      [key: string]: string;
    };
    await this.ajouterDescriptionsBd({ id: idNouvelleBd, descriptions });

    fOublierBdNoms();
    fOublierBdDescr();

    const idBdMotsClefs = bdBase.get("motsClefs") as string;
    const { bd: bdMotsClefs, fOublier: fOublierBdMotsClefs } =
      await this.client.ouvrirBd<FeedStore<string>>({ id: idBdMotsClefs });
    const motsClefs = ClientConstellation.obtÉlémentsDeBdListe({
      bd: bdMotsClefs,
    }) as string[];
    await this.ajouterMotsClefsBd({
      idBd: idNouvelleBd,
      idsMotsClefs: motsClefs,
    });

    const idBdTableaux = bdBase.get("tableaux") as string;
    const idNouvelleBdTableaux = nouvelleBd.get("tableaux") as string;

    const { bd: nouvelleBdTableaux, fOublier: fOublierNouvelleTableaux } =
      await this.client.ouvrirBd<KeyValueStore<infoTableau>>({
        id: idNouvelleBdTableaux,
      });
    const { bd: bdTableaux, fOublier: fOublierBdTableaux } =
      await this.client.ouvrirBd<KeyValueStore<infoTableau>>({
        id: idBdTableaux,
      });
    const tableaux = ClientConstellation.obtObjetdeBdDic({
      bd: bdTableaux,
    });

    for (const idTableau of Object.keys(tableaux)) {
      const idNouveauTableau: string =
        await this.client.tableaux!.copierTableau({
          id: idTableau,
          idBd: idNouvelleBd,
          copierDonnées,
        });
      await nouvelleBdTableaux.set(idNouveauTableau, tableaux[idTableau]);
    }

    const statut = bdBase.get("statut") || { statut: TYPES_STATUT.ACTIVE };
    await nouvelleBd.set("statut", statut);

    const image = bdBase.get("image");
    if (image) await nouvelleBd.set("image", image);

    await nouvelleBd.set("copiéDe", { id });

    await fOublier();
    fOublierNouvelleTableaux();

    fOublierNouvelle();
    fOublierBdTableaux();
    fOublierBdMotsClefs();
    return idNouvelleBd;
  }

  async créerBdDeSchéma({
    schéma,
    ajouter = true,
  }: {
    schéma: schémaSpécificationBd;
    ajouter?: boolean;
  }): Promise<string> {
    const { tableaux, motsClefs, licence } = schéma;

    // On n'ajoutera la BD que lorsqu'elle sera prête
    const idBd = await this.créerBd({ licence, ajouter: false });

    if (motsClefs) {
      await this.ajouterMotsClefsBd({ idBd, idsMotsClefs: motsClefs });
    }

    for (const tb of tableaux) {
      const { cols, clef: clefTableau } = tb;
      const idTableau = await this.ajouterTableauBd({ idBd, clefTableau });

      for (const c of cols) {
        const { idColonne, idVariable, index } = c;
        await this.client.tableaux!.ajouterColonneTableau({
          idTableau,
          idVariable,
          idColonne,
        });
        if (index) {
          await this.client.tableaux!.changerColIndex({
            idTableau,
            idColonne,
            val: true,
          });
        }
      }
    }

    // Maintenant on peut l'annoncer !
    if (ajouter) await this.ajouterÀMesBds({ id: idBd });

    return idBd;
  }

  @cacheSuivi
  async suivreParent({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<{ id: string } | undefined>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (bd: KeyValueStore<typeÉlémentsBdBD>) => {
      const copiéDe = bd.get("copiéDe");
      f(copiéDe as { id: string });
    };
    return await this.client.suivreBd({
      id: idBd,
      f: fFinale,
    });
  }

  @cacheSuivi
  async suivreDifférencesAvecSchémaNuée({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<différenceBds[]>;
  }): Promise<schémaFonctionOublier> {
    const info: {
      difsTableaux: différenceTableauxBds[];
      tableauxBd?: infoTableauAvecId[];
      tableauxBdLiée?: infoTableauAvecId[];
    } = {
      difsTableaux: [],
    };

    const fFinale = () => {
      const différences: différenceBds[] = [...info.difsTableaux];

      if (info.tableauxBdLiée && info.tableauxBd) {
        for (const tableauLié of info.tableauxBdLiée) {
          const tableau = info.tableauxBdLiée.find(
            (t) => t.clef === tableauLié.clef
          );
          if (!tableau) {
            const dif: différenceBDTableauManquant = {
              clefManquante: tableauLié.clef,
            };
            différences.push(dif);
          }
        }
        for (const tableau of info.tableauxBd) {
          const tableauLié = info.tableauxBdLiée.find(
            (t) => t.clef === tableau.clef
          );
          if (!tableauLié) {
            const dif: différenceBDTableauExtra = {
              clefExtra: tableau.clef,
            };
            différences.push(dif);
          }
        }
      }

      f(différences);
    };

    const fListe = async (
      fSuivreRacine: (tableaux: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({
        id: idBd,
        f: (x) => fSuivreRacine(x.map((y) => y.id)),
      });
    };

    const fBranche = async (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<différenceTableauxBds[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux!.suivreDifférencesAvecTableauLié({
        id,
        f: (diffs) =>
          fSuivreBranche(
            diffs.map((d) => {
              return {
                idTableau: id,
                différence: d,
              };
            })
          ),
      });
    };

    const fFinaleSuivreDiffsTableaux = (diffs: différenceTableauxBds[]) => {
      info.difsTableaux = diffs;
      fFinale();
    };

    const fOublierDifférencesTableaux =
      await this.client.suivreBdsDeFonctionListe({
        fListe,
        f: fFinaleSuivreDiffsTableaux,
        fBranche,
      });

    const fOublierTableauxBd = await this.suivreTableauxBd({
      id: idBd,
      f: (tableaux) => {
        info.tableauxBd = tableaux;
        fFinale();
      },
    });

    const fSuivreRacineBdLiée = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (nouvelIdBdCible?: string) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreParent({
        idBd,
        f: (x) => faisRien, // fSuivreRacine(x?.lier ? x.id : undefined),
      });
    };

    const fSuivreBdLiée = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<infoTableauAvecId[]>;
    }): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({
        id,
        f: fSuivreBd,
      });
    };

    const fOublierTableauxBdLiée = await this.client.suivreBdDeFonction({
      fRacine: fSuivreRacineBdLiée,
      f: (tableaux) => {
        info.tableauxBdLiée = tableaux;
        fFinale();
      },
      fSuivre: fSuivreBdLiée,
    });

    return async () => {
      await fOublierTableauxBd();
      await fOublierTableauxBdLiée();
      await fOublierDifférencesTableaux();
    };
  }

  @cacheSuivi
  async rechercherBdsParMotsClefs({
    motsClefs,
    f,
    idBdBdsCompte,
  }: {
    motsClefs: string[];
    f: schémaFonctionSuivi<string[]>;
    idBdBdsCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBds({ f: fSuivreRacine, idBdBdsCompte });
    };

    const fCondition = async (
      id: string,
      fSuivreCondition: (état: boolean) => void
    ): Promise<schémaFonctionOublier> => {
      const fFinaleSuivreCondition = (motsClefsBd: string[]) => {
        const état = motsClefs.every((m) => motsClefsBd.includes(m));
        fSuivreCondition(état);
      };
      return await this.suivreMotsClefsBd({ id, f: fFinaleSuivreCondition });
    };
    return await this.client.suivreBdsSelonCondition({ fListe, fCondition, f });
  }

  async combinerBds({
    idBdBase,
    idBd2,
  }: {
    idBdBase: string;
    idBd2: string;
  }): Promise<void> {
    const obtTableaux = async (idBd: string): Promise<infoTableauAvecId[]> => {
      return await uneFois(
        async (
          fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>
        ): Promise<schémaFonctionOublier> => {
          return await this.suivreTableauxBd({ id: idBd, f: fSuivi });
        }
      );
    };

    const tableauxBase = await obtTableaux(idBdBase);
    const tableauxBd2 = await obtTableaux(idBd2);

    for (const info of tableauxBd2) {
      const { id: idTableau, clef } = info;
      if (clef) {
        const idTableauBaseCorresp = tableauxBase.find(
          (t) => t.clef === clef
        )?.id;

        if (idTableauBaseCorresp) {
          await this.client.tableaux!.combinerDonnées({
            idTableauBase: idTableauBaseCorresp,
            idTableau2: idTableau,
          });
        }
      }
    }
  }

  @cacheSuivi
  async suivreIdTableauParClef({
    idBd,
    clef,
    f,
  }: {
    idBd: string;
    clef: string;
    f: schémaFonctionSuivi<string | undefined>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (tableaux: infoTableauAvecId[]) => {
      const infoTableau = tableaux.find((t) => t.clef === clef);
      f(infoTableau?.id);
    };
    return await this.suivreTableauxBd({ id: idBd, f: fFinale });
  }

  @cacheSuivi
  async suivreBdUnique({
    schéma,
    motClefUnique,
    f,
  }: {
    schéma: schémaSpécificationBd;
    motClefUnique: string;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    const clefStockageLocal = "bdUnique: " + motClefUnique;

    const déjàCombinées = new Set();

    const fFinale = async (bds: string[]): Promise<void> => {
      let idBd: string;
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
          }

          break;
        }
      }
      f(idBd);
    };

    const fOublier = await this.rechercherBdsParMotsClefs({
      motsClefs: [motClefUnique],
      f: fFinale,
    });

    return fOublier;
  }

  @cacheSuivi
  async suivreIdTableauParClefDeBdUnique({
    schémaBd,
    motClefUnique,
    clefTableau,
    f,
  }: {
    schémaBd: schémaSpécificationBd;
    motClefUnique: string;
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
        motClefUnique,
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
    return await this.client.suivreBdDeFonction<string>({
      fRacine,
      f,
      fSuivre,
    });
  }

  @cacheSuivi
  async suivreDonnéesDeTableauUnique<T extends élémentBdListeDonnées>({
    schémaBd,
    motClefUnique,
    clefTableau,
    f,
  }: {
    schémaBd: schémaSpécificationBd;
    motClefUnique: string;
    clefTableau: string;
    f: schémaFonctionSuivi<élémentDonnées<T>[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (données?: élémentDonnées<T>[]) => {
      return f(données || []);
    };

    const fSuivreDonnéesDeTableau = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<élémentDonnées<T>[]>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux!.suivreDonnées({
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
        motClefUnique,
        clefTableau,
        f: (idTableau?: string) => {
          if (idTableau) fSuivreRacine(idTableau);
        },
      });
    };

    return await this.client.suivreBdDeFonction({
      fRacine: fSuivreTableau,
      f: fFinale,
      fSuivre: fSuivreDonnéesDeTableau,
    });
  }

  async ajouterÉlémentÀTableauUnique<T extends élémentBdListeDonnées>({
    schémaBd,
    motClefUnique,
    clefTableau,
    vals,
  }: {
    schémaBd: schémaSpécificationBd;
    motClefUnique: string;
    clefTableau: string;
    vals: T;
  }): Promise<string> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClefDeBdUnique({
          schémaBd,
          motClefUnique,
          clefTableau,
          f: (id?: string) => {
            if (id) fSuivi(id);
          },
        });
      },
      true
    );

    return await this.client.tableaux!.ajouterÉlément({
      idTableau: idTableau,
      vals,
    });
  }

  async effacerÉlémentDeTableauUnique({
    schémaBd,
    motClefUnique,
    clefTableau,
    empreinte,
  }: {
    schémaBd: schémaSpécificationBd;
    motClefUnique: string;
    clefTableau: string;
    empreinte: string;
  }): Promise<void> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreIdTableauParClefDeBdUnique({
          schémaBd,
          motClefUnique,
          clefTableau,
          f: (id?: string) => {
            if (id) fSuivi(id);
          },
        });
      },
      true
    );

    return await this.client.tableaux!.effacerÉlément({
      idTableau: idTableau,
      empreinteÉlément: empreinte,
    });
  }

  async ajouterNomsBd({
    id,
    noms,
  }: {
    id: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdNoms) throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });

    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    await fOublier();
  }

  async sauvegarderNomBd({
    id,
    langue,
    nom,
  }: {
    id: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdNoms) throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.set(langue, nom);
    await fOublier();
  }

  async effacerNomBd({
    id,
    langue,
  }: {
    id: string;
    langue: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdNoms) throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.del(langue);
    await fOublier();
  }

  async ajouterDescriptionsBd({
    id,
    descriptions,
  }: {
    id: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdDescr) throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
    await fOublier();
  }

  async sauvegarderDescrBd({
    id,
    langue,
    descr,
  }: {
    id: string;
    langue: string;
    descr: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdDescr) throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    await bdDescr.set(langue, descr);
    await fOublier();
  }

  async effacerDescrBd({
    id,
    langue,
  }: {
    id: string;
    langue: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdDescr) throw new Error(`Permission de modification refusée pour BD ${id}.`);

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    await bdDescr.del(langue);
    await fOublier();
  }

  async changerLicenceBd({
    idBd,
    licence,
  }: {
    idBd: string;
    licence: string;
  }): Promise<void> {
    const { bd: bdBd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id: idBd });
    await bdBd.set("licence", licence);
    await fOublier();
  }

  async ajouterMotsClefsBd({
    idBd,
    idsMotsClefs,
  }: {
    idBd: string;
    idsMotsClefs: string | string[];
  }): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];
    const optionsAccès = await this.client.obtOpsAccès({ idBd });
    const idBdMotsClefs = await this.client.obtIdBd({
      nom: "motsClefs",
      racine: idBd,
      type: "feed",
      optionsAccès,
    });
    if (!idBdMotsClefs) {
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);
    }

    const { bd: bdMotsClefs, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >({ id: idBdMotsClefs });
    for (const id of idsMotsClefs) {
      const motsClefsExistants = ClientConstellation.obtÉlémentsDeBdListe({
        bd: bdMotsClefs,
      });
      if (!motsClefsExistants.includes(id)) await bdMotsClefs.add(id);
    }
    await fOublier();
  }

  async effacerMotClefBd({
    idBd,
    idMotClef,
  }: {
    idBd: string;
    idMotClef: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd });
    const idBdMotsClefs = await this.client.obtIdBd({
      nom: "motsClefs",
      racine: idBd,
      type: "feed",
      optionsAccès,
    });
    if (!idBdMotsClefs) {
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);
    }

    const { bd: bdMotsClefs, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >({ id: idBdMotsClefs });

    await this.client.effacerÉlémentDeBdListe({
      bd: bdMotsClefs,
      élément: idMotClef,
    });

    await fOublier();
  }

  async ajouterTableauBd({
    idBd,
    clefTableau,
  }: {
    idBd: string;
    clefTableau?: string;
  }): Promise<string> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd });
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idBd,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdTableaux) {
      throw new Error(`Permission de modification refusée pour BD ${idBd}.`);
    }

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<infoTableau>
    >({ id: idBdTableaux });

    clefTableau = clefTableau || uuidv4();
    const idTableau = await this.client.tableaux!.créerTableau({ idBd });
    await bdTableaux.set(idTableau, {
      position: Object.keys(bdTableaux.all).length,
      clef: clefTableau,
    });

    await fOublier();
    return idTableau;
  }

  async effacerTableauBd({
    id,
    idTableau,
  }: {
    id: string;
    idTableau: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    // D'abord effacer l'entrée dans notre liste de tableaux
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdTableaux) {
      throw new Error(`Permission de modification refusée pour BD ${id}.`);
    }

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdTableaux });
    await bdTableaux.del(idTableau);
    await fOublier();

    // Enfin, effacer les données et le tableau lui-même
    await this.client.tableaux!.effacerTableau({ idTableau });
  }

  async spécifierClefTableau({
    idBd,
    idTableau,
    clef,
  }: {
    idBd: string;
    idTableau: string;
    clef: string;
  }): Promise<void> {
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idBd,
      type: "kvstore",
    });
    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<infoTableau>
    >({ id: idBdTableaux });

    const infoExistante = bdTableaux.get(idTableau) as infoTableau;
    infoExistante.clef = clef;
    bdTableaux.set(idTableau, infoExistante);

    await fOublier();
  }

  async marquerObsolète({
    id,
    idNouvelle,
  }: {
    id: string;
    idNouvelle?: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id });
    bd.set("statut", { statut: TYPES_STATUT.OBSOLÈTE, idNouvelle });
    await fOublier();
  }

  async marquerActive({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id });
    bd.set("statut", { statut: TYPES_STATUT.ACTIVE });
    await fOublier();
  }

  async marquerBêta({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id });
    bd.set("statut", { statut: TYPES_STATUT.BÊTA });
    await fOublier();
  }

  async marquerInterne({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id });
    bd.set("statut", { statut: TYPES_STATUT.INTERNE });
    await fOublier();
  }

  @cacheSuivi
  async suivreLicence({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id,
      f: async (bd) => {
        const licence = (bd as KeyValueStore<typeÉlémentsBdBD>).get(
          "licence"
        ) as string;
        f(licence);
      },
    });
  }

  async inviterAuteur({
    idBd,
    idBdCompteAuteur,
    rôle,
  }: {
    idBd: string;
    idBdCompteAuteur: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    await this.client.donnerAccès({ idBd, identité: idBdCompteAuteur, rôle });
  }

  async sauvegarderImage({
    idBd,
    image,
  }: {
    idBd: string;
    image: ImportCandidate;
  }): Promise<void> {
    let contenu: ImportCandidate;

    if ((image as File).size !== undefined) {
      if ((image as File).size > MAX_TAILLE_IMAGE) {
        throw new Error("Taille maximale excédée");
      }
      contenu = await (image as File).arrayBuffer();
    } else {
      contenu = image;
    }
    const idImage = await this.client.ajouterÀSFIP({ fichier: contenu });
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id: idBd });
    await bd.set("image", idImage);
    await fOublier();
  }

  async effacerImage({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id: idBd });
    await bd.del("image");
    await fOublier();
  }

  @cacheSuivi
  async suivreImage({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<Uint8Array | null>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idBd,
      f: async (bd: KeyValueStore<typeÉlémentsBdBD>) => {
        const idImage = bd.get("image");
        if (!idImage) return f(null);
        const image = await this.client.obtFichierSFIP({
          id: idImage as string,
          max: MAX_TAILLE_IMAGE_VIS,
        });
        return f(image);
      },
    });
  }

  @cacheSuivi
  async suivreNomsBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({ id, clef: "noms", f });
  }

  @cacheSuivi
  async suivreDescrBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({ id, clef: "descriptions", f });
  }

  @cacheSuivi
  async suivreMotsClefsBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListeDeClef({ id, clef: "motsClefs", f });
  }

  @cacheSuivi
  async suivreTableauxBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<infoTableauAvecId[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (infos: { [clef: string]: infoTableau }) => {
      const tableaux: infoTableauAvecId[] = Object.entries(infos).map(
        ([id, info]) => {
          return {
            id,
            ...info,
          };
        }
      );
      f(tableaux);
    };
    return await this.client.suivreBdDicDeClef({
      id,
      clef: "tableaux",
      f: fFinale,
    });
  }

  @cacheSuivi
  async suivreScoreAccèsBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<number | undefined>;
  }): Promise<schémaFonctionOublier> {
    // À faire
    f(Number.parseInt(id));
    return faisRien;
  }

  @cacheSuivi
  async suivreScoreCouvertureBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<number | undefined>;
  }): Promise<schémaFonctionOublier> {
    type scoreTableau = { numérateur: number; dénominateur: number };

    const fFinale = (branches: scoreTableau[]) => {
      const numérateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.numérateur,
        0
      );
      const dénominateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.dénominateur,
        0
      );
      f(dénominateur === 0 ? undefined : numérateur / dénominateur);
    };

    const fBranche = async (
      idTableau: string,
      f: schémaFonctionSuivi<scoreTableau>
    ): Promise<schémaFonctionOublier> => {
      const info: { cols?: InfoColAvecCatégorie[]; règles?: règleColonne[] } =
        {};

      const fFinaleBranche = () => {
        const { cols, règles } = info;

        if (cols !== undefined && règles !== undefined) {
          const colsÉligibles = cols.filter((c) =>
            ["numérique", "catégorique"].includes(typeof c.catégorie === "string" ? c.catégorie : c.catégorie.catégorieBase)
          );

          const dénominateur = colsÉligibles.length;
          const numérateur = colsÉligibles.filter((c) =>
            règles.some(
              (r) =>
                r.règle.règle.typeRègle !== "catégorie" && r.colonne === c.id
            )
          ).length;
          f({ numérateur, dénominateur });
        }
      };

      const fOublierCols = await this.client.tableaux!.suivreColonnes({
        idTableau,
        f: (cols) => {
          info.cols = cols;
          fFinaleBranche();
        },
      });

      const fOublierRègles = await this.client.tableaux!.suivreRègles({
        idTableau,
        f: (règles) => {
          info.règles = règles;
          fFinaleBranche();
        },
      });

      return async () => {
        await fOublierCols();
        await fOublierRègles();
      };
    };

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({
        id,
        f: (tableaux) => fSuivreRacine(tableaux.map((x) => x.id)),
      });
    };

    return await this.client.suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  @cacheSuivi
  async suivreScoreValideBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<number | undefined>;
  }): Promise<schémaFonctionOublier> {
    type scoreTableau = { numérateur: number; dénominateur: number };

    const fFinale = (branches: scoreTableau[]) => {
      const numérateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.numérateur,
        0
      );
      const dénominateur = branches.reduce(
        (a: number, b: scoreTableau) => a + b.dénominateur,
        0
      );
      f(dénominateur === 0 ? undefined : numérateur / dénominateur);
    };

    const fBranche = async (
      idTableau: string,
      f: schémaFonctionSuivi<scoreTableau>
    ): Promise<schémaFonctionOublier> => {
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
          const colsÉligibles = cols.filter((c) =>
            ["numérique", "catégorique"].includes(typeof c.catégorie === "string" ? c.catégorie : c.catégorie.catégorieBase)
          );

          const déjàVus: { empreinte: string; idColonne: string }[] = [];
          const nCellulesÉrronnées = erreurs
            .map((e) => {
              return {
                empreinte: e.empreinte,
                idColonne: e.erreur.règle.colonne,
              };
            })
            .filter((x) => {
              const déjàVu = déjàVus.find(
                (y) =>
                  y.empreinte === x.empreinte && y.idColonne === x.idColonne
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
                  .length
            )
            .reduce((a, b) => a + b, 0);

          const numérateur = dénominateur - nCellulesÉrronnées;

          f({ numérateur, dénominateur });
        }
      };

      const fOublierDonnées = await this.client.tableaux!.suivreDonnées({
        idTableau,
        f: (données) => {
          info.données = données;
          fFinaleBranche();
        },
      });

      const fOublierErreurs = await this.client.tableaux!.suivreValidDonnées({
        idTableau,
        f: (erreurs) => {
          info.erreurs = erreurs;
          fFinaleBranche();
        },
      });

      const fOublierColonnes = await this.client.tableaux!.suivreColonnes({
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

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({
        id,
        f: (tableaux) => fSuivreRacine(tableaux.map((t) => t.id)),
      });
    };

    return await this.client.suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  @cacheSuivi
  async suivreScoreBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<infoScore>;
  }): Promise<schémaFonctionOublier> {
    const info: { accès?: number; couverture?: number; valide?: number } = {};

    const fFinale = () => {
      const { accès, couverture, valide } = info;
      const score: infoScore = {
        total: ((accès || 0) + (couverture || 0) + (valide || 0)) / 3,
        accès,
        couverture,
        valide,
      };
      f(score);
    };

    const oublierAccès = await this.suivreScoreAccèsBd({
      id,
      f: (accès) => {
        info.accès = accès;
        fFinale();
      },
    });
    const oublierCouverture = await this.suivreScoreCouvertureBd({
      id,
      f: (couverture) => {
        info.couverture = couverture;
        fFinale();
      },
    });
    const oublierValide = await this.suivreScoreValideBd({
      id,
      f: (valide) => {
        info.valide = valide;
        fFinale();
      },
    });
    return async () => {
      await oublierAccès();
      await oublierCouverture();
      await oublierValide();
    };
  }

  @cacheSuivi
  async suivreVariablesBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (variables?: string[]) => {
      return f(variables || []);
    };

    const fBranche = async (
      id: string,
      f: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux!.suivreVariables({ idTableau: id, f });
    };

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({
        id,
        f: (x) => fSuivreRacine(x.map((x) => x.id)),
      });
    };

    return await this.client.suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  async exporterDonnées({
    id,
    langues,
    nomFichier,
  }: {
    id: string;
    langues?: string[];
    nomFichier?: string;
  }): Promise<donnéesBdExportées> {
    const doc = utils.book_new();
    const fichiersSFIP: Set<{ cid: string; ext: string }> = new Set();

    const infosTableaux = await uneFois(
      (f: schémaFonctionSuivi<infoTableauAvecId[]>) =>
        this.suivreTableauxBd({ id, f })
    );

    for (const tableau of infosTableaux) {
      const { id: idTableau } = tableau;
      const { fichiersSFIP: fichiersSFIPTableau } =
        await this.client.tableaux!.exporterDonnées({
          idTableau,
          langues,
          doc,
        });
      fichiersSFIPTableau.forEach((f: { cid: string; ext: string }) =>
        fichiersSFIP.add(f)
      );
    }

    if (!nomFichier) {
      const nomsBd = await uneFois(
        (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
          this.suivreNomsBd({ id, f })
      );
      const idCourt = id.split("/").pop()!;

      nomFichier = langues ? traduire(nomsBd, langues) || idCourt : idCourt;
    }

    return { doc, fichiersSFIP, nomFichier };
  }

  async exporterDocumentDonnées({
    données,
    formatDoc,
    dir = "",
    inclureFichiersSFIP = true,
  }: {
    données: donnéesBdExportées;
    formatDoc: BookType | "xls";
    dir?: string;
    inclureFichiersSFIP?: boolean;
  }): Promise<string> {
    const { doc, fichiersSFIP, nomFichier } = données;

    const conversionsTypes: { [key: string]: BookType } = {
      xls: "biff8",
    };
    const bookType: BookType = conversionsTypes[formatDoc] || formatDoc;

    // Créer le dossier si nécessaire. Sinon, xlsx n'écrit rien, et ce, sans se plaindre.
    if (!(isBrowser || isWebWorker) && !fs.existsSync(dir)) {
      // Mais juste si on n'est pas dans le navigateur ! Dans le navigateur, ça télécharge sans problème.
      fs.mkdirSync(dir, { recursive: true });
    }

    if (inclureFichiersSFIP) {
      const fichierDoc = {
        octets: writeXLSX(doc, { bookType, type: "buffer" }),
        nom: `${nomFichier}.${formatDoc}`,
      };
      const fichiersDeSFIP = await Promise.all(
        [...fichiersSFIP].map(async (fichier) => {
          return {
            nom: `${fichier.cid}.${fichier.ext}`,
            octets: await toBuffer(
              this.client.obtItérableAsyncSFIP({ id: fichier.cid })
            ),
          };
        })
      );
      await zipper([fichierDoc], fichiersDeSFIP, path.join(dir, nomFichier));
      return path.join(dir, `${nomFichier}.zip`);
    } else {
      writeFile(doc, path.join(dir, `${nomFichier}.${formatDoc}`), {
        bookType,
      });
      return path.join(dir, `${nomFichier}.${formatDoc}`);
    }
  }

  async effacerBd({ id }: { id: string }): Promise<void> {
    // D'abord effacer l'entrée dans notre liste de BDs
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >({ id: this.idBd });
    await this.client.effacerÉlémentDeBdListe({ bd: bdRacine, élément: id });
    await fOublier();

    // Et puis maintenant aussi effacer les données et la BD elle-même
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    for (const clef in ["noms", "descriptions", "motsClefs"]) {
      const idBd = await this.client.obtIdBd({
        nom: clef,
        racine: id,
        optionsAccès,
      });
      if (idBd) await this.client.effacerBd({ id: idBd });
    }
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: id,
      type: "kvstore",
      optionsAccès,
    });
    if (idBdTableaux) {
      const { bd: bdTableaux, fOublier: fOublierTableaux } =
        await this.client.ouvrirBd<KeyValueStore<infoTableau>>({
          id: idBdTableaux,
        });
      const tableaux: string[] = Object.keys(bdTableaux.all);
      for (const t of tableaux) {
        await this.client.tableaux!.effacerTableau({ idTableau: t });
      }
      fOublierTableaux();
      await this.client.effacerBd({ id: idBdTableaux });
    }

    await this.enleverDeMesBds({ id });
    await this.client.effacerBd({ id });
  }
}
