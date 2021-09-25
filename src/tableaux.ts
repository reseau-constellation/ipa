import { v4 as uuidv4 } from "uuid";
import XLSX from "xlsx";
import {
  FeedStore,
  KeyValueStore,
  élémentFeedStore,
  isValidAddress,
} from "orbit-db";

import ClientConstellation, {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  élémentsBd,
  élémentBdListe,
  uneFois,
  faisRien,
} from "./client";
import ContrôleurConstellation from "./accès/cntrlConstellation";
import { donnéesBdExportées } from "./bds";
import {
  erreurValidation,
  règleVariable,
  règleVariableAvecId,
  règleColonne,
  générerFonctionRègle,
  schémaFonctionValidation,
  élémentDonnées,
  élémentBdListeDonnées,
} from "./valid";
import { catégorieVariables } from "./variables";
import { traduire } from "./utils";

export type InfoCol = {
  id: string;
  variable: string;
  indexe?: boolean;
};

export type InfoColAvecCatégorie = InfoCol & {
  catégorie: catégorieVariables;
};

export function élémentsÉgaux(
  élément1: { [key: string]: élémentsBd },
  élément2: { [key: string]: élémentsBd }
): boolean {
  const clefs1 = Object.keys(élément1).filter((x) => x !== "id");
  const clefs2 = Object.keys(élément2).filter((x) => x !== "id");
  if (!clefs1.every((x) => élément1[x] === élément2[x])) return false;
  if (!clefs2.every((x) => élément1[x] === élément2[x])) return false;
  return true;
}

export function indexeÉlémentsÉgaux(
  élément1: { [key: string]: élémentsBd },
  élément2: { [key: string]: élémentsBd },
  indexe: string[]
): boolean {
  if (!indexe.every((x) => élément1[x] === élément2[x])) return false;
  return true;
}

export default class Tableaux {
  client: ClientConstellation;

  constructor(client: ClientConstellation) {
    this.client = client;
  }

  async créerTableau(): Promise<string> {
    const idBdTableau = await this.client.créerBdIndépendante("kvstore", {
      adresseBd: undefined,
      premierMod: this.client.bdRacine!.id,
    });
    const bdTableaux = (await this.client.ouvrirBd(
      idBdTableau
    )) as KeyValueStore;

    const accès = bdTableaux.access as unknown as ContrôleurConstellation;
    const optionsAccès = { adresseBd: accès.adresseBd };

    const idBdNoms = await this.client.créerBdIndépendante(
      "kvstore",
      optionsAccès
    );
    await bdTableaux.set("noms", idBdNoms);

    const idBdDonnées = await this.client.créerBdIndépendante(
      "feed",
      optionsAccès
    );
    await bdTableaux.set("données", idBdDonnées);

    const idBdColonnes = await this.client.créerBdIndépendante(
      "feed",
      optionsAccès
    );
    await bdTableaux.set("colonnes", idBdColonnes);

    const idBdRègles = await this.client.créerBdIndépendante(
      "feed",
      optionsAccès
    );
    await bdTableaux.set("règles", idBdRègles);

    return idBdTableau;
  }

  async copierTableau(id: string): Promise<string> {
    const bdBase = (await this.client.ouvrirBd(id)) as KeyValueStore;
    const idNouveauTableau = await this.créerTableau();
    const nouvelleBd = (await this.client.ouvrirBd(
      idNouveauTableau
    )) as KeyValueStore;

    //Copier l'id unique s'il y a lieu
    const idUnique = await bdBase.get("idUnique");
    if (idUnique) await nouvelleBd.put("idUnique", idUnique);

    //Copier les noms
    const idBdNoms = await bdBase.get("noms");
    const noms = ((await this.client.ouvrirBd(idBdNoms)) as KeyValueStore).all;
    await this.ajouterNomsTableau(idNouveauTableau, noms);

    //Copier les données
    await this.client.copierContenuBdListe(bdBase, nouvelleBd, "données");

    //Copier les colonnes
    await this.client.copierContenuBdListe(bdBase, nouvelleBd, "colonnes");

    //Copier les règles
    await this.client.copierContenuBdListe(bdBase, nouvelleBd, "règles");

    return idNouveauTableau;
  }

