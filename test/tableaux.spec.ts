describe("Tableaux", function () {
  let fOublierClients: () => Promise<void>;
  let clients: Constellation[];
  let client: Constellation;

  let idBd: string;

  before(async () => {

    client = clients[0];
    idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Exporter données", function () {
    let idTableau: string;
    let idVarNumérique: string;
    let idVarChaîne: string;
    let idVarFichier: string;
    let idVarBooléenne: string;


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
    });

  });
});
