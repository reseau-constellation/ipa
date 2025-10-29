import {
  attendreStabilité,
  suivreFonctionImbriquée,
  suivreDeFonctionListe,
  faisRien,
  ignorerNonDéfinis,
  uneFois,
} from "@constl/utils-ipa";

import { Semaphore } from "@chriscdn/promise-semaphore";
import { cacheSuivi } from "@/décorateursCache.js";
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
import { ContrôleurConstellation as générerContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import { ComposanteClientListe } from "@/v2/nébuleuse/services.js";

export interface schémaSpécificationBd {
  licence: string;
  licenceContenu?: string;
  métadonnées?: string;
  motsClefs?: string[];
  nuées?: string[];
  statut?: schémaStatut;
  tableaux: {
    cols: {
      idColonne: string;
      idVariable?: string;
      index?: boolean;
      optionnelle?: boolean;
    }[];
    clef: string;
  }[];
}

export interface infoScore {
  accès?: number;
  couverture?: number;
  valide?: number;
  licence?: number;
  total: number;
}

export type différenceBds =
  | différenceBDTableauSupplémentaire
  | différenceBDTableauManquant
  | différenceTableauxBds;

export type différenceBDTableauManquant = {
  type: "tableauManquant";
  sévère: true;
  clefManquante: string;
};

export type différenceBDTableauSupplémentaire = {
  type: "tableauSupplémentaire";
  sévère: false;
  clefExtra: string;
};

export type différenceTableauxBds<
  T extends différenceTableaux = différenceTableaux,
> = {
  type: "tableau";
  sévère: T["sévère"];
  idTableau: string;
  différence: T;
};

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
const schémaStructureBdMotsClefs: JSONSchemaType<string> = { type: "string" };
const schémaStructureBdNuées: JSONSchemaType<string> = { type: "string" };

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

export class BDs extends ComposanteClientListe<string> {
  verrouBdUnique: Semaphore;

  constructor({ client }: { client: Constellation }) {
    super({ client, clef: "bds", schémaBdPrincipale });
    this.verrouBdUnique = new Semaphore();
  }

  async créerBdDeNuée({
    idNuée,
    licence,
    licenceContenu,
    épingler = true,
  }: {
    idNuée: string;
    licence: string;
    licenceContenu?: string;
    épingler?: boolean;
  }): Promise<string> {
    const schéma = await this.client.nuées.générerSchémaBdNuée({
      idNuée,
      licence,
      licenceContenu,
    });
    return await this.créerBdDeSchéma({ schéma, épingler });
  }

  async copierBd({
    idBd,
    copierDonnées = true,
  }: {
    idBd: string;
    copierDonnées?: boolean;
  }): Promise<string> {
    const { bd: bdBase, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    const licence = await bdBase.get("licence");
    const licenceContenu = await bdBase.get("licenceContenu");
    if (!licence)
      throw new Error(`Aucune licence trouvée sur la BD source ${idBd}.`);
    const idNouvelleBd = await this.créerBd({
      licence,
      licenceContenu,
    });
    const { bd: nouvelleBd, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBdTypée({
        id: idNouvelleBd,
        type: "nested",
        schéma: schémaStructureBdBd,
      });

    const métadonnées = await bdBase.get("métadonnées");
    if (métadonnées) {
      await this.sauvegarderMétadonnéesBd({ idBd: idNouvelleBd, métadonnées });
    }

    const noms = await bdBase.get("noms");
    if (noms) {
      await this.sauvegarderNomsBd({ idBd: idNouvelleBd, noms });
    }

    const descriptions = await bdBase.get("descriptions");
    if (descriptions) {
      await this.sauvegarderDescriptionsBd({
        idBd: idNouvelleBd,
        descriptions,
      });
    }

    const idBdMotsClefs = await bdBase.get("motsClefs");
    if (idBdMotsClefs) {
      const { bd: bdMotsClefs, fOublier: fOublierBdMotsClefs } =
        await this.client.ouvrirBdTypée({
          id: idBdMotsClefs,
          type: "set",
          schéma: schémaStructureBdMotsClefs,
        });
      const motsClefs = (await bdMotsClefs.all()).map((x) => x.value);
      await fOublierBdMotsClefs();
      await this.ajouterMotsClefsBd({
        idBd: idNouvelleBd,
        idsMotsClefs: motsClefs,
      });
    }

    const idBdNuées = await bdBase.get("nuées");
    if (idBdNuées) {
      const { bd: bdNuées, fOublier: fOublierBdNuées } =
        await this.client.ouvrirBdTypée({
          id: idBdNuées,
          type: "set",
          schéma: schémaStructureBdNuées,
        });
      const nuées = (await bdNuées.all()).map((x) => x.value);
      await fOublierBdNuées();
      await this.rejoindreNuées({
        idBd: idNouvelleBd,
        idsNuées: nuées,
      });
    }

    const idBdTableaux = await bdBase.get("tableaux");
    const idNouvelleBdTableaux = await nouvelleBd.get("tableaux");
    if (!idNouvelleBdTableaux) throw new Error("Erreur d'initialisation.");

    const { bd: nouvelleBdTableaux, fOublier: fOublierNouvelleTableaux } =
      await this.client.ouvrirBdTypée({
        id: idNouvelleBdTableaux,
        type: "ordered-keyvalue",
        schéma: schémaBdTableauxDeBd,
      });
    if (idBdTableaux) {
      const { bd: bdTableaux, fOublier: fOublierBdTableaux } =
        await this.client.ouvrirBdTypée({
          id: idBdTableaux,
          type: "ordered-keyvalue",
          schéma: schémaBdTableauxDeBd,
        });
      const tableaux = await bdTableaux.all();

      await fOublierBdTableaux();
      for (const { key: idTableau, value: tableau } of tableaux) {
        const idNouveauTableau: string =
          await this.client.tableaux.copierTableau({
            id: idTableau,
            idBd: idNouvelleBd,
            copierDonnées,
          });
        await nouvelleBdTableaux.set(idNouveauTableau, tableau);
      }
    }

    const statut = (await bdBase.get("statut")) || {
      statut: "active",
    };
    await nouvelleBd.set("statut", statut);

    const image = await bdBase.get("image");
    if (image) await nouvelleBd.set("image", image);

    await nouvelleBd.set("copiéDe", { id: idBd });

    await Promise.allSettled([
      fOublier(),
      fOublierNouvelleTableaux(),
      fOublierNouvelle(),
    ]);
    return idNouvelleBd;
  }

  async créerBdDeSchéma({
    schéma,
    épingler,
  }: {
    schéma: schémaSpécificationBd;
    épingler?: boolean;
  }): Promise<string> {
    const { tableaux, motsClefs, nuées, licence, licenceContenu, statut } =
      schéma;

    // On n'ajoutera la BD que lorsqu'elle sera prête
    const idBd = await this.créerBd({
      licence,
      licenceContenu,
      épingler,
    });

    if (motsClefs) {
      await this.ajouterMotsClefsBd({ idBd, idsMotsClefs: motsClefs });
    }

    if (nuées) {
      await this.rejoindreNuées({ idBd, idsNuées: nuées });
    }

    if (statut) {
      await this.changerStatutBd({ idBd, statut });
    }

    for (const tb of tableaux) {
      const { cols, clef: clefTableau } = tb;
      const idTableau = await this.ajouterTableauBd({ idBd, clefTableau });

      for (const c of cols) {
        const { idColonne, idVariable, index, optionnelle } = c;
        await this.client.tableaux.ajouterColonneTableau({
          idTableau,
          idVariable,
          idColonne,
        });
        if (index) {
          await this.client.tableaux.changerColIndex({
            idTableau,
            idColonne,
            val: true,
          });
        }
        if (!optionnelle) {
          const règle: règleExiste = {
            typeRègle: "existe",
            détails: {},
          };
          await this.client.tableaux.ajouterRègleTableau({
            idTableau,
            idColonne,
            règle,
          });
        }
      }
    }

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
  async suivreNuéesBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListeDeClef({
      id: idBd,
      clef: "nuées",
      schéma: { type: "string" },
      f,
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

  async combinerBds({
    idBdBase,
    idBd2,
    patience = 100,
  }: {
    idBdBase: string;
    idBd2: string;
    patience?: number;
  }): Promise<void> {
    const obtTableaux = async (idBd: string): Promise<infoTableauAvecId[]> => {
      return await uneFois(
        async (
          fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>,
        ): Promise<schémaFonctionOublier> => {
          return await this.suivreTableauxBd({ idBd, f: fSuivi });
        },
        attendreStabilité(patience),
      );
    };

    const tableauxBase = await obtTableaux(idBdBase);
    const tableauxBd2 = await obtTableaux(idBd2);

    for (const info of tableauxBd2) {
      const { id: idTableau, clef } = info;
      if (clef) {
        const idTableauBaseCorresp = tableauxBase.find(
          (t) => t.clef === clef,
        )?.id;

        if (idTableauBaseCorresp) {
          await this.client.tableaux.combinerDonnées({
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
    const fFinale = async (tableaux: infoTableauAvecId[]) => {
      const infoTableau = tableaux.find((t) => t.clef === clef);
      await f(infoTableau?.id);
    };
    return await this.suivreTableauxBd({ idBd, f: fFinale });
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

  async sauvegarderMétadonnéesBd({
    idBd,
    métadonnées,
  }: {
    idBd: string;
    métadonnées: { [key: string]: élémentsBd };
  }): Promise<void> {
    await this._confirmerPermission({ idBd });

    const { bd: bdBd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bdBd.set(`métadonnées`, métadonnées);
    await fOublier();
  }

  async sauvegarderMétadonnéeBd({
    idBd,
    clef,
    métadonnée,
  }: {
    idBd: string;
    clef: string;
    métadonnée: string;
  }): Promise<void> {
    await this._confirmerPermission({ idBd });
    const { bd: bdBd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bdBd.set(`métadonnées/${clef}`, métadonnée);
    await fOublier();
  }

  async effacerMétadonnéeBd({
    idBd,
    clef,
  }: {
    idBd: string;
    clef: string;
  }): Promise<void> {
    await this._confirmerPermission({ idBd });

    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    await bd.del(`métadonnées/${clef}`);
    await fOublier();
  }

  @cacheSuivi
  async suivreMétadonnéesBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<{ [key: string]: élémentsBd }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
      f: async (bd) => {
        await f((await bd.get("métadonnées")) || {});
      },
    });
  }

  async rejoindreNuées({
    idBd,
    idsNuées,
  }: {
    idBd: string;
    idsNuées: string | string[];
  }): Promise<void> {
    await this._confirmerPermission({ idBd });
    if (!Array.isArray(idsNuées)) idsNuées = [idsNuées];
    const idBdNuées = await this.client.obtIdBd({
      nom: "nuées",
      racine: idBd,
      type: "set",
    });

    const { bd: bdNuées, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNuées,
      type: "set",
      schéma: schémaStructureBdNuées,
    });
    for (const id of idsNuées) {
      const nuéesExistantes = (await bdNuées.all()).map((x) => x.value);
      if (!nuéesExistantes.includes(id)) await bdNuées.add(id);
    }
    await fOublier();
  }

  async quitterNuée({
    idBd,
    idNuée,
  }: {
    idBd: string;
    idNuée: string;
  }): Promise<void> {
    await this._confirmerPermission({ idBd });
    const idBdNuées = await this.client.obtIdBd({
      nom: "nuée",
      racine: idBd,
      type: "set",
    });

    const { bd: bdNuées, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNuées,
      type: "set",
      schéma: schémaStructureBdNuées,
    });

    await bdNuées.del(idNuée);

    await fOublier();
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
      type: "ordered-keyvalue",
    });
    if (!idBdTableaux) throw new Error("Id Bd Tableau non obtenable.");
    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdTableaux,
      type: "ordered-keyvalue",
      schéma: schémaBdTableauxDeBd,
    });

    const infoExistante = await bdTableaux.get(idTableau);
    if (infoExistante) {
      infoExistante.value.clef = clef;
      bdTableaux.set(idTableau, infoExistante.value);
    }

    await fOublier();
  }

  async changerStatutBd({
    idBd,
    statut,
  }: {
    idBd: string;
    statut: schémaStatut;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    bd.set("statut", statut);
    await fOublier();
  }

  async suivreStatutBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<schémaStatut>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDic({
      id: idBd,
      schéma: schémaStructureBdBd,
      f: async (x) => {
        if (x["statut"]) return await f(x["statut"]);
      },
    });
  }

  async marquerObsolète({
    idBd,
    idNouvelle,
  }: {
    idBd: string;
    idNouvelle?: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    bd.set("statut", { statut: "obsolète", idNouvelle });
    await fOublier();
  }

  async marquerActive({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    bd.set("statut", { statut: "active" });
    await fOublier();
  }

  async marquerJouet({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    bd.set("statut", { statut: "jouet" });
    await fOublier();
  }

  async marquerInterne({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBd,
      type: "nested",
      schéma: schémaStructureBdBd,
    });
    bd.set("statut", { statut: "interne" });
    await fOublier();
  }

  @cacheSuivi
  async suivreMotsClefsBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const motsClefs: { deNuées?: string[][]; deBd?: string[] } = {};
    const fFinale = async () => {
      const motsClefsFinaux = [...new Set(motsClefs.deNuées?.flat() || [])];
      for (const motClef of motsClefs.deBd || []) {
        if (!motsClefsFinaux.includes(motClef)) motsClefsFinaux.push(motClef);
      }

      return await f(motsClefsFinaux);
    };
    const constl = this.client;
    const fOublierMotsClefsNuées = await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: string[]) => Promise<void>;
      }) => {
        return await constl.bds.suivreNuéesBd({ idBd, f: fSuivreRacine });
      },
      fBranche: async ({
        id: idNuée,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<string[]>;
      }): Promise<schémaFonctionOublier> => {
        return await constl.nuées.suivreMotsClefsNuée({
          idNuée,
          f: fSuivreBranche,
        });
      },
      f: async (motsClefsNuées: string[][]) => {
        motsClefs.deNuées = motsClefsNuées;
        await fFinale();
      },
    });
    const fOublierMotsClefsBd = await this.client.suivreBdListeDeClef({
      id: idBd,
      clef: "motsClefs",
      schéma: { type: "string" },
      f: async (motsClefsBd: string[]) => {
        motsClefs.deBd = motsClefsBd;
        await fFinale();
      },
    });

    return async () => {
      await Promise.allSettled([
        fOublierMotsClefsBd(),
        fOublierMotsClefsNuées(),
      ]);
    };
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
              (r) =>
                r.règle.règle.typeRègle !== "catégorie" && r.colonne === c.id,
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
