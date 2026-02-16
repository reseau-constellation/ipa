import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { expect } from "aegir/chai";
import { v4 as uuidv4 } from "uuid";
import JSZip from "jszip";
import { dossierTempo } from "@constl/utils-tests";
import {
  DISPOSITIFS_INSTALLÉS,
  TOUS_DISPOSITIFS,
} from "@/v2/nébuleuse/services/favoris.js";
import {
  MEMBRE,
  MODÉRATRICE,
} from "@/v2/nébuleuse/services/compte/accès/consts.js";
import { obtRessourceTest } from "test/ressources/index.js";
import { créerConstellation, type Constellation } from "@/v2/index.js";
import { moyenne } from "@/v2/utils.js";
import { créerConstellationsTest, obtenir } from "./utils.js";
import { obtenirOptionsLibp2pTest } from "./nébuleuse/services/utils.js";
import type {
  InfoAuteur,
  Métadonnées,
  StatutDonnées,
  TraducsTexte,
  PartielRécursif,
} from "@/v2/types.js";
import type { DonnéesFichierBdExportées } from "@/v2/utils.js";
import type {
  DifférenceBds,
  DonnéesBdExportées,
  SchémaBd,
  ScoreBd,
  ÉpingleBd,
} from "@/v2/bds/bds.js";
import type { DonnéesRangéeTableau, InfoColonne } from "@/v2/tableaux.js";
import type { DonnéesRangéeTableauAvecId } from "@/v2/bds/tableaux.js";
import type { RègleBornes } from "@/v2/règles.js";

