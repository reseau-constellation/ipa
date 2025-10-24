import { expect } from "aegir/chai";
import { constellation as utilsTestConstellation } from "@constl/utils-tests";
import { obtenir } from "@constl/utils-ipa";
import { créerConstellation } from "@/index.js";
import { TraducsNom } from "@/types.js";
import type { Constellation } from "@/client.js";
import type {
  règleBornes,
  règleCatégorie,
  règleVariableAvecId,
} from "@/valid.js";
import type { catégorieVariables } from "@/variables.js";

const { créerConstellationsTest } = utilsTestConstellation;

describe("Variables", function () {
  let fOublierClients: () => Promise<void>;
  let clients: Constellation[];
  let client: Constellation;

  before("Préparer clients", async () => {
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
    let idVariable: string;

    it("Pas de variables pour commencer", async () => {
      const variables = await obtenir(({ siDéfini }) =>
        client.variables.suivreVariables({
          f: siDéfini(),
        }),
      );
      expect(variables).to.be.an.empty("array");
    });
    it("Créer des variables", async () => {
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      const variables = await obtenir(({ siPasVide }) =>
        client.variables.suivreVariables({
          f: siPasVide(),
        }),
      );
      expect(variables).to.deep.equal([idVariable]);
    });

    it("Effacer une variable", async () => {
      await client.variables.effacerVariable({ idVariable });
      const variables = await obtenir(({ siVide }) =>
        client.variables.suivreVariables({
          f: siVide(),
        }),
      );
      expect(variables).to.be.an.empty("array");
    });
  });

  describe("Mes variables", function () {
    let idVariable: string;

    before("Créer variable", async () => {
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
    });

    it("La variable est déjà ajoutée", async () => {
      const variables = await obtenir(({ siPasVide }) =>
        client.variables.suivreVariables({
          f: siPasVide(),
        }),
      );
      expect(variables).to.contain(idVariable);
    });

    it("Enlever de mes variables", async () => {
      await client.variables.enleverDeMesVariables({ idVariable });
      const variables = await obtenir(({ siVide }) =>
        client.variables.suivreVariables({
          f: siVide(),
        }),
      );
      expect(variables).not.to.contain(idVariable);
    });

    it("Ajouter à mes variables", async () => {
      await client.variables.ajouterÀMesVariables({ idVariable });
      const variables = await obtenir(({ siPasVide }) =>
        client.variables.suivreVariables({
          f: siPasVide(),
        }),
      );
      expect(variables).to.contain(idVariable);
    });
  });

  describe("Noms", function () {
    let idVariable: string;

    before("Suivre noms variable", async () => {
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
    });

    it("Pas de noms pour commencer", async () => {
      const noms = await obtenir<TraducsTexte>(({ siDéfini }) =>
        client.variables.suivreNomsVariable({
          idVariable,
          f: siDéfini(),
        }),
      );
      expect(Object.keys(noms)).to.have.lengthOf(0);
    });

    it("Ajouter un nom", async () => {
      await client.variables.sauvegarderNomVariable({
        idVariable,
        langue: "fr",
        nom: "Précipitation",
      });
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        client.variables.suivreNomsVariable({
          idVariable,
          f: siPasVide(),
        }),
      );
      expect(noms.fr).to.equal("Précipitation");
    });

    it("Ajouter des noms", async () => {
      await client.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          த: "மழை",
          हिं: "बारिश",
        },
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        client.variables.suivreNomsVariable({
          idVariable,
          f: si((x) => Object.keys(x).length > 2),
        }),
      );
      expect(noms).to.deep.equal({
        த: "மழை",
        हिं: "बारिश",
        fr: "Précipitation",
      });
    });

    it("Changer un nom", async () => {
      await client.variables.sauvegarderNomVariable({
        idVariable,
        langue: "fr",
        nom: "précipitation",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        client.variables.suivreNomsVariable({
          idVariable,
          f: si((x) => !!x.fr && !x.fr.startsWith("P")),
        }),
      );
      expect(noms.fr).to.equal("précipitation");
    });

    it("Effacer un nom", async () => {
      await client.variables.effacerNomVariable({
        idVariable,
        langue: "fr",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        client.variables.suivreNomsVariable({
          idVariable,
          f: si((x) => !x["fr"]),
        }),
      );
      expect(noms).to.deep.equal({ த: "மழை", हिं: "बारिश" });
    });
  });

  describe("Descriptions", function () {
    let idVariable: string;

    before("Préparer clients", async () => {
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
    });

    it("Pas de descriptions pour commencer", async () => {
      const descrs = await obtenir<TraducsTexte>(({ siDéfini }) =>
        client.variables.suivreDescriptionsVariable({
          idVariable,
          f: siDéfini(),
        }),
      );
      expect(Object.keys(descrs)).to.have.lengthOf(0);
    });

    it("Ajouter une description", async () => {
      await client.variables.sauvegarderDescriptionVariable({
        idVariable,
        langue: "fr",
        description: "la quantité de précipitation quotidienne",
      });
      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        client.variables.suivreDescriptionsVariable({
          idVariable,
          f: si((x) => !!x["fr"]),
        }),
      );
      expect(descrs.fr).to.equal("la quantité de précipitation quotidienne");
    });

    it("Ajouter des descriptions", async () => {
      await client.variables.sauvegarderDescriptionsVariable({
        idVariable,
        descriptions: {
          த: "தினசரி மழை",
          हिं: "दैनिक बारिश",
        },
      });
      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        client.variables.suivreDescriptionsVariable({
          idVariable,
          f: si((x) => Object.keys(x).length > 2),
        }),
      );
      expect(descrs).to.deep.equal({
        த: "தினசரி மழை",
        हिं: "दैनिक बारिश",
        fr: "la quantité de précipitation quotidienne",
      });
    });

    it("Changer une description", async () => {
      await client.variables.sauvegarderDescriptionVariable({
        idVariable,
        langue: "fr",
        description: "La quantité de précipitation quotidienne",
      });
      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        client.variables.suivreDescriptionsVariable({
          idVariable,
          f: si((x) => !!x.fr && x["fr"].startsWith("L")),
        }),
      );
      expect(descrs.fr).to.equal("La quantité de précipitation quotidienne");
    });

    it("Effacer une description", async () => {
      await client.variables.effacerDescriptionVariable({
        idVariable,
        langue: "fr",
      });
      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        client.variables.suivreDescriptionsVariable({
          idVariable,
          f: si((x) => !x["fr"]),
        }),
      );

      expect(descrs).to.deep.equal({
        த: "தினசரி மழை",
        हिं: "दैनिक बारिश",
      });
    });
  });

  describe("Catégorie", function () {
    let idVariable: string;

    before("Préparer clients", async () => {
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
    });

    it("Changer la catégorie", async () => {
      await client.variables.sauvegarderCatégorieVariable({
        idVariable,
        catégorie: "chaîne",
      });
      const catégorie = await obtenir<catégorieVariables>(({ si }) =>
        client.variables.suivreCatégorieVariable({
          idVariable,
          f: si((x) => x.catégorie !== "numérique"),
        }),
      );
      expect(catégorie).to.deep.equal({
        type: "simple",
        catégorie: "chaîne",
      });
    });
  });

  describe("Unités", function () {
    let idVariable: string;

    before("Préparer clients", async () => {
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
    });

    it("Aucune unité pour commencer", async () => {
      const unités = await obtenir(({ siNul }) =>
        client.variables.suivreUnitésVariable({
          idVariable,
          f: siNul(),
        }),
      );
      expect(unités).to.be.null();
    });

    it("Changer les unités", async () => {
      await client.variables.sauvegarderUnitésVariable({
        idVariable,
        idUnité: "mm",
      });
      const unités = await obtenir(({ siPasNul }) =>
        client.variables.suivreUnitésVariable({
          idVariable,
          f: siPasNul(),
        }),
      );
      expect(unités).to.equal("mm");
    });
  });

  describe("Règles", function () {
    let idVariable: string;
    let idRègle: string;

    before("Préparer clients", async () => {
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
    });

    it("Règle générique de catégorie pour commencer", async () => {
      const règles = await obtenir<règleVariableAvecId[]>(({ siPasVide }) =>
        client.variables.suivreRèglesVariable({
          idVariable,
          f: siPasVide(),
        }),
      );
      expect(Array.isArray(règles)).to.be.true();
      expect(règles).to.have.lengthOf(1);
      expect(règles[0].règle.typeRègle).to.equal("catégorie");
    });

    it("Ajouter une règle", async () => {
      const règle: règleBornes = {
        typeRègle: "bornes",
        détails: {
          type: "fixe",
          val: 0,
          op: ">",
        },
      };
      idRègle = await client.variables.ajouterRègleVariable({
        idVariable,
        règle,
      });
      const règles = await obtenir<règleVariableAvecId[]>(({ si }) =>
        client.variables.suivreRèglesVariable({
          idVariable,
          f: si((x) => x.length > 1),
        }),
      );
      expect(règles).to.have.lengthOf(2);
      expect(règles.filter((r) => r.id === idRègle)).to.have.lengthOf(1);
    });

    it("Effacer une règle", async () => {
      await client.variables.effacerRègleVariable({ idVariable, idRègle });
      const règles = await obtenir<règleVariableAvecId[]>(({ si }) =>
        client.variables.suivreRèglesVariable({
          idVariable,
          f: si((x) => x.length < 2),
        }),
      );
      expect(règles).to.have.lengthOf(1);
    });

    it("On ne peut pas effacer une règle générique de base", async () => {
      const règles = await obtenir<règleVariableAvecId[]>(({ siPasVide }) =>
        client.variables.suivreRèglesVariable({
          idVariable,
          f: siPasVide(),
        }),
      );
      const règleDeBase = règles[0];
      await client.variables.effacerRègleVariable({
        idVariable,
        idRègle: règleDeBase.id,
      });
      expect(règles[0].id).to.equal(règleDeBase.id);
    });

    it("On détecte le changement de catégorie", async () => {
      await client.variables.sauvegarderCatégorieVariable({
        idVariable,
        catégorie: "horoDatage",
      });
      const règles = await obtenir<règleVariableAvecId[]>(({ si }) =>
        client.variables.suivreRèglesVariable({
          idVariable,
          f: si((x) =>
            x.some(
              (r) =>
                r.règle.typeRègle === "catégorie" &&
                r.règle.détails.catégorie.catégorie === "horoDatage",
            ),
          ),
        }),
      );
      const règleCatégorie = règles.find(
        (r) => r.règle.typeRègle === "catégorie",
      ) as règleVariableAvecId<règleCatégorie> | undefined;
      expect(règleCatégorie).to.exist();
      expect(règleCatégorie?.règle.détails.catégorie).to.deep.equal({
        type: "simple",
        catégorie: "horoDatage",
      });
    });
  });

  describe("Copier variable", function () {
    let idVariable2: string;

    const règle: règleBornes = {
      typeRègle: "bornes",
      détails: {
        type: "fixe",
        val: 0,
        op: ">",
      },
    };

    before("Préparer clients", async () => {
      const idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      await client.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          த: "மழை",
          हिं: "बारिश",
        },
      });
      await client.variables.sauvegarderDescriptionsVariable({
        idVariable,
        descriptions: {
          த: "தினசரி மழை",
          हिं: "दैनिक बारिश",
        },
      });
      await client.variables.ajouterRègleVariable({ idVariable, règle });
      await client.variables.sauvegarderUnitésVariable({
        idVariable,
        idUnité: "mm",
      });

      idVariable2 = await client.variables.copierVariable({
        idVariable,
      });
    });

    it("La variable est copiée", async () => {
      const variables = await obtenir(({ siPasVide }) =>
        client.variables.suivreVariables({
          f: siPasVide(),
        }),
      );
      expect(Array.isArray(variables)).to.be.true();
      expect(variables).to.contain(idVariable2);
    });

    it("Les noms sont copiés", async () => {
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        client.variables.suivreNomsVariable({
          idVariable: idVariable2,
          f: si((x) => Object.keys(x).length > 1),
        }),
      );
      expect(noms).to.deep.equal({ த: "மழை", हिं: "बारिश" });
    });

    it("Les descriptions sont copiés", async () => {
      const descriptions = await obtenir<TraducsTexte>(({ si }) =>
        client.variables.suivreDescriptionsVariable({
          idVariable: idVariable2,
          f: si((x) => Object.keys(x).length > 1),
        }),
      );
      expect(descriptions).to.deep.equal({
        த: "தினசரி மழை",
        हिं: "दैनिक बारिश",
      });
    });

    it("Les règles sont copiés", async () => {
      const règleCatégorie: règleCatégorie = {
        typeRègle: "catégorie",
        détails: {
          catégorie: { type: "simple", catégorie: "numérique" },
        },
      };
      const règles = await obtenir<règleVariableAvecId[]>(({ si }) =>
        client.variables.suivreRèglesVariable({
          idVariable: idVariable2,
          f: si((x) => x.length > 1),
        }),
      );
      expect(règles.map((r) => r.règle)).to.have.deep.members([
        règle,
        règleCatégorie,
      ]);
    });

    it("Les unités sont copiés", async () => {
      const val = await obtenir(({ siDéfini }) =>
        client.variables.suivreUnitésVariable({
          idVariable: idVariable2,
          f: siDéfini(),
        }),
      );
      expect(val).to.equal("mm");
    });

    it("La catégorie est copiée", async () => {
      const val = await obtenir(({ siDéfini }) =>
        client.variables.suivreCatégorieVariable({
          idVariable: idVariable2,
          f: siDéfini(),
        }),
      );
      expect(val).to.deep.equal({
        type: "simple",
        catégorie: "numérique",
      });
    });
  });
});
