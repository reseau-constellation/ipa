import { uneFois } from "@constl/utils-ipa";
import {
  attente as utilsTestAttente,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";
import { isElectronMain, isNode } from "wherearewe";
import { expect } from "aegir/chai";
import { MEMBRE, MODÉRATEUR } from "@/accès/consts.js";

import {
  infoAuteur,
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaRetourFonctionRechercheParProfondeur,
} from "@/types.js";

import { type Constellation, créerConstellation } from "@/index.js";
import { obtRessourceTest } from "./ressources/index.js";
import type { infoTableauAvecId, schémaSpécificationBd } from "@/bds.js";
import type { ÉpingleFavorisAvecId } from "@/favoris.js";
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
  const { fOublier: fOublierClients, clients } = await créerConstellationsTest({
    n,
    créerConstellation,
  });
  const idsNodesSFIP = await Promise.all(
    clients.map(async (c) => (await c.obtIdSFIP()).toString()),
  );
  const idsOrbite = await Promise.all(
    clients.map(async (c) => await c.obtIdDispositif()),
  );
  const idsBdCompte = await Promise.all(
    clients.map(async (c) => await c.obtIdCompte()),
  );

  return {
    clients,
    fOublierClients,
    idsNodesSFIP,
    idsOrbite,
    idsBdCompte,
  };
}

