import isArray from "lodash/isArray";

import ClientConstellation from "@/client.js";
import { catégorieVariables } from "@/variables";
import { schémaFonctionOublier } from "@/utils/index.js";
import { règleVariableAvecId, règleBornes, règleCatégorie } from "@/valid";

import { générerClients, typesClients, AttendreRésultat } from "@/utilsTests";
import { config } from "@/utilsTests/sfipTest";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Variables", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      let idVariable: string;

      beforeAll(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        client = clients[0];
      }, config.patienceInit);

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("Création", function () {
        let variables: string[];
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.variables!.suivreVariables({
            f: (x) => (variables = x),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });
        test("Pas de variables pour commencer", async () => {
          expect(isArray(variables)).toBe(true);
          expect(variables).toHaveLength(0);
        });
        test(
          "Créer des variables",
          async () => {
            idVariable = await client.variables!.créerVariable({
              catégorie: "numérique",
            });
            expect(isArray(variables)).toBe(true);

            expect(variables).toHaveLength(1);
            expect(variables).toContain(idVariable);
          },
          config.patience
        );

        test("Effacer un mot-clef", async () => {
          await client.variables!.effacerVariable({ id: idVariable });
          expect(isArray(variables)).toBe(true);
          expect(variables).toHaveLength(0);
        });
      });

      describe("Mes variables", function () {
        let idVariable: string;
        let mesVariables: string[] = [];
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables!.suivreVariables({
            f: (vs) => (mesVariables = vs),
          });
        }, config.patience);

        afterAll(() => {
          if (fOublier) fOublier();
        });

        test("La variable est déjà ajoutée", async () => {
          expect(mesVariables).toContain(idVariable);
        });

        test("Enlever de mes variables", async () => {
          await client.variables!.enleverDeMesVariables({ id: idVariable });
          expect(mesVariables).not.toContain(idVariable);
        });

        test("Ajouter à mes variables", async () => {
          await client.variables!.ajouterÀMesVariables({ id: idVariable });
          expect(mesVariables).toContain(idVariable);
        });
      });

      describe("Noms", function () {
        let fOublier: schémaFonctionOublier;
        const noms = new AttendreRésultat<{ [clef: string]: string }>();

        beforeAll(async () => {
          fOublier = await client.variables!.suivreNomsVariable({
            id: idVariable,
            f: (n) => noms.mettreÀJour(n),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
          noms.toutAnnuler();
        });

        test("Pas de noms pour commencer", async () => {
          await noms.attendreExiste();
          expect(Object.keys(noms)).toHaveLength(0);
        });

        test("Ajouter un nom", async () => {
          await client.variables!.sauvegarderNomVariable({
            id: idVariable,
            langue: "fr",
            nom: "Précipitation",
          });
          expect(noms.val.fr).toEqual("Précipitation");
        });

        test("Ajouter des noms", async () => {
          await client.variables!.ajouterNomsVariable({
            id: idVariable,
            noms: {
              த: "மழை",
              हिं: "बारिश",
            },
          });
          expect(noms).toEqual({
            த: "மழை",
            हिं: "बारिश",
            fr: "Précipitation",
          });
        });

        test("Changer un nom", async () => {
          await client.variables!.sauvegarderNomVariable({
            id: idVariable,
            langue: "fr",
            nom: "précipitation",
          });
          expect(noms.val.fr).toEqual("précipitation");
        });

        test("Effacer un nom", async () => {
          await client.variables!.effacerNomVariable({
            id: idVariable,
            langue: "fr",
          });
          expect(noms.val).toEqual({ த: "மழை", हिं: "बारिश" });
        });
      });

      describe("Descriptions", function () {
        let descrs: { [key: string]: string };
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.variables!.suivreDescrVariable({
            id: idVariable,
            f: (d) => (descrs = d),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Pas de descriptions pour commencer", async () => {
          expect(Object.keys(descrs)).toHaveLength(0);
        });

        test("Ajouter une description", async () => {
          await client.variables!.sauvegarderDescrVariable({
            id: idVariable,
            langue: "fr",
            description: "la quantité de précipitation quotidienne",
          });
          expect(descrs.fr).toEqual("la quantité de précipitation quotidienne");
        });

        test("Ajouter des descriptions", async () => {
          await client.variables!.ajouterDescriptionsVariable({
            id: idVariable,
            descriptions: {
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
            },
          });
          expect(descrs).toEqual({
            த: "தினசரி மழை",
            हिं: "दैनिक बारिश",
            fr: "la quantité de précipitation quotidienne",
          });
        });

        test("Changer une description", async () => {
          await client.variables!.sauvegarderDescrVariable({
            id: idVariable,
            langue: "fr",
            description: "La quantité de précipitation quotidienne",
          });
          expect(descrs?.fr).toEqual(
            "La quantité de précipitation quotidienne"
          );
        });

        test("Effacer une description", async () => {
          await client.variables!.effacerDescrVariable({
            id: idVariable,
            langue: "fr",
          });
          expect(descrs).toEqual({
            த: "தினசரி மழை",
            हिं: "दैनिक बारिश",
          });
        });
      });

      describe("Catégorie", function () {
        let catégorie: catégorieVariables;
        let idVariable: string;
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables!.suivreCatégorieVariable({
            id: idVariable,
            f: (c) => (catégorie = c),
          });
        }, config.patience);

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Changer la catégorie", async () => {
          await client.variables!.sauvegarderCatégorieVariable({
            idVariable,
            catégorie: "chaîne",
          });
          expect(catégorie).toEqual("chaîne");
        });
      });

      describe("Unités", function () {
        let unités: string;
        let idVariable: string;
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables!.suivreUnitésVariable({
            id: idVariable,
            f: (u) => (unités = u),
          });
        }, config.patience);

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Aucune unité pour commencer", async () => {
          expect(unités).toBeUndefined();
        });

        test("Changer les unités", async () => {
          await client.variables!.sauvegarderUnitésVariable({
            idVariable,
            idUnité: "mm",
          });
          expect(unités).toEqual("mm");
        });
      });

      describe("Règles", function () {
        let règles: règleVariableAvecId[];
        let idVariable: string;
        let idRègle: string;
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables!.suivreRèglesVariable({
            id: idVariable,
            f: (r) => (règles = r),
          });
        }, config.patience);

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Règle générique de catégorie pour commencer", async () => {
          expect(isArray(règles)).toBe(true);
          expect(règles).toHaveLength(1);
          expect(règles[0].règle.typeRègle).toEqual("catégorie");
        });

        test("Ajouter une règle", async () => {
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
              type: "fixe",
              val: 0,
              op: ">",
            },
          };
          idRègle = await client.variables!.ajouterRègleVariable({
            idVariable,
            règle,
          });
          expect(règles).toHaveLength(2);
          expect(règles.filter((r) => r.id === idRègle)).toHaveLength(1);
        });

        test("Effacer une règle", async () => {
          await client.variables!.effacerRègleVariable({ idVariable, idRègle });
          expect(règles).toHaveLength(1);
        });

        test("On ne peut pas effacer une règle générique de base", async () => {
          const règleDeBase = règles[0];
          await client.variables!.effacerRègleVariable({
            idVariable,
            idRègle: règleDeBase.id,
          });
          expect(règles[0].id).toEqual(règleDeBase.id);
        });

        test("On détecte le changement de catégorie", async () => {
          await client.variables!.sauvegarderCatégorieVariable({
            idVariable,
            catégorie: "horoDatage",
          });
          const règleCatégorie = règles.find(
            (r) => r.règle.typeRègle === "catégorie"
          ) as règleVariableAvecId<règleCatégorie> | undefined;
          expect(règleCatégorie).toBeTruthy();
          expect(règleCatégorie?.règle.détails.catégorie).toEqual("horoDatage");
        });
      });

      describe("Copier variable", function () {
        let variables: string[];
        let noms: { [key: string]: string };
        let descrs: { [key: string]: string };
        let catégorie: catégorieVariables;
        let règles: règleVariableAvecId[];
        let unités: string;

        let idVariable2: string;

        const fsOublier: schémaFonctionOublier[] = [];
        const règle: règleBornes = {
          typeRègle: "bornes",
          détails: {
            type: "fixe",
            val: 0,
            op: ">",
          },
        };

        beforeAll(async () => {
          fsOublier.push(
            await client.variables!.suivreVariables({
              f: (x) => (variables = x),
            })
          );

          const idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          await client.variables!.ajouterNomsVariable({
            id: idVariable,
            noms: {
              த: "மழை",
              हिं: "बारिश",
            },
          });
          await client.variables!.ajouterDescriptionsVariable({
            id: idVariable,
            descriptions: {
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
            },
          });
          await client.variables!.ajouterRègleVariable({ idVariable, règle });
          await client.variables!.sauvegarderUnitésVariable({
            idVariable,
            idUnité: "mm",
          });

          idVariable2 = await client.variables!.copierVariable({
            id: idVariable,
          });

          fsOublier.push(
            await client.variables!.suivreNomsVariable({
              id: idVariable2,
              f: (x) => (noms = x),
            })
          );
          fsOublier.push(
            await client.variables!.suivreDescrVariable({
              id: idVariable2,
              f: (x) => (descrs = x),
            })
          );
          fsOublier.push(
            await client.variables!.suivreRèglesVariable({
              id: idVariable2,
              f: (r) => (règles = r),
            })
          );
          fsOublier.push(
            await client.variables!.suivreCatégorieVariable({
              id: idVariable2,
              f: (c) => (catégorie = c),
            })
          );
          fsOublier.push(
            await client.variables!.suivreUnitésVariable({
              id: idVariable2,
              f: (u) => (unités = u),
            })
          );
        }, config.patience);

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        test("La variable est copiée", async () => {
          expect(isArray(variables)).toBe(true);
          expect(variables).toContain(idVariable2);
        });

        test("Les noms sont copiés", async () => {
          expect(noms).toEqual({ த: "மழை", हिं: "बारिश" });
        });

        test("Les descriptions sont copiés", async () => {
          expect(descrs).toEqual({
            த: "தினசரி மழை",
            हिं: "दैनिक बारिश",
          });
        });

        test("Les règles sont copiés", async () => {
          const règleCatégorie: règleCatégorie = {
            typeRègle: "catégorie",
            détails: {
              catégorie: "numérique",
            },
          };
          expect(règles.map((r) => r.règle)).toEqual(
            expect.arrayContaining([règle, règleCatégorie])
          );
        });

        test("Les unités sont copiés", async () => {
          expect(unités).toEqual("mm");
        });

        test("La catégorie est copiés", async () => {
          expect(catégorie).toEqual("numérique");
        });
      });
    });
  });
});
