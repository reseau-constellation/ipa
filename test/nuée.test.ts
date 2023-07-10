import { typesClients, générerClients } from "@/utilsTests/client.js";
import type { default as ClientConstellation } from "@/client.js";
import { schémaFonctionOublier, adresseOrbiteValide } from "@/utils/index.js";

import { AttendreRésultat } from "@/utilsTests/attente.js";
import { élémentDeMembreAvecValid } from "@/reseau.js";
import { InfoColAvecCatégorie, élémentBdListeDonnées } from "@/tableaux.js";
import { schémaSpécificationBd } from "@/bds.js";

import {expect} from "aegir/chai";


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

    before(async () => {
      ({ fOublier: fOublierClients, clients } = await générerClients(2, type));
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

    describe("Noms", function () {
      test.skip("Nuée");
    });

    describe("Descriptions", function () {
      test.skip("Nuée");
    });

    describe("Mots-clefs", function () {
      test.skip("Nuée");
    });

    describe("Mes nuées", function () {
      test.skip("Nuée");
    });

    describe("Status nuée", function () {
      test.skip("Nuée");
    });

    describe("Création", function () {
      test.skip("Nuée");
    });

    describe("Tableaux", function () {
      describe("Ajouter et enlever", function () {
        test.skip("Nuée");
      });

      describe("Colonnes", function () {
        let idNuée: string;
        let idTableau: string;
        let fOublier: schémaFonctionOublier;

        const résultat = new AttendreRésultat<InfoColAvecCatégorie[]>();

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
        test.skip("Nuée");
      });
      describe("Règles", function () {
        test.skip("Nuée");
      });
    });
    describe("Qualité", function () {
      test.skip("Nuée");
    });
    describe("Différences tableau", function () {
      test.skip("Nuée");
    });
    describe("Différences bd", function () {
      test.skip("Nuée");
    });
    describe("Suivre données", function () {
      describe("Vérifier autorisations", function () {
        test.skip("Nuée");
      });
      describe("Erreurs formats bds", function () {
        test.skip("Nuée");
      });
      describe("Erreurs formats tableaux", function () {
        test.skip("Nuée");
      });
      describe("Erreurs données", function () {
        test.skip("Nuée");
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

        before(async () => {
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

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        it("Mes données aparaissent chez moi", async () => {
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
        const résultatChezMoi = new AttendreRésultat<
          élémentDeMembreAvecValid<élémentBdListeDonnées>[]
        >();
        const résultatChezLesAutres = new AttendreRésultat<
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

          empreinte = await clients[1].bds!.ajouterÉlémentÀTableauUnique({
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
          expect(val[0]).to.deep.equal(réf);
        });

        it("Mais pas chez les autres", async () => {
          const val = await résultatChezLesAutres.attendreExiste();
          expect(val.length).to.equal(0);
        });
      });
    });

    describe("Gestionnaires", function () {
      test.skip("Créer gestionnaire indépendant");
      test.skip("Exclure membre");
      test.skip("Réintégrer membre");
      test.skip("Changer philosophie à CJPI");
      test.skip("Inviter membre");
    });

    describe("Autorisations nuée", function () {
      test.skip("Créer Nuée avec gestionnaire existant");
      test.skip("Changer philosophie");
      test.skip("Accepter membre");
      test.skip("Exclure membre");
      test.skip("Changer gestionnaire");
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

        before(async () => {
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

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        it("Bds de membres autorisés", async () => {
          idBdMembreAutorisé = await client.bds!.créerBdDeSchéma({
            schéma: schémaNuée,
          });
          const val = await résultat.attendreQue((x) => x.length > 0);
          expect(val[0]).to.equal(idBdMembreAutorisé);
        });

        it("Bd non autorisée - incluse dans les miennes", async () => {
          idBdMembreNonAutorisé = await clients[1].bds!.créerBdDeSchéma({
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

        const résultat = new AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        before(async () => {
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

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        it("Bds de membres autorisés", async () => {
          idBd = await clients[1].bds!.créerBdDeSchéma({
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

    describe("Correspondances tableaux", function () {
      test.skip("Nuée");
    });

    describe("Ascendance", function () {
      describe("Héritage noms", function () {
        test.skip("Nuée");
      });
      describe("Héritage descriptions", function () {
        test.skip("Nuée");
      });
      describe("Héritage règles", function () {
        test.skip("Nuée");
      });
      describe("Traçabilité descendants", function () {
        test.skip("Nuée");
      });
      describe("Suivi données descendants", function () {
        test.skip("Nuée");
      });
    });
    describe("Suivre empreinte tête", function () {
      test.skip("Nuée");
    });
    describe("Exporter données", function () {
      test.skip("Nuée");
    });
    describe("Générer de bd", function () {
      test.skip("Nuée");
    });
    describe("Générer schéma", function () {
      test.skip("Nuée");
    });
  });
});

/*it("Les noms sont liés", async () => {
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

  expect(nomsLiés).to.deep.equal(réfNomsLiés);
  await client.bds!.sauvegarderNomBd({
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
  await client.bds!.sauvegarderDescrBd({
    id: idBdCopieLiée,
    langue: "த",
    descr: "தினசரி பொழிவு",
  });

  expect(descrsLiées).to.deep.equal(réfDescrsLiées);
  await client.bds!.sauvegarderDescrBd({
    id: idBdOrig,
    langue: "fr",
    descr: "Précipitation journalière",
  });

  réfDescrsLiées["fr"] = "précipitation";
  expect(descrsLiées).to.deep.equal(réfDescrsLiées);
});

test.skip("Changement de tableaux détecté");
test.skip("Changement de colonnes tableau détecté");
test.skip("Changement propriétés de colonnes tableau détecté");
test.skip("Changement de règles détecté");
*/
