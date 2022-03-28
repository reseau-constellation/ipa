import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";
import fs from "fs";
import path from "path";
import { WorkBook, BookType, readFile } from "xlsx";
import AdmZip from "adm-zip";
import tmp from "tmp";

import KeyValueStore from "orbit-db-kvstore";
import FeedStore from "orbit-db-feedstore";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import ImportateurFeuilleCalcul from "@/importateur/xlsx"
import { uneFois, schémaFonctionSuivi } from "@/utils";
import { SpécificationAutomatisation } from "@/automatisation";

import { testAPIs, config } from "./sfipTest";
import { générerClients, typesClients, attendreFichierExiste, attendreFichierModifié } from "./utils";

chai.should();
chai.use(chaiAsPromised);

/*
step("Le fichier zip existe", () => {
  const nomZip = path.join(dirZip, nomFichier + ".zip");
  expect(fs.existsSync(nomZip)).to.be.true;
  const zip = new AdmZip(nomZip);
  zip.extractAllTo(fichierExtrait, true);
  expect(fs.existsSync(fichierExtrait)).to.be.true;
});

it("Les données sont exportées", () => {
  expect(
    fs.existsSync(path.join(fichierExtrait, nomFichier + ".ods"))
  ).to.be.true;
});

step("Le dossier pour les données SFIP existe", () => {
  expect(fs.existsSync(path.join(fichierExtrait, "sfip"))).to.be
    .true;
});
*/

const vérifierDonnéesTableau = (
  doc: string | WorkBook, tableau: string, données: {[key: string]: string | number }[]
): void => {
  if (typeof doc === "string") {
    expect(fs.existsSync(doc)).to.be.true;
    doc = readFile(doc);
  }
  const importateur = new ImportateurFeuilleCalcul(doc);

  const cols = importateur.obtColsTableau(tableau);
  const donnéesFichier = importateur.obtDonnées(tableau, cols);

  expect(donnéesFichier).to.have.deep.members(données);
}

const vérifierDonnéesBd = (
  doc: string | WorkBook, données: { [key: string]: { [key: string]: string | number }[] }
): void => {
  if (typeof doc === "string") {
    expect(fs.existsSync(doc));
    doc = readFile(doc);
  }
  for (const tableau of Object.keys(données)) {
    vérifierDonnéesTableau(doc, tableau, données[tableau]);
  }
}

const vérifierDonnéesProjet = (
  doc: string, données: { [key: string]: { [key: string]: { [key: string]: string | number }[] } }
): void => {
  const zip = new AdmZip(doc);
  const fichierExtrait = tmp.dirSync();
  zip.extractAllTo(fichierExtrait.name, true);

  try {
    for (const fichierBd of Object.keys(données)) {
      vérifierDonnéesBd(path.join(fichierExtrait.name, fichierBd), données[fichierBd]);
    }
  } catch(e) {
    fichierExtrait.removeCallback();
    throw e
  }
}

typesClients.forEach((type) => {
  describe.only("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Automatisation", function () {
        this.timeout(config.timeout);

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation;

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

        describe("Importation", function () {
          before(async () => {});

          step("Aucune automatisation pour commencer");
          step("Ajout automatisation détecté");
          step("Importation selon fréquence");
          step("Importation selon changements");
          step("Effacer automatisation");
        });

        describe("Exportation", function () {
          let idVariable: string;
          let idCol: string;
          let idTableau: string;
          let idBd: string;
          let idProjet: string;

          const dir = path.join(__dirname, "_temp/testExporterBd");

          before(async () => {
            idBd = await client.bds!.créerBd("ODbl-1_0");
            await client.bds!.ajouterNomsBd(idBd, { fr: "Ma bd"});

            idTableau = await client.bds!.ajouterTableauBd(idBd);
            await client.tableaux!.ajouterNomsTableau(idTableau, { fr: "météo" });

            idVariable = await client.variables!.créerVariable("numérique");
            idCol = await client.tableaux!.ajouterColonneTableau(idTableau, idVariable);
            await client.variables!.ajouterNomsVariable(idVariable, { fr: "précipitation" });
            await client.tableaux!.ajouterÉlément(idTableau, {
              [idCol]: 3
            });

            idProjet = await client.projets!.créerProjet();
            await client.projets!.ajouterBdProjet(idProjet, idBd);
            await client.projets!.ajouterNomsProjet(idProjet, { fr: "Mon projet"})
          })

          after(async () => {
            const automatisations = await uneFois(
              async (fSuivi: schémaFonctionSuivi<SpécificationAutomatisation[]>) => await client.automatisations!.suivreAutomatisations(fSuivi)
            )
            await Promise.all(automatisations.map(async a=> await client.automatisations!.annulerAutomatisation(a.id)))
          })

          step("Exportation tableau", async () => {
            await client.automatisations!.ajouterAutomatisationExporter(
              idTableau,
              "tableau",
              "ods",
              false,
              dir,
              ["fr"],
            );
            const fichier = path.join(dir, "météo.ods");
            await attendreFichierExiste(fichier);
            vérifierDonnéesTableau(
              fichier,
              "météo",
              [{précipitation: 3}]
            );
          });

          step("Exportation BD", async () => {
            const fichier = path.join(dir, "Ma bd.ods");
            await client.automatisations!.ajouterAutomatisationExporter(
              idBd,
              "bd",
              "ods",
              false,
              dir,
              ["fr"]
            )
            await attendreFichierExiste(fichier);
            vérifierDonnéesBd(
              fichier,
              { météo: [ { précipitation: 3 } ] }
            );
          });

          step("Exportation projet", async () => {
            const fichier = path.join(dir, "Mon projet.zip");
            await client.automatisations!.ajouterAutomatisationExporter(
              idProjet,
              "projet",
              "ods",
              false,
              dir,
              ["fr"]
            )
            await attendreFichierExiste(fichier);
            vérifierDonnéesProjet(
              fichier,
              {
                "Ma bd.ods": {
                  météo: [ {  précipitation: 3 } ]
                }
              }
            );
          });

          step("Exportation selon changements", async () => {
            const fichier = path.join(dir, "Ma bd.ods");

            const avant = Date.now();
            await client.tableaux!.ajouterÉlément(
              idTableau, { [idCol]: 5 }
            );

            await attendreFichierModifié(
              fichier,
              avant
            );

            vérifierDonnéesBd(
              fichier,
              { météo: [ { précipitation: 3 }, { précipitation: 5 } ] }
            );
          });

          step("Exportation selon fréquence", async () => {
            const idBd = await client.bds!.créerBd("ODbl-1_0")
            await client.automatisations!.ajouterAutomatisationExporter(
              idBd,
              "bd",
              "ods",
              false,
              "exportations",
              {
                unités: "secondes",
                n: 1
              },
            )
            expect(fichier).to.exist
            const maintenant = Date.now();
            await faireChangementsÀLaBd();
            await attendreFichierModifié();
            const après = Date.now();
            expect (après - maintenant).to.be.greaterThanOrEqual(1 * 1000)
          });
        });

        describe("Exportation nuée bds", function () {
          step("Exportation selon fréquence");
          step("Exportation selon changements");
        });

        describe("Suivre état automatisations", function () {
          it("erreur");
          it("écoute");
          it("sync");
          it("programmée");
        });
      });
    });
  });
});
