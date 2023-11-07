import type { ClientConstellation } from "@/client.js";
import type { catégorieVariables } from "@/variables.js";
import type { schémaFonctionOublier } from "@/types.js";
import type {
  règleVariableAvecId,
  règleBornes,
  règleCatégorie,
} from "@/valid.js";
import { expect } from "aegir/chai";

import {
  attente,
  client as utilsClientTest,
  attente as utilsTestAttente,
} from "@constl/utils-tests";
const { générerClients } = utilsClientTest;
import { typesClients } from "./ressources/utils.js";
import { générerClient } from "@/index.js";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Variables", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      before("Préparer clients", async () => {
        ({ fOublier: fOublierClients, clients: clients as unknown } =
          await générerClients({ n: 1, type, générerClient }));
        client = clients[0];
      });

      after(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("Création", function () {
        let fOublier: schémaFonctionOublier;
        let idVariable: string;

        const variables = new utilsTestAttente.AttendreRésultat<string[]>();

        before("Préparer clients", async () => {
          fOublier = await client.variables.suivreVariables({
            f: (x) => variables.mettreÀJour(x),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });
        it("Pas de variables pour commencer", async () => {
          const val = await variables.attendreExiste();
          expect(val).to.be.an.empty("array");
        });
        it("Créer des variables", async () => {
          idVariable = await client.variables.créerVariable({
            catégorie: "numérique",
          });
          const val = await variables.attendreQue((x) => !!x.length);
          expect(val).to.be.an("array").with.lengthOf(1);
          expect(val).to.contain(idVariable);
        });

        it("Effacer une variable", async () => {
          await client.variables.effacerVariable({ idVariable });
          const val = await variables.attendreQue((x) => !x.length);
          expect(val).to.be.an.empty("array");
        });
      });

      describe("Mes variables", function () {
        let idVariable: string;
        let fOublier: schémaFonctionOublier;

        const mesVariables = new utilsTestAttente.AttendreRésultat<string[]>();

        before("Créer variable", async () => {
          idVariable = await client.variables.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables.suivreVariables({
            f: (vs) => mesVariables.mettreÀJour(vs),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("La variable est déjà ajoutée", async () => {
          const val = await mesVariables.attendreQue((x) => !!x.length);
          expect(val).to.contain(idVariable);
        });

        it("Enlever de mes variables", async () => {
          await client.variables.enleverDeMesVariables({ idVariable });
          const val = await mesVariables.attendreQue((x) => !x.length);
          expect(val).not.to.contain(idVariable);
        });

        it("Ajouter à mes variables", async () => {
          await client.variables.ajouterÀMesVariables({ idVariable });
          const val = await mesVariables.attendreQue((x) => !!x.length);
          expect(val).to.contain(idVariable);
        });
      });

      describe("Noms", function () {
        let idVariable: string;
        let fOublier: schémaFonctionOublier;

        const noms = new utilsTestAttente.AttendreRésultat<{
          [clef: string]: string;
        }>();

        before("Suivre noms variable", async () => {
          idVariable = await client.variables.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables.suivreNomsVariable({
            idVariable,
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
          await client.variables.sauvegarderNomVariable({
            idVariable,
            langue: "fr",
            nom: "Précipitation",
          });
          const val = await noms.attendreQue((x) => !!x.fr);
          expect(val.fr).to.equal("Précipitation");
        });

        it("Ajouter des noms", async () => {
          await client.variables.sauvegarderNomsVariable({
            idVariable,
            noms: {
              த: "மழை",
              हिं: "बारिश",
            },
          });
          const val = await noms.attendreQue((x) => Object.keys(x).length > 2);
          expect(val).to.deep.equal({
            த: "மழை",
            हिं: "बारिश",
            fr: "Précipitation",
          });
        });

        it("Changer un nom", async () => {
          await client.variables.sauvegarderNomVariable({
            idVariable,
            langue: "fr",
            nom: "précipitation",
          });
          const val = await noms.attendreQue((x) => !x.fr.startsWith("P"));
          expect(val.fr).to.equal("précipitation");
        });

        it("Effacer un nom", async () => {
          await client.variables.effacerNomVariable({
            idVariable,
            langue: "fr",
          });
          const val = await noms.attendreQue((x) => !x["fr"]);
          expect(val).to.deep.equal({ த: "மழை", हिं: "बारिश" });
        });
      });

      describe("Descriptions", function () {
        let idVariable: string;

        const descrs = new attente.AttendreRésultat<{
          [key: string]: string;
        }>();
        let fOublier: schémaFonctionOublier;

        before("Préparer clients", async () => {
          idVariable = await client.variables.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables.suivreDescriptionsVariable({
            idVariable,
            f: (d) => descrs.mettreÀJour(d),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Pas de descriptions pour commencer", async () => {
          const vals = await descrs.attendreExiste();
          expect(Object.keys(vals)).to.have.lengthOf(0);
        });

        it("Ajouter une description", async () => {
          await client.variables.sauvegarderDescriptionVariable({
            idVariable,
            langue: "fr",
            description: "la quantité de précipitation quotidienne",
          });
          const val = await descrs.attendreQue((x) => !!x["fr"]);
          expect(val.fr).to.equal("la quantité de précipitation quotidienne");
        });

        it("Ajouter des descriptions", async () => {
          await client.variables.sauvegarderDescriptionsVariable({
            idVariable,
            descriptions: {
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
            },
          });
          const val = await descrs.attendreQue(
            (x) => Object.keys(x).length > 2,
          );
          expect(val).to.deep.equal({
            த: "தினசரி மழை",
            हिं: "दैनिक बारिश",
            fr: "la quantité de précipitation quotidienne",
          });
        });

        it("Changer une description", async () => {
          await client.variables.sauvegarderDescriptionVariable({
            idVariable,
            langue: "fr",
            description: "La quantité de précipitation quotidienne",
          });
          const val = await descrs.attendreQue((x) => x["fr"].startsWith("L"));
          expect(val.fr).to.equal("La quantité de précipitation quotidienne");
        });

        it("Effacer une description", async () => {
          await client.variables.effacerDescriptionVariable({
            idVariable,
            langue: "fr",
          });
          const val = await descrs.attendreQue((x) => !x["fr"]);
          expect(val).to.deep.equal({
            த: "தினசரி மழை",
            हिं: "दैनिक बारिश",
          });
        });
      });

      describe("Catégorie", function () {
        let idVariable: string;

        const catégorie = new attente.AttendreRésultat<catégorieVariables>();
        let fOublier: schémaFonctionOublier;

        before("Préparer clients", async () => {
          idVariable = await client.variables.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables.suivreCatégorieVariable({
            idVariable,
            f: (c) => catégorie.mettreÀJour(c),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Changer la catégorie", async () => {
          await client.variables.sauvegarderCatégorieVariable({
            idVariable,
            catégorie: "chaîne",
          });
          const val = await catégorie.attendreQue(
            (x) => x.catégorie !== "numérique",
          );
          expect(val).to.deep.equal({
            type: "simple",
            catégorie: "chaîne",
          });
        });
      });

      describe("Unités", function () {
        let idVariable: string;
        let fOublier: schémaFonctionOublier;
        const unités = new utilsTestAttente.AttendreRésultat<string | null>();

        before("Préparer clients", async () => {
          idVariable = await client.variables.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables.suivreUnitésVariable({
            idVariable,
            f: (u) => unités.mettreÀJour(u),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
          unités.toutAnnuler();
        });

        it("Aucune unité pour commencer", async () => {
          const val = await unités.attendreQue((x) => x !== undefined);
          expect(val).to.be.null();
        });

        it("Changer les unités", async () => {
          await client.variables.sauvegarderUnitésVariable({
            idVariable,
            idUnité: "mm",
          });
          const val = await unités.attendreQue((x) => !!x);
          expect(val).to.equal("mm");
        });
      });

      describe("Règles", function () {
        let idVariable: string;
        let idRègle: string;

        const règles = new attente.AttendreRésultat<règleVariableAvecId[]>();
        let fOublier: schémaFonctionOublier;

        before("Préparer clients", async () => {
          idVariable = await client.variables.créerVariable({
            catégorie: "numérique",
          });
          fOublier = await client.variables.suivreRèglesVariable({
            idVariable,
            f: (r) => règles.mettreÀJour(r),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Règle générique de catégorie pour commencer", async () => {
          const val = await règles.attendreQue((x) => !!x.length);
          expect(Array.isArray(val)).to.be.true();
          expect(val).to.have.lengthOf(1);
          expect(val[0].règle.typeRègle).to.equal("catégorie");
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
          idRègle = await client.variables.ajouterRègleVariable({
            idVariable,
            règle,
          });

          const val = await règles.attendreQue((x) => x.length > 1);
          expect(val).to.have.lengthOf(2);
          expect(val.filter((r) => r.id === idRègle)).to.have.lengthOf(1);
        });

        it("Effacer une règle", async () => {
          await client.variables.effacerRègleVariable({ idVariable, idRègle });
          const val = await règles.attendreQue((x) => x.length < 2);
          expect(val).to.have.lengthOf(1);
        });

        it("On ne peut pas effacer une règle générique de base", async () => {
          const val = await règles.attendreExiste();
          const règleDeBase = val[0];
          await client.variables.effacerRègleVariable({
            idVariable,
            idRègle: règleDeBase.id,
          });
          expect(val[0].id).to.equal(règleDeBase.id);
        });

        it("On détecte le changement de catégorie", async () => {
          await client.variables.sauvegarderCatégorieVariable({
            idVariable,
            catégorie: "horoDatage",
          });
          const val = await règles.attendreQue((x) =>
            x.some(
              (r) =>
                r.règle.typeRègle === "catégorie" &&
                r.règle.détails.catégorie.catégorie === "horoDatage",
            ),
          );
          const règleCatégorie = val.find(
            (r) => r.règle.typeRègle === "catégorie",
          ) as règleVariableAvecId<règleCatégorie> | undefined;
          expect(règleCatégorie).to.exist();
          expect(règleCatégorie?.règle.détails.catégorie).to.deep.equal({
            type: "simple",
            catégorie: "horoDatage",
          });
        });
      });

      describe("Copier variable", function () {
        const variables = new attente.AttendreRésultat<string[]>();
        const noms = new attente.AttendreRésultat<{ [key: string]: string }>();
        const descrs = new attente.AttendreRésultat<{
          [key: string]: string;
        }>();
        const catégorie = new attente.AttendreRésultat<catégorieVariables>();
        const règles = new attente.AttendreRésultat<règleVariableAvecId[]>();
        const unités = new attente.AttendreRésultat<string | null>();

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
            await client.variables.suivreVariables({
              f: (x) => variables.mettreÀJour(x),
            }),
          );

          const idVariable = await client.variables.créerVariable({
            catégorie: "numérique",
          });
          await client.variables.sauvegarderNomsVariable({
            idVariable,
            noms: {
              த: "மழை",
              हिं: "बारिश",
            },
          });
          await client.variables.sauvegarderDescriptionsVariable({
            idVariable,
            descriptions: {
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
            },
          });
          await client.variables.ajouterRègleVariable({ idVariable, règle });
          await client.variables.sauvegarderUnitésVariable({
            idVariable,
            idUnité: "mm",
          });

          idVariable2 = await client.variables.copierVariable({
            idVariable,
          });

          fsOublier.push(
            await client.variables.suivreNomsVariable({
              idVariable: idVariable2,
              f: (x) => noms.mettreÀJour(x),
            }),
          );
          fsOublier.push(
            await client.variables.suivreDescriptionsVariable({
              idVariable: idVariable2,
              f: (x) => descrs.mettreÀJour(x),
            }),
          );
          fsOublier.push(
            await client.variables.suivreRèglesVariable({
              idVariable: idVariable2,
              f: (r) => règles.mettreÀJour(r),
            }),
          );
          fsOublier.push(
            await client.variables.suivreCatégorieVariable({
              idVariable: idVariable2,
              f: (c) => catégorie.mettreÀJour(c),
            }),
          );
          fsOublier.push(
            await client.variables.suivreUnitésVariable({
              idVariable: idVariable2,
              f: (u) => unités.mettreÀJour(u),
            }),
          );
        });

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        it("La variable est copiée", async () => {
          const val = await variables.attendreQue((x) => x.length > 0);
          expect(Array.isArray(val)).to.be.true();
          expect(val).to.contain(idVariable2);
        });

        it("Les noms sont copiés", async () => {
          const val = await noms.attendreQue((x) => Object.keys(x).length > 1);
          expect(val).to.deep.equal({ த: "மழை", हिं: "बारिश" });
        });

        it("Les descriptions sont copiés", async () => {
          const val = await descrs.attendreQue(
            (x) => Object.keys(x).length > 1,
          );
          expect(val).to.deep.equal({
            த: "தினசரி மழை",
            हिं: "दैनिक बारिश",
          });
        });

        it("Les règles sont copiés", async () => {
          const règleCatégorie: règleCatégorie = {
            typeRègle: "catégorie",
            détails: {
              catégorie: { type: "simple", catégorie: "numérique" },
            },
          };
          const val = await règles.attendreQue((x) => x.length > 1);
          expect(val.map((r) => r.règle)).to.have.deep.members([
            règle,
            règleCatégorie,
          ]);
        });

        it("Les unités sont copiés", async () => {
          const val = await unités.attendreExiste();
          expect(val).to.equal("mm");
        });

        it("La catégorie est copiée", async () => {
          const val = await catégorie.attendreExiste();
          expect(val).to.deep.equal({
            type: "simple",
            catégorie: "numérique",
          });
        });
      });
    });
  });
});