if (isNode || isElectronMain) {
  describe("Réseau", function () {
    describe("Suivre en ligne", function () {
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let idsNodesSFIP: string[];
      let idsOrbite: string[];
      let clients: Constellation[];

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
        ({ idsBdCompte, idsNodesSFIP, idsOrbite, clients, fOublierClients } =
          await toutPréparer(3));

        fsOublier.push(
          await clients[0].réseau.suivreConnexionsPostesSFIP({
            f: (c) => rés.mettreÀJour(c),
          }),
        );
        fsOublier.push(
          await clients[0].réseau.suivreConnexionsDispositifs({
            f: (d) => dispositifs.mettreÀJour(d),
          }),
        );
        fsOublier.push(
          await clients[0].réseau.suivreConnexionsMembres({
            f: (c) => membresEnLigne.mettreÀJour(c),
          }),
        );
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        if (fOublierClients) await fOublierClients();
        rés.toutAnnuler();
        dispositifs.toutAnnuler();
        membresEnLigne.toutAnnuler();
      });

      it("Autres postes détectés", async () => {
        const val = await rés.attendreQue((x) =>
          idsNodesSFIP.slice(1).every((id) => x.find((p) => p.pair === id)),
        );
        expect(val.map((p) => p.pair)).to.have.members([
          idsNodesSFIP[1],
          idsNodesSFIP[2],
        ]);
        expect(val.map((p) => p.adresses.length)).to.have.members([1, 1]);
      });

      it("Autres dispositifs détectés", async () => {
        const val = await dispositifs.attendreQue(
          (x?: statutDispositif[]) => !!x && x.length >= 3,
        );
        expect(val.map((d) => d.infoDispositif.idDispositif)).to.have.members(
          idsOrbite,
        );
      });

      it("Autres membres détectés", async () => {
        const réfRés: infoMembre[] = [];
        for (let i = 0; i <= clients.length - 1; i++) {
          const identitéOrbite = await clients[i].obtIdentitéOrbite();
          réfRés.push({
            idCompte: idsBdCompte[i],
            protocoles: [],
            dispositifs: [
              {
                idSFIP: idsNodesSFIP[i],
                idDispositif: idsOrbite[i],
                idCompte: idsBdCompte[i],
                clefPublique: identitéOrbite.publicKey,
                encryption: {
                  type: await clients[i].encryption.obtNom(),
                  clefPublique: (await clients[i].encryption.obtClefs())
                    .publique,
                },
                signatures: identitéOrbite.signatures,
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

      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];

      let clients: Constellation[];

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2));
        fsOublier.push(
          await clients[0].réseau.suivreFiables({
            f: (m) => fiablesPropres.mettreÀJour(m),
          }),
        );
        fsOublier.push(
          await clients[1].réseau.suivreFiables({
            f: (m) => fiablesAutres.mettreÀJour(m),
            idCompte: idsBdCompte[0],
          }),
        );
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        if (fOublierClients) await fOublierClients();
        fiablesPropres.toutAnnuler();
        fiablesAutres.toutAnnuler();
      });

      it("Personne pour commencer", async () => {
        const val = await fiablesPropres.attendreExiste();
        expect(val.length).to.equal(0);
      });

      it("Faire confiance", async () => {
        await clients[0].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[1],
        });
        const val = await fiablesPropres.attendreQue(
          (x) => !!x && x.length > 0,
        );
        expect(val.length).to.equal(1);
        expect(val).to.have.members([idsBdCompte[1]]);
      });

      it("Détecter confiance d'autre membre", async () => {
        const val = await fiablesAutres.attendreQue((x) => !!x && x.length > 0);
        expect(val.length).to.equal(1);
        expect(val).to.have.members([idsBdCompte[1]]);
      });

      it("Un débloquage accidental ne fait rien", async () => {
        await clients[0].réseau.débloquerMembre({
          idCompte: idsBdCompte[1],
        });
        const val = await fiablesPropres.attendreExiste();
        expect(Array.isArray(val)).to.be.true();
        expect(val.length).to.equal(1);
        expect(val).to.have.members([idsBdCompte[1]]);
      });

      it("Il n'était pas si chouette que ça après tout", async () => {
        await clients[0].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsBdCompte[1],
        });
        const val = await fiablesPropres.attendreQue((x) => x.length === 0);
        expect(val).to.be.an.empty("array");
      });
    });

    describe("Membres bloqués", function () {
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let clients: Constellation[];

      const bloquésTous = new utilsTestAttente.AttendreRésultat<infoBloqué[]>();
      const bloquésPubliques = new utilsTestAttente.AttendreRésultat<
        string[]
      >();
      const bloquésAutreMembre = new utilsTestAttente.AttendreRésultat<
        infoBloqué[]
      >();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3));
        fsOublier.push(
          await clients[0].réseau.suivreBloqués({
            f: (m) => bloquésTous.mettreÀJour(m),
          }),
        );
        fsOublier.push(
          await clients[0].réseau.suivreBloquésPubliques({
            f: (m) => bloquésPubliques.mettreÀJour(m),
          }),
        );
        fsOublier.push(
          await clients[1].réseau.suivreBloqués({
            f: (m) => bloquésAutreMembre.mettreÀJour(m),
            idCompte: idsBdCompte[0],
          }),
        );
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        if (fOublierClients) await fOublierClients();

        bloquésTous.toutAnnuler();
        bloquésPubliques.toutAnnuler();
        bloquésAutreMembre.toutAnnuler();
      });

      it("Personne pour commencer", async () => {
        await bloquésPubliques.attendreExiste();
        expect(bloquésPubliques.val?.length).to.equal(0);
      });

      it("Bloquer quelqu'un", async () => {
        await clients[0].réseau.bloquerMembre({
          idCompte: idsBdCompte[1],
        });
        const val = await bloquésTous.attendreQue((x) => !!x && x.length > 0);

        expect(val.length).to.equal(1);
        expect(val).to.have.deep.members([
          {
            idCompte: idsBdCompte[1],
            privé: false,
          },
        ]);
        expect(bloquésPubliques.val).to.have.members([idsBdCompte[1]]);
      });

      it("Un dé-confiance accidental ne fait rien", async () => {
        await clients[0].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsBdCompte[1],
        });

        const bloqués = await bloquésTous.attendreQue(
          (x) => !!x && x.length > 0,
        );

        expect(bloqués).to.have.deep.members([
          {
            idCompte: idsBdCompte[1],
            privé: false,
          },
        ]);
      });

      it("Bloquer privé", async () => {
        await clients[0].réseau.bloquerMembre({
          idCompte: idsBdCompte[2],
          privé: true,
        });

        const bloqués = await bloquésTous.attendreQue(
          (x) => !!x && x.length > 1,
        );
        expect(bloqués).to.have.deep.members([
          {
            idCompte: idsBdCompte[1],
            privé: false,
          },
          {
            idCompte: idsBdCompte[2],
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
            idCompte: idsBdCompte[1],
            privé: false,
          },
        ]);
      });

      it("On ne détecte pas le bloqué privé d'un autre membre", async () => {
        const val = await bloquésAutreMembre.attendreExiste();
        expect(val.map((b) => b.idCompte)).not.to.contain(idsBdCompte[2]);
      });

      it("Débloquer publique", async () => {
        await clients[0].réseau.débloquerMembre({
          idCompte: idsBdCompte[1],
        });
        const val = await bloquésPubliques.attendreQue((x) => x.length === 0);
        expect(val.length).to.equal(0);
      });

      it("Débloquer privé", async () => {
        await clients[0].réseau.débloquerMembre({
          idCompte: idsBdCompte[2],
        });
        const val = await bloquésTous.attendreQue((x) => x.length === 0);
        expect(val.length).to.equal(0);
      });

      it("Passer de bloqué privé à bloqué publique", async () => {
        await clients[0].réseau.bloquerMembre({
          idCompte: idsBdCompte[1],
          privé: true,
        });
        let val = await bloquésPubliques.attendreExiste();
        expect(val.length).to.equal(0);
        await clients[0].réseau.bloquerMembre({
          idCompte: idsBdCompte[1],
          privé: false,
        });
        val = await bloquésPubliques.attendreQue((x) => x.length > 0);
        expect(val.length).to.equal(1);
        expect(bloquésTous.val?.[0].privé).to.be.false();
      });
    });

    describe("Suivre relations immédiates", function () {
      describe("Relations explicites", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: Constellation[];

        const relationsPropres = new utilsTestAttente.AttendreRésultat<
          infoConfiance[]
        >();
        const relationsAutres = new utilsTestAttente.AttendreRésultat<
          infoConfiance[]
        >();

        const fsOublier: schémaFonctionOublier[] = [];

        before(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3));
          fsOublier.push(
            await clients[0].réseau.suivreRelationsImmédiates({
              f: (c) => relationsPropres.mettreÀJour(c),
            }),
          );
          fsOublier.push(
            await clients[1].réseau.suivreRelationsImmédiates({
              f: (c) => relationsAutres.mettreÀJour(c),
              idCompte: idsBdCompte[0],
            }),
          );
        });

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (fOublierClients) await fOublierClients();

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
              idCompte: idsBdCompte[1],
              confiance: 1,
            },
          ];
          await clients[0].réseau.faireConfianceAuMembre({
            idCompte: idsBdCompte[1],
          });
          const val = await relationsPropres.attendreQue(
            (x) => !!x && !!x.length,
          );

          expect(val).to.have.deep.members(réf);
        });

        it("Bloquer membre détecté", async () => {
          const réf: infoConfiance[] = [
            {
              idCompte: idsBdCompte[1],
              confiance: 1,
            },
            {
              idCompte: idsBdCompte[2],
              confiance: -1,
            },
          ];

          await clients[0].réseau.bloquerMembre({
            idCompte: idsBdCompte[2],
          });
          const val = await relationsPropres.attendreQue(
            (x) => !!x && x.length === 2,
          );
          expect(val).to.have.deep.members(réf);
        });

        it("Débloquer membre détecté", async () => {
          const réf: infoConfiance[] = [
            {
              idCompte: idsBdCompte[1],
              confiance: 1,
            },
          ];
          await clients[0].réseau.débloquerMembre({
            idCompte: idsBdCompte[2],
          });
          const val = await relationsPropres.attendreQue(
            (x) =>
              x.find((r) => r.idCompte === idsBdCompte[1])?.confiance !== -1,
          );
          expect(val.find((r) => r.idCompte === idsBdCompte[1])).to.deep.equal(
            réf[0],
          );
        });

        it("Ajout membres au réseau d'un autre membre détecté", async () => {
          const réf: infoConfiance[] = [
            {
              idCompte: idsBdCompte[1],
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
          await clients[0].réseau.nePlusFaireConfianceAuMembre({
            idCompte: idsBdCompte[1],
          });
          const val = await relationsPropres.attendreQue(
            (x) => !!x && x.length == 0,
          );
          expect(val.length).to.equal(0);
        });
      });

      describe("Relations indirectes", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: Constellation[];

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
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2));
          fsOublier.push(
            await clients[0].réseau.suivreRelationsImmédiates({
              f: (c) => relationsPropres.mettreÀJour(c),
            }),
          );
          fsOublier.push(
            await clients[1].réseau.suivreRelationsImmédiates({
              f: (c) => relationsAutres.mettreÀJour(c),
              idCompte: idsBdCompte[0],
            }),
          );
        });

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (fOublierClients) await fOublierClients();

          relationsPropres.toutAnnuler();
          relationsAutres.toutAnnuler();
        });

        it("Ajout aux favoris détecté", async () => {
          idMotClef2 = await clients[1].motsClefs.créerMotClef();
          await clients[0].favoris.épinglerFavori({
            idObjet: idMotClef2,
            épingle: {
              type: "motClef"
            },
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && x.length > 0,
          );
          expect(val.map((r) => r.idCompte)).to.contain(idsBdCompte[1]);
        });

        it("Ajout aux favoris d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length),
          );
          expect(val.map((r) => r.idCompte)).to.contain(idsBdCompte[1]);
        });

        it("Enlever favori détecté", async () => {
          await clients[0].favoris.désépinglerFavori({
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
          idVariable = await clients[0].variables.créerVariable({
            catégorie: "numérique",
          });
          await clients[0].variables.inviterAuteur({
            idVariable,
            idCompteAuteur: idsBdCompte[1],
            rôle: MEMBRE,
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length),
          );

          expect(val.map((r) => r.idCompte)).to.contain(idsBdCompte[1]);
        });

        it("Ajout coauteur variable d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue((x) => x.length > 0);
          expect(val.map((r) => r.idCompte)).to.contain(idsBdCompte[1]);
        });

        it("Enlever variable détecté", async () => {
          await clients[0].variables.effacerVariable({ idVariable });
          const valPropres = await relationsPropres.attendreQue(
            (x) => x.length < 1,
          );
          expect(valPropres.length).to.equal(0);

          const val = await relationsAutres.attendreQue((x) => !x.length);
          expect(val.length).to.equal(0);
        });

        it("Ajout coauteur BD détecté", async () => {
          idBd = await clients[0].bds.créerBd({ licence: "ODbl-1_0" });
          await clients[0].bds.inviterAuteur({
            idBd,
            idCompteAuteur: idsBdCompte[1],
            rôle: MEMBRE,
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length),
          );

          expect(val.map((r) => r.idCompte)).to.contain(idsBdCompte[1]);
        });

        it("Ajout coauteur BD d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length),
          );
          expect(val.map((r) => r.idCompte)).to.contain(idsBdCompte[1]);
        });

        it("Enlever bd détecté", async () => {
          await clients[0].bds.effacerBd({ idBd });
          const valPropres = await relationsPropres.attendreQue(
            (x) => x.length < 1,
          );
          expect(valPropres.length).to.equal(0);

          const val = await relationsAutres.attendreQue((x) => !x.length);
          expect(val.length).to.equal(0);
        });

        it("Ajout coauteur projet détecté", async () => {
          idProjet = await clients[0].projets.créerProjet();
          await clients[0].projets.inviterAuteur({
            idProjet,
            idCompteAuteur: idsBdCompte[1],
            rôle: MEMBRE,
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length),
          );
          expect(val.map((r) => r.idCompte)).to.contain(idsBdCompte[1]);
        });

        it("Ajout coauteur projet d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length),
          );
          expect(val.map((r) => r.idCompte)).to.contain(idsBdCompte[1]);
        });

        it("Enlever projet détecté", async () => {
          await clients[0].projets.effacerProjet({ idProjet });
          const valPropres = await relationsPropres.attendreQue(
            (x) => !x.length,
          );
          expect(valPropres.length).to.equal(0);

          const val = await relationsAutres.attendreQue((x) => !x.length);
          expect(val.length).to.equal(0);
        });

        it("Ajout coauteur mot-clef détecté", async () => {
          idMotClef1 = await clients[0].motsClefs.créerMotClef();
          await clients[0].motsClefs.inviterAuteur({
            idMotClef: idMotClef1,
            idCompteAuteur: idsBdCompte[1],
            rôle: MEMBRE,
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length),
          );
          expect(val.map((r) => r.idCompte)).to.contain(idsBdCompte[1]);
        });

        it("Ajout coauteur mot-clef d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length),
          );
          expect(val.map((r) => r.idCompte)).to.contain(idsBdCompte[1]);
        });

        it("Enlever mot-clef détecté", async () => {
          await clients[0].motsClefs.effacerMotClef({
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
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let clients: Constellation[];

      let fOublier: schémaFonctionOublier;
      let fChangerProfondeur: schémaRetourFonctionRechercheParProfondeur["fChangerProfondeur"];
      const rés = new utilsTestAttente.AttendreRésultat<infoRelation[]>();

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3));
        ({ fOublier, fChangerProfondeur } =
          await clients[0].réseau.suivreRelationsConfiance({
            f: (r) => rés.mettreÀJour(r),
            profondeur: 2,
          }));
      });

      after(async () => {
        if (fOublier) await fOublier();
        if (fOublierClients) await fOublierClients();

        rés.toutAnnuler();
      });

      it("Relations immédiates", async () => {
        const réf: infoRelation[] = [
          {
            de: idsBdCompte[0],
            pour: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
        ];
        await clients[0].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[1],
        });

        const val = await rés.attendreQue((x) => !!x && !!x.length);
        expect(val).to.deep.equal(réf);
      });
      it("Relations indirectes", async () => {
        const réf: infoRelation[] = [
          {
            de: idsBdCompte[0],
            pour: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            de: idsBdCompte[1],
            pour: idsBdCompte[2],
            confiance: 1,
            profondeur: 2,
          },
        ];
        await clients[1].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[2],
        });

        const val = await rés.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.deep.equal(réf);
      });

      it("Diminuer profondeur", async () => {
        const réf: infoRelation[] = [
          {
            de: idsBdCompte[0],
            pour: idsBdCompte[1],
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
            de: idsBdCompte[0],
            pour: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            de: idsBdCompte[1],
            pour: idsBdCompte[2],
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
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let moiMême: infoMembreRéseau;
      let clients: Constellation[];

      let fOublier: schémaFonctionOublier;
      let fChangerProfondeur: schémaRetourFonctionRechercheParProfondeur["fChangerProfondeur"];

      const rés = new utilsTestAttente.AttendreRésultat<infoMembreRéseau[]>();

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3));
        moiMême = {
          idCompte: idsBdCompte[0],
          profondeur: 0,
          confiance: 1,
        };
        ({ fOublier, fChangerProfondeur } =
          await clients[0].réseau.suivreComptesRéseau({
            f: (c) => rés.mettreÀJour(c),
            profondeur: 2,
          }));
      });

      after(async () => {
        if (fOublier) await fOublier();
        if (fOublierClients) await fOublierClients();
        rés.toutAnnuler();
      });

      it("Relations confiance immédiates", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
        ];
        await clients[0].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[1],
        });

        const val = await rés.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Relations confiance indirectes", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsBdCompte[2],
            confiance: 0.8,
            profondeur: 2,
          },
        ];
        await clients[1].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[2],
        });

        await rés.attendreQue((x) => !!x && x.length > 2);
        expect(rés.val).to.have.deep.members(réf);
      });
      it("Relations confiance directes et indirectes", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsBdCompte[2],
            confiance: 1,
            profondeur: 1,
          },
        ];
        await clients[0].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[2],
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
            idCompte: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsBdCompte[2],
            confiance: 0.8,
            profondeur: 2,
          },
        ];
        await clients[0].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsBdCompte[2],
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
            idCompte: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
        ];
        await clients[1].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsBdCompte[2],
        });

        const val = await rés.attendreQue((x) => x.length === 2);
        expect(val).to.have.deep.members(réf);
      });
      it("Enlever relation confiance directe", async () => {
        const réf = [moiMême];

        await clients[0].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsBdCompte[1],
        });

        const val = await rés.attendreQue((x) => !!x && x.length === 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Membre bloqué directement", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsBdCompte[1],
            confiance: -1,
            profondeur: 1,
          },
        ];
        await clients[0].réseau.bloquerMembre({
          idCompte: idsBdCompte[1],
        });

        const val = await rés.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Membre débloqué directement", async () => {
        const réf = [moiMême];

        await clients[0].réseau.débloquerMembre({
          idCompte: idsBdCompte[1],
        });

        const val = await rés.attendreQue((x) => !!x && x.length === 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Membre bloqué indirectement", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsBdCompte[2],
            confiance: -0.9,
            profondeur: 2,
          },
        ];
        await clients[0].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[1],
        });
        await clients[1].réseau.bloquerMembre({
          idCompte: idsBdCompte[2],
        });

        const val = await rés.attendreQue((x) => !!x && x.length === 3);
        expect(val).to.have.deep.members(réf);
      });
      it("Précédence confiance propre", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsBdCompte[2],
            confiance: 1,
            profondeur: 1,
          },
        ];
        await clients[0].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[2],
        });

        const val = await rés.attendreQue(
          (x) =>
            !!x &&
            x.find((y) => y.idCompte === idsBdCompte[2])?.confiance === 1,
        );
        expect(val).to.have.deep.members(réf);

        await clients[0].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsBdCompte[2],
        });
        await clients[0].réseau.nePlusFaireConfianceAuMembre({
          idCompte: idsBdCompte[1],
        });
        await clients[1].réseau.débloquerMembre({
          idCompte: idsBdCompte[2],
        });
      });
      it("Diminuer profondeur", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
        ];
        await clients[0].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[1],
        });
        await clients[1].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[2],
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
            idCompte: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsBdCompte[2],
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
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let moiMême: infoMembreRéseau;
      let clients: Constellation[];

      let fOublier: schémaFonctionOublier;
      let fChangerProfondeur: schémaRetourFonctionRechercheParProfondeur["fChangerProfondeur"];

      const rés = new utilsTestAttente.AttendreRésultat<infoMembreRéseau[]>();

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3));
        moiMême = {
          idCompte: idsBdCompte[0],
          profondeur: 0,
          confiance: 1,
        };
        // await clients[0].réseau.suivreMessageGossipsub({ sujet: "réseau-constellation", f: x=>console.log(JSON.stringify(JSON.parse(x), undefined, 2))});
        ({ fOublier, fChangerProfondeur } =
          await clients[0].réseau.suivreComptesRéseauEtEnLigne({
            f: (c) => rés.mettreÀJour(c),
            profondeur: 2,
          }));
      });

      after(async () => {
        if (fOublier) await fOublier();
        if (fOublierClients) await fOublierClients();
        rés.toutAnnuler();
      });

      it("Comptes en ligne détectés", async () => {
        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsBdCompte[1],
            confiance: 0,
            profondeur: Infinity,
          },
          {
            idCompte: idsBdCompte[2],
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
            idCompte: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsBdCompte[2],
            confiance: 0,
            profondeur: Infinity,
          },
        ];

        await clients[0].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[1],
        });
        const val = await rés.attendreQue(
          (x) =>
            !!x &&
            x.find((x) => x.idCompte === idsBdCompte[1])?.confiance === 1 &&
            x.find((x) => x.idCompte === idsBdCompte[2])?.confiance === 0,
        );

        expect(val).to.have.deep.members(réf);
      });

      it("Changer profondeur", async () => {
        await clients[1].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[2],
        });
        await rés.attendreQue(
          (x) =>
            !!x &&
            (x.find((x) => x.idCompte === idsBdCompte[2])?.confiance || 0) > 0,
        );

        const réf: infoMembreRéseau[] = [
          moiMême,
          {
            idCompte: idsBdCompte[1],
            confiance: 1,
            profondeur: 1,
          },
          {
            idCompte: idsBdCompte[2],
            confiance: 0,
            profondeur: Infinity,
          },
        ];
        fChangerProfondeur(1);
        const val = await rés.attendreQue(
          (x) =>
            !!x &&
            x.find((x) => x.idCompte === idsBdCompte[2])?.confiance === 0,
        );

        expect(val).to.have.deep.members(réf);
      });
    });

    describe("Suivre confiance mon réseau pour membre", function () {
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let clients: Constellation[];

      let fOublier: schémaFonctionOublier;
      let fChangerProfondeur: schémaRetourFonctionRechercheParProfondeur["fChangerProfondeur"];

      const rés = new utilsTestAttente.AttendreRésultat<number>();

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3));
        ({ fOublier, fChangerProfondeur } =
          await clients[0].réseau.suivreConfianceMonRéseauPourMembre({
            idCompte: idsBdCompte[2],
            f: (confiance) => rés.mettreÀJour(confiance),
            profondeur: 4,
          }));
      });

      after(async () => {
        rés.toutAnnuler();

        if (fOublier) await fOublier();
        if (fOublierClients) await fOublierClients();
      });

      it("Confiance initiale 0", async () => {
        rés.attendreQue((x) => x === 0);
      });

      it("Faire confiance au membre", async () => {
        await clients[0].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[1],
        });
        await clients[1].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[2],
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
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let clients: Constellation[];

      let fOublier: schémaFonctionOublier;
      let idMotClef: string;

      const rés = new utilsTestAttente.AttendreRésultat<number>();

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3));
        idMotClef = await clients[1].motsClefs.créerMotClef();

        fOublier = await clients[0].réseau.suivreConfianceAuteurs({
          idItem: idMotClef,
          clef: "motsClefs",
          f: (confiance) => rés.mettreÀJour(confiance),
        });
      });

      after(async () => {
        if (fOublier) await fOublier();
        if (fOublierClients) await fOublierClients();
        rés.toutAnnuler();
      });

      it("Confiance 0 pour commencer", async () => {
        rés.attendreQue((x) => x === 0);
      });

      it("Ajout auteur au réseau", async () => {
        await clients[0].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[1],
        });

        const val = await rés.attendreQue((x) => !!x && x > 0);
        expect(val).to.equal(1);
      });

      it("Ajout coauteur au réseau", async () => {
        await clients[1].motsClefs.inviterAuteur({
          idMotClef,
          idCompteAuteur: idsBdCompte[2],
          rôle: MEMBRE,
        });
        await clients[2].motsClefs.ajouterÀMesMotsClefs({ idMotClef });
        const valAvant = await rés.attendreQue((x) => !!x && x > 1);

        expect(valAvant).to.be.greaterThan(1);
        expect(valAvant).to.be.lessThan(2);

        await clients[0].réseau.faireConfianceAuMembre({
          idCompte: idsBdCompte[2],
        });
        const val = await rés.attendreQue((x) => !!x && x > valAvant);

        expect(val).to.equal(2);
      });

      it("Coauteur se retire", async () => {
        await clients[2].motsClefs.enleverDeMesMotsClefs({ idMotClef });
        const val = await rés.attendreQue((x) => !!x && x < 2);

        expect(val).to.equal(1);
      });
    });

    describe("Auteurs", function () {
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let clients: Constellation[];

      let idMotClef: string;
      let idVariable: string;
      let idBd: string;
      let idProjet: string;

      const résMotClef = new utilsTestAttente.AttendreRésultat<infoAuteur[]>();
      const résVariable = new utilsTestAttente.AttendreRésultat<infoAuteur[]>();
      const résBds = new utilsTestAttente.AttendreRésultat<infoAuteur[]>();
      const résProjet = new utilsTestAttente.AttendreRésultat<infoAuteur[]>();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2));

        idMotClef = await clients[0].motsClefs.créerMotClef();
        fsOublier.push(
          await clients[0].réseau.suivreAuteursMotClef({
            idMotClef,
            f: (auteurs) => résMotClef.mettreÀJour(auteurs),
          }),
        );

        idVariable = await clients[0].variables.créerVariable({
          catégorie: "numérique",
        });
        fsOublier.push(
          await clients[0].réseau.suivreAuteursVariable({
            idVariable,
            f: (auteurs) => résVariable.mettreÀJour(auteurs),
          }),
        );

        idBd = await clients[0].bds.créerBd({ licence: "ODbl-1_0" });
        fsOublier.push(
          await clients[0].réseau.suivreAuteursBd({
            idBd,
            f: (auteurs) => résBds.mettreÀJour(auteurs),
          }),
        );

        idProjet = await clients[0].projets.créerProjet();
        fsOublier.push(
          await clients[0].réseau.suivreAuteursProjet({
            idProjet,
            f: (auteurs) => résProjet.mettreÀJour(auteurs),
          }),
        );
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        if (fOublierClients) await fOublierClients();
        résMotClef.toutAnnuler();
        résVariable.toutAnnuler();
        résBds.toutAnnuler();
        résProjet.toutAnnuler();
      });

      it("Mots-clefs : Inviter auteur", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsBdCompte[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsBdCompte[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];
        await clients[0].motsClefs.inviterAuteur({
          idMotClef,
          idCompteAuteur: idsBdCompte[1],
          rôle: MEMBRE,
        });

        const val = await résMotClef.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.deep.equal(réf);
      });
      it("Mots-clefs : Accepter invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsBdCompte[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsBdCompte[1],
            accepté: true,
            rôle: MEMBRE,
          },
        ];

        await clients[1].motsClefs.ajouterÀMesMotsClefs({ idMotClef });
        const val = await résMotClef.attendreQue((x) =>
          Boolean(!!x && x.find((y) => y.idCompte === idsBdCompte[1])?.accepté),
        );

        expect(val).to.deep.equal(réf);
      });
      it("Mots-clefs : Refuser invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsBdCompte[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsBdCompte[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];

        await clients[1].motsClefs.enleverDeMesMotsClefs({ idMotClef });
        const val = await résMotClef.attendreQue(
          (x) => !!x && !x.find((y) => y.idCompte === idsBdCompte[1])?.accepté,
        );

        expect(val).to.deep.equal(réf);
      });
      it("Mots-clefs : Promotion à modérateur", async () => {
        await clients[0].motsClefs.inviterAuteur({
          idMotClef,
          idCompteAuteur: idsBdCompte[1],
          rôle: MODÉRATEUR,
        });

        await résMotClef.attendreQue(
          (auteurs) =>
            !!auteurs &&
            auteurs.find((a) => a.idCompte === idsBdCompte[1])?.rôle ===
              MODÉRATEUR,
        );
      });

      it("Variables : Inviter auteur", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsBdCompte[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsBdCompte[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];
        await clients[0].variables.inviterAuteur({
          idVariable,
          idCompteAuteur: idsBdCompte[1],
          rôle: MEMBRE,
        });

        const val = await résVariable.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Variables : Accepter invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsBdCompte[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsBdCompte[1],
            accepté: true,
            rôle: MEMBRE,
          },
        ];

        await clients[1].variables.ajouterÀMesVariables({
          idVariable,
        });
        const val = await résVariable.attendreQue(
          (x) => !!x?.find((y) => y.idCompte === idsBdCompte[1])?.accepté,
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Variables : Refuser invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsBdCompte[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsBdCompte[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];

        await clients[1].variables.enleverDeMesVariables({
          idVariable,
        });
        const val = await résVariable.attendreQue(
          (x) => !!x && !x.find((y) => y.idCompte === idsBdCompte[1])?.accepté,
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Variables : Promotion à modérateur", async () => {
        await clients[0].variables.inviterAuteur({
          idVariable,
          idCompteAuteur: idsBdCompte[1],
          rôle: MODÉRATEUR,
        });

        await résVariable.attendreQue(
          (auteurs) =>
            !!auteurs &&
            auteurs.find((a) => a.idCompte === idsBdCompte[1])?.rôle ===
              MODÉRATEUR,
        );
      });

      it("Bds : Inviter auteur", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsBdCompte[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsBdCompte[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];
        await clients[0].bds.inviterAuteur({
          idBd,
          idCompteAuteur: idsBdCompte[1],
          rôle: MEMBRE,
        });

        const val = await résBds.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Bds : Accepter invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsBdCompte[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsBdCompte[1],
            accepté: true,
            rôle: MEMBRE,
          },
        ];

        await clients[1].bds.ajouterÀMesBds({ idBd });
        const val = await résBds.attendreQue((x) =>
          Boolean(!!x && x.find((y) => y.idCompte === idsBdCompte[1])?.accepté),
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Bds : Refuser invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsBdCompte[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsBdCompte[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];

        await clients[1].bds.enleverDeMesBds({ idBd });
        const val = await résBds.attendreQue(
          (x) => !!x && !x.find((y) => y.idCompte === idsBdCompte[1])?.accepté,
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Bds : Promotion à modérateur", async () => {
        await clients[0].bds.inviterAuteur({
          idBd,
          idCompteAuteur: idsBdCompte[1],
          rôle: MODÉRATEUR,
        });

        await résBds.attendreQue(
          (auteurs) =>
            !!auteurs &&
            auteurs.find((a) => a.idCompte === idsBdCompte[1])?.rôle ===
              MODÉRATEUR,
        );
      });

      it("Projets : Inviter auteur", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsBdCompte[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsBdCompte[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];
        await clients[0].projets.inviterAuteur({
          idProjet,
          idCompteAuteur: idsBdCompte[1],
          rôle: MEMBRE,
        });

        const val = await résProjet.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.have.deep.members(réf);
      });
      it("Projets : Accepter invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsBdCompte[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsBdCompte[1],
            accepté: true,
            rôle: MEMBRE,
          },
        ];

        await clients[1].projets.ajouterÀMesProjets({ idProjet });
        const val = await résProjet.attendreQue((x) =>
          Boolean(!!x && x.find((y) => y.idCompte === idsBdCompte[1])?.accepté),
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Projets : Refuser invitation", async () => {
        const réf: infoAuteur[] = [
          {
            idCompte: idsBdCompte[0],
            accepté: true,
            rôle: MODÉRATEUR,
          },
          {
            idCompte: idsBdCompte[1],
            accepté: false,
            rôle: MEMBRE,
          },
        ];

        await clients[1].projets.enleverDeMesProjets({ idProjet });
        const val = await résProjet.attendreQue(
          (x) => !!x && !x.find((y) => y.idCompte === idsBdCompte[1])?.accepté,
        );

        expect(val).to.have.deep.members(réf);
      });
      it("Projets : Promotion à modérateur", async () => {
        await clients[0].projets.inviterAuteur({
          idProjet,
          idCompteAuteur: idsBdCompte[1],
          rôle: MODÉRATEUR,
        });

        await résProjet.attendreQue(
          (auteurs) =>
            !!auteurs &&
            auteurs.find((a) => a.idCompte === idsBdCompte[1])?.rôle ===
              MODÉRATEUR,
        );
      });
    });

    describe("Suivre membre", function () {
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let clients: Constellation[];
      let IMAGE: Buffer;

      const résNom = new utilsTestAttente.AttendreRésultat<{
        [key: string]: string;
      }>();
      const résCourriel = new utilsTestAttente.AttendreRésultat<
        string | null
      >();
      const résImage =
        new utilsTestAttente.AttendreRésultat<Uint8Array | null>();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        IMAGE = await obtRessourceTest({
          nomFichier: "logo.svg",
        });

        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2));

        fsOublier.push(
          await clients[1].profil.suivreNoms({
            idCompte: idsBdCompte[0],
            f: (n) => résNom.mettreÀJour(n),
          }),
        );
        fsOublier.push(
          await clients[1].profil.suivreCourriel({
            idCompte: idsBdCompte[0],
            f: (c) => résCourriel.mettreÀJour(c),
          }),
        );
        fsOublier.push(
          await clients[1].profil.suivreImage({
            idCompte: idsBdCompte[0],
            f: (i) => résImage.mettreÀJour(i),
          }),
        );
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        if (fOublierClients) await fOublierClients();
        résNom.toutAnnuler();
        résCourriel.toutAnnuler();
        résImage.toutAnnuler();
      });

      it("Nom détecté", async () => {
        await clients[0].profil.sauvegarderNom({
          langue: "fr",
          nom: "Julien",
        });

        const val = await résNom.attendreQue((x) => !!x && Boolean(x.fr));
        expect(val.fr).to.equal("Julien");
      });

      it("Courriel détecté", async () => {
        await clients[0].profil.sauvegarderCourriel({
          courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
        });

        const val = await résCourriel.attendreQue(
          (x: string | null | undefined) => Boolean(x),
        );
        expect(val).to.equal("தொடர்பு@லஸ்ஸி.இந்தியா");
      });

      it("Image détectée", async () => {
        await clients[0].profil.sauvegarderImage({
          image: { contenu: IMAGE, nomFichier: "image.svg" },
        });

        const val = await résImage.attendreExiste();
        expect(val).to.deep.equal(new Uint8Array(IMAGE));
      });

      it.skip("Protocoles détectés");
    });

    describe("Suivre mots-clefs", function () {
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let clients: Constellation[];

      let idMotClef1: string;
      let idMotClef2: string;

      const résPropres = new utilsTestAttente.AttendreRésultat<string[]>();
      const résAutres = new utilsTestAttente.AttendreRésultat<string[]>();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2));
        fsOublier.push(
          await clients[1].réseau.suivreMotsClefsMembre({
            idCompte: idsBdCompte[0],
            f: (motsClefs) => résAutres.mettreÀJour(motsClefs),
          }),
        );
        fsOublier.push(
          await clients[1].réseau.suivreMotsClefsMembre({
            idCompte: idsBdCompte[1],
            f: (motsClefs) => résPropres.mettreÀJour(motsClefs),
          }),
        );
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        if (fOublierClients) await fOublierClients();
        résPropres.toutAnnuler();
        résAutres.toutAnnuler();
      });

      it("Mes propres mots-clefs détectés", async () => {
        idMotClef2 = await clients[1].motsClefs.créerMotClef();

        const val = await résPropres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idMotClef2);
      });

      it("Mot-clef d'un autre membre détecté", async () => {
        idMotClef1 = await clients[0].motsClefs.créerMotClef();
        const val = await résAutres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idMotClef1);
      });
    });

    describe("Suivre variables", function () {
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let clients: Constellation[];

      let idVariable1: string;
      let idVariable2: string;

      const résPropres = new utilsTestAttente.AttendreRésultat<string[]>();
      const résAutres = new utilsTestAttente.AttendreRésultat<string[]>();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2));
        fsOublier.push(
          await clients[1].réseau.suivreVariablesMembre({
            idCompte: idsBdCompte[0],
            f: (variables) => résAutres.mettreÀJour(variables),
          }),
        );
        fsOublier.push(
          await clients[1].réseau.suivreVariablesMembre({
            idCompte: idsBdCompte[1],
            f: (variables) => résPropres.mettreÀJour(variables),
          }),
        );
      });

      after(async () => {
        résPropres.toutAnnuler();
        résAutres.toutAnnuler();

        await Promise.all(fsOublier.map((f) => f()));
        if (fOublierClients) await fOublierClients();
      });

      it("Mes variables détectées", async () => {
        idVariable2 = await clients[1].variables.créerVariable({
          catégorie: "numérique",
        });

        const val = await résPropres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idVariable2);
      });

      it("Variable d'un autre membre détectée", async () => {
        idVariable1 = await clients[0].variables.créerVariable({
          catégorie: "numérique",
        });
        const val = await résAutres.attendreQue((x) => Boolean(x?.length));
        expect(val).to.contain(idVariable1);
      });
    });

    describe("Suivre BDs", function () {
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let clients: Constellation[];

      const résPropres = new utilsTestAttente.AttendreRésultat<string[]>();
      const résAutres = new utilsTestAttente.AttendreRésultat<string[]>();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2));
        fsOublier.push(
          await clients[1].réseau.suivreBdsMembre({
            idCompte: idsBdCompte[0],
            f: (bds) => résAutres.mettreÀJour(bds),
          }),
        );
        fsOublier.push(
          await clients[1].réseau.suivreBdsMembre({
            idCompte: idsBdCompte[1],
            f: (bds) => résPropres.mettreÀJour(bds),
          }),
        );
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        if (fOublierClients) await fOublierClients();
        résPropres.toutAnnuler();
        résAutres.toutAnnuler();
      });

      it("Mes BDs détectées", async () => {
        const idBd = await clients[1].bds.créerBd({ licence: "ODbl-1_0" });

        const val = await résPropres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idBd);
      });

      it("BD d'un autre membre détectée", async () => {
        const idBd = await clients[0].bds.créerBd({ licence: "ODbl-1_0" });
        const val = await résAutres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idBd);
      });
    });

    describe("Suivre projets", function () {
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let clients: Constellation[];

      const résPropres = new utilsTestAttente.AttendreRésultat<string[]>();
      const résAutres = new utilsTestAttente.AttendreRésultat<string[]>();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2));
        fsOublier.push(
          await clients[1].réseau.suivreProjetsMembre({
            idCompte: idsBdCompte[0],
            f: (projets) => résAutres.mettreÀJour(projets),
          }),
        );
        fsOublier.push(
          await clients[1].réseau.suivreProjetsMembre({
            idCompte: idsBdCompte[1],
            f: (projets) => résPropres.mettreÀJour(projets),
          }),
        );
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        if (fOublierClients) await fOublierClients();
        résPropres.toutAnnuler();
        résAutres.toutAnnuler();
      });

      it("Mes projets détectés", async () => {
        const idProjet = await clients[1].projets.créerProjet();

        const val = await résPropres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idProjet);
      });

      it("Projet d'un autre membre détecté", async () => {
        const idProjet = await clients[0].projets.créerProjet();
        const val = await résAutres.attendreQue((x) => !!x && !!x.length);
        expect(val).to.contain(idProjet);
      });
    });

    describe("Suivre favoris", function () {
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let clients: Constellation[];

      let idMotClef: string;

      const résPropres = new utilsTestAttente.AttendreRésultat<
        ÉpingleFavorisAvecId[]
      >();
      const résAutres = new utilsTestAttente.AttendreRésultat<
        ÉpingleFavorisAvecId[]
      >();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2));

        fsOublier.push(
          await clients[1].réseau.suivreFavorisMembre({
            idCompte: idsBdCompte[0],
            f: (favoris) => résAutres.mettreÀJour(favoris),
          }),
        );
        fsOublier.push(
          await clients[1].réseau.suivreFavorisMembre({
            idCompte: idsBdCompte[1],
            f: (favoris) => résPropres.mettreÀJour(favoris),
          }),
        );

        idMotClef = await clients[0].motsClefs.créerMotClef({épingler: false});
      });

      after(async () => {
        résPropres.toutAnnuler();
        résAutres.toutAnnuler();

        await Promise.all(fsOublier.map((f) => f()));
        if (fOublierClients) await fOublierClients();
      });

      it("Mes favoris détectés", async () => {
        const réf: ÉpingleFavorisAvecId[] = [
          {
            idObjet: idMotClef,
            épingle: {
              type: "motClef"
            }
          },
        ];

        await clients[1].favoris.épinglerFavori({
          idObjet: idMotClef,
          épingle: {
            type: "motClef"
          },
        });
        const val = await résPropres.attendreQue((x) => x.length > 0);
        expect(val).to.have.deep.members(réf);
      });

      it("Favoris d'un autre membre détectés", async () => {
        const réf: ÉpingleFavorisAvecId[] = [
          {
            idObjet: idMotClef,
            épingle: {
              type: "motClef"
            }
          },
        ];

        await clients[0].favoris.épinglerFavori({
          idObjet: idMotClef,
          épingle: {
            type: "motClef"
          },
        });
        const val = await résAutres.attendreQue((x) => x.length > 0);
        expect(val).to.have.deep.members(réf);
      });
    });

    describe("Suivre favoris objet", function () {
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let clients: Constellation[];

      let idMotClef: string;
      let fOublier: schémaFonctionOublier;

      const rés = new utilsTestAttente.AttendreRésultat<
        {épingle: ÉpingleFavorisAvecId; idCompte: string }[]
      >();

      before(async () => {
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2));
        idMotClef = await clients[0].motsClefs.créerMotClef({
          épingler: false,
        });

        ({ fOublier } = await clients[0].réseau.suivreFavorisObjet({
          idObjet: idMotClef,
          f: (favoris) => rés.mettreÀJour(favoris),
          profondeur: 4,
        }));
      });

      after(async () => {
        if (fOublier) await fOublier();
        if (fOublierClients) await fOublierClients();
        rés.toutAnnuler();
      });

      it("Aucun favoris pour commencer", async () => {
        const val = await rés.attendreExiste();
        expect(val.length).to.equal(0);
      });

      it("Ajout à mes favoris détecté", async () => {
        const réf: {épingle: ÉpingleFavorisAvecId; idCompte: string }[] = [
          {
            idCompte: idsBdCompte[0],
            épingle: {
              idObjet: idMotClef,
              épingle: {
              type: "motClef"
            }}
          },
        ];
        await clients[0].favoris.épinglerFavori({
          idObjet: idMotClef,
          épingle: { type: "motClef" }
        });
        const val = await rés.attendreQue((x) => !!x && !!x.length);

        expect(val).to.have.deep.members(réf);
      });

      it("Ajout aux favoris d'un autre membre détecté", async () => {
        const réf: {épingle: ÉpingleFavorisAvecId; idCompte: string }[] = [
          {
            idCompte: idsBdCompte[0],
            épingle: {
              épingle: {type: "motClef"},
              idObjet: idMotClef
            }
          },
          {
            idCompte: idsBdCompte[1],
            épingle: {
              épingle: {type: "motClef"},
              idObjet: idMotClef
            }
          },
        ];
        await clients[1].favoris.épinglerFavori({
          idObjet: idMotClef,
          épingle: {
            type: "motClef"
          }
        });
        const val = await rés.attendreQue((x) => !!x && x.length === 2);

        expect(val).to.have.deep.members(réf);
      });
    });

    describe("Suivre réplications", function () {
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let idsOrbite: string[];
      let clients: Constellation[];

      let idBd: string;

      const rés = new utilsTestAttente.AttendreRésultat<infoRéplications>();
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ idsBdCompte, idsOrbite, clients, fOublierClients } =
          await toutPréparer(2));
        idBd = await clients[0].bds.créerBd({ licence: "ODbl-1_0" });
        fsOublier.push(
          (
            await clients[0].réseau.suivreRéplications({
              idObjet: idBd,
              f: (bds) => rés.mettreÀJour(bds),
              profondeur: 4,
            })
          ).fOublier,
        );
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        if (fOublierClients) await fOublierClients();
        rés.toutAnnuler();
      });

      it("Auteur de la BD pour commencer", async () => {
        await clients[0].favoris.épinglerFavori({
          idObjet: idBd,
          épingle: {type: "motClef"}
        });

        const val = await rés.attendreQue((x) => !!x && x.membres.length > 0);

        expect(val.membres.map((m) => m.infoMembre.idCompte)).to.contain(
          idsBdCompte[0],
        );
        expect(val.dispositifs.map((d) => d.dispositif.idDispositif)).to.contain(
          idsOrbite[0],
        );
      });

      it("Ajout d'une réplication détectée", async () => {
        await clients[1].favoris.épinglerFavori({
          idObjet: idBd,
          épingle: {type: "bd"},
        });

        const val = await rés.attendreQue((x) => !!x && x.membres.length > 1);

        expect(val.membres.map((m) => m.infoMembre.idCompte)).to.have.members([
          idsBdCompte[0],
          idsBdCompte[1],
        ]);
        expect(val.dispositifs.map((d) => d.dispositif.idDispositif)).to.have.members([
          idsOrbite[0],
          idsOrbite[1],
        ]);
      });
    });

    describe("Suivre BD par mot-clef unique", function () {
      let fOublierClients: () => Promise<void>;
      let idsBdCompte: string[];
      let clients: Constellation[];

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
        ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2));
        const idVarClef = await clients[0].variables.créerVariable({
          catégorie: "chaîneNonTraductible",
        });
        const idVarLangue = await clients[0].variables.créerVariable({
          catégorie: "chaîneNonTraductible",
        });
        const idVarTrad = await clients[0].variables.créerVariable({
          catégorie: "chaîneNonTraductible",
        });

        idNuée = await clients[0].nuées.créerNuée({});

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

        idBd1 = await clients[0].bds.créerBdDeSchéma({ schéma });
        idBd2 = await clients[1].bds.créerBdDeSchéma({ schéma });

        await clients[0].bds.rejoindreNuées({
          idsNuées: idNuée,
          idBd: idBd1,
        });
        await clients[1].bds.rejoindreNuées({
          idsNuées: idNuée,
          idBd: idBd2,
        });

        idTableau1 = (
          await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>,
            ): Promise<schémaFonctionOublier> => {
              return await clients[0].bds.suivreTableauxBd({
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
              return await clients[1].bds.suivreTableauxBd({
                idBd: idBd2,
                f: fSuivi,
              });
            },
          )
        )[0].id;

        fsOublier.push(
          (
            await clients[0].réseau.suivreBdsDeNuée({
              idNuée,
              f: (bds) => résBds.mettreÀJour(bds),
            })
          ).fOublier,
        );
        fsOublier.push(
          (
            await clients[0].réseau.suivreÉlémentsDeTableauxUniques({
              idNuéeUnique: idNuée,
              clef: clefTableau,
              f: (éléments) => résÉléments.mettreÀJour(éléments),
            })
          ).fOublier,
        );

        id1 = (
          await clients[0].tableaux.ajouterÉlément({
            idTableau: idTableau1,
            vals: données1,
          })
        )[0];
        id2 = (
          await clients[0].tableaux.ajouterÉlément({
            idTableau: idTableau1,
            vals: données2,
          })
        )[0];
        id3 = (
          await clients[1].tableaux.ajouterÉlément({
            idTableau: idTableau2,
            vals: données3,
          })
        )[0];
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        if (fOublierClients) await fOublierClients();
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
            idCompte: idsBdCompte[0],
            élément: {
              id: id1,
              données: données1,
            },
          },
          {
            idCompte: idsBdCompte[0],
            élément: {
              id: id2,
              données: données2,
            },
          },
          {
            idCompte: idsBdCompte[1],
            élément: {
              id: id3,
              données: données3,
            },
          },
        ];

        expect(élémentsSansId).to.have.deep.members(réf);
      });
    });
  });
}
