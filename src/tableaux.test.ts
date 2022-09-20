import isArray from "lodash/isArray";

import XLSX from "xlsx";
import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import {
  schémaFonctionOublier,
  adresseOrbiteValide,
  élémentsBd,
} from "@/utils";

import {
  InfoCol,
  InfoColAvecCatégorie,
  élémentBdListeDonnées,
} from "@/tableaux";
import {
  règleBornes,
  règleColonne,
  règleValeurCatégorique,
  détailsRègleValeurCatégoriqueDynamique,
  erreurValidation,
  erreurRègle,
  erreurRègleBornesColonneInexistante,
  erreurRègleCatégoriqueColonneInexistante,
  erreurRègleBornesVariableNonPrésente,
  élémentDonnées,
} from "@/valid";

import { générerClients, attendreRésultat, typesClients } from "@/utilsTests";
import { config } from "@/utilsTests/sfipTest";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Tableaux", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      let idBd: string;
      let idTableau: string;
      let colonnes: InfoColAvecCatégorie[];

      beforeAll(async () => {
        enregistrerContrôleurs();
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        client = clients[0];
        idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
      }, config.patienceInit);

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      test(
        "Création",
        async () => {
          idTableau = await client.tableaux!.créerTableau({ idBd });
          expect(adresseOrbiteValide(idTableau)).toBe(true);
        },
        config.patience
      );

      describe("Noms", function () {
        let noms: { [key: string]: string };
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.tableaux!.suivreNomsTableau({
            idTableau,
            f: (n) => (noms = n),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Pas de noms pour commencer", async () => {
          expect(Object.keys(noms)).toHaveLength(0);
        });

        test("Ajouter un nom", async () => {
          await client.tableaux!.sauvegarderNomTableau({
            idTableau,
            langue: "fr",
            nom: "Alphabets",
          });
          expect(noms.fr).toEqual("Alphabets");
        });

        test("Ajouter des noms", async () => {
          await client.tableaux!.ajouterNomsTableau({
            idTableau,
            noms: {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            },
          });
          expect(noms).toEqual({
            fr: "Alphabets",
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          });
        });

        test("Changer un nom", async () => {
          await client.tableaux!.sauvegarderNomTableau({
            idTableau,
            langue: "fr",
            nom: "Systèmes d'écriture",
          });
          expect(noms?.fr).toEqual("Systèmes d'écriture");
        });

        test("Effacer un nom", async () => {
          await client.tableaux!.effacerNomTableau({
            idTableau,
            langue: "fr",
          });
          expect(noms).toEqual({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe("Données", function () {
        let variables: string[];
        let données: élémentDonnées<élémentBdListeDonnées>[];
        let idsVariables: string[];

        const idsColonnes: string[] = [];
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idTableau = await client.tableaux!.créerTableau({ idBd });
          fsOublier.push(
            await client.tableaux!.suivreColonnes({
              idTableau,
              f: (c) => (colonnes = c),
            })
          );
          fsOublier.push(
            await client.tableaux!.suivreVariables({
              idTableau,
              f: (v) => (variables = v),
            })
          );
          fsOublier.push(
            await client.tableaux!.suivreDonnées({
              idTableau,
              f: (d) => (données = d),
            })
          );

          const idVariable1 = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          const idVariable2 = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idsVariables = [idVariable1, idVariable2];
        }, config.patience);

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        test("Tout est vide pour commencer", async () => {
          expect(isArray(variables)).toBe(true);
          expect(variables).toHaveLength(0);

          expect(isArray(colonnes)).toBe(true);
          expect(colonnes).toHaveLength(0);

          expect(isArray(données)).toBe(true);
          expect(données).toHaveLength(0);
        });

        test("Ajouter colonnes", async () => {
          for (const idV of idsVariables) {
            idsColonnes.push(
              await client.tableaux!.ajouterColonneTableau({
                idTableau,
                idVariable: idV,
              })
            );
          }
          expect(colonnes.map((c) => c.variable)).toEqual(idsVariables);
        });

        test("Les variables sont détectées", async () => {
          expect(variables).toEqual(idsVariables);
        });

        test("Ajouter un élément", async () => {
          const élément = {
            [idsColonnes[0]]: 123.456,
            [idsColonnes[1]]: "வணக்கம்",
          };
          await client.tableaux!.ajouterÉlément({ idTableau, vals: élément });
          expect(isArray(données)).toBe(true);
          expect(données).toHaveLength(1);

          const élémentDonnées = données[0];
          expect(typeof élémentDonnées.empreinte).toEqual("string");
          for (const [cl, v] of Object.entries(élément)) {
            expect(élémentDonnées.données[cl]).toEqual(v);
          }
        });

        test("Modifier un élément - modifier une valeur", async () => {
          const élémentDonnées = données[0];

          await client.tableaux!.modifierÉlément({
            idTableau,
            vals: { [idsColonnes[0]]: -123 },
            empreintePrécédente: élémentDonnées.empreinte,
          });
          expect(isArray(données)).toBe(true);
          expect(données).toHaveLength(1);

          const nouvelÉlémentDonnées = données[0];
          expect(nouvelÉlémentDonnées.données[idsColonnes[0]]).toEqual(-123);
        });

        test("Modifier un élément - effacer une clef", async () => {
          const élémentDonnées = données[0];

          await client.tableaux!.modifierÉlément({
            idTableau,
            vals: { [idsColonnes[0]]: undefined },
            empreintePrécédente: élémentDonnées.empreinte,
          });

          const nouvelÉlémentDonnées = données[0];
          expect(Object.keys(nouvelÉlémentDonnées.données)).not.toContain(
            idsColonnes[0]
          );
        });

        test("Modifier un élément - ajouter une clef", async () => {
          const élémentDonnées = données[0];

          await client.tableaux!.modifierÉlément({
            idTableau,
            vals: { [idsColonnes[0]]: 123 },
            empreintePrécédente: élémentDonnées.empreinte,
          });

          const nouvelÉlémentDonnées = données[0];
          expect(nouvelÉlémentDonnées.données[idsColonnes[0]]).toEqual(123);
        });

        test("Effacer un élément", async () => {
          const élémentDonnées = données[0];

          await client.tableaux!.effacerÉlément({
            idTableau,
            empreinteÉlément: élémentDonnées.empreinte,
          });
          expect(isArray(données)).toBe(true);
          expect(données).toHaveLength(0);
        });

        test("Effacer une colonne", async () => {
          await client.tableaux!.effacerColonneTableau({
            idTableau,
            idColonne: idsColonnes[0],
          });
          const variablesDesColonnes = colonnes.map((c) => c.variable);
          expect(variablesDesColonnes).toHaveLength(1);
          expect(variablesDesColonnes).toEqual(
            expect.arrayContaining([idsVariables[1]])
          );
        });
      });

      describe("Colonnes index", function () {
        let indexes: string[];
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.tableaux!.suivreIndex({
            idTableau,
            f: (x) => (indexes = x),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Pas d'index pour commencer", async () => {
          expect(isArray(indexes)).toBe(true);
          expect(indexes).toHaveLength(0);
        });

        test("Ajouter un index", async () => {
          await client.tableaux!.changerColIndex({
            idTableau,
            idColonne: colonnes[0].id,
            val: true,
          });
          expect(indexes).toHaveLength(1);
          expect(indexes).toEqual(expect.arrayContaining([colonnes[0].id]));
        });

        test("Effacer l'index", async () => {
          await client.tableaux!.changerColIndex({
            idTableau,
            idColonne: colonnes[0].id,
            val: false,
          });
          expect(isArray(indexes)).toBe(true);
          expect(indexes).toHaveLength(0);
        });
      });

      describe("Règles: Fonctionnalités de base", function () {
        let idTableauRègles: string;
        let idVariableNumérique: string;
        let idVariableChaîne: string;

        let idRègle: string;

        let idColonneNumérique: string;
        let idColonneChaîne: string;

        const résultats: {
          règles: règleColonne[];
          erreurs: erreurValidation[];
        } = { règles: [], erreurs: [] };
        const fsOublier: schémaFonctionOublier[] = [];

        beforeEach(async () => {
          idTableauRègles = await client.tableaux!.créerTableau({ idBd });
          fsOublier.push(
            await client.tableaux!.suivreRègles({
              idTableau: idTableauRègles,
              f: (r) => (résultats.règles = r),
            })
          );
          fsOublier.push(
            await client.tableaux!.suivreValidDonnées({
              idTableau: idTableauRègles,
              f: (e) => (résultats.erreurs = e),
            })
          );

          idVariableNumérique = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          idVariableChaîne = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });

          idColonneNumérique = await client.tableaux!.ajouterColonneTableau({
            idTableau: idTableauRègles,
            idVariable: idVariableNumérique,
          });
          idColonneChaîne = await client.tableaux!.ajouterColonneTableau({
            idTableau: idTableauRègles,
            idVariable: idVariableChaîne,
          });
        }, config.patience);

        afterEach(async () => {
          fsOublier.forEach((f) => f());
        });

        test("Règles génériques de catégorie pour commencer", async () => {
          await attendreRésultat(
            résultats,
            "règles",
            (r) => !!r && r.length === 2
          );

          expect(isArray(résultats.règles)).toBe(true);
          expect(résultats.règles).toHaveLength(2);
          for (const r of résultats.règles) {
            expect(r.règle.règle.typeRègle).toEqual("catégorie");
          }
        });

        test("Aucune erreur pour commencer", async () => {
          expect(isArray(résultats.erreurs)).toBe(true);
          expect(résultats.erreurs).toHaveLength(0);
        });

        test("Ajouter des données valides", async () => {
          await client.tableaux!.ajouterÉlément({
            idTableau: idTableauRègles,
            vals: {
              [idColonneChaîne]: "abc",
              [idColonneNumérique]: 123,
            },
          });
          expect(isArray(résultats.erreurs)).toBe(true);
          expect(résultats.erreurs).toHaveLength(0);
        });

        test("Ajouter des données de catégorie invalide", async () => {
          const empreinte = await client.tableaux!.ajouterÉlément({
            idTableau: idTableauRègles,
            vals: {
              [idColonneChaîne]: 123,
            },
          });

          expect(typeof empreinte).toEqual("string");
          expect(isArray(résultats.erreurs)).toBe(true);
          expect(résultats.erreurs).toHaveLength(1);
          expect(
            résultats.erreurs[0].erreur.règle.règle.règle.typeRègle
          ).toEqual("catégorie");
        });

        test("Ajouter une règle au tableau", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
              type: "fixe",
              val: 0,
              op: "<",
            },
          };
          idRègle = await client.tableaux!.ajouterRègleTableau({
            idTableau: idTableauRègles,
            idColonne: idColonneNumérique,
            règle,
          });
          expect(résultats.règles).toHaveLength(3);
          const règleAjoutée = résultats.règles.filter(
            (r) => r.règle.id === idRègle
          )[0];
          expect(règleAjoutée).toBeTruthy();
          expect(règleAjoutée.source).toEqual("tableau");
        });

        test("Ajouter une règle à la variable", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
              type: "fixe",
              val: 0,
              op: "<",
            },
          };
          idRègle = await client.variables!.ajouterRègleVariable({
            idVariable: idVariableNumérique,
            règle,
          });
          expect(résultats.règles).toHaveLength(3);
          expect(
            résultats.règles.filter((r) => r.règle.id === idRègle)
          ).toHaveLength(1);
        });

        test("Ajouter des données invalides (règle tableau)", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
              type: "fixe",
              val: 0,
              op: "<",
            },
          };
          idRègle = await client.tableaux!.ajouterRègleTableau({
            idTableau: idTableauRègles,
            idColonne: idColonneNumérique,
            règle,
          });

          await client.tableaux!.ajouterÉlément({
            idTableau: idTableauRègles,
            vals: {
              [idColonneNumérique]: 123,
            },
          });
          expect(résultats.erreurs).toHaveLength(1);
          expect(résultats.erreurs[0].erreur.règle.règle.id).toEqual(idRègle);
        });

        test("Ajouter des données invalides (règle variable)", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
              type: "fixe",
              val: 0,
              op: "<",
            },
          };
          idRègle = await client.variables!.ajouterRègleVariable({
            idVariable: idVariableNumérique,
            règle,
          });

          await client.tableaux!.ajouterÉlément({
            idTableau: idTableauRègles,
            vals: {
              [idColonneNumérique]: 123,
            },
          });
          expect(résultats.erreurs).toHaveLength(1);
          expect(résultats.erreurs[0].erreur.règle.règle.id).toEqual(idRègle);
        });

        test("On ne peut pas directement effacer une règle provenant de la variable", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
              type: "fixe",
              val: 0,
              op: "<",
            },
          };
          idRègle = await client.variables!.ajouterRègleVariable({
            idVariable: idVariableNumérique,
            règle,
          });
          await client.tableaux!.effacerRègleTableau({
            idTableau: idTableauRègles,
            idRègle,
          });
          expect(
            résultats.règles.filter((r) => r.règle.id === idRègle)
          ).toHaveLength(1);
        });

        test("Effacer une règle tableau", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
              type: "fixe",
              val: 0,
              op: "<",
            },
          };
          idRègle = await client.tableaux!.ajouterRègleTableau({
            idTableau: idTableauRègles,
            idColonne: idColonneNumérique,
            règle,
          });
          await client.tableaux!.ajouterÉlément({
            idTableau: idTableauRègles,
            vals: {
              [idColonneNumérique]: 123,
            },
          });

          await client.tableaux!.effacerRègleTableau({
            idTableau: idTableauRègles,
            idRègle,
          });
          expect(résultats.règles).toHaveLength(2);
          expect(résultats.erreurs).toHaveLength(0);
        });

        test("Effacer une règle variable", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
              type: "fixe",
              val: 0,
              op: "<",
            },
          };
          idRègle = await client.variables!.ajouterRègleVariable({
            idVariable: idVariableNumérique,
            règle,
          });
          await client.tableaux!.ajouterÉlément({
            idTableau: idTableauRègles,
            vals: {
              [idColonneNumérique]: 123,
            },
          });

          expect(résultats.règles).toHaveLength(3);
          expect(résultats.erreurs).toHaveLength(1);

          await client.variables!.effacerRègleVariable({
            idVariable: idVariableNumérique,
            idRègle,
          });

          expect(résultats.règles).toHaveLength(2);
          expect(résultats.erreurs).toHaveLength(0);
        });
      });

      describe("Règles: Règle bornes relative à une colonne", function () {
        let idTableauRègles: string;

        let idVariableTempMin: string;
        let idColonneTempMin: string;
        let idVariableTempMax: string;
        let idVariableTempMoyenne: string;
        let règle1: règleBornes;
        let règle2: règleBornes;
        let idRègle1: string;
        let idRègle2: string;
        let idRègle3: string;
        let empreinte2: string;

        const erreurs: {
          valid: erreurValidation[];
          règles: erreurRègle[];
        } = { valid: [], règles: [] };
        const idColonneTempMax = "col temp max";
        const empreintesDonnées: string[] = [];
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idTableauRègles = await client.tableaux!.créerTableau({ idBd });

          fsOublier.push(
            await client.tableaux!.suivreValidDonnées({
              idTableau: idTableauRègles,
              f: (e) => (erreurs.valid = e),
            })
          );

          fsOublier.push(
            await client.tableaux!.suivreValidRègles({
              idTableau: idTableauRègles,
              f: (e) => (erreurs.règles = e),
            })
          );

          idVariableTempMin = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          idVariableTempMax = await client.variables!.créerVariable({
            catégorie: "numérique",
          });

          idVariableTempMoyenne = await client.variables!.créerVariable({
            catégorie: "numérique",
          });

          idColonneTempMin = await client.tableaux!.ajouterColonneTableau({
            idTableau: idTableauRègles,
            idVariable: idVariableTempMin,
          });
          for (const min of [0, 5]) {
            empreintesDonnées.push(
              await client.tableaux!.ajouterÉlément({
                idTableau: idTableauRègles,
                vals: {
                  [idColonneTempMin]: min,
                },
              })
            );
          }
        }, config.patience);

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        test("Erreur règle si la colonne n'existe pas", async () => {
          règle1 = {
            typeRègle: "bornes",
            détails: {
              type: "dynamiqueColonne",
              val: idColonneTempMax,
              op: "<=",
            },
          };

          idRègle1 = await client.tableaux!.ajouterRègleTableau({
            idTableau: idTableauRègles,
            idColonne: idColonneTempMin,
            règle: règle1,
          });

          const réf: erreurRègleBornesColonneInexistante[] = [
            {
              règle: {
                source: "tableau",
                colonne: idColonneTempMin,
                règle: {
                  id: idRègle1,
                  règle: règle1,
                },
              },
              détails: "colonneBornesInexistante",
            },
          ];

          expect(isArray(erreurs.valid)).toBe(true);
          expect(erreurs.valid).toHaveLength(0);

          expect(isArray(erreurs.règles)).toBe(true);
          expect(erreurs.règles).toHaveLength(réf.length);
          expect(erreurs.règles).toEqual(expect.arrayContaining(réf));
        });

        test("Ajout colonne réf détectée", async () => {
          await client.tableaux!.ajouterColonneTableau({
            idTableau: idTableauRègles,
            idVariable: idVariableTempMax,
            idColonne: idColonneTempMax,
          });
          await attendreRésultat(
            erreurs,
            "règles",
            (x) => !!x && x.length === 0
          );
          expect(erreurs.règles).toHaveLength(0);
        });

        test("Ajout éléments colonne réf détecté", async () => {
          empreintesDonnées[0] = await client.tableaux!.modifierÉlément({
            idTableau: idTableauRègles,
            vals: { [idColonneTempMax]: -1 },
            empreintePrécédente: empreintesDonnées[0],
          });

          const réf: erreurValidation = {
            empreinte: empreintesDonnées[0],
            erreur: {
              règle: {
                source: "tableau",
                colonne: idColonneTempMin,
                règle: {
                  id: idRègle1,
                  règle: règle1,
                },
              },
            },
          };
          expect(erreurs.valid).toHaveLength(1);
          expect(erreurs.valid).toEqual(expect.arrayContaining([réf]));

          await client.tableaux!.modifierÉlément({
            idTableau: idTableauRègles,
            vals: { [idColonneTempMax]: 6 },
            empreintePrécédente: empreintesDonnées[0],
          });
          expect(erreurs.valid).toHaveLength(0);
        });

        test("Ajout éléments valides", async () => {
          await client.tableaux!.ajouterÉlément({
            idTableau: idTableauRègles,
            vals: {
              [idColonneTempMin]: -15,
              [idColonneTempMax]: -5,
            },
          });
          expect(erreurs.valid).toHaveLength(0);
        });

        test("Ajout éléments invalides", async () => {
          empreinte2 = await client.tableaux!.ajouterÉlément({
            idTableau: idTableauRègles,
            vals: {
              [idColonneTempMin]: -15,
              [idColonneTempMax]: -25,
            },
          });

          const réf: erreurValidation = {
            empreinte: empreinte2,
            erreur: {
              règle: {
                source: "tableau",
                colonne: idColonneTempMin,
                règle: {
                  id: idRègle1,
                  règle: règle1,
                },
              },
            },
          };

          expect(erreurs.valid).toHaveLength(1);
          expect(erreurs.valid).toEqual(expect.arrayContaining([réf]));
        });

        test("Règle bornes relatives variable", async () => {
          (règle2 = {
            typeRègle: "bornes",
            détails: {
              type: "dynamiqueVariable",
              val: idVariableTempMin,
              op: ">=",
            },
          }),
            (idRègle2 = await client.variables!.ajouterRègleVariable({
              idVariable: idVariableTempMax,
              règle: règle2,
            }));

          const réf: erreurValidation[] = [
            {
              empreinte: empreinte2,
              erreur: {
                règle: {
                  source: "tableau",
                  colonne: idColonneTempMin,
                  règle: {
                    id: idRègle1,
                    règle: règle1,
                  },
                },
              },
            },
            {
              empreinte: empreinte2,
              erreur: {
                règle: {
                  source: "variable",
                  colonne: idColonneTempMax,
                  règle: {
                    id: idRègle2,
                    règle: règle2,
                  },
                },
              },
            },
          ];

          expect(erreurs.valid).toHaveLength(2);
          expect(erreurs.valid).toEqual(expect.arrayContaining(réf));
        });

        test("Erreur règle variable introuvable", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
              type: "dynamiqueVariable",
              val: idVariableTempMoyenne,
              op: "<=",
            },
          };

          idRègle3 = await client.tableaux!.ajouterRègleTableau({
            idTableau: idTableauRègles,
            idColonne: idColonneTempMin,
            règle,
          });

          const réf: [erreurRègleBornesVariableNonPrésente] = [
            {
              détails: "variableBornesNonPrésente",
              règle: {
                source: "tableau",
                colonne: idColonneTempMin,
                règle: {
                  id: idRègle3,
                  règle,
                },
              },
            },
          ];

          await attendreRésultat(erreurs, "règles", (x) => !!x && x.length > 0);
          expect(erreurs.règles).toHaveLength(1);
          expect(erreurs.règles).toEqual(expect.arrayContaining(réf));

          await client.tableaux!.ajouterColonneTableau({
            idTableau: idTableauRègles,
            idVariable: idVariableTempMoyenne,
          });
          await attendreRésultat(
            erreurs,
            "règles",
            (x) => !!x && x.length === 0
          );
          expect(erreurs.règles).toHaveLength(0);
        });
      });

      describe("Règle valeur catégorique", function () {
        describe("Catégories fixes", function () {
          let idTableauRègles: string;
          let idColonne: string;
          let idVariable: string;

          const err: { eurs: erreurValidation[] } = { eurs: [] };

          const fsOublier: schémaFonctionOublier[] = [];

          beforeAll(async () => {
            idTableauRègles = await client.tableaux!.créerTableau({ idBd });

            fsOublier.push(
              await client.tableaux!.suivreValidDonnées({
                idTableau: idTableauRègles,
                f: (e) => (err.eurs = e),
              })
            );

            idVariable = await client.variables!.créerVariable({
              catégorie: "chaîne",
            });
            idColonne = await client.tableaux!.ajouterColonneTableau({
              idTableau: idTableauRègles,
              idVariable,
            });

            const règleCatégorique: règleValeurCatégorique = {
              typeRègle: "valeurCatégorique",
              détails: { type: "fixe", options: ["வணக்கம்", "សួស្ឌី"] },
            };

            await client.tableaux!.ajouterRègleTableau({
              idTableau: idTableauRègles,
              idColonne,
              règle: règleCatégorique,
            });
          }, config.patience);
          afterAll(() => fsOublier.forEach((f) => f()));

          test("Ajout éléments valides", async () => {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableauRègles,
              vals: {
                [idColonne]: "வணக்கம்",
              },
            });
            expect(err.eurs).toHaveLength(0);
          });
          test("Ajout éléments invalides", async () => {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableauRègles,
              vals: {
                [idColonne]: "សូស្ដី",
              },
            });
            await attendreRésultat(err, "eurs", (x) => !!x && x.length > 0);
            expect(err.eurs).toHaveLength(1);
          });
        });

        describe("Catégories d'une colonne d'un tableau", function () {
          let idTableauÀTester: string;
          let idColonneÀTester: string;
          let idTableauCatégories: string;

          let idVariable: string;
          let idVariableRéf: string;
          let idRègle: string;
          let règleCatégorique: règleValeurCatégorique<détailsRègleValeurCatégoriqueDynamique>;

          const idColonneCatégories = "id colonne catégories";

          const erreurs: {
            valid?: erreurValidation[];
            règles?: erreurRègle[];
          } = {};
          const fsOublier: schémaFonctionOublier[] = [];

          beforeAll(async () => {
            idTableauÀTester = await client.tableaux!.créerTableau({ idBd });

            fsOublier.push(
              await client.tableaux!.suivreValidDonnées({
                idTableau: idTableauÀTester,
                f: (e) => (erreurs.valid = e),
              })
            );

            fsOublier.push(
              await client.tableaux!.suivreValidRègles({
                idTableau: idTableauÀTester,
                f: (e) => (erreurs.règles = e),
              })
            );

            idVariable = await client.variables!.créerVariable({
              catégorie: "chaîne",
            });
            idVariableRéf = await client.variables!.créerVariable({
              catégorie: "chaîne",
            });
            idColonneÀTester = await client.tableaux!.ajouterColonneTableau({
              idTableau: idTableauÀTester,
              idVariable,
            });

            idTableauCatégories = await client.tableaux!.créerTableau({ idBd });

            règleCatégorique = {
              typeRègle: "valeurCatégorique",
              détails: {
                type: "dynamique",
                tableau: idTableauCatégories,
                colonne: idColonneCatégories,
              },
            };

            idRègle = await client.tableaux!.ajouterRègleTableau({
              idTableau: idTableauÀTester,
              idColonne: idColonneÀTester,
              règle: règleCatégorique,
            });
          }, config.patience * 2);

          afterAll(() => fsOublier.forEach((f) => f()));

          test("Pas d'erreur (ici, au moins) si la colonne n'existe pas", async () => {
            expect(erreurs.valid).toHaveLength(0);
          });

          test("Mais on a une erreur au niveau de la règle", async () => {
            const réf: erreurRègleCatégoriqueColonneInexistante = {
              règle: {
                règle: {
                  id: idRègle,
                  règle: règleCatégorique,
                },
                source: "tableau",
                colonne: idColonneÀTester,
              },
              détails: "colonneCatégInexistante",
            };
            await attendreRésultat(erreurs, "règles", (x) => !!x?.length);
            expect(erreurs.règles).toHaveLength(1);
            expect(erreurs.règles).toEqual(expect.arrayContaining([réf]));
          });

          test("Ajout colonne réf", async () => {
            await client.tableaux!.ajouterColonneTableau({
              idTableau: idTableauCatégories,
              idVariable: idVariableRéf,
              idColonne: idColonneCatégories,
            });
            await attendreRésultat(erreurs, "règles", (x) => x?.length === 0);
            expect(erreurs.règles).toHaveLength(0);
          });

          test("Ajout éléments colonne réf détecté", async () => {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableauÀTester,
              vals: {
                [idColonneÀTester]: "வணக்கம்",
              },
            });
            expect(erreurs.valid).toHaveLength(1);

            for (const mot of ["வணக்கம்", "Ütz iwäch"]) {
              await client.tableaux!.ajouterÉlément({
                idTableau: idTableauCatégories,
                vals: {
                  [idColonneCatégories]: mot,
                },
              });
            }

            expect(erreurs.valid).toHaveLength(0);
          });
          test("Ajout éléments valides", async () => {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableauÀTester,
              vals: {
                [idColonneÀTester]: "Ütz iwäch",
              },
            });
            expect(erreurs.valid).toHaveLength(0);
          });
          test("Ajout éléments invalides", async () => {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableauÀTester,
              vals: {
                [idColonneÀTester]: "வணக்கம",
              },
            });
            expect(erreurs.valid).toHaveLength(1);
          });
        });
      });

      describe("Tableau avec variables non locales", function () {
        let idTableau: string;
        let idColonne: string;
        let variables: string[];
        let colonnes: InfoColAvecCatégorie[];
        let colonnesSansCatégorie: InfoCol[];
        let données: élémentDonnées[];

        const idVarChaîne =
          "/orbitdb/zdpuAximNmZyUWXGCaLmwSEGDeWmuqfgaoogA7KNSa1B2DAAF/dd77aec3-e7b8-4695-b068-49ce4227b360";
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idTableau = await client.tableaux!.créerTableau({ idBd });
          idColonne = await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable: idVarChaîne,
          });
          fsOublier.push(
            await client.tableaux!.suivreVariables({
              idTableau,
              f: (v) => (variables = v),
            })
          );
          fsOublier.push(
            await client.tableaux!.suivreColonnes({
              idTableau,
              f: (c) => (colonnes = c),
            })
          );
          fsOublier.push(
            await client.tableaux!.suivreColonnes({
              idTableau,
              f: (c) => (colonnesSansCatégorie = c),
              catégories: false,
            })
          );
          fsOublier.push(
            await client.tableaux!.suivreDonnées({
              idTableau,
              f: (d) => (données = d),
            })
          );
        }, config.patience);

        afterAll(() => {
          fsOublier.forEach((f) => f());
        });
        test("Tableau créé", () => {
          expect(adresseOrbiteValide(idTableau)).toBe(true);
        });
        test("Suivre variables", () => {
          expect(isArray(variables)).toBe(true);

          expect(variables).toHaveLength(1);
          expect(variables).toEqual(expect.arrayContaining([idVarChaîne]));
        });
        test("Suivre colonnes", () => {
          expect(colonnes).toBeUndefined;
        });
        test("Suivre colonnes sans catégorie", () => {
          expect(isArray(colonnesSansCatégorie)).toBe(true);
          expect(colonnesSansCatégorie).toHaveLength(1);
          expect(colonnesSansCatégorie).toEqual(
            expect.arrayContaining([{ id: idColonne, variable: idVarChaîne }])
          );
        });
        test("Ajouter données", async () => {
          await client.tableaux!.ajouterÉlément({
            idTableau,
            vals: {
              [idColonne]: "Bonjour !",
            },
          });
          expect(isArray(données)).toBe(true);
          expect(données).toHaveLength(1);
          expect(données[0].données[idColonne]).toEqual("Bonjour !");
        });
      });

      describe("Copier tableau", function () {
        let idTableau: string;
        let idVariable: string;
        let idColonne: string;
        let idRègle: string;
        let colsIndexe: string[];

        let variables: string[];
        let noms: { [key: string]: string };
        let données: élémentDonnées<élémentBdListeDonnées>[];
        let colonnes: InfoColAvecCatégorie[];
        let règles: règleColonne[];

        const réfNoms = {
          த: "மழை",
          हिं: "बारिश",
        };
        const règle: règleBornes = {
          typeRègle: "bornes",
          détails: {
            type: "fixe",
            val: 0,
            op: ">",
          },
        };

        let idTableauCopie: string;

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idTableau = await client.tableaux!.créerTableau({ idBd });
          await client.tableaux!.ajouterNomsTableau({
            idTableau,
            noms: réfNoms,
          });

          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          idColonne = await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable,
          });
          await client.tableaux!.changerColIndex({
            idTableau,
            idColonne,
            val: true,
          });

          await client.tableaux!.ajouterÉlément({
            idTableau,
            vals: {
              [idColonne]: 123,
            },
          });

          idRègle = await client.tableaux!.ajouterRègleTableau({
            idTableau,
            idColonne,
            règle,
          });

          idTableauCopie = await client.tableaux!.copierTableau({
            id: idTableau,
            idBd,
          });

          fsOublier.push(
            await client.tableaux!.suivreVariables({
              idTableau: idTableauCopie,
              f: (x) => (variables = x),
            })
          );
          fsOublier.push(
            await client.tableaux!.suivreNomsTableau({
              idTableau: idTableauCopie,
              f: (x) => (noms = x),
            })
          );
          fsOublier.push(
            await client.tableaux!.suivreDonnées({
              idTableau: idTableauCopie,
              f: (x) => (données = x),
            })
          );
          fsOublier.push(
            await client.tableaux!.suivreColonnes({
              idTableau: idTableauCopie,
              f: (x) => (colonnes = x),
            })
          );
          fsOublier.push(
            await client.tableaux!.suivreIndex({
              idTableau: idTableauCopie,
              f: (x) => (colsIndexe = x),
            })
          );
          fsOublier.push(
            await client.tableaux!.suivreRègles({
              idTableau: idTableauCopie,
              f: (x) => (règles = x),
            })
          );
        }, config.patience * 2);

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        test("Le tableau est copié", async () => {
          expect(adresseOrbiteValide(idTableauCopie)).toBe(true);
        });

        test("Les noms sont copiés", async () => {
          expect(noms).toEqual(réfNoms);
        });

        test("Les colonnes sont copiées", async () => {
          expect(isArray(colonnes)).toBe(true);
          expect(colonnes).toHaveLength(1);
          expect(colonnes[0].variable).toEqual(idVariable);
        });

        test("Les indexes sont copiés", async () => {
          expect(isArray(colsIndexe)).toBe(true);
          expect(colsIndexe).toHaveLength(1);
          expect(colsIndexe[0]).toEqual(idColonne);
        });

        test("Les règles sont copiés", async () => {
          const règleRecherchée = règles.find((r) => r.règle.id === idRègle);
          expect(règleRecherchée).toBeTruthy();
          expect(règleRecherchée?.colonne).toEqual(colonnes[0].id);
          expect(règleRecherchée?.règle.règle).toEqual(règle);
        });

        test("Les variables sont copiés", async () => {
          expect(isArray(variables)).toBe(true);
          expect(variables).toHaveLength(1);
          expect(variables[0]).toEqual(idVariable);
        });

        test("Les données sont copiés", async () => {
          expect(isArray(données)).toBe(true);
          expect(données).toHaveLength(1);
          expect(données[0].données[colonnes[0].id]).toEqual(123);
        });

        test("Les noms des tableaux sont liées", async () => {
          expect(nomsTableauxLiés).toEqual(réfNomsTableauxLiés);
        });
      });

      describe("Combiner données tableaux", function () {
        let idTableauBase: string;
        let idTableau2: string;

        let idVarDate: string;
        let idVarEndroit: string;
        let idVarTempMin: string;
        let idVarTempMax: string;

        let données: élémentDonnées<élémentBdListeDonnées>[];
        let fOublier: schémaFonctionOublier;

        const idsCols: { [key: string]: string } = {};

        beforeAll(async () => {
          idTableauBase = await client.tableaux!.créerTableau({ idBd });
          idTableau2 = await client.tableaux!.créerTableau({ idBd });

          idVarDate = await client.variables!.créerVariable({
            catégorie: "horoDatage",
          });
          idVarEndroit = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarTempMin = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          idVarTempMax = await client.variables!.créerVariable({
            catégorie: "numérique",
          });

          for (const idVar of [
            idVarDate,
            idVarEndroit,
            idVarTempMin,
            idVarTempMax,
          ]) {
            const idCol = await client.tableaux!.ajouterColonneTableau({
              idTableau: idTableauBase,
              idVariable: idVar,
            });

            idsCols[idVar] = idCol;
            await client.tableaux!.ajouterColonneTableau({
              idTableau: idTableau2,
              idVariable: idVar,
              idColonne: idCol,
            });
          }
          for (const idVar of [idVarDate, idVarEndroit]) {
            await client.tableaux!.changerColIndex({
              idTableau: idTableauBase,
              idColonne: idsCols[idVar],
              val: true,
            });
            await client.tableaux!.changerColIndex({
              idTableau: idTableau2,
              idColonne: idsCols[idVar],
              val: true,
            });
          }

          fOublier = await client.tableaux!.suivreDonnées({
            idTableau: idTableauBase,
            f: (d) => (données = d),
          });

          const élémentsBase = [
            {
              [idsCols[idVarEndroit]]: "ici",
              [idsCols[idVarDate]]: "2021-01-01",
              [idsCols[idVarTempMin]]: 25,
            },
            {
              [idsCols[idVarEndroit]]: "ici",
              [idsCols[idVarDate]]: "2021-01-02",
              [idsCols[idVarTempMin]]: 25,
            },
            {
              [idsCols[idVarEndroit]]: "là-bas",
              [idsCols[idVarDate]]: "2021-01-01",
              [idsCols[idVarTempMin]]: 25,
            },
          ];
          for (const élément of élémentsBase) {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableauBase,
              vals: élément,
            });
          }

          const éléments2 = [
            {
              [idsCols[idVarEndroit]]: "ici",
              [idsCols[idVarDate]]: "2021-01-01",
              [idsCols[idVarTempMin]]: 27,
              [idsCols[idVarTempMax]]: 30,
            },
            {
              [idsCols[idVarEndroit]]: "ici",
              [idsCols[idVarDate]]: "2021-01-02",
              [idsCols[idVarTempMin]]: 27,
            },
            {
              [idsCols[idVarEndroit]]: "là-bas",
              [idsCols[idVarDate]]: "2021-01-02",
              [idsCols[idVarTempMin]]: 27,
            },
          ];
          for (const élément of éléments2) {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableau2,
              vals: élément,
            });
          }

          await client.tableaux!.combinerDonnées({ idTableauBase, idTableau2 });
        }, config.patience * 2);

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Données manquantes ajoutées", async () => {
          expect(isArray(données)).toBe(true);
          expect(données).toHaveLength(4);
          expect(
            données
              .map((d) => d.données)
              .map((d) => {
                delete d.id;
                return d;
              })
          ).toEqual(
            expect.arrayContaining([
              {
                [idsCols[idVarEndroit]]: "ici",
                [idsCols[idVarDate]]: "2021-01-01",
                [idsCols[idVarTempMin]]: 25,
                [idsCols[idVarTempMax]]: 30,
              },
              {
                [idsCols[idVarEndroit]]: "ici",
                [idsCols[idVarDate]]: "2021-01-02",
                [idsCols[idVarTempMin]]: 25,
              },
              {
                [idsCols[idVarEndroit]]: "là-bas",
                [idsCols[idVarDate]]: "2021-01-01",
                [idsCols[idVarTempMin]]: 25,
              },
              {
                [idsCols[idVarEndroit]]: "là-bas",
                [idsCols[idVarDate]]: "2021-01-02",
                [idsCols[idVarTempMin]]: 27,
              },
            ])
          );
        });
      });

      describe("Importer données", function () {
        let fOublier: schémaFonctionOublier;
        let idTableau: string;

        let idVarDate: string;
        let idVarEndroit: string;
        let idVarTempMin: string;
        let idVarTempMax: string;

        let données: élémentDonnées<élémentBdListeDonnées>[];

        const idsCols: { [key: string]: string } = {};

        beforeAll(async () => {
          idTableau = await client.tableaux!.créerTableau({ idBd });

          idVarDate = await client.variables!.créerVariable({
            catégorie: "horoDatage",
          });
          idVarEndroit = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarTempMin = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          idVarTempMax = await client.variables!.créerVariable({
            catégorie: "numérique",
          });

          for (const idVar of [
            idVarDate,
            idVarEndroit,
            idVarTempMin,
            idVarTempMax,
          ]) {
            const idCol = await client.tableaux!.ajouterColonneTableau({
              idTableau,
              idVariable: idVar,
            });
            idsCols[idVar] = idCol;
          }

          fOublier = await client.tableaux!.suivreDonnées({
            idTableau,
            f: (d) => (données = d),
          });

          const élémentsBase = [
            {
              [idsCols[idVarEndroit]]: "ici",
              [idsCols[idVarDate]]: "2021-01-01",
              [idsCols[idVarTempMin]]: 25,
            },
            {
              [idsCols[idVarEndroit]]: "ici",
              [idsCols[idVarDate]]: "2021-01-02",
              [idsCols[idVarTempMin]]: 25,
            },
            {
              [idsCols[idVarEndroit]]: "là-bas",
              [idsCols[idVarDate]]: "2021-01-01",
              [idsCols[idVarTempMin]]: 25,
            },
          ];
          for (const élément of élémentsBase) {
            await client.tableaux!.ajouterÉlément({ idTableau, vals: élément });
          }

          const nouvellesDonnées = [
            {
              [idsCols[idVarEndroit]]: "ici",
              [idsCols[idVarDate]]: "2021-01-01",
              [idsCols[idVarTempMin]]: 25,
            },
            {
              [idsCols[idVarEndroit]]: "ici",
              [idsCols[idVarDate]]: "2021-01-02",
              [idsCols[idVarTempMin]]: 27,
            },
          ];
          await client.tableaux!.importerDonnées({
            idTableau,
            données: nouvellesDonnées,
          });
        }, config.patience * 2);

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Données importées correctement", async () => {
          expect(isArray(données)).toBe(true);
          expect(données).toHaveLength(2);
          expect(
            données
              .map((d) => d.données)
              .map((d) => {
                delete d.id;
                return d;
              })
          ).toEqual([
            {
              [idsCols[idVarEndroit]]: "ici",
              [idsCols[idVarDate]]: "2021-01-01",
              [idsCols[idVarTempMin]]: 25,
            },
            {
              [idsCols[idVarEndroit]]: "ici",
              [idsCols[idVarDate]]: "2021-01-02",
              [idsCols[idVarTempMin]]: 27,
            },
          ]);
        });
      });

      describe("Exporter données", function () {
        let idTableau: string;
        let idVarNumérique: string;
        let idVarChaîne: string;
        let idVarFichier: string;
        let idVarBooléenne: string;

        let idColNumérique: string;
        let idColChaîne: string;
        let idColFichier: string;
        let idColBooléenne: string;

        let doc: XLSX.WorkBook;
        let fichiersSFIP: Set<{ cid: string; ext: string }>;

        let fOublier: schémaFonctionOublier;

        const nomTableauFr = "Tableau test";

        beforeAll(async () => {
          idTableau = await client.tableaux!.créerTableau({ idBd });
          idVarNumérique = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          idVarChaîne = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarFichier = await client.variables!.créerVariable({
            catégorie: "fichier",
          });
          idVarBooléenne = await client.variables!.créerVariable({
            catégorie: "booléen",
          });

          idColNumérique = await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable: idVarNumérique,
          });
          idColChaîne = await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable: idVarChaîne,
          });
          idColBooléenne = await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable: idVarBooléenne,
          });
          idColFichier = await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable: idVarFichier,
          });

          await client.tableaux!.ajouterNomsTableau({
            idTableau,
            noms: {
              fr: nomTableauFr,
            },
          });

          await client.variables!.ajouterNomsVariable({
            id: idVarNumérique,
            noms: {
              fr: "Numérique",
              हिं: "यह है संख्या",
            },
          });

          await client.variables!.ajouterNomsVariable({
            id: idVarChaîne,
            noms: {
              fr: "Numérique",
              த: "இது உரை ஆகும்",
            },
          });

          const éléments: { [key: string]: élémentsBd }[] = [
            {
              [idColNumérique]: 123,
              [idColChaîne]: "வணக்கம்",
              [idColBooléenne]: true,
              [idColFichier]: {
                cid: "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ",
                ext: "mp4",
              },
            },
            {
              [idColNumérique]: 456,
            },
          ];
          for (const élément of éléments) {
            await client.tableaux!.ajouterÉlément({ idTableau, vals: élément });
          }
          ({ doc, fichiersSFIP } = await client.tableaux!.exporterDonnées({
            idTableau,
            langues: ["த", "fr"],
          }));
        }, config.patience);

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Langue appropriée pour le nom du tableau", () => {
          expect(doc.SheetNames[0]).toEqual(nomTableauFr);
        });

        test("Langue appropriée pour les noms des colonnes", () => {
          for (const { cellule, val } of [
            { cellule: "A1", val: "Numérique" },
            { cellule: "B1", val: "இது உரை ஆகும்" },
            { cellule: "C1", val: idColBooléenne },
            { cellule: "D1", val: idColFichier },
          ]) {
            expect(
              (doc.Sheets[nomTableauFr][cellule] as XLSX.CellObject).v
            ).toEqual(val);
          }
        });

        test("Données numériques exportées", async () => {
          const val = doc.Sheets[nomTableauFr].A2.v;
          expect(val).toEqual(123);

          const val2 = doc.Sheets[nomTableauFr].A3.v;
          expect(val2).toEqual(456);
        });

        test("Données chaîne exportées", async () => {
          const val = doc.Sheets[nomTableauFr].B2.v;
          expect(val).toEqual("வணக்கம்");
        });

        test("Données booléennes exportées", async () => {
          const val = doc.Sheets[nomTableauFr].C2.v;
          expect(val).toEqual("true");
        });

        test("Données fichier exportées", async () => {
          const val = doc.Sheets[nomTableauFr].D2.v;
          expect(val).toEqual(
            "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ.mp4"
          );
        });

        test("Les fichiers SFIP sont détectés", async () => {
          expect(fichiersSFIP.size).toEqual(1);
          expect(fichiersSFIP).toEqual(
            new Set([
              {
                cid: "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ",
                ext: "mp4",
              },
            ])
          );
        });

        test("Exporter avec ids des colonnes et du tableau", async () => {
          ({ doc } = await client.tableaux!.exporterDonnées({ idTableau }));
          const idTableauCourt = idTableau.split("/").pop()!.slice(0, 30);
          expect(doc.SheetNames[0]).toEqual(idTableauCourt);
          for (const { cellule, val } of [
            { cellule: "A1", val: idColNumérique },
            { cellule: "B1", val: idColChaîne },
            { cellule: "C1", val: idColBooléenne },
            { cellule: "D1", val: idColFichier },
          ]) {
            expect(
              (doc.Sheets[idTableauCourt][cellule] as XLSX.CellObject).v
            ).toEqual(val);
          }
        });
      });
    });
  });
});
