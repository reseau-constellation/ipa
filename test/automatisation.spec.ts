import fs from "fs";
import path from "path";
import XLSX, { WorkBook, utils } from "xlsx";
import JSZip from "jszip";
import { isBrowser, isElectronRenderer } from "wherearewe";
import axios from "axios";

import {
  constellation as utilsTestConstellation,
  attente as utilsTestAttente,
  dossiers,
} from "@constl/utils-tests";
const { créerConstellationsTest } = utilsTestConstellation;

import { ImportateurFeuilleCalcul } from "@/importateur/xlsx.js";
import { schémaFonctionSuivi, schémaFonctionOublier } from "@/types.js";
import { uneFois } from "@constl/utils-ipa";
import type {
  SpécificationAutomatisation,
  SourceDonnéesImportationURL,
  SourceDonnéesImportationFichier,
  infoImporterJSON,
  infoImporterFeuilleCalcul,
  ÉtatAutomatisation,
  ÉtatErreur,
  ÉtatProgrammée,
  ÉtatEnSync,
} from "@/automatisation.js";
import type { élémentBdListeDonnées, élémentDonnées } from "@/tableaux.js";

import { obtRessourceTest } from "./ressources/index.js";
import { type Constellation, créerConstellation } from "@/index.js";

import { expect } from "aegir/chai";

const vérifierDonnéesTableau = (
  doc: string | WorkBook,
  tableau: string,
  données: { [key: string]: string | number }[],
): void => {
  if (typeof doc === "string") {
    expect(fs.existsSync(doc)).to.be.true();
    doc = XLSX.readFile(doc, {});
    console.log(doc);
  }
  const importateur = new ImportateurFeuilleCalcul(doc);

  const cols = importateur.obtColsTableau(tableau);
  const donnéesFichier = importateur.obtDonnées(tableau, cols);

  console.log({cols, donnéesFichier});

  expect(donnéesFichier).to.have.deep.members(données);
  expect(donnéesFichier.length).to.equal(données.length);
};

const vérifierDonnéesBd = (
  doc: string | WorkBook,
  données: { [key: string]: { [key: string]: string | number }[] },
): void => {
  if (typeof doc === "string") {
    expect(fs.existsSync(doc));
    doc = XLSX.readFile(doc);
  }
  for (const tableau of Object.keys(données)) {
    vérifierDonnéesTableau(doc, tableau, données[tableau]);
  }
};

const vérifierDonnéesProjet = async (
  doc: string,
  données: {
    [key: string]: { [key: string]: { [key: string]: string | number }[] };
  },
): Promise<void> => {
  // Il faut essayer plusieurs fois parce que le fichier ZIP peut
  // être créé avant la fin de l'écriture du fichier (ce qui cause
  // une erreur de lecture).

  const zip = await new Promise<JSZip>((résoudre) => {
    const interval = setInterval(async () => {
      let zip_: JSZip;
      try {
        const donnéesFichier = fs.readFileSync(doc);
        zip_ = await JSZip.loadAsync(donnéesFichier);
        clearInterval(interval);
        résoudre(zip_);
      } catch {
        // Réessayer
      }
    }, 100);
  });

  const { dossier: dossierFichierExtrait, fEffacer } =
    await dossiers.dossierTempo();
  await Promise.all(
    Object.entries(zip.files).map(async ([adresseRelative, élémentZip]) => {
      const adresseAbsolue = path.join(dossierFichierExtrait, adresseRelative);
      if (élémentZip.dir) {
        fs.mkdirSync(adresseAbsolue);
      } else {
        const contenu = await élémentZip.async("nodebuffer");
        fs.writeFileSync(adresseAbsolue, contenu);
      }
    }),
  );

  for (const fichierBd of Object.keys(données)) {
    vérifierDonnéesBd(
      path.join(dossierFichierExtrait, fichierBd),
      données[fichierBd],
    );
  }

  fEffacer();
};

const comparerDonnéesTableau = (
  données: élémentDonnées<élémentBdListeDonnées>[],
  réf: élémentBdListeDonnées[],
): void => {
  const enleverId = (x: élémentBdListeDonnées): élémentBdListeDonnées => {
    return Object.fromEntries(
      Object.entries(x).filter(([clef, _val]) => clef !== "id"),
    );
  };
  expect(données.length).to.equal(réf.length);
  expect(données.map((d) => enleverId(d.données))).to.have.deep.members(réf);
};

