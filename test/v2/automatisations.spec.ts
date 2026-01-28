import { expect } from "aegir/chai";
import { créerConstellationsTest, obtenir } from "./utils.js";
import type { PartielRécursif } from "@/v2/types.js";
import type { SourceDonnéesImportationFichier, SpécificationAutomatisation, SpécificationImporter, ÉtatAutomatisation, ÉtatAutomatisationErreur } from "@/v2/automatisations/types.js";
import type { Constellation } from "@/v2/index.js";
import { DonnéesRangéeTableau } from "@/v2/tableaux.js";
import { DonnéesRangéeTableauAvecId } from "@/v2/bds/tableaux.js";
import { writeFileSync } from "fs";
import { join } from "path";
import { dossierTempo } from "@constl/utils-tests";

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
      idsComptes = await Promise.all(constls.map((c) => c.compte.obtIdCompte()));
    });
  
    after(async () => {
      if (fermer) await fermer();
    });
  
    let id: string;

    it("ajout automatisation", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" })
      id = await constl.automatisations.ajouterAutomatisationExporter({
        fréquence: { type: "manuelle" },
        idObjet: idBd,
        formatDoc: "ods",
        typeObjet: "bd",
        inclureDocuments: false,
      });
      const automatisations = await obtenir<PartielRécursif<SpécificationAutomatisation>[]>(({ siPasVide }) =>
        constl.automatisations.suivreAutomatisations({ f: siPasVide() }),
      );

      const monDispositif = await constl.compte.obtIdDispositif();
      const réf: SpécificationAutomatisation[] = [{
        id,
        type: "exportation",
        typeObjet: "bd",
        fréquence:  { type: "manuelle" },
        idObjet: idBd,
        formatDoc: "ods",
        inclureDocuments: false,
        dispositifs: [monDispositif]
      }];

      expect(automatisations).to.have.deep.members(réf);
    });

    it("modification automatisation", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });

      await constl.automatisations.modifierAutomatisation({
        id,
        automatisation,
      });
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
      idsComptes = await Promise.all(constls.map((c) => c.compte.obtIdCompte()));
    });
  
    after(async () => {
      if (fermer) await fermer();
    });

    it("importation données", async () => {
      await constl.automatisations.ajouterAutomatisationImporter({
        idBd,
        idTableau,
        fréquence: { type: "dynamique" },
        source: {
          type: "fichier",
          info: {},
        },
      });
      const données = await obtenir(({ f: siPasVide }) =>
        constl.bds.tableaux.suivreDonnées({
          idStructure: idBd,
          idTableau,
          f: siPasVide(),
        }),
      );

      expect(données).to.deep.equal(réf);
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
      })
      
      afterEach(async () => {
        if (idAuto) await constl.automatisations.annulerAutomatisation({ id: idAuto });
        idAuto = undefined;
        
        effacer();
      })

      it("fichier masqué sur autre dispositif", async () => {
        const adresseFichier = join(dossier, "mes données.csv");

        idAuto = await constl.automatisations.ajouterAutomatisationImporter({
          idBd,
          idTableau,
          fréquence: { type: "manuelle" },
          source: { 
            type: "fichier", 
            adresseFichier,
            info: { formatDonnées: "feuilleCalcul", nomTableau: "", cols: {} } 
          }
        });

        const automatisations = await obtenir<PartielRécursif<SpécificationAutomatisation>[]>(({siPasVide}) => constl.automatisations.suivreAutomatisations({ f: siPasVide(), idCompte: idsComptes[0] }))
        expect((automatisations.find(a=>a.id === idAuto) as SpécificationImporter<SourceDonnéesImportationFichier>).source.adresseFichier).to.equal(adresseFichier);

        const automatisationsSurAutre = await obtenir<PartielRécursif<SpécificationAutomatisation>[]>(({siPasVide}) => constls[1].automatisations.suivreAutomatisations({ f: siPasVide(), idCompte: idsComptes[0] }))
        expect((automatisationsSurAutre.find(a=>a.id === idAuto) as SpécificationImporter<SourceDonnéesImportationFichier>).source?.adresseFichier).to.be.undefined();
      });
      
      /** Importation données */
      /** Importation fichiers SFIP */

      it("erreur si fichier non disponible", async () => {
        idAuto = await constl.automatisations.ajouterAutomatisationImporter({
          idBd,
          idTableau,
          source: { 
            type: "fichier", 
            adresseFichier: join(dossier, "je n'existe pas.csv"),
            info: { formatDonnées: "feuilleCalcul", nomTableau: "", cols: {}, } 
          }
        });
        const états = await obtenir<{
          [key: string]: ÉtatAutomatisation;
        }>(({si})=>constl.automatisations.suivreÉtatAutomatisations({
          f: si(x => !!x && !!idAuto && Object.keys(x).includes(idAuto))
        }))

        const réf: ÉtatAutomatisationErreur = {
          type: "erreur",
          erreur: "Fichier non existant"
        }
        expect(états[idAuto]).to.deep.equal(réf);
      });

      it("erreur si fichier corrompu", async () => {
        writeFileSync(join(dossier, "fichier corrompu.csv"), "Ceci ne sont pas des données csv.");

        idAuto = await constl.automatisations.ajouterAutomatisationImporter({
          idBd,
          idTableau,
          source: { 
            type: "fichier", 
            adresseFichier: join(dossier, "fichier corrompu.csv"),
            info: { formatDonnées: "feuilleCalcul", nomTableau: "", cols: {}, } 
          }
        });

        const états = await obtenir<{
          [key: string]: ÉtatAutomatisation;
        }>(({si})=>constl.automatisations.suivreÉtatAutomatisations({
          f: si(x => !!x && !!idAuto && Object.keys(x).includes(idAuto))
        }))
        
        const réf: ÉtatAutomatisationErreur = {
          type: "erreur",
          erreur: "Fichier corrumpu"
        }
        expect(états[idAuto]).to.deep.equal(réf);
      });

      // Importer de fichier local - fréquence fixe
      /** Importation selon fréquence; état */
      /** Pas réimporté si aucun changement */

      // Importer de fichier local - manuellement
      /** Déclencher manuellement; état */

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
        expect(état).to.deep.equal(réfÉtat)

        const données = await obtenir<DonnéesRangéeTableauAvecId<DonnéesRangéeTableau>[]>(({si})=>constl.bds.tableaux.suivreDonnées({ idStructure: idBd, idTableau, f: si()}))
        const réfDonnées: DonnéesRangéeTableau[] = [

        ]
        expect(données.map(d=>d.données)).to.deep.equal(réfDonnées)
      });

      it("importation lors de changements au fichier", async () => {
        const réfDonnées: DonnéesRangéeTableau[] = [

        ]
        writeFileSync(fichierSource, )

        expect(état).to.deep.equal({})

        const données = await obtenir<DonnéesRangéeTableauAvecId<DonnéesRangéeTableau>[]>(({si})=>constl.bds.tableaux.suivreDonnées({ idStructure: idBd, idTableau, f: si()}))
        expect(données.map(d=>d.données)).to.deep.equal(réfDonnées)
      });

      // Importer d'URL - fréquence fixe
      // Importer d'URL - manuellement
      /** Importation données */
      /** Importation fichiers SFIP */
      /** Erreur si fichier non disponible; état */
      /** Erreur si fichier corrompu; état */

    // Importer d'URL - fréquence fixe
    // Importer d'URL - manuellement
    }) 
    

    constl.automatisations.ajouterAutomatisationImporter();
    constl.automatisations.suivreAutomatisations();
    constl.automatisations.suivreÉtatAutomatisations();
    constl.automatisations.modifierAutomatisation();
    constl.automatisations.lancerManuellement();
    constl.automatisations.annulerAutomatisation();

    constl.automatisations.ajouterAutomatisationExporter();
  });

  describe("exportations", function () {
    it("fichier masqué sur autre dispositif");
    // Exportation - tableaux

    // Exportation - bds

    // Exportation - nuées
    /**  */

    // Exportation - projets
  });
});
