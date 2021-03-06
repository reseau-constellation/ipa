import { v4 as uuidv4 } from "uuid";
import { WorkBook, utils } from "xlsx";
import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";
import OrbitDB from "orbit-db";

import ClientConstellation from "@/client";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  uneFois,
  faisRien,
} from "@/utils";
import ContrôleurConstellation from "@/accès/cntrlConstellation";
import { donnéesBdExportées } from "@/bds";
import {
  erreurValidation,
  règleVariable,
  règleVariableAvecId,
  règleColonne,
  générerFonctionRègle,
  schémaFonctionValidation,
  élémentDonnées,
} from "@/valid";
import { catégorieVariables } from "@/variables";
import { traduire, élémentsBd } from "@/utils";

export type élémentBdListeDonnées = {
  [key: string]: élémentsBd;
};

export type InfoCol = {
  id: string;
  variable: string;
  index?: boolean;
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

export function indexÉlémentsÉgaux(
  élément1: { [key: string]: élémentsBd },
  élément2: { [key: string]: élémentsBd },
  index: string[]
): boolean {
  if (!index.every((x) => élément1[x] === élément2[x])) return false;
  return true;
}

export type typeÉlémentsBdTableaux = string;

export default class Tableaux {
  client: ClientConstellation;

  constructor({ client }: { client: ClientConstellation }) {
    this.client = client;
  }

  async créerTableau(): Promise<string> {
    const idBdTableau = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès: {
        adresseBd: undefined,
        premierMod: this.client.bdCompte!.id,
      },
    });
    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdTableaux>
    >({ id: idBdTableau });

    const accès = bdTableaux.access as unknown as ContrôleurConstellation;
    const optionsAccès = { adresseBd: accès.adresseBd };

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdTableaux.set("noms", idBdNoms);

    const idBdDonnées = await this.client.créerBdIndépendante({
      type: "feed",
      optionsAccès,
    });
    await bdTableaux.set("données", idBdDonnées);

    const idBdColonnes = await this.client.créerBdIndépendante({
      type: "feed",
      optionsAccès,
    });
    await bdTableaux.set("colonnes", idBdColonnes);

    const idBdRègles = await this.client.créerBdIndépendante({
      type: "feed",
      optionsAccès,
    });
    await bdTableaux.set("règles", idBdRègles);

    fOublier();

    return idBdTableau;
  }

  async copierTableau({
    id,
    copierDonnées = true,
  }: {
    id: string;
    copierDonnées?: boolean;
  }): Promise<string> {
    const { bd: bdBase, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<typeÉlémentsBdTableaux>
    >({ id });
    const idNouveauTableau = await this.créerTableau();
    const { bd: nouvelleBd, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBd<KeyValueStore<typeÉlémentsBdTableaux>>({
        id: idNouveauTableau,
      });

    // Copier l'id unique s'il y a lieu
    const idUnique = bdBase.get("idUnique");
    if (idUnique) await nouvelleBd.put("idUnique", idUnique);

    // Copier les noms
    const idBdNoms = bdBase.get("noms");
    const { bd: bdNoms, fOublier: fOublierNoms } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    const noms = bdNoms.all;
    await this.ajouterNomsTableau({ idTableau: idNouveauTableau, noms });

    // Copier les colonnes
    await this.client.copierContenuBdListe({
      bdBase,
      nouvelleBd,
      clef: "colonnes",
    });

    // Copier les règles
    await this.client.copierContenuBdListe({
      bdBase,
      nouvelleBd,
      clef: "règles",
    });

    if (copierDonnées) {
      // Copier les données
      await this.client.copierContenuBdListe({
        bdBase,
        nouvelleBd,
        clef: "données",
      });
    }

    fOublier();
    fOublierNouvelle();
    fOublierNoms();

    return idNouveauTableau;
  }

  async spécifierIdUniqueTableau({
    idTableau,
    idUnique,
  }: {
    idTableau: string;
    idUnique: string;
  }): Promise<void> {
    const { bd: bdTableau, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idTableau });
    await bdTableau.put("idUnique", idUnique);
    fOublier();
  }

  async suivreIdUnique({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<string | undefined>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (bd: KeyValueStore<typeÉlémentsBdTableaux>) => {
      const idUnique = bd.get("idUnique");
      f(idUnique);
    };
    return await this.client.suivreBd({ id: idTableau, f: fFinale });
  }

  async changerColIndex({
    idTableau,
    idColonne,
    val,
  }: {
    idTableau: string;
    idColonne: string;
    val: boolean;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idTableau });
    const idBdColonnes = await this.client.obtIdBd({
      nom: "colonnes",
      racine: idTableau,
      type: "feed",
      optionsAccès,
    });
    if (!idBdColonnes) {
      throw `Permission de modification refusée pour BD ${idTableau}.`;
    }

    const { bd: bdColonnes, fOublier } = await this.client.ouvrirBd<
      FeedStore<InfoCol>
    >({ id: idBdColonnes });
    const éléments = ClientConstellation.obtÉlémentsDeBdListe({
      bd: bdColonnes,
      renvoyerValeur: false,
    });
    const élémentCol = éléments.find((x) => x.payload.value.id === idColonne);

    // Changer uniquement si la colonne existe et était déjà sous le même statut que `val`
    if (élémentCol && Boolean(élémentCol.payload.value.index) !== val) {
      const { value } = élémentCol.payload;
      const nouvelÉlément: InfoCol = Object.assign(value, { index: val });
      await bdColonnes.remove(élémentCol.hash);
      await bdColonnes.add(nouvelÉlément);
    }

    fOublier();
  }

  async suivreIndex({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (cols: InfoColAvecCatégorie[]) => {
      const indexes = cols.filter((c) => c.index).map((c) => c.id);
      f(indexes);
    };
    return await this.suivreColonnes({ idTableau, f: fFinale });
  }

  async suivreDonnées<T extends élémentBdListeDonnées>({
    idTableau,
    f,
    clefsSelonVariables = false,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<élémentDonnées<T>[]>;
    clefsSelonVariables?: boolean;
  }): Promise<schémaFonctionOublier> {
    const info: {
      données?: LogEntry<T>[];
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
                  // Convertir au nom de la variable si souhaité
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

    const fSuivreColonnes = (colonnes: InfoCol[]) => {
      info.colonnes = Object.fromEntries(
        colonnes.map((c) => [c.id, c.variable])
      );
      fFinale();
    };
    const oublierColonnes = await this.suivreColonnes({
      idTableau,
      f: fSuivreColonnes,
      catégories: false,
    });

    const fSuivreDonnées = (données: LogEntry<T>[]) => {
      info.données = données;
      fFinale();
    };
    const oublierDonnées = await this.client.suivreBdListeDeClef<T>({
      id: idTableau,
      clef: "données",
      f: fSuivreDonnées,
      renvoyerValeur: false,
    });

    return () => {
      oublierDonnées();
      oublierColonnes();
    };
  }

  async exporterDonnées({
    idTableau,
    langues,
    doc,
    nomFichier,
  }: {
    idTableau: string;
    langues?: string[];
    doc?: WorkBook;
    nomFichier?: string;
  }): Promise<donnéesBdExportées> {
    /* Créer le document si nécessaire */
    doc = doc || utils.book_new();
    const fichiersSFIP: Set<{ cid: string; ext: string }> = new Set();

    let nomTableau: string;
    const idCourtTableau = idTableau.split("/").pop()!;
    if (langues) {
      const noms = await uneFois(
        (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
          this.suivreNomsTableau({ idTableau, f })
      );

      nomTableau = traduire(noms, langues) || idCourtTableau;
    } else {
      nomTableau = idCourtTableau;
    }

    const colonnes = await uneFois(
      (f: schémaFonctionSuivi<InfoColAvecCatégorie[]>) =>
        this.suivreColonnes({ idTableau, f })
    );

    const données = await uneFois(
      (f: schémaFonctionSuivi<élémentDonnées<élémentBdListeDonnées>[]>) =>
        this.suivreDonnées({ idTableau, f })
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
        this.suivreVariables({ idTableau, f })
      );
      const nomsVariables: { [key: string]: string } = {};
      for (const idVar of variables) {
        const nomsDisponibles = await uneFois(
          (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
            this.client.variables!.suivreNomsVariable({ id: idVar, f })
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
    const tableau = utils.json_to_sheet(donnéesPourXLSX);

    /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
    utils.book_append_sheet(doc, tableau, nomTableau.slice(0, 30));

    nomFichier = nomFichier || nomTableau;
    return { doc, fichiersSFIP, nomFichier };
  }

  async ajouterÉlément<T extends élémentBdListeDonnées>({
    idTableau,
    vals,
  }: {
    idTableau: string;
    vals: T;
  }): Promise<string> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idTableau });
    const idBdDonnées = await this.client.obtIdBd({
      nom: "données",
      racine: idTableau,
      type: "feed",
      optionsAccès,
    });
    if (!idBdDonnées) {
      throw `Permission de modification refusée pour BD ${idTableau}.`;
    }

    const { bd: bdDonnées, fOublier } = await this.client.ouvrirBd<
      FeedStore<T>
    >({ id: idBdDonnées });
    vals = await this.vérifierClefsÉlément({ idTableau, élément: vals });
    const id = uuidv4();
    const empreinte = await bdDonnées.add({ ...vals, id });

    fOublier();

    return empreinte;
  }

  async modifierÉlément({
    idTableau,
    vals,
    empreintePrécédente,
  }: {
    idTableau: string;
    vals: { [key: string]: élémentsBd | undefined };
    empreintePrécédente: string;
  }): Promise<string> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idTableau });
    const idBdDonnées = await this.client.obtIdBd({
      nom: "données",
      racine: idTableau,
      type: "feed",
      optionsAccès,
    });
    if (!idBdDonnées) {
      throw `Permission de modification refusée pour BD ${idTableau}.`;
    }

    const { bd: bdDonnées, fOublier } = await this.client.ouvrirBd<
      FeedStore<élémentBdListeDonnées>
    >({ id: idBdDonnées });

    const précédent = this.client.obtÉlémentBdListeSelonEmpreinte({
      bd: bdDonnées,
      empreinte: empreintePrécédente,
    }) as { [key: string]: élémentsBd };

    let élément = Object.assign({}, précédent, vals);

    Object.keys(vals).map((c: string) => {
      if (vals[c] === undefined) delete élément[c];
    });
    élément = await this.vérifierClefsÉlément({ idTableau, élément });

    if (!élémentsÉgaux(élément, précédent)) {
      const résultat = await Promise.all([
        bdDonnées.remove(empreintePrécédente),
        bdDonnées.add(élément),
      ]);
      fOublier();
      return résultat[1];
    } else {
      fOublier();
      return Promise.resolve(empreintePrécédente);
    }
  }

  async vérifierClefsÉlément<T extends élémentBdListeDonnées>({
    idTableau,
    élément,
  }: {
    idTableau: string;
    élément: élémentBdListeDonnées;
  }): Promise<T> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idTableau });
    const idBdColonnes = await this.client.obtIdBd({
      nom: "colonnes",
      racine: idTableau,
      type: "feed",
      optionsAccès,
    });
    if (!idBdColonnes) {
      throw `Permission de modification refusée pour BD ${idTableau}.`;
    }

    const { bd: bdColonnes, fOublier } = await this.client.ouvrirBd<
      FeedStore<InfoCol>
    >({ id: idBdColonnes });
    const idsColonnes: string[] = bdColonnes
      .iterator({ limit: -1 })
      .collect()
      .map((e) => e.payload.value.id);
    const clefsPermises = [...idsColonnes, "id"];
    const clefsFinales = Object.keys(élément).filter((x: string) =>
      clefsPermises.includes(x)
    );

    fOublier();

    return Object.fromEntries(
      clefsFinales.map((x: string) => [x, élément[x]])
    ) as T;
  }

  async effacerÉlément({
    idTableau,
    empreinteÉlément,
  }: {
    idTableau: string;
    empreinteÉlément: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idTableau });
    const idBdDonnées = await this.client.obtIdBd({
      nom: "données",
      racine: idTableau,
      type: "feed",
      optionsAccès,
    });
    if (!idBdDonnées) {
      throw `Permission de modification refusée pour BD ${idTableau}.`;
    }

    const { bd: bdDonnées, fOublier } = await this.client.ouvrirBd<
      FeedStore<InfoCol>
    >({ id: idBdDonnées });
    await bdDonnées.remove(empreinteÉlément);
    fOublier();
  }

  async combinerDonnées({
    idTableauBase,
    idTableau2,
  }: {
    idTableauBase: string;
    idTableau2: string;
  }): Promise<void> {
    const colsTableauBase = await uneFois(
      async (fSuivi: schémaFonctionSuivi<InfoCol[]>) => {
        return await this.suivreColonnes({
          idTableau: idTableauBase,
          f: fSuivi,
        });
      }
    );

    const donnéesTableauBase = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<élémentDonnées<élémentBdListeDonnées>[]>
      ) => {
        return await this.suivreDonnées({
          idTableau: idTableauBase,
          f: fSuivi,
        });
      }
    );

    const donnéesTableau2 = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<élémentDonnées<élémentBdListeDonnées>[]>
      ) => {
        return await this.suivreDonnées({ idTableau: idTableau2, f: fSuivi });
      }
    );

    const indexes = colsTableauBase.filter((c) => c.index).map((c) => c.id);
    for (const nouvelÉlément of donnéesTableau2) {
      const existant = donnéesTableauBase.find((d) =>
        indexÉlémentsÉgaux(d.données, nouvelÉlément.données, indexes)
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
          await this.effacerÉlément({
            idTableau: idTableauBase,
            empreinteÉlément: existant.empreinte,
          });
          await this.ajouterÉlément({
            idTableau: idTableauBase,
            vals: Object.assign({}, existant.données, àAjouter),
          });
        }
      } else {
        await this.ajouterÉlément({
          idTableau: idTableauBase,
          vals: nouvelÉlément.données,
        });
      }
    }
  }

  async importerDonnées({
    idTableau,
    données,
  }: {
    idTableau: string;
    données: élémentBdListeDonnées[];
  }): Promise<void> {
    const donnéesTableau = await uneFois(
      async (
        fSuivi: schémaFonctionSuivi<élémentDonnées<élémentBdListeDonnées>[]>
      ) => {
        return await this.suivreDonnées({ idTableau, f: fSuivi });
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
      await this.ajouterÉlément({ idTableau, vals: n });
    }

    for (const e of àEffacer) {
      await this.effacerÉlément({ idTableau, empreinteÉlément: e });
    }
  }

  async ajouterNomsTableau({
    idTableau,
    noms,
  }: {
    idTableau: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idTableau });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idTableau,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdNoms) {
      throw `Permission de modification refusée pour BD ${idTableau}.`;
    }

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }

    fOublier();
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
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idTableau });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idTableau,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdNoms) {
      throw `Permission de modification refusée pour BD ${idTableau}.`;
    }

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.set(langue, nom);
    fOublier();
  }

  async effacerNomTableau({
    idTableau,
    langue,
  }: {
    idTableau: string;
    langue: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idTableau });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idTableau,
      type: "kvstore",
      optionsAccès,
    });
    if (!idBdNoms) {
      throw `Permission de modification refusée pour BD ${idTableau}.`;
    }

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.del(langue);

    fOublier();
  }

  async suivreNomsTableau({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id: idTableau,
      clef: "noms",
      f,
    });
  }

  async ajouterColonneTableau({
    idTableau,
    idVariable,
    idColonne,
  }: {
    idTableau: string;
    idVariable: string;
    idColonne?: string;
  }): Promise<string> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idTableau });
    const idBdColonnes = await this.client.obtIdBd({
      nom: "colonnes",
      racine: idTableau,
      type: "feed",
      optionsAccès,
    });
    if (!idBdColonnes) {
      throw `Permission de modification refusée pour BD ${idTableau}.`;
    }

    const { bd: bdColonnes, fOublier } = await this.client.ouvrirBd<
      FeedStore<InfoCol>
    >({ id: idBdColonnes });
    const entrée: InfoCol = {
      id: idColonne || uuidv4(),
      variable: idVariable,
    };
    await bdColonnes.add(entrée);

    fOublier();
    return entrée.id;
  }

  async effacerColonneTableau({
    idTableau,
    idColonne,
  }: {
    idTableau: string;
    idColonne: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idTableau });
    const idBdColonnes = await this.client.obtIdBd({
      nom: "colonnes",
      racine: idTableau,
      type: "feed",
      optionsAccès,
    });
    if (!idBdColonnes) {
      throw `Permission de modification refusée pour BD ${idTableau}.`;
    }

    const { bd: bdColonnes, fOublier } = await this.client.ouvrirBd<
      FeedStore<InfoCol>
    >({ id: idBdColonnes });
    await this.client.effacerÉlémentDeBdListe({
      bd: bdColonnes,
      élément: (x) => x.payload.value.id === idColonne,
    });

    fOublier();
  }

  suivreColonnes({
    idTableau,
    f,
    catégories,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<InfoColAvecCatégorie[]>;
    catégories?: true;
  }): Promise<schémaFonctionOublier>;

  suivreColonnes({
    idTableau,
    f,
    catégories,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<InfoCol[]>;
    catégories: false;
  }): Promise<schémaFonctionOublier>;

  suivreColonnes({
    idTableau,
    f,
    catégories,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<(InfoCol | InfoColAvecCatégorie)[]>;
    catégories?: boolean;
  }): Promise<schémaFonctionOublier>;

  async suivreColonnes({
    idTableau,
    f,
    catégories = true,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<InfoColAvecCatégorie[]>;
    catégories?: boolean;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (colonnes?: InfoColAvecCatégorie[]) => {
      return f(colonnes || []);
    };
    const fBranche = async (
      id: string,
      fSuivi: schémaFonctionSuivi<InfoColAvecCatégorie>,
      branche: InfoCol
    ): Promise<schémaFonctionOublier> => {
      if (!id) return faisRien;

      return await this.client.variables!.suivreCatégorieVariable({
        id,
        f: (catégorie) => {
          const col = Object.assign({ catégorie }, branche);
          fSuivi(col);
        },
      });
    };
    const fIdBdDeBranche = (x: InfoColAvecCatégorie) => x.variable;

    const fCode = (x: InfoColAvecCatégorie) => x.id;
    const fSuivreBdColonnes = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<InfoColAvecCatégorie[]>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.suivreBdsDeBdListe({
        id,
        f: fSuivreBd,
        fBranche,
        fIdBdDeBranche,
        fCode,
      });
    };

    if (catégories) {
      return await this.client.suivreBdDeClef({
        id: idTableau,
        clef: "colonnes",
        f: fFinale,
        fSuivre: fSuivreBdColonnes,
      });
    } else {
      return await this.client.suivreBdListeDeClef({
        id: idTableau,
        clef: "colonnes",
        f: fFinale,
      });
    }
  }

  async suivreVariables({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = (variables?: string[]) => {
      f((variables || []).filter((v) => v && OrbitDB.isValidAddress(v)));
    };
    const fSuivreBdColonnes = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<string[]>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.suivreBdListe({
        id,
        f: (cols: InfoCol[]) => fSuivreBd(cols.map((c) => c.variable)),
      });
    };
    return await this.client.suivreBdDeClef({
      id: idTableau,
      clef: "colonnes",
      f: fFinale,
      fSuivre: fSuivreBdColonnes,
    });
  }

  async ajouterRègleTableau({
    idTableau,
    idColonne,
    règle,
  }: {
    idTableau: string;
    idColonne: string;
    règle: règleVariable;
  }): Promise<string> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idTableau });
    const idBdRègles = await this.client.obtIdBd({
      nom: "règles",
      racine: idTableau,
      type: "feed",
      optionsAccès,
    });
    if (!idBdRègles) {
      throw `Permission de modification refusée pour tableau ${idTableau}.`;
    }

    const { bd: bdRègles, fOublier } = await this.client.ouvrirBd<
      FeedStore<règleColonne>
    >({ id: idBdRègles });

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

    fOublier();

    return id;
  }

  async effacerRègleTableau({
    idTableau,
    idRègle,
  }: {
    idTableau: string;
    idRègle: string;
  }): Promise<void> {
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idTableau });
    const idBdRègles = await this.client.obtIdBd({
      nom: "règles",
      racine: idTableau,
      type: "feed",
      optionsAccès,
    });

    if (!idBdRègles) {
      throw `Permission de modification refusée pour tableau ${idTableau}.`;
    }

    const { bd: bdRègles, fOublier } = await this.client.ouvrirBd<
      FeedStore<règleColonne>
    >({ id: idBdRègles });

    await this.client.effacerÉlémentDeBdListe({
      bd: bdRègles,
      élément: (é) => é.payload.value.règle.id === idRègle,
    });

    fOublier();
  }

  async suivreRègles({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<règleColonne[]>;
  }): Promise<schémaFonctionOublier> {
    const dicRègles: { tableau?: règleColonne[]; variable?: règleColonne[] } =
      {};
    const fFinale = () => {
      if (!dicRègles.tableau || !dicRègles.variable) return;
      return f([...dicRègles.tableau, ...dicRègles.variable]);
    };

    // Suivre les règles spécifiées dans le tableau
    const fFinaleRèglesTableau = (règles: règleColonne[]) => {
      dicRègles.tableau = règles;
      fFinale();
    };

    const oublierRèglesTableau =
      await this.client.suivreBdListeDeClef<règleColonne>({
        id: idTableau,
        clef: "règles",
        f: fFinaleRèglesTableau,
      });

    // Suivre les règles spécifiées dans les variables
    const fListe = async (
      fSuivreRacine: (éléments: InfoCol[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreColonnes({ idTableau, f: fSuivreRacine });
    };

    const fFinaleRèglesVariables = (règles: règleColonne[]) => {
      dicRègles.variable = règles;
      fFinale();
    };

    const fBranche = async (
      idVariable: string,
      fSuivreBranche: schémaFonctionSuivi<règleColonne[]>,
      branche: InfoCol
    ) => {
      const fFinaleSuivreBranche = (règles: règleVariableAvecId[]) => {
        const règlesColonnes: règleColonne[] = règles.map((r) => {
          return {
            règle: r,
            source: "variable",
            colonne: branche.id,
          };
        });
        return fSuivreBranche(règlesColonnes);
      };
      return await this.client.variables!.suivreRèglesVariable({
        id: idVariable,
        f: fFinaleSuivreBranche,
      });
    };

    const fIdBdDeBranche = (b: InfoCol) => b.variable;
    const fCode = (b: InfoCol) => b.id;

    const oublierRèglesVariable = await this.client.suivreBdsDeFonctionListe({
      fListe,
      f: fFinaleRèglesVariables,
      fBranche,
      fIdBdDeBranche,
      fCode,
    });

    // Tout oublier
    const fOublier = () => {
      oublierRèglesTableau();
      oublierRèglesVariable();
    };

    return fOublier;
  }

  async suivreValidDonnées<T extends élémentBdListeDonnées>({
    idTableau,
    f,
  }: {
    idTableau: string;
    f: schémaFonctionSuivi<erreurValidation[]>;
  }): Promise<schémaFonctionOublier> {
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
    const fFinaleRègles = (
      règles: { règle: règleColonne; donnéesCatégorie?: élémentsBd[] }[]
    ) => {
      if (info.varsÀColonnes) {
        info.règles = règles.map((r) =>
          générerFonctionRègle({
            règle: r.règle,
            varsÀColonnes: info.varsÀColonnes!,
            donnéesCatégorie: r.donnéesCatégorie,
          })
        );
        fFinale();
      }
    };
    const fFinaleDonnées = (données: élémentDonnées<T>[]) => {
      info.données = données;
      fFinale();
    };
    const fOublierVarsÀColonnes = await this.suivreColonnes({
      idTableau,
      f: (cols) => {
        const varsÀColonnes = cols.reduce(
          (o, c) => ({ ...o, [c.variable]: c.id }),
          {}
        );
        info.varsÀColonnes = varsÀColonnes;
      },
    });

    const fListeRègles = async (
      fSuivreRacine: (règles: règleColonne[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreRègles({ idTableau, f: fSuivreRacine });
    };

    const fBrancheRègles = async (
      _id: string,
      fSuivreBranche: schémaFonctionSuivi<{
        règle: règleColonne;
        donnéesCatégorie?: élémentsBd[];
      }>,
      règle: règleColonne
    ): Promise<schémaFonctionOublier> => {
      if (
        règle.règle.règle.typeRègle === "valeurCatégorique" &&
        règle.règle.règle.détails.tableau
      ) {
        const { tableau, colonne } = règle.règle.règle.détails;
        return await this.suivreDonnées({
          idTableau: tableau as string,
          f: (données) =>
            fSuivreBranche({
              règle,
              donnéesCatégorie: données.map(
                (d) => d.données[colonne as string]
              ),
            }),
        });
      } else {
        fSuivreBranche({ règle });
        return faisRien;
      }
    };

    const fIdDeBranche = (b: règleColonne) => b.règle.id;
    const fCode = (b: règleColonne) => b.règle.id;

    const fOublierRègles = await this.client.suivreBdsDeFonctionListe({
      fListe: fListeRègles,
      f: fFinaleRègles,
      fBranche: fBrancheRègles,
      fIdBdDeBranche: fIdDeBranche,
      fCode,
    });

    const fOublierDonnées = await this.suivreDonnées({
      idTableau,
      f: fFinaleDonnées,
    });
    const fOublier = () => {
      fOublierRègles();
      fOublierDonnées();
      fOublierVarsÀColonnes();
    };
    return fOublier;
  }

  async effacerTableau({ idTableau }: { idTableau: string }): Promise<void> {
    // Effacer toutes les composantes du tableau
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idTableau });
    for (const clef in ["noms", "données", "colonnes", "règles"]) {
      const idBd = await this.client.obtIdBd({
        nom: clef,
        racine: idTableau,
        optionsAccès,
      });
      if (idBd) await this.client.effacerBd({ id: idBd });
    }
    // Effacer le tableau lui-même
    await this.client.effacerBd({ id: idTableau });
  }
}
