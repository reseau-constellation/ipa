import { validerCatégorieVal } from "@constl/utils-ipa";
import { v4 as uuidv4 } from "uuid";

import { expect } from "aegir/chai";
import {
  générerFonctionRègle,
  règleBornes,
  règleCatégorie,
  règleColonne,
  règleExiste,
  règleValeurCatégorique,
  typeOp,
} from "@/valid.js";
import type { catégorieBaseVariables } from "@/variables.js";
import type { élémentsBd } from "@/types.js";

const catégories: {
  [key in catégorieBaseVariables]: {
    valides: élémentsBd[];
    invalides: élémentsBd[];
  };
} = {
  numérique: {
    valides: [-12.3, 0, 1, 123e5],
    invalides: [false, "abc", { a: 2 }],
  },
  chaîne: {
    valides: ["/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX"],
    invalides: [
      123,
      "zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX",
      "/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX/7e0cde32-7fee-487c-ad6e-4247f627488e", // orbit-db < v1.0
    ],
  },
  chaîneNonTraductible: {
    valides: ["abc", "வணக்கம்", ""],
    invalides: [123, true, ["abc"]],
  },
  horoDatage: {
    valides: [new Date(Date.now()).toISOString(), Date.now(), "1947-08-15"],
    invalides: ["15-08-1947"],
  },
  intervaleTemps: {
    valides: [["01-01-2021", "01-02-2021"]],
    invalides: ["01-01-2021", ["01-01-2021"]],
  },
  booléen: {
    valides: [true, false],
    invalides: [1, 0, "abc"],
  },
  géojson: {
    valides: [
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [102.0, 0.5] },
            properties: { prop0: "value0" },
          },
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [102.0, 0.0],
                [103.0, 1.0],
                [104.0, 0.0],
                [105.0, 1.0],
              ],
            },
            properties: {
              prop0: "value0",
              prop1: 0.0,
            },
          },
        ],
      },
    ],
    invalides: [
      { "Je suis": "invalide" },
      {
        type: "feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [102.0, 0.0],
            [103.0, 1.0],
            [104.0, 0.0],
            [105.0, 1.0],
          ],
        },
        properties: {
          prop0: "value0",
          prop1: 0.0,
        },
      },
    ],
  },
  fichier: {
    valides: [
      "QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP/text.txt",
      "QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP/கோப்பு.பை",
    ],
    invalides: [
      "Je ne suis pas un cid/fichier.txt",
      "QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP",
    ],
  },
  vidéo: {
    valides: ["QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP/fichier.mp4"],
    invalides: ["QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP/fichier.jpg"],
  },
  audio: {
    valides: ["QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP/fichier.mp3"],
    invalides: ["QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP/fichier.ts"],
  },
  image: {
    valides: ["QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP/fichier.jpg"],
    invalides: ["QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP/fichier.பை"],
  },
};

