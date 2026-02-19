import { expect } from "aegir/chai";
import {
  MEMBRE,
  MODÉRATRICE,
} from "@/v2/nébuleuse/services/compte/accès/consts.js";
import { TOUS_DISPOSITIFS } from "@/v2/nébuleuse/services/favoris.js";
import { créerConstellationsTest, obtenir } from "./utils.js";
import type { Constellation } from "@/v2/index.js";
import type {
  InfoAuteur,
  PartielRécursif,
  StatutDonnées,
  TraducsTexte,
} from "@/v2/types.js";
import type {
  CatégorieVariable as CatégorieVariable,
  ÉpingleVariable,
} from "@/v2/variables.js";
import type {
  RègleBornes,
  RègleCatégorie,
  RègleVariableAvecId,
} from "@/v2/règles.js";

describe.only("Variables", function () {
  let fermer: () => Promise<void>;
  let constls: Constellation[];
  let constl: Constellation;

  let idsComptes: string[];

  before("préparer constls", async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 2,
    }));
    constl = constls[0];
    idsComptes = await Promise.all(constls.map((c) => c.compte.obtIdCompte()));
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("création variables", function () {
    let idVariable: string;

    it("pas de variables pour commencer", async () => {
      const variables = await obtenir(({ siDéfini }) =>
        constl.variables.suivreVariables({
          f: siDéfini(),
        }),
      );
      expect(variables).to.be.an.empty("array");
    });

    it("création", async () => {
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      expect(constl.variables.identifiantValide(idVariable)).to.be.true();
    });

    it("accès", async () => {
      const permission = await obtenir(({ siDéfini }) =>
        constl.compte.suivrePermission({
          idObjet: idVariable,
          f: siDéfini(),
        }),
      );
      expect(permission).to.equal(MODÉRATRICE);
    });

    it("automatiquement ajoutée à mes variables", async () => {
      const mesVariables = await obtenir<string[]>(({ siDéfini }) =>
        constl.variables.suivreVariables({
          f: siDéfini(),
        }),
      );
      expect(mesVariables).to.be.an("array").and.to.contain(idVariable);
    });

    it("détectée sur un autre compte", async () => {
      const sesVariables = await obtenir<string[]>(({ siDéfini }) =>
        constls[1].variables.suivreVariables({
          f: siDéfini(),
          idCompte: idsComptes[0],
        }),
      );
      expect(sesVariables).have.members([idVariable]);
    });

    it("enlever de mes variables", async () => {
      await constl.variables.enleverDeMesVariables({ idVariable });
      const mesVariables = await obtenir<string[] | undefined>(({ siVide }) =>
        constl.variables.suivreVariables({
          f: siVide(),
        }),
      );
      expect(mesVariables).to.be.an.empty("array");
    });

    it("ajouter manuellement à mes variables", async () => {
      await constl.variables.ajouterÀMesVariables({ idVariable });
      const mesVariables = await obtenir<string[]>(({ siPasVide }) =>
        constl.variables.suivreVariables({
          f: siPasVide(),
        }),
      );
      expect(mesVariables).to.have.members([idVariable]);
    });

    it("effacer variable", async () => {
      await constl.variables.effacerVariable({ idVariable });
      const mesVariables = await obtenir<string[] | undefined>(({ siVide }) =>
        constl.variables.suivreVariables({
          f: siVide(),
        }),
      );
      expect(mesVariables).to.be.empty();
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
        constl.variables.suivreNoms({
          idVariable,
          f: siDéfini(),
        }),
      );
      expect(Object.keys(noms)).to.have.lengthOf(0);
    });

    it("ajouter un nom", async () => {
      await constl.variables.sauvegarderNom({
        idVariable,
        langue: "fr",
        nom: "Précipitation",
      });
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.variables.suivreNoms({
          idVariable,
          f: siPasVide(),
        }),
      );
      expect(noms.fr).to.equal("Précipitation");
    });

    it("ajouter des noms", async () => {
      await constl.variables.sauvegarderNoms({
        idVariable,
        noms: {
          த: "மழை",
          हिं: "बारिश",
        },
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreNoms({
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
      await constl.variables.sauvegarderNom({
        idVariable,
        langue: "fr",
        nom: "précipitation",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreNoms({
          idVariable,
          f: si((x) => !!x?.fr && !x.fr.startsWith("P")),
        }),
      );
      expect(noms.fr).to.equal("précipitation");
    });

    it("effacer un nom", async () => {
      await constl.variables.effacerNom({
        idVariable,
        langue: "fr",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreNoms({
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
        constl.variables.suivreDescriptions({
          idVariable,
          f: siDéfini(),
        }),
      );
      expect(Object.keys(descrs)).to.have.lengthOf(0);
    });

    it("ajouter une description", async () => {
      await constl.variables.sauvegarderDescription({
        idVariable,
        langue: "fr",
        description: "la quantité de précipitation quotidienne",
      });
      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreDescriptions({
          idVariable,
          f: si((x) => !!x?.["fr"]),
        }),
      );
      expect(descrs.fr).to.equal("la quantité de précipitation quotidienne");
    });

    it("ajouter des descriptions", async () => {
      await constl.variables.sauvegarderDescriptions({
        idVariable,
        descriptions: {
          த: "தினசரி மழை",
          हिं: "दैनिक बारिश",
        },
      });
      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreDescriptions({
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
      await constl.variables.sauvegarderDescription({
        idVariable,
        langue: "fr",
        description: "La quantité de précipitation quotidienne",
      });
      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreDescriptions({
          idVariable,
          f: si((x) => !!x?.fr && x["fr"].startsWith("L")),
        }),
      );
      expect(descrs.fr).to.equal("La quantité de précipitation quotidienne");
    });

    it("effacer une description", async () => {
      await constl.variables.effacerDescription({
        idVariable,
        langue: "fr",
      });
      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreDescriptions({
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
      await constl.variables.sauvegarderCatégorie({
        idVariable,
        catégorie: "chaîne",
      });
      const catégorie = await obtenir<CatégorieVariable>(({ si }) =>
        constl.variables.suivreCatégorie({
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
      type: "catégorie",
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
        constl.variables.suivreRègles({
          idVariable,
          f: siPasVide(),
        }),
      );
      const réf: RègleCatégorie = {
        type: "catégorie",
        détails: {
          catégorie: {
            type: "simple",
            catégorie: "numérique",
          },
        },
      };

      expect(règles.map((r) => r.règle)).to.deep.equal(réf);
      idRègleCatégorie = règles.find((r) => r.règle.type === "catégorie")!.id;
    });

    it("ajouter une règle", async () => {
      const règle: RègleBornes = {
        type: "bornes",
        détails: {
          type: "fixe",
          val: 0,
          op: ">",
        },
      };

      idRègle = await constl.variables.ajouterRègle({
        idVariable,
        règle,
      });

      const règles = await obtenir<RègleVariableAvecId[]>(({ si }) =>
        constl.variables.suivreRègles({
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
        type: "bornes",
        détails: {
          type: "fixe",
          val: 0,
          op: ">=",
        },
      };

      await constl.variables.modifierRègle({
        idVariable,
        idRègle,
        règleModifiée,
      });

      const règles = await obtenir<RègleVariableAvecId[]>(({ si }) =>
        constl.variables.suivreRègles({
          idVariable,
          f: si((x) => {
            const règleBornes = x?.find((r) => r.id === idRègle) as
              | RègleVariableAvecId<RègleBornes>
              | undefined;
            return règleBornes?.règle.détails.op !== ">";
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
      await constl.variables.effacerRègle({ idVariable, idRègle });
      const règles = await obtenir<RègleVariableAvecId[]>(({ si }) =>
        constl.variables.suivreRègles({
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
      await constl.variables.effacerRègle({
        idVariable,
        idRègle: idRègleCatégorie,
      });
      const règles = await obtenir<RègleVariableAvecId[]>(({ siPasVide }) =>
        constl.variables.suivreRègles({
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
        constl.variables.suivreRègles({
          idVariable,
          f: si(
            (x) =>
              !!x?.some(
                (r) =>
                  r.règle.type === "catégorie" &&
                  r.règle.détails.catégorie.catégorie !== "numérique",
              ),
          ),
        }),
      );
      await constl.variables.sauvegarderCatégorie({
        idVariable,
        catégorie: "horoDatage",
      });
      const règles = await pRègles;

      const réf: RègleVariableAvecId[] = [
        {
          id: idRègleCatégorie,
          règle: {
            type: "catégorie",
            détails: {
              catégorie: {
                type: "simple",
                catégorie: "horoDatage",
              },
            },
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
        constl.variables.suivreUnités({
          idVariable,
          f: siNul(),
        }),
      );
      expect(unités).to.be.null();
    });

    it("changer les unités", async () => {
      await constl.variables.sauvegarderUnités({
        idVariable,
        idUnité: "mm",
      });
      const unités = await obtenir(({ siPasNul }) =>
        constl.variables.suivreUnités({
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
      idVariable = await constl.variables.créerVariable({
        catégorie: "booléen",
      });
      const statut = await obtenir(({ siDéfini }) =>
        constl.variables.suivreStatut({
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
      await constl.variables.sauvegarderStatut({
        idVariable,
        statut: nouveauStatut,
      });

      const statut = await obtenir<PartielRécursif<StatutDonnées> | undefined>(
        ({ si }) =>
          constl.variables.suivreStatut({
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
      type: "bornes",
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
      await constl.variables.sauvegarderNoms({
        idVariable,
        noms: {
          த: "மழை",
          हिं: "बारिश",
        },
      });
      await constl.variables.sauvegarderDescriptions({
        idVariable,
        descriptions: {
          த: "தினசரி மழை",
          हिं: "दैनिक बारिश",
        },
      });
      await constl.variables.ajouterRègle({ idVariable, règle });
      await constl.variables.sauvegarderUnités({
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
        constl.variables.suivreNoms({
          idVariable: idVariable2,
          f: si((x) => !!x && Object.keys(x).length > 1),
        }),
      );
      expect(noms).to.deep.equal({ த: "மழை", हिं: "बारिश" });
    });

    it("les descriptions sont copiées", async () => {
      const descriptions = await obtenir<TraducsTexte>(({ si }) =>
        constl.variables.suivreDescriptions({
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
        constl.variables.suivreCatégorie({
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
        type: "catégorie",
        détails: {
          catégorie: { type: "simple", catégorie: "numérique" },
        },
      };
      const règles = await obtenir<RègleVariableAvecId[]>(({ si }) =>
        constl.variables.suivreRègles({
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
        constl.variables.suivreUnités({
          idVariable: idVariable2,
          f: siDéfini(),
        }),
      );
      expect(val).to.equal("mm");
    });
  });

  describe("épingler", function () {
    let idVariable: string;

    before(async () => {
      idVariable = await constl.variables.créerVariable({ catégorie: "image" });
    });

    it("désépingler", async () => {
      await constl.variables.désépingler({ idVariable });

      const épingle = await obtenir<PartielRécursif<ÉpingleVariable>>(
        ({ siNonDéfini }) =>
          constl.variables.suivreÉpingle({ idVariable, f: siNonDéfini() }),
      );

      expect(épingle).to.be.undefined();
    });

    it("épingler", async () => {
      await constl.variables.épingler({ idVariable });

      const épingle = await obtenir<ÉpingleVariable>(({ siDéfini }) =>
        constl.variables.suivreÉpingle({ idVariable, f: siDéfini() }),
      );

      const réf: ÉpingleVariable = {
        type: "variable",
        épingle: {
          base: TOUS_DISPOSITIFS,
        },
      };
      expect(épingle).to.deep.equal(réf);
    });

    it("résoudre épingle", async () => {
      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.variables.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idVariable,
            épingle: {
              type: "variable",
              épingle: {
                base: true,
              },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolution]).to.have.members([idVariable]);
    });
  });

  describe("auteurs", function () {
    let idVariable: string;

    before(async () => {
      idVariable = await constl.variables.créerVariable({
        catégorie: "géojson",
      });
    });

    it("compte créateur autorisé pour commencer", async () => {
      const auteurs = await obtenir<InfoAuteur[]>(({ siPasVide }) =>
        constl.variables.suivreAuteurs({
          idVariable,
          f: siPasVide(),
        }),
      );
      const réf: InfoAuteur[] = [
        {
          idCompte: idsComptes[0],
          accepté: true,
          rôle: MODÉRATRICE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });

    it("inviter compte", async () => {
      await constl.variables.inviterAuteur({
        idVariable,
        idCompte: idsComptes[1],
        rôle: MEMBRE,
      });
      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.variables.suivreAuteurs({
          idVariable,
          f: si((x) => !!x && x.length > 1),
        }),
      );
      const réf: InfoAuteur[] = [
        {
          idCompte: idsComptes[0],
          accepté: true,
          rôle: MODÉRATRICE,
        },
        {
          idCompte: idsComptes[1],
          accepté: false,
          rôle: MEMBRE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });

    it("acceptation invitation", async () => {
      await constls[1].variables.ajouterÀMesVariables({ idVariable });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.variables.suivreAuteurs({
          idVariable,
          f: si((x) => !!x?.find((a) => a.idCompte === idsComptes[1])?.accepté),
        }),
      );
      const réf: InfoAuteur[] = [
        {
          idCompte: idsComptes[0],
          accepté: true,
          rôle: MODÉRATRICE,
        },
        {
          idCompte: idsComptes[1],
          accepté: true,
          rôle: MEMBRE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });

    it("modification par le nouvel auteur", async () => {
      await obtenir(({ siDéfini }) =>
        constls[1].compte.suivrePermission({
          idObjet: idVariable,
          f: siDéfini(),
        }),
      );

      // Modification de la variable
      await constls[1].variables.sauvegarderNom({
        idVariable,
        langue: "fr",
        nom: "Pédologie",
      });
      const noms = await obtenir(({ siPasVide }) =>
        constls[0].variables.suivreNoms({ idVariable, f: siPasVide() }),
      );
      expect(noms).to.deep.equal({ fr: "Pédologie" });
    });

    it("promotion à modératrice", async () => {
      await constl.variables.inviterAuteur({
        idVariable,
        idCompte: idsComptes[1],
        rôle: MODÉRATRICE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.variables.suivreAuteurs({
          idVariable,
          f: si(
            (x) =>
              !!x &&
              x.find((a) => a.idCompte === idsComptes[1])?.rôle === MODÉRATRICE,
          ),
        }),
      );
      const réf: InfoAuteur[] = [
        {
          idCompte: idsComptes[0],
          accepté: true,
          rôle: MODÉRATRICE,
        },
        {
          idCompte: idsComptes[1],
          accepté: true,
          rôle: MODÉRATRICE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });

    it("inviter compte hors ligne", async () => {
      const compteHorsLigne =
        "/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX";
      await constl.variables.inviterAuteur({
        idVariable,
        idCompte: compteHorsLigne,
        rôle: MEMBRE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.variables.suivreAuteurs({
          idVariable,
          f: si((x) => !!x?.find((a) => a.idCompte === compteHorsLigne)),
        }),
      );
      const réf: InfoAuteur[] = [
        {
          idCompte: idsComptes[0],
          accepté: true,
          rôle: MODÉRATRICE,
        },
        {
          idCompte: idsComptes[1],
          accepté: true,
          rôle: MEMBRE,
        },
        {
          idCompte: compteHorsLigne,
          accepté: false,
          rôle: MEMBRE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });
  });
});
