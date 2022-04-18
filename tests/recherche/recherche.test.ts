import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import {
  schémaFonctionOublier,
  résultatRecherche,
  infoRésultat,
  infoRésultatTexte,
  infoRésultatRecherche,
  infoRésultatVide,
} from "@/utils";

import { testAPIs, config } from "../sfipTest";
import { générerClients, attendreRésultat, typesClients } from "../utils";

chai.should();
chai.use(chaiAsPromised);

const vérifierRecherche = (résultats: résultatRecherche<infoRésultat>[], réf: résultatRecherche<infoRésultat>[], scores: {[key: string]: (x: number)=>void} = {}) => {

  const scoresRésultat = Object.fromEntries(résultats.map(r=>[r.id, r.résultatObjectif.score]));
  const résultatsSansScore = résultats.map(r=>{
    const sansScore: {[key: string]: any} = {
      ...r
    }
    return sansScore.résultatObjectif = Object.fromEntries(Object.entries(sansScore.résultatObjectif).filter(x=>x[0] !== "score"));
  });

  const réfSansScore = réf.map(r=>{
    const sansScore: {[key: string]: any} = {
      ...r
    }
    return sansScore.résultatObjectif = Object.fromEntries(Object.entries(sansScore.résultatObjectif).filter(x=>x[0] !== "score"));
  });

  expect(résultatsSansScore).to.have.deep.members(réfSansScore);
  for (const clef of Object.keys(scoresRésultat)) {
    const rés = scoresRésultat[clef];
    (scores[clef] || ((x: number) => expect(x).to.be.greaterThan(0).and.lessThan(1)))(rés)
  }

}

