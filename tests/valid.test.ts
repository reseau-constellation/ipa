import { expect } from "chai";
import { v4 as uuidv4 } from "uuid";
import { élémentsBd } from "@/utils";
import {
  validerCatégorieVal,
  générerFonctionRègle,
  règleExiste,
  règleColonne,
  règleBornes,
  règleCatégorie,
  règleValeurCatégorique,
  typeOp,
} from "@/valid";
import { catégorieVariables } from "@/variables";

const catégories: {
  [key in catégorieVariables]: {
    valides: élémentsBd[];
    invalides: élémentsBd[];
  };
} = {
  numérique: {
    valides: [-12.3, 0, 1, 123e5],
    invalides: [false, "abc", { a: 2 }],
  },
  chaîne: {
    valides: ["abc", "வணக்கம்", ""],
    invalides: [123, true, ["abc"]],
  },
  horoDatage: {
    valides: [new Date(Date.now()).toISOString(), Date.now(), "1947-08-15"],
    invalides: ["15-08-1947"],
  },
  intervaleTemps: {
    valides: [["01-01-2021", "01-02-2021"]],
    invalides: ["01-01-2021"],
  },
  catégorique: {
    valides: ["abc", 1, true, false, { a: 1 }], // Tout dépend des options...rien à vérifier pour l'instant
    invalides: [],
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
      { cid: "QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP", ext: ".பை" },
    ],
    invalides: [
      { cid: "Je ne suis pas un cid", ext: ".பை" },
      { cid: "QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP" },
      { ext: ".பை" },
    ],
  },
  vidéo: {
    valides: [
      { cid: "QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP", ext: ".mp4" },
    ],
    invalides: [
      { cid: "QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP", ext: ".jpg" },
    ],
  },
  audio: {
    valides: [
      { cid: "QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP", ext: ".mp3" },
    ],
    invalides: [
      { cid: "QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP", ext: ".ts" },
    ],
  },
  photo: {
    valides: [
      { cid: "QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP", ext: ".jpg" },
    ],
    invalides: [
      { cid: "QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP", ext: ".பை" },
    ],
  },
};

