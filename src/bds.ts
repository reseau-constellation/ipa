import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";
import { ImportCandidate } from "ipfs-core-types/src/utils";

import { WorkBook, utils, BookType, writeFile, write as writeXLSX } from "xlsx";
import toBuffer from "it-to-buffer";
import fs from "fs";
import path from "path";
import oùSommesNous from "wherearewe";

import { InfoColAvecCatégorie, typeÉlémentsBdTableaux } from "@/tableaux.js";
import { schémaStatut, TYPES_STATUT } from "@/utils/types.js";

import { règleColonne, élémentDonnées, erreurValidation } from "@/valid.js";
import { élémentBdListeDonnées } from "@/tableaux.js";
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
    idUnique?: string;
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

export type typeÉlémentsBdBD = string | schémaStatut;

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

export default class BDs {
  client: ClientConstellation;
  idBd: string;

  constructor({ client, id }: { client: ClientConstellation; id: string }) {
    this.client = client;
    this.idBd = id;
  }

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
        adresseBd: undefined,
        premierMod: this.client.bdCompte!.id,
      },
    });

    const { bd: bdBD, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id: idBdBd });
    await bdBD.set("type", "bd");
    await bdBD.set("licence", licence);

    const accès = bdBD.access as unknown as ContrôleurConstellation;
    const optionsAccès = { adresseBd: accès.adresseBd };

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
      type: "feed",
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

    fOublier();

    return idBdBd;
  }

  async ajouterÀMesBds({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<FeedStore<string>>({
      id: this.idBd,
    });
    await bd.add(id);
    fOublier();
  }

  async enleverDeMesBds({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<FeedStore<string>>({
      id: this.idBd,
    });
    await this.client.effacerÉlémentDeBdListe({ bd, élément: id });
    fOublier();
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
      await this.client.ouvrirBd<FeedStore<typeÉlémentsBdTableaux>>({
        id: idNouvelleBdTableaux,
      });
    const { bd: bdTableaux, fOublier: fOublierBdTableaux } =
      await this.client.ouvrirBd<FeedStore<typeÉlémentsBdTableaux>>({
        id: idBdTableaux,
      });
    const tableaux = ClientConstellation.obtÉlémentsDeBdListe({
      bd: bdTableaux,
    });

    for (const idT of tableaux) {
      const idNouveauTableau: string =
        await this.client.tableaux!.copierTableau({ id: idT, copierDonnées });
      await nouvelleBdTableaux.add(idNouveauTableau);
    }

    const statut = bdBase.get("statut") || { statut: TYPES_STATUT.ACTIVE };
    await nouvelleBd.set("statut", statut);

    const image = bdBase.get("image");
    if (image) await nouvelleBd.set("image", image);

    await nouvelleBd.set("copiéDe", id);

    fOublier();
    fOublierNouvelleTableaux();
    fOublierBdNoms();
    fOublierBdDescr();
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
      const { cols, idUnique } = tb;
      const idTableau = await this.ajouterTableauBd({ id: idBd });
      if (idUnique) {
        await this.client.tableaux!.spécifierIdUniqueTableau({
          idTableau,
          idUnique,
        });
      }

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
    const obtTableauxEtIdsUniques = async (
      idBd: string
    ): Promise<{ idTableau: string; idUnique: string }[]> => {
      const tableaux = await uneFois(
        async (
          fSuivi: schémaFonctionSuivi<string[]>
        ): Promise<schémaFonctionOublier> => {
          return await this.suivreTableauxBd({ id: idBd, f: fSuivi });
        }
      );
      const idsUniques = [];
      for (const idTableau of tableaux) {
        const idUnique = await uneFois(
          async (
            fSuivi: schémaFonctionSuivi<string | undefined>
          ): Promise<schémaFonctionOublier> => {
            return await this.client.tableaux!.suivreIdUnique({
              idTableau,
              f: fSuivi,
            });
          }
        );
        if (idUnique) idsUniques.push({ idTableau, idUnique });
      }
      return idsUniques;
    };

    const tableauxBase = await obtTableauxEtIdsUniques(idBdBase);
    const tableauxBd2 = await obtTableauxEtIdsUniques(idBd2);

    for (const info of tableauxBd2) {
      const { idTableau, idUnique } = info;
      const idTableauBaseCorresp = tableauxBase.find(
        (t) => t.idUnique === idUnique
      )?.idTableau;

      if (idTableauBaseCorresp) {
        await this.client.tableaux!.combinerDonnées({
          idTableauBase: idTableauBaseCorresp,
          idTableau2: idTableau,
        });
      }
    }
  }

  async suivreTableauParIdUnique({
    idBd,
    idUniqueTableau,
    f,
  }: {
    idBd: string;
    idUniqueTableau: string;
    f: schémaFonctionSuivi<string | undefined>;
  }): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (ids: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({ id: idBd, f: fSuivreRacine });
    };

    const fCondition = async (
      id: string,
      fSuivreCondition: (état: boolean) => void
    ): Promise<schémaFonctionOublier> => {
      return await this.client.tableaux!.suivreIdUnique({
        idTableau: id,
        f: (id) => fSuivreCondition(id === idUniqueTableau),
      });
    };

    return await this.client.suivreBdsSelonCondition({
      fListe,
      fCondition,
      f: (ids) => f(ids.length ? ids[0] : undefined),
    });
  }

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

  async suivreTableauUniqueDeBdUnique({
    schémaBd,
    motClefUnique,
    idUniqueTableau,
    f,
  }: {
    schémaBd: schémaSpécificationBd;
    motClefUnique: string;
    idUniqueTableau: string;
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
      return await this.suivreTableauParIdUnique({
        idBd: id,
        idUniqueTableau,
        f: fSuivreBd,
      });
    };
    return await this.client.suivreBdDeFonction<string>({
      fRacine,
      f,
      fSuivre,
    });
  }

  async suivreDonnéesDeTableauUnique<T extends élémentBdListeDonnées>({
    schémaBd,
    motClefUnique,
    idUniqueTableau,
    f,
  }: {
    schémaBd: schémaSpécificationBd;
    motClefUnique: string;
    idUniqueTableau: string;
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
      return await this.suivreTableauUniqueDeBdUnique({
        schémaBd,
        motClefUnique,
        idUniqueTableau,
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
    idUniqueTableau,
    vals,
  }: {
    schémaBd: schémaSpécificationBd;
    motClefUnique: string;
    idUniqueTableau: string;
    vals: T;
  }): Promise<string> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreTableauUniqueDeBdUnique({
          schémaBd,
          motClefUnique,
          idUniqueTableau,
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
    idUniqueTableau,
    empreinte,
  }: {
    schémaBd: schémaSpécificationBd;
    motClefUnique: string;
    idUniqueTableau: string;
    empreinte: string;
  }): Promise<void> {
    const idTableau = await uneFois(
      async (fSuivi: schémaFonctionSuivi<string>) => {
        return await this.suivreTableauUniqueDeBdUnique({
          schémaBd,
          motClefUnique,
          idUniqueTableau,
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
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });

    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    fOublier();
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
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.set(langue, nom);
    fOublier();
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
    if (!idBdNoms) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.del(langue);
    fOublier();
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
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
    fOublier();
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
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    await bdDescr.set(langue, descr);
    fOublier();
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
    if (!idBdDescr) throw `Permission de modification refusée pour BD ${id}.`;

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdDescr });
    await bdDescr.del(langue);
    fOublier();
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
    fOublier();
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
      throw `Permission de modification refusée pour BD ${idBd}.`;
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
    fOublier();
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
      throw `Permission de modification refusée pour BD ${idBd}.`;
    }

    const { bd: bdMotsClefs, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >({ id: idBdMotsClefs });

    await this.client.effacerÉlémentDeBdListe({
      bd: bdMotsClefs,
      élément: idMotClef,
    });

    fOublier();
  }

  async ajouterTableauBd({ id }: { id: string }): Promise<string> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: id,
      type: "feed",
      optionsAccès,
    });
    if (!idBdTableaux) {
      throw `Permission de modification refusée pour BD ${id}.`;
    }

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >({ id: idBdTableaux });
    const idTableau = await this.client.tableaux!.créerTableau();
    await bdTableaux.add(idTableau);

    fOublier();
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
      type: "feed",
      optionsAccès,
    });
    if (!idBdTableaux) {
      throw `Permission de modification refusée pour BD ${id}.`;
    }

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >({ id: idBdTableaux });
    await this.client.effacerÉlémentDeBdListe({
      bd: bdTableaux,
      élément: idTableau,
    });
    fOublier();

    // Enfin, effacer les données et le tableau lui-même
    await this.client.tableaux!.effacerTableau({ idTableau });
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
    fOublier();
  }

  async marquerActive({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id });
    bd.set("statut", { statut: TYPES_STATUT.ACTIVE });
    fOublier();
  }

  async marquerBêta({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id });
    bd.set("statut", { statut: TYPES_STATUT.BÊTA });
    fOublier();
  }

  async marquerInterne({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id });
    bd.set("statut", { statut: TYPES_STATUT.INTERNE });
    fOublier();
  }

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
    fOublier();
  }

  async effacerImage({ idBd }: { idBd: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdBD>
    >({ id: idBd });
    await bd.del("image");
    fOublier();
  }

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

  async suivreNomsBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({ id, clef: "noms", f });
  }

  async suivreDescrBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({ id, clef: "descriptions", f });
  }

  async suivreMotsClefsBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListeDeClef({ id, clef: "motsClefs", f });
  }

  async suivreTableauxBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListeDeClef({ id, clef: "tableaux", f });
  }

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
            ["numérique", "catégorique"].includes(c.catégorie)
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

      return () => {
        fOublierCols();
        fOublierRègles();
      };
    };

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({ id, f: fSuivreRacine });
    };

    return await this.client.suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

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
            ["numérique", "catégorique"].includes(c.catégorie)
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

      return () => {
        fOublierDonnées();
        fOublierErreurs();
        fOublierColonnes();
      };
    };

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreTableauxBd({ id, f: fSuivreRacine });
    };

    return await this.client.suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

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
    return () => {
      oublierAccès();
      oublierCouverture();
      oublierValide();
    };
  }

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
    const fSuivreTableaux = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<string[]>;
    }) => {
      return await this.client.suivreBdsDeBdListe({
        id,
        f: fSuivreBd,
        fBranche,
      });
    };

    return await this.client.suivreBdDeClef({
      id,
      clef: "tableaux",
      f: fFinale,
      fSuivre: fSuivreTableaux,
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

    const idsTableaux = await uneFois((f: schémaFonctionSuivi<string[]>) =>
      this.suivreTableauxBd({ id, f })
    );

    for (const idTableau of idsTableaux) {
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
  }): Promise<void> {
    const { doc, fichiersSFIP, nomFichier } = données;

    const conversionsTypes: { [key: string]: BookType } = {
      xls: "biff8",
    };
    const bookType: BookType = conversionsTypes[formatDoc] || formatDoc;

    // Créer le dossier si nécessaire. Sinon, xlsx n'écrit rien, et ce, sans se plaindre.
    if (
      !(oùSommesNous.isBrowser || oùSommesNous.isWebWorker) &&
      !fs.existsSync(dir)
    ) {
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
    } else {
      writeFile(doc, path.join(dir, `${nomFichier}.${formatDoc}`), {
        bookType,
      });
    }
  }

  async effacerBd({ id }: { id: string }): Promise<void> {
    // D'abord effacer l'entrée dans notre liste de BDs
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >({ id: this.idBd });
    await this.client.effacerÉlémentDeBdListe({ bd: bdRacine, élément: id });
    fOublier();

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
      type: "feed",
      optionsAccès,
    });
    if (idBdTableaux) {
      const { bd: bdTableaux, fOublier: fOublierTableaux } =
        await this.client.ouvrirBd<FeedStore<string>>({ id: idBdTableaux });
      const tableaux: string[] = bdTableaux
        .iterator({ limit: -1 })
        .collect()
        .map((e: LogEntry<string>) => e.payload.value);
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
