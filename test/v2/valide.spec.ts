import { validerCatégorieVal } from "@constl/utils-ipa";
import { v4 as uuidv4 } from "uuid";

import { expect } from "aegir/chai";

import { générerFonctionValidation } from "@/v2/règles.js";
import type { DonnéesRangéeTableau } from "@/v2/tableaux.js";
import type { DagCborEncodable } from "@orbitdb/core";
import type {
  ErreurDonnée,
  FonctionValidation,
  Op,
  RègleBornes,
  RègleCatégorie,
  RègleColonne,
  RègleExiste,
  RègleIndexUnique,
  RègleValeurCatégorique,
  SourceRègle,
} from "@/v2/règles.js";
import type { CatégorieBaseVariables } from "@/v2/variables.js";

const catégories: {
  [key in CatégorieBaseVariables]: {
    valides: DagCborEncodable[];
    invalides: DagCborEncodable[];
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
      "Je ne suis pas un idc/fichier.txt",
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
    invalides: ["QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP/நிரல்.பை"],
  },
} as const;

describe.only("Validation", function () {
  describe("valider catégories", function () {
    Object.keys(catégories).forEach((cat) => {
      describe(cat + " valides", function () {
        catégories[cat as CatégorieBaseVariables].valides.forEach((val) => {
          it(`${val}`, () => {
            const valide = validerCatégorieVal({
              val,
              catégorie: {
                type: "simple",
                catégorie: cat as CatégorieBaseVariables,
              },
            });
            expect(valide).to.be.true();
          });
        });
      });
      describe(cat + " non valides", function () {
        catégories[cat as CatégorieBaseVariables].invalides.forEach((val) => {
          it(JSON.stringify(val), () => {
            const valide = validerCatégorieVal({
              val,
              catégorie: {
                type: "simple",
                catégorie: cat as CatégorieBaseVariables,
              },
            });
            expect(valide).to.be.false();
          });
        });
      });
    });
  });
  describe("générer fonction règle", function () {
    describe("règle existe", function () {
      const idColonneNumérique = "col numérique";
      const règle: RègleColonne<RègleExiste> = {
        source: { type: "variable", id: "idVar" },
        colonne: idColonneNumérique,
        règle: {
          id: uuidv4(),
          règle: {
            type: "existe",
            détails: {},
          },
        },
      };
      const fonc = générerFonctionValidation({
        règle,
        varsÀColonnes: {},
        colsIndex: [],
      });
      const id = uuidv4();

      it("valeure existante", () => {
        const erreurs = fonc([
          {
            données: { [idColonneNumérique]: 123 },
            id,
          },
        ]);
        expect(erreurs).to.be.empty();
      });

      it("valeure manquante", () => {
        const erreurs = fonc([
          {
            données: { "une autre colonne": "abc" },
            id,
          },
        ]);
        const réf: ErreurDonnée<RègleExiste>[] = [
          {
            id,
            erreur: règle,
          },
        ];
        expect(erreurs).to.have.deep.members(réf);
      });
    });

    describe("règles catégories", function () {
      const idColonneNumérique = "col numérique";
      const règle: RègleColonne<RègleCatégorie> = {
        source: { type: "variable", id: "idVar" },
        colonne: idColonneNumérique,
        règle: {
          id: uuidv4(),
          règle: {
            type: "catégorie",
            détails: {
              catégorie: { type: "simple", catégorie: "numérique" },
            },
          },
        },
      };
      const fonc = générerFonctionValidation({
        règle,
        varsÀColonnes: {},
        colsIndex: [],
      });
      const id = uuidv4();

      it("catérogie valide", () => {
        const erreurs = fonc([
          {
            données: { [idColonneNumérique]: 123 },
            id,
          },
        ]);
        expect(erreurs).to.be.empty();
      });

      it("catérogie invalide", () => {
        const erreurs = fonc([
          {
            données: { [idColonneNumérique]: "abc" },
            id,
          },
        ]);
        const réf: ErreurDonnée<RègleCatégorie>[] = [
          {
            id,
            erreur: règle,
          },
        ];
        expect(erreurs).to.have.members(réf);
      });
    });

    describe("règles index unique", function () {
      const idColonneTexte = "col chaîne";
      const idColonneDate = "col date";

      describe("index univariable", function () {
        let fonc: FonctionValidation<DonnéesRangéeTableau, RègleIndexUnique>;

        const règle: RègleColonne<RègleIndexUnique> = {
          source: {
            type: "tableau",
            idTableau: "idTableau",
            idStructure: "idStructure",
          },
          colonne: idColonneTexte,
          règle: {
            id: uuidv4(),
            règle: {
              type: "indexUnique",
            },
          },
        };

        before(async () => {
          fonc = générerFonctionValidation({
            règle,
            varsÀColonnes: {},
            colsIndex: [idColonneTexte],
          });
        });

        it("données valides", () => {
          const erreurs = fonc([
            { données: { [idColonneTexte]: "a" }, id: uuidv4() },
            { données: { [idColonneTexte]: "b" }, id: uuidv4() },
          ]);

          expect(erreurs).to.be.empty();
        });

        it("index dupliqué", () => {
          const idsÉléments = [uuidv4(), uuidv4(), uuidv4()];
          const erreurs = fonc([
            { données: { [idColonneTexte]: "a" }, id: idsÉléments[0] },
            { données: { [idColonneTexte]: "a" }, id: idsÉléments[1] },
            { données: { [idColonneTexte]: "b" }, id: idsÉléments[2] },
          ]);

          const réf: ErreurDonnée<RègleIndexUnique>[] = [
            {
              id: idsÉléments[0],
              erreur: règle,
            },
            {
              id: idsÉléments[1],
              erreur: règle,
            },
          ];
          expect(erreurs).to.have.deep.members(réf);
        });
      });

      describe("index multivariable", function () {
        let fonc: FonctionValidation<DonnéesRangéeTableau, RègleIndexUnique>;

        const règle: RègleColonne<RègleIndexUnique> = {
          source: {
            type: "tableau",
            idTableau: "idTableau",
            idStructure: "idStructure",
          },
          colonne: idColonneTexte,
          règle: {
            id: uuidv4(),
            règle: {
              type: "indexUnique",
            },
          },
        };

        before(async () => {
          fonc = générerFonctionValidation({
            règle,
            varsÀColonnes: {},
            colsIndex: [idColonneTexte, idColonneDate],
          });
        });

        it("données valides", () => {
          const erreurs = fonc([
            {
              données: {
                [idColonneTexte]: "a",
                [idColonneDate]: new Date("01/01/2025").getTime(),
              },
              id: uuidv4(),
            },
            {
              données: {
                [idColonneTexte]: "a",
                [idColonneDate]: new Date("01/02/2025").getTime(),
              },
              id: uuidv4(),
            },
          ]);

          expect(erreurs).to.be.empty();
        });

        it("index dupliqué", () => {
          const idsÉléments = [uuidv4(), uuidv4(), uuidv4()];
          const erreurs = fonc([
            {
              données: {
                [idColonneTexte]: "a",
                [idColonneDate]: new Date("01/01/2025").getTime(),
              },
              id: idsÉléments[0],
            },
            {
              données: {
                [idColonneTexte]: "a",
                [idColonneDate]: new Date("01/01/2025").getTime(),
              },
              id: idsÉléments[1],
            },
            {
              données: {
                [idColonneTexte]: "b",
                [idColonneDate]: new Date("01/01/2025").getTime(),
              },
              id: idsÉléments[2],
            },
          ]);

          const réf: ErreurDonnée<RègleIndexUnique>[] = [
            {
              id: idsÉléments[0],
              erreur: règle,
            },
            {
              id: idsÉléments[1],
              erreur: règle,
            },
          ];
          expect(erreurs).to.have.deep.members(réf);
        });
      });
    });

    describe("règles bornes", function () {
      const idColonneNumérique = "col numérique";

      it("pas d'erreure si la colonne n'existe pas", () => {
        const règle: RègleColonne<RègleBornes> = {
          source: {
            type: "tableau",
            idTableau: "idTableau",
            idStructure: "idStructure",
          },
          colonne: idColonneNumérique,
          règle: {
            id: uuidv4(),
            règle: {
              type: "bornes",
              détails: {
                type: "fixe",
                val: 0,
                op: ">=",
              },
            },
          },
        };
        const fonc = générerFonctionValidation({
          règle,
          varsÀColonnes: {},
          colsIndex: [],
        });
        const erreurs = fonc([
          { données: { "une autre colonne": 1 }, id: uuidv4() },
        ]);
        expect(erreurs).to.be.empty();
      });

      it("tests bornes", () => {
        const source: SourceRègle = {
          type: "tableau",
          idTableau: "idTableau",
          idStructure: "idStructure",
        };

        const ops: { op: Op; valides: number[]; invalides: number[] }[] = [
          { op: ">", valides: [0.1, 1], invalides: [0, -1] },
          { op: ">=", valides: [0, 1], invalides: [-0.1, -1] },
          { op: "<", valides: [-1, -0.1], invalides: [0, 1] },
          { op: "<=", valides: [-1, 0], invalides: [0.1, 1] },
        ];
        ops.forEach((op) => {
          describe(op.op, () => {
            const règle: RègleColonne<RègleBornes> = {
              source,
              colonne: idColonneNumérique,
              règle: {
                id: uuidv4(),
                règle: {
                  type: "bornes",
                  détails: {
                    type: "fixe",
                    val: 0,
                    op: op.op,
                  },
                },
              },
            };
            const fonc = générerFonctionValidation({
              règle,
              varsÀColonnes: {},
              colsIndex: [],
            });
            const idÉlément = uuidv4();

            op.valides.forEach((v) => {
              it(`${v}`, () => {
                const erreurs = fonc([
                  {
                    données: { [idColonneNumérique]: v },
                    id: idÉlément,
                  },
                ]);
                expect(erreurs).to.be.empty();
              });
            });

            op.invalides.forEach((v) => {
              it(`${v}`, () => {
                const erreurs = fonc([
                  {
                    données: { [idColonneNumérique]: v },
                    id: idÉlément,
                  },
                ]);
                const réf: ErreurDonnée<RègleBornes>[] = [
                  {
                    id: idÉlément,
                    erreur: règle,
                  },
                ];
                expect(erreurs).to.have.deep.members(réf);
              });
            });
          });
        });
      });

      describe("bornes selon une autre variable", () => {
        const idVarTempMin = "var temp min";

        const idColTempMax = "temp max";
        const idColTempMin = "temp min";

        const règle: RègleColonne<RègleBornes> = {
          source: { type: "variable", id: "idVar" },
          colonne: idColTempMax,
          règle: {
            id: uuidv4(),
            règle: {
              type: "bornes",
              détails: {
                type: "dynamiqueVariable",
                val: idVarTempMin,
                op: ">=",
              },
            },
          },
        };
        const fonc = générerFonctionValidation({
          règle,
          varsÀColonnes: {
            [idVarTempMin]: idColTempMin,
          },
          colsIndex: [],
        });
        const idÉlément = uuidv4();

        it("pas d'erreur si la colonne n'existe pas", () => {
          const erreurs = fonc([
            { données: { [idColTempMin]: 1 }, id: idÉlément },
          ]);

          expect(erreurs).to.be.empty();
        });

        it("pas d'erreur si tout est valide", () => {
          const erreurs = fonc([
            {
              données: { [idColTempMin]: 10, [idColTempMax]: 20 },
              id: idÉlément,
            },
          ]);

          expect(erreurs).to.be.empty();
        });

        it("pas d'erreur si la colonne référence n'existe pas", () => {
          const erreurs = fonc([
            { données: { [idColTempMax]: 20 }, id: idÉlément },
          ]);

          expect(erreurs).to.be.empty();
        });

        it("erreur si non valide", () => {
          const erreurs = fonc([
            {
              données: { [idColTempMax]: 20, [idColTempMin]: 25 },
              id: idÉlément,
            },
          ]);

          const réf: ErreurDonnée<RègleBornes>[] = [
            {
              id: idÉlément,
              erreur: règle,
            },
          ];
          expect(erreurs).to.have.deep.members(réf);
        });
      });
    });

    describe("règles catégoriques", function () {
      const idColonneChaîne = "col chaîne";

      const règle: RègleColonne<RègleValeurCatégorique> = {
        source: {
          type: "tableau",
          idTableau: "idTableau",
          idStructure: "idStructure",
        },
        colonne: idColonneChaîne,
        règle: {
          id: uuidv4(),
          règle: {
            type: "valeurCatégorique",
            détails: {
              type: "fixe",
              options: ["a", "b", "c"],
            },
          },
        },
      };
      const fonc = générerFonctionValidation({
        règle,
        varsÀColonnes: {},
        colsIndex: [],
      });
      const id = uuidv4();

      it("pas d'erreur si la colonne n'existe pas", () => {
        const erreurs = fonc([{ données: { "une autre colonne": 2 }, id }]);

        expect(erreurs).to.be.empty();
      });

      it("pas d'erreur si valide", () => {
        const erreurs = fonc([{ données: { [idColonneChaîne]: "a" }, id }]);

        expect(erreurs).to.be.empty();
      });

      it("erreur si non valide", () => {
        const erreurs = fonc([{ données: { [idColonneChaîne]: "d" }, id }]);

        const réf: ErreurDonnée<RègleValeurCatégorique>[] = [
          {
            id,
            erreur: règle,
          },
        ];

        expect(erreurs).to.deep.equal(réf);
      });
    });

    describe("catégories liste - règle bornes", function () {
      const idColonneNumérique = "col numérique";

      const règle: RègleColonne<RègleBornes> = {
        source: { type: "variable", id: "idVar" },
        colonne: idColonneNumérique,
        règle: {
          id: uuidv4(),
          règle: {
            type: "bornes",
            détails: {
              type: "fixe",
              op: ">",
              val: 0,
            },
          },
        },
      };
      const fonc = générerFonctionValidation({
        règle,
        varsÀColonnes: {},
        colsIndex: [],
      });
      const id = uuidv4();

      it("valeur valide", () => {
        const erreurs = fonc([
          {
            données: { [idColonneNumérique]: [123, 456] },
            id,
          },
        ]);

        expect(erreurs).to.be.empty();
      });

      it("valeur invalide", () => {
        const erreurs = fonc([
          {
            données: { [idColonneNumérique]: [123, -123] },
            id,
          },
        ]);

        const réf: ErreurDonnée<RègleBornes>[] = [
          {
            id,
            erreur: règle,
          },
        ];

        expect(erreurs).to.deep.equal(réf);
      });
    });

    describe("catégories liste - règle catégorie", function () {
      const idColonneNumérique = "col numérique";
      const règle: RègleColonne<RègleCatégorie> = {
        source: { type: "variable", id: "idVar" },
        colonne: idColonneNumérique,
        règle: {
          id: uuidv4(),
          règle: {
            type: "catégorie",
            détails: {
              catégorie: { type: "liste", catégorie: "numérique" },
            },
          },
        },
      };
      const fonc = générerFonctionValidation({
        règle,
        varsÀColonnes: {},
        colsIndex: [],
      });
      const id = uuidv4();

      it("catégorie valide", () => {
        const erreurs = fonc([
          {
            données: { [idColonneNumérique]: [123, 456] },
            id,
          },
        ]);

        expect(erreurs).to.be.empty();
      });

      it("catégorie invalide", () => {
        const erreurs = fonc([
          {
            données: { [idColonneNumérique]: [123, "abc"] },
            id,
          },
        ]);

        const réf: ErreurDonnée<RègleCatégorie>[] = [
          {
            id,
            erreur: règle,
          },
        ];

        expect(erreurs).to.deep.equal(réf);
      });
    });
  });
});
