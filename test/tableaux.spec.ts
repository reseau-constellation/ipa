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

describe.only("Tableaux", function () {
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

  describe("Création", () => {
    let accès: boolean;

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idTableau = await client.tableaux.créerTableau({ idBd });
      fsOublier.push(
        await client.suivrePermissionÉcrire({
          id: idTableau,
          f: (x) => (accès = x),
        }),
      );
    });
    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });
    it("Créé", () => {
      expect(isValidAddress(idTableau)).to.be.true();
    });
    it("Accès", async () => {
      expect(accès).to.be.true();
    });
  });

  describe("Noms", function () {
    let fOublier: schémaFonctionOublier;
    const noms = new attente.AttendreRésultat<{ [key: string]: string }>();

    before(async () => {
      fOublier = await client.tableaux.suivreNomsTableau({
        idTableau,
        f: (n) => noms.mettreÀJour(n),
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de noms pour commencer", async () => {
      const val = await noms.attendreExiste();
      expect(Object.keys(val).length).to.equal(0);
    });

    it("Ajouter un nom", async () => {
      await client.tableaux.sauvegarderNomTableau({
        idTableau,
        langue: "fr",
        nom: "Alphabets",
      });
      const val = await noms.attendreQue((x) => !!x["fr"]);
      expect(val.fr).to.equal("Alphabets");
    });

    it("Ajouter des noms", async () => {
      await client.tableaux.sauvegarderNomsTableau({
        idTableau,
        noms: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });
      const val = await noms.attendreQue((x) => Object.keys(x).length > 2);
      expect(val).to.deep.equal({
        fr: "Alphabets",
        த: "எழுத்துகள்",
        हिं: "वर्णमाला",
      });
    });

    it("Changer un nom", async () => {
      await client.tableaux.sauvegarderNomTableau({
        idTableau,
        langue: "fr",
        nom: "Systèmes d'écriture",
      });
      const val = await noms.attendreQue((x) => x.fr !== "Alphabets");
      expect(val.fr).to.equal("Systèmes d'écriture");
    });

    it("Effacer un nom", async () => {
      await client.tableaux.effacerNomTableau({
        idTableau,
        langue: "fr",
      });
      const val = await noms.attendreQue((x) => !x["fr"]);
      expect(val).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("Données", function () {
    let idsVariables: string[];

    const colonnes = new attente.AttendreRésultat<InfoColAvecCatégorie[]>();
    const variables = new attente.AttendreRésultat<string[]>();
    const données = new attente.AttendreRésultat<
      élémentDonnées<élémentBdListeDonnées>[]
    >();

    const idsColonnes: string[] = [];
    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idTableau = await client.tableaux.créerTableau({ idBd });
      fsOublier.push(
        await client.tableaux.suivreColonnesEtCatégoriesTableau({
          idTableau,
          f: (c) => colonnes.mettreÀJour(c),
        }),
      );
      fsOublier.push(
        await client.tableaux.suivreVariables({
          idTableau,
          f: (v) => variables.mettreÀJour(v),
        }),
      );
      fsOublier.push(
        await client.tableaux.suivreDonnées({
          idTableau,
          f: (d) => données.mettreÀJour(d),
        }),
      );

      const idVariable1 = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      const idVariable2 = await client.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idsVariables = [idVariable1, idVariable2];
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("Tout est vide pour commencer", async () => {
      const valVariables = await variables.attendreExiste();
      expect(valVariables).to.be.an.empty("array");

      const valColonnes = await colonnes.attendreExiste();
      expect(valColonnes).to.be.an.empty("array");

      const valDonnées = await données.attendreExiste();
      expect(valDonnées).to.be.an.empty("array");
    });

    it("Ajouter colonnes", async () => {
      for (const idV of idsVariables) {
        idsColonnes.push(
          await client.tableaux.ajouterColonneTableau({
            idTableau,
            idVariable: idV,
          }),
        );
      }
      const valColonnes = await colonnes.attendreQue((x) => x.length > 1);
      expect(valColonnes.map((c) => c.variable)).to.deep.equal(idsVariables);
    });

    it("Les variables sont détectées", async () => {
      const valVariables = await variables.attendreQue((x) => x.length > 0);
      expect(valVariables).to.deep.equal(idsVariables);
    });

    it("Ajouter un élément", async () => {
      const élément = {
        [idsColonnes[0]]: 123.456,
        [idsColonnes[1]]: "வணக்கம்",
      };
      await client.tableaux.ajouterÉlément({ idTableau, vals: élément });

      const valDonnées = await données.attendreQue((x) => x.length > 0);
      expect(Array.isArray(valDonnées)).to.be.true();
      expect(valDonnées.length).to.equal(1);

      const élémentDonnées = valDonnées[0];
      expect(typeof élémentDonnées.id).to.equal("string");
      for (const [cl, v] of Object.entries(élément)) {
        expect(élémentDonnées.données[cl]).to.equal(v);
      }
    });

    it("Modifier un élément - modifier une valeur", async () => {
      let valDonnées = await données.attendreExiste();
      const élémentDonnées = valDonnées[0];

      await client.tableaux.modifierÉlément({
        idTableau,
        vals: { [idsColonnes[0]]: -123 },
        idÉlément: élémentDonnées.id,
      });

      valDonnées = await données.attendreQue(
        (x) => x.length > 0 && x[0].données[idsColonnes[0]] !== 123.456,
      );
      expect(Array.isArray(valDonnées)).to.be.true();
      expect(valDonnées.length).to.equal(1);

      const nouvelÉlémentDonnées = valDonnées[0];
      expect(nouvelÉlémentDonnées.données[idsColonnes[0]]).to.equal(-123);
    });

    it("Modifier un élément - effacer une clef", async () => {
      let valDonnées = await données.attendreExiste();
      const élémentDonnées = valDonnées[0];

      await client.tableaux.modifierÉlément({
        idTableau,
        vals: { [idsColonnes[0]]: undefined },
        idÉlément: élémentDonnées.id,
      });

      valDonnées = await données.attendreQue(
        (x) => x.length > 0 && !x[0].données[idsColonnes[0]],
      );
      const nouvelÉlémentDonnées = valDonnées[0];
      expect(Object.keys(nouvelÉlémentDonnées.données)).not.to.include(
        idsColonnes[0],
      );
    });

    it("Modifier un élément - ajouter une clef", async () => {
      let valDonnées = await données.attendreExiste();
      const élémentDonnées = valDonnées[0];

      await client.tableaux.modifierÉlément({
        idTableau,
        vals: { [idsColonnes[0]]: 123 },
        idÉlément: élémentDonnées.id,
      });

      valDonnées = await données.attendreQue(
        (x) => x.length > 0 && !!x[0].données[idsColonnes[0]],
      );
      const nouvelÉlémentDonnées = valDonnées[0];
      expect(nouvelÉlémentDonnées.données[idsColonnes[0]]).to.equal(123);
    });

    it("Effacer un élément", async () => {
      let valDonnées = await données.attendreExiste();
      const élémentDonnées = valDonnées[0];

      await client.tableaux.effacerÉlément({
        idTableau,
        idÉlément: élémentDonnées.id,
      });

      valDonnées = await données.attendreQue((x) => x.length === 0);
      expect(valDonnées).to.be.an.empty("array");
    });

    it("Effacer une colonne", async () => {
      await client.tableaux.effacerColonneTableau({
        idTableau,
        idColonne: idsColonnes[0],
      });
      await new Promise<void>((résoudre) => setTimeout(() => résoudre(), 3000));
      const valColonnes = await colonnes.attendreQue((x) => x.length === 1);
      const variablesDesColonnes = valColonnes.map((c) => c.variable);
      expect(variablesDesColonnes.length).to.equal(1);
      expect(variablesDesColonnes).to.deep.equal([idsVariables[1]]);
    });
  });

  describe("Colonnes index", function () {
    const indexes = new attente.AttendreRésultat<string[]>();
    const colonnes = new attente.AttendreRésultat<InfoColAvecCatégorie[]>();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      fsOublier.push(
        await client.tableaux.suivreIndex({
          idTableau,
          f: (x) => indexes.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.tableaux.suivreColonnesEtCatégoriesTableau({
          idTableau,
          f: (c) => colonnes.mettreÀJour(c),
        }),
      );
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("Pas d'index pour commencer", async () => {
      const valIndexes = await indexes.attendreExiste();
      expect(valIndexes).to.be.an.empty("array");
    });

    it("Ajouter un index", async () => {
      const valColonnes = await colonnes.attendreExiste();

      await client.tableaux.changerColIndex({
        idTableau,
        idColonne: valColonnes[0].id,
        val: true,
      });
      const valIndexes = await indexes.attendreQue((x) => x.length > 0);
      expect(valIndexes.length).to.equal(1);
      expect(valIndexes).to.deep.equal([valColonnes[0].id]);
    });

    it("Effacer l'index", async () => {
      const valColonnes = await colonnes.attendreExiste();

      await client.tableaux.changerColIndex({
        idTableau,
        idColonne: valColonnes[0].id,
        val: false,
      });

      const valIndexes = await indexes.attendreQue((x) => x.length === 0);
      expect(valIndexes).to.be.an.empty("array");
    });
  });

  describe("Id colonne", function () {
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

    it("Changer un id de colonne", async () => {
      const valColonnes = await colonnes.attendreExiste();

      await client.tableaux.changerIdColonne({
        idTableau,
        idColonne: valColonnes[0].id,
        nouvelleIdColonne: "nouvel identifiant",
      });
      const nouvellesColonnes = await colonnes.attendreQue(
        (x) => x[0].id !== valColonnes[0].id,
      );
      expect(nouvellesColonnes[0].id).to.equal("nouvel identifiant");
    });
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

    it("Règles génériques de catégorie pour commencer", async () => {
      const val = await résRègles.attendreQue((r) => !!r && r.length === 2);

      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(2);
      for (const r of val) {
        expect(r.règle.règle.typeRègle).to.equal("catégorie");
      }
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

  describe("Tableau avec variables non locales", function () {
    let idTableau: string;
    let idColonne: string;

    const variables = new attente.AttendreRésultat<string[]>();
    const colonnes = new attente.AttendreRésultat<InfoColAvecCatégorie[]>();
    const colonnesSansCatégorie = new attente.AttendreRésultat<InfoCol[]>();
    const données = new attente.AttendreRésultat<élémentDonnées[]>();

    const idVarChaîne =
      "/orbitdb/zdpuAximNmZyUWXGCaLmwSEGDeWmuqfgaoogA7KNSa1B2DAAF";
    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idTableau = await client.tableaux.créerTableau({ idBd });
      idColonne = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable: idVarChaîne,
      });
      fsOublier.push(
        await client.tableaux.suivreVariables({
          idTableau,
          f: (v) => variables.mettreÀJour(v),
        }),
      );
      fsOublier.push(
        await client.tableaux.suivreColonnesEtCatégoriesTableau({
          idTableau,
          f: (c) => colonnes.mettreÀJour(c),
        }),
      );
      fsOublier.push(
        await client.tableaux.suivreColonnesTableau({
          idTableau,
          f: (c) => colonnesSansCatégorie.mettreÀJour(c),
        }),
      );
      fsOublier.push(
        await client.tableaux.suivreDonnées({
          idTableau,
          f: (d) => données.mettreÀJour(d),
        }),
      );
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("Tableau créé", () => {
      expect(isValidAddress(idTableau)).to.be.true();
    });
    it("Suivre variables", async () => {
      const valVariables = await variables.attendreQue((x) => x.length > 0);
      expect(valVariables).to.deep.equal([idVarChaîne]);
    });
    it("Suivre colonnes", async () => {
      expect(colonnes.val).to.be.undefined();
    });
    it("Suivre colonnes sans catégorie", async () => {
      const val = await colonnesSansCatégorie.attendreQue((x) => x.length > 0);
      expect(val).to.deep.equal([{ id: idColonne, variable: idVarChaîne }]);
    });
    it("Ajouter données", async () => {
      await client.tableaux.ajouterÉlément({
        idTableau,
        vals: {
          [idColonne]: "Bonjour !",
        },
      });

      const valDonnées = await données.attendreQue((x) => x.length > 0);
      expect(valDonnées[0].données[idColonne]).to.equal("Bonjour !");
    });
  });

  describe("Copier tableau", function () {
    let idTableau: string;
    let idVariable: string;
    let idColonne: string;
    let idRègle: string;

    const variables = new attente.AttendreRésultat<string[]>();
    const noms = new attente.AttendreRésultat<{
      [key: string]: string;
    }>();
    const données = new attente.AttendreRésultat<
      élémentDonnées<élémentBdListeDonnées>[]
    >();
    const colonnes = new attente.AttendreRésultat<InfoColAvecCatégorie[]>();
    const colsIndexe = new attente.AttendreRésultat<string[]>();
    const règles = new attente.AttendreRésultat<règleColonne[]>();

    let idTableauCopie: string;

    const réfNoms = {
      த: "மழை",
      हिं: "बारिश",
    };
    const règle: règleBornes = {
      typeRègle: "bornes",
      détails: {
        type: "fixe",
        val: 0,
        op: ">",
      },
    };

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idTableau = await client.tableaux.créerTableau({ idBd });
      await client.tableaux.sauvegarderNomsTableau({
        idTableau,
        noms: réfNoms,
      });

      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      idColonne = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable,
      });
      await client.tableaux.changerColIndex({
        idTableau,
        idColonne,
        val: true,
      });

      await client.tableaux.ajouterÉlément({
        idTableau,
        vals: {
          [idColonne]: 123,
        },
      });

      idRègle = await client.tableaux.ajouterRègleTableau({
        idTableau,
        idColonne,
        règle,
      });

      idTableauCopie = await client.tableaux.copierTableau({
        id: idTableau,
        idBd,
      });

      fsOublier.push(
        await client.tableaux.suivreVariables({
          idTableau: idTableauCopie,
          f: (x) => variables.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.tableaux.suivreNomsTableau({
          idTableau: idTableauCopie,
          f: (x) => noms.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.tableaux.suivreDonnées({
          idTableau: idTableauCopie,
          f: (x) => données.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.tableaux.suivreColonnesEtCatégoriesTableau({
          idTableau: idTableauCopie,
          f: (x) => colonnes.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.tableaux.suivreIndex({
          idTableau: idTableauCopie,
          f: (x) => colsIndexe.mettreÀJour(x),
        }),
      );
      fsOublier.push(
        await client.tableaux.suivreRègles({
          idTableau: idTableauCopie,
          f: (x) => règles.mettreÀJour(x),
        }),
      );
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
      colonnes.toutAnnuler();
    });

    it("Le tableau est copié", async () => {
      expect(isValidAddress(idTableauCopie)).to.be.true();
    });

    it("Les noms sont copiés", async () => {
      const val = await noms.attendreExiste();
      expect(val).to.deep.equal(réfNoms);
    });

    it("Les colonnes sont copiées", async () => {
      const val = await colonnes.attendreQue((x) => x.length > 0);
      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(1);
      expect(val[0].variable).to.equal(idVariable);
    });

    it("Les indexes sont copiés", async () => {
      const val = await colsIndexe.attendreQue((x) => x.length > 0);
      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(1);
      expect(val[0]).to.equal(idColonne);
    });

    it("Les règles sont copiés", async () => {
      const vals = await règles.attendreQue((x) =>
        x.some((r) => r.règle.id === idRègle),
      );

      const règleRecherchée = vals.find((r) => r.règle.id === idRègle);
      expect(règleRecherchée).to.not.be.undefined();
      expect(règleRecherchée?.colonne).to.equal(colonnes.val?.[0].id);
      expect(règleRecherchée?.règle.règle).to.deep.equal(règle);
    });

    it("Les variables sont copiés", async () => {
      const val = await variables.attendreQue((v) => v.length > 0);

      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(1);
      expect(val[0]).to.equal(idVariable);
    });

    it("Les données sont copiés", async () => {
      const valColonnes = await colonnes.attendreExiste();
      const valDonnées = await données.attendreQue((x) => x.length > 0);

      expect(Array.isArray(valDonnées)).to.be.true();
      expect(valDonnées.length).to.equal(1);
      expect(valDonnées[0].données[valColonnes[0].id]).to.equal(123);
    });
  });

  describe("Combiner données tableaux", function () {
    let idTableauBase: string;
    let idTableau2: string;

    let idVarDate: string;
    let idVarEndroit: string;
    let idVarTempMin: string;
    let idVarTempMax: string;

    const données = new attente.AttendreRésultat<
      élémentDonnées<élémentBdListeDonnées>[]
    >();
    let fOublier: schémaFonctionOublier;

    const idsCols: { [key: string]: string } = {};

    before(async () => {
      idTableauBase = await client.tableaux.créerTableau({ idBd });
      idTableau2 = await client.tableaux.créerTableau({ idBd });

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
          idTableau: idTableauBase,
          idVariable: idVar,
        });

        idsCols[idVar] = idCol;
        await client.tableaux.ajouterColonneTableau({
          idTableau: idTableau2,
          idVariable: idVar,
          idColonne: idCol,
        });
      }
      for (const idVar of [idVarDate, idVarEndroit]) {
        await client.tableaux.changerColIndex({
          idTableau: idTableauBase,
          idColonne: idsCols[idVar],
          val: true,
        });
        await client.tableaux.changerColIndex({
          idTableau: idTableau2,
          idColonne: idsCols[idVar],
          val: true,
        });
      }

      fOublier = await client.tableaux.suivreDonnées({
        idTableau: idTableauBase,
        f: (d) => données.mettreÀJour(d),
      });

      const élémentsBase = [
        {
          [idsCols[idVarEndroit]]: "ici",
          [idsCols[idVarDate]]: "2021-01-01",
          [idsCols[idVarTempMin]]: 25,
        },
        {
          [idsCols[idVarEndroit]]: "ici",
          [idsCols[idVarDate]]: "2021-01-02",
          [idsCols[idVarTempMin]]: 25,
        },
        {
          [idsCols[idVarEndroit]]: "là-bas",
          [idsCols[idVarDate]]: "2021-01-01",
          [idsCols[idVarTempMin]]: 25,
        },
      ];
      for (const élément of élémentsBase) {
        await client.tableaux.ajouterÉlément({
          idTableau: idTableauBase,
          vals: élément,
        });
      }

      const éléments2 = [
        {
          [idsCols[idVarEndroit]]: "ici",
          [idsCols[idVarDate]]: "2021-01-01",
          [idsCols[idVarTempMin]]: 27,
          [idsCols[idVarTempMax]]: 30,
        },
        {
          [idsCols[idVarEndroit]]: "ici",
          [idsCols[idVarDate]]: "2021-01-02",
          [idsCols[idVarTempMin]]: 27,
        },
        {
          [idsCols[idVarEndroit]]: "là-bas",
          [idsCols[idVarDate]]: "2021-01-02",
          [idsCols[idVarTempMin]]: 27,
        },
      ];
      for (const élément of éléments2) {
        await client.tableaux.ajouterÉlément({
          idTableau: idTableau2,
          vals: élément,
        });
      }

      await client.tableaux.combinerDonnées({
        idTableauBase,
        idTableau2,
      });
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Données manquantes ajoutées", async () => {
      const réf = [
        {
          [idsCols[idVarEndroit]]: "ici",
          [idsCols[idVarDate]]: "2021-01-01",
          [idsCols[idVarTempMin]]: 25,
          [idsCols[idVarTempMax]]: 30,
        },
        {
          [idsCols[idVarEndroit]]: "ici",
          [idsCols[idVarDate]]: "2021-01-02",
          [idsCols[idVarTempMin]]: 25,
        },
        {
          [idsCols[idVarEndroit]]: "là-bas",
          [idsCols[idVarDate]]: "2021-01-01",
          [idsCols[idVarTempMin]]: 25,
        },
        {
          [idsCols[idVarEndroit]]: "là-bas",
          [idsCols[idVarDate]]: "2021-01-02",
          [idsCols[idVarTempMin]]: 27,
        },
      ];
      const val = await données.attendreQue((x) => x.length === réf.length);

      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(4);
      expect(
        val
          .map((d) => d.données)
          .map((d) => {
            delete d.id;
            return d;
          }),
      ).to.deep.include.members(réf);
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
