import { step } from "mocha-steps";

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
  erreurValidation,
  élémentDonnées,
} from "@/valid";

import { générerClients, attendreRésultat, typesClients } from "./utils";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Tableaux", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      let idTableau: string;
      let colonnes: InfoColAvecCatégorie[];

      beforeAll(async () => {
        enregistrerContrôleurs();
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        client = clients[0];
      });

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      step("Création", async () => {
        idTableau = await client.tableaux!.créerTableau();
        expect(adresseOrbiteValide(idTableau)).toBe(true);
      });

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

        step("Pas de noms pour commencer", async () => {
          expect(noms).toHaveLength(0);
        });

        step("Ajouter un nom", async () => {
          await client.tableaux!.sauvegarderNomTableau({
            idTableau,
            langue: "fr",
            nom: "Alphabets",
          });
          expect(noms.fr).toEqual("Alphabets");
        });

        step("Ajouter des noms", async () => {
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

        step("Changer un nom", async () => {
          await client.tableaux!.sauvegarderNomTableau({
            idTableau,
            langue: "fr",
            nom: "Systèmes d'écriture",
          });
          expect(noms?.fr).toEqual("Systèmes d'écriture");
        });

        step("Effacer un nom", async () => {
          await client.tableaux!.effacerNomTableau({
            idTableau,
            langue: "fr",
          });
          expect(noms).toEqual({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe("Ids uniques", function () {
        let idUnique: string | undefined;
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.tableaux!.suivreIdUnique({
            idTableau,
            f: (id) => (idUnique = id),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        step("Pas de noms pour commencer", async () => {
          expect(idUnique).toBeUndefined;
        });

        step("Ajouter une id unique", async () => {
          await client.tableaux!.spécifierIdUniqueTableau({
            idTableau,
            idUnique: "quelque chose d'unique",
          });
          expect(idUnique).toEqual("quelque chose d'unique");
        });
      });

      describe("Données", function () {
        let variables: string[];
        let données: élémentDonnées<élémentBdListeDonnées>[];
        let idsVariables: string[];

        const idsColonnes: string[] = [];
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idTableau = await client.tableaux!.créerTableau();
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
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        step("Tout est vide pour commencer", async () => {
          expect(variables, "variables")
            .toBeTruthy()
            .and.to.be.an.empty("array");
          expect(colonnes, "colonnes").toBeTruthy().and.to.be.an.empty("array");
          expect(données, "données").toBeTruthy().and.to.be.an.empty("array");
        });

        step("Ajouter colonnes", async () => {
          for (const idV of idsVariables) {
            idsColonnes.push(
              await client.tableaux!.ajouterColonneTableau({
                idTableau,
                idVariable: idV,
              })
            );
          }
          expect(colonnes.map((c) => c.variable)).toEqual(
            idsVariables
          );
        });

        step("Les variables sont détectées", async () => {
          expect(variables).toEqual(idsVariables);
        });

        step("Ajouter un élément", async () => {
          const élément = {
            [idsColonnes[0]]: 123.456,
            [idsColonnes[1]]: "வணக்கம்",
          };
          await client.tableaux!.ajouterÉlément({ idTableau, vals: élément });
          expect(isArray(données)).toBe(true);
          expect(XYZ).toHaveLength(1);

          const élémentDonnées = données[0];
          expect(élémentDonnées.empreinte).to.be.a("string");
          for (const [cl, v] of Object.entries(élément)) {
            expect(élémentDonnées.données[cl]).toBeTruthy().and.toEqual(v);
          }
        });

        step("Modifier un élément - modifier une valeur", async () => {
          const élémentDonnées = données[0];

          await client.tableaux!.modifierÉlément({
            idTableau,
            vals: { [idsColonnes[0]]: -123 },
            empreintePrécédente: élémentDonnées.empreinte,
          });
          expect(isArray(données)).toBe(true);
          expect(XYZ).toHaveLength(1);

          const nouvelÉlémentDonnées = données[0];
          expect(nouvelÉlémentDonnées.données[idsColonnes[0]]).toEqual(-123);
        });

        step("Modifier un élément - effacer une clef", async () => {
          const élémentDonnées = données[0];

          await client.tableaux!.modifierÉlément({
            idTableau,
            vals: { [idsColonnes[0]]: undefined },
            empreintePrécédente: élémentDonnées.empreinte,
          });

          const nouvelÉlémentDonnées = données[0];
          expect(nouvelÉlémentDonnées.données).to.not.have.key(idsColonnes[0]);
        });

        step("Modifier un élément - ajouter une clef", async () => {
          const élémentDonnées = données[0];

          await client.tableaux!.modifierÉlément({
            idTableau,
            vals: { [idsColonnes[0]]: 123 },
            empreintePrécédente: élémentDonnées.empreinte,
          });

          const nouvelÉlémentDonnées = données[0];
          expect(nouvelÉlémentDonnées.données[idsColonnes[0]]).toEqual(123);
        });

        step("Effacer un élément", async () => {
          const élémentDonnées = données[0];

          await client.tableaux!.effacerÉlément({
            idTableau,
            empreinteÉlément: élémentDonnées.empreinte,
          });
          expect(isArray(données)).toBe(true);
          expect(données).toHaveLength(0);
        });

        step("Effacer une colonne", async () => {
          await client.tableaux!.effacerColonneTableau({
            idTableau,
            idColonne: idsColonnes[0],
          });
          expect(colonnes.map((c) => c.variable))
            .have.lengthOf(1)
            .and.to.have.members([idsVariables[1]]);
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

        step("Pas d'index pour commencer", async () => {
          expect(isArray(indexes)).toBe(true);
          expect(indexes).toHaveLength(0);
        });

        step("Ajouter un index", async () => {
          await client.tableaux!.changerColIndex({
            idTableau,
            idColonne: colonnes[0].id,
            val: true,
          });
          expect(indexes).toHaveLength(1).and.to.have.members([colonnes[0].id]);
        });

        step("Effacer l'index", async () => {
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
          idTableauRègles = await client.tableaux!.créerTableau();
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
        });

        afterEach(async () => {
          fsOublier.forEach((f) => f());
        });

        step("Règles génériques de catégorie pour commencer", async () => {
          await attendreRésultat(résultats, "règles", (r) => r.length === 2);

          expect(isArray(résultats.règles)).toBe(true);
          expect(XYZ).toHaveLength(2);
          for (const r of résultats.règles) {
            expect(r.règle.règle.typeRègle).toEqual("catégorie");
          }
        });

        step("Aucune erreur pour commencer", async () => {
          expect(résultats.erreurs).to.be.an.empty("array");
        });

        step("Ajouter des données valides", async () => {
          await client.tableaux!.ajouterÉlément({
            idTableau: idTableauRègles,
            vals: {
              [idColonneChaîne]: "abc",
              [idColonneNumérique]: 123,
            },
          });
          expect(résultats.erreurs).to.be.an.empty("array");
        });

        step("Ajouter des données de catégorie invalide", async () => {
          const empreinte = await client.tableaux!.ajouterÉlément({
            idTableau: idTableauRègles,
            vals: {
              [idColonneChaîne]: 123,
            },
          });

          expect(empreinte).to.be.a.string;
          expect(isArray(résultats.erreurs)).toBe(true);
          expect(XYZ).toHaveLength(1);
          expect(
            résultats.erreurs[0].erreur.règle.règle.règle.typeRègle
          ).toEqual("catégorie");
        });

        step("Ajouter une règle au tableau", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
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

        step("Ajouter une règle à la variable", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
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

        step("Ajouter des données invalides (règle tableau)", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
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

        step("Ajouter des données invalides (règle variable)", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
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

        step(
          "On ne peut pas directement effacer une règle provenant de la variable",
          async () => {
            const règle: règleBornes = {
              typeRègle: "bornes",
              détails: {
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
          }
        );

        step("Effacer une règle tableau", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
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

        step("Effacer une règle variable", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
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

        const err: { eurs: erreurValidation[] } = { eurs: [] };
        const idColonneTempMax = "col temp max";
        const empreintesDonnées: string[] = [];
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idTableauRègles = await client.tableaux!.créerTableau();

          fsOublier.push(
            await client.tableaux!.suivreValidDonnées({
              idTableau: idTableauRègles,
              f: (e) => (err.eurs = e),
            })
          );

          idVariableTempMin = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          idVariableTempMax = await client.variables!.créerVariable({
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
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        step("Erreur si la colonne n'existe pas", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
              val: idColonneTempMax,
              op: "<=",
            },
          };
          await client.tableaux!.ajouterRègleTableau({
            idTableau: idTableauRègles,
            idColonne: idColonneTempMin,
            règle,
          });
          expect(isArray(err.eurs)).toBe(true).of.length(2);
        });

        step("Ajout colonne réf détectée", async () => {
          await client.tableaux!.ajouterColonneTableau({
            idTableau: idTableauRègles,
            idVariable: idVariableTempMax,
            idColonne: idColonneTempMax,
          });
          await attendreRésultat(err, "eurs", (x) => x.length === 0);
          expect(err.eurs).toHaveLength(0);
        });

        step("Ajout éléments colonne réf détecté", async () => {
          empreintesDonnées[0] = await client.tableaux!.modifierÉlément({
            idTableau: idTableauRègles,
            vals: { [idColonneTempMax]: -1 },
            empreintePrécédente: empreintesDonnées[0],
          });
          expect(err.eurs).toHaveLength(1);
          expect(err.eurs[0].erreur.règle.colonne).toEqual(idColonneTempMin);

          await client.tableaux!.modifierÉlément({
            idTableau: idTableauRègles,
            vals: { [idColonneTempMax]: 6 },
            empreintePrécédente: empreintesDonnées[0],
          });
          expect(err.eurs).toHaveLength(0);
        });

        step("Ajout éléments valides", async () => {
          await client.tableaux!.ajouterÉlément({
            idTableau: idTableauRègles,
            vals: {
              [idColonneTempMin]: -15,
              [idColonneTempMax]: -5,
            },
          });
          expect(err.eurs).toHaveLength(0);
        });

        step("Ajout éléments invalides", async () => {
          await client.tableaux!.ajouterÉlément({
            idTableau: idTableauRègles,
            vals: {
              [idColonneTempMin]: -15,
              [idColonneTempMax]: -25,
            },
          });
          expect(err.eurs).toHaveLength(1);
        });

        step("Règle bornes relatives variable", async () => {
          await client.variables!.ajouterRègleVariable({
            idVariable: idVariableTempMax,
            règle: {
              typeRègle: "bornes",
              détails: { val: idVariableTempMin, op: ">=" },
            },
          });
          expect(err.eurs).toHaveLength(2);
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
            idTableauRègles = await client.tableaux!.créerTableau();

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
          });
          afterAll(() => fsOublier.forEach((f) => f()));

          step("Ajout éléments valides", async () => {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableauRègles,
              vals: {
                [idColonne]: "வணக்கம்",
              },
            });
            expect(err.eurs).toHaveLength(0);
          });
          step("Ajout éléments invalides", async () => {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableauRègles,
              vals: {
                [idColonne]: "សូស្ដី",
              },
            });
            await attendreRésultat(err, "eurs", (x) => x.length > 0);
            expect(err.eurs).toHaveLength(1);
          });
        });

        describe("Catégories d'une colonne d'un tableau", function () {
          let idTableauÀTester: string;
          let idColonneÀTester: string;
          let idTableauCatégories: string;

          let idVariable: string;
          let idVariableRéf: string;

          const idColonneCatégories = "id colonne catégories";

          const err: { eurs: erreurValidation[] } = { eurs: [] };
          const fsOublier: schémaFonctionOublier[] = [];

          beforeAll(async () => {
            idTableauÀTester = await client.tableaux!.créerTableau();

            fsOublier.push(
              await client.tableaux!.suivreValidDonnées({
                idTableau: idTableauÀTester,
                f: (e) => (err.eurs = e),
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

            idTableauCatégories = await client.tableaux!.créerTableau();

            const règleCatégorique: règleValeurCatégorique = {
              typeRègle: "valeurCatégorique",
              détails: {
                type: "dynamique",
                tableau: idTableauCatégories,
                colonne: idColonneCatégories,
              },
            };

            await client.tableaux!.ajouterRègleTableau({
              idTableau: idTableauÀTester,
              idColonne: idColonneÀTester,
              règle: règleCatégorique,
            });
          });

          afterAll(() => fsOublier.forEach((f) => f()));

          step(
            "Pas d'erreur (ici, au moins) si la colonne n'existe pas",
            async () => {
              expect(err.eurs).toHaveLength(0);
            }
          );

          step("Ajout colonne réf", async () => {
            await client.tableaux!.ajouterColonneTableau({
              idTableau: idTableauCatégories,
              idVariable: idVariableRéf,
              idColonne: idColonneCatégories,
            });
            expect(err.eurs).toHaveLength(0);
          });

          it("Ajout éléments colonne réf détecté", async () => {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableauÀTester,
              vals: {
                [idColonneÀTester]: "வணக்கம்",
              },
            });
            expect(err.eurs).toHaveLength(1);

            for (const mot of ["வணக்கம்", "Ütz iwäch"]) {
              await client.tableaux!.ajouterÉlément({
                idTableau: idTableauCatégories,
                vals: {
                  [idColonneCatégories]: mot,
                },
              });
            }

            expect(err.eurs).toHaveLength(0);
          });
          it("Ajout éléments valides", async () => {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableauÀTester,
              vals: {
                [idColonneÀTester]: "Ütz iwäch",
              },
            });
            expect(err.eurs).toHaveLength(0);
          });
          it("Ajout éléments invalides", async () => {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableauÀTester,
              vals: {
                [idColonneÀTester]: "வணக்கம",
              },
            });
            expect(err.eurs).toHaveLength(1);
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
          idTableau = await client.tableaux!.créerTableau();
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
        });

        afterAll(() => {
          fsOublier.forEach((f) => f());
        });
        step("Tableau créé", () => {
          expect(adresseOrbiteValide(idTableau)).toBe(true);
        });
        step("Suivre variables", () => {
          expect(isArray(variables)).toBe(true);

          expect(XYZ).toHaveLength(1).and.members([idVarChaîne]);
        });
        step("Suivre colonnes", () => {
          expect(colonnes).toBeUndefined;
        });
        step("Suivre colonnes sans catégorie", () => {
          expect(isArray(colonnesSansCatégorie)).toBe(true);

          expect(XYZ)
            .toHaveLength(1)
            .and.deep.members([{ id: idColonne, variable: idVarChaîne }]);
        });
        step("Ajouter données", async () => {
          await client.tableaux!.ajouterÉlément({
            idTableau,
            vals: {
              [idColonne]: "Bonjour !",
            },
          });
          expect(isArray(données)).toBe(true);
          expect(XYZ).toHaveLength(1);
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
            val: 0,
            op: ">",
          },
        };

        let idTableauCopie: string;

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idTableau = await client.tableaux!.créerTableau();
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
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        it("Le tableau est copié", async () => {
          expect(adresseOrbiteValide(idTableauCopie)).toBe(true);
        });

        it("Les noms sont copiés", async () => {
          expect(noms).toEqual(réfNoms);
        });

        it("Les colonnes sont copiées", async () => {
          expect(isArray(colonnes)).toBe(true);
          expect(XYZ).toHaveLength(1);
          expect(colonnes[0].variable).toEqual(idVariable);
        });

        it("Les indexes sont copiés", async () => {
          expect(isArray(colsIndexe)).toBe(true);
          expect(XYZ).toHaveLength(1);
          expect(colsIndexe[0]).toEqual(idColonne);
        });

        it("Les règles sont copiés", async () => {
          const règleRecherchée = règles.find((r) => r.règle.id === idRègle);
          expect(règleRecherchée).toBeTruthy();
          expect(règleRecherchée?.colonne).toEqual(colonnes[0].id);
          expect(règleRecherchée?.règle.règle).toEqual(règle);
        });

        it("Les variables sont copiés", async () => {
          expect(isArray(variables)).toBe(true);
          expect(XYZ).toHaveLength(1);
          expect(variables[0]).toEqual(idVariable);
        });

        it("Les données sont copiés", async () => {
          expect(isArray(données)).toBe(true);
          expect(XYZ).toHaveLength(1);
          expect(données[0].données[colonnes[0].id]).toEqual(123);
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
          idTableauBase = await client.tableaux!.créerTableau();
          idTableau2 = await client.tableaux!.créerTableau();

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
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        step("Données manquantes ajoutées", async () => {
          expect(isArray(données)).toBe(true);
          expect(XYZ).toHaveLength(4);
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
          ]);
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
          idTableau = await client.tableaux!.créerTableau();

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
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        it("Données importées correctement", async () => {
          expect(isArray(données)).toBe(true);
          expect(XYZ).toHaveLength(2);
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
          idTableau = await client.tableaux!.créerTableau();
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
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        it("Langue appropriée pour le nom du tableau", () => {
          expect(doc.SheetNames[0]).toEqual(nomTableauFr);
        });

        it("Langue appropriée pour les noms des colonnes", () => {
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

        it("Données numériques exportées", async () => {
          const val = doc.Sheets[nomTableauFr].A2.v;
          expect(val).toEqual(123);

          const val2 = doc.Sheets[nomTableauFr].A3.v;
          expect(val2).toEqual(456);
        });

        it("Données chaîne exportées", async () => {
          const val = doc.Sheets[nomTableauFr].B2.v;
          expect(val).toEqual("வணக்கம்");
        });

        it("Données booléennes exportées", async () => {
          const val = doc.Sheets[nomTableauFr].C2.v;
          expect(val).toEqual("true");
        });

        it("Données fichier exportées", async () => {
          const val = doc.Sheets[nomTableauFr].D2.v;
          expect(val).toEqual(
            "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ.mp4"
          );
        });

        it("Les fichiers SFIP sont détectés", async () => {
          expect(fichiersSFIP.size).equal(1);
          expect(fichiersSFIP).to.have.deep.keys([
            {
              cid: "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ",
              ext: "mp4",
            },
          ]);
        });

        it("Exporter avec ids des colonnes et du tableau", async () => {
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
