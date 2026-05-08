import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { expect } from "aegir/chai";
import { dossierTempo } from "@constl/utils-tests";
import JSZip from "jszip";
import {
  isBrowser,
  isElectronMain,
  isElectronRenderer,
  isNode,
} from "wherearewe";
import { v4 as uuidv4 } from "uuid";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";
import { MEMBRE } from "@/v2/nébuleuse/services/compte/accès/consts.js";
import { obtRessourceTest } from "./ressources/index.js";
import { créerConstellationsTest, obtenir } from "./utils.js";
import type { DagCborEncodable } from "@orbitdb/core";
import type { Rôle } from "@/v2/nébuleuse/services/compte/accès/types.js";
import type { Constellation } from "@/v2/index.js";
import type { TraducsTexte } from "@/v2/types.js";
import type {
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
import type {
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
import type { DonnéesTableauExportées } from "@/v2/bds/tableaux.js";
import type { DonnéesFichierBdExportées } from "@/v2/utils.js";
import type { CatégorieBaseVariables } from "@/v2/variables.js";
import type { CellObject, WorkBook } from "xlsx";

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
        langue: "fra",
        nom: "Alphabets",
      });
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.bds.tableaux.suivreNoms({
          idStructure: idBd,
          idTableau,
          f: siPasVide(),
        }),
      );
      expect(noms.fra).to.equal("Alphabets");
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
        fra: "Alphabets",
      });
    });

    it("changer un nom", async () => {
      await constl.bds.tableaux.sauvegarderNom({
        idStructure: idBd,
        idTableau,
        langue: "fra",
        nom: "Systèmes d'écriture",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.tableaux.suivreNoms({
          idStructure: idBd,
          idTableau,
          f: si((x) => x?.["fra"] !== "Alphabets"),
        }),
      );

      expect(noms.fra).to.equal("Systèmes d'écriture");
    });

    it("effacer un nom", async () => {
      await constl.bds.tableaux.effacerNom({
        idStructure: idBd,
        idTableau,
        langue: "fra",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.tableaux.suivreNoms({
          idStructure: idBd,
          idTableau,
          f: si((x) => !!x && !Object.keys(x).includes("fra")),
        }),
      );

      expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("données", function () {
    describe("colonnes", function () {
      let idBd: string;
      let idTableau: string;

      beforeEach(async () => {
        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
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
          idVariable,
        });
        const pColonnes = obtenir<InfoColonne[]>(({ si }) =>
          constl.bds.tableaux.suivreColonnes({
            idStructure: idBd,
            idTableau,
            f: si((cols) => !!cols?.find((c) => c.id !== idColonne)),
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
        };

        expect(await pColonnes).to.deep.equal([réf]);
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

      it.skip("déplacer colonne", async () => {
        const idCol1 = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        const idCol2 = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });

        /*await constl.bds.tableaux.réordonnerColonnes({
          idStructure: idBd,
          idTableau,
          idColonne: idCol1,
          position: 1,
        });*/
        const nouvellesColonnes = await obtenir<InfoColonne[]>(({ si }) =>
          constl.bds.tableaux.suivreColonnes({
            idStructure: idBd,
            idTableau,
            f: si((colonnes) => colonnes?.[0].id !== idCol1),
          }),
        );

        const réf: InfoColonne[] = [{ id: idCol2 }, { id: idCol1 }];
        // Pas `to.have.deep.members`, afin de confirmer l'ordre
        expect(nouvellesColonnes).to.deep.equal(réf);
      });
    });

    describe("variables", function () {
      let idBd: string;
      let idTableau: string;

      beforeEach(async () => {
        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
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
      let idBd: string;
      let idTableau: string;

      let idColChaîne: string;
      let idColNumérique: string;

      beforeEach(async () => {
        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
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
              (d) =>
                !!d?.find(
                  (x) => !Object.keys(x.données).includes(idColNumérique),
                ),
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
              (d) =>
                !!d?.find((x) =>
                  Object.keys(x.données).includes(idColNumérique),
                ),
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
              (d) =>
                !!d?.find((x) => !Object.keys(x.données).includes(idColChaîne)),
            ),
          }),
        );
        await constl.bds.tableaux.effacerColonne({
          idStructure: idBd,
          idTableau,
          idColonne: idColChaîne,
        });

        const réf: DonnéesRangéeTableauAvecId[] = [
          { id: idÉlément, données: { [idColNumérique]: 123.456 } },
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
              (d) =>
                !!d?.find((x) => Object.keys(x.données).includes(idColChaîne)),
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
            données: { [idColChaîne]: "வணக்கம்", [idColNumérique]: 123.456 },
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

        const pDonnées = obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            clefsSelonVariables: true,
            f: si(
              (d) =>
                !!d?.find(
                  (x) =>
                    Object.keys(x.données).length === 2 &&
                    !Object.keys(x.données).includes(idColNumérique),
                ),
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

        await constl.bds.tableaux.modifierIndexColonne({
          idStructure: idBd,
          idTableau,
          idColonne: idColChaîne,
          index: true,
        });

        const erreurs = await obtenir<ErreurDonnée[]>(({ siPasVide }) =>
          constl.bds.tableaux.suivreValidDonnées({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
        );

        const idRègle = (
          await obtenir<RègleColonne[]>(({ si }) =>
            constl.bds.tableaux.suivreRègles({
              idStructure: idBd,
              idTableau,
              f: si(
                (x) => !!x?.find((r) => r.règle.règle.type === "indexUnique"),
              ),
            }),
          )
        ).find((r) => r.règle.règle.type === "indexUnique")?.règle.id;

        const réf: ErreurDonnée<RègleIndexUnique>[] = idsÉléments.map((id) => ({
          id,
          erreur: {
            règle: {
              id: idRègle!,
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
        const idRègle = await constl.variables.ajouterRègle({
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

    describe("règles", function () {
      describe("général", function () {
        let idBd: string;
        let idTableau: string;
        let idColonne: string;
        let idRègle: string;

        before(async () => {
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
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
          const idRègle = await constl.variables.ajouterRègle({
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
          expect(règles.find((r) => r.règle.id === idRègle)).to.deep.equal(réf);
        });
      });

      describe("catégories", function () {
        let idBd: string;
        let idTableau: string;
        let idColonne: string;
        let idRègle: string;
        let idVariable: string;

        before(async () => {
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
          idColonne = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
        });

        it("ajout variable", async () => {
          idVariable = await constl.variables.créerVariable({
            catégorie: "numérique",
          });
          await constl.bds.tableaux.modifierVariableColonne({
            idStructure: idBd,
            idTableau,
            idColonne,
            idVariable,
          });
          const règles = await obtenir<RègleColonne[]>(({ si }) =>
            constl.bds.tableaux.suivreRègles({
              idStructure: idBd,
              idTableau,
              f: si(
                (x) => !!x?.find((r) => r.règle.règle.type === "catégorie"),
              ),
            }),
          );
          idRègle = règles.find((r) => r.règle.règle.type === "catégorie")!
            .règle.id;

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
              source: { type: "variable", id: idVariable },
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
                  [idColonne]: "123",
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
                        catégorie: "numérique",
                      },
                    },
                  },
                },
                source: { type: "variable", id: idVariable },
                colonne: idColonne,
              },
            },
          ];
          expect(erreurs).to.have.deep.members(réf);
        });
      });

      describe("bornes relatives colonne", function () {
        let idBd: string;
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
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
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
                colonne: idColonneTempMax,
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
        let idBd: string;
        let idTableau: string;
        let idColonneTempMax: string;

        beforeEach(async () => {
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
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
        let idBd: string;
        let idTableau: string;
        let idColonne: string;
        let idRègle: string;

        const règle: RègleValeurCatégorique = {
          type: "valeurCatégorique",
          détails: { type: "fixe", options: ["வணக்கம்", "សួស្តើ"] },
        };

        before(async () => {
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
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
        let idBd: string;
        let idTableau: string;
        let idColonne: string;
        let idRègle: string;

        let règle: RègleValeurCatégorique<DétailsRègleValeurCatégoriqueDynamique>;

        const idTableauValide = "valide";
        const idColonnePermises = "permises";

        before(async () => {
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
          idColonne = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
          règle = {
            type: "valeurCatégorique",
            détails: {
              type: "dynamique",
              structure: idBd,
              tableau: idTableauValide,
              colonne: idColonnePermises,
            },
          };
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
                (x) => !!x?.find((e) => e.type === "colonneCatégInexistante"),
              ),
            }),
          );
          const réf: ErreurRègle[] = [
            {
              type: "colonneCatégInexistante",
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

          const erreurs = await obtenir<ErreurDonnée[]>(({ siVide }) =>
            constl.bds.tableaux.suivreValidDonnées({
              idStructure: idBd,
              idTableau,
              f: siVide(),
            }),
          );
          expect(erreurs).to.be.empty();
        });
      });
    });

    describe("importation", function () {
      let idBd: string;
      let idTableau: string;

      const idColonneDate = "Date";
      const idColonneEndroit = "Endroit";
      const idColonneTempMin = "Température minimale";

      const ici = [11.010353745293981, 76.93447944133268];
      const là = [16.534768942113885, 80.79302512863033];

      const élémentsBase = [
        {
          [idColonneEndroit]: ici,
          [idColonneDate]: {
            système: "dateJS",
            val: new Date("2021-01-01").valueOf(),
          },
          [idColonneTempMin]: 25,
        },
        {
          [idColonneEndroit]: ici,
          [idColonneDate]: {
            système: "dateJS",
            val: new Date("2021-01-02").valueOf(),
          },
          [idColonneTempMin]: 25,
        },
        {
          [idColonneEndroit]: là,
          [idColonneDate]: {
            système: "dateJS",
            val: new Date("2021-01-01").valueOf(),
          },
          [idColonneTempMin]: 25,
        },
      ];

      beforeEach(async () => {
        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
        idTableau = await constl.bds.ajouterTableau({ idBd });
        await Promise.all(
          [idColonneDate, idColonneEndroit, idColonneTempMin].map(
            async (idColonne) =>
              await constl.bds.tableaux.ajouterColonne({
                idStructure: idBd,
                idTableau,
                idColonne,
              }),
          ),
        );

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
      });

      it("importation éléments", async () => {
        const nouvellesDonnées: DonnéesRangéeTableau[] = [
          {
            [idColonneEndroit]: ici,
            [idColonneDate]: {
              système: "dateJS",
              val: new Date("2021-01-01").valueOf(),
            },
            [idColonneTempMin]: 25,
          },
          {
            [idColonneEndroit]: ici,
            [idColonneDate]: {
              système: "dateJS",
              val: new Date("2021-01-02").valueOf(),
            },
            [idColonneTempMin]: 27,
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
                !x.some(
                  (d) =>
                    (d.données["endroit"] as number[] | undefined)?.[0] ===
                    là[0],
                ),
            ),
          }),
        );
        expect(données.map((d) => d.données)).to.deep.equal(nouvellesDonnées);
      });
    });

    describe("conversions", function () {
      const géojson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [102.0, 0.5] },
            properties: { prop0: "value0" },
          },
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [102.0, 0.0],
                [103.0, 1.0],
                [104.0, 0.0],
                [105.0, 1.0],
              ],
            },
            properties: {
              prop0: "value0",
              prop1: 0.0,
            },
          },
        ],
      };

      it("colonne non spécifiée n'est pas ignorée", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ numérique: "123", chaîne: "নমস্কার" }],
          conversions: [
            {
              colonne: "numérique",
              conversion: { type: "numérique" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            numérique: 123,
            chaîne: "নমস্কার",
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("numérique - chiffre", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ numérique: 123 }],
          conversions: [],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            numérique: 123,
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("numérique - chiffre format texte", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ numérique: "123" }],
          conversions: [
            { colonne: "numérique", conversion: { type: "numérique" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            numérique: 123,
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("numérique - système d'écriture", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ numérique: "১২৩" }],
          conversions: [
            {
              colonne: "numérique",
              conversion: { type: "numérique", systèmeNumération: "বাংলা" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            numérique: 123,
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("numérique - système d'écriture non spécifié", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ numérique: "௱௨௰௩" }],
          conversions: [
            { colonne: "numérique", conversion: { type: "numérique" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            numérique: 123,
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("numérique - opérations", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ numérique: 101 }],
          conversions: [
            {
              colonne: "numérique",
              conversion: {
                type: "numérique",
                opération: [
                  { op: "-", val: 32 },
                  { op: "*", val: 5 / 9 },
                ],
              },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            numérique: 38 + 1 / 3,
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("numérique - invalide", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ numérique: "abc", chaîne: "abc" }],
          conversions: [
            { colonne: "numérique", conversion: { type: "numérique" } },
            { colonne: "chaîne", conversion: { type: "chaîne" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            chaîne: "abc",
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("numérique - non définie", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ chaîne: "abc", numérique: undefined }],
          conversions: [
            { colonne: "numérique", conversion: { type: "numérique" } },
            { colonne: "chaîne", conversion: { type: "chaîne" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            chaîne: "abc",
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("chaîne - texte", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ chaîne: "abc" }],
          conversions: [{ colonne: "chaîne", conversion: { type: "chaîne" } }],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            chaîne: "abc",
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("chaîne - traduction existante", async () => {
        const idTexte = uuidv4();
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ chaîne: idTexte }],
          conversions: [{ colonne: "chaîne", conversion: { type: "chaîne" } }],
          traductions: { [idTexte]: { fra: "riz" } },
        });
        const réf: DonnéesRangéeTableau[] = [
          {
            chaîne: idTexte,
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("chaîne - traduction non existante", async () => {
        const idTexte = uuidv4();
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ chaîne: idTexte }],
          conversions: [{ colonne: "chaîne", conversion: { type: "chaîne" } }],
        });
        const réf: DonnéesRangéeTableau[] = [
          {
            chaîne: idTexte,
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("chaîne - retrouver traduction existante", async () => {
        const idTexte = uuidv4();
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ chaîne: "riz" }],
          conversions: [{ colonne: "chaîne", conversion: { type: "chaîne" } }],
          traductions: { [idTexte]: { fra: "riz" } },
        });
        const réf: DonnéesRangéeTableau[] = [
          {
            chaîne: idTexte,
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("chaîne - spécifier langue traduction existante", async () => {
        const idTexte = uuidv4();
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ chaîne: "arròs" }],
          conversions: [
            {
              colonne: "chaîne",
              conversion: { type: "chaîne", langue: "ctl" },
            },
          ],
          traductions: { [idTexte]: { fra: "riz", ctl: "arròs" } },
        });
        const réf: DonnéesRangéeTableau[] = [
          {
            chaîne: idTexte,
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("chaîne - spécifier langue traduction non existante", async () => {
        const { converties, traductions } =
          await constl.bds.tableaux.convertirDonnées({
            données: [{ chaîne: "நெல்" }],
            conversions: [
              {
                colonne: "chaîne",
                conversion: { type: "chaîne", langue: "த" },
              },
            ],
          });
        const réf: DonnéesRangéeTableau[] = [
          {
            chaîne: "நெல்",
          },
        ];
        expect(converties).to.have.deep.members(réf);

        // Vérifier nouvelles traductions bien identifiées
        expect(traductions).to.deep.equal({
          நெல்: { த: "நெல்" },
        });
      });

      it("chaîne - non définie", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ chaîne: undefined }],
          conversions: [{ colonne: "chaîne", conversion: { type: "chaîne" } }],
        });

        const réf: DonnéesRangéeTableau[] = [{}];
        expect(converties).to.have.deep.members(réf);
      });

      it("booléenne - booléenne", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ booléenne: true }, { booléenne: false }],
          conversions: [
            { colonne: "booléenne", conversion: { type: "booléen" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            booléenne: true,
          },
          {
            booléenne: false,
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("booléenne - numérique", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ booléenne: 0 }, { booléenne: 1 }, { booléenne: 2 }],
          conversions: [
            { colonne: "booléenne", conversion: { type: "booléen" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            booléenne: false,
          },
          {
            booléenne: true,
          },
          {},
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("booléenne - texte", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [
            { booléenne: "faux" },
            { booléenne: "vrai" },
            { booléenne: "peut-être" },
          ],
          conversions: [
            { colonne: "booléenne", conversion: { type: "booléen" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            booléenne: false,
          },
          {
            booléenne: true,
          },
          {},
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("booléenne - non définie", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ booléenne: true }, { booléenne: undefined }],
          conversions: [
            { colonne: "booléenne", conversion: { type: "booléen" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            booléenne: true,
          },
          {},
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("booléenne - invalide", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ booléenne: { a: 1 } }],
          conversions: [
            { colonne: "booléenne", conversion: { type: "booléen" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{}];
        expect(converties).to.have.deep.members(réf);
      });

      describe("fichier", function () {
        let dossier: string;
        let effacer: () => void;

        let mock: typeof AxiosMockAdapter;
        let LOGO: Uint8Array;
        let idc: string;

        before(async () => {
          LOGO = await obtRessourceTest({
            nomFichier: "logo.svg",
          });
          idc = await constl.services["hélia"].ajouterFichierÀSFIP({
            contenu: LOGO,
            nomFichier: "logo.svg",
          });

          mock = new AxiosMockAdapter(axios);
          mock
            .onGet("https://test.réseau-constellation.ca/logo.svg")
            .reply(200, LOGO);
          mock
            .onGet("https://test.réseau-constellation.ca/inexistant.svg")
            .reply(404);

          if (isElectronMain || isNode) {
            ({ dossier, effacer } = await dossierTempo());
            mkdirSync(join(dossier, "médias"));
            writeFileSync(join(dossier, "médias/logo.svg"), LOGO);
          }
        });

        after(async () => {
          if (mock) mock.restore();
          if (effacer) effacer();
        });

        it("chaîne - fichier local", async () => {
          if (isElectronMain || isNode) {
            const { converties } = await constl.bds.tableaux.convertirDonnées({
              données: [{ fichier: "logo.svg" }],
              conversions: [
                {
                  colonne: "fichier",
                  conversion: {
                    type: "fichier",
                    baseChemin: join(dossier, "médias"),
                  },
                },
              ],
            });

            // Sera vide sur le navigateur
            const réf: DonnéesRangéeTableau[] =
              isElectronMain || isNode ? [{ fichier: idc }] : [{}];
            expect(converties).to.have.deep.members(réf);
          }
        });

        it("chaîne - fichier non existant", async () => {
          const { converties } = await constl.bds.tableaux.convertirDonnées({
            données: [{ fichier: "n'existe pas.svg" }],
            conversions: [
              {
                colonne: "fichier",
                conversion: { type: "fichier", baseChemin: "médias" },
              },
            ],
          });

          const réf: DonnéesRangéeTableau[] = [{}];
          expect(converties).to.have.deep.members(réf);
        });

        it("chaîne - adresse url", async () => {
          const { converties } = await constl.bds.tableaux.convertirDonnées({
            données: [
              { fichier: "https://test.réseau-constellation.ca/logo.svg" },
            ],
            conversions: [
              { colonne: "fichier", conversion: { type: "fichier" } },
            ],
          });

          const réf: DonnéesRangéeTableau[] = [{ fichier: idc }];
          expect(converties).to.have.deep.members(réf);
        });

        it("chaîne - adresse url indisponible", async () => {
          const { converties } = await constl.bds.tableaux.convertirDonnées({
            données: [
              {
                fichier: "https://test.réseau-constellation.ca/inexistant.svg",
              },
            ],
            conversions: [
              { colonne: "fichier", conversion: { type: "fichier" } },
            ],
          });

          const réf: DonnéesRangéeTableau[] = [{}];
          expect(converties).to.have.deep.members(réf);
        });

        it("objet - contenu fichier", async () => {
          const { converties } = await constl.bds.tableaux.convertirDonnées({
            données: [{ fichier: { contenu: LOGO, nomFichier: "logo.svg" } }],
            conversions: [
              { colonne: "fichier", conversion: { type: "fichier" } },
            ],
          });

          const réf: DonnéesRangéeTableau[] = [{ fichier: idc }];
          expect(converties).to.have.deep.members(réf);
        });

        it("objet - invalide", async () => {
          const { converties } = await constl.bds.tableaux.convertirDonnées({
            données: [{ fichier: { contenu: LOGO } }],
            conversions: [
              { colonne: "fichier", conversion: { type: "fichier" } },
            ],
          });

          const réf: DonnéesRangéeTableau[] = [{}];
          expect(converties).to.have.deep.members(réf);
        });

        it("invalide", async () => {
          const { converties } = await constl.bds.tableaux.convertirDonnées({
            données: [{ fichier: 123 }],
            conversions: [
              { colonne: "fichier", conversion: { type: "fichier" } },
            ],
          });

          const réf: DonnéesRangéeTableau[] = [{}];
          expect(converties).to.have.deep.members(réf);
        });
      });

      it("chaîneNonTraductible - texte", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ chaîne: "abc" }],
          conversions: [
            {
              colonne: "chaîne",
              conversion: { type: "chaîneNonTraductible" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            chaîne: "abc",
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("chaîneNonTraductible - objet", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ chaîne: { une: { valeur: "texte" } } }],
          conversions: [
            {
              colonne: "chaîne",
              conversion: { type: "chaîneNonTraductible" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            chaîne: '{"une":{"valeur":"texte"}}',
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("chaîneNonTraductible - numérique", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ chaîne: 123 }],
          conversions: [
            {
              colonne: "chaîne",
              conversion: { type: "chaîneNonTraductible" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            chaîne: "123",
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("chaîneNonTraductible - non définie", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ chaîne: undefined }],
          conversions: [
            {
              colonne: "chaîne",
              conversion: { type: "chaîneNonTraductible" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{}];
        expect(converties).to.have.deep.members(réf);
      });

      it("horoDatage - chaîne", async () => {
        const maintenant = new Date();
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ date: maintenant.toISOString() }],
          conversions: [
            { colonne: "date", conversion: { type: "horoDatage" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          { date: { système: "dateJS", val: maintenant.getTime() } },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("horoDatage - numéro", async () => {
        const maintenant = new Date().getTime();
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ date: maintenant }],
          conversions: [
            { colonne: "date", conversion: { type: "horoDatage" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          { date: { système: "dateJS", val: maintenant } },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("horoDatage - date", async () => {
        const maintenant = new Date();
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ date: maintenant }],
          conversions: [
            { colonne: "date", conversion: { type: "horoDatage" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          { date: { système: "dateJS", val: maintenant.getTime() } },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("horoDatage - chaîne invalide", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ date: "ceci n'est pas une date" }],
          conversions: [
            { colonne: "date", conversion: { type: "horoDatage" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{}];
        expect(converties).to.have.deep.members(réf);
      });

      it("horoDatage - type invalide", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ date: true }],
          conversions: [
            { colonne: "date", conversion: { type: "horoDatage" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{}];
        expect(converties).to.have.deep.members(réf);
      });

      it("intervaleTemps - liste de dates", async () => {
        const maintenant = new Date();
        const hier = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000 * 5);
        const intervale = [hier, maintenant];

        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ intervale }],
          conversions: [
            {
              colonne: "intervale",
              conversion: { type: "intervaleTemps" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            intervale: [
              { système: "dateJS", val: hier.getTime() },
              { système: "dateJS", val: maintenant.getTime() },
            ],
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("intervaleTemps - texte", async () => {
        const maintenant = new Date();
        const hier = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000);
        const intervale = [hier, maintenant];

        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ intervale: JSON.stringify(intervale) }],
          conversions: [
            {
              colonne: "intervale",
              conversion: { type: "intervaleTemps" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          {
            intervale: [
              { système: "dateJS", val: hier.getTime() },
              { système: "dateJS", val: maintenant.getTime() },
            ],
          },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("intervaleTemps - json texte invalide", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ intervale: "Je ne suis pas du JSON" }],
          conversions: [
            {
              colonne: "intervale",
              conversion: { type: "intervaleTemps" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{}];
        expect(converties).to.have.deep.members(réf);
      });

      it("intervaleTemps - dates texte invalide", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [
            { intervale: [new Date().toString(), "Je ne suis pas une date"] },
          ],
          conversions: [
            {
              colonne: "intervale",
              conversion: { type: "intervaleTemps" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{}];
        expect(converties).to.have.deep.members(réf);
      });

      it("intervaleTemps - trop court", async () => {
        const maintenant = new Date();
        const intervale = [maintenant];

        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ intervale: JSON.stringify(intervale) }],
          conversions: [
            {
              colonne: "intervale",
              conversion: { type: "intervaleTemps" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{}];
        expect(converties).to.have.deep.members(réf);
      });

      it("intervaleTemps - trop long", async () => {
        const maintenant = new Date();
        const hier = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000);
        const demain = new Date(maintenant.getTime() + 24 * 60 * 60 * 1000);
        const intervale = [hier, maintenant, demain];

        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ intervale: JSON.stringify(intervale) }],
          conversions: [
            {
              colonne: "intervale",
              conversion: { type: "intervaleTemps" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{}];
        expect(converties).to.have.deep.members(réf);
      });

      it("intervaleTemps - type invalide", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ intervale: { valeur: "invalide" } }],
          conversions: [
            {
              colonne: "intervale",
              conversion: { type: "intervaleTemps" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{}];
        expect(converties).to.have.deep.members(réf);
      });

      it("géojson - valide", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ géojson }],
          conversions: [
            { colonne: "géojson", conversion: { type: "géojson" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          { géojson: géojson as DonnéesRangéeTableau },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("géojson - texte", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ géojson: JSON.stringify(géojson) }],
          conversions: [
            { colonne: "géojson", conversion: { type: "géojson" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [
          { géojson: géojson as DonnéesRangéeTableau },
        ];
        expect(converties).to.have.deep.members(réf);
      });

      it("géojson - texte - json invalide", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ géojson: "je ne suis pas du json" }],
          conversions: [
            { colonne: "géojson", conversion: { type: "géojson" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{}];
        expect(converties).to.have.deep.members(réf);
      });

      it("géojson - type non valide", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ géojson: 123 }],
          conversions: [
            { colonne: "géojson", conversion: { type: "géojson" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{}];
        expect(converties).to.have.deep.members(réf);
      });

      it("géojson - non définie", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ géojson: undefined }],
          conversions: [
            { colonne: "géojson", conversion: { type: "géojson" } },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{}];
        expect(converties).to.have.deep.members(réf);
      });

      it("liste", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ listeNumérique: [1, 2, 3] }],
          conversions: [
            {
              colonne: "listeNumérique",
              typeCatégorie: "liste",
              conversion: { type: "numérique" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{ listeNumérique: [1, 2, 3] }];
        expect(converties).to.have.deep.members(réf);
      });

      it("liste - texte", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ listeNumérique: "[1, 2, 3]" }],
          conversions: [
            {
              colonne: "listeNumérique",
              typeCatégorie: "liste",
              conversion: { type: "numérique" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{ listeNumérique: [1, 2, 3] }];
        expect(converties).to.have.deep.members(réf);
      });

      it("liste - texte JSON invalide", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ listeNumérique: "Je ne suis pas du json." }],
          conversions: [
            {
              colonne: "listeNumérique",
              typeCatégorie: "liste",
              conversion: { type: "numérique" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{ listeNumérique: [] }];
        expect(converties).to.have.deep.members(réf);
      });

      it("liste - valeur non liste", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ listeNumérique: 123 }],
          conversions: [
            {
              colonne: "listeNumérique",
              typeCatégorie: "liste",
              conversion: { type: "numérique" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{ listeNumérique: [123] }];
        expect(converties).to.have.deep.members(réf);
      });

      it("liste - une valeur invalide", async () => {
        const { converties } = await constl.bds.tableaux.convertirDonnées({
          données: [{ listeNumérique: [123, "abc"] }],
          conversions: [
            {
              colonne: "listeNumérique",
              typeCatégorie: "liste",
              conversion: { type: "numérique" },
            },
          ],
        });

        const réf: DonnéesRangéeTableau[] = [{ listeNumérique: [123] }];
        expect(converties).to.have.deep.members(réf);
      });
    });

    describe("exportation", function () {
      describe("suivi données", async () => {
        let idBd: string;
        let idTableau: string;

        const idColonneEndroit = "endroit";
        const idColonneDate = "date";
        const idColonneTempératureMinimale = "températureMinimale";
        const idColonneImage = "image";

        const éléments: DonnéesRangéeTableau[] = [
          {
            [idColonneDate]: new Date().getTime(),
            [idColonneEndroit]: "ici",
            [idColonneTempératureMinimale]: -17,
            [idColonneImage]:
              "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/image.jpeg",
          },
        ];
        const documentsMédias = éléments.map((é) => é[idColonneImage]);

        before(async () => {
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
          await Promise.all(
            [
              idColonneDate,
              idColonneEndroit,
              idColonneTempératureMinimale,
              idColonneImage,
            ].map(
              async (idColonne) =>
                await constl.bds.tableaux.ajouterColonne({
                  idStructure: idBd,
                  idTableau,
                  idColonne,
                }),
            ),
          );
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments,
          });
        });

        it("langues nom tableau - nom indisponible", async () => {
          await constl.bds.tableaux.sauvegarderNom({
            idStructure: idBd,
            idTableau,
            langue: "fra",
            nom: "tableau",
          });
          const données = await obtenir<DonnéesTableauExportées>(
            ({ siDéfini }) =>
              constl.bds.tableaux.suivreDonnéesExportation({
                idStructure: idBd,
                idTableau,
                langues: ["cst"],
                f: siDéfini(),
              }),
          );
          expect(données.nomTableau).to.equal("tableau");
        });

        it("langues nom tableau - nom disponible", async () => {
          await constl.bds.tableaux.sauvegarderNom({
            idStructure: idBd,
            idTableau,
            langue: "cst",
            nom: "tabla",
          });
          const données = await obtenir<DonnéesTableauExportées>(({ si }) =>
            constl.bds.tableaux.suivreDonnéesExportation({
              idStructure: idBd,
              idTableau,
              langues: ["cst"],
              f: si((x) => !!x?.nomTableau && x?.nomTableau !== "tableau"),
            }),
          );
          expect(données.nomTableau).to.equal("tabla");
        });

        it("langues noms colonnes", async () => {
          const idVariableDate = await constl.variables.créerVariable({
            catégorie: "horoDatage",
          });
          await constl.bds.tableaux.modifierVariableColonne({
            idStructure: idBd,
            idTableau,
            idColonne: idColonneDate,
            idVariable: idVariableDate,
          });
          await constl.variables.sauvegarderNom({
            idVariable: idVariableDate,
            langue: "cst",
            nom: "fecha",
          });
          const données = await obtenir<DonnéesTableauExportées>(({ si }) =>
            constl.bds.tableaux.suivreDonnéesExportation({
              idStructure: idBd,
              idTableau,
              langues: ["fra"],
              f: si((x) => !!x && !Object.keys(x.données[0]).includes("date")),
            }),
          );
          expect(Object.keys(données.données[0])).to.include("fecha");
        });

        it("id tableau", async () => {
          const données = await obtenir<DonnéesTableauExportées>(
            ({ siDéfini }) =>
              constl.bds.tableaux.suivreDonnéesExportation({
                idStructure: idBd,
                idTableau,
                f: siDéfini(),
              }),
          );
          expect(données.nomTableau).to.equal(idTableau);
        });

        it("id colonnes", async () => {
          const données = await obtenir<DonnéesTableauExportées>(
            ({ siDéfini }) =>
              constl.bds.tableaux.suivreDonnéesExportation({
                idStructure: idBd,
                idTableau,
                f: siDéfini(),
              }),
          );
          expect(Object.keys(données.données[0])).to.include(idColonneDate);
        });

        it("données", async () => {
          const données = await obtenir<DonnéesTableauExportées>(({ si }) =>
            constl.bds.tableaux.suivreDonnéesExportation({
              idStructure: idBd,
              idTableau,
              f: si((x) => !!x && Object.keys(x.données[0]).length >= 4),
            }),
          );
          expect(données.données).to.have.deep.members(éléments);
        });

        it("données - langues variable chaîne", async () => {
          // Créer une bd uniquement pour ce test différent
          const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          const idTableau = await constl.bds.ajouterTableau({ idBd });

          const idColonneChaîne = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });

          const clefMante = uuidv4();
          const clefCoccinelle = uuidv4();
          const clefAraignée = uuidv4();

          await constl.bds.tableaux.ajouterTraductionsValeur({
            idStructure: idBd,
            idTableau,
            clef: clefMante,
            traducs: {
              fra: "Mante religieuse",
              த: "தொழுவன் பூச்சி",
              മ: "പച്ചത്തൊഴുംപ്രാണി",
              漢: "薄翅螳",
            },
          });
          await constl.bds.tableaux.ajouterTraductionsValeur({
            idStructure: idBd,
            idTableau,
            clef: clefCoccinelle,
            traducs: { fra: "Coccinelle", த: "பொறிவண்டு" },
          });

          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              { [idColonneChaîne]: clefMante },
              { [idColonneChaîne]: clefCoccinelle },
              { [idColonneChaîne]: clefAraignée },
            ],
          });

          const donnéesFrançais = await obtenir<DonnéesTableauExportées>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnéesExportation({
                idStructure: idBd,
                idTableau,
                langues: ["fra"],
                f: si((x) => !!x && x?.données.length >= 3),
              }),
          );
          const réfFrançais: DonnéesRangéeTableau[] = [
            {
              [idColonneChaîne]: "Mante religieuse",
            },
            {
              [idColonneChaîne]: "Coccinelle",
            },
            {
              [idColonneChaîne]: clefAraignée,
            },
          ];
          expect(donnéesFrançais.données).to.have.deep.members(réfFrançais);

          const données_മലയാളം = await obtenir<DonnéesTableauExportées>(
            ({ si }) =>
              constl.bds.tableaux.suivreDonnéesExportation({
                idStructure: idBd,
                idTableau,
                langues: ["മ", "fra"],
                f: si((x) => !!x && x?.données.length >= 3),
              }),
          );
          const réf_മലയാളം: DonnéesRangéeTableau[] = [
            {
              [idColonneChaîne]: "പച്ചത്തൊഴുംപ്രാണി",
            },
            {
              [idColonneChaîne]: "Coccinelle",
            },
            {
              [idColonneChaîne]: clefAraignée,
            },
          ];
          expect(données_മലയാളം.données).to.have.deep.members(réf_മലയാളം);
        });

        it("fichier", async () => {
          const données = await obtenir<DonnéesTableauExportées>(({ si }) =>
            constl.bds.tableaux.suivreDonnéesExportation({
              idStructure: idBd,
              idTableau,
              f: si((x) => !!x && x.documentsMédias.size > 0),
            }),
          );
          expect([...données.documentsMédias]).to.have.members(documentsMédias);
        });
      });

      describe("à document", function () {
        let idBd: string;
        let idTableau: string;

        let données: DonnéesFichierBdExportées;

        const nomTableauFr = "Tableau test";

        const idsColonnes: { [clef in CatégorieBaseVariables]?: string } = {};
        const catégories: CatégorieBaseVariables[] = [
          "audio",
          "booléen",
          "chaîne",
          "chaîneNonTraductible",
          "fichier",
          "géojson",
          "horoDatage",
          "image",
          "intervaleTemps",
          "numérique",
          "vidéo",
        ];
        const étiquettesColonnesDocu = [..."ABCDEFGHIJKL"];

        const obtenirValsDocu = (
          col: string,
          nomTableau: string,
          docu: WorkBook,
        ): DagCborEncodable[] => {
          const étiquette = étiquettesColonnesDocu.find(
            (c) => docu.Sheets[nomTableau][`${c}1`].v === col,
          );
          const vals: DagCborEncodable[] = [];

          let i = 1;
          while (i++) {
            const val =
              données.docu.Sheets[nomTableauFr][`${étiquette}${i}`]?.v;
            if (val === undefined) break;
            vals.push(val);
          }
          return vals;
        };

        const valDate = new Date().getTime();
        const valIntervaleTemps = [new Date().getTime(), new Date().getTime()];
        const valGéoJson: DagCborEncodable = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [102.0, 0.5] },
              properties: { prop0: "value0" },
            },
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [102.0, 0.0],
                  [103.0, 1.0],
                  [104.0, 0.0],
                  [105.0, 1.0],
                ],
              },
              properties: {
                prop0: "value0",
                prop1: 0.0,
              },
            },
          ],
        };

        before(async () => {
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });

          for (const catégorie of catégories) {
            idsColonnes[catégorie] = await constl.bds.tableaux.ajouterColonne({
              idStructure: idBd,
              idTableau,
            });
          }
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
            idColonne: "colonneListe",
          });

          const éléments: DonnéesRangéeTableau[] = [
            {
              [idsColonnes["numérique"]!]: 123,
              [idsColonnes["chaîneNonTraductible"]!]: "வணக்கம்",
              [idsColonnes["booléen"]!]: true,
              [idsColonnes["fichier"]!]:
                "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/fichier.mp4",
              [idsColonnes["audio"]!]:
                "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/audio.mp4",
              [idsColonnes["image"]!]:
                "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/image.jpeg",
              [idsColonnes["vidéo"]!]:
                "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/vidéo.mp4",
              [idsColonnes["chaîne"]!]: "du texte",
              [idsColonnes["géojson"]!]: valGéoJson,
              [idsColonnes["horoDatage"]!]: valDate,
              [idsColonnes["intervaleTemps"]!]: valIntervaleTemps,
              colonneListe: [1, 2, 3],
            },
            {
              [idsColonnes["numérique"]!]: 456,
            },
          ];
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments,
          });

          await constl.bds.tableaux.sauvegarderNoms({
            idStructure: idBd,
            idTableau,
            noms: {
              fra: nomTableauFr,
            },
          });

          données = await constl.bds.tableaux.exporterDonnées({
            idStructure: idBd,
            idTableau,
            langues: ["த", "fra"],
          });
        });

        it("nom fichier", async () => {
          expect(données.nomFichier).to.equal(nomTableauFr);
        });

        it("nom fichier spécifié", async () => {
          const donnéesAvecNomFichier =
            await constl.bds.tableaux.exporterDonnées({
              idStructure: idBd,
              idTableau,
              nomFichier: "mon fichier",
            });
          expect(donnéesAvecNomFichier.nomFichier).to.equal("mon fichier");
        });

        it("nom tableau", async () => {
          expect(données.docu.SheetNames[0]).to.equal(nomTableauFr);
        });

        it("noms colonnes", async () => {
          // Tous les noms de colonne devraient exister dans le document
          expect(
            étiquettesColonnesDocu.map(
              (c) =>
                (données.docu.Sheets[nomTableauFr][`${c}1`] as CellObject).v,
            ),
          ).to.have.members([...Object.values(idsColonnes), "colonneListe"]);
        });

        it("données numériques", async () => {
          const vals = obtenirValsDocu(
            idsColonnes["numérique"]!,
            nomTableauFr,
            données.docu,
          );
          expect(vals).to.have.deep.ordered.members([123, 456]);
        });

        it("données horoDatage", async () => {
          const vals = obtenirValsDocu(
            idsColonnes["horoDatage"]!,
            nomTableauFr,
            données.docu,
          );
          expect(vals).to.have.deep.ordered.members([valDate]);
        });

        it("données chaîne", async () => {
          const vals = obtenirValsDocu(
            idsColonnes["chaîne"]!,
            nomTableauFr,
            données.docu,
          );
          expect(vals).to.have.deep.ordered.members(["du texte"]);
        });

        it("données booléennes", async () => {
          const vals = obtenirValsDocu(
            idsColonnes["booléen"]!,
            nomTableauFr,
            données.docu,
          );
          expect(vals).to.have.deep.ordered.members(["vrai"]);
        });

        it("données fichiers", async () => {
          const vals = obtenirValsDocu(
            idsColonnes["fichier"]!,
            nomTableauFr,
            données.docu,
          );
          expect(vals).to.have.deep.ordered.members([
            "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/fichier.mp4",
          ]);
        });

        it("données audio", async () => {
          const vals = obtenirValsDocu(
            idsColonnes["audio"]!,
            nomTableauFr,
            données.docu,
          );
          expect(vals).to.have.deep.ordered.members([
            "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/audio.mp4",
          ]);
        });

        it("données chaîne non traductible", async () => {
          const vals = obtenirValsDocu(
            idsColonnes["chaîneNonTraductible"]!,
            nomTableauFr,
            données.docu,
          );
          expect(vals).to.have.deep.ordered.members(["வணக்கம்"]);
        });

        it("données géojson", async () => {
          const vals = obtenirValsDocu(
            idsColonnes["géojson"]!,
            nomTableauFr,
            données.docu,
          );
          expect(vals).to.have.deep.ordered.members([
            JSON.stringify(valGéoJson),
          ]);
        });

        it("données image", async () => {
          const vals = obtenirValsDocu(
            idsColonnes["image"]!,
            nomTableauFr,
            données.docu,
          );
          expect(vals).to.have.deep.ordered.members([
            "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/image.jpeg",
          ]);
        });

        it("données intervaleTemps", async () => {
          const vals = obtenirValsDocu(
            idsColonnes["intervaleTemps"]!,
            nomTableauFr,
            données.docu,
          );
          expect(
            vals.map((v) => JSON.parse(v as string)),
          ).to.have.deep.ordered.members([valIntervaleTemps]);
        });

        it("données vidéo", async () => {
          const vals = obtenirValsDocu(
            idsColonnes["vidéo"]!,
            nomTableauFr,
            données.docu,
          );
          expect(vals).to.have.deep.ordered.members([
            "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/vidéo.mp4",
          ]);
        });

        it("données variable catégorie liste", async () => {
          const vals = obtenirValsDocu(
            "colonneListe",
            nomTableauFr,
            données.docu,
          );
          expect(
            vals.map((v) => JSON.parse(v as string)),
          ).to.have.deep.ordered.members([[1, 2, 3]]);
        });

        it("fichiers sfip inclus", async () => {
          expect([...données.documentsMédias]).to.have.deep.members([
            "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/fichier.mp4",
            "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/image.jpeg",
            "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/vidéo.mp4",
            "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/audio.mp4",
          ]);
        });

        it("exporter sans noms", async () => {
          const { docu } = await constl.bds.tableaux.exporterDonnées({
            idStructure: idBd,
            idTableau,
          });

          const idTableauCourt = idTableau.split("/").pop()!.slice(0, 30);

          expect(docu.SheetNames[0]).to.equal(idTableauCourt);

          expect(
            étiquettesColonnesDocu.map(
              (c) =>
                (données.docu.Sheets[nomTableauFr][`${c}1`] as CellObject).v,
            ),
          ).to.have.members([...Object.values(idsColonnes), "colonneListe"]);
        });
      });

      describe("à fichier", function () {
        let idBd: string;
        let idTableau: string;

        let idc: string;

        let dossier: string;
        let effacer: () => void;

        const nomTableauFr = "voici un tableau";

        before(async () => {
          idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
          idTableau = await constl.bds.ajouterTableau({ idBd });
          await constl.bds.tableaux.sauvegarderNom({
            idStructure: idBd,
            idTableau,
            langue: "fra",
            nom: nomTableauFr,
          });

          const octets = await obtRessourceTest({
            nomFichier: "logo.svg",
          });
          idc = await constl.services["hélia"].ajouterFichierÀSFIP({
            contenu: octets,
            nomFichier: "logo.svg",
          });

          const idColonne = await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau,
          });
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [{ [idColonne]: idc }],
          });
        });

        beforeEach(async () => {
          ({ dossier, effacer } = await dossierTempo());
        });

        afterEach(async () => {
          if (effacer) effacer();
        });

        it("exporter document sans fichiers sfip", async () => {
          const fichier = await constl.bds.tableaux.exporterDonnéesÀFichier({
            idStructure: idBd,
            idTableau,
            dossier,
            formatDocu: "ods",
            langues: ["fra"],
            inclureDocuments: false,
          });
          if (isBrowser || isElectronRenderer) {
            expect(fichier).to.equal("voici un tableau.ods");
          } else {
            const cheminFichier = join(dossier, `${nomTableauFr}.ods`);
            expect(fichier).to.equal(cheminFichier);
            expect(existsSync(cheminFichier)).to.be.true();
          }
        });

        it("exporter document zip avec fichiers sfip", async () => {
          if (isBrowser || isElectronRenderer) return;

          await constl.bds.tableaux.exporterDonnéesÀFichier({
            idStructure: idBd,
            idTableau,
            dossier,
            formatDocu: "ods",
            langues: ["fra"],
            inclureDocuments: true,
          });
          const cheminFichier = join(dossier, `${nomTableauFr}.zip`);
          expect(existsSync(cheminFichier)).to.be.true();

          // Le fichier ZIP est valide
          const zip = await JSZip.loadAsync(readFileSync(cheminFichier));

          // Le document des données existe
          expect(zip.files[nomTableauFr + ".ods"]).to.exist();

          // Le dossier pour les données SFIP existe
          expect(zip.files["médias/"]?.dir).to.be.true();

          // Les fichiers SFIP existent
          expect(
            zip.files[["médias", idc.replace("/", "-")].join("/")],
          ).to.exist();
        });

        it("dossier auparavant inexistant - sans fichiers sfip", async () => {
          if (isBrowser || isElectronRenderer) return;

          const nouveauDossier = join(dossier, "plus", "profond");

          await constl.bds.tableaux.exporterDonnéesÀFichier({
            idStructure: idBd,
            idTableau,
            dossier: nouveauDossier,
            formatDocu: "ods",
            langues: ["fra"],
            inclureDocuments: false,
          });

          const cheminFichier = join(nouveauDossier, `${nomTableauFr}.ods`);
          expect(existsSync(cheminFichier)).to.be.true();
        });

        it("dossier auparavant inexistant - avec fichiers sfip", async () => {
          if (isBrowser || isElectronRenderer) return;

          const nouveauDossier = join(dossier, "plus", "profond");

          await constl.bds.tableaux.exporterDonnéesÀFichier({
            idStructure: idBd,
            idTableau,
            dossier: nouveauDossier,
            formatDocu: "ods",
            langues: ["fra"],
          });

          const cheminFichier = join(nouveauDossier, `${nomTableauFr}.zip`);
          expect(existsSync(cheminFichier)).to.be.true();
        });
      });
    });

    describe("variables indisponibles", function () {
      let idBd: string;
      let idTableau: string;
      let idColonne: string;

      const idVariableIndisponible =
        "/constl/variables/orbitdb/zdpuAximNmZyUWXGCaLmwSEGDeWmuqfgaoogA7KNSa1B2DAAF";

      before(async () => {
        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
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
            // Catégorie absente et indisponible car variable non accessible
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
        expect(données).to.have.deep.members(réf);
      });
    });

    describe("combiner données", function () {
      let idBd: string;

      let idTableauDestinataire: string;
      let idTableauSource: string;

      const idColonneDate = "Date";
      const idColonneEndroit = "Endroit";
      const idColonneTempMin = "Température minimale";
      const idColonneTempMax = "Température maximale";

      const ici = [11.010353745293981, 76.93447944133268];
      const là = [16.534768942113885, 80.79302512863033];
      const quelquePart = [14.782883663386926, -91.14748363253622];

      const uneDate = new Date("2021-01-01").getTime();
      const unJour = new Date("2021-01-02").getTime();
      const uneAutreJournée = new Date("2021-01-03").getTime();

      const combinerDonnées = async () => {
        return await constl.bds.tableaux.combinerDonnées({
          de: {
            idStructure: idBd,
            idTableau: idTableauSource,
          },
          à: {
            idStructure: idBd,
            idTableau: idTableauDestinataire,
          },
        });
      };

      const élémentsDestinataire = [
        {
          [idColonneEndroit]: ici,
          [idColonneDate]: uneDate,
          [idColonneTempMin]: 25,
        },
        {
          [idColonneEndroit]: ici,
          [idColonneDate]: uneAutreJournée,
          [idColonneTempMin]: 25,
        },
        {
          [idColonneEndroit]: là,
          [idColonneDate]: uneDate,
          [idColonneTempMin]: 25,
        },
      ];

      const élémentsSource: DonnéesRangéeTableau[] = [
        {
          [idColonneEndroit]: ici,
          [idColonneDate]: uneDate,
          [idColonneTempMin]: 27,
          [idColonneTempMax]: 30,
        },
        {
          [idColonneEndroit]: ici,
          [idColonneDate]: uneAutreJournée,
          [idColonneTempMin]: 27,
        },
        {
          [idColonneEndroit]: là,
          [idColonneDate]: uneAutreJournée,
          [idColonneTempMin]: 27,
        },
        {
          [idColonneEndroit]: quelquePart,
          [idColonneDate]: unJour,
          [idColonneTempMin]: 27,
        },
      ];

      before(async () => {
        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
        idTableauSource = await constl.bds.ajouterTableau({ idBd });
        for (const idColonne of [
          idColonneDate,
          idColonneEndroit,
          idColonneTempMin,
          idColonneTempMax,
        ]) {
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau: idTableauSource,
            idColonne,
          });
        }

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau: idTableauSource,
          éléments: élémentsSource,
        });
      });

      beforeEach(async () => {
        idTableauDestinataire = await constl.bds.ajouterTableau({ idBd });

        for (const idColonne of [
          idColonneDate,
          idColonneEndroit,
          idColonneTempMin,
          idColonneTempMax,
        ]) {
          await constl.bds.tableaux.ajouterColonne({
            idStructure: idBd,
            idTableau: idTableauDestinataire,
            idColonne,
          });
        }

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau: idTableauDestinataire,
          éléments: élémentsDestinataire,
        });
      });

      it("sans index", async () => {
        await combinerDonnées();

        const réf: DonnéesRangéeTableau[] = [
          ...élémentsSource,
          ...élémentsDestinataire,
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

      it("index univariable", async () => {
        await constl.bds.tableaux.modifierIndexColonne({
          idStructure: idBd,
          idTableau: idTableauDestinataire,
          idColonne: idColonneDate,
          index: true,
        });

        const idsCombinés = await combinerDonnées();

        const réf: DonnéesRangéeTableau[] = [
          {
            [idColonneEndroit]: ici,
            [idColonneDate]: uneDate,
            [idColonneTempMin]: 25,
            [idColonneTempMax]: 30,
          },
          {
            [idColonneEndroit]: ici,
            [idColonneDate]: uneAutreJournée,
            [idColonneTempMin]: 25,
          },
          {
            [idColonneEndroit]: là,
            [idColonneDate]: uneDate,
            [idColonneTempMin]: 25,
          },
          {
            [idColonneEndroit]: quelquePart,
            [idColonneDate]: unJour,
            [idColonneTempMin]: 27,
          },
        ];

        const résultat = await obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau: idTableauDestinataire,
            f: si(
              (x) =>
                x?.length === réf.length &&
                idsCombinés.every((id) => x.find((d) => d.id === id)),
            ),
          }),
        );
        expect(résultat.map((d) => d.données)).to.have.deep.members(réf);
      });

      it("index variable liste", async () => {
        await constl.bds.tableaux.modifierIndexColonne({
          idStructure: idBd,
          idTableau: idTableauDestinataire,
          idColonne: idColonneEndroit,
          index: true,
        });

        const idsCombinés = await combinerDonnées();

        const réf: DonnéesRangéeTableau[] = [
          {
            [idColonneEndroit]: ici,
            [idColonneDate]: uneDate,
            [idColonneTempMin]: 25,
            [idColonneTempMax]: 30,
          },
          {
            [idColonneEndroit]: ici,
            [idColonneDate]: uneAutreJournée,
            [idColonneTempMin]: 25,
          },
          {
            [idColonneEndroit]: là,
            [idColonneDate]: uneDate,
            [idColonneTempMin]: 25,
          },
          {
            [idColonneEndroit]: quelquePart,
            [idColonneDate]: unJour,
            [idColonneTempMin]: 27,
          },
        ];

        const résultat = await obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau: idTableauDestinataire,
            f: si(
              (x) =>
                x?.length === réf.length &&
                idsCombinés.every((id) => x.find((d) => d.id === id)),
            ),
          }),
        );
        expect(résultat.map((d) => d.données)).to.have.deep.members(réf);
      });

      it("index multivariable", async () => {
        for (const idColonne of [idColonneDate, idColonneEndroit]) {
          await constl.bds.tableaux.modifierIndexColonne({
            idStructure: idBd,
            idTableau: idTableauDestinataire,
            idColonne,
            index: true,
          });
        }

        const réf: DonnéesRangéeTableau[] = [
          {
            [idColonneEndroit]: ici,
            [idColonneDate]: uneDate,
            [idColonneTempMin]: 25,
            [idColonneTempMax]: 30,
          },
          {
            [idColonneEndroit]: ici,
            [idColonneDate]: uneAutreJournée,
            [idColonneTempMin]: 25,
          },
          {
            [idColonneEndroit]: là,
            [idColonneDate]: uneDate,
            [idColonneTempMin]: 25,
          },
          {
            [idColonneEndroit]: là,
            [idColonneDate]: uneAutreJournée,
            [idColonneTempMin]: 27,
          },
          {
            [idColonneEndroit]: quelquePart,
            [idColonneDate]: unJour,
            [idColonneTempMin]: 27,
          },
        ];
        const idsCombinés = await combinerDonnées();

        const résultat = await obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau: idTableauDestinataire,
            f: si(
              (x) =>
                x?.length === réf.length &&
                idsCombinés.every((id) => x.find((d) => d.id === id)),
            ),
          }),
        );
        expect(résultat.map((d) => d.données)).to.have.deep.members(réf);
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
        index: true,
      });

      await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau: idTableauRéf,
        idColonne,
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

      const réf: RègleColonne = {
        règle: {
          id: idRègle,
          règle,
        },
        source: {
          type: "tableau",
          idStructure: idBd,
          idTableau: idTableauCopié,
        },
        colonne: idColonne,
      };

      expect(règles.find((r) => r.règle.id === idRègle)).to.deep.equal(réf);
    });

    it("les variables sont copiés", async () => {
      const variables = await obtenir(({ siPasVide }) =>
        constl.bds.tableaux.suivreVariables({
          idStructure: idBd,
          idTableau: idTableauCopié,
          f: siPasVide(),
        }),
      );

      expect(variables).to.have.deep.members([idVariable]);
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
        idStructureDestinataire: idNouvelleBd,
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

      const réf: RègleColonne = {
        règle: {
          id: idRègle,
          règle,
        },
        source: {
          type: "tableau",
          idStructure: idNouvelleBd,
          idTableau: idTableauCopié,
        },
        colonne: idColonne,
      };

      expect(règles.find((r) => r.règle.id === idRègle)).to.deep.equal(réf);
    });

    it("nouvelle structure - les variables sont copiés", async () => {
      const variables = await obtenir(({ siPasVide }) =>
        constl.bds.tableaux.suivreVariables({
          idStructure: idNouvelleBd,
          idTableau: idTableauCopié,
          f: siPasVide(),
        }),
      );

      expect(variables).to.have.deep.members([idVariable]);
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

  describe("accès", function () {
    let fermerAccès: () => Promise<void>;
    let constlsAccès: Constellation[];

    before(async () => {
      ({ fermer: fermerAccès, constls: constlsAccès } =
        await créerConstellationsTest({
          n: 2,
        }));
    });

    after(async () => {
      if (fermerAccès) await fermerAccès();
    });

    it("l'accès du tableau suit l'accès à la structure originale", async () => {
      const idBd = await constlsAccès[0].bds.créerBd({ licence: "ODBl-1_0" });
      const idTableau = await constlsAccès[0].bds.ajouterTableau({
        idBd,
      });
      const idColonne = await constlsAccès[0].bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
      });

      await constlsAccès[0].bds.donnerAccèsObjet({
        idObjet: idBd,
        identité: await constlsAccès[1].compte.obtIdCompte(),
        rôle: MEMBRE,
      });

      // Vérifier la permission
      const idDonnées = await constlsAccès[0].bds.tableaux.obtIdDonnées({
        idStructure: idBd,
        idTableau,
      });
      const permission = await obtenir<Rôle>(({ siDéfini }) =>
        constlsAccès[1].compte.suivrePermission({
          idObjet: idDonnées,
          f: siDéfini(),
        }),
      );
      expect(permission).to.equal(MEMBRE);

      // Vérifier que l'édition des données fonctionne
      const idÉlément = (
        await constlsAccès[1].bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments: [
            {
              [idColonne]: 123,
            },
          ],
        })
      )[0];

      const vals = await obtenir<DonnéesRangéeTableauAvecId[]>(
        ({ siPasVide }) =>
          constlsAccès[0].bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
      );

      const réf: DonnéesRangéeTableauAvecId[] = [
        {
          id: idÉlément,
          données: {
            [idColonne]: 123,
          },
        },
      ];
      expect(vals).to.deep.equal(réf);
    });
  });
});
