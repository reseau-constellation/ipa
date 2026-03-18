import { expect } from "aegir/chai";
import { CID } from "multiformats";
import { que } from "@constl/utils-tests";
import { diviserIdcEtFichier, idcEtFichierValide } from "@/v2/utils.js";
import { obtRessourceTest } from "../../ressources/index.js";
import { créerNébuleusesTest } from "../utils.js";
import type { NébuleuseTest } from "../utils.js";

describe.only("Épingles", function () {
  describe("vérification idc", function () {
    const idc = "bafkreie7ohywtosou76tasm7j63yigtzxe7d5zqus4zu3j6oltvgtibeom";
    it("idc et fichier", async () => {
      const validé = idcEtFichierValide(`${idc}/mon fichier.txt`);
      expect(validé).to.deep.equal({
        idc,
        fichier: "mon fichier.txt",
      });
    });

    it("idc sans fichier", async () => {
      const validé = idcEtFichierValide(idc);
      expect(validé).to.be.false();
    });

    it("idc avec fichier imbriqué", async () => {
      const validé = idcEtFichierValide(`${idc}/mon/fichier.txt`);
      expect(validé).to.deep.equal({
        idc,
        fichier: "mon/fichier.txt",
      });
    });
  });

  describe("épingler et désépingler", function () {
    let fermer: () => Promise<void>;
    let nébuleuses: NébuleuseTest[];
    let nébuleuse: NébuleuseTest;

    let idBd: string;
    let idc: string;

    before(async () => {
      ({ fermer, nébuleuses } = await créerNébuleusesTest({
        n: 1,
      }));
      nébuleuse = nébuleuses[0];

      const fichier: Uint8Array = await obtRessourceTest({
        nomFichier: "logo.png",
      });
      idc = await nébuleuse.services.hélia.ajouterFichierÀSFIP({
        contenu: fichier,
        nomFichier: "logo.svg",
      });

      const { bd, oublier } = await nébuleuse.orbite.créerBd({
        type: "keyvalue",
      });
      idBd = bd.address;
      await bd.put("a", 1);
      await oublier();
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("épingler hélia", async () => {
      await nébuleuse.services["épingles"].épingler({
        idRequête: "a",
        épingles: new Set([idc]),
      });

      await que(
        async () =>
          await nébuleuse.services["épingles"].estÉpinglé({ id: idc }),
      );

      const hélia = await nébuleuse.services.hélia.hélia();
      const épingléSurHélia = await hélia.pins.isPinned(
        CID.parse(diviserIdcEtFichier(idc).idc),
      );

      expect(épingléSurHélia).to.be.true();
    });

    it("désépingler hélia", async () => {
      await nébuleuse.services["épingles"].désépingler({ idRequête: "a" });

      await que(
        async () =>
          !(await nébuleuse.services["épingles"].estÉpinglé({ id: idc })),
      );

      const hélia = await nébuleuse.services.hélia.hélia();
      const épingléSurHélia = await hélia.pins.isPinned(
        CID.parse(diviserIdcEtFichier(idc).idc),
      );

      expect(épingléSurHélia).to.be.false();
    });

    it("épingler orbite", async () => {
      await nébuleuse.services["épingles"].épingler({
        idRequête: "a",
        épingles: new Set([idBd]),
      });

      await que(
        async () =>
          await nébuleuse.services["épingles"].estÉpinglé({ id: idBd }),
      );
    });

    it("désépingler orbite", async () => {
      await nébuleuse.services["épingles"].désépingler({ idRequête: "a" });

      await que(
        async () =>
          (await nébuleuse.services["épingles"].estÉpinglé({ id: idBd })) ===
          false,
      );
    });
  });

  describe("cycle de vie", function () {
    let fermer: () => Promise<void>;
    let nébuleuses: NébuleuseTest[];
    let nébuleuse: NébuleuseTest;

    beforeEach(async () => {
      ({ fermer, nébuleuses } = await créerNébuleusesTest({
        n: 1,
      }));
      nébuleuse = nébuleuses[0];
    });

    afterEach(async () => {
      if (fermer) await fermer();
    });

    it("bds fermées après fermeture", async () => {
      let fermée = false;
      const lorsqueFermée = () => (fermée = true);

      const { bd, oublier } = await nébuleuse.orbite.créerBd({
        type: "keyvalue",
      });
      bd.events.on("close", lorsqueFermée);

      await bd.put("a", 1);

      await nébuleuse.services["épingles"].épingler({
        idRequête: "a",
        épingles: new Set([bd.address]),
      });
      await que(
        async () =>
          await nébuleuse.services["épingles"].estÉpinglé({ id: bd.address }),
      );

      await oublier();
      expect(fermée).to.be.false();

      await nébuleuse.services["épingles"].fermer();

      bd.events.off("close", lorsqueFermée);
      expect(fermée).to.be.true();
    });

    it("pas d'erreur si bd non disponible", async () => {
      const idBdInexistante =
        "/constl/bd/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX";

      await nébuleuse.services["épingles"].épingler({
        idRequête: "a",
        épingles: new Set([idBdInexistante]),
      });
    });

    it("pas d'erreur si idc hélia non disponible", async () => {
      const idcInexistant =
        "bafkreie7ohywtosou76tasm7j63yigtzxe7d5zqus4zu3j6oltvgtibeom";

      await nébuleuse.services["épingles"].épingler({
        idRequête: "a",
        épingles: new Set([idcInexistant]),
      });
    });
  });
});
