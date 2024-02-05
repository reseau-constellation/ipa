import type XLSX from "xlsx";
import fs from "fs";
import path from "path";

import pkg from "lodash";
const { isSet } = pkg;

import {
  constellation as utilsTestConstellation,
  attente as utilsTestAttente,
  dossiers,
} from "@constl/utils-tests";
const { créerConstellationsTest } = utilsTestConstellation;

import { créerConstellation, type ClientConstellation } from "@/index.js";
import { schémaFonctionSuivi, schémaFonctionOublier } from "@/types.js";
import { uneFois } from "@constl/utils-ipa";
import { isValidAddress } from "@orbitdb/core";

import type { InfoColAvecCatégorie } from "@/tableaux.js";
import type {
  infoScore,
  schémaSpécificationBd,
  infoTableauAvecId,
} from "@/bds.js";
import type { élémentBdListeDonnées, élémentDonnées } from "@/tableaux.js";
import type { règleBornes } from "@/valid.js";

import { expect } from "aegir/chai";
import JSZip from "jszip";
import { obtRessourceTest } from "./ressources/index.js";
import { isElectronMain, isNode } from "wherearewe";
import { attente } from "@constl/utils-tests";
import { préparerOrbite } from "@/orbite.js";

describe("BDs", function () {
  let fOublierClients: () => Promise<void>;
  let clients: ClientConstellation[];
  let client: ClientConstellation;

  let idBd: string;
  let accèsBd: boolean;

  const fsOublier: schémaFonctionOublier[] = [];

  before(async () => {
    préparerOrbite();
    ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
      n: 1,
      créerConstellation,
    }));
    client = clients[0];
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
    await Promise.all(fsOublier.map((f) => f()));
  });

  it("Création", async () => {
    idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
    expect(isValidAddress(idBd)).to.be.true();
  });
  it("Accès", async () => {
    fsOublier.push(
      await client.suivrePermissionÉcrire({
        id: idBd,
        f: (x) => (accèsBd = x),
      }),
    );
    expect(accèsBd).to.be.true();
  });

  describe("Mes BDs", () => {
    let fOublier: schémaFonctionOublier;
    let idNouvelleBd: string;
    const bds = new utilsTestAttente.AttendreRésultat<string[]>();

    before(async () => {
      fOublier = await client.bds.suivreBds({
        f: (x) => bds.mettreÀJour(x),
      });
    });
    after(async () => {
      if (fOublier) await fOublier();
      bds.toutAnnuler();
    });
    it("La BD déjà créée est présente", async () => {
      const val = await bds.attendreExiste();
      expect(val).to.be.an("array").and.to.contain(idBd);
    });
    it("On crée une autre BD sans l'ajouter", async () => {
      idNouvelleBd = await client.bds.créerBd({
        licence: "ODbl-1_0",
        ajouter: false,
      });
      const val = bds.val;
      expect(val).to.be.an("array").with.length(1).and.contain(idBd);
    });
    it("On peut l'ajouter ensuite à mes bds", async () => {
      await client.bds.ajouterÀMesBds({ idBd: idNouvelleBd });
      const val = await bds.attendreQue((x) => x.length > 1);
      expect(val)
        .to.be.an("array")
        .with.length(2)
        .to.have.members([idNouvelleBd, idBd]);
    });
    it("On peut aussi l'effacer", async () => {
      await client.bds.effacerBd({ idBd: idNouvelleBd });
      const val = await bds.attendreQue((x) => x.length < 2);
      expect(val).to.be.an("array").with.length(1).and.contain(idBd);
    });
  });

  describe("Noms", function () {
    let fOublier: schémaFonctionOublier;

    const attenteNoms = new attente.AttendreRésultat<{
      [langue: string]: string;
    }>();

    before(async () => {
      fOublier = await client.bds.suivreNomsBd({
        idBd,
        f: (n) => attenteNoms.mettreÀJour(n),
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
      attenteNoms.toutAnnuler();
    });

    it("Pas de noms pour commencer", async () => {
      const noms = await attenteNoms.attendreExiste();
      expect(Object.keys(noms).length).to.equal(0);
    });

    it("Ajouter un nom", async () => {
      await client.bds.sauvegarderNomBd({
        idBd,
        langue: "fr",
        nom: "Alphabets",
      });
      const noms = await attenteNoms.attendreQue(
        (n) => Object.keys(n).length > 0,
      );
      expect(noms.fr).to.equal("Alphabets");
    });

    it("Ajouter des noms", async () => {
      await client.bds.sauvegarderNomsBd({
        idBd,
        noms: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });
      const noms = await attenteNoms.attendreQue(
        (n) => Object.keys(n).length > 2,
      );
      expect(noms).to.deep.equal({
        fr: "Alphabets",
        த: "எழுத்துகள்",
        हिं: "वर्णमाला",
      });
    });

    it("Changer un nom", async () => {
      await client.bds.sauvegarderNomBd({
        idBd,
        langue: "fr",
        nom: "Systèmes d'écriture",
      });
      const noms = await attenteNoms.attendreQue(
        (n) => n["fr"] !== "Alphabets",
      );
      expect(noms?.fr).to.equal("Systèmes d'écriture");
    });

    it("Effacer un nom", async () => {
      await client.bds.effacerNomBd({ idBd, langue: "fr" });
      const noms = await attenteNoms.attendreQue((n) => !n["fr"]);
      expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("Descriptions", function () {
    let fOublier: schémaFonctionOublier;

    const attenteDescrs = new attente.AttendreRésultat<{
      [key: string]: string;
    }>();

    before(async () => {
      fOublier = await client.bds.suivreDescriptionsBd({
        idBd,
        f: (d) => attenteDescrs.mettreÀJour(d),
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
      attenteDescrs.toutAnnuler();
    });

    it("Aucune description pour commencer", async () => {
      const descrs = await attenteDescrs.attendreExiste();
      expect(Object.keys(descrs).length).to.equal(0);
    });

    it("Ajouter une description", async () => {
      await client.bds.sauvegarderDescriptionBd({
        idBd,
        langue: "fr",
        description: "Alphabets",
      });
      const descrs = await attenteDescrs.attendreQue((x) => !!x["fr"]);
      expect(descrs.fr).to.equal("Alphabets");
    });

    it("Ajouter des descriptions", async () => {
      await client.bds.sauvegarderDescriptionsBd({
        idBd,
        descriptions: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });
      const descrs = await attenteDescrs.attendreQue(
        (x) => Object.keys(x).length > 2,
      );
      expect(descrs).to.deep.equal({
        fr: "Alphabets",
        த: "எழுத்துகள்",
        हिं: "वर्णमाला",
      });
    });

    it("Changer une description", async () => {
      await client.bds.sauvegarderDescriptionBd({
        idBd,
        langue: "fr",
        description: "Systèmes d'écriture",
      });
      const descrs = await attenteDescrs.attendreQue(
        (x) => x["fr"] !== "Alphabets",
      );
      expect(descrs?.fr).to.equal("Systèmes d'écriture");
    });

    it("Effacer une description", async () => {
      await client.bds.effacerDescriptionBd({ idBd, langue: "fr" });
      const descrs = await attenteDescrs.attendreQue((x) => !x["fr"]);
      expect(descrs).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("Mots-clefs", function () {
    let fOublier: schémaFonctionOublier;
    let idMotClef: string;

    const attenteMotsClefs = new attente.AttendreRésultat<string[]>();

    before(async () => {
      fOublier = await client.bds.suivreMotsClefsBd({
        idBd,
        f: (m) => attenteMotsClefs.mettreÀJour(m),
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
      attenteMotsClefs.toutAnnuler();
    });
    it("Pas de mots-clefs pour commencer", async () => {
      const motsClefs = await attenteMotsClefs.attendreExiste();
      expect(motsClefs).to.be.an.empty("array");
    });
    it("Ajout d'un mot-clef", async () => {
      idMotClef = await client.motsClefs.créerMotClef();
      await client.bds.ajouterMotsClefsBd({
        idBd,
        idsMotsClefs: idMotClef,
      });

      const motsClefs = await attenteMotsClefs.attendreQue((x) => x.length > 0);
      expect(Array.isArray(motsClefs)).to.be.true();
      expect(motsClefs.length).to.equal(1);
    });
    it("Effacer un mot-clef", async () => {
      await client.bds.effacerMotClefBd({ idBd, idMotClef });

      const motsClefs = await attenteMotsClefs.attendreQue(
        (x) => x.length === 0,
      );
      expect(motsClefs).to.be.an.empty("array");
    });
  });

  describe("Changer licence BD", function () {
    let idBd: string;
    let fOublier: schémaFonctionOublier;
    const attenteLicence = new attente.AttendreRésultat<string>();

    before(async () => {
      idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
      fOublier = await client.bds.suivreLicenceBd({
        idBd,
        f: (l) => attenteLicence.mettreÀJour(l),
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
      attenteLicence.toutAnnuler();
    });

    it("Licence originale présente", async () => {
      const licence = await attenteLicence.attendreExiste();

      expect(licence).to.equal("ODbl-1_0");
    });

    it("Changement de licence", async () => {
      await client.bds.changerLicenceBd({ idBd, licence: "ODC-BY-1_0" });

      const licence = await attenteLicence.attendreQue((l) => l !== "ODbl-1_0");
      expect(licence).to.equal("ODC-BY-1_0");
    });
  });

  describe("Statut BD", function () {
    it.skip("À faire");
  });

  describe("Tableaux", function () {
    let idTableau: string;
    let accèsTableau: boolean;

    const attenteTableaux = new attente.AttendreRésultat<infoTableauAvecId[]>();
    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      fsOublier.push(
        await client.bds.suivreTableauxBd({
          idBd,
          f: (t) => attenteTableaux.mettreÀJour(t),
        }),
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    it("Pas de tableaux pour commencer", async () => {
      const tableaux = await attenteTableaux.attendreExiste();
      expect(tableaux).to.be.an.empty("array");
    });

    it("Ajout d'un tableau", async () => {
      idTableau = await client.bds.ajouterTableauBd({
        idBd,
        clefTableau: "abc",
      });
      expect(isValidAddress(idTableau)).to.be.true();

      const tableaux = await attenteTableaux.attendreQue((t) => t.length > 0);
      expect(Array.isArray(tableaux)).to.be.true();
      expect(tableaux.length).to.equal(1);
      expect(tableaux).to.have.deep.members([
        {
          id: idTableau,
          clef: "abc",
        },
      ]);
    });

    it("Accès au tableau", async () => {
      fsOublier.push(
        await client.suivrePermissionÉcrire({
          id: idTableau,
          f: (x) => (accèsTableau = x),
        }),
      );
      expect(accèsTableau).to.be.true();
    });

    it("Effacer un tableau", async () => {
      await client.bds.effacerTableauBd({ idBd, idTableau });

      const tableaux = await attenteTableaux.attendreQue((t) => t.length === 0);
      expect(tableaux).to.be.an.empty("array");
    });
  });

  describe("Variables", function () {
    let fOublier: schémaFonctionOublier;
    let idTableau: string;
    let idVariable: string;
    let idColonne: string;

    const attenteVariables = new attente.AttendreRésultat<string[]>();

    before(async () => {
      fOublier = await client.bds.suivreVariablesBd({
        idBd,
        f: (v) => attenteVariables.mettreÀJour(v),
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
      attenteVariables.toutAnnuler();
    });
    it("Pas de variables pour commencer", async () => {
      const variables = await attenteVariables.attendreExiste();
      expect(variables).to.be.an.empty("array");
    });

    it("Ajout d'un tableau et d'une variable", async () => {
      idTableau = await client.bds.ajouterTableauBd({ idBd });
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });

      idColonne = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable,
      });

      const variables = await attenteVariables.attendreQue((v) => v.length > 0);
      expect(Array.isArray(variables)).to.be.true();
      expect(variables.length).to.equal(1);
      expect(variables[0]).to.equal(idVariable);
    });

    it("Effacer une variable", async () => {
      await client.tableaux.effacerColonneTableau({
        idTableau,
        idColonne,
      });
      const variables = await attenteVariables.attendreQue(
        (v) => v.length === 0,
      );
      expect(variables).to.be.an.empty("array");
    });
  });

  describe("Copier BD", function () {
    let idBdOrig: string;
    let idBdCopie: string;

    let idMotClef: string;
    let idVariable: string;
    let idTableau: string;

    const attenteNoms = new attente.AttendreRésultat<{
      [key: string]: string;
    }>();
    const attenteDescrs = new attente.AttendreRésultat<{
      [key: string]: string;
    }>();
    const attenteLicence = new attente.AttendreRésultat<string>();
    const attenteMotsClefs = new attente.AttendreRésultat<string[]>();
    const attenteVariables = new attente.AttendreRésultat<string[]>();
    const attenteTableaux = new attente.AttendreRésultat<infoTableauAvecId[]>();

    const réfNoms = {
      த: "மழை",
      हिं: "बारिश",
    };
    const réfDescrs = {
      த: "தினசரி மழை",
      हिं: "दैनिक बारिश",
    };
    const réfLicence = "ODbl-1_0";

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idBdOrig = await client.bds.créerBd({ licence: réfLicence });

      await client.bds.sauvegarderNomsBd({
        idBd: idBdOrig,
        noms: réfNoms,
      });
      await client.bds.sauvegarderDescriptionsBd({
        idBd: idBdOrig,
        descriptions: réfDescrs,
      });

      idMotClef = await client.motsClefs.créerMotClef();
      await client.bds.ajouterMotsClefsBd({
        idBd: idBdOrig,
        idsMotsClefs: idMotClef,
      });

      idTableau = await client.bds.ajouterTableauBd({ idBd: idBdOrig });

      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable,
      });

      idBdCopie = await client.bds.copierBd({ idBd: idBdOrig });

      fsOublier.push(
        await client.bds.suivreNomsBd({
          idBd: idBdCopie,
          f: (x) => attenteNoms.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.bds.suivreDescriptionsBd({
          idBd: idBdCopie,
          f: (x) => attenteDescrs.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.bds.suivreLicenceBd({
          idBd: idBdCopie,
          f: (x) => attenteLicence.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.bds.suivreMotsClefsBd({
          idBd: idBdCopie,
          f: (x) => attenteMotsClefs.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.bds.suivreVariablesBd({
          idBd: idBdCopie,
          f: (x) => attenteVariables.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.bds.suivreTableauxBd({
          idBd: idBdCopie,
          f: (x) => attenteTableaux.mettreÀJour(x),
        }),
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
      attenteNoms.toutAnnuler();
      attenteDescrs.toutAnnuler();
      attenteLicence.toutAnnuler();
      attenteMotsClefs.toutAnnuler();
      attenteVariables.toutAnnuler();
      attenteTableaux.toutAnnuler();
    });

    it("Les noms sont copiés", async () => {
      const noms = await attenteNoms.attendreExiste();
      expect(noms).to.deep.equal(réfNoms);
    });
    it("Les descriptions sont copiées", async () => {
      const descrs = await attenteDescrs.attendreExiste();
      expect(descrs).to.deep.equal(réfDescrs);
    });
    it("La licence est copiée", async () => {
      const licence = await attenteLicence.attendreExiste();
      expect(licence).to.equal(réfLicence);
    });
    it("Les mots-clefs sont copiés", async () => {
      const motsClefs = await attenteMotsClefs.attendreExiste();
      expect(motsClefs).to.have.members([idMotClef]);
    });
    it("Les tableaux sont copiés", async () => {
      const tableaux = await attenteTableaux.attendreQue((t) => t.length > 0);
      expect(Array.isArray(tableaux)).to.be.true();
      expect(tableaux.length).to.equal(1);
    });
    it("Les variables sont copiées", async () => {
      const variables = await attenteVariables.attendreQue((v) => v.length > 0);
      expect(variables).to.have.members([idVariable]);
    });
  });

  describe("Combiner BDs", function () {
    let idVarClef: string;
    let idVarTrad: string;

    let idBd1: string;
    let idBd2: string;

    let idTableau1: string;
    let idTableau2: string;

    const données1 = new attente.AttendreRésultat<
      élémentDonnées<élémentBdListeDonnées>[]
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idVarClef = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarTrad = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });

      const schéma: schémaSpécificationBd = {
        licence: "ODbl-1_0",
        tableaux: [
          {
            cols: [
              {
                idVariable: idVarClef,
                idColonne: "clef",
                index: true,
              },
              {
                idVariable: idVarTrad,
                idColonne: "trad",
              },
            ],
            clef: "tableau trads",
          },
        ],
      };

      idBd1 = await client.bds.créerBdDeSchéma({ schéma });
      idBd2 = await client.bds.créerBdDeSchéma({ schéma });

      idTableau1 = (
        await uneFois(
          async (
            fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>,
          ): Promise<schémaFonctionOublier> => {
            return await client.bds.suivreTableauxBd({
              idBd: idBd1,
              f: fSuivi,
            });
          },
        )
      )[0].id;
      idTableau2 = (
        await uneFois(
          async (
            fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>,
          ): Promise<schémaFonctionOublier> => {
            return await client.bds.suivreTableauxBd({
              idBd: idBd2,
              f: fSuivi,
            });
          },
        )
      )[0].id;

      type élémentTrad = { clef: string; trad?: string };

      const éléments1: élémentTrad[] = [
        {
          clef: "fr",
          trad: "Constellation",
        },
        {
          clef: "kaq", // Une trad vide, par erreur disons
        },
      ];
      for (const élément of éléments1) {
        await client.tableaux.ajouterÉlément({
          idTableau: idTableau1,
          vals: élément,
        });
      }

      const éléments2: élémentTrad[] = [
        {
          clef: "fr",
          trad: "Constellation!", // Une erreur ici, disons
        },
        {
          clef: "kaq",
          trad: "Ch'umil",
        },
        {
          clef: "हिं",
          trad: "तारामंडल",
        },
      ];
      for (const élément of éléments2) {
        await client.tableaux.ajouterÉlément({
          idTableau: idTableau2,
          vals: élément,
        });
      }

      fsOublier.push(
        await client.tableaux.suivreDonnées({
          idTableau: idTableau1,
          f: (d) => données1.mettreÀJour(d),
          clefsSelonVariables: true,
        }),
      );

      await client.bds.combinerBds({ idBdBase: idBd1, idBd2 });
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
      données1.toutAnnuler();
    });

    it("Les données sont copiées", async () => {
      const val = await données1.attendreQue(
        (x) =>
          x.length > 2 && x.every((y) => Object.keys(y.données).length > 1),
      );
      const donnéesSansId = val.map((d) => d.données);
      expect(Array.isArray(donnéesSansId)).to.be.true();

      expect(donnéesSansId.length).to.equal(3);
      expect(donnéesSansId).to.have.deep.members([
        { [idVarClef]: "fr", [idVarTrad]: "Constellation" },
        { [idVarClef]: "kaq", [idVarTrad]: "Ch'umil" },
        { [idVarClef]: "हिं", [idVarTrad]: "तारामंडल" },
      ]);
    });
  });

  describe("Créer BD de schéma", function () {
    let idVarClef: string;
    let idVarTrad: string;
    let idVarLangue: string;

    let idMotClef: string;

    let idBd: string;

    const tableaux = new attente.AttendreRésultat<infoTableauAvecId[]>();
    const tableauUnique = new attente.AttendreRésultat<string | undefined>();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idVarClef = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarTrad = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarLangue = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });

      idMotClef = await client.motsClefs.créerMotClef();

      const schéma: schémaSpécificationBd = {
        licence: "ODbl-1_0",
        motsClefs: [idMotClef],
        tableaux: [
          {
            cols: [
              {
                idVariable: idVarClef,
                idColonne: "clef",
                index: true,
              },
              {
                idVariable: idVarTrad,
                idColonne: "trad",
              },
            ],
            clef: "tableau trads",
          },
          {
            cols: [
              {
                idVariable: idVarLangue,
                idColonne: "langue",
                index: true,
              },
            ],
            clef: "tableau langues",
          },
        ],
      };

      idBd = await client.bds.créerBdDeSchéma({ schéma });
      fsOublier.push(
        await client.bds.suivreTableauxBd({
          idBd,
          f: (t) => tableaux.mettreÀJour(t),
        }),
      );
      fsOublier.push(
        await client.bds.suivreIdTableauParClef({
          idBd,
          clef: "tableau trads",
          f: (t) => tableauUnique.mettreÀJour(t),
        }),
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    it("Les tableaux sont créés", async () => {
      const val = await tableaux.attendreQue((x) => x.length > 1);

      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(2);
    });

    it("Colonnes", async () => {
      const val = await tableaux.attendreExiste();
      const colonnes = await uneFois(
        async (
          fSuivi: schémaFonctionSuivi<InfoColAvecCatégorie[]>,
        ): Promise<schémaFonctionOublier> => {
          return await client.tableaux.suivreColonnesTableau({
            idTableau: val[0].id,
            f: fSuivi,
            catégories: true,
          });
        },
        (c) => c !== undefined && c.length > 1,
      );

      const idsColonnes = colonnes.map((c) => c.id);
      expect(Array.isArray(idsColonnes)).to.be.true();

      expect(idsColonnes.length).to.equal(2);
      expect(idsColonnes).to.have.members(["clef", "trad"]);
    });

    it("Mots clefs", async () => {
      const motsClefs = await uneFois(
        async (
          fSuivi: schémaFonctionSuivi<string[]>,
        ): Promise<schémaFonctionOublier> => {
          return await client.bds.suivreMotsClefsBd({
            idBd,
            f: fSuivi,
          });
        },
      );
      expect(Array.isArray(motsClefs)).to.be.true();

      expect(motsClefs.length).to.equal(1);
      expect(motsClefs).to.have.members([idMotClef]);
    });

    it("Index colonne", async () => {
      const val = await tableaux.attendreExiste();
      const indexes = await uneFois(
        async (
          fSuivi: schémaFonctionSuivi<string[]>,
        ): Promise<schémaFonctionOublier> => {
          return await client.tableaux.suivreIndex({
            idTableau: val[0].id,
            f: fSuivi,
          });
        },
        (x) => !!x && x.length > 0,
      );
      expect(Array.isArray(indexes)).to.be.true();

      expect(indexes.length).to.equal(1);
      expect(indexes).to.have.members(["clef"]);
    });

    it("Tableaux unique détectable", async () => {
      const val = await tableauUnique.attendreExiste();

      expect(isValidAddress(val)).to.be.true();
    });
  });

  describe("Suivre BD unique", function () {
    let idVarClef: string;
    let idVarTrad: string;
    let idVarLangue: string;

    let fOublier: schémaFonctionOublier;

    const rés = new utilsTestAttente.AttendreRésultat<string>();

    before(async () => {
      idVarClef = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarTrad = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarLangue = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });

      const idNuée = await client.nuées.créerNuée({});

      const schéma: schémaSpécificationBd = {
        licence: "ODbl-1_0",
        tableaux: [
          {
            cols: [
              {
                idVariable: idVarClef,
                idColonne: "clef",
                index: true,
              },
              {
                idVariable: idVarTrad,
                idColonne: "trad",
              },
            ],
            clef: "tableau trads",
          },
          {
            cols: [
              {
                idVariable: idVarLangue,
                idColonne: "langue",
                index: true,
              },
            ],
            clef: "tableau langues",
          },
        ],
      };

      fOublier = await client.bds.suivreBdUnique({
        schéma,
        idNuéeUnique: idNuée,
        f: (id) => rés.mettreÀJour(id),
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
      rés.toutAnnuler();
    });
    it("La BD est créée lorsqu'elle n'existe pas", async () => {
      await rés.attendreExiste();
      expect(isValidAddress(rés.val)).to.be.true();
    });
    it.skip("Gestion de la concurrence entre dispositifs");
    it.skip("Gestion de concurrence entre 2+ BDs");
  });

  describe("Suivre tableau unique", function () {
    let idBd: string;
    let idTableau: string;

    let fOublier: schémaFonctionOublier;

    const rés = new utilsTestAttente.AttendreRésultat<string>();

    before(async () => {
      idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });

      idTableau = await client.bds.ajouterTableauBd({ idBd });

      fOublier = await client.bds.suivreIdTableauParClef({
        idBd: idBd,
        clef: "clefUnique",
        f: (id) => rés.mettreÀJour(id),
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
      rés.toutAnnuler();
    });
    it("Rien pour commencer", async () => {
      expect(rés.val).to.be.undefined();
    });
    it("Ajout de clef détecté", async () => {
      await client.bds.spécifierClefTableau({
        idBd,
        idTableau,
        clef: "clefUnique",
      });
      await rés.attendreExiste();
      expect(rés.val).to.equal(idTableau);
    });
  });

  describe("Suivre tableau unique de BD unique", function () {
    let idVarClef: string;
    let idVarTrad: string;

    let fOublier: schémaFonctionOublier;

    const rés = new utilsTestAttente.AttendreRésultat<string>();

    before(async () => {
      idVarClef = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarTrad = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });

      const idNuée = await client.nuées.créerNuée({});

      const schéma: schémaSpécificationBd = {
        licence: "ODbl-1_0",
        tableaux: [
          {
            cols: [
              {
                idVariable: idVarClef,
                idColonne: "clef",
                index: true,
              },
              {
                idVariable: idVarTrad,
                idColonne: "trad",
              },
            ],
            clef: "id tableau unique",
          },
        ],
      };

      fOublier = await client.bds.suivreIdTableauParClefDeBdUnique({
        schémaBd: schéma,
        idNuéeUnique: idNuée,
        clefTableau: "id tableau unique",
        f: (id) => rés.mettreÀJour(id),
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
      rés.toutAnnuler();
    });

    it("Tableau unique détecté", async () => {
      await rés.attendreExiste();
      expect(isValidAddress(rés.val)).to.be.true();
    });
  });

  describe("Score", function () {
    let idBd: string;
    let idTableau: string;
    let idVarNumérique: string;
    let idVarChaîne: string;
    let idVarNumérique2: string;

    let idColNumérique: string;
    let idColNumérique2: string;

    const attenteScore = new attente.AttendreRésultat<infoScore>();

    let fOublier: schémaFonctionOublier;

    before(async () => {
      idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
      idTableau = await client.bds.ajouterTableauBd({ idBd });

      idVarNumérique = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      idVarNumérique2 = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      idVarChaîne = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });

      fOublier = await client.bds.suivreQualitéBd({
        idBd,
        f: (s) => attenteScore.mettreÀJour(s),
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    describe("Score accessibilité", function () {
      it.skip("À faire");
    });

    describe("Score couverture tests", function () {
      it("`undefined` lorsque aucune colonne", async () => {
        const score = await attenteScore.attendreExiste();
        expect(score.couverture).to.be.undefined();
      });

      it("Ajout de colonnes", async () => {
        idColNumérique = await client.tableaux.ajouterColonneTableau({
          idTableau,
          idVariable: idVarNumérique,
        });
        idColNumérique2 = await client.tableaux.ajouterColonneTableau({
          idTableau,
          idVariable: idVarNumérique2,
        });
        await client.tableaux.ajouterColonneTableau({
          idTableau,
          idVariable: idVarChaîne,
        });
        const score = await attenteScore.attendreQue(
          (s) => s.couverture !== undefined,
        );
        expect(score.couverture).to.equal(0);
      });

      it("Ajout de règles", async () => {
        const règleNumérique: règleBornes = {
          typeRègle: "bornes",
          détails: { type: "fixe", val: 0, op: ">=" },
        };
        await client.tableaux.ajouterRègleTableau({
          idTableau,
          idColonne: idColNumérique,
          règle: règleNumérique,
        });
        let score = await attenteScore.attendreQue(
          (s) => !!s.couverture && s.couverture > 0,
        );
        expect(score.couverture).to.equal(0.5);

        await client.tableaux.ajouterRègleTableau({
          idTableau,
          idColonne: idColNumérique2,
          règle: règleNumérique,
        });
        score = await attenteScore.attendreQue(
          (s) => !!s.couverture && s.couverture > 0.5,
        );
        expect(score.couverture).to.equal(1);
      });
    });

    describe("Score validité", function () {
      let idÉlément: string;

      it("`undefined` pour commencer", async () => {
        const score = await attenteScore.attendreExiste();
        expect(score.valide).to.be.undefined();
      });

      it("Ajout d'éléments", async () => {
        idÉlément = (
          await client.tableaux.ajouterÉlément({
            idTableau,
            vals: {
              [idColNumérique]: -1,
              [idColNumérique2]: 1,
            },
          })
        )[0];
        let score = await attenteScore.attendreQue(
          (s) => !!s.valide && s.valide == 0.5,
        );
        expect(score.valide).to.equal(0.5);
        await client.tableaux.ajouterÉlément({
          idTableau,
          vals: {
            [idColNumérique]: 1,
          },
        });
        score = await attenteScore.attendreQue(
          (s) => !!s.valide && s.valide > 0.5,
        );
        expect(score.valide).to.equal(2 / 3);
      });

      it("Correction des éléments", async () => {
        await client.tableaux.modifierÉlément({
          idTableau,
          vals: { [idColNumérique]: 12 },
          idÉlément,
        });
        const score = await attenteScore.attendreQue(
          (s) => !!s.valide && s.valide > 2 / 3,
        );
        expect(score.valide).to.equal(1);
      });
    });

    describe("Score total", function () {
      it("Calcul du score total", async () => {
        const score = await attenteScore.attendreExiste();
        const total =
          ((score.accès || 0) + (score.couverture || 0) + (score.valide || 0)) /
          3;
        expect(score.total).to.equal(total);
      });
    });
  });

  describe("Exporter données", function () {
    let idBd: string;
    let doc: XLSX.WorkBook;
    let fichiersSFIP: Set<string>;
    let nomFichier: string;
    let cid: string;

    const nomTableau1 = "Tableau 1";
    const nomTableau2 = "Tableau 2";

    before(async () => {
      idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });

      const idTableau1 = await client.bds.ajouterTableauBd({ idBd });
      const idTableau2 = await client.bds.ajouterTableauBd({ idBd });

      const idVarNum = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      const idVarFichier = await client.variables.créerVariable({
        catégorie: "fichier",
      });
      await client.tableaux.ajouterColonneTableau({
        idTableau: idTableau1,
        idVariable: idVarNum,
      });
      const idColFichier = await client.tableaux.ajouterColonneTableau({
        idTableau: idTableau2,
        idVariable: idVarFichier,
      });

      const octets = await obtRessourceTest({
        nomFichier: "logo.svg",
        optsAxios: { responseType: "arraybuffer" },
      });
      cid = await client.ajouterÀSFIP({
        contenu: octets,
        nomFichier: "logo.svg",
      });

      await client.tableaux.ajouterÉlément({
        idTableau: idTableau2,
        vals: {
          [idColFichier]: cid,
        },
      });

      await client.tableaux.sauvegarderNomsTableau({
        idTableau: idTableau1,
        noms: {
          fr: nomTableau1,
        },
      });
      await client.tableaux.sauvegarderNomsTableau({
        idTableau: idTableau2,
        noms: {
          fr: nomTableau2,
        },
      });

      ({ doc, fichiersSFIP, nomFichier } = await client.bds.exporterDonnées({
        idBd,
        langues: ["fr"],
      }));
    });

    it("Doc créé avec tous les tableaux", () => {
      expect(Array.isArray(doc.SheetNames));
      expect(doc.SheetNames).to.have.members([nomTableau1, nomTableau2]);
    });
    it("Fichiers SFIP retrouvés de tous les tableaux", () => {
      expect(isSet(fichiersSFIP)).to.be.true();
      expect(fichiersSFIP.size).to.equal(1);
      expect([...fichiersSFIP]).to.have.deep.members([cid]);
    });

    describe("Exporter document données", function () {
      if (isElectronMain || isNode) {
        let dossierZip: string;
        let fEffacer: () => void;
        let zip: JSZip;

        before(async () => {
          ({ dossier: dossierZip, fEffacer } = await dossiers.dossierTempo());

          await client.bds.exporterDocumentDonnées({
            données: { doc, fichiersSFIP, nomFichier },
            formatDoc: "ods",
            dossier: dossierZip,
            inclureFichiersSFIP: true,
          });
        });

        after(() => {
          if (fEffacer) fEffacer();
        });

        it("Le fichier zip existe", async () => {
          const nomZip = path.join(dossierZip, nomFichier + ".zip");
          expect(fs.existsSync(nomZip)).to.be.true();
          zip = await JSZip.loadAsync(fs.readFileSync(nomZip));
        });

        it("Les données sont exportées", () => {
          const contenu = zip.files[nomFichier + ".ods"];
          expect(contenu).to.exist();
        });

        it("Le dossier pour les données SFIP existe", () => {
          const contenu = zip.files["sfip/"];
          expect(contenu?.dir).to.be.true();
        });

        it("Les fichiers SFIP existent", () => {
          const contenu = zip.files[path.join("sfip", cid.replace("/", "-"))];
          expect(contenu).to.exist();
        });
      }
    });
  });

  describe("Rechercher BDs par mot-clef", function () {
    let fOublier: schémaFonctionOublier;
    let idMotClef: string;
    let idBdRechercheMotsClefs: string;

    const résultats = new attente.AttendreRésultat<string[]>();
    before(async () => {
      idMotClef = await client.motsClefs.créerMotClef();

      fOublier = await client.bds.rechercherBdsParMotsClefs({
        motsClefs: [idMotClef],
        f: (r) => résultats.mettreÀJour(r),
      });

      idBdRechercheMotsClefs = await client.bds.créerBd({
        licence: "ODbl-1_0",
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultats pour commencer", async () => {
      const val = await résultats.attendreExiste();
      expect(val).to.be.an.empty("array");
    });

    it("Ajout d'un mot-clef détecté", async () => {
      await client.bds.ajouterMotsClefsBd({
        idBd: idBdRechercheMotsClefs,
        idsMotsClefs: [idMotClef],
      });

      const val = await résultats.attendreQue((x) => x.length > 0);
      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(1);
      expect(val[0]).to.equal(idBdRechercheMotsClefs);
    });
  });
});
