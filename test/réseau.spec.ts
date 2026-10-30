import {
  attente as utilsTestAttente,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";
import { expect } from "aegir/chai";
import { MEMBRE } from "@/v2/nébuleuse/services/compte/accès/consts.js";

import type {
  schémaFonctionOublier,
  schémaRetourFonctionRechercheParProfondeur,
} from "@/types.js";
import type {
  infoConfiance,
  infoMembreRéseau,
  infoRelation,
} from "@/reseau.js";
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

  describe("Suivre relations immédiates", function () {
    describe("Relations indirectes", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let constls: Constellation[];

      let idMotClef1: string;
      let idMotClef2: string;
      let idBd: string;
      let idVariable: string;
      let idProjet: string;

      const relationsPropres = new utilsTestAttente.AttendreRésultat<
        infoConfiance[]
      >();
      const relationsAutres = new utilsTestAttente.AttendreRésultat<
        infoConfiance[]
      >();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(2));
        fsOublier.push(
          await constls[0].réseau.suivreRelationsImmédiates({
            f: (c) => relationsPropres.mettreÀJour(c),
          }),
        );
        fsOublier.push(
          await constls[1].réseau.suivreRelationsImmédiates({
            f: (c) => relationsAutres.mettreÀJour(c),
            idCompte: idsComptes[0],
          }),
        );
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();

        relationsPropres.toutAnnuler();
        relationsAutres.toutAnnuler();
      });

      it("Ajout aux favoris détecté", async () => {
        idMotClef2 = await constls[1].motsClefs.créerMotClef();
        await constls[0].motsClefs.épinglerMotClef({
          idMotClef: idMotClef2,
        });

        const val = await relationsPropres.attendreQue(
          (x) => !!x && x.length > 0,
        );
        expect(val.map((r) => r.idCompte)).to.contain(idsComptes[1]);
      });

      it("Ajout aux favoris d'un tiers détecté", async () => {
        const val = await relationsAutres.attendreQue(
          (x) => !!x && Boolean(x.length),
        );
        expect(val.map((r) => r.idCompte)).to.contain(idsComptes[1]);
      });

      it("Enlever favori détecté", async () => {
        await constls[0].favoris.désépinglerFavori({
          idObjet: idMotClef2,
        });
        const valPropres = await relationsPropres.attendreQue(
          (x) => x && x.length === 0,
        );
        expect(valPropres.length).to.equal(0);

        const valAutres = await relationsAutres.attendreQue(
          (x?: infoConfiance[]) => !!x && !x.length,
        );
        expect(valAutres.length).to.equal(0);
      });

      it("Ajout coauteur variable détecté", async () => {
        idVariable = await constls[0].variables.créerVariable({
          catégorie: "numérique",
        });
        await constls[0].variables.inviterAuteur({
          idVariable,
          idCompteAuteur: idsComptes[1],
          rôle: MEMBRE,
        });

        const val = await relationsPropres.attendreQue(
          (x) => !!x && Boolean(x.length),
        );

        expect(val.map((r) => r.idCompte)).to.contain(idsComptes[1]);
      });

      it("Ajout coauteur variable d'un tiers détecté", async () => {
        const val = await relationsAutres.attendreQue((x) => x.length > 0);
        expect(val.map((r) => r.idCompte)).to.contain(idsComptes[1]);
      });

      it("Enlever variable détecté", async () => {
        await constls[0].variables.effacerVariable({ idVariable });
        const valPropres = await relationsPropres.attendreQue(
          (x) => x.length < 1,
        );
        expect(valPropres.length).to.equal(0);

        const val = await relationsAutres.attendreQue((x) => !x.length);
        expect(val.length).to.equal(0);
      });

      it("Ajout coauteur BD détecté", async () => {
        idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });
        await constls[0].bds.inviterAuteur({
          idBd,
          idCompteAuteur: idsComptes[1],
          rôle: MEMBRE,
        });

        const val = await relationsPropres.attendreQue(
          (x) => !!x && Boolean(x.length),
        );

        expect(val.map((r) => r.idCompte)).to.contain(idsComptes[1]);
      });

      it("Ajout coauteur BD d'un tiers détecté", async () => {
        const val = await relationsAutres.attendreQue(
          (x) => !!x && Boolean(x.length),
        );
        expect(val.map((r) => r.idCompte)).to.contain(idsComptes[1]);
      });

      it("Enlever bd détecté", async () => {
        await constls[0].bds.effacerBd({ idBd });
        const valPropres = await relationsPropres.attendreQue(
          (x) => x.length < 1,
        );
        expect(valPropres.length).to.equal(0);

        const val = await relationsAutres.attendreQue((x) => !x.length);
        expect(val.length).to.equal(0);
      });

      it("Ajout coauteur projet détecté", async () => {
        idProjet = await constls[0].projets.créerProjet();
        await constls[0].projets.inviterAuteur({
          idProjet,
          idCompteAuteur: idsComptes[1],
          rôle: MEMBRE,
        });

        const val = await relationsPropres.attendreQue(
          (x) => !!x && Boolean(x.length),
        );
        expect(val.map((r) => r.idCompte)).to.contain(idsComptes[1]);
      });

      it("Ajout coauteur projet d'un tiers détecté", async () => {
        const val = await relationsAutres.attendreQue(
          (x) => !!x && Boolean(x.length),
        );
        expect(val.map((r) => r.idCompte)).to.contain(idsComptes[1]);
      });

      it("Enlever projet détecté", async () => {
        await constls[0].projets.effacerProjet({ idProjet });
        const valPropres = await relationsPropres.attendreQue((x) => !x.length);
        expect(valPropres.length).to.equal(0);

        const val = await relationsAutres.attendreQue((x) => !x.length);
        expect(val.length).to.equal(0);
      });

      it("Ajout coauteur mot-clef détecté", async () => {
        idMotClef1 = await constls[0].motsClefs.créerMotClef();
        await constls[0].motsClefs.inviterAuteur({
          idMotClef: idMotClef1,
          idCompteAuteur: idsComptes[1],
          rôle: MEMBRE,
        });

        const val = await relationsPropres.attendreQue(
          (x) => !!x && Boolean(x.length),
        );
        expect(val.map((r) => r.idCompte)).to.contain(idsComptes[1]);
      });

      it("Ajout coauteur mot-clef d'un tiers détecté", async () => {
        const val = await relationsAutres.attendreQue(
          (x) => !!x && Boolean(x.length),
        );
        expect(val.map((r) => r.idCompte)).to.contain(idsComptes[1]);
      });

      it("Enlever mot-clef détecté", async () => {
        await constls[0].motsClefs.effacerMotClef({
          idMotClef: idMotClef1,
        });
        const valPropres = await relationsPropres.attendreQue((x) => !x.length);
        expect(valPropres.length).to.equal(0);

        await relationsAutres.attendreQue(
          (x?: infoConfiance[]) => !!x && !x.length,
        );
        const valAutres = await relationsPropres.attendreExiste();
        expect(valAutres.length).to.equal(0);
      });
    });
  });

  describe("Suivre relations confiance", function () {
    let fOublierConstls: () => Promise<void>;
    let idsComptes: string[];
    let constls: Constellation[];

    let fOublier: schémaFonctionOublier;
    let fChangerProfondeur: schémaRetourFonctionRechercheParProfondeur["fChangerProfondeur"];
    const rés = new utilsTestAttente.AttendreRésultat<infoRelation[]>();

    before(async () => {
      ({ idsComptes, constls, fOublierConstls } = await toutPréparer(3));
      ({ fOublier, fChangerProfondeur } =
        await constls[0].réseau.suivreRelationsConfiance({
          f: (r) => rés.mettreÀJour(r),
          profondeur: 2,
        }));
    });

    after(async () => {
      if (fOublier) await fOublier();
      if (fOublierConstls) await fOublierConstls();

      rés.toutAnnuler();
    });

    it("Relations immédiates", async () => {
      const réf: infoRelation[] = [
        {
          de: idsComptes[0],
          pour: idsComptes[1],
          confiance: 1,
          profondeur: 1,
        },
      ];
      await constls[0].réseau.faireConfianceAuMembre({
        idCompte: idsComptes[1],
      });

      const val = await rés.attendreQue((x) => !!x && !!x.length);
      expect(val).to.deep.equal(réf);
    });
    it("Relations indirectes", async () => {
      const réf: infoRelation[] = [
        {
          de: idsComptes[0],
          pour: idsComptes[1],
          confiance: 1,
          profondeur: 1,
        },
        {
          de: idsComptes[1],
          pour: idsComptes[2],
          confiance: 1,
          profondeur: 2,
        },
      ];
      await constls[1].réseau.faireConfianceAuMembre({
        idCompte: idsComptes[2],
      });

      const val = await rés.attendreQue((x) => !!x && x.length > 1);
      expect(val).to.deep.equal(réf);
    });

    it("Diminuer profondeur", async () => {
      const réf: infoRelation[] = [
        {
          de: idsComptes[0],
          pour: idsComptes[1],
          confiance: 1,
          profondeur: 1,
        },
      ];
      fChangerProfondeur(1);
      const val = await rés.attendreQue((x) => !!x && x.length === 1);
      expect(val).to.deep.equal(réf);
    });

    it("Augmenter profondeur", async () => {
      const réf: infoRelation[] = [
        {
          de: idsComptes[0],
          pour: idsComptes[1],
          confiance: 1,
          profondeur: 1,
        },
        {
          de: idsComptes[1],
          pour: idsComptes[2],
          confiance: 1,
          profondeur: 2,
        },
      ];

      fChangerProfondeur(2);

      const val = await rés.attendreQue((x) => !!x && x.length === 2);
      expect(val).to.deep.equal(réf);
    });
  });

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
