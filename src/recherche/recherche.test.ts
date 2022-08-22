import { step } from "mocha-steps";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import { statutMembre } from "@/reseau";
import {
  schémaFonctionOublier,
  résultatRecherche,
  infoRésultat,
  infoRésultatTexte,
  infoRésultatRecherche,
  infoRésultatVide,
} from "@/utils";


import { générerClients, typesClients, attendreRésultat } from "@/utilsTests";


const vérifierRecherche = (
  résultats: résultatRecherche<infoRésultat>[],
  réf: résultatRecherche<infoRésultat>[],
  scores: { [key: string]: (x: number) => void } = {}
) => {
  const scoresRésultat = Object.fromEntries(
    résultats.map((r) => [r.id, r.résultatObjectif.score])
  );
  const résultatsSansScore = résultats.map((r) => {
    const sansScore: { [key: string]: any } = {
      ...r,
    };
    return (sansScore.résultatObjectif = Object.fromEntries(
      Object.entries(sansScore.résultatObjectif).filter((x) => x[0] !== "score")
    ));
  });

  const réfSansScore = réf.map((r) => {
    const sansScore: { [key: string]: any } = {
      ...r,
    };
    return (sansScore.résultatObjectif = Object.fromEntries(
      Object.entries(sansScore.résultatObjectif).filter((x) => x[0] !== "score")
    ));
  });

  expect(résultatsSansScore).toEqual(réfSansScore);
  for (const clef of Object.keys(scoresRésultat)) {
    const rés = scoresRésultat[clef];
    (
      scores[clef] ||
      ((x: number) => {
        expect(x).toBeGreaterThan(0)
        expect(x).toBeLessThanOrEqual(1)
      })
    )(rés);
  }
};

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Rechercher dans réseau", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;
      let client2: ClientConstellation;
      let client3: ClientConstellation;

      beforeAll(async () => {
        enregistrerContrôleurs();
        ({ fOublier: fOublierClients, clients } = await générerClients(
          3,
          type
        ));
        [client, client2, client3] = clients;
      });

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("Profil", function () {
        describe("selon nom", function () {
          let fOublier: schémaFonctionOublier;
          let fChangerN: (n: number) => void;
          let réfClient2: résultatRecherche<infoRésultatTexte>;
          let réfClient3: résultatRecherche<infoRésultatTexte>;

          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier, fChangerN } =
              await client.recherche!.rechercherProfilSelonNom({
                nom: "Julien",
                f: (membres) => (rés.ultat = membres),
                nRésultatsDésirés: 2,
              }));
            réfClient2 = {
              id: client2.idBdCompte!,
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
            réfClient3 = {
              id: client3.idBdCompte!,
              résultatObjectif: {
                score: 4 / 9,
                type: "résultat",
                de: "nom",
                clef: "es",
                info: {
                  type: "texte",
                  texte: "Julián",
                  début: 0,
                  fin: 6,
                },
              },
            };
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step(
            "Moins de résultats que demandé s'il n'y a vraiment rien",
            async () => {
              await client2.profil!.sauvegarderNom({
                langue: "fr",
                nom: "Julien",
              });

              await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
              vérifierRecherche(rés.ultat!, [réfClient2]);
            }
          );

          step("On suit les changements", async () => {
            await client3.profil!.sauvegarderNom({
              langue: "es",
              nom: "Julián",
            });

            await attendreRésultat(rés, "ultat", (x) => x && x.length > 1);
            vérifierRecherche(rés.ultat!, [réfClient2, réfClient3]);
          });

          step("Diminuer N désiré", async () => {
            fChangerN(1);

            await attendreRésultat(rés, "ultat", (x) => x && x.length === 1);
            vérifierRecherche(rés.ultat!, [réfClient2]);
          });

          step("Augmenter N désiré", async () => {
            fChangerN(2);

            await attendreRésultat(rés, "ultat", (x) => x && x.length > 1);
            vérifierRecherche(rés.ultat!, [réfClient2, réfClient3]);
          });
        });
        describe("selon courriel", function () {
          let fOublier: schémaFonctionOublier;
          let réfClient2: résultatRecherche<infoRésultatTexte>;

          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier } =
              await client.recherche!.rechercherProfilSelonCourriel({
                courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
                f: (membres) => (rés.ultat = membres),
                nRésultatsDésirés: 2,
              }));
            réfClient2 = {
              id: client2.idBdCompte!,
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

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Rien pour commencer détecté", async () => {
            await client2.profil!.sauvegarderCourriel({
              courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
            });

            await attendreRésultat(rés, "ultat");
            expect(rés.ultat).toBeTruthy();
            expect(rés.ultat).toHaveLength(0);
          });

          step("Ajout détecté", async () => {
            await client2.profil!.sauvegarderCourriel({
              courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
            });

            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réfClient2]);
          });

          step("Changements détectés", async () => {
            await client2.profil!.sauvegarderCourriel({
              courriel: "julien.malard@mail.mcgill.ca",
            });

            await attendreRésultat(rés, "ultat", (x) => x && !x.length);
            expect(rés.ultat).toHaveLength(0);
          });
        });

        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          let réfClient2: résultatRecherche<infoRésultatTexte>;

          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherProfilSelonId({
              idCompte: client2.idBdCompte!,
              f: (membres) => (rés.ultat = membres),
              nRésultatsDésirés: 2,
            }));
            réfClient2 = {
              id: client2.idBdCompte!,
              résultatObjectif: {
                score: 0,
                type: "résultat",
                de: "id",
                info: {
                  type: "texte",
                  texte: client2.idBdCompte!,
                  début: 0,
                  fin: client2.idBdCompte!.length,
                },
              },
            };
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Membre détecté", async () => {
            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réfClient2]);
          });
        });
      });

      describe("Mots-clefs", () => {
        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          let réfClient2: résultatRecherche<infoRésultatTexte>;

          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            const idMotClef = await client2.motsClefs!.créerMotClef();
            ({ fOublier } = await client.recherche!.rechercherMotClefSelonId({
              idMotClef,
              f: (motsClefs) => (rés.ultat = motsClefs),
              nRésultatsDésirés: 2,
            }));
            réfClient2 = {
              id: client2.idBdCompte!,
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

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Mot-clef détecté", async () => {
            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réfClient2]);
          });
        });

        describe("selon nom", () => {
          let fOublier: schémaFonctionOublier;
          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherMotClefSelonNom({
              nomMotClef: "hydro",
              f: (motsClefs) => (rés.ultat = motsClefs),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Rien pour commencer", async () => {
            await attendreRésultat(rés, "ultat");
            expect(rés.ultat).toHaveLength(0);
          });

          step("Nouveau mot-clef détecté", async () => {
            const idMotClef = await client2.motsClefs!.créerMotClef();
            const réf: résultatRecherche<infoRésultatTexte> = {
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

            await client2.motsClefs!.ajouterNomsMotClef({
              id: idMotClef,
              noms: {
                fr: "hydrologie",
              },
            });

            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });

        describe("tous", () => {
          let fOublier: schémaFonctionOublier;
          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherMotsClefs({
              f: (motsClefs) => (rés.ultat = motsClefs),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Mots-clefs détectés", async () => {
            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
          });
        });
      });

      describe("Variables", () => {
        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          let réfClient2: résultatRecherche<infoRésultatTexte>;

          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            const idVariable = await client2.variables!.créerVariable({
              catégorie: "numérique",
            });
            ({ fOublier } = await client.recherche!.rechercherVariableSelonId({
              idVariable,
              f: (motsClefs) => (rés.ultat = motsClefs),
              nRésultatsDésirés: 2,
            }));
            réfClient2 = {
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

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Variable détecté", async () => {
            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réfClient2]);
          });
        });

        describe("selon nom", () => {
          let fOublier: schémaFonctionOublier;
          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherVariableSelonNom({
              nomVariable: "précip",
              f: (variables) => (rés.ultat = variables),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Rien pour commencer", async () => {
            await attendreRésultat(rés, "ultat");
            expect(rés.ultat).toHaveLength(0);
          });

          step("Nouvelle variable détectée", async () => {
            const idVariable = await client2.variables!.créerVariable({
              catégorie: "numérique",
            });
            const réf: résultatRecherche<infoRésultatTexte> = {
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

            await client2.variables!.ajouterNomsVariable({
              id: idVariable,
              noms: {
                fr: "précipitation",
              },
            });

            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });

        describe("selon descr", () => {
          let fOublier: schémaFonctionOublier;
          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier } =
              await client.recherche!.rechercherVariableSelonDescr({
                descrVariable: "précip",
                f: (variables) => (rés.ultat = variables),
                nRésultatsDésirés: 2,
              }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Rien pour commencer", async () => {
            await attendreRésultat(rés, "ultat");
            expect(rés.ultat).toHaveLength(0);
          });

          step("Nouvelle variable détectée", async () => {
            const idVariable = await client2.variables!.créerVariable({
              catégorie: "numérique",
            });
            const réf: résultatRecherche<infoRésultatTexte> = {
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

            await client2.variables!.ajouterDescriptionsVariable({
              id: idVariable,
              descriptions: {
                fr: "précipitation",
              },
            });

            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });

        describe("tous", () => {
          let fOublier: schémaFonctionOublier;
          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherVariables({
              f: (variables) => (rés.ultat = variables),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Variables détectées", async () => {
            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
          });
        });
      });

      describe("Bds", () => {
        let idBd: string;

        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            idBd = await client2.bds!.créerBd({ licence: "ODbl-1_0" });

            ({ fOublier } = await client.recherche!.rechercherBdSelonId({
              idBd,
              f: (bds) => (rés.ultat = bds),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Bd détectée", async () => {
            const réf: résultatRecherche<infoRésultatTexte> = {
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
            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });
        describe("selon nom", () => {
          let fOublier: schémaFonctionOublier;
          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherBdSelonNom({
              nomBd: "météo",
              f: (bds) => (rés.ultat = bds),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Bd détectée", async () => {
            const réf: résultatRecherche<infoRésultatTexte> = {
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
            await client2.bds!.ajouterNomsBd({
              id: idBd,
              noms: { fr: "météorologie" },
            });
            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });

        describe("selon descr", () => {
          let fOublier: schémaFonctionOublier;
          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherBdSelonDescr({
              descrBd: "météo",
              f: (bds) => (rés.ultat = bds),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Bd détectée", async () => {
            const réf: résultatRecherche<infoRésultatTexte> = {
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
            await client2.bds!.ajouterDescriptionsBd({
              id: idBd,
              descriptions: {
                fr: "Météorologie de la région de Montpellier.",
              },
            });
            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });

        describe("selon variables", () => {
          let fOublier: schémaFonctionOublier;
          const rés: {
            ultat?: résultatRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            >[];
          } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherBdSelonVariable({
              texte: "précipitation",
              f: (bds) => (rés.ultat = bds),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Nouvelle variable détectée", async () => {
            const idVariable = await client2.variables!.créerVariable({
              catégorie: "numérique",
            });
            const idTableau = await client2.bds!.ajouterTableauBd({ id: idBd });
            await client2.tableaux!.ajouterColonneTableau({
              idTableau,
              idVariable,
            });
            await client2.variables!.ajouterNomsVariable({
              id: idVariable,
              noms: {
                fr: "Précipitation",
              },
            });

            const réf: résultatRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
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

            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });

        describe("selon mots-clefs", () => {
          let fOublier: schémaFonctionOublier;
          const rés: {
            ultat?: résultatRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            >[];
          } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherBdSelonMotClef({
              texte: "meteorología",
              f: (bds) => (rés.ultat = bds),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Nouveau mot-clef détecté", async () => {
            const idMotClef = await client2.motsClefs!.créerMotClef();
            await client2.bds!.ajouterMotsClefsBd({
              idBd,
              idsMotsClefs: idMotClef,
            });
            await client2.motsClefs!.ajouterNomsMotClef({
              id: idMotClef,
              noms: {
                es: "Meteorología",
              },
            });

            const réf: résultatRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
              id: idBd,
              résultatObjectif: {
                score: 0,
                type: "résultat",
                de: "motClef",
                clef: idMotClef,
                info: {
                  type: "résultat",
                  de: "nom",
                  clef: "es",
                  info: {
                    type: "texte",
                    texte: "Meteorología",
                    début: 0,
                    fin: 12,
                  },
                },
              },
            };

            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });

        describe("tous", () => {
          let fOublier: schémaFonctionOublier;
          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherBds({
              f: (bds) => (rés.ultat = bds),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Bd détectée", async () => {
            const réf: résultatRecherche<infoRésultatVide> = {
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
            await client2.bds!.ajouterNomsBd({
              id: idBd,
              noms: {
                fr: "Météorologie de la région de Montpellier.",
              },
            });
            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });
      });

      describe("Projets", () => {
        let idProjet: string;
        let idBd: string;

        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            idProjet = await client2.projets!.créerProjet();

            ({ fOublier } = await client.recherche!.rechercherProjetSelonId({
              idProjet,
              f: (bds) => (rés.ultat = bds),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Projet détecté", async () => {
            const réf: résultatRecherche<infoRésultatTexte> = {
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
            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });

        describe("selon nom", () => {
          let fOublier: schémaFonctionOublier;
          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherProjetSelonNom({
              nomProjet: "météo",
              f: (projets) => (rés.ultat = projets),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Projet détecté", async () => {
            const réf: résultatRecherche<infoRésultatTexte> = {
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
            await client2.projets!.ajouterNomsProjet({
              id: idProjet,
              noms: {
                fr: "météorologie",
              },
            });

            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });
        describe("selon descr", () => {
          let fOublier: schémaFonctionOublier;
          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherProjetSelonDescr({
              descrProjet: "météo",
              f: (projets) => (rés.ultat = projets),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Projet détecté", async () => {
            const réf: résultatRecherche<infoRésultatTexte> = {
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
            await client2.projets!.ajouterDescriptionsProjet({
              id: idProjet,
              descriptions: {
                fr: "Météorologie de la région de Montpellier.",
              },
            });

            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });

        describe("selon variables", () => {
          let fOublier: schémaFonctionOublier;
          const rés: {
            ultat?: résultatRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            >[];
          } = {};

          beforeAll(async () => {
            idBd = await client2.bds!.créerBd({ licence: "ODbl-1_0" });
            await client2.projets!.ajouterBdProjet({ idProjet, idBd });

            ({ fOublier } =
              await client.recherche!.rechercherProjetSelonVariable({
                texte: "précip",
                f: (bds) => (rés.ultat = bds),
                nRésultatsDésirés: 2,
              }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Nouvelle variable détectée", async () => {
            const idVariable = await client2.variables!.créerVariable({
              catégorie: "numérique",
            });
            const idTableau = await client2.bds!.ajouterTableauBd({ id: idBd });
            await client2.tableaux!.ajouterColonneTableau({
              idTableau,
              idVariable,
            });
            await client2.variables!.ajouterNomsVariable({
              id: idVariable,
              noms: {
                fr: "Précipitation",
              },
            });

            const réf: résultatRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
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

            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });

        describe("selon mots-clefs", () => {
          let fOublier: schémaFonctionOublier;
          const rés: {
            ultat?: résultatRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            >[];
          } = {};

          beforeAll(async () => {
            idBd = await client2.bds!.créerBd({ licence: "ODbl-1_0" });
            await client2.projets!.ajouterBdProjet({ idProjet, idBd });

            ({ fOublier } =
              await client.recherche!.rechercherProjetSelonMotClef({
                texte: "meteorología",
                f: (bds) => (rés.ultat = bds),
                nRésultatsDésirés: 2,
              }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Nouveau mot-clef sur la bd détecté", async () => {
            const idMotClef = await client2.motsClefs!.créerMotClef();
            await client2.bds!.ajouterMotsClefsBd({
              idBd,
              idsMotsClefs: idMotClef,
            });
            await client2.motsClefs!.ajouterNomsMotClef({
              id: idMotClef,
              noms: {
                es: "Meteorología",
              },
            });

            const réf: résultatRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
              id: idBd,
              résultatObjectif: {
                score: 0,
                type: "résultat",
                de: "motClef",
                clef: idMotClef,
                info: {
                  type: "résultat",
                  de: "nom",
                  clef: "es",
                  info: {
                    type: "texte",
                    texte: "Meteorología",
                    début: 0,
                    fin: 12,
                  },
                },
              },
            };

            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });

        describe("selon bd", () => {
          let fOublier: schémaFonctionOublier;
          const rés: {
            ultat?: résultatRecherche<
              infoRésultatRecherche<
                infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
              >
            >[];
          } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherProjetSelonBd({
              texte: "meteorología",
              f: (projets) => (rés.ultat = projets),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Changement nom bd détecté", async () => {
            const réf: résultatRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
              id: idProjet,
              résultatObjectif: {
                score: 0,
                type: "résultat",
                de: "bd",
                clef: idBd,
                info: {
                  type: "résultat",
                  de: "nom",
                  clef: "es",
                  info: {
                    type: "texte",
                    texte: "Meteorología",
                    début: 0,
                    fin: 12,
                  },
                },
              },
            };
            await client2.bds!.ajouterNomsBd({
              id: idBd,
              noms: { es: "Meteorología" },
            });

            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });

        describe("tous", () => {
          let fOublier: schémaFonctionOublier;
          const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherProjets({
              f: (projets) => (rés.ultat = projets),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(() => {
            if (fOublier) fOublier();
          });

          step("Projet détecté", async () => {
            const réf: résultatRecherche<infoRésultatVide> = {
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
            await client2.projets!.ajouterNomsProjet({
              id: idProjet,
              noms: {
                fr: "Météorologie de la région de Montpellier.",
              },
            });

            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);
            vérifierRecherche(rés.ultat!, [réf]);
          });
        });
      });
    });
  });
});

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Test fonctionnalités recherche", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      beforeAll(async () => {
        enregistrerContrôleurs();
        ({ fOublier: fOublierClients, clients } = await générerClients(
          5,
          type
        ));
        client = clients[0];
        for (const [i, c] of clients.entries()) {
          if (i < clients.length - 1) {
            await c.réseau!.faireConfianceAuMembre({
              idBdCompte: clients[i + 1].idBdCompte!,
            });
          }
        }
      });

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("Rechercher de réseau", () => {
        let fOublierRecherche: schémaFonctionOublier;
        let fChangerN: (x: number) => void;

        const rés: {
          membresEnLigne?: statutMembre[];
          motsClefs?: résultatRecherche<infoRésultatTexte>[];
        } = {};
        const fsOublier: schémaFonctionOublier[] = [];
        const motsClefs: { [key: string]: string } = {};

        beforeAll(async () => {
          fsOublier.push(
            await client.réseau!.suivreConnexionsMembres({
              f: (m) => (rés.membresEnLigne = m),
            })
          );
          await attendreRésultat(
            rés,
            "membresEnLigne",
            (x) => x && x.length === 5
          );

          for (const c of clients) {
            const idMotClef = await c.motsClefs!.créerMotClef();
            motsClefs[c.idBdCompte!] = idMotClef;

            c.réseau!.recevoirSalut = async () => {};
            c.réseau!.dispositifsEnLigne = {};
            c.réseau!.emit("membreVu");
          }

          await attendreRésultat(rés, "membresEnLigne", (x) => x && !x.length);

          ({ fOublier: fOublierRecherche, fChangerN } =
            await client.recherche!.rechercherMotClefSelonNom({
              nomMotClef: "ភ្លៀង",
              f: (r) => (rés.motsClefs = r),
              nRésultatsDésirés: 5,
            }));
          fsOublier.push(fOublierRecherche);
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        step("Mes objets sont détectés", async () => {
          const idMotClef = motsClefs[client.idBdCompte!];
          const réf: résultatRecherche<infoRésultatTexte>[] = [
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

          await client.motsClefs!.ajouterNomsMotClef({
            id: idMotClef,
            noms: {
              ខ្មែរ: "ភ្លៀង",
            },
          });

          await attendreRésultat(rés, "motsClefs", (x) => x && !!x.length);
          vérifierRecherche(rés.motsClefs!, réf);
        });

        step("Objet devient intéressant", async () => {
          const réf: résultatRecherche<infoRésultatTexte>[] = [];

          for (const c of clients) {
            const idMotClef = motsClefs[c.idBdCompte!];
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
            if (c === client) continue;

            await c.motsClefs!.ajouterNomsMotClef({
              id: idMotClef,
              noms: {
                ខ្មែរ: "ភ្លៀង",
              },
            });
          }

          await attendreRésultat(rés, "motsClefs", (x) => x && x.length >= 5);
          vérifierRecherche(rés.motsClefs!, réf);
        });

        step("Objet ne correspond plus", async () => {
          const idMotClef = motsClefs[clients[4].idBdCompte!];
          await clients[4].motsClefs!.effacerNomMotClef({
            id: idMotClef,
            langue: "ខ្មែរ",
          });

          const réf: résultatRecherche<infoRésultatTexte>[] = [];
          for (const c of clients) {
            const idMC = motsClefs[c.idBdCompte!];
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

          await attendreRésultat(rés, "motsClefs", (x) => x && x.length <= 4);
          vérifierRecherche(rés.motsClefs!, réf);
        });

        step("Diminuer N", async () => {
          fChangerN(3);

          const réf: résultatRecherche<infoRésultatTexte>[] = [];
          for (const c of clients.slice(0, 3)) {
            const idMC = motsClefs[c.idBdCompte!];
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

          await attendreRésultat(rés, "motsClefs", (x) => x && x.length <= 3);
          vérifierRecherche(rés.motsClefs!, réf);
        });

        test.todo("Objet correspond mieux");

        step("Augmenter N", async () => {
          fChangerN(10);

          const réf: résultatRecherche<infoRésultatTexte>[] = [];
          for (const c of clients.slice(0, 4)) {
            const idMC = motsClefs[c.idBdCompte!];
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

          await attendreRésultat(rés, "motsClefs", (x) => x && x.length >= 4);
          vérifierRecherche(rés.motsClefs!, réf);
        });
      });
    });
  });
});
