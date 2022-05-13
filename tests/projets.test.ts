import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";

import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import rmrf from "rimraf";
import AdmZip from "adm-zip";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import { schémaFonctionOublier, adresseOrbiteValide } from "@/utils";

import { testAPIs, config } from "./sfipTest";
import { générerClients, attendreRésultat, typesClients } from "./utils";

chai.should();
chai.use(chaiAsPromised);

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Projets", function () {
        this.timeout(config.timeout);

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation;

        let idProjet: string;

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

        step("Création", async () => {
          idProjet = await client.projets!.créerProjet();
          expect(adresseOrbiteValide(idProjet)).to.be.true;
        });

        describe("Mes projets", function () {
          let idNouveauProjet: string;
          let mesProjets: string[] = [];
          let fOublier: schémaFonctionOublier;

          before(async () => {
            idNouveauProjet = await client.projets!.créerProjet();
            fOublier = await client.projets!.suivreProjets({
              f: (ps) => (mesProjets = ps),
            });
          });

          after(() => {
            if (fOublier) fOublier();
          });

          step("Le projet est déjà ajouté", async () => {
            expect(mesProjets).to.include(idNouveauProjet);
          });

          step("Enlever de mes projets", async () => {
            await client.projets!.enleverDeMesProjets(idNouveauProjet);
            expect(mesProjets).to.not.include(idNouveauProjet);
          });

          step("Ajouter à mes projets", async () => {
            await client.projets!.ajouterÀMesProjets(idNouveauProjet);
            expect(mesProjets).to.include(idNouveauProjet);
          });

          step("On peut aussi l'effacer", async () => {
            await client.projets!.effacerProjet({ id: idNouveauProjet });
            expect(mesProjets).to.not.include(idNouveauProjet);
          });
        });

        describe("Noms", function () {
          let noms: { [key: string]: string };
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.projets!.suivreNomsProjet({
              id: idProjet,
              f: (n) => (noms = n),
            });
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Pas de noms pour commencer", async () => {
            expect(noms).to.be.empty;
          });

          step("Ajouter un nom", async () => {
            await client.projets!.sauvegarderNomProjet({
              id: idProjet,
              langue: "fr",
              nom: "Alphabets",
            });
            expect(noms.fr).to.equal("Alphabets");
          });

          step("Ajouter des noms", async () => {
            await client.projets!.ajouterNomsProjet({
              id: idProjet,
              noms: {
                த: "எழுத்துகள்",
                हिं: "वर्णमाला",
              },
            });
            expect(noms).to.deep.equal({
              fr: "Alphabets",
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            });
          });

          step("Changer un nom", async () => {
            await client.projets!.sauvegarderNomProjet({
              id: idProjet,
              langue: "fr",
              nom: "Systèmes d'écriture",
            });
            expect(noms?.fr).to.equal("Systèmes d'écriture");
          });

          step("Effacer un nom", async () => {
            await client.projets!.effacerNomProjet({
              id: idProjet,
              langue: "fr",
            });
            expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
          });
        });

        describe("Descriptions", function () {
          let descrs: { [key: string]: string };
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.projets!.suivreDescrProjet({
              id: idProjet,
              f: (d) => (descrs = d),
            });
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Aucune description pour commencer", async () => {
            expect(descrs).to.be.empty;
          });

          step("Ajouter une description", async () => {
            await client.projets!.sauvegarderDescrProjet({
              id: idProjet,
              langue: "fr",
              nom: "Alphabets",
            });
            expect(descrs.fr).to.equal("Alphabets");
          });

          step("Ajouter des descriptions", async () => {
            await client.projets!.ajouterDescriptionsProjet({
              id: idProjet,
              descriptions: {
                த: "எழுத்துகள்",
                हिं: "वर्णमाला",
              },
            });
            expect(descrs).to.deep.equal({
              fr: "Alphabets",
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            });
          });

          step("Changer une description", async () => {
            await client.projets!.sauvegarderDescrProjet({
              id: idProjet,
              langue: "fr",
              nom: "Systèmes d'écriture",
            });
            expect(descrs?.fr).to.equal("Systèmes d'écriture");
          });

          step("Effacer une description", async () => {
            await client.projets!.effacerDescrProjet({
              id: idProjet,
              langue: "fr",
            });
            expect(descrs).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
          });
        });

        describe("Mots-clefs", function () {
          let motsClefs: string[];
          let fOublier: schémaFonctionOublier;
          let idMotClef: string;

          before(async () => {
            fOublier = await client.projets!.suivreMotsClefsProjet({
              idProjet: idProjet,
              f: (m) => (motsClefs = m),
            });
          });

          after(async () => {
            if (fOublier) fOublier();
          });
          step("Pas de mots-clefs pour commencer", async () => {
            expect(motsClefs).to.be.an.empty("array");
          });
          step("Ajout d'un mot-clef", async () => {
            idMotClef = await client.motsClefs!.créerMotClef();
            await client.projets!.ajouterMotsClefsProjet({
              idProjet,
              idsMotsClefs: idMotClef,
            });
            expect(motsClefs).to.be.an("array").of.length(1);
          });
          step("Effacer un mot-clef", async () => {
            await client.projets!.effacerMotClefProjet({ idProjet, idMotClef });
            expect(motsClefs).to.be.an.empty("array");
          });
        });

        describe("Statut projet", function () {
          step("À faire");
        });

        describe("BDs", function () {
          let idBd: string;

          let bds: string[];
          let variables: string[];

          const rés: { motsClefs?: string[] } = {};

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            fsOublier.push(
              await client.projets!.suivreBdsProjet({
                id: idProjet,
                f: (b) => (bds = b),
              })
            );
            fsOublier.push(
              await client.projets!.suivreMotsClefsProjet({
                idProjet,
                f: (m) => (rés.motsClefs = m),
              })
            );
            fsOublier.push(
              await client.projets!.suivreVariablesProjet({
                id: idProjet,
                f: (v) => (variables = v),
              })
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          step("Pas de BDs pour commencer", async () => {
            expect(bds).to.be.an.empty("array");
          });

          step("Ajout d'une BD", async () => {
            idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
            await client.projets!.ajouterBdProjet({ idProjet, idBd });
            expect(bds).to.be.an("array").of.length(1);
            expect(bds[0]).to.equal(idBd);
          });

          it("Mots-clefs BD détectés", async () => {
            const idMotClef = await client.motsClefs!.créerMotClef();
            await client.bds!.ajouterMotsClefsBd({
              idBd,
              idsMotsClefs: idMotClef,
            });

            await attendreRésultat(rés, "motsClefs", (x) => x && x.length > 0);

            expect(rés.motsClefs).to.be.an("array").of.length(1);
            expect(rés.motsClefs![0]).to.equal(idMotClef);
          });

          it("Variables BD détectées", async () => {
            expect(variables).to.be.an.empty("array");

            const idVariable = await client.variables!.créerVariable({
              catégorie: "numérique",
            });
            const idTableau = await client.bds!.ajouterTableauBd({ id: idBd });

            await client.tableaux!.ajouterColonneTableau({
              idTableau,
              idVariable,
            });
            expect(variables).to.be.an("array").of.length(1);
            expect(variables[0]).to.equal(idVariable);
          });

          it("Effacer une BD", async () => {
            await client.projets!.effacerBdProjet({ idProjet, idBd });
            expect(bds).to.be.an.empty("array");
          });
        });

        describe("Copier projet", function () {
          let idProjetOrig: string;
          let idProjetCopie: string;

          let idMotClef: string;
          let idBd: string;

          let noms: { [key: string]: string };
          let descrs: { [key: string]: string };

          let motsClefs: string[];
          let bds: string[];

          const réfNoms = {
            த: "மழை",
            हिं: "बारिश",
          };
          const réfDescrs = {
            த: "தினசரி மழை",
            हिं: "दैनिक बारिश",
          };

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            idProjetOrig = await client.projets!.créerProjet();

            await client.projets!.ajouterNomsProjet({
              id: idProjetOrig,
              noms: réfNoms,
            });
            await client.projets!.ajouterDescriptionsProjet({
              id: idProjetOrig,
              descriptions: réfDescrs,
            });

            idMotClef = await client.motsClefs!.créerMotClef();
            await client.projets!.ajouterMotsClefsProjet({
              idProjet: idProjetOrig,
              idsMotsClefs: idMotClef,
            });

            idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
            await client.projets!.ajouterBdProjet({
              idProjet: idProjetOrig,
              idBd,
            });

            idProjetCopie = await client.projets!.copierProjet({
              id: idProjetOrig,
            });

            fsOublier.push(
              await client.projets!.suivreNomsProjet({
                id: idProjetCopie,
                f: (x) => (noms = x),
              })
            );
            fsOublier.push(
              await client.projets!.suivreDescrProjet({
                id: idProjetCopie,
                f: (x) => (descrs = x),
              })
            );
            fsOublier.push(
              await client.projets!.suivreMotsClefsProjet({
                idProjet: idProjetCopie,
                f: (x) => (motsClefs = x),
              })
            );
            fsOublier.push(
              await client.projets!.suivreBdsProjet({
                id: idProjetCopie,
                f: (x) => (bds = x),
              })
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          it("Les noms sont copiés", async () => {
            expect(noms).to.deep.equal(réfNoms);
          });
          it("Les descriptions sont copiées", async () => {
            expect(descrs).to.deep.equal(réfDescrs);
          });
          it("Les mots-clefs sont copiés", async () => {
            expect(motsClefs).to.have.members([idMotClef]);
          });
          it("Les BDs sont copiées", async () => {
            expect(bds).to.be.an("array").of.length(1);
          });
        });

        describe("Exporter données", function () {
          let idProjet: string;
          let docs: { doc: XLSX.WorkBook; nom: string }[];
          let fichiersSFIP: Set<{ cid: string; ext: string }>;
          let nomFichier: string;

          let cid: string;

          const nomTableau1 = "Tableau 1";
          const nomTableau2 = "Tableau 2";

          before(async () => {
            idProjet = await client.projets!.créerProjet();
            const idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
            await client.bds!.ajouterNomsBd({
              id: idBd,
              noms: { fr: "Ma BD" },
            });
            await client.projets!.ajouterBdProjet({ idProjet, idBd });

            const idTableau1 = await client.bds!.ajouterTableauBd({ id: idBd });
            const idTableau2 = await client.bds!.ajouterTableauBd({ id: idBd });

            const idVarNum = await client.variables!.créerVariable({
              catégorie: "numérique",
            });
            const idVarFichier = await client.variables!.créerVariable({
              catégorie: "fichier",
            });
            await client.tableaux!.ajouterColonneTableau({
              idTableau: idTableau1,
              idVariable: idVarNum,
            });
            const idColFichier = await client.tableaux!.ajouterColonneTableau({
              idTableau: idTableau2,
              idVariable: idVarFichier,
            });

            const OCTETS = fs.readFileSync(
              path.resolve(__dirname, "_ressources/logo.svg")
            );
            cid = await client.ajouterÀSFIP({ fichier: OCTETS });

            await client.tableaux!.ajouterÉlément({
              idTableau: idTableau2,
              vals: {
                [idColFichier]: {
                  cid,
                  ext: "svg",
                },
              },
            });

            await client.tableaux!.ajouterNomsTableau({
              idTableau: idTableau1,
              noms: {
                fr: nomTableau1,
              },
            });
            await client.tableaux!.ajouterNomsTableau({
              idTableau: idTableau2,
              noms: {
                fr: nomTableau2,
              },
            });

            ({ docs, fichiersSFIP, nomFichier } =
              await client.projets!.exporterDonnées({
                id: idProjet,
                langues: ["fr"],
              }));
          });

          after(() => {
            rmrf.sync(path.join(__dirname, "_temp"));
          });

          step("Doc créé avec toutes les bds", () => {
            expect(docs).to.be.an("array").with.lengthOf(1);
            expect(docs[0].doc.SheetNames)
              .to.be.an("array")
              .with.members([nomTableau1, nomTableau2]);
            expect(docs[0].nom).to.equal("Ma BD");
          });

          step("Fichiers SFIP retrouvés de tous les tableaux", () => {
            expect(fichiersSFIP.size).equal(1);
            expect(fichiersSFIP).to.have.deep.keys([{ cid, ext: "svg" }]);
          });

          describe("Exporter document projet", async () => {
            const dirZip = path.join(__dirname, "_temp/testExporterProjet");
            const fichierExtrait = path.join(
              __dirname,
              "_temp/testExporterProjetExtrait"
            );

            let nomZip: string;

            before(async () => {
              await client.projets!.exporterDocumentDonnées({
                données: { docs, fichiersSFIP, nomFichier },
                formatDoc: "ods",
                dir: dirZip,
                inclureFichiersSFIP: true,
              });
              nomZip = path.join(dirZip, nomFichier + ".zip");
            });

            step("Le fichier zip existe", () => {
              expect(fs.existsSync(nomZip)).to.be.true;
              const zip = new AdmZip(nomZip);
              zip.extractAllTo(fichierExtrait, true);
              expect(fs.existsSync(fichierExtrait)).to.be.true;
            });

            it("Les données sont exportées", () => {
              expect(fs.existsSync(path.join(fichierExtrait, "Ma BD.ods"))).to
                .be.true;
            });

            step("Le dossier pour les données SFIP existe", () => {
              expect(fs.existsSync(path.join(fichierExtrait, "sfip"))).to.be
                .true;
            });

            step("Les fichiers SFIP existent", () => {
              expect(
                fs.existsSync(path.join(fichierExtrait, "sfip", cid + ".svg"))
              ).to.be.true;
            });
          });
        });
      });
    });
  });
});
