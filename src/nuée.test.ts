import { typesClients, générerClients } from "@/utilsTests/client.js";
import type { default as ClientConstellation } from "@/client.js";
import {
  schémaFonctionOublier,

  adresseOrbiteValide,
} from "@/utils/index.js";
import { config } from "@/utilsTests/sfip.js";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      const fsOublier: schémaFonctionOublier[] = [];

      beforeAll(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
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
        }
      );
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
    })
    describe("Création", function () {
      test.todo("Nuée");
    });
    describe("Tableaux", function () {
      describe("Ajouter et enlever", function () {
        test.todo("Nuée");
      })
      describe("Colonnes", function () {
        test.todo("Nuée");
      })
      describe("Variables", function () {
        test.todo("Nuée");
      })
      describe("Règles", function () {
        test.todo("Nuée");
      })
    });
    describe("Qualité", function () {
      test.todo("Nuée");
    })
    describe("Différences tableau", function () {
      test.todo("Nuée");
    })
    describe("Différences bd", function () {
      test.todo("Nuée");
    })
    describe("Suivre données", function () {
      describe("Vérifier autorisations", function () {
        test.todo("Nuée");
      })
      describe("Erreurs formats bds", function () {
        test.todo("Nuée");
      })
      describe("Erreurs formats tableaux", function () {
        test.todo("Nuée");
      })
      describe("Erreurs données", function () {
        test.todo("Nuée");
      })
      describe("Toujours inclure les miennes", function () {
        test.todo("Nuée");
      })
    })
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
      test.todo("Nuée");
    })
    describe("Correspondances tableaux", function () {
      test.todo("Nuée");
    })
    describe("Ascendance", function () {
      describe("Héritage noms", function () {
        test.todo("Nuée");
      })
      describe("Héritage descriptions", function () {
        test.todo("Nuée");
      })
      describe("Héritage règles", function () {
        test.todo("Nuée");
      })
      describe("Traçabilité descendants", function () {
        test.todo("Nuée");
      })
      describe("Suivi données descendants", function () {
        test.todo("Nuée");
      })
    })
    describe("Suivre empreinte tête", function () {
      test.todo("Nuée");
    })
    describe("Exporter données", function () {
      test.todo("Nuée");
    })
    describe("Générer de bd", function () {
      test.todo("Nuée");
    })
    describe("Générer schéma", function () {
      test.todo("Nuée");
    })
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
