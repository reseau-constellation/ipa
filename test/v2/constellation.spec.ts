import path from "path";
import { expect } from "aegir/chai";
import { que } from "@constl/utils-tests";
import {
  MEMBRE,
  MODÉRATRICE,
} from "@/v2/crabe/services/compte/accès/consts.js";
import { créerConstellation } from "@/v2/index.js";
import {
  créerConstellationsTest,
  dossierTempoPropre,
  obtenir,
} from "./utils.js";
import type { KeyValueDatabase } from "@orbitdb/core";
import type { Constellation } from "@/v2/constellation.js";
import type { TraducsTexte } from "@/v2/types.js";
import type { Rôle } from "@/v2/crabe/services/compte/accès/types.js";

describe.only("Constellation", function () {
  describe("création", function () {
    let fermer: () => Promise<void>;
    let constls: Constellation[];

    before(async () => {
      ({ fermer, constls } = await créerConstellationsTest({
        n: 2,
      }));
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("démarrage", async () => {
      expect(constls[0].estDémarrée).to.not.be.false();

      expect(Object.values(constls[0].services).every((s) => s.estDémarré));
    });

    it("instances de Constellation test non connectées au relai production", async () => {
      const libp2p = await constls[0].services["libp2p"].libp2p();
      const connexions = libp2p.getConnections();

      expect(
        connexions.filter((c) =>
          c.remoteAddr.getComponents().find((a) => a.name.includes("ip")),
        ),
      ).to.not.be.empty();
      expect(
        connexions.filter((c) =>
          c.remoteAddr.getComponents().find((a) => a.name.includes("dns")),
        ),
      ).to.be.empty();
    });

    it("fermeture", async () => {
      await constls[0].fermer();
      expect(Object.values(constls[0].services).every((s) => !s.estDémarré));
    });
  });

  describe("syncronisation", function () {
    let fermer: () => Promise<void>;

    const constls: Constellation[] = [];

    before(async () => {
      const { dossier, effacer } = await dossierTempoPropre();

      for (const i in [...Array(2).entries()]) {
        const constl = créerConstellation({
          dossier: path.join(dossier, i),
        });
        constls.push(constl);
      }

      fermer = async () => {
        await Promise.allSettled(constls.map((c) => c.fermer()));
        effacer();
      };
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("tests temporaires orbite base pour syncronisation", async () => {
      const { bd, oublier } = await constls[0].orbite.créerBd({
        type: "keyvalue",
      });
      const idObjet = bd.address;

      await bd.put("a", 2);

      const promesseDonnées = obtenir<KeyValueDatabase>(({ si }) =>
        constls[1].orbite.suivreBd({
          id: idObjet,
          type: "keyvalue",
          f: si(async (x) => !!x && (await x.all()).length > 0),
        }),
      );

      // Vérifier la permission
      const données = await promesseDonnées;
      await oublier();
      expect((await données.all()).length).to.be.greaterThan(0);
    });

    it("tests temporaires orbite pour syncronisation", async () => {
      const { bd, oublier } = await constls[0].orbite.créerBd({
        type: "keyvalue",
      });
      const idObjet = bd.address;

      const promessePermission = obtenir<Rôle>(({ siDéfini }) =>
        constls[1].compte.suivrePermission({
          idObjet,
          f: siDéfini(),
        }),
      );

      await constls[0].compte.donnerAccèsObjet({
        idObjet,
        identité: await constls[1].compte.obtIdCompte(),
        rôle: MEMBRE,
      });

      await constls[0].compte.donnerAccèsObjet({
        idObjet,
        identité: await constls[1].compte.obtIdCompte(),
        rôle: MODÉRATRICE,
      });

      // Vérifier la permission
      const permission = await promessePermission;
      expect(permission).to.not.be.undefined();

      // Vérifier que l'édition des données fonctionne
      const { bd: bd2, oublier: oublier2 } = await constls[1].orbite.ouvrirBd({
        id: idObjet,
        type: "keyvalue",
      });
      await bd2.put("a", 2);
      await que(async () => (await bd.all()).length > 0);

      await oublier();
      await oublier2();
    });

    it("tests temporaires pour syncronisation", async () => {
      const idBd = await constls[0].bds.créerBd({ licence: "ODBl-1_0" });

      const promessePermission = obtenir<Rôle>(({ siDéfini }) =>
        constls[1].compte.suivrePermission({
          idObjet: idBd,
          f: siDéfini(),
        }),
      );

      await constls[0].compte.donnerAccèsObjet({
        idObjet: idBd,
        identité: await constls[1].compte.obtIdCompte(),
        rôle: MEMBRE,
      });

      // Vérifier la permission
      const permission = await promessePermission;
      expect(permission).to.equal(MEMBRE);

      // Vérifier que l'édition des données fonctionne
      await constls[1].bds.sauvegarderNom({
        idBd,
        langue: "fr",
        nom: "mon tableau",
      });

      const noms = await obtenir<TraducsTexte | undefined>(({ siPasVide }) =>
        constls[0].bds.suivreNoms({ idBd, f: siPasVide() }),
      );
      expect(noms).to.deep.equal({
        fr: "mon tableau",
      });
    });
  });
});
