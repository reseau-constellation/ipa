import { uneFois } from "@constl/utils-ipa";
import {
  attente as utilsTestAttente,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";
import { isElectronMain, isNode } from "wherearewe";
import { expect } from "aegir/chai";
import { TypedEmitter } from "tiny-typed-emitter";
import { peerIdFromString } from "@libp2p/peer-id";
import { MEMBRE } from "@/v2/nébuleuse/services/compte/accès/consts.js";

import { obtRessourceTest } from "./v2/ressources/index.js";
import type {
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaRetourFonctionRechercheParProfondeur,
} from "@/types.js";
import type {
  infoConfiance,
  infoMembre,
  infoMembreRéseau,
  infoRelation,
  infoRéplications,
  statutDispositif,
  statutMembre,
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
