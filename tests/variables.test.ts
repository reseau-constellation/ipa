import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import { catégorieVariables } from "@/variables";
import { schémaFonctionOublier } from "@/utils";
import { règleVariableAvecId, règleBornes, règleCatégorie } from "@/valid";

import { testAPIs, config } from "./sfipTest";
import { générerClients, typesClients } from "./utils";

chai.should();
chai.use(chaiAsPromised);

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Variables", function () {
        this.timeout(config.timeout);

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation;

        let idVariable: string;

        before(async () => {
          enregistrerContrôleurs();
          ({ fOublier: fOublierClients, clients } = await générerClients(
            1,
            API,
            type
          ));
          client = clients[0];
        });

        after(async () => {
          if (fOublierClients) await fOublierClients();
        });

        describe("Création", function () {
          let variables: string[];
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.variables!.suivreVariables(
              {f: (x) => (variables = x)}
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });
          step("Pas de variables pour commencer", async () => {
            expect(variables).to.be.an.empty("array");
          });
          step("Créer des variables", async () => {
            idVariable = await client.variables!.créerVariable({catégorie: "numérique"});
            expect(variables)
              .to.be.an("array")
              .with.lengthOf(1)
              .that.contains(idVariable);
          });
          step("Effacer un mot-clef", async () => {
            await client.variables!.effacerVariable({id: idVariable});
            expect(variables).to.be.an.empty("array");
          });
        });

        describe("Mes variables", function () {
          let idVariable: string;
          let mesVariables: string[] = [];
          let fOublier: schémaFonctionOublier;

          before(async () => {
            idVariable = await client.variables!.créerVariable({catégorie: "numérique"});
            fOublier = await client.variables!.suivreVariables(
              {f: (vs) => (mesVariables = vs)}
            );
          });

          after(() => {
            if (fOublier) fOublier();
          });

          step("La variable est déjà ajoutée", async () => {
            expect(mesVariables).to.include(idVariable);
          });

          step("Enlever de mes variables", async () => {
            await client.variables!.enleverDeMesVariables({id: idVariable});
            expect(mesVariables).to.not.include(idVariable);
          });

          step("Ajouter à mes variables", async () => {
            await client.variables!.ajouterÀMesVariables({id: idVariable});
            expect(mesVariables).to.include(idVariable);
          });
        });

        describe("Noms", function () {
          let noms: { [key: string]: string };
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.variables!.suivreNomsVariable({
              id: idVariable,
              f: (n) => (noms = n)
            });
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Pas de noms pour commencer", async () => {
            expect(noms).to.be.empty;
          });

          step("Ajouter un nom", async () => {
            await client.variables!.sauvegarderNomVariable({
              id: idVariable,
              langue: "fr",
              nom: "Précipitation"
            });
            expect(noms.fr).to.equal("Précipitation");
          });

          step("Ajouter des noms", async () => {
            await client.variables!.ajouterNomsVariable({id: idVariable, noms: {
              த: "மழை",
              हिं: "बारिश",
            }});
            expect(noms).to.deep.equal({
              த: "மழை",
              हिं: "बारिश",
              fr: "Précipitation",
            });
          });

          step("Changer un nom", async () => {
            await client.variables!.sauvegarderNomVariable({
              id: idVariable,
              langue: "fr",
              nom: "précipitation"
            });
            expect(noms?.fr).to.equal("précipitation");
          });

          step("Effacer un nom", async () => {
            await client.variables!.effacerNomVariable({id: idVariable, langue: "fr"});
            expect(noms).to.deep.equal({ த: "மழை", हिं: "बारिश" });
          });
        });

        describe("Descriptions", function () {
          let descrs: { [key: string]: string };
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.variables!.suivreDescrVariable({
              id: idVariable,
              f: (d) => (descrs = d)
            });
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Pas de descriptions pour commencer", async () => {
            expect(descrs).to.be.empty;
          });

          step("Ajouter une description", async () => {
            await client.variables!.sauvegarderDescrVariable({
              id: idVariable,
              langue: "fr",
              description: "la quantité de précipitation quotidienne"
            });
            expect(descrs.fr).to.equal(
              "la quantité de précipitation quotidienne"
            );
          });

          step("Ajouter des descriptions", async () => {
            await client.variables!.ajouterDescriptionsVariable({id: idVariable, descriptions: {
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
            }});
            expect(descrs).to.deep.equal({
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
              fr: "la quantité de précipitation quotidienne",
            });
          });

          step("Changer une description", async () => {
            await client.variables!.sauvegarderDescrVariable({
              id: idVariable,
              langue: "fr",
              description: "La quantité de précipitation quotidienne"
            });
            expect(descrs?.fr).to.equal(
              "La quantité de précipitation quotidienne"
            );
          });

          step("Effacer une description", async () => {
            await client.variables!.effacerDescrVariable({id: idVariable, langue: "fr"});
            expect(descrs).to.deep.equal({
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
            });
          });
        });

        describe("Catégorie", function () {
          let catégorie: catégorieVariables;
          let idVariable: string;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            idVariable = await client.variables!.créerVariable({catégorie: "numérique"});
            fOublier = await client.variables!.suivreCatégorieVariable({
              id: idVariable,
              f: (c) => (catégorie = c)
            });
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Changer la catégorie", async () => {
            await client.variables!.sauvegarderCatégorieVariable({
              idVariable,
              catégorie: "chaîne"
            });
            expect(catégorie).to.equal("chaîne");
          });
        });

        describe("Unités", function () {
          let unités: string;
          let idVariable: string;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            idVariable = await client.variables!.créerVariable({catégorie: "numérique"});
            fOublier = await client.variables!.suivreUnitésVariable({
              id: idVariable,
              f: (u) => (unités = u)
            });
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Aucune unité pour commencer", async () => {
            expect(unités).to.undefined;
          });

          step("Changer les unités", async () => {
            await client.variables!.sauvegarderUnitésVariable({ idVariable, idUnité: "mm" });
            expect(unités).to.equal("mm");
          });
        });

        describe("Règles", function () {
          let règles: règleVariableAvecId[];
          let idVariable: string;
          let idRègle: string;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            idVariable = await client.variables!.créerVariable({catégorie: "numérique"});
            fOublier = await client.variables!.suivreRèglesVariable({
              id: idVariable,
              f: (r) => (règles = r)
            });
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Règle générique de catégorie pour commencer", async () => {
            expect(règles).to.be.an("array").with.lengthOf(1);
            expect(règles[0].règle.typeRègle).to.equal("catégorie");
          });

          step("Ajouter une règle", async () => {
            const règle: règleBornes = {
              typeRègle: "bornes",
              détails: {
                val: 0,
                op: ">",
              },
            };
            idRègle = await client.variables!.ajouterRègleVariable({
              idVariable,
              règle
            });
            expect(règles).to.have.lengthOf(2);
            expect(règles.filter((r) => r.id === idRègle)).to.have.lengthOf(1);
          });

          step("Effacer une règle", async () => {
            await client.variables!.effacerRègleVariable({idVariable, idRègle});
            expect(règles).to.have.lengthOf(1);
          });

          step(
            "On ne peut pas effacer une règle générique de base",
            async () => {
              const règleDeBase = règles[0];
              await client.variables!.effacerRègleVariable({
                idVariable,
                idRègle: règleDeBase.id
              });
              expect(règles[0].id).to.equal(règleDeBase.id);
            }
          );

          step("On détecte le changement de catégorie", async () => {
            await client.variables!.sauvegarderCatégorieVariable({
              idVariable,
              catégorie: "horoDatage"
            });
            const règleCatégorie = règles.find(
              (r) => r.règle.typeRègle === "catégorie"
            );
            expect(règleCatégorie).to.exist;
            expect(règleCatégorie?.règle.détails.catégorie).to.equal(
              "horoDatage"
            );
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
              val: 0,
              op: ">",
            },
          };

          before(async () => {
            fsOublier.push(
              await client.variables!.suivreVariables({f: (x) => (variables = x)})
            );

            const idVariable = await client.variables!.créerVariable(
              {catégorie: "numérique"}
            );
            await client.variables!.ajouterNomsVariable({id: idVariable, noms: {
              த: "மழை",
              हिं: "बारिश",
            }});
            await client.variables!.ajouterDescriptionsVariable({id: idVariable, descriptions: {
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
            }});
            await client.variables!.ajouterRègleVariable({idVariable, règle});
            await client.variables!.sauvegarderUnitésVariable({idVariable, idUnité: "mm"});

            idVariable2 = await client.variables!.copierVariable({id: idVariable});

            fsOublier.push(
              await client.variables!.suivreNomsVariable({
                id: idVariable2,
                f: (x) => (noms = x)
              })
            );
            fsOublier.push(
              await client.variables!.suivreDescrVariable({
                id: idVariable2,
                f: (x) => (descrs = x)
              })
            );
            fsOublier.push(
              await client.variables!.suivreRèglesVariable({
                id: idVariable2,
                f: (r) => (règles = r)
              })
            );
            fsOublier.push(
              await client.variables!.suivreCatégorieVariable({
                id: idVariable2,
                f: (c) => (catégorie = c)
              })
            );
            fsOublier.push(
              await client.variables!.suivreUnitésVariable({
                id: idVariable2,
                f: (u) => (unités = u)
              })
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          it("La variable est copiée", async () => {
            expect(variables).to.be.an("array").that.contains(idVariable2);
          });

          it("Les noms sont copiés", async () => {
            expect(noms).to.deep.equal({ த: "மழை", हिं: "बारिश" });
          });

          it("Les descriptions sont copiés", async () => {
            expect(descrs).to.deep.equal({
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
            });
          });

          it("Les règles sont copiés", async () => {
            const règleCatégorie: règleCatégorie = {
              typeRègle: "catégorie",
              détails: {
                catégorie: "numérique",
              },
            };
            expect(règles.map((r) => r.règle)).to.have.deep.members([
              règle,
              règleCatégorie,
            ]);
          });

          it("Les unités sont copiés", async () => {
            expect(unités).to.deep.equal("mm");
          });

          it("La catégorie est copiés", async () => {
            expect(catégorie).to.deep.equal("numérique");
          });
        });
      });
    });
  });
});