  async spécifierIdUniqueTableau(
    idTableau: string,
    idUnique: string
  ): Promise<void> {
    const bdTableau = (await this.client.ouvrirBd(idTableau)) as KeyValueStore;
    await bdTableau.put("idUnique", idUnique);
  }

  async suivreIdUnique(
    idTableau: string,
    f: schémaFonctionSuivi<string | undefined>
  ): Promise<schémaFonctionOublier> {
    const fFinale = async (bd: KeyValueStore) => {
      const idUnique = await bd.get("idUnique");
      f(idUnique);
    };
    return await this.client.suivreBd(idTableau, fFinale);
  }

  async changerColIndexe(
    idTableau: string,
    idColonne: string,
    val: boolean
  ): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(idTableau);
    const idBdColonnes = await this.client.obtIdBd(
      "colonnes",
      idTableau,
      "feed",
      optionsAccès
    );
    if (!idBdColonnes)
      throw `Permission de modification refusée pour BD ${idTableau}.`;

    const bdColonnes = (await this.client.ouvrirBd(idBdColonnes)) as FeedStore;
    const éléments = ClientConstellation.obtÉlémentsDeBdListe<InfoCol>(
      bdColonnes,
      false
    );
    const élémentCol = éléments.find((x) => x.payload.value.id === idColonne);

