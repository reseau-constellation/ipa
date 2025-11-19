import { isValidAddress } from "@orbitdb/core";
import {
  attente,
  attente as utilsTestAttente,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";
import { expect } from "aegir/chai";
import { créerConstellation, type Constellation } from "@/index.js";
import { schémaFonctionOublier, élémentsBd } from "@/types.js";
import type XLSX from "xlsx";

import type {
  InfoCol,
  InfoColAvecCatégorie,
  élémentBdListeDonnées,
  élémentDonnées,
} from "@/tableaux.js";
import type {
  détailsRègleBornesDynamiqueColonne,
  détailsRègleBornesDynamiqueVariable,
  détailsRègleValeurCatégoriqueDynamique,
  erreurRègle,
  erreurRègleBornesColonneInexistante,
  erreurRègleBornesVariableNonPrésente,
  erreurRègleCatégoriqueColonneInexistante,
  erreurValidation,
  règleBornes,
  règleColonne,
  règleValeurCatégorique,
} from "@/valid.js";

const { créerConstellationsTest } = utilsTestConstellation;

describe("Tableaux", function () {
  let fOublierClients: () => Promise<void>;
  let clients: Constellation[];
  let client: Constellation;

  let idBd: string;
  let idTableau: string;

  before(async () => {
    ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
      n: 1,

      créerConstellation,
    }));
    client = clients[0];
    idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Réordonner colonne", function () {
    const colonnes = new attente.AttendreRésultat<InfoCol[]>();
    let fOublier: schémaFonctionOublier;

    before(async () => {
      fOublier = await client.tableaux.suivreColonnesTableau({
        idTableau,
        f: (x) => colonnes.mettreÀJour(x),
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Repositionner la colonne", async () => {
      const idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      const idCol2 = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable,
      });

      const valColonnes = await colonnes.attendreExiste();
      await client.tableaux.réordonnerColonneTableau({
        idTableau,
        idColonne: valColonnes[0].id,
        position: 1,
      });
      const nouvellesColonnes = await colonnes.attendreQue(
        (x) => x[0].id !== valColonnes[0].id,
      );
      expect(nouvellesColonnes.map((c) => c.id)).to.deep.equal([
        idCol2,
        valColonnes[0].id,
      ]);
    });
  });

  describe("Règles: Fonctionnalités de base", function () {
    let idTableauRègles: string;
    let idVariableNumérique: string;
    let idVariableChaîne: string;

    let idRègle: string;

    let idColonneNumérique: string;
    let idColonneChaîne: string;

    const résRègles = new utilsTestAttente.AttendreRésultat<règleColonne[]>();
    const résErreurs = new utilsTestAttente.AttendreRésultat<
      erreurValidation[]
    >();

    let fsOublier: schémaFonctionOublier[] = [];

    beforeEach(async () => {
      idTableauRègles = await client.tableaux.créerTableau({ idBd });
      fsOublier.push(
        await client.tableaux.suivreRègles({
          idTableau: idTableauRègles,
          f: (r) => résRègles.mettreÀJour(r),
        }),
      );
      fsOublier.push(
        await client.tableaux.suivreValidDonnées({
          idTableau: idTableauRègles,
          f: (e) => résErreurs.mettreÀJour(e),
        }),
      );

      idVariableNumérique = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      idVariableChaîne = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });

      idColonneNumérique = await client.tableaux.ajouterColonneTableau({
        idTableau: idTableauRègles,
        idVariable: idVariableNumérique,
      });
      idColonneChaîne = await client.tableaux.ajouterColonneTableau({
        idTableau: idTableauRègles,
        idVariable: idVariableChaîne,
      });
    });

    afterEach(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
      fsOublier = [];
      résRègles.toutAnnuler();
      résErreurs.toutAnnuler();
    });


    it("Aucune erreur pour commencer", async () => {
      const val = await résErreurs.attendreExiste();
      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(0);
    });

    it("Ajouter des données valides", async () => {
      await client.tableaux.ajouterÉlément({
        idTableau: idTableauRègles,
        vals: {
          [idColonneChaîne]: "abc",
          [idColonneNumérique]: 123,
        },
      });
      const val = await résErreurs.attendreExiste();
      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(0);
    });

    it("Ajouter des données de catégorie invalide", async () => {
      const id = (
        await client.tableaux.ajouterÉlément({
          idTableau: idTableauRègles,
          vals: {
            [idColonneChaîne]: 123,
          },
        })
      )[0];
      expect(typeof id).to.equal("string");
      const val = await résErreurs.attendreQue((x) => !!x.length);
      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(1);
      expect(val[0].erreur.règle.règle.règle.typeRègle).to.equal("catégorie");
    });

    it("Ajouter une règle au tableau", async () => {
      const règle: règleBornes = {
        typeRègle: "bornes",
        détails: {
          type: "fixe",
          val: 0,
          op: "<",
        },
      };
      idRègle = await client.tableaux.ajouterRègleTableau({
        idTableau: idTableauRègles,
        idColonne: idColonneNumérique,
        règle,
      });
      const val = await résRègles.attendreQue((x) => x.length >= 3);
      expect(val.length).to.equal(3);
      const règleAjoutée = val.filter((r) => r.règle.id === idRègle)[0];
      expect(règleAjoutée).to.not.be.undefined();
      expect(règleAjoutée.source).to.deep.equal({
        type: "tableau",
        id: idTableauRègles,
      });
    });

    it("Ajouter une règle à la variable", async () => {
      const règle: règleBornes = {
        typeRègle: "bornes",
        détails: {
          type: "fixe",
          val: 0,
          op: "<",
        },
      };
      idRègle = await client.variables.ajouterRègleVariable({
        idVariable: idVariableNumérique,
        règle,
      });
      const val = await résRègles.attendreQue((x) => x.length >= 3);
      expect(val.length).to.equal(3);
      expect(val.filter((r) => r.règle.id === idRègle).length).to.equal(1);
    });

    it("Ajouter des données invalides (règle tableau)", async () => {
      const règle: règleBornes = {
        typeRègle: "bornes",
        détails: {
          type: "fixe",
          val: 0,
          op: "<",
        },
      };
      idRègle = await client.tableaux.ajouterRègleTableau({
        idTableau: idTableauRègles,
        idColonne: idColonneNumérique,
        règle,
      });

      await client.tableaux.ajouterÉlément({
        idTableau: idTableauRègles,
        vals: {
          [idColonneNumérique]: 123,
        },
      });

      const val = await résErreurs.attendreQue((x) => !!x.length);
      expect(val.length).to.equal(1);
      expect(val[0].erreur.règle.règle.id).to.equal(idRègle);
    });

    it("Ajouter des données invalides (règle variable)", async () => {
      const règle: règleBornes = {
        typeRègle: "bornes",
        détails: {
          type: "fixe",
          val: 0,
          op: "<",
        },
      };
      idRègle = await client.variables.ajouterRègleVariable({
        idVariable: idVariableNumérique,
        règle,
      });

      await client.tableaux.ajouterÉlément({
        idTableau: idTableauRègles,
        vals: {
          [idColonneNumérique]: 123,
        },
      });
      const val = await résErreurs.attendreQue((x) => x.length >= 1);
      expect(val.length).to.equal(1);
      expect(val[0].erreur.règle.règle.id).to.equal(idRègle);
    });

    it("On ne peut pas directement effacer une règle provenant de la variable", async () => {
      const règle: règleBornes = {
        typeRègle: "bornes",
        détails: {
          type: "fixe",
          val: 0,
          op: "<",
        },
      };
      idRègle = await client.variables.ajouterRègleVariable({
        idVariable: idVariableNumérique,
        règle,
      });
      await client.tableaux.effacerRègleTableau({
        idTableau: idTableauRègles,
        idRègle,
      });

      const val = await résRègles.attendreExiste();
      expect(val.filter((r) => r.règle.id === idRègle).length).to.equal(1);
    });

    it("Effacer une règle tableau", async () => {
      const règle: règleBornes = {
        typeRègle: "bornes",
        détails: {
          type: "fixe",
          val: 0,
          op: "<",
        },
      };
      idRègle = await client.tableaux.ajouterRègleTableau({
        idTableau: idTableauRègles,
        idColonne: idColonneNumérique,
        règle,
      });
      await client.tableaux.ajouterÉlément({
        idTableau: idTableauRègles,
        vals: {
          [idColonneNumérique]: 123,
        },
      });

      await client.tableaux.effacerRègleTableau({
        idTableau: idTableauRègles,
        idRègle,
      });
      const valErreurs = await résErreurs.attendreQue((x) => x.length === 0);
      const valRègles = await résRègles.attendreQue(
        (x) => !x.some((r) => r.règle.id === idRègle),
      );
      expect(valRègles.length).to.equal(2);
      expect(valErreurs.length).to.equal(0);
    });

    it("Effacer une règle variable", async () => {
      const règle: règleBornes = {
        typeRègle: "bornes",
        détails: {
          type: "fixe",
          val: 0,
          op: "<",
        },
      };
      idRègle = await client.variables.ajouterRègleVariable({
        idVariable: idVariableNumérique,
        règle,
      });
      await client.tableaux.ajouterÉlément({
        idTableau: idTableauRègles,
        vals: {
          [idColonneNumérique]: 123,
        },
      });

      let valErreurs = await résErreurs.attendreQue((x) => x.length > 0);
      let valRègles = await résRègles.attendreQue((x) => x.length > 2);

      expect(valRègles.length).to.equal(3);
      expect(valErreurs.length).to.equal(1);

      await client.variables.effacerRègleVariable({
        idVariable: idVariableNumérique,
        idRègle,
      });

      valErreurs = await résErreurs.attendreQue((x) => x.length === 0);
      valRègles = await résRègles.attendreQue((x) => x.length < 3);

      expect(valRègles.length).to.equal(2);
      expect(valErreurs.length).to.equal(0);
    });
  });

  describe("Règles: Règle bornes relative à une colonne", function () {
    let idTableauRègles: string;

    let idVariableTempMin: string;
    let idColonneTempMin: string;
    let idVariableTempMax: string;
    let idVariableTempMoyenne: string;
    let règle1: règleBornes<détailsRègleBornesDynamiqueColonne>;
    let règle2: règleBornes;
    let idRègle1: string;
    let idRègle2: string;
    let idRègle3: string;
    let id2: string;

    const erreursValid = new utilsTestAttente.AttendreRésultat<
      erreurValidation[]
    >();
    const erreursRègles = new utilsTestAttente.AttendreRésultat<
      erreurRègle[]
    >();

    const idColonneTempMax = "col temp max";
    let idsDonnées: string[] = [];
    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idTableauRègles = await client.tableaux.créerTableau({ idBd });

      fsOublier.push(
        await client.tableaux.suivreValidDonnées({
          idTableau: idTableauRègles,
          f: (e) => erreursValid.mettreÀJour(e),
        }),
      );

      fsOublier.push(
        await client.tableaux.suivreValidRègles({
          idTableau: idTableauRègles,
          f: (e) => erreursRègles.mettreÀJour(e),
        }),
      );

      idVariableTempMin = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      idVariableTempMax = await client.variables.créerVariable({
        catégorie: "numérique",
      });

      idVariableTempMoyenne = await client.variables.créerVariable({
        catégorie: "numérique",
      });

      idColonneTempMin = await client.tableaux.ajouterColonneTableau({
        idTableau: idTableauRègles,
        idVariable: idVariableTempMin,
      });
      idsDonnées = await client.tableaux.ajouterÉlément({
        idTableau: idTableauRègles,
        vals: Array.from(Array(10).keys()).map((min) => ({
          [idColonneTempMin]: min,
        })),
      });
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
      erreursValid.toutAnnuler();
      erreursRègles.toutAnnuler();
    });

    it("Erreur règle si la colonne n'existe pas", async () => {
      règle1 = {
        typeRègle: "bornes",
        détails: {
          type: "dynamiqueColonne",
          val: idColonneTempMax,
          op: "≤",
        },
      };

      idRègle1 = await client.tableaux.ajouterRègleTableau({
        idTableau: idTableauRègles,
        idColonne: idColonneTempMin,
        règle: règle1,
      });

      const réf: erreurRègleBornesColonneInexistante[] = [
        {
          règle: {
            source: { type: "tableau", id: idTableauRègles },
            colonne: idColonneTempMin,
            règle: {
              id: idRègle1,
              règle: règle1,
            },
          },
          détails: "colonneBornesInexistante",
        },
      ];

      const résValid = await erreursValid.attendreExiste();
      expect(résValid.length).to.equal(0);

      const résRègles = await erreursRègles.attendreQue((x) => x.length > 0);
      expect(résRègles).to.deep.equal(réf);
    });

    it("Ajout colonne réf détectée", async () => {
      await client.tableaux.ajouterColonneTableau({
        idTableau: idTableauRègles,
        idVariable: idVariableTempMax,
        idColonne: idColonneTempMax,
      });
      const val = await erreursRègles.attendreQue((x) => x.length === 0);
      expect(val.length).to.equal(0);
    });

    it("Ajout éléments colonne réf détecté", async () => {
      await client.tableaux.modifierÉlément({
        idTableau: idTableauRègles,
        vals: { [idColonneTempMax]: -1 },
        idÉlément: idsDonnées[0],
      });

      const réf: erreurValidation = {
        id: idsDonnées[0],
        erreur: {
          règle: {
            source: { type: "tableau", id: idTableauRègles },
            colonne: idColonneTempMin,
            règle: {
              id: idRègle1,
              règle: règle1,
            },
          },
        },
      };

      const valErreursValid = await erreursValid.attendreQue(
        (x) => x.length > 0,
      );
      expect(valErreursValid).to.deep.equal([réf]);

      await client.tableaux.modifierÉlément({
        idTableau: idTableauRègles,
        vals: { [idColonneTempMax]: 6 },
        idÉlément: idsDonnées[0],
      });
      const résValid = await erreursValid.attendreQue((x) => x.length < 1);
      expect(résValid.length).to.equal(0);
    });

    it("Ajout éléments valides", async () => {
      await client.tableaux.ajouterÉlément({
        idTableau: idTableauRègles,
        vals: {
          [idColonneTempMin]: -15,
          [idColonneTempMax]: -5,
        },
      });
      const résValid = await erreursValid.attendreExiste();
      expect(résValid.length).to.equal(0);
    });

    it("Ajout éléments invalides", async () => {
      id2 = (
        await client.tableaux.ajouterÉlément({
          idTableau: idTableauRègles,
          vals: {
            [idColonneTempMin]: -15,
            [idColonneTempMax]: -25,
          },
        })
      )[0];

      const réf: erreurValidation = {
        id: id2,
        erreur: {
          règle: {
            source: { type: "tableau", id: idTableauRègles },
            colonne: idColonneTempMin,
            règle: {
              id: idRègle1,
              règle: règle1,
            },
          },
        },
      };

      const valErreursValid = await erreursValid.attendreQue(
        (x) => x.length > 0,
      );
      expect(valErreursValid).to.deep.equal([réf]);
    });

    it("Règle bornes relatives variable", async () => {
      règle2 = {
        typeRègle: "bornes",
        détails: {
          type: "dynamiqueVariable",
          val: idVariableTempMin,
          op: ">=",
        },
      };
      idRègle2 = await client.variables.ajouterRègleVariable({
        idVariable: idVariableTempMax,
        règle: règle2,
      });

      const réf: erreurValidation[] = [
        {
          id: id2,
          erreur: {
            règle: {
              source: { type: "tableau", id: idTableauRègles },
              colonne: idColonneTempMin,
              règle: {
                id: idRègle1,
                règle: règle1,
              },
            },
          },
        },
        {
          id: id2,
          erreur: {
            règle: {
              source: { type: "variable", id: idVariableTempMax },
              colonne: idColonneTempMax,
              règle: {
                id: idRègle2,
                règle: règle2,
              },
            },
          },
        },
      ];

      const valErreursValid = await erreursValid.attendreQue(
        (x) => x.length > 1,
      );
      expect(valErreursValid).to.deep.equal(réf);
    });

    it("Erreur règle variable introuvable", async () => {
      const règle: règleBornes<détailsRègleBornesDynamiqueVariable> = {
        typeRègle: "bornes",
        détails: {
          type: "dynamiqueVariable",
          val: idVariableTempMoyenne,
          op: "<=",
        },
      };

      idRègle3 = await client.tableaux.ajouterRègleTableau({
        idTableau: idTableauRègles,
        idColonne: idColonneTempMin,
        règle,
      });

      const réf: [erreurRègleBornesVariableNonPrésente] = [
        {
          détails: "variableBornesNonPrésente",
          règle: {
            source: { type: "tableau", id: idTableauRègles },
            colonne: idColonneTempMin,
            règle: {
              id: idRègle3,
              règle,
            },
          },
        },
      ];

      const val1 = await erreursRègles.attendreQue((x) => !!x && x.length > 0);
      expect(val1).to.deep.equal(réf);

      await client.tableaux.ajouterColonneTableau({
        idTableau: idTableauRègles,
        idVariable: idVariableTempMoyenne,
      });
      const val2 = await erreursRègles.attendreQue(
        (x) => !!x && x.length === 0,
      );
      expect(val2.length).to.equal(0);
    });
  });

  describe("Règle valeur catégorique", function () {
    describe("Catégories fixes", function () {
      let idTableauRègles: string;
      let idColonne: string;
      let idVariable: string;

      const erreurs = new utilsTestAttente.AttendreRésultat<
        erreurValidation[]
      >();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idTableauRègles = await client.tableaux.créerTableau({ idBd });

        fsOublier.push(
          await client.tableaux.suivreValidDonnées({
            idTableau: idTableauRègles,
            f: (e) => erreurs.mettreÀJour(e),
          }),
        );

        idVariable = await client.variables.créerVariable({
          catégorie: "chaîneNonTraductible",
        });
        idColonne = await client.tableaux.ajouterColonneTableau({
          idTableau: idTableauRègles,
          idVariable,
        });

        const règleCatégorique: règleValeurCatégorique = {
          typeRègle: "valeurCatégorique",
          détails: { type: "fixe", options: ["வணக்கம்", "សួស្តើ"] },
        };

        await client.tableaux.ajouterRègleTableau({
          idTableau: idTableauRègles,
          idColonne,
          règle: règleCatégorique,
        });
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        erreurs.toutAnnuler();
      });

      it("Ajout éléments valides", async () => {
        await client.tableaux.ajouterÉlément({
          idTableau: idTableauRègles,
          vals: {
            [idColonne]: "வணக்கம்",
          },
        });
        const rés = await erreurs.attendreExiste();
        expect(rés.length).to.equal(0);
      });
      it("Ajout éléments invalides", async () => {
        await client.tableaux.ajouterÉlément({
          idTableau: idTableauRègles,
          vals: {
            [idColonne]: "សូស្ដី",
          },
        });
        const val = await erreurs.attendreQue((x) => !!x && x.length > 0);
        expect(val.length).to.equal(1);
      });
    });

    describe("Catégories d'une colonne d'un tableau", function () {
      let idTableauÀTester: string;
      let idColonneÀTester: string;
      let idTableauCatégories: string;

      let idVariable: string;
      let idVariableRéf: string;
      let idRègle: string;
      let règleCatégorique: règleValeurCatégorique<détailsRègleValeurCatégoriqueDynamique>;

      const idColonneCatégories = "id colonne catégories";

      const erreursValid = new utilsTestAttente.AttendreRésultat<
        erreurValidation[]
      >();
      const erreursRègles = new utilsTestAttente.AttendreRésultat<
        erreurRègle[]
      >();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idTableauÀTester = await client.tableaux.créerTableau({ idBd });

        fsOublier.push(
          await client.tableaux.suivreValidDonnées({
            idTableau: idTableauÀTester,
            f: (e) => erreursValid.mettreÀJour(e),
          }),
        );

        fsOublier.push(
          await client.tableaux.suivreValidRègles({
            idTableau: idTableauÀTester,
            f: (e) => erreursRègles.mettreÀJour(e),
          }),
        );

        idVariable = await client.variables.créerVariable({
          catégorie: "chaîneNonTraductible",
        });
        idVariableRéf = await client.variables.créerVariable({
          catégorie: "chaîneNonTraductible",
        });
        idColonneÀTester = await client.tableaux.ajouterColonneTableau({
          idTableau: idTableauÀTester,
          idVariable,
        });

        idTableauCatégories = await client.tableaux.créerTableau({
          idBd,
        });

        règleCatégorique = {
          typeRègle: "valeurCatégorique",
          détails: {
            type: "dynamique",
            tableau: idTableauCatégories,
            colonne: idColonneCatégories,
          },
        };

        idRègle = await client.tableaux.ajouterRègleTableau({
          idTableau: idTableauÀTester,
          idColonne: idColonneÀTester,
          règle: règleCatégorique,
        });
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        erreursValid.toutAnnuler();
        erreursRègles.toutAnnuler();
      });

      it("Pas d'erreur (ici, au moins) si la colonne n'existe pas", async () => {
        const rés = await erreursValid.attendreExiste();
        expect(rés.length).to.equal(0);
      });

      it("Mais on a une erreur au niveau de la règle", async () => {
        const réf: erreurRègleCatégoriqueColonneInexistante = {
          règle: {
            règle: {
              id: idRègle,
              règle: règleCatégorique,
            },
            source: { type: "tableau", id: idTableauÀTester },
            colonne: idColonneÀTester,
          },
          détails: "colonneCatégInexistante",
        };
        const val = await erreursRègles.attendreQue((x) => !!x?.length);
        expect(val).to.deep.equal([réf]);
      });

      it("Ajout colonne réf", async () => {
        await client.tableaux.ajouterColonneTableau({
          idTableau: idTableauCatégories,
          idVariable: idVariableRéf,
          idColonne: idColonneCatégories,
        });
        const val = await erreursRègles.attendreQue((x) => x?.length === 0);
        expect(val.length).to.equal(0);
      });

      it("Ajout éléments colonne réf détecté", async () => {
        await client.tableaux.ajouterÉlément({
          idTableau: idTableauÀTester,
          vals: {
            [idColonneÀTester]: "வணக்கம்",
          },
        });
        let rés = await erreursValid.attendreQue((x) => x.length > 0);
        expect(rés.length).to.equal(1);

        for (const mot of ["வணக்கம்", "Ütz iwäch"]) {
          await client.tableaux.ajouterÉlément({
            idTableau: idTableauCatégories,
            vals: {
              [idColonneCatégories]: mot,
            },
          });
        }

        rés = await erreursValid.attendreQue((x) => x.length < 1);
        expect(rés.length).to.equal(0);
      });
      it("Ajout éléments valides", async () => {
        await client.tableaux.ajouterÉlément({
          idTableau: idTableauÀTester,
          vals: {
            [idColonneÀTester]: "Ütz iwäch",
          },
        });
        const rés = await erreursValid.attendreExiste();
        expect(rés.length).to.equal(0);
      });
      it("Ajout éléments invalides", async () => {
        await client.tableaux.ajouterÉlément({
          idTableau: idTableauÀTester,
          vals: {
            [idColonneÀTester]: "வணக்கம",
          },
        });
        const rés = await erreursValid.attendreQue((x) => x.length > 0);
        expect(rés.length).to.equal(1);
      });
    });
  });

  describe("Importer données", function () {
    let fOublier: schémaFonctionOublier;
    let idTableau: string;

    let idVarDate: string;
    let idVarEndroit: string;
    let idVarTempMin: string;
    let idVarTempMax: string;

    const données = new attente.AttendreRésultat<
      élémentDonnées<élémentBdListeDonnées>[]
    >();

    const idsCols: { [key: string]: string } = {};

    before(async () => {
      idTableau = await client.tableaux.créerTableau({ idBd });

      idVarDate = await client.variables.créerVariable({
        catégorie: "horoDatage",
      });
      idVarEndroit = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarTempMin = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      idVarTempMax = await client.variables.créerVariable({
        catégorie: "numérique",
      });

      for (const idVar of [
        idVarDate,
        idVarEndroit,
        idVarTempMin,
        idVarTempMax,
      ]) {
        const idCol = await client.tableaux.ajouterColonneTableau({
          idTableau,
          idVariable: idVar,
        });
        idsCols[idVar] = idCol;
      }

      fOublier = await client.tableaux.suivreDonnées({
        idTableau,
        f: (d) => données.mettreÀJour(d),
      });

      const élémentsBase = [
        {
          [idsCols[idVarEndroit]]: "ici",
          [idsCols[idVarDate]]: {
            système: "dateJS",
            val: new Date("2021-01-01").valueOf(),
          },
          [idsCols[idVarTempMin]]: 25,
        },
        {
          [idsCols[idVarEndroit]]: "ici",
          [idsCols[idVarDate]]: {
            système: "dateJS",
            val: new Date("2021-01-02").valueOf(),
          },
          [idsCols[idVarTempMin]]: 25,
        },
        {
          [idsCols[idVarEndroit]]: "là-bas",
          [idsCols[idVarDate]]: {
            système: "dateJS",
            val: new Date("2021-01-01").valueOf(),
          },
          [idsCols[idVarTempMin]]: 25,
        },
      ];

      await client.tableaux.ajouterÉlément({
        idTableau,
        vals: élémentsBase,
      });

      // Il faut attendre que les données soient bien ajoutées avant de progresser avec l'importation.
      await données.attendreQue((x) => x.length === 3);

      const nouvellesDonnées = [
        {
          [idsCols[idVarEndroit]]: "ici",
          [idsCols[idVarDate]]: {
            système: "dateJS",
            val: new Date("2021-01-01").valueOf(),
          },
          [idsCols[idVarTempMin]]: 25,
        },
        {
          [idsCols[idVarEndroit]]: "ici",
          [idsCols[idVarDate]]: {
            système: "dateJS",
            val: new Date("2021-01-02").valueOf(),
          },
          [idsCols[idVarTempMin]]: 27,
        },
      ];
      await client.tableaux.importerDonnées({
        idTableau,
        données: nouvellesDonnées,
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Données importées correctement", async () => {
      const val = await données.attendreQue(
        (x) =>
          x.length === 2 &&
          !x.some((d) => d.données[idsCols[idVarEndroit]] === "là-bas"),
      );

      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(2);
      expect(
        val
          .map((d) => d.données)
          .map((d) => {
            delete d.id;
            return d;
          }),
      ).to.have.deep.members([
        {
          [idsCols[idVarEndroit]]: "ici",
          [idsCols[idVarDate]]: {
            système: "dateJS",
            val: new Date("2021-01-01").valueOf(),
          },
          [idsCols[idVarTempMin]]: 25,
        },
        {
          [idsCols[idVarEndroit]]: "ici",
          [idsCols[idVarDate]]: {
            système: "dateJS",
            val: new Date("2021-01-02").valueOf(),
          },
          [idsCols[idVarTempMin]]: 27,
        },
      ]);
    });
  });

  describe("Exporter données", function () {
    let idTableau: string;
    let idVarNumérique: string;
    let idVarChaîne: string;
    let idVarFichier: string;
    let idVarBooléenne: string;

    let idColNumérique: string;
    let idColChaîne: string;
    let idColFichier: string;
    let idColBooléenne: string;

    let doc: XLSX.WorkBook;
    let fichiersSFIP: Set<string>;

    const nomTableauFr = "Tableau test";

    before(async () => {
      idTableau = await client.tableaux.créerTableau({ idBd });
      idVarNumérique = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      idVarChaîne = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarFichier = await client.variables.créerVariable({
        catégorie: "fichier",
      });
      idVarBooléenne = await client.variables.créerVariable({
        catégorie: "booléen",
      });

      idColNumérique = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable: idVarNumérique,
      });
      idColChaîne = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable: idVarChaîne,
      });
      idColBooléenne = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable: idVarBooléenne,
      });
      idColFichier = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable: idVarFichier,
      });

      await client.tableaux.sauvegarderNomsTableau({
        idTableau,
        noms: {
          fr: nomTableauFr,
        },
      });

      await client.variables.sauvegarderNomsVariable({
        idVariable: idVarNumérique,
        noms: {
          fr: "Numérique",
          हिं: "यह है संख्या",
        },
      });

      await client.variables.sauvegarderNomsVariable({
        idVariable: idVarChaîne,
        noms: {
          fr: "Chaîne",
          த: "இது உரை ஆகும்",
        },
      });

      const éléments: { [key: string]: élémentsBd }[] = [
        {
          [idColNumérique]: 123,
          [idColChaîne]: "வணக்கம்",
          [idColBooléenne]: true,
          [idColFichier]: "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ.mp4",
        },
        {
          [idColNumérique]: 456,
        },
      ];
      for (const élément of éléments) {
        await client.tableaux.ajouterÉlément({
          idTableau,
          vals: élément,
        });
      }
      ({ doc, fichiersSFIP } = await client.tableaux.exporterDonnées({
        idTableau,
        langues: ["த", "fr"],
      }));
    });

    it("Langue appropriée pour le nom du tableau", () => {
      expect(doc.SheetNames[0]).to.equal(nomTableauFr);
    });

    it("Langue appropriée pour les noms des colonnes", () => {
      for (const { cellule } of [
        { cellule: "A1" },
        { cellule: "B1" },
        { cellule: "C1" },
        { cellule: "D1" },
      ]) {
        expect([
          "Numérique",
          "இது உரை ஆகும்",
          idColBooléenne,
          idColFichier,
        ]).to.contain((doc.Sheets[nomTableauFr][cellule] as XLSX.CellObject).v);
      }
    });

    it("Données numériques exportées", async () => {
      const iColNumérique = ["A", "B", "C", "D"].find(
        (i) => doc.Sheets[nomTableauFr][`${i}1`].v === "Numérique",
      );
      const val = doc.Sheets[nomTableauFr][`${iColNumérique}2`].v;
      expect(val).to.equal(123);

      const val2 = doc.Sheets[nomTableauFr][`${iColNumérique}3`].v;
      expect(val2).to.equal(456);
    });

    it("Données chaîne exportées", async () => {
      const iColChaîne = ["A", "B", "C", "D"].find(
        (i) => doc.Sheets[nomTableauFr][`${i}1`].v === "இது உரை ஆகும்",
      );
      const val = doc.Sheets[nomTableauFr][`${iColChaîne}2`].v;
      expect(val).to.equal("வணக்கம்");
    });

    it("Données booléennes exportées", async () => {
      const iColBooléenne = ["A", "B", "C", "D"].find(
        (i) => doc.Sheets[nomTableauFr][`${i}1`].v === idColBooléenne,
      );
      const val = doc.Sheets[nomTableauFr][`${iColBooléenne}2`].v;
      expect(val).to.equal("true");
    });

    it("Données fichier exportées", async () => {
      const iColFichier = ["A", "B", "C", "D"].find(
        (i) => doc.Sheets[nomTableauFr][`${i}1`].v === idColFichier,
      );
      const val = doc.Sheets[nomTableauFr][`${iColFichier}2`].v;
      expect(val).to.equal(
        "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ.mp4",
      );
    });

    it("Les fichiers SFIP sont détectés", async () => {
      expect(fichiersSFIP.size).to.equal(1);
      expect(fichiersSFIP).to.deep.equal(
        new Set(["QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ.mp4"]),
      );
    });

    it("Exporter avec ids des colonnes et du tableau", async () => {
      ({ doc } = await client.tableaux.exporterDonnées({ idTableau }));

      const idTableauCourt = idTableau.split("/").pop()!.slice(0, 30);
      expect(doc.SheetNames[0]).to.equal(idTableauCourt);
      for (const { cellule } of [
        { cellule: "A1" },
        { cellule: "B1" },
        { cellule: "C1" },
        { cellule: "D1" },
      ]) {
        expect([
          idColNumérique,
          idColChaîne,
          idColBooléenne,
          idColFichier,
        ]).to.contain(doc.Sheets[idTableauCourt][cellule].v);
      }
    });
  });
});
