import type { default as ClientConstellation } from "@/client.js";
import type { statutMembre } from "@/reseau.js";
import type {
  schémaFonctionOublier,
  résultatRecherche,
  infoRésultat,
  infoRésultatTexte,
  infoRésultatRecherche,
  infoRésultatVide,
  résultatObjectifRecherche,
} from "@/utils/index.js";

import { générerClients, typesClients } from "@/utilsTests/client.js";
import { AttendreRésultat } from "@/utilsTests/attente.js";

import { expect } from "aegir/chai";
import { isElectronMain, isNode } from "wherearewe";

const vérifierRecherche = (
  résultats: résultatRecherche<infoRésultat>[],
  réf: résultatRecherche<infoRésultat>[],
  scores: { [key: string]: (x: number) => void } = {}
) => {
  const scoresRésultat = Object.fromEntries(
    résultats.map((r) => [r.id, r.résultatObjectif.score])
  );
  const résultatsSansScore = résultats.map((r) => {
    const sansScore: {
      id: string;
      résultatObjectif: Omit<résultatObjectifRecherche<infoRésultat>, "score">;
    } = {
      id: r.id,
      résultatObjectif: Object.fromEntries(
        Object.entries(r.résultatObjectif).filter((x) => x[0] !== "score")
      ) as Omit<résultatObjectifRecherche<infoRésultat>, "score">,
    };
    return sansScore;
  });

  const réfSansScore = réf.map((r) => {
    const sansScore: {
      id: string;
      résultatObjectif: Omit<résultatObjectifRecherche<infoRésultat>, "score">;
    } = {
      id: r.id,
      résultatObjectif: Object.fromEntries(
        Object.entries(r.résultatObjectif).filter((x) => x[0] !== "score")
      ) as Omit<résultatObjectifRecherche<infoRésultat>, "score">,
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

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    if (isElectronMain || isNode) {
      describe("Rechercher dans réseau", function () {
        describe("Profil", function () {
          let fOublierClients: () => Promise<void>;
          let clients: ClientConstellation[];
          let idsComptes: string[];

          before(async () => {
            ({ fOublier: fOublierClients, clients } = await générerClients(
              3,
              type
            ));
            idsComptes = await Promise.all(
              clients.map(async (c) => await c.obtIdCompte())
            );
          });

          after(async () => {
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

            before(async () => {
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

            after(async () => {
              if (fOublier) await fOublier();
              if (fOublier2) await fOublier2();
              rés.toutAnnuler();
              rés2.toutAnnuler();
            });

            it("Moins de résultats que demandé s'il n'y a vraiment rien", async () => {
              await clients[1].profil!.sauvegarderNom({
                langue: "fr",
                nom: "Julien",
              });

              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réfClient2]);
            });

            it("On suit les changements", async () => {
              await clients[2].profil!.sauvegarderNom({
                langue: "es",
                nom: "Julián",
              });

              const val = await rés.attendreQue((x) => !!x && x.length > 1);
              vérifierRecherche(val, [réfClient2, réfClient3]);
            });

            it("Diminuer N désiré", async () => {
              await fChangerN(1);

              const val = await rés.attendreQue((x) => !!x && x.length === 1);
              vérifierRecherche(val, [réfClient2]);
            });

            it("Augmenter N désiré", async () => {
              await fChangerN(2);

              const val = await rés.attendreQue((x) => !!x && x.length > 1);
              vérifierRecherche(val, [réfClient2, réfClient3]);
            });

            it("Augmenter N désiré d'abord", async () => {
              await fChangerN2(2);

              const val = await rés2.attendreQue((x) => !!x && x.length > 1);
              vérifierRecherche(val, [réfClient2, réfClient3]);
            });

            it("Et ensuite diminuer N désiré", async () => {
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

            before(async () => {
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

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Rien pour commencer détecté", async () => {
              const val = await rés.attendreExiste();
              expect(val).to.be.empty();
            });

            it("Ajout détecté", async () => {
              await clients[1].profil!.sauvegarderCourriel({
                courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
              });

              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réfClient2]);
            });

            it("Changements détectés", async () => {
              await clients[1].profil!.sauvegarderCourriel({
                courriel: "julien.malard@mail.mcgill.ca",
              });

              const val = await rés.attendreQue((x) => !!x && !x.length);
              expect(val.length).to.equal(0);
            });
          });

          describe("selon id", () => {
            let fOublier: schémaFonctionOublier;
            let réfClient2: résultatRecherche<infoRésultatTexte>;

            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatTexte>[]
            >();

            before(async () => {
              ({ fOublier } =
                await clients[0].recherche!.rechercherProfilSelonId({
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

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Membre détecté", async () => {
              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réfClient2]);
            });
          });
        });

        describe("Mots-clefs", () => {
          let fOublierClients: () => Promise<void>;
          let clients: ClientConstellation[];
          let idsComptes: string[];

          before(async () => {
            ({ fOublier: fOublierClients, clients } = await générerClients(
              2,
              type
            ));
            idsComptes = await Promise.all(
              clients.map(async (c) => await c.obtIdCompte())
            );
          });

          after(async () => {
            if (fOublierClients) await fOublierClients();
          });

          describe("selon id", () => {
            let fOublier: schémaFonctionOublier;
            let réfClient2: résultatRecherche<infoRésultatTexte>;

            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatTexte>[]
            >();

            before(async () => {
              const idMotClef = await clients[1].motsClefs!.créerMotClef();
              ({ fOublier } =
                await clients[0].recherche!.rechercherMotClefSelonId({
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
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Mot-clef détecté", async () => {
              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réfClient2]);
            });
          });

          describe("selon nom", () => {
            let fOublier: schémaFonctionOublier;
            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatTexte>[]
            >();

            before(async () => {
              ({ fOublier } =
                await clients[0].recherche!.rechercherMotClefSelonNom({
                  nomMotClef: "hydro",
                  f: (motsClefs) => rés.mettreÀJour(motsClefs),
                  nRésultatsDésirés: 2,
                }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Rien pour commencer", async () => {
              const val = await rés.attendreExiste();
              expect(val.length).to.equal(0);
            });

            it("Nouveau mot-clef détecté", async () => {
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

              await clients[1].motsClefs!.sauvegarderNomsMotClef({
                idMotClef,
                noms: {
                  fr: "hydrologie",
                },
              });

              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réf]);
            });
          });

          describe("tous", () => {
            let fOublier: schémaFonctionOublier;
            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatTexte>[]
            >();

            before(async () => {
              ({ fOublier } = await clients[0].recherche!.rechercherMotsClefs({
                f: (motsClefs) => rés.mettreÀJour(motsClefs),
                nRésultatsDésirés: 2,
              }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Mots-clefs détectés", async () => {
              await rés.attendreQue((x) => !!x && !!x.length);
            });
          });
        });

        describe("Variables", () => {
          let fOublierClients: () => Promise<void>;
          let clients: ClientConstellation[];

          before(async () => {
            ({ fOublier: fOublierClients, clients } = await générerClients(
              2,
              type
            ));
          });

          after(async () => {
            if (fOublierClients) await fOublierClients();
          });

          describe("selon id", () => {
            let fOublier: schémaFonctionOublier;
            let réfClient2: résultatRecherche<infoRésultatTexte>;

            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatTexte>[]
            >();

            before(async () => {
              const idVariable = await clients[1].variables!.créerVariable({
                catégorie: "numérique",
              });
              ({ fOublier } =
                await clients[0].recherche!.rechercherVariableSelonId({
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
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Variable détecté", async () => {
              const val = await rés.attendreQue((x) => !!x && !!x.length);
              vérifierRecherche(val, [réfClient2]);
            });
          });

          describe("selon nom", () => {
            let fOublier: schémaFonctionOublier;
            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatTexte>[]
            >();

            before(async () => {
              ({ fOublier } =
                await clients[0].recherche!.rechercherVariableSelonNom({
                  nomVariable: "précip",
                  f: (variables) => rés.mettreÀJour(variables),
                  nRésultatsDésirés: 2,
                }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Rien pour commencer", async () => {
              const val = await rés.attendreExiste();
              expect(val.length).to.equal(0);
            });

            it("Nouvelle variable détectée", async () => {
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
            });
          });

          describe("selon descr", () => {
            let fOublier: schémaFonctionOublier;
            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatTexte>[]
            >();

            before(async () => {
              ({ fOublier } =
                await clients[0].recherche!.rechercherVariableSelonDescr({
                  descrVariable: "précip",
                  f: (variables) => rés.mettreÀJour(variables),
                  nRésultatsDésirés: 2,
                }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Rien pour commencer", async () => {
              const val = await rés.attendreExiste();
              expect(val.length).to.equal(0);
            });

            it("Nouvelle variable détectée", async () => {
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
            });
          });

          describe("tous", () => {
            let fOublier: schémaFonctionOublier;
            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatTexte>[]
            >();

            before(async () => {
              ({ fOublier } = await clients[0].recherche!.rechercherVariables({
                f: (variables) => rés.mettreÀJour(variables),
                nRésultatsDésirés: 2,
              }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Variables détectées", async () => {
              await rés.attendreQue((x) => !!x && !!x.length);
            });
          });
        });

        describe("Bds", () => {
          let idBd: string;

          let fOublierClients: () => Promise<void>;
          let clients: ClientConstellation[];

          before(async () => {
            ({ fOublier: fOublierClients, clients } = await générerClients(
              2,
              type
            ));
          });

          after(async () => {
            if (fOublierClients) await fOublierClients();
          });

          describe("selon id", () => {
            let fOublier: schémaFonctionOublier;
            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatTexte>[]
            >();

            before(async () => {
              idBd = await clients[1].bds!.créerBd({ licence: "ODbl-1_0" });

              ({ fOublier } = await clients[0].recherche!.rechercherBdSelonId({
                idBd,
                f: (bds) => rés.mettreÀJour(bds),
                nRésultatsDésirés: 2,
              }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Bd détectée", async () => {
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

            before(async () => {
              ({ fOublier } = await clients[0].recherche!.rechercherBdSelonNom({
                nomBd: "météo",
                f: (bds) => rés.mettreÀJour(bds),
                nRésultatsDésirés: 2,
              }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Bd détectée", async () => {
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

            before(async () => {
              ({ fOublier } =
                await clients[0].recherche!.rechercherBdSelonDescr({
                  descrBd: "météo",
                  f: (bds) => rés.mettreÀJour(bds),
                  nRésultatsDésirés: 2,
                }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Bd détectée", async () => {
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

            before(async () => {
              ({ fOublier } =
                await clients[0].recherche!.rechercherBdSelonVariable({
                  texte: "précipitation",
                  f: (bds) => rés.mettreÀJour(bds),
                  nRésultatsDésirés: 2,
                }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Nouvelle variable détectée", async () => {
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
            });
          });

          describe("selon mots-clefs", () => {
            let fOublier: schémaFonctionOublier;
            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
            >();

            before(async () => {
              ({ fOublier } =
                await clients[0].recherche!.rechercherBdSelonMotClef({
                  texte: "meteorología",
                  f: (bds) => rés.mettreÀJour(bds),
                  nRésultatsDésirés: 2,
                }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Nouveau mot-clef détecté", async () => {
              const idMotClef = await clients[1].motsClefs!.créerMotClef();
              await clients[1].bds!.ajouterMotsClefsBd({
                idBd,
                idsMotsClefs: idMotClef,
              });
              await clients[1].motsClefs!.sauvegarderNomsMotClef({
                idMotClef,
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
            });
          });

          describe("tous", () => {
            let fOublier: schémaFonctionOublier;
            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatTexte>[]
            >();

            before(async () => {
              ({ fOublier } = await clients[0].recherche!.rechercherBds({
                f: (bds) => rés.mettreÀJour(bds),
                nRésultatsDésirés: 2,
              }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Bd détectée", async () => {
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

          before(async () => {
            ({ fOublier: fOublierClients, clients } = await générerClients(
              2,
              type
            ));
          });

          after(async () => {
            if (fOublierClients) await fOublierClients();
          });

          describe("selon id", () => {
            let fOublier: schémaFonctionOublier;
            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatTexte>[]
            >();

            before(async () => {
              idProjet = await clients[1].projets!.créerProjet();

              ({ fOublier } =
                await clients[0].recherche!.rechercherProjetSelonId({
                  idProjet,
                  f: (x) => rés.mettreÀJour(x),
                  nRésultatsDésirés: 2,
                }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Projet détecté", async () => {
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

            before(async () => {
              ({ fOublier } =
                await clients[0].recherche!.rechercherProjetSelonNom({
                  nomProjet: "météo",
                  f: (projets) => rés.mettreÀJour(projets),
                  nRésultatsDésirés: 2,
                }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Projet détecté", async () => {
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

            before(async () => {
              ({ fOublier } =
                await clients[0].recherche!.rechercherProjetSelonDescr({
                  descrProjet: "météo",
                  f: (projets) => rés.mettreÀJour(projets),
                  nRésultatsDésirés: 2,
                }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Projet détecté", async () => {
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

            before(async () => {
              idBd = await clients[1].bds!.créerBd({ licence: "ODbl-1_0" });
              await clients[1].projets!.ajouterBdProjet({ idProjet, idBd });

              ({ fOublier } =
                await clients[0].recherche!.rechercherProjetSelonVariable({
                  texte: "précip",
                  f: (bds) => rés.mettreÀJour(bds),
                  nRésultatsDésirés: 2,
                }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Nouvelle variable détectée", async () => {
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
            });
          });

          describe("selon mots-clefs", () => {
            let fOublier: schémaFonctionOublier;
            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[]
            >();

            before(async () => {
              idBd = await clients[1].bds!.créerBd({ licence: "ODbl-1_0" });
              await clients[1].projets!.ajouterBdProjet({ idProjet, idBd });

              ({ fOublier } =
                await clients[0].recherche!.rechercherProjetSelonMotClef({
                  texte: "meteorología",
                  f: (bds) => rés.mettreÀJour(bds),
                  nRésultatsDésirés: 2,
                }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Nouveau mot-clef sur la bd détecté", async () => {
              const idMotClef = await clients[1].motsClefs!.créerMotClef();
              await clients[1].bds!.ajouterMotsClefsBd({
                idBd,
                idsMotsClefs: idMotClef,
              });
              await clients[1].motsClefs!.sauvegarderNomsMotClef({
                idMotClef,
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
            });
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

            before(async () => {
              ({ fOublier } =
                await clients[0].recherche!.rechercherProjetSelonBd({
                  texte: nouveauNom,
                  f: (projets) => rés.mettreÀJour(projets),
                  nRésultatsDésirés: 2,
                }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Changement nom bd détecté", async () => {
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
            });
          });

          describe("tous", () => {
            let fOublier: schémaFonctionOublier;
            const rés = new AttendreRésultat<
              résultatRecherche<infoRésultatTexte>[]
            >();

            before(async () => {
              ({ fOublier } = await clients[0].recherche!.rechercherProjets({
                f: (projets) => rés.mettreÀJour(projets),
                nRésultatsDésirés: 2,
              }));
            });

            after(async () => {
              if (fOublier) await fOublier();
              rés.toutAnnuler();
            });

            it("Projet détecté", async () => {
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
    }
  });
});

typesClients.forEach((type) => {
  describe.skip("Client " + type, function () {
    describe("Test fonctionnalités recherche", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;
      let idsComptes: string[];

      before(async () => {
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
      });

      after(async () => {
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

        before(async () => {
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
        });

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          résMembresEnLigne.toutAnnuler();
          résMotsClefs.toutAnnuler();
        });

        it("Mes objets sont détectés", async () => {
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

          await client.motsClefs!.sauvegarderNomsMotClef({
            idMotClef,
            noms: {
              ខ្មែរ: "ភ្លៀង",
            },
          });

          const val = await résMotsClefs.attendreQue((x) => !!x && !!x.length);
          vérifierRecherche(val, réf);
        });

        it("Objet devient intéressant", async () => {
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

            await c.motsClefs!.sauvegarderNomsMotClef({
              idMotClef,
              noms: {
                ខ្មែរ: "ភ្លៀង",
              },
            });
          }

          const val = await résMotsClefs.attendreQue(
            (x) => !!x && x.length >= 5
          );
          vérifierRecherche(val, réf);
        });

        it("Objet ne correspond plus", async () => {
          const idMotClef = motsClefs[idsComptes[4]];
          await clients[4].motsClefs!.effacerNomMotClef({
            idMotClef,
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

        it("Diminuer N", async () => {
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

        it.skip("Objet correspond mieux");

        it("Augmenter N", async () => {
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