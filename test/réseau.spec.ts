import {
  attente as utilsTestAttente,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";
import { expect } from "aegir/chai";

import type {
  schémaFonctionOublier,
  schémaRetourFonctionRechercheParProfondeur,
} from "@/types.js";
import type { infoConfiance, infoMembreRéseau } from "@/reseau.js";
import { type Constellation, créerConstellation } from "@/index.js";

const { créerConstellationsTest } = utilsTestConstellation;

async function toutPréparer(n: number) {
  const { fOublier: fOublierConstls, clients: constls } =
    await créerConstellationsTest({
      n,
      créerConstellation,
    });
  const idsLibp2p = await Promise.all(
    constls.map(async (c) => await c.obtIdLibp2p()),
  );
  const idsDispositifs = await Promise.all(
    constls.map(async (c) => await c.obtIdDispositif()),
  );
  const idsComptes = await Promise.all(
    constls.map(async (c) => await c.obtIdCompte()),
  );

  return {
    constls,
    fOublierConstls,
    idsLibp2p,
    idsDispositifs,
    idsComptes,
  };
}

describe("Réseau", function () {
  describe("Suivre comptes réseau et en ligne", function () {
    let fOublierConstls: () => Promise<void>;
    let idsComptes: string[];
    let moiMême: infoMembreRéseau;
    let constls: Constellation[];

    let fOublier: schémaFonctionOublier;
    let fChangerProfondeur: schémaRetourFonctionRechercheParProfondeur["fChangerProfondeur"];

    const rés = new utilsTestAttente.AttendreRésultat<infoMembreRéseau[]>();

    before(async () => {
      ({ idsComptes, constls, fOublierConstls } = await toutPréparer(3));
      moiMême = {
        idCompte: idsComptes[0],
        profondeur: 0,
        confiance: 1,
      };

      ({ fOublier, fChangerProfondeur } =
        await constls[0].réseau.suivreComptesRéseauEtEnLigne({
          f: (c) => rés.mettreÀJour(c),
          profondeur: 2,
        }));
    });

    after(async () => {
      if (fOublier) await fOublier();
      if (fOublierConstls) await fOublierConstls();
      rés.toutAnnuler();
    });

    it("Comptes en ligne détectés", async () => {
      const réf: infoMembreRéseau[] = [
        moiMême,
        {
          idCompte: idsComptes[1],
          confiance: 0,
          profondeur: Infinity,
        },
        {
          idCompte: idsComptes[2],
          confiance: 0,
          profondeur: Infinity,
        },
      ];

      const val = await rés.attendreQue((x) => !!x && x.length === 3);
      expect(val).to.have.deep.members(réf);
    });

    it("Comptes réseau détectés", async () => {
      const réf: infoMembreRéseau[] = [
        moiMême,
        {
          idCompte: idsComptes[1],
          confiance: 1,
          profondeur: 1,
        },
        {
          idCompte: idsComptes[2],
          confiance: 0,
          profondeur: Infinity,
        },
      ];

      await constls[0].réseau.faireConfianceAuMembre({
        idCompte: idsComptes[1],
      });
      const val = await rés.attendreQue(
        (x) =>
          !!x &&
          x.find((x) => x.idCompte === idsComptes[1])?.confiance === 1 &&
          x.find((x) => x.idCompte === idsComptes[2])?.confiance === 0,
      );

      expect(val).to.have.deep.members(réf);
    });

    it("Changer profondeur", async () => {
      await constls[1].réseau.faireConfianceAuMembre({
        idCompte: idsComptes[2],
      });
      await rés.attendreQue(
        (x) =>
          !!x &&
          (x.find((x) => x.idCompte === idsComptes[2])?.confiance || 0) > 0,
      );

      const réf: infoMembreRéseau[] = [
        moiMême,
        {
          idCompte: idsComptes[1],
          confiance: 1,
          profondeur: 1,
        },
        {
          idCompte: idsComptes[2],
          confiance: 0,
          profondeur: Infinity,
        },
      ];
      fChangerProfondeur(1);
      const val = await rés.attendreQue(
        (x) =>
          !!x && x.find((x) => x.idCompte === idsComptes[2])?.confiance === 0,
      );

      expect(val).to.have.deep.members(réf);
    });
  });
});
