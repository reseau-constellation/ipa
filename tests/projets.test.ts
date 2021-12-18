import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";

import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import rmrf from "rimraf";
import AdmZip from "adm-zip";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation, {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  adresseOrbiteValide,
  uneFois,
} from "@/client";
import { infoAuteur } from "@/bds";
import { MODÉRATEUR, MEMBRE } from "@/accès/consts";

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
        let client2: ClientConstellation;

        let idBdRacine1: string;
        let idBdRacine2: string;

        let idProjet: string;

        before(async () => {
          enregistrerContrôleurs();
          ({ fOublier: fOublierClients, clients } = await générerClients(
            2,
            API,
            type
          ));
          client = clients[0];
          client2 = clients[1];

          idBdRacine1 = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string>
            ): Promise<schémaFonctionOublier> => {
              return await client.suivreIdBdRacine(fSuivi);
            }
          );
          idBdRacine2 = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string>
            ): Promise<schémaFonctionOublier> => {
              return await client2.suivreIdBdRacine(fSuivi);
            }
          );
        });

        after(async () => {
          if (fOublierClients) await fOublierClients();
        });

        step("Création", async () => {
          idProjet = await client.projets!.créerProjet();
          expect(adresseOrbiteValide(idProjet)).to.be.true;
        });

        describe("Mes projets", async () => {
          let fOublier: schémaFonctionOublier;
          let projets: string[];
          let idNouveauProjet: string;

          before(async () => {
            fOublier = await client.projets!.suivreProjetsMembre(
              (prjs) => (projets = prjs)
            );
          });
          after(async () => {
            if (fOublier) fOublier();
          });
          step("Le projet déjà créé est présent", async () => {
            expect(projets).to.be.an("array").with.lengthOf(1);
            expect(projets[0]).to.equal(idProjet);
          });
          step("On crée un autre projet", async () => {
            idNouveauProjet = await client.projets!.créerProjet();
            expect(projets).to.be.an("array").with.lengthOf(2);
            expect(projets).to.include.members([idNouveauProjet, idProjet]);
          });
          step("On peut aussi l'effacer", async () => {
            await client.projets!.effacerProjet(idNouveauProjet);
            expect(projets).to.be.an("array").with.lengthOf(1);
            expect(projets[0]).to.equal(idProjet);
          });
        });

        describe("Noms", function () {
          let noms: { [key: string]: string };
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.projets!.suivreNomsProjet(
              idProjet,
              (n) => (noms = n)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Pas de noms pour commencer", async () => {
            expect(noms).to.be.empty;
          });

          step("Ajouter un nom", async () => {
            await client.projets!.sauvegarderNomProjet(
              idProjet,
              "fr",
              "Alphabets"
            );
            expect(noms.fr).to.equal("Alphabets");
          });

          step("Ajouter des noms", async () => {
            await client.projets!.ajouterNomsProjet(idProjet, {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            });
            expect(noms).to.deep.equal({
              fr: "Alphabets",
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            });
          });

          step("Changer un nom", async () => {
            await client.projets!.sauvegarderNomProjet(
              idProjet,
              "fr",
              "Systèmes d'écriture"
            );
            expect(noms?.fr).to.equal("Systèmes d'écriture");
          });

          step("Effacer un nom", async () => {
            await client.projets!.effacerNomProjet(idProjet, "fr");
            expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
          });
        });

        describe("Descriptions", function () {
          let descrs: { [key: string]: string };
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.projets!.suivreDescrProjet(
              idProjet,
              (d) => (descrs = d)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Aucune description pour commencer", async () => {
            expect(descrs).to.be.empty;
          });

          step("Ajouter une description", async () => {
            await client.projets!.sauvegarderDescrProjet(
              idProjet,
              "fr",
              "Alphabets"
            );
            expect(descrs.fr).to.equal("Alphabets");
          });

          step("Ajouter des descriptions", async () => {
            await client.projets!.ajouterDescriptionsProjet(idProjet, {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            });
            expect(descrs).to.deep.equal({
              fr: "Alphabets",
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            });
          });

          step("Changer une description", async () => {
            await client.projets!.sauvegarderDescrProjet(
              idProjet,
              "fr",
              "Systèmes d'écriture"
            );
            expect(descrs?.fr).to.equal("Systèmes d'écriture");
          });

          step("Effacer une description", async () => {
            await client.projets!.effacerDescrProjet(idProjet, "fr");
            expect(descrs).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
          });
        });

        describe("Mots-clefs", function () {
          let motsClefs: string[];
          let fOublier: schémaFonctionOublier;
          let idMotClef: string;

          before(async () => {
            fOublier = await client.projets!.suivreMotsClefsProjet(
              idProjet,
              (m) => (motsClefs = m)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });
          step("Pas de mots-clefs pour commencer", async () => {
            expect(motsClefs).to.be.an.empty("array");
          });
          step("Ajout d'un mot-clef", async () => {
            idMotClef = await client.motsClefs!.créerMotClef();
            await client.projets!.ajouterMotsClefsProjet(idProjet, idMotClef);
            expect(motsClefs).to.be.an("array").of.length(1);
          });
          step("Effacer un mot-clef", async () => {
            await client.projets!.effacerMotClefProjet(idProjet, idMotClef);
            expect(motsClefs).to.be.an.empty("array");
          });
        });

        describe("Statut projet", function () {
          step("À faire");
        });

        describe("Auteurs", function () {
          let idProjetAuteurs: string;
          const rés: { ultat?: infoAuteur[] } = {};

          let fOublier: schémaFonctionOublier;

          before(async () => {
            idProjetAuteurs = await client.projets!.créerProjet();
            fOublier = await client.projets!.suivreAuteurs(
              idProjetAuteurs,
              (a) => (rés.ultat = a)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Juste moi pour commencer", async () => {
            expect(rés.ultat).to.be.an("array").with.lengthOf(1);
            const moi = rés.ultat![0];
            expect(moi?.accepté).to.be.true;
            expect(moi?.idBdRacine).to.equal(idBdRacine1);
            expect(moi?.rôle).to.equal(MODÉRATEUR);
          });

          step("Inviter un membre", async () => {
            await client.projets!.inviterAuteur(
              idProjetAuteurs,
              idBdRacine2,
              MEMBRE
            );
            await attendreRésultat(
              rés,
              "ultat",
              (x: infoAuteur[]) => x && x.length === 2
            );

            expect(rés.ultat).to.be.an("array").with.lengthOf(2);

            const nouvelAuteur = rés.ultat?.find(
              (x) => x.idBdRacine === idBdRacine2
            );
            expect(nouvelAuteur).to.exist;
            expect(nouvelAuteur?.accepté).to.be.false;
            expect(nouvelAuteur?.rôle).to.equal(MEMBRE);
          });

          step("Accepter une invitation", async () => {
            await client2.projets!.ajouterÀMesProjets(idProjetAuteurs);

            await attendreRésultat(
              rés,
              "ultat",
              (x: infoAuteur[]) => x && x[1]?.accepté
            );

            const nouvelAuteur = rés.ultat?.find(
              (x) => x.idBdRacine === idBdRacine2
            );
            expect(nouvelAuteur?.accepté).to.be.true;
          });

          step("Promotion à modérateur", async () => {
            await client.bds!.inviterAuteur(
              idProjetAuteurs,
              idBdRacine2,
              MODÉRATEUR
            );

            await attendreRésultat(
              rés,
              "ultat",
              (x: infoAuteur[]) => x && x[1]?.rôle === MODÉRATEUR
            );

            const nouvelAuteur = rés.ultat?.find(
              (x) => x.idBdRacine === idBdRacine2
            );
            expect(nouvelAuteur?.accepté).to.be.true; // L'acceptation de l'invitation est toujours valide
            expect(nouvelAuteur?.rôle).to.equal(MODÉRATEUR);
          });
        });

        describe("BDs", function () {
          let idBd: string;

          let bds: string[];
          let variables: string[];

          const rés: { motsClefs?: string[] } = {};

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            fsOublier.push(
              await client.projets!.suivreBdsProjet(idProjet, (b) => (bds = b))
            );
            fsOublier.push(
              await client.projets!.suivreMotsClefsProjet(
                idProjet,
                (m) => (rés.motsClefs = m)
              )
            );
            fsOublier.push(
              await client.projets!.suivreVariablesProjet(
                idProjet,
                (v) => (variables = v)
              )
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          step("Pas de BDs pour commencer", async () => {
            expect(bds).to.be.an.empty("array");
          });

          step("Ajout d'une BD", async () => {
            idBd = await client.bds!.créerBd("ODbl-1_0");
            await client.projets!.ajouterBdProjet(idProjet, idBd);
            expect(bds).to.be.an("array").of.length(1);
            expect(bds[0]).to.equal(idBd);
          });

          it("Mots-clefs BD détectés", async () => {
            const idMotClef = await client.motsClefs!.créerMotClef();
            await client.bds!.ajouterMotsClefsBd(idBd, idMotClef);

            await attendreRésultat(
              rés,
              "motsClefs",
              (x?: string[]) => x && x.length > 0
            );

            expect(rés.motsClefs).to.be.an("array").of.length(1);
            expect(rés.motsClefs![0]).to.equal(idMotClef);
          });

          it("Variables BD détectées", async () => {
            expect(variables).to.be.an.empty("array");

            const idVariable = await client.variables!.créerVariable(
              "numérique"
            );
            const idTableau = await client.bds!.ajouterTableauBd(idBd);

            await client.tableaux!.ajouterColonneTableau(idTableau, idVariable);
            expect(variables).to.be.an("array").of.length(1);
            expect(variables[0]).to.equal(idVariable);
          });

          it("Effacer une BD", async () => {
            await client.projets!.effacerBdProjet(idProjet, idBd);
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

            await client.projets!.ajouterNomsProjet(idProjetOrig, réfNoms);
            await client.projets!.ajouterDescriptionsProjet(
              idProjetOrig,
              réfDescrs
            );

            idMotClef = await client.motsClefs!.créerMotClef();
            await client.projets!.ajouterMotsClefsProjet(
              idProjetOrig,
              idMotClef
            );

            idBd = await client.bds!.créerBd("ODbl-1_0");
            await client.projets!.ajouterBdProjet(idProjetOrig, idBd);

            idProjetCopie = await client.projets!.copierProjet(idProjetOrig);

            fsOublier.push(
              await client.projets!.suivreNomsProjet(
                idProjetCopie,
                (x) => (noms = x)
              )
            );
            fsOublier.push(
              await client.projets!.suivreDescrProjet(
                idProjetCopie,
                (x) => (descrs = x)
              )
            );
            fsOublier.push(
              await client.projets!.suivreMotsClefsProjet(
                idProjetCopie,
                (x) => (motsClefs = x)
              )
            );
            fsOublier.push(
              await client.projets!.suivreBdsProjet(
                idProjetCopie,
                (x) => (bds = x)
              )
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
            const idBd = await client.bds!.créerBd("ODbl-1_0");
            await client.bds!.ajouterNomsBd(idBd, { fr: "Ma BD" });
            await client.projets!.ajouterBdProjet(idProjet, idBd);

            const idTableau1 = await client.bds!.ajouterTableauBd(idBd);
            const idTableau2 = await client.bds!.ajouterTableauBd(idBd);

            const idVarNum = await client.variables!.créerVariable("numérique");
            const idVarFichier = await client.variables!.créerVariable(
              "fichier"
            );
            await client.tableaux!.ajouterColonneTableau(idTableau1, idVarNum);
            const idColFichier = await client.tableaux!.ajouterColonneTableau(
              idTableau2,
              idVarFichier
            );

            const OCTETS = fs.readFileSync(
              path.resolve(__dirname, "_ressources/logo.svg")
            );
            cid = await client.ajouterÀSFIP(OCTETS);

            await client.tableaux!.ajouterÉlément(idTableau2, {
              [idColFichier]: {
                cid,
                ext: "svg",
              },
            });

            await client.tableaux!.ajouterNomsTableau(idTableau1, {
              fr: nomTableau1,
            });
            await client.tableaux!.ajouterNomsTableau(idTableau2, {
              fr: nomTableau2,
            });

            ({ docs, fichiersSFIP, nomFichier } =
              await client.projets!.exporterDonnées(idProjet, ["fr"]));
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
              await client.projets!.exporterDocumentDonnées(
                { docs, fichiersSFIP, nomFichier },
                "ods",
                dirZip,
                true
              );
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
