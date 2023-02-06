import { config } from "@/utilsTests/sfipTest.js";

import type ClientConstellation from "@/client.js";
import type { statutMembre } from "@/reseau.js";
import type {
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
    const sansScore: { [key: string]: unknown } = {
      ...r,
    };
    return (sansScore.résultatObjectif = Object.fromEntries(
      Object.entries(sansScore.résultatObjectif).filter((x) => x[0] !== "score")
    ));
  });

  const réfSansScore = réf.map((r) => {
    const sansScore: { [key: string]: unknown } = {
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

      describe("Profil", function () {
        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let idsComptes: string[];

        beforeAll(async () => {
          ({ fOublier: fOublierClients, clients } = await générerClients(
            3,
            type
          ));
          idsComptes = await Promise.all(clients.map(async c=>await c.obtIdCompte()));
          
        }, config.patienceInit * 3);
  
        afterAll(async () => {
          if (fOublierClients) await fOublierClients();
        });

        describe("selon nom", function () {
          let fOublier: schémaFonctionOublier;
          let fChangerN: (n: number) => Promise<void>;

          let fOublier2: schémaFonctionOublier;
          let fChangerN2: (n: number) => Promise<void>;

          let réfClient2: résultatRecherche<infoRésultatTexte>;
          let réfClient3: résultatRecherche<infoRésultatTexte>;

          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();
          const rés2 = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            ({ fOublier, fChangerN } =
              await clients[0].recherche!.rechercherProfilSelonNom({
                nom: "Julien",
                f: (membres) => rés.mettreÀJour(membres),
                nRésultatsDésirés: 2,
              }));

              ({ fOublier: fOublier2, fChangerN: fChangerN2 } =
                await clients[0].recherche!.rechercherProfilSelonNom({
                  nom: "Julien",
                  f: (membres) => rés2.mettreÀJour(membres),
                  nRésultatsDésirés: 1,
                }));

            réfClient2 = {
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
            réfClient3 = {
              id: idsComptes[2],
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
            if (fOublier2) await fOublier2();
            rés.toutAnnuler();
            rés2.toutAnnuler();
          });

          test(
            "Moins de résultats que demandé s'il n'y a vraiment rien",
            async () => {
              await clients[1].profil!.sauvegarderNom({
                langue: "fr",
                nom: "Julien",
              });

              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réfClient2]);
            },
            config.patience
          );

          test("On suit les changements", async () => {
            await clients[2].profil!.sauvegarderNom({
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

          test("Augmenter N désiré d'abord", async () => {
            await fChangerN2(2);

            const val = await rés2.attendreQue((x) => !!x && x.length > 1);
            vérifierRecherche(val, [réfClient2, réfClient3]);
          });

          test("Et ensuite diminuer N désiré", async () => {
            await fChangerN2(1);

            const val = await rés2.attendreQue((x) => !!x && x.length === 1);
            vérifierRecherche(val, [réfClient2]);
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
              await clients[0].recherche!.rechercherProfilSelonCourriel({
                courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
                f: (membres) => rés.mettreÀJour(membres),
                nRésultatsDésirés: 2,
              }));
            réfClient2 = {
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
            await clients[1].profil!.sauvegarderCourriel({
              courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
            });

            const val = await rés.attendreQue((x) => !!x && !!x.length);
            vérifierRecherche(val, [réfClient2]);
          });

          test("Changements détectés", async () => {
            await clients[1].profil!.sauvegarderCourriel({
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
            ({ fOublier } = await clients[0].recherche!.rechercherProfilSelonId({
              idCompte: await clients[1].obtIdCompte(),
              f: (membres) => rés.mettreÀJour(membres),
              nRésultatsDésirés: 2,
            }));
            réfClient2 = {
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
        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let idsComptes: string[];

        beforeAll(async () => {
          ({ fOublier: fOublierClients, clients } = await générerClients(
            2,
            type
          ));
          idsComptes = await Promise.all(clients.map(async c=>await c.obtIdCompte()));
          
        }, config.patienceInit * 2);
  
        afterAll(async () => {
          if (fOublierClients) await fOublierClients();
        });

        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          let réfClient2: résultatRecherche<infoRésultatTexte>;

          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            const idMotClef = await clients[1].motsClefs!.créerMotClef();
            ({ fOublier } = await clients[0].recherche!.rechercherMotClefSelonId({
              idMotClef,
              f: (motsClefs) => rés.mettreÀJour(motsClefs),
              nRésultatsDésirés: 2,
            }));
            réfClient2 = {
              id: idsComptes[1],
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
            ({ fOublier } = await clients[0].recherche!.rechercherMotClefSelonNom({
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
              const idMotClef = await clients[1].motsClefs!.créerMotClef();
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

              await clients[1].motsClefs!.ajouterNomsMotClef({
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
            ({ fOublier } = await clients[0].recherche!.rechercherMotsClefs({
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
        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];

        beforeAll(async () => {
          ({ fOublier: fOublierClients, clients } = await générerClients(
            2,
            type
          ));
          
        }, config.patienceInit * 2);
  
        afterAll(async () => {
          if (fOublierClients) await fOublierClients();
        });
        
        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          let réfClient2: résultatRecherche<infoRésultatTexte>;

          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            const idVariable = await clients[1].variables!.créerVariable({
              catégorie: "numérique",
            });
            ({ fOublier } = await clients[0].recherche!.rechercherVariableSelonId({
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
            ({ fOublier } = await clients[0].recherche!.rechercherVariableSelonNom({
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
              const idVariable = await clients[1].variables!.créerVariable({
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

              await clients[1].variables!.ajouterNomsVariable({
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
              await clients[0].recherche!.rechercherVariableSelonDescr({
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
              const idVariable = await clients[1].variables!.créerVariable({
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

              await clients[1].variables!.ajouterDescriptionsVariable({
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
            ({ fOublier } = await clients[0].recherche!.rechercherVariables({
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

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];

        beforeAll(async () => {
          ({ fOublier: fOublierClients, clients } = await générerClients(
            2,
            type
          ));
          
        }, config.patienceInit * 2);
  
        afterAll(async () => {
          if (fOublierClients) await fOublierClients();
        });

        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            idBd = await clients[1].bds!.créerBd({ licence: "ODbl-1_0" });

            ({ fOublier } = await clients[0].recherche!.rechercherBdSelonId({
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
            ({ fOublier } = await clients[0].recherche!.rechercherBdSelonNom({
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
            await clients[1].bds!.ajouterNomsBd({
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
            ({ fOublier } = await clients[0].recherche!.rechercherBdSelonDescr({
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
            await clients[1].bds!.ajouterDescriptionsBd({
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
            ({ fOublier } = await clients[0].recherche!.rechercherBdSelonVariable({
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
              const idVariable = await clients[1].variables!.créerVariable({
                catégorie: "numérique",
              });
              const idTableau = await clients[1].bds!.ajouterTableauBd({
                idBd,
              });
              await clients[1].tableaux!.ajouterColonneTableau({
                idTableau,
                idVariable,
              });
              await clients[1].variables!.ajouterNomsVariable({
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
            ({ fOublier } = await clients[0].recherche!.rechercherBdSelonMotClef({
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
              const idMotClef = await clients[1].motsClefs!.créerMotClef();
              await clients[1].bds!.ajouterMotsClefsBd({
                idBd,
                idsMotsClefs: idMotClef,
              });
              await clients[1].motsClefs!.ajouterNomsMotClef({
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
            ({ fOublier } = await clients[0].recherche!.rechercherBds({
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
            await clients[1].bds!.ajouterNomsBd({
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

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];

        beforeAll(async () => {
          ({ fOublier: fOublierClients, clients } = await générerClients(
            2,
            type
          ));
          
        }, config.patienceInit * 2);
  
        afterAll(async () => {
          if (fOublierClients) await fOublierClients();
        });

        describe("selon id", () => {
          let fOublier: schémaFonctionOublier;
          const rés = new AttendreRésultat<
            résultatRecherche<infoRésultatTexte>[]
          >();

          beforeAll(async () => {
            idProjet = await clients[1].projets!.créerProjet();

            ({ fOublier } = await clients[0].recherche!.rechercherProjetSelonId({
              idProjet,
              f: (x) => rés.mettreÀJour(x),
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
            ({ fOublier } = await clients[0].recherche!.rechercherProjetSelonNom({
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
            await clients[1].projets!.ajouterNomsProjet({
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
            ({ fOublier } = await clients[0].recherche!.rechercherProjetSelonDescr({
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
            await clients[1].projets!.ajouterDescriptionsProjet({
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
            idBd = await clients[1].bds!.créerBd({ licence: "ODbl-1_0" });
            await clients[1].projets!.ajouterBdProjet({ idProjet, idBd });

            ({ fOublier } =
              await clients[0].recherche!.rechercherProjetSelonVariable({
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
              const idVariable = await clients[1].variables!.créerVariable({
                catégorie: "numérique",
              });
              const idTableau = await clients[1].bds!.ajouterTableauBd({
                idBd,
              });
              await clients[1].tableaux!.ajouterColonneTableau({
                idTableau,
                idVariable,
              });
              await clients[1].variables!.ajouterNomsVariable({
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
            idBd = await clients[1].bds!.créerBd({ licence: "ODbl-1_0" });
            await clients[1].projets!.ajouterBdProjet({ idProjet, idBd });

            ({ fOublier } =
              await clients[0].recherche!.rechercherProjetSelonMotClef({
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
              const idMotClef = await clients[1].motsClefs!.créerMotClef();
              await clients[1].bds!.ajouterMotsClefsBd({
                idBd,
                idsMotsClefs: idMotClef,
              });
              await clients[1].motsClefs!.ajouterNomsMotClef({
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
            ({ fOublier } = await clients[0].recherche!.rechercherProjetSelonBd({
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
              await clients[1].bds!.ajouterNomsBd({
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
            ({ fOublier } = await clients[0].recherche!.rechercherProjets({
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
            await clients[1].projets!.ajouterNomsProjet({
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

            c.réseau!.recevoirSalut = async () => {
              // Désactiver
            };
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
