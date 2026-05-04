import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "fs";
import path, { basename, join } from "path";
import { expect } from "aegir/chai";
import {
  attendreFichierExiste,
  attendreFichierModifié,
  dossierTempo,
} from "@constl/utils-tests";
import {
  isBrowser,
  isElectronMain,
  isElectronRenderer,
  isNode,
} from "wherearewe";
import { TypedEmitter } from "tiny-typed-emitter";
import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import { attendreStabilité, uneFois } from "@constl/utils-ipa";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";
import { stabiliser } from "@/v2/nébuleuse/utils.js";
import { MESSAGE_NON_DISPO_NAVIGATEUR } from "@/v2/automatisations/utils.js";
import { enleverPréfixesEtOrbite } from "@/v2/utils.js";
import {
  créerConstellationsTest,
  obtenir,
  utiliserFauxChronomètres,
} from "./utils.js";
import { obtRessourceTest } from "./ressources/index.js";
import { attendreQue } from "./appli/utils/fonctions.js";
import type { ConversionColonne } from "@/v2/bds/tableaux.js";
import type { SinonFakeTimers } from "sinon";
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
import type { NestedValue } from "@orbitdb/nested-db";
import type { ClefsExtraction } from "@/v2/importateur/json.js";

const JOURS = 1000 * 60 * 60 * 24;

const pasEnCoursDeSync = async ({
  idAuto,
  constl,
}: {
  idAuto: string;
  constl: Constellation;
}) => {
  await obtenir<{ [clef: string]: ÉtatAutomatisation }>(({ si }) =>
    constl.automatisations.suivreÉtatAutomatisations({
      f: si((états) => !!états && états[idAuto]?.type !== "sync"),
    }),
  );
};

const dernièreModif = (fichier: string): number | undefined => {
  return existsSync(fichier) ? statSync(fichier).mtime.getTime() : undefined;
};

const écrireDonnées = (
  données: DonnéesRangéeTableau[],
  fichier: string,
  conversions?: { [col: string]: string },
) => {
  if (conversions) {
    données = données.map((d) =>
      Object.fromEntries(
        Object.entries(d).map(([col, val]) => [conversions[col], val]),
      ),
    );
  }
  const colonnes = [...new Set(données.map((d) => Object.keys(d)).flat())];
  const texte =
    colonnes.join(",") +
    "\n" +
    données
      .map(
        (d) =>
          colonnes
            .map((c) =>
              d[c] === undefined || d[c] === null ? "" : d[c]?.toString(),
            )
            .join(",") + "\n",
      )
      .join("");
      console.log(texte)
  writeFileSync(fichier, texte);
};

const suiviÉtats = async ({
  idAuto,
  constl,
  dédupliquer = true,
}: {
  idAuto: string;
  constl: Constellation;
  dédupliquer?: boolean;
}) => {
  const historique: ÉtatAutomatisation[] = [];

  const événements = new TypedEmitter<{ modifié: () => void }>();
  const oublier = await constl.automatisations.suivreÉtatAutomatisations({
    f: (états) => {
      const nouvelÉtat = états[idAuto];
      if (
        nouvelÉtat &&
        (!dédupliquer || nouvelÉtat.type !== historique[0]?.type)
      ) {
        historique.unshift(nouvelÉtat);
        console.log(nouvelÉtat);
        événements.emit("modifié");
      }
    },
  });

  return {
    terminer: async ({ min = 1 }: { min?: number } = {}): Promise<
      ÉtatAutomatisation[]
    > => {
      const conditions = () => {
        if (min !== undefined && historique.length < min) return false;
        return true;
      };
      if (conditions()) {
        await oublier();
        return historique.toReversed();
      } else
        return new Promise((résoudre) => {
          événements.on("modifié", async () => {
            if (conditions()) {
              await oublier();
              résoudre(historique.toReversed());
            }
          });
        });
    },
  };
};

const obtEmpreinte = async ({
  idBd,
  constl,
}: {
  idBd: string;
  constl: Constellation;
}): Promise<string> => {
  return await uneFois(
    (f) => constl.bds.suivreEmpreinteTête({ idBd, f }),
    attendreStabilité(100),
  );
};