    if (élémentCol && Boolean(élémentCol.payload.value.indexe) !== val) {
      const { value } = élémentCol.payload;
      const nouvelÉlément: InfoCol = Object.assign(value, { indexe: val });
      await bdColonnes.remove(élémentCol.hash);
      await bdColonnes.add(nouvelÉlément);
    }
  }

  async suivreIndexe(
    idTableau: string,
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    const fFinale = (cols: InfoColAvecCatégorie[]) => {
      const indexes = cols.filter((c) => c.indexe).map((c) => c.id);
      f(indexes);
    };
    return await this.suivreColonnes(idTableau, fFinale);
  }

  async suivreDonnées<T extends élémentBdListeDonnées>(
    idTableau: string,
    f: schémaFonctionSuivi<élémentDonnées<T>[]>,
    clefsSelonVariables = false
  ): Promise<schémaFonctionOublier> {
    const info: {
      données?: élémentBdListe<T>[];
      colonnes?: { [key: string]: string };
    } = {};

    const fFinale = () => {
      const { données, colonnes } = info;

      if (données && colonnes) {
        const donnéesFinales: élémentDonnées<T>[] = données.map(
          (x): élémentDonnées<T> => {
            const empreinte = x.hash;
            const élément = x.payload.value;

            const données: T = clefsSelonVariables
              ? Object.keys(élément).reduce((acc: T, elem: string) => {
                  const idVar = elem === "id" ? "id" : colonnes[elem];
                  (acc as élémentBdListeDonnées)[idVar] = élément[elem];
                  return acc;
                }, {} as T)
              : élément;

            return { données, empreinte };
          }
        );
        f(donnéesFinales);
      }
    };

    const fSuivreColonnes = (colonnes: InfoColAvecCatégorie[]) => {
      info.colonnes = Object.fromEntries(
        colonnes.map((c) => [c.id, c.variable])
      );
      fFinale();
    };
    const oublierColonnes = await this.suivreColonnes(
      idTableau,
      fSuivreColonnes
    );

    const fSuivreDonnées = (données: élémentBdListe<T>[]) => {
      info.données = données;
      fFinale();
    };
    const oublierDonnées = await this.client.suivreBdListeDeClef<T>(
      idTableau,
      "données",
      fSuivreDonnées,
      false
    );

    return () => {
      oublierDonnées();
      oublierColonnes();
    };
  }

  async exporterDonnées(
    idTableau: string,
    langues?: string[],
    doc?: XLSX.WorkBook,
    nomFichier?: string
  ): Promise<donnéesBdExportées> {
    /* Créer le document si nécessaire */
    doc = doc || XLSX.utils.book_new();
    const fichiersSFIP: Set<{ cid: string; ext: string }> = new Set();

    let nomTableau: string;
    const idCourtTableau = idTableau.split("/").pop()!;
    if (langues) {
      const noms = await uneFois(
        (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
          this.suivreNomsTableau(idTableau, f)
      );

      nomTableau = traduire(noms, langues) || idCourtTableau;
    } else {
      nomTableau = idCourtTableau;
    }

    const colonnes = await uneFois(
      (f: schémaFonctionSuivi<InfoColAvecCatégorie[]>) =>
        this.suivreColonnes(idTableau, f)
    );

    const données = await uneFois(
      (f: schémaFonctionSuivi<élémentDonnées<élémentBdListeDonnées>[]>) =>
        this.suivreDonnées(idTableau, f)
    );

    const formaterÉlément = (
      é: élémentBdListeDonnées
    ): élémentBdListeDonnées => {
      const élémentFinal: élémentBdListeDonnées = {};

      for (const col of Object.keys(é)) {
        const colonne = colonnes.find((c) => c.id === col);
        if (!colonne) continue;

        const { variable, catégorie } = colonne;

        let val: string | number;
        switch (typeof é[col]) {
          case "object":
            if (["audio", "photo", "vidéo", "fichier"].includes(catégorie)) {
              const { cid, ext } = é[col] as { cid: string; ext: string };
              if (!cid || !ext) continue;
              val = `${cid}.${ext}`;

              fichiersSFIP.add({ cid, ext });
            } else {
              val = JSON.stringify(é[col]);
            }

            break;
          case "boolean":
            val = (é[col] as boolean).toString();
            break;
          case "number":
            val = é[col] as number;
            break;
          case "string":
            val = é[col] as string;
            break;
          default:
            continue;
        }
        if (val !== undefined) élémentFinal[langues ? variable : col] = val;
      }

      return élémentFinal;
    };

    let donnéesPourXLSX = données.map((d) => formaterÉlément(d.données));

    if (langues) {
      const variables = await uneFois((f: schémaFonctionSuivi<string[]>) =>
        this.suivreVariables(idTableau, f)
      );
      const nomsVariables: { [key: string]: string } = {};
      for (const idVar of variables) {
        const nomsDisponibles = await uneFois(
          (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
            this.client.variables!.suivreNomsVariable(idVar, f)
        );
        const idCol = colonnes.find((c) => c.variable === idVar)!.id!;
        nomsVariables[idVar] = traduire(nomsDisponibles, langues) || idCol;
      }
      donnéesPourXLSX = donnéesPourXLSX.map((d) =>
        Object.keys(d).reduce((acc: élémentBdListeDonnées, elem: string) => {
          const nomVar = nomsVariables[elem];
          acc[nomVar] = d[elem];
          return acc;
        }, {})
      );
    }

    /* créer le tableau */
    const tableau = XLSX.utils.json_to_sheet(donnéesPourXLSX);

    /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
    XLSX.utils.book_append_sheet(doc, tableau, nomTableau.slice(0, 30));

    nomFichier = nomFichier || nomTableau;
    return { doc, fichiersSFIP, nomFichier };
  }

  async ajouterÉlément(
    idTableau: string,
    vals: { [key: string]: élémentsBd }
  ): Promise<string> {
    const optionsAccès = await this.client.obtOpsAccès(idTableau);
    const idBdDonnées = await this.client.obtIdBd(
      "données",
      idTableau,
      "feed",
      optionsAccès
    );
    if (!idBdDonnées)
      throw `Permission de modification refusée pour BD ${idTableau}.`;

    const bdDonnées = (await this.client.ouvrirBd(idBdDonnées)) as FeedStore;
    vals = await this.vérifierClefsÉlément(idTableau, vals);
    const id = uuidv4();
    return await bdDonnées.add({ ...vals, id });
  }

  async modifierÉlément(
    idTableau: string,
    vals: { [key: string]: élémentsBd },
    empreintePrécédente: string
  ): Promise<string | void> {
    const optionsAccès = await this.client.obtOpsAccès(idTableau);
    const idBdDonnées = await this.client.obtIdBd(
      "données",
      idTableau,
      "feed",
      optionsAccès
    );
    if (!idBdDonnées)
      throw `Permission de modification refusée pour BD ${idTableau}.`;

    const bdDonnées = (await this.client.ouvrirBd(idBdDonnées)) as FeedStore;

    const précédent = this.client.obtÉlémentBdListeSelonEmpreinte(
      bdDonnées,
      empreintePrécédente
    ) as { [key: string]: élémentsBd };

    let élément = Object.assign({}, précédent, vals);

    Object.keys(vals).map((c: string) => {
      if (vals[c] === undefined) delete élément[c];
    });
    élément = await this.vérifierClefsÉlément(idTableau, élément);

    if (!élémentsÉgaux(élément, précédent)) {
      const résultat = await Promise.all([
        bdDonnées.remove(empreintePrécédente),
        bdDonnées.add(élément),
      ]);
      return résultat[1];
    }
    return Promise.resolve();
  }

  async vérifierClefsÉlément<T>(
    idTableau: string,
    élément: { [key: string]: T }
  ): Promise<{ [key: string]: T }> {
    const optionsAccès = await this.client.obtOpsAccès(idTableau);
    const idBdColonnes = await this.client.obtIdBd(
      "colonnes",
      idTableau,
      "feed",
      optionsAccès
    );
    if (!idBdColonnes)
      throw `Permission de modification refusée pour BD ${idTableau}.`;

    const bdColonnes = (await this.client.ouvrirBd(idBdColonnes)) as FeedStore;
    const idsColonnes: string[] = bdColonnes
      .iterator({ limit: -1 })
      .collect()
      .map((e: élémentFeedStore<InfoCol>) => e.payload.value.id);
    const clefsPermises = [...idsColonnes, "id"];
    const clefsFinales = Object.keys(élément).filter((x: string) =>
      clefsPermises.includes(x)
    );
    return Object.fromEntries(clefsFinales.map((x: string) => [x, élément[x]]));
  }

  async effacerÉlément(
    idTableau: string,
    empreinteÉlément: string
  ): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(idTableau);
    const idBdDonnées = await this.client.obtIdBd(
      "données",
      idTableau,
      "feed",
      optionsAccès
    );
    if (!idBdDonnées)
      throw `Permission de modification refusée pour BD ${idTableau}.`;

    const bdDonnées = (await this.client.ouvrirBd(idBdDonnées)) as FeedStore;
    await bdDonnées.remove(empreinteÉlément);
  }

  async combinerDonnées(
    idTableauBase: string,
    idTableau2: string
  ): Promise<void> {
    const colsTableauBase = await uneFois(
      async (fSuivi: schémaFonctionSuivi<InfoColAvecCatégorie[]>) => {
        return await this.suivreColonnes(idTableauBase, fSuivi);
      }
    );

    const donnéesTableauBase = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<élémentDonnées<élémentBdListeDonnées>[]>
      ) => {
        return await this.suivreDonnées(idTableauBase, fSuivi);
      }
    );

    const donnéesTableau2 = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<élémentDonnées<élémentBdListeDonnées>[]>
      ) => {
        return await this.suivreDonnées(idTableau2, fSuivi);
      }
    );

    const indexes = colsTableauBase.filter((c) => c.indexe).map((c) => c.id);
    for (const nouvelÉlément of donnéesTableau2) {
      const existant = donnéesTableauBase.find((d) =>
        indexeÉlémentsÉgaux(d.données, nouvelÉlément.données, indexes)
      );
      if (existant) {
        const àAjouter: { [key: string]: élémentsBd } = {};
        for (const col of colsTableauBase) {
          if (
            existant.données[col.id] === undefined &&
            nouvelÉlément.données[col.id] !== undefined
          ) {
            àAjouter[col.id] = nouvelÉlément.données[col.id];
          }
        }
        if (Object.keys(àAjouter).length) {
          await this.effacerÉlément(idTableauBase, existant.empreinte);
          await this.ajouterÉlément(
            idTableauBase,
            Object.assign({}, existant.données, àAjouter)
          );
        }
      } else {
        await this.ajouterÉlément(idTableauBase, nouvelÉlément.données);
      }
    }
  }

  async importerDonnées(
    idTableau: string,
    données: élémentBdListeDonnées[]
  ): Promise<void> {
    const donnéesTableau = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<élémentDonnées<élémentBdListeDonnées>[]>
      ) => {
        return await this.suivreDonnées(idTableau, fSuivi);
      }
    );

    const nouveaux: élémentBdListeDonnées[] = [];
    for (const élément of données) {
      if (!donnéesTableau.some((x) => élémentsÉgaux(x.données, élément))) {
        nouveaux.push(élément);
      }
    }

    const àEffacer: string[] = [];
    for (const élément of donnéesTableau) {
      if (!données.some((x) => élémentsÉgaux(x, élément.données))) {
        àEffacer.push(élément.empreinte);
      }
    }

    for (const n of nouveaux) {
      await this.ajouterÉlément(idTableau, n);
    }

    for (const e of àEffacer) {
      await this.effacerÉlément(idTableau, e);
    }
  }

  async ajouterNomsTableau(
    idTableau: string,
    noms: { [key: string]: string }
  ): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(idTableau);
    const idBdNoms = await this.client.obtIdBd(
      "noms",
      idTableau,
      "kvstore",
      optionsAccès
    );
    if (!idBdNoms)
      throw `Permission de modification refusée pour BD ${idTableau}.`;

    const bdNoms = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
  }

  async sauvegarderNomTableau(
    idTableau: string,
    langue: string,
    nom: string
  ): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(idTableau);
    const idBdNoms = await this.client.obtIdBd(
      "noms",
      idTableau,
      "kvstore",
      optionsAccès
    );
    if (!idBdNoms)
      throw `Permission de modification refusée pour BD ${idTableau}.`;

    const bdNoms = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    await bdNoms.set(langue, nom);
  }

  async effacerNomTableau(idTableau: string, langue: string): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(idTableau);
    const idBdNoms = await this.client.obtIdBd(
      "noms",
      idTableau,
      "kvstore",
      optionsAccès
    );
    if (!idBdNoms)
      throw `Permission de modification refusée pour BD ${idTableau}.`;

    const bdNoms = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    await bdNoms.del(langue);
  }

  async suivreNomsTableau(
    idTableau: string,
    f: schémaFonctionSuivi<{ [key: string]: string }>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef(idTableau, "noms", f);
  }

  async ajouterColonneTableau(
    idTableau: string,
    idVariable: string,
    idColonne?: string
  ): Promise<string> {
    const optionsAccès = await this.client.obtOpsAccès(idTableau);
    const idBdColonnes = await this.client.obtIdBd(
      "colonnes",
      idTableau,
      "feed",
      optionsAccès
    );
    if (!idBdColonnes)
      throw `Permission de modification refusée pour BD ${idTableau}.`;

    const bdColonnes = (await this.client.ouvrirBd(idBdColonnes)) as FeedStore;
    const entrée: InfoCol = {
      id: idColonne || uuidv4(),
      variable: idVariable,
    };
    await bdColonnes.add(entrée);
    return entrée.id;
  }

  async effacerColonneTableau(
    idTableau: string,
    idColonne: string
  ): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(idTableau);
    const idBdColonnes = await this.client.obtIdBd(
      "colonnes",
      idTableau,
      "feed",
      optionsAccès
    );
    if (!idBdColonnes)
      throw `Permission de modification refusée pour BD ${idTableau}.`;

    const bdColonnes = (await this.client.ouvrirBd(idBdColonnes)) as FeedStore;
    const élément = await this.client.rechercherBdListe(
      idBdColonnes,
      (x: élémentFeedStore<InfoCol>) => x.payload.value.id === idColonne
    );

    await bdColonnes.remove(élément.hash);
  }

  async suivreColonnes(
    idTableau: string,
    f: schémaFonctionSuivi<InfoColAvecCatégorie[]>
  ): Promise<schémaFonctionOublier> {
    const fFinale = (colonnes?: InfoColAvecCatégorie[]) => {
      return f(colonnes || []);
    };
    const fBranche = async (
      id: string,
      fSuivi: schémaFonctionSuivi<InfoColAvecCatégorie>,
      branche?: InfoCol
    ): Promise<schémaFonctionOublier> => {
      if (!id) return faisRien;

      return await this.client.variables!.suivreCatégorieVariable(
        id,
        (catégorie) => {
          const col = Object.assign({ catégorie }, branche!);
          fSuivi(col);
        }
      );
    };
    const fIdBdDeBranche = (x: InfoColAvecCatégorie) => x.variable;

    const fCode = (x: InfoColAvecCatégorie) => x.id;
    const fSuivreBdColonnes = async (
      id: string,
      f: schémaFonctionSuivi<InfoColAvecCatégorie[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.suivreBdsDeBdListe(
        id,
        f,
        fBranche,
        fIdBdDeBranche,
        undefined,
        fCode
      );
    };

    return await this.client.suivreBdDeClef(
      idTableau,
      "colonnes",
      fFinale,
      fSuivreBdColonnes
    );
  }

  async suivreVariables(
    idTableau: string,
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    const fFinale = (variables?: string[]) => {
      f((variables || []).filter((v) => v && isValidAddress(v)));
    };
    const fSuivreBdColonnes = async (
      id: string,
      f: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.suivreBdListe(id, (cols: InfoCol[]) =>
        f(cols.map((c) => c.variable))
      );
    };
    return await this.client.suivreBdDeClef(
      idTableau,
      "colonnes",
      fFinale,
      fSuivreBdColonnes
    );
  }

  async ajouterRègleTableau(
    idTableau: string,
    idColonne: string,
    règle: règleVariable
  ): Promise<string> {
    const optionsAccès = await this.client.obtOpsAccès(idTableau);
    const idBdRègles = await this.client.obtIdBd(
      "règles",
      idTableau,
      "feed",
      optionsAccès
    );
    if (!idBdRègles)
      throw `Permission de modification refusée pour tableau ${idTableau}.`;

    const bdRègles = (await this.client.ouvrirBd(idBdRègles)) as FeedStore;

    const id = uuidv4();
    const règleAvecId: règleVariableAvecId = {
      id,
      règle,
    };

    const entrée: règleColonne = {
      règle: règleAvecId,
      source: "tableau",
      colonne: idColonne,
    };
    await bdRègles.add(entrée);

    return id;
  }

  async effacerRègleTableau(idTableau: string, idRègle: string): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès(idTableau);
    const idBdRègles = await this.client.obtIdBd(
      "règles",
      idTableau,
      "feed",
      optionsAccès
    );

    if (!idBdRègles)
      throw `Permission de modification refusée pour tableau ${idTableau}.`;

    const bdRègles = (await this.client.ouvrirBd(idBdRègles)) as FeedStore;

    const règle = await this.client.rechercherBdListe<règleColonne>(
      idBdRègles,
      (r) => r.payload.value.règle.id === idRègle
    );
    if (règle) {
      await bdRègles.remove(règle.hash);
    }
  }

  async suivreRègles(
    idTableau: string,
    f: schémaFonctionSuivi<règleColonne[]>
  ): Promise<schémaFonctionOublier> {
    const dicRègles: { tableau?: règleColonne[]; variable?: règleColonne[] } =
      {};
    const fFinale = () => {
      if (!dicRègles.tableau || !dicRègles.variable) return;
      return f([...dicRègles.tableau, ...dicRègles.variable]);
    };

    //Suivre les règles spécifiées dans le tableau
    const fFinaleRèglesTableau = (règles: règleColonne[]) => {
      dicRègles.tableau = règles;
      fFinale();
    };

    const oublierRèglesTableau =
      await this.client.suivreBdListeDeClef<règleColonne>(
        idTableau,
        "règles",
        fFinaleRèglesTableau
      );

    // Suivre les règles spécifiées dans les variables
    const fListe = async (
      fSuivreRacine: (éléments: InfoCol[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreColonnes(idTableau, fSuivreRacine);
    };

    const fFinaleRèglesVariables = (règles: règleColonne[]) => {
      dicRègles.variable = règles;
      fFinale();
    };

    const fBranche = async (
      idVariable: string,
      fSuivreBranche: schémaFonctionSuivi<règleColonne[]>,
      branche?: InfoCol
    ) => {
      const fFinaleSuivreBranche = (règles: règleVariableAvecId[]) => {
        const règlesColonnes: règleColonne[] = règles.map((r) => {
          return {
            règle: r,
            source: "variable",
            colonne: branche!.id,
          };
        });
        return fSuivreBranche(règlesColonnes);
      };
      return await this.client.variables!.suivreRèglesVariable(
        idVariable,
        fFinaleSuivreBranche
      );
    };

    const fIdBdDeBranche = (b: InfoCol) => b.variable;
    const fCode = (b: InfoCol) => b.id;

    const oublierRèglesVariable = await this.client.suivreBdsDeFonctionListe(
      fListe,
      fFinaleRèglesVariables,
      fBranche,
      fIdBdDeBranche,
      undefined,
      fCode
    );

    //Tout oublier
    const fOublier = () => {
      oublierRèglesTableau();
      oublierRèglesVariable();
    };
    return fOublier;
  }

  async suivreValidDonnées<T extends élémentBdListeDonnées>(
    idTableau: string,
    f: schémaFonctionSuivi<erreurValidation[]>
  ): Promise<schémaFonctionOublier> {
    const info: {
      données?: élémentDonnées<T>[];
      règles?: schémaFonctionValidation<T>[];
      varsÀColonnes?: { [key: string]: string };
    } = {};
    const fFinale = () => {
      if (!info.données || !info.règles) return;

      let erreurs: erreurValidation[] = [];
      for (const r of info.règles) {
        const nouvellesErreurs = r(info.données);
        erreurs = [...erreurs, ...nouvellesErreurs.flat()];
      }
      f(erreurs);
    };
    const fFinaleRègles = (règles: règleColonne[]) => {
      if (info.varsÀColonnes) {
        info.règles = règles.map((r) =>
          générerFonctionRègle(r, info.varsÀColonnes!)
        );
        fFinale();
      }
    };
    const fFinaleDonnées = (données: élémentDonnées<T>[]) => {
      info.données = données;
      fFinale();
    };
    const fOublierVarsÀColonnes = await this.suivreColonnes(
      idTableau,
      (cols) => {
        const varsÀColonnes = cols.reduce(
          (o, c) => ({ ...o, [c.variable]: c.id }),
          {}
        );
        info.varsÀColonnes = varsÀColonnes;
      }
    );
    const fOublierRègles = await this.suivreRègles(idTableau, fFinaleRègles);
    const fOublierDonnées = await this.suivreDonnées(idTableau, fFinaleDonnées);
    const fOublier = () => {
      fOublierRègles();
      fOublierDonnées();
      fOublierVarsÀColonnes();
    };
    return fOublier;
  }

  async effacerTableau(idTableau: string): Promise<void> {
    // Effacer toutes les composantes du tableau
    const optionsAccès = await this.client.obtOpsAccès(idTableau);
    for (const clef in ["noms", "données", "colonnes", "règles"]) {
      const idBd = await this.client.obtIdBd(
        clef,
        idTableau,
        undefined,
        optionsAccès
      );
      if (idBd) await this.client.effacerBd(idBd);
    }
    // Effacer le tableau lui-même
    await this.client.effacerBd(idTableau);
  }
}
