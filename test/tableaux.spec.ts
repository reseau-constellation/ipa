
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
