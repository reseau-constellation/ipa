import { expect } from "aegir/chai";
import { créerConstellationsTest, rechercher } from "../utils.js";
import type { ObtRecherche } from "../utils.js";
import type { Oublier } from "@/v2/crabe/types.js";
import type { Constellation } from "@/v2/index.js";
import type {
  InfoRésultat,
  InfoRésultatRecherche,
  InfoRésultatTexte,
  InfoRésultatVide,
  RésultatObjectifRecherche,
  RésultatRecherche,
} from "@/v2/recherche/types.js";

const vérifierRecherche = (
  résultats: RésultatRecherche<InfoRésultat>[],
  réf: RésultatRecherche<InfoRésultat>[],
  scores: { [key: string]: (x: number) => void } = {},
) => {
  const scoresRésultat = Object.fromEntries(
    résultats.map((r) => [r.id, r.résultatObjectif.score]),
  );
  const résultatsSansScore = résultats.map((r) => {
    const sansScore: {
      id: string;
      résultatObjectif: Omit<RésultatObjectifRecherche<InfoRésultat>, "score">;
    } = {
      id: r.id,
      résultatObjectif: Object.fromEntries(
        Object.entries(r.résultatObjectif).filter((x) => x[0] !== "score"),
      ) as Omit<RésultatObjectifRecherche<InfoRésultat>, "score">,
    };
    return sansScore;
  });

  const réfSansScore = réf.map((r) => {
    const sansScore: {
      id: string;
      résultatObjectif: Omit<RésultatObjectifRecherche<InfoRésultat>, "score">;
    } = {
      id: r.id,
      résultatObjectif: Object.fromEntries(
        Object.entries(r.résultatObjectif).filter((x) => x[0] !== "score"),
      ) as Omit<RésultatObjectifRecherche<InfoRésultat>, "score">,
    };
    return sansScore;
  });

  expect(résultatsSansScore).to.have.deep.members(réfSansScore);

  for (const clef of Object.keys(scoresRésultat)) {
    const rés = scoresRésultat[clef];
    (
      scores[clef] ||
      ((x: number) => {
        expect(x).to.be.greaterThan(0);
        expect(x).to.be.lessThanOrEqual(1);
      })
    )(rés);
  }
};

