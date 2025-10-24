import { adresseOrbiteValide, obtenir } from "@constl/utils-ipa";
import { créerConstellationsTest } from "@constl/utils-tests";
import { expect } from "aegir/chai";
import { Constellation, créerConstellation } from "@/v2/index.js";
import { DISPOSITIFS_INSTALLÉS, TOUS_DISPOSITIFS } from "@/v2/favoris.js";
import { ÉpingleBd } from "@/v2/bds.js";

describe("BDs", function () {
  let fermer: () => Promise<void>;
  let constls: Constellation[];
  let constl: Constellation;

  before(async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 1,
      créerConstellation,
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
      expect(permission).to.be.true();
    });

    it("nouvelle BD ajoutée à mes bds", async () => {
      const mesBds = await obtenir<string[]>(({ siDéfini }) =>
        constl.bds.suivreBds({
          f: siDéfini(),
        }),
      );
      expect(mesBds).to.be.an("array").and.to.contain(idBd);
    });

    it("enlever de mes bds", async () => {
      await constl.bds.enleverDeMesBds({ idBd });
      const mesBds = await obtenir<string[] | undefined>(({ si }) =>
        constl.bds.suivreBds({
          f: si((x) => !!x && x.includes(idBd)),
        }),
      );
      expect(mesBds).to.be.an.empty("array");
    });

    it("ajouter manuellement à mes bds", async () => {
      await constl.bds.ajouterÀMesBds({ idBd });
      const mesBds = await obtenir<string[] | undefined>(({ siPasVide }) =>
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
      expect(mesBds).to.be.an("array").with.length(1).and.to.contain(idBd);
    });
  });

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
      expect(résolution).to.have.members([idBd]);
    });

    it("résoudre épingle - tableaux", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const idTableau = await constl.bds.ajouterTableau({ idBd });

      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
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
          f: siDéfini(),
        }),
      );
      expect(résolution).to.have.members([idBd, idTableau]);

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
      expect(résolutionSansTableaux).to.have.members([idBd]);
    });

    it("résoudre épingle - fichiers", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const idTableau = await constl.bds.ajouterTableau({ idBd });
      const idVariable = await constl.variables.créerVariable({
        catégorie: "fichier",
      });
      const idColonne = await constl.tableaux.ajouterColonne({
        idTableau,
        idVariable,
      });

      const idc = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ.mp4";
      await constl.tableaux.ajouterÉlément({
        idTableau,
        val: { [idColonne]: idc },
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
      expect(résolution).to.have.members([idBd, idTableau, idc]);

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
      expect(résolutionSansFichers).to.have.members([idBd]);
    });

    it("résoudre épingle - fichiers variable liste", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const idTableau = await constl.bds.ajouterTableau({ idBd });
      const idVariable = await constl.variables.créerVariable({
        catégorie: "fichier",
        liste: true,
      });
      const idColonne = await constl.tableaux.ajouterColonne({
        idTableau,
        idVariable,
      });

      const idc = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ.mp4";
      const idc2 = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmR.mp4";
      await constl.tableaux.ajouterÉlément({
        idTableau,
        val: { [idColonne]: [idc, idc2] },
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
      expect(résolution).to.have.members([idBd, idTableau, idc, idc2]);
    });
  });
});