describe("BDs", function () {
  let fermer: () => Promise<void>;
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

  describe("création bds", function () {
    let idBd: string;

    it("pas de bds pour commencer", async () => {
      const bds = await obtenir(({ siDéfini }) =>
        constl.bds.suivreBds({
          f: siDéfini(),
        }),
      );
      expect(bds).to.be.an.empty("array");
    });

    it("création", async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      expect(constl.bds.identifiantValide(idBd)).to.be.true();
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

    it("détectée sur un autre compte", async () => {
      const sesBds = await obtenir<string[]>(({ siDéfini }) =>
        constls[1].bds.suivreBds({
          f: siDéfini(),
          idCompte: idsComptes[0],
        }),
      );
      expect(sesBds).have.members([idBd]);
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
        constl.bds.suivreNoms({ idBd, f: siDéfini() }),
      );
      expect(Object.keys(noms).length).to.equal(0);
    });

    it("ajouter un nom", async () => {
      await constl.bds.sauvegarderNom({
        idBd,
        langue: "fr",
        nom: "Alphabets",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreNoms({
          idBd,
          f: si((n) => !!n && Object.keys(n).length > 0),
        }),
      );
      expect(noms.fr).to.equal("Alphabets");
    });

    it("ajouter des noms", async () => {
      await constl.bds.sauvegarderNoms({
        idBd,
        noms: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreNoms({
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
      await constl.bds.sauvegarderNom({
        idBd,
        langue: "fr",
        nom: "Systèmes d'écriture",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreNoms({
          idBd,
          f: si((n) => n?.["fr"] !== "Alphabets"),
        }),
      );

      expect(noms?.fr).to.equal("Systèmes d'écriture");
    });

    it("effacer un nom", async () => {
      await constl.bds.effacerNom({ idBd, langue: "fr" });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreNoms({ idBd, f: si((n) => !!n && !n["fr"]) }),
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
        constl.bds.suivreDescriptions({ idBd, f: siDéfini() }),
      );
      expect(Object.keys(descrs).length).to.equal(0);
    });

    it("ajouter une description", async () => {
      await constl.bds.sauvegarderDescription({
        idBd,
        langue: "fr",
        description: "Alphabets",
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreDescriptions({ idBd, f: si((x) => !!x?.["fr"]) }),
      );
      expect(descrs.fr).to.equal("Alphabets");
    });

    it("ajouter des descriptions", async () => {
      await constl.bds.sauvegarderDescriptions({
        idBd,
        descriptions: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreDescriptions({
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
      await constl.bds.sauvegarderDescription({
        idBd,
        langue: "fr",
        description: "Systèmes d'écriture",
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreDescriptions({
          idBd,
          f: si((x) => x?.["fr"] !== "Alphabets"),
        }),
      );
      expect(descrs?.fr).to.equal("Systèmes d'écriture");
    });

    it("effacer une description", async () => {
      await constl.bds.effacerDescription({ idBd, langue: "fr" });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.bds.suivreDescriptions({ idBd, f: si((x) => !!x && !x["fr"]) }),
      );
      expect(descrs).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("métadonnées", function () {
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("pas de métadonnées pour commencer", async () => {
      const métadonnées = await obtenir<Métadonnées>(({ siDéfini }) =>
        constl.bds.suivreMétadonnées({ idBd, f: siDéfini() }),
      );
      expect(Object.keys(métadonnées).length).to.equal(0);
    });

    it("ajouter une métadonnée", async () => {
      await constl.bds.sauvegarderMétadonnée({
        idBd,
        clef: "clef1",
        valeur: true,
      });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.bds.suivreMétadonnées({
          idBd,
          f: si((n) => !!n && Object.keys(n).length > 0),
        }),
      );
      expect(métadonnées.clef1).to.be.true();
    });

    it("ajouter des métadonnées", async () => {
      await constl.bds.sauvegarderMétadonnées({
        idBd,
        métadonnées: {
          clef2: 123,
          clef3: "du texte",
        },
      });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.bds.suivreMétadonnées({
          idBd,
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
      await constl.bds.sauvegarderMétadonnée({
        idBd,
        clef: "clef1",
        valeur: false,
      });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.bds.suivreMétadonnées({
          idBd,
          f: si((n) => n?.["clef1"] !== true),
        }),
      );

      expect(métadonnées?.clef1).to.be.false();
    });

    it("effacer une métadonnée", async () => {
      await constl.bds.effacerMétadonnée({ idBd, clef: "clef1" });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.bds.suivreMétadonnées({
          idBd,
          f: si((n) => !!n && !n["clef1"]),
        }),
      );
      expect(métadonnées).to.deep.equal({ clef2: 123, clef3: "du texte" });
    });
  });

  describe("mots-clefs", function () {
    let idMotClef: string;
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("pas de mots-clefs pour commencer", async () => {
      const motsClefs = await obtenir<string[]>(({ siDéfini }) =>
        constl.bds.suivreMotsClefs({
          idBd,
          f: siDéfini(),
        }),
      );
      expect(motsClefs).to.be.an.empty("array");
    });

    it("ajout d'un mot-clef", async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
      await constl.bds.ajouterMotsClefs({
        idBd,
        idsMotsClefs: idMotClef,
      });

      const motsClefs = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.suivreMotsClefs({ idBd, f: siPasVide() }),
      );
      expect(Array.isArray(motsClefs)).to.be.true();
      expect(motsClefs.length).to.equal(1);
    });

    it("effacer un mot-clef", async () => {
      await constl.bds.effacerMotClef({ idBd, idMotClef });

      const motsClefs = await obtenir<string[]>(({ siVide }) =>
        constl.bds.suivreMotsClefs({
          idBd,
          f: siVide(),
        }),
      );
      expect(motsClefs).to.be.an.empty("array");
    });
  });

  describe("tableaux", function () {
    let idTableau: string;
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("pas de tableaux pour commencer", async () => {
      const tableaux = await obtenir<string[]>(({ siDéfini }) =>
        constl.bds.suivreTableaux({
          idBd,
          f: siDéfini(),
        }),
      );
      expect(tableaux).to.be.an.empty("array");
    });

    it("ajout d'un tableau", async () => {
      idTableau = await constl.bds.ajouterTableau({
        idBd,
      });
      expect(typeof idTableau).to.equal("string");

      const tableaux = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.suivreTableaux({
          idBd,
          f: siPasVide(),
        }),
      );
      expect(tableaux).to.have.members([idTableau]);
    });

    it("suivre colonnes tableau", async () => {
      const idVariable = await constl.variables.créerVariable({
        catégorie: "vidéo",
      });
      const idColonne = await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idVariable,
      });
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
          variable: idVariable,
        },
      ];
      expect(colonnes).to.have.deep.members(réf);
    });

    it.skip("réordonner tableaux", async () => {
      console.log("pas encore possible");
    });

    it("effacer un tableau", async () => {
      await constl.bds.effacerTableau({ idBd, idTableau });

      const tableaux = await obtenir<string[]>(({ siVide }) =>
        constl.bds.suivreTableaux({
          idBd,
          f: siVide(),
        }),
      );
      expect(tableaux).to.be.an.empty("array");
    });
  });

  describe("variables", function () {
    let idTableau: string;
    let idVariable: string;
    let idColonne: string;
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("pas de variables pour commencer", async () => {
      const variables = await obtenir<string[]>(({ siDéfini }) =>
        constl.bds.suivreVariables({
          idBd,
          f: siDéfini(),
        }),
      );
      expect(variables).to.be.an.empty("array");
    });

    it("ajout d'un tableau et d'une variable", async () => {
      idTableau = await constl.bds.ajouterTableau({ idBd });
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      idColonne = await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idVariable,
      });

      const variables = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.suivreVariables({
          idBd,
          f: siPasVide(),
        }),
      );
      expect(Array.isArray(variables)).to.be.true();
      expect(variables.length).to.equal(1);
      expect(variables[0]).to.equal(idVariable);
    });

    it("effacer une variable", async () => {
      await constl.bds.tableaux.effacerColonne({
        idStructure: idBd,
        idTableau,
        idColonne,
      });
      const variables = await obtenir<string[]>(({ siVide }) =>
        constl.bds.suivreVariables({
          idBd,
          f: siVide(),
        }),
      );
      expect(variables).to.be.an.empty("array");
    });
  });

  describe("image", function () {
    let IMAGE: Uint8Array;
    let idBd: string;

    before(async () => {
      IMAGE = await obtRessourceTest({
        nomFichier: "logo.svg",
      });

      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("aucune image pour commencer", async () => {
      const image = await obtenir(({ siNul }) =>
        constl.bds.suivreImage({ idBd, f: siNul() }),
      );
      expect(image).to.be.null();
    });

    it("ajouter image", async () => {
      const idImage = await constl.bds.sauvegarderImage({
        idBd,
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });
      expect(idImage).to.endWith("logo.svg");

      const image = await obtenir<{
        image: Uint8Array;
        idImage: string;
      } | null>(({ siPasNul }) =>
        constl.bds.suivreImage({ idBd, f: siPasNul() }),
      );

      const réf = { idImage, image: IMAGE };
      expect(image).to.deep.equal(réf);
    });

    it("effacer image", async () => {
      await constl.bds.effacerImage({ idBd });
      const image = await obtenir(({ siNul }) =>
        constl.bds.suivreImage({ idBd, f: siNul() }),
      );
      expect(image).to.be.null();
    });
  });

  describe("licences", function () {
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({
        licence: "ODbl-1_0",
        licenceContenu: "CC-BY-4_0",
      });
    });

    it("licence originale présente", async () => {
      const licence = await obtenir(({ siDéfini }) =>
        constl.bds.suivreLicence({
          idBd,
          f: siDéfini(),
        }),
      );

      expect(licence).to.equal("ODbl-1_0");
    });

    it("changement de licence", async () => {
      await constl.bds.changerLicence({ idBd, licence: "ODC-BY-1_0" });

      const licence = await await obtenir(({ si }) =>
        constl.bds.suivreLicence({
          idBd,
          f: si((l) => l !== "ODbl-1_0"),
        }),
      );
      expect(licence).to.equal("ODC-BY-1_0");
    });

    it("licence contenu originale", async () => {
      const licence = await obtenir(({ siDéfini }) =>
        constl.bds.suivreLicenceContenu({
          idBd,
          f: siDéfini(),
        }),
      );

      expect(licence).to.equal("CC-BY-4_0");
    });

    it("changement de licence contenu", async () => {
      await constl.bds.changerLicenceContenu({
        idBd,
        licenceContenu: "CC-BY-SA-4_0",
      });

      const licence = await await obtenir(({ si }) =>
        constl.bds.suivreLicence({
          idBd,
          f: si((l) => l !== "CC-BY-4_0"),
        }),
      );
      expect(licence).to.equal("CC-BY-SA-4_0");
    });
  });

  describe("épingles", function () {
    it("désépingler bd", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      await constl.bds.désépingler({ idBd });

      const épingle = await obtenir(({ siNonDéfini }) =>
        constl.bds.suivreÉpingle({
          idBd,
          f: siNonDéfini(),
        }),
      );
      expect(épingle).to.be.undefined();
    });

    it("épingler bd", async () => {
      const idBd = await constl.bds.créerBd({
        licence: "ODbl-1_0",
        épingler: false,
      });
      await constl.bds.épingler({ idBd });

      const épingle = await obtenir(({ siDéfini }) =>
        constl.bds.suivreÉpingle({ idBd, f: siDéfini() }),
      );

      const réf: ÉpingleBd = {
        type: "bd",
        épingle: {
          base: TOUS_DISPOSITIFS,
          données: {
            tableaux: TOUS_DISPOSITIFS,
            fichiers: DISPOSITIFS_INSTALLÉS,
          },
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
              épingle: { base: true },
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
      const idDonnéesTableau = await constl.bds.tableaux.obtIdDonnées({
        idStructure: idBd,
        idTableau,
      });

      const résolution = await obtenir<Set<string>>(({ si }) =>
        constl.bds.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idBd,
            épingle: {
              type: "bd",
              épingle: {
                base: true,
                données: {
                  tableaux: true,
                },
              },
            },
          },
          f: si((x) => !!x && x.size > 1),
        }),
      );
      expect([...résolution]).to.have.members([idBd, idDonnéesTableau]);

      const résolutionSansTableaux = await obtenir<Set<string>>(
        ({ siDéfini }) =>
          constl.bds.suivreRésolutionÉpingle({
            épingle: {
              idObjet: idBd,
              épingle: {
                type: "bd",
                épingle: {
                  base: true,
                },
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
      const idDonnéesTableau = await constl.bds.tableaux.obtIdDonnées({
        idStructure: idBd,
        idTableau,
      });

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
              épingle: {
                base: true,
                données: {
                  tableaux: true,
                  fichiers: true,
                },
              },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolution]).to.have.members([idBd, idDonnéesTableau, idc]);

      const résolutionSansFichers = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.bds.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idBd,
            épingle: {
              type: "bd",
              épingle: {
                base: true,
              },
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
              épingle: {
                base: true,
                données: {
                  tableaux: true,
                  fichiers: true,
                },
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

      const statut = await obtenir<PartielRécursif<StatutDonnées> | null>(
        ({ si }) =>
          constl.bds.suivreStatut({
            idBd,
            f: si((x) => x?.statut !== "active"),
          }),
      );

      expect(statut).to.deep.equal(nouveauStatut);
    });
  });

  describe("schémas", function () {
    const idColonneLangue = "langue";
    const idColonneClef = "clef";
    const idColonneTraduc = "traduc";
    const idColonneNomLangue = "nom langue";

    const idTableauTraducs = "tableau traducs";
    const idTableauLangues = "tableau langues";

    const licence = "ODbl-1_0";
    const licenceContenu = "CC-BY-SA-4_0";
    const clefUnique = "clef unique pour cette bd";
    const métadonnées = { clef: true, clef2: [1, 2, 3] };
    const statut: StatutDonnées = { statut: "interne" };

    let idVarClef: string;
    let idVarTraduc: string;
    let idVarLangue: string;
    let idVarNomLangue: string;

    let idMotClef: string;
    let idNuée: string;
    let idBd: string;

    let schéma: SchémaBd;

    before(async () => {
      idVarClef = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarTraduc = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarLangue = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarNomLangue = await constl.variables.créerVariable({
        catégorie: "chaîne",
      });

      idMotClef = await constl.motsClefs.créerMotClef();
      idNuée = await constl.nuées.créerNuée();

      schéma = {
        licence,
        licenceContenu,
        motsClefs: [idMotClef],
        métadonnées,
        statut,
        tableaux: {
          [idTableauTraducs]: {
            cols: [
              {
                idVariable: idVarClef,
                idColonne: idColonneClef,
                index: true,
              },
              {
                idVariable: idVarLangue,
                idColonne: idColonneLangue,
                index: true,
              },
              {
                idVariable: idVarTraduc,
                idColonne: idColonneTraduc,
              },
            ],
          },
          [idTableauLangues]: {
            cols: [
              {
                idVariable: idVarLangue,
                idColonne: idColonneLangue,
              },
              {
                idVariable: idVarNomLangue,
                idColonne: idColonneNomLangue,
              },
            ],
          },
        },
        clefUnique,
      };
    });

    describe("création bd à partir de schéma", function () {
      before(async () => {
        idBd = await constl.bds.créerBdDeSchéma({ schéma });
      });

      it("licence", async () => {
        const licenceBd = await obtenir<string>(({ siDéfini }) =>
          constl.bds.suivreLicence({
            idBd,
            f: siDéfini(),
          }),
        );
        expect(licenceBd).to.equal(licence);
      });

      it("licence contenu", async () => {
        const licenceContenuBd = await obtenir<string>(({ siDéfini }) =>
          constl.bds.suivreLicenceContenu({
            idBd,
            f: siDéfini(),
          }),
        );
        expect(licenceContenuBd).to.equal(licenceContenu);
      });

      it("métadonnées", async () => {
        const métadonnéesBd = await obtenir<Métadonnées>(({ si }) =>
          constl.bds.suivreMétadonnées({
            idBd,
            f: si((x) => !!x && Object.keys(x).length > 0),
          }),
        );

        expect(métadonnéesBd).to.deep.equal(métadonnées);
      });

      it("mots-clefs", async () => {
        const motsClefs = await obtenir<string[]>(({ siPasVide }) =>
          constl.bds.suivreMotsClefs({ idBd, f: siPasVide() }),
        );

        expect(motsClefs).to.have.members([idMotClef]);
      });

      it("statut", async () => {
        const statutBd = await obtenir<PartielRécursif<StatutDonnées> | undefined>(
          ({ siPasNul }) =>
            constl.bds.suivreStatut({
              idBd,
              f: siPasNul(),
            }),
        );

        expect(statutBd).to.deep.equal(statut);
      });

      it("nuées", async () => {
        const nuéesBd = await obtenir<string[]>(({ siPasVide }) =>
          constl.bds.suivreNuées({
            idBd,
            f: siPasVide(),
          }),
        );

        expect(nuéesBd).to.have.members([idNuée]);
      });

      it("tableaux", async () => {
        const tableaux = await obtenir<string[]>(({ siPasVide }) =>
          constl.bds.suivreTableaux({
            idBd,
            f: siPasVide(),
          }),
        );

        expect(tableaux).to.have.members([idTableauTraducs, idTableauLangues]);
      });

      it("colonnes", async () => {
        const colonnes = await obtenir<InfoColonne[]>(({ si }) =>
          constl.bds.tableaux.suivreColonnes({
            idStructure: idBd,
            idTableau: idTableauTraducs,
            f: si((c) => c !== undefined && c.length > 1),
          }),
        );

        const réf: InfoColonne[] = [
          {
            id: idColonneClef,
            variable: idVarClef,
            index: true,
          },
          {
            id: idColonneLangue,
            variable: idVarLangue,
            index: true,
          },
          {
            id: idColonneTraduc,
            variable: idVarTraduc,
          },
        ];
        expect(colonnes).to.have.deep.members(réf);
      });

      it("clef unique", async () => {
        const clefUniqueBd = await obtenir<string>(({ siDéfini }) =>
          constl.bds.suivreClefUnique({ idBd, f: siDéfini() }),
        );
        expect(clefUniqueBd).to.equal(clefUnique);
      });
    });

    describe("génération de schéma", async () => {
      it("schéma complet", async () => {
        const schémaGénéré = await constl.bds.créerSchémaDeBd({ idBd });

        expect(schémaGénéré).to.deep.equal(schéma);
      });
    });
  });

  describe("nuées", function () {
    let idBd: string;
    let idNuée: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODBl-1_0" });
      idNuée = await constl.nuées.créerNuée();
    });

    it("aucune nuée pour commencer", async () => {
      const nuées = await obtenir<string[]>(({ siDéfini }) =>
        constl.bds.suivreNuées({ idBd, f: siDéfini() }),
      );
      expect(nuées).to.be.empty();
    });

    it("rejoindre nuée", async () => {
      await constl.bds.rejoindreNuée({ idBd, idNuée });

      const nuées = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.suivreNuées({ idBd, f: siPasVide() }),
      );
      expect(nuées).to.have.members([idNuée]);
    });

    it("quitter nuée", async () => {
      await constl.bds.quitterNuée({ idBd, idNuée });

      const nuées = await obtenir<string[]>(({ siDéfini }) =>
        constl.bds.suivreNuées({ idBd, f: siDéfini() }),
      );
      expect(nuées).to.be.empty();
    });
  });

  describe("différences", function () {
    let idBd: string;
    let idBdRéf: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODBl-1_0" });
      idBdRéf = await constl.bds.créerBd({ licence: "ODBl-1_0" });
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

  describe("copier", function () {
    let idBdOrig: string;
    let idBdCopie: string;

    let idMotClef: string;
    let idVariable: string;
    let idTableau: string;

    let donnéesRéf: DonnéesRangéeTableau[];

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
    const réfLicence = "ODbl-1_0";
    const réfLicenceContenu = "CC-BY-SA-4_0";

    const réfMétadonnées = { clef: true };

    const réfStatut: StatutDonnées = { statut: "interne" };

    before(async () => {
      IMAGE = await obtRessourceTest({
        nomFichier: "logo.svg",
      });

      idBdOrig = await constl.bds.créerBd({
        licence: réfLicence,
        licenceContenu: réfLicenceContenu,
      });
      idMotClef = await constl.motsClefs.créerMotClef();

      await constl.bds.sauvegarderNoms({
        idBd: idBdOrig,
        noms: réfNoms,
      });
      await constl.bds.sauvegarderDescriptions({
        idBd: idBdOrig,
        descriptions: réfDescrs,
      });
      await constl.bds.ajouterMotsClefs({
        idBd: idBdOrig,
        idsMotsClefs: idMotClef,
      });
      await constl.bds.sauvegarderMétadonnées({
        idBd: idBdOrig,
        métadonnées: réfMétadonnées,
      });
      idImage = await constl.bds.sauvegarderImage({
        idBd: idBdOrig,
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });

      idTableau = await constl.bds.ajouterTableau({ idBd: idBdOrig });

      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      const idColonne = await constl.bds.tableaux.ajouterColonne({
        idStructure: idBdOrig,
        idTableau,
        idVariable,
      });

      donnéesRéf = [
        {
          [idColonne]: 1,
        },
        {
          [idColonne]: 2,
        },
        {
          [idColonne]: 0,
        },
      ];

      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idBdOrig,
        idTableau,
        éléments: donnéesRéf,
      });
    });

    it("copier la bd", async () => {
      idBdCopie = await constl.bds.copierBd({ idBd: idBdOrig });
      expect(idBdCopie).to.be.a("string");
    });

    it("les noms sont copiés", async () => {
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.bds.suivreNoms({ idBd: idBdCopie, f: siPasVide() }),
      );
      expect(noms).to.deep.equal(réfNoms);
    });

    it("les descriptions sont copiées", async () => {
      const descrs = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.bds.suivreDescriptions({ idBd: idBdCopie, f: siPasVide() }),
      );
      expect(descrs).to.deep.equal(réfDescrs);
    });

    it("les métadonnées sont copiées", async () => {
      const métadonnées = await obtenir<Métadonnées>(({ siPasVide }) =>
        constl.bds.suivreMétadonnées({ idBd: idBdCopie, f: siPasVide() }),
      );
      expect(métadonnées).to.deep.equal(réfMétadonnées);
    });

    it("la licence est copiée", async () => {
      const licence = await obtenir<string>(({ siDéfini }) =>
        constl.bds.suivreLicence({ idBd: idBdCopie, f: siDéfini() }),
      );
      expect(licence).to.equal(réfLicence);
    });

    it("la licence du contenu est copiée", async () => {
      const licenceContenu = await obtenir<string>(({ siDéfini }) =>
        constl.bds.suivreLicenceContenu({ idBd: idBdCopie, f: siDéfini() }),
      );
      expect(licenceContenu).to.equal(réfLicenceContenu);
    });

    it("les mots-clefs sont copiés", async () => {
      const motsClefs = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.suivreMotsClefs({ idBd: idBdCopie, f: siPasVide() }),
      );
      expect(motsClefs).to.have.members([idMotClef]);
    });

    it("le statut est copié", async () => {
      const statut = await obtenir<PartielRécursif<StatutDonnées> | null>(
        ({ siDéfini }) =>
          constl.bds.suivreStatut({ idBd: idBdCopie, f: siDéfini() }),
      );
      expect(statut).to.deep.equal(réfStatut);
    });

    it("l'image est copiée'", async () => {
      const image = await obtenir<{
        image: Uint8Array;
        idImage: string;
      } | null>(({ siDéfini }) =>
        constl.bds.suivreImage({ idBd: idBdCopie, f: siDéfini() }),
      );
      expect(image).to.deep.equal({ idImage, image: IMAGE });
    });

    it("les tableaux sont copiés", async () => {
      const tableaux = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.suivreTableaux({ idBd: idBdCopie, f: siPasVide() }),
      );
      expect(tableaux).to.have.members([idTableau]);
    });

    it("les variables sont copiées", async () => {
      const variables = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.suivreVariables({ idBd: idBdCopie, f: siPasVide() }),
      );
      expect(variables).to.have.members([idVariable]);
    });

    it("les données sont copiées", async () => {
      const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
        ({ siPasVide }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBdCopie,
            idTableau,
            f: siPasVide(),
          }),
      );
      expect(données).to.have.members(donnéesRéf);
    });

    it("source copie établie", async () => {
      const copiéeDe = await obtenir<{ id?: string }>(({ siDéfini }) =>
        constl.bds.suivreSource({ idBd: idBdCopie, f: siDéfini() }),
      );
      expect(copiéeDe).to.deep.equal({ id: idBdOrig });
    });

    it("copier bd sans licence contenu", async () => {
      const idBdSansLicenceContenu = await constl.bds.créerBd({
        licence: "ODbl-1_0",
      });
      const idBdCopieSansLicenceContenu = await constl.bds.copierBd({
        idBd: idBdSansLicenceContenu,
      });
      const licenceContenu = await obtenir<string | null>(({ siDéfini }) =>
        constl.bds.suivreLicenceContenu({
          idBd: idBdCopieSansLicenceContenu,
          f: siDéfini(),
        }),
      );

      expect(licenceContenu).to.be.null();
    });

    it("copier sans copier les données", async () => {
      const idBdCopieSansDonnées = await constl.bds.copierBd({
        idBd: idBdOrig,
        copierDonnées: false,
      });
      const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
        ({ siPasVide }) =>
          constl.bds.tableaux.suivreDonnées({
            idStructure: idBdCopieSansDonnées,
            idTableau,
            f: siPasVide(),
          }),
      );
      expect(données).to.be.empty();
    });
  });

  describe("combiner", function () {
    let idBdSource: string;
    let idBdDestinataire: string;

    const idTableau = "traductions";
    const idTableauSupplémentaire = "tableau source";
    const idTableauManquant = "tableau destinataire";

    const idColonneClef = "clef";
    const idColonneTraduc = "traduc";

    before(async () => {
      const schéma: SchémaBd = {
        licence: "ODbl-1_0",
        tableaux: {
          idTableau: {
            cols: [
              {
                idColonne: idColonneClef,
                index: true,
              },
              {
                idColonne: idColonneTraduc,
              },
            ],
          },
        },
      };

      idBdSource = await constl.bds.créerBdDeSchéma({ schéma });
      idBdDestinataire = await constl.bds.créerBdDeSchéma({ schéma });

      type ÉlémentTrad = {
        [idColonneClef]: string;
        [idColonneTraduc]?: string;
      };

      const élémentsSource: ÉlémentTrad[] = [
        {
          [idColonneClef]: "fr",
          [idColonneTraduc]: "Constellation",
        },
        {
          [idColonneClef]: "kaq", // Une traduction vide, par erreur disons
        },
      ];
      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idBdSource,
        idTableau,
        éléments: élémentsSource,
      });

      const élémentsDestinataire: ÉlémentTrad[] = [
        {
          [idColonneClef]: "fr",
          [idColonneTraduc]: "Constellation!", // Une erreur ici, disons
        },
        {
          [idColonneClef]: "kaq",
          [idColonneTraduc]: "Ch'umil",
        },
        {
          [idColonneClef]: "हिं",
          [idColonneTraduc]: "तारामंडल",
        },
      ];
      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idBdDestinataire,
        idTableau,
        éléments: élémentsDestinataire,
      });
    });

    it("combiner les bds", async () => {
      await constl.bds.combinerBds({ idBdSource, idBdDestinataire });
    });

    it("données combinées", async () => {
      const données = await obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
        constl.bds.tableaux.suivreDonnées({
          idStructure: idBdDestinataire,
          idTableau,
          f: si(
            (x) =>
              !!x &&
              x.length > 2 &&
              x.every((y) => Object.keys(y.données).length > 1),
          ),
        }),
      );

      const donnéesSansId = données.map((d) => d.données);
      expect(donnéesSansId).to.have.deep.members([
        { [idColonneClef]: "fr", [idColonneTraduc]: "Constellation" },
        { [idColonneClef]: "kaq", [idColonneTraduc]: "Ch'umil" },
        { [idColonneClef]: "हिं", [idColonneTraduc]: "तारामंडल" },
      ]);
    });

    it("tableau supplémentaire non touché", async () => {
      const tableauxBdDestinataire = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.suivreTableaux({ idBd: idBdDestinataire, f: siPasVide() }),
      );
      expect(tableauxBdDestinataire).to.contain(idTableauSupplémentaire);
    });

    it("tableau manquant non ajouté", async () => {
      const tableauxBdDestinataire = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.suivreTableaux({ idBd: idBdDestinataire, f: siPasVide() }),
      );
      expect(tableauxBdDestinataire).to.not.contain(idTableauManquant);
    });
  });

  describe("empreinte", function () {
    let idBd: string;
    let idTableau: string;
    let idVariable: string;
    let idColonne: string;

    let empreinte: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
    });

    it("sans tableaux", async () => {
      empreinte = await obtenir<string>(({ siDéfini }) =>
        constl.bds.suivreEmpreinteTête({
          idBd,
          f: siDéfini(),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("ajout tableau", async () => {
      const promesseEmpreinte = obtenir<string>(({ si }) =>
        constl.bds.suivreEmpreinteTête({
          idBd,
          f: si((x) => x !== empreinte),
        }),
      );

      idTableau = await constl.bds.ajouterTableau({ idBd });

      empreinte = await promesseEmpreinte;

      expect(empreinte).to.be.a.not.empty("string");
    });

    it("ajout colonne", async () => {
      const promesseEmpreinte = obtenir<string>(({ si }) =>
        constl.bds.suivreEmpreinteTête({
          idBd,
          f: si((x) => x !== empreinte),
        }),
      );

      idColonne = await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idVariable,
      });

      empreinte = await promesseEmpreinte;
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("changement nom tableau détecté", async () => {
      const promesseEmpreinte = obtenir<string>(({ si }) =>
        constl.bds.suivreEmpreinteTête({
          idBd,
          f: si((x) => x !== empreinte),
        }),
      );

      await constl.bds.tableaux.sauvegarderNom({
        idStructure: idBd,
        idTableau,
        langue: "fr",
        nom: "Insectes de Montréal",
      });

      empreinte = await promesseEmpreinte;
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("changement nom bd détecté", async () => {
      const promesseEmpreinte = obtenir<string>(({ si }) =>
        constl.bds.suivreEmpreinteTête({
          idBd,
          f: si((x) => x !== empreinte),
        }),
      );

      await constl.bds.sauvegarderNom({
        idBd,
        langue: "fr",
        nom: "Science citoyenne",
      });

      empreinte = await promesseEmpreinte;
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("changement données tableau détecté", async () => {
      const promesseEmpreinte = obtenir<string>(({ si }) =>
        constl.bds.suivreEmpreinteTête({
          idBd,
          f: si((x) => x !== empreinte),
        }),
      );

      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idBd,
        idTableau,
        éléments: [{ [idColonne]: 2 }],
      });

      empreinte = await promesseEmpreinte;
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("changement noms variable détecté", async () => {
      const promesseEmpreinte = obtenir<string>(({ si }) =>
        constl.bds.suivreEmpreinteTête({
          idBd,
          f: si((x) => x !== empreinte),
        }),
      );

      await constl.variables.sauvegarderNom({
        idVariable,
        langue: "fr",
        nom: "Population observée",
      });

      empreinte = await promesseEmpreinte;
      expect(empreinte).to.be.a.not.empty("string");
    });
  });

  describe("score", function () {
    let idBd: string;
    let idTableau: string;
    let idVarNumérique: string;
    let idVarChaîne: string;
    let idVarNumérique2: string;

    let idColNumérique: string;
    let idColNumérique2: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      idTableau = await constl.bds.ajouterTableau({ idBd });

      idVarNumérique = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      idVarNumérique2 = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      idVarChaîne = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
    });

    describe("score accessibilité", function () {
      it.skip("À faire");
    });

    describe("score couverture tests", function () {
      it("`undefined` lorsque aucune colonne", async () => {
        const score = await obtenir<ScoreBd>(({ siDéfini }) =>
          constl.bds.suivreScoreQualité({
            idBd,
            f: siDéfini(),
          }),
        );
        expect(score.couverture).to.be.undefined();
      });

      it("ajout de colonnes", async () => {
        idColNumérique = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable: idVarNumérique,
        });
        idColNumérique2 = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable: idVarNumérique2,
        });
        await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable: idVarChaîne,
        });
        const score = await obtenir<ScoreBd>(({ si }) =>
          constl.bds.suivreScoreQualité({
            idBd,
            f: si((s) => s?.couverture !== undefined),
          }),
        );
        expect(score.couverture).to.equal(0);
      });

      it("ajout de règles", async () => {
        const règleNumérique: RègleBornes = {
          type: "bornes",
          détails: { type: "fixe", val: 0, op: ">=" },
        };
        await constl.bds.tableaux.ajouterRègle({
          idStructure: idBd,
          idTableau,
          idColonne: idColNumérique,
          règle: règleNumérique,
        });
        let score = await obtenir<ScoreBd>(({ si }) =>
          constl.bds.suivreScoreQualité({
            idBd,
            f: si((s) => !!s && !!s.couverture && s.couverture > 0),
          }),
        );
        expect(score.couverture).to.equal(0.5);

        await constl.bds.tableaux.ajouterRègle({
          idStructure: idBd,
          idTableau,
          idColonne: idColNumérique2,
          règle: règleNumérique,
        });
        score = await obtenir<ScoreBd>(({ si }) =>
          constl.bds.suivreScoreQualité({
            idBd,
            f: si((s) => !!s && !!s.couverture && s.couverture > 0.5),
          }),
        );
        expect(score.couverture).to.equal(1);
      });
    });

    describe("score validité données", function () {
      let idÉlément: string;

      it("`undefined` pour commencer", async () => {
        const score = await obtenir<ScoreBd>(({ siDéfini }) =>
          constl.bds.suivreScoreQualité({
            idBd,
            f: siDéfini(),
          }),
        );
        expect(score.valide).to.be.undefined();
      });

      it("ajout d'éléments", async () => {
        idÉlément = (
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBd,
            idTableau,
            éléments: [
              {
                [idColNumérique]: -1,
                [idColNumérique2]: 1,
              },
            ],
          })
        )[0];
        let score = await obtenir<ScoreBd>(({ si }) =>
          constl.bds.suivreScoreQualité({
            idBd,
            f: si((s) => s?.valide !== undefined && s.valide === 0.5),
          }),
        );
        expect(score.valide).to.equal(0.5);
        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments: [
            {
              [idColNumérique]: 1,
            },
          ],
        });
        score = await obtenir<ScoreBd>(({ si }) =>
          constl.bds.suivreScoreQualité({
            idBd,
            f: si((s) => !!s?.valide && s.valide > 0.5),
          }),
        );
        expect(score.valide).to.equal(2 / 3);
      });

      it("correction des éléments", async () => {
        await constl.bds.tableaux.modifierÉlément({
          idStructure: idBd,
          idTableau,
          vals: { [idColNumérique]: 12 },
          idÉlément,
        });
        const score = await obtenir<ScoreBd>(({ si }) =>
          constl.bds.suivreScoreQualité({
            idBd,
            f: si((s) => s?.valide !== undefined && s.valide > 2 / 3),
          }),
        );
        expect(score.valide).to.equal(1);
      });
    });

    describe("score infos", function () {
      it("0 pour commencer", async () => {
        const score = await obtenir<ScoreBd>(({ siDéfini }) =>
          constl.bds.suivreScoreQualité({
            idBd,
            f: siDéfini(),
          }),
        );
        expect(score.infos).to.equal(0);
      });

      it("ajout noms", async () => {
        await constl.bds.sauvegarderNoms({ idBd, noms: { fr: "Ma BD" } });
        const score = await obtenir<ScoreBd>(({ si }) =>
          constl.bds.suivreScoreQualité({
            idBd,
            f: si((s) => s?.infos !== undefined && s.infos > 0),
          }),
        );
        expect(score.infos).to.equal(0.5);
      });

      it("ajout descriptions", async () => {
        await constl.bds.sauvegarderDescriptions({
          idBd,
          descriptions: { fr: "Ma BD" },
        });
        const score = await obtenir<ScoreBd>(({ si }) =>
          constl.bds.suivreScoreQualité({
            idBd,
            f: si((s) => s?.infos !== undefined && s.infos > 0.5),
          }),
        );
        expect(score.infos).to.equal(1);
      });
    });

    describe("score total", function () {
      it("calcul du score total", async () => {
        const score = await obtenir<ScoreBd>(({ siDéfini }) =>
          constl.bds.suivreScoreQualité({
            idBd,
            f: siDéfini(),
          }),
        );
        const total = moyenne([
          score.accès,
          score.couverture,
          score.valide,
          score.infos,
        ]);
        expect(score.total).to.equal(total);
      });
    });
  });

  describe("bds uniques", function () {
    let idBdUnique: string;

    const clefUnique = uuidv4();
    const idTableau = "mon tableau";

    const idColonneLangue = "clef";
    const idColonneTraduc = "traduc";

    const éléments: DonnéesRangéeTableau[] = [
      {
        [idColonneLangue]: "kaq",
        [idColonneTraduc]: "Ch'umil",
      },
      { [idColonneLangue]: "हिं", [idColonneTraduc]: "तारामंडल" },
    ];

    const schéma: SchémaBd = {
      licence: "ODbl-1_0",
      tableaux: {
        [idTableau]: {
          cols: [
            {
              idColonne: idColonneLangue,
              index: true,
            },
            {
              idColonne: idColonneTraduc,
              index: false,
            },
          ],
        },
      },
      clefUnique,
    };

    it("création bd unique", async () => {
      idBdUnique = await constl.bds.obtenirBdUnique({ schéma });

      expect(constl.bds.identifiantValide(idBdUnique)).to.be.true();
    });

    it("détection de la même bd unique", async () => {
      const idBdUniqueMaintenant = await constl.bds.obtenirBdUnique({
        schéma,
      });
      expect(idBdUniqueMaintenant).to.equal(idBdUnique);
    });

    it("ajout données bd unique", async () => {
      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idBdUnique,
        idTableau,
        éléments,
      });

      const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
        ({ siPasVide }) =>
          constl.bds.suivreDonnéesBdUnique({
            schéma,
            idTableau,
            f: siPasVide(),
          }),
      );

      expect(données.map((d) => d.données)).to.have.deep.members(éléments);
    });

    it("combinaison bds existantes", async () => {
      const idBdUnique2 = await constl.bds.créerBdDeSchéma({ schéma });
      const élémentsBd2: DonnéesRangéeTableau[] = [
        {
          [idColonneLangue]: "తె",
          [idColonneTraduc]: "నక్షత్రరాశి",
        },
      ];
      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idBdUnique2,
        idTableau,
        éléments: élémentsBd2,
      });

      const réf: DonnéesRangéeTableau[] = [...éléments, ...élémentsBd2];

      const données = await obtenir<DonnéesRangéeTableauAvecId[]>(({ si }) =>
        constl.bds.suivreDonnéesBdUnique({
          schéma,
          idTableau,
          f: si((x) => !!x && x.length >= réf.length),
        }),
      );

      expect(données.map((d) => d.données)).to.have.deep.members(réf);
    });

    it("recréée si effacée", async () => {
      await constl.bds.effacerBd({ idBd: idBdUnique });
      const nouvelIdBdUnique = await constl.bds.obtenirBdUnique({
        schéma,
      });

      expect(constl.bds.identifiantValide(nouvelIdBdUnique)).to.be.true();
      expect(nouvelIdBdUnique).to.not.equal(idBdUnique);
    });

    it("persistance à la réouverture", async () => {
      const { constls: constlsTestRéouverture, fermer: fermerTestRéouverture } =
        await créerConstellationsTest({ n: 1 });
      const constlTestRéouverture = constlsTestRéouverture[0];

      const idBdUniqueTestRéouverture = await constl.bds.obtenirBdUnique({
        schéma,
      });
      const éléments: DonnéesRangéeTableau[] = [
        {
          [idColonneLangue]: "తె",
          [idColonneTraduc]: "నక్షత్రరాశి",
        },
      ];
      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idBdUniqueTestRéouverture,
        idTableau,
        éléments,
      });

      const dossierOriginal =
        await constlTestRéouverture.services["dossier"].dossier();

      await constlTestRéouverture.fermer();

      const constlRéouverte = créerConstellation({
        services: {
          dossier: { dossier: dossierOriginal },
          libp2p: {
            libp2p: obtenirOptionsLibp2pTest(),
          },
        },
      });

      const données = await obtenir<
        DonnéesRangéeTableauAvecId<DonnéesRangéeTableau>[]
      >(({ si }) =>
        constlRéouverte.bds.suivreDonnéesBdUnique({
          schéma,
          idTableau,
          f: si((d) => !!d && d.length >= 2),
        }),
      );

      await fermerTestRéouverture();
      expect(données.map((d) => d.données)).to.have.deep.members(éléments);
    });

    it("erreur si pas de clef unique", async () => {
      const schémaSansClefUnique: SchémaBd = {
        licence: "ODbl-1_0",
        tableaux: {
          [idTableau]: {
            cols: [
              {
                idColonne: idColonneLangue,
                index: true,
              },
              {
                idColonne: idColonneTraduc,
                index: false,
              },
            ],
          },
        },
      };
      await expect(
        constl.bds.obtenirBdUnique({
          schéma: schémaSansClefUnique,
        }),
      ).to.eventually.be.rejectedWith(
        "Le schéma doit contenir la propriété `clefUnique`.",
      );
    });
  });

  describe("exportation", function () {
    let idc: string;

    const idcIndisponible = "QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n";

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
      let idBd: string;
      let idTableau1: string;
      let idTableau2: string;

      let données: DonnéesBdExportées;

      const nomBdFr = "ma base de données";

      before(async () => {
        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
        idTableau1 = await constl.bds.ajouterTableau({ idBd });
        idTableau2 = await constl.bds.ajouterTableau({ idBd });

        const idColFichier = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau: idTableau1,
        });

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau: idTableau1,
          éléments: [
            {
              [idColFichier]: idc,
            },
          ],
        });

        await constl.bds.sauvegarderNom({ idBd, langue: "fr", nom: nomBdFr });

        données = await obtenir<DonnéesBdExportées>(({ siDéfini }) =>
          constl.bds.suivreDonnéesExportation({
            idBd,
            langues: ["fr"],
            f: siDéfini(),
          }),
        );
      });

      it("noms bd", async () => {
        expect(données.nomBd).to.equal(nomBdFr);
      });

      it("tableaux", async () => {
        expect(
          données.tableaux.map((t) => t.nomTableau),
        ).to.have.ordered.members([idTableau1, idTableau2]);
      });
    });

    describe("à document", function () {
      let idBd: string;
      let idTableau1: string;
      let idTableau2: string;

      let données: DonnéesFichierBdExportées;

      before(async () => {
        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
        idTableau1 = await constl.bds.ajouterTableau({ idBd });
        idTableau2 = await constl.bds.ajouterTableau({ idBd });

        const idColonne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau: idTableau1,
        });
        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau: idTableau1,
          éléments: [{ [idColonne]: idc }],
        });

        données = await constl.bds.exporterDonnées({ idBd });
      });

      it("nom document - spécifié", async () => {
        const donnéesAvecNom = await constl.bds.exporterDonnées({
          idBd,
          nomFichier: "mon fichier",
        });
        expect(donnéesAvecNom.nomFichier).to.equal("mon fichier");
      });

      it("nom document - non spécifié", async () => {
        expect(données.nomFichier).to.equal(idBd.replace("/orbitdb/", ""));
      });

      it("document données - tableaux créés", async () => {
        expect(Array.isArray(données.docu.SheetNames));
        expect(données.docu.SheetNames).to.have.members([
          idTableau1,
          idTableau2,
        ]);
      });

      it("document données - fichiers SFIP", async () => {
        expect([...données.documentsMédias]).to.have.members([idc]);
      });
    });

    describe("à fichier", function () {
      let idBd: string;
      let idTableau: string;
      let idColonne: string;

      let zip: JSZip;

      let dossier: string;
      let effacer: () => void;

      const nomTableauFr = "voici un tableau";
      const nomFichier = "mes données";

      before(async () => {
        ({ dossier, effacer } = await dossierTempo());

        idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
        idTableau = await constl.bds.ajouterTableau({ idBd });
        await constl.bds.tableaux.sauvegarderNom({
          idStructure: idBd,
          idTableau,
          langue: "fr",
          nom: nomTableauFr,
        });

        idColonne = await constl.bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
        });
        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments: [{ [idColonne]: idc }],
        });
      });

      after(async () => {
        if (effacer) effacer();
      });

      it("le fichier zip existe", async () => {
        await constl.bds.exporterÀFichier({
          idBd,
          nomFichier,
          dossier,
          formatDocu: "ods",
        });

        const nomZip = join(dossier, nomFichier + ".zip");
        expect(existsSync(nomZip)).to.be.true();
        zip = await JSZip.loadAsync(readFileSync(nomZip));
      });

      it("les données sont exportées", async () => {
        const contenu = zip.files[nomFichier + ".ods"];
        expect(contenu).to.exist();
      });

      it("le dossier pour les données SFIP existe", async () => {
        const contenu = zip.files["médias/"];
        expect(contenu?.dir).to.be.true();
      });

      it("les fichiers SFIP existent", async () => {
        const contenu = zip.files[["médias", idc.replace("/", "-")].join("/")];
        expect(contenu).to.exist();
      });

      it("exportable même si fichiers SFIP indisponibles", async () => {
        const nomFichierTest = "avec fichiers indisponibles";

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments: [{ [idColonne]: idcIndisponible }],
        });

        await constl.bds.exporterÀFichier({
          idBd,
          nomFichier: nomFichierTest,
          dossier,
          formatDocu: "ods",
        });

        const nomZip = join(dossier, nomFichierTest + ".zip");
        zip = await JSZip.loadAsync(readFileSync(nomZip));

        const contenu = zip.files[["sfip", idc.replace("/", "-")].join("/")];
        expect(contenu).to.exist();

        const contenuIndisponible =
          zip.files[["sfip", idcIndisponible.replace("/", "-")].join("/")];
        expect(contenuIndisponible).to.not.exist();
      });
    });
  });

  describe("auteurs", function () {
    let idBd: string;
    let idTableau: string;
    let idColonne: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      idTableau = await constl.bds.ajouterTableau({ idBd });
      idColonne = await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
      });
    });

    it("compte créateur autorisé pour commencer", async () => {
      const auteurs = await obtenir<InfoAuteur[]>(({ siPasVide }) =>
        constl.bds.suivreAuteurs({
          idBd,
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
      await constl.bds.inviterAuteur({
        idBd,
        idCompte: idsComptes[1],
        rôle: MEMBRE,
      });
      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.bds.suivreAuteurs({
          idBd,
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
      await constls[1].bds.ajouterÀMesBds({ idBd });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.bds.suivreAuteurs({
          idBd,
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
        constls[1].compte.suivrePermission({ idObjet: idBd, f: siDéfini() }),
      );

      // Modification de la base de données
      await constls[1].bds.sauvegarderNom({
        idBd,
        langue: "fr",
        nom: "Niveaux d'eau",
      });
      const noms = await obtenir(({ siPasVide }) =>
        constls[0].bds.suivreNoms({ idBd, f: siPasVide() }),
      );
      expect(noms).to.deep.equal({ fr: "Niveaux d'eau" });

      // Modification des données
      await constls[1].bds.tableaux.ajouterÉléments({
        idStructure: idBd,
        idTableau,
        éléments: [{ [idColonne]: 2.5 }],
      });
      const données = await obtenir<DonnéesRangéeTableauAvecId[]>(
        ({ siPasVide }) =>
          constls[0].bds.tableaux.suivreDonnées({
            idStructure: idBd,
            idTableau,
            f: siPasVide(),
          }),
      );
      expect(données.map((d) => d.données)).to.deep.equal({ [idColonne]: 2.5 });
    });

    it("promotion à modératrice", async () => {
      await constl.bds.inviterAuteur({
        idBd,
        idCompte: idsComptes[1],
        rôle: MODÉRATRICE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.bds.suivreAuteurs({
          idBd,
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
      await constl.bds.inviterAuteur({
        idBd,
        idCompte: compteHorsLigne,
        rôle: MEMBRE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.bds.suivreAuteurs({
          idBd,
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