describe("Validation", function () {
  describe("Valider catégories", function () {
    Object.keys(catégories).forEach((cat: string) => {
      describe(cat + " valides", function () {
        catégories[cat as catégorieVariables].valides.forEach((val) => {
          it(`${val}`, () => {
            const valide = validerCatégorieVal({
              val,
              catégorie: cat as catégorieVariables,
            });
            expect(valide).to.be.true;
          });
        });
      });
      describe(cat + " non valides", function () {
        catégories[cat as catégorieVariables].invalides.forEach((val) => {
          it(`${val}`, () => {
            const valide = validerCatégorieVal({
              val,
              catégorie: cat as catégorieVariables,
            });
            expect(valide).to.be.false;
          });
        });
      });
    });
  });
  describe("Générer fonction règle", function () {
    describe("Règle existe", function () {
      const règle: règleColonne<règleExiste> = {
        source: "variable",
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
      const empreinte = uuidv4();

      it("Valeure existante", () => {
        const erreurs = fonc([
          {
            données: { "col numérique": 123 },
            empreinte,
          },
        ]);
        expect(erreurs).to.be.an.empty("array");
      });
      it("Valeure manquante", () => {
        const erreurs = fonc([
          {
            données: { "une autre colonne": "abc" },
            empreinte,
          },
        ]);
        expect(erreurs).to.be.an("array").with.lengthOf(1);
        expect(erreurs[0].empreinte).to.equal(empreinte);
        expect(erreurs[0].erreur.règle).to.deep.equal(règle);
      });
    });

    describe("Règles catégories", function () {
      const règle: règleColonne<règleCatégorie> = {
        source: "variable",
        colonne: "col numérique",
        règle: {
          id: uuidv4(),
          règle: {
            typeRègle: "catégorie",
            détails: {
              catégorie: "numérique",
            },
          },
        },
      };
      const fonc = générerFonctionRègle({ règle, varsÀColonnes: {} });
      const empreinte = uuidv4();

      it("Catérogie valide", () => {
        const erreurs = fonc([
          {
            données: { "col numérique": 123 },
            empreinte,
          },
        ]);
        expect(erreurs).to.be.an.empty("array");
      });
      it("Catérogie invalide", () => {
        const erreurs = fonc([
          {
            données: { "col numérique": "abc" },
            empreinte,
          },
        ]);
        expect(erreurs).to.be.an("array").with.lengthOf(1);
        expect(erreurs[0].empreinte).to.equal(empreinte);
        expect(erreurs[0].erreur.règle).to.deep.equal(règle);
      });
    });
    describe("Règles bornes", function () {
      it("Pas d'erreure si la colonne n'existe pas", () => {
        const règle: règleColonne<règleBornes> = {
          source: "tableau",
          colonne: "col numérique",
          règle: {
            id: uuidv4(),
            règle: {
              typeRègle: "bornes",
              détails: {
                val: 0,
                op: ">=",
              },
            },
          },
        };
        const fonc = générerFonctionRègle({ règle, varsÀColonnes: {} });
        const erreurs = fonc([
          { données: { "une autre colonne": 1 }, empreinte: uuidv4() },
        ]);
        expect(erreurs).to.be.an.empty("array");
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
            source: "variable",
            colonne: "col numérique",
            règle: {
              id: uuidv4(),
              règle: {
                typeRègle: "bornes",
                détails: {
                  val: ref,
                  op: op.op,
                },
              },
            },
          };
          const fonc = générerFonctionRègle({ règle, varsÀColonnes: {} });
          const empreinte = uuidv4();

          op.valides.forEach((v) => {
            it(`${v}`, () => {
              const erreurs = fonc([
                {
                  données: { "col numérique": v },
                  empreinte,
                },
              ]);
              expect(erreurs).to.be.an.empty("array");
            });
          });
          op.invalides.forEach((v) => {
            it(`${v}`, () => {
              const erreurs = fonc([
                {
                  données: { "col numérique": v },
                  empreinte,
                },
              ]);
              expect(erreurs).to.be.an("array").with.lengthOf(1);
              expect(erreurs[0].empreinte).to.equal(empreinte);
              expect(erreurs[0].erreur.règle).to.deep.equal(règle);
            });
          });
        });
      });

      describe("Bornes selon une autre variable", () => {
        const règle: règleColonne<règleBornes> = {
          source: "tableau",
          colonne: "temp max",
          règle: {
            id: uuidv4(),
            règle: {
              typeRègle: "bornes",
              détails: {
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
        const empreinte = uuidv4();
        it("Pas d'erreur si la colonne n'existe pas", () => {
          const erreurs = fonc([{ données: { "temp min": 1 }, empreinte }]);
          expect(erreurs).to.be.an.empty("array");
        });
        it("Pas d'erreur si tout est valide", () => {
          const erreurs = fonc([
            { données: { "temp min": 10, "temp max": 20 }, empreinte },
          ]);
          expect(erreurs).to.be.an.empty("array");
        });
        it("Pas d'erreur si la colonne référence n'existe pas", () => {
          const erreurs = fonc([{ données: { "temp max": 20 }, empreinte }]);
          expect(erreurs).to.be.an.empty("array");
        });
        it("Erreur si non valide", () => {
          const erreurs = fonc([
            { données: { "temp max": 20, "temp min": 25 }, empreinte },
          ]);

          expect(erreurs).to.be.an("array").with.lengthOf(1);
          expect(erreurs[0].empreinte).to.equal(empreinte);
          expect(erreurs[0].erreur.règle).to.deep.equal(règle);
        });
      });
    });
    describe("Règles catégoriques", function () {
      const règle: règleColonne<règleValeurCatégorique> = {
        source: "tableau",
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
      const empreinte = uuidv4();

      it("Pas d'erreur si la colonne n'existe pas", () => {
        const erreurs = fonc([
          { données: { "une autre colonne": 2 }, empreinte },
        ]);
        expect(erreurs).to.be.an.empty("array");
      });
      it("Pas d'erreur si tout valide", () => {
        const erreurs = fonc([{ données: { "col chaîne": "a" }, empreinte }]);
        expect(erreurs).to.be.an.empty("array");
      });
      it("Erreur si non valide", () => {
        const erreurs = fonc([{ données: { "col chaîne": "d" }, empreinte }]);

        expect(erreurs).to.be.an("array").with.lengthOf(1);
        expect(erreurs[0].empreinte).to.equal(empreinte);
        expect(erreurs[0].erreur.règle).to.deep.equal(règle);
      });
    });
  });
});
