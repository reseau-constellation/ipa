import { expect } from "aegir/chai";
import type { Constellation } from "@/v2/index.js";
import type {
  InfoRésultat,
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
  expect(résultatsSansScore.length).to.eq(réfSansScore.length);
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
  describe("Profil", function () {
    let fermer: Oublier;
    let constls: Constellation[];
    let idsComptes: string[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 3,
      }));

      idsComptes = await Promise.all(
        constls.map(async (c) => await c.obtIdCompte()),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("selon nom", function () {
      let fChangerN: (n: number) => Promise<void>;

      let fOublier2: schémaFonctionOublier;
      let fChangerN2: (n: number) => Promise<void>;

      let réfconstl2: RésultatRecherche<InfoRésultatTexte>;
      let réfconstl3: RésultatRecherche<InfoRésultatTexte>;

      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();
      const rés2 = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier, fChangerN } =
          await constls[0].recherche.rechercherProfilsSelonNom({
            nom: "Julien",
            f: (membres) => rés.mettreÀJour(membres),
            nRésultatsDésirés: 2,
          }));

        ({ fOublier: fOublier2, fChangerN: fChangerN2 } =
          await constls[0].recherche.rechercherProfilsSelonNom({
            nom: "Julien",
            f: (membres) => rés2.mettreÀJour(membres),
            nRésultatsDésirés: 1,
          }));

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

      it("Moins de résultats que demandé s'il n'y a vraiment rien", async () => {
        await constls[1].profil.sauvegarderNom({
          langue: "fr",
          nom: "Julien",
        });

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réfconstl2]);
      });

      it("On suit les changements", async () => {
        await constls[2].profil.sauvegarderNom({
          langue: "cst",
          nom: "Julián",
        });

        const val = await rés.attendreQue((x) => !!x && x.length > 1);
        vérifierRecherche(val, [réfconstl2, réfconstl3]);
      });

      it("Diminuer N désiré", async () => {
        await fChangerN(1);

        const val = await rés.attendreQue((x) => !!x && x.length === 1);
        vérifierRecherche(val, [réfconstl2]);
      });

      it("Augmenter N désiré", async () => {
        await fChangerN(2);

        const val = await rés.attendreQue((x) => !!x && x.length > 1);
        vérifierRecherche(val, [réfconstl2, réfconstl3]);
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
    });

    describe("selon courriel", function () {
      let réfconstl2: RésultatRecherche<InfoRésultatTexte>;

      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } =
          await constls[0].recherche.rechercherProfilsSelonCourriel({
            courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
            f: (membres) => rés.mettreÀJour(membres),
            nRésultatsDésirés: 2,
          }));
        réfconstl2 = {
          id: idsComptes[1],
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
      });

      it("Rien pour commencer détecté", async () => {
        const val = await rés.attendreExiste();
        expect(val).to.be.empty();
      });

      it("Ajout détecté", async () => {
        await constls[1].profil.sauvegarderCourriel({
          courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
        });

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réfconstl2]);
      });

      it("Changements détectés", async () => {
        await constls[1].profil.effacerCourriel();
        await constls[1].profil.sauvegarderCourriel({
          courriel: "julien.malard@mail.mcgill.ca",
        });

        const val = await rés.attendreQue((x) => !x.length);
        expect(val.length).to.equal(0);
      });
    });

    describe("selon id", () => {
      let réfconstl2: RésultatRecherche<InfoRésultatTexte>;

      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherProfilsSelonId({
          idCompte: await constls[1].obtIdCompte(),
          f: (membres) => rés.mettreÀJour(membres),
          nRésultatsDésirés: 2,
        }));
        réfconstl2 = {
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
      });

      it("Membre détecté", async () => {
        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réfconstl2]);
      });
    });
  });

  describe("Mots-clefs", () => {
    let fermer: Oublier;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
        créerConstellation,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("selon id", () => {
      let réfconstl2: RésultatRecherche<InfoRésultatTexte>;

      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        const idMotClef = await constls[1].motsClefs.créerMotClef();

        ({ fOublier } = await constls[0].recherche.rechercherMotsClefsSelonId({
          idMotClef,
          f: (motsClefs) => rés.mettreÀJour(motsClefs),
          nRésultatsDésirés: 2,
        }));

        réfconstl2 = {
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
        };
      });

      it("Mot-clef détecté", async () => {
        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réfconstl2]);
      });
    });

    describe("selon nom", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherMotsClefsSelonNom({
          nomMotClef: "hydro",
          f: (motsClefs) => rés.mettreÀJour(motsClefs),
          nRésultatsDésirés: 2,
        }));
      });

      it("Rien pour commencer", async () => {
        const val = await rés.attendreExiste();
        expect(val.length).to.equal(0);
      });

      it("Nouveau mot-clef détecté", async () => {
        const idMotClef = await constls[1].motsClefs.créerMotClef();
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

        await constls[1].motsClefs.sauvegarderNomsMotClef({
          idMotClef,
          noms: {
            fr: "hydrologie",
          },
        });

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("tous", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherMotsClefs({
          f: (motsClefs) => rés.mettreÀJour(motsClefs),
          nRésultatsDésirés: 2,
        }));
      });

      it("Mots-clefs détectés", async () => {
        await rés.attendreQue((x) => x.length > 0);
      });
    });
  });

  describe("Variables", () => {
    let fermer: Oublier;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
        créerConstellation,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("selon id", () => {
      let réfconstl2: RésultatRecherche<InfoRésultatTexte>;

      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        const idVariable = await constls[1].variables.créerVariable({
          catégorie: "numérique",
        });

        ({ fOublier } = await constls[0].recherche.rechercherVariablesSelonId({
          idVariable,
          f: (motsClefs) => rés.mettreÀJour(motsClefs),
          nRésultatsDésirés: 2,
        }));

        réfconstl2 = {
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
      });

      it("Variable détecté", async () => {
        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réfconstl2]);
      });
    });

    describe("selon nom", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherVariablesSelonNom({
          nomVariable: "précip",
          f: (variables) => rés.mettreÀJour(variables),
          nRésultatsDésirés: 2,
        }));
      });

      it("Rien pour commencer", async () => {
        const val = await rés.attendreExiste();
        expect(val.length).to.equal(0);
      });

      it("Nouvelle variable détectée", async () => {
        const idVariable = await constls[1].variables.créerVariable({
          catégorie: "numérique",
        });
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

        await constls[1].variables.sauvegarderNomsVariable({
          idVariable,
          noms: {
            fr: "précipitation",
          },
        });

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("selon descr", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } =
          await constls[0].recherche.rechercherVariablesSelonDescr({
            descrVariable: "précip",
            f: (variables) => rés.mettreÀJour(variables),
            nRésultatsDésirés: 2,
          }));
      });

      it("Rien pour commencer", async () => {
        const val = await rés.attendreExiste();
        expect(val.length).to.equal(0);
      });

      it("Nouvelle variable détectée", async () => {
        const idVariable = await constls[1].variables.créerVariable({
          catégorie: "numérique",
        });
        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idVariable,
          résultatObjectif: {
            score: 0.5,
            type: "résultat",
            de: "descr",
            clef: "fr",
            info: {
              type: "texte",
              texte: "précipitation",
              début: 0,
              fin: 6,
            },
          },
        };

        await constls[1].variables.sauvegarderDescriptionsVariable({
          idVariable,
          descriptions: {
            fr: "précipitation",
          },
        });

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("tous", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherVariables({
          f: (variables) => rés.mettreÀJour(variables),
          nRésultatsDésirés: 2,
        }));
      });

      it("Variables détectées", async () => {
        await rés.attendreQue((x) => x.length > 0);
      });
    });
  });

  describe("Bds", () => {
    let idBd: string;

    let fermer: Oublier;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
        créerConstellation,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("selon id", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });

        ({ fOublier } = await constls[0].recherche.rechercherBdsSelonId({
          idBd,
          f: (bds) => rés.mettreÀJour(bds),
          nRésultatsDésirés: 2,
        }));
      });

      it("Bd détectée", async () => {
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
        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("selon nom", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherBdsSelonNom({
          nomBd: "météo",
          f: (bds) => rés.mettreÀJour(bds),
          nRésultatsDésirés: 2,
        }));
      });

      it("Bd détectée", async () => {
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
        await constls[1].bds.sauvegarderNomsBd({
          idBd,
          noms: { fr: "météorologie" },
        });
        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("selon descr", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherBdsSelonDescr({
          descrBd: "météo",
          f: (bds) => rés.mettreÀJour(bds),
          nRésultatsDésirés: 2,
        }));
      });

      it("Bd détectée", async () => {
        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idBd,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "descr",
            clef: "fr",
            info: {
              type: "texte",
              texte: "Météorologie de la région de Montpellier.",
              début: 0,
              fin: 5,
            },
          },
        };
        await constls[1].bds.sauvegarderDescriptionsBd({
          idBd,
          descriptions: {
            fr: "Météorologie de la région de Montpellier.",
          },
        });
        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("selon variables", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherBdsSelonVariable({
          texte: "précipitation",
          f: (bds) => rés.mettreÀJour(bds),
          nRésultatsDésirés: 2,
        }));
      });

      it("Nouvelle variable détectée", async () => {
        const idVariable = await constls[1].variables.créerVariable({
          catégorie: "numérique",
        });
        const idTableau = await constls[1].bds.ajouterTableauBd({
          idBd,
        });
        await constls[1].tableaux.ajouterColonneTableau({
          idTableau,
          idVariable,
        });
        await constls[1].variables.sauvegarderNomsVariable({
          idVariable,
          noms: {
            fr: "Précipitation",
          },
        });

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

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("selon mots-clefs", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherBdsSelonMotClef({
          texte: "meteorología",
          f: (bds) => rés.mettreÀJour(bds),
          nRésultatsDésirés: 2,
        }));
      });

      it("Nouveau mot-clef détecté", async () => {
        const idMotClef = await constls[1].motsClefs.créerMotClef();
        await constls[1].bds.ajouterMotsClefsBd({
          idBd,
          idsMotsClefs: idMotClef,
        });
        await constls[1].motsClefs.sauvegarderNomsMotClef({
          idMotClef,
          noms: {
            cst: "Meteorología",
          },
        });

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

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("tous", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherBds({
          f: (bds) => rés.mettreÀJour(bds),
          nRésultatsDésirés: 2,
        }));
      });

      it("Bd détectée", async () => {
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
        await constls[1].bds.sauvegarderNomsBd({
          idBd,
          noms: {
            fr: "Météorologie de la région de Montpellier.",
          },
        });
        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });
  });

  describe("Nuées", () => {
    let idNuée: string;

    let fermer: Oublier;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
        créerConstellation,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("selon id", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        idNuée = await constls[1].nuées.créerNuée();

        ({ fOublier } = await constls[0].recherche.rechercherNuéesSelonId({
          idNuée,
          f: (nuées) => rés.mettreÀJour(nuées),
          nRésultatsDésirés: 2,
        }));
      });

      it("Nuée détectée", async () => {
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
        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });
    describe("selon nom", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherNuéesSelonNom({
          nomNuée: "météo",
          f: (nuées) => rés.mettreÀJour(nuées),
          nRésultatsDésirés: 2,
        }));
      });

      it("Nuée détectée", async () => {
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
        await constls[1].nuées.sauvegarderNomsNuée({
          idNuée,
          noms: { fr: "météorologie" },
        });
        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("selon descr", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherNuéesSelonDescr({
          descrNuée: "météo",
          f: (nuées) => rés.mettreÀJour(nuées),
          nRésultatsDésirés: 2,
        }));
      });

      it("Nuée détectée", async () => {
        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idNuée,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "descr",
            clef: "fr",
            info: {
              type: "texte",
              texte: "Météorologie de la région de Montpellier.",
              début: 0,
              fin: 5,
            },
          },
        };
        await constls[1].nuées.sauvegarderDescriptionsNuée({
          idNuée,
          descriptions: {
            fr: "Météorologie de la région de Montpellier.",
          },
        });
        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("selon variables", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherNuéesSelonVariable(
          {
            texte: "précipitation",
            f: (nuées) => rés.mettreÀJour(nuées),
            nRésultatsDésirés: 2,
          },
        ));
      });

      it("Nouvelle variable détectée", async () => {
        const idVariable = await constls[1].variables.créerVariable({
          catégorie: "numérique",
        });
        const idTableau = await constls[1].nuées.ajouterTableauNuée({
          idNuée,
        });
        await constls[1].nuées.ajouterColonneTableauNuée({
          idTableau,
          idVariable,
        });
        await constls[1].variables.sauvegarderNomsVariable({
          idVariable,
          noms: {
            fr: "Précipitation",
          },
        });

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

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("selon mots-clefs", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherNuéesSelonMotClef({
          texte: "meteorología",
          f: (nuées) => rés.mettreÀJour(nuées),
          nRésultatsDésirés: 2,
        }));
      });

      it("Nouveau mot-clef détecté", async () => {
        const idMotClef = await constls[1].motsClefs.créerMotClef();
        await constls[1].nuées.ajouterMotsClefsNuée({
          idNuée,
          idsMotsClefs: idMotClef,
        });
        await constls[1].motsClefs.sauvegarderNomsMotClef({
          idMotClef,
          noms: {
            cst: "Meteorología",
          },
        });

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

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("tous", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherNuées({
          f: (nuées) => rés.mettreÀJour(nuées),
          nRésultatsDésirés: 2,
        }));
      });

      it("Nuée détectée", async () => {
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
        await constls[1].nuées.sauvegarderNomsNuée({
          idNuée,
          noms: {
            fr: "Météorologie de la région de Montpellier.",
          },
        });
        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });
  });

  describe("Projets", () => {
    let idProjet: string;
    let idBd: string;

    let fermer: Oublier;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
        créerConstellation,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    describe("selon id", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        idProjet = await constls[1].projets.créerProjet();

        ({ fOublier } = await constls[0].recherche.rechercherProjetsSelonId({
          idProjet,
          f: (x) => rés.mettreÀJour(x),
          nRésultatsDésirés: 2,
        }));
      });

      it("Projet détecté", async () => {
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
        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("selon nom", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherProjetsSelonNom({
          nomProjet: "météo",
          f: (projets) => rés.mettreÀJour(projets),
          nRésultatsDésirés: 2,
        }));
      });

      it("Projet détecté", async () => {
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
        await constls[1].projets.sauvegarderNomsProjet({
          idProjet,
          noms: {
            fr: "météorologie",
          },
        });

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("selon descr", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherProjetsSelonDescr({
          descrProjet: "météo",
          f: (projets) => rés.mettreÀJour(projets),
          nRésultatsDésirés: 2,
        }));
      });

      it("Projet détecté", async () => {
        const réf: RésultatRecherche<InfoRésultatTexte> = {
          id: idProjet,
          résultatObjectif: {
            score: 0,
            type: "résultat",
            de: "descr",
            clef: "fr",
            info: {
              type: "texte",
              texte: "Météorologie de la région de Montpellier.",
              début: 0,
              fin: 5,
            },
          },
        };
        await constls[1].projets.sauvegarderDescriptionsProjet({
          idProjet,
          descriptions: {
            fr: "Météorologie de la région de Montpellier.",
          },
        });

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("selon variables", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<
          InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
        >[]
      >();

      before(async () => {
        idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });
        await constls[1].projets.ajouterBdProjet({ idProjet, idBd });

        ({ fOublier } =
          await constls[0].recherche.rechercherProjetsSelonVariable({
            texte: "précip",
            f: (bds) => rés.mettreÀJour(bds),
            nRésultatsDésirés: 2,
          }));
      });

      it("Nouvelle variable détectée", async () => {
        const idVariable = await constls[1].variables.créerVariable({
          catégorie: "numérique",
        });
        const idTableau = await constls[1].bds.ajouterTableauBd({
          idBd,
        });
        await constls[1].tableaux.ajouterColonneTableau({
          idTableau,
          idVariable,
        });
        await constls[1].variables.sauvegarderNomsVariable({
          idVariable,
          noms: {
            fr: "Précipitation",
          },
        });

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

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("selon mots-clefs", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<
          InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
        >[]
      >();

      before(async () => {
        idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });
        await constls[1].projets.ajouterBdProjet({ idProjet, idBd });

        ({ fOublier } =
          await constls[0].recherche.rechercherProjetsSelonMotClef({
            texte: "meteorología",
            f: (projets) => rés.mettreÀJour(projets),
            nRésultatsDésirés: 2,
          }));
      });

      it("Nouveau mot-clef sur la bd détecté", async () => {
        const idMotClef = await constls[1].motsClefs.créerMotClef();
        await constls[1].bds.ajouterMotsClefsBd({
          idBd,
          idsMotsClefs: idMotClef,
        });
        await constls[1].motsClefs.sauvegarderNomsMotClef({
          idMotClef,
          noms: {
            cst: "Meteorología",
          },
        });

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

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("selon bd", () => {
      const nouveauNom = "Mi base de datos meteorológicos";
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<
          | InfoRésultatRecherche<
              | InfoRésultatTexte
              | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
              | InfoRésultatVide
            >
          | InfoRésultatVide
        >[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherProjetsSelonBd({
          texte: nouveauNom,
          f: (projets) => rés.mettreÀJour(projets),
          nRésultatsDésirés: 2,
        }));
      });

      it("Changement nom bd détecté", async () => {
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
        await constls[1].bds.sauvegarderNomsBd({
          idBd,
          noms: { cst: "Mi base de datos meteorológicos" },
        });

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });

    describe("tous", () => {
      const rés = new utilsTestAttente.AttendreRésultat<
        RésultatRecherche<InfoRésultatTexte>[]
      >();

      before(async () => {
        ({ fOublier } = await constls[0].recherche.rechercherProjets({
          f: (projets) => rés.mettreÀJour(projets),
          nRésultatsDésirés: 2,
        }));
      });

      it("Projet détecté", async () => {
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
        await constls[1].projets.sauvegarderNomsProjet({
          idProjet,
          noms: {
            fr: "Météorologie de la région de Montpellier.",
          },
        });

        const val = await rés.attendreQue((x) => x.length > 0);
        vérifierRecherche(val, [réf]);
      });
    });
  });
});

describe.skip("Test fonctionnalités recherche", function () {
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