describe("Automatisation", function () {
  let fOublierClients: () => Promise<void>;
  let clients: Constellation[];
  let client: Constellation;

  before(async () => {
    ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
      n: 1,
      créerConstellation,
    }));
    client = clients[0];
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Importation", function () {
    let idTableau: string;
    let idCol1: string;
    let idCol2: string;
    let dossier: string;
    let fOublierAuto: () => Promise<void>;
    let fEffacer: () => void;

    let _get: typeof axios.get;

    let rés: utilsTestAttente.AttendreRésultat<
      élémentDonnées<élémentBdListeDonnées>[]
    >;
    let fsOublier: schémaFonctionOublier[] = [];

    beforeEach(async () => {
      _get = axios.get;

      fsOublier = [];
      rés = new utilsTestAttente.AttendreRésultat<
        élémentDonnées<élémentBdListeDonnées>[]
      >();
      ({ dossier, fEffacer } = await dossiers.dossierTempo());
      fsOublier.push(async () => fEffacer());

      const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });

      idTableau = await client.bds.ajouterTableauBd({ idBd });

      const idVar1 = await client.variables.créerVariable({
        catégorie: "numérique",
      });

      const idVar2 = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });

      idCol1 = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable: idVar1,
      });
      idCol2 = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable: idVar2,
      });

      fsOublier.push(
        await client.tableaux.suivreDonnées({
          idTableau,
          f: (données) => rés.mettreÀJour(données),
        }),
      );
    });

    afterEach(async () => {
      await Promise.all(fsOublier.map((f) => f()));
      if (fOublierAuto) await fOublierAuto();

      rés.toutAnnuler();
      axios.get = _get;
    });

    it("Importer de fichier JSON", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const fichierJSON = path.join(dossier, "données.json");
      const données = {
        données: [
          { "col 1": 1, "col 2": "អ" },
          { "col 1": 2, "col 2": "அ" },
          { "col 1": 3, "col 2": "a" },
        ],
      };

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
            [idCol2]: ["col 2"],
          },
        },
      };

      const idAuto = await client.automatisations.ajouterAutomatisationImporter(
        {
          idTableau,
          source,
          fréquence: {
            type: "dynamique",
          },
        },
      );
      fOublierAuto = async () =>
        await client.automatisations.annulerAutomatisation({
          id: idAuto,
        });

      const val = await rés.attendreQue((x) => !!(x && x.length === 3));

      comparerDonnéesTableau(val, [
        { [idCol1]: 1, [idCol2]: "អ" },
        { [idCol1]: 2, [idCol2]: "அ" },
        { [idCol1]: 3, [idCol2]: "a" },
      ]);
    });

    it("Importer de fichier tableau", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const fichierFeuilleCalcul = path.join(dossier, "données.ods");

      const données = XLSX.utils.book_new();
      const tableau = XLSX.utils.json_to_sheet([
        { "colé 1": 4 }
      ]);
      XLSX.utils.book_append_sheet(données, tableau, "météo");
      console.log(JSON.stringify(données, undefined, 2))

      XLSX.writeFile(données, fichierFeuilleCalcul, {
        bookType: "ods"
      });

      const brutes = new TextDecoder().decode(fs.readFileSync(fichierFeuilleCalcul))
      console.log({brutes: JSON.stringify(brutes, undefined, 2)})
      return;
      const source: SourceDonnéesImportationFichier<infoImporterFeuilleCalcul> =
        {
          typeSource: "fichier",
          adresseFichier: fichierFeuilleCalcul,
          info: {
            nomTableau: "tabléau",
            formatDonnées: "feuilleCalcul",
            cols: {
              [idCol1]: "colé 1",
              [idCol2]: "colé 2",
            },
          },
        };

      const idAuto = await client.automatisations.ajouterAutomatisationImporter(
        {
          idTableau,
          source,
          fréquence: {
            type: "dynamique",
          },
        },
      );
      fOublierAuto = async () =>
        await client.automatisations.annulerAutomatisation({ id: idAuto });

      const val = await rés.attendreQue((x) => !!(x && x.length === 3));

      comparerDonnéesTableau(val, [
        { [idCol1]: 4, [idCol2]: "អ" },
        { [idCol1]: 5, [idCol2]: "அ" },
        { [idCol1]: 6, [idCol2]: "a" },
      ]);
    });

    it.skip("Importer d'un URL (feuille calcul)", async function () {
      // @ts-expect-error  Faire semblant qu'on se connecte à l'Internet
      axios.get = async (url, opts) => {
        return url.startsWith("https://")
          ? {
              data: await obtRessourceTest({
                nomFichier: "cases.csv",
                optsAxios: opts,
              }),
            }
          : _get(url, opts);
      };
      const source: SourceDonnéesImportationURL<infoImporterFeuilleCalcul> = {
        typeSource: "url",
        url: "https://coviddata.github.io/coviddata/v1/countries/cases.csv",
        info: {
          nomTableau: "Sheet1",
          formatDonnées: "feuilleCalcul",
          cols: {
            [idCol1]: "2021-01-22",
            [idCol2]: "Country",
          },
          optionsXLSX: {
            dateNF: "yyyy-mm-dd",
          },
        },
      };

      const idAuto = await client.automatisations.ajouterAutomatisationImporter(
        {
          idTableau,
          source,
          fréquence: {
            type: "fixe",
            détails: {
              unités: "jours",
              n: 1,
            },
          },
        },
      );
      fOublierAuto = async () =>
        await client.automatisations.annulerAutomatisation({ id: idAuto });

      const val = await rés.attendreQue((x) => x.length >= 10);

      comparerDonnéesTableau(val, [
        { [idCol1]: 24846678, [idCol2]: "United States" },
        { [idCol1]: 10639684, [idCol2]: "India" },
        { [idCol1]: 8753920, [idCol2]: "Brazil" },
        { [idCol1]: 3594094, [idCol2]: "United Kingdom" },
        { [idCol1]: 3637862, [idCol2]: "Russia" },
        { [idCol1]: 3069695, [idCol2]: "France" },
        { [idCol1]: 2499560, [idCol2]: "Spain" },
        { [idCol1]: 2441854, [idCol2]: "Italy" },
        { [idCol1]: 2418472, [idCol2]: "Turkey" },
        { [idCol1]: 2125261, [idCol2]: "Germany" },
      ]);
    });

    it.skip("Importer d'un URL (json)", async function () {
      const source: SourceDonnéesImportationURL<infoImporterJSON> = {
        typeSource: "url",
        url: "https://coordinates.native-land.ca/indigenousLanguages.json",
        info: {
          formatDonnées: "json",
          clefsRacine: ["features"],
          clefsÉléments: [],
          cols: {
            [idCol2]: ["properties", "Name"],
            [idCol1]: ["geometry", "coordinates", 0, 0, 0],
          },
        },
      };

      // @ts-expect-error Je ne suis pas trop as sûr pourquoi
      axios.get = async (url, opts) => {
        return url.startsWith("https://")
          ? {
              data: await obtRessourceTest({
                nomFichier: "indigenousLanguages.json",
                optsAxios: opts,
              }),
            }
          : _get(url, opts);
      };

      const idAuto = await client.automatisations.ajouterAutomatisationImporter(
        {
          idTableau,
          source,
          fréquence: {
            type: "fixe",
            détails: {
              unités: "jours",
              n: 1,
            },
          },
        },
      );
      fOublierAuto = async () =>
        await client.automatisations.annulerAutomatisation({ id: idAuto });

      const val = await rés.attendreQue((x) => !!(x && x.length >= 8));

      // Nom de la langue
      expect(
        val.map((r) => r.données[idCol2]).every((n) => typeof n === "string"),
      ).to.be.true();

      // Longitude
      expect(
        val
          .map((r) => r.données[idCol1] as number)
          .every((n: number) => -180 <= n && n <= 180),
      ).to.be.true();
    });

    it.skip("Importation selon changements", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const fichierJSON = path.join(dossier, "données.json");
      const données = {
        données: [
          { "col 1": 1, "col 2": "អ" },
          { "col 1": 2, "col 2": "அ" },
          { "col 1": 3, "col 2": "a" },
        ],
      };

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
            [idCol2]: ["col 2"],
          },
        },
      };

      const idAuto = await client.automatisations.ajouterAutomatisationImporter(
        {
          idTableau,
          source,
          fréquence: {
            type: "dynamique",
          },
        },
      );
      fOublierAuto = async () =>
        await client.automatisations.annulerAutomatisation({
          id: idAuto,
        });

      données.données.push({ "col 1": 4, "col 2": "子" });
      fs.writeFileSync(fichierJSON, JSON.stringify(données));

      const val = await rés.attendreQue((x) => x?.length === 4);

      comparerDonnéesTableau(val, [
        { [idCol1]: 1, [idCol2]: "អ" },
        { [idCol1]: 2, [idCol2]: "அ" },
        { [idCol1]: 3, [idCol2]: "a" },
        { [idCol1]: 4, [idCol2]: "子" },
      ]);
    });

    it.skip("Importation selon fréquence", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const fichierJSON = path.join(dossier, "données.json");
      const données = {
        données: [
          { "col 1": 1, "col 2": "អ" },
          { "col 1": 2, "col 2": "அ" },
          { "col 1": 3, "col 2": "a" },
        ],
      };

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
            [idCol2]: ["col 2"],
          },
        },
      };

      const idAuto = await client.automatisations.ajouterAutomatisationImporter(
        {
          idTableau,
          source,
          fréquence: {
            type: "fixe",
            détails: {
              unités: "millisecondes",
              n: 300,
            },
          },
        },
      );
      fOublierAuto = async () =>
        await client.automatisations.annulerAutomatisation({
          id: idAuto,
        });
      await rés.attendreQue((x) => x?.length === 3);

      const maintenant = Date.now();
      données.données.push({ "col 1": 4, "col 2": "子" });
      fs.writeFileSync(fichierJSON, JSON.stringify(données));

      const val = await rés.attendreQue((x) => x?.length === 4);

      const après = Date.now();
      expect(après - maintenant).to.be.greaterThanOrEqual(300);

      comparerDonnéesTableau(val, [
        { [idCol1]: 1, [idCol2]: "អ" },
        { [idCol1]: 2, [idCol2]: "அ" },
        { [idCol1]: 3, [idCol2]: "a" },
        { [idCol1]: 4, [idCol2]: "子" },
      ]);
    });
    it.skip("Effacer automatisation");
  });

  describe("Exportation", function () {
    let idVariablePrécip: string;
    let idVariableTemp: string;
    let idColPrécip: string;
    let idColTemp: string;
    let idTableau: string;
    let idBd: string;
    let idProjet: string;
    let dossier: string;
    let fEffacer: () => void;

    const fsOublier: (() => void)[] = [];

    before(async () => {
      ({ dossier, fEffacer } = await dossiers.dossierTempo());
      fsOublier.push(fEffacer);

      idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
      await client.bds.sauvegarderNomsBd({
        idBd,
        noms: { fr: "Ma bd", cst: "Mi bd" },
      });

      idTableau = await client.bds.ajouterTableauBd({ idBd });
      await client.tableaux.sauvegarderNomsTableau({
        idTableau,
        noms: {
          fr: "météo",
        },
      });

      idVariablePrécip = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      idColPrécip = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable: idVariablePrécip,
      });
      await client.variables.sauvegarderNomsVariable({
        idVariable: idVariablePrécip,
        noms: {
          fr: "précipitation",
        },
      });
      idVariableTemp = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      idColTemp = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable: idVariableTemp,
      });
      await client.variables.sauvegarderNomsVariable({
        idVariable: idVariableTemp,
        noms: {
          fr: "température",
        },
      });
      await client.tableaux.ajouterÉlément({
        idTableau,
        vals: {
          [idColPrécip]: 3,
          [idColTemp]: 25,
        },
      });

      idProjet = await client.projets.créerProjet();
      await client.projets.ajouterBdProjet({ idProjet, idBd });
      await client.projets.sauvegarderNomsProjet({
        idProjet,
        noms: {
          fr: "Mon projet",
        },
      });
    });

    after(async () => {
      const automatisations = await uneFois(
        async (fSuivi: schémaFonctionSuivi<SpécificationAutomatisation[]>) =>
          await client.automatisations.suivreAutomatisations({
            f: fSuivi,
          }),
      );
      await Promise.all(
        automatisations.map(
          async (a) =>
            await client.automatisations.annulerAutomatisation({
              id: a.id,
            }),
        ),
      );
      fsOublier.forEach((f) => f());
    });

    it("Exportation tableau", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const fichier = path.join(dossier, "météo.ods");
      const attente = new utilsTestAttente.AttendreFichierExiste(fichier);
      fsOublier.push(() => attente.annuler());
      const attendreExiste = attente.attendre();

      const idAuto = await client.automatisations.ajouterAutomatisationExporter(
        {
          id: idTableau,
          typeObjet: "tableau",
          formatDoc: "ods",
          inclureFichiersSFIP: false,
          dossier,
          langues: ["fr"],
          fréquence: {
            type: "dynamique",
          },
        },
      );

      await attendreExiste;
      const brutes = new TextDecoder().decode(fs.readFileSync(fichier))
      console.log({brutes: JSON.stringify(brutes, undefined, 2)})
      vérifierDonnéesTableau(fichier, "météo", [{ précipitation: 3, température: 25 }]);

      await client.automatisations.annulerAutomatisation({ id: idAuto });
    });

    it("Exportation BD", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const fichier = path.join(dossier, "Ma bd.ods");
      const attente = new utilsTestAttente.AttendreFichierExiste(fichier);
      const attendreExiste = attente.attendre();
      fsOublier.push(() => attente.annuler());

      const idAuto = await client.automatisations.ajouterAutomatisationExporter(
        {
          id: idBd,
          typeObjet: "bd",
          formatDoc: "ods",
          inclureFichiersSFIP: false,
          dossier,
          langues: ["fr"],
          fréquence: {
            type: "dynamique",
          },
        },
      );

      await attendreExiste;
      vérifierDonnéesBd(fichier, { météo: [{ précipitation: 3, température: 25 }] });
      await client.automatisations.annulerAutomatisation({ id: idAuto });
    });

    it("Exportation projet", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const fichier = path.join(dossier, "Mon projet.zip");
      const attente = new utilsTestAttente.AttendreFichierExiste(fichier);
      const attendreExiste = attente.attendre();
      fsOublier.push(() => attente.annuler());

      const idAuto = await client.automatisations.ajouterAutomatisationExporter(
        {
          id: idProjet,
          typeObjet: "projet",
          formatDoc: "ods",
          inclureFichiersSFIP: false,
          dossier,
          langues: ["fr"],
          fréquence: {
            type: "dynamique",
          },
        },
      );
      await attendreExiste;
      await vérifierDonnéesProjet(fichier, {
        "Ma bd.ods": {
          météo: [{ précipitation: 3, température: 25 }],
        },
      });

      await client.automatisations.annulerAutomatisation({ id: idAuto });
    });

    it("Exportation selon changements", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const fichier = path.join(dossier, "Ma bd.ods");

      const attente = new utilsTestAttente.AttendreFichierExiste(fichier);
      fsOublier.push(() => attente.annuler());

      const idAuto = await client.automatisations.ajouterAutomatisationExporter(
        {
          id: idBd,
          typeObjet: "bd",
          formatDoc: "ods",
          inclureFichiersSFIP: false,
          dossier,
          langues: ["fr"],
          fréquence: {
            type: "dynamique",
          },
        },
      );

      await attente.attendre();
      const attendreModifié = new utilsTestAttente.AttendreFichierModifié(
        fichier,
      );
      fsOublier.push(() => attendreModifié.annuler());

      const avant = Date.now();
      const attenteModifié = attendreModifié.attendre(avant, async () => {
        const doc = XLSX.readFile(fichier);
        return utils.sheet_to_json(doc.Sheets["météo"]).length >= 2;
      });
      await client.tableaux.ajouterÉlément({
        idTableau,
        vals: { [idColPrécip]: 5 },
      });
      await attenteModifié;

      vérifierDonnéesBd(fichier, {
        météo: [{ précipitation: 3, température: 25 }, { précipitation: 5 }],
      });
      await client.automatisations.annulerAutomatisation({ id: idAuto });
    });

    it("Exportation selon fréquence", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const fichier = path.join(dossier, "Mi bd.ods");
      const attente = new utilsTestAttente.AttendreFichierExiste(fichier);
      const attendreExiste = attente.attendre();
      fsOublier.push(() => attente.annuler());

      const idAuto = await client.automatisations.ajouterAutomatisationExporter(
        {
          id: idBd,
          typeObjet: "bd",
          formatDoc: "ods",
          inclureFichiersSFIP: false,
          dossier,
          langues: ["cst"],
          fréquence: {
            type: "fixe",
            détails: {
              unités: "secondes",
              n: 0.3,
            },
          },
        },
      );
      const avantAttente = Date.now();
      await attendreExiste;
      const avantAjout = Date.now();

      const attenteModifié = new utilsTestAttente.AttendreFichierModifié(
        fichier,
      );
      fsOublier.push(() => attenteModifié.annuler());
      const modifié = attenteModifié.attendre(avantAjout);

      await client.tableaux.ajouterÉlément({
        idTableau,
        vals: { [idCol]: 7 },
      });

      await modifié;

      const après = Date.now();
      expect(après - avantAttente).to.be.greaterThanOrEqual(0.3 * 1000);

      await client.automatisations.annulerAutomatisation({ id: idAuto });
    });
  });

  describe("Exportation nuée bds", function () {
    let dossier: string;
    let fEffacer: () => void;

    let idNuée: string;
    let idBd: string;
    let idColonneNumérique: string;

    const clefTableau = "Tableau principal";
    const fsOublier: (() => void)[] = [];

    before(async () => {
      ({ dossier, fEffacer } = await dossiers.dossierTempo());
      fsOublier.push(fEffacer);
      idNuée = await client.nuées.créerNuée({});
      await client.nuées.sauvegarderNomsNuée({
        idNuée,
        noms: { fr: "Science citoyenne" },
      });
      const idTableau = await client.nuées.ajouterTableauNuée({
        idNuée,
        clefTableau,
      });
      await client.tableaux.sauvegarderNomTableau({
        idTableau,
        langue: "fr",
        nom: "météo",
      });
      const idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      await client.variables.sauvegarderNomVariable({
        idVariable,
        langue: "fr",
        nom: "Précipitation",
      });
      idColonneNumérique = await client.nuées.ajouterColonneTableauNuée({
        idTableau,
        idVariable,
      });
      const schéma = await client.nuées.générerSchémaBdNuée({
        idNuée,
        licence: "ODbl-1_0",
      });

      idBd = await client.bds.créerBdDeSchéma({ schéma });
    });

    after(async () => {
      fsOublier.forEach((f) => f());
    });

    it("Exportation selon changements", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const fichier = path.join(dossier, "Science citoyenne.ods");
      const attente = new utilsTestAttente.AttendreFichierExiste(fichier);
      const attendreExiste = attente.attendre();
      fsOublier.push(() => attente.annuler());
      const idAuto = await client.automatisations.ajouterAutomatisationExporter(
        {
          id: idNuée,
          typeObjet: "nuée",
          formatDoc: "ods",
          inclureFichiersSFIP: false,
          dossier,
          langues: ["fr"],
          fréquence: {
            type: "dynamique",
          },
        },
      );
      await attendreExiste;
      const attenteModifié = new utilsTestAttente.AttendreFichierModifié(
        fichier,
      );
      fsOublier.push(() => attenteModifié.annuler());

      const avant = Date.now();
      await client.bds.ajouterÉlémentÀTableauParClef({
        idBd,
        clefTableau,
        vals: { [idColonneNumérique]: 123 },
      });

      await attenteModifié.attendre(avant, async () => {
        const doc = XLSX.readFile(fichier);
        return (
          Object.keys(utils.sheet_to_json(doc.Sheets["météo"])[0] || {})
            .length > 1
        );
      });

      vérifierDonnéesBd(fichier, {
        météo: [{ Précipitation: 123, auteur: await client.obtIdCompte() }],
      });

      await client.automatisations.annulerAutomatisation({ id: idAuto });
    });
  });

  describe("Suivre état automatisations exportation", function () {
    let idVariable: string;
    let idCol: string;
    let idTableau: string;
    let idBd: string;
    let dossier: string;
    let fEffacer: () => void;

    const résÉtats = new utilsTestAttente.AttendreRésultat<{
      [key: string]: ÉtatAutomatisation;
    }>();
    const résAutos = new utilsTestAttente.AttendreRésultat<
      SpécificationAutomatisation[]
    >();

    const fsOublier: (schémaFonctionOublier | (() => void))[] = [];

    before(async () => {
      ({ dossier, fEffacer } = await dossiers.dossierTempo());
      fsOublier.push(fEffacer);

      fsOublier.push(
        await client.automatisations.suivreÉtatAutomatisations({
          f: (états) => {
            résÉtats.mettreÀJour(états);
          },
        }),
      );
      fsOublier.push(
        await client.automatisations.suivreAutomatisations({
          f: (autos) => résAutos.mettreÀJour(autos),
        }),
      );

      idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
      await client.bds.sauvegarderNomsBd({
        idBd,
        noms: { fr: "Ma bd", cst: "Mi bd" },
      });

      idTableau = await client.bds.ajouterTableauBd({ idBd });
      await client.tableaux.sauvegarderNomsTableau({
        idTableau,
        noms: {
          fr: "météo",
        },
      });

      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      idCol = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable,
      });
      await client.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          fr: "précipitation",
        },
      });
      await client.tableaux.ajouterÉlément({
        idTableau,
        vals: {
          [idCol]: 3,
        },
      });
    });

    after(async () => {
      résÉtats.toutAnnuler();
      résAutos.toutAnnuler();

      await Promise.all(fsOublier.map((f) => f()));
      const automatisations = await uneFois(
        async (fSuivi: schémaFonctionSuivi<SpécificationAutomatisation[]>) =>
          await client.automatisations.suivreAutomatisations({
            f: fSuivi,
          }),
      );
      await Promise.all(
        automatisations.map(
          async (a) =>
            await client.automatisations.annulerAutomatisation({
              id: a.id,
            }),
        ),
      );
    });

    it("sync et écoute", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const attendreFichierExiste = new utilsTestAttente.AttendreFichierExiste(
        path.join(dossier, "Ma bd.ods"),
      );
      fsOublier.push(() => attendreFichierExiste.annuler());
      const idAuto = await client.automatisations.ajouterAutomatisationExporter(
        {
          id: idBd,
          typeObjet: "bd",
          formatDoc: "ods",
          inclureFichiersSFIP: false,
          dossier,
          langues: ["fr"],
          fréquence: {
            type: "dynamique",
          },
        },
      );
      await attendreFichierExiste.attendre();
      await résÉtats.attendreQue((x) => !!(x && x[idAuto]?.type !== "sync"));

      expect(résÉtats.val![idAuto]).to.deep.equal({
        type: "écoute",
      });

      const avantAjout = Date.now();
      const attendre = résÉtats.attendreQue(
        (x) => !!(x && x[idAuto]?.type === "sync"),
      );
      await client.tableaux.ajouterÉlément({
        idTableau,
        vals: { [idCol]: 4 },
      });

      const { type, depuis } = (await attendre)[idAuto] as ÉtatEnSync;
      expect(type).to.equal("sync");
      expect(depuis).to.be.greaterThanOrEqual(avantAjout);
    });

    it("programmée", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const attendreFichierExiste = new utilsTestAttente.AttendreFichierExiste(
        path.join(dossier, "Ma bd.ods"),
      );
      fsOublier.push(() => attendreFichierExiste.annuler());

      const idAuto = await client.automatisations.ajouterAutomatisationExporter(
        {
          id: idBd,
          typeObjet: "bd",
          formatDoc: "ods",
          inclureFichiersSFIP: false,
          dossier,
          langues: ["fr"],
          fréquence: {
            type: "fixe",
            détails: {
              unités: "heures",
              n: 1,
            },
          },
        },
      );

      await attendreFichierExiste.attendre();

      const val = await résÉtats.attendreQue(
        (x) => !!(x && x[idAuto]?.type === "programmée"),
      );

      const état = val[idAuto] as ÉtatProgrammée;

      expect(état.type).to.equal("programmée");

      const maintenant = Date.now();
      expect(état.à - maintenant).to.be.lessThanOrEqual(1000 * 60 * 60);
    });

    it("erreur", async () => {
      const avant = Date.now();

      const idAuto = await client.automatisations.ajouterAutomatisationExporter(
        {
          id: idBd,
          typeObjet: "bd",
          // @ts-expect-error: on fait une erreur par exprès !
          formatDoc: "ods!",
          inclureFichiersSFIP: false,
          dossier,
          langues: ["fr"],
          fréquence: {
            type: "fixe",
            détails: {
              unités: "semaines",
              n: 1,
            },
          },
        },
      );

      const val = await résÉtats.attendreQue(
        (x) => x[idAuto]?.type === "erreur",
      );

      const après = Date.now();

      expect(val[idAuto].type).to.equal("erreur");
      const état = val[idAuto] as ÉtatErreur;

      expect(JSON.parse(état.erreur).message).to.equal(
        "Unrecognized bookType |ods!|",
      );
      expect(état.prochaineProgramméeÀ).to.be.lessThanOrEqual(
        après + 1000 * 60 * 60 * 24 * 7,
      );
      expect(état.prochaineProgramméeÀ).to.be.greaterThanOrEqual(
        avant + 1000 * 60 * 60 * 24 * 7,
      );
    });
  });

  describe("Suivre état automatisations importation", function () {
    let idTableau: string;
    let idCol1: string;
    let idCol2: string;
    let dossier: string;
    let fEffacer: () => void;

    const résÉtats = new utilsTestAttente.AttendreRésultat<{
      [key: string]: ÉtatAutomatisation;
    }>();
    const résAutos = new utilsTestAttente.AttendreRésultat<
      SpécificationAutomatisation[]
    >();
    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      fsOublier.push(
        await client.automatisations.suivreÉtatAutomatisations({
          f: (états) => résÉtats.mettreÀJour(états),
        }),
      );
      fsOublier.push(
        await client.automatisations.suivreAutomatisations({
          f: (autos) => résAutos.mettreÀJour(autos),
        }),
      );

      ({ dossier, fEffacer } = await dossiers.dossierTempo());
      fsOublier.push(async () => fEffacer());

      const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
      idTableau = await client.tableaux.créerTableau({ idBd });
      const idVar1 = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      const idVar2 = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });

      idCol1 = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable: idVar1,
      });
      idCol2 = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable: idVar2,
      });
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
      résÉtats.toutAnnuler();
      résAutos.toutAnnuler();
    });

    it("sync et écoute", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const fichierJSON = path.join(dossier, "données.json");
      const données = {
        données: [
          { "col 1": 1, "col 2": "អ" },
          { "col 1": 2, "col 2": "அ" },
          { "col 1": 3, "col 2": "a" },
        ],
      };

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
            [idCol2]: ["col 2"],
          },
        },
      };

      const idAuto = await client.automatisations.ajouterAutomatisationImporter(
        {
          idTableau,
          source,
          fréquence: {
            type: "dynamique",
          },
        },
      );

      const val = await résÉtats.attendreQue(
        (x) => !!(x && x[idAuto]?.type === "écoute"),
      );

      expect(val[idAuto]).to.deep.equal({
        type: "écoute",
      });

      données.données.push({ "col 1": 4, "col 2": "子" });

      const avantAjout = Date.now();
      const attendre = résÉtats.attendreQue(
        (x) => !!(x && x[idAuto]?.type === "sync"),
      );
      fs.writeFileSync(fichierJSON, JSON.stringify(données));

      const états = await attendre;
      expect(états![idAuto].type).to.equal("sync");
      const étatSync = états![idAuto] as ÉtatEnSync;
      expect(étatSync.depuis).to.be.greaterThanOrEqual(avantAjout);
    });

    it("programmée", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const fichierJSON = path.join(dossier, "données.json");
      const données = {
        données: [
          { "col 1": 1, "col 2": "អ" },
          { "col 1": 2, "col 2": "அ" },
          { "col 1": 3, "col 2": "a" },
        ],
      };

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
            [idCol2]: ["col 2"],
          },
        },
      };

      const idAuto = await client.automatisations.ajouterAutomatisationImporter(
        {
          idTableau,
          source,
          fréquence: {
            type: "fixe",
            détails: {
              unités: "minutes",
              n: 3,
            },
          },
        },
      );

      const val = await résÉtats.attendreQue(
        (x) => !!(x && x[idAuto]?.type === "programmée"),
      );

      const maintenant = Date.now();

      expect(val[idAuto].type).to.equal("programmée");

      const état = val[idAuto] as ÉtatProgrammée;
      expect(état.à).to.be.lessThanOrEqual(maintenant + 1000 * 60 * 3);
    });

    it("erreur", async function () {
      if (isBrowser || isElectronRenderer) this.skip();

      const avant = Date.now();

      const fichierJSON = path.join(dossier, "données.json");
      const données = {
        données: [
          { "col 1": 1, "col 2": "អ" },
          { "col 1": 2, "col 2": "அ" },
          { "col 1": 3, "col 2": "a" },
        ],
      };

      fs.writeFileSync(fichierJSON, JSON.stringify(données));

      const source: SourceDonnéesImportationFichier<infoImporterJSON> = {
        typeSource: "fichier",
        adresseFichier: fichierJSON + "!",
        info: {
          formatDonnées: "json",
          clefsRacine: ["données"],
          clefsÉléments: [],
          cols: {
            [idCol1]: ["col 1"],
            [idCol2]: ["col 2"],
          },
        },
      };

      const idAuto = await client.automatisations.ajouterAutomatisationImporter(
        {
          idTableau,
          source,
          fréquence: {
            type: "fixe",
            détails: {
              unités: "minutes",
              n: 3,
            },
          },
        },
      );

      await résÉtats.attendreQue((x) => !!(x && x[idAuto]?.type === "erreur"));

      const après = Date.now();

      expect(résÉtats.val![idAuto].type).to.equal("erreur");
      const état = résÉtats.val![idAuto] as ÉtatErreur;

      expect(état.erreur).to.contain("introuvable.");
      expect(état.prochaineProgramméeÀ).to.be.lessThanOrEqual(
        après + 1000 * 60 * 3,
      );
      expect(état.prochaineProgramméeÀ).to.be.greaterThanOrEqual(
        avant + 1000 * 60 * 3,
      );
    });
  });
});
