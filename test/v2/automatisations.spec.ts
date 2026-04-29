import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { expect } from "aegir/chai";
import { dossierTempo } from "@constl/utils-tests";
import { stabiliser } from "@/v2/nébuleuse/utils.js";
import { créerConstellationsTest, obtenir } from "./utils.js";
import type {
  DonnéesRangéeTableau,
  DonnéesRangéeTableauAvecId,
} from "@/v2/tableaux.js";
import type { PartielRécursif } from "@/v2/types.js";
import type {
  SourceDonnéesImportationFichier,
  SpécificationAutomatisation,
  SpécificationExporter,
  SpécificationImporter,
  ÉtatAutomatisation,
  ÉtatAutomatisationAttente,
  ÉtatAutomatisationErreur,
} from "@/v2/automatisations/types.js";
import type { Constellation } from "@/v2/index.js";

const écrireDonnées = (données: DonnéesRangéeTableau[], fichier: string) => {
  const colonnes = [...new Set(données.map((d) => Object.keys(d)).flat())];
  const texte =
    colonnes.join(",") +
    "\n" +
    données.map(
      (d) =>
        colonnes.map((c) =>
          d[c] === undefined || d[c] === null ? "" : d[c]?.toString(),
        ).join(",") + "\n",
    ).join("");
  writeFileSync(fichier, texte);
};

const suiviÉtats = async ({idAuto, constl}: {idAuto: string; constl: Constellation}) => {
  const historique: ÉtatAutomatisation[] = []
  const oublier = await constl.automatisations.suivreÉtatAutomatisations({
    f: états => {
      console.log({états})
      const nouvelÉtat = états[idAuto];
      if (nouvelÉtat && nouvelÉtat.type !== historique[0]?.type) historique.unshift(nouvelÉtat)
      console.log({historique})
    }
  })
  console.log("suiviÉtats", idAuto)
  return {
    terminer: async (): Promise<ÉtatAutomatisation[]> => {
      await oublier()
      return historique.toReversed()
    }
  }
}

