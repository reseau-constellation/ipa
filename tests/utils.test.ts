import { expect } from "chai";
import { step } from "mocha-steps";

import fs from "fs";
import path from "path";
import rmrf from "rimraf";
import AdmZip from "adm-zip";

import { cidValide, traduire, zipper } from "@/utils";

describe("Utils", function () {
  describe("cidValide", function () {
    step("valide", () => {
      const valide = cidValide(
        "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ"
      );
      expect(valide).to.be.true;
    });
    step("non valide", () => {
      const valide = cidValide("Bonjour, je ne suis pas une CID.");
      expect(valide).to.be.false;
    });
  });
  describe("traduire", function () {
    step("premier choix", () => {
      const trad = traduire({ fr: "français", த: "தமிழ்" }, ["த", "fr"]);
      expect(trad).to.equal("தமிழ்");
    });
    step("deuxième choix", () => {
      const trad = traduire({ fr: "français" }, ["த", "fr"]);
      expect(trad).to.equal("français");
    });
    step("non disponible", () => {
      const trad = traduire({ fr: "français" }, ["kaq"]);
      expect(trad).to.be.undefined;
    });
  });
  describe("zipper", function () {
    const nomFichier = path.join(__dirname, "_temp/testZip.zip");
    const fichierExtrait = path.join(__dirname, "_temp/testZipExtrait");

    before(async () => {
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

    after(() => {
      rmrf.sync(path.join(__dirname, "_temp"));
    });
    step("Le fichier zip est créé", async () => {
      expect(fs.existsSync(nomFichier)).to.be.true;
      const zip = new AdmZip(nomFichier);
      zip.extractAllTo(/*target path*/ fichierExtrait, /*overwrite*/ true);

      expect(fs.existsSync(fichierExtrait)).to.be.true;
    });
    step("Les documents de base existent", () => {
      const adresseFichier1 = path.join(fichierExtrait, "fichier1.txt");
      expect(fs.existsSync(adresseFichier1)).to.be.true;
      const contenu = new TextDecoder().decode(
        fs.readFileSync(adresseFichier1)
      );
      expect(contenu).to.equal("Je ne suis que du texte.");
    });
    step("Les fichiers SFIP sont inclus", () => {
      const adresseFichiersSFIP = path.join(fichierExtrait, "sfip");
      expect(fs.existsSync(adresseFichiersSFIP)).to.be.true;

      const adresseFichierSFIP1 = path.join(
        adresseFichiersSFIP,
        "fichierSFIP1.txt"
      );
      expect(fs.existsSync(adresseFichierSFIP1)).to.be.true;
      const contenuSFIP1 = new TextDecoder().decode(
        fs.readFileSync(adresseFichierSFIP1)
      );
      expect(contenuSFIP1).to.equal("Je le fichier SFIP no. 1.");

      const adresseFichierSFIP2 = path.join(
        adresseFichiersSFIP,
        "fichierSFIP2.txt"
      );
      expect(fs.existsSync(adresseFichierSFIP2)).to.be.true;
      const contenuSFIP2 = new TextDecoder().decode(
        fs.readFileSync(adresseFichierSFIP2)
      );
      expect(contenuSFIP2).to.equal("Je le fichier SFIP no. 2.");
    });
  });
});
