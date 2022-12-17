import { config } from "@/utilsTests/sfipTest.js";

import ClientConstellation from "@/client.js";
import { statutMembre } from "@/reseau.js";
import {
  schémaFonctionOublier,
  résultatRecherche,
  infoRésultat,
  infoRésultatTexte,
  infoRésultatRecherche,
  infoRésultatVide,
} from "@/utils/index.js";

import {
  générerClients,
  typesClients,
  AttendreRésultat,
} from "@/utilsTests/index.js";

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
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThanOrEqual(1);
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
      let idCompte2: string;
      let idCompte3: string;

      beforeAll(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          3,
          type
        ));
        [client, client2, client3] = clients;
        idCompte2 = await client2.obtIdCompte();
        idCompte3 = await client3.obtIdCompte();
      }, config.patienceInit * 3);

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("Profil", function () {
        describe("selon nom", function () {
          let fOublier: schémaFonctionOublier;
          let fChangerN: (n: number) => Promise<void>;
          let réfClient2: résultatRecherche<infoRésultatTexte>;
          let réfClient3: résultatRecherche<infoRésultatTexte>;

          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier, fChangerN } =
              await client.recherche!.rechercherProfilSelonNom({
                nom: "Julien",
                f: (membres) => rés.mettreÀJour(membres),
                nRésultatsDésirés: 2,
              }));
            réfClient2 = {
              id: idCompte2,
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
              id: idCompte3,
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

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test(
            "Moins de résultats que demandé s'il n'y a vraiment rien",
            async () => {
              await client2.profil!.sauvegarderNom({
                langue: "fr",
                nom: "Julien",
              });

              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réfClient2]);
            },
            config.patience
          );

          test("On suit les changements", async () => {
            await client3.profil!.sauvegarderNom({
              langue: "es",
              nom: "Julián",
            });

            const val = await rés.attendreQue((x) => !!x && x.length > 1);
            vérifierRecherche(val, [réfClient2, réfClient3]);
          });

          test("Diminuer N désiré", async () => {
            await fChangerN(1);

            const val = await rés.attendreQue((x) => !!x && x.length === 1);
            vérifierRecherche(val, [réfClient2]);
          });

          test("Augmenter N désiré", async () => {
            await fChangerN(2);

            const val = await rés.attendreQue((x) => !!x && x.length > 1);
            vérifierRecherche(val, [réfClient2, réfClient3]);
          });
        });

        describe("selon courriel", function () {
          let fOublier: schémaFonctionOublier;
          let réfClient2: résultatRecherche<infoRésultatTexte>;

          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier } =
              await client.recherche!.rechercherProfilSelonCourriel({
                courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
                f: (membres) => rés.mettreÀJour(membres),
                nRésultatsDésirés: 2,
              }));
            réfClient2 = {
              id: idCompte2,
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

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Rien pour commencer détecté", async () => {
            const val = await rés.attendreExiste();
            expect(val).toBeTruthy();
            expect(val).toHaveLength(0);
          });

          test("Ajout détecté", async () => {
            await client2.profil!.sauvegarderCourriel({
              courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
            });

            const val = await rés.attendreQue((x) => !!x && !!x.length);
            vérifierRecherche(val, [réfClient2]);
          });

          test("Changements détectés", async () => {
            await client2.profil!.sauvegarderCourriel({
              courriel: "julien.malard@mail.mcgill.ca",
            });

            const val = await rés.attendreQue((x) => !!x && !x.length);
            expect(val).toHaveLength(0);
          });
        });

        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          let réfClient2: résultatRecherche<infoRésultatTexte>;

          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherProfilSelonId({
              idCompte: await client2.obtIdCompte(),
              f: (membres) => rés.mettreÀJour(membres),
              nRésultatsDésirés: 2,
            }));
            réfClient2 = {
              id: idCompte2,
              résultatObjectif: {
                score: 0,
                type: "résultat",
                de: "id",
                info: {
                  type: "texte",
                  texte: idCompte2,
                  début: 0,
                  fin: idCompte2.length,
                },
              },
            };
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Membre détecté", async () => {
            const val = await rés.attendreQue((x) => !!x && !!x.length);
            vérifierRecherche(val, [réfClient2]);
          });
        });
      });

      describe("Mots-clefs", () => {
        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          let réfClient2: résultatRecherche<infoRésultatTexte>;

          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            const idMotClef = await client2.motsClefs!.créerMotClef();
            ({ fOublier } = await client.recherche!.rechercherMotClefSelonId({
              idMotClef,
              f: (motsClefs) => rés.mettreÀJour(motsClefs),
              nRésultatsDésirés: 2,
            }));
            réfClient2 = {
              id: idCompte2,
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
          }, config.patience);

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Mot-clef détecté", async () => {
            const val = await rés.attendreQue((x) => !!x && !!x.length);
            vérifierRecherche(val, [réfClient2]);
          });
        });

        describe("selon nom", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherMotClefSelonNom({
              nomMotClef: "hydro",
              f: (motsClefs) => rés.mettreÀJour(motsClefs),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Rien pour commencer", async () => {
            const val = await rés.attendreExiste();
            expect(val).toHaveLength(0);
          });

          test(
            "Nouveau mot-clef détecté",
            async () => {
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

              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réf]);
            },
            config.patience
          );
        });

        describe("tous", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherMotsClefs({
              f: (motsClefs) => rés.mettreÀJour(motsClefs),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Mots-clefs détectés", async () => {
            await rés.attendreQue((x) => !!x && !!x.length);
          });
        });
      });

      describe("Variables", () => {
        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          let réfClient2: résultatRecherche<infoRésultatTexte>;

          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            const idVariable = await client2.variables!.créerVariable({
              catégorie: "numérique",
            });
            ({ fOublier } = await client.recherche!.rechercherVariableSelonId({
              idVariable,
              f: (motsClefs) => rés.mettreÀJour(motsClefs),
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
          }, config.patience);

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Variable détecté", async () => {
            const val = await rés.attendreQue((x) => !!x && !!x.length);
            vérifierRecherche(val, [réfClient2]);
          });
        });

        describe("selon nom", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherVariableSelonNom({
              nomVariable: "précip",
              f: (variables) => rés.mettreÀJour(variables),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Rien pour commencer", async () => {
            const val = await rés.attendreExiste();
            expect(val).toHaveLength(0);
          });

          test(
            "Nouvelle variable détectée",
            async () => {
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

              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réf]);
            },
            config.patience
          );
        });

        describe("selon descr", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier } =
              await client.recherche!.rechercherVariableSelonDescr({
                descrVariable: "précip",
                f: (variables) => rés.mettreÀJour(variables),
                nRésultatsDésirés: 2,
              }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Rien pour commencer", async () => {
            const val = await rés.attendreExiste();
            expect(val).toHaveLength(0);
          });

          test(
            "Nouvelle variable détectée",
            async () => {
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

              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réf]);
            },
            config.patience
          );
        });

        describe("tous", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherVariables({
              f: (variables) => rés.mettreÀJour(variables),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Variables détectées", async () => {
            await rés.attendreQue((x) => !!x && !!x.length);
          });
        });
      });

      describe("Bds", () => {
        let idBd: string;

        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            idBd = await client2.bds!.créerBd({ licence: "ODbl-1_0" });

            ({ fOublier } = await client.recherche!.rechercherBdSelonId({
              idBd,
              f: (bds) => rés.mettreÀJour(bds),
              nRésultatsDésirés: 2,
            }));
          }, config.patience);

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Bd détectée", async () => {
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
            const val = await rés.attendreQue((x) => !!x && !!x.length);
            vérifierRecherche(val, [réf]);
          });
        });
        describe("selon nom", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherBdSelonNom({
              nomBd: "météo",
              f: (bds) => rés.mettreÀJour(bds),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Bd détectée", async () => {
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
            const val = await rés.attendreQue((x) => !!x && !!x.length);
            vérifierRecherche(val, [réf]);
          });
        });

        describe("selon descr", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherBdSelonDescr({
              descrBd: "météo",
              f: (bds) => rés.mettreÀJour(bds),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Bd détectée", async () => {
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
            const val = await rés.attendreQue((x) => !!x && !!x.length);
            vérifierRecherche(val, [réf]);
          });
        });

        describe("selon variables", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherBdSelonVariable({
              texte: "précipitation",
              f: (bds) => rés.mettreÀJour(bds),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test(
            "Nouvelle variable détectée",
            async () => {
              const idVariable = await client2.variables!.créerVariable({
                catégorie: "numérique",
              });
              const idTableau = await client2.bds!.ajouterTableauBd({
                idBd,
              });
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

              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réf]);
            },
            config.patience
          );
        });

        describe("selon mots-clefs", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherBdSelonMotClef({
              texte: "meteorología",
              f: (bds) => rés.mettreÀJour(bds),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test(
            "Nouveau mot-clef détecté",
            async () => {
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

              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réf]);
            },
            config.patience
          );
        });

        describe("tous", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherBds({
              f: (bds) => rés.mettreÀJour(bds),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Bd détectée", async () => {
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
            const val = await rés.attendreQue((x) => !!x && !!x.length);
            vérifierRecherche(val, [réf]);
          });
        });
      });

      describe("Projets", () => {
        let idProjet: string;
        let idBd: string;

        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            idProjet = await client2.projets!.créerProjet();

            ({ fOublier } = await client.recherche!.rechercherProjetSelonId({
              idProjet,
              f: (bds) => rés.mettreÀJour(bds),
              nRésultatsDésirés: 2,
            }));
          }, config.patience);

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Projet détecté", async () => {
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
            const val = await rés.attendreQue((x) => !!x && !!x.length);
            vérifierRecherche(val, [réf]);
          });
        });

        describe("selon nom", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherProjetSelonNom({
              nomProjet: "météo",
              f: (projets) => rés.mettreÀJour(projets),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Projet détecté", async () => {
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

            const val = await rés.attendreQue((x) => !!x && !!x.length);
            vérifierRecherche(val, [réf]);
          });
        });

        describe("selon descr", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherProjetSelonDescr({
              descrProjet: "météo",
              f: (projets) => rés.mettreÀJour(projets),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Projet détecté", async () => {
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

            const val = await rés.attendreQue((x) => !!x && !!x.length);
            vérifierRecherche(val, [réf]);
          });
        });

        describe("selon variables", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
          >();

          beforeAll(async () => {
            idBd = await client2.bds!.créerBd({ licence: "ODbl-1_0" });
            await client2.projets!.ajouterBdProjet({ idProjet, idBd });

            ({ fOublier } =
              await client.recherche!.rechercherProjetSelonVariable({
                texte: "précip",
                f: (bds) => rés.mettreÀJour(bds),
                nRésultatsDésirés: 2,
              }));
          }, config.patience);

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test(
            "Nouvelle variable détectée",
            async () => {
              const idVariable = await client2.variables!.créerVariable({
                catégorie: "numérique",
              });
              const idTableau = await client2.bds!.ajouterTableauBd({
                idBd,
              });
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

              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réf]);
            },
            config.patience
          );
        });

        describe("selon mots-clefs", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
          >();

          beforeAll(async () => {
            idBd = await client2.bds!.créerBd({ licence: "ODbl-1_0" });
            await client2.projets!.ajouterBdProjet({ idProjet, idBd });

            ({ fOublier } =
              await client.recherche!.rechercherProjetSelonMotClef({
                texte: "meteorología",
                f: (bds) => rés.mettreÀJour(bds),
                nRésultatsDésirés: 2,
              }));
          }, config.patience);

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test(
            "Nouveau mot-clef sur la bd détecté",
            async () => {
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

              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réf]);
            },
            config.patience
          );
        });

        describe("selon bd", () => {
          let fOublier: schémaFonctionOublier;

          const nouveauNom = "Mi base de datos meteorológicos";
          const rés = new AttendreRésultat<
            résultatRecherche<
              infoRésultatRecherche<
                infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
              >
            >[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherProjetSelonBd({
              texte: nouveauNom,
              f: (projets) => rés.mettreÀJour(projets),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test(
            "Changement nom bd détecté",
            async () => {
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
                      texte: nouveauNom,
                      début: 0,
                      fin: nouveauNom.length,
                    },
                  },
                },
              };
              await client2.bds!.ajouterNomsBd({
                id: idBd,
                noms: { es: "Mi base de datos meteorológicos" },
              });

              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réf]);
            },
            config.patience
          );
        });

        describe("tous", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier } = await client.recherche!.rechercherProjets({
              f: (projets) => rés.mettreÀJour(projets),
              nRésultatsDésirés: 2,
            }));
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            rés.toutAnnuler();
          });

          test("Projet détecté", async () => {
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

            const val = await rés.attendreQue((x) => !!x && !!x.length);
            vérifierRecherche(val, [réf]);
          });
        });
      });
    });
  });
});

