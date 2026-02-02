import { writeFileSync } from "fs";
import { join } from "path";
import { expect } from "aegir/chai";
import { dossierTempo } from "@constl/utils-tests";
import { créerConstellationsTest, obtenir } from "./utils.js";
import type { DonnéesRangéeTableau } from "@/v2/tableaux.js";
import type { PartielRécursif } from "@/v2/types.js";
import type {
  SourceDonnéesImportationFichier,
  SpécificationAutomatisation,
  SpécificationImporter,
  ÉtatAutomatisation,
  ÉtatAutomatisationErreur,
} from "@/v2/automatisations/types.js";
import type { Constellation } from "@/v2/index.js";
import type { DonnéesRangéeTableauAvecId } from "@/v2/bds/tableaux.js";

describe("Automatisations", function () {
  describe("gestion automatisations", function () {
    let fermer: () => Promise<void>;
    let constls: Constellation[];
    let constl: Constellation;

    let idsComptes: string[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
      }));
      constl = constls[0];
      idsComptes = await Promise.all(
        constls.map((c) => c.compte.obtIdCompte()),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    let id: string;

    it("ajout automatisation", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      id = await constl.automatisations.ajouterAutomatisationExporter({
        fréquence: { type: "manuelle" },
        idObjet: idBd,
        formatDoc: "ods",
        typeObjet: "bd",
        inclureDocuments: false,
      });
      const automatisations = await obtenir<
        PartielRécursif<SpécificationAutomatisation>[]
      >(({ siPasVide }) =>
        constl.automatisations.suivreAutomatisations({ f: siPasVide() }),
      );

      const monDispositif = await constl.compte.obtIdDispositif();
      const réf: SpécificationAutomatisation[] = [
        {
          id,
          type: "exportation",
          typeObjet: "bd",
          fréquence: { type: "manuelle" },
          idObjet: idBd,
          formatDoc: "xlsx",
          inclureDocuments: false,
          dispositifs: [monDispositif],
        },
      ];

      expect(automatisations).to.have.deep.members(réf);
    });

    it("modification automatisation", async () => {
      await constl.automatisations.modifierAutomatisation({
        id,
        automatisation: {
          formatDoc: "ods",
        },
      });

      const automatisations = await obtenir<
        PartielRécursif<SpécificationAutomatisation>[]
      >(({ si }) =>
        constl.automatisations.suivreAutomatisations({ f: si(autos=>(autos?.find(auto=>auto.id === id) as SpécificationImporter).formatDoc !== "xlsx") }),
      );

      const monDispositif = await constl.compte.obtIdDispositif();
      const réf: SpécificationAutomatisation[] = [
        {
          id,
          type: "exportation",
          typeObjet: "bd",
          fréquence: { type: "manuelle" },
          idObjet: idBd,
          formatDoc: "ods",
          inclureDocuments: false,
          dispositifs: [monDispositif],
        },
      ];

      expect(automatisations).to.have.deep.members(réf);

    });

    it("annulation automatisation", async () => {
      await constl.automatisations.annulerAutomatisation({ id });

      const automatisations = await obtenir(({ siVide }) =>
        constl.automatisations.suivreAutomatisations({ f: siVide() }),
      );
      expect(automatisations).to.be.empty();

      const états = await obtenir(({ siVide }) =>
        constl.automatisations.suivreÉtatAutomatisations({ f: siVide() }),
      );
      expect(états).to.be.empty();
    });
  });

  describe("importations", function () {
    let fermer: () => Promise<void>;
    let constls: Constellation[];
    let constl: Constellation;

    let idsComptes: string[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
      }));
      constl = constls[0];
      idsComptes = await Promise.all(
        constls.map((c) => c.compte.obtIdCompte()),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("importer de fichier local", function () {
      let idBd: string;
      let idTableau: string;

      let dossier: string;
      let effacer: () => void;

      let idAuto: string | undefined = undefined;

      beforeEach(async () => {
        ({ dossier, effacer } = await dossierTempo());
        idBd = await constl.bds.créerBd({ licence: "ODBl-1_0" });
        idTableau = await constl.bds.ajouterTableau({ idBd });
      });

      afterEach(async () => {
        if (idAuto)
          await constl.automatisations.annulerAutomatisation({ id: idAuto });
        idAuto = undefined;

        effacer();
      });

      // Fonctionalités d'importation

      it("fichier masqué sur autre dispositif", async () => {
        const adresseFichier = join(dossier, "mes données.csv");

        idAuto = await constl.automatisations.ajouterAutomatisationImporter({
          idBd,
          idTableau,
          fréquence: { type: "manuelle" },
          source: {
            type: "fichier",
            adresseFichier,
            info: { formatDonnées: "feuilleCalcul", nomTableau: "", cols: {} },
          },
        });

        const automatisations = await obtenir<
          PartielRécursif<SpécificationAutomatisation>[]
        >(({ siPasVide }) =>
          constl.automatisations.suivreAutomatisations({
            f: siPasVide(),
            idCompte: idsComptes[0],
          }),
        );
        expect(
          (
            automatisations.find(
              (a) => a.id === idAuto,
            ) as SpécificationImporter<SourceDonnéesImportationFichier>
          ).source.adresseFichier,
        ).to.equal(adresseFichier);

        const automatisationsSurAutre = await obtenir<
          PartielRécursif<SpécificationAutomatisation>[]
        >(({ siPasVide }) =>
          constls[1].automatisations.suivreAutomatisations({
            f: siPasVide(),
            idCompte: idsComptes[0],
          }),
        );
        expect(
          (
            automatisationsSurAutre.find(
              (a) => a.id === idAuto,
            ) as SpécificationImporter<SourceDonnéesImportationFichier>
          ).source?.adresseFichier,
        ).to.be.undefined();
      });

      it("importation données", async () => {
        const colDate = await constl.bds.tableaux.ajouterColonne({ idStructure: idBd, idTableau })
        const colPrécip = await constl.bds.tableaux.ajouterColonne({ idStructure: idBd, idTableau })

        await constl.automatisations.ajouterAutomatisationImporter({
          idBd,
          idTableau,
          fréquence: { type: "dynamique" },
          source: {
            type: "fichier",
            adresseFichier: join(dossier, "données.csv"),
            info: {
              formatDonnées: "feuilleCalcul",
              nomTableau: "",
              cols: { [colDate]: "Date", [colPrécip]: "Précipitation" }
            },
          },
        });
        expect(état).to.deep.equal(réfÉtat);

        const données = await obtenir<
          DonnéesRangéeTableauAvecId<DonnéesRangéeTableau>[]
        >(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si(),
          }),
        );
        const réfDonnées: DonnéesRangéeTableau[] = [];
        expect(données.map((d) => d.données)).to.deep.equal(réfDonnées);
      });

      it("importation fichiers", async () => {
        const colDate = await constl.bds.tableaux.ajouterColonne({ idStructure: idBd, idTableau })
        const colImage = await constl.bds.tableaux.ajouterColonne({ idStructure: idBd, idTableau })
        
        await constl.automatisations.ajouterAutomatisationImporter({
          idBd,
          idTableau,
          fréquence: { type: "dynamique" },
          source: {
            type: "fichier",
            adresseFichier: join(dossier, "données.csv"),
            info: {
              formatDonnées: "feuilleCalcul",
              nomTableau: "",
              cols: { [colDate]: "Date", [colImage]: "Image" }
            },
          },
        });
        expect(état).to.deep.equal(réfÉtat);

        const données = await obtenir<
          DonnéesRangéeTableauAvecId<DonnéesRangéeTableau>[]
        >(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si(),
          }),
        );
        const réfDonnées: DonnéesRangéeTableau[] = [];
        expect(données.map((d) => d.données)).to.deep.equal(réfDonnées);

        // Vérifier fichiers importés dans SFIP
        expect()
      });

      it("erreur si fichier non disponible", async () => {
        idAuto = await constl.automatisations.ajouterAutomatisationImporter({
          idBd,
          idTableau,
          source: {
            type: "fichier",
            adresseFichier: join(dossier, "je n'existe pas.csv"),
            info: { formatDonnées: "feuilleCalcul", nomTableau: "", cols: {} },
          },
        });
        const états = await obtenir<{
          [key: string]: ÉtatAutomatisation;
        }>(({ si }) =>
          constl.automatisations.suivreÉtatAutomatisations({
            f: si((x) => !!x && !!idAuto && Object.keys(x).includes(idAuto)),
          }),
        );

        const réf: ÉtatAutomatisationErreur = {
          type: "erreur",
          erreur: "Fichier non existant",
        };
        expect(états[idAuto]).to.deep.equal(réf);
      });

      it("erreur si fichier corrompu", async () => {
        writeFileSync(
          join(dossier, "fichier corrompu.csv"),
          "Ceci ne sont pas des données csv.",
        );

        idAuto = await constl.automatisations.ajouterAutomatisationImporter({
          idBd,
          idTableau,
          source: {
            type: "fichier",
            adresseFichier: join(dossier, "fichier corrompu.csv"),
            info: { formatDonnées: "feuilleCalcul", nomTableau: "", cols: {} },
          },
        });

        const états = await obtenir<{
          [key: string]: ÉtatAutomatisation;
        }>(({ si }) =>
          constl.automatisations.suivreÉtatAutomatisations({
            f: si((x) => !!x && !!idAuto && Object.keys(x).includes(idAuto)),
          }),
        );

        const réf: ÉtatAutomatisationErreur = {
          type: "erreur",
          erreur: "Fichier corrumpu",
        };
        expect(états[idAuto]).to.deep.equal(réf);
      });

      // Importer de fichier local - fréquence fixe
      /** Importation selon fréquence; état */
      /** Pas réimporté si aucun changement */
      /** Relancer manuellement */
      
      // Importer de fichier local - manuellement
      /** Déclencher manuellement; état */
      /** Relancer manuellement */
      
      // Importer de fichier local - lors de changements
      
      it("importation initiale", async () => {
        await constl.automatisations.ajouterAutomatisationImporter({
          idBd,
          idTableau,
          fréquence: { type: "dynamique" },
          source: {
            type: "fichier",
            info: {},
          },
        });
        expect(état).to.deep.equal(réfÉtat);

        const données = await obtenir<
          DonnéesRangéeTableauAvecId<DonnéesRangéeTableau>[]
        >(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si(),
          }),
        );
        const réfDonnées: DonnéesRangéeTableau[] = [];
        expect(données.map((d) => d.données)).to.deep.equal(réfDonnées);
      });

      it("importation lors de changements au fichier", async () => {
        const réfDonnées: DonnéesRangéeTableau[] = [];
        writeFileSync(fichierSource);

        expect(état).to.deep.equal({});

        const données = await obtenir<
          DonnéesRangéeTableauAvecId<DonnéesRangéeTableau>[]
        >(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si(),
          }),
        );
        expect(données.map((d) => d.données)).to.deep.equal(réfDonnées);
      });
      /** Relancer manuellement */
    });
    
    describe("importer d'URL", function () {
      // Importer d'URL - fréquence fixe
      // Importer d'URL - manuellement
      /** Importation données */
      /** Importation fichiers SFIP */
      /** Erreur si fichier non disponible; état */
      /** Erreur si fichier corrompu; état */

      // Importer d'URL - fréquence fixe
      // Importer d'URL - manuellement
    });

    constl.automatisations.ajouterAutomatisationImporter();
    constl.automatisations.suivreAutomatisations();
    constl.automatisations.suivreÉtatAutomatisations();
    constl.automatisations.modifierAutomatisation();
    constl.automatisations.lancerManuellement();
    constl.automatisations.annulerAutomatisation();

    constl.automatisations.ajouterAutomatisationExporter();
  });

  describe("exportations", function () {
    // Exportations
    it("fichier masqué sur autre dispositif");
    
    // Exportation - fréquence fixe
    /** Pas réexporté si aucun changement */
    /** Réexporté si fichier disparu */
    /** Réexporté lorsque déclanché */
    
    // Exportation - dynamique
    /** Réexporté lors de changements */
    /** Réexporté si fichier disparu */
    /** Réexporté lorsque déclanché */
    
    // Exportation - manuelle
    /** Réexporté lorsque déclanché */
    
    // Exportation - tableaux
    /** Exporter données */
    /** Exporter fichiers */
    
    // Exportation - bds
    /** Exporter données */
    /** Exporter fichiers */
    
    // Exportation - nuées
    /** Exporter données */
    /** Exporter fichiers */
    
    // Exportation - projets
    /** Exporter données */
    /** Exporter fichiers */
  });
});
