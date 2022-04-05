import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";
import fs from "fs";
import path from "path";
import XLSX, { WorkBook, readFile, writeFile } from "xlsx";
import AdmZip from "adm-zip";
import tmp from "tmp";
import rmrf from "rimraf"
import { v4 as uuid} from "uuid";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import ImportateurFeuilleCalcul from "@/importateur/xlsx"
import { uneFois, schémaFonctionSuivi, schémaFonctionOublier } from "@/utils";
import { SpécificationAutomatisation, SourceDonnéesImportationURL, SourceDonnéesImportationFichier, infoImporterJSON, infoImporterFeuilleCalcul, ÉtatAutomatisation, ÉtatErreur, ÉtatProgrammée, ÉtatEnSync, ÉtatÉcoute } from "@/automatisation";
import { élémentDonnées } from "@/valid";
import { élémentBdListeDonnées } from "@/tableaux";

import { testAPIs, config } from "./sfipTest";
import { générerClients, typesClients, attendreFichierExiste, attendreFichierModifié, attendreRésultat } from "./utils";

chai.should();
chai.use(chaiAsPromised);

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

const vérifierDonnéesProjet = async (
  doc: string, données: { [key: string]: { [key: string]: { [key: string]: string | number }[] } }
): Promise<void> => {

  // Il faut essayer plusieurs fois parce que le fichier ZIP peut
  // être créé avant la fin de l'écriture du fichier (ce qui cause
  // une erreur de lecture).
  const zip = await new Promise<AdmZip>(résoudre => {
    const interval = setInterval(() => {
      let zip: AdmZip
      try {
        zip = new AdmZip(doc)
        clearInterval(interval);
        résoudre(zip);
      } catch {
        // Réessayer
      }
    }, 10);
  });

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

const comparerDonnéesTableau = (données: élémentDonnées<élémentBdListeDonnées>[], réf: élémentBdListeDonnées[]): void => {
  const enleverId = (x: élémentBdListeDonnées): élémentBdListeDonnées => {
    return Object.fromEntries(Object.entries(x).filter(([clef, _val])=>clef!=="id"))
  }
  expect(données.map(d=>enleverId(d.données))).to.have.deep.members(réf);
}

typesClients.forEach((type) => {
  describe("Client " + type, function () {
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
          rmrf.sync(path.join(__dirname, "_temp"));
        });

        describe("Importation", function () {
          let idTableau: string;
          let idCol1: string;
          let idCol2: string;
          let dir: string;

          const rés: { ultat?: élémentDonnées<élémentBdListeDonnées>[] } = {}
          const fsOublier: schémaFonctionOublier[] = []

          beforeEach(async () => {
            dir = path.join(__dirname, "_temp/testImporterBd/" + uuid());
            fs.mkdirSync(dir, { recursive: true });

            idTableau = await client.tableaux!.créerTableau();
            const idVar1 = await client.variables!.créerVariable("numérique");
            const idVar2 = await client.variables!.créerVariable("chaîne");

            idCol1 = await client.tableaux!.ajouterColonneTableau(idTableau, idVar1);
            idCol2 = await client.tableaux!.ajouterColonneTableau(idTableau, idVar2);

            fsOublier.push(await client.tableaux!.suivreDonnées(
              idTableau,
              données => rés.ultat = données
            ))
          });

          afterEach(async () => {
            fsOublier.forEach(f=>f());
            rmrf.sync(dir);
            delete rés["ultat"]
          });

          it("Importer de fichier JSON", async () => {
            const fichierJSON = path.join(dir, "données.json");
            const données = {
              "données": [
                { "col 1": 1, "col 2": "អ"},
                { "col 1": 2, "col 2": "அ"},
                { "col 1": 3, "col 2": "a"},
              ]
            }

            fs.writeFileSync(fichierJSON, JSON.stringify(données));

            const source: SourceDonnéesImportationFichier<infoImporterJSON> = {
              typeSource: "fichier",
              adresseFichier: fichierJSON,
              info: {
                formatDonnées: "json",
                clefsRacine: ["données"],
                clefsÉléments: [],
                cols: {
                  [idCol1]: ["col 1"],
                  [idCol2]: ["col 2"]
                }
              }
            }

            await client.automatisations!.ajouterAutomatisationImporter(
              idTableau,
              source
            );

            await attendreRésultat(rés, "ultat", x=>x && x.length === 3)

            comparerDonnéesTableau(rés.ultat!, [
                { [idCol1]: 1, [idCol2]: "អ"},
                { [idCol1]: 2, [idCol2]: "அ"},
                { [idCol1]: 3, [idCol2]: "a"},
            ]);
          });

          it("Importer de fichier tableau", async () => {
            const fichierFeuilleCalcul = path.join(dir, "données.ods");

            const données = XLSX.utils.book_new();
            const tableau = XLSX.utils.json_to_sheet([
              { "col 1": 4, "col 2": "អ"},
              { "col 1": 5, "col 2": "அ"},
              { "col 1": 6, "col 2": "a"},
            ])
            XLSX.utils.book_append_sheet(données, tableau, "tableau")

            writeFile(données, fichierFeuilleCalcul, {
              bookType: "ods",
            });

            const source: SourceDonnéesImportationFichier<infoImporterFeuilleCalcul> = {
              typeSource: "fichier",
              adresseFichier: fichierFeuilleCalcul,
              info: {
                nomTableau: "tableau",
                formatDonnées: "feuilleCalcul",
                cols: {
                  [idCol1]: "col 1",
                  [idCol2]: "col 2"
                }
              }
            }

            await client.automatisations!.ajouterAutomatisationImporter(
              idTableau,
              source
            );

            await attendreRésultat(rés, "ultat", x=>x && x.length === 3);

            comparerDonnéesTableau(rés.ultat!, [
                { [idCol1]: 4, [idCol2]: "អ"},
                { [idCol1]: 5, [idCol2]: "அ"},
                { [idCol1]: 6, [idCol2]: "a"},
            ]);

          });

          it("Importer d'un URL (feuille calcul)", async () => {
            const source: SourceDonnéesImportationURL<infoImporterFeuilleCalcul> = {
              typeSource: "url",
              url: "https://coviddata.github.io/coviddata/v1/countries/cases.csv",
              info: {
                nomTableau: "Sheet1",
                formatDonnées: "feuilleCalcul",
                cols: {
                  [idCol1]: "1/22/21",
                  [idCol2]: "Country"
                }
              }
            }

            await client.automatisations!.ajouterAutomatisationImporter(
              idTableau,
              source,
              {
                unités: "jours",
                n: 1
              }
            );

            await attendreRésultat(rés, "ultat", x=>x && x.length >= 10);

            comparerDonnéesTableau(rés.ultat!, [
                { [idCol1]: 24846678, [idCol2]: "United States"},
                { [idCol1]: 10639684, [idCol2]: "India"},
                { [idCol1]: 8753920, [idCol2]: "Brazil"},
                { [idCol1]: 3594094, [idCol2]: "United Kingdom"},
                { [idCol1]: 3637862, [idCol2]: "Russia"},
                { [idCol1]: 3069695, [idCol2]: "France"},
                { [idCol1]: 2499560, [idCol2]: "Spain"},
                { [idCol1]: 2441854, [idCol2]: "Italy"},
                { [idCol1]: 2418472, [idCol2]: "Turkey"},
                { [idCol1]: 2125261, [idCol2]: "Germany"},
            ]);
          });

          it("Importer d'un URL (json)", async () => {
            const source: SourceDonnéesImportationURL<infoImporterJSON> = {
              typeSource: "url",
              url: "https://coordinates.native-land.ca/indigenousLanguages.json",
              info: {
                formatDonnées: "json",
                clefsRacine: ["features"],
                clefsÉléments: [],
                cols: {
                  [idCol2]: ["properties", "Name"],
                  [idCol1]: ["geometry", "coordinates", 0, 0, 0]
                }
              }
            }

            await client.automatisations!.ajouterAutomatisationImporter(
              idTableau,
              source,
              {
                unités: "jours",
                n: 1
              },
            );

            await attendreRésultat(rés, "ultat", x=>x && x.length >= 10);

            // Les résultats peuvent varier avec le temps !
            // Nom de la langue
            expect(rés.ultat!.map(r=>r.données[idCol1]).every(n=>typeof n === "string"))

            // Longitude
            expect(rés.ultat!.map(r=>r.données[idCol2]).every(n=> -180 <= n && n <= 180))
          });

          it("Importation selon changements", async () => {
            const fichierJSON = path.join(dir, "données.json");
            const données = {
              "données": [
                { "col 1": 1, "col 2": "អ"},
                { "col 1": 2, "col 2": "அ"},
                { "col 1": 3, "col 2": "a"},
              ]
            }

            fs.writeFileSync(fichierJSON, JSON.stringify(données));

            const source: SourceDonnéesImportationFichier<infoImporterJSON> = {
              typeSource: "fichier",
              adresseFichier: fichierJSON,
              info: {
                formatDonnées: "json",
                clefsRacine: ["données"],
                clefsÉléments: [],
                cols: {
                  [idCol1]: ["col 1"],
                  [idCol2]: ["col 2"]
                }
              }
            }

            await client.automatisations!.ajouterAutomatisationImporter(
              idTableau,
              source
            );

            données.données.push({"col 1": 4, "col 2": "子"});
            fs.writeFileSync(fichierJSON, JSON.stringify(données));

            await attendreRésultat(rés, "ultat", x => x.length === 4);

            comparerDonnéesTableau(rés.ultat!, [
                { [idCol1]: 1, [idCol2]: "អ"},
                { [idCol1]: 2, [idCol2]: "அ"},
                { [idCol1]: 3, [idCol2]: "a"},
                { [idCol1]: 4, [idCol2]: "子"},
            ]);
          });

          it("Importation selon fréquence", async () => {
            const fichierJSON = path.join(dir, "données.json");
            const données = {
              "données": [
                { "col 1": 1, "col 2": "អ"},
                { "col 1": 2, "col 2": "அ"},
                { "col 1": 3, "col 2": "a"},
              ]
            }

            fs.writeFileSync(fichierJSON, JSON.stringify(données));

            const source: SourceDonnéesImportationFichier<infoImporterJSON> = {
              typeSource: "fichier",
              adresseFichier: fichierJSON,
              info: {
                formatDonnées: "json",
                clefsRacine: ["données"],
                clefsÉléments: [],
                cols: {
                  [idCol1]: ["col 1"],
                  [idCol2]: ["col 2"]
                }
              }
            }

            await client.automatisations!.ajouterAutomatisationImporter(
              idTableau,
              source,
              {
                unités: "millisecondes",
                n: 300
              }
            );

            const maintenant = Date.now();
            données.données.push({"col 1": 4, "col 2": "子"});
            fs.writeFileSync(fichierJSON, JSON.stringify(données));

            await attendreRésultat(rés, "ultat", x => x.length === 4);

            const après = Date.now();
            expect (après - maintenant).to.be.greaterThanOrEqual(0.3 * 1000)

            comparerDonnéesTableau(rés.ultat!, [
                { [idCol1]: 1, [idCol2]: "អ"},
                { [idCol1]: 2, [idCol2]: "அ"},
                { [idCol1]: 3, [idCol2]: "a"},
                { [idCol1]: 4, [idCol2]: "子"},
            ]);

          });
          it("Effacer automatisation");
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
            await client.bds!.ajouterNomsBd(idBd, { fr: "Ma bd", es: "Mi bd"});

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
            const idAuto = await client.automatisations!.ajouterAutomatisationExporter(
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

            await client.automatisations!.annulerAutomatisation(idAuto);
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
            const idAuto = await client.automatisations!.ajouterAutomatisationExporter(
              idProjet,
              "projet",
              "ods",
              false,
              dir,
              ["fr"]
            )
            await attendreFichierExiste(fichier);
            await vérifierDonnéesProjet(
              fichier,
              {
                "Ma bd.ods": {
                  météo: [ {  précipitation: 3 } ]
                }
              }
            );

            await client.automatisations!.annulerAutomatisation(idAuto);
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
            const fichier = path.join(dir, "Mi bd.ods");

            await client.automatisations!.ajouterAutomatisationExporter(
              idBd,
              "bd",
              "ods",
              false,
              dir,
              ["es"],
              {
                unités: "secondes",
                n: 0.3
              },
            )
            await attendreFichierExiste(fichier);

            const maintenant = Date.now();
            await client.tableaux!.ajouterÉlément(
              idTableau, { [idCol]: 7 }
            );
            await attendreFichierModifié(fichier, maintenant);

            const après = Date.now();
            expect (après - maintenant).to.be.greaterThanOrEqual(0.3 * 1000)
          });
        });

        describe("Exportation nuée bds", function () {
          step("Exportation selon changements", async () => {
            await client.automatisations!.ajouterAutomatisationExporterNuée(
              idMotClef,
              undefined,
              fichier,
            );

          });
          step("Exportation selon fréquence");
        });

        describe("Suivre état automatisations exportation", function () {
          let idVariable: string;
          let idCol: string;
          let idTableau: string;
          let idBd: string;

          const rés: { états?: {[key: string]: ÉtatAutomatisation}, autos?: SpécificationAutomatisation[] } = {}
          const fsOublier: schémaFonctionOublier[] = [];
          const dir = path.join(__dirname, "_temp/testExporterBd");

          beforeEach(async () => {
            fsOublier.push(await client.automatisations!.suivreÉtatAutomatisations(états => rés.états = états));
            fsOublier.push(await client.automatisations!.suivreAutomatisations(autos => rés.autos = autos));

            idBd = await client.bds!.créerBd("ODbl-1_0");
            await client.bds!.ajouterNomsBd(idBd, { fr: "Ma bd", es: "Mi bd"});

            idTableau = await client.bds!.ajouterTableauBd(idBd);
            await client.tableaux!.ajouterNomsTableau(idTableau, { fr: "météo" });

            idVariable = await client.variables!.créerVariable("numérique");
            idCol = await client.tableaux!.ajouterColonneTableau(idTableau, idVariable);
            await client.variables!.ajouterNomsVariable(idVariable, { fr: "précipitation" });
            await client.tableaux!.ajouterÉlément(idTableau, {
              [idCol]: 3
            });
          })

          afterEach(async () => {
            fsOublier.forEach(f=>f());
            const automatisations = await uneFois(
              async (fSuivi: schémaFonctionSuivi<SpécificationAutomatisation[]>) => await client.automatisations!.suivreAutomatisations(fSuivi)
            )
            await Promise.all(automatisations.map(async a=> await client.automatisations!.annulerAutomatisation(a.id)));
            rmrf.sync(dir)
          })

          it("sync et écoute", async () => {
            const idAuto = await client.automatisations!.ajouterAutomatisationExporter(
              idBd,
              "bd",
              "ods",
              false,
              dir,
              ["fr"],
            );
            await attendreFichierExiste(path.join(dir, "Ma bd.ods"));
            // @ts-ignore
            await attendreRésultat(rés, "états", x=>x[idAuto]);

            expect(rés.états![idAuto]).to.deep.equal({
              type: "écoute"
            });

            const avantAjout = Date.now();
            await client.tableaux!.ajouterÉlément(idTableau, {[idCol]: 4});

            // @ts-ignore
            await attendreRésultat(rés, "états", x=>x[idAuto].type === "sync");

            const { type, depuis } = rés.états![idAuto] as ÉtatEnSync;
            expect(type).to.equal("sync");
            expect(depuis).to.be.greaterThanOrEqual(avantAjout);
          });

          it("programmée", async ()=> {
            const idAuto = await client.automatisations!.ajouterAutomatisationExporter(
              idBd,
              "bd",
              "ods",
              false,
              dir,
              ["fr"],
              {
                unités: "heures",
                n: 1
              }
            );

            await attendreFichierExiste(path.join(dir, "Ma bd.ods"));
            const maintenant = Date.now();

            // @ts-ignore
            await attendreRésultat(rés, "états", x=>x[idAuto])

            const état = rés.états![idAuto] as ÉtatProgrammée;

            expect(état.type).to.equal("programmée");
            expect(état.à).to.be.lessThanOrEqual(maintenant + 1000 * 60 * 60);
          });

          it("erreur", async () => {
            const avant = Date.now();

            const idAuto = await client.automatisations!.ajouterAutomatisationExporter(
              idBd,
              "bd",
              // @ts-ignore: on fait une erreur par exprès !
              "ods!",
              false,
              dir,
              ["fr"],
              {
                unités: "semaines",
                n: 1
              }
            );

            // @ts-ignore: Je sais pas comment faire ça
            await attendreRésultat(rés, "états", x=>!!x[idAuto]);

            const après = Date.now();

            expect(rés.états![idAuto].type).to.equal("erreur");
            const état = rés.états![idAuto] as ÉtatErreur;

            expect(état.erreur).to.equal("Error: Unrecognized bookType |ods!|");
            expect(état.prochaineProgramméeÀ).to.be.lessThanOrEqual(après + 1000 * 60 * 60 * 24 * 7);
            expect(état.prochaineProgramméeÀ).to.be.greaterThanOrEqual(avant + 1000 * 60 * 60 * 24 * 7);
          });
        });

        describe("Suivre état automatisations importation", function () {
          let idTableau: string;
          let idCol1: string;
          let idCol2: string;
          let dir: string;

          const rés: { états?: {[key: string]: ÉtatAutomatisation}, autos?: SpécificationAutomatisation[] } = {}
          const fsOublier: schémaFonctionOublier[] = [];

          beforeEach(async () => {
            fsOublier.push(await client.automatisations!.suivreÉtatAutomatisations(états => rés.états = états));
            fsOublier.push(await client.automatisations!.suivreAutomatisations(autos => rés.autos = autos));

            dir = path.join(__dirname, "_temp/testImporterBd/" + uuid());

            fs.mkdirSync(dir, { recursive: true });

            idTableau = await client.tableaux!.créerTableau();
            const idVar1 = await client.variables!.créerVariable("numérique");
            const idVar2 = await client.variables!.créerVariable("chaîne");

            idCol1 = await client.tableaux!.ajouterColonneTableau(idTableau, idVar1);
            idCol2 = await client.tableaux!.ajouterColonneTableau(idTableau, idVar2);
          });

          afterEach(async () => {
            fsOublier.forEach(f=>f());
            rmrf.sync(dir);
            delete rés["états"];
            delete rés["autos"];
          });

          it("sync et écoute", async () => {
            const fichierJSON = path.join(dir, "données.json");
            const données = {
              "données": [
                { "col 1": 1, "col 2": "អ"},
                { "col 1": 2, "col 2": "அ"},
                { "col 1": 3, "col 2": "a"},
              ]
            }

            fs.writeFileSync(fichierJSON, JSON.stringify(données));

            const source: SourceDonnéesImportationFichier<infoImporterJSON> = {
              typeSource: "fichier",
              adresseFichier: fichierJSON,
              info: {
                formatDonnées: "json",
                clefsRacine: ["données"],
                clefsÉléments: [],
                cols: {
                  [idCol1]: ["col 1"],
                  [idCol2]: ["col 2"]
                }
              }
            }

            const idAuto = await client.automatisations!.ajouterAutomatisationImporter(
              idTableau,
              source
            );

            // @ts-ignore: Je sais pas comment faire ça
            await attendreRésultat(rés, "états", x => x && x[idAuto]?.type === "écoute");

            expect(rés.états![idAuto]).to.deep.equal({
              type: "écoute"
            });

            données.données.push({"col 1": 4, "col 2": "子"});

            const avantAjout = Date.now();
            fs.writeFileSync(fichierJSON, JSON.stringify(données));

            // @ts-ignore: Je sais pas comment faire ça
            await attendreRésultat(rés, "états", x=>x[idAuto].type === "sync");

            expect(rés.états![idAuto].type).to.equal("sync");
            const étatSync = rés.états![idAuto] as ÉtatEnSync;
            expect(étatSync.depuis).to.be.greaterThanOrEqual(avantAjout);
          });

          it("programmée", async ()=> {
            const fichierJSON = path.join(dir, "données.json");
            const données = {
              "données": [
                { "col 1": 1, "col 2": "អ"},
                { "col 1": 2, "col 2": "அ"},
                { "col 1": 3, "col 2": "a"},
              ]
            }

            fs.writeFileSync(fichierJSON, JSON.stringify(données));

            const source: SourceDonnéesImportationFichier<infoImporterJSON> = {
              typeSource: "fichier",
              adresseFichier: fichierJSON,
              info: {
                formatDonnées: "json",
                clefsRacine: ["données"],
                clefsÉléments: [],
                cols: {
                  [idCol1]: ["col 1"],
                  [idCol2]: ["col 2"]
                }
              }
            }

            const idAuto = await client.automatisations!.ajouterAutomatisationImporter(
              idTableau,
              source,
              {
                unités: "minutes",
                n: 3
              }
            );

            // @ts-ignore: Je sais pas comment faire ça
            await attendreRésultat(rés, "états", x=>x && x[idAuto]?.type === "programmée");

            const maintenant = Date.now();

            expect(rés.états![idAuto].type).to.equal("programmée");

            const état = rés.états![idAuto] as ÉtatProgrammée;
            expect(état.à).to.be.lessThanOrEqual(maintenant + 1000 * 60 * 3)
          });

          it("erreur", async () => {
            const avant = Date.now();

            const fichierJSON = path.join(dir, "données.json");
            const données = {
              "données": [
                { "col 1": 1, "col 2": "អ"},
                { "col 1": 2, "col 2": "அ"},
                { "col 1": 3, "col 2": "a"},
              ]
            }

            fs.writeFileSync(fichierJSON, JSON.stringify(données));

            const source: SourceDonnéesImportationFichier<infoImporterJSON> = {
              typeSource: "fichier",
              adresseFichier: fichierJSON+"!",
              info: {
                formatDonnées: "json",
                clefsRacine: ["données"],
                clefsÉléments: [],
                cols: {
                  [idCol1]: ["col 1"],
                  [idCol2]: ["col 2"]
                }
              }
            }

            const idAuto = await client.automatisations!.ajouterAutomatisationImporter(
              idTableau,
              source,
              {
                unités: "minutes",
                n: 3
              }
            );

            // @ts-ignore: Je sais pas comment faire ça
            await attendreRésultat(rés, "états", x=>x && x[idAuto]?.type === "erreur");

            const après = Date.now();

            expect(rés.états![idAuto].type).to.equal("erreur");
            const état = rés.états![idAuto] as ÉtatErreur;

            expect(état.erreur.startsWith("Error: ENOENT: no such file or directory, open "), état.erreur);
            expect(état.prochaineProgramméeÀ).to.be.lessThanOrEqual(après + 1000 * 60 * 3);
            expect(état.prochaineProgramméeÀ).to.be.greaterThanOrEqual(avant + 1000 * 60 * 3);
          });
        });
      });
    });
  });
});
