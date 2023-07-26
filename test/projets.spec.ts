import type XLSX from "xlsx";
import JSZip from "jszip";
import { isElectronMain, isNode } from "wherearewe";

import type { default as ClientConstellation } from "@/client.js";
import { schémaFonctionOublier, adresseOrbiteValide } from "@/utils/index.js";

import { générerClients, typesClients } from "@/utilsTests/client.js";
import { AttendreRésultat } from "@/utilsTests/attente.js";
import {
  obtDirTempoPourTest,
  dossierTempoTests,
} from "@/utilsTests/dossiers.js";
import { obtRessourceTest } from "./ressources/index.js";

import { expect } from "aegir/chai";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Projets", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      let idProjet: string;

      before(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        client = clients[0];
      });

      after(async () => {
        if (fOublierClients) await fOublierClients();
      });

      it("Création", async () => {
        idProjet = await client.projets!.créerProjet();
        expect(adresseOrbiteValide(idProjet)).to.be.true();
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

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Le projet est déjà ajouté", async () => {
          expect(mesProjets).to.contain(idNouveauProjet);
        });

        it("Enlever de mes projets", async () => {
          await client.projets!.enleverDeMesProjets({
            idProjet: idNouveauProjet,
          });
          expect(mesProjets).not.to.contain(idNouveauProjet);
        });

        it("Ajouter à mes projets", async () => {
          await client.projets!.ajouterÀMesProjets({
            idProjet: idNouveauProjet,
          });
          expect(mesProjets).to.contain(idNouveauProjet);
        });

        it("On peut aussi l'effacer", async () => {
          await client.projets!.effacerProjet({ id: idNouveauProjet });
          expect(mesProjets).not.to.contain(idNouveauProjet);
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
          if (fOublier) await fOublier();
        });

        it("Pas de noms pour commencer", async () => {
          expect(Object.keys(noms).length).to.equal(0);
        });

        it("Ajouter un nom", async () => {
          await client.projets!.sauvegarderNomProjet({
            id: idProjet,
            langue: "fr",
            nom: "Alphabets",
          });
          expect(noms.fr).to.equal("Alphabets");
        });

        it("Ajouter des noms", async () => {
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

        it("Changer un nom", async () => {
          await client.projets!.sauvegarderNomProjet({
            id: idProjet,
            langue: "fr",
            nom: "Systèmes d'écriture",
          });
          expect(noms?.fr).to.equal("Systèmes d'écriture");
        });

        it("Effacer un nom", async () => {
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
          if (fOublier) await fOublier();
        });

        it("Aucune description pour commencer", async () => {
          expect(Object.keys(descrs).length).to.equal(0);
        });

        it("Ajouter une description", async () => {
          await client.projets!.sauvegarderDescrProjet({
            id: idProjet,
            langue: "fr",
            nom: "Alphabets",
          });
          expect(descrs.fr).to.equal("Alphabets");
        });

        it("Ajouter des descriptions", async () => {
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

        it("Changer une description", async () => {
          await client.projets!.sauvegarderDescrProjet({
            id: idProjet,
            langue: "fr",
            nom: "Systèmes d'écriture",
          });
          expect(descrs?.fr).to.equal("Systèmes d'écriture");
        });

        it("Effacer une description", async () => {
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
          if (fOublier) await fOublier();
        });
        it("Pas de mots-clefs pour commencer", async () => {
          expect(Array.isArray(motsClefs)).to.be.true();
          expect(motsClefs.length).to.equal(0);
        });
        it("Ajout d'un mot-clef", async () => {
          idMotClef = await client.motsClefs!.créerMotClef();
          await client.projets!.ajouterMotsClefsProjet({
            idProjet,
            idsMotsClefs: idMotClef,
          });
          expect(Array.isArray(motsClefs)).to.be.true();
          expect(motsClefs.length).to.equal(1);
        });
        it("Effacer un mot-clef", async () => {
          await client.projets!.effacerMotClefProjet({ idProjet, idMotClef });
          expect(Array.isArray(motsClefs)).to.be.true();
          expect(motsClefs.length).to.equal(0);
        });
      });

      describe("Statut projet", function () {
        it.skip("À faire");
      });

      describe("BDs", function () {
        let idBd: string;

        let bds: string[];
        let variables: string[];

        const rés = new AttendreRésultat<string[]>();

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

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          rés.toutAnnuler();
        });

        it("Pas de BDs pour commencer", async () => {
          expect(Array.isArray(bds)).to.be.true();
          expect(bds.length).to.equal(0);
        });

        it("Ajout d'une BD", async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          await client.projets!.ajouterBdProjet({ idProjet, idBd });
          expect(Array.isArray(bds)).to.be.true();
          expect(bds.length).to.equal(1);
          expect(bds[0]).to.equal(idBd);
        });

        it("Mots-clefs BD détectés", async () => {
          const idMotClef = await client.motsClefs!.créerMotClef();
          await client.bds!.ajouterMotsClefsBd({
            idBd,
            idsMotsClefs: idMotClef,
          });

          const val = await rés.attendreQue((x) => !!x && x.length > 0);
          expect(val).to.have.members([idMotClef]);
        });

        it("Variables BD détectées", async () => {
          expect(Array.isArray(variables)).to.be.true();
          expect(variables.length).to.equal(0);

          const idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          const idTableau = await client.bds!.ajouterTableauBd({ idBd });

          await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable,
          });
          expect(Array.isArray(variables)).to.be.true();
          expect(variables.length).to.equal(1);
          expect(variables[0]).to.equal(idVariable);
        });

        it("Effacer une BD", async () => {
          await client.projets!.effacerBdProjet({ idProjet, idBd });
          expect(Array.isArray(bds)).to.be.true();
          expect(bds.length).to.equal(0);
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
          await Promise.all(fsOublier.map((f) => f()));
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
          expect(Array.isArray(bds)).to.be.true();
          expect(bds.length).to.equal(1);
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

          const OCTETS = await obtRessourceTest({nomFichier: "logo.svg", optsAxios: { responseType: "arraybuffer" }});
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

        it("Doc créé avec toutes les bds", () => {
          expect(Array.isArray(docs)).to.be.true();
          expect(docs.length).to.equal(1);
          expect(Array.isArray(docs[0].doc.SheetNames)).to.be.true();
          expect(docs[0].doc.SheetNames).to.have.members([
            nomTableau1,
            nomTableau2,
          ]);
          expect(docs[0].nom).to.equal("Ma BD");
        });

        it("Fichiers SFIP retrouvés de tous les tableaux", () => {
          expect(fichiersSFIP.size).to.equal(1);
          expect([...fichiersSFIP]).to.have.deep.members([{ cid, ext: "svg" }]);
        });

        if (isElectronMain || isNode) {
          describe("Exporter document projet", function () {

            let dossierBase: string;
            let dossierZip: string;
            let fEffacer: () => void;
  
            let nomZip: string;
            let zip: JSZip;
  
            before(async () => {
              const path = await import("path");

              ({ dossier: dossierBase, fEffacer } = await dossierTempoTests());
              dossierZip = await obtDirTempoPourTest({
                base: dossierBase,
                nom: "testExporterProjet",
              });
  
              await client.projets!.exporterDocumentDonnées({
                données: { docs, fichiersSFIP, nomFichier },
                formatDoc: "ods",
                dossier: dossierZip,
                inclureFichiersSFIP: true,
              });
              nomZip = path.join(dossierZip, nomFichier + ".zip");
            });
  
            after(() => {
              if (fEffacer) fEffacer();
            });
  
            it("Le fichier zip existe", async () => {
              const fs = await import("fs");
              expect(fs.existsSync(nomZip)).to.be.true();
              zip = await JSZip.loadAsync(fs.readFileSync(nomZip));
            });
  
            it("Les données sont exportées", async () => {
              const contenu = zip.files["Ma BD.ods"];
              expect(contenu).to.exist();
            });
  
            it("Le dossier pour les données SFIP existe", () => {
              const contenu = zip.files["sfip/"];
              expect(contenu?.dir).to.be.true();
            });
  
            it("Les fichiers SFIP existent", async () => {
              const path = await import("path");
              const contenu = zip.files[path.join("sfip", cid + ".svg")];
              expect(contenu).to.exist();
            });
          });
        }
      });
    });
  });
});
