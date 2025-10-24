import { uneFois } from "@constl/utils-ipa";
import {
  attente as utilsTestAttente,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";
import { isElectronMain, isNode } from "wherearewe";
import { expect } from "aegir/chai";
import { TypedEmitter } from "tiny-typed-emitter";
import { peerIdFromString } from "@libp2p/peer-id";
import { MEMBRE, MODÉRATEUR } from "@/v2/crabe/services/compte/accès/consts.js";
import {
  infoAuteur,
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaRetourFonctionRechercheParProfondeur,
} from "@/types.js";

import { type Constellation, créerConstellation } from "@/index.js";
import { INSTALLÉ, TOUS, type ÉpingleFavorisAvecId } from "@/favoris.js";
import { obtRessourceTest } from "./ressources/index.js";
import type { infoTableauAvecId, schémaSpécificationBd } from "@/bds.js";
import type {
  infoBloqué,
  infoConfiance,
  infoMembre,
  infoMembreRéseau,
  infoRelation,
  infoRéplications,
  statutDispositif,
  statutMembre,
  élémentDeMembre,
} from "@/reseau.js";
import type { élémentBdListeDonnées } from "@/tableaux.js";

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

if (isNode || isElectronMain) {
  describe("Réseau", function () {
    describe("Suivre en ligne", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let idsLibp2p: string[];
      let idsDispositifs: string[];
      let constls: Constellation[];

      const rés = new utilsTestAttente.AttendreRésultat<
        { pair: string; adresses: string[] }[]
      >();
      const dispositifs = new utilsTestAttente.AttendreRésultat<
        statutDispositif[]
      >();
      const membresEnLigne = new utilsTestAttente.AttendreRésultat<
        statutMembre[]
      >();
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsComptes, idsLibp2p, idsDispositifs, constls, fOublierConstls } =
          await toutPréparer(3));

        fsOublier.push(
          await constls[0].réseau.suivreConnexionsPostesSFIP({
            f: (c) => rés.mettreÀJour(c),
          }),
        );
        fsOublier.push(
          await constls[0].réseau.suivreConnexionsDispositifs({
            f: (d) => dispositifs.mettreÀJour(d),
          }),
        );
        fsOublier.push(
          await constls[0].réseau.suivreConnexionsMembres({
            f: (c) => membresEnLigne.mettreÀJour(c),
          }),
        );
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();
        rés.toutAnnuler();
        dispositifs.toutAnnuler();
        membresEnLigne.toutAnnuler();
      });

      it("Autres postes détectés", async () => {
        const val = await rés.attendreQue((x) =>
          idsLibp2p.slice(1).every((id) => x.find((p) => p.pair === id)),
        );
        expect(val.map((p) => p.pair)).to.have.members([
          idsLibp2p[1],
          idsLibp2p[2],
        ]);
        expect(val.map((p) => p.adresses.length)).to.have.members([1, 1]);
      });

      it("Autres dispositifs détectés", async () => {
        const val = await dispositifs.attendreQue(
          (x?: statutDispositif[]) => !!x && x.length >= 3,
        );
        expect(val.map((d) => d.infoDispositif.idDispositif)).to.have.members(
          idsDispositifs,
        );
      });

      it("Autres membres détectés", async () => {
        const réfRés: infoMembre[] = [];
        for (let i = 0; i <= constls.length - 1; i++) {
          const identitéOrbite = await constls[i].obtIdentitéOrbite();
          réfRés.push({
            idCompte: idsComptes[i],
            protocoles: [],
            dispositifs: [
              {
                idLibp2p: idsLibp2p[i],
                idDispositif: idsDispositifs[i],
                idCompte: idsComptes[i],
                clefPublique: identitéOrbite.publicKey,
                signatures: identitéOrbite.signatures,
                nChangementsCompte: 0,
              },
            ],
          });
        }
        const val = await membresEnLigne.attendreQue((x) => x.length >= 3);
        expect(val.map((r) => r.infoMembre)).to.have.deep.members(réfRés);
      });
    });

    describe("Membres fiables", function () {
      const fiablesPropres = new utilsTestAttente.AttendreRésultat<string[]>();
      const fiablesAutres = new utilsTestAttente.AttendreRésultat<string[]>();

      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];

      let constls: Constellation[];

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(2));
        fsOublier.push(
          await constls[0].réseau.suivreFiables({
            f: (m) => fiablesPropres.mettreÀJour(m),
          }),
        );
        fsOublier.push(
          await constls[1].réseau.suivreFiables({
            f: (m) => fiablesAutres.mettreÀJour(m),
            idCompte: idsComptes[0],
          }),
        );
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();
        fiablesPropres.toutAnnuler();
        fiablesAutres.toutAnnuler();
      });

      it("Personne pour commencer", async () => {
        const val = await fiablesPropres.attendreExiste();
        expect(val.length).to.equal(0);
      });

      it("Faire confiance", async () => {
        await constls[0].réseau.faireConfianceAuMembre({
          idCompte: idsComptes[1],
        });
        const val = await fiablesPropres.attendreQue(
          (x) => !!x && x.length > 0,
        );
        expect(val.length).to.equal(1);
        expect(val).to.have.members([idsComptes[1]]);
      });

      it("Détecter confiance d'autre membre", async () => {
        const val = await fiablesAutres.attendreQue((x) => !!x && x.length > 0);
        expect(val.length).to.equal(1);
        expect(val).to.have.members([idsComptes[1]]);
      });

      it("Un débloquage accidental ne fait rien", async () => {
        await constls[0].réseau.débloquerMembre({
          idCompte: idsComptes[1],
        });
        const val = await fiablesPropres.attendreExiste();
        expect(Array.isArray(val)).to.be.true();
        expect(val.length).to.equal(1);
        expect(val).to.have.members([idsComptes[1]]);
      });

      it("Il n'était pas si chouette que ça après tout", async () => {
        await constls[0].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsComptes[1],
        });
        const val = await fiablesPropres.attendreQue((x) => x.length === 0);
        expect(val).to.be.an.empty("array");
      });
    });

    describe("Membres bloqués", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let constls: Constellation[];

      const bloquésTous = new utilsTestAttente.AttendreRésultat<infoBloqué[]>();
      const bloquésPubliques = new utilsTestAttente.AttendreRésultat<
        string[]
      >();
      const bloquésAutreMembre = new utilsTestAttente.AttendreRésultat<
        infoBloqué[]
      >();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(3));
        fsOublier.push(
          await constls[0].réseau.suivreBloqués({
            f: (m) => bloquésTous.mettreÀJour(m),
          }),
        );
        fsOublier.push(
          await constls[0].réseau.suivreBloquésPubliques({
            f: (m) => bloquésPubliques.mettreÀJour(m),
          }),
        );
        fsOublier.push(
          await constls[1].réseau.suivreBloqués({
            f: (m) => bloquésAutreMembre.mettreÀJour(m),
            idCompte: idsComptes[0],
          }),
        );
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();

        bloquésTous.toutAnnuler();
        bloquésPubliques.toutAnnuler();
        bloquésAutreMembre.toutAnnuler();
      });

      it("Personne pour commencer", async () => {
        await bloquésPubliques.attendreExiste();
        expect(bloquésPubliques.val?.length).to.equal(0);
      });

      it("Bloquer quelqu'un", async () => {
        await constls[0].réseau.bloquerMembre({
          idCompte: idsComptes[1],
        });
        const val = await bloquésTous.attendreQue((x) => !!x && x.length > 0);

        expect(val.length).to.equal(1);
        expect(val).to.have.deep.members([
          {
            idCompte: idsComptes[1],
            privé: false,
          },
        ]);
        expect(bloquésPubliques.val).to.have.members([idsComptes[1]]);
      });

      it("Un dé-confiance accidental ne fait rien", async () => {
        await constls[0].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsComptes[1],
        });

        const bloqués = await bloquésTous.attendreQue(
          (x) => !!x && x.length > 0,
        );

        expect(bloqués).to.have.deep.members([
          {
            idCompte: idsComptes[1],
            privé: false,
          },
        ]);
      });

      it("Bloquer privé", async () => {
        await constls[0].réseau.bloquerMembre({
          idCompte: idsComptes[2],
          privé: true,
        });

        const bloqués = await bloquésTous.attendreQue(
          (x) => !!x && x.length > 1,
        );
        expect(bloqués).to.have.deep.members([
          {
            idCompte: idsComptes[1],
            privé: false,
          },
          {
            idCompte: idsComptes[2],
            privé: true,
          },
        ]);
      });

      it("On détecte bloqué publique d'un autre membre", async () => {
        const val = await bloquésAutreMembre.attendreQue(
          (x) => !!x && x.length > 0,
        );
        expect(val).to.have.deep.members([
          {
            idCompte: idsComptes[1],
            privé: false,
          },
        ]);
      });

      it("On ne détecte pas le bloqué privé d'un autre membre", async () => {
        const val = await bloquésAutreMembre.attendreExiste();
        expect(val.map((b) => b.idCompte)).not.to.contain(idsComptes[2]);
      });

      it("Débloquer publique", async () => {
        await constls[0].réseau.débloquerMembre({
          idCompte: idsComptes[1],
        });
        const val = await bloquésPubliques.attendreQue((x) => x.length === 0);
        expect(val.length).to.equal(0);
      });

      it("Débloquer privé", async () => {
        await constls[0].réseau.débloquerMembre({
          idCompte: idsComptes[2],
        });
        const val = await bloquésTous.attendreQue((x) => x.length === 0);
        expect(val.length).to.equal(0);
      });

      it("Passer de bloqué privé à bloqué publique", async () => {
        await constls[0].réseau.bloquerMembre({
          idCompte: idsComptes[1],
          privé: true,
        });
        let val = await bloquésPubliques.attendreExiste();
        expect(val.length).to.equal(0);
        await constls[0].réseau.bloquerMembre({
          idCompte: idsComptes[1],
          privé: false,
        });
        val = await bloquésPubliques.attendreQue((x) => x.length > 0);
        expect(val.length).to.equal(1);
        expect(bloquésTous.val?.[0].privé).to.be.false();
      });
    });

    describe("Suivre relations immédiates", function () {
      describe("Relations explicites", function () {
        let fOublierConstls: () => Promise<void>;
        let idsComptes: string[];
        let constls: Constellation[];

        const relationsPropres = new utilsTestAttente.AttendreRésultat<
          infoConfiance[]
        >();
        const relationsAutres = new utilsTestAttente.AttendreRésultat<
          infoConfiance[]
        >();

        const fsOublier: schémaFonctionOublier[] = [];

        before(async () => {
          ({ idsComptes, constls, fOublierConstls } = await toutPréparer(3));
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

        it("Personne pour commencer", async () => {
          const propres = await relationsPropres.attendreExiste();
          const autres = await relationsAutres.attendreExiste();

          expect(propres).to.be.an.empty("array");
          expect(autres).to.be.an.empty("array");
        });

        it("Ajout membre de confiance détecté", async () => {
          const réf: infoConfiance[] = [
            {
              idCompte: idsComptes[1],
              confiance: 1,
            },
          ];
          await constls[0].réseau.faireConfianceAuMembre({
            idCompte: idsComptes[1],
          });
          const val = await relationsPropres.attendreQue(
            (x) => !!x && !!x.length,
          );

          expect(val).to.have.deep.members(réf);
        });

        it("Bloquer membre détecté", async () => {
          const réf: infoConfiance[] = [
            {
              idCompte: idsComptes[1],
              confiance: 1,
            },
            {
              idCompte: idsComptes[2],
              confiance: -1,
            },
          ];

          await constls[0].réseau.bloquerMembre({
            idCompte: idsComptes[2],
          });
          const val = await relationsPropres.attendreQue(
            (x) => !!x && x.length === 2,
          );
          expect(val).to.have.deep.members(réf);
        });

        it("Débloquer membre détecté", async () => {
          const réf: infoConfiance[] = [
            {
              idCompte: idsComptes[1],
              confiance: 1,
            },
          ];
          await constls[0].réseau.débloquerMembre({
            idCompte: idsComptes[2],
          });
          const val = await relationsPropres.attendreQue(
            (x) =>
              x.find((r) => r.idCompte === idsComptes[1])?.confiance !== -1,
          );
          expect(val.find((r) => r.idCompte === idsComptes[1])).to.deep.equal(
            réf[0],
          );
        });

        it("Ajout membres au réseau d'un autre membre détecté", async () => {
          const réf: infoConfiance[] = [
            {
              idCompte: idsComptes[1],
              confiance: 1,
            },
          ];
          const val = await relationsAutres.attendreQue(
            (x?: infoConfiance[]) =>
              !!x && x.length > 0 && x.every((x) => x.confiance > 0),
          );

          expect(val).to.have.deep.members(réf);
        });

        it("Enlever membre de confiance détecté", async () => {
          await constls[0].réseau.nePlusFaireConfianceAuMembre({
            idCompte: idsComptes[1],
          });
          const val = await relationsPropres.attendreQue(
            (x) => !!x && x.length == 0,
          );
          expect(val.length).to.equal(0);
        });
      });

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
          const valPropres = await relationsPropres.attendreQue(
            (x) => !x.length,
          );
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
          const valPropres = await relationsPropres.attendreQue(
            (x) => !x.length,
          );
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

    describe("Suivre comptes réseau", function () {
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
          await constls[0].réseau.suivreComptesRéseau({
            f: (c) => rés.mettreÀJour(c),
            profondeur: 2,
          }));
      });

      after(async () => {
        if (fOublier) await fOublier();
        if (fOublierConstls) await fOublierConstls();
        rés.toutAnnuler();
      });

      it("Relations confiance immédiates", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsComptes[1],
            confiance: 1,
            profondeur: 1,
          },
        ];
        await constls[0].réseau.faireConfianceAuMembre({
          idCompte: idsComptes[1],
        });

        const val = await rés.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Relations confiance indirectes", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsComptes[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsComptes[2],
            confiance: 0.8,
            profondeur: 2,
          },
        ];
        await constls[1].réseau.faireConfianceAuMembre({
          idCompte: idsComptes[2],
        });

        await rés.attendreQue((x) => !!x && x.length > 2);
        expect(rés.val).to.have.deep.members(réf);
      });
      it("Relations confiance directes et indirectes", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsComptes[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsComptes[2],
            confiance: 1,
            profondeur: 1,
          },
        ];
        await constls[0].réseau.faireConfianceAuMembre({
          idCompte: idsComptes[2],
        });

        const val = await rés.attendreQue(
          (x) =>
            x.length > 2 &&
            x.map((y) => y.confiance).reduce((i, j) => i * j, 1) === 1,
        );
        expect(val).to.have.deep.members(réf);
      });
      it("Enlever relation confiance directe (en double)", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsComptes[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsComptes[2],
            confiance: 0.8,
            profondeur: 2,
          },
        ];
        await constls[0].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsComptes[2],
        });

        const val = await rés.attendreQue(
          (x) =>
            x.length > 2 &&
            x.map((y) => y.confiance).reduce((i, j) => i * j, 1) < 1,
        );
        expect(val).to.have.deep.members(réf);
      });
      it("Enlever relation confiance indirecte", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsComptes[1],
            confiance: 1,
            profondeur: 1,
          },
        ];
        await constls[1].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsComptes[2],
        });

        const val = await rés.attendreQue((x) => x.length === 2);
        expect(val).to.have.deep.members(réf);
      });
      it("Enlever relation confiance directe", async () => {
        const réf = [moiMême];

        await constls[0].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsComptes[1],
        });

        const val = await rés.attendreQue((x) => !!x && x.length === 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Membre bloqué directement", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsComptes[1],
            confiance: -1,
            profondeur: 1,
          },
        ];
        await constls[0].réseau.bloquerMembre({
          idCompte: idsComptes[1],
        });

        const val = await rés.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Membre débloqué directement", async () => {
        const réf = [moiMême];

        await constls[0].réseau.débloquerMembre({
          idCompte: idsComptes[1],
        });

        const val = await rés.attendreQue((x) => !!x && x.length === 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Membre bloqué indirectement", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsComptes[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsComptes[2],
            confiance: -0.9,
            profondeur: 2,
          },
        ];
        await constls[0].réseau.faireConfianceAuMembre({
          idCompte: idsComptes[1],
        });
        await constls[1].réseau.bloquerMembre({
          idCompte: idsComptes[2],
        });

        const val = await rés.attendreQue((x) => !!x && x.length === 3);
        expect(val).to.have.deep.members(réf);
      });
      it("Précédence confiance propre", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsComptes[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsComptes[2],
            confiance: 1,
            profondeur: 1,
          },
        ];
        await constls[0].réseau.faireConfianceAuMembre({
          idCompte: idsComptes[2],
        });

        const val = await rés.attendreQue(
          (x) =>
            !!x && x.find((y) => y.idCompte === idsComptes[2])?.confiance === 1,
        );
        expect(val).to.have.deep.members(réf);

        await constls[0].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsComptes[2],
        });
        await constls[0].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsComptes[1],
        });
        await constls[1].réseau.débloquerMembre({
          idCompte: idsComptes[2],
        });
      });
      it("Diminuer profondeur", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsComptes[1],
            confiance: 1,
            profondeur: 1,
          },
        ];
        await constls[0].réseau.faireConfianceAuMembre({
          idCompte: idsComptes[1],
        });
        await constls[1].réseau.faireConfianceAuMembre({
          idCompte: idsComptes[2],
        });
        rés.attendreQue(
          (x) => !!x && x.length === 3 && x.every((r) => r.confiance > 0),
        );

        await fChangerProfondeur(1);
        const val = await rés.attendreQue((x) => !!x && x.length === 2);
        expect(val).to.have.deep.members(réf);
      });
      it("Augmenter profondeur", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsComptes[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsComptes[2],
            confiance: 0.8,
            profondeur: 2,
          },
        ];
        await fChangerProfondeur(2);

        const val = await rés.attendreQue(
          (x) => !!x && x.length === 3 && x.every((y) => y.confiance > 0),
        );
        expect(val).to.have.deep.members(réf);
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

    describe("Suivre confiance mon réseau pour membre", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let constls: Constellation[];

      let fOublier: schémaFonctionOublier;
      let fChangerProfondeur: schémaRetourFonctionRechercheParProfondeur["fChangerProfondeur"];

      const rés = new utilsTestAttente.AttendreRésultat<number>();

      before(async () => {
        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(3));
        ({ fOublier, fChangerProfondeur } =
          await constls[0].réseau.suivreConfianceMonRéseauPourMembre({
            idCompte: idsComptes[2],
            f: (confiance) => rés.mettreÀJour(confiance),
            profondeur: 4,
          }));
      });

      after(async () => {
        rés.toutAnnuler();

        if (fOublier) await fOublier();
        if (fOublierConstls) await fOublierConstls();
      });

      it("Confiance initiale 0", async () => {
        rés.attendreQue((x) => x === 0);
      });

      it("Faire confiance au membre", async () => {
        await constls[0].réseau.faireConfianceAuMembre({
          idCompte: idsComptes[1],
        });
        await constls[1].réseau.faireConfianceAuMembre({
          idCompte: idsComptes[2],
        });

        const val = await rés.attendreQue((x) => !!x && x > 0);
        expect(val).to.equal(0.8);
      });

      it("Changer profondeur", async () => {
        fChangerProfondeur(1);
        rés.attendreQue((x) => x === 0);
      });
    });

    describe("Suivre confiance auteurs", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let constls: Constellation[];

      let fOublier: schémaFonctionOublier;
      let idMotClef: string;

      const rés = new utilsTestAttente.AttendreRésultat<number>();

      before(async () => {
        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(3));
        idMotClef = await constls[1].motsClefs.créerMotClef();

        fOublier = await constls[0].réseau.suivreConfianceAuteurs({
          idItem: idMotClef,
          clef: "motsClefs",
          f: (confiance) => rés.mettreÀJour(confiance),
        });
      });

      after(async () => {
        if (fOublier) await fOublier();
        if (fOublierConstls) await fOublierConstls();
        rés.toutAnnuler();
      });

      it("Confiance 0 pour commencer", async () => {
        rés.attendreQue((x) => x === 0);
      });

      it("Ajout auteur au réseau", async () => {
        await constls[0].réseau.faireConfianceAuMembre({
          idCompte: idsComptes[1],
        });

        const val = await rés.attendreQue((x) => !!x && x > 0);
        expect(val).to.equal(1);
      });

      it("Ajout coauteur au réseau", async () => {
        await constls[1].motsClefs.inviterAuteur({
          idMotClef,
          idCompteAuteur: idsComptes[2],
          rôle: MEMBRE,
        });
        await constls[2].motsClefs.ajouterÀMesMotsClefs({ idMotClef });
        const valAvant = await rés.attendreQue((x) => !!x && x > 1);

        expect(valAvant).to.be.greaterThan(1);
        expect(valAvant).to.be.lessThan(2);

        await constls[0].réseau.faireConfianceAuMembre({
          idCompte: idsComptes[2],
        });
        const val = await rés.attendreQue((x) => !!x && x === 2);

        expect(val).to.equal(2);
      });

      it("Coauteur se retire", async () => {
        await constls[2].motsClefs.enleverDeMesMotsClefs({ idMotClef });
        const val = await rés.attendreQue((x) => !!x && x < 2);

        expect(val).to.equal(1);
      });
    });

    describe("Auteurs", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let constls: Constellation[];

      let idMotClef: string;
      let idVariable: string;
      let idBd: string;
      let idProjet: string;
      let idNuée: string;

      const résMotClef = new utilsTestAttente.AttendreRésultat<infoAuteur[]>();
      const résVariable = new utilsTestAttente.AttendreRésultat<infoAuteur[]>();
      const résBds = new utilsTestAttente.AttendreRésultat<infoAuteur[]>();
      const résProjet = new utilsTestAttente.AttendreRésultat<infoAuteur[]>();
      const résNuée = new utilsTestAttente.AttendreRésultat<infoAuteur[]>();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(2));

        idMotClef = await constls[0].motsClefs.créerMotClef();
        fsOublier.push(
          await constls[0].réseau.suivreAuteursMotClef({
            idMotClef,
            f: (auteurs) => résMotClef.mettreÀJour(auteurs),
          }),
        );

        idVariable = await constls[0].variables.créerVariable({
          catégorie: "numérique",
        });
        fsOublier.push(
          await constls[0].réseau.suivreAuteursVariable({
            idVariable,
            f: (auteurs) => résVariable.mettreÀJour(auteurs),
          }),
        );

        idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });
        fsOublier.push(
          await constls[0].réseau.suivreAuteursBd({
            idBd,
            f: (auteurs) => résBds.mettreÀJour(auteurs),
          }),
        );

        idProjet = await constls[0].projets.créerProjet();
        fsOublier.push(
          await constls[0].réseau.suivreAuteursProjet({
            idProjet,
            f: (auteurs) => résProjet.mettreÀJour(auteurs),
          }),
        );

        idNuée = await constls[0].nuées.créerNuée();
        fsOublier.push(
          await constls[0].réseau.suivreAuteursNuée({
            idNuée,
            f: (auteurs) => résNuée.mettreÀJour(auteurs),
          }),
        );
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();
        résMotClef.toutAnnuler();
        résVariable.toutAnnuler();
        résBds.toutAnnuler();
        résProjet.toutAnnuler();
      });

      it("Mots-clefs : Inviter auteur", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];
        await constls[0].motsClefs.inviterAuteur({
          idMotClef,
          idCompteAuteur: idsComptes[1],
          rôle: MEMBRE,
        });

        const val = await résMotClef.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.deep.equal(réf);
      });
      it("Mots-clefs : Accepter invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: true,
            rôle: MEMBRE,
          },
        ];

        await constls[1].motsClefs.ajouterÀMesMotsClefs({ idMotClef });
        const val = await résMotClef.attendreQue((x) =>
          Boolean(!!x && x.find((y) => y.idCompte === idsComptes[1])?.accepté),
        );

        expect(val).to.deep.equal(réf);
      });
      it("Mots-clefs : Modification par le nouvel auteur", async () => {
        await uneFois(
          (fSuivi) =>
            constls[1].suivrePermission({ idObjet: idMotClef, f: fSuivi }),
          (x) => !!x,
        );

        await constls[1].motsClefs.sauvegarderNomMotClef({
          idMotClef,
          langue: "fr",
          nom: "Hydrologie",
        });
        await constls[1].motsClefs.sauvegarderDescriptionMotClef({
          idMotClef,
          langue: "fr",
          description: "Pour les données en hydrologie",
        });
      });
      it("Mots-clefs : Refuser invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];

        await constls[1].motsClefs.enleverDeMesMotsClefs({ idMotClef });
        const val = await résMotClef.attendreQue(
          (x) => !!x && !x.find((y) => y.idCompte === idsComptes[1])?.accepté,
        );

        expect(val).to.deep.equal(réf);
      });
      it("Mots-clefs : Promotion à modérateur", async () => {
        await constls[0].motsClefs.inviterAuteur({
          idMotClef,
          idCompteAuteur: idsComptes[1],
          rôle: MODÉRATEUR,
        });

        await résMotClef.attendreQue(
          (auteurs) =>
            !!auteurs &&
            auteurs.find((a) => a.idCompte === idsComptes[1])?.rôle ===
              MODÉRATEUR,
        );
      });

      it("Variables : Inviter auteur", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];
        await constls[0].variables.inviterAuteur({
          idVariable,
          idCompteAuteur: idsComptes[1],
          rôle: MEMBRE,
        });

        const val = await résVariable.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Variables : Modification par le nouvel auteur", async () => {
        await uneFois(
          (fSuivi) =>
            constls[1].suivrePermission({ idObjet: idVariable, f: fSuivi }),
          (x) => !!x,
        );

        await constls[1].variables.sauvegarderNomVariable({
          idVariable,
          langue: "fr",
          nom: "Température",
        });
        await constls[1].variables.sauvegarderDescriptionVariable({
          idVariable,
          langue: "fr",
          description: "La température moyenne journalière",
        });
        await constls[1].variables.ajouterRègleVariable({
          idVariable,
          règle: {
            typeRègle: "existe",
            détails: {},
          },
        });
      });
      it("Variables : Accepter invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: true,
            rôle: MEMBRE,
          },
        ];

        await constls[1].variables.ajouterÀMesVariables({
          idVariable,
        });
        const val = await résVariable.attendreQue(
          (x) => !!x?.find((y) => y.idCompte === idsComptes[1])?.accepté,
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Variables : Refuser invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];

        await constls[1].variables.enleverDeMesVariables({
          idVariable,
        });
        const val = await résVariable.attendreQue(
          (x) => !!x && !x.find((y) => y.idCompte === idsComptes[1])?.accepté,
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Variables : Promotion à modérateur", async () => {
        await constls[0].variables.inviterAuteur({
          idVariable,
          idCompteAuteur: idsComptes[1],
          rôle: MODÉRATEUR,
        });

        await résVariable.attendreQue(
          (auteurs) =>
            !!auteurs &&
            auteurs.find((a) => a.idCompte === idsComptes[1])?.rôle ===
              MODÉRATEUR,
        );
      });

      it("Bds : Inviter auteur", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];
        await constls[0].bds.inviterAuteur({
          idBd,
          idCompteAuteur: idsComptes[1],
          rôle: MEMBRE,
        });

        const val = await résBds.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Bds : Accepter invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: true,
            rôle: MEMBRE,
          },
        ];

        await constls[1].bds.ajouterÀMesBds({ idBd });
        const val = await résBds.attendreQue((x) =>
          Boolean(!!x && x.find((y) => y.idCompte === idsComptes[1])?.accepté),
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Bds : Modification par le nouvel auteur", async () => {
        await uneFois(
          (fSuivi) => constls[1].suivrePermission({ idObjet: idBd, f: fSuivi }),
          (x) => !!x,
        );

        await constls[1].bds.sauvegarderMétadonnéeBd({
          idBd,
          clef: "test",
          métadonnée: "valeur test",
        });
        await constls[1].bds.sauvegarderNomBd({
          idBd,
          langue: "fr",
          nom: "Nom de la bd",
        });
        await constls[1].bds.sauvegarderDescriptionBd({
          idBd,
          langue: "fr",
          description: "Description de la bd",
        });
        const idTableau = await constls[1].bds.ajouterTableauBd({
          idBd,
        });
        await constls[1].tableaux.sauvegarderNomTableau({
          idTableau,
          langue: "fr",
          nom: "Nom tableau",
        });
        const idColonne = await constls[1].tableaux.ajouterColonneTableau({
          idTableau,
          idVariable,
        });
        await constls[1].tableaux.ajouterRègleTableau({
          idTableau,
          idColonne,
          règle: { typeRègle: "existe", détails: {} },
        });
        await constls[1].tableaux.ajouterÉlément({
          idTableau,
          vals: { [idColonne]: 123 },
        });
        await constls[1].bds.rejoindreNuées({
          idBd,
          idsNuées: ["/orbitdb/idDUneNuéeÀRejoindre"],
        });
        await constls[1].bds.ajouterMotsClefsBd({
          idBd,
          idsMotsClefs: [idMotClef],
        });
      });
      it("Bds : Refuser invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];

        await constls[1].bds.enleverDeMesBds({ idBd });
        const val = await résBds.attendreQue(
          (x) => !!x && !x.find((y) => y.idCompte === idsComptes[1])?.accepté,
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Bds : Promotion à modérateur", async () => {
        await constls[0].bds.inviterAuteur({
          idBd,
          idCompteAuteur: idsComptes[1],
          rôle: MODÉRATEUR,
        });

        await résBds.attendreQue(
          (auteurs) =>
            !!auteurs &&
            auteurs.find((a) => a.idCompte === idsComptes[1])?.rôle ===
              MODÉRATEUR,
        );
      });

      it("Projets : Inviter auteur", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];
        await constls[0].projets.inviterAuteur({
          idProjet,
          idCompteAuteur: idsComptes[1],
          rôle: MEMBRE,
        });

        const val = await résProjet.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Projets : Accepter invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: true,
            rôle: MEMBRE,
          },
        ];

        await constls[1].projets.ajouterÀMesProjets({ idProjet });
        const val = await résProjet.attendreQue((x) =>
          Boolean(!!x && x.find((y) => y.idCompte === idsComptes[1])?.accepté),
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Projets : Modification par le nouvel auteur", async () => {
        await uneFois(
          (fSuivi) =>
            constls[1].suivrePermission({ idObjet: idProjet, f: fSuivi }),
          (x) => !!x,
        );

        await constls[1].projets.sauvegarderNomProjet({
          idProjet,
          langue: "fr",
          nom: "Nom du projet",
        });
        await constls[1].projets.sauvegarderDescriptionProjet({
          idProjet,
          langue: "fr",
          description: "Description du projet",
        });
        await constls[1].projets.ajouterMotsClefsProjet({
          idProjet,
          idsMotsClefs: [idMotClef],
        });
        await constls[1].projets.ajouterBdProjet({
          idProjet,
          idBd,
        });
      });
      it("Projets : Refuser invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];

        await constls[1].projets.enleverDeMesProjets({ idProjet });
        const val = await résProjet.attendreQue(
          (x) => !!x && !x.find((y) => y.idCompte === idsComptes[1])?.accepté,
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Projets : Promotion à modérateur", async () => {
        await constls[0].projets.inviterAuteur({
          idProjet,
          idCompteAuteur: idsComptes[1],
          rôle: MODÉRATEUR,
        });

        await résProjet.attendreQue(
          (auteurs) =>
            !!auteurs &&
            auteurs.find((a) => a.idCompte === idsComptes[1])?.rôle ===
              MODÉRATEUR,
        );
      });

      it("Nuées : Inviter auteur", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];
        await constls[0].nuées.inviterAuteur({
          idNuée,
          idCompteAuteur: idsComptes[1],
          rôle: MEMBRE,
        });

        const val = await résNuée.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Nuées : Accepter invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: true,
            rôle: MEMBRE,
          },
        ];

        await constls[1].nuées.ajouterÀMesNuées({ idNuée });
        const val = await résNuée.attendreQue((x) =>
          Boolean(!!x && x.find((y) => y.idCompte === idsComptes[1])?.accepté),
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Nuées : Modification par le nouvel auteur", async () => {
        await uneFois(
          (fSuivi) =>
            constls[1].suivrePermission({ idObjet: idNuée, f: fSuivi }),
          (x) => !!x,
        );

        await constls[1].nuées.sauvegarderMétadonnéeNuée({
          idNuée,
          clef: "test",
          métadonnée: "valeur test",
        });
        await constls[1].nuées.sauvegarderNomNuée({
          idNuée,
          langue: "fr",
          nom: "Nom de la nuée",
        });
        await constls[1].nuées.sauvegarderDescriptionNuée({
          idNuée,
          langue: "fr",
          description: "Description de la nuée",
        });
        const idTableau = await constls[1].nuées.ajouterTableauNuée({
          idNuée,
        });
        await constls[1].nuées.sauvegarderNomsTableauNuée({
          idTableau,
          noms: { fr: "Nom tableau" },
        });
        const idColonne = await constls[1].nuées.ajouterColonneTableauNuée({
          idTableau,
          idVariable,
        });
        await constls[1].nuées.ajouterRègleTableauNuée({
          idTableau,
          idColonne,
          règle: { typeRègle: "existe", détails: {} },
        });
        await constls[1].nuées.ajouterMotsClefsNuée({
          idNuée,
          idsMotsClefs: [idMotClef],
        });
      });
      it("Nuées : Refuser invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsComptes[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsComptes[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];

        await constls[1].nuées.enleverDeMesNuées({ idNuée });
        const val = await résNuée.attendreQue(
          (x) => !!x && !x.find((y) => y.idCompte === idsComptes[1])?.accepté,
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Nuées : Promotion à modérateur", async () => {
        await constls[0].nuées.inviterAuteur({
          idNuée,
          idCompteAuteur: idsComptes[1],
          rôle: MODÉRATEUR,
        });

        await résNuée.attendreQue(
          (auteurs) =>
            !!auteurs &&
            auteurs.find((a) => a.idCompte === idsComptes[1])?.rôle ===
              MODÉRATEUR,
        );
      });
    });

    describe("Suivre membre", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let constls: Constellation[];
      let IMAGE: Buffer;

      const résNom = new utilsTestAttente.AttendreRésultat<{
        [key: string]: string;
      }>();
      const résCourriel = new utilsTestAttente.AttendreRésultat<
        string | null
      >();
      const résImage = new utilsTestAttente.AttendreRésultat<{
        image: Uint8Array;
        idImage: string;
      } | null>();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        IMAGE = await obtRessourceTest({
          nomFichier: "logo.svg",
        });

        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(2));

        fsOublier.push(
          await constls[1].profil.suivreNoms({
            idCompte: idsComptes[0],
            f: (n) => résNom.mettreÀJour(n),
          }),
        );
        fsOublier.push(
          await constls[1].profil.suivreCourriel({
            idCompte: idsComptes[0],
            f: (c) => résCourriel.mettreÀJour(c),
          }),
        );
        fsOublier.push(
          await constls[1].profil.suivreImage({
            idCompte: idsComptes[0],
            f: (i) => résImage.mettreÀJour(i),
          }),
        );
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();
        résNom.toutAnnuler();
        résCourriel.toutAnnuler();
        résImage.toutAnnuler();
      });

      it("Nom détecté", async () => {
        await constls[0].profil.sauvegarderNom({
          langue: "fr",
          nom: "Julien",
        });

        const val = await résNom.attendreQue((x) => !!x && Boolean(x.fr));
        expect(val.fr).to.equal("Julien");
      });

      it("Courriel détecté", async () => {
        await constls[0].profil.sauvegarderCourriel({
          courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
        });

        const val = await résCourriel.attendreQue(
          (x: string | null | undefined) => Boolean(x),
        );
        expect(val).to.equal("தொடர்பு@லஸ்ஸி.இந்தியா");
      });

      it("Image détectée", async () => {
        await constls[0].profil.sauvegarderImage({
          image: { contenu: IMAGE, nomFichier: "image.svg" },
        });

        const val = await résImage.attendreExiste();
        expect(val?.image).to.deep.equal(new Uint8Array(IMAGE));
      });

      it.skip("Protocoles détectés");
    });

    describe("Suivre mots-clefs", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let constls: Constellation[];

      let idMotClef1: string;
      let idMotClef2: string;

      const résPropres = new utilsTestAttente.AttendreRésultat<string[]>();
      const résAutres = new utilsTestAttente.AttendreRésultat<string[]>();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(2));
        fsOublier.push(
          await constls[1].réseau.suivreMotsClefsMembre({
            idCompte: idsComptes[0],
            f: (motsClefs) => résAutres.mettreÀJour(motsClefs),
          }),
        );
        fsOublier.push(
          await constls[1].réseau.suivreMotsClefsMembre({
            idCompte: idsComptes[1],
            f: (motsClefs) => résPropres.mettreÀJour(motsClefs),
          }),
        );
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();
        résPropres.toutAnnuler();
        résAutres.toutAnnuler();
      });

      it("Mes propres mots-clefs détectés", async () => {
        idMotClef2 = await constls[1].motsClefs.créerMotClef();

        const val = await résPropres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idMotClef2);
      });

      it("Mot-clef d'un autre membre détecté", async () => {
        idMotClef1 = await constls[0].motsClefs.créerMotClef();
        const val = await résAutres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idMotClef1);
      });
    });

    describe("Suivre variables", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let constls: Constellation[];

      let idVariable1: string;
      let idVariable2: string;

      const résPropres = new utilsTestAttente.AttendreRésultat<string[]>();
      const résAutres = new utilsTestAttente.AttendreRésultat<string[]>();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(2));
        fsOublier.push(
          await constls[1].réseau.suivreVariablesMembre({
            idCompte: idsComptes[0],
            f: (variables) => résAutres.mettreÀJour(variables),
          }),
        );
        fsOublier.push(
          await constls[1].réseau.suivreVariablesMembre({
            idCompte: idsComptes[1],
            f: (variables) => résPropres.mettreÀJour(variables),
          }),
        );
      });

      after(async () => {
        résPropres.toutAnnuler();
        résAutres.toutAnnuler();

        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();
      });

      it("Mes variables détectées", async () => {
        idVariable2 = await constls[1].variables.créerVariable({
          catégorie: "numérique",
        });

        const val = await résPropres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idVariable2);
      });

      it("Variable d'un autre membre détectée", async () => {
        idVariable1 = await constls[0].variables.créerVariable({
          catégorie: "numérique",
        });
        const val = await résAutres.attendreQue((x) => Boolean(x?.length));
        expect(val).to.contain(idVariable1);
      });
    });

    describe("Suivre BDs", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let constls: Constellation[];

      const résPropres = new utilsTestAttente.AttendreRésultat<string[]>();
      const résAutres = new utilsTestAttente.AttendreRésultat<string[]>();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(2));
        fsOublier.push(
          await constls[1].réseau.suivreBdsMembre({
            idCompte: idsComptes[0],
            f: (bds) => résAutres.mettreÀJour(bds),
          }),
        );
        fsOublier.push(
          await constls[1].réseau.suivreBdsMembre({
            idCompte: idsComptes[1],
            f: (bds) => résPropres.mettreÀJour(bds),
          }),
        );
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();
        résPropres.toutAnnuler();
        résAutres.toutAnnuler();
      });

      it("Mes BDs détectées", async () => {
        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });

        const val = await résPropres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idBd);
      });

      it("BD d'un autre membre détectée", async () => {
        const idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });
        const val = await résAutres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idBd);
      });
    });

    describe("Suivre projets", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let constls: Constellation[];

      const résPropres = new utilsTestAttente.AttendreRésultat<string[]>();
      const résAutres = new utilsTestAttente.AttendreRésultat<string[]>();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(2));
        fsOublier.push(
          await constls[1].réseau.suivreProjetsMembre({
            idCompte: idsComptes[0],
            f: (projets) => résAutres.mettreÀJour(projets),
          }),
        );
        fsOublier.push(
          await constls[1].réseau.suivreProjetsMembre({
            idCompte: idsComptes[1],
            f: (projets) => résPropres.mettreÀJour(projets),
          }),
        );
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();
        résPropres.toutAnnuler();
        résAutres.toutAnnuler();
      });

      it("Mes projets détectés", async () => {
        const idProjet = await constls[1].projets.créerProjet();

        const val = await résPropres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idProjet);
      });

      it("Projet d'un autre membre détecté", async () => {
        const idProjet = await constls[0].projets.créerProjet();
        const val = await résAutres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idProjet);
      });
    });

    describe("Suivre favoris", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let constls: Constellation[];

      let idMotClef: string;

      const résPropres = new utilsTestAttente.AttendreRésultat<
        ÉpingleFavorisAvecId[]
      >();
      const résAutres = new utilsTestAttente.AttendreRésultat<
        ÉpingleFavorisAvecId[]
      >();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(2));

        fsOublier.push(
          await constls[1].réseau.suivreFavorisMembre({
            idCompte: idsComptes[0],
            f: (favoris) => résAutres.mettreÀJour(favoris),
          }),
        );
        fsOublier.push(
          await constls[1].réseau.suivreFavorisMembre({
            idCompte: idsComptes[1],
            f: (favoris) => résPropres.mettreÀJour(favoris),
          }),
        );

        idMotClef = await constls[0].motsClefs.créerMotClef({
          épingler: false,
        });
      });

      after(async () => {
        résPropres.toutAnnuler();
        résAutres.toutAnnuler();

        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();
      });

      it("Mes favoris détectés", async () => {
        const réf: ÉpingleFavorisAvecId = {
          idObjet: idMotClef,
          épingle: {
            type: "motClef",
            base: TOUS,
          },
        };
        await constls[1].favoris.épinglerFavori({
          idObjet: idMotClef,
          épingle: {
            type: "motClef",
            base: TOUS,
          },
        });
        const val = await résPropres.attendreQue(
          (x) => !!x.find((r) => r.idObjet === idMotClef),
        );
        expect(val.find((r) => r.idObjet === idMotClef)).to.deep.equal(réf);
      });

      it("Favoris d'un autre membre détectés", async () => {
        const réf: ÉpingleFavorisAvecId = {
          idObjet: idMotClef,
          épingle: {
            type: "motClef",
            base: TOUS,
          },
        };
        await constls[0].favoris.épinglerFavori({
          idObjet: idMotClef,
          épingle: {
            type: "motClef",
            base: TOUS,
          },
        });
        const val = await résAutres.attendreQue(
          (x) => !!x.find((r) => r.épingle.type === "motClef"),
        );
        expect(val.find((r) => r.épingle.type === "motClef")).to.deep.equal(
          réf,
        );
      });
    });

    describe("Suivre favoris objet", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let constls: Constellation[];

      let idMotClef: string;
      let fOublier: schémaFonctionOublier;

      const rés = new utilsTestAttente.AttendreRésultat<
        { épingle: ÉpingleFavorisAvecId; idCompte: string }[]
      >();

      before(async () => {
        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(2));
        idMotClef = await constls[0].motsClefs.créerMotClef({
          épingler: false,
        });

        ({ fOublier } = await constls[0].réseau.suivreFavorisObjet({
          idObjet: idMotClef,
          f: (favoris) => rés.mettreÀJour(favoris),
          profondeur: 4,
        }));
      });

      after(async () => {
        if (fOublier) await fOublier();
        if (fOublierConstls) await fOublierConstls();
        rés.toutAnnuler();
      });

      it("Aucun favoris pour commencer", async () => {
        const val = await rés.attendreExiste();
        expect(val.length).to.equal(0);
      });

      it("Ajout à mes favoris détecté", async () => {
        const réf: { épingle: ÉpingleFavorisAvecId; idCompte: string }[] = [
          {
            idCompte: idsComptes[0],
            épingle: {
              idObjet: idMotClef,
              épingle: {
                type: "motClef",
                base: TOUS,
              },
            },
          },
        ];
        await constls[0].favoris.épinglerFavori({
          idObjet: idMotClef,
          épingle: { type: "motClef", base: TOUS },
        });
        const val = await rés.attendreQue((x) => x.length > 0);

        expect(val).to.have.deep.members(réf);
      });

      it("Ajout aux favoris d'un autre membre détecté", async () => {
        const réf: { épingle: ÉpingleFavorisAvecId; idCompte: string }[] = [
          {
            idCompte: idsComptes[0],
            épingle: {
              épingle: { type: "motClef", base: TOUS },
              idObjet: idMotClef,
            },
          },
          {
            idCompte: idsComptes[1],
            épingle: {
              épingle: { type: "motClef", base: TOUS },
              idObjet: idMotClef,
            },
          },
        ];
        await constls[1].favoris.épinglerFavori({
          idObjet: idMotClef,
          épingle: {
            type: "motClef",
            base: TOUS,
          },
        });
        const val = await rés.attendreQue((x) => !!x && x.length === 2);

        expect(val).to.have.deep.members(réf);
      });
    });

    describe("Suivre réplications", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let idsDispositifs: string[];
      let constls: Constellation[];

      let idBd: string;

      const rés = new utilsTestAttente.AttendreRésultat<infoRéplications>();
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsComptes, idsDispositifs, constls, fOublierConstls } =
          await toutPréparer(2));
        idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });
        fsOublier.push(
          (
            await constls[0].réseau.suivreRéplications({
              idObjet: idBd,
              f: (bds) => rés.mettreÀJour(bds),
              profondeur: 4,
            })
          ).fOublier,
        );
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();
        rés.toutAnnuler();
      });

      it("Auteur de la BD pour commencer", async () => {
        await constls[0].favoris.épinglerFavori({
          idObjet: idBd,
          épingle: { type: "motClef", base: TOUS },
        });

        const val = await rés.attendreQue((x) => !!x && x.membres.length > 0);

        expect(val.membres.map((m) => m.infoMembre.idCompte)).to.contain(
          idsComptes[0],
        );
        expect(
          val.dispositifs.map((d) => d.dispositif.idDispositif),
        ).to.contain(idsDispositifs[0]);
      });

      it("Ajout d'une réplication détectée", async () => {
        await constls[1].favoris.épinglerFavori({
          idObjet: idBd,
          épingle: {
            type: "bd",
            base: TOUS,
            données: {
              tableaux: TOUS,
              fichiers: INSTALLÉ,
            },
          },
        });

        const val = await rés.attendreQue(
          (x) => !!x && x.membres.length > 1 && x.dispositifs.length > 1,
        );

        expect(val.membres.map((m) => m.infoMembre.idCompte)).to.have.members([
          idsComptes[0],
          idsComptes[1],
        ]);
        expect(
          val.dispositifs.map((d) => d.dispositif.idDispositif),
        ).to.have.members([idsDispositifs[0], idsDispositifs[1]]);
      });
    });

    describe("Suivre BD par mot-clef unique", function () {
      let fOublierConstls: () => Promise<void>;
      let idsComptes: string[];
      let constls: Constellation[];

      let idNuée: string;
      let idBd1: string;
      let idBd2: string;
      let idTableau1: string | undefined;
      let idTableau2: string | undefined;

      let id1: string;
      let id2: string;
      let id3: string;

      const clefTableau = "tableau trads";
      const données1 = {
        clef: "titre",
        langue: "fr",
        trad: "Constellation",
      };
      const données2 = { clef: "titre", langue: "हिं", trad: "तारामंडल" };
      const données3 = { clef: "titre", langue: "kaq", trad: "Ch'umil" };

      const résBds = new utilsTestAttente.AttendreRésultat<string[]>();
      const résÉléments = new utilsTestAttente.AttendreRésultat<
        élémentDeMembre<élémentBdListeDonnées>[]
      >();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsComptes, constls, fOublierConstls } = await toutPréparer(2));
        const idVarClef = await constls[0].variables.créerVariable({
          catégorie: "chaîneNonTraductible",
        });
        const idVarLangue = await constls[0].variables.créerVariable({
          catégorie: "chaîneNonTraductible",
        });
        const idVarTrad = await constls[0].variables.créerVariable({
          catégorie: "chaîneNonTraductible",
        });

        idNuée = await constls[0].nuées.créerNuée();

        const schéma: schémaSpécificationBd = {
          licence: "ODbl-1_0",
          tableaux: [
            {
              cols: [
                {
                  idVariable: idVarClef,
                  idColonne: "clef",
                },
                {
                  idVariable: idVarLangue,
                  idColonne: "langue",
                },
                {
                  idVariable: idVarTrad,
                  idColonne: "trad",
                },
              ],
              clef: clefTableau,
            },
          ],
        };

        idBd1 = await constls[0].bds.créerBdDeSchéma({ schéma });
        idBd2 = await constls[1].bds.créerBdDeSchéma({ schéma });

        await constls[0].bds.rejoindreNuées({
          idsNuées: idNuée,
          idBd: idBd1,
        });
        await constls[1].bds.rejoindreNuées({
          idsNuées: idNuée,
          idBd: idBd2,
        });

        idTableau1 = (
          await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>,
            ): Promise<schémaFonctionOublier> => {
              return await constls[0].bds.suivreTableauxBd({
                idBd: idBd1,
                f: fSuivi,
              });
            },
          )
        )[0].id;

        idTableau2 = (
          await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>,
            ): Promise<schémaFonctionOublier> => {
              return await constls[1].bds.suivreTableauxBd({
                idBd: idBd2,
                f: fSuivi,
              });
            },
          )
        )[0].id;

        fsOublier.push(
          (
            await constls[0].réseau.suivreBdsDeNuée({
              idNuée,
              f: (bds) => résBds.mettreÀJour(bds),
            })
          ).fOublier,
        );
        fsOublier.push(
          (
            await constls[0].réseau.suivreÉlémentsDeTableauxUniques({
              idNuéeUnique: idNuée,
              clef: clefTableau,
              f: (éléments) => résÉléments.mettreÀJour(éléments),
            })
          ).fOublier,
        );

        id1 = (
          await constls[0].tableaux.ajouterÉlément({
            idTableau: idTableau1,
            vals: données1,
          })
        )[0];
        id2 = (
          await constls[0].tableaux.ajouterÉlément({
            idTableau: idTableau1,
            vals: données2,
          })
        )[0];
        id3 = (
          await constls[1].tableaux.ajouterÉlément({
            idTableau: idTableau2,
            vals: données3,
          })
        )[0];
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();
        résBds.toutAnnuler();
        résÉléments.toutAnnuler();
      });

      it("Suivre BDs du réseau", async () => {
        const val = await résBds.attendreQue(
          (x: string[]) => x && x.length === 2,
        );
        expect(val.length).to.equal(2);
        expect(val).to.have.members([idBd1, idBd2]);
      });

      it("Suivre éléments des BDs", async () => {
        const val = await résÉléments.attendreQue((x) => x && x.length === 3);
        const élémentsSansId = val.map((r) => {
          delete r.élément.données.id;
          return r;
        });

        const réf: élémentDeMembre<élémentBdListeDonnées>[] = [
          {
            idCompte: idsComptes[0],
            élément: {
              id: id1,
              données: données1,
            },
          },
          {
            idCompte: idsComptes[0],
            élément: {
              id: id2,
              données: données2,
            },
          },
          {
            idCompte: idsComptes[1],
            élément: {
              id: id3,
              données: données3,
            },
          },
        ];

        expect(élémentsSansId).to.have.deep.members(réf);
      });
    });

    describe("Messages", function () {
      let fOublierConstls: () => Promise<void>;
      let idsDispositifs: string[];
      let idsComptes: string[];
      let constls: Constellation[];

      const rés = new utilsTestAttente.AttendreRésultat<infoRéplications>();
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsComptes, idsDispositifs, constls, fOublierConstls } =
          await toutPréparer(3));
      });

      after(async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
        if (fOublierConstls) await fOublierConstls();
        rés.toutAnnuler();
      });

      const messageReçu = async ({
        de,
        à,
      }: {
        de: string;
        à: Constellation | Constellation[];
      }): Promise<{
        promesseBienReçu: Promise<boolean>;
        messageÀEnvoyer: string;
      }> => {
        const messageÀEnvoyer = `C'est bien moi : ${de}`;
        if (!Array.isArray(à)) à = [à];

        const générerPromesseReçuParDisposoitif = async (
          d: Constellation,
        ): Promise<() => Promise<boolean>> => {
          const événementReçu = new TypedEmitter<{
            reçu: (corresp: boolean) => void;
          }>();
          let résultat: boolean | undefined = undefined;
          const fOublier = await d.réseau.suivreMessagesDirectes({
            type: "texte",
            de,
            f: (message) => {
              const corresp =
                (message.contenu as { message: string }).message ===
                messageÀEnvoyer;
              résultat = corresp;
              événementReçu.emit("reçu", corresp);
            },
          });
          return () =>
            new Promise<boolean>((résoudre) => {
              événementReçu.once("reçu", (x) => {
                fOublier();
                résoudre(x);
              });
              if (résultat !== undefined) {
                fOublier();
                résoudre(résultat);
              }
            });
        };

        const promessesBienReçu = await Promise.all(
          à.map((d) => générerPromesseReçuParDisposoitif(d)),
        );

        const promesseTousBienReçus = Promise.all(
          promessesBienReçu.map((p) => p()),
        ).then((réceptions) => réceptions.every((r) => r));
        return {
          promesseBienReçu: promesseTousBienReçus,
          messageÀEnvoyer,
        };
      };

      it("Envoyer message à un autre dispositif", async () => {
        const { promesseBienReçu, messageÀEnvoyer } = await messageReçu({
          de: idsDispositifs[0],
          à: constls[1],
        });

        await constls[0].réseau.envoyerMessageAuDispositif({
          msg: {
            type: "texte",
            contenu: { message: messageÀEnvoyer },
          },
          idDispositif: idsDispositifs[1],
        });
        const bienReçu = await promesseBienReçu;
        expect(bienReçu).to.be.true();
      });
      it("Envoyer message à un autre membre", async () => {
        const { promesseBienReçu, messageÀEnvoyer } = await messageReçu({
          de: idsDispositifs[0],
          à: constls[1],
        });

        await constls[0].réseau.envoyerMessageAuMembre({
          msg: {
            type: "texte",
            contenu: { message: messageÀEnvoyer },
          },
          idCompte: idsComptes[1],
        });
        const bienReçu = await promesseBienReçu;
        expect(bienReçu).to.be.true();
      });

      it("Envoyer message à un autre membre qui a plusieurs dispositifs", async () => {
        const { promesseBienReçu, messageÀEnvoyer } = await messageReçu({
          de: idsDispositifs[0],
          à: [constls[1], constls[2]],
        });
        const invitation = await constls[1].générerInvitationRejoindreCompte();
        await constls[2].demanderEtPuisRejoindreCompte(invitation);
        await uneFois(
          async (fSuivi: schémaFonctionSuivi<string[]>) => {
            return await constls[0].suivreDispositifs({
              idCompte: idsComptes[1],
              f: fSuivi,
            });
          },
          (ids) => !!ids && ids.length > 1,
        );

        await constls[0].réseau.envoyerMessageAuMembre({
          msg: {
            type: "texte",
            contenu: { message: messageÀEnvoyer },
          },
          idCompte: idsComptes[1],
        });

        const bienReçu = await promesseBienReçu;
        expect(bienReçu).to.be.true();
      });

      it("Envoyer après reconnexion", async () => {
        const { promesseBienReçu, messageÀEnvoyer } = await messageReçu({
          de: idsDispositifs[0],
          à: constls[1],
        });
        const idLibp2pConstl1 = peerIdFromString(
          await constls[1].obtIdLibp2p(),
        );
        await constls[0].orbite.orbite.ipfs.libp2p.hangUp(idLibp2pConstl1);

        await constls[0].orbite.orbite.ipfs.libp2p.dial(idLibp2pConstl1);

        await constls[0].réseau.envoyerMessageAuDispositif({
          msg: {
            type: "texte",
            contenu: { message: messageÀEnvoyer },
          },
          idDispositif: idsDispositifs[1],
        });
        const bienReçu = await promesseBienReçu;
        expect(bienReçu).to.be.true();
      });
    });
  });
}