describe.only("Automatisations", function () {
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
    let idBd: string;

    it("ajout automatisation", async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      id = await constl.automatisations.ajouterAutomatisationExporter({
        fréquence: { type: "manuelle" },
        idObjet: idBd,
        formatDoc: "xlsx",
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
        constl.automatisations.suivreAutomatisations({
          f: si(
            (autos) =>
              (autos?.find((auto) => auto.id === id) as SpécificationExporter)
                .formatDoc !== "xlsx",
          ),
        }),
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

        effacer?.();
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
        console.log({idAuto})
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
        const adresseFichier = join(dossier, "données.csv");
        const colDate = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        const colPrécip = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        
        const conversionColonnes = { [colDate]: "தேதி", [colPrécip]: "Précipitation" }
        const réfDonnées: DonnéesRangéeTableau[] = [
          { [colDate]: new Date(1, 1, 2026).getTime(), [colPrécip]: 10 },
          { [colDate]: new Date(1, 2, 2026).getTime(), [colPrécip]: 5 },
        ];
        const donnéesFichier = réfDonnées.map(d=>Object.fromEntries(Object.entries(d).map(([col, val])=>[conversionColonnes[col], val])))
        écrireDonnées(donnéesFichier, adresseFichier);

        idAuto = await constl.automatisations.ajouterAutomatisationImporter({
          idBd,
          idTableau,
          fréquence: { type: "dynamique" },
          source: {
            type: "fichier",
            adresseFichier,
            info: {
              formatDonnées: "feuilleCalcul",
              nomTableau: "",
              cols: conversionColonnes,
            },
          },
        });

        const sÉtats = await suiviÉtats({ idAuto, constl })
        console.log("ici")
        const données = await obtenir<
          DonnéesRangéeTableauAvecId<DonnéesRangéeTableau>[]
        >(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: stabiliser()(si((x) => !!x && x?.length >= 2)),
          }),
        );

        expect(données.map((d) => d.données)).to.deep.equal(réfDonnées);

        const états = await sÉtats.terminer();
        const réfÉtats: ÉtatAutomatisation["type"][] = ["sync", "écoute"];
        expect(états.map(é=>é.type)).to.deep.equal(réfÉtats);
      });

      it("importation fichiers", async () => {
        const adresseFichier = join(dossier, "données.csv");

        const colNom = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        const colFichier = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });

        // Créer fichiers
        const fichiers = [
          {
            nom: "mon fichier1",
            chemin: "fichier1.png",
            données: new TextEncoder().encode("abcd"),
          },
          {
            nom: "mon fichier2",
            chemin: "./fichier2.png",
            données: new TextEncoder().encode("efgh"),
          },
          {
            nom: "mon fichier3",
            chemin: join("sousdossier", "fichier3.png"),
            données: new TextEncoder().encode("ijkl"),
          },
        ];
        mkdirSync(join(dossier, "sousdossier"));
        for (const { chemin, données } of fichiers) {
          writeFileSync(join(dossier, chemin), données);
        }
        écrireDonnées(
          fichiers.map(({ nom, chemin }) => ({
            "Nom document": nom,
            Fichier: chemin,
          })),
          adresseFichier,
        );

        // Tester l'automatisation
        await constl.automatisations.ajouterAutomatisationImporter({
          idBd,
          idTableau,
          fréquence: { type: "dynamique" },
          source: {
            type: "fichier",
            adresseFichier,
            info: {
              formatDonnées: "feuilleCalcul",
              nomTableau: "",
              cols: { "Nom document": colNom, Fichier: colFichier },
            },
          },
        });

        const donnéesTableau = await obtenir<
          DonnéesRangéeTableauAvecId<DonnéesRangéeTableau>[]
        >(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si((x) => !!x && x.length >= 3),
          }),
        );

        const réfDonnées: DonnéesRangéeTableau[] = [];
        expect(donnéesTableau.map((d) => d.données)).to.deep.equal(réfDonnées);

        // Vérifier fichiers importés dans SFIP
        const hélia = constl.services["hélia"];
        for (const { nom, données } of fichiers) {
          const idSfip = donnéesTableau.find((d) => d.données[colNom] === nom)!
            .données[colFichier] as string;
          expect(
            await hélia.obtFichierDeSFIP({
              id: idSfip,
            }),
          ).to.deep.equal(données);
        }
      });

      it("erreur si fichier non disponible", async () => {
        const adresseFichier = join(dossier, "je n'existe pas encore.csv");
        idAuto = await constl.automatisations.ajouterAutomatisationImporter({
          idBd,
          idTableau,
          source: {
            type: "fichier",
            adresseFichier,
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

        écrireDonnées([{ col1: 1, col2: 2 }], adresseFichier);

        const étatsAprèsÉcriture = await obtenir<{
          [key: string]: ÉtatAutomatisation;
        }>(({ si }) =>
          constl.automatisations.suivreÉtatAutomatisations({
            f: si((x) => !!x && !!idAuto && Object.keys(x).includes(idAuto)),
          }),
        );

        const réfAprèsÉcriture: ÉtatAutomatisationAttente = {
          type: "attente",
        };
        expect(étatsAprèsÉcriture[idAuto]).to.deep.equal(réfAprèsÉcriture);
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

      it("conversions");

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

    // constl.automatisations.ajouterAutomatisationImporter();
    // constl.automatisations.suivreAutomatisations();
    // constl.automatisations.suivreÉtatAutomatisations();
    // constl.automatisations.modifierAutomatisation();
    // constl.automatisations.lancerManuellement();
    // constl.automatisations.annulerAutomatisation();

    // constl.automatisations.ajouterAutomatisationExporter();
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

    // Exportation - copies
    /** Copies selon nombre */
    /** Copies selon temps */

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
