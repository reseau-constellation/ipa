import {
  attente as utilsTestAttente,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";
import { isSet } from "lodash-es";
import { isElectronMain, isNode } from "wherearewe";
import { expect } from "aegir/chai";
import { créerConstellation, type Constellation } from "@/index.js";
import { obtRessourceTest } from "./ressources/index.js";
import type { schémaFonctionOublier } from "@/types.js";

import type { élémentDeMembreAvecValid } from "@/reseau.js";
import type { élémentBdListeDonnées } from "@/tableaux.js";

import type { donnéesNuéeExportation } from "@/nuées.js";

import type XLSX from "xlsx";
import type { schémaSpécificationBd } from "@/bds.js";

const { créerConstellationsTest } = utilsTestConstellation;

const générerNuéeTest = async (
  client: Constellation,
  opts: {
    nuéeParent?: string;
    autorisation?: string | "IJPC" | "CJPI";
    ajouter?: boolean;
  } = {},
): Promise<{ idNuée: string; idTableau: string }> => {
  const idNuée = await client.nuées.créerNuée(opts);
  const clefTableau = "principal";

  const idTableau = await client.nuées.ajouterTableauNuée({
    idNuée,
    clefTableau,
  });
  const idVariableNumérique = await client.variables.créerVariable({
    catégorie: "numérique",
  });
  await client.nuées.ajouterColonneTableauNuée({
    idTableau,
    idVariable: idVariableNumérique,
    idColonne: "numérique",
  });
  return { idNuée, idTableau };
};

describe("Nuées", function () {
  if (isElectronMain || isNode) {
    describe("Suivre données", function () {
      let fOublierClients: () => Promise<void>;
      let clients: Constellation[];
      let client: Constellation;

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ fOublier: fOublierClients, clients } = await créerConstellationsTest(
          {
            n: 2,
            créerConstellation,
          },
        ));
        client = clients[0];
      });

      after(async () => {
        if (fOublierClients) await fOublierClients();
        await Promise.allSettled(fsOublier.map((f) => f()));
      });
      describe("Vérifier autorisations", function () {
        it.skip("Nuée");
      });
      describe("Erreurs formats bds", function () {
        it.skip("Nuée");
      });
      describe("Erreurs formats tableaux", function () {
        it.skip("Nuée");
      });
      describe("Erreurs données", function () {
        it.skip("Nuée");
      });

      describe("Toujours inclure les miennes", function () {
        let idNuée: string;
        let idCol: string;
        let id: string;

        const fsOublier: schémaFonctionOublier[] = [];
        const résultatChezMoi = new utilsTestAttente.AttendreRésultat<
          élémentDeMembreAvecValid<élémentBdListeDonnées>[]
        >();
        const résultatChezLesAutres = new utilsTestAttente.AttendreRésultat<
          élémentDeMembreAvecValid<élémentBdListeDonnées>[]
        >();

        before(async () => {
          idNuée = await client.nuées.créerNuée({ autorisation: "CJPI" });

          const idTableau = await client.nuées.ajouterTableauNuée({
            idNuée,
            clefTableau: "principal",
          });
          const idVariableNumérique = await client.variables.créerVariable({
            catégorie: "numérique",
          });
          idCol = await client.nuées.ajouterColonneTableauNuée({
            idTableau,
            idVariable: idVariableNumérique,
            idColonne: "col numérique",
          });
          const { fOublier: fOublierChezMoi } =
            await clients[1].nuées.suivreDonnéesTableauNuée({
              idNuée,
              clefTableau: "principal",
              f: async (x) => résultatChezMoi.mettreÀJour(x),
            });
          fsOublier.push(fOublierChezMoi);

          const { fOublier: fOublierChezLesAutres } =
            await client.nuées.suivreDonnéesTableauNuée({
              idNuée,
              clefTableau: "principal",
              f: async (x) => résultatChezLesAutres.mettreÀJour(x),
            });
          fsOublier.push(fOublierChezLesAutres);

          const schémaNuée = await client.nuées.générerSchémaBdNuée({
            idNuée,
            licence: "ODbl-1_0",
          });
          id = (
            await clients[1].bds.ajouterÉlémentÀTableauUnique({
              schémaBd: schémaNuée,
              idNuéeUnique: idNuée,
              clefTableau: "principal",
              vals: { [idCol]: 3 },
            })
          )[0];
        });

        after(async () => {
          await Promise.allSettled(fsOublier.map((f) => f()));
        });

        it("Mes données aparaissent chez moi", async () => {
          const val = await résultatChezMoi.attendreQue(
            (x) => x && x.length > 0,
          );
          const réf: élémentDeMembreAvecValid<élémentBdListeDonnées> = {
            idCompte: await clients[1].obtIdCompte(),
            élément: {
              données: {
                [idCol]: 3,
              },
              id,
            },
            valid: [],
          };
          expect(val[0]).to.deep.equal(réf);
        });

        it("Mais pas chez les autres", async () => {
          const val = await résultatChezLesAutres.attendreExiste();
          expect(val.length).to.equal(0);
        });
      });

      describe("Toujours inclure les miennes - idNuée non rejoignable", function () {
        let id: string;

        const idNuée =
          "/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX"; // tuNeMeTrouverasPas
        const idCol = "colonne numérique";
        const fsOublier: schémaFonctionOublier[] = [];
        const résultatChezMoi = new utilsTestAttente.AttendreRésultat<
          élémentDeMembreAvecValid<élémentBdListeDonnées>[]
        >();
        const résultatChezLesAutres = new utilsTestAttente.AttendreRésultat<
          élémentDeMembreAvecValid<élémentBdListeDonnées>[]
        >();
        const résultatChezLesAutresSansVérification =
          new utilsTestAttente.AttendreRésultat<
            élémentDeMembreAvecValid<élémentBdListeDonnées>[]
          >();

        before(async () => {
          const idVariableNumérique = await client.variables.créerVariable({
            catégorie: "numérique",
          });

          const schémaBd: schémaSpécificationBd = {
            licence: "ODbl-1_0",
            nuées: [idNuée],
            tableaux: [
              {
                cols: [
                  {
                    idVariable: idVariableNumérique,
                    idColonne: idCol,
                  },
                ],
                clef: "principal",
              },
            ],
          };

          const { fOublier: fOublierChezMoi } =
            await clients[1].nuées.suivreDonnéesTableauNuée({
              idNuée,
              clefTableau: "principal",
              f: async (x) => résultatChezMoi.mettreÀJour(x),
            });
          fsOublier.push(fOublierChezMoi);

          const { fOublier: fOublierChezLesAutres } =
            await client.nuées.suivreDonnéesTableauNuée({
              idNuée,
              clefTableau: "principal",
              f: async (x) => résultatChezLesAutres.mettreÀJour(x),
            });
          fsOublier.push(fOublierChezLesAutres);

          const { fOublier: fOublierChezLesAutresSansVérification } =
            await client.nuées.suivreDonnéesTableauNuée({
              idNuée,
              clefTableau: "principal",
              f: async (x) =>
                résultatChezLesAutresSansVérification.mettreÀJour(x),
              vérifierAutorisation: false,
            });
          fsOublier.push(fOublierChezLesAutresSansVérification);

          id = (
            await clients[1].bds.ajouterÉlémentÀTableauUnique({
              schémaBd,
              idNuéeUnique: idNuée,
              clefTableau: "principal",
              vals: { [idCol]: 3 },
            })
          )[0];
        });

        after(async () => {
          await Promise.allSettled(fsOublier.map((f) => f()));
        });

        it("Mes données aparaissent chez moi", async () => {
          const val = await résultatChezMoi.attendreQue(
            (x) => x && x.length > 0,
          );
          const réf: élémentDeMembreAvecValid<élémentBdListeDonnées> = {
            idCompte: await clients[1].obtIdCompte(),
            élément: {
              données: {
                [idCol]: 3,
              },
              id,
            },
            valid: [],
          };
          expect(val[0]).to.deep.equal(réf);
        });

        it("et chez les autres, s'ils le veulent vraiment", async () => {
          const val = await résultatChezLesAutresSansVérification.attendreQue(
            (x) => x && x.length > 0,
          );
          const réf: élémentDeMembreAvecValid<élémentBdListeDonnées> = {
            idCompte: await clients[1].obtIdCompte(),
            élément: {
              données: {
                [idCol]: 3,
              },
              id,
            },
            valid: [],
          };
          expect(val[0]).to.deep.equal(réf);
        });

        it("Mais pas normalement", async () => {
          const val = await résultatChezLesAutres.attendreExiste();
          expect(val.length).to.equal(0);
        });
      });
    });
  }

  describe("Suivi données descendants", function () {
    let idCol: string;
    let schémaBd: schémaSpécificationBd;
    let idÉlémentNuée: string;
    let idNuée: string;
    let idNuéeParent: string;

    const données = new utilsTestAttente.AttendreRésultat<
      élémentDeMembreAvecValid<élémentBdListeDonnées>[]
    >();
    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idNuéeParent = await client.nuées.créerNuée();
      idNuée = await client.nuées.créerNuée({ nuéeParent: idNuéeParent });
      const idTableau = await client.nuées.ajouterTableauNuée({
        idNuée: idNuéeParent,
        clefTableau: "principal",
      });
      const idVariableNumérique = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      idCol = await client.nuées.ajouterColonneTableauNuée({
        idTableau,
        idVariable: idVariableNumérique,
        idColonne: "col numérique",
      });

      schémaBd = await client.nuées.générerSchémaBdNuée({
        idNuée: idNuéeParent,
        licence: "ODBl-1_0",
      });

      const { fOublier: fOublierDonnées } =
        await client.nuées.suivreDonnéesTableauNuée({
          idNuée: idNuéeParent,
          clefTableau: "principal",
          f: (x) => données.mettreÀJour(x),
          héritage: ["descendance"],
        });
      fsOublier.push(fOublierDonnées);
      fsOublier.push(async () => données.toutAnnuler());
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("Données nuée détectées", async () => {
      idÉlémentNuée = (
        await client.bds.ajouterÉlémentÀTableauUnique({
          schémaBd,
          idNuéeUnique: idNuéeParent,
          clefTableau: "principal",
          vals: { [idCol]: 3 },
        })
      )[0];

      const val = await données.attendreQue((x) => x.length > 0);
      expect(val).to.have.deep.members([
        {
          idCompte: await client.obtIdCompte(),
          élément: {
            données: { [idCol]: 3 },
            id: idÉlémentNuée,
          },
          valid: [],
        },
      ]);
    });

    it("Données nuée enfant détectées", async () => {
      const schémaBdEnfant = await client.nuées.générerSchémaBdNuée({
        idNuée: idNuée,
        licence: "ODBl-1_0",
      });
      const id = (
        await client.bds.ajouterÉlémentÀTableauUnique({
          schémaBd: schémaBdEnfant,
          idNuéeUnique: idNuée,
          clefTableau: "principal",
          vals: { [idCol]: 4 },
        })
      )[0];

      const val = await données.attendreQue((x) => x.length > 1);
      const idCompte = await client.obtIdCompte();
      expect(val).to.have.deep.members([
        {
          idCompte,
          élément: {
            données: { [idCol]: 3 },
            id: idÉlémentNuée,
          },
          valid: [],
        },
        {
          idCompte,
          élément: {
            données: { [idCol]: 4 },
            id,
          },
          valid: [],
        },
      ]);
    });
  });

  describe("Suivre données exportées", function () {
    let fOublierClients: () => Promise<void>;
    let clients: Constellation[];
    let client: Constellation;

    let idNuée: string;
    let schémaNuée: schémaSpécificationBd;
    let idBd: string;

    const résultat =
      new utilsTestAttente.AttendreRésultat<donnéesNuéeExportation>();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
        n: 2,

        créerConstellation,
      }));

      client = clients[0];

      ({ idNuée } = await générerNuéeTest(client));
      schémaNuée = await client.nuées.générerSchémaBdNuée({
        idNuée,
        licence: "ODbl-1_0",
      });
      const fOublierRésultat = await client.nuées.suivreDonnéesExportation({
        idNuée,
        langues: ["fr"],
        f: (x) => résultat.mettreÀJour(x),
      });
      fsOublier.push(fOublierRésultat);
    });

    after(async () => {
      résultat.toutAnnuler();
      await Promise.allSettled(fsOublier.map((f) => f()));
      if (fOublierClients) await fOublierClients();
    });

    it("Suivre noms", async () => {
      await client.nuées.sauvegarderNomNuée({
        idNuée,
        langue: "fr",
        nom: "Nuée test",
      });
      const val = await résultat.attendreQue(
        (x) => !x.nomNuée.startsWith("zdpu"),
      );
      expect(val.nomNuée).to.eq("Nuée test");
    });

    it("Suivre tableaux", async () => {
      idBd = await client.bds.créerBdDeSchéma({
        schéma: schémaNuée,
      });
      await client.bds.ajouterÉlémentÀTableauParClef({
        idBd,
        clefTableau: "principal",
        vals: [{ numérique: 1 }, { numérique: 2 }, { numérique: 3 }],
      });
      const val = await résultat.attendreQue(
        (x) => x.tableaux.length > 0 && x.tableaux[0].données.length >= 3,
      );
      const auteur = await client.obtIdCompte();
      expect(val.tableaux.map((t) => t.données).flat()).to.have.deep.members([
        { numérique: 1, auteur },
        { numérique: 2, auteur },
        { numérique: 3, auteur },
      ]);
    });
  });

  describe("Document données exportées", function () {
    let fOublierClients: () => Promise<void>;
    let clients: Constellation[];
    let client: Constellation;

    let idNuée: string;
    let idTableau1Nuée: string;
    let idTableau2Nuée: string;
    let idColNum: string;

    let idBd: string;
    let doc: XLSX.WorkBook;
    let fichiersSFIP: Set<string>;
    let nomFichier: string;
    let cid: string;

    const nomTableau1 = "Tableau 1";
    const nomTableau2 = "Tableau 2";

    before(async () => {
      ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
        n: 1,

        créerConstellation,
      }));

      client = clients[0];

      idNuée = await client.nuées.créerNuée();
      await client.nuées.sauvegarderNomNuée({
        idNuée,
        langue: "fr",
        nom: "Ma nuée",
      });

      idTableau1Nuée = await client.nuées.ajouterTableauNuée({
        idNuée,
        clefTableau: "tableau 1",
      });
      idTableau2Nuée = await client.nuées.ajouterTableauNuée({
        idNuée,
        clefTableau: "tableau 2",
      });

      const idVarNum = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      const idVarFichier = await client.variables.créerVariable({
        catégorie: "fichier",
      });
      idColNum = await client.nuées.ajouterColonneTableauNuée({
        idTableau: idTableau1Nuée,
        idVariable: idVarNum,
      });
      const idColFichier = await client.nuées.ajouterColonneTableauNuée({
        idTableau: idTableau2Nuée,
        idVariable: idVarFichier,
      });

      const octets = await obtRessourceTest({
        nomFichier: "logo.svg",
      });
      cid = await client.ajouterÀSFIP({
        contenu: octets,
        nomFichier: "logo.svg",
      });

      const schéma = await client.nuées.générerSchémaBdNuée({
        idNuée,
        licence: "ODbl-1_0",
      });
      idBd = await client.bds.créerBdDeSchéma({ schéma });

      await client.bds.ajouterÉlémentÀTableauParClef({
        idBd,
        clefTableau: "tableau 2",
        vals: {
          [idColFichier]: cid,
        },
      });

      await client.nuées.sauvegarderNomsTableauNuée({
        idTableau: idTableau1Nuée,
        noms: {
          fr: nomTableau1,
        },
      });
      await client.nuées.sauvegarderNomsTableauNuée({
        idTableau: idTableau2Nuée,
        noms: {
          fr: nomTableau2,
        },
      });

      ({ doc, fichiersSFIP, nomFichier } =
        await client.nuées.exporterDonnéesNuée({
          idNuée,
          langues: ["fr"],
        }));
    });

    after(async () => {
      if (fOublierClients) await fOublierClients();
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

    it("Nom fichier", () => {
      expect(nomFichier).to.eq("Ma nuée");
    });

    it("Exportable même si nuée non disponible", async () => {
      const schéma = await client.nuées.générerSchémaBdNuée({
        idNuée,
        licence: "ODbl-1_0",
      });
      const idNuéeNExistePas =
        "/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX"; // N'existe pas
      schéma.nuées = [idNuéeNExistePas];
      idBd = await client.bds.créerBdDeSchéma({ schéma });
      await client.bds.ajouterÉlémentÀTableauParClef({
        idBd,
        clefTableau: "tableau 1",
        vals: {
          [idColNum]: 123,
        },
      });

      const { doc, fichiersSFIP, nomFichier } =
        await client.nuées.exporterDonnéesNuée({
          idNuée: idNuéeNExistePas,
          langues: ["fr"],
          clefTableau: "tableau 1",
        });
      expect(Array.isArray(doc.SheetNames));
      expect(doc.SheetNames).to.have.members(["tableau 1"]);

      expect(isSet(fichiersSFIP)).to.be.true();
      expect(fichiersSFIP.size).to.equal(0);

      expect(nomFichier).to.eq(idNuéeNExistePas.slice("/orbitdb/".length));
    });
  });
});
