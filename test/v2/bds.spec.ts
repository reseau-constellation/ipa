import { adresseOrbiteValide } from "@constl/utils-ipa";
import { expect } from "aegir/chai";
import { Constellation } from "@/v2/index.js";
import { DISPOSITIFS_INSTALLÉS, TOUS_DISPOSITIFS } from "@/v2/favoris.js";
import { DifférenceBds, ÉpingleBd } from "@/v2/bds/bds.js";
import { MODÉRATRICE } from "@/v2/crabe/services/compte/accès/consts.js";
import { StatutDonnées, TraducsTexte } from "@/v2/types.js";
import { créerConstellationsTest, obtenir } from "./utils.js";

describe("BDs", function () {
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

  describe("création bds", function () {
    let idBd: string;

    it("création", async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      expect(adresseOrbiteValide(idBd)).to.be.true();
    });

    it("accès", async () => {
      const permission = await obtenir(({ siDéfini }) =>
        constl.compte.suivrePermission({
          idObjet: idBd,
          f: siDéfini(),
        }),
      );
      expect(permission).to.equal(MODÉRATRICE);
    });

    it("automatiquement ajoutée à mes bds", async () => {
      const mesBds = await obtenir<string[]>(({ siDéfini }) =>
        constl.bds.suivreBds({
          f: siDéfini(),
        }),
      );
      expect(mesBds).to.be.an("array").and.to.contain(idBd);
    });

    it("enlever de mes bds", async () => {
      await constl.bds.enleverDeMesBds({ idBd });
      const mesBds = await obtenir<string[] | undefined>(({ siVide }) =>
        constl.bds.suivreBds({
          f: siVide(),
        }),
      );
      expect(mesBds).to.be.an.empty("array");
    });

    it("ajouter manuellement à mes bds", async () => {
      await constl.bds.ajouterÀMesBds({ idBd });
      const mesBds = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.suivreBds({
          f: siPasVide(),
        }),
      );
      expect(mesBds).to.have.members([idBd]);
    });

    it("effacer bd", async () => {
      await constl.bds.effacerBd({ idBd });
      const mesBds = await obtenir<string[] | undefined>(({ siVide }) =>
        constl.bds.suivreBds({
          f: siVide(),
        }),
      );
      expect(mesBds).to.be.empty();
    });
  });

  describe("noms", function () {
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("pas de noms pour commencer", async () => {
      const noms = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.bds.suivreNomsBd({ idBd, f: siDéfini() }),
      );
      expect(Object.keys(noms).length).to.equal(0);
    });

    it("ajouter un nom", async () => {
      await constl.bds.sauvegarderNomBd({
        idBd,
        langue: "fr",
        nom: "Alphabets",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreNomsBd({
          idBd,
          f: si((n) => !!n && Object.keys(n).length > 0),
        }),
      );
      expect(noms.fr).to.equal("Alphabets");
    });

    it("ajouter des noms", async () => {
      await constl.bds.sauvegarderNomsBd({
        idBd,
        noms: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreNomsBd({
          idBd,
          f: si((n) => !!n && Object.keys(n).length > 2),
        }),
      );
      expect(noms).to.deep.equal({
        fr: "Alphabets",
        த: "எழுத்துகள்",
        हिं: "वर्णमाला",
      });
    });

    it("changer un nom", async () => {
      await constl.bds.sauvegarderNomBd({
        idBd,
        langue: "fr",
        nom: "Systèmes d'écriture",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreNomsBd({
          idBd,
          f: si((n) => n?.["fr"] !== "Alphabets"),
        }),
      );

      expect(noms?.fr).to.equal("Systèmes d'écriture");
    });

    it("effacer un nom", async () => {
      await constl.bds.effacerNomBd({ idBd, langue: "fr" });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreNomsBd({ idBd, f: si((n) => !!n && !n["fr"]) }),
      );
      expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("descriptions", function () {
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("aucune description pour commencer", async () => {
      const descrs = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.bds.suivreDescriptionsBd({ idBd, f: siDéfini() }),
      );
      expect(Object.keys(descrs).length).to.equal(0);
    });

    it("ajouter une description", async () => {
      await constl.bds.sauvegarderDescriptionBd({
        idBd,
        langue: "fr",
        description: "Alphabets",
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreDescriptionsBd({ idBd, f: si((x) => !!x?.["fr"]) }),
      );
      expect(descrs.fr).to.equal("Alphabets");
    });

    it("ajouter des descriptions", async () => {
      await constl.bds.sauvegarderDescriptionsBd({
        idBd,
        descriptions: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreDescriptionsBd({
          idBd,
          f: si((x) => !!x && Object.keys(x).length > 2),
        }),
      );
      expect(descrs).to.deep.equal({
        fr: "Alphabets",
        த: "எழுத்துகள்",
        हिं: "वर्णमाला",
      });
    });

    it("changer une description", async () => {
      await constl.bds.sauvegarderDescriptionBd({
        idBd,
        langue: "fr",
        description: "Systèmes d'écriture",
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreDescriptionsBd({
          idBd,
          f: si((x) => x?.["fr"] !== "Alphabets"),
        }),
      );
      expect(descrs?.fr).to.equal("Systèmes d'écriture");
    });

    it("effacer une description", async () => {
      await constl.bds.effacerDescriptionBd({ idBd, langue: "fr" });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreDescriptionsBd({ idBd, f: si((x) => !!x && !x["fr"]) }),
      );
      expect(descrs).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("métadonnées");

  describe("mots-clefs");

  describe("tableaux");

  describe("variables");

  describe("image");

  describe("licences");

  describe("épingles", function () {
    it("désépingler bd", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      await constl.bds.désépinglerBd({ idBd });

      const épingle = await obtenir(({ si }) =>
        constl.bds.suivreÉpingleBd({
          idBd,
          f: si((x) => x === undefined),
        }),
      );
      expect(épingle).to.be.undefined();
    });

    it("épingler bd", async () => {
      const idBd = await constl.bds.créerBd({
        licence: "ODbl-1_0",
        épingler: false,
      });
      await constl.bds.épinglerBd({ idBd });

      const épingle = await obtenir(({ siDéfini }) =>
        constl.bds.suivreÉpingleBd({ idBd, f: siDéfini() }),
      );

      const réf: ÉpingleBd = {
        base: TOUS_DISPOSITIFS,
        type: "bd",
        données: {
          tableaux: TOUS_DISPOSITIFS,
          fichiers: DISPOSITIFS_INSTALLÉS,
        },
      };
      expect(épingle).to.deep.equal(réf);
    });

    it("résoudre épingle - base", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.bds.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idBd,
            épingle: {
              type: "bd",
              base: true,
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolution]).to.have.members([idBd]);
    });

    it("résoudre épingle - tableaux", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const idTableau = await constl.bds.ajouterTableau({ idBd });

      const résolution = await obtenir<Set<string>>(({ si }) =>
        constl.bds.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idBd,
            épingle: {
              type: "bd",
              base: true,
              données: {
                tableaux: true,
              },
            },
          },
          f: si((x) => !!x && x.size > 1),
        }),
      );
      expect([...résolution]).to.have.members([idBd, idTableau]);

      const résolutionSansTableaux = await obtenir<Set<string>>(
        ({ siDéfini }) =>
          constl.bds.suivreRésolutionÉpingle({
            épingle: {
              idObjet: idBd,
              épingle: {
                type: "bd",
                base: true,
              },
            },
            f: siDéfini(),
          }),
      );
      expect([...résolutionSansTableaux]).to.have.members([idBd]);
    });

    it("résoudre épingle - fichiers", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const idTableau = await constl.bds.ajouterTableau({ idBd });
      const idVariable = await constl.variables.créerVariable({
        catégorie: "fichier",
      });
      const idColonne = await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idVariable,
      });

      const idc = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ.mp4";
      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idBd,
        idTableau,
        éléments: [{ [idColonne]: idc }],
      });

      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.bds.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idBd,
            épingle: {
              type: "bd",
              base: true,
              données: {
                tableaux: true,
                fichiers: true,
              },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolution]).to.have.members([idBd, idTableau, idc]);

      const résolutionSansFichers = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.bds.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idBd,
            épingle: {
              type: "bd",
              base: true,
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolutionSansFichers]).to.have.members([idBd]);
    });

    it("résoudre épingle - fichiers variable liste", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const idTableau = await constl.bds.ajouterTableau({ idBd });
      const idVariable = await constl.variables.créerVariable({
        catégorie: { catégorie: "fichier", type: "liste" },
      });
      const idColonne = await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idVariable,
      });

      const idc = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ.mp4";
      const idc2 = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmR.mp4";
      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idBd,
        idTableau,
        éléments: [{ [idColonne]: [idc, idc2] }],
      });

      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.bds.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idBd,
            épingle: {
              type: "bd",
              base: true,
              données: {
                tableaux: true,
                fichiers: true,
              },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolution]).to.have.members([idBd, idTableau, idc, idc2]);
    });
  });

  describe("statut", function () {
    let idBd: string;

    it("statut actif par défaut", async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const statut = await obtenir(({ siDéfini }) =>
        constl.bds.suivreStatut({
          idBd,
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
        idNouvelle: "/orbitdb/uneAutreBaseDeDonnées",
      };
      await constl.bds.sauvegarderStatut({
        idBd,
        statut: nouveauStatut,
      });

      const statut = await obtenir<StatutDonnées | null>(({ si }) =>
        constl.bds.suivreStatut({
          idBd,
          f: si((x) => x?.statut !== "active"),
        }),
      );

      expect(statut).to.deep.equal(nouveauStatut);
    });
  });

  describe("copier", function () {
    it("suivre bd parent");
  });

  describe("schémas", function () {
    it("création bd à partir de schéma");
    it("génération de schéma");
  });

  describe("nuées", function () {
    it("aucune nuée pour commencer");
    it("rejoindre nuée");
    it("quiter nuée");
  });

  describe("différences", function () {
    let idBd: string;
    let idBdRéf: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODBl-1_0" });
    });

    it("vide pour commencer", async () => {
      const différences = await obtenir(({ siVide }) =>
        constl.bds.suivreDifférencesAvecBd({ idBd, idBdRéf, f: siVide() }),
      );
      expect(différences).to.be.empty();
    });

    it("tableau manquant", async () => {
      const idTableau = await constl.bds.ajouterTableau({ idBd: idBdRéf });
      const différences = await obtenir(({ siPasVide }) =>
        constl.bds.suivreDifférencesAvecBd({ idBd, idBdRéf, f: siPasVide() }),
      );

      const réf: DifférenceBds[] = [
        {
          type: "tableauManquant",
          sévère: true,
          clefManquante: idTableau,
        },
      ];
      expect(différences).to.have.deep.members(réf);

      await constl.bds.ajouterTableau({ idBd, idTableau });
      const différencesAprès = await obtenir(({ siVide }) =>
        constl.bds.suivreDifférencesAvecBd({ idBd, idBdRéf, f: siVide() }),
      );
      expect(différencesAprès).to.be.empty();
    });

    it("tableau supplémentaire", async () => {
      const idTableau = await constl.bds.ajouterTableau({ idBd });
      const différences = await obtenir(({ siPasVide }) =>
        constl.bds.suivreDifférencesAvecBd({ idBd, idBdRéf, f: siPasVide() }),
      );

      const réf: DifférenceBds[] = [
        {
          type: "tableauSupplémentaire",
          sévère: false,
          clefExtra: idTableau,
        },
      ];
      expect(différences).to.have.deep.members(réf);

      await constl.bds.effacerTableau({ idBd, idTableau });
      const différencesAprès = await obtenir(({ siVide }) =>
        constl.bds.suivreDifférencesAvecBd({ idBd, idBdRéf, f: siVide() }),
      );
      expect(différencesAprès).to.be.empty();
    });

    it("différences tableau", async () => {
      const idTableau = await constl.bds.ajouterTableau({ idBd: idBdRéf });
      await constl.bds.ajouterTableau({ idBd, idTableau });

      const idColonne = await constl.bds.tableaux.ajouterColonne({
        idStructure: idBdRéf,
        idTableau,
      });
      const différences = await obtenir(({ siPasVide }) =>
        constl.bds.suivreDifférencesAvecBd({ idBd, idBdRéf, f: siPasVide() }),
      );

      const réf: DifférenceBds[] = [
        {
          type: "tableau",
          idTableau,
          sévère: true,
          différence: {
            type: "colonneManquante",
            idColonneManquante: idColonne,
            sévère: true,
          },
        },
      ];
      expect(différences).to.have.deep.members(réf);

      await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idColonne,
      });
      const différencesAprès = await obtenir(({ siVide }) =>
        constl.bds.suivreDifférencesAvecBd({ idBd, idBdRéf, f: siVide() }),
      );
      expect(différencesAprès).to.be.empty();
    });
  });

  describe("combiner");

  describe("score");

  describe("bds uniques");

  describe("exportation");
});