describe("Validation", function () {
  describe("Valider catégories", function () {
    Object.keys(catégories).forEach((cat) => {
      describe(cat + " valides", function () {
        catégories[cat as catégorieBaseVariables].valides.forEach((val) => {
          it(`${val}`, () => {
            const valide = validerCatégorieVal({
              val,
              catégorie: {
                type: "simple",
                catégorie: cat as catégorieBaseVariables,
              },
            });
            expect(valide).to.be.true();
          });
        });
      });
      describe(cat + " non valides", function () {
        catégories[cat as catégorieBaseVariables].invalides.forEach((val) => {
          it(JSON.stringify(val), () => {
            const valide = validerCatégorieVal({
              val,
              catégorie: {
                type: "simple",
                catégorie: cat as catégorieBaseVariables,
              },
            });
            expect(valide).to.be.false();
          });
        });
      });
    });
  });
  describe("Générer fonction règle", function () {
    describe("Règle existe", function () {
      const règle: règleColonne<règleExiste> = {
        source: { type: "variable", id: "idVar" },
        colonne: "col numérique",
        règle: {
          id: uuidv4(),
          règle: {
            typeRègle: "existe",
            détails: {},
          },
        },
      };
      const fonc = générerFonctionRègle({ règle, varsÀColonnes: {} });
      const id = uuidv4();

      it("Valeure existante", () => {
        const erreurs = fonc([
          {
            données: { "col numérique": 123 },
            id,
          },
        ]);
        expect(Array.isArray(erreurs)).to.be.true();
        expect(erreurs.length).to.equal(0);
      });
      it("Valeure manquante", () => {
        const erreurs = fonc([
          {
            données: { "une autre colonne": "abc" },
            id,
          },
        ]);
        expect(Array.isArray(erreurs)).to.be.true();
        expect(erreurs.length).to.equal(1);
        expect(erreurs[0].id).to.equal(id);
        expect(erreurs[0].erreur.règle).to.equal(règle);
      });
    });

    describe("Règles catégories", function () {
      const règle: règleColonne<règleCatégorie> = {
        source: { type: "variable", id: "idVar" },
        colonne: "col numérique",
        règle: {
          id: uuidv4(),
          règle: {
            typeRègle: "catégorie",
            détails: {
              catégorie: { type: "simple", catégorie: "numérique" },
            },
          },
        },
      };
      const fonc = générerFonctionRègle({ règle, varsÀColonnes: {} });
      const id = uuidv4();

      it("Catérogie valide", () => {
        const erreurs = fonc([
          {
            données: { "col numérique": 123 },
            id,
          },
        ]);
        expect(Array.isArray(erreurs)).to.be.true();
        expect(erreurs.length).to.equal(0);
      });
      it("Catérogie invalide", () => {
        const erreurs = fonc([
          {
            données: { "col numérique": "abc" },
            id,
          },
        ]);
        expect(Array.isArray(erreurs)).to.be.true();
        expect(erreurs.length).to.equal(1);
        expect(erreurs[0].id).to.equal(id);
        expect(erreurs[0].erreur.règle).to.equal(règle);
      });
    });
    describe("Règles bornes", function () {
      it("Pas d'erreure si la colonne n'existe pas", () => {
        const règle: règleColonne<règleBornes> = {
          source: { type: "tableau", id: "idTableau" },
          colonne: "col numérique",
          règle: {
            id: uuidv4(),
            règle: {
              typeRègle: "bornes",
              détails: {
                type: "fixe",
                val: 0,
                op: ">=",
              },
            },
          },
        };
        const fonc = générerFonctionRègle({ règle, varsÀColonnes: {} });
        const erreurs = fonc([
          { données: { "une autre colonne": 1 }, id: uuidv4() },
        ]);
        expect(Array.isArray(erreurs)).to.be.true();
        expect(erreurs.length).to.equal(0);
      });

      const ref = 0;
      const ops: { op: typeOp; valides: number[]; invalides: number[] }[] = [
        { op: ">", valides: [0.1, 1], invalides: [0, -1] },
        { op: ">=", valides: [0, 1], invalides: [-0.1, -1] },
        { op: "<", valides: [-1, -0.1], invalides: [0, 1] },
        { op: "<=", valides: [-1, 0], invalides: [0.1, 1] },
      ];
      ops.forEach((op) => {
        describe(op.op, () => {
          const règle: règleColonne<règleBornes> = {
            source: { type: "variable", id: "idVar" },
            colonne: "col numérique",
            règle: {
              id: uuidv4(),
              règle: {
                typeRègle: "bornes",
                détails: {
                  type: "fixe",
                  val: ref,
                  op: op.op,
                },
              },
            },
          };
          const fonc = générerFonctionRègle({ règle, varsÀColonnes: {} });
          const id = uuidv4();

          op.valides.forEach((v) => {
            it(`${v}`, () => {
              const erreurs = fonc([
                {
                  données: { "col numérique": v },
                  id,
                },
              ]);
              expect(Array.isArray(erreurs)).to.be.true();
              expect(erreurs.length).to.equal(0);
            });
          });
          op.invalides.forEach((v) => {
            it(`${v}`, () => {
              const erreurs = fonc([
                {
                  données: { "col numérique": v },
                  id,
                },
              ]);
              expect(Array.isArray(erreurs)).to.be.true();
              expect(erreurs.length).to.equal(1);
              expect(erreurs[0].id).to.equal(id);
              expect(erreurs[0].erreur.règle).to.equal(règle);
            });
          });
        });
      });

      describe("Bornes selon une autre variable", () => {
        const règle: règleColonne<règleBornes> = {
          source: { type: "variable", id: "idVar" },
          colonne: "temp max",
          règle: {
            id: uuidv4(),
            règle: {
              typeRègle: "bornes",
              détails: {
                type: "dynamiqueVariable",
                val: "var temp min",
                op: ">=",
              },
            },
          },
        };
        const fonc = générerFonctionRègle({
          règle,
          varsÀColonnes: {
            "var temp min": "temp min",
          },
        });
        const id = uuidv4(); // Pas important

        it("Pas d'erreur si la colonne n'existe pas", () => {
          const erreurs = fonc([{ données: { "temp min": 1 }, id }]);
          expect(Array.isArray(erreurs)).to.be.true();
          expect(erreurs.length).to.equal(0);
        });
        it("Pas d'erreur si tout est valide", () => {
          const erreurs = fonc([
            { données: { "temp min": 10, "temp max": 20 }, id },
          ]);
          expect(Array.isArray(erreurs)).to.be.true();
          expect(erreurs.length).to.equal(0);
        });
        it("Pas d'erreur si la colonne référence n'existe pas", () => {
          const erreurs = fonc([{ données: { "temp max": 20 }, id }]);
          expect(Array.isArray(erreurs)).to.be.true();
          expect(erreurs.length).to.equal(0);
        });
        it("Erreur si non valide", () => {
          const erreurs = fonc([
            { données: { "temp max": 20, "temp min": 25 }, id },
          ]);

          expect(Array.isArray(erreurs)).to.be.true();
          expect(erreurs.length).to.equal(1);
          expect(erreurs[0].id).to.equal(id);
          expect(erreurs[0].erreur.règle).to.equal(règle);
        });
      });
    });
    describe("Règles catégoriques", function () {
      const règle: règleColonne<règleValeurCatégorique> = {
        source: { type: "tableau", id: "idTableau" },
        colonne: "col chaîne",
        règle: {
          id: uuidv4(),
          règle: {
            typeRègle: "valeurCatégorique",
            détails: {
              type: "fixe",
              options: ["a", "b", "c"],
            },
          },
        },
      };
      const fonc = générerFonctionRègle({
        règle,
        varsÀColonnes: { "var temp min": "temp min" },
      });
      const id = uuidv4();

      it("Pas d'erreur si la colonne n'existe pas", () => {
        const erreurs = fonc([{ données: { "une autre colonne": 2 }, id }]);
        expect(Array.isArray(erreurs)).to.be.true();
        expect(erreurs.length).to.equal(0);
      });
      it("Pas d'erreur si tout valide", () => {
        const erreurs = fonc([{ données: { "col chaîne": "a" }, id }]);
        expect(Array.isArray(erreurs)).to.be.true();
        expect(erreurs.length).to.equal(0);
      });

      it("Erreur si non valide", () => {
        const erreurs = fonc([{ données: { "col chaîne": "d" }, id }]);

        expect(Array.isArray(erreurs)).to.be.true();
        expect(erreurs.length).to.equal(1);
        expect(erreurs[0].id).to.equal(id);
        expect(erreurs[0].erreur.règle).to.equal(règle);
      });
    });
    describe("Catégories liste", function () {
      const règleCat: règleColonne<règleCatégorie> = {
        source: { type: "variable", id: "idVar" },
        colonne: "col numérique",
        règle: {
          id: uuidv4(),
          règle: {
            typeRègle: "catégorie",
            détails: {
              catégorie: { type: "liste", catégorie: "numérique" },
            },
          },
        },
      };
      const règleVal: règleColonne<règleBornes> = {
        source: { type: "variable", id: "idVar" },
        colonne: "col numérique",
        règle: {
          id: uuidv4(),
          règle: {
            typeRègle: "bornes",
            détails: {
              type: "fixe",
              op: ">",
              val: 0,
            },
          },
        },
      };
      const foncCat = générerFonctionRègle({
        règle: règleCat,
        varsÀColonnes: {},
      });
      const foncBorne = générerFonctionRègle({
        règle: règleVal,
        varsÀColonnes: {},
      });
      const id = uuidv4();

      it("Catérogie valide", () => {
        const erreurs = foncCat([
          {
            données: { "col numérique": [123, 456] },
            id,
          },
        ]);
        expect(Array.isArray(erreurs)).to.be.true();
        expect(erreurs.length).to.equal(0);
      });
      it("Catérogie invalide", () => {
        const erreurs = foncCat([
          {
            données: { "col numérique": [123, "abc"] },
            id,
          },
        ]);
        expect(Array.isArray(erreurs)).to.be.true();
        expect(erreurs.length).to.equal(1);
        expect(erreurs[0].id).to.equal(id);
        expect(erreurs[0].erreur.règle).to.equal(règleCat);
      });
      it("Valeur valide", () => {
        const erreurs = foncBorne([
          {
            données: { "col numérique": [123, 456] },
            id,
          },
        ]);
        expect(Array.isArray(erreurs)).to.be.true();
        expect(erreurs.length).to.equal(0);
      });
      it("Valeur invalide", () => {
        const erreurs = foncBorne([
          {
            données: { "col numérique": [123, -123] },
            id,
          },
        ]);
        expect(Array.isArray(erreurs)).to.be.true();
        expect(erreurs.length).to.equal(1);
        expect(erreurs[0].id).to.equal(id);
        expect(erreurs[0].erreur.règle).to.equal(règleVal);
      });
    });
  });
});
