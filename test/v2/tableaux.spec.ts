import { expect } from "aegir/chai";
import { MEMBRE } from "@/v2/crabe/services/compte/accès/consts.js";
import { Rôle } from "@/v2/crabe/services/compte/accès/types.js";
import { Constellation } from "@/v2/index.js";
import { TraducsTexte } from "@/v2/types.js";
import { InfoColonne } from "@/v2/tableaux.js";
import { créerConstellationsTest, obtenir } from "./utils.js";

describe.only("tableaux", function () {
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
      idTableau = await constl.tableaux.créerTableau({ idStructure: idBd });
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("pas de noms pour commencer", async () => {
      const noms = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.tableaux.suivreNomsTableau({
          idTableau,
          f: siDéfini(),
        }),
      );
      expect(Object.keys(noms).length).to.equal(0);
    });

    it("ajouter un nom", async () => {
      await constl.tableaux.sauvegarderNomTableau({
        idTableau,
        langue: "fr",
        nom: "Alphabets",
      });
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.tableaux.suivreNomsTableau({
          idTableau,
          f: siPasVide(),
        }),
      );
      expect(noms.fr).to.equal("Alphabets");
    });

    it("ajouter des noms", async () => {
      await constl.tableaux.sauvegarderNomsTableau({
        idTableau,
        noms: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.tableaux.suivreNomsTableau({
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
      await constl.tableaux.sauvegarderNomTableau({
        idTableau,
        langue: "fr",
        nom: "Systèmes d'écriture",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.tableaux.suivreNomsTableau({
          idTableau,
          f: si((x) => x?.["fr"] !== "Alphabets"),
        }),
      );

      expect(noms.fr).to.equal("Systèmes d'écriture");
    });

    it("fffacer un nom", async () => {
      await constl.tableaux.effacerNomTableau({
        idTableau,
        langue: "fr",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.tableaux.suivreNomsTableau({
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
        idTableau = await constl.tableaux.créerTableau({ idStructure: idBd });
      });

      it("colonnes vides pour commencer", async () => {
        const colonnes = await obtenir<InfoColonne[]>(({ siDéfini }) =>
          constl.tableaux.suivreColonnes({ idTableau, f: siDéfini() }),
        );
        expect(colonnes).to.be.empty();
      });

      it("ajout colonne", async () => {
        const idVariable = await constl.variables.créerVariable({
          catégorie: "audio",
        });

        const pColonnes = obtenir<InfoColonne[]>(({ siPasVide }) =>
          constl.tableaux.suivreColonnes({ idTableau, f: siPasVide() }),
        );

        const idColonne = await constl.tableaux.ajouterColonne({
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
          constl.tableaux.suivreColonnes({ idTableau, f: siPasVide() }),
        );
        const idColonne = await constl.tableaux.ajouterColonne({
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
          constl.tableaux.suivreColonnes({
            idTableau,
            f: si((cols) => !!cols?.find((c) => !!c.variable)),
          }),
        );

        const idColonne = await constl.tableaux.ajouterColonne({
          idTableau,
        });
        const pInfoColonne = obtenir<InfoColonne>(({ si }) =>
          constl.tableaux.suivreInfoColonne({
            idTableau,
            idColonne,
            f: si((c) => !!c?.variable),
          }),
        );

        await constl.tableaux.modifierVariableColonne({
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
          constl.tableaux.suivreColonnes({
            idTableau,
            f: si((cols) => !!cols?.find((c) => c.index)),
          }),
        );

        const idColonne = await constl.tableaux.ajouterColonne({
          idTableau,
        });
        const pInfoColonne = obtenir<InfoColonne>(({ si }) =>
          constl.tableaux.suivreInfoColonne({
            idTableau,
            idColonne,
            f: si((c) => !!c?.index),
          }),
        );

        await constl.tableaux.modifierColonneIndex({
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

        const idColonne = await constl.tableaux.ajouterColonne({
          idTableau,
        });
        const pColonnes = obtenir<InfoColonne[]>(({ si }) =>
          constl.tableaux.suivreColonnes({
            idTableau,
            f: si((cols) => !!cols?.find((c) => c.id !== idColonne)),
          }),
        );
        const pInfoColonne = obtenir<InfoColonne>(({ si }) =>
          constl.tableaux.suivreInfoColonne({
            idTableau,
            idColonne,
            f: si((c) => c.id !== idColonne),
          }),
        );

        const nouvelId = "un nouveau nom pour la colonne";
        await constl.tableaux.modifierIdColonne({
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
        idTableau = await constl.tableaux.créerTableau({ idStructure: idBd });
      });

      it("variables vides pour commencer", async () => {
        const variables = await obtenir(({ siDéfini }) =>
          constl.tableaux.suivreVariables({ idTableau, f: siDéfini() }),
        );
        expect(variables).to.be.empty();
      });

      it("ajout colonne", async () => {
        const pVariables = obtenir(({ siPasVide }) =>
          constl.tableaux.suivreVariables({ idTableau, f: siPasVide() }),
        );

        const idVariable = await constl.variables.créerVariable({
          catégorie: "vidéo",
        });
        await constl.tableaux.ajouterColonne({ idTableau, idVariable });

        expect(await pVariables).to.deep.equal([idVariable]);
      });

      it("modification variable", async () => {
        const idVariable = await constl.variables.créerVariable({
          catégorie: "vidéo",
        });
        const idColonne = await constl.tableaux.ajouterColonne({
          idTableau,
          idVariable,
        });

        const idVariable2 = await constl.variables.créerVariable({
          catégorie: "audio",
        });

        const pVariables = obtenir<string[]>(({ si }) =>
          constl.tableaux.suivreVariables({
            idTableau,
            f: si((vrs) => !!vrs?.includes(idVariable2)),
          }),
        );

        await constl.tableaux.changerVariableColonne({
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
        const idColonne = await constl.tableaux.ajouterColonne({
          idTableau,
          idVariable,
        });
        await obtenir(({ siPasVide }) =>
          constl.tableaux.suivreVariables({ idTableau, f: siPasVide() }),
        );

        await constl.tableaux.changerVariableColonne({
          idTableau,
          idColonne,
          idVariable: undefined,
        });
        const pVariables = obtenir(({ siVide }) =>
          constl.tableaux.suivreVariables({ idTableau, f: siVide() }),
        );

        expect(await pVariables).to.be.empty();
      });

      it("enlever colonne", async () => {
        const idVariable = await constl.variables.créerVariable({
          catégorie: "vidéo",
        });
        const idColonne = await constl.tableaux.ajouterColonne({
          idTableau,
          idVariable,
        });
        await obtenir(({ siPasVide }) =>
          constl.tableaux.suivreVariables({ idTableau, f: siPasVide() }),
        );

        await constl.tableaux.effacerColonne({ idTableau, idColonne });
        const pVariables = obtenir(({ siVide }) =>
          constl.tableaux.suivreVariables({ idTableau, f: siVide() }),
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
        idTableau = await constl.tableaux.créerTableau({ idStructure: idBd });
      });

      it("données vides pour commencer", async () => {
        const données = await obtenir(({ siDéfini }) =>
          constl.tableaux.suivreDonnées({ idTableau, f: siDéfini() }),
        );
        expect(données).to.be.empty();
      });

      it("ajouter élément", async () => {
        const pDonnées = obtenir(({ siPasVide })=>constl.tableaux.suivreDonnées({ idTableau, f: siPasVide() }))

        idColNumérique = await constl.tableaux.ajouterColonne({ idTableau });
        idColChaîne = await constl.tableaux.ajouterColonne({ idTableau });
        const élément = {
          [idColNumérique]: 123.456,
          [idColChaîne]: "வணக்கம்",
        };
        idÉlément = await constl.tableaux.ajouterÉlément({ idTableau, élément });

        expect(await pDonnées).to.deep.equal([{id: idÉlément, élément}])
      });

      it("modifier élément", async () => {
        const pDonnées = obtenir(({ si })=>constl.tableaux.suivreDonnées({ idTableau, f: si(d=>d.find(x=>x[idColNumérique] !== 123.456)) }))
        const nouvelÉlément = {
          [idColNumérique]: 654.321,
          [idColChaîne]: "வணக்கம்",
        }
        await constl.tableaux.modifierÉlément({ idTableau, idÉlément, élément: nouvelÉlément });

        expect(await pDonnées).to.deep.equal([{id: idÉlément, élément: nouvelÉlément}])
      });

      it('effacer clef élément', async () => {
        const pDonnées = obtenir(({ si })=>constl.tableaux.suivreDonnées({ idTableau, f: si(d=>d.find(x=>!x.keys().includes(idColNumérique))) }))
        const vals = {
          [idColNumérique]: undefined,
        }
        await constl.tableaux.modifierÉlément({ idTableau, idÉlément, vals });

        expect(await pDonnées).to.deep.equal([{id: idÉlément, élément: { [idColChaîne]: "வணக்கம்" }}])
      })

      it('ajouter clef élément', async () => {
        const pDonnées = obtenir(({ si })=>constl.tableaux.suivreDonnées({ idTableau, f: si(d=>d.find(x=>x.keys().includes(idColNumérique))) }))
        const vals = {
          [idColNumérique]: 123,
        }
        await constl.tableaux.modifierÉlément({ idTableau, idÉlément, vals });

        expect(await pDonnées).to.deep.equal([{id: idÉlément, élément: { [idColChaîne]: "வணக்கம்", [idColNumérique]: 123 }}])
      })

      it('effacer colonne', async () => {
        const pDonnées = obtenir(({ si })=>constl.tableaux.suivreDonnées({ idTableau, f: si(d=>d.find(x=>!x.keys().includes(idColChaîne))) }))
        await constl.tableaux.effacerColonne({ idTableau, idColonne: idColChaîne });

        expect(await pDonnées).to.deep.equal([{id: idÉlément, élément: { [idColNumérique]: 123 }}])
      })

      it('restaurer colonne', async () => {
        const pDonnées = obtenir(({ si })=>constl.tableaux.suivreDonnées({ idTableau, f: si(d=>d.find(x=>x.keys().includes(idColChaîne))) }))
        await constl.tableaux.ajouterColonne({ idTableau, idColonne: idColChaîne });

        expect(await pDonnées).to.deep.equal([{id: idÉlément, élément: { [idColChaîne]: "வணக்கம்", [idColNumérique]: 123 }}])
      })

      it("effacer élément", async () => {
        const pDonnées = obtenir(({ siVide })=>constl.tableaux.suivreDonnées({ idTableau, f: siVide() }))

        await constl.tableaux.effacerÉlément({ idTableau, idÉlément });

        expect(await pDonnées).to.deep.equal([])
      });

      it("suivre données selon variable - id élément si variable non existante", async () => {        
        // Id colonne
        const élément = {
          [idColNumérique]: 123.456,
          [idColChaîne]: "வணக்கம்",
        };
        idÉlément = await constl.tableaux.ajouterÉlément({ idTableau, élément });
        const données = await obtenir(({siPasVide})=>constl.tableaux.suivreDonnées({ idTableau, f: siPasVide(), clefsSelonVariables: true}))
        expect(données).to.deep.equal([{ id: idÉlément, élément }])

      })

      it('suivre données selon variable - ajout variable ', async () => {
        const idVarNumérique = await constl.variables.créerVariable({ catégorie: 'numérique' });
        // Id variable
        await constl.tableaux.modifierVariableColonne({ idTableau, idColonne: idColNumérique, idVariable: idVarNumérique })
        const données = await obtenir(({si})=>constl.tableaux.suivreDonnées({ idTableau, f: si(x=>!x.keys().includes(idColNumérique)), clefsSelonVariables: true}))
        expect(données).to.deep.equal([{ id: idÉlément, élément: {
          [idVarNumérique]: 123.456,
          [idColChaîne]: "வணக்கம்",
        } }])
      });
    });

    describe("importation", function () {
      it("importation nouveaux éléments");
      it("importation avec index");
      it("importation avec index variable liste");
      it("importation avec indices multiples");
    });

    describe("exportation", function () {});

    describe("règles", function () {
      it("ajout règle colonne");
      it("ajout règle à travers variable");
    });

    describe("erreurs", function () {
      it("colonnes - id colonne dédoublé");
      it("colonnes - variable colonne dédoublée");
      it("éléments - index dédoublé");
      it("éléments - erreur règle colonne");
      it("éléments - erreur règle variable");
    });
  });

  describe("accès", function () {
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
      const idTableau = await constls[0].tableaux.créerTableau({
        idStructure: idBd,
      });

      await constls[0].compte.donnerAccèsObjet({
        idObjet: idBd,
        identité: await constls[1].compte.obtIdCompte(),
        rôle: MEMBRE,
      });

      // Vérifier la permission
      const permission = await obtenir<Rôle>(({ siDéfini }) =>
        constls[1].compte.suivrePermission({
          idObjet: idTableau,
          f: siDéfini(),
        }),
      );
      expect(permission).to.equal(MEMBRE);

      // Vérifier que l'édition des données fonctionne
      await constls[1].tableaux.sauvegarderNomTableau({
        idTableau,
        langue: "fr",
        nom: "mon tableau",
      });

      const noms = await obtenir<TraducsTexte | undefined>(({ siPasVide }) =>
        constls[0].tableaux.suivreNomsTableau({ idTableau, f: siPasVide() }),
      );
      expect(noms).to.deep.equal({
        fr: "mon tableau",
      });
    });
  });
});
