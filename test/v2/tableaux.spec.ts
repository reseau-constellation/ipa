import { expect } from "aegir/chai";
import { MEMBRE } from "@/v2/crabe/services/compte/accès/consts.js";
import { Rôle } from "@/v2/crabe/services/compte/accès/types.js";
import { Constellation } from "@/v2/index.js";
import { TraducsTexte } from "@/v2/types.js";
import {
  DifférenceColonneManquante,
  DifférenceColonneSupplémentaire,
  DifférenceIndexColonne,
  DifférenceTableaux,
  DifférenceVariableColonne,
  DonnéesRangéeTableau,
  DonnéesRangéeTableauAvecId,
  InfoColonne,
  InfoColonneAvecCatégorie,
} from "@/v2/tableaux.js";
import {
  DétailsRègleBornesDynamiqueColonne,
  DétailsRègleBornesDynamiqueVariable,
  DétailsRègleValeurCatégoriqueDynamique,
  ErreurColonne,
  ErreurDonnée,
  ErreurRègle,
  RègleBornes,
  RègleCatégorie,
  RègleColonne,
  RègleIndexUnique,
  RègleValeurCatégorique,
} from "@/v2/règles.js";
import { créerConstellationsTest, obtenir } from "./utils.js";

describe("tableaux", function () {
  let fermer: () => Promise<void>;
  let constls: Constellation[];
  let constl: Constellation;

  before(async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 1,
    }));
    constl = constls[0];
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("noms", function () {
    let idBd: string;

    let idTableau: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      idTableau = await constl.bds.ajouterTableau({ idBd });
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
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
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

      it("erreur - variable colonne dédoublée", async () => {
        const erreursAvant = await obtenir<ErreurColonne[]>(({ siDéfini }) =>
          constl.bds.tableaux.suivreValidColonnes({
            idStructure: idBd,
            idTableau,
            f: siDéfini(),
          }),
        );
        expect(erreursAvant).to.be.empty();

        const idVariable = await constl.variables.créerVariable({
          catégorie: "vidéo",
        });

        const idColonne1 = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable,
        });
        // Ajouter une autre colonne avec la même variable
        const idColonne2 = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable,
        });

        const erreurs = await obtenir<ErreurColonne[]>(({ siPasVide }) =>
          constl.bds.tableaux.suivreValidColonnes({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
        );
        const réf: ErreurColonne[] = [
          {
            type: "variableDédoublée",
            colonnes: [idColonne1, idColonne2],
          },
        ];
        expect(erreurs).to.have.deep.members(réf);
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

      beforeEach(async () => {
        idTableau = await constl.bds.ajouterTableau({ idBd });

        idColNumérique = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        idColChaîne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
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

        const élément = {
          [idColNumérique]: 123.456,
          [idColChaîne]: "வணக்கம்",
        };
        const idÉlément = (
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [élément],
          })
        )[0];

        const réf: DonnéesRangéeTableauAvecId[] = [
          { id: idÉlément, données: élément },
        ];
        expect(await pDonnées).to.deep.equal(réf);
      });

      it("modifier élément", async () => {
        const idÉlément = (
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColNumérique]: 123.456,
                [idColChaîne]: "வணக்கம்",
              },
            ],
          })
        )[0];

        const pDonnées = obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si(
              (d) => !!d?.find((x) => x.données[idColNumérique] !== 123.456),
            ),
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
          vals: nouvelÉlément,
        });

        const réf: DonnéesRangéeTableauAvecId[] = [
          { id: idÉlément, données: nouvelÉlément },
        ];
        expect(await pDonnées).to.deep.equal(réf);
      });

      it("effacer clef élément", async () => {
        const idÉlément = (
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColNumérique]: 123.456,
                [idColChaîne]: "வணக்கம்",
              },
            ],
          })
        )[0];
        const pDonnées = obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si(
              (d) => !!d?.find((x) => !Object.keys(x).includes(idColNumérique)),
            ),
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

        const réf: DonnéesRangéeTableauAvecId[] = [
          { id: idÉlément, données: { [idColChaîne]: "வணக்கம்" } },
        ];
        expect(await pDonnées).to.deep.equal(réf);
      });

      it("ajouter clef élément", async () => {
        const idÉlément = (
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColChaîne]: "வணக்கம்",
              },
            ],
          })
        )[0];
        const pDonnées = obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si(
              (d) => !!d?.find((x) => Object.keys(x).includes(idColNumérique)),
            ),
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

        const réf: DonnéesRangéeTableauAvecId[] = [
          {
            id: idÉlément,
            données: { [idColChaîne]: "வணக்கம்", [idColNumérique]: 123 },
          },
        ];
        expect(await pDonnées).to.deep.equal(réf);
      });

      it("effacer colonne", async () => {
        const idÉlément = (
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColNumérique]: 123.456,
                [idColChaîne]: "வணக்கம்",
              },
            ],
          })
        )[0];
        const pDonnées = obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si(
              (d) => !!d?.find((x) => !Object.keys(x).includes(idColChaîne)),
            ),
          }),
        );
        await constl.bds.tableaux.effacerColonne({
          idStructure: idBd,
          idTableau,
          idColonne: idColChaîne,
        });

        const réf: DonnéesRangéeTableauAvecId[] = [
          { id: idÉlément, données: { [idColNumérique]: 123 } },
        ];
        expect(await pDonnées).to.deep.equal(réf);
      });

      it("restaurer colonne", async () => {
        const idÉlément = (
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColNumérique]: 123.456,
                [idColChaîne]: "வணக்கம்",
              },
            ],
          })
        )[0];
        await constl.bds.tableaux.effacerColonne({
          idStructure: idBd,
          idTableau,
          idColonne: idColChaîne,
        });
        const pDonnées = obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si(
              (d) => !!d?.find((x) => Object.keys(x).includes(idColChaîne)),
            ),
          }),
        );
        await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idColonne: idColChaîne,
        });

        const réf: DonnéesRangéeTableauAvecId[] = [
          {
            id: idÉlément,
            données: { [idColChaîne]: "வணக்கம்", [idColNumérique]: 123 },
          },
        ];
        expect(await pDonnées).to.deep.equal(réf);
      });

      it("effacer élément", async () => {
        const idÉlément = (
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColNumérique]: 123.456,
                [idColChaîne]: "வணக்கம்",
              },
            ],
          })
        )[0];
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
        const élément = {
          [idColNumérique]: 123.456,
          [idColChaîne]: "வணக்கம்",
        };
        const idÉlément = (
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [élément],
          })
        )[0];
        const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
          ({ siPasVide }) =>
            constl.bds.tableaux.suivreDonnées({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
              clefsSelonVariables: true,
            }),
        );

        const réf: DonnéesRangéeTableauAvecId[] = [
          { id: idÉlément, données: élément },
        ];
        expect(données).to.deep.equal(réf);
      });

      it("suivre données selon variable - ajout variable ", async () => {
        const élément = {
          [idColNumérique]: 123.456,
          [idColChaîne]: "வணக்கம்",
        };
        const idÉlément = (
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [élément],
          })
        )[0];

        const pDonnées = obtenir(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            clefsSelonVariables: true,
            f: si(
              (x) =>
                !!x &&
                Object.keys(x).length === 2 &&
                !Object.keys(x).includes(idColNumérique),
            ),
          }),
        );

        const idVarNumérique = await constl.variables.créerVariable({
          catégorie: "numérique",
        });

        await constl.bds.tableaux.modifierVariableColonne({
          idStructure: idBd,
          idTableau,
          idColonne: idColNumérique,
          idVariable: idVarNumérique,
        });

        const données = await pDonnées;

        const réf: DonnéesRangéeTableauAvecId[] = [
          {
            id: idÉlément,
            données: {
              [idVarNumérique]: 123.456,
              [idColChaîne]: "வணக்கம்",
            },
          },
        ];
        expect(données).to.deep.equal(réf);
      });

      it("erreur si index dédoublé", async () => {
        await constl.bds.tableaux.modifierIndexColonne({
          idStructure: idBd,
          idTableau,
          idColonne: idColChaîne,
          index: true,
        });

        const élément1 = {
          [idColNumérique]: 123.456,
          [idColChaîne]: "வணக்கம்",
        };
        const élément2 = {
          [idColNumérique]: -123.456,
          [idColChaîne]: "வணக்கம்",
        };
        const idsÉléments = await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments: [élément1, élément2],
        });

        const erreurs = await obtenir<ErreurDonnée[]>(({ siPasVide }) =>
          constl.bds.tableaux.suivreValidDonnées({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
        );

        const idRègle = (
          await obtenir<RègleColonne[]>(({ siPasVide }) =>
            constl.bds.tableaux.suivreRègles({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
            }),
          )
        )[0].règle.id;

        const réf: ErreurDonnée<RègleIndexUnique>[] = idsÉléments.map((id) => ({
          id,
          erreur: {
            règle: {
              id: idRègle,
              règle: {
                type: "indexUnique",
              },
            },
            source: {
              type: "tableau",
              idStructure: idBd,
              idTableau,
            },
            colonne: idColChaîne,
          },
        }));
        expect(erreurs).to.have.deep.members(réf);
      });

      it("erreur de règle colonne", async () => {
        const idÉlément = (
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColNumérique]: 123.456,
                [idColChaîne]: "வணக்கம்",
              },
            ],
          })
        )[0];

        const règle: RègleBornes = {
          type: "bornes",
          détails: {
            type: "fixe",
            op: ">",
            val: 500,
          },
        };
        const idRègle = await constl.bds.tableaux.ajouterRègle({
          idStructure: idBd,
          idTableau,
          idColonne: idColNumérique,
          règle,
        });

        const erreurs = await obtenir<ErreurDonnée[]>(({ siPasVide }) =>
          constl.bds.tableaux.suivreValidDonnées({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
        );

        const réf: ErreurDonnée<RègleBornes> = {
          id: idÉlément,
          erreur: {
            règle: {
              id: idRègle,
              règle,
            },
            source: { type: "tableau", idStructure: idBd, idTableau },
            colonne: idColNumérique,
          },
        };
        expect(erreurs).to.have.deep.members([réf]);
      });

      it("erreur de règle variable", async () => {
        const idÉlément = (
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColNumérique]: 123.456,
                [idColChaîne]: "வணக்கம்",
              },
            ],
          })
        )[0];

        const idVariable = await constl.variables.créerVariable({
          catégorie: "numérique",
        });
        await constl.bds.tableaux.modifierVariableColonne({
          idStructure: idBd,
          idTableau,
          idColonne: idColNumérique,
          idVariable,
        });

        const règle: RègleBornes = {
          type: "bornes",
          détails: {
            type: "fixe",
            op: ">",
            val: 500,
          },
        };
        const idRègle = await constl.variables.ajouterRègleVariable({
          idVariable,
          règle,
        });

        const erreurs = await obtenir<ErreurDonnée[]>(({ siPasVide }) =>
          constl.bds.tableaux.suivreValidDonnées({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
        );

        const réf: ErreurDonnée<RègleBornes> = {
          id: idÉlément,
          erreur: {
            règle: {
              id: idRègle,
              règle,
            },
            source: { type: "variable", id: idVariable },
            colonne: idColNumérique,
          },
        };
        expect(erreurs).to.have.deep.members([réf]);
      });
    });

    describe("index", function () {
      let idTableau: string;
      let idsÉlémentsInitiaux: string[];

      const idColonneDate = "date";
      const idColonneEndroit = "endroit";
      const idColonnePrécip = "précip";

      const élémentsInitiaux: DonnéesRangéeTableau[] = [
        {
          [idColonneDate]: (new Date("20/11/2025")).valueOf(),
          [idColonneEndroit]: [11.010353745293981, 76.93447944133268],
          [idColonnePrécip]: 3
        },
        {
          [idColonneDate]: (new Date("21/11/2025")).valueOf(),
          [idColonneEndroit]: [16.534768942113885, 80.79302512863033],
          [idColonnePrécip]: 11
        }
      ]

      beforeEach(async () => {
        idTableau = await constl.bds.ajouterTableau({ idBd });
        await constl.bds.tableaux.ajouterColonne({ idStructure: idBd, idTableau, idColonne: idColonneDate });
        await constl.bds.tableaux.ajouterColonne({ idStructure: idBd, idTableau, idColonne: idColonneEndroit });
        await constl.bds.tableaux.ajouterColonne({ idStructure: idBd, idTableau, idColonne: idColonnePrécip });
        
        idsÉlémentsInitiaux = await constl.bds.tableaux.ajouterÉléments({
          idStructure:idBd,
          idTableau,
          éléments: élémentsInitiaux
        })
      });

      it("index univariable - ajout élément", async () => {
        await constl.bds.tableaux.modifierIndexColonne({ idStructure: idBd, idTableau, idColonne: idColonneDate, index: true });

        const éléments: DonnéesRangéeTableau[] = [{
          [idColonneDate]: (new Date("21/11/2025")).valueOf(),
          [idColonneEndroit]: [11.010353745293981, 76.93447944133268],
          [idColonnePrécip]: 4
        }]
        const idsNouveauxÉléments = await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments
        });

        const réf: DonnéesRangéeTableauAvecId[] = [
          {
            id: idsÉlémentsInitiaux[0],
            données: élémentsInitiaux[0]
          },
          {
            id: idsNouveauxÉléments[0],
            données: éléments[0]
          }
        ]

        const données = await obtenir<DonnéesRangéeTableauAvecId[]>(({si})=>constl.bds.tableaux.suivreDonnées({idStructure: idBd, idTableau, 
          f: si(x=>x?.length === réf.length && idsNouveauxÉléments.every(id=>x.find(d=>d.id === id)))})
        )
        expect(données).to.have.deep.members(réf);
      });

      it("index univariable - modification élément", async () => {
        await constl.bds.tableaux.modifierIndexColonne({ idStructure: idBd, idTableau, idColonne: idColonneDate, index: true })
        await constl.bds.tableaux.modifierÉlément({
          idStructure: idBd, idTableau, idÉlément: idsÉlémentsInitiaux[0], vals: { [idColonneDate]: (new Date("22/11/2025")).valueOf() }
        })

        const éléments: DonnéesRangéeTableau[] = [
          {
            [idColonneDate]: (new Date("22/11/2025")).valueOf(),
            [idColonneEndroit]: [11.010353745293981, 76.93447944133268],
            [idColonnePrécip]: 5
          },
        ]
        const idsNouveauxÉléments = await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments
        });

        const réf: DonnéesRangéeTableauAvecId[] = [
          { id: idsNouveauxÉléments[0], données: éléments[0] },
          { id: idsÉlémentsInitiaux[1], données: élémentsInitiaux[1] }
        ]

        const données = await obtenir<DonnéesRangéeTableauAvecId[]>(({si})=>constl.bds.tableaux.suivreDonnées({idStructure: idBd, idTableau, 
          f: si(x=>x?.length === réf.length && idsNouveauxÉléments.every(id=>x.find(d=>d.id === id)))})
        )
        expect(données).to.have.deep.members(réf);
      });

      it("index variable liste - ajout élément", async () => {
        await constl.bds.tableaux.modifierIndexColonne({ idStructure: idBd, idTableau, idColonne: idColonneEndroit, index: true })

        const éléments: DonnéesRangéeTableau[] = [{
          [idColonneDate]: (new Date("20/11/2025")).valueOf(),
          [idColonneEndroit]: [16.534768942113885, 80.79302512863033],
          [idColonnePrécip]: 4
        }]
        const idsNouveauxÉléments = await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments
        });

        const réf: DonnéesRangéeTableauAvecId[] = [
          {
            id: idsÉlémentsInitiaux[0],
            données: élémentsInitiaux[0]
          },
          {
            id: idsNouveauxÉléments[0],
            données: éléments[0]
          },
        ]

        const données = await obtenir<DonnéesRangéeTableauAvecId[]>(({si})=>constl.bds.tableaux.suivreDonnées({idStructure: idBd, idTableau, 
          f: si(x=>x?.length === réf.length && idsNouveauxÉléments.every(id=>x.find(d=>d.id === id)))})
        )
        expect(données).to.have.deep.members(réf);
      });

      it("index variable liste - modification élément", async () => {
        await constl.bds.tableaux.modifierIndexColonne({ idStructure: idBd, idTableau, idColonne: idColonneEndroit, index: true })
        await constl.bds.tableaux.modifierÉlément({
          idStructure: idBd, idTableau, idÉlément: idsÉlémentsInitiaux[0], vals: { [idColonneEndroit]: [14.782883663386926, -91.14748363253622] }
        })

        const éléments: DonnéesRangéeTableau[] = [
          {
            [idColonneDate]: (new Date("22/11/2025")).valueOf(),
            [idColonneEndroit]: [11.010353745293981, 76.93447944133268],
            [idColonnePrécip]: 5
          },
        ]
        const idsNouveauxÉléments = await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments
        });

        const réf: DonnéesRangéeTableauAvecId[] = [
          { id: idsNouveauxÉléments[0], données: éléments[0] },
          { id: idsÉlémentsInitiaux[1], données: élémentsInitiaux[1] }
        ]
        const données = await obtenir<DonnéesRangéeTableauAvecId[]>(({si})=>constl.bds.tableaux.suivreDonnées({idStructure: idBd, idTableau, 
          f: si(x=>x?.length === réf.length && idsNouveauxÉléments.every(id=>x.find(d=>d.id === id)))})
        )
        expect(données).to.have.deep.members(réf);
      });

      it("index multivariable - ajout élément", async () => {
        await constl.bds.tableaux.modifierIndexColonne({ idStructure: idBd, idTableau, idColonne: idColonneDate, index: true })
        await constl.bds.tableaux.modifierIndexColonne({ idStructure: idBd, idTableau, idColonne: idColonneEndroit, index: true })

        const éléments: DonnéesRangéeTableau[] = [{
          [idColonneDate]: (new Date("20/11/2025")).valueOf(),
          [idColonneEndroit]: [11.010353745293981, 76.93447944133268],
          [idColonnePrécip]: 3
        },
        {
          [idColonneDate]: (new Date("21/11/2025")).valueOf(),
          [idColonneEndroit]: [11.010353745293981, 76.93447944133268],
          [idColonnePrécip]: 11
        }]
        const idsNouveauxÉléments = await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments
        });

        const réf: DonnéesRangéeTableauAvecId[] = [
          {
            id: idsÉlémentsInitiaux[1],
            données: élémentsInitiaux[1]
          },
          {
            id: idsNouveauxÉléments[0],
            données: éléments[0]
          },
          {
            id: idsNouveauxÉléments[1],
            données: éléments[1]
          }
        ]

        const données = await obtenir<DonnéesRangéeTableauAvecId[]>(({si})=>constl.bds.tableaux.suivreDonnées({idStructure: idBd, idTableau, 
          f: si(x=>x?.length === réf.length && idsNouveauxÉléments.every(id=>x.find(d=>d.id === id)))})
        )
        expect(données).to.have.deep.members(réf);
      });

      it("index multivariable - modification élément", async () => {
        await constl.bds.tableaux.modifierIndexColonne({ idStructure: idBd, idTableau, idColonne: idColonneDate, index: true })
        await constl.bds.tableaux.modifierIndexColonne({ idStructure: idBd, idTableau, idColonne: idColonneEndroit, index: true })
        await constl.bds.tableaux.modifierÉlément({
          idStructure: idBd, idTableau, idÉlément: idsÉlémentsInitiaux[0], vals: { [idColonneEndroit]: [14.782883663386926, -91.14748363253622] }
        })

        const éléments: DonnéesRangéeTableau[] = [{
          [idColonneDate]: (new Date("20/11/2025")).valueOf(),
          [idColonneEndroit]: [14.782883663386926, -91.14748363253622],
          [idColonnePrécip]: 5
        },]
        const idsNouveauxÉléments = await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments
        });

        const réf: DonnéesRangéeTableauAvecId[] = [
          { id: idsNouveauxÉléments[0], données: éléments[0] },
          { id: idsÉlémentsInitiaux[1], données: élémentsInitiaux[1] }
        ]
        const données = await obtenir<DonnéesRangéeTableauAvecId[]>(({si})=>constl.bds.tableaux.suivreDonnées({idStructure: idBd, idTableau, 
          f: si(x=>x?.length === réf.length && idsNouveauxÉléments.every(id=>x.find(d=>d.id === id)))})
        )
        expect(données).to.have.deep.members(réf);
      });
    });

    describe("règles", function () {
      describe("général", function () {
        let idTableau: string;
        let idColonne: string;
        let idRègle: string;

        before(async () => {
          idTableau = await constl.bds.ajouterTableau({ idBd });
          idColonne = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
        });

        it("aucune règle pour commencer", async () => {
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
          const règles = await obtenir<RègleColonne[]>(({ siDéfini }) =>
            constl.bds.tableaux.suivreRègles({
              idStructure: idBd,
              idTableau,
              f: siDéfini(),
            }),
          );

          expect(règles).to.be.empty();
        });

        it("ajouter règle", async () => {
          const règle: RègleBornes = {
            type: "bornes",
            détails: {
              type: "fixe",
              op: "≥",
              val: 100,
            },
          };
          idRègle = await constl.bds.tableaux.ajouterRègle({
            idStructure: idBd,
            idTableau,
            idColonne,
            règle,
          });
          await constl.bds.tableaux.ajouterRègle({
            idStructure: idBd,
            idTableau,
            idColonne,
            règle,
          });

          const règles = await obtenir<RègleColonne[]>(({ siPasVide }) =>
            constl.bds.tableaux.suivreRègles({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
            }),
          );

          const réfRègles: RègleColonne[] = [
            {
              règle: {
                id: idRègle,
                règle,
              },
              source: { type: "tableau", idStructure: idBd, idTableau },
              colonne: idColonne,
            },
          ];
          expect(règles).to.have.deep.members(réfRègles);

          const idÉlément = (
            await constl.bds.tableaux.ajouterÉléments({
              idStructure: idBd,
              idTableau,
              éléments: [{ [idColonne]: 10 }],
            })
          )[0];

          const erreurs = await obtenir<ErreurDonnée[]>(({ siPasVide }) =>
            constl.bds.tableaux.suivreValidDonnées({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
            }),
          );
          const réfErreurs: ErreurDonnée[] = [
            {
              id: idÉlément,
              erreur: réfRègles[0],
            },
          ];
          expect(erreurs).to.have.deep.members(réfErreurs);
        });

        it("modifier règle", async () => {
          const règleModifiée: RègleBornes = {
            type: "bornes",
            détails: {
              type: "fixe",
              op: "≤",
              val: 100,
            },
          };
          await constl.bds.tableaux.modifierRègle({
            idStructure: idBd,
            idTableau,
            idRègle,
            règleModifiée,
          });

          const règles = await obtenir<RègleColonne[]>(({ si }) =>
            constl.bds.tableaux.suivreRègles({
              idStructure: idBd,
              idTableau,
              f: si(
                (x) =>
                  !!x?.find(
                    (r) =>
                      r.règle.règle.type === "bornes" &&
                      r.règle.règle.détails.op !== "≥",
                  ),
              ),
            }),
          );

          const réfRègles: RègleColonne[] = [
            {
              règle: {
                id: idRègle,
                règle: règleModifiée,
              },
              source: { type: "tableau", idStructure: idBd, idTableau },
              colonne: idColonne,
            },
          ];
          expect(règles).to.have.deep.members(réfRègles);

          const erreurs = await obtenir<ErreurDonnée[]>(({ siVide }) =>
            constl.bds.tableaux.suivreValidDonnées({
              idStructure: idBd,
              idTableau,
              f: siVide(),
            }),
          );
          expect(erreurs).to.be.empty();
        });

        it("effacer règle", async () => {
          await constl.bds.tableaux.effacerRègle({
            idStructure: idBd,
            idTableau,
            idRègle,
          });

          const règles = await obtenir<RègleColonne[]>(({ siVide }) =>
            constl.bds.tableaux.suivreRègles({
              idStructure: idBd,
              idTableau,
              f: siVide(),
            }),
          );
          expect(règles).to.be.empty();
        });

        it("on ne peut pas directement effacer une règle provenant de la variable", async () => {
          const idVariable = await constl.variables.créerVariable({
            catégorie: "numérique",
          });
          const idColonne = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idVariable,
          });
          const règle: RègleBornes = {
            type: "bornes",
            détails: {
              type: "fixe",
              val: 0,
              op: "<",
            },
          };
          const idRègle = await constl.variables.ajouterRègleVariable({
            idVariable,
            règle,
          });
          await constl.bds.tableaux.effacerRègle({
            idStructure: idBd,
            idTableau,
            idRègle,
          });

          const règles = await obtenir<RègleColonne[]>(({ si }) =>
            constl.bds.tableaux.suivreRègles({
              idStructure: idBd,
              idTableau,
              f: si((x) => !!x?.find((r) => r.règle.règle.type === "bornes")),
            }),
          );

          const réf: RègleColonne = {
            règle: {
              id: idRègle,
              règle,
            },
            source: { type: "variable", id: idVariable },
            colonne: idColonne,
          };
          expect(
            règles.filter((r) => r.règle.id === idRègle).length,
          ).to.deep.equal(réf);
        });
      });

      describe("catégories", function () {
        let idTableau: string;
        let idColonne: string;
        let idRègle: string;

        before(async () => {
          idTableau = await constl.bds.ajouterTableau({ idBd });
          idColonne = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
        });

        it("ajout variable", async () => {
          const idVariable = await constl.variables.créerVariable({
            catégorie: "numérique",
          });
          await constl.bds.tableaux.modifierVariableColonne({
            idStructure: idBd,
            idTableau,
            idColonne,
            idVariable,
          });
          const règles = await obtenir<RègleColonne[]>(({ siPasVide }) =>
            constl.bds.tableaux.suivreRègles({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
            }),
          );
          idRègle = règles[0].règle.id;

          const réf: RègleColonne<RègleCatégorie>[] = [
            {
              règle: {
                id: idRègle,
                règle: {
                  type: "catégorie",
                  détails: {
                    catégorie: { type: "simple", catégorie: "numérique" },
                  },
                },
              },
              source: { type: "tableau", idStructure: idBd, idTableau },
              colonne: idColonne,
            },
          ];
          expect(règles).to.have.deep.members(réf);
        });

        it("erreur données", async () => {
          const idÉlément = (
            await constl.bds.tableaux.ajouterÉléments({
              idStructure: idBd,
              idTableau,
              éléments: [
                {
                  [idColonne]: 123,
                },
              ],
            })
          )[0];

          const erreurs = await obtenir<ErreurDonnée[]>(({ siPasVide }) =>
            constl.bds.tableaux.suivreValidDonnées({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
            }),
          );
          const réf: ErreurDonnée[] = [
            {
              id: idÉlément,
              erreur: {
                règle: {
                  id: idRègle,
                  règle: {
                    type: "catégorie",
                    détails: {
                      catégorie: {
                        type: "simple",
                        catégorie: "chaîne",
                      },
                    },
                  },
                },
                source: { type: "tableau", idStructure: idBd, idTableau },
                colonne: idColonne,
              },
            },
          ];
          expect(erreurs).to.have.deep.members(réf);
        });
      });

      describe("bornes relatives colonne", function () {
        let idTableau: string;
        let idColonneTempMin: string;
        let idColonneTempMax: string;
        let idRègle: string;

        const règle: RègleBornes<DétailsRègleBornesDynamiqueColonne> = {
          type: "bornes",
          détails: {
            type: "dynamiqueColonne",
            val: "température minimum",
            op: ">=",
          },
        };

        before(async () => {
          idTableau = await constl.bds.ajouterTableau({ idBd });
          idColonneTempMax = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
        });

        it("erreur règle borne - colonne inexistante", async () => {
          idRègle = await constl.bds.tableaux.ajouterRègle({
            idStructure: idBd,
            idTableau,
            idColonne: idColonneTempMax,
            règle,
          });

          const erreurs = await obtenir<ErreurRègle[]>(({ siPasVide }) =>
            constl.bds.tableaux.suivreValidRègles({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
            }),
          );
          const réf: ErreurRègle[] = [
            {
              type: "colonneBornesInexistante",
              règle: {
                source: { type: "tableau", idStructure: idBd, idTableau },
                règle: { id: idRègle, règle },
                colonne: idColonneTempMax,
              },
            },
          ];
          expect(erreurs).to.have.deep.members(réf);
        });

        it("ajout colonne borne", async () => {
          idColonneTempMin = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: "température minimum",
          });

          const erreurs = await obtenir<ErreurRègle[]>(({ siVide }) =>
            constl.bds.tableaux.suivreValidRègles({
              idStructure: idBd,
              idTableau,
              f: siVide(),
            }),
          );
          expect(erreurs).to.be.empty();
        });

        it("élément valide", async () => {
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColonneTempMin]: -15,
                [idColonneTempMax]: -5,
              },
            ],
          });

          const erreurs = await obtenir<ErreurDonnée[]>(({ siDéfini }) =>
            constl.bds.tableaux.suivreValidDonnées({
              idStructure: idBd,
              idTableau,
              f: siDéfini(),
            }),
          );
          expect(erreurs).to.be.empty();
        });

        it("erreur données - élément invalide", async () => {
          const idÉlément = (
            await constl.bds.tableaux.ajouterÉléments({
              idStructure: idBd,
              idTableau,
              éléments: [
                {
                  [idColonneTempMin]: -15,
                  [idColonneTempMax]: -25,
                },
              ],
            })
          )[0];

          const réf: ErreurDonnée[] = [
            {
              id: idÉlément,
              erreur: {
                source: { type: "tableau", idStructure: idBd, idTableau },
                colonne: idColonneTempMin,
                règle: {
                  id: idRègle,
                  règle,
                },
              },
            },
          ];

          const erreurs = await obtenir<ErreurDonnée[]>(({ siPasVide }) =>
            constl.bds.tableaux.suivreValidDonnées({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
            }),
          );
          expect(erreurs).to.deep.equal(réf);
        });
      });

      describe("bornes relatives variable", function () {
        let idTableau: string;
        let idColonneTempMax: string;

        beforeEach(async () => {
          idTableau = await constl.bds.ajouterTableau({ idBd });
          idColonneTempMax = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
        });

        it("erreur données", async () => {
          const idVariableTempMin = await constl.variables.créerVariable({
            catégorie: "numérique",
          });
          const règle: RègleBornes<DétailsRègleBornesDynamiqueVariable> = {
            type: "bornes",
            détails: {
              type: "dynamiqueVariable",
              val: idVariableTempMin,
              op: ">",
            },
          };
          const idRègle = await constl.bds.tableaux.ajouterRègle({
            idStructure: idBd,
            idTableau,
            idColonne: idColonneTempMax,
            règle,
          });

          const idColonneTempMin = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idVariable: idVariableTempMin,
          });

          const idsÉléments = await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColonneTempMax]: 10,
                [idColonneTempMin]: 20,
              },
              {
                [idColonneTempMax]: 10,
                [idColonneTempMin]: 5,
              },
            ],
          });

          const erreurs = await obtenir<ErreurDonnée[]>(({ siPasVide }) =>
            constl.bds.tableaux.suivreValidDonnées({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
            }),
          );
          const réf: ErreurDonnée[] = [
            {
              id: idsÉléments[0],
              erreur: {
                colonne: idColonneTempMax,
                règle: { règle, id: idRègle },
                source: { type: "tableau", idStructure: idBd, idTableau },
              },
            },
          ];
          expect(erreurs).to.have.deep.members(réf);
        });

        it("erreur règle borne - variable inexistante", async () => {
          const idVariableTempMoyenne = await constl.variables.créerVariable({
            catégorie: "numérique",
          });
          const règle: RègleBornes<DétailsRègleBornesDynamiqueVariable> = {
            type: "bornes",
            détails: {
              type: "dynamiqueVariable",
              val: idVariableTempMoyenne,
              op: ">=",
            },
          };
          const idRègle = await constl.bds.tableaux.ajouterRègle({
            idStructure: idBd,
            idTableau,
            idColonne: idColonneTempMax,
            règle,
          });

          const erreurs = await obtenir<ErreurRègle[]>(({ siPasVide }) =>
            constl.bds.tableaux.suivreValidRègles({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
            }),
          );
          const réf: ErreurRègle[] = [
            {
              type: "variableBornesNonPrésente",
              règle: {
                source: { type: "tableau", idStructure: idBd, idTableau },
                règle: { id: idRègle, règle },
                colonne: idColonneTempMax,
              },
            },
          ];
          expect(erreurs).to.have.deep.members(réf);
        });
      });

      describe("catégorique fixe", function () {
        let idTableau: string;
        let idColonne: string;
        let idRègle: string;

        const règle: RègleValeurCatégorique = {
          type: "valeurCatégorique",
          détails: { type: "fixe", options: ["வணக்கம்", "សួស្តើ"] },
        };

        before(async () => {
          idTableau = await constl.bds.ajouterTableau({ idBd });
          idColonne = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
        });

        it("élément valide", async () => {
          idRègle = await constl.bds.tableaux.ajouterRègle({
            idStructure: idBd,
            idTableau,
            idColonne,
            règle,
          });

          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColonne]: "வணக்கம்",
              },
            ],
          });

          const erreurs = await obtenir<ErreurDonnée[]>(({ siDéfini }) =>
            constl.bds.tableaux.suivreValidDonnées({
              idStructure: idBd,
              idTableau,
              f: siDéfini(),
            }),
          );
          expect(erreurs).to.be.empty();
        });

        it("erreur données", async () => {
          const idÉlément = (
            await constl.bds.tableaux.ajouterÉléments({
              idStructure: idBd,
              idTableau,
              éléments: [
                {
                  [idColonne]: "សូស្ដី",
                },
              ],
            })
          )[0];

          const erreurs = await obtenir<ErreurDonnée[]>(({ siPasVide }) =>
            constl.bds.tableaux.suivreValidDonnées({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
            }),
          );
          const réf: ErreurDonnée[] = [
            {
              id: idÉlément,
              erreur: {
                colonne: idColonne,
                règle: { id: idRègle, règle },
                source: { type: "tableau", idStructure: idBd, idTableau },
              },
            },
          ];
          expect(erreurs).to.have.deep.members(réf);
        });
      });

      describe("catégorique relative", function () {
        let idTableau: string;
        let idColonne: string;
        let idRègle: string;

        const idTableauValide = "valide";
        const idColonnePermises = "permises";
        const règle: RègleValeurCatégorique<DétailsRègleValeurCatégoriqueDynamique> =
          {
            type: "valeurCatégorique",
            détails: {
              type: "dynamique",
              structure: idBd,
              tableau: idTableauValide,
              colonne: idColonnePermises,
            },
          };

        before(async () => {
          idTableau = await constl.bds.ajouterTableau({ idBd });
          idColonne = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
        });

        it("erreur règle catégorique - tableau inexistant", async () => {
          idRègle = await constl.bds.tableaux.ajouterRègle({
            idStructure: idBd,
            idTableau,
            idColonne,
            règle,
          });

          const erreurs = await obtenir<ErreurRègle[]>(({ siPasVide }) =>
            constl.bds.tableaux.suivreValidRègles({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
            }),
          );
          const réf: ErreurRègle[] = [
            {
              type: "tableauCatégInexistant",
              règle: {
                source: { type: "tableau", idStructure: idBd, idTableau },
                règle: { id: idRègle, règle },
                colonne: idColonne,
              },
            },
          ];
          expect(erreurs).to.have.deep.members(réf);
        });

        it("erreur règle catégorique - colonne inexistante", async () => {
          await constl.bds.ajouterTableau({ idBd, idTableau: idTableauValide });

          const erreurs = await obtenir<ErreurRègle[]>(({ si }) =>
            constl.bds.tableaux.suivreValidRègles({
              idStructure: idBd,
              idTableau,
              f: si(
                (x) => !!x?.find((e) => e.type === "tableauCatégInexistant"),
              ),
            }),
          );
          const réf: ErreurRègle[] = [
            {
              type: "tableauCatégInexistant",
              règle: {
                source: { type: "tableau", idStructure: idBd, idTableau },
                règle: { id: idRègle, règle },
                colonne: idColonne,
              },
            },
          ];
          expect(erreurs).to.have.deep.members(réf);
        });

        it("ajout colonne référence", async () => {
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau: idTableauValide,
            idColonne: idColonnePermises,
          });

          const erreurs = await obtenir<ErreurDonnée[]>(({ siVide }) =>
            constl.bds.tableaux.suivreValidDonnées({
              idStructure: idBd,
              idTableau,
              f: siVide(),
            }),
          );
          expect(erreurs).to.be.empty();
        });

        it("élément valide", async () => {
          const permises = ["வணக்கம்", "Ütz iwäch"];
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau: idTableauValide,
            éléments: permises.map((mot) => ({
              [idColonnePermises]: mot,
            })),
          });
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColonne]: "வணக்கம்",
              },
            ],
          });

          const erreurs = await obtenir<ErreurDonnée[]>(({ siDéfini }) =>
            constl.bds.tableaux.suivreValidDonnées({
              idStructure: idBd,
              idTableau,
              f: siDéfini(),
            }),
          );
          expect(erreurs).to.be.empty();
        });

        it("erreur données", async () => {
          const idÉlément = (
            await constl.bds.tableaux.ajouterÉléments({
              idStructure: idBd,
              idTableau,
              éléments: [
                {
                  [idColonne]: "કેમ છો",
                },
              ],
            })
          )[0];

          const erreurs = await obtenir<ErreurDonnée[]>(({ siPasVide }) =>
            constl.bds.tableaux.suivreValidDonnées({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
            }),
          );
          const réf: ErreurDonnée[] = [
            {
              id: idÉlément,
              erreur: {
                colonne: idColonne,
                source: { type: "tableau", idStructure: idBd, idTableau },
                règle: { id: idRègle, règle },
              },
            },
          ];
          expect(erreurs).to.have.deep.members(réf);
        });

        it("ajout valeurs colonne référence", async () => {
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau: idTableauValide,
            éléments: [
              {
                [idColonnePermises]: "કેમ છો",
              },
            ],
          });

          const erreurs = await obtenir<ErreurDonnée[]>(({ siDéfini }) =>
            constl.bds.tableaux.suivreValidDonnées({
              idStructure: idBd,
              idTableau,
              f: siDéfini(),
            }),
          );
          expect(erreurs).to.be.empty();
        });
      });
    });

    describe("importation", function () {
      let idTableau: string;

      before(async () => {
        idTableau = await constl.bds.ajouterTableau({ idBd });
        await Promise.all(
          ["endroit", "date", "températureMinimale"].map(
            async (idColonne) =>
              await constl.bds.tableaux.ajouterColonne({
                idStructure: idBd,
                idTableau,
                idColonne,
              }),
          ),
        );
      });

      it("importation éléments", async () => {
        const élémentsBase = [
          {
            endroit: "ici",
            date: {
              système: "dateJS",
              val: new Date("2021-01-01").valueOf(),
            },
            températureMinimale: 25,
          },
          {
            endroit: "ici",
            date: {
              système: "dateJS",
              val: new Date("2021-01-02").valueOf(),
            },
            températureMinimale: 25,
          },
          {
            endroit: "là-bas",
            date: {
              système: "dateJS",
              val: new Date("2021-01-01").valueOf(),
            },
            températureMinimale: 25,
          },
        ];

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments: élémentsBase,
        });

        // Il faut attendre que les données soient bien ajoutées avant de progresser avec l'importation.
        await obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si((x) => x?.length === 3),
          }),
        );

        const nouvellesDonnées: DonnéesRangéeTableau[] = [
          {
            endroit: "ici",
            date: {
              système: "dateJS",
              val: new Date("2021-01-01").valueOf(),
            },
            températureMinimale: 25,
          },
          {
            endroit: "ici",
            date: {
              système: "dateJS",
              val: new Date("2021-01-02").valueOf(),
            },
            températureMinimale: 27,
          },
        ];
        await constl.bds.tableaux.importerDonnées({
          idStructure: idBd,
          idTableau,
          données: nouvellesDonnées,
        });

        const données = await obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: si(
              (x) =>
                x?.length === 2 &&
                !x.some((d) => d.données["endroit"] === "là-bas"),
            ),
          }),
        );
        expect(données.map((d) => d.données)).to.deep.equal(nouvellesDonnées);
      });
    });

    describe("exportation", function () {
      it("langues nom tableau");
      it("langues noms colonnes");
      it("id tableau");
      it("id colonnes");
      it("données numériques");
      it("données dates");
      it("données chaîne");
      it("données booléennes");
      it("données fichiers");
    });

    describe("variables indisponibles", function () {
      let idTableau: string;
      let idColonne: string;

      const idVariableIndisponible =
        "/orbitdb/zdpuAximNmZyUWXGCaLmwSEGDeWmuqfgaoogA7KNSa1B2DAAF";

      before(async () => {
        idTableau = await constl.bds.ajouterTableau({ idBd });
        idColonne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable: idVariableIndisponible,
        });
      });

      it("accéder variables", async () => {
        const variables = await obtenir(({ siPasVide }) =>
          constl.bds.tableaux.suivreVariables({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
        );

        expect(variables).to.have.deep.members([idVariableIndisponible]);
      });

      it("accéder colonnes", async () => {
        const colonnes = await obtenir<InfoColonne[]>(({ siPasVide }) =>
          constl.bds.tableaux.suivreColonnes({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
        );

        const réf: InfoColonne[] = [
          {
            id: idColonne,
            variable: idVariableIndisponible,
          },
        ];
        expect(colonnes).to.have.deep.members(réf);
      });

      it("accéder catégories colonnes", async () => {
        const catégories = await obtenir<InfoColonneAvecCatégorie[]>(
          ({ siPasVide }) =>
            constl.bds.tableaux.suivreCatégoriesColonnes({
              idStructure: idBd,
              idTableau,
              f: siPasVide(),
            }),
        );

        const réf: InfoColonneAvecCatégorie[] = [
          {
            id: idColonne,
            variable: idVariableIndisponible,
            catégorie: undefined, // Indisponible car variable non accessible
          },
        ];
        expect(catégories).to.deep.equal(réf);
      });

      it("accéder données", async () => {
        const idÉlément = (
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColonne]: "Bonjour !",
              },
            ],
          })
        )[0];

        const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
          ({ siPasVide }) =>
            constl.bds.tableaux.suivreDonnées({
              idStructure: idBd,
              idTableau,
              clefsSelonVariables: true,
              f: siPasVide(),
            }),
        );
        const réf: DonnéesRangéeTableauAvecId[] = [
          {
            id: idÉlément,
            données: {
              [idVariableIndisponible]: "Bonjour !",
            },
          },
        ];
        expect(données).to.equal(réf);
      });
    });

    describe("combiner données", function () {
      let idTableauDestinataire: string;
      let idTableauSource: string;

      before(async () => {
        idTableauDestinataire = await constl.bds.ajouterTableau({ idBd });
        idTableauSource = await constl.bds.ajouterTableau({ idBd });

        for (const idTableau of [idTableauDestinataire, idTableauSource]) {
          for (const idColonne of ["date", "endroit", "tempMin", "tempMax"]) {
            await constl.bds.tableaux.ajouterColonne({
              idStructure: idBd,
              idTableau,
              idColonne,
            });
            if (idColonne === "date" || idColonne === "endroit") {
              await constl.bds.tableaux.modifierIndexColonne({
                idStructure: idBd,
                idTableau: idTableauDestinataire,
                idColonne,
                index: true,
              });
            }
          }
        }

        const élémentsDestinataire = [
          {
            endroit: "ici",
            date: "2021-01-01",
            tempMin: 25,
          },
          {
            endroit: "ici",
            date: "2021-01-02",
            tempMin: 25,
          },
          {
            endroit: "là-bas",
            date: "2021-01-01",
            tempMin: 25,
          },
        ];
        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau: idTableauDestinataire,
          éléments: élémentsDestinataire,
        });

        const élémentsSource: DonnéesRangéeTableau[] = [
          {
            endroit: "ici",
            date: "2021-01-01",
            tempMin: 27,
            tempMax: 30,
          },
          {
            endroit: "ici",
            date: "2021-01-02",
            tempMin: 27,
          },
          {
            endroit: "là-bas",
            date: "2021-01-02",
            tempMin: 27,
          },
        ];

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau: idTableauSource,
          éléments: élémentsSource,
        });
      });

      it("données manquantes ajoutées", async () => {
        await constl.bds.tableaux.combinerDonnées({
          de: {
            idStructure: idBd,
            idTableau: idTableauSource,
          },
          à: {
            idStructure: idBd,
            idTableau: idTableauDestinataire,
          },
        });

        const réf = [
          {
            endroit: "ici",
            date: "2021-01-01",
            tempMin: 25,
            tempMax: 30,
          },
          {
            endroit: "ici",
            date: "2021-01-02",
            tempMin: 25,
          },
          {
            endroit: "là-bas",
            date: "2021-01-01",
            tempMin: 25,
          },
          {
            endroit: "là-bas",
            date: "2021-01-02",
            tempMin: 27,
          },
        ];
        const données = await obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau: idTableauDestinataire,
            f: si((x) => x?.length === réf.length),
          }),
        );

        expect(données.map((d) => d.données)).to.have.deep.members(réf);
      });
    });
  });

  describe("différences tableaux", function () {
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    let idTableau: string;
    let idTableauRéf: string;

    beforeEach(async () => {
      idTableau = await constl.bds.ajouterTableau({ idBd });
      idTableauRéf = await constl.bds.ajouterTableau({ idBd });
    });

    it("variable colonne", async () => {
      const idColonne = "une colonne";

      const idVariable = await constl.variables.créerVariable({
        catégorie: "image",
      });
      const idVariable2 = await constl.variables.créerVariable({
        catégorie: "image",
      });

      await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idColonne,
        idVariable,
      });
      await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau: idTableauRéf,
        idColonne,
        idVariable: idVariable2,
      });

      const différences = await obtenir<DifférenceTableaux[]>(({ siPasVide }) =>
        constl.bds.tableaux.suivreDifférencesAvecTableau({
          tableau: { idStructure: idBd, idTableau },
          tableauRéf: { idStructure: idBd, idTableau: idTableauRéf },
          f: siPasVide(),
        }),
      );
      const réf: DifférenceVariableColonne[] = [
        {
          type: "variableColonne",
          sévère: true,
          idColonne,
          varColTableau: idVariable,
          varColTableauRéf: idVariable2,
        },
      ];
      expect(différences).to.have.deep.members(réf);
    });

    it("index colonne", async () => {
      const idColonne = "une colonne";
      await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idColonne,
      });
      await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau: idTableauRéf,
        idColonne,
      });

      await constl.bds.tableaux.modifierIndexColonne({
        idStructure: idBd,
        idTableau,
        idColonne,
        index: true,
      });

      const différences = await obtenir<DifférenceTableaux[]>(({ siPasVide }) =>
        constl.bds.tableaux.suivreDifférencesAvecTableau({
          tableau: { idStructure: idBd, idTableau },
          tableauRéf: { idStructure: idBd, idTableau: idTableauRéf },
          f: siPasVide(),
        }),
      );
      const réf: DifférenceIndexColonne[] = [
        {
          type: "indexColonne",
          sévère: true,
          idColonne,
          colTableauIndexée: true,
        },
      ];
      expect(différences).to.have.deep.members(réf);
    });
    it("colonne manquante", async () => {
      const idColonne = await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau: idTableauRéf,
      });

      const différences = await obtenir<DifférenceTableaux[]>(({ siPasVide }) =>
        constl.bds.tableaux.suivreDifférencesAvecTableau({
          tableau: { idStructure: idBd, idTableau },
          tableauRéf: { idStructure: idBd, idTableau: idTableauRéf },
          f: siPasVide(),
        }),
      );
      const réf: DifférenceColonneManquante[] = [
        {
          type: "colonneManquante",
          sévère: true,
          idColonneManquante: idColonne,
        },
      ];
      expect(différences).to.have.deep.members(réf);
    });

    it("colonne supplémentaire", async () => {
      const idColonne = await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
      });

      const différences = await obtenir<DifférenceTableaux[]>(({ siPasVide }) =>
        constl.bds.tableaux.suivreDifférencesAvecTableau({
          tableau: { idStructure: idBd, idTableau },
          tableauRéf: { idStructure: idBd, idTableau: idTableauRéf },
          f: siPasVide(),
        }),
      );
      const réf: DifférenceColonneSupplémentaire[] = [
        {
          type: "colonneSupplémentaire",
          sévère: false,
          idColonneSupplémentaire: idColonne,
        },
      ];
      expect(différences).to.have.deep.members(réf);
    });
  });

  describe("copier", function () {
    let idBd: string;
    let idTableau: string;
    let idVariable: string;
    let idColonne: string;
    let idRègle: string;

    let idTableauCopié: string;
    let idNouvelleBd: string;

    const réfNoms = {
      த: "மழை",
      हिं: "बारिश",
    };
    const règle: RègleBornes = {
      type: "bornes",
      détails: {
        type: "fixe",
        val: 0,
        op: ">",
      },
    };

    before(async () => {
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

      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idBd,
        idTableau,
        éléments: [
          {
            [idColonne]: 123,
          },
        ],
      });

      idRègle = await constl.bds.tableaux.ajouterRègle({
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

    it("nouvelle structure - le tableau est copié", async () => {
      idNouvelleBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });

      idTableauCopié = await constl.bds.tableaux.copierTableau({
        idStructure: idBd,
        idTableau,
        idStructureDestinataire: idNouvelleBd
      });
      expect(idTableauCopié).to.be.a("string");
    });

    it("nouvelle structure - les noms sont copiés", async () => {
      const noms = await obtenir(({ siPasVide }) =>
        constl.bds.tableaux.suivreNoms({
          idStructure: idNouvelleBd,
          idTableau: idTableauCopié,
          f: siPasVide(),
        }),
      );
      expect(noms).to.deep.equal(réfNoms);
    });

    it("nouvelle structure - les colonnes sont copiées", async () => {
      const colonnes = await obtenir<InfoColonne[]>(({ siPasVide }) =>
        constl.bds.tableaux.suivreColonnes({
          idStructure: idNouvelleBd,
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

    it("nouvelle structure - les règles sont copiés", async () => {
      const règles = await obtenir<RègleColonne[]>(({ si }) =>
        constl.bds.tableaux.suivreRègles({
          idStructure: idNouvelleBd,
          idTableau: idTableauCopié,
          f: si((x) => !!x && x.some((r) => r.règle.id === idRègle)),
        }),
      );

      expect(règles).to.deep.equal([règle]);
    });

    it("nouvelle structure - les variables sont copiés", async () => {
      const variables = await obtenir(({ siPasVide }) =>
        constl.bds.tableaux.suivreVariables({
          idStructure: idNouvelleBd,
          idTableau: idTableauCopié,
          f: siPasVide(),
        }),
      );

      expect(variables).to.deep.equal([idVariable]);
    });

    it("nouvelle structure - les données sont copiés", async () => {
      const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
        ({ siPasVide }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idNouvelleBd,
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
      const idDonnées = await constls[0].bds.tableaux.obtIdDonnées({
        idStructure: idBd,
        idTableau,
      });
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
        éléments: [
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
