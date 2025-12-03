import { expect } from "aegir/chai";
import { adresseOrbiteValide } from "@constl/utils-ipa";
import { MEMBRE, MODÉRATRICE } from "@/v2/crabe/services/compte/accès/index.js";
import { obtRessourceTest } from "test/ressources/index.js";
import {
  DISPOSITIFS_INSTALLÉS,
  TOUS_DISPOSITIFS,
} from "@/v2/crabe/services/favoris.js";
import { obtenir, créerConstellationsTest } from "./utils.js";
import type {
  InfoAuteur,
  Métadonnées,
  StatutDonnées,
  TraducsTexte,
} from "@/v2/types.js";
import type { Constellation } from "@/v2/index.js";
import type { Oublier } from "@/v2/crabe/types.js";
import type { DifférenceBds } from "@/v2/bds/bds.js";
import type { InfoColonne } from "@/v2/tableaux.js";
import type {
  AutorisationNuée,
  InfoTableauNuée,
  ÉpingleNuée,
} from "@/v2/nuées/nuées.js";

describe("Nuées", function () {
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

  describe("création nuées", function () {
    let idNuée: string;

    it("pas de nuées pour commencer", async () => {
      const nuées = await obtenir(({ siDéfini }) =>
        constl.nuées.suivreNuées({
          f: siDéfini(),
        }),
      );
      expect(nuées).to.be.an.empty("array");
    });

    it("création", async () => {
      idNuée = await constl.nuées.créerNuée();
      expect(adresseOrbiteValide(idNuée)).to.be.true();
    });

    it("accès", async () => {
      const permission = await obtenir(({ siDéfini }) =>
        constl.compte.suivrePermission({
          idObjet: idNuée,
          f: siDéfini(),
        }),
      );
      expect(permission).to.equal(MODÉRATRICE);
    });

    it("automatiquement ajoutée à mes nuées", async () => {
      const mesNuées = await obtenir<string[]>(({ siDéfini }) =>
        constl.nuées.suivreNuées({
          f: siDéfini(),
        }),
      );
      expect(mesNuées).to.be.an("array").and.to.contain(idNuée);
    });

    it("détectée sur un autre compte", async () => {
      const sesNuées = await obtenir<string[]>(({ siDéfini }) =>
        constls[1].nuées.suivreNuées({
          f: siDéfini(),
          idCompte: idsComptes[0],
        }),
      );
      expect(sesNuées).have.members([idNuée]);
    });

    it("enlever de mes nuées", async () => {
      await constl.nuées.enleverDeMesNuées({ idNuée });
      const mesNuées = await obtenir<string[] | undefined>(({ siVide }) =>
        constl.nuées.suivreNuées({
          f: siVide(),
        }),
      );
      expect(mesNuées).to.be.an.empty("array");
    });

    it("ajouter manuellement à mes nuées", async () => {
      await constl.nuées.ajouterÀMesNuées({ idNuée });
      const mesNuées = await obtenir<string[]>(({ siPasVide }) =>
        constl.nuées.suivreNuées({
          f: siPasVide(),
        }),
      );
      expect(mesNuées).to.have.members([idNuée]);
    });

    it("effacer nuée", async () => {
      await constl.nuées.effacerNuée({ idNuée });
      const mesNuées = await obtenir<string[] | undefined>(({ siVide }) =>
        constl.nuées.suivreNuées({
          f: siVide(),
        }),
      );
      expect(mesNuées).to.be.empty();
    });
  });

  describe("noms", function () {
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("pas de noms pour commencer", async () => {
      const noms = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.nuées.suivreNoms({ idNuée, f: siDéfini() }),
      );
      expect(Object.keys(noms).length).to.equal(0);
    });

    it("ajouter un nom", async () => {
      await constl.nuées.sauvegarderNom({
        idNuée,
        langue: "fr",
        nom: "Alphabets",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreNoms({
          idNuée,
          f: si((n) => !!n && Object.keys(n).length > 0),
        }),
      );
      expect(noms.fr).to.equal("Alphabets");
    });

    it("ajouter des noms", async () => {
      await constl.nuées.sauvegarderNoms({
        idNuée,
        noms: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreNoms({
          idNuée,
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
      await constl.nuées.sauvegarderNom({
        idNuée,
        langue: "fr",
        nom: "Systèmes d'écriture",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreNoms({
          idNuée,
          f: si((n) => n?.["fr"] !== "Alphabets"),
        }),
      );

      expect(noms?.fr).to.equal("Systèmes d'écriture");
    });

    it("effacer un nom", async () => {
      await constl.nuées.effacerNom({ idNuée, langue: "fr" });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreNoms({ idNuée, f: si((n) => !!n && !n["fr"]) }),
      );
      expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("descriptions", function () {
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("aucune description pour commencer", async () => {
      const descrs = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.nuées.suivreDescriptions({ idNuée, f: siDéfini() }),
      );
      expect(Object.keys(descrs).length).to.equal(0);
    });

    it("ajouter une description", async () => {
      await constl.nuées.sauvegarderDescription({
        idNuée,
        langue: "fr",
        description: "Alphabets",
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreDescriptions({ idNuée, f: si((x) => !!x?.["fr"]) }),
      );
      expect(descrs.fr).to.equal("Alphabets");
    });

    it("ajouter des descriptions", async () => {
      await constl.nuées.sauvegarderDescriptions({
        idNuée,
        descriptions: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreDescriptions({
          idNuée,
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
      await constl.nuées.sauvegarderDescription({
        idNuée,
        langue: "fr",
        description: "Systèmes d'écriture",
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreDescriptions({
          idNuée,
          f: si((x) => x?.["fr"] !== "Alphabets"),
        }),
      );
      expect(descrs?.fr).to.equal("Systèmes d'écriture");
    });

    it("effacer une description", async () => {
      await constl.nuées.effacerDescription({ idNuée, langue: "fr" });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreDescriptions({
          idNuée,
          f: si((x) => !!x && !x["fr"]),
        }),
      );
      expect(descrs).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("métadonnées", function () {
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("pas de métadonnées pour commencer", async () => {
      const métadonnées = await obtenir<Métadonnées>(({ siDéfini }) =>
        constl.nuées.suivreMétadonnées({ idNuée, f: siDéfini() }),
      );
      expect(Object.keys(métadonnées).length).to.equal(0);
    });

    it("ajouter une métadonnée", async () => {
      await constl.nuées.sauvegarderMétadonnée({
        idNuée,
        clef: "clef1",
        valeur: true,
      });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.nuées.suivreMétadonnées({
          idNuée,
          f: si((n) => !!n && Object.keys(n).length > 0),
        }),
      );
      expect(métadonnées.clef1).to.be.true();
    });

    it("ajouter des métadonnées", async () => {
      await constl.nuées.sauvegarderMétadonnées({
        idNuée,
        métadonnées: {
          clef2: 123,
          clef3: "du texte",
        },
      });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.nuées.suivreMétadonnées({
          idNuée,
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
      await constl.nuées.sauvegarderMétadonnée({
        idNuée,
        clef: "clef1",
        valeur: false,
      });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.nuées.suivreMétadonnées({
          idNuée,
          f: si((n) => n?.["clef1"] !== true),
        }),
      );

      expect(métadonnées?.clef1).to.be.false();
    });

    it("effacer une métadonnée", async () => {
      await constl.nuées.effacerMétadonnée({ idNuée, clef: "clef1" });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.nuées.suivreMétadonnées({
          idNuée,
          f: si((n) => !!n && !n["clef1"]),
        }),
      );
      expect(métadonnées).to.deep.equal({ clef2: 123, clef3: "du texte" });
    });
  });

  describe("mots-clefs", function () {
    let idMotClef: string;
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("pas de mots-clefs pour commencer", async () => {
      const motsClefs = await obtenir<string[]>(({ siDéfini }) =>
        constl.nuées.suivreMotsClefs({
          idNuée,
          f: siDéfini(),
        }),
      );
      expect(motsClefs).to.be.an.empty("array");
    });

    it("ajout d'un mot-clef", async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
      await constl.nuées.ajouterMotsClefs({
        idNuée,
        idsMotsClefs: idMotClef,
      });

      const motsClefs = await obtenir<string[]>(({ siPasVide }) =>
        constl.nuées.suivreMotsClefs({ idNuée, f: siPasVide() }),
      );
      expect(Array.isArray(motsClefs)).to.be.true();
      expect(motsClefs.length).to.equal(1);
    });

    it("effacer un mot-clef", async () => {
      await constl.nuées.effacerMotClef({ idNuée, idMotClef });

      const motsClefs = await obtenir<string[]>(({ siVide }) =>
        constl.nuées.suivreMotsClefs({
          idNuée,
          f: siVide(),
        }),
      );
      expect(motsClefs).to.be.an.empty("array");
    });
  });

  describe("image", function () {
    let IMAGE: Uint8Array;
    let idNuée: string;

    before(async () => {
      IMAGE = await obtRessourceTest({
        nomFichier: "logo.svg",
      });

      idNuée = await constl.nuées.créerNuée();
    });

    it("aucune image pour commencer", async () => {
      const image = await obtenir(({ siNul }) =>
        constl.nuées.suivreImage({ idNuée, f: siNul() }),
      );
      expect(image).to.be.null();
    });

    it("ajouter image", async () => {
      const idImage = await constl.nuées.sauvegarderImage({
        idNuée,
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });
      expect(idImage).to.endWith("logo.svg");

      const image = await obtenir<{
        image: Uint8Array;
        idImage: string;
      } | null>(({ siPasNul }) =>
        constl.nuées.suivreImage({ idNuée, f: siPasNul() }),
      );

      const réf = { idImage, image: IMAGE };
      expect(image).to.deep.equal(réf);
    });

    it("effacer image", async () => {
      await constl.nuées.effacerImage({ idNuée });
      const image = await obtenir(({ siNul }) =>
        constl.nuées.suivreImage({ idNuée, f: siNul() }),
      );
      expect(image).to.be.null();
    });
  });

  describe("autorisations", function () {
    it("nuée ouverte - tous peuvent écrire");
    it("nuée ouverte - bloquer compte");
    it("nuée ouverte - débloquer compte");
    it("nuée par invitation - compte créateur peut écrire");
    it("nuée par invitation - compte membre peut écrire");
    it("nuée par invitation - les autres ne peuvent pas écrire");
    it("nuée par invitation - inviter compte");
    it("nuée par invitation - désinviter compte");

    it("convertir à ouverte");
    it("reconvertir à par invitation - invités persistent");

    it("convertir à par invitation");
    it("reconvertir à ouverte - bloqués persistent");

    it("erreur nuée ouverte - bloquer compte créateur nuée");
    it("erreur nuée ouverte - bloquer compte créateur nuée");
    it("erreur nuée par invitation - désinviter compte membre nuée");
    it("erreur nuée par invitation - désinviter compte membre nuée");
  });

  describe("tableaux", function () {
    let idTableau: string;
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("pas de tableaux pour commencer", async () => {
      const tableaux = await obtenir<InfoTableauNuée[]>(({ siDéfini }) =>
        constl.nuées.suivreTableaux({
          idNuée,
          f: siDéfini(),
        }),
      );
      expect(tableaux).to.be.an.empty("array");
    });

    it("ajout d'un tableau", async () => {
      idTableau = await constl.nuées.ajouterTableau({
        idNuée,
      });
      expect(typeof idTableau).to.equal("string");

      const tableaux = await obtenir<InfoTableauNuée[]>(({ siPasVide }) =>
        constl.nuées.suivreTableaux({
          idNuée,
          f: siPasVide(),
        }),
      );

      const réf: InfoTableauNuée[] = [{ id: idTableau, source: idNuée }];
      expect(tableaux).to.have.members(réf);
    });

    it("suivre colonnes tableau", async () => {
      const idVariable = await constl.variables.créerVariable({
        catégorie: "vidéo",
      });
      const idColonne = await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuée,
        idTableau,
        idVariable,
      });
      const colonnes = await obtenir<InfoColonne[]>(({ siPasVide }) =>
        constl.nuées.tableaux.suivreColonnes({
          idStructure: idNuée,
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
      await constl.nuées.effacerTableau({ idNuée, idTableau });

      const tableaux = await obtenir<InfoTableauNuée[]>(({ siVide }) =>
        constl.nuées.suivreTableaux({
          idNuée,
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
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("pas de variables pour commencer", async () => {
      const variables = await obtenir<string[]>(({ siDéfini }) =>
        constl.nuées.suivreVariables({
          idNuée,
          f: siDéfini(),
        }),
      );
      expect(variables).to.be.an.empty("array");
    });

    it("ajout d'un tableau et d'une variable", async () => {
      idTableau = await constl.nuées.ajouterTableau({ idNuée });
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      idColonne = await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuée,
        idTableau,
        idVariable,
      });

      const variables = await obtenir<string[]>(({ siPasVide }) =>
        constl.nuées.suivreVariables({
          idNuée,
          f: siPasVide(),
        }),
      );
      expect(Array.isArray(variables)).to.be.true();
      expect(variables.length).to.equal(1);
      expect(variables[0]).to.equal(idVariable);
    });

    it("effacer une variable", async () => {
      await constl.nuées.tableaux.effacerColonne({
        idStructure: idNuée,
        idTableau,
        idColonne,
      });
      const variables = await obtenir<string[]>(({ siVide }) =>
        constl.nuées.suivreVariables({
          idNuée,
          f: siVide(),
        }),
      );
      expect(variables).to.be.an.empty("array");
    });
  });

  describe("statut", function () {
    let idNuée: string;

    it("statut actif par défaut", async () => {
      idNuée = await constl.nuées.créerNuée();
      const statut = await obtenir(({ siDéfini }) =>
        constl.nuées.suivreStatut({
          idNuée,
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
      await constl.nuées.sauvegarderStatut({
        idNuée,
        statut: nouveauStatut,
      });

      const statut = await obtenir<StatutDonnées | null>(({ si }) =>
        constl.nuées.suivreStatut({
          idNuée,
          f: si((x) => x?.statut !== "active"),
        }),
      );

      expect(statut).to.deep.equal(nouveauStatut);
    });
  });

  describe("épingles", function () {
    it("désépingler nuée", async () => {
      const idNuée = await constl.nuées.créerNuée();
      await constl.nuées.désépingler({ idNuée });

      const épingle = await obtenir(({ siNonDéfini }) =>
        constl.nuées.suivreÉpingle({
          idNuée,
          f: siNonDéfini(),
        }),
      );
      expect(épingle).to.be.undefined();
    });

    it("épingler nuée", async () => {
      const idNuée = await constl.nuées.créerNuée({
        épingler: false,
      });
      await constl.nuées.épingler({ idNuée });

      const épingle = await obtenir(({ siDéfini }) =>
        constl.nuées.suivreÉpingle({ idNuée, f: siDéfini() }),
      );

      const réf: ÉpingleNuée = {
        type: "nuée",
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
      const idNuée = await constl.nuées.créerNuée();
      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.nuées.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idNuée,
            épingle: {
              type: "nuée",
              épingle: { base: true },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolution]).to.have.members([idNuée]);
    });

    it("résoudre épingle - bds", async () => {
      const idNuée = await constl.nuées.créerNuée();

      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const idTableau = await constl.nuées.ajouterTableau({ idNuée });

      await constl.bds.ajouterTableau({ idBd, idTableau });
      const idDonnéesTableau = await constl.bds.tableaux.obtIdDonnées({
        idStructure: idNuée,
        idTableau,
      });

      const résolution = await obtenir<Set<string>>(({ si }) =>
        constl.nuées.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idNuée,
            épingle: {
              type: "nuée",
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
      expect([...résolution]).to.have.members([idNuée, idBd, idDonnéesTableau]);

      const résolutionSansTableaux = await obtenir<Set<string>>(
        ({ siDéfini }) =>
          constl.nuées.suivreRésolutionÉpingle({
            épingle: {
              idObjet: idNuée,
              épingle: {
                type: "nuée",
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
      expect([...résolutionSansTableaux]).to.have.members([idNuée, idBd]);
    });

    it("résoudre épingle - fichiers", async () => {
      const idNuée = await constl.nuées.créerNuée();

      const idTableau = await constl.nuées.ajouterTableau({ idNuée });
      const idVariable = await constl.variables.créerVariable({
        catégorie: "fichier",
      });
      const idColonne = await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuée,
        idTableau,
        idVariable,
      });

      const schéma = await constl.nuées.créerSchémaDeNuée({
        idNuée,
        licence: "ODbl-1_0",
      });

      const idBd = await constl.bds.créerBdDeSchéma({ schéma });

      const idc = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ.mp4";
      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idNuée,
        idTableau,
        éléments: [{ [idColonne]: idc }],
      });

      const idDonnéesTableau = await constl.bds.tableaux.obtIdDonnées({
        idStructure: idBd,
        idTableau,
      });

      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.nuées.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idNuée,
            épingle: {
              type: "nuée",
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
      expect([...résolution]).to.have.members([idNuée, idDonnéesTableau, idc]);

      const résolutionSansFichers = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.nuées.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idNuée,
            épingle: {
              type: "nuée",
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
      expect([...résolutionSansFichers]).to.have.members([idNuée, idBd]);

      const résolutionSansFichersOuTableaux = await obtenir<Set<string>>(
        ({ siDéfini }) =>
          constl.nuées.suivreRésolutionÉpingle({
            épingle: {
              idObjet: idNuée,
              épingle: {
                type: "nuée",
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
      expect([...résolutionSansFichersOuTableaux]).to.have.members([idNuée]);
    });
  });

  describe("différences", function () {
    let idBd: string;
    let idNuée: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODBl-1_0" });
      idNuée = await constl.nuées.créerNuée();
    });

    it("vide pour commencer", async () => {
      const différences = await obtenir(({ siVide }) =>
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siVide() }),
      );
      expect(différences).to.be.empty();
    });

    it("tableau manquant", async () => {
      const idTableau = await constl.nuées.ajouterTableau({ idNuée });
      const différences = await obtenir<DifférenceBds[]>(({ siPasVide }) =>
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siPasVide() }),
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
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siVide() }),
      );
      expect(différencesAprès).to.be.empty();
    });

    it("tableau supplémentaire", async () => {
      const idTableau = await constl.bds.ajouterTableau({ idBd });
      const différences = await obtenir(({ siPasVide }) =>
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siPasVide() }),
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
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siVide() }),
      );
      expect(différencesAprès).to.be.empty();
    });

    it("différences tableau", async () => {
      const idTableau = await constl.nuées.ajouterTableau({ idNuée });
      await constl.bds.ajouterTableau({ idBd, idTableau });

      const idColonne = await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuée,
        idTableau,
      });
      const différences = await obtenir(({ siPasVide }) =>
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siPasVide() }),
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
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siVide() }),
      );
      expect(différencesAprès).to.be.empty();
    });
  });

  describe("copier", function () {
    let idNuéeSource: string;

    let idNuéeOrig: string;
    let idNuéeCopie: string;

    let idMotClef: string;
    let idVariable: string;
    let idTableau: string;
    let idColonne: string;

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

    const réfBloqués = ["pas chouette", "méchant", "pas gentil"];

    before(async () => {
      IMAGE = await obtRessourceTest({
        nomFichier: "logo.svg",
      });

      idNuéeSource = await constl.nuées.créerNuée();

      idNuéeOrig = await constl.nuées.créerNuée({
        parent: idNuéeSource,
        autorisation: "ouverte",
      });

      for (const méchant of réfBloqués) {
        await constl.nuées.bloquerCompte({
          idNuée: idNuéeSource,
          idCompte: méchant,
        });
      }

      await constl.nuées.sauvegarderNoms({
        idNuée: idNuéeOrig,
        noms: réfNoms,
      });
      await constl.nuées.sauvegarderDescriptions({
        idNuée: idNuéeOrig,
        descriptions: réfDescrs,
      });

      idMotClef = await constl.motsClefs.créerMotClef();
      await constl.nuées.ajouterMotsClefs({
        idNuée: idNuéeOrig,
        idsMotsClefs: idMotClef,
      });
      await constl.nuées.sauvegarderMétadonnées({
        idNuée: idNuéeOrig,
        métadonnées: réfMétadonnées,
      });
      idImage = await constl.nuées.sauvegarderImage({
        idNuée: idNuéeOrig,
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });

      idTableau = await constl.nuées.ajouterTableau({ idNuée: idNuéeOrig });

      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      idColonne = await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuéeOrig,
        idTableau,
        idVariable,
      });
    });

    it("copier la nuée", async () => {
      idNuéeCopie = await constl.nuées.copierNuée({ idNuée: idNuéeOrig });
      expect(idNuéeCopie).to.be.a("string");
    });

    it("les noms sont copiés", async () => {
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.nuées.suivreNoms({ idNuée: idNuéeCopie, f: siPasVide() }),
      );
      expect(noms).to.deep.equal(réfNoms);
    });

    it("les descriptions sont copiées", async () => {
      const descrs = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.nuées.suivreDescriptions({
          idNuée: idNuéeCopie,
          f: siPasVide(),
        }),
      );
      expect(descrs).to.deep.equal(réfDescrs);
    });

    it("les métadonnées sont copiées", async () => {
      const métadonnées = await obtenir<Métadonnées>(({ siPasVide }) =>
        constl.nuées.suivreMétadonnées({ idNuée: idNuéeCopie, f: siPasVide() }),
      );
      expect(métadonnées).to.deep.equal(réfMétadonnées);
    });

    it("les mots-clefs sont copiés", async () => {
      const motsClefs = await obtenir<string[]>(({ siPasVide }) =>
        constl.nuées.suivreMotsClefs({ idNuée: idNuéeCopie, f: siPasVide() }),
      );
      expect(motsClefs).to.have.members([idMotClef]);
    });

    it("le statut est copié", async () => {
      const statut = await obtenir<StatutDonnées | null>(({ siDéfini }) =>
        constl.nuées.suivreStatut({ idNuée: idNuéeCopie, f: siDéfini() }),
      );
      expect(statut).to.deep.equal(réfStatut);
    });

    it("l'image est copiée'", async () => {
      const image = await obtenir<{
        image: Uint8Array;
        idImage: string;
      } | null>(({ siDéfini }) =>
        constl.nuées.suivreImage({ idNuée: idNuéeCopie, f: siDéfini() }),
      );
      expect(image).to.deep.equal({ idImage, image: IMAGE });
    });

    it("les tableaux sont copiés", async () => {
      const tableaux = await obtenir<InfoTableauNuée[]>(({ siPasVide }) =>
        constl.nuées.suivreTableaux({ idNuée: idNuéeCopie, f: siPasVide() }),
      );
      expect(tableaux).to.have.members([idTableau]);
    });

    it("les colonnes sont copiés", async () => {
      const colonnes = await obtenir<InfoColonne[]>(({ siPasVide }) =>
        constl.nuées.tableaux.suivreColonnes({
          idStructure: idNuéeCopie,
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

    it("les variables sont copiées", async () => {
      const variables = await obtenir<string[]>(({ siPasVide }) =>
        constl.nuées.suivreVariables({ idNuée: idNuéeCopie, f: siPasVide() }),
      );
      expect(variables).to.have.members([idVariable]);
    });

    it("les autorisations sont copiées", async () => {
      const autorisation = await obtenir<AutorisationNuée>(({ siDéfini }) =>
        constl.nuées.suivreAutorisation({ idNuée: idNuéeCopie, f: siDéfini() }),
      );
      const réf: AutorisationNuée = {
        type: "ouverte",
        bloqués: réfBloqués,
      };
      expect(autorisation).to.deep.equal(réf);
    });

    it("l'ascendance est copiée", async () => {
      const ascendance = await obtenir<string[]>(({ siDéfini }) =>
        constl.nuées.suivreAscendants({ idNuée: idNuéeCopie, f: siDéfini() }),
      );
      expect(ascendance).to.have.deep.members([idNuéeSource]);
    });

    it("source copie établie", async () => {
      const copiéeDe = await obtenir<{ id: string }>(({ siDéfini }) =>
        constl.nuées.suivreSource({ idNuée: idNuéeCopie, f: siDéfini() }),
      );
      expect(copiéeDe).to.deep.equal({ id: idNuéeOrig });
    });
  });

  describe("empreinte", function () {
    let idNuée: string;
    let idBd: string;
    let idTableau: string;
    let idVariable: string;
    let idColonne: string;

    let empreinte: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      idTableau = await constl.nuées.ajouterTableau({ idNuée });
      idColonne = await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuée,
        idTableau,
        idVariable,
      });
    });

    it("sans bds", async () => {
      empreinte = await obtenir<string>(({ siDéfini }) =>
        constl.nuées.suivreEmpreinteTête({
          idNuée,
          f: siDéfini(),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("ajout bds", async () => {
      const schéma = await constl.nuées.créerSchémaDeNuée({
        idNuée,
        licence: "ODBl-1_0",
      });
      idBd = await constl.bds.créerBdDeSchéma({
        schéma,
      });

      empreinte = await obtenir<string>(({ si }) =>
        constl.nuées.suivreEmpreinteTête({
          idNuée,
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
        constl.nuées.suivreEmpreinteTête({
          idNuée,
          f: si((x) => x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("changement nom nuée détecté", async () => {
      await constl.nuées.sauvegarderNom({
        idNuée,
        langue: "fr",
        nom: "Science citoyenne",
      });

      empreinte = await obtenir<string>(({ si }) =>
        constl.nuées.suivreEmpreinteTête({
          idNuée,
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
        constl.nuées.suivreEmpreinteTête({
          idNuée,
          f: si((x) => x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("changement noms variable détecté", async () => {
      throw new Error(
        "Fonctionalité à implémenter dans `constl.nuées.suivreEmpreinteTête`",
      );
      await constl.variables.sauvegarderNom({
        idVariable,
        langue: "fr",
        nom: "Population observée",
      });

      empreinte = await obtenir<string>(({ si }) =>
        constl.nuées.suivreEmpreinteTête({
          idNuée,
          f: si((x) => x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });
  });

  describe("score");

  describe("auteurs", function () {
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("compte créateur autorisé pour commencer", async () => {
      const auteurs = await obtenir<InfoAuteur[]>(({ siPasVide }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
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
      await constl.nuées.inviterAuteur({
        idNuée,
        idCompte: idsComptes[1],
        rôle: MEMBRE,
      });
      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
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
      await constls[1].nuées.ajouterÀMesNuées({ idNuée });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
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
        constls[1].compte.suivrePermission({ idObjet: idNuée, f: siDéfini() }),
      );

      // Modification de la nuée
      await constls[1].nuées.sauvegarderNom({
        idNuée,
        langue: "fr",
        nom: "Pédologie",
      });
      const noms = await obtenir(({ siPasVide }) =>
        constls[0].nuées.suivreNoms({ idNuée, f: siPasVide() }),
      );
      expect(noms).to.deep.equal({ fr: "Pédologie" });
    });

    it("promotion à modératrice", async () => {
      await constl.nuées.inviterAuteur({
        idNuée,
        idCompte: idsComptes[1],
        rôle: MODÉRATRICE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
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
      await constl.nuées.inviterAuteur({
        idNuée,
        idCompte: compteHorsLigne,
        rôle: MEMBRE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
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

  describe("ascendance", function () {
    describe("suivre parents", function () {
      it("vide si aucun parent");
      it("ascendance transitive");
      it("pas d'erreur si récursif");
    });
  });

  describe("exportation");
});
