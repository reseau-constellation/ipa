import JSZip from "jszip";
import { isElectronMain, isNode } from "wherearewe";


import {
  attente,
  dossiers,
  attente as utilsTestAttente,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";

import { expect } from "aegir/chai";
import { type Constellation, créerConstellation } from "@/index.js";
import { obtRessourceTest } from "./ressources/index.js";
import type { schémaFonctionOublier } from "@/types.js";
import type xlsx from "xlsx";

const { créerConstellationsTest } = utilsTestConstellation;

describe("Projets", function () {
  let fOublierClients: () => Promise<void>;
  let clients: Constellation[];
  let client: Constellation;

  let idProjet: string;

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

  describe("Mots-clefs", function () {
    let fOublier: schémaFonctionOublier;
    let idMotClef: string;

    const motsClefs = new attente.AttendreRésultat<
      { source: "projet" | "bds"; idMotClef: string }[]
    >();
    before(async () => {
      fOublier = await client.projets.suivreMotsClefsProjet({
        idProjet: idProjet,
        f: (m) => motsClefs.mettreÀJour(m),
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
      idMotClef = await client.motsClefs.créerMotClef();
      await client.projets.ajouterMotsClefsProjet({
        idProjet,
        idsMotsClefs: idMotClef,
      });
      const val = await motsClefs.attendreQue((x) => x.length > 0);
      expect(val).to.be.an("array").with.lengthOf(1);
    });
    it("Effacer un mot-clef", async () => {
      await client.projets.effacerMotClefProjet({ idProjet, idMotClef });

      const val = await motsClefs.attendreQue((x) => x.length === 0);
      expect(val).to.be.an.empty("array");
    });
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
        await client.projets.suivreBdsProjet({
          idProjet,
          f: (b) => bds.mettreÀJour(b),
        }),
      );
      fsOublier.push(
        await client.projets.suivreMotsClefsProjet({
          idProjet,
          f: (m) => motsClefs.mettreÀJour(m),
        }),
      );
      fsOublier.push(
        await client.projets.suivreVariablesProjet({
          idProjet,
          f: (v) => variables.mettreÀJour(v),
        }),
      );
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
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
      await client.projets.ajouterBdProjet({ idProjet, idBd });

      const val = await bds.attendreQue((x) => x.length > 0);
      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(1);
      expect(val[0]).to.equal(idBd);
    });

    it("Mots-clefs BD détectés", async () => {
      const idMotClef = await client.motsClefs.créerMotClef();
      await client.bds.ajouterMotsClefsBd({
        idBd,
        idsMotsClefs: idMotClef,
      });

      const val = await motsClefs.attendreQue((x) => !!x && x.length > 0);
      expect(val).to.have.deep.members([{ source: "bds", idMotClef }]);
    });

    it("Variables BD détectées", async () => {
      let val = await variables.attendreExiste();
      expect(val).to.be.an.empty("array");

      const idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      const idTableau = await client.bds.ajouterTableauBd({ idBd });

      await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable,
      });

      val = await variables.attendreQue((x) => x.length > 0);
      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(1);
      expect(val[0]).to.equal(idVariable);
    });

    it("Effacer une BD", async () => {
      await client.projets.effacerBdProjet({ idProjet, idBd });

      const val = await bds.attendreQue((x) => !x.length);
      expect(val).to.be.an.empty("array");
    });
  });

  describe("Copier projet", function () {
    let idProjetOrig: string;
    let idProjetCopie: string;

    let idMotClef: string;
    let idBd: string;

    const noms = new attente.AttendreRésultat<{ [key: string]: string }>();
    const descrs = new attente.AttendreRésultat<{
      [key: string]: string;
    }>();
    const motsClefs = new attente.AttendreRésultat<
      { source: "projet" | "bds"; idMotClef: string }[]
    >();
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
      idProjetOrig = await client.projets.créerProjet();

      await client.projets.sauvegarderNomsProjet({
        idProjet: idProjetOrig,
        noms: réfNoms,
      });
      await client.projets.sauvegarderDescriptionsProjet({
        idProjet: idProjetOrig,
        descriptions: réfDescrs,
      });

      idMotClef = await client.motsClefs.créerMotClef();
      await client.projets.ajouterMotsClefsProjet({
        idProjet: idProjetOrig,
        idsMotsClefs: idMotClef,
      });

      idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
      await client.projets.ajouterBdProjet({
        idProjet: idProjetOrig,
        idBd,
      });

      idProjetCopie = await client.projets.copierProjet({
        idProjet: idProjetOrig,
      });

      fsOublier.push(
        await client.projets.suivreNomsProjet({
          idProjet: idProjetCopie,
          f: (x) => noms.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.projets.suivreDescriptionsProjet({
          idProjet: idProjetCopie,
          f: (x) => descrs.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.projets.suivreMotsClefsProjet({
          idProjet: idProjetCopie,
          f: (x) => motsClefs.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.projets.suivreBdsProjet({
          idProjet: idProjetCopie,
          f: (x) => bds.mettreÀJour(x),
        }),
      );
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
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
      const val = await descrs.attendreExiste();
      expect(val).to.deep.equal(réfDescrs);
    });
    it("Les mots-clefs sont copiés", async () => {
      const val = await motsClefs.attendreExiste();
      expect(val).to.have.deep.members([{ source: "projet", idMotClef }]);
    });
    it("Les BDs sont copiées", async () => {
      const val = await bds.attendreQue((x) => x.length > 0);
      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(1);
    });
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
