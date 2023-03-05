import isArray from "lodash/isArray";

import type XLSX from "xlsx";
import fs from "fs";
import path from "path";
import rmrf from "rimraf";
import AdmZip from "adm-zip";

import type { default as ClientConstellation } from "@/client.js";
import { schémaFonctionOublier, adresseOrbiteValide } from "@/utils/index.js";

import { générerClients, typesClients } from "@/utilsTests/client.js";
import { AttendreRésultat } from "@/utilsTests/attente.js";
import {
  obtDirTempoPourTest,
  dossierRessourcesTests,
} from "@/utilsTests/dossiers.js";
import { config } from "@/utilsTests/sfip.js";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Projets", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      let idProjet: string;

      beforeAll(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        client = clients[0];
      }, config.patienceInit);

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      test("Création", async () => {
        idProjet = await client.projets!.créerProjet();
        expect(adresseOrbiteValide(idProjet)).toBe(true);
      });

      describe("Mes projets", function () {
        let idNouveauProjet: string;
        let mesProjets: string[] = [];
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          idNouveauProjet = await client.projets!.créerProjet();
          fOublier = await client.projets!.suivreProjets({
            f: (ps) => (mesProjets = ps),
          });
        }, config.patience);

        afterAll(async () => {
          if (fOublier) await fOublier();
        });

        test("Le projet est déjà ajouté", async () => {
          expect(mesProjets).toEqual(expect.arrayContaining([idNouveauProjet]));
        });

        test("Enlever de mes projets", async () => {
          await client.projets!.enleverDeMesProjets({
            idProjet: idNouveauProjet,
          });
          expect(mesProjets).not.toEqual(
            expect.arrayContaining([idNouveauProjet])
          );
        });

        test("Ajouter à mes projets", async () => {
          await client.projets!.ajouterÀMesProjets({
            idProjet: idNouveauProjet,
          });
          expect(mesProjets).toEqual(expect.arrayContaining([idNouveauProjet]));
        });

        test("On peut aussi l'effacer", async () => {
          await client.projets!.effacerProjet({ id: idNouveauProjet });
          expect(mesProjets).not.toEqual(
            expect.arrayContaining([idNouveauProjet])
          );
        });
      });

      describe("Noms", function () {
        let noms: { [key: string]: string };
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.projets!.suivreNomsProjet({
            id: idProjet,
            f: (n) => (noms = n),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
        });

        test("Pas de noms pour commencer", async () => {
          expect(Object.keys(noms)).toHaveLength(0);
        });

        test("Ajouter un nom", async () => {
          await client.projets!.sauvegarderNomProjet({
            id: idProjet,
            langue: "fr",
            nom: "Alphabets",
          });
          expect(noms.fr).toEqual("Alphabets");
        });

        test("Ajouter des noms", async () => {
          await client.projets!.ajouterNomsProjet({
            id: idProjet,
            noms: {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            },
          });
          expect(noms).toEqual({
            fr: "Alphabets",
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          });
        });

        test("Changer un nom", async () => {
          await client.projets!.sauvegarderNomProjet({
            id: idProjet,
            langue: "fr",
            nom: "Systèmes d'écriture",
          });
          expect(noms?.fr).toEqual("Systèmes d'écriture");
        });

        test("Effacer un nom", async () => {
          await client.projets!.effacerNomProjet({
            id: idProjet,
            langue: "fr",
          });
          expect(noms).toEqual({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe("Descriptions", function () {
        let descrs: { [key: string]: string };
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.projets!.suivreDescrProjet({
            id: idProjet,
            f: (d) => (descrs = d),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
        });

        test("Aucune description pour commencer", async () => {
          expect(Object.keys(descrs)).toHaveLength(0);
        });

        test("Ajouter une description", async () => {
          await client.projets!.sauvegarderDescrProjet({
            id: idProjet,
            langue: "fr",
            nom: "Alphabets",
          });
          expect(descrs.fr).toEqual("Alphabets");
        });

        test("Ajouter des descriptions", async () => {
          await client.projets!.ajouterDescriptionsProjet({
            id: idProjet,
            descriptions: {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            },
          });
          expect(descrs).toEqual({
            fr: "Alphabets",
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          });
        });

        test("Changer une description", async () => {
          await client.projets!.sauvegarderDescrProjet({
            id: idProjet,
            langue: "fr",
            nom: "Systèmes d'écriture",
          });
          expect(descrs?.fr).toEqual("Systèmes d'écriture");
        });

        test("Effacer une description", async () => {
          await client.projets!.effacerDescrProjet({
            id: idProjet,
            langue: "fr",
          });
          expect(descrs).toEqual({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe("Mots-clefs", function () {
        let motsClefs: string[];
        let fOublier: schémaFonctionOublier;
        let idMotClef: string;

        beforeAll(async () => {
          fOublier = await client.projets!.suivreMotsClefsProjet({
            idProjet: idProjet,
            f: (m) => (motsClefs = m),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
        });
        test("Pas de mots-clefs pour commencer", async () => {
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(0);
        });
        test("Ajout d'un mot-clef", async () => {
          idMotClef = await client.motsClefs!.créerMotClef();
          await client.projets!.ajouterMotsClefsProjet({
            idProjet,
            idsMotsClefs: idMotClef,
          });
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(1);
        });
        test("Effacer un mot-clef", async () => {
          await client.projets!.effacerMotClefProjet({ idProjet, idMotClef });
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(0);
        });
      });

      describe("Statut projet", function () {
        test.todo("À faire");
      });

      describe("BDs", function () {
        let idBd: string;

        let bds: string[];
        let variables: string[];

        const rés = new AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client.projets!.suivreBdsProjet({
              id: idProjet,
              f: (b) => (bds = b),
            })
          );
          fsOublier.push(
            await client.projets!.suivreMotsClefsProjet({
              idProjet,
              f: (m) => rés.mettreÀJour(m),
            })
          );
          fsOublier.push(
            await client.projets!.suivreVariablesProjet({
              id: idProjet,
              f: (v) => (variables = v),
            })
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          rés.toutAnnuler();
        });

        test("Pas de BDs pour commencer", async () => {
          expect(isArray(bds)).toBe(true);
          expect(bds).toHaveLength(0);
        });

        test("Ajout d'une BD", async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          await client.projets!.ajouterBdProjet({ idProjet, idBd });
          expect(isArray(bds)).toBe(true);
          expect(bds).toHaveLength(1);
          expect(bds[0]).toEqual(idBd);
        });

        test("Mots-clefs BD détectés", async () => {
          const idMotClef = await client.motsClefs!.créerMotClef();
          await client.bds!.ajouterMotsClefsBd({
            idBd,
            idsMotsClefs: idMotClef,
          });

          const val = await rés.attendreQue((x) => !!x && x.length > 0);
          expect(val).toEqual(expect.arrayContaining([idMotClef]));
        });

        test("Variables BD détectées", async () => {
          expect(isArray(variables)).toBe(true);
          expect(variables).toHaveLength(0);

          const idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          const idTableau = await client.bds!.ajouterTableauBd({ idBd });

          await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable,
          });
          expect(isArray(variables)).toBe(true);
          expect(variables).toHaveLength(1);
          expect(variables[0]).toEqual(idVariable);
        });

        test("Effacer une BD", async () => {
          await client.projets!.effacerBdProjet({ idProjet, idBd });
          expect(isArray(bds)).toBe(true);
          expect(bds).toHaveLength(0);
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

        beforeAll(async () => {
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
        }, config.patience);

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        test("Les noms sont copiés", async () => {
          expect(noms).toEqual(réfNoms);
        });
        test("Les descriptions sont copiées", async () => {
          expect(descrs).toEqual(réfDescrs);
        });
        test("Les mots-clefs sont copiés", async () => {
          expect(motsClefs).toEqual(expect.arrayContaining([idMotClef]));
        });
        test("Les BDs sont copiées", async () => {
          expect(isArray(bds)).toBe(true);
          expect(bds).toHaveLength(1);
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

        beforeAll(async () => {
          idProjet = await client.projets!.créerProjet();
          const idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          await client.bds!.ajouterNomsBd({
            id: idBd,
            noms: { fr: "Ma BD" },
          });
          await client.projets!.ajouterBdProjet({ idProjet, idBd });

          const idTableau1 = await client.bds!.ajouterTableauBd({ idBd });
          const idTableau2 = await client.bds!.ajouterTableauBd({ idBd });

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
            path.join(await dossierRessourcesTests(), "logo.svg")
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
        }, config.patience);

        test("Doc créé avec toutes les bds", () => {
          expect(isArray(docs)).toBe(true);
          expect(docs).toHaveLength(1);
          expect(isArray(docs[0].doc.SheetNames)).toBe(true);
          expect(docs[0].doc.SheetNames).toEqual(
            expect.arrayContaining([nomTableau1, nomTableau2])
          );
          expect(docs[0].nom).toEqual("Ma BD");
        });

        test("Fichiers SFIP retrouvés de tous les tableaux", () => {
          expect(fichiersSFIP.size).toEqual(1);
          expect(fichiersSFIP).toContainEqual({ cid, ext: "svg" });
        });

        describe("Exporter document projet", function () {
          let dossierZip: string;
          let fEffacerDossierZip: () => void;
          let dossierFichierExtrait: string;
          let fEffacerFichierExtrait: () => void;
          let nomZip: string;

          beforeAll(async () => {
            ({ dossier: dossierZip, fEffacer: fEffacerDossierZip } =
              await obtDirTempoPourTest("testExporterProjet"));
            ({
              dossier: dossierFichierExtrait,
              fEffacer: fEffacerFichierExtrait,
            } = await obtDirTempoPourTest("testExporterProjetExtrait"));

            await client.projets!.exporterDocumentDonnées({
              données: { docs, fichiersSFIP, nomFichier },
              formatDoc: "ods",
              dossier: dossierZip,
              inclureFichiersSFIP: true,
            });
            nomZip = path.join(dossierZip, nomFichier + ".zip");
          }, config.patience);

          afterAll(() => {
            if (fEffacerDossierZip) fEffacerDossierZip();
            if (fEffacerFichierExtrait) fEffacerFichierExtrait();
            rmrf.sync(dossierZip);
            rmrf.sync(dossierFichierExtrait);
          });

          test("Le fichier zip existe", () => {
            expect(fs.existsSync(nomZip)).toBe(true);
            const zip = new AdmZip(nomZip);
            zip.extractAllTo(dossierFichierExtrait, true);
            expect(fs.existsSync(dossierFichierExtrait)).toBe(true);
          });

          test("Les données sont exportées", () => {
            expect(
              fs.existsSync(path.join(dossierFichierExtrait, "Ma BD.ods"))
            ).toBe(true);
          });

          test("Le dossier pour les données SFIP existe", () => {
            expect(
              fs.existsSync(path.join(dossierFichierExtrait, "sfip"))
            ).toBe(true);
          });

          test("Les fichiers SFIP existent", () => {
            expect(
              fs.existsSync(
                path.join(dossierFichierExtrait, "sfip", cid + ".svg")
              )
            ).toBe(true);
          });
        });
      });
    });
  });
});
