import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { expect } from "aegir/chai";
import { dossierTempo } from "@constl/utils-tests";
import JSZip from "jszip";
import {
  MEMBRE,
  MODÉRATRICE,
} from "@/v2/nébuleuse/services/compte/accès/index.js";
import {
  TOUS_DISPOSITIFS,
  DISPOSITIFS_INSTALLÉS,
} from "@/v2/nébuleuse/services/favoris.js";
import { enleverPréfixeOrbite, enleverPréfixesEtOrbite } from "@/v2/utils.js";
import { obtRessourceTest } from "./ressources/index.js";
import { obtenir, créerConstellationsTest } from "./utils.js";
import type {
  InfoAuteur,
  Métadonnées,
  StatutDonnées,
  TraducsTexte,
  PartielRécursif,
} from "@/v2/types.js";
import type { Constellation } from "@/v2/index.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type {
  DonnéesFichierProjetExportées,
  DonnéesProjetExportées,
  MotClefProjet,
  ÉpingleProjet,
} from "@/v2/projets.js";

describe.skip("Projets", function () {
  let fermer: Oublier;
  let constls: Constellation[];
  let constl: Constellation;

  let idsComptes: string[];

  before(async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 2,
    }));
    constl = constls[0];
    idsComptes = await Promise.all(constls.map((c) => c.compte.obtIdCompte()));
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("création projets", function () {
    let idProjet: string;

    it("pas de projets pour commencer", async () => {
      const projets = await obtenir(({ siDéfini }) =>
        constl.projets.suivreProjets({
          f: siDéfini(),
        }),
      );
      expect(projets).to.be.an.empty("array");
    });

    it("création", async () => {
      idProjet = await constl.projets.créerProjet();
      expect(
        await constl.projets.identifiantValide({ identifiant: idProjet }),
      ).to.be.true();
    });

    it("accès", async () => {
      const permission = await obtenir(({ siDéfini }) =>
        constl.projets.suivrePermission({
          idObjet: idProjet,
          f: siDéfini(),
        }),
      );
      expect(permission).to.equal(MODÉRATRICE);
    });

    it("automatiquement ajoutée à mes projets", async () => {
      const mesProjets = await obtenir<string[]>(({ siDéfini }) =>
        constl.projets.suivreProjets({
          f: siDéfini(),
        }),
      );
      expect(mesProjets).to.be.an("array").and.to.contain(idProjet);
    });

    it("détectée sur un autre compte", async () => {
      const sesProjets = await obtenir<string[]>(({ siPasVide }) =>
        constls[1].projets.suivreProjets({
          f: siPasVide(),
          idCompte: idsComptes[0],
        }),
      );
      expect(sesProjets).have.members([idProjet]);
    });

    it("enlever de mes projets", async () => {
      await constl.projets.enleverDeMesProjets({ idProjet });
      const mesProjets = await obtenir<string[] | undefined>(({ siVide }) =>
        constl.projets.suivreProjets({
          f: siVide(),
        }),
      );
      expect(mesProjets).to.be.an.empty("array");
    });

    it("ajouter manuellement à mes projets", async () => {
      await constl.projets.ajouterÀMesProjets({ idProjet });
      const mesProjets = await obtenir<string[]>(({ siPasVide }) =>
        constl.projets.suivreProjets({
          f: siPasVide(),
        }),
      );
      expect(mesProjets).to.have.members([idProjet]);
    });

    it("effacer projet", async () => {
      await constl.projets.effacerProjet({ idProjet });
      const mesProjets = await obtenir<string[] | undefined>(({ siVide }) =>
        constl.projets.suivreProjets({
          f: siVide(),
        }),
      );
      expect(mesProjets).to.be.empty();
    });
  });

  describe("noms", function () {
    let idProjet: string;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
    });

    it("pas de noms pour commencer", async () => {
      const noms = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.projets.suivreNoms({ idProjet, f: siDéfini() }),
      );
      expect(Object.keys(noms).length).to.equal(0);
    });

    it("ajouter un nom", async () => {
      await constl.projets.sauvegarderNom({
        idProjet,
        langue: "fr",
        nom: "Alphabets",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.projets.suivreNoms({
          idProjet,
          f: si((n) => !!n && Object.keys(n).length > 0),
        }),
      );
      expect(noms.fr).to.equal("Alphabets");
    });

    it("ajouter des noms", async () => {
      await constl.projets.sauvegarderNoms({
        idProjet,
        noms: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.projets.suivreNoms({
          idProjet,
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
      await constl.projets.sauvegarderNom({
        idProjet,
        langue: "fr",
        nom: "Systèmes d'écriture",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.projets.suivreNoms({
          idProjet,
          f: si((n) => n?.["fr"] !== "Alphabets"),
        }),
      );

      expect(noms?.fr).to.equal("Systèmes d'écriture");
    });

    it("effacer un nom", async () => {
      await constl.projets.effacerNom({ idProjet, langue: "fr" });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.projets.suivreNoms({ idProjet, f: si((n) => !!n && !n["fr"]) }),
      );
      expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("descriptions", function () {
    let idProjet: string;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
    });

    it("aucune description pour commencer", async () => {
      const descrs = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.projets.suivreDescriptions({ idProjet, f: siDéfini() }),
      );
      expect(Object.keys(descrs).length).to.equal(0);
    });

    it("ajouter une description", async () => {
      await constl.projets.sauvegarderDescription({
        idProjet,
        langue: "fr",
        description: "Alphabets",
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.projets.suivreDescriptions({
          idProjet,
          f: si((x) => !!x?.["fr"]),
        }),
      );
      expect(descrs.fr).to.equal("Alphabets");
    });

    it("ajouter des descriptions", async () => {
      await constl.projets.sauvegarderDescriptions({
        idProjet,
        descriptions: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.projets.suivreDescriptions({
          idProjet,
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
      await constl.projets.sauvegarderDescription({
        idProjet,
        langue: "fr",
        description: "Systèmes d'écriture",
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.projets.suivreDescriptions({
          idProjet,
          f: si((x) => x?.["fr"] !== "Alphabets"),
        }),
      );
      expect(descrs?.fr).to.equal("Systèmes d'écriture");
    });

    it("effacer une description", async () => {
      await constl.projets.effacerDescription({ idProjet, langue: "fr" });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.projets.suivreDescriptions({
          idProjet,
          f: si((x) => !!x && !x["fr"]),
        }),
      );
      expect(descrs).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("métadonnées", function () {
    let idProjet: string;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
    });

    it("pas de métadonnées pour commencer", async () => {
      const métadonnées = await obtenir<Métadonnées>(({ siDéfini }) =>
        constl.projets.suivreMétadonnées({ idProjet, f: siDéfini() }),
      );
      expect(Object.keys(métadonnées).length).to.equal(0);
    });

    it("ajouter une métadonnée", async () => {
      await constl.projets.sauvegarderMétadonnée({
        idProjet,
        clef: "clef1",
        valeur: true,
      });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.projets.suivreMétadonnées({
          idProjet,
          f: si((n) => !!n && Object.keys(n).length > 0),
        }),
      );
      expect(métadonnées.clef1).to.be.true();
    });

    it("ajouter des métadonnées", async () => {
      await constl.projets.sauvegarderMétadonnées({
        idProjet,
        métadonnées: {
          clef2: 123,
          clef3: "du texte",
        },
      });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.projets.suivreMétadonnées({
          idProjet,
          f: si((n) => !!n && Object.keys(n).length > 2),
        }),
      );
      expect(métadonnées).to.deep.equal({
        clef1: true,
        clef2: 123,
        clef3: "du texte",
      });
    });

    it("changer un métadonnée", async () => {
      await constl.projets.sauvegarderMétadonnée({
        idProjet,
        clef: "clef1",
        valeur: false,
      });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.projets.suivreMétadonnées({
          idProjet,
          f: si((n) => n?.["clef1"] !== true),
        }),
      );

      expect(métadonnées?.clef1).to.be.false();
    });

    it("effacer une métadonnée", async () => {
      await constl.projets.effacerMétadonnée({ idProjet, clef: "clef1" });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.projets.suivreMétadonnées({
          idProjet,
          f: si((n) => !!n && !Object.keys(n).includes("clef1")),
        }),
      );
      expect(métadonnées).to.deep.equal({ clef2: 123, clef3: "du texte" });
    });
  });

  describe("image", function () {
    let IMAGE: Uint8Array;
    let idProjet: string;

    before(async () => {
      IMAGE = await obtRessourceTest({
        nomFichier: "logo.svg",
      });

      idProjet = await constl.projets.créerProjet();
    });

    it("aucune image pour commencer", async () => {
      const image = await obtenir(({ siNul }) =>
        constl.projets.suivreImage({ idProjet, f: siNul() }),
      );
      expect(image).to.be.null();
    });

    it("ajouter image", async () => {
      const idImage = await constl.projets.sauvegarderImage({
        idProjet,
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });
      expect(idImage).to.endWith("logo.svg");

      const image = await obtenir<{
        image: Uint8Array;
        idImage: string;
      } | null>(({ siPasNul }) =>
        constl.projets.suivreImage({ idProjet, f: siPasNul() }),
      );

      const réf = { idImage, image: IMAGE };
      expect(image).to.deep.equal(réf);
    });

    it("effacer image", async () => {
      await constl.projets.effacerImage({ idProjet });
      const image = await obtenir(({ siNul }) =>
        constl.projets.suivreImage({ idProjet, f: siNul() }),
      );
      expect(image).to.be.null();
    });
  });

  describe("statut", function () {
    let idProjet: string;

    it("statut actif par défaut", async () => {
      idProjet = await constl.projets.créerProjet();
      const statut = await obtenir(({ siDéfini }) =>
        constl.projets.suivreStatut({
          idProjet,
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
        idNouvelle: "constl/projet/orbitdb/unAutreProjet",
      };
      await constl.projets.sauvegarderStatut({
        idProjet,
        statut: nouveauStatut,
      });

      const statut = await obtenir<PartielRécursif<StatutDonnées> | undefined>(
        ({ si }) =>
          constl.projets.suivreStatut({
            idProjet,
            f: si((x) => x?.statut !== "active"),
          }),
      );

      expect(statut).to.deep.equal(nouveauStatut);
    });
  });

  describe("bds", function () {
    let idProjet: string;
    let idBd: string;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("pas de bds pour commencer", async () => {
      const bds = await obtenir(({ siDéfini }) =>
        constl.projets.suivreBds({ idProjet, f: siDéfini() }),
      );
      expect(bds).to.be.empty();
    });

    it("ajout d'une bd", async () => {
      await constl.projets.ajouterBds({ idProjet, idsBds: idBd });

      const bds = await obtenir(({ siPasVide }) =>
        constl.projets.suivreBds({ idProjet, f: siPasVide() }),
      );
      expect(bds).to.have.members([idBd]);
    });

    it("effacer une bd", async () => {
      await constl.projets.enleverBd({ idProjet, idBd });

      const bds = await obtenir(({ siVide }) =>
        constl.projets.suivreBds({ idProjet, f: siVide() }),
      );
      expect(bds).to.be.empty();
    });
  });

  describe("mots-clefs", function () {
    let idProjet: string;
    let idBd: string;

    let idMotClef: string;
    let idMotClefBd: string;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      idMotClef = await constl.motsClefs.créerMotClef();
    });

    it("rien pour commencer", async () => {
      const motsClefs = await obtenir(({ siDéfini }) =>
        constl.projets.suivreMotsClefs({ idProjet, f: siDéfini() }),
      );
      expect(motsClefs).to.be.empty();
    });

    it("ajouter mot-clef propre", async () => {
      await constl.projets.ajouterMotsClefs({
        idProjet,
        idsMotsClefs: [idMotClef],
      });
      const motsClefs = await obtenir<MotClefProjet[]>(({ siPasVide }) =>
        constl.projets.suivreMotsClefs({ idProjet, f: siPasVide() }),
      );

      const réf: MotClefProjet[] = [{ idMotClef, source: "projet" }];
      expect(motsClefs).to.have.deep.members(réf);
    });

    it("mots-clefs bd détectés", async () => {
      idMotClefBd = await constl.motsClefs.créerMotClef();
      await constl.bds.ajouterMotsClefs({
        idBd,
        idsMotsClefs: idMotClefBd,
      });

      const motsClefs = await obtenir<MotClefProjet[]>(({ si }) =>
        constl.projets.suivreMotsClefs({
          idProjet,
          f: si((x) => !!x?.find((m) => m.source === "bds")),
        }),
      );

      const réf: MotClefProjet[] = [
        { idMotClef, source: "projet" },
        { idMotClef: idMotClefBd, source: "bds" },
      ];
      expect(motsClefs).to.have.deep.members(réf);
    });

    it("enlever mot-clef propre", async () => {
      await constl.projets.effacerMotClef({
        idProjet,
        idMotClef,
      });

      const motsClefs = await obtenir<MotClefProjet[]>(({ si }) =>
        constl.projets.suivreMotsClefs({
          idProjet,
          f: si((x) => !!x && x.length <= 1),
        }),
      );

      const réf: MotClefProjet[] = [{ idMotClef: idMotClefBd, source: "bds" }];
      expect(motsClefs).to.have.deep.members(réf);
    });
  });

  describe("variables", function () {
    let idProjet: string;
    let idBd: string;

    let idVariable: string;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      idVariable = await constl.variables.créerVariable({
        catégorie: "horoDatage",
      });
    });

    it("rien pour commencer", async () => {
      const variables = await obtenir(({ siDéfini }) =>
        constl.projets.suivreVariables({ idProjet, f: siDéfini() }),
      );
      expect(variables).to.be.empty();
    });

    it("ajouter bd et variable", async () => {
      await constl.projets.ajouterBds({ idProjet, idsBds: [idBd] });
      const idTableau = await constl.bds.ajouterTableau({ idBd });
      await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idVariable,
      });
      const variables = await obtenir<string[]>(({ siPasVide }) =>
        constl.projets.suivreVariables({ idProjet, f: siPasVide() }),
      );

      expect(variables).to.have.members([idVariable]);
    });

    it("enlever bd et variable", async () => {
      await constl.projets.enleverBd({
        idProjet,
        idBd,
      });

      const variables = await obtenir(({ siVide }) =>
        constl.projets.suivreVariables({ idProjet, f: siVide() }),
      );
      expect(variables).to.be.empty();
    });
  });

  describe("épingles", function () {
    let idProjet: string;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
    });

    it("épinglée par défaut", async () => {
      const épingle = await obtenir<ÉpingleProjet>(({ siDéfini }) =>
        constl.projets.suivreÉpingle({ idProjet, f: siDéfini() }),
      );

      const réf: ÉpingleProjet = {
        type: "projet",
        épingle: {
          base: TOUS_DISPOSITIFS,
          bds: {
            type: "bd",
            épingle: {
              base: TOUS_DISPOSITIFS,
              données: {
                tableaux: TOUS_DISPOSITIFS,
                fichiers: DISPOSITIFS_INSTALLÉS,
              },
            },
          },
        },
      };
      expect(épingle).to.deep.equal(réf);
    });

    it("désépingler projet", async () => {
      await constl.projets.désépingler({ idProjet });

      const épingle = await obtenir(({ siNonDéfini }) =>
        constl.projets.suivreÉpingle({
          idProjet,
          f: siNonDéfini(),
        }),
      );
      expect(épingle).to.be.undefined();
    });

    it("épingler projet", async () => {
      const idProjet = await constl.projets.créerProjet({
        épingler: false,
      });
      await constl.projets.épingler({ idProjet });

      const épingle = await obtenir(({ siDéfini }) =>
        constl.projets.suivreÉpingle({ idProjet, f: siDéfini() }),
      );

      const réf: ÉpingleProjet = {
        type: "projet",
        épingle: {
          base: TOUS_DISPOSITIFS,
          bds: {
            type: "bd",
            épingle: {
              base: TOUS_DISPOSITIFS,
              données: {
                tableaux: TOUS_DISPOSITIFS,
                fichiers: DISPOSITIFS_INSTALLÉS,
              },
            },
          },
        },
      };
      expect(épingle).to.deep.equal(réf);
    });

    it("résoudre épingle - base", async () => {
      const idProjet = await constl.projets.créerProjet();
      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.projets.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idProjet,
            épingle: {
              type: "projet",
              épingle: { base: true },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolution]).to.have.members([idProjet]);
    });

    it("résoudre épingle - bds", async () => {
      const idProjet = await constl.projets.créerProjet();

      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const idTableau = await constl.bds.ajouterTableau({ idBd });

      const idDonnéesTableau = await constl.bds.tableaux.obtIdDonnées({
        idStructure: idProjet,
        idTableau,
      });

      const résolution = await obtenir<Set<string>>(({ si }) =>
        constl.projets.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idProjet,
            épingle: {
              type: "projet",
              épingle: {
                base: true,
                bds: {
                  type: "bd",
                  épingle: {
                    base: true,
                    données: {
                      tableaux: true,
                    },
                  },
                },
              },
            },
          },
          f: si((x) => !!x && x.size > 1),
        }),
      );
      expect([...résolution]).to.have.members([
        idProjet,
        idBd,
        idDonnéesTableau,
      ]);

      const résolutionSansTableaux = await obtenir<Set<string>>(
        ({ siDéfini }) =>
          constl.projets.suivreRésolutionÉpingle({
            épingle: {
              idObjet: idProjet,
              épingle: {
                type: "projet",
                épingle: {
                  base: true,
                  bds: {
                    type: "bd",
                    épingle: {
                      base: true,
                      données: {
                        tableaux: false,
                      },
                    },
                  },
                },
              },
            },
            f: siDéfini(),
          }),
      );
      expect([...résolutionSansTableaux]).to.have.members([idProjet, idBd]);
    });

    it("résoudre épingle - fichiers", async () => {
      const idProjet = await constl.projets.créerProjet();

      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const idTableau = await constl.bds.ajouterTableau({ idBd });
      const idVariable = await constl.variables.créerVariable({
        catégorie: "fichier",
      });
      const idColonne = await constl.bds.tableaux.ajouterColonne({
        idStructure: idProjet,
        idTableau,
        idVariable,
      });

      const idc = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/fichier.mp4";
      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idProjet,
        idTableau,
        éléments: [{ [idColonne]: idc }],
      });

      const idDonnéesTableau = await constl.bds.tableaux.obtIdDonnées({
        idStructure: idBd,
        idTableau,
      });

      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.projets.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idProjet,
            épingle: {
              type: "projet",
              épingle: {
                base: true,
                bds: {
                  type: "bd",
                  épingle: {
                    base: true,
                    données: {
                      tableaux: true,
                      fichiers: true,
                    },
                  },
                },
              },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolution]).to.have.members([
        idProjet,
        idBd,
        idDonnéesTableau,
        idc,
      ]);

      const résolutionSansFichers = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.projets.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idProjet,
            épingle: {
              type: "projet",
              épingle: {
                base: true,
                bds: {
                  type: "bd",
                  épingle: {
                    base: true,
                    données: {
                      tableaux: true,
                      fichiers: false,
                    },
                  },
                },
              },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolutionSansFichers]).to.have.members([idProjet, idBd]);

      const résolutionSansFichersOuTableaux = await obtenir<Set<string>>(
        ({ siDéfini }) =>
          constl.projets.suivreRésolutionÉpingle({
            épingle: {
              idObjet: idProjet,
              épingle: {
                type: "projet",
                épingle: {
                  base: true,
                  bds: {
                    type: "bd",
                    épingle: {
                      base: true,
                    },
                  },
                },
              },
            },
            f: siDéfini(),
          }),
      );
      expect([...résolutionSansFichersOuTableaux]).to.have.members([idProjet]);
    });
  });

  describe("copier", function () {
    let idProjetOrig: string;
    let idProjetCopie: string;

    let idMotClef: string;
    let idBd: string;

    let IMAGE: Uint8Array;
    let idImage: string;

    const réfNoms = {
      த: "மழை",
      हिं: "बारिश",
    };
    const réfDescrs = {
      த: "தினசரி மழை",
      हिं: "दैनिक बारिश",
    };
    const réfMétadonnées = { clef: true };

    const réfStatut: StatutDonnées = { statut: "interne" };

    before(async () => {
      IMAGE = await obtRessourceTest({
        nomFichier: "logo.svg",
      });

      idProjetOrig = await constl.projets.créerProjet();
      idMotClef = await constl.motsClefs.créerMotClef();
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });

      await constl.projets.sauvegarderNoms({
        idProjet: idProjetOrig,
        noms: réfNoms,
      });
      await constl.projets.sauvegarderDescriptions({
        idProjet: idProjetOrig,
        descriptions: réfDescrs,
      });
      await constl.projets.ajouterMotsClefs({
        idProjet: idProjetOrig,
        idsMotsClefs: idMotClef,
      });
      await constl.projets.sauvegarderMétadonnées({
        idProjet: idProjetOrig,
        métadonnées: réfMétadonnées,
      });
      idImage = await constl.projets.sauvegarderImage({
        idProjet: idProjetOrig,
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });

      await constl.projets.ajouterBds({
        idProjet: idProjetOrig,
        idsBds: [idBd],
      });
    });

    it("copier le projet", async () => {
      idProjetCopie = await constl.projets.copierProjet({
        idProjet: idProjetOrig,
      });
      expect(
        await constl.projets.identifiantValide({ identifiant: idProjetCopie }),
      ).to.be.true();
    });

    it("les noms sont copiés", async () => {
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.projets.suivreNoms({ idProjet: idProjetCopie, f: siPasVide() }),
      );
      expect(noms).to.deep.equal(réfNoms);
    });

    it("les descriptions sont copiées", async () => {
      const descrs = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.projets.suivreDescriptions({
          idProjet: idProjetCopie,
          f: siPasVide(),
        }),
      );
      expect(descrs).to.deep.equal(réfDescrs);
    });

    it("les métadonnées sont copiées", async () => {
      const métadonnées = await obtenir<Métadonnées>(({ siPasVide }) =>
        constl.projets.suivreMétadonnées({
          idProjet: idProjetCopie,
          f: siPasVide(),
        }),
      );
      expect(métadonnées).to.deep.equal(réfMétadonnées);
    });

    it("les mots-clefs sont copiés", async () => {
      const motsClefs = await obtenir<MotClefProjet[]>(({ siPasVide }) =>
        constl.projets.suivreMotsClefs({
          idProjet: idProjetCopie,
          f: siPasVide(),
        }),
      );
      expect(motsClefs).to.have.deep.members([{ idMotClef, source: "projet" }]);
    });

    it("le statut est copié", async () => {
      const statut = await obtenir<PartielRécursif<StatutDonnées> | undefined>(
        ({ siDéfini }) =>
          constl.projets.suivreStatut({
            idProjet: idProjetCopie,
            f: siDéfini(),
          }),
      );
      expect(statut).to.deep.equal(réfStatut);
    });

    it("l'image est copiée", async () => {
      const image = await obtenir<{
        image: Uint8Array;
        idImage: string;
      } | null>(({ siDéfini }) =>
        constl.projets.suivreImage({ idProjet: idProjetCopie, f: siDéfini() }),
      );
      expect(image).to.deep.equal({ idImage, image: IMAGE });
    });

    it("les bds sont copiées", async () => {
      const bds = await obtenir<string[]>(({ siPasVide }) =>
        constl.projets.suivreBds({ idProjet: idProjetCopie, f: siPasVide() }),
      );
      expect(bds).to.have.members([idBd]);
    });

    it("source copie établie", async () => {
      const copiéeDe = await obtenir<{ id?: string }>(({ siDéfini }) =>
        constl.projets.suivreSource({ idProjet: idProjetCopie, f: siDéfini() }),
      );
      expect(copiéeDe).to.deep.equal({ id: idProjetOrig });
    });
  });

  describe("empreinte", function () {
    let idProjet: string;
    let idBd: string;
    let idTableau: string;
    let idVariable: string;
    let idColonne: string;

    let empreinte: string;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      idTableau = await constl.bds.ajouterTableau({ idBd });
      idColonne = await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idVariable,
      });
    });

    it("sans bds", async () => {
      empreinte = await obtenir<string>(({ siDéfini }) =>
        constl.projets.suivreEmpreinteTête({
          idProjet,
          f: siDéfini(),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("ajout bds", async () => {
      await constl.projets.ajouterBds({
        idProjet,
        idsBds: idBd,
      });

      empreinte = await obtenir<string>(({ si }) =>
        constl.projets.suivreEmpreinteTête({
          idProjet,
          f: si((x) => x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("changement nom bds détecté", async () => {
      await constl.bds.sauvegarderNom({
        idBd,
        langue: "fr",
        nom: "Insectes de Montréal",
      });

      empreinte = await obtenir<string>(({ si }) =>
        constl.projets.suivreEmpreinteTête({
          idProjet,
          f: si((x) => x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("changement nom projet détecté", async () => {
      await constl.projets.sauvegarderNom({
        idProjet,
        langue: "fr",
        nom: "Science citoyenne",
      });

      empreinte = await obtenir<string>(({ si }) =>
        constl.projets.suivreEmpreinteTête({
          idProjet,
          f: si((x) => x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("changement données bds détecté", async () => {
      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idBd,
        idTableau,
        éléments: [{ [idColonne]: 2 }],
      });

      empreinte = await obtenir<string>(({ si }) =>
        constl.projets.suivreEmpreinteTête({
          idProjet,
          f: si((x) => x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("changement noms variable détecté", async () => {
      await constl.variables.sauvegarderNom({
        idVariable,
        langue: "fr",
        nom: "Population observée",
      });

      empreinte = await obtenir<string>(({ si }) =>
        constl.projets.suivreEmpreinteTête({
          idProjet,
          f: si((x) => x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });
  });

  describe("auteurs", function () {
    let idProjet: string;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
    });

    it("compte créateur autorisé pour commencer", async () => {
      const auteurs = await obtenir<InfoAuteur[]>(({ siPasVide }) =>
        constl.projets.suivreAuteurs({
          idProjet,
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
      await constl.projets.inviterAuteur({
        idProjet,
        idCompte: idsComptes[1],
        rôle: MEMBRE,
      });
      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.projets.suivreAuteurs({
          idProjet,
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
      await constls[1].projets.ajouterÀMesProjets({ idProjet });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.projets.suivreAuteurs({
          idProjet,
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
        constls[1].projets.suivrePermission({
          idObjet: idProjet,
          f: siDéfini(),
        }),
      );

      // Modification du projet
      await constls[1].projets.sauvegarderNom({
        idProjet,
        langue: "fr",
        nom: "Pédologie",
      });
      const noms = await obtenir(({ siPasVide }) =>
        constls[0].projets.suivreNoms({ idProjet, f: siPasVide() }),
      );
      expect(noms).to.deep.equal({ fr: "Pédologie" });
    });

    it("promotion à modératrice", async () => {
      await constl.projets.inviterAuteur({
        idProjet,
        idCompte: idsComptes[1],
        rôle: MODÉRATRICE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.projets.suivreAuteurs({
          idProjet,
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
        "/nébuleuse/compte/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX";
      await constl.projets.inviterAuteur({
        idProjet,
        idCompte: compteHorsLigne,
        rôle: MEMBRE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.projets.suivreAuteurs({
          idProjet,
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
          rôle: MODÉRATRICE,
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

  describe("exportation", function () {
    let idc: string;

    const idcIndisponible = "QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n";
    const idBdIndisponible =
      "/constl/bd/orbitdb/zdpuAximNmZyUWXGCaLmwSEGDeWmuqfgaoogA7KNSa1B2DAAF";

    before(async () => {
      const octets = await obtRessourceTest({
        nomFichier: "logo.svg",
      });
      idc = await constl.services["hélia"].ajouterFichierÀSFIP({
        contenu: octets,
        nomFichier: "logo.svg",
      });
    });

    describe("suivi données exportation", function () {
      let idProjet: string;
      let idBd1: string;
      let idBd2: string;

      const nomProjetFr = "mon projet de science citoyenne";

      before(async () => {
        idProjet = await constl.projets.créerProjet();

        idBd1 = await constl.bds.créerBd({ licence: "ODbl-1_0" });
        idBd2 = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      });

      it("nom projet", async () => {
        const pDonnées = obtenir<DonnéesProjetExportées>(({ si }) =>
          constl.projets.suivreDonnéesExportation({
            idProjet,
            langues: ["fr"],
            f: si((x) => !!x && !idProjet.includes(x.nomProjet)),
          }),
        );

        await constl.projets.sauvegarderNom({
          idProjet,
          langue: "fr",
          nom: nomProjetFr,
        });

        const données = await pDonnées;
        expect(données.nomProjet).to.equal(nomProjetFr);
      });

      it("bds", async () => {
        const pDonnées = obtenir<DonnéesProjetExportées>(({ si }) =>
          constl.projets.suivreDonnéesExportation({
            idProjet,
            langues: ["fr"],
            f: si((x) => !!x && x.bds.length >= 2),
          }),
        );

        await constl.projets.ajouterBds({
          idProjet,
          idsBds: [idBd1, idBd2],
        });

        const données = await pDonnées;
        expect(données.bds.map((bd) => bd.nomBd)).to.have.members(
          [idBd1, idBd2].map((idBd) => idBd.split("/").pop()),
        );
      });

      it("bd indisponible", async () => {
        await constl.projets.ajouterBds({
          idProjet,
          idsBds: [idBdIndisponible],
        });

        const données = await obtenir<DonnéesProjetExportées>(({ si }) =>
          constl.projets.suivreDonnéesExportation({
            idProjet,
            langues: ["fr"],
            f: si((x) => !!x && x.bds.length >= 2),
          }),
        );

        // Les bds indisponibles n'apparaissent pas dans les résultats
        expect(données.bds.map((bd) => bd.nomBd)).to.have.members(
          [idBd1, idBd2].map((idBd) => idBd.split("/").pop()),
        );
      });
    });

    describe("à document", function () {
      let idProjet: string;
      let idBd1: string;
      let idBd2: string;

      let idTableau: string;
      let idColonneFichier: string;

      let données: DonnéesFichierProjetExportées;

      before(async () => {
        idProjet = await constl.projets.créerProjet();

        idBd1 = await constl.bds.créerBd({ licence: "ODbl-1_0" });
        idBd2 = await constl.bds.créerBd({ licence: "ODbl-1_0" });

        idTableau = await constl.bds.ajouterTableau({ idBd: idBd1 });
        idColonneFichier = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd1,
          idTableau,
        });

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd1,
          idTableau,
          éléments: [{ [idColonneFichier]: idc }],
        });

        données = await constl.projets.exporterDonnées({
          idProjet,
          langues: ["fr"],
        });
      });

      it("nom document - spécifié", async () => {
        const donnéesAvecNom = await constl.projets.exporterDonnées({
          idProjet,
          nomFichier: "mon fichier",
        });
        expect(donnéesAvecNom.nomFichier).to.equal("mon fichier");
      });

      it("nom document - non spécifié", async () => {
        expect(données.nomFichier).to.equal(enleverPréfixesEtOrbite(idProjet));
      });

      it("bds", async () => {
        expect(données.docus.map((d) => d.nom)).to.have.members(
          [idBd1, idBd2].map(enleverPréfixeOrbite),
        );
      });

      it("fichiers sfip de toutes les bds", async () => {
        expect(données.documentsMédias).to.include([idc]);
      });

      it("exportable même si bd indisponible", async () => {
        const idProjetTest = await constl.projets.créerProjet();
        await constl.projets.ajouterBds({
          idProjet: idProjetTest,
          idsBds: [idBd1, idBdIndisponible],
        });
        const { docus, documentsMédias } = await constl.projets.exporterDonnées(
          {
            idProjet: idProjetTest,
            langues: ["fr"],
          },
        );

        expect(docus.map((d) => d.nom)).to.have.members([idBd1]);
        expect(documentsMédias).to.have.members([idc]);
      });

      it("exportable même si fichier sfip indisponible", async () => {
        it("exportable même si fichier SFIP indisponible", async () => {
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd2,
            idTableau,
            éléments: [
              {
                [idColonneFichier]: idcIndisponible,
              },
            ],
          });

          const { documentsMédias } = await constl.projets.exporterDonnées({
            idProjet,
            langues: ["fr"],
          });
          expect(documentsMédias).to.have.members([idc, idcIndisponible]);
        });
      });
    });

    describe("à fichier", function () {
      let idProjet: string;
      let idBd1: string;
      let idBd2: string;
      let idTableau: string;
      let idColonne: string;

      let zip: JSZip;

      const nomFichier = "mes données";
      const nomBd1 = "Ma BD";

      let dossier: string;
      let effacer: () => void;

      before(async () => {
        ({ dossier, effacer } = await dossierTempo());

        idProjet = await constl.projets.créerProjet();

        idBd1 = await constl.bds.créerBd({ licence: "ODbl-1_0" });
        idBd2 = await constl.bds.créerBd({ licence: "ODbl-1_0" });

        idTableau = await constl.bds.ajouterTableau({ idBd: idBd1 });

        idColonne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd1,
          idTableau,
        });

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd1,
          idTableau,
          éléments: [{ [idColonne]: idc }],
        });

        await constl.bds.sauvegarderNoms({ idBd: idBd1, noms: { fr: nomBd1 } });

        await constl.projets.ajouterBds({ idProjet, idsBds: [idBd1, idBd2] });
      });

      after(async () => {
        if (effacer) effacer();
      });

      it("le fichier zip existe", async () => {
        await constl.projets.exporterÀFichier({
          idProjet,
          nomFichier,
          dossier,
          formatDocu: "ods",
        });

        const nomZip = join(dossier, nomFichier + ".zip");
        expect(existsSync(nomZip)).to.be.true();
        zip = await JSZip.loadAsync(readFileSync(nomZip));
      });

      it("les bds sont exportées", async () => {
        const contenuBd1 = zip.files[`${nomBd1}.ods`];
        expect(contenuBd1).to.exist();

        const contenuBd2 = zip.files[`${enleverPréfixesEtOrbite(idBd2)}.ods`];
        expect(contenuBd2).to.exist();
      });

      it("le dossier pour les données SFIP existe", async () => {
        const contenu = zip.files["médias/"];
        expect(contenu?.dir).to.be.true();
      });

      it("les fichiers SFIP existent", async () => {
        const contenu = zip.files[["médias", idc.replace("/", "-")].join("/")];
        expect(contenu).to.exist();
      });

      it("fichier SFIP indisponible", async () => {
        const nomFichierTest = "projet avec documents indisponibles";

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd1,
          idTableau,
          éléments: [{ [idColonne]: idcIndisponible }],
        });

        await constl.projets.exporterÀFichier({
          idProjet,
          nomFichier: nomFichierTest,
          dossier,
          formatDocu: "ods",
        });

        const nomZip = join(dossier, nomFichierTest + ".zip");
        zip = await JSZip.loadAsync(readFileSync(nomZip));

        const contenu = zip.files[["médias", idc.replace("/", "-")].join("/")];
        expect(contenu).to.exist();

        const contenuIndisponible =
          zip.files[["médias", idcIndisponible.replace("/", "-")].join("/")];
        expect(contenuIndisponible).to.not.exist();
      });
    });
  });
});
