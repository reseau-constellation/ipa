import { expect } from "aegir/chai";
import { Constellation } from "@/v2/index.js";
import { StatutDonnées, TraducsTexte } from "@/v2/types.js";
import { CatégorieVariables as CatégorieVariable } from "@/v2/variables.js";
import {
  RègleBornes,
  RègleCatégorie,
  RègleVariableAvecId,
} from "@/v2/règles.js";
import { créerConstellationsTest, obtenir } from "./utils.js";

describe.only("Variables", function () {
  let fermer: () => Promise<void>;
  let constls: Constellation[];
  let constl: Constellation;

  before("préparer constls", async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 1,
    }));
    constl = constls[0];
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("création", function () {
    let idVariable: string;

    it("pas de variables pour commencer", async () => {
      const variables = await obtenir(({ siDéfini }) =>
        constl.variables.suivreVariables({
          f: siDéfini(),
        }),
      );
      expect(variables).to.be.an.empty("array");
    });

    it("créer des variables", async () => {
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      const variables = await obtenir(({ siPasVide }) =>
        constl.variables.suivreVariables({
          f: siPasVide(),
        }),
      );
      expect(variables).to.deep.equal([idVariable]);
    });

    it("effacer une variable", async () => {
      await constl.variables.effacerVariable({ idVariable });
      const variables = await obtenir(({ siVide }) =>
        constl.variables.suivreVariables({
          f: siVide(),
        }),
      );
      expect(variables).to.be.an.empty("array");
    });
  });

  describe("mes variables", function () {
    let idVariable: string;

    before("Créer variable", async () => {
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
    });

    it("la variable est déjà ajoutée", async () => {
      const variables = await obtenir(({ siPasVide }) =>
        constl.variables.suivreVariables({
          f: siPasVide(),
        }),
      );
      expect(variables).to.contain(idVariable);
    });

    it("enlever de mes variables", async () => {
      await constl.variables.enleverDeMesVariables({ idVariable });
      const variables = await obtenir(({ siVide }) =>
        constl.variables.suivreVariables({
          f: siVide(),
        }),
      );
      expect(variables).not.to.contain(idVariable);
    });

    it("ajouter à mes variables", async () => {
      await constl.variables.ajouterÀMesVariables({ idVariable });
      const variables = await obtenir(({ siPasVide }) =>
        constl.variables.suivreVariables({
          f: siPasVide(),
        }),
      );
      expect(variables).to.contain(idVariable);
    });
  });

  describe("noms", function () {
    let idVariable: string;

    before("suivre noms variable", async () => {
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
    });

    it("pas de noms pour commencer", async () => {
      const noms = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.variables.suivreNomsVariable({
          idVariable,
          f: siDéfini(),
        }),
      );
      expect(Object.keys(noms)).to.have.lengthOf(0);
    });

    it("ajouter un nom", async () => {
      await constl.variables.sauvegarderNomVariable({
        idVariable,
        langue: "fr",
        nom: "Précipitation",
      });
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.variables.suivreNomsVariable({
          idVariable,
          f: siPasVide(),
        }),
      );
      expect(noms.fr).to.equal("Précipitation");
    });

    it("ajouter des noms", async () => {
      await constl.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          த: "மழை",
          हिं: "बारिश",
        },
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreNomsVariable({
          idVariable,
          f: si((x) => !!x && Object.keys(x).length > 2),
        }),
      );
      expect(noms).to.deep.equal({
        த: "மழை",
        हिं: "बारिश",
        fr: "Précipitation",
      });
    });

    it("changer un nom", async () => {
      await constl.variables.sauvegarderNomVariable({
        idVariable,
        langue: "fr",
        nom: "précipitation",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreNomsVariable({
          idVariable,
          f: si((x) => !!x?.fr && !x.fr.startsWith("P")),
        }),
      );
      expect(noms.fr).to.equal("précipitation");
    });

    it("effacer un nom", async () => {
      await constl.variables.effacerNomVariable({
        idVariable,
        langue: "fr",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreNomsVariable({
          idVariable,
          f: si((x) => !x?.["fr"]),
        }),
      );
      expect(noms).to.deep.equal({ த: "மழை", हिं: "बारिश" });
    });
  });

  describe("descriptions", function () {
    let idVariable: string;

    before(async () => {
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
    });

    it("pas de descriptions pour commencer", async () => {
      const descrs = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.variables.suivreDescriptionsVariable({
          idVariable,
          f: siDéfini(),
        }),
      );
      expect(Object.keys(descrs)).to.have.lengthOf(0);
    });

    it("ajouter une description", async () => {
      await constl.variables.sauvegarderDescriptionVariable({
        idVariable,
        langue: "fr",
        description: "la quantité de précipitation quotidienne",
      });
      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreDescriptionsVariable({
          idVariable,
          f: si((x) => !!x?.["fr"]),
        }),
      );
      expect(descrs.fr).to.equal("la quantité de précipitation quotidienne");
    });

    it("ajouter des descriptions", async () => {
      await constl.variables.sauvegarderDescriptionsVariable({
        idVariable,
        descriptions: {
          த: "தினசரி மழை",
          हिं: "दैनिक बारिश",
        },
      });
      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreDescriptionsVariable({
          idVariable,
          f: si((x) => !!x && Object.keys(x).length > 2),
        }),
      );
      expect(descrs).to.deep.equal({
        த: "தினசரி மழை",
        हिं: "दैनिक बारिश",
        fr: "la quantité de précipitation quotidienne",
      });
    });

    it("changer une description", async () => {
      await constl.variables.sauvegarderDescriptionVariable({
        idVariable,
        langue: "fr",
        description: "La quantité de précipitation quotidienne",
      });
      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreDescriptionsVariable({
          idVariable,
          f: si((x) => !!x?.fr && x["fr"].startsWith("L")),
        }),
      );
      expect(descrs.fr).to.equal("La quantité de précipitation quotidienne");
    });

    it("effacer une description", async () => {
      await constl.variables.effacerDescriptionVariable({
        idVariable,
        langue: "fr",
      });
      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreDescriptionsVariable({
          idVariable,
          f: si((x) => !x?.["fr"]),
        }),
      );

      expect(descrs).to.deep.equal({
        த: "தினசரி மழை",
        हिं: "दैनिक बारिश",
      });
    });
  });

  describe("catégorie", function () {
    let idVariable: string;

    before(async () => {
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
    });

    it("changer la catégorie", async () => {
      await constl.variables.sauvegarderCatégorieVariable({
        idVariable,
        catégorie: "chaîne",
      });
      const catégorie = await obtenir<CatégorieVariable>(({ si }) =>
        constl.variables.suivreCatégorieVariable({
          idVariable,
          f: si((x) => x?.catégorie !== "numérique"),
        }),
      );
      expect(catégorie).to.deep.equal({
        type: "simple",
        catégorie: "chaîne",
      });
    });
  });

  describe("règles", function () {
    let idVariable: string;
    let idRègle: string;

    let idRègleCatégorie: string;
    const réfRègleCatégorie: RègleCatégorie = {
      typeRègle: "catégorie",
      détails: {
        catégorie: {
          type: "simple",
          catégorie: "numérique",
        },
      },
    };

    before(async () => {
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
    });

    it("règle générique de catégorie pour commencer", async () => {
      const règles = await obtenir<RègleVariableAvecId[]>(({ siPasVide }) =>
        constl.variables.suivreRèglesVariable({
          idVariable,
          f: siPasVide(),
        }),
      );
      const réf: RègleCatégorie = {
        typeRègle: "catégorie",
        détails: {
          catégorie: {
            type: "simple",
            catégorie: "numérique",
          },
        },
      };

      expect(règles.map((r) => r.règle)).to.deep.equal(réf);
      idRègleCatégorie = règles.find(
        (r) => r.règle.typeRègle === "catégorie",
      )!.id;
    });

    it("ajouter une règle", async () => {
      const règle: RègleBornes = {
        typeRègle: "bornes",
        détails: {
          type: "fixe",
          val: 0,
          op: ">",
        },
      };

      idRègle = await constl.variables.ajouterRègleVariable({
        idVariable,
        règle,
      });

      const règles = await obtenir<RègleVariableAvecId[]>(({ si }) =>
        constl.variables.suivreRèglesVariable({
          idVariable,
          f: si((x) => !!x && x.length > 1),
        }),
      );

      const réf: RègleVariableAvecId[] = [
        {
          id: idRègleCatégorie,
          règle: réfRègleCatégorie,
        },
        {
          id: idRègle,
          règle,
        },
      ];
      expect(règles).to.have.deep.members(réf);
    });

    it("modifier une règle", async () => {
        const règleModifiée: RègleBornes = {
          typeRègle: "bornes",
          détails: {
            type: "fixe",
            val: 0,
            op: ">=",
          },
        };
  
        await constl.variables.modifierRègleVariable({
          idVariable,
          idRègle,
          règleModifiée,
        });
  
        const règles = await obtenir<RègleVariableAvecId[]>(({ si }) =>
          constl.variables.suivreRèglesVariable({
            idVariable,
            f: si((x) => {
              const règleBornes = x?.find(r=>r.id === idRègle) as RègleVariableAvecId<RègleBornes> | undefined;
              return règleBornes?.règle.détails.op !== ">"
            }),
          }),
        );
  
        const réf: RègleVariableAvecId[] = [
          {
            id: idRègleCatégorie,
            règle: réfRègleCatégorie,
          },
          {
            id: idRègle,
            règle: règleModifiée,
          },
        ];
        expect(règles).to.have.deep.members(réf);
      });

    it("effacer une règle", async () => {
      await constl.variables.effacerRègleVariable({ idVariable, idRègle });
      const règles = await obtenir<RègleVariableAvecId[]>(({ si }) =>
        constl.variables.suivreRèglesVariable({
          idVariable,
          f: si((x) => !!x && x.length < 2),
        }),
      );

      const réf: RègleVariableAvecId[] = [
        {
          id: idRègleCatégorie,
          règle: réfRègleCatégorie,
        },
      ];
      expect(règles).to.have.deep.members(réf);
    });

    it("on ne peut pas effacer une règle générique de base", async () => {
      await constl.variables.effacerRègleVariable({
        idVariable,
        idRègle: idRègleCatégorie,
      });
      const règles = await obtenir<RègleVariableAvecId[]>(({ siPasVide }) =>
        constl.variables.suivreRèglesVariable({
          idVariable,
          f: siPasVide(),
        }),
      );

      const réf: RègleVariableAvecId[] = [
        {
          id: idRègleCatégorie,
          règle: réfRègleCatégorie,
        },
      ];
      expect(règles).to.have.deep.members(réf);
    });

    it("on détecte le changement de catégorie", async () => {
      const pRègles = obtenir<RègleVariableAvecId[]>(({ si }) =>
        constl.variables.suivreRèglesVariable({
          idVariable,
          f: si((x) =>
            !!x?.some(
              (r) =>
                r.règle.typeRègle === "catégorie" &&
                r.règle.détails.catégorie.catégorie !== "numérique",
            ),
          ),
        }),
      );
      await constl.variables.sauvegarderCatégorieVariable({
        idVariable,
        catégorie: "horoDatage",
      });
      const règles = await pRègles;

      const réf: RègleVariableAvecId[] = [
        {
          id: idRègleCatégorie,
          règle: {
            typeRègle: "catégorie",
            détails: {
              catégorie: {
                type: "simple",
                catégorie: "horoDatage"
              }
            }
          },
        },
      ];
      expect(règles).to.have.deep.members(réf);
    });
  });

  describe("unités", function () {
    let idVariable: string;

    before(async () => {
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
    });

    it("aucune unité pour commencer", async () => {
      const unités = await obtenir(({ siNul }) =>
        constl.variables.suivreUnitésVariable({
          idVariable,
          f: siNul(),
        }),
      );
      expect(unités).to.be.null();
    });

    it("changer les unités", async () => {
      await constl.variables.sauvegarderUnitésVariable({
        idVariable,
        idUnité: "mm",
      });
      const unités = await obtenir(({ siPasNul }) =>
        constl.variables.suivreUnitésVariable({
          idVariable,
          f: siPasNul(),
        }),
      );
      expect(unités).to.equal("mm");
    });
  });

  describe("statut", function () {
    let idVariable: string;

    it("statut actif par défaut", async () => {
      idVariable = await constl.variables.créerVariable({ catégorie: "booléen" });
      const statut = await obtenir(({ siDéfini }) =>
        constl.variables.suivreStatutVariable({
          idVariable,
          f: siDéfini(),
        }),
      );

      const réf: StatutDonnées = {
        statut: "active",
      };
      expect(statut).to.deep.equal(réf);
    });

    it("changer statut", async () => {
      const nouveauStatut: StatutDonnées = {
        statut: "obsolète",
        // Pour une vraie application, utiliser un identifiant valide, bien entendu.
        idNouvelle: "/orbitdb/uneAutreVariable",
      };
      await constl.variables.sauvegarderStatutVariable({
        idVariable,
        statut: nouveauStatut,
      });

      const statut = await obtenir<StatutDonnées | null>(({ si }) =>
        constl.variables.suivreStatutVariable({
          idVariable,
          f: si((x) => x?.statut !== "active"),
        }),
      );

      expect(statut).to.deep.equal(nouveauStatut);
    });
  });

  describe("copier variable", function () {
    let idVariable2: string;

    const règle: RègleBornes = {
      typeRègle: "bornes",
      détails: {
        type: "fixe",
        val: 0,
        op: ">",
      },
    };

    before(async () => {
      const idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      await constl.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          த: "மழை",
          हिं: "बारिश",
        },
      });
      await constl.variables.sauvegarderDescriptionsVariable({
        idVariable,
        descriptions: {
          த: "தினசரி மழை",
          हिं: "दैनिक बारिश",
        },
      });
      await constl.variables.ajouterRègleVariable({ idVariable, règle });
      await constl.variables.sauvegarderUnitésVariable({
        idVariable,
        idUnité: "mm",
      });

      idVariable2 = await constl.variables.copierVariable({
        idVariable,
      });
    });

    it("la variable est copiée", async () => {
      const variables = await obtenir(({ siPasVide }) =>
        constl.variables.suivreVariables({
          f: siPasVide(),
        }),
      );
      expect(variables).to.include(idVariable2);
    });

    it("les noms sont copiés", async () => {
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreNomsVariable({
          idVariable: idVariable2,
          f: si((x) => !!x && Object.keys(x).length > 1),
        }),
      );
      expect(noms).to.deep.equal({ த: "மழை", हिं: "बारिश" });
    });

    it("les descriptions sont copiées", async () => {
      const descriptions = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreDescriptionsVariable({
          idVariable: idVariable2,
          f: si((x) => !!x && Object.keys(x).length > 1),
        }),
      );
      expect(descriptions).to.deep.equal({
        த: "தினசரி மழை",
        हिं: "दैनिक बारिश",
      });
    });

    it("la catégorie est copiée", async () => {
        const catégorie = await obtenir(({ siDéfini }) =>
          constl.variables.suivreCatégorieVariable({
            idVariable: idVariable2,
            f: siDéfini(),
          }),
        );
        expect(catégorie).to.deep.equal({
          type: "simple",
          catégorie: "numérique",
        });
      });

    it("les règles sont copiées", async () => {
      const règleCatégorie: RègleCatégorie = {
        typeRègle: "catégorie",
        détails: {
          catégorie: { type: "simple", catégorie: "numérique" },
        },
      };
      const règles = await obtenir<RègleVariableAvecId[]>(({ si }) =>
        constl.variables.suivreRèglesVariable({
          idVariable: idVariable2,
          f: si((x) => !!x && x.length > 1),
        }),
      );
      expect(règles.map((r) => r.règle)).to.have.deep.members([
        règle,
        règleCatégorie,
      ]);
    });

    it("les unités sont copiés", async () => {
      const val = await obtenir(({ siDéfini }) =>
        constl.variables.suivreUnitésVariable({
          idVariable: idVariable2,
          f: siDéfini(),
        }),
      );
      expect(val).to.equal("mm");
    });

  });
});
