import { expect } from "aegir/chai";
import { créerConstellationsTest, obtenir } from "./utils.js";
import type { Constellation } from "@/v2/index.js";
import { SpécificationAutomatisation } from "@/v2/automatisations/types.js";

describe("Automatisations", function () {
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

  describe("gestion automatisations", function () {
    let id: string;
    it("ajout automatisation", async () => {
      id = await constl.automatisations.ajouterAutomatisationExporter({
        
      })
      const automatisations = await obtenir(({ siPasVide })=>constl.automatisations.suivreAutomatisations({ f: siPasVide() }))
      const réf: SpécificationAutomatisation[] = [
        {}
      ]

      expect(automatisations).to.have.deep.members(réf)
    })

    it("modification automatisation", async () => {
      await constl.automatisations.modifierAutomatisation({ id, automatisation })
      
    })

    it("annulation automatisation", async () => {
      await constl.automatisations.annulerAutomatisation({ id });

      const automatisations = await obtenir(({ siVide })=>constl.automatisations.suivreAutomatisations({ f: siVide() }))
      expect(automatisations).to.be.empty();
      
      const états = await obtenir(({ siVide })=>constl.automatisations.suivreÉtatAutomatisations({ f: siVide() }))
      expect(états).to.be.empty();
    })
  })

  describe("importations", function () {

    it("fichier masqué sur autre dispositif")

    it("importation données", async () => {
      await constl.automatisations.ajouterAutomatisationImporter({
        idBd,
        idTableau,
        fréquence: { type: "dynamique" },
        source: {
          type: "fichier",
          info: {}
        }
      });
      const données = await obtenir(({f: siPasVide}) => constl.bds.tableaux.suivreDonnées({
        idStructure: idBd,
        idTableau,
        f: siPasVide(),
      }))

      expect(données).to.deep.equal(réf)
      
    });
    // Importer de fichier local
    /** Importation données */
    /** Importation fichiers SFIP */
    /** Erreur si fichier non disponible; état */
    /** Erreur si fichier corrompu; état */

    // Importer de fichier local - fréquence fixe
    /** Importation selon fréquence; état */
    /** Pas réimporté si aucun changement */
    
    // Importer de fichier local - manuellement
    /** Déclencher manuellement; état */

    // Importer de fichier local - lors de changements
    /** Importation si changements au fichier; état */
    /** Données mises à jour */
    
    // Importer d'URL - fréquence fixe
    // Importer d'URL - manuellement

    constl.automatisations.ajouterAutomatisationImporter()
    constl.automatisations.suivreAutomatisations()
    constl.automatisations.suivreÉtatAutomatisations()
    constl.automatisations.modifierAutomatisation()
    constl.automatisations.lancerManuellement()
    constl.automatisations.annulerAutomatisation()

    constl.automatisations.ajouterAutomatisationExporter()


  })

  describe("exportations", function () {

    it("fichier masqué sur autre dispositif")
    // Exportation - tableaux
    
    // Exportation - bds
    
    // Exportation - nuées
    
    // Exportation - projets
    
  })
})