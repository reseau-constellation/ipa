import { générerClient, type ClientConstellation } from "@/index.js";
import { schémaFonctionOublier, schémaStatut, TYPES_STATUT } from "@/types.js";
import { adresseOrbiteValide } from "@constl/utils-ipa";

import { élémentDeMembreAvecValid } from "@/reseau.js";
import { InfoColAvecCatégorie, élémentBdListeDonnées } from "@/tableaux.js";
import { infoTableauAvecId, schémaSpécificationBd } from "@/bds.js";

import {
  clientsConnectés,
  client as utilsClientTest,
  attente as utilsTestAttente,
} from "@constl/utils-tests";
const { générerClients } = utilsClientTest;
import { typesClients } from "./ressources/utils.js";


import { expect } from "aegir/chai";
import { isElectronMain, isNode } from "wherearewe";

const générerNuéeTest = async (
  client: ClientConstellation,
  opts: {
    nuéeParent?: string;
    autorisation?: string | "IJPC" | "CJPI";
    ajouter?: boolean;
  } = {}
): Promise<{ idNuée: string; idTableau: string }> => {
  const idNuée = await client.nuées!.créerNuée(opts);
  const clefTableau = "principal";

  const idTableau = await client.nuées!.ajouterTableauNuée({
    idNuée,
    clefTableau,
  });
  const idVariableNumérique = await client.variables!.créerVariable({
    catégorie: "numérique",
  });
  await client.nuées!.ajouterColonneTableauNuée({
    idTableau,
    idVariable: idVariableNumérique,
    idColonne: "numérique",
  });
  return { idNuée, idTableau };
};

typesClients.forEach((type) => {
  describe.only("Client " + type, function () {
    describe.skip("Nuées : Tests individuels", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients({
          n: 1,
          type,
          générerClient
        }));
        client = clients[0];
      });

      after(async () => {
        if (fOublierClients) await fOublierClients();
        await Promise.all(fsOublier.map((f) => f()));
      });

      describe("Création", function () {
        it("Nuée", async () => {
          const idNuée = await client.nuées!.créerNuée({});
          expect(adresseOrbiteValide(idNuée)).to.be.true();
        });
      });

      describe.skip("Noms", function () {
        let idNuée: string;
        let fOublier: schémaFonctionOublier;

        const noms = new utilsTestAttente.AttendreRésultat<{
          [key: string]: string;
        }>();

        before(async () => {
          idNuée = await client.nuées!.créerNuée({});
          fOublier = await client.nuées!.suivreNomsNuée({
            idNuée,
            f: (n) => noms.mettreÀJour(n),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Pas de noms pour commencer", async () => {
          const val = await noms.attendreExiste();
          expect(Object.keys(val).length).to.equal(0);
        });

        it("Ajouter un nom", async () => {
          await client.nuées!.sauvegarderNomsNuée({
            idNuée,
            noms: { fr: "Alphabets" },
          });
          const val = await noms.attendreQue((x) => Object.keys(x).length > 0);
          expect(val.fr).to.equal("Alphabets");
        });

        it("Ajouter des noms", async () => {
          await client.nuées!.sauvegarderNomsNuée({
            idNuée,
            noms: {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            },
          });
          const val = await noms.attendreQue((x) => !!x.हिं);
          expect(val).to.deep.equal({
            fr: "Alphabets",
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          });
        });

        it("Changer un nom", async () => {
          await client.nuées!.sauvegarderNomsNuée({
            idNuée,
            noms: { fr: "Systèmes d'écriture" },
          });
          const val = await noms.attendreQue((x) => x.fr !== "Alphabets");
          expect(val?.fr).to.equal("Systèmes d'écriture");
        });

        it("Effacer un nom", async () => {
          await client.nuées!.effacerNomNuée({ idNuée, langue: "fr" });
          const val = await noms.attendreQue((x) => !x.fr);
          expect(val).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe.skip("Descriptions", function () {
        let idNuée: string;
        let fOublier: schémaFonctionOublier;

        const descr = new utilsTestAttente.AttendreRésultat<{
          [key: string]: string;
        }>();

        before(async () => {
          idNuée = await client.nuées!.créerNuée({});
          fOublier = await client.nuées!.suivreDescriptionsNuée({
            idNuée,
            f: (n) => descr.mettreÀJour(n),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Pas de descriptions pour commencer", async () => {
          const val = await descr.attendreExiste();
          expect(Object.keys(val).length).to.equal(0);
        });

        it("Ajouter une description", async () => {
          await client.nuées!.sauvegarderDescriptionsNuée({
            idNuée,
            descriptions: { fr: "Alphabets" },
          });
          const val = await descr.attendreQue((x) => Object.keys(x).length > 0);
          expect(val.fr).to.equal("Alphabets");
        });

        it("Ajouter des descriptions", async () => {
          await client.nuées!.sauvegarderDescriptionsNuée({
            idNuée,
            descriptions: {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            },
          });
          const val = await descr.attendreQue((x) => !!x.हिं);
          expect(val).to.deep.equal({
            fr: "Alphabets",
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          });
        });

        it("Changer une description", async () => {
          await client.nuées!.sauvegarderDescriptionsNuée({
            idNuée,
            descriptions: { fr: "Systèmes d'écriture" },
          });
          const val = await descr.attendreQue((x) => x.fr !== "Alphabets");
          expect(val?.fr).to.equal("Systèmes d'écriture");
        });

        it("Effacer une description", async () => {
          await client.nuées!.effacerDescriptionNuée({
            idNuée,
            langue: "fr",
          });
          const val = await descr.attendreQue((x) => !x.fr);
          expect(val).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe.skip("Mots-clefs", function () {
        let idMotClef: string;
        let idNuée: string;

        let fOublier: schémaFonctionOublier;

        const motsClefs = new utilsTestAttente.AttendreRésultat<string[]>();

        before(async () => {
          idNuée = await client.nuées!.créerNuée({});
          fOublier = await client.nuées!.suivreMotsClefsNuée({
            idNuée,
            f: (m) => motsClefs.mettreÀJour(m),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });
        it("Pas de mots-clefs pour commencer", async () => {
          const val = await motsClefs.attendreExiste();
          expect(val).to.be.an.empty("array");
        });
        it("Ajout d'un mot-clef", async () => {
          idMotClef = await client.motsClefs!.créerMotClef();
          await client.nuées!.ajouterMotsClefsNuée({
            idNuée,
            idsMotsClefs: idMotClef,
          });
          const val = await motsClefs.attendreQue((x) => x.length > 0);

          expect(val).to.contain(idMotClef);
        });
        it("Effacer un mot-clef", async () => {
          await client.nuées!.effacerMotClefNuée({ idNuée, idMotClef });
          const val = await motsClefs.attendreQue(
            (x) => !x.includes(idMotClef)
          );

          expect(val).to.be.an.empty("array");
        });
      });

      describe.skip("Mes nuées", function () {
        let fOublier: schémaFonctionOublier;
        let idNuée: string;
        let idNouvelleNuée: string;

        const nuées = new utilsTestAttente.AttendreRésultat<string[]>();

        before(async () => {
          idNuée = await client.nuées!.créerNuée({});
          fOublier = await client.nuées!.suivreNuées({
            f: (_nuées) => nuées.mettreÀJour(_nuées),
          });
        });
        after(async () => {
          if (fOublier) await fOublier();
        });
        it("On crée une autre nuée sans l'ajouter", async () => {
          idNouvelleNuée = await client.nuées!.créerNuée({
            ajouter: false,
          });
          const val = await nuées.attendreExiste();
          expect(val).to.be.an("array").and.not.to.contain(idNouvelleNuée);
        });
        it("La nuée déjà ajoutée est présente", async () => {
          const val = await nuées.attendreExiste();
          expect(val).to.be.an("array").and.to.contain(idNuée);
        });

        it("On peut l'ajouter ensuite à mes bds", async () => {
          await client.nuées!.ajouterÀMesNuées({ idNuée: idNouvelleNuée });
          const val = await nuées.attendreQue((x) =>
            x.includes(idNouvelleNuée)
          );

          expect(val).to.be.an("array").and.to.contain(idNouvelleNuée);
        });

        it("On peut aussi l'effacer", async () => {
          await client.nuées!.effacerNuée({ idNuée: idNouvelleNuée });
          const val = await nuées.attendreQue(
            (x) => !x.includes(idNouvelleNuée)
          );
          expect(val).to.be.an("array").and.to.not.contain(idNouvelleNuée);
        });
      });

      describe.skip("Statut nuée", function () {
        let fOublier: schémaFonctionOublier;
        let idNuée: string;

        const statut = new utilsTestAttente.AttendreRésultat<schémaStatut>();

        before(async () => {
          idNuée = await client.nuées!.créerNuée({});
          fOublier = await client.nuées!.suivreStatutNuée({
            idNuée,
            f: (x) => statut.mettreÀJour(x),
          });
        });
        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Marquer bêta", async () => {
          await client.nuées?.marquerBêta({ idNuée });
          const val = await statut.attendreQue(
            (x) => x.statut === TYPES_STATUT.BÊTA
          );
          expect(val).to.deep.equal({
            statut: TYPES_STATUT.BÊTA,
          });
        });

        it("Marquer interne", async () => {
          await client.nuées?.marquerInterne({ idNuée });
          const val = await statut.attendreQue(
            (x) => x.statut === TYPES_STATUT.INTERNE
          );
          expect(val).to.deep.equal({
            statut: TYPES_STATUT.INTERNE,
          });
        });

        it("Marquer obsolète", async () => {
          await client.nuées?.marquerObsolète({
            idNuée,
            idNouvelle: "Une nouvelle bd.",
          }); //  Pour une vraie application, utiliser un id Nuée valide, bien entendu.
          const val = await statut.attendreQue(
            (x) => x.statut === TYPES_STATUT.OBSOLÈTE
          );
          expect(val).to.deep.equal({
            statut: TYPES_STATUT.OBSOLÈTE,
            idNouvelle: "Une nouvelle bd.",
          });
        });

        it("Marquer active", async () => {
          await client.nuées?.marquerActive({ idNuée });
          const val = await statut.attendreQue(
            (x) => x.statut === TYPES_STATUT.ACTIVE
          );
          expect(val).to.deep.equal({
            statut: TYPES_STATUT.ACTIVE,
          });
        });
      });

      describe.skip("Tableaux", function () {
        describe("Ajouter et enlever", function () {
          let fOublier: schémaFonctionOublier;
          let idNuée: string;
          let idTableau: string;

          const tableaux = new utilsTestAttente.AttendreRésultat<
            infoTableauAvecId[]
          >();

          before(async () => {
            idNuée = await client.nuées!.créerNuée({});
            fOublier = await client.nuées!.suivreTableauxNuée({
              idNuée,
              f: (x) => tableaux.mettreÀJour(x),
            });
          });
          after(async () => {
            if (fOublier) await fOublier();
          });

          it("Ajout tableau", async () => {
            idTableau = await client.nuées!.ajouterTableauNuée({
              idNuée,
              clefTableau: "abc",
            });
            const val = await tableaux.attendreExiste();
            expect(val).to.have.deep.members([
              {
                clef: "abc",
                position: 0,
                id: idTableau,
              },
            ]);
          });

          it("Effacer tableau", async () => {
            await client.nuées!.effacerTableauNuée({
              idNuée,
              idTableau,
            });
            const val = await tableaux.attendreQue((x) => !x.length);
            expect(val).to.be.empty();
          });
        });

        describe("Colonnes", function () {
          let idNuée: string;
          let idTableau: string;
          let fOublier: schémaFonctionOublier;

          const résultat = new utilsTestAttente.AttendreRésultat<
            InfoColAvecCatégorie[]
          >();

          before(async () => {
            idNuée = await client.nuées!.créerNuée({});
            idTableau = await client.nuées!.ajouterTableauNuée({
              idNuée,
              clefTableau: "principal",
            });
            fOublier = await client.nuées!.suivreColonnesTableauNuée({
              idNuée,
              clefTableau: "principal",
              f: (x) => résultat.mettreÀJour(x),
            });
          });

          after(async () => {
            if (fOublier) await fOublier();
          });

          it("Ajout colonne", async () => {
            const idVariable = await client.variables!.créerVariable({
              catégorie: "chaîne",
            });
            await client.nuées!.ajouterColonneTableauNuée({
              idTableau,
              idVariable,
            });
            const val = await résultat.attendreQue((x) => x.length > 0);
            expect(val[0].variable).to.equal(idVariable);
          });
        });

        describe("Variables", function () {
          let fOublier: schémaFonctionOublier;
          let idNuée: string;
          let idTableau: string;
          let idColonne: string;

          const variables = new utilsTestAttente.AttendreRésultat<string[]>();

          before(async () => {
            idNuée = await client.nuées!.créerNuée({});
            idTableau = await client.nuées!.ajouterTableauNuée({ idNuée });

            fOublier = await client.nuées!.suivreVariablesNuée({
              idNuée,
              f: (x) => variables.mettreÀJour(x),
            });
          });

          after(async () => {
            if (fOublier) await fOublier();
          });

          it("Pas de variables pour commencer", async () => {
            const val = await variables.attendreExiste();
            expect(val).to.be.an.empty("array");
          });

          it("Ajout d'une variable", async () => {
            const idVariable = await client.variables!.créerVariable({
              catégorie: "numérique",
            });

            idColonne = await client.nuées!.ajouterColonneTableauNuée({
              idTableau,
              idVariable,
            });

            const val = await variables.attendreQue((x) => x.length > 0);
            expect(val).to.have.members([idVariable]);
          });

          it("Effacer une variable", async () => {
            await client.nuées!.effacerColonneTableauNuée({
              idTableau,
              idColonne,
            });
            const val = await variables.attendreQue((x) => !x.length);
            expect(val).to.be.an.empty("array");
          });
        });

        describe("Règles", function () {
          it.skip("Nuée");
        });
      });
      describe("Qualité", function () {
        it.skip("Nuée");
      });
      describe("Différences tableau", function () {
        it.skip("Nuée");
      });
      describe("Différences bd", function () {
        it.skip("Nuée");
      });
    });

    if (isElectronMain || isNode) {
      describe("Suivre données", function () {
        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation;

        const fsOublier: schémaFonctionOublier[] = [];

        before(async () => {
          ({ fOublier: fOublierClients, clients } = await générerClients({
            n: 2,
            type,
            générerClient
          }));
          client = clients[0];
        });

        after(async () => {
          if (fOublierClients) await fOublierClients();
          await Promise.all(fsOublier.map((f) => f()));
        });
        describe("Vérifier autorisations", function () {
          it.skip("Nuée");
        });
        describe("Erreurs formats bds", function () {
          it.skip("Nuée");
        });
        describe("Erreurs formats tableaux", function () {
          it.skip("Nuée");
        });
        describe("Erreurs données", function () {
          it.skip("Nuée");
        });

        describe("Toujours inclure les miennes", function () {
          let idNuée: string;
          let idCol: string;
          let empreinte: string;

          const fsOublier: schémaFonctionOublier[] = [];
          const résultatChezMoi = new utilsTestAttente.AttendreRésultat<
            élémentDeMembreAvecValid<élémentBdListeDonnées>[]
          >();
          const résultatChezLesAutres = new utilsTestAttente.AttendreRésultat<
            élémentDeMembreAvecValid<élémentBdListeDonnées>[]
          >();

          before(async () => {
            idNuée = await client.nuées!.créerNuée({ autorisation: "CJPI" });

            const idTableau = await client.nuées!.ajouterTableauNuée({
              idNuée,
              clefTableau: "principal",
            });
            const idVariableNumérique = await client.variables!.créerVariable({
              catégorie: "numérique",
            });
            idCol = await client.nuées!.ajouterColonneTableauNuée({
              idTableau,
              idVariable: idVariableNumérique,
              idColonne: "col numérique",
            });
            const { fOublier: fOublierChezMoi } =
              await clients[1].nuées!.suivreDonnéesTableauNuée({
                idNuée,
                clefTableau: "principal",
                f: async (x) => résultatChezMoi.mettreÀJour(x),
                nRésultatsDésirés: 100,
              });
            fsOublier.push(fOublierChezMoi);

            const { fOublier: fOublierChezLesAutres } =
              await client.nuées!.suivreDonnéesTableauNuée({
                idNuée,
                clefTableau: "principal",
                f: async (x) => résultatChezLesAutres.mettreÀJour(x),
                nRésultatsDésirés: 100,
              });
            fsOublier.push(fOublierChezLesAutres);

            const schémaNuée = await client.nuées!.générerSchémaBdNuée({
              idNuée,
              licence: "ODbl-1_0",
            });
            empreinte = await clients[1].bds.ajouterÉlémentÀTableauUnique({
              schémaBd: schémaNuée,
              idNuéeUnique: idNuée,
              clefTableau: "principal",
              vals: { [idCol]: 3 },
            });
          });

          after(async () => {
            await Promise.all(fsOublier.map((f) => f()));
          });

          it("Mes données aparaissent chez moi", async () => {
            const val = await résultatChezMoi.attendreQue(
              (x) => x && x.length > 0
            );
            const réf: élémentDeMembreAvecValid<élémentBdListeDonnées> = {
              idCompte: await clients[1].obtIdCompte(),
              élément: {
                données: {
                  [idCol]: 3,
                  id: val[0].élément.données["id"],
                },
                empreinte,
              },
              valid: [],
            };
            expect(val[0]).to.deep.equal(réf);
          });

          it("Mais pas chez les autres", async () => {
            const val = await résultatChezLesAutres.attendreExiste();
            expect(val.length).to.equal(0);
          });
        });

        describe("Toujours inclure les miennes - idNuée non rejoignable", function () {
          let empreinte: string;

          const idNuée =
            "/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX/tuNeMeTrouverasPas";
          const idCol = "colonne numérique";
          const fsOublier: schémaFonctionOublier[] = [];
          const résultatChezMoi = new utilsTestAttente.AttendreRésultat<
            élémentDeMembreAvecValid<élémentBdListeDonnées>[]
          >();
          const résultatChezLesAutres = new utilsTestAttente.AttendreRésultat<
            élémentDeMembreAvecValid<élémentBdListeDonnées>[]
          >();

          before(async () => {
            const idVariableNumérique = await client.variables!.créerVariable({
              catégorie: "numérique",
            });

            const schémaBd: schémaSpécificationBd = {
              licence: "ODbl-1_0",
              nuées: [idNuée],
              tableaux: [
                {
                  cols: [
                    {
                      idVariable: idVariableNumérique,
                      idColonne: idCol,
                    },
                  ],
                  clef: "principal",
                },
              ],
            };

            const { fOublier: fOublierChezMoi } =
              await clients[1].nuées!.suivreDonnéesTableauNuée({
                idNuée,
                clefTableau: "principal",
                f: async (x) => résultatChezMoi.mettreÀJour(x),
                nRésultatsDésirés: 100,
              });
            fsOublier.push(fOublierChezMoi);

            const { fOublier: fOublierChezLesAutres } =
              await client.nuées!.suivreDonnéesTableauNuée({
                idNuée,
                clefTableau: "principal",
                f: async (x) => résultatChezLesAutres.mettreÀJour(x),
                nRésultatsDésirés: 100,
              });
            fsOublier.push(fOublierChezLesAutres);

            empreinte = await clients[1].bds.ajouterÉlémentÀTableauUnique({
              schémaBd,
              idNuéeUnique: idNuée,
              clefTableau: "principal",
              vals: { [idCol]: 3 },
            });
          });

          after(async () => {
            await Promise.all(fsOublier.map((f) => f()));
          });

          it("Mes données aparaissent chez moi", async () => {
            const val = await résultatChezMoi.attendreQue(
              (x) => x && x.length > 0
            );
            const réf: élémentDeMembreAvecValid<élémentBdListeDonnées> = {
              idCompte: await clients[1].obtIdCompte(),
              élément: {
                données: {
                  [idCol]: 3,
                  id: val[0].élément.données["id"],
                },
                empreinte,
              },
              valid: [],
            };
            expect(val[0]).to.deep.equal(réf);
          });

          it("Mais pas chez les autres", async () => {
            const val = await résultatChezLesAutres.attendreExiste();
            expect(val.length).to.equal(0);
          });
        });
      });

      describe.skip("Gestionnaires", function () {
        it.skip("Créer gestionnaire indépendant");
        it.skip("Exclure membre");
        it.skip("Réintégrer membre");
        it.skip("Changer philosophie à CJPI");
        it.skip("Inviter membre");
      });

      describe("Autorisations nuée", function () {
        it.skip("Créer Nuée avec gestionnaire existant");
        it.skip("Changer philosophie");
        it.skip("Accepter membre");
        it.skip("Exclure membre");
        it.skip("Changer gestionnaire");
      });

      describe("Correspondances bds", function () {
        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation;

        const fsOublier: schémaFonctionOublier[] = [];

        before(async () => {
          ({ fOublier: fOublierClients, clients } = await générerClients({
            n: 2,
            type,
            générerClient
          }));
          // @ts-ignore
          await clientsConnectés(...clients)
          client = clients[0];
        });

        after(async () => {
          if (fOublierClients) await fOublierClients();
          await Promise.all(fsOublier.map((f) => f()));
        });
        describe("CJPI", function () {
          let idNuée: string;
          let schémaNuée: schémaSpécificationBd;
          let idBdMembreAutorisé: string;
          let idBdMembreNonAutorisé: string;

          const résultat = new utilsTestAttente.AttendreRésultat<string[]>();
          const résultatSansVérification =
            new utilsTestAttente.AttendreRésultat<string[]>();
          const résultatSansInclureLesMiennes =
            new utilsTestAttente.AttendreRésultat<string[]>();

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            console.log("ici 0");
            fsOublier.push(await clients[1].réseau.suivreConnexionsDispositifs({f: console.log}));
            fsOublier.push(await clients[1].réseau.suivreConnexionsPostesSFIP({f: console.log}));
            ({ idNuée } = await générerNuéeTest(client, {
              autorisation: "CJPI",
            }));
            console.log("ici 1", { idNuée });
            schémaNuée = await client.nuées!.générerSchémaBdNuée({
              idNuée,
              licence: "ODbl-1_0",
            });
            console.log("ici 2");
            const { fOublier: fOublierRésultat } =
              await clients[1].nuées!.suivreBdsCorrespondantes({
                idNuée,
                f: (x) => {console.log("résultat 1 test", x); résultat.mettreÀJour(x)},
                nRésultatsDésirés: 100,
              });
            fsOublier.push(fOublierRésultat);
            console.log("ici 3");

            /*const { fOublier: fOublierRésultatSansVérification } =
              await client.nuées!.suivreBdsCorrespondantes({
                idNuée,
                f: (x) => {console.log("résultat sans vérification", x); résultatSansVérification.mettreÀJour(x)},
                nRésultatsDésirés: 100,
                vérifierAutorisation: false,
              });
            fsOublier.push(fOublierRésultatSansVérification);
            console.log("ici 4");

            const { fOublier: fOublierRésultatSansInclureLesMiennes } =
              await clients[1].nuées!.suivreBdsCorrespondantes({
                idNuée,
                f: (x) => {console.log("résultat sans inclure les miennes", x); résultatSansInclureLesMiennes.mettreÀJour(x)},
                nRésultatsDésirés: 100,
                toujoursInclureLesMiennes: false,
              });
            fsOublier.push(fOublierRésultatSansInclureLesMiennes);
            console.log("ici avant terminé"); */
          });

          after(async () => {
            await Promise.all(fsOublier.map((f) => f()));
          });

          it("Bds de membres autorisés", async () => {
            console.log("ici test 0");
            idBdMembreAutorisé = await client.bds.créerBdDeSchéma({
              schéma: schémaNuée,
            });
            console.log("ici test 1");
            const val = await résultat.attendreQue((x) => x.length > 0);
            console.log("ici test 2");
            expect(val[0]).to.equal(idBdMembreAutorisé);
          });

          it("Bd non autorisée - incluse dans les miennes", async () => {
            idBdMembreNonAutorisé = await clients[1].bds.créerBdDeSchéma({
              schéma: schémaNuée,
            });
            const val = await résultat.attendreQue((x) => x.length > 1);
            expect(val.includes(idBdMembreNonAutorisé)).to.be.true();
          });

          it("Bd non autorisée - non incluse pour les autres", async () => {
            const val2 = await résultatSansInclureLesMiennes.attendreQue(
              (x) => x.length > 0
            );
            expect(val2.includes(idBdMembreNonAutorisé)).to.be.false();
          });

          it("Bd non autorisée - incluse sans vérification", async () => {
            const val3 = await résultatSansVérification.attendreQue(
              (x) => x.length > 1
            );
            expect(val3.includes(idBdMembreNonAutorisé)).to.be.true();
          });
        });

        describe("IJPC", function () {
          let idNuée: string;
          let schémaNuée: schémaSpécificationBd;
          let idBd: string;

          const résultat = new utilsTestAttente.AttendreRésultat<string[]>();

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            ({ idNuée } = await générerNuéeTest(client, {
              autorisation: "IJPC",
            }));
            schémaNuée = await client.nuées!.générerSchémaBdNuée({
              idNuée,
              licence: "ODbl-1_0",
            });
            const { fOublier: fOublierRésultat } =
              await client.nuées!.suivreBdsCorrespondantes({
                idNuée,
                f: (x) => résultat.mettreÀJour(x),
                nRésultatsDésirés: 100,
              });
            fsOublier.push(fOublierRésultat);
          });

          after(async () => {
            await Promise.all(fsOublier.map((f) => f()));
          });

          it("Bds de membres autorisés", async () => {
            idBd = await clients[1].bds.créerBdDeSchéma({
              schéma: schémaNuée,
            });
            const val = await résultat.attendreQue((x) => x.length > 0);
            expect(val[0]).to.equal(idBd);
          });

          it("Bloquer membre", async () => {
            await client.nuées?.exclureMembreDeNuée({
              idNuée,
              idCompte: await clients[1].obtIdCompte(),
            });
            const val = await résultat.attendreQue((x) => x.length === 0);
            expect(val.includes(idBd)).to.be.false();
          });
        });
      });
    }

    describe("Correspondances tableaux", function () {
      it.skip("Nuée");
    });

    describe("Ascendance", function () {
      describe("Héritage noms", function () {
        it.skip("Nuée");
      });
      describe("Héritage descriptions", function () {
        it.skip("Nuée");
      });
      describe("Héritage règles", function () {
        it.skip("Nuée");
      });
      describe("Traçabilité descendants", function () {
        it.skip("Nuée");
      });
      describe("Suivi données descendants", function () {
        it.skip("Nuée");
      });
    });
    describe("Suivre empreinte tête", function () {
      it.skip("Nuée");
    });
    describe("Exporter données", function () {
      it.skip("Nuée");
    });
    describe("Générer de bd", function () {
      it.skip("Nuée");
    });
    describe("Générer schéma", function () {
      it.skip("Nuée");
    });
  });
});

/*it("Les noms sont liés", async () => {
  const réfNomsLiés: { [key: string]: string } = Object.assign(
    {},
    réfNoms,
    { த: "பொழிவு" }
  );
  await client.bds.sauvegarderNomBd({
    id: idBdCopieLiée,
    langue: "த",
    nom: "பொழிவு",
  });

  expect(nomsLiés).to.deep.equal(réfNomsLiés);
  await client.bds.sauvegarderNomBd({
    id: idBdOrig,
    langue: "fr",
    nom: "précipitation",
  });

  réfNomsLiés["fr"] = "précipitation";
  expect(nomsLiés).to.deep.equal(réfNomsLiés);
});

it("Les descriptions sont liées", async () => {
  const réfDescrsLiées: { [key: string]: string } = Object.assign(
    {},
    réfNoms,
    { த: "தினசரி பொழிவு" }
  );
  await client.bds.sauvegarderDescrBd({
    id: idBdCopieLiée,
    langue: "த",
    descr: "தினசரி பொழிவு",
  });

  expect(descrsLiées).to.deep.equal(réfDescrsLiées);
  await client.bds.sauvegarderDescrBd({
    id: idBdOrig,
    langue: "fr",
    descr: "Précipitation journalière",
  });

  réfDescrsLiées["fr"] = "précipitation";
  expect(descrsLiées).to.deep.equal(réfDescrsLiées);
});

it.skip("Changement de tableaux détecté");
it.skip("Changement de colonnes tableau détecté");
it.skip("Changement propriétés de colonnes tableau détecté");
it.skip("Changement de règles détecté");
*/
