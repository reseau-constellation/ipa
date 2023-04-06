import { typesClients, générerClients } from "@/utilsTests/client.js";
import type { default as ClientConstellation } from "@/client.js";
import { schémaFonctionOublier, adresseOrbiteValide } from "@/utils/index.js";
import { config } from "@/utilsTests/sfip.js";
import { AttendreRésultat } from "./utilsTests";
import { élémentDeMembreAvecValid } from "./reseau";
import { InfoColAvecCatégorie, élémentBdListeDonnées } from "./tableaux";
import { schémaSpécificationBd } from "./bds";

const générerNuéeTest = async (
  client: ClientConstellation,
  opts: {
    nuéeParent?: string;
    autorisation?: string;
    philosophie?: "IJPC" | "CJPI";
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
  describe("Client " + type, function () {
    let fOublierClients: () => Promise<void>;
    let clients: ClientConstellation[];
    let client: ClientConstellation;

    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      ({ fOublier: fOublierClients, clients } = await générerClients(2, type));
      client = clients[0];
    }, config.patienceInit);

    afterAll(async () => {
      if (fOublierClients) await fOublierClients();
      await Promise.all(fsOublier.map((f) => f()));
    });
    describe("Création", function () {
      test("Nuée", async () => {
        const idNuée = await client.nuées!.créerNuée({});
        expect(adresseOrbiteValide(idNuée)).toBe(true);
      });
    });
    describe("Noms", function () {
      test.todo("Nuée");
    });
    describe("Descriptions", function () {
      test.todo("Nuée");
    });
    describe("Mots-clefs", function () {
      test.todo("Nuée");
    });
    describe("Mes nuées", function () {
      test.todo("Nuée");
    });
    describe("Status nuée", function () {
      test.todo("Nuée");
    });
    describe("Création", function () {
      test.todo("Nuée");
    });
    describe("Tableaux", function () {
      describe("Ajouter et enlever", function () {
        test.todo("Nuée");
      });
      describe("Colonnes", function () {
        let idNuée: string;
        let idTableau: string;
        let fOublier: schémaFonctionOublier;

        const résultat = new AttendreRésultat<InfoColAvecCatégorie[]>();

        beforeAll(async () => {
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

        afterAll(async () => {
          if (fOublier) await fOublier();
        });

        test("Ajout colonne", async () => {
          const idVariable = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          await client.nuées!.ajouterColonneTableauNuée({
            idTableau,
            idVariable,
          });
          const val = await résultat.attendreQue((x) => x.length > 0);
          expect(val[0].variable).toEqual(idVariable);
        });
      });
      describe("Variables", function () {
        test.todo("Nuée");
      });
      describe("Règles", function () {
        test.todo("Nuée");
      });
    });
    describe("Qualité", function () {
      test.todo("Nuée");
    });
    describe("Différences tableau", function () {
      test.todo("Nuée");
    });
    describe("Différences bd", function () {
      test.todo("Nuée");
    });
    describe("Suivre données", function () {
      describe("Vérifier autorisations", function () {
        test.todo("Nuée");
      });
      describe("Erreurs formats bds", function () {
        test.todo("Nuée");
      });
      describe("Erreurs formats tableaux", function () {
        test.todo("Nuée");
      });
      describe("Erreurs données", function () {
        test.todo("Nuée");
      });

      describe("Toujours inclure les miennes", function () {
        let idNuée: string;
        let idCol: string;
        let empreinte: string;

        const fsOublier: schémaFonctionOublier[] = [];
        const résultatChezMoi = new AttendreRésultat<
          élémentDeMembreAvecValid<élémentBdListeDonnées>[]
        >();
        const résultatChezLesAutres = new AttendreRésultat<
          élémentDeMembreAvecValid<élémentBdListeDonnées>[]
        >();

        beforeAll(async () => {
          idNuée = await client.nuées!.créerNuée({ philosophie: "CJPI" });

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
            idColonne: "numérique",
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
          empreinte = await clients[1].bds!.ajouterÉlémentÀTableauUnique({
            schémaBd: schémaNuée,
            idNuéeUnique: idNuée,
            clefTableau: "principal",
            vals: { [idCol]: 3 },
          });
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        test("Mes données aparaissent chez moi", async () => {
          const val = await résultatChezMoi.attendreQue(
            (x) => x && x.length > 0
          );
          const réf: élémentDeMembreAvecValid<élémentBdListeDonnées> = {
            idBdCompte: await clients[1].obtIdCompte(),
            élément: {
              données: {
                [idCol]: 3,
                id: val[0].élément.données["id"],
              },
              empreinte,
            },
            valid: [],
          };
          expect(val[0]).toEqual(réf);
        });

        test("Mais pas chez les autres", async () => {
          const val = await résultatChezLesAutres.attendreExiste();
          expect(val.length).toEqual(0);
        });
      });

      describe("Toujours inclure les miennes - idNuée non rejoignable", function () {
        let empreinte: string;
        
        const idNuée = "/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX/tuNeMeTrouverasPas";
        const idCol = "colonne numérique";
        const fsOublier: schémaFonctionOublier[] = [];
        const résultatChezMoi = new AttendreRésultat<
          élémentDeMembreAvecValid<élémentBdListeDonnées>[]
        >();
        const résultatChezLesAutres = new AttendreRésultat<
          élémentDeMembreAvecValid<élémentBdListeDonnées>[]
        >();

        beforeAll(async () => {

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
                  }
                ],
                clef: "principal" 
              }
            ]
          } 

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

          empreinte = await clients[1].bds!.ajouterÉlémentÀTableauUnique({
            schémaBd,
            idNuéeUnique: idNuée,
            clefTableau: "principal",
            vals: { [idCol]: 3 },
          });
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        test("Mes données aparaissent chez moi", async () => {
          const val = await résultatChezMoi.attendreQue(
            (x) => x && x.length > 0
          );
          const réf: élémentDeMembreAvecValid<élémentBdListeDonnées> = {
            idBdCompte: await clients[1].obtIdCompte(),
            élément: {
              données: {
                [idCol]: 3,
                id: val[0].élément.données["id"],
              },
              empreinte,
            },
            valid: [],
          };
          expect(val[0]).toEqual(réf);
        });

        test("Mais pas chez les autres", async () => {
          const val = await résultatChezLesAutres.attendreExiste();
          expect(val.length).toEqual(0);
        });
      });
    });

    describe("Gestionnaires", function () {
      test.todo("Créer gestionnaire indépendant");
      test.todo("Exclure membre");
      test.todo("Réintégrer membre");
      test.todo("Changer philosophie à CJPI");
      test.todo("Inviter membre");
    });

    describe("Autorisations nuée", function () {
      test.todo("Créer Nuée avec gestionnaire existant");
      test.todo("Changer philosophie");
      test.todo("Accepter membre");
      test.todo("Exclure membre");
      test.todo("Changer gestionnaire");
    });

    describe("Correspondances bds", function () {
      describe("CJPI", function () {
        let idNuée: string;
        let schémaNuée: schémaSpécificationBd;
        let idBdMembreAutorisé: string;
        let idBdMembreNonAutorisé: string;

        const résultat = new AttendreRésultat<string[]>();
        const résultatSansVérification = new AttendreRésultat<string[]>();
        const résultatSansInclureLesMiennes = new AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idNuée } = await générerNuéeTest(client, { philosophie: "CJPI" }));
          schémaNuée = await client.nuées!.générerSchémaBdNuée({
            idNuée,
            licence: "ODbl-1_0",
          });
          const { fOublier: fOublierRésultat } =
            await clients[1].nuées!.suivreBdsCorrespondantes({
              idNuée,
              f: (x) => résultat.mettreÀJour(x),
              nRésultatsDésirés: 100,
            });
          fsOublier.push(fOublierRésultat);

          const { fOublier: fOublierRésultatSansVérification } =
            await client.nuées!.suivreBdsCorrespondantes({
              idNuée,
              f: (x) => résultatSansVérification.mettreÀJour(x),
              nRésultatsDésirés: 100,
              vérifierAutorisation: false,
            });
          fsOublier.push(fOublierRésultatSansVérification);

          const { fOublier: fOublierRésultatSansInclureLesMiennes } =
            await clients[1].nuées!.suivreBdsCorrespondantes({
              idNuée,
              f: (x) => résultatSansInclureLesMiennes.mettreÀJour(x),
              nRésultatsDésirés: 100,
              toujoursInclureLesMiennes: false,
            });
          fsOublier.push(fOublierRésultatSansInclureLesMiennes);
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        test("Bds de membres autorisés", async () => {
          idBdMembreAutorisé = await client.bds!.créerBdDeSchéma({
            schéma: schémaNuée,
          });
          const val = await résultat.attendreQue((x) => x.length > 0);
          expect(val[0]).toEqual(idBdMembreAutorisé);
        });

        test("Bd non autorisée - incluse dans les miennes", async () => {
          idBdMembreNonAutorisé = await clients[1].bds!.créerBdDeSchéma({
            schéma: schémaNuée,
          });
          const val = await résultat.attendreQue((x) => x.length > 1);
          expect(val.includes(idBdMembreNonAutorisé)).toBe(true);
        });

        test("Bd non autorisée - non incluse pour les autres", async () => {
          const val2 = await résultatSansInclureLesMiennes.attendreQue(
            (x) => x.length > 0
          );
          expect(val2.includes(idBdMembreNonAutorisé)).toBe(false);
        });

        test("Bd non autorisée - incluse sans vérification", async () => {
          const val3 = await résultatSansVérification.attendreQue(
            (x) => x.length > 1
          );
          expect(val3.includes(idBdMembreNonAutorisé)).toEqual(true);
        });
      });

      describe("IJPC", function () {
        let idNuée: string;
        let schémaNuée: schémaSpécificationBd;
        let idBd: string;

        const résultat = new AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idNuée } = await générerNuéeTest(client, { philosophie: "IJPC" }));
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

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        test("Bds de membres autorisés", async () => {
          idBd = await clients[1].bds!.créerBdDeSchéma({
            schéma: schémaNuée,
          });
          const val = await résultat.attendreQue((x) => x.length > 0);
          expect(val[0]).toEqual(idBd);
        });

        test("Bloquer membre", async () => {
          await client.nuées?.exclureMembreDeNuée({
            idNuée,
            idCompte: await clients[1].obtIdCompte(),
          });
          const val = await résultat.attendreQue((x) => x.length === 0);
          expect(val.includes(idBd)).toBe(false);
        });
      });
    });

    describe("Correspondances tableaux", function () {
      test.todo("Nuée");
    });

    describe("Ascendance", function () {
      describe("Héritage noms", function () {
        test.todo("Nuée");
      });
      describe("Héritage descriptions", function () {
        test.todo("Nuée");
      });
      describe("Héritage règles", function () {
        test.todo("Nuée");
      });
      describe("Traçabilité descendants", function () {
        test.todo("Nuée");
      });
      describe("Suivi données descendants", function () {
        test.todo("Nuée");
      });
    });
    describe("Suivre empreinte tête", function () {
      test.todo("Nuée");
    });
    describe("Exporter données", function () {
      test.todo("Nuée");
    });
    describe("Générer de bd", function () {
      test.todo("Nuée");
    });
    describe("Générer schéma", function () {
      test.todo("Nuée");
    });
  });
});

