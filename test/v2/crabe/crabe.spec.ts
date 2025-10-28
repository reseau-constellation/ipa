import { expect } from "aegir/chai";
import { ServicesLibp2pTest, dossierTempo } from "@constl/utils-tests";
import { obtenir } from "@constl/utils-ipa";
import { ServicesNécessairesCompte } from "@/v2/crabe/services/compte/compte.js";
import { ServiceDonnéesNébuleuse } from "@/v2/crabe/services/services.js";
import { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import { TraducsTexte } from "@/v2/types.js";
import { CrabeTest, créerCrabesTest } from "./utils.js";
import type { Oublier } from "@/v2/crabe/types.js";

describe.only("Crabe", function () {
  describe("création", function () {
    let crabe: CrabeTest;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempo());
    });

    after(async () => {
      if (crabe) await crabe.fermer();
      effacer();
    });

    it("démarrage", async () => {
      crabe = new CrabeTest({ options: { dossier }, services: {} });

      await crabe.démarrer();
      expect(Object.values(crabe.services).every((s) => s.estDémarré));
    });

    it("fermeture", async () => {
      await crabe.fermer();
      expect(Object.values(crabe.services).every((s) => !s.estDémarré));
    });
  });

  describe("services additionnels", function () {
    class ServiceTest1 extends ServiceDonnéesNébuleuse<
      "test1",
      { a: number },
      ServicesLibp2pTest
    > {
      constructor({
        nébuleuse,
      }: {
        nébuleuse: Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>;
      }) {
        super({
          clef: "test1",
          nébuleuse,
          options: {
            schéma: {
              type: "object",
              properties: { a: { type: "number", nullable: true } },
            },
          },
        });
      }
    }

    class ServiceTest2 extends ServiceDonnéesNébuleuse<
      "test2",
      { b: number },
      ServicesLibp2pTest
    > {
      constructor({
        nébuleuse,
      }: {
        nébuleuse: Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>;
      }) {
        super({
          clef: "test2",
          nébuleuse,
          options: {
            schéma: {
              type: "object",
              properties: { b: { type: "number", nullable: true } },
            },
          },
        });
      }
    }

    type StructureDonnées = {
      test1: { a: number };
      test2: { b: number };
    };

    let crabe: CrabeTest<StructureDonnées>;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempo());

      crabe = new CrabeTest<StructureDonnées>({
        services: {
          test1: ServiceTest1,
          test2: ServiceTest2,
        },
        options: {
          dossier,
          services: {
            test1: {
              schéma: {
                type: "object",
                properties: { a: { type: "number", nullable: true } },
              },
            },
          },
        },
      });
      await crabe.démarrer();
    });

    after(async () => {
      await crabe.fermer();
      effacer();
    });

    it("accès aux services additionnels", async () => {
      const serviceTest1 = crabe.services.test1;

      expect(serviceTest1).to.exist();
    });

    it("erreur pour mauvaise clef", async () => {
      const bd = await crabe.services.compte.bd();

      // @ts-expect-error  Clef inexistante dans la structure
      await expect(bd.set("n/existe/pas", 1)).to.eventually.be.rejectedWith(
        "Unsupported key n/existe/pas.",
      );

      await expect(
        // @ts-expect-error Service inexistant
        bd.set("service/inexistant", 1),
      ).to.eventually.be.rejectedWith("Unsupported key service/inexistant.");
    });
  });

  describe("changement compte", function () {
    let crabes: CrabeTest[];
    let fermer: Oublier;

    before(async () => {
      ({ crabes, fermer } = await créerCrabesTest({ n: 2, services: {} }));

      await crabes[0].profil.sauvegarderNom({
        nom: "Julien Malard-Adam",
        langue: "fr",
      });
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("mise à jour profil", async () => {
      const promesseNoms = obtenir<TraducsTexte | undefined>(({ si }) =>
        crabes[1].profil.suivreNoms({
          f: si((x) => !!x && Object.keys(x).includes("fr")),
        }),
      );
      const idCompteAntérieur = await crabes[1].compte.obtIdCompte();
      const promesseIdCompte = obtenir(({ si }) =>
        crabes[1].compte.suivreIdCompte({
          f: si((x) => x !== idCompteAntérieur),
        }),
      );
      await crabes[0].compte.ajouterDispositif({
        idDispositif: await crabes[1].compte.obtIdDispositif(),
      });
      await crabes[1].compte.rejoindreCompte({
        idCompte: await crabes[0].compte.obtIdCompte(),
      });
      // À faire : Pour une drôle de raison, il faut modifier la BD avant qu'elle ne s'actualise...
      await crabes[0].profil.effacerNom({ langue: "de" });
      console.log("profil modifié");

      const nouvelId = await promesseIdCompte;
      expect(nouvelId).to.equal(await crabes[0].compte.obtIdCompte());

      const noms = await promesseNoms;
      expect(noms?.fr).to.equal("Julien Malard-Adam");
    });
  });
});