typesClients.forEach((type) => {
  describe.only("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {

      describe("Rechercher dans réseau", function () {
        this.timeout(config.timeout);

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation;
        let client2: ClientConstellation;
        let client3: ClientConstellation;

        before(async () => {
          enregistrerContrôleurs();
          ({ fOublier: fOublierClients, clients } = await générerClients(
            3,
            API,
            type
          ));
          [client, client2, client3] = clients;
        });

        after(async () => {
          if (fOublierClients) await fOublierClients();
        });

        describe("Profil", function () {
          describe("selon nom", function () {
            let fOublier: schémaFonctionOublier;
            let fChangerN: (n: number) => void;
            let réfClient2: résultatRecherche<infoRésultatTexte>
            let réfClient3: résultatRecherche<infoRésultatTexte>

            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {}

            before(async () => {
              ({ fOublier, fChangerN } = await client.recherche!.rechercherProfilSelonNom(
                "Julien",
                membres => rés.ultat = membres,
                2,
              ));
              réfClient2 = {
                id: client2.idBdCompte!,
                résultatObjectif: {
                  score: 4/9,
                  type: "résultat",
                  de: "nom",
                  clef: "fr",
                  info: {
                    type: "texte",
                    texte: "Julien",
                    début: 0,
                    fin: 6
                  }
                }
              };
              réfClient3 = {
                id: client3.idBdCompte!,
                résultatObjectif: {
                  score: 4/9,
                  type: "résultat",
                  de: "nom",
                  clef: "es",
                  info: {
                    type: "texte",
                    texte: "Julián",
                    début: 0,
                    fin: 6
                  }
                }
              }
            })

            after(() => {
                if (fOublier) fOublier();
            });

            step("Moins de résultats que demandé s'il n'y a vraiment rien", async () => {

              await client2.profil!.sauvegarderNom("fr", "Julien");

              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réfClient2]);
            })

            step("On suit les changements", async () => {
              await client3.profil!.sauvegarderNom("es", "Julián");

              await attendreRésultat(rés, "ultat", x=>x.length > 1);
              vérifierRecherche(
                rés.ultat!,
                [réfClient2, réfClient3],
              );
            })

            step("Diminuer N désiré", async () => {
              fChangerN(1);

              await attendreRésultat(rés, "ultat", x=>x.length === 1);
              vérifierRecherche(rés.ultat!, [réfClient2]);
            });

            step("Augmenter N désiré", async () => {
              fChangerN(2);

              await attendreRésultat(rés, "ultat", x=>x.length > 1);
              vérifierRecherche(rés.ultat!, [réfClient2, réfClient3]);
            });

          });
          describe("selon courriel", function () {
            let fOublier: schémaFonctionOublier;
            let réfClient2: résultatRecherche<infoRésultatTexte>

            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {}

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherProfilSelonCourriel (
                "தொடர்பு@லஸ்ஸி.இந்தியா",
                membres => rés.ultat = membres,
                2,
              ));
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
                    fin: 21
                  }
                }
              }
            });

            after(() => {
                if (fOublier) fOublier();
            });

            step("Rien pour commencer détecté", async () => {
              await client2.profil!.sauvegarderCourriel("தொடர்பு@லஸ்ஸி.இந்தியா");

              await attendreRésultat(rés, "ultat");
              expect(rés.ultat).to.exist.and.to.be.empty;
            });

            step("Ajout détecté", async () => {
              await client2.profil!.sauvegarderCourriel("தொடர்பு@லஸ்ஸி.இந்தியா");

              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réfClient2]);
            });

            step("Changements détectés", async () => {
              await client2.profil!.sauvegarderCourriel("julien.malard@mail.mcgill.ca");

              await attendreRésultat(rés, "ultat", x=>x && !x.length);
              expect(rés.ultat).to.be.empty;
            });
          });

          describe("selon id", () => {
            let fOublier: schémaFonctionOublier;
            let réfClient2: résultatRecherche<infoRésultatTexte>;

            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {}

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherProfilSelonId(
                client2.idBdCompte!,
                membres => rés.ultat = membres,
                2,
              ));
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
                    fin: client2.idBdCompte!.length
                  }
                }
              }
            });

            after(() => {
                if (fOublier) fOublier();
            });

            step("Membre détecté", async () => {
              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réfClient2]);
            });
          });
        });

        describe("Mots-clefs", () => {
          describe("selon id", () => {let fOublier: schémaFonctionOublier;
            let réfClient2: résultatRecherche<infoRésultatTexte>

            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {}

            before(async () => {
              const idMotClef = await client2.motsClefs!.créerMotClef();
              ({ fOublier } = await client.recherche!.rechercherMotClefSelonId (
                idMotClef,
                motsClefs => rés.ultat = motsClefs,
                2,
              ));
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
                    fin: idMotClef.length
                  }
                }
              }
            });

            after(() => {
                if (fOublier) fOublier();
            });

            step("Mot-clef détecté", async () => {
              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réfClient2]);
            });
          });

          describe("selon nom", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherMotClefSelonNom(
                "hydro",
                motsClefs => rés.ultat = motsClefs,
                2,
              ))
            })

            after(() => {
                if (fOublier) fOublier();
            });

            step("Rien pour commencer", async () => {
              await attendreRésultat(rés, "ultat");
              expect(rés.ultat).to.be.empty;
            })

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
                    fin: 5
                  }
                }
              };

              await client2.motsClefs!.ajouterNomsMotClef(idMotClef, { fr: "hydrologie"});

              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!,[réf]);
            });
          });

          describe("tous", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherMotsClefs(
                motsClefs => rés.ultat = motsClefs,
                2,
              ))
            })

            after(() => {
                if (fOublier) fOublier();
            });

            step("Mots-clefs détectés", async () => {
              await attendreRésultat(rés, "ultat", x => x && !!x.length);
            });
          });
        });

        describe("Variables", () => {
          describe("selon id", () => {let fOublier: schémaFonctionOublier;
            let réfClient2: résultatRecherche<infoRésultatTexte>

            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {}

            before(async () => {
              const idVariable = await client2.variables!.créerVariable("numérique");
              ({ fOublier } = await client.recherche!.rechercherVariableSelonId (
                idVariable,
                motsClefs => rés.ultat = motsClefs,
                2,
              ));
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
                    fin: idVariable.length
                  }
                }
              }
            });

            after(() => {
                if (fOublier) fOublier();
            });

            step("Variable détecté", async () => {
              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réfClient2]);
            });
          });

          describe("selon nom", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherVariableSelonNom(
                "précip",
                variables => rés.ultat = variables,
                2,
              ))
            })

            after(() => {
                if (fOublier) fOublier();
            });

            step("Rien pour commencer", async () => {
              await attendreRésultat(rés, "ultat");
              expect(rés.ultat).to.be.empty;
            })

            step("Nouvelle variable détectée", async () => {
              const idVariable = await client2.variables!.créerVariable("numérique");
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
                    fin: 6
                  }
                }
              };

              await client2.variables!.ajouterNomsVariable(idVariable, { fr: "précipitation"});

              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(
                rés.ultat!,
                [réf]
              );
            });
          });

          describe("selon descr", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherVariableSelonDescr(
                "précip",
                variables => rés.ultat = variables,
                2,
              ))
            })

            after(() => {
                if (fOublier) fOublier();
            });

            step("Rien pour commencer", async () => {
              await attendreRésultat(rés, "ultat");
              expect(rés.ultat).to.be.empty;
            })

            step("Nouvelle variable détectée", async () => {
              const idVariable = await client2.variables!.créerVariable("numérique");
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
                    fin: 6
                  }
                }
              };

              await client2.variables!.ajouterDescriptionsVariable(idVariable, { fr: "précipitation"});

              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(
                rés.ultat!,
                [réf]
              );
            });
          });

          describe("tous", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherVariables(
                variables => rés.ultat = variables,
                2,
              ))
            })

            after(() => {
                if (fOublier) fOublier();
            });

            step("Variables détectées", async () => {
              await attendreRésultat(rés, "ultat", x => x && !!x.length);
            });
          });
        });

        describe("Bds", () => {
          let idBd: string;

          describe("selon id", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

            before(async () => {
              idBd = await client2.bds!.créerBd("ODbl-1_0");

              ({ fOublier } = await client.recherche!.rechercherBdSelonId(
                idBd,
                bds => rés.ultat = bds,
                2,
              ));
            })

            after(() => {
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
                    fin: idBd.length
                  }
                }
              }
              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réf]);
            });
          });
          describe("selon nom", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherBdSelonNom(
                "météo",
                bds => rés.ultat = bds,
                2,
              ));
            })

            after(() => {
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
                    fin: 5
                  }
                }
              }
              await client2.bds!.ajouterNomsBd(idBd, {fr: "météorologie"})
              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réf]);
            });
          });

          describe("selon descr", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherBdSelonDescr(
                "météo",
                bds => rés.ultat = bds,
                2,
              ));
            })

            after(() => {
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
                    fin: 5
                  }
                }
              }
              await client2.bds!.ajouterDescriptionsBd(idBd, {fr: "Météorologie de la région de Montpellier."})
              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réf]);
            });
          });

          describe("selon variables", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherBdSelonVariable(
                "précipitation",
                bds => rés.ultat = bds,
                2,
              ));
            })

            after(() => {
                if (fOublier) fOublier();
            });

            step("Nouvelle variable détectée", async () => {
              const idVariable = await client2.variables!.créerVariable("numérique");
              const idTableau = await client2.bds!.ajouterTableauBd(idBd);
              await client2.tableaux!.ajouterColonneTableau(idTableau, idVariable);
              await client2.variables!.ajouterNomsVariable(idVariable, {fr: "Précipitation"});

              const réf: résultatRecherche<infoRésultatRecherche<infoRésultatTexte>> = {
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
                      fin: 13
                    }
                  }
                }
              }

              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réf]);
            });
          });

          describe("selon mots-clefs", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherBdSelonMotClef(
                "meteorología",
                bds => rés.ultat = bds,
                2,
              ));
            })

            after(() => {
                if (fOublier) fOublier();
            });

            step("Nouveau mot-clef détecté", async () => {
              const idMotClef = await client2.motsClefs!.créerMotClef();
              await client2.bds!.ajouterMotsClefsBd(idBd, idMotClef);
              await client2.motsClefs!.ajouterNomsMotClef(idMotClef, {es: "Meteorología"});

              const réf: résultatRecherche<infoRésultatRecherche<infoRésultatTexte>> = {
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
                      fin: 12
                    }
                  }
                }
              }

              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réf]);
            });
          });

          describe("tous", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherBds(
                bds => rés.ultat = bds,
                2,
              ));
            })

            after(() => {
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
                    type: "vide"
                  }
                }
              }
              await client2.bds!.ajouterNomsBd(idBd, {fr: "Météorologie de la région de Montpellier."})
              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
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

            before(async () => {
              idProjet = await client2.projets!.créerProjet();

              ({ fOublier } = await client.recherche!.rechercherProjetSelonId(
                idProjet,
                bds => rés.ultat = bds,
                2,
              ));
            })

            after(() => {
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
                    fin: idProjet.length
                  }
                }
              }
              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réf]);
            });
          });

          describe("selon nom", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherProjetSelonNom(
                "météo",
                projets => rés.ultat = projets,
                2,
              ));
            })

            after(() => {
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
                    fin: 5
                  }
                }
              }
              await client2.projets!.ajouterNomsProjet(idProjet, {fr: "météorologie"})

              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réf]);
            });
          });
          describe("selon descr", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherProjetSelonDescr(
                "météo",
                projets => rés.ultat = projets,
                2,
              ));
            })

            after(() => {
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
                    fin: 5
                  }
                }
              }
              await client2.projets!.ajouterDescriptionsProjet(idProjet, {fr: "Météorologie de la région de Montpellier."})

              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réf]);
            });
          });

          describe("selon variables", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[] } = {};

            before(async () => {
              idBd = await client2.bds!.créerBd("ODbl-1_0");
              await client2.projets!.ajouterBdProjet(idProjet, idBd);

              ({ fOublier } = await client.recherche!.rechercherProjetSelonVariable(
                "précip",
                bds => rés.ultat = bds,
                2,
              ));
            })

            after(() => {
                if (fOublier) fOublier();
            });

            step("Nouvelle variable détectée", async () => {
              const idVariable = await client2.variables!.créerVariable("numérique");
              const idTableau = await client2.bds!.ajouterTableauBd(idBd);
              await client2.tableaux!.ajouterColonneTableau(idTableau, idVariable);
              await client2.variables!.ajouterNomsVariable(idVariable, { fr: "Précipitation" });

              const réf: résultatRecherche<infoRésultatRecherche<infoRésultatTexte>> = {
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
                      fin: 6
                    }
                  }
                }
              }

              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réf]);
            });
          });

          describe("selon mots-clefs", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatRecherche<infoRésultatTexte>>[] } = {};

            before(async () => {
              idBd = await client2.bds!.créerBd("ODbl-1_0");
              await client2.projets!.ajouterBdProjet(idProjet, idBd);

              ({ fOublier } = await client.recherche!.rechercherProjetSelonMotClef(
                "meteorología",
                bds => rés.ultat = bds,
                2,
              ));
            })

            after(() => {
                if (fOublier) fOublier();
            });

            step("Nouveau mot-clef sur la bd détecté", async () => {
              const idMotClef = await client2.motsClefs!.créerMotClef();
              await client2.bds!.ajouterMotsClefsBd(idBd, idMotClef);
              await client2.motsClefs!.ajouterNomsMotClef(idMotClef, {es: "Meteorología"});

              const réf: résultatRecherche<infoRésultatRecherche<infoRésultatTexte>> = {
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
                      fin: 12
                    }
                  }
                }
              }

              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réf]);
            });
          });

          describe("selon bd", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatRecherche<infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>>>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherProjetSelonBd(
                "meteorología",
                bds => rés.ultat = bds,
                2,
              ));
            })

            after(() => {
                if (fOublier) fOublier();
            });

            step("Changement nom bd détecté", async () => {
              const réf: résultatRecherche<infoRésultatRecherche<infoRésultatTexte>> = {
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
                      fin: 12
                    }
                  }
                }
              }
              await client2.bds!.ajouterNomsBd(idBd, { es: "Meteorología" });

              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réf]);
            });
          });

          describe("tous", () => {
            let fOublier: schémaFonctionOublier;
            const rés: { ultat?: résultatRecherche<infoRésultatTexte>[] } = {};

            before(async () => {
              ({ fOublier } = await client.recherche!.rechercherProjets(
                projets => rés.ultat = projets,
                2,
              ));
            })

            after(() => {
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
                    type: "vide"
                  }
                }
              }
              await client2.projets!.ajouterNomsProjet(idProjet, {fr: "Météorologie de la région de Montpellier."})

              await attendreRésultat(rés, "ultat", x=>x && !!x.length);
              vérifierRecherche(rés.ultat!, [réf]);
            });
          });
        });
      });
    });
  });
});