/*test("Les noms sont liés", async () => {
  const réfNomsLiés: { [key: string]: string } = Object.assign(
    {},
    réfNoms,
    { த: "பொழிவு" }
  );
  await client.bds!.sauvegarderNomBd({
    id: idBdCopieLiée,
    langue: "த",
    nom: "பொழிவு",
  });

  expect(nomsLiés).toEqual(réfNomsLiés);
  await client.bds!.sauvegarderNomBd({
    id: idBdOrig,
    langue: "fr",
    nom: "précipitation",
  });

  réfNomsLiés["fr"] = "précipitation";
  expect(nomsLiés).toEqual(réfNomsLiés);
});

test("Les descriptions sont liées", async () => {
  const réfDescrsLiées: { [key: string]: string } = Object.assign(
    {},
    réfNoms,
    { த: "தினசரி பொழிவு" }
  );
  await client.bds!.sauvegarderDescrBd({
    id: idBdCopieLiée,
    langue: "த",
    descr: "தினசரி பொழிவு",
  });

  expect(descrsLiées).toEqual(réfDescrsLiées);
  await client.bds!.sauvegarderDescrBd({
    id: idBdOrig,
    langue: "fr",
    descr: "Précipitation journalière",
  });

  réfDescrsLiées["fr"] = "précipitation";
  expect(descrsLiées).toEqual(réfDescrsLiées);
});

test.todo("Changement de tableaux détecté");
test.todo("Changement de colonnes tableau détecté");
test.todo("Changement propriétés de colonnes tableau détecté");
test.todo("Changement de règles détecté");
*/