describe.only("Automatisations", function () {
  describe("gestion automatisations", function () {
    let dossier: string;
    let effacer: () => void;

    let fermer: () => Promise<void>;
    let constls: Constellation[];
    let constl: Constellation;

    before(async () => {
      ({ dossier, effacer } = await dossierTempo());

      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
      }));
      constl = constls[0];
    });

    after(async () => {
      if (fermer) await fermer();

      effacer?.();
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
        dossier,
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
          dossier,
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
          dossier,
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

  describe.only("importations", function () {
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
      describe("paramètres", function () {
        let idBd: string;
        let idTableau: string;

        let dossier: string;
        let effacer: () => void;

        let idAuto: string;

        before(async () => {
          ({ dossier, effacer } = await dossierTempo());
          idBd = await constl.bds.créerBd({ licence: "ODBl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
        });

        after(async () => {
          if (idAuto)
            await constl.automatisations.annulerAutomatisation({ id: idAuto });

          effacer?.();
        });

        it("fichier masqué sur autre dispositif", async () => {
          const adresseFichier = join(dossier, "mes données.csv");

          idAuto = await constl.automatisations.ajouterAutomatisationImporter({
            idBd,
            idTableau,
            fréquence: { type: "manuelle" },
            source: {
              type: "fichier",
              adresseFichier,
              info: {
                formatDonnées: "feuilleCalcul",
                nomTableau: "",
                cols: {},
              },
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
      });

      describe("importer données", function () {
        let idBd: string;
        let idTableau: string;

        let dossier: string;
        let effacer: () => void;

        let idAuto: string;

        beforeEach(async () => {
          ({ dossier, effacer } = await dossierTempo());
          idBd = await constl.bds.créerBd({ licence: "ODBl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
        });

        afterEach(async () => {
          if (idAuto)
            await constl.automatisations.annulerAutomatisation({ id: idAuto });

          effacer?.();
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

          const conversionColonnes = {
            [colDate]: "தேதி",
            [colPrécip]: "Précipitation",
          };
          const réfDonnées: DonnéesRangéeTableau[] = [
            { [colDate]: new Date(1, 1, 2026).getTime(), [colPrécip]: 10 },
            { [colDate]: new Date(1, 2, 2026).getTime(), [colPrécip]: 5 },
          ];

          if (isNode || isElectronMain) {
            écrireDonnées(réfDonnées, adresseFichier, conversionColonnes);
          }

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

          const sÉtats = await suiviÉtats({ idAuto, constl });

          // S'il s'agit du navigateur, on devrait avoir une erreur
          if (isBrowser || isElectronRenderer) {
            const états = await sÉtats.terminer({ min: 1 });
            const réf: ÉtatAutomatisationErreur = {
              type: "erreur",
              erreur: MESSAGE_NON_DISPO_NAVIGATEUR,
              prochaineProgramméeÀ: undefined,
            };
            expect(états).to.have.deep.members([réf]);
            return;
          }

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
          expect(états.map((é) => é.type)).to.deep.equal(réfÉtats);
        });

        it("importation médias", async () => {
          if (isBrowser || isElectronRenderer) return;

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
              idc: "bafybeigpcvasv4p6z2rsyknsddapiu457sgfy73fbrvi5gs2wigczf4pui",
            },
            {
              nom: "mon fichier2",
              chemin: "./fichier2.png",
              données: new TextEncoder().encode("efgh"),
              idc: "bafybeicktzgg5fjm2v5wsqzvo6sqau35ffq5gerllu3lxalfdxjjmv63em",
            },
            {
              nom: "mon fichier3",
              chemin: join("sousdossier", "fichier3.png"),
              données: new TextEncoder().encode("ijkl"),
              idc: "bafybeihz4x2k5xikmn4n23oqc3vv2m5lasxni2odxohzfjaaiiit65564y",
            },
          ];

          const réfDonnées = fichiers.map(({ nom, chemin, idc }) => ({
            [colNom]: nom,
            [colFichier]: join(idc, basename(chemin)),
          }));
          const conversionColonnes = {
            [colNom]: "Nom document",
            [colFichier]: "Fichier",
          };
          const donnéesFichier = fichiers.map(({ nom, chemin }) => ({
            [conversionColonnes[colNom]]: nom,
            [conversionColonnes[colFichier]]: chemin,
          }));

          mkdirSync(join(dossier, "sousdossier"));
          for (const { chemin, données } of fichiers) {
            writeFileSync(join(dossier, chemin), données);
          }
          écrireDonnées(donnéesFichier, adresseFichier);

          // Tester l'automatisation
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
            conversions: [
              { colonne: colFichier, conversion: { type: "fichier" } },
            ],
          });

          const donnéesTableau = await obtenir<
            DonnéesRangéeTableauAvecId<DonnéesRangéeTableau>[]
          >(({ si }) =>
            constl.bds.tableaux.suivreDonnées({
              idStructure: idBd,
              idTableau,
              f: stabiliser()(si((x) => !!x && x.length >= 3)),
            }),
          );

          expect(donnéesTableau.map((d) => d.données)).to.deep.equal(
            réfDonnées,
          );

          // Vérifier fichiers importés dans SFIP
          const hélia = constl.services["hélia"];
          for (const { nom, données } of fichiers) {
            const idSfip = donnéesTableau.find(
              (d) => d.données[colNom] === nom,
            )!.données[colFichier] as string;

            expect(
              await hélia.obtFichierDeSFIP({
                id: idSfip,
              }),
            ).to.deep.equal(données);
          }
        });

        it("conversions", async () => {
          if (isBrowser || isElectronRenderer) return;

          const adresseFichier = join(dossier, "données.csv");
          const colDate = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
          const colPrécip = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });

          const conversionColonnes = {
            [colDate]: "ತಾರೀಖು",
            [colPrécip]: "ಮಳೆ",
          };
          const donnéesFichier: DonnéesRangéeTableau[] = [
            { [colDate]: new Date(1, 1, 2026).getTime(), [colPrécip]: "೧೦" },
            { [colDate]: new Date(1, 2, 2026).getTime(), [colPrécip]: "೫" },
          ];

          écrireDonnées(donnéesFichier, adresseFichier, conversionColonnes);
          const réfDonnées: DonnéesRangéeTableau[] = [
            { [colDate]: new Date(1, 1, 2026).getTime(), [colPrécip]: 0.010 },
            { [colDate]: new Date(1, 2, 2026).getTime(), [colPrécip]: 0.005 },
          ];
          const conversions: ConversionColonne[] = [
            {
              colonne: colPrécip,
              conversion: {
                type: "numérique",
                systèmeNumération: "ಕನ್ನಡ",
                opération: { op: "/", val: 1000 },
              },
            },
          ];

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
            conversions,
          });

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
        });

        it("erreur si fichier non disponible", async () => {
          if (isBrowser || isElectronRenderer) return;

          const adresseFichier = join(dossier, "je n'existe pas encore.csv");
          idAuto = await constl.automatisations.ajouterAutomatisationImporter({
            idBd,
            idTableau,
            source: {
              type: "fichier",
              adresseFichier,
              info: {
                formatDonnées: "feuilleCalcul",
                nomTableau: "",
                cols: {},
              },
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
          if (isBrowser || isElectronRenderer) return;

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
              info: {
                formatDonnées: "feuilleCalcul",
                nomTableau: "",
                cols: {},
              },
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
      });

      describe("fréquence fixe", function () {
        const FRÉQUENCE_IMPORTATION = JOURS * 1; // Tous les jours

        let dossier: string;
        let effacer: () => void;

        let idBd: string;
        let idTableau: string;

        let idAuto: string;
        let fichier: string;

        const idColPrécip = "précip";
        const idColDate = "date";
        const conversionColonnes = {
          [idColDate]: "தேதி",
          [idColPrécip]: "மழை",
        };

        let horloge: SinonFakeTimers;

        before(async function () {
          if (!(isNode || isElectronMain)) this.skip();

          horloge = utiliserFauxChronomètres();

          ({ dossier, effacer } = await dossierTempo());

          fichier = join(dossier, "தரவுத்தளம்.txt");

          // Créer bd
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: idColPrécip,
          });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: idColDate,
          });

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationImporter({
            idBd,
            idTableau,
            source: {
              type: "fichier",
              info: {
                formatDonnées: "feuilleCalcul",
                nomTableau: "",
                cols: conversionColonnes,
              },
              adresseFichier: fichier,
            },
            fréquence: {
              type: "fixe",
              détails: {
                unités: "jours",
                n: FRÉQUENCE_IMPORTATION / JOURS,
              },
            },
          });
        });

        after(async () => {
          horloge.restore();

          effacer?.();

          if (idAuto)
            await constl.automatisations.annulerAutomatisation({ id: idAuto });
        });

        it("importation initiale", async () => {
          // Sauvegarder fichier
          const réfDonnées: DonnéesRangéeTableau[] = [
            { [idColDate]: new Date(1, 1, 2026).getTime(), [idColPrécip]: 10 },
            { [idColDate]: new Date(1, 2, 2026).getTime(), [idColPrécip]: 5 },
          ];
          écrireDonnées(réfDonnées, fichier, conversionColonnes);

          // Vérifier données importées
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 2),
              }),
          );

          expect(données.map((d) => d.données)).to.have.deep.members(
            réfDonnées,
          );
        });

        it("pas de changement si donnnées identiques", async () => {
          const empreinteAvant = await obtEmpreinte({ idBd, constl });
          const sÉtats = await suiviÉtats({ idAuto, constl });

          // Avancer temps
          await horloge.tickAsync(FRÉQUENCE_IMPORTATION * 1.5);

          // Attendre syncronisée
          const états = await sÉtats.terminer({ min: 2 });

          // Empreinte identique
          const empreinte = obtEmpreinte({ idBd, constl });
          expect(empreinte).to.equal(empreinteAvant);

          const réfÉtats: ÉtatAutomatisation["type"][] = ["sync", "programmée"];
          expect(états.map((é) => é.type)).to.deep.equal(réfÉtats);
        });

        it("réimportées si données changent", async () => {
          // Changer fichier
          const nouvellesDonnées: DonnéesRangéeTableau[] = [
            { [idColDate]: new Date(1, 1, 2026).getTime(), [idColPrécip]: 10 },
            { [idColDate]: new Date(1, 2, 2026).getTime(), [idColPrécip]: 5 },
            { [idColDate]: new Date(1, 3, 2026).getTime(), [idColPrécip]: 0 },
          ];
          écrireDonnées(nouvellesDonnées, fichier, conversionColonnes);

          // Avancer temps
          await horloge.tickAsync(FRÉQUENCE_IMPORTATION * 1.5);

          // Données mises à jour
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 3),
              }),
          );

          expect(données.map((d) => d.données)).to.have.deep.members(
            nouvellesDonnées,
          );
        });

        it("réimportées si relancée", async () => {
          // Changer fichier
          const nouvellesDonnées: DonnéesRangéeTableau[] = [
            { [idColDate]: new Date(1, 1, 2026).getTime(), [idColPrécip]: 10 },
            { [idColDate]: new Date(1, 2, 2026).getTime(), [idColPrécip]: 5 },
            { [idColDate]: new Date(1, 3, 2026).getTime(), [idColPrécip]: 0 },
            { [idColDate]: new Date(1, 4, 2026).getTime(), [idColPrécip]: 2 },
          ];
          écrireDonnées(nouvellesDonnées, fichier);

          // Relancer
          await constl.automatisations.lancerManuellement({ id: idAuto });

          // Données mises à jour
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 4),
              }),
          );

          expect(données.map((d) => d.données)).to.have.deep.members(
            nouvellesDonnées,
          );
        });
      });

      describe("fréquence dynamique", function () {
        let dossier: string;
        let effacer: () => void;

        let idBd: string;
        let idTableau: string;

        let idAuto: string;
        let fichier: string;

        let réfDonnées: DonnéesRangéeTableau[];

        const idColPrécip = "précip";
        const idColDate = "date";
        const conversionColonnes = {
          [idColDate]: "தேதி",
          [idColPrécip]: "மழை",
        };

        before(async function () {
          if (!(isNode || isElectronMain)) this.skip();

          ({ dossier, effacer } = await dossierTempo());

          fichier = join(dossier, "தரவுத்தளம்.txt");

          // Créer bd
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: idColPrécip,
          });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: idColDate,
          });

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationImporter({
            idBd,
            idTableau,
            source: {
              type: "fichier",
              info: {
                formatDonnées: "feuilleCalcul",
                nomTableau: "",
                cols: conversionColonnes,
              },
              adresseFichier: fichier,
            },
            fréquence: {
              type: "dynamique",
            },
          });
        });

        after(async () => {
          effacer?.();

          if (idAuto)
            await constl.automatisations.annulerAutomatisation({ id: idAuto });
        });

        it("importation initiale", async () => {
          // Sauvegarder fichier
          réfDonnées = [
            { [idColDate]: new Date(1, 1, 2026).getTime(), [idColPrécip]: 10 },
            { [idColDate]: new Date(1, 2, 2026).getTime(), [idColPrécip]: 5 },
          ];
          écrireDonnées(réfDonnées, fichier, conversionColonnes);

          // Vérifier données importées
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 2),
              }),
          );

          expect(données.map((d) => d.données)).to.have.deep.members(
            réfDonnées,
          );
        });
        it("réimportation lorsque fichier modifié", async () => {
          // Sauvegarder fichier
          réfDonnées = [
            { [idColDate]: new Date(1, 1, 2026).getTime(), [idColPrécip]: 10 },
            { [idColDate]: new Date(1, 2, 2026).getTime(), [idColPrécip]: 5 },
            { [idColDate]: new Date(1, 3, 2026).getTime(), [idColPrécip]: 2 },
          ];
          écrireDonnées(réfDonnées, fichier, conversionColonnes);

          // Vérifier données modifiées
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 3),
              }),
          );

          expect(données.map((d) => d.données)).to.have.deep.members(
            réfDonnées,
          );
        });

        it("réimportation lorsque relancée", async () => {
          // Modifier données dans la bd
          const donnéesAvant = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 3),
              }),
          );
          await constl.bds.tableaux.effacerÉlément({
            idStructure: idBd,
            idTableau,
            idÉlément: donnéesAvant[0].id,
          });

          // Relancer
          await constl.automatisations.lancerManuellement({ id: idAuto });

          // Données bien réimportées
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 3),
              }),
          );

          expect(données.map((d) => d.données)).to.have.deep.members(
            réfDonnées,
          );
        });
      });

      describe("fréquence manuelle", function () {
        let dossier: string;
        let effacer: () => void;

        let idBd: string;
        let idTableau: string;

        let idAuto: string;
        let fichier: string;

        let réfDonnées: DonnéesRangéeTableau[];

        const idColPrécip = "précip";
        const idColDate = "date";
        const conversionColonnes = {
          [idColDate]: "தேதி",
          [idColPrécip]: "மழை",
        };

        let horloge: SinonFakeTimers;

        before(async function () {
          if (!(isNode || isElectronMain)) this.skip();

          horloge = utiliserFauxChronomètres();

          ({ dossier, effacer } = await dossierTempo());

          fichier = join(dossier, "தரவுத்தளம்.txt");

          // Créer bd
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: idColPrécip,
          });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: idColDate,
          });

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationImporter({
            idBd,
            idTableau,
            source: {
              type: "fichier",
              info: {
                formatDonnées: "feuilleCalcul",
                nomTableau: "",
                cols: conversionColonnes,
              },
              adresseFichier: fichier,
            },
            fréquence: {
              type: "manuelle",
            },
          });
        });

        after(async () => {
          horloge.restore();

          effacer?.();

          if (idAuto)
            await constl.automatisations.annulerAutomatisation({ id: idAuto });
        });

        it("pas importées pour commencer", async () => {
          // Sauvegarder fichier
          réfDonnées = [
            { [idColDate]: new Date(1, 1, 2026).getTime(), [idColPrécip]: 10 },
            { [idColDate]: new Date(1, 2, 2026).getTime(), [idColPrécip]: 5 },
          ];
          écrireDonnées(réfDonnées, fichier, conversionColonnes);

          // Données vides
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ siDéfini }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: siDéfini(),
              }),
          );

          expect(données).to.be.empty();
        });

        it("importée lorsque déclanchée", async () => {
          // Déclancher
          await constl.automatisations.lancerManuellement({ id: idAuto });

          // Données importées
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 2),
              }),
          );
          expect(données.map((d) => d.données)).to.deep.equal(réfDonnées);
        });

        it("pas de changement si donnnées identiques", async () => {
          const empreinteAvant = await obtEmpreinte({ idBd, constl });

          // Relancer
          const sÉtats = await suiviÉtats({ idAuto, constl });
          await constl.automatisations.lancerManuellement({ id: idAuto });

          // Attendre syncronisée
          const états = await sÉtats.terminer({ min: 2 });
          const réfÉtats: ÉtatAutomatisation["type"][] = ["sync", "attente"];
          expect(états.map((é) => é.type)).to.deep.equal(réfÉtats);

          // Empreinte identique
          const empreinteMaintenant = await obtEmpreinte({ idBd, constl });
          expect(empreinteAvant).to.equal(empreinteMaintenant);
        });

        it("réimportation si données changent", async () => {
          // Changer données
          réfDonnées = [
            { [idColDate]: new Date(1, 1, 2026).getTime(), [idColPrécip]: 10 },
            { [idColDate]: new Date(1, 2, 2026).getTime(), [idColPrécip]: 5 },
            { [idColDate]: new Date(1, 3, 2026).getTime(), [idColPrécip]: 0 },
          ];
          écrireDonnées(réfDonnées, fichier, conversionColonnes);

          // Relancer
          await constl.automatisations.lancerManuellement({ id: idAuto });

          // Données mises à jour
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 3),
              }),
          );
          expect(données.map((d) => d.données)).to.deep.equal(réfDonnées);
        });
      });
    });

    describe("importer d'URL", function () {
      let mock: AxiosMockAdapter;

      const données: NestedValue = {
        தகவல்கள்: [],
      };

      // Fichiers test
      const fichiers = [
        {
          nom: "mon fichier1",
          url: "https://test.réseau-constellation.ca/fichier1.png",
          données: new TextEncoder().encode("abcd"),
          idc: "bafybeigpcvasv4p6z2rsyknsddapiu457sgfy73fbrvi5gs2wigczf4pui",
        },
        {
          nom: "mon fichier2",
          url: "https://test.réseau-constellation.ca/fichier2.png",
          données: new TextEncoder().encode("efgh"),
          idc: "bafybeicktzgg5fjm2v5wsqzvo6sqau35ffq5gerllu3lxalfdxjjmv63em",
        }
      ];

      const changerDonnéesURL = (
        nouvelles: DonnéesRangéeTableau[],
        conversionsColonnes: { [clef: string]: ClefsExtraction },
      ) => {
        // Implémentation rapide et nonrécursif qui ne fonctionne que pour un seul 
        // niveau d'extraction des clefs
        données.தகவல்கள் = Object.fromEntries(
          Object.entries(nouvelles).map(([col, val]) => [
            conversionsColonnes[col][0],
            val,
          ]),
        );
      };

      before(async () => {
        mock = new AxiosMockAdapter(axios);
        mock
          .onGet("https://test.réseau-constellation.ca/données-test.json")
          .reply(200, données);
        mock
          .onGet("https://test.réseau-constellation.ca/invalides.json")
          .reply(200, new TextEncoder().encode("Nous ne sommes pas vos données."));
        mock
          .onGet("https://test.réseau-constellation.ca/inexistantes.json")
          .reply(404);

        for (const { url, données } of fichiers) {
          mock.onGet(url).reply(200, données)
        }
      });

      after(async () => {
        if (mock) mock.restore();
      });

      describe("importer données", function () {
        let idBd: string;
        let idTableau: string;

        let idAuto: string;

        beforeEach(async () => {
          données.தகவல்கள் = [];

          idBd = await constl.bds.créerBd({ licence: "ODBl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
        });

        afterEach(async () => {
          if (idAuto)
            await constl.automatisations.annulerAutomatisation({ id: idAuto });
        });

        it("importation données", async () => {
          const colDate = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
          const colPrécip = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });

          const conversionColonnes: {[clef: string]: ClefsExtraction} = {
            [colDate]: ["தேதி"],
            [colPrécip]: ["Précipitation"],
          };
          const réfDonnées: DonnéesRangéeTableau[] = [
            { [colDate]: new Date(1, 1, 2026).getTime(), [colPrécip]: 10 },
            { [colDate]: new Date(1, 2, 2026).getTime(), [colPrécip]: 5 },
          ];

          changerDonnéesURL(réfDonnées, conversionColonnes);

          idAuto = await constl.automatisations.ajouterAutomatisationImporter({
            idBd,
            idTableau,
            fréquence: { type: "dynamique" },
            source: {
              type: "url",
              url: "https://test.réseau-constellation.ca/données-test.json",
              info: {
                formatDonnées: "json",
                clefsRacine: ["தகவல்கள்"],
                clefsÉléments: [],
                cols: conversionColonnes,
              },
            },
          });

          const sÉtats = await suiviÉtats({ idAuto, constl });

          // S'il s'agit du navigateur, on devrait avoir une erreur
          if (isBrowser || isElectronRenderer) {
            const états = await sÉtats.terminer({ min: 1 });
            const réf: ÉtatAutomatisationErreur = {
              type: "erreur",
              erreur: MESSAGE_NON_DISPO_NAVIGATEUR,
              prochaineProgramméeÀ: undefined,
            };
            expect(états).to.have.deep.members([réf]);
            return;
          }

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
          expect(états.map((é) => é.type)).to.deep.equal(réfÉtats);
        });

        it("importation médias", async () => {
          const colNom = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
          const colFichier = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });

          const réfDonnées = fichiers.map(({ nom, url }) => ({
            [colNom]: nom,
            [colFichier]: url,
          }));
          const conversionColonnes: {[clef: string]: ClefsExtraction} = {
            [colNom]: ["Nom document"],
            [colFichier]: ["Fichier"],
          };

          changerDonnéesURL(réfDonnées, conversionColonnes);

          // Tester l'automatisation
          idAuto = await constl.automatisations.ajouterAutomatisationImporter({
            idBd,
            idTableau,
            fréquence: { type: "dynamique" },
            source: {
              type: "url",
              url: "https://test.réseau-constellation.ca/données-test.json",
              info: {
                formatDonnées: "json",
                clefsRacine: ["தகவல்கள்"],
                clefsÉléments: [],
                cols: conversionColonnes,
              },
            },
            conversions: [
              { colonne: colFichier, conversion: { type: "fichier" } },
            ],
          });

          const donnéesTableau = await obtenir<
            DonnéesRangéeTableauAvecId<DonnéesRangéeTableau>[]
          >(({ si }) =>
            constl.bds.tableaux.suivreDonnées({
              idStructure: idBd,
              idTableau,
              f: stabiliser()(si((x) => !!x && x.length >= 3)),
            }),
          );

          expect(donnéesTableau.map((d) => d.données)).to.deep.equal(
            réfDonnées,
          );

          // Vérifier fichiers importés dans SFIP
          const hélia = constl.services["hélia"];
          for (const { nom, données } of fichiers) {
            const idSfip = donnéesTableau.find(
              (d) => d.données[colNom] === nom,
            )!.données[colFichier] as string;

            expect(
              await hélia.obtFichierDeSFIP({
                id: idSfip,
              }),
            ).to.deep.equal(données);
          }
        });

        it("erreur si URL non disponible", async () => {
          const colDate = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
          const colPrécip = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });

          const conversionColonnes: {[clef: string]: ClefsExtraction} = {
            [colDate]: ["தேதி"],
            [colPrécip]: ["Précipitation"],
          };

          idAuto = await constl.automatisations.ajouterAutomatisationImporter({
            idBd,
            idTableau,
            source: {
              type: "url",
              url: "https://test.réseau-constellation.ca/inexistantes.json",
              info: {
                formatDonnées: "json",
                clefsRacine: ["தகவல்கள்"],
                clefsÉléments: [],
                cols: conversionColonnes,
              },
            },
            fréquence: {
              type: "fixe",
              détails: {
                unités: "jours",
                n: 1,
              },
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
            erreur: "Données non existantes",
          };
          expect(états[idAuto]).to.deep.equal(réf);
        });

        it("erreur si données corrompues", async () => {
          const colDate = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
          const colPrécip = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });

          const conversionColonnes: {[clef: string]: ClefsExtraction} = {
            [colDate]: ["தேதி"],
            [colPrécip]: ["Précipitation"],
          };

          idAuto = await constl.automatisations.ajouterAutomatisationImporter({
            idBd,
            idTableau,
            source: {
              type: "url",
              url: "https://test.réseau-constellation.ca/invalides.json",
              info: {
                formatDonnées: "json",
                clefsRacine: ["தகவல்கள்"],
                clefsÉléments: [],
                cols: conversionColonnes,
              },
            },
            fréquence: {
              type: "fixe",
              détails: {
                unités: "jours",
                n: 1,
              },
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
            erreur: "Données invalides",
          };
          expect(états[idAuto]).to.deep.equal(réf);
        });
      });

      describe("fréquence fixe", function () {
        const FRÉQUENCE_IMPORTATION = JOURS * 1; // Tous les jours

        let idBd: string;
        let idTableau: string;

        let idAuto: string;

        let réfDonnées: DonnéesRangéeTableau[];

        const idColPrécip = "précip";
        const idColDate = "date";
        const conversionColonnes: { [key: string]: ClefsExtraction } = {
          [idColDate]: ["தேதி"],
          [idColPrécip]: ["பொழிவு"],
        };

        let horloge: SinonFakeTimers;

        before(async function () {
          données.தகவல்கள் = [];

          horloge = utiliserFauxChronomètres();

          // Créer bd
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: idColPrécip,
          });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: idColDate,
          });

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationImporter({
            idBd,
            idTableau,
            source: {
              type: "url",
              url: "https://test.réseau-constellation.ca/données-test.json",
              info: {
                formatDonnées: "json",
                clefsRacine: ["தகவல்கள்"],
                clefsÉléments: [],
                cols: conversionColonnes,
              },
            },
            fréquence: {
              type: "fixe",
              détails: {
                unités: "jours",
                n: FRÉQUENCE_IMPORTATION / JOURS,
              },
            },
          });
        });

        after(async () => {
          horloge.restore();

          if (idAuto)
            await constl.automatisations.annulerAutomatisation({ id: idAuto });
        });

        it("importation initiale", async () => {
          // Sauvegarder donnnées
          réfDonnées = [
            { [idColDate]: new Date(1, 1, 2026).getTime(), [idColPrécip]: 10 },
            { [idColDate]: new Date(1, 2, 2026).getTime(), [idColPrécip]: 5 },
          ];
          changerDonnéesURL(réfDonnées, conversionColonnes);

          // Vérifier données importées
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 2),
              }),
          );

          expect(données.map((d) => d.données)).to.have.deep.members(
            réfDonnées,
          );
        });

        it("pas de changement si donnnées identiques", async () => {
          const empreinteAvant = await obtEmpreinte({ idBd, constl });
          const sÉtats = await suiviÉtats({ idAuto, constl });

          // Avancer temps
          await horloge.tickAsync(FRÉQUENCE_IMPORTATION * 1.5);

          // Attendre syncronisée
          const états = await sÉtats.terminer({ min: 2 });

          // Empreinte identique
          const empreinte = obtEmpreinte({ idBd, constl });
          expect(empreinte).to.equal(empreinteAvant);

          const réfÉtats: ÉtatAutomatisation["type"][] = ["sync", "programmée"];
          expect(états.map((é) => é.type)).to.deep.equal(réfÉtats);
        });

        it("réimportées si données changent", async () => {
          // Changer données
          réfDonnées = [
            { [idColDate]: new Date(1, 1, 2026).getTime(), [idColPrécip]: 10 },
            { [idColDate]: new Date(1, 2, 2026).getTime(), [idColPrécip]: 5 },
            { [idColDate]: new Date(1, 3, 2026).getTime(), [idColPrécip]: 0 },
          ];
          changerDonnéesURL(réfDonnées, conversionColonnes);

          // Avancer temps
          await horloge.tickAsync(FRÉQUENCE_IMPORTATION * 1.5);

          // Données mises à jour
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 3),
              }),
          );

          expect(données.map((d) => d.données)).to.have.deep.members(
            réfDonnées,
          );
        });

        it("réimportées si relancée", async () => {
          // Modifier données dans la bd
          const donnéesAvant = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 3),
              }),
          );
          await constl.bds.tableaux.effacerÉlément({
            idStructure: idBd,
            idTableau,
            idÉlément: donnéesAvant[0].id,
          });

          // Relancer
          await constl.automatisations.lancerManuellement({ id: idAuto });

          // Données mises à jour
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 4),
              }),
          );

          expect(données.map((d) => d.données)).to.have.deep.members(
            réfDonnées,
          );
        });
      });

      describe("fréquence dynamique", function () {
        let idBd: string;
        let idTableau: string;

        let idAuto: string;

        const idColPrécip = "précip";
        const idColDate = "date";
        const conversionColonnes: { [key: string]: ClefsExtraction } = {
          [idColDate]: ["தேதி"],
          [idColPrécip]: ["பொழிவு"],
        };

        before(async function () {
          données.தகவல்கள் = [];

          // Créer bd
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: idColPrécip,
          });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: idColDate,
          });

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationImporter({
            idBd,
            idTableau,
            source: {
              type: "url",
              url: "https://test.réseau-constellation.ca/données-test.json",
              info: {
                formatDonnées: "json",
                clefsRacine: ["தகவல்கள்"],
                clefsÉléments: [],
                cols: conversionColonnes,
              },
            },
            fréquence: {
              type: "dynamique",
            },
          });
        });

        after(async () => {
          if (idAuto)
            await constl.automatisations.annulerAutomatisation({ id: idAuto });
        });

        it("erreur si importation URL dynamique", async () => {
          const états = await obtenir<{
            [key: string]: ÉtatAutomatisation;
          }>(({ si }) =>
            constl.automatisations.suivreÉtatAutomatisations({
              f: si((x) => !!x && !!idAuto && Object.keys(x).includes(idAuto)),
            }),
          );

          // État erreur
          const réf: ÉtatAutomatisationErreur = {
            type: "erreur",
            erreur:
              "Impossible d'établir une importation de fréquence dynamique pour l'importation d'un URL.",
          };
          expect(états[idAuto]).to.deep.equal(réf);
        });
      });

      describe("fréquence manuelle", function () {
        let idBd: string;
        let idTableau: string;

        let idAuto: string;

        let réfDonnées: DonnéesRangéeTableau[];

        const idColPrécip = "précip";
        const idColDate = "date";
        const conversionColonnes: { [key: string]: ClefsExtraction } = {
          [idColDate]: ["தேதி"],
          [idColPrécip]: ["பொழிவு"],
        };

        before(async function () {
          données.தகவல்கள் = [];

          // Créer bd
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: idColPrécip,
          });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: idColDate,
          });

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationImporter({
            idBd,
            idTableau,
            source: {
              type: "url",
              url: "https://test.réseau-constellation.ca/données-test.json",
              info: {
                formatDonnées: "json",
                clefsRacine: ["தகவல்கள்"],
                clefsÉléments: [],
                cols: conversionColonnes,
              },
            },
            fréquence: {
              type: "manuelle",
            },
          });
        });

        after(async () => {
          if (idAuto)
            await constl.automatisations.annulerAutomatisation({ id: idAuto });
        });

        it("pas importées pour commencer", async () => {
          // Établir données
          réfDonnées = [
            { [idColDate]: new Date(1, 1, 2026).getTime(), [idColPrécip]: 10 },
            { [idColDate]: new Date(1, 2, 2026).getTime(), [idColPrécip]: 5 },
          ];
          changerDonnéesURL(réfDonnées, conversionColonnes);

          // Données vides
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ siDéfini }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: siDéfini(),
              }),
          );

          expect(données).to.be.empty();
        });

        it("importées lorsque déclancheé", async () => {
          // Déclancher
          await constl.automatisations.lancerManuellement({ id: idAuto });

          // Données bien importées
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 2),
              }),
          );
          expect(données.map((d) => d.données)).to.deep.equal(réfDonnées);
        });
        
        it("pas de changement si donnnées identiques", async () => {
          // Empreinte initiale
          const empreinteAvant = await obtEmpreinte({ idBd, constl });

          // Relancer
          const sÉtats = await suiviÉtats({ idAuto, constl });
          await constl.automatisations.lancerManuellement({ id: idAuto });

          // Attendre syncronisée
          const états = await sÉtats.terminer({ min: 2 });
          const réfÉtats: ÉtatAutomatisation["type"][] = ["sync", "attente"];
          expect(états.map((é) => é.type)).to.deep.equal(réfÉtats);

          // Empreinte identique
          const empreinteMaintenant = await obtEmpreinte({ idBd, constl });
          expect(empreinteAvant).to.equal(empreinteMaintenant);
        });

        it("réimportation si données changent", async () => {
          // Changer données
          réfDonnées = [
            { [idColDate]: new Date(1, 1, 2026).getTime(), [idColPrécip]: 10 },
            { [idColDate]: new Date(1, 2, 2026).getTime(), [idColPrécip]: 5 },
            { [idColDate]: new Date(1, 3, 2026).getTime(), [idColPrécip]: 0 },
          ];
          changerDonnéesURL(réfDonnées, conversionColonnes);

          // Relancer
          await constl.automatisations.lancerManuellement({ id: idAuto });

          // Données mises à jour
          const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnées({
                idStructure: idBd,
                idTableau,
                f: si((x) => !!x && x.length >= 3),
              }),
          );
          expect(données.map((d) => d.données)).to.deep.equal(réfDonnées);
        });
      });
    });
  });

  describe("exportations", function () {
    let fermer: () => Promise<void>;
    let constls: Constellation[];
    let constl: Constellation;

    let idsComptes: string[];

    before(async function () {
      if (!(isNode || isElectronMain)) this.skip();

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

    describe("paramètres", function () {
      let dossier: string;
      let effacer: () => void;

      let idBd: string;

      let idAuto: string;

      before(async () => {
        ({ dossier, effacer } = await dossierTempo());

        // Créer bd
        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      });

      after(async () => {
        effacer?.();

        if (idAuto)
          await constl.automatisations.annulerAutomatisation({ id: idAuto });
      });

      it("dossier masqué sur autre dispositif", async () => {
        idAuto = await constl.automatisations.ajouterAutomatisationExporter({
          typeObjet: "bd",
          idObjet: idBd,
          formatDoc: "ods",
          inclureDocuments: false,
          fréquence: {
            type: "manuelle",
          },
          dossier,
        });

        // Accessible sur le même dispositif
        const automatisations = await obtenir<
          PartielRécursif<SpécificationAutomatisation>[]
        >(({ si }) =>
          constl.automatisations.suivreAutomatisations({
            f: si((autos) => !!autos?.find((a) => a.id === idAuto)),
            idCompte: idsComptes[0],
          }),
        );
        expect(
          (
            automatisations.find(
              (a) => a.id === idAuto,
            ) as SpécificationExporter
          ).dossier,
        ).to.equal(dossier);

        // Masqué sur un autre dispositif
        const automatisationsSurAutre = await obtenir<
          PartielRécursif<SpécificationAutomatisation>[]
        >(({ si }) =>
          constls[1].automatisations.suivreAutomatisations({
            f: si((autos) => !!autos?.find((a) => a.id === idAuto)),
            idCompte: idsComptes[0],
          }),
        );
        expect(
          (
            automatisationsSurAutre.find(
              (a) => a.id === idAuto,
            ) as SpécificationExporter
          ).dossier,
        ).to.be.undefined();
      });
    });

    describe("exporter données", function () {
      let dossier: string;
      let effacer: () => void;

      let idBd: string;
      let idTableau: string;
      let idColPrécip: string;
      let idColPhoto: string;
      let idc: string;

      let idAuto: string;

      const nomTableauFra = "Météo";
      const nomBdத = "வானிலை தகவல்கள்";

      before(async () => {
        ({ dossier, effacer } = await dossierTempo());

        // Créer bd
        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
        await constl.bds.sauvegarderNom({ idBd, langue: "த", nom: nomBdத });

        idTableau = await constl.bds.ajouterTableau({ idBd });
        idColPrécip = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        idColPhoto = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });

        await constl.bds.tableaux.sauvegarderNoms({
          idStructure: idBd,
          idTableau,
          noms: { fra: nomTableauFra },
        });

        const octets = await obtRessourceTest({
          nomFichier: "logo.svg",
        });
        idc = await constl.services["hélia"].ajouterFichierÀSFIP({
          contenu: octets,
          nomFichier: "logo.svg",
        });

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments: [
            { [idColPhoto]: idc, [idColPrécip]: 12 },
            { [idColPrécip]: 2 },
          ],
        });
      });

      after(async () => {
        effacer?.();
      });

      afterEach(async () => {
        if (idAuto)
          await constl.automatisations.annulerAutomatisation({ id: idAuto });
      });

      describe("exporter tableaux", function () {
        it("données exportées", async () => {
          const dossierTest = join(dossier, uuidv4());
          const fichier = join(dossierTest, nomTableauFra + ".ods");

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationExporter({
            typeObjet: "tableau",
            idObjet: idBd,
            idTableau,
            formatDoc: "ods",
            inclureDocuments: false,
            langues: [],
            fréquence: {
              type: "dynamique",
            },
            dossier: dossierTest,
          });

          // Attendre fichier créé
          await attendreFichierExiste({ fichier });
        });

        it("fichiers exportées", async () => {
          const dossierTest = join(dossier, uuidv4());
          const fichierZip = join(dossierTest, nomTableauFra + ".zip");

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationExporter({
            typeObjet: "tableau",
            idObjet: idBd,
            idTableau,
            formatDoc: "ods",
            inclureDocuments: true,
            langues: ["fra"],
            fréquence: {
              type: "dynamique",
            },
            dossier: dossierTest,
          });

          // Attendre fichier créé
          await attendreFichierExiste({ fichier: fichierZip });

          // Le fichier ZIP est valide
          const zip = await JSZip.loadAsync(readFileSync(fichierZip));

          // Le document des données existe
          expect(zip.files[nomTableauFra + ".ods"]).to.exist();

          // Le dossier pour les données des médias existe
          expect(zip.files["médias/"]?.dir).to.be.true();

          // Les fichiers des médias existent
          expect(
            zip.files[["médias", idc.replace("/", "-")].join("/")],
          ).to.exist();
        });
      });

      describe("exporter bds", function () {
        it("données exportées", async () => {
          const dossierTest = join(dossier, uuidv4());
          const fichier = join(dossierTest, nomBdத + ".ods");

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationExporter({
            typeObjet: "bd",
            idObjet: idBd,
            formatDoc: "ods",
            langues: ["fra"],
            inclureDocuments: false,
            fréquence: {
              type: "dynamique",
            },
            dossier: dossierTest,
          });

          // Attendre fichier créé
          await attendreFichierExiste({ fichier });
        });

        it("fichiers exportées", async () => {
          const dossierTest = join(dossier, uuidv4());
          const fichierZip = join(dossierTest, nomBdத + ".zip");

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationExporter({
            typeObjet: "bd",
            idObjet: idBd,
            formatDoc: "ods",
            inclureDocuments: true,
            langues: ["fra"],
            fréquence: {
              type: "dynamique",
            },
            dossier: dossierTest,
          });

          // Attendre fichier créé
          await attendreFichierExiste({ fichier: fichierZip });

          // Le fichier ZIP est valide
          const zip = await JSZip.loadAsync(readFileSync(fichierZip));

          // Le document des données existe
          expect(zip.files[nomBdத + ".ods"]).to.exist();

          // Le dossier pour les données des médias existe
          expect(zip.files["médias/"]?.dir).to.be.true();

          // Les fichiers des médias existent
          expect(
            zip.files[["médias", idc.replace("/", "-")].join("/")],
          ).to.exist();
        });
      });

      describe.skip("exporter nuées", function () {
        let idNuée: string;
        const nomNuée = "Mon projet de science citoyenne";

        before(async () => {
          const schéma = await constl.bds.créerSchémaDeBd({ idBd });
          idNuée = await constl.nuées.créerNuéeDeSchéma({ schéma });
          await constl.nuées.sauvegarderNom({
            idNuée,
            langue: "fra",
            nom: nomNuée,
          });

          await constl.bds.rejoindreNuée({ idBd, idNuée });
        });

        it("données exportées", async () => {
          const dossierTest = join(dossier, uuidv4());
          const fichier = join(dossierTest, nomNuée + ".ods");

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationExporter({
            typeObjet: "nuée",
            idObjet: idNuée,
            formatDoc: "ods",
            langues: ["fra"],
            inclureDocuments: false,
            fréquence: {
              type: "dynamique",
            },
            dossier: dossierTest,
          });

          // Attendre fichier créé
          await attendreFichierExiste({ fichier });
        });

        it("fichiers exportées", async () => {
          const dossierTest = join(dossier, uuidv4());
          const fichierZip = join(dossierTest, nomNuée + ".zip");

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationExporter({
            typeObjet: "nuée",
            idObjet: idNuée,
            formatDoc: "ods",
            inclureDocuments: true,
            langues: ["fra"],
            fréquence: {
              type: "dynamique",
            },
            dossier: dossierTest,
          });

          // Attendre fichier créé
          await attendreFichierExiste({ fichier: fichierZip });

          // Le fichier ZIP est valide
          const zip = await JSZip.loadAsync(readFileSync(fichierZip));

          // Le document des données existe
          expect(zip.files[nomNuée + ".ods"]).to.exist();

          // Le dossier pour les données des médias existe
          expect(zip.files["médias/"]?.dir).to.be.true();

          // Les fichiers des médias existent
          expect(
            zip.files[["médias", idc.replace("/", "-")].join("/")],
          ).to.exist();
        });
      });

      describe("exporter projets", function () {
        let idProjet: string;

        const nomProjet = "Mon projet";

        before(async () => {
          idProjet = await constl.projets.créerProjet();
          await constl.projets.ajouterBds({ idProjet, idsBds: idBd });
          await constl.projets.sauvegarderNom({
            idProjet,
            langue: "fra",
            nom: nomProjet,
          });
        });

        it("données exportées", async () => {
          const dossierTest = join(dossier, uuidv4());
          const fichierZip = join(dossierTest, nomProjet + ".zip");

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationExporter({
            typeObjet: "projet",
            idObjet: idProjet,
            formatDoc: "ods",
            langues: ["fra"],
            inclureDocuments: false,
            fréquence: {
              type: "dynamique",
            },
            dossier: dossierTest,
          });

          // Attendre fichier créé
          await attendreFichierExiste({ fichier: fichierZip });

          // Le fichier ZIP est valide
          const zip = await JSZip.loadAsync(readFileSync(fichierZip));

          // Les documents des bds existent
          expect(zip.files[nomBdத + ".ods"]).to.exist();

          // Le données des médias n'existent pas
          expect(zip.files["médias/"]?.dir).to.be.true();
          expect(
            zip.files[["médias", idc.replace("/", "-")].join("/")],
          ).to.not.exist();
        });

        it("fichiers exportées", async () => {
          const dossierTest = join(dossier, uuidv4());
          const fichierZip = join(dossierTest, nomProjet + ".zip");

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationExporter({
            typeObjet: "projet",
            idObjet: idProjet,
            formatDoc: "ods",
            inclureDocuments: true,
            langues: ["fra"],
            fréquence: {
              type: "dynamique",
            },
            dossier: dossierTest,
          });

          // Attendre fichier créé
          await attendreFichierExiste({ fichier: fichierZip });

          // Le fichier ZIP est valide
          const zip = await JSZip.loadAsync(readFileSync(fichierZip));

          // Le document des données existe
          expect(zip.files[nomBdத + ".ods"]).to.exist();

          // Le dossier pour les données des médias existe
          expect(zip.files["médias/"]?.dir).to.be.true();

          // Les fichiers des médias existent
          expect(
            zip.files[["médias", idc.replace("/", "-")].join("/")],
          ).to.exist();
        });
      });
    });

    describe("fréquence fixe", function () {
      const FRÉQUENCE_EXPORTATION = 1000 * 60 * 30; // Toutes les demi-heures

      let dossier: string;
      let effacer: () => void;

      let idBd: string;
      let idTableau: string;
      let idColPrécip: string;
      let idColDate: string;

      let idAuto: string;
      let fichier: string;

      let horloge: SinonFakeTimers;

      before(async () => {
        horloge = utiliserFauxChronomètres();

        ({ dossier, effacer } = await dossierTempo());

        // Créer bd
        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
        idTableau = await constl.bds.ajouterTableau({ idBd });
        idColPrécip = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        idColDate = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });

        fichier = path.join(dossier, enleverPréfixesEtOrbite(idBd) + ".ods");

        // Établir automatisation exportation
        idAuto = await constl.automatisations.ajouterAutomatisationExporter({
          typeObjet: "bd",
          idObjet: idBd,
          formatDoc: "ods",
          inclureDocuments: false,
          fréquence: {
            type: "fixe",
            détails: {
              unités: "heures",
              n: FRÉQUENCE_EXPORTATION / (1000 * 60 * 60),
            },
          },
          dossier,
        });
      });

      after(async () => {
        horloge.restore();

        effacer?.();

        if (idAuto)
          await constl.automatisations.annulerAutomatisation({ id: idAuto });
      });

      it("réexportée selon fréquence", async () => {
        // Exportation initiale
        await attendreFichierExiste({ fichier });
        const premièreModif = dernièreModif(fichier);
        expect(premièreModif).to.not.be.undefined();

        // Modifier données
        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments: [{ [idColPrécip]: 0, [idColDate]: Date.now() }],
        });

        // Pas encore exportée
        const dernièreModifAprèsAjout = dernièreModif(fichier);
        expect(dernièreModifAprèsAjout).to.equal(premièreModif);

        // Avancer temps
        const fichierModifié = attendreFichierModifié({ fichier });
        await horloge.tickAsync(FRÉQUENCE_EXPORTATION * 1.5);

        // Réexportée
        await fichierModifié;
        expect(dernièreModifAprèsAjout).to.not.be.undefined();
        expect(dernièreModif(fichier)).to.be.greaterThan(
          dernièreModifAprèsAjout!,
        );
      });

      it.skip("pas réexportée si aucun changement", async () => {
        const dernièreModifAvant = dernièreModif(fichier);

        // Avancer temps
        console.log("tique");
        await horloge.tickAsync(FRÉQUENCE_EXPORTATION * 2.5);
        console.log("toque");
        // Pas réexportée
        await pasEnCoursDeSync({ idAuto, constl });
        const dernièreModifMaintenant = dernièreModif(fichier);

        expect(dernièreModifAvant).to.equal(dernièreModifMaintenant);
      });

      it("réexportée si fichier disparu", async () => {
        // Effacer fichier
        rmSync(fichier);

        // Avancer temps
        await horloge.tickAsync(FRÉQUENCE_EXPORTATION);

        // Bien réexportée
        await attendreFichierExiste({ fichier });

        expect(existsSync(fichier)).to.be.true();
      });

      it.skip("réexportée lorsque déclanchée", async () => {
        const modifié = attendreFichierModifié({ fichier });

        // Relancer
        const avant = Date.now();
        await constl.automatisations.lancerManuellement({ id: idAuto });

        // Bien réexportée
        console.log("on attend la modification");
        await modifié;
        console.log("bien modifié");
        const maintenant = Date.now();

        expect(avant - maintenant).to.be.lessThan(FRÉQUENCE_EXPORTATION);
      });
    });

    describe("fréquence dynamique", function () {
      let dossier: string;
      let effacer: () => void;

      let idBd: string;
      let idTableau: string;
      let idColPrécip: string;
      let idColDate: string;

      let idAuto: string;
      let fichier: string;

      before(async () => {
        ({ dossier, effacer } = await dossierTempo());

        // Créer bd
        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
        idTableau = await constl.bds.ajouterTableau({ idBd });
        idColPrécip = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        idColDate = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });

        fichier = path.join(dossier, enleverPréfixesEtOrbite(idBd) + ".ods");

        // Établir automatisation exportation
        idAuto = await constl.automatisations.ajouterAutomatisationExporter({
          typeObjet: "bd",
          idObjet: idBd,
          formatDoc: "ods",
          inclureDocuments: false,
          fréquence: {
            type: "dynamique",
          },
          dossier,
        });
      });

      after(async () => {
        effacer?.();

        if (idAuto)
          await constl.automatisations.annulerAutomatisation({ id: idAuto });
      });

      it("réexportée lors de changements", async () => {
        // Exportation initiale
        await attendreFichierExiste({ fichier });
        const premièreModif = dernièreModif(fichier);
        expect(premièreModif).to.not.be.undefined();

        // Modifier données
        const fichierModifié = attendreFichierModifié({ fichier });
        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments: [{ [idColPrécip]: 0, [idColDate]: Date.now() }],
        });

        // Bien exportée
        await fichierModifié;
        const dernièreModifAprèsAjout = dernièreModif(fichier);
        expect(dernièreModifAprèsAjout).to.be.greaterThan(premièreModif!);
      });

      it.skip("réexportée si fichier disparu", async () => {
        // Effacer fichier
        rmSync(fichier);

        // Bien réexportée
        await attendreFichierExiste({ fichier });

        expect(existsSync(fichier)).to.be.true();
      });

      it("réexportée lorsque déclanchée", async () => {
        const modifié = attendreFichierModifié({ fichier });

        // Relancer
        const dernièreModifAvant = dernièreModif(fichier);
        await constl.automatisations.lancerManuellement({ id: idAuto });

        // Bien réexportée
        await modifié;

        expect(dernièreModifAvant).to.not.be.undefined();
        expect(dernièreModif(fichier)).to.be.greaterThan(dernièreModifAvant!);
      });
    });

    describe("fréquence manuelle", function () {
      let dossier: string;
      let effacer: () => void;

      let idBd: string;
      let idTableau: string;
      let idColPrécip: string;
      let idColDate: string;

      let idAuto: string;
      let fichier: string;

      before(async () => {
        ({ dossier, effacer } = await dossierTempo());

        // Créer bd
        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
        idTableau = await constl.bds.ajouterTableau({ idBd });
        idColPrécip = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        idColDate = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });

        fichier = path.join(dossier, enleverPréfixesEtOrbite(idBd) + ".ods");

        // Établir automatisation exportation
        idAuto = await constl.automatisations.ajouterAutomatisationExporter({
          typeObjet: "bd",
          idObjet: idBd,
          formatDoc: "ods",
          inclureDocuments: false,
          fréquence: {
            type: "manuelle",
          },
          dossier,
        });
      });

      after(async () => {
        effacer?.();

        if (idAuto)
          await constl.automatisations.annulerAutomatisation({ id: idAuto });
      });

      it("pas exportée pour commencer", async () => {
        await pasEnCoursDeSync({ idAuto, constl });
        expect(existsSync(fichier)).to.be.false();
      });

      it("exportée lorsque déclanchée", async () => {
        const avant = Date.now();
        await constl.automatisations.lancerManuellement({
          id: idAuto,
        });

        await attendreFichierExiste({ fichier });
        expect(dernièreModif(fichier)).to.be.greaterThan(avant);
      });

      it("réexporté uniquement lorsque déclanchée", async () => {
        const dernièreModifAvantChangement = dernièreModif(fichier);

        // Modifier données
        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments: [{ [idColPrécip]: 0, [idColDate]: Date.now() }],
        });

        // Document pas mis à jour
        await pasEnCoursDeSync({ idAuto, constl });
        const dernièreModifAprèsChangement = dernièreModif(fichier);
        expect(dernièreModifAprèsChangement).to.not.be.undefined();
        expect(dernièreModifAprèsChangement).to.equal(
          dernièreModifAvantChangement,
        );

        // Relancer
        const modifié = attendreFichierModifié({ fichier });
        await constl.automatisations.lancerManuellement({
          id: idAuto,
        });

        // Document bien mis à jour
        await modifié;
        const dernièreModifAprèsRelancée = dernièreModif(fichier);
        expect(dernièreModifAprèsRelancée).to.be.greaterThan(
          dernièreModifAprèsChangement!,
        );
      });
    });

    describe("copies", function () {
      const documentsExportés = ({
        dossier,
        nomFichier,
      }: {
        dossier: string;
        nomFichier: string;
      }) => {
        return readdirSync(dossier)
          .filter(
            (f) =>
              basename(f).startsWith(nomFichier) &&
              basename(f).endsWith(".ods"),
          )
          .map((f) => join(dossier, f));
      };

      const attendreExporté = async ({
        dossier,
      }: {
        dossier: string;
      }): Promise<string> => {
        console.log("ici avant");
        const existants = readdirSync(dossier)
          .map((f) => join(dossier, f))
          .filter((f) => statSync(f).isFile());
        console.log("ici après");

        const chokidar = await import("chokidar");

        const écouteur = chokidar.watch(dossier);
        return new Promise((résoudre) =>
          écouteur.on("add", (chemin) => {
            console.log(chemin);
            if (!existants.includes(chemin))
              écouteur.close().then(() => résoudre(chemin));
          }),
        );
      };

      describe("selon nombre", function () {
        let dossier: string;
        let effacer: () => void;

        let idBd: string;
        let idTableau: string;
        let idAuto: string;

        let fichierV1: string;
        let fichierV2: string;
        let fichierV3: string;

        before(async () => {
          ({ dossier, effacer } = await dossierTempo());

          // Créer bd
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationExporter({
            typeObjet: "bd",
            idObjet: idBd,
            formatDoc: "ods",
            inclureDocuments: false,
            fréquence: {
              type: "manuelle",
            },
            copies: {
              type: "n",
              n: 2,
            },
            dossier,
          });
        });

        after(async () => {
          effacer?.();

          if (idAuto)
            await constl.automatisations.annulerAutomatisation({ id: idAuto });
        });

        it("création multiples copies", async () => {
          const pFichierV1 = attendreExporté({ dossier });
          await constl.automatisations.lancerManuellement({ id: idAuto });
          fichierV1 = await pFichierV1;

          const pFichierV2 = attendreExporté({ dossier });
          await constl.automatisations.lancerManuellement({ id: idAuto });
          fichierV2 = await pFichierV2;

          expect(
            documentsExportés({
              dossier,
              nomFichier: enleverPréfixesEtOrbite(idBd),
            }),
          ).to.have.members([fichierV1, fichierV2]);
        });

        it("effacer automatiquement lorsque trop nombreux", async () => {
          // Exporter encore une fois
          const pFichierV3 = attendreExporté({ dossier });
          await constl.automatisations.lancerManuellement({ id: idAuto });
          fichierV3 = await pFichierV3;

          // Le nouveau document prend la place du plus ancien
          await attendreQue(() => !existsSync(fichierV1));
          expect(existsSync(fichierV3)).to.be.true();
          expect(existsSync(fichierV1)).to.be.false();
        });

        it("effacer automatiquement si n modifié", async () => {
          // Modifier l'automatisation
          await constl.automatisations.modifierAutomatisation({
            id: idAuto,
            automatisation: {
              copies: {
                n: 1,
              },
            },
          });

          await attendreQue(() => !existsSync(fichierV2));
          expect(existsSync(fichierV2)).to.be.false();
        });
      });

      describe("selon temps", function () {
        let dossier: string;
        let effacer: () => void;

        let idBd: string;
        let idTableau: string;
        let idAuto: string;

        let fichierV1: string;
        let fichierV2: string;
        let fichierV3: string;

        before(async () => {
          ({ dossier, effacer } = await dossierTempo());

          // Créer bd
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });

          // Établir automatisation exportation
          idAuto = await constl.automatisations.ajouterAutomatisationExporter({
            typeObjet: "bd",
            idObjet: idBd,
            formatDoc: "ods",
            inclureDocuments: false,
            fréquence: {
              type: "manuelle",
            },
            copies: {
              type: "temps",
              temps: {
                unités: "jours",
                n: 100,
              },
            },
            dossier,
          });
        });

        after(async () => {
          effacer?.();

          if (idAuto)
            await constl.automatisations.annulerAutomatisation({ id: idAuto });
        });

        it("création multiples copies", async () => {
          const pFichierV1 = attendreExporté({ dossier });
          await constl.automatisations.lancerManuellement({ id: idAuto });
          fichierV1 = await pFichierV1;

          const pFichierV2 = attendreExporté({ dossier });
          await constl.automatisations.lancerManuellement({ id: idAuto });
          fichierV2 = await pFichierV2;

          await pasEnCoursDeSync({ idAuto, constl });

          expect(
            documentsExportés({
              dossier,
              nomFichier: enleverPréfixesEtOrbite(idBd),
            }),
          ).to.have.members([fichierV1, fichierV2]);
        });

        it("effacer automatiquement lorsque périmées", async () => {
          const ilYA101Jours = new Date(Date.now() - JOURS * 101);
          utimesSync(fichierV1, ilYA101Jours, ilYA101Jours);

          const pFichierV3 = attendreExporté({ dossier });
          await constl.automatisations.lancerManuellement({ id: idAuto });
          fichierV3 = await pFichierV3;

          await pasEnCoursDeSync({ idAuto, constl });

          expect(
            documentsExportés({
              dossier,
              nomFichier: enleverPréfixesEtOrbite(idBd),
            }),
          ).to.have.members([fichierV2, fichierV3]);
        });

        it("effacer automatiquement si temps modifié", async () => {
          // Modifier l'automatisation
          await constl.automatisations.modifierAutomatisation({
            id: idAuto,
            automatisation: {
              copies: {
                type: "temps",
                temps: {
                  unités: "millisecondes",
                  n: 1,
                },
              },
            },
          });

          await attendreQue(() => !existsSync(fichierV3));

          expect(
            documentsExportés({
              dossier,
              nomFichier: enleverPréfixesEtOrbite(idBd),
            }),
          ).to.be.empty();
        });
      });
    });
  });
});
