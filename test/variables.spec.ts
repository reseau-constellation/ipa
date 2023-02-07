import pkg from 'lodash';
const { isArray } = pkg;

import type { default as ClientConstellation } from "@/client.js";
import type { catégorieVariables } from "@/variables.js";
import type { schémaFonctionOublier } from "@/utils/index.js";
import type { règleVariableAvecId, règleBornes, règleCatégorie } from "@/valid.js";
import {expect} from "aegir/chai";

import {
  générerClients,
  typesClients,
  AttendreRésultat,
} from "@/utilsTests/index.js";
import { config } from "@/utilsTests/sfipTest.js";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Variables", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      let idVariable: string;

      before("Préparer clients", async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
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

        before("Préparer clients", async () => {
          fOublier = await client.variables!.suivreVariables({
            f: (x) => (variables = x),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });
        it("Pas de variables pour commencer", async () => {
          expect(variables).to.be.an.empty("array");
        });
        it(
          "Créer des variables",
          async () => {
            idVariable = await client.variables!.créerVariable({
              catégorie: "numérique",
            });
            expect(variables).to.be.an("array");

            expect(variables).to.have.lengthOf(1);
            expect(variables).to.contain(idVariable);
          },
          config.patience
        );

        it("Effacer un mot-clef", async () => {
          await client.variables!.effacerVariable({ id: idVariable });
          expect(variables).to.be.an.empty("array");
        });
      });

      describe("Mes variables", function () {
        let idVariable: string;
        let mesVariables: string[] = [];
        let fOublier: schémaFonctionOublier;

        before("Préparer clients", async () => {
          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables!.suivreVariables({
            f: (vs) => (mesVariables = vs),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("La variable est déjà ajoutée", async () => {
          expect(mesVariables).to.contain(idVariable);
        });

        it("Enlever de mes variables", async () => {
          await client.variables!.enleverDeMesVariables({ id: idVariable });
          expect(mesVariables).not.to.contain(idVariable);
        });

        it("Ajouter à mes variables", async () => {
          await client.variables!.ajouterÀMesVariables({ id: idVariable });
          expect(mesVariables).to.contain(idVariable);
        });
      });

      describe("Noms", function () {
        let fOublier: schémaFonctionOublier;
        const noms = new AttendreRésultat<{ [clef: string]: string }>();

        before("Préparer clients", async () => {
          fOublier = await client.variables!.suivreNomsVariable({
            id: idVariable,
            f: (n) => noms.mettreÀJour(n),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
          noms.toutAnnuler();
        });

        it("Pas de noms pour commencer", async () => {
          const val = await noms.attendreExiste();
          expect(Object.keys(val)).to.have.lengthOf(0);
        });

        it("Ajouter un nom", async () => {
          await client.variables!.sauvegarderNomVariable({
            id: idVariable,
            langue: "fr",
            nom: "Précipitation",
          });
          const val = await noms.attendreQue(x=>!!x.fr)
          expect(val.fr).to.equal("Précipitation");
        });

        it("Ajouter des noms", async () => {
          await client.variables!.ajouterNomsVariable({
            id: idVariable,
            noms: {
              த: "மழை",
              हिं: "बारिश",
            },
          });
          expect(noms.val).to.deep.equal({
            த: "மழை",
            हिं: "बारिश",
            fr: "Précipitation",
          });
        });

        it("Changer un nom", async () => {
          await client.variables!.sauvegarderNomVariable({
            id: idVariable,
            langue: "fr",
            nom: "précipitation",
          });
          const val = await noms.attendreQue(x=>!!x.fr)
          expect(val.fr).to.equal("précipitation");
        });

        it("Effacer un nom", async () => {
          await client.variables!.effacerNomVariable({
            id: idVariable,
            langue: "fr",
          });
          expect(noms.val).to.deep.equal({ த: "மழை", हिं: "बारिश" });
        });
      });

      describe("Descriptions", function () {
        let descrs: { [key: string]: string };
        let fOublier: schémaFonctionOublier;

        before("Préparer clients", async () => {
          fOublier = await client.variables!.suivreDescrVariable({
            id: idVariable,
            f: (d) => (descrs = d),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Pas de descriptions pour commencer", async () => {
          expect(Object.keys(descrs)).to.have.lengthOf(0);
        });

        it("Ajouter une description", async () => {
          await client.variables!.sauvegarderDescrVariable({
            id: idVariable,
            langue: "fr",
            description: "la quantité de précipitation quotidienne",
          });
          expect(descrs.fr).to.equal("la quantité de précipitation quotidienne");
        });

        it("Ajouter des descriptions", async () => {
          await client.variables!.ajouterDescriptionsVariable({
            id: idVariable,
            descriptions: {
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
            },
          });
          expect(descrs).to.deep.equal({
            த: "தினசரி மழை",
            हिं: "दैनिक बारिश",
            fr: "la quantité de précipitation quotidienne",
          });
        });

        it("Changer une description", async () => {
          await client.variables!.sauvegarderDescrVariable({
            id: idVariable,
            langue: "fr",
            description: "La quantité de précipitation quotidienne",
          });
          expect(descrs?.fr).to.equal(
            "La quantité de précipitation quotidienne"
          );
        });

        it("Effacer une description", async () => {
          await client.variables!.effacerDescrVariable({
            id: idVariable,
            langue: "fr",
          });
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

        before("Préparer clients", async () => {
          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables!.suivreCatégorieVariable({
            id: idVariable,
            f: (c) => (catégorie = c),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Changer la catégorie", async () => {
          await client.variables!.sauvegarderCatégorieVariable({
            idVariable,
            catégorie: "chaîne",
          });
          expect(catégorie).to.equal("chaîne");
        });
      });

      describe("Unités", function () {
        let unités: string;
        let idVariable: string;
        let fOublier: schémaFonctionOublier;

        before("Préparer clients", async () => {
          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables!.suivreUnitésVariable({
            id: idVariable,
            f: (u) => (unités = u),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Aucune unité pour commencer", async () => {
          expect(unités).to.be.undefined();
        });

        it("Changer les unités", async () => {
          await client.variables!.sauvegarderUnitésVariable({
            idVariable,
            idUnité: "mm",
          });
          expect(unités).to.equal("mm");
        });
      });

      describe("Règles", function () {
        let règles: règleVariableAvecId[];
        let idVariable: string;
        let idRègle: string;
        let fOublier: schémaFonctionOublier;

        before("Préparer clients", async () => {
          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables!.suivreRèglesVariable({
            id: idVariable,
            f: (r) => (règles = r),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Règle générique de catégorie pour commencer", async () => {
          expect(isArray(règles)).to.be.true();
          expect(règles).to.have.lengthOf(1);
          expect(règles[0].règle.typeRègle).to.equal("catégorie");
        });

        it("Ajouter une règle", async () => {
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
          expect(règles).to.have.lengthOf(2);
          expect(règles.filter((r) => r.id === idRègle)).to.have.lengthOf(1);
        });

        it("Effacer une règle", async () => {
          await client.variables!.effacerRègleVariable({ idVariable, idRègle });
          expect(règles).to.have.lengthOf(1);
        });

        it("On ne peut pas effacer une règle générique de base", async () => {
          const règleDeBase = règles[0];
          await client.variables!.effacerRègleVariable({
            idVariable,
            idRègle: règleDeBase.id,
          });
          expect(règles[0].id).to.equal(règleDeBase.id);
        });

        it("On détecte le changement de catégorie", async () => {
          await client.variables!.sauvegarderCatégorieVariable({
            idVariable,
            catégorie: "horoDatage",
          });
          const règleCatégorie = règles.find(
            (r) => r.règle.typeRègle === "catégorie"
          ) as règleVariableAvecId<règleCatégorie> | undefined;
          expect(règleCatégorie).to.exist();
          expect(règleCatégorie?.règle.détails.catégorie).to.equal("horoDatage");
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

        before("Préparer clients", async () => {
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
        });

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        it("La variable est copiée", async () => {
          expect(isArray(variables)).to.be.true();
          expect(variables).to.contain(idVariable2);
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
          expect(règles.map((r) => r.règle)).to.have.deep.members(
            [règle, règleCatégorie]
          );
        });

        it("Les unités sont copiés", async () => {
          expect(unités).to.equal("mm");
        });

        it("La catégorie est copiés", async () => {
          expect(catégorie).to.equal("numérique");
        });
      });
    });
  });
});
