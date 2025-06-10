import { isValidAddress } from "@orbitdb/core";
import XLSX from "xlsx";
import {
  attente,
  attente as utilsTestAttente,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";
import { isSet } from "lodash-es";
import { isElectronMain, isNode } from "wherearewe";
import { expect } from "aegir/chai";
import { créerConstellation, type Constellation } from "@/index.js";
import { TraducsNom, schémaFonctionOublier, schémaStatut } from "@/types.js";

import { infoTableauAvecId, schémaSpécificationBd } from "@/bds.js";
import { élémentDeMembreAvecValid } from "@/reseau.js";
import { InfoColAvecCatégorie, élémentBdListeDonnées } from "@/tableaux.js";

import { donnéesNuéeExportation } from "@/nuées.js";
import { règleColonne } from "@/valid.js";

import { obtRessourceTest } from "./ressources/index.js";
import { obtenir } from "./utils/utils.js";

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

const idsCorrespondantes = async (
  résultat: attente.AttendreRésultat<string[]>,
  ids: { [nom: string]: string },
) => {
  const nIdsDésirées = Object.keys(ids).length;
  const val = await résultat.attendreQue((x) => x.length > nIdsDésirées - 1);
  expect(
    val.map(
      (x) => Object.entries(ids).find(([_nom, id]) => id === x)?.[0] || x,
    ),
  )
    .to.have.members(Object.keys(ids))
    .lengthOf(nIdsDésirées);
};

describe.only("Nuées", function () {
  describe("Tests individuels", function () {
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

    describe("Création", function () {
      it("Nuée", async () => {
        const idNuée = await client.nuées.créerNuée();
        expect(isValidAddress(idNuée)).to.be.true();
      });
    });

    describe("Noms", function () {
      let idNuée: string;

      before(async () => {
        idNuée = await client.nuées.créerNuée();
      });

      it("Pas de noms pour commencer", async () => {
        const noms = await obtenir<TraducsNom>(({ siDéfini }) =>
          client.nuées.suivreNomsNuée({
            idNuée,
            f: siDéfini(),
          }),
        );
        expect(Object.keys(noms).length).to.equal(0);
      });

      it("Ajouter un nom", async () => {
        await client.nuées.sauvegarderNomsNuée({
          idNuée,
          noms: { fr: "Alphabets" },
        });
        const noms = await obtenir<TraducsNom>(({ siPasVide }) =>
          client.nuées.suivreNomsNuée({
            idNuée,
            f: siPasVide(),
          }),
        );
        expect(noms.fr).to.equal("Alphabets");
      });

      it("Ajouter des noms", async () => {
        await client.nuées.sauvegarderNomsNuée({
          idNuée,
          noms: {
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          },
        });
        const noms = await obtenir<TraducsNom>(({ si }) =>
          client.nuées.suivreNomsNuée({
            idNuée,
            f: si((x) => !!x.हिं),
          }),
        );
        expect(noms).to.deep.equal({
          fr: "Alphabets",
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        });
      });

      it("Changer un nom", async () => {
        await client.nuées.sauvegarderNomsNuée({
          idNuée,
          noms: { fr: "Systèmes d'écriture" },
        });
        const noms = await obtenir<TraducsNom>(({ si }) =>
          client.nuées.suivreNomsNuée({
            idNuée,
            f: si((x) => x.fr !== "Alphabets"),
          }),
        );
        expect(noms.fr).to.equal("Systèmes d'écriture");
      });

      it("Effacer un nom", async () => {
        await client.nuées.effacerNomNuée({ idNuée, langue: "fr" });
        const noms = await obtenir<TraducsNom>(({ si }) =>
          client.nuées.suivreNomsNuée({
            idNuée,
            f: si((x) => !x.fr),
          }),
        );
        expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
      });
    });

    describe("Descriptions", function () {
      let idNuée: string;
      let fOublier: schémaFonctionOublier;

      const descr = new utilsTestAttente.AttendreRésultat<{
        [key: string]: string;
      }>();

      before(async () => {
        idNuée = await client.nuées.créerNuée();
        fOublier = await client.nuées.suivreDescriptionsNuée({
          idNuée,
          f: (n) => descr.mettreÀJour(n),
        });
      });

      after(async () => {
        if (fOublier) await fOublier();
      });

      it("Pas de descriptions pour commencer", async () => {
        const val = await descr.attendreExiste();
        expect(Object.keys(val).length).to.equal(0);
      });

      it("Ajouter une description", async () => {
        await client.nuées.sauvegarderDescriptionsNuée({
          idNuée,
          descriptions: { fr: "Alphabets" },
        });
        const val = await descr.attendreQue((x) => Object.keys(x).length > 0);
        expect(val.fr).to.equal("Alphabets");
      });

      it("Ajouter des descriptions", async () => {
        await client.nuées.sauvegarderDescriptionsNuée({
          idNuée,
          descriptions: {
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          },
        });
        const val = await descr.attendreQue((x) => !!x.हिं);
        expect(val).to.deep.equal({
          fr: "Alphabets",
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        });
      });

      it("Changer une description", async () => {
        await client.nuées.sauvegarderDescriptionsNuée({
          idNuée,
          descriptions: { fr: "Systèmes d'écriture" },
        });
        const val = await descr.attendreQue((x) => x.fr !== "Alphabets");
        expect(val?.fr).to.equal("Systèmes d'écriture");
      });

      it("Effacer une description", async () => {
        await client.nuées.effacerDescriptionNuée({
          idNuée,
          langue: "fr",
        });
        const val = await descr.attendreQue((x) => !x.fr);
        expect(val).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
      });
    });

    describe("Mots-clefs", function () {
      let idMotClef: string;
      let idNuée: string;

      let fOublier: schémaFonctionOublier;

      const motsClefs = new utilsTestAttente.AttendreRésultat<string[]>();

      before(async () => {
        idNuée = await client.nuées.créerNuée();
        fOublier = await client.nuées.suivreMotsClefsNuée({
          idNuée,
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
        await client.nuées.ajouterMotsClefsNuée({
          idNuée,
          idsMotsClefs: idMotClef,
        });
        const val = await motsClefs.attendreQue((x) => x.length > 0);

        expect(val).to.contain(idMotClef);
      });
      it("Effacer un mot-clef", async () => {
        await client.nuées.effacerMotClefNuée({ idNuée, idMotClef });
        const val = await motsClefs.attendreQue((x) => !x.includes(idMotClef));

        expect(val).to.be.an.empty("array");
      });
    });

    describe("Génération schémas", function () {
      let idNuée: string;
      let idsMotsClefs: string[];
      let idVarChaîne: string;
      let idVarNumérique: string;
      let idsTableaux: string[];
      let schéma: schémaSpécificationBd;

      before(async () => {
        idNuée = await client.nuées.créerNuée();

        idsMotsClefs = [
          await client.motsClefs.créerMotClef(),
          await client.motsClefs.créerMotClef(),
        ];
        await client.nuées.ajouterMotsClefsNuée({ idNuée, idsMotsClefs });

        idVarChaîne = await client.variables.créerVariable({
          catégorie: "chaîne",
        });
        idVarNumérique = await client.variables.créerVariable({
          catégorie: "numérique",
        });

        idsTableaux = [
          await client.nuées.ajouterTableauNuée({
            idNuée,
            clefTableau: "tableau 1",
          }),
          await client.nuées.ajouterTableauNuée({
            idNuée,
            clefTableau: "tableau 2",
          }),
        ];
        for (const idTableau of idsTableaux) {
          await client.nuées.ajouterColonneTableauNuée({
            idTableau,
            idVariable: idVarChaîne,
            idColonne: "colonne chaîne",
            index: true,
          });
          await client.nuées.ajouterColonneTableauNuée({
            idTableau,
            idVariable: idVarNumérique,
            idColonne: "colonne numérique",
          });
        }

        await client.nuées.ajouterRègleTableauNuée({
          idTableau: idsTableaux[1],
          idColonne: "colonne numérique",
          règle: { typeRègle: "existe", détails: {} },
        });

        schéma = await client.nuées.générerSchémaBdNuée({
          idNuée,
          licence: "ODBl-1_0",
        });
      });

      it("Nuée incluse", async () => {
        expect(schéma.nuées).to.be.an("array").contain(idNuée);
      });
      it("Mots-clefs inclus", async () => {
        expect(schéma.motsClefs).to.be.an("array").deep.equal(idsMotsClefs);
      });
      it("Tableaux et colonnes incluses", async () => {
        expect(schéma.tableaux).to.deep.equal([
          {
            cols: [
              {
                idVariable: idVarChaîne,
                idColonne: "colonne chaîne",
                index: true,
                optionnelle: true,
              },
              {
                idVariable: idVarNumérique,
                idColonne: "colonne numérique",
                optionnelle: true,
                index: false,
              },
            ],
            clef: "tableau 1",
          },
          {
            cols: [
              {
                idVariable: idVarChaîne,
                idColonne: "colonne chaîne",
                optionnelle: true,
                index: true,
              },
              {
                idVariable: idVarNumérique,
                idColonne: "colonne numérique",
                optionnelle: false,
                index: false,
              },
            ],
            clef: "tableau 2",
          },
        ]);
      });
    });

    describe("Mes nuées", function () {
      let fOublier: schémaFonctionOublier;
      let idNuée: string;
      let idNouvelleNuée: string;

      const nuées = new utilsTestAttente.AttendreRésultat<string[]>();

      before(async () => {
        idNuée = await client.nuées.créerNuée();
        fOublier = await client.nuées.suivreNuées({
          f: (_nuées) => nuées.mettreÀJour(_nuées),
        });
      });
      after(async () => {
        if (fOublier) await fOublier();
      });
      it("On crée une autre nuée sans l'ajouter", async () => {
        idNouvelleNuée = await client.nuées.créerNuée();
        await client.nuées.enleverDeMesNuées({ idNuée: idNouvelleNuée });
        const val = await nuées.attendreQue(
          (x) => x && !x.includes(idNouvelleNuée),
        );
        expect(val).to.be.an("array").and.not.to.contain(idNouvelleNuée);
      });
      it("La nuée déjà ajoutée est présente", async () => {
        const val = await nuées.attendreExiste();
        expect(val).to.be.an("array").and.to.contain(idNuée);
      });

      it("On peut l'ajouter ensuite à mes bds", async () => {
        await client.nuées.ajouterÀMesNuées({ idNuée: idNouvelleNuée });
        const val = await nuées.attendreQue((x) => x.includes(idNouvelleNuée));

        expect(val).to.be.an("array").and.to.contain(idNouvelleNuée);
      });

      it("On peut aussi l'effacer", async () => {
        await client.nuées.effacerNuée({ idNuée: idNouvelleNuée });
        const val = await nuées.attendreQue((x) => !x.includes(idNouvelleNuée));
        expect(val).to.be.an("array").and.to.not.contain(idNouvelleNuée);
      });
    });

    describe("Statut nuée", function () {
      let fOublier: schémaFonctionOublier;
      let idNuée: string;

      const statut = new utilsTestAttente.AttendreRésultat<schémaStatut>();

      before(async () => {
        idNuée = await client.nuées.créerNuée();
        fOublier = await client.nuées.suivreStatutNuée({
          idNuée,
          f: (x) => statut.mettreÀJour(x),
        });
      });
      after(async () => {
        if (fOublier) await fOublier();
      });

      it("Marquer jouet", async () => {
        await client.nuées.marquerJouet({ idNuée });
        const val = await statut.attendreQue((x) => x.statut === "jouet");
        expect(val).to.deep.equal({
          statut: "jouet",
        });
      });

      it("Marquer interne", async () => {
        await client.nuées.marquerInterne({ idNuée });
        const val = await statut.attendreQue((x) => x.statut === "interne");
        expect(val).to.deep.equal({
          statut: "interne",
        });
      });

      it("Marquer obsolète", async () => {
        await client.nuées.marquerObsolète({
          idNuée,
          idNouvelle: "Une nouvelle bd.",
        }); //  Pour une vraie application, utiliser un id Nuée valide, bien entendu.
        const val = await statut.attendreQue((x) => x.statut === "obsolète");
        expect(val).to.deep.equal({
          statut: "obsolète",
          idNouvelle: "Une nouvelle bd.",
        });
      });

      it("Marquer active", async () => {
        await client.nuées.marquerActive({ idNuée });
        const val = await statut.attendreQue((x) => x.statut === "active");
        expect(val).to.deep.equal({
          statut: "active",
        });
      });
    });

    describe("Tableaux", function () {
      describe("Ajouter et enlever", function () {
        let fOublier: schémaFonctionOublier;
        let idNuée: string;
        let idTableau: string;

        const tableaux = new utilsTestAttente.AttendreRésultat<
          infoTableauAvecId[]
        >();

        before(async () => {
          idNuée = await client.nuées.créerNuée();
          fOublier = await client.nuées.suivreTableauxNuée({
            idNuée,
            f: (x) => tableaux.mettreÀJour(x),
          });
        });
        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Ajout tableau", async () => {
          idTableau = await client.nuées.ajouterTableauNuée({
            idNuée,
            clefTableau: "abc",
          });
          const val = await tableaux.attendreQue((x) => x.length > 0);
          expect(val).to.have.deep.members([
            {
              clef: "abc",
              id: idTableau,
            },
          ]);
        });

        it("Effacer tableau", async () => {
          await client.nuées.effacerTableauNuée({
            idNuée,
            idTableau,
          });
          const val = await tableaux.attendreQue((x) => !x.length);
          expect(val).to.be.empty();
        });
      });

      describe("Colonnes", function () {
        let idNuée: string;
        let idTableau: string;
        let fOublier: schémaFonctionOublier;

        const résultat = new utilsTestAttente.AttendreRésultat<
          InfoColAvecCatégorie[]
        >();

        before(async () => {
          idNuée = await client.nuées.créerNuée();
          idTableau = await client.nuées.ajouterTableauNuée({
            idNuée,
            clefTableau: "principal",
          });
          fOublier = await client.nuées.suivreColonnesEtCatégoriesTableauNuée({
            idNuée,
            clefTableau: "principal",
            f: (x) => résultat.mettreÀJour(x),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Ajout colonne", async () => {
          const idVariable = await client.variables.créerVariable({
            catégorie: "chaîne",
          });
          await client.nuées.ajouterColonneTableauNuée({
            idTableau,
            idVariable,
          });
          const val = await résultat.attendreQue((x) => x.length > 0);
          expect(val[0].variable).to.equal(idVariable);
        });
      });

      describe("Variables", function () {
        let fOublier: schémaFonctionOublier;
        let idNuée: string;
        let idTableau: string;
        let idColonne: string;

        const variables = new utilsTestAttente.AttendreRésultat<string[]>();

        before(async () => {
          idNuée = await client.nuées.créerNuée();
          idTableau = await client.nuées.ajouterTableauNuée({ idNuée });

          fOublier = await client.nuées.suivreVariablesNuée({
            idNuée,
            f: (x) => variables.mettreÀJour(x),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Pas de variables pour commencer", async () => {
          const val = await variables.attendreExiste();
          expect(val).to.be.an.empty("array");
        });

        it("Ajout d'une variable", async () => {
          const idVariable = await client.variables.créerVariable({
            catégorie: "numérique",
          });

          idColonne = await client.nuées.ajouterColonneTableauNuée({
            idTableau,
            idVariable,
          });

          const val = await variables.attendreQue((x) => x.length > 0);
          expect(val).to.have.members([idVariable]);
        });

        it("Effacer une variable", async () => {
          await client.nuées.effacerColonneTableauNuée({
            idTableau,
            idColonne,
          });
          const val = await variables.attendreQue((x) => !x.length);
          expect(val).to.be.an.empty("array");
        });
      });

      describe("Règles", function () {
        it.skip("Nuée");
      });
    });
    describe("Qualité", function () {
      it.skip("Nuée");
    });
    describe("Différences tableau", function () {
      it.skip("Nuée");
    });
    describe("Différences bd", function () {
      it.skip("Nuée");
    });
  });

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

    describe("Gestionnaires", function () {
      it.skip("Créer gestionnaire indépendant");
      it.skip("Exclure membre");
      it.skip("Réintégrer membre");
      it.skip("Changer philosophie à CJPI");
      it.skip("Inviter membre");
    });

    describe("Autorisations nuée", function () {
      it.skip("Créer Nuée avec gestionnaire existant");
      it.skip("Changer philosophie");
      it.skip("Accepter membre");
      it.skip("Exclure membre");
      it.skip("Changer gestionnaire");
    });

    describe("Correspondances bds", function () {
      let fOublierClients: () => Promise<void>;
      let clients: Constellation[];
      let client: Constellation;

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
      });

      describe("Héritage", function () {
        let idNuéeGrandParent: string;
        let idNuéeParent: string;
        let idNuée: string;
        let idNuéeSœure: string;
        let idBdDeNuéeGrandParent: string;
        let idBdDeNuéeParent: string;
        let idBdDeNuée: string;
        let idBdDeNuéeSœure: string;

        let fsOublier: schémaFonctionOublier[] = [];

        before(async () => {
          idNuéeGrandParent = await client.nuées.créerNuée();
          idNuéeParent = await client.nuées.créerNuée({
            nuéeParent: idNuéeGrandParent,
          });
          idNuée = await client.nuées.créerNuée({
            nuéeParent: idNuéeParent,
          });
          idNuéeSœure = await client.nuées.créerNuée({
            nuéeParent: idNuéeParent,
          });
          idBdDeNuéeGrandParent = await client.bds.créerBdDeSchéma({
            schéma: await client.nuées.générerSchémaBdNuée({
              idNuée: idNuéeGrandParent,
              licence: "ODbl-1_0",
            }),
          });
          idBdDeNuéeParent = await client.bds.créerBdDeSchéma({
            schéma: await client.nuées.générerSchémaBdNuée({
              idNuée: idNuéeParent,
              licence: "ODbl-1_0",
            }),
          });
          idBdDeNuée = await client.bds.créerBdDeSchéma({
            schéma: await client.nuées.générerSchémaBdNuée({
              idNuée: idNuée,
              licence: "ODbl-1_0",
            }),
          });
          idBdDeNuéeSœure = await client.bds.créerBdDeSchéma({
            schéma: await client.nuées.générerSchémaBdNuée({
              idNuée: idNuéeSœure,
              licence: "ODbl-1_0",
            }),
          });
        });

        afterEach(async () => {
          await Promise.allSettled(fsOublier.map((f) => f()));
          fsOublier = [];
        });

        it("Sans héritage", async () => {
          const correspondantes = new attente.AttendreRésultat<string[]>();
          const { fOublier } = await client.nuées.suivreBdsCorrespondantes({
            idNuée,
            f: (x) => correspondantes.mettreÀJour(x),
          });
          fsOublier.push(fOublier);

          const val = await correspondantes.attendreQue((x) => x.length > 0);
          expect(val).to.have.members([idBdDeNuée]).lengthOf(1);
        });
        it("Héritage descendance", async () => {
          const correspondantes = new attente.AttendreRésultat<string[]>();
          const { fOublier } = await client.nuées.suivreBdsCorrespondantes({
            idNuée: idNuéeParent,
            héritage: ["descendance"],
            f: (x) => correspondantes.mettreÀJour(x),
          });
          fsOublier.push(fOublier);
          const val = await correspondantes.attendreQue((x) => x.length > 2);
          expect(val)
            .to.have.members([idBdDeNuéeParent, idBdDeNuée, idBdDeNuéeSœure])
            .lengthOf(3);
        });
        it("Héritage ascendance", async () => {
          const correspondantes = new attente.AttendreRésultat<string[]>();
          const { fOublier } = await client.nuées.suivreBdsCorrespondantes({
            idNuée,
            héritage: ["ascendance"],
            f: (x) => correspondantes.mettreÀJour(x),
          });
          fsOublier.push(fOublier);
          const val = await correspondantes.attendreQue((x) => x.length > 2);
          expect(val)
            .to.have.members([
              idBdDeNuéeGrandParent,
              idBdDeNuéeParent,
              idBdDeNuée,
            ])
            .lengthOf(3);
        });
        it("Héritage ascendance et descendance", async () => {
          const correspondantes = new attente.AttendreRésultat<string[]>();
          const { fOublier } = await client.nuées.suivreBdsCorrespondantes({
            idNuée: idNuéeParent,
            héritage: ["descendance", "ascendance"],
            f: (x) => correspondantes.mettreÀJour(x),
          });
          fsOublier.push(fOublier);
          await idsCorrespondantes(correspondantes, {
            idBdDeNuéeGrandParent,
            idBdDeNuéeParent,
            idBdDeNuée,
            idBdDeNuéeSœure,
          });
        });
      });

      describe("CJPI", function () {
        let idNuée: string;
        let schémaNuée: schémaSpécificationBd;
        let idBdMembreAutorisé: string;
        let idBdMembreNonAutorisé: string;

        const résultat = new utilsTestAttente.AttendreRésultat<string[]>();
        const résultatSansVérification = new utilsTestAttente.AttendreRésultat<
          string[]
        >();
        const résultatSansInclureLesMiennes =
          new utilsTestAttente.AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        before(async () => {
          ({ idNuée } = await générerNuéeTest(client, {
            autorisation: "CJPI",
          }));
          schémaNuée = await client.nuées.générerSchémaBdNuée({
            idNuée,
            licence: "ODbl-1_0",
          });
          idBdMembreAutorisé = await client.bds.créerBdDeSchéma({
            schéma: schémaNuée,
          });
          const { fOublier: fOublierRésultat } =
            await clients[1].nuées.suivreBdsCorrespondantes({
              idNuée,
              f: (x) => résultat.mettreÀJour(x),
            });
          fsOublier.push(fOublierRésultat);

          const { fOublier: fOublierRésultatSansVérification } =
            await client.nuées.suivreBdsCorrespondantes({
              idNuée,
              f: (x) => résultatSansVérification.mettreÀJour(x),
              vérifierAutorisation: false,
            });
          fsOublier.push(fOublierRésultatSansVérification);

          const { fOublier: fOublierRésultatSansInclureLesMiennes } =
            await clients[1].nuées.suivreBdsCorrespondantes({
              idNuée,
              f: (x) => résultatSansInclureLesMiennes.mettreÀJour(x),
              toujoursInclureLesMiennes: false,
            });
          fsOublier.push(fOublierRésultatSansInclureLesMiennes);
        });

        after(async () => {
          await Promise.allSettled(fsOublier.map((f) => f()));
        });

        it("Bds de membres autorisés", async () => {
          const val = await résultat.attendreQue((x) => x.length > 0);
          expect(val[0]).to.equal(idBdMembreAutorisé);
        });

        it("Bd non autorisée - incluse dans les miennes", async () => {
          idBdMembreNonAutorisé = await clients[1].bds.créerBdDeSchéma({
            schéma: schémaNuée,
          });
          const val = await résultat.attendreQue((x) => x.length > 1);
          expect(val.includes(idBdMembreNonAutorisé)).to.be.true();
        });

        it("Bd non autorisée - non incluse pour les autres", async () => {
          const val2 = await résultatSansInclureLesMiennes.attendreQue(
            (x) => x.length > 0,
          );
          expect(val2.includes(idBdMembreNonAutorisé)).to.be.false();
        });

        it("Bd non autorisée - incluse sans vérification", async () => {
          const val3 = await résultatSansVérification.attendreQue(
            (x) => x.length > 1,
          );
          expect(val3.includes(idBdMembreNonAutorisé)).to.be.true();
        });
      });

      describe("IJPC", function () {
        let idNuée: string;
        let schémaNuée: schémaSpécificationBd;
        let idBd: string;

        const résultat = new utilsTestAttente.AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        before(async () => {
          ({ idNuée } = await générerNuéeTest(client, {
            autorisation: "IJPC",
          }));
          schémaNuée = await client.nuées.générerSchémaBdNuée({
            idNuée,
            licence: "ODbl-1_0",
          });
          const { fOublier: fOublierRésultat } =
            await client.nuées.suivreBdsCorrespondantes({
              idNuée,
              f: (x) => résultat.mettreÀJour(x),
            });
          fsOublier.push(fOublierRésultat);
        });

        after(async () => {
          await Promise.allSettled(fsOublier.map((f) => f()));
        });

        it("Bds de membres autorisés", async () => {
          idBd = await clients[1].bds.créerBdDeSchéma({
            schéma: schémaNuée,
          });
          const val = await résultat.attendreQue((x) => x.length > 0);
          expect(val).to.include(idBd);
        });

        it("Bloquer membre", async () => {
          await client.nuées.exclureMembreDeNuée({
            idNuée,
            idCompte: await clients[1].obtIdCompte(),
          });
          const val = await résultat.attendreQue((x) => x.length === 0);
          expect(val.includes(idBd)).to.be.false();
        });
      });
    });
  }

  describe("Correspondances tableaux", function () {
    it.skip("Nuée");
  });

  describe("Ascendance", function () {
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

    describe("Suivi parents", function () {
      let idNuée: string;
      let idNuéeParent: string;

      const parents = new utilsTestAttente.AttendreRésultat<string[]>();
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idNuéeParent = await client.nuées.créerNuée();
        idNuée = await client.nuées.créerNuée({ nuéeParent: idNuéeParent });

        const fOublierParents = await client.nuées.suivreNuéesParents({
          idNuée,
          f: (x) => parents.mettreÀJour(x),
        });
        fsOublier.push(fOublierParents);
        fsOublier.push(async () => parents.toutAnnuler());
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
      });

      it("Parent détecté", async () => {
        const val = await parents.attendreQue((x) => x.length > 0);
        expect(val).to.have.members([idNuéeParent]);
      });

      it("Parent transitif détecté", async () => {
        const idNuéeGrandParent = await client.nuées.créerNuée();
        await client.nuées.préciserParent({
          idNuée: idNuéeParent,
          idNuéeParent: idNuéeGrandParent,
        });
        const val = await parents.attendreQue((x) => x.length > 1);
        expect(val).to.have.members([idNuéeParent, idNuéeGrandParent]);
      });

      it("Parent transitif enlevé avec parent", async () => {
        await client.nuées.enleverParent({ idNuée });
        const val = await parents.attendreQue((x) => x.length === 0);
        expect(val).to.be.an.empty("array");
      });
    });

    describe("Traçabilité descendants", function () {
      let idNuéeEnfant: string;
      let idNuée: string;
      let idNuéeParent: string;

      const descendants = new utilsTestAttente.AttendreRésultat<string[]>();
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idNuéeParent = await client.nuées.créerNuée();
        idNuée = await client.nuées.créerNuée({ nuéeParent: idNuéeParent });

        const { fOublier: fOublierDescendants } =
          await client.nuées.rechercherNuéesDéscendantes({
            idNuée: idNuéeParent,
            f: (x) => descendants.mettreÀJour(x),
          });

        fsOublier.push(fOublierDescendants);
        fsOublier.push(async () => descendants.toutAnnuler());
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
      });
      it("Descendant détecté", async () => {
        const val = await descendants.attendreQue((x) => x.length > 0);
        expect(val).to.have.members([idNuée]);
      });

      it("Descendance transitive détectée", async () => {
        idNuéeEnfant = await client.nuées.créerNuée({ nuéeParent: idNuée });

        const val = await descendants.attendreQue((x) => x.length > 1);
        expect(val).to.have.members([idNuée, idNuéeEnfant]);
      });
    });

    describe("Héritage noms", function () {
      let idNuée: string;
      let idNuéeParent: string;

      const noms = new utilsTestAttente.AttendreRésultat<{
        [langue: string]: string;
      }>();
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idNuéeParent = await client.nuées.créerNuée();
        idNuée = await client.nuées.créerNuée({ nuéeParent: idNuéeParent });
        const fOublierNoms = await client.nuées.suivreNomsNuée({
          idNuée,
          f: (x) => noms.mettreÀJour(x),
        });
        fsOublier.push(fOublierNoms);
        fsOublier.push(async () => noms.toutAnnuler());
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
      });

      it("Rien pour commencer", async () => {
        const val = await noms.attendreExiste();
        expect(val).to.be.an.empty("object");
      });

      it("Ajout nom nuée", async () => {
        await client.nuées.sauvegarderNomNuée({
          idNuée,
          langue: "fr",
          nom: "Science citoyenne",
        });
        const val = await noms.attendreQue((x) => !!x.fr);
        expect(val["fr"]).to.equal("Science citoyenne");
      });

      it("Ajout nom nuée parent", async () => {
        await client.nuées.sauvegarderNomNuée({
          idNuée: idNuéeParent,
          langue: "cst",
          nom: "Ciencia ciudádana",
        });
        const val = await noms.attendreQue((x) => !!x.cst);
        expect(val["cst"]).to.equal("Ciencia ciudádana");
      });

      it("Précédence nuée sur parent", async () => {
        await client.nuées.sauvegarderNomNuée({
          idNuée,
          langue: "cst",
          nom: "Proyecto de ciencia ciudádana",
        });
        const val = await noms.attendreQue(
          (x) => x.cst !== "Ciencia ciudádana",
        );
        expect(val["cst"]).to.equal("Proyecto de ciencia ciudádana");
      });
    });

    describe("Héritage descriptions", function () {
      let idNuée: string;
      let idNuéeParent: string;
      const descriptions = new utilsTestAttente.AttendreRésultat<{
        [langue: string]: string;
      }>();
      const fsOublier: schémaFonctionOublier[] = [];
      before(async () => {
        idNuéeParent = await client.nuées.créerNuée();
        idNuée = await client.nuées.créerNuée({ nuéeParent: idNuéeParent });
        const fOublierDescriptions = await client.nuées.suivreDescriptionsNuée({
          idNuée,
          f: (x) => descriptions.mettreÀJour(x),
        });
        fsOublier.push(fOublierDescriptions);
        fsOublier.push(async () => descriptions.toutAnnuler());
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
      });

      it("Rien pour commencer", async () => {
        const val = await descriptions.attendreExiste();
        expect(val).to.be.an.empty("object");
      });

      it("Ajout description nuée", async () => {
        await client.nuées.sauvegarderDescriptionNuée({
          idNuée,
          langue: "fr",
          description: "Science citoyenne",
        });
        const val = await descriptions.attendreQue((x) => !!x.fr);
        expect(val["fr"]).to.equal("Science citoyenne");
      });

      it("Ajout description nuée parent", async () => {
        await client.nuées.sauvegarderDescriptionNuée({
          idNuée: idNuéeParent,
          langue: "cst",
          description: "Ciencia ciudádana",
        });
        const val = await descriptions.attendreQue((x) => !!x.cst);
        expect(val["cst"]).to.equal("Ciencia ciudádana");
      });

      it("Précédence nuée sur parent", async () => {
        await client.nuées.sauvegarderDescriptionNuée({
          idNuée,
          langue: "cst",
          description: "Proyecto de ciencia ciudádana",
        });
        const val = await descriptions.attendreQue(
          (x) => x.cst !== "Ciencia ciudádana",
        );
        expect(val["cst"]).to.equal("Proyecto de ciencia ciudádana");
      });
    });

    describe.skip("Héritage règles", function () {
      // À faire: déterminer structure tableaux nuées entre idTableau et clefTableau
      /*const règle: règleExiste = {
        typeRègle: "existe",
        détails: {}
      }*/
      const clefTableau = "principal";
      let idNuée: string;
      let idNuéeParent: string;
      const règles = new utilsTestAttente.AttendreRésultat<règleColonne[]>();
      const fsOublier: schémaFonctionOublier[] = [];
      before(async () => {
        idNuéeParent = await client.nuées.créerNuée();
        idNuée = await client.nuées.créerNuée({ nuéeParent: idNuéeParent });
        const fOublierRègles = await client.nuées.suivreRèglesTableauNuée({
          idNuée,
          clefTableau,
          f: (x) => règles.mettreÀJour(x),
        });
        fsOublier.push(fOublierRègles);
        fsOublier.push(async () => règles.toutAnnuler());
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
      });
      it("Rien pour commencer", async () => {
        const val = await règles.attendreExiste();
        expect(val).to.be.an.empty("array");
      });

      it("Ajout règle nuée");

      it("Ajout règle nuée parent");
    });

    describe("Suivi données ascendants", function () {
      let idNuée: string;
      let idNuéeParent: string;
      let idCol: string;
      let schémaBd: schémaSpécificationBd;
      let idÉlémentNuée: string;

      const fsOublier: schémaFonctionOublier[] = [];
      const données = new utilsTestAttente.AttendreRésultat<
        élémentDeMembreAvecValid<élémentBdListeDonnées>[]
      >();

      before(async () => {
        idNuéeParent = await client.nuées.créerNuée();
        idNuée = await client.nuées.créerNuée({ nuéeParent: idNuéeParent });
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

        schémaBd = await client.nuées.générerSchémaBdNuée({
          idNuée,
          licence: "ODBl-1_0",
        });

        const { fOublier: fOublierDonnées } =
          await client.nuées.suivreDonnéesTableauNuée({
            idNuée,
            clefTableau: "principal",
            f: (x) => données.mettreÀJour(x),
            héritage: ["ascendance"],
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
            idNuéeUnique: idNuée,
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

      it("Données nuée parent détectées", async () => {
        const id = (
          await client.bds.ajouterÉlémentÀTableauUnique({
            schémaBd,
            idNuéeUnique: idNuéeParent,
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
  });

  describe("Suivre empreinte", function () {
    let fOublierClients: () => Promise<void>;
    let clients: Constellation[];
    let client: Constellation;

    let idNuée: string;
    let idBd: string;
    let idTableau: string;
    let idCol: string;
    let empreinte: string;

    before(async () => {
      ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
        n: 1,

        créerConstellation,
      }));
      client = clients[0];

      idNuée = await client.nuées.créerNuée();
      const idVariable = await client.variables.créerVariable({
        catégorie: "audio",
      });
      idTableau = await client.nuées.ajouterTableauNuée({ idNuée });
      idCol = await client.nuées.ajouterColonneTableauNuée({
        idTableau,
        idVariable,
      });
    });

    after(async () => {
      if (fOublierClients) await fOublierClients();
    });

    it("Sans bds", async () => {
      empreinte = await obtenir<string>(({ siDéfini }) =>
        client.nuées.suivreEmpreinteTêtesBdsNuée({
          idNuée,
          f: siDéfini(),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("Ajout bds", async () => {
      const schéma = await client.nuées.générerSchémaBdNuée({
        idNuée,
        licence: "ODBl-1_0",
      });
      idBd = await client.bds.créerBdDeSchéma({
        schéma,
      });

      empreinte = await obtenir<string>(({ si }) =>
        client.nuées.suivreEmpreinteTêtesBdsNuée({
          idNuée,
          f: si((x) => x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("Changement nom bds détecté", async () => {
      await client.bds.sauvegarderNomBd({ idBd, langue: "fr", nom: "Ma BD" });

      empreinte = await obtenir<string>(({ si }) =>
        client.nuées.suivreEmpreinteTêtesBdsNuée({
          idNuée,
          f: si((x) => x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("Changement nom nuée détecté", async () => {
      await client.nuées.sauvegarderNomNuée({
        idNuée,
        langue: "fr",
        nom: "Ma nuée",
      });

      empreinte = await obtenir<string>(({ si }) =>
        client.nuées.suivreEmpreinteTêtesBdsNuée({
          idNuée,
          f: si((x) => x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("Changement données bds détecté", async () => {
      await client.tableaux.ajouterÉlément({
        idTableau,
        vals: { [idCol]: 123 },
      });

      empreinte = await obtenir<string>(({ si }) =>
        client.nuées.suivreEmpreinteTêtesBdsNuée({
          idNuée,
          f: si((x) => x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
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

  describe.only("Document données exportées", function () {
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

  describe("Générer de bd", function () {
    it.skip("Nuée");
  });
});
