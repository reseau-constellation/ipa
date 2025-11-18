import { expect } from "aegir/chai";
import { MEMBRE } from "@/v2/crabe/services/compte/accès/consts.js";
import { Rôle } from "@/v2/crabe/services/compte/accès/types.js";
import { Constellation } from "@/v2/index.js";
import { TraducsTexte } from "@/v2/types.js";
import { DonnéesRangéeTableauAvecId, InfoColonne } from "@/v2/tableaux.js";
import { RègleBornes, RègleColonne } from "@/v2/règles.js";
import { créerConstellationsTest, obtenir } from "./utils.js";

describe("tableaux", function () {
  describe("noms", function () {
    let fermer: () => Promise<void>;
    let constls: Constellation[];
    let constl: Constellation;
    let idBd: string;

    let idTableau: string;

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 1,
      }));
      constl = constls[0];

      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      idTableau = await constl.bds.ajouterTableau({ idBd });
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("pas de noms pour commencer", async () => {
      const noms = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.bds.tableaux.suivreNoms({
          idStructure: idBd,
          idTableau,
          f: siDéfini(),
        }),
      );
      expect(Object.keys(noms).length).to.equal(0);
    });

    it("ajouter un nom", async () => {
      await constl.bds.tableaux.sauvegarderNom({
        idStructure: idBd,
        idTableau,
        langue: "fr",
        nom: "Alphabets",
      });
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.bds.tableaux.suivreNoms({
          idStructure: idBd,
          idTableau,
          f: siPasVide(),
        }),
      );
      expect(noms.fr).to.equal("Alphabets");
    });

    it("ajouter des noms", async () => {
      await constl.bds.tableaux.sauvegarderNoms({
        idStructure: idBd,
        idTableau,
        noms: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.tableaux.suivreNoms({
          idStructure: idBd,
          idTableau,
          f: si((x) => !!x && Object.keys(x).length >= 3),
        }),
      );

      expect(noms).to.deep.equal({
        த: "எழுத்துகள்",
        हिं: "वर्णमाला",
        fr: "Alphabets",
      });
    });

    it("changer un nom", async () => {
      await constl.bds.tableaux.sauvegarderNom({
        idStructure: idBd,
        idTableau,
        langue: "fr",
        nom: "Systèmes d'écriture",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.tableaux.suivreNoms({
          idStructure: idBd,
          idTableau,
          f: si((x) => x?.["fr"] !== "Alphabets"),
        }),
      );

      expect(noms.fr).to.equal("Systèmes d'écriture");
    });

    it("effacer un nom", async () => {
      await constl.bds.tableaux.effacerNom({
        idStructure: idBd,
        idTableau,
        langue: "fr",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.tableaux.suivreNoms({
          idStructure: idBd,
          idTableau,
          f: si((x) => !!x && !Object.keys(x).includes("fr")),
        }),
      );

      expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("données", function () {
    let fermer: () => Promise<void>;
    let constls: Constellation[];
    let constl: Constellation;
    let idBd: string;

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 1,
      }));
      constl = constls[0];

      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("colonnes", function () {
      let idTableau: string;

      beforeEach(async () => {
        idTableau = await constl.bds.ajouterTableau({ idBd });
      });

      it("colonnes vides pour commencer", async () => {
        const colonnes = await obtenir<InfoColonne[]>(({ siDéfini }) =>
          constl.bds.tableaux.suivreColonnes({
            idStructure: idBd,
            idTableau,
            f: siDéfini(),
          }),
        );
        expect(colonnes).to.be.empty();
      });

      it("ajout colonne", async () => {
        const idVariable = await constl.variables.créerVariable({
          catégorie: "audio",
        });

        const pColonnes = obtenir<InfoColonne[]>(({ siPasVide }) =>
          constl.bds.tableaux.suivreColonnes({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
        );

        const idColonne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable,
        });

        const réf: InfoColonne = {
          id: idColonne,
          variable: idVariable,
        };
        expect(await pColonnes).to.deep.equal([réf]);
      });

      it("ajout colonne sans variable", async () => {
        const pColonnes = obtenir<InfoColonne[]>(({ siPasVide }) =>
          constl.bds.tableaux.suivreColonnes({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
        );
        const idColonne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        const réf: InfoColonne = {
          id: idColonne,
        };
        expect(await pColonnes).to.deep.equal([réf]);
      });

      it("modification variable colonne", async () => {
        const idVariable = await constl.variables.créerVariable({
          catégorie: "audio",
        });

        const pColonnes = obtenir<InfoColonne[]>(({ si }) =>
          constl.bds.tableaux.suivreColonnes({
            idStructure: idBd,
            idTableau,
            f: si((cols) => !!cols?.find((c) => !!c.variable)),
          }),
        );

        const idColonne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        const pInfoColonne = obtenir<InfoColonne | null>(({ si }) =>
          constl.bds.tableaux.suivreInfoColonne({
            idStructure: idBd,
            idTableau,
            idColonne,
            f: si((c) => !!c?.variable),
          }),
        );

        await constl.bds.tableaux.modifierVariableColonne({
          idStructure: idBd,
          idTableau,
          idColonne,
          idVariable,
        });

        const réf: InfoColonne = {
          id: idColonne,
          variable: idVariable,
        };
        expect(await pColonnes).to.deep.equal([réf]);
        expect(await pInfoColonne).to.deep.equal(réf);
      });

      it("modification index colonne", async () => {
        const idVariable = await constl.variables.créerVariable({
          catégorie: "horoDatage",
        });

        const pColonnes = obtenir<InfoColonne[]>(({ si }) =>
          constl.bds.tableaux.suivreColonnes({
            idStructure: idBd,
            idTableau,
            f: si((cols) => !!cols?.find((c) => c.index)),
          }),
        );

        const idColonne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        const pInfoColonne = obtenir<InfoColonne | null>(({ si }) =>
          constl.bds.tableaux.suivreInfoColonne({
            idStructure: idBd,
            idTableau,
            idColonne,
            f: si((c) => !!c?.index),
          }),
        );

        await constl.bds.tableaux.modifierIndexColonne({
          idStructure: idBd,
          idTableau,
          idColonne,
          index: true,
        });

        const réf: InfoColonne = {
          id: idColonne,
          variable: idVariable,
          index: true,
        };
        expect(await pColonnes).to.deep.equal([réf]);
        expect(await pInfoColonne).to.deep.equal(réf);
      });

      it("modification id colonne", async () => {
        const idVariable = await constl.variables.créerVariable({
          catégorie: "horoDatage",
        });

        const idColonne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        const pColonnes = obtenir<InfoColonne[]>(({ si }) =>
          constl.bds.tableaux.suivreColonnes({
            idStructure: idBd,
            idTableau,
            f: si((cols) => !!cols?.find((c) => c.id !== idColonne)),
          }),
        );
        const pInfoColonne = obtenir<InfoColonne | null>(({ si }) =>
          constl.bds.tableaux.suivreInfoColonne({
            idStructure: idBd,
            idTableau,
            idColonne,
            f: si((c?: InfoColonne | null) => c?.id !== idColonne),
          }),
        );

        const nouvelId = "un nouveau nom pour la colonne";
        await constl.bds.tableaux.modifierIdColonne({
          idStructure: idBd,
          idTableau,
          idColonne,
          nouvelId,
        });

        const réf: InfoColonne = {
          id: nouvelId,
          variable: idVariable,
          index: true,
        };
        expect(await pColonnes).to.deep.equal([réf]);
        expect(await pInfoColonne).to.deep.equal(réf);
      });
    });

    describe("variables", function () {
      let idTableau: string;

      beforeEach(async () => {
        idTableau = await constl.bds.ajouterTableau({ idBd });
      });

      it("variables vides pour commencer", async () => {
        const variables = await obtenir(({ siDéfini }) =>
          constl.bds.tableaux.suivreVariables({
            idStructure: idBd,
            idTableau,
            f: siDéfini(),
          }),
        );
        expect(variables).to.be.empty();
      });

      it("ajout colonne", async () => {
        const pVariables = obtenir(({ siPasVide }) =>
          constl.bds.tableaux.suivreVariables({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
        );

        const idVariable = await constl.variables.créerVariable({
          catégorie: "vidéo",
        });
        await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable,
        });

        expect(await pVariables).to.deep.equal([idVariable]);
      });

      it("modification variable", async () => {
        const idVariable = await constl.variables.créerVariable({
          catégorie: "vidéo",
        });
        const idColonne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable,
        });

        const idVariable2 = await constl.variables.créerVariable({
          catégorie: "audio",
        });

        const pVariables = obtenir<string[]>(({ si }) =>
          constl.bds.tableaux.suivreVariables({
            idStructure: idBd,
            idTableau,
            f: si((vrs) => !!vrs?.includes(idVariable2)),
          }),
        );

        await constl.bds.tableaux.modifierVariableColonne({
          idStructure: idBd,
          idTableau,
          idColonne,
          idVariable: idVariable2,
        });

        expect(await pVariables).to.deep.equal([idVariable2]);
      });

      it("enlever variable", async () => {
        const idVariable = await constl.variables.créerVariable({
          catégorie: "vidéo",
        });
        const idColonne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable,
        });
        await obtenir(({ siPasVide }) =>
          constl.bds.tableaux.suivreVariables({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
        );

        await constl.bds.tableaux.modifierVariableColonne({
          idStructure: idBd,
          idTableau,
          idColonne,
          idVariable: undefined,
        });
        const pVariables = obtenir(({ siVide }) =>
          constl.bds.tableaux.suivreVariables({
            idStructure: idBd,
            idTableau,
            f: siVide(),
          }),
        );

        expect(await pVariables).to.be.empty();
      });

      it("enlever colonne", async () => {
        const idVariable = await constl.variables.créerVariable({
          catégorie: "vidéo",
        });
        const idColonne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable,
        });
        await obtenir(({ siPasVide }) =>
          constl.bds.tableaux.suivreVariables({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
        );

        await constl.bds.tableaux.effacerColonne({
          idStructure: idBd,
          idTableau,
          idColonne,
        });
        const pVariables = obtenir(({ siVide }) =>
          constl.bds.tableaux.suivreVariables({
            idStructure: idBd,
            idTableau,
            f: siVide(),
          }),
        );

        expect(await pVariables).to.be.empty();
      });
    });

    describe("éléments", function () {
      let idTableau: string;

      let idColChaîne: string;
      let idColNumérique: string;
      let idÉlément: string;

      before(async () => {
        idTableau = await constl.bds.ajouterTableau({ idBd });
      });

      it("données vides pour commencer", async () => {
        const données = await obtenir(({ siDéfini }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: siDéfini(),
          }),
        );
        expect(données).to.be.empty();
      });

      it("ajouter élément", async () => {
        const pDonnées = obtenir(({ siPasVide }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
        );

        idColNumérique = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        idColChaîne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        const élément = {
          [idColNumérique]: 123.456,
          [idColChaîne]: "வணக்கம்",
        };
        idÉlément = await constl.bds.tableaux.ajouterÉlément({
          idStructure: idBd,
          idTableau,
          élément,
        });

        expect(await pDonnées).to.deep.equal([{ id: idÉlément, élément }]);
      });

      it("modifier élément", async () => {
        const pDonnées = obtenir(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si((d) => d.find((x) => x[idColNumérique] !== 123.456)),
          }),
        );
        const nouvelÉlément = {
          [idColNumérique]: 654.321,
          [idColChaîne]: "வணக்கம்",
        };
        await constl.bds.tableaux.modifierÉlément({
          idStructure: idBd,
          idTableau,
          idÉlément,
          élément: nouvelÉlément,
        });

        expect(await pDonnées).to.deep.equal([
          { id: idÉlément, élément: nouvelÉlément },
        ]);
      });

      it("effacer clef élément", async () => {
        const pDonnées = obtenir(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si((d) => d.find((x) => !x.keys().includes(idColNumérique))),
          }),
        );
        const vals = {
          [idColNumérique]: undefined,
        };
        await constl.bds.tableaux.modifierÉlément({
          idStructure: idBd,
          idTableau,
          idÉlément,
          vals,
        });

        expect(await pDonnées).to.deep.equal([
          { id: idÉlément, élément: { [idColChaîne]: "வணக்கம்" } },
        ]);
      });

      it("ajouter clef élément", async () => {
        const pDonnées = obtenir(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si((d) => d.find((x) => x.keys().includes(idColNumérique))),
          }),
        );
        const vals = {
          [idColNumérique]: 123,
        };
        await constl.bds.tableaux.modifierÉlément({
          idStructure: idBd,
          idTableau,
          idÉlément,
          vals,
        });

        expect(await pDonnées).to.deep.equal([
          {
            id: idÉlément,
            élément: { [idColChaîne]: "வணக்கம்", [idColNumérique]: 123 },
          },
        ]);
      });

      it("effacer colonne", async () => {
        const pDonnées = obtenir(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si((d) => d.find((x) => !x.keys().includes(idColChaîne))),
          }),
        );
        await constl.bds.tableaux.effacerColonne({
          idStructure: idBd,
          idTableau,
          idColonne: idColChaîne,
        });

        expect(await pDonnées).to.deep.equal([
          { id: idÉlément, élément: { [idColNumérique]: 123 } },
        ]);
      });

      it("restaurer colonne", async () => {
        const pDonnées = obtenir(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si((d) => d.find((x) => x.keys().includes(idColChaîne))),
          }),
        );
        await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idColonne: idColChaîne,
        });

        expect(await pDonnées).to.deep.equal([
          {
            id: idÉlément,
            élément: { [idColChaîne]: "வணக்கம்", [idColNumérique]: 123 },
          },
        ]);
      });

      it("effacer élément", async () => {
        const pDonnées = obtenir(({ siVide }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: siVide(),
          }),
        );

        await constl.bds.tableaux.effacerÉlément({
          idStructure: idBd,
          idTableau,
          idÉlément,
        });

        expect(await pDonnées).to.deep.equal([]);
      });

      it("suivre données selon variable - id élément si variable non existante", async () => {
        // Id colonne
        const élément = {
          [idColNumérique]: 123.456,
          [idColChaîne]: "வணக்கம்",
        };
        idÉlément = await constl.bds.tableaux.ajouterÉlément({
          idStructure: idBd,
          idTableau,
          élément,
        });
        const données = await obtenir(({ siPasVide }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
            clefsSelonVariables: true,
          }),
        );
        expect(données).to.deep.equal([{ id: idÉlément, élément }]);
      });

      it("suivre données selon variable - ajout variable ", async () => {
        const idVarNumérique = await constl.variables.créerVariable({
          catégorie: "numérique",
        });
        // Id variable
        await constl.bds.tableaux.modifierVariableColonne({
          idStructure: idBd,
          idTableau,
          idColonne: idColNumérique,
          idVariable: idVarNumérique,
        });
        const données = await obtenir(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si((x) => !x.keys().includes(idColNumérique)),
            clefsSelonVariables: true,
          }),
        );
        expect(données).to.deep.equal([
          {
            id: idÉlément,
            élément: {
              [idVarNumérique]: 123.456,
              [idColChaîne]: "வணக்கம்",
            },
          },
        ]);
      });
    });

    describe("règles", function () {
      it("ajout règle colonne");
      it("ajout règle à travers variable");
    });

    describe("importation", function () {
      it("importation nouveaux éléments");
      it("importation avec index");
      it("importation avec index variable liste");
      it("importation avec indices multiples");
    });

    describe("exportation", function () {});

    describe("erreurs", function () {
      it("colonnes - id colonne dédoublé");
      it("colonnes - variable colonne dédoublée");
      it("éléments - index dédoublé");
      it("éléments - erreur règle colonne");
      it("éléments - erreur règle variable");
    });
  });

  describe("copier", function () {
    let fermer: () => Promise<void>;
    let constls: Constellation[];
    let constl: Constellation;
    let idBd: string;

    before(async () => {});

    after(async () => {
      if (fermer) await fermer();
    });

    let idTableau: string;
    let idVariable: string;
    let idColonne: string;
    let idRègle: string;

    let idTableauCopié: string;

    const réfNoms = {
      த: "மழை",
      हिं: "बारिश",
    };
    const règle: RègleBornes = {
      typeRègle: "bornes",
      détails: {
        type: "fixe",
        val: 0,
        op: ">",
      },
    };

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 1,
      }));
      constl = constls[0];

      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });

      idTableau = await constl.bds.ajouterTableau({ idBd });
      await constl.bds.tableaux.sauvegarderNoms({
        idStructure: idBd,
        idTableau,
        noms: réfNoms,
      });

      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      idColonne = await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idVariable,
      });
      await constl.bds.tableaux.modifierIndexColonne({
        idStructure: idBd,
        idTableau,
        idColonne,
        index: true,
      });

      await constl.bds.tableaux.ajouterÉlément({
        idStructure: idBd,
        idTableau,
        vals: {
          [idColonne]: 123,
        },
      });

      idRègle = await constl.bds.tableaux.ajouterRègleTableau({
        idStructure: idBd,
        idTableau,
        idColonne,
        règle,
      });
    });

    it("le tableau est copié", async () => {
      idTableauCopié = await constl.bds.tableaux.copierTableau({
        idStructure: idBd,
        idTableau,
      });
      expect(idTableauCopié).to.be.a("string");
    });

    it("les noms sont copiés", async () => {
      const noms = await obtenir(({ siPasVide }) =>
        constl.bds.tableaux.suivreNoms({
          idStructure: idBd,
          idTableau: idTableauCopié,
          f: siPasVide(),
        }),
      );
      expect(noms).to.deep.equal(réfNoms);
    });

    it("les colonnes sont copiées", async () => {
      const colonnes = await obtenir<InfoColonne[]>(({ siPasVide }) =>
        constl.bds.tableaux.suivreColonnes({
          idStructure: idBd,
          idTableau: idTableauCopié,
          f: siPasVide(),
        }),
      );
      expect(colonnes).to.deep.equal([
        {
          id: idColonne,
          variable: idVariable,
          index: true,
        },
      ]);
    });

    it("les règles sont copiés", async () => {
      const règles = await obtenir<RègleColonne[]>(({ si }) =>
        constl.bds.tableaux.suivreRègles({
          idStructure: idBd,
          idTableau: idTableauCopié,
          f: si((x) => !!x && x.some((r) => r.règle.id === idRègle)),
        }),
      );

      expect(règles).to.deep.equal([règle]);
    });

    it("les variables sont copiés", async () => {
      const variables = await obtenir(({ siPasVide }) =>
        constl.bds.tableaux.suivreVariables({
          idStructure: idBd,
          idTableau: idTableauCopié,
          f: siPasVide(),
        }),
      );

      expect(variables).to.deep.equal([idVariable]);
    });

    it("les données sont copiés", async () => {
      const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
        ({ siPasVide }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau: idTableauCopié,
            f: siPasVide(),
          }),
      );
      expect(données.map((d) => d.données)).to.deep.equal([
        { [idColonne]: 123 },
      ]);
    });
  });

  describe.only("accès", function () {
    let fermer: () => Promise<void>;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("l'accès du tableau suit l'accès à la structure originale", async () => {
      const idBd = await constls[0].bds.créerBd({ licence: "ODBl-1_0" });
      const idTableau = await constls[0].bds.ajouterTableau({
        idBd,
      });
      const idColonne = await constls[0].bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
      });

      await constls[0].compte.donnerAccèsObjet({
        idObjet: idBd,
        identité: await constls[1].compte.obtIdCompte(),
        rôle: MEMBRE,
      });

      // Vérifier la permission
      const idDonnées = await constls[0].bds.tableaux.obtIdDonnées({});
      const permission = await obtenir<Rôle>(({ siDéfini }) =>
        constls[1].compte.suivrePermission({
          idObjet: idDonnées,
          f: siDéfini(),
        }),
      );
      expect(permission).to.equal(MEMBRE);

      // Vérifier que l'édition des données fonctionne
      await constls[1].bds.tableaux.ajouterÉléments({
        idStructure: idBd,
        idTableau,
        vals: [
          {
            [idColonne]: 123,
          },
        ],
      });

      const vals = await obtenir(({ siPasVide }) =>
        constls[0].bds.tableaux.suivreDonnées({
          idStructure: idBd,
          idTableau,
          f: siPasVide(),
        }),
      );
      expect(vals).to.deep.equal([
        {
          [idColonne]: 123,
        },
      ]);
    });
  });
});