typesClients.forEach((type) => {
  describe.skip("Client " + type, function () {
    describe("Test fonctionnalités recherche", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;
      let idsComptes: string[];

      beforeAll(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          5,
          type
        ));
        client = clients[0];
        for (const [i, c] of clients.entries()) {
          idsComptes.push(await c.obtIdCompte());
          if (i < clients.length - 1) {
            await c.réseau!.faireConfianceAuMembre({
              idBdCompte: await clients[i + 1].obtIdCompte(),
            });
          }
        }
      }, config.patienceInit * 5);

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("Rechercher de réseau", () => {
        let fOublierRecherche: schémaFonctionOublier;
        let fChangerN: (x: number) => Promise<void>;

        const résMembresEnLigne = new AttendreRésultat<statutMembre[]>();
        const résMotsClefs = new AttendreRésultat<
          résultatRecherche<infoRésultatTexte>[]
        >();

        const fsOublier: schémaFonctionOublier[] = [];
        const motsClefs: { [key: string]: string } = {};

        beforeAll(async () => {
          fsOublier.push(
            await client.réseau!.suivreConnexionsMembres({
              f: (m) => résMembresEnLigne.mettreÀJour(m),
            })
          );
          await résMembresEnLigne.attendreQue((x) => !!x && x.length === 5);

          for (const c of clients) {
            const idMotClef = await c.motsClefs!.créerMotClef();
            const idCompte = await c.obtIdCompte();
            motsClefs[idCompte] = idMotClef;

            c.réseau!.recevoirSalut = async () => {};
            c.réseau!.dispositifsEnLigne = {};
            c.réseau!.emit("membreVu");
          }

          await résMembresEnLigne.attendreQue((x) => !!x && !x.length);

          ({ fOublier: fOublierRecherche, fChangerN } =
            await client.recherche!.rechercherMotClefSelonNom({
              nomMotClef: "ភ្លៀង",
              f: (r) => résMotsClefs.mettreÀJour(r),
              nRésultatsDésirés: 5,
            }));
          fsOublier.push(fOublierRecherche);
        }, config.patience);

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          résMembresEnLigne.toutAnnuler();
          résMotsClefs.toutAnnuler();
        });

        test("Mes objets sont détectés", async () => {
          const idMotClef = motsClefs[idsComptes[0]];
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

          const val = await résMotsClefs.attendreQue((x) => !!x && !!x.length);
          vérifierRecherche(val, réf);
        });

        test(
          "Objet devient intéressant",
          async () => {
            const réf: résultatRecherche<infoRésultatTexte>[] = [];

            for (const c of clients) {
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
              if (c === client) continue;

              await c.motsClefs!.ajouterNomsMotClef({
                id: idMotClef,
                noms: {
                  ខ្មែរ: "ភ្លៀង",
                },
              });
            }

            const val = await résMotsClefs.attendreQue(
              (x) => !!x && x.length >= 5
            );
            vérifierRecherche(val, réf);
          },
          config.patience
        );

        test("Objet ne correspond plus", async () => {
          const idMotClef = motsClefs[idsComptes[4]];
          await clients[4].motsClefs!.effacerNomMotClef({
            id: idMotClef,
            langue: "ខ្មែរ",
          });

          const réf: résultatRecherche<infoRésultatTexte>[] = [];
          for (const c of clients) {
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
            (x) => !!x && !!x.length && x.length <= 4
          );
          vérifierRecherche(val, réf);
        });

        test("Diminuer N", async () => {
          await fChangerN(3);

          const réf: résultatRecherche<infoRésultatTexte>[] = [];
          for (const c of clients.slice(0, 3)) {
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

          const val = await résMotsClefs.attendreQue(
            (x) => !!x && x.length <= 3
          );
          vérifierRecherche(val, réf);
        });

        test.todo("Objet correspond mieux");

        test("Augmenter N", async () => {
          await fChangerN(10);

          const réf: résultatRecherche<infoRésultatTexte>[] = [];
          for (const c of clients.slice(0, 4)) {
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

          const val = await résMotsClefs.attendreQue(
            (x) => !!x && x.length >= 4
          );
          vérifierRecherche(val, réf);
        });
      });
    });
  });
});
