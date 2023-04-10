import isArray from "lodash/isArray";

import fs from "fs";
import path from "path";

import ImportateurDonnéesJSON, {
  extraireDonnées,
  aplatirDonnées,
  élément,
} from "@/importateur/json.js";

import { dossierRessourcesTests } from "@/utilsTests/dossiers";

describe("JSON", function () {
  describe("Extraire données", function () {
    test("Extraire d'objet", () => {
      const donnéesJSON = { a: 1 };
      const données = extraireDonnées(donnéesJSON, ["a"]);
      expect(données).toEqual(1);
    });
    test("Extraire de liste", () => {
      const donnéesJSON = [1, 2, 3];
      const données = extraireDonnées(donnéesJSON, [0]);
      expect(données).toEqual(1);
    });
    test("Extraire récursif", () => {
      const donnéesJSON = [{ a: 1 }, 2, 3];
      const données = extraireDonnées(donnéesJSON, [0, "a"]);
      expect(données).toEqual(1);
    });
    test("Erreur indexe chaîne pour liste", () => {
      const donnéesJSON = [1, 2, 3];
      expect(() => extraireDonnées(donnéesJSON, ["0"])).toThrow();
    });
    test("Erreur indexe numérique pour objet", () => {
      const donnéesJSON = [1, 2, 3];
      expect(() => extraireDonnées(donnéesJSON, ["0"])).toThrow();
    });
    test("Erreur indexer non-élément", () => {
      const donnéesJSON = { a: 1 };
      expect(() => extraireDonnées(donnéesJSON, [0])).toThrow();
    });
  });

  describe("Aplatire données", function () {
    test("Aplatire objet", () => {
      const données = { a: [{ b: 2 }, { b: 3 }, { b: 4 }], c: 1 };

      const aplaties = aplatirDonnées(données, ["a"]);
      expect(aplaties).toEqual([
        { c: 1, a: { b: 2 } },
        { c: 1, a: { b: 3 } },
        { c: 1, a: { b: 4 } },
      ]);
    });
    test("Aplatire liste", () => {
      const données = [[{ b: 2 }, { b: 3 }, { b: 4 }], { c: 1 }];

      const aplaties = aplatirDonnées(données, [0]);
      expect(aplaties).toEqual([
        [{ b: 2 }, { c: 1 }],
        [{ b: 3 }, { c: 1 }],
        [{ b: 4 }, { c: 1 }],
      ]);
    });
    test("Aplatire début liste", () => {
      const données = [{ b: 2 }, { b: 3 }, { b: 4 }];

      const aplaties = aplatirDonnées(données);
      expect(aplaties).toEqual([{ b: 2 }, { b: 3 }, { b: 4 }]);
    });
    test("Aplatire début dict", () => {
      const données = { a: { b: 2 }, b: { b: 3 }, c: { b: 4 } };

      const aplaties = aplatirDonnées(données);
      expect(aplaties).toEqual([{ b: 2 }, { b: 3 }, { b: 4 }]);
    });
    test("Aplatire dict imbriqué", () => {
      const données = {
        AFG: {
          location: "Afghanistan",
          population: 39835428.0,
          data: [
            {
              date: "2020-02-24",
              new_cases: 5.0,
            },
            {
              date: "2020-02-25",
              new_cases: 0.0,
            },
          ],
        },
        OWID_AFR: {
          location: "Africa",
          population: 1373486472.0,
          data: [
            {
              date: "2020-02-13",
              new_cases: 0.0,
            },
            {
              date: "2020-02-14",
              new_cases: 1.0,
            },
          ],
        },
      };

      const aplaties = aplatirDonnées(données, [-1, "data"]);
      expect(aplaties).toEqual([
        {
          location: "Afghanistan",
          population: 39835428.0,
          data: {
            date: "2020-02-24",
            new_cases: 5.0,
          },
        },
        {
          location: "Afghanistan",
          population: 39835428.0,
          data: {
            date: "2020-02-25",
            new_cases: 0.0,
          },
        },
        {
          location: "Africa",
          population: 1373486472.0,
          data: {
            date: "2020-02-13",
            new_cases: 0.0,
          },
        },
        {
          location: "Africa",
          population: 1373486472.0,
          data: {
            date: "2020-02-14",
            new_cases: 1.0,
          },
        },
      ]);
    });
  });

  describe("Importateur JSON", function () {
    let données: élément[];

    beforeAll(async () => {
      // Données de https://covid.ourworldindata.org/data/owid-covid-dataon
      const donnéesJSON = JSON.parse(
        (
          await fs.promises.readFile(
            path.join(await dossierRessourcesTests(), "donnéesTest.json")
          )
        ).toString()
      );
      const importateur = new ImportateurDonnéesJSON({
        "mes données": { "sont ici": [donnéesJSON] },
      });
      données = importateur.obtDonnées(
        ["mes données", "sont ici", 0],
        [-1, "data"],
        {
          région: ["location"],
          date: ["data", "date"],
          nouveauxCas: ["data", "new_cases"],
          totalCas: ["data", "total_cases"],
          nouveauxVaccinés: ["data", "new_vaccinations"],
        }
      );
    });

    test("Données importées", async () => {
      expect(isArray(données)).toBe(true);
      expect(données.length).toBeGreaterThan(0);
      expect(Object.keys(données[0])).toEqual(
        expect.arrayContaining(["région", "date", "nouveauxCas", "totalCas"])
      );
    });
  });
});