describe("Rechercher dans réseau", function () {
  describe("profil", function () {
    let fermer: Oublier;
    let constls: Constellation[];
    let idsComptes: string[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
      }));

      idsComptes = await Promise.all(
        constls.map(async (c) => await c.compte.obtIdCompte()),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("selon id", () => {
      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].profil.recherche.selonId({
            idCompte: idsComptes[0],
            f,
          }),
        );
      });

      it("id membre détecté", async () => {
        const résultat = await recherche.siPasVide();

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idsComptes[1],
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "id",
            info: {
              type: "texte",
              texte: idsComptes[1],
              début: 0,
              fin: idsComptes[1].length,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon nom", function () {
      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[0].profil.recherche.selonNom({ nom: "Julien", f }),
        );
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("noms détectés", async () => {
        const pRésultat = recherche.siPasVide();

        await constls[0].profil.sauvegarderNom({
          langue: "fr",
          nom: "Julien",
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idsComptes[0],
          résultatObjectif: {
            score: 4 / 9,
            type: "résultat",
            de: "nom",
            clef: "fr",
            info: {
              type: "texte",
              texte: "Julien",
              début: 0,
              fin: 6,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon courriel", function () {

      let recherche: ObtRecherche<InfoRésultatTexte>;
      before(async () => {
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].profil.recherche.selonCourriel({ courriel: "தொடர்பு@லஸ்ஸி.இந்தியா", f }),
        );
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("ajout détecté", async () => {
        const pRésultat = recherche.siPasVide();
        
        await constls[0].profil.sauvegarderCourriel({
          courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idsComptes[0],
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "courriel",
            info: {
              type: "texte",
              texte: "தொடர்பு@லஸ்ஸி.இந்தியா",
              début: 0,
              fin: 21,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });

      it("changements détectés", async () => {
        await constls[0].profil.effacerCourriel();
        await constls[0].profil.sauvegarderCourriel({
          courriel: "julien.malard@mail.mcgill.ca",
        });

        const résultat = await recherche.siVi();
        expect(résultat).to.be.empty();
      });
    });
  });

  describe("mots-clefs", () => {
    let fermer: Oublier;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("selon id", () => {
      let idMotClef: string;

      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        idMotClef = await constls[0].motsClefs.créerMotClef();
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].motsClefs.recherche.selonId({ idMotClef, f }),
        );
      });

      it("id mot-clef détecté", async () => {
        const résultat = await recherche.siPasVide();

        const réf: RésultatRecherche<InfoRésultatTexte>[] = [
          {
            id: idMotClef,
            résultatObjectif: {
              score: 0,
              type: "résultat",
              de: "id",
              info: {
                type: "texte",
                texte: idMotClef,
                début: 0,
                fin: idMotClef.length,
              },
            },
          },
        ];
        vérifierRecherche(résultat, réf);
      });
    });

    describe("selon nom", () => {
      let idMotClef: string;
      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].motsClefs.recherche.selonNom({ nomMotClef: "hydro", f }),
        );
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("rien si pas de nom", async () => {
        idMotClef = await constls[0].motsClefs.créerMotClef();

        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("nom mot-clef détecté", async () => {
        const pRésultat = recherche.siPasVide();

        await constls[0].motsClefs.sauvegarderNoms({
          idMotClef,
          noms: {
            fr: "hydrologie",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idMotClef,
          résultatObjectif: {
            score: 0.5,
            type: "résultat",
            de: "nom",
            clef: "fr",
            info: {
              type: "texte",
              texte: "hydrologie",
              début: 0,
              fin: 5,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("tous", () => {
      let idMotClef: string;
      let recherche: ObtRecherche<InfoRésultatVide>;

      before(async () => {
        recherche = await rechercher<InfoRésultatVide>(({ f }) =>
          constls[1].motsClefs.recherche.tous({ f }),
        );
      });

      it("mots-clefs détectés", async () => {
        const pRésultat = recherche.siPasVide();

        idMotClef = await constls[0].motsClefs.créerMotClef();

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatVide> = {
          id: idMotClef,
          résultatObjectif: {
            score: 1,
            type: "résultat",
            de: "*",
            info: {
              type: "vide",
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });
  });

  describe("variables", () => {
    let fermer: Oublier;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("selon id", () => {
      let idVariable: string;

      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        idVariable = await constls[0].variables.créerVariable({
          catégorie: "horoDatage",
        });
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].variables.recherche.selonId({ idVariable, f }),
        );
      });

      it("id variable détecté", async () => {
        const résultat = await recherche.siPasVide();

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idVariable,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "id",
            info: {
              type: "texte",
              texte: idVariable,
              début: 0,
              fin: idVariable.length,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon nom", () => {
      let idVariable: string;

      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].variables.recherche.selonNom({
            nomVariable: "précip",
            f,
          }),
        );
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("rien si pas de nom", async () => {
        idVariable = await constls[0].variables.créerVariable({
          catégorie: "audio",
        });

        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("nom variable détecté", async () => {
        const pRésultat = recherche.siPasVide();

        await constls[0].variables.sauvegarderNoms({
          idVariable,
          noms: {
            fr: "précipitation",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idVariable,
          résultatObjectif: {
            score: 0.5,
            type: "résultat",
            de: "nom",
            clef: "fr",
            info: {
              type: "texte",
              texte: "précipitation",
              début: 0,
              fin: 6,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon descriptions", () => {
      let idVariable: string;

      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].variables.recherche.selonDescription({
            descriptionVariable: "précip",
            f,
          }),
        );
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("rien si pas de nom", async () => {
        idVariable = await constls[0].variables.créerVariable({
          catégorie: "audio",
        });

        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("description variable détectée", async () => {
        const pRésultat = recherche.siPasVide();

        idVariable = await constls[0].variables.créerVariable({
          catégorie: "numérique",
        });

        await constls[0].variables.sauvegarderDescriptions({
          idVariable,
          descriptions: {
            fr: "précipitation",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idVariable,
          résultatObjectif: {
            score: 0.5,
            type: "résultat",
            de: "descriptions",
            clef: "fr",
            info: {
              type: "texte",
              texte: "précipitation",
              début: 0,
              fin: 6,
            },
          },
        };

        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("toutes", () => {
      let idVariable: string;
      let recherche: ObtRecherche<InfoRésultatVide>;

      before(async () => {
        recherche = await rechercher<InfoRésultatVide>(({ f }) =>
          constls[1].variables.recherche.toutes({ f }),
        );
      });

      it("variables détectées", async () => {
        const pRésultat = recherche.siPasVide();

        idVariable = await constls[0].motsClefs.créerMotClef();

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatVide> = {
          id: idVariable,
          résultatObjectif: {
            score: 1,
            type: "résultat",
            de: "*",
            info: {
              type: "vide",
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });
  });

  describe("bds", () => {
    let fermer: Oublier;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("selon id", () => {
      let idBd: string;

      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].bds.recherche.selonId({ idBd, f }),
        );
      });

      it("id bd détecté", async () => {
        const résultat = await recherche.siPasVide();

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idBd,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "id",
            info: {
              type: "texte",
              texte: idBd,
              début: 0,
              fin: idBd.length,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon nom", () => {
      let idBd: string;

      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].bds.recherche.selonNom({ nomBd: "météo", f }),
        );
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("rien si pas de nom", async () => {
        idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });

        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("nom bd détecté", async () => {
        const pRésultat = recherche.siPasVide();

        await constls[0].bds.sauvegarderNoms({
          idBd,
          noms: {
            fr: "météorologie",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idBd,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "nom",
            clef: "fr",
            info: {
              type: "texte",
              texte: "météorologie",
              début: 0,
              fin: 5,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon descriptions", () => {
      let idBd: string;

      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].bds.recherche.selonDescription({
            descriptionBd: "météo",
            f,
          }),
        );
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("rien si pas de description", async () => {
        idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });

        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("description bd détectée", async () => {
        const pRésultat = recherche.siPasVide();

        await constls[1].bds.sauvegarderDescriptions({
          idBd,
          descriptions: {
            fr: "Météorologie de la région de Montpellier.",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idBd,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "description",
            clef: "fr",
            info: {
              type: "texte",
              texte: "Météorologie de la région de Montpellier.",
              début: 0,
              fin: 5,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon variables", () => {
      let idBd: string;

      let recherche: ObtRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;

      before(async () => {
        recherche = await rechercher<InfoRésultatRecherche<InfoRésultatTexte>>(
          ({ f }) =>
            constls[1].bds.recherche.selonVariable({
              texte: "précipitation",
              f,
            }),
        );
        idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("nouvelle variable détectée", async () => {
        const pRésultat = recherche.siPasVide();

        const idVariable = await constls[0].variables.créerVariable({
          catégorie: "numérique",
        });
        const idTableau = await constls[0].bds.ajouterTableau({
          idBd,
        });
        await constls[0].bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable,
        });
        await constls[0].variables.sauvegarderNoms({
          idVariable,
          noms: {
            fr: "Précipitation",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>> =
          {
            id: idBd,
            résultatObjectif: {
              score: 0,
              type: "résultat",
              de: "variable",
              clef: idVariable,
              info: {
                type: "résultat",
                de: "nom",
                clef: "fr",
                info: {
                  type: "texte",
                  texte: "Précipitation",
                  début: 0,
                  fin: 13,
                },
              },
            },
          };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon mots-clefs", () => {
      let idBd: string;

      let recherche: ObtRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;

      before(async () => {
        recherche = await rechercher<InfoRésultatRecherche<InfoRésultatTexte>>(
          ({ f }) =>
            constls[1].bds.recherche.selonMotClef({ texte: "meteorología", f }),
        );
        idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("nouveau mot-clef détecté", async () => {
        const pRésultat = recherche.siPasVide();

        const idMotClef = await constls[1].motsClefs.créerMotClef();
        await constls[0].bds.ajouterMotsClefs({
          idBd,
          idsMotsClefs: idMotClef,
        });
        await constls[0].motsClefs.sauvegarderNoms({
          idMotClef,
          noms: {
            cst: "Meteorología",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>> =
          {
            id: idBd,
            résultatObjectif: {
              score: 0,
              type: "résultat",
              de: "motClef",
              clef: idMotClef,
              info: {
                type: "résultat",
                de: "nom",
                clef: "cst",
                info: {
                  type: "texte",
                  texte: "Meteorología",
                  début: 0,
                  fin: 12,
                },
              },
            },
          };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("toutes", () => {
      let idBd: string;

      let recherche: ObtRecherche<InfoRésultatTexte | InfoRésultatVide>;

      before(async () => {
        recherche = await rechercher<InfoRésultatTexte | InfoRésultatVide>(
          ({ f }) => constls[1].bds.recherche.toutes({ f }),
        );
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("bds détectées", async () => {
        const pRésultat = recherche.siPasVide();
        idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatVide> = {
          id: idBd,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "*",
            info: {
              type: "vide",
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });
  });

  describe("nuées", () => {
    let fermer: Oublier;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("selon id", () => {
      let idNuée: string;

      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        idNuée = await constls[0].nuées.créerNuée();
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].nuées.recherche.selonId({ idNuée, f }),
        );
      });

      it("id nuée détecté", async () => {
        const résultat = await recherche.siPasVide();

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idNuée,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "id",
            info: {
              type: "texte",
              texte: idNuée,
              début: 0,
              fin: idNuée.length,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon nom", () => {
      let idNuée: string;

      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].nuées.recherche.selonNom({ nomNuée: "météo", f }),
        );
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("rien si pas de nom", async () => {
        idNuée = await constls[0].nuées.créerNuée();

        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("nom nuée détecté", async () => {
        const pRésultat = recherche.siPasVide();

        await constls[0].nuées.sauvegarderNoms({
          idNuée,
          noms: {
            fr: "météorologie",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idNuée,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "nom",
            clef: "fr",
            info: {
              type: "texte",
              texte: "météorologie",
              début: 0,
              fin: 5,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon description", () => {
      let idNuée: string;

      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].nuées.recherche.selonDescription({
            descriptionNuée: "météo",
            f,
          }),
        );
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("rien si pas de description", async () => {
        idNuée = await constls[0].nuées.créerNuée();

        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("description nuée détectée", async () => {
        const pRésultat = recherche.siPasVide();

        await constls[0].nuées.sauvegarderDescriptions({
          idNuée,
          descriptions: {
            fr: "Météorologie de la région de Montpellier.",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idNuée,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "description",
            clef: "fr",
            info: {
              type: "texte",
              texte: "Météorologie de la région de Montpellier.",
              début: 0,
              fin: 5,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon variables", () => {
      let idNuée: string;

      let recherche: ObtRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;

      before(async () => {
        recherche = await rechercher<InfoRésultatRecherche<InfoRésultatTexte>>(
          ({ f }) =>
            constls[1].nuées.recherche.selonVariable({
              texte: "précipitation",
              f,
            }),
        );
        idNuée = await constls[0].nuées.créerNuée();
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("nouvelle variable détectée", async () => {
        const pRésultat = recherche.siPasVide();

        const idVariable = await constls[0].variables.créerVariable({
          catégorie: "numérique",
        });
        const idTableau = await constls[0].nuées.ajouterTableau({
          idNuée,
        });
        await constls[0].nuées.tableaux.ajouterColonne({
          idStructure: idNuée,
          idTableau,
          idVariable,
        });
        await constls[0].variables.sauvegarderNoms({
          idVariable,
          noms: {
            fr: "Précipitation",
          },
        });
        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>> =
          {
            id: idNuée,
            résultatObjectif: {
              score: 0,
              type: "résultat",
              de: "variable",
              clef: idVariable,
              info: {
                type: "résultat",
                de: "nom",
                clef: "fr",
                info: {
                  type: "texte",
                  texte: "Précipitation",
                  début: 0,
                  fin: 13,
                },
              },
            },
          };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon mots-clefs", () => {
      let idNuée: string;

      let recherche: ObtRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;

      before(async () => {
        recherche = await rechercher<InfoRésultatRecherche<InfoRésultatTexte>>(
          ({ f }) =>
            constls[1].nuées.recherche.selonMotClef({
              texte: "meteorología",
              f,
            }),
        );
        idNuée = await constls[0].nuées.créerNuée();
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("nouveau mot-clef détecté", async () => {
        const pRésultat = recherche.siPasVide();

        const idMotClef = await constls[1].motsClefs.créerMotClef();
        await constls[1].nuées.ajouterMotsClefs({
          idNuée,
          idsMotsClefs: idMotClef,
        });
        await constls[1].motsClefs.sauvegarderNoms({
          idMotClef,
          noms: {
            cst: "Meteorología",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>> =
          {
            id: idNuée,
            résultatObjectif: {
              score: 0,
              type: "résultat",
              de: "motClef",
              clef: idMotClef,
              info: {
                type: "résultat",
                de: "nom",
                clef: "cst",
                info: {
                  type: "texte",
                  texte: "Meteorología",
                  début: 0,
                  fin: 12,
                },
              },
            },
          };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("toutes", () => {
      let idNuée: string;

      let recherche: ObtRecherche<InfoRésultatTexte | InfoRésultatVide>;

      before(async () => {
        recherche = await rechercher<InfoRésultatTexte | InfoRésultatVide>(
          ({ f }) => constls[1].bds.recherche.toutes({ f }),
        );
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("nuées détectées", async () => {
        const pRésultat = recherche.siPasVide();
        idNuée = await constls[0].nuées.créerNuée();

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatVide> = {
          id: idNuée,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "*",
            info: {
              type: "vide",
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });
  });

  describe("projets", () => {
    let fermer: Oublier;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("selon id", () => {
      let idProjet: string;

      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        idProjet = await constls[0].projets.créerProjet();
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].projets.recherche.selonId({ idProjet, f }),
        );
      });

      it("id projet détecté", async () => {
        const résultat = await recherche.siPasVide();

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idProjet,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "id",
            info: {
              type: "texte",
              texte: idProjet,
              début: 0,
              fin: idProjet.length,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon nom", () => {
      let idProjet: string;

      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].projets.recherche.selonNom({ nomProjet: "météo", f }),
        );
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("rien si pas de nom", async () => {
        idProjet = await constls[0].projets.créerProjet();

        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("nom projet détecté", async () => {
        const pRésultat = recherche.siPasVide();

        await constls[0].projets.sauvegarderNoms({
          idProjet,
          noms: {
            fr: "météorologie",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idProjet,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "nom",
            clef: "fr",
            info: {
              type: "texte",
              texte: "météorologie",
              début: 0,
              fin: 5,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon descriptions", () => {
      let idProjet: string;

      let recherche: ObtRecherche<InfoRésultatTexte>;

      before(async () => {
        recherche = await rechercher<InfoRésultatTexte>(({ f }) =>
          constls[1].projets.recherche.selonDescription({
            descriptionProjet: "météo",
            f,
          }),
        );
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("rien si pas de description", async () => {
        idProjet = await constls[0].projets.créerProjet();

        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("description projet détectée", async () => {
        const pRésultat = recherche.siPasVide();

        await constls[0].projets.sauvegarderDescriptions({
          idProjet,
          descriptions: {
            fr: "météorologie",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idProjet,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "descriptions",
            clef: "fr",
            info: {
              type: "texte",
              texte: "météorologie",
              début: 0,
              fin: 5,
            },
          },
        };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon variables", () => {
      let idProjet: string;
      let idBd: string;

      let recherche: ObtRecherche<
        InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
      >;

      before(async () => {
        recherche = await rechercher<
          InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
        >(({ f }) =>
          constls[1].projets.recherche.selonVariable({
            texte: "précip",
            f,
          }),
        );
        idProjet = await constls[0].projets.créerProjet();
        idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });
        await constls[0].projets.ajouterBds({ idProjet, idsBds: idBd });
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("nouvelle variable détectée", async () => {
        const pRésultat = recherche.siPasVide();

        const idVariable = await constls[0].variables.créerVariable({
          catégorie: "numérique",
        });
        const idTableau = await constls[0].bds.ajouterTableau({
          idBd,
        });
        await constls[0].bds.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable,
        });
        await constls[0].variables.sauvegarderNoms({
          idVariable,
          noms: {
            fr: "Précipitation",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>> =
          {
            id: idProjet,
            résultatObjectif: {
              score: 0,
              type: "résultat",
              de: "variable",
              clef: idVariable,
              info: {
                type: "résultat",
                de: "nom",
                clef: "fr",
                info: {
                  type: "texte",
                  texte: "Précipitation",
                  début: 0,
                  fin: 6,
                },
              },
            },
          };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon mots-clefs", () => {
      let idProjet: string;
      let idBd: string;

      let recherche: ObtRecherche<
        InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
      >;

      before(async () => {
        recherche = await rechercher<
          InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
        >(({ f }) =>
          constls[1].projets.recherche.selonMotClef({
            texte: "meteorología",
            f,
          }),
        );
        idProjet = await constls[0].projets.créerProjet();
        idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });
        await constls[0].projets.ajouterBds({ idProjet, idsBds: idBd });
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("nouveau mot-clef sur la bd détecté", async () => {
        const pRésultat = recherche.siPasVide();

        const idMotClef = await constls[1].motsClefs.créerMotClef();
        await constls[1].bds.ajouterMotsClefs({
          idBd,
          idsMotsClefs: idMotClef,
        });
        await constls[1].motsClefs.sauvegarderNoms({
          idMotClef,
          noms: {
            cst: "Meteorología",
          },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>> =
          {
            id: idProjet,
            résultatObjectif: {
              score: 0,
              type: "résultat",
              de: "motClef",
              clef: idMotClef,
              info: {
                type: "résultat",
                de: "nom",
                clef: "cst",
                info: {
                  type: "texte",
                  texte: "Meteorología",
                  début: 0,
                  fin: 12,
                },
              },
            },
          };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("selon bd", () => {
      let idProjet: string;
      let idBd: string;

      type TypeRecherche =
        | InfoRésultatRecherche<
            | InfoRésultatTexte
            | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
            | InfoRésultatVide
          >
        | InfoRésultatVide;

      let recherche: ObtRecherche<TypeRecherche>;

      const nouveauNom = "Mi base de datos meteorológicos";

      before(async () => {
        recherche = await rechercher<TypeRecherche>(({ f }) =>
          constls[1].projets.recherche.selonBd({
            texte: nouveauNom,
            f,
          }),
        );

        idProjet = await constls[0].projets.créerProjet();
        idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });
        await constls[0].projets.ajouterBds({ idProjet, idsBds: idBd });
      });

      it("rien pour commencer", async () => {
        const résultat = await recherche.siDéfini();
        expect(résultat).to.be.empty();
      });

      it("changement nom bd détecté", async () => {
        const pRésultat = recherche.siPasVide();

        await constls[0].bds.sauvegarderNoms({
          idBd,
          noms: { cst: "Mi base de datos meteorológicos" },
        });

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>> =
          {
            id: idProjet,
            résultatObjectif: {
              score: 0,
              type: "résultat",
              de: "bd",
              clef: idBd,
              info: {
                type: "résultat",
                de: "nom",
                clef: "cst",
                info: {
                  type: "texte",
                  texte: nouveauNom,
                  début: 0,
                  fin: nouveauNom.length,
                },
              },
            },
          };
        vérifierRecherche(résultat, [réf]);
      });
    });

    describe("tous", () => {
      let idProjet: string;

      type TypeRecherche =
        | InfoRésultatRecherche<
            | InfoRésultatTexte
            | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
            | InfoRésultatVide
          >
        | InfoRésultatVide;

      let recherche: ObtRecherche<TypeRecherche>;

      before(async () => {
        recherche = await rechercher<TypeRecherche>(({ f }) =>
          constls[1].projets.recherche.tous({
            f,
          }),
        );
      });

      it("projet détecté", async () => {
        const pRésultat = recherche.siPasVide();

        idProjet = await constls[0].projets.créerProjet();

        const résultat = await pRésultat;

        const réf: RésultatRecherche<InfoRésultatVide> = {
          id: idProjet,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "*",
            info: {
              type: "vide",
            },
          },
        };

        vérifierRecherche(résultat, [réf]);
      });
    });
  });
});

describe.skip("Test fonctionnalités recherche", function () {

  let rechercheSurCompte1: ObtRecherche<InfoRésultatTexte>;
  let rechercheSurCompte2: ObtRecherche<InfoRésultatTexte>;

  before(async () => {
    rechercheSurCompte1 = await rechercher<InfoRésultatTexte>(({ f }) =>
      constls[0].profil.recherche.selonNom({ nom: "Julien", f }),
    );
    rechercheSurCompte2 = await rechercher<InfoRésultatTexte>(({ f }) =>
      constls[1].profil.recherche.selonNom({ nom: "Julien", f }),
    );

    réfconstl2 = {
      id: idsComptes[1],
      résultatObjectif: {
        score: 4 / 9,
        type: "résultat",
        de: "nom",
        clef: "fr",
        info: {
          type: "texte",
          texte: "Julien",
          début: 0,
          fin: 6,
        },
      },
    };
    réfconstl3 = {
      id: idsComptes[2],
      résultatObjectif: {
        score: 4 / 9,
        type: "résultat",
        de: "nom",
        clef: "cst",
        info: {
          type: "texte",
          texte: "Julián",
          début: 0,
          fin: 6,
        },
      },
    };
  });

  it("moins de résultats que demandé s'il n'y a vraiment rien", async () => {
    const pRésultat = rechercheSurCompte1.siPasVide();
    await constls[1].profil.sauvegarderNom({
      langue: "fr",
      nom: "Julien",
    });

    const résultat = await pRésultat;
    vérifierRecherche(résultat, [réfconstl2]);
  });

  it("on suit les changements", async () => {
    const pRésultat = rechercheSurCompte1.siAuMoins(2);
    await constls[2].profil.sauvegarderNom({
      langue: "cst",
      nom: "Julián",
    });

    const résultat = await pRésultat;
    vérifierRecherche(résultat, [réfconstl2, réfconstl3]);
  });

  it("diminuer N désiré", async () => {
    const pRésultat = rechercheSurCompte1.siPasPlusQue(1);
    await rechercheSurCompte1.n(1);

    const résultat = await pRésultat;
    vérifierRecherche(résultat, [réfconstl2]);
  });

  it("augmenter N désiré", async () => {
    const pRésultat = rechercheSurCompte1.siAuMoins(2);
    await rechercheSurCompte1.n(4);

    const résultat = await pRésultat;
    vérifierRecherche(résultat, [réfconstl2, réfconstl3]);
  });

  it("Augmenter N désiré d'abord", async () => {
    await fChangerN2(2);

    const val = await rés2.attendreQue((x) => !!x && x.length > 1);
    vérifierRecherche(val, [réfconstl2, réfconstl3]);
  });

  it("Et ensuite diminuer N désiré", async () => {
    await fChangerN2(1);

    const val = await rés2.attendreQue((x) => !!x && x.length === 1);
    vérifierRecherche(val, [réfconstl2]);
  });

  let fermer: Oublier;
  let constls: Constellation[];
  let constl: Constellation;
  const idsComptes: string[] = [];

  before(async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 5,
      créerConstellation,
    }));
    constl = constls[0];
    for (const [i, c] of constls.entries()) {
      idsComptes.push(await c.obtIdCompte());
      if (i < constls.length - 1) {
        await c.réseau.faireConfianceAuMembre({
          idCompte: await constls[i + 1].obtIdCompte(),
        });
      }
    }
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("Rechercher de réseau", () => {
    let fOublierRecherche: schémaFonctionOublier;
    let fChangerN: (x: number) => Promise<void>;

    const résMembresEnLigne = new utilsTestAttente.AttendreRésultat<
      statutMembre[]
    >();
    const résMotsClefs = new utilsTestAttente.AttendreRésultat<
      RésultatRecherche<InfoRésultatTexte>[]
    >();

    const fsOublier: schémaFonctionOublier[] = [];
    const motsClefs: { [key: string]: string } = {};

    before(async () => {
      fsOublier.push(
        await constl.réseau.suivreConnexionsMembres({
          f: (m) => résMembresEnLigne.mettreÀJour(m),
        }),
      );
      await résMembresEnLigne.attendreQue((x) => !!x && x.length === 5);

      for (const c of constls) {
        const idMotClef = await c.motsClefs.créerMotClef();
        const idCompte = await c.obtIdCompte();
        motsClefs[idCompte] = idMotClef;

        c.réseau.recevoirSalut = async () => {
          // Désactiver
        };
        c.réseau.dispositifsEnLigne = {};
        c.réseau.événements.emit("membreVu");
      }

      await résMembresEnLigne.attendreQue((x) => !!x && !x.length);

      ({ fOublier: fOublierRecherche, fChangerN } =
        await constl.recherche.rechercherMotsClefsSelonNom({
          nomMotClef: "ភ្លៀង",
          f: (r) => résMotsClefs.mettreÀJour(r),
          nRésultatsDésirés: 5,
        }));
      fsOublier.push(fOublierRecherche);
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
      résMembresEnLigne.toutAnnuler();
      résMotsClefs.toutAnnuler();
    });

    it("Mes objets sont détectés", async () => {
      const idMotClef = motsClefs[idsComptes[0]];
      const réf: RésultatRecherche<InfoRésultatTexte>[] = [
        {
          id: idMotClef,
          résultatObjectif: {
            score: 1,
            type: "résultat",
            de: "nom",
            clef: "ខ្មែរ",
            info: {
              type: "texte",
              texte: "ភ្លៀង",
              début: 0,
              fin: 5,
            },
          },
        },
      ];

      await constl.motsClefs.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          ខ្មែរ: "ភ្លៀង",
        },
      });

      const val = await résMotsClefs.attendreQue((x) => x.length > 0);
      vérifierRecherche(val, réf);
    });

    it("Objet devient intéressant", async () => {
      const réf: RésultatRecherche<InfoRésultatTexte>[] = [];

      for (const c of constls) {
        const idCompte = await c.obtIdCompte();
        const idMotClef = motsClefs[idCompte];
        réf.push({
          id: idMotClef,
          résultatObjectif: {
            score: 1,
            type: "résultat",
            de: "nom",
            clef: "ខ្មែរ",
            info: {
              type: "texte",
              texte: "ភ្លៀង",
              début: 0,
              fin: 5,
            },
          },
        });
        if (c === constl) continue;

        await c.motsClefs.sauvegarderNomsMotClef({
          idMotClef,
          noms: {
            ខ្មែរ: "ភ្លៀង",
          },
        });
      }

      const val = await résMotsClefs.attendreQue((x) => !!x && x.length >= 5);
      vérifierRecherche(val, réf);
    });

    it("Objet ne correspond plus", async () => {
      const idMotClef = motsClefs[idsComptes[4]];
      await constls[4].motsClefs.effacerNomMotClef({
        idMotClef,
        langue: "ខ្មែរ",
      });

      const réf: RésultatRecherche<InfoRésultatTexte>[] = [];
      for (const c of constls) {
        const idCompte = await c.obtIdCompte();
        const idMC = motsClefs[idCompte];
        if (idMC === idMotClef) continue;
        réf.push({
          id: idMC,
          résultatObjectif: {
            score: 1,
            type: "résultat",
            de: "nom",
            clef: "ខ្មែរ",
            info: {
              type: "texte",
              texte: "ភ្លៀង",
              début: 0,
              fin: 5,
            },
          },
        });
      }

      const val = await résMotsClefs.attendreQue(
        (x) => x.length > 0 && x.length <= 4,
      );
      vérifierRecherche(val, réf);
    });

    it("Diminuer N", async () => {
      await fChangerN(3);

      const réf: RésultatRecherche<InfoRésultatTexte>[] = [];
      for (const c of constls.slice(0, 3)) {
        const idCompte = await c.obtIdCompte();
        const idMC = motsClefs[idCompte];
        réf.push({
          id: idMC,
          résultatObjectif: {
            score: 1,
            type: "résultat",
            de: "nom",
            clef: "ខ្មែរ",
            info: {
              type: "texte",
              texte: "ភ្លៀង",
              début: 0,
              fin: 5,
            },
          },
        });
      }

      const val = await résMotsClefs.attendreQue((x) => !!x && x.length <= 3);
      vérifierRecherche(val, réf);
    });

    it.skip("Objet correspond mieux");

    it("Augmenter N", async () => {
      await fChangerN(10);

      const réf: RésultatRecherche<InfoRésultatTexte>[] = [];
      for (const c of constls.slice(0, 4)) {
        const idCompte = await c.obtIdCompte();
        const idMC = motsClefs[idCompte];
        réf.push({
          id: idMC,
          résultatObjectif: {
            score: 1,
            type: "résultat",
            de: "nom",
            clef: "ខ្មែរ",
            info: {
              type: "texte",
              texte: "ភ្លៀង",
              début: 0,
              fin: 5,
            },
          },
        });
      }

      const val = await résMotsClefs.attendreQue((x) => !!x && x.length >= 4);
      vérifierRecherche(val, réf);
    });
  });
});
