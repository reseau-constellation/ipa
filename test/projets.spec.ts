import JSZip from "jszip";
import { isElectronMain, isNode } from "wherearewe";

import {
  dossiers,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";

import { expect } from "aegir/chai";
import { type Constellation, créerConstellation } from "@/index.js";
import { obtRessourceTest } from "./ressources/index.js";
import type xlsx from "xlsx";

const { créerConstellationsTest } = utilsTestConstellation;

describe("Projets", function () {
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

  describe("Exporter données", function () {
    let idProjet: string;
    let docs: { doc: xlsx.WorkBook; nom: string }[];
    let fichiersSFIP: Set<string>;
    let nomFichier: string;

    let cid: string;

    const nomTableau1 = "Tableau 1";
    const nomTableau2 = "Tableau 2";

    before(async () => {
      idProjet = await client.projets.créerProjet();
      const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
      await client.bds.sauvegarderNomsBd({
        idBd,
        noms: { fr: "Ma BD" },
      });
      await client.projets.ajouterBdProjet({ idProjet, idBd });

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

      const OCTETS = await obtRessourceTest({
        nomFichier: "logo.svg",
      });
      cid = await client.ajouterÀSFIP({
        contenu: OCTETS,
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

      ({ docs, fichiersSFIP, nomFichier } =
        await client.projets.exporterDonnées({
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
      expect([...fichiersSFIP]).to.have.deep.members([cid]);
    });

    if (isElectronMain || isNode) {
      describe("Exporter document projet", function () {
        let dossierZip: string;
        let fEffacer: () => void;

        let nomZip: string;
        let zip: JSZip;

        before(async () => {
          const path = await import("path");

          ({ dossier: dossierZip, fEffacer } = await dossiers.dossierTempo());

          await client.projets.documentDonnéesÀFichier({
            données: { docs, fichiersSFIP, nomFichier },
            formatDoc: "ods",
            dossier: dossierZip,
            inclureDocuments: true,
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
          const contenu = zip.files[["sfip", cid.replace("/", "-")].join("/")];
          expect(contenu).to.exist();
        });
      });
    }
  });
});
