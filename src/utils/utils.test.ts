import fs from "fs";
import path from "path";
import rmrf from "rimraf";
import AdmZip from "adm-zip";

import { cidValide, traduire, zipper } from "@/utils/index.js";

import { obtDirTempoPourTest } from "@/utilsTests/index.js";

describe("Utils", function () {
  describe("cidValide", function () {
    test("valide", () => {
      const valide = cidValide(
        "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ"
      );
      expect(valide).toBe(true);
    });
    test("non valide", () => {
      const valide = cidValide("Bonjour, je ne suis pas un IDC.");
      expect(valide).toBe(false);
    });
  });
  describe("traduire", function () {
    test("premier choix", () => {
      const trad = traduire({ fr: "français", த: "தமிழ்" }, ["த", "fr"]);
      expect(trad).toEqual("தமிழ்");
    });
    test("deuxième choix", () => {
      const trad = traduire({ fr: "français" }, ["த", "fr"]);
      expect(trad).toEqual("français");
    });
    test("non disponible", () => {
      const trad = traduire({ fr: "français" }, ["kaq"]);
      expect(trad).toBeUndefined;
    });
  });
  describe("zipper", function () {
    const dirTempoTest = obtDirTempoPourTest();
    const nomFichier = path.join(dirTempoTest, "testZip.zip");
    const fichierExtrait = path.join(dirTempoTest, "testZipExtrait");

    beforeAll(async () => {
      const fichiersDocs = [
        {
          nom: "fichier1.txt",
          octets: Buffer.from("Je ne suis que du texte."),
        },
      ];
      const fichiersSFIP = [
        {
          nom: "fichierSFIP1.txt",
          octets: Buffer.from("Je le fichier SFIP no. 1."),
        },
        {
          nom: "fichierSFIP2.txt",
          octets: Buffer.from("Je le fichier SFIP no. 2."),
        },
      ];

      await zipper(fichiersDocs, fichiersSFIP, nomFichier);
    });

    afterAll(() => {
      rmrf.sync(dirTempoTest);
    });

    test("Le fichier zip est créé", async () => {
      expect(fs.existsSync(nomFichier)).toBe(true);
      const zip = new AdmZip(nomFichier);
      zip.extractAllTo(/* target path */ fichierExtrait, /* overwrite */ true);

      expect(fs.existsSync(fichierExtrait)).toBe(true);
    });
    test("Les documents de base existent", () => {
      const adresseFichier1 = path.join(fichierExtrait, "fichier1.txt");
      expect(fs.existsSync(adresseFichier1)).toBe(true);
      const contenu = new TextDecoder().decode(
        fs.readFileSync(adresseFichier1)
      );
      expect(contenu).toEqual("Je ne suis que du texte.");
    });
    test("Les fichiers SFIP sont inclus", () => {
      const adresseFichiersSFIP = path.join(fichierExtrait, "sfip");
      expect(fs.existsSync(adresseFichiersSFIP)).toBe(true);

      const adresseFichierSFIP1 = path.join(
        adresseFichiersSFIP,
        "fichierSFIP1.txt"
      );
      expect(fs.existsSync(adresseFichierSFIP1)).toBe(true);
      const contenuSFIP1 = new TextDecoder().decode(
        fs.readFileSync(adresseFichierSFIP1)
      );
      expect(contenuSFIP1).toEqual("Je le fichier SFIP no. 1.");

      const adresseFichierSFIP2 = path.join(
        adresseFichiersSFIP,
        "fichierSFIP2.txt"
      );
      expect(fs.existsSync(adresseFichierSFIP2)).toBe(true);
      const contenuSFIP2 = new TextDecoder().decode(
        fs.readFileSync(adresseFichierSFIP2)
      );
      expect(contenuSFIP2).toEqual("Je le fichier SFIP no. 2.");
    });
  });
});
