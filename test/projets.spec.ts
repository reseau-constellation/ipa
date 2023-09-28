import type XLSX from "xlsx";
import JSZip from "jszip";
import { isElectronMain, isNode } from "wherearewe";

import { générerClient, type ClientConstellation } from "@/index.js";
import { schémaFonctionOublier } from "@/types.js";
import { isValidAddress } from "@orbitdb/core";

import {
  attente,
  client as utilsClientTest,
  attente as utilsTestAttente,
  dossiers as utilsTestDossiers,
} from "@constl/utils-tests";
const { générerClients } = utilsClientTest;
import { typesClients } from "./ressources/utils.js";

const { dossierTempoTests, obtDirTempoPourTest } = utilsTestDossiers;

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
        ({ fOublier: fOublierClients, clients } = await générerClients({
          n: 1,
          type,
          générerClient,
        }));
        client = clients[0];
      });

      after(async () => {
        if (fOublierClients) await fOublierClients();
      });

      it("Création", async () => {
        idProjet = await client.projets!.créerProjet();
        expect(isValidAddress(idProjet)).to.be.true();
      });

      describe("Mes projets", function () {
        let idNouveauProjet: string;
        let fOublier: schémaFonctionOublier;
        
        const mesProjets = new attente.AttendreRésultat<string[]>();
        before(async () => {
          idNouveauProjet = await client.projets!.créerProjet();
          fOublier = await client.projets!.suivreProjets({
            f: (ps) => mesProjets.mettreÀJour(ps),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
          mesProjets.toutAnnuler();
        });

        it("Le projet est déjà ajouté", async () => {
          const val = await mesProjets.attendreQue(x=>x.includes(idNouveauProjet))
          expect(val).to.contain(idNouveauProjet);
        });

        it("Enlever de mes projets", async () => {
          await client.projets!.enleverDeMesProjets({
            idProjet: idNouveauProjet,
          });
          const val = await mesProjets.attendreQue(x=>!x.includes(idNouveauProjet))
          expect(val).not.to.contain(idNouveauProjet);
        });

        it("Ajouter à mes projets", async () => {
          await client.projets!.ajouterÀMesProjets({
            idProjet: idNouveauProjet,
          });
          const val = await mesProjets.attendreQue(x=>x.includes(idNouveauProjet))
          expect(val).to.contain(idNouveauProjet);
        });

        it("On peut aussi l'effacer", async () => {
          await client.projets!.effacerProjet({ idProjet: idNouveauProjet });

          const val = await mesProjets.attendreQue(x=>!x.includes(idNouveauProjet))
          expect(val).not.to.contain(idNouveauProjet);
        });
      });

      describe("Noms", function () {
        let fOublier: schémaFonctionOublier;
        
        const noms = new attente.AttendreRésultat<{ [key: string]: string }>();
        before(async () => {
          fOublier = await client.projets!.suivreNomsProjet({
            idProjet,
            f: (n) => (noms.mettreÀJour(n)),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Pas de noms pour commencer", async () => {
          const val = await noms.attendreExiste();
          expect(Object.keys(val).length).to.equal(0);
        });

        it("Ajouter un nom", async () => {
          await client.projets!.sauvegarderNomProjet({
            idProjet,
            langue: "fr",
            nom: "Alphabets",
          });
          const val = await noms.attendreQue(x=>!!x["fr"])
          expect(val.fr).to.equal("Alphabets");
        });

        it("Ajouter des noms", async () => {
          await client.projets!.sauvegarderNomsProjet({
            idProjet,
            noms: {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            },
          });
          const val = await noms.attendreQue(x=>Object.keys(x).length > 2)
          expect(val).to.deep.equal({
            fr: "Alphabets",
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          });
        });

        it("Changer un nom", async () => {
          await client.projets!.sauvegarderNomProjet({
            idProjet,
            langue: "fr",
            nom: "Systèmes d'écriture",
          });
          const val = await noms.attendreQue(x=>x.fr !== "Alphabets")
          expect(val.fr).to.equal("Systèmes d'écriture");
        });

        it("Effacer un nom", async () => {
          await client.projets!.effacerNomProjet({
            idProjet,
            langue: "fr",
          });
          const val = await noms.attendreQue(x=>!x["fr"]);
          expect(val).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe("Descriptions", function () {
        let fOublier: schémaFonctionOublier;
        
        const descrs = new attente.AttendreRésultat<{ [key: string]: string }>();
        before(async () => {
          fOublier = await client.projets!.suivreDescriptionsProjet({
            idProjet,
            f: (d) => (descrs.mettreÀJour(d)),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Aucune description pour commencer", async () => {
          const vals = await descrs.attendreExiste();
          expect(Object.keys(vals).length).to.equal(0);
        });

        it("Ajouter une description", async () => {
          await client.projets!.sauvegarderDescriptionProjet({
            idProjet,
            langue: "fr",
            description: "Alphabets",
          });
          const val = await descrs.attendreQue(x=>!!x["fr"])
          expect(val.fr).to.equal("Alphabets");
        });

        it("Ajouter des descriptions", async () => {
          await client.projets!.sauvegarderDescriptionsProjet({
            idProjet,
            descriptions: {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            },
          });
          const val = await descrs.attendreQue(x=>Object.keys(x).length > 2)
          expect(val).to.deep.equal({
            fr: "Alphabets",
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          });
        });

        it("Changer une description", async () => {
          await client.projets!.sauvegarderDescriptionProjet({
            idProjet,
            langue: "fr",
            description: "Systèmes d'écriture",
          });
          const val = await descrs.attendreQue(x=>x.fr !== "Alphabets")
          expect(val.fr).to.equal("Systèmes d'écriture");
        });

        it("Effacer une description", async () => {
          await client.projets!.effacerDescriptionProjet({
            idProjet,
            langue: "fr",
          });
          const val = await descrs.attendreQue(x=>!x["fr"]);
          expect(val).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe("Mots-clefs", function () {
        let fOublier: schémaFonctionOublier;
        let idMotClef: string;
        
        const motsClefs = new attente.AttendreRésultat<{ source: "projet" | "bds"; idMotClef: string }[]>();
        before(async () => {
          fOublier = await client.projets!.suivreMotsClefsProjet({
            idProjet: idProjet,
            f: (m) => (motsClefs.mettreÀJour(m)),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });
        it("Pas de mots-clefs pour commencer", async () => {
          const val = await motsClefs.attendreExiste();
          expect(val).to.be.an.empty("array");
        });
        it("Ajout d'un mot-clef", async () => {
          idMotClef = await client.motsClefs!.créerMotClef();
          await client.projets!.ajouterMotsClefsProjet({
            idProjet,
            idsMotsClefs: idMotClef,
          });
          const val = await motsClefs.attendreQue(x=>x.length > 0)
          expect(val).to.be.an('array').with.lengthOf(1);
        });
        it("Effacer un mot-clef", async () => {
          await client.projets!.effacerMotClefProjet({ idProjet, idMotClef });

          const val = await motsClefs.attendreQue(x=>x.length === 0)
          expect(val).to.be.an.empty("array");
        });
      });

      describe("Statut projet", function () {
        it.skip("À faire");
      });

      describe("BDs", function () {
        let idBd: string;

        const bds = new attente.AttendreRésultat<string[]>();
        const variables = new attente.AttendreRésultat<string[]>();

        const motsClefs = new utilsTestAttente.AttendreRésultat<
          { source: "projet" | "bds"; idMotClef: string }[]
        >();

        const fsOublier: schémaFonctionOublier[] = [];

        before(async () => {
          fsOublier.push(
            await client.projets!.suivreBdsProjet({
              idProjet,
              f: (b) => (bds.mettreÀJour(b)),
            }),
          );
          fsOublier.push(
            await client.projets!.suivreMotsClefsProjet({
              idProjet,
              f: (m) => motsClefs.mettreÀJour(m),
            }),
          );
          fsOublier.push(
            await client.projets!.suivreVariablesProjet({
              idProjet,
              f: (v) => (variables.mettreÀJour(v)),
            }),
          );
        });

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          variables.toutAnnuler();
          bds.toutAnnuler();
          motsClefs.toutAnnuler();
        });

        it("Pas de BDs pour commencer", async () => {
          const val = await bds.attendreExiste();
          expect(val).to.be.an.empty("array");
        });

        it("Ajout d'une BD", async () => {
          idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
          await client.projets!.ajouterBdProjet({ idProjet, idBd });

          const val = await bds.attendreQue(x=>x.length > 0)
          expect(Array.isArray(val)).to.be.true();
          expect(val.length).to.equal(1);
          expect(val[0]).to.equal(idBd);
        });

        it("Mots-clefs BD détectés", async () => {
          const idMotClef = await client.motsClefs!.créerMotClef();
          await client.bds.ajouterMotsClefsBd({
            idBd,
            idsMotsClefs: idMotClef,
          });

          const val = await motsClefs.attendreQue((x) => !!x && x.length > 0);
          expect(val).to.have.deep.members([{ source: "bds", idMotClef }]);
        });

        it("Variables BD détectées", async () => {
          let val = await variables.attendreExiste()
          expect(val).to.be.an.empty("array");

          const idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          const idTableau = await client.bds.ajouterTableauBd({ idBd });

          await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable,
          });

          val = await variables.attendreQue(x=>x.length > 0)
          expect(Array.isArray(val)).to.be.true();
          expect(val.length).to.equal(1);
          expect(val[0]).to.equal(idVariable);
        });

        it("Effacer une BD", async () => {
          await client.projets!.effacerBdProjet({ idProjet, idBd });

          const val = await bds.attendreQue(x=>!x.length);
          expect(val).to.be.an.empty("array");
        });
      });

      describe("Copier projet", function () {
        let idProjetOrig: string;
        let idProjetCopie: string;

        let idMotClef: string;
        let idBd: string;

        const noms = new attente.AttendreRésultat<{ [key: string]: string }>();
        const descrs = new attente.AttendreRésultat<{ [key: string]: string }>();
        const motsClefs = new attente.AttendreRésultat<{ source: "projet" | "bds"; idMotClef: string }[]>();
        const bds = new attente.AttendreRésultat<string[]>();

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

          await client.projets!.sauvegarderNomsProjet({
            idProjet: idProjetOrig,
            noms: réfNoms,
          });
          await client.projets!.sauvegarderDescriptionsProjet({
            idProjet: idProjetOrig,
            descriptions: réfDescrs,
          });

          idMotClef = await client.motsClefs!.créerMotClef();
          await client.projets!.ajouterMotsClefsProjet({
            idProjet: idProjetOrig,
            idsMotsClefs: idMotClef,
          });

          idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
          await client.projets!.ajouterBdProjet({
            idProjet: idProjetOrig,
            idBd,
          });

          idProjetCopie = await client.projets!.copierProjet({
            idProjet: idProjetOrig,
          });

          fsOublier.push(
            await client.projets!.suivreNomsProjet({
              idProjet: idProjetCopie,
              f: (x) => (noms.mettreÀJour(x)),
            }),
          );
          fsOublier.push(
            await client.projets!.suivreDescriptionsProjet({
              idProjet: idProjetCopie,
              f: (x) => (descrs.mettreÀJour(x)),
            }),
          );
          fsOublier.push(
            await client.projets!.suivreMotsClefsProjet({
              idProjet: idProjetCopie,
              f: (x) => (motsClefs.mettreÀJour(x)),
            }),
          );
          fsOublier.push(
            await client.projets!.suivreBdsProjet({
              idProjet: idProjetCopie,
              f: (x) => (bds.mettreÀJour(x)),
            }),
          );
        });

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          noms.toutAnnuler();
          descrs.toutAnnuler();
          motsClefs.toutAnnuler();
          bds.toutAnnuler();
        });

        it("Les noms sont copiés", async () => {
          const val = await noms.attendreExiste();
          expect(val).to.deep.equal(réfNoms);
        });
        it("Les descriptions sont copiées", async () => {
          const val = await descrs.attendreExiste()
          expect(val).to.deep.equal(réfDescrs);
        });
        it("Les mots-clefs sont copiés", async () => {
          const val = await motsClefs.attendreExiste()
          expect(val).to.have.deep.members([
            { source: "projet", idMotClef },
          ]);
        });
        it("Les BDs sont copiées", async () => {
          const val = await bds.attendreQue(x=>x.length > 0)
          expect(Array.isArray(val)).to.be.true();
          expect(val.length).to.equal(1);
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
          const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
          await client.bds.sauvegarderNomsBd({
            idBd,
            noms: { fr: "Ma BD" },
          });
          await client.projets!.ajouterBdProjet({ idProjet, idBd });

          const idTableau1 = await client.bds.ajouterTableauBd({ idBd });
          const idTableau2 = await client.bds.ajouterTableauBd({ idBd });

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

          const OCTETS = await obtRessourceTest({
            nomFichier: "logo.svg",
            optsAxios: { responseType: "arraybuffer" },
          });
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

          await client.tableaux!.sauvegarderNomsTableau({
            idTableau: idTableau1,
            noms: {
              fr: nomTableau1,
            },
          });
          await client.tableaux!.sauvegarderNomsTableau({
            idTableau: idTableau2,
            noms: {
              fr: nomTableau2,
            },
          });

          ({ docs, fichiersSFIP, nomFichier } =
            await client.projets!.exporterDonnées({
              idProjet,
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
