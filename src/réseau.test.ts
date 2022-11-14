import isArray from "lodash/isArray";
import fs from "fs";
import path from "path";

import { enregistrerContrôleurs } from "@/accès";
import { MODÉRATEUR, MEMBRE } from "@/accès/consts";
import ClientConstellation from "@/client.js";
import {
  schémaFonctionSuivi,
  schémaRetourFonctionRecherche,
  schémaFonctionOublier,
  uneFois,
  infoAuteur,
} from "@/utils/index.js";
import { ÉlémentFavorisAvecObjet } from "@/favoris";
import {
  élémentDeMembre,
  statutDispositif,
  infoBloqué,
  infoConfiance,
  infoMembre,
  statutMembre,
  infoRelation,
  infoMembreRéseau,
  infoRéplications,
} from "@/reseau";
import { schémaSpécificationBd, infoTableauAvecId } from "@/bds";
import { élémentBdListeDonnées } from "@/tableaux";

import {
  AttendreRésultat,
  générerClients,
  typesClients,
  dirRessourcesTests,
} from "@/utilsTests";
import { config } from "@/utilsTests/sfipTest";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Réseau", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation,
        client2: ClientConstellation,
        client3: ClientConstellation;
      let idBdCompte1: string;
      let idBdCompte2: string;
      let idBdCompte3: string;
      let idNodeSFIP1: string, idNodeSFIP2: string, idNodeSFIP3: string;
      let idOrbite1: string, idOrbite2: string, idOrbite3: string;
      let moiMême: infoMembreRéseau;

      beforeAll(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          3,
          type
        ));
        [client, client2, client3] = clients;

        enregistrerContrôleurs();

        idNodeSFIP1 = (await client.obtIdSFIP()).id.toCID().toString();
        idNodeSFIP2 = (await client2.obtIdSFIP()).id.toCID().toString();
        idNodeSFIP3 = (await client3.obtIdSFIP()).id.toCID().toString();

        idOrbite1 = await client.obtIdOrbite();
        idOrbite2 = await client2.obtIdOrbite();
        idOrbite3 = await client3.obtIdOrbite();

        idBdCompte1 = await client.obtIdCompte();
        idBdCompte2 = await client2.obtIdCompte();
        idBdCompte3 = await client3.obtIdCompte();

        moiMême = {
          idBdCompte: idBdCompte1,
          confiance: 1,
          profondeur: 0,
        };
      }, config.patienceInit * 3);

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("Suivre postes", function () {
        const rés = new AttendreRésultat<{ addr: string; peer: string }[]>();
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.réseau!.suivreConnexionsPostesSFIP({
            f: (c) => (rés.mettreÀJour(c)),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });

        test("Autres postes détectés", async () => {
          expect(rés.val.map((r) => r.peer)).toEqual(
            expect.arrayContaining([idNodeSFIP2, idNodeSFIP3])
          );
        });
      });

      describe("Suivre dispositifs en ligne", function () {
        const dispositifs = new AttendreRésultat<statutDispositif[]>();
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.réseau!.suivreConnexionsDispositifs({
            f: (d) => dispositifs.mettreÀJour(d),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
          dispositifs.toutAnnuler();
        });

        test("Autres dispositifs détectés", async () => {
          const val = await dispositifs.attendreQue(
            (x?: statutDispositif[]) => !!x && x.length === 3
          );
          expect(val.map((d) => d.infoDispositif.idOrbite)).toEqual(
            expect.arrayContaining([idOrbite1, idOrbite2, idOrbite3])
          );
        });
      });

      describe("Suivre membres en ligne", function () {
        const rés = new AttendreRésultat<statutMembre[]>();
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.réseau!.suivreConnexionsMembres({
            f: (c) => (rés.mettreÀJour(c)),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler()
        });

        test("Autres membres détectés", async () => {
          const identitéOrbite1 = await client.obtIdentitéOrbite();
          const identitéOrbite2 = await client2.obtIdentitéOrbite();
          const identitéOrbite3 = await client3.obtIdentitéOrbite();

          const réfRés: infoMembre[] = [
            {
              idBdCompte: idBdCompte1,
              dispositifs: [
                {
                  idSFIP: idNodeSFIP1,
                  idOrbite: idOrbite1,
                  idCompte: idBdCompte1,
                  clefPublique: identitéOrbite1.publicKey,
                  encryption: {
                    type: await client.encryption.obtNom(),
                    clefPublique: (await client.encryption.obtClefs()).publique,
                  },
                  signatures: identitéOrbite1.signatures,
                },
              ],
            },
            {
              idBdCompte: idBdCompte2,
              dispositifs: [
                {
                  idSFIP: idNodeSFIP2,
                  idOrbite: idOrbite2,
                  idCompte: idBdCompte2,
                  clefPublique: identitéOrbite2.publicKey,
                  encryption: {
                    type: await client2.encryption.obtNom(),
                    clefPublique: (await client2.encryption.obtClefs())
                      .publique,
                  },
                  signatures: identitéOrbite2.signatures,
                },
              ],
            },
            {
              idBdCompte: idBdCompte3,
              dispositifs: [
                {
                  idSFIP: idNodeSFIP3,
                  idOrbite: idOrbite3,
                  idCompte: idBdCompte3,
                  clefPublique: identitéOrbite3.publicKey,
                  encryption: {
                    type: await client3.encryption.obtNom(),
                    clefPublique: (await client3.encryption.obtClefs())
                      .publique,
                  },
                  signatures: identitéOrbite3.signatures,
                },
              ],
            },
          ];
          const val = await rés.attendreQue(x=>x.length >= 3)
          expect(val.map((r) => r.infoMembre)).toEqual(
            expect.arrayContaining(réfRés)
          );
        });
      });

      describe("Membres fiables", function () {
        const fiablesPropres = new AttendreRésultat<string[]>();
        const fiablesAutres = new AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client.réseau!.suivreFiables({
              f: (m) => (fiablesPropres.mettreÀJour(m)),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreFiables({
              f: (m) => (fiablesAutres.mettreÀJour(m)),
              idBdCompte: idBdCompte1,
            })
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          fiablesPropres.toutAnnuler();
          fiablesAutres.toutAnnuler();
        });

        test("Personne pour commencer", async () => {
          expect(fiablesPropres.val).toHaveLength(0);
        });

        test("Faire confiance", async () => {
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          expect(isArray(fiablesPropres.val)).toBe(true);
          expect(fiablesPropres.val).toHaveLength(1);
          expect(fiablesPropres.val).toEqual(
            expect.arrayContaining([idBdCompte2])
          );
        });

        test("Détecter confiance d'autre membre", async () => {
          const val = await fiablesAutres.attendreQue((x) => !!x && x.length > 0);
          expect(isArray(val)).toBe(true);
          expect(val).toHaveLength(1);
          expect(val).toEqual(expect.arrayContaining([idBdCompte2]));
        });

        test("Un débloquage accidental ne fait rien", async () => {
          await client.réseau!.débloquerMembre({ idBdCompte: idBdCompte2 });
          expect(isArray(fiablesPropres.val)).toBe(true);
          expect(fiablesPropres.val).toHaveLength(1);
          expect(fiablesPropres.val).toEqual(
            expect.arrayContaining([idBdCompte2])
          );
        });

        test("Changer d'avis", async () => {
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          expect(fiablesPropres.val).toHaveLength(0);
        });
      });

      describe("Membres bloqués", function () {
        const bloquésTous = new AttendreRésultat<infoBloqué[]>();
        const bloquésPubliques = new AttendreRésultat<string[]>();
        const bloquésAutreMembre = new AttendreRésultat<infoBloqué[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client.réseau!.suivreBloqués({ f: (m) => (bloquésTous.mettreÀJour(m)) })
          );
          fsOublier.push(
            await client.réseau!.suivreBloquésPubliques({
              f: (m) => (bloquésPubliques.mettreÀJour(m)),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreBloqués({
              f: (m) => (bloquésAutreMembre.mettreÀJour(m)),
              idBdCompte: idBdCompte1,
            })
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          await client.réseau!.débloquerMembre({ idBdCompte: idBdCompte2 });
          await client.réseau!.débloquerMembre({ idBdCompte: idBdCompte3 });

          bloquésTous.toutAnnuler()
          bloquésPubliques.toutAnnuler()
          bloquésAutreMembre.toutAnnuler()
        });

        test("Personne pour commencer", async () => {
          expect(bloquésPubliques.val).toHaveLength(0);
        });

        test("Bloquer quelqu'un", async () => {
          await client.réseau!.bloquerMembre({ idBdCompte: idBdCompte2 });
          expect(isArray(bloquésTous.val));
          expect(bloquésTous.val).toHaveLength(1);
          expect(bloquésTous.val).toEqual(
            expect.arrayContaining([
              {
                idBdCompte: idBdCompte2,
                privé: false,
              },
            ])
          );
          expect(bloquésPubliques.val).toEqual(
            expect.arrayContaining([idBdCompte2])
          );
        });

        test("Un dé-confiance accidental ne fait rien", async () => {
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });

          expect(bloquésTous.val).toEqual(
            expect.arrayContaining([
              {
                idBdCompte: idBdCompte2,
                privé: false,
              },
            ])
          );
        });

        test("Bloquer privé", async () => {
          await client.réseau!.bloquerMembre({
            idBdCompte: idBdCompte3,
            privé: true,
          });
          expect(bloquésTous.val).toEqual(
            expect.arrayContaining([
              {
                idBdCompte: idBdCompte2,
                privé: false,
              },
              {
                idBdCompte: idBdCompte3,
                privé: true,
              },
            ])
          );
        });

        test("On détecte bloqué publique d'un autre membre", async () => {
          const val = await bloquésAutreMembre.attendreQue(
            (x) => !!x && x.length > 0
          );
          expect(val).toEqual(
            expect.arrayContaining([
              {
                idBdCompte: idBdCompte2,
                privé: false,
              },
            ])
          );
        });

        test("On ne détecte pas le bloqué privé d'un autre membre", async () => {
          expect(bloquésAutreMembre.val.map((b) => b.idBdCompte)).not.toContain(
            idBdCompte3
          );
        });

        test("Débloquer publique", async () => {
          await client.réseau!.débloquerMembre({ idBdCompte: idBdCompte2 });
          expect(bloquésPubliques.val).toHaveLength(0);
        });

        test("Débloquer privé", async () => {
          await client.réseau!.débloquerMembre({ idBdCompte: idBdCompte3 });
          expect(bloquésTous.val).toHaveLength(0);
        });
      });

      describe("Suivre relations immédiates", function () {
        let idMotClef1: string;
        let idMotClef2: string;
        let idBd: string;
        let idVariable: string;
        let idProjet: string;

        const relationsPropres = new AttendreRésultat<infoConfiance[]>();
        const relationsAutres = new AttendreRésultat<infoConfiance[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client.réseau!.suivreRelationsImmédiates({
              f: (c) => (relationsPropres.mettreÀJour(c)),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreRelationsImmédiates({
              f: (c) => (relationsAutres.mettreÀJour(c)),
              idBdCompte: idBdCompte1,
            })
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (idMotClef1)
            await client2.motsClefs!.effacerMotClef({ id: idMotClef1 });
          if (idMotClef2)
            await client2.motsClefs!.effacerMotClef({ id: idMotClef2 });
          if (idBd) await client.bds!.effacerBd({ id: idBd });
          if (idProjet) await client.projets!.effacerProjet({ id: idProjet });

          relationsPropres.toutAnnuler()
          relationsAutres.toutAnnuler()
        });

        test("Personne pour commencer", async () => {
          const propres = await relationsPropres.attendreQue((x) => x?.length === 0);
          const autres = await relationsAutres.attendreQue((x) => x?.length === 0);

          expect(isArray(propres)).toBe(true);
          expect(propres).toHaveLength(0);

          expect(isArray(autres)).toBe(true);
          expect(autres).toHaveLength(0);
        });

        test("Ajout membre de confiance détecté", async () => {
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toEqual(
            expect.arrayContaining([idBdCompte2])
          );
        });

        test("Bloquer membre détecté", async () => {
          await client.réseau!.bloquerMembre({ idBdCompte: idBdCompte3 });
          const val = await relationsPropres.attendreQue(
            (x) => !!x && x.length === 2
          );
          expect(val.map((r) => r.idBdCompte)).toEqual(
            expect.arrayContaining([idBdCompte3])
          );
        });

        test("Débloquer membre détecté", async () => {
          await client.réseau!.débloquerMembre({ idBdCompte: idBdCompte3 });
          await relationsPropres.attendreQue(
            (x) => !!x && x.length === 1
          );
        });

        test("Ajout membres au réseau d'un autre membre détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x?: infoConfiance[]) => x?.length === 1
          );

          expect(val.map((r) => r.idBdCompte)).toEqual(
            expect.arrayContaining([idBdCompte2])
          );
        });

        test("Enlever membre de confiance détecté", async () => {
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          expect(relationsPropres.val).toHaveLength(0);
        });

        test("Ajout aux favoris détecté", async () => {
          idMotClef2 = await client2.motsClefs!.créerMotClef();
          await client.favoris!.épinglerFavori({
            id: idMotClef2,
            dispositifs: "TOUS",
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Ajout aux favoris d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Enlever favori détecté", async () => {
          await client.favoris!.désépinglerFavori({ id: idMotClef2 });
          expect(relationsPropres.val).toHaveLength(0);

          const val = await relationsAutres.attendreQue(
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(val).toHaveLength(0);
        });

        test("Ajout coauteur BD détecté", async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          await client.bds!.inviterAuteur({
            idBd,
            idBdCompteAuteur: idBdCompte2,
            rôle: MEMBRE,
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );

          expect(val.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Ajout coauteur BD d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Enlever bd détecté", async () => {
          await client.bds!.effacerBd({ id: idBd });

          expect(relationsPropres.val).toHaveLength(0);

          const val = await relationsAutres.attendreQue(
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(val).toHaveLength(0);
        });

        test("Ajout coauteur projet détecté", async () => {
          idProjet = await client.projets!.créerProjet();
          await client.projets!.inviterAuteur({
            idProjet,
            idBdCompteAuteur: idBdCompte2,
            rôle: MEMBRE,
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Ajout coauteur projet d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Enlever projet détecté", async () => {
          await client.projets!.effacerProjet({ id: idProjet });

          expect(relationsPropres.val).toHaveLength(0);

          const val = await relationsAutres.attendreQue(
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(val).toHaveLength(0);
        });

        test("Ajout coauteur variable détecté", async () => {
          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          await client.variables!.inviterAuteur({
            idVariable,
            idBdCompteAuteur: idBdCompte2,
            rôle: MEMBRE,
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );

          expect(val.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Ajout coauteur variable d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Enlever variable détecté", async () => {
          await client.variables!.effacerVariable({ id: idVariable });

          expect(relationsPropres.val).toHaveLength(0);

          const val = await relationsAutres.attendreQue(
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(val).toHaveLength(0);
        });

        test("Ajout coauteur mot-clef détecté", async () => {
          idMotClef1 = await client.motsClefs!.créerMotClef();
          await client.motsClefs!.inviterAuteur({
            idMotClef: idMotClef1,
            idBdCompteAuteur: idBdCompte2,
            rôle: MEMBRE,
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Ajout coauteur mot-clef d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Enlever mot-clef détecté", async () => {
          await client.motsClefs!.effacerMotClef({ id: idMotClef1 });

          expect(relationsPropres.val).toHaveLength(0);

          await relationsAutres.attendreQue(
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(relationsAutres.val).toHaveLength(0);
        });
      });

      describe("Suivre relations confiance", function () {
        let fOublier: schémaFonctionOublier;
        let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];
        const rés = new AttendreRésultat<infoRelation[]>;

        beforeAll(async () => {
          ({ fOublier, fChangerProfondeur } =
            await client.réseau!.suivreRelationsConfiance({
              f: (r) => (rés.mettreÀJour(r)),
              profondeur: 2,
            }));
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client2.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
          rés.toutAnnuler();
        });

        test("Relations immédiates", async () => {
          const réf: infoRelation[] = [
            {
              de: idBdCompte1,
              pour: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
          ];
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });

          const val = await rés.attendreQue((x) => !!x && !!x.length);
          expect(val).toEqual(réf);
        });
        test("Relations indirectes", async () => {
          const réf: infoRelation[] = [
            {
              de: idBdCompte1,
              pour: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
            {
              de: idBdCompte2,
              pour: idBdCompte3,
              confiance: 1,
              profondeur: 2,
            },
          ];
          await client2.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });

          const val = await rés.attendreQue((x) => !!x && x.length > 1);
          expect(val).toEqual(réf);
        });

        test("Diminuer profondeur", async () => {
          const réf: infoRelation[] = [
            {
              de: idBdCompte1,
              pour: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
          ];
          fChangerProfondeur(1);
          const val = await rés.attendreQue((x) => !!x && x.length === 1);
          expect(val).toEqual(réf);
        });

        test("Augmenter profondeur", async () => {
          const réf: infoRelation[] = [
            {
              de: idBdCompte1,
              pour: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
            {
              de: idBdCompte2,
              pour: idBdCompte3,
              confiance: 1,
              profondeur: 2,
            },
          ];

          fChangerProfondeur(2);

          const val = await rés.attendreQue((x) => !!x && x.length === 2);
          expect(val).toEqual(réf);
        });
      });

      describe("Suivre comptes réseau", function () {
        let fOublier: schémaFonctionOublier;
        let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];

        const rés = new AttendreRésultat<infoMembreRéseau[]>();

        beforeAll(async () => {
          ({ fOublier, fChangerProfondeur } =
            await client.réseau!.suivreComptesRéseau({
              f: (c) => (rés.mettreÀJour(c)),
              profondeur: 2,
            }));
        });

        afterAll(async () => {
          if (fOublier) await fOublier();

          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
          await client2.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
          await client2.réseau!.débloquerMembre({
            idBdCompte: idBdCompte3,
          });
          await client.réseau!.débloquerMembre({
            idBdCompte: idBdCompte2,
          });
          rés.toutAnnuler();
        }, config.patience);

        test("Relations confiance immédiates", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
          ];
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });

          const val = await rés.attendreQue((x) => !!x && x.length > 1);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test(
          "Relations confiance indirectes",
          async () => {
            const réf: infoMembreRéseau[] = [
              moiMême,
              {
                idBdCompte: idBdCompte2,
                confiance: 1,
                profondeur: 1,
              },
              {
                idBdCompte: idBdCompte3,
                confiance: 0.8,
                profondeur: 2,
              },
            ];
            await client2.réseau!.faireConfianceAuMembre({
              idBdCompte: idBdCompte3,
            });

            await rés.attendreQue((x) => !!x && x.length > 2);
            expect(rés.val).toEqual(expect.arrayContaining(réf));
          },
          config.patience
        );
        test("Relations confiance directes et indirectes", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 1,
              profondeur: 1,
            },
          ];
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });

          const val = await rés.attendreQue(
            (x) =>
              !!x && x.map((y) => y.confiance).reduce((i, j) => i * j, 1) === 1
          );
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Enlever relation confiance directe (en double)", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 0.8,
              profondeur: 2,
            },
          ];
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });

          const val = await rés.attendreQue(
            (x) =>
              !!x && x.map((y) => y.confiance).reduce((i, j) => i * j, 1) < 1
          );
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Enlever relation confiance indirecte", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
          ];
          await client2.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });

          const val = await rés.attendreQue((x) => !!x && x.length === 2);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Enlever relation confiance directe", async () => {
          const réf = [moiMême];

          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });

          const val = await rés.attendreQue((x) => !!x && x.length === 1);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Membre bloqué directement", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: -1,
              profondeur: 1,
            },
          ];
          await client.réseau!.bloquerMembre({
            idBdCompte: idBdCompte2,
          });

          const val = await rés.attendreQue((x) => !!x && x.length > 1);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Membre débloqué directement", async () => {
          const réf = [moiMême];

          await client.réseau!.débloquerMembre({
            idBdCompte: idBdCompte2,
          });

          const val = await rés.attendreQue((x) => !!x && x.length === 1);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Membre bloqué indirectement", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: -0.9,
              profondeur: 2,
            },
          ];
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client2.réseau!.bloquerMembre({
            idBdCompte: idBdCompte3,
          });

          const val = await rés.attendreQue((x) => !!x && x.length === 3);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Précédence confiance propre", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 1,
              profondeur: 1,
            },
          ];
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });

          const val = await rés.attendreQue(
            (x) =>
              !!x &&
              x.find((y) => y.idBdCompte === client3.idBdCompte)?.confiance ===
                1
          );
          expect(val).toEqual(expect.arrayContaining(réf));

          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client2.réseau!.débloquerMembre({
            idBdCompte: idBdCompte3,
          });
        });
        test("Diminuer profondeur", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
          ];
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client2.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
          rés.attendreQue((x) => !!x && x.length === 3);

          fChangerProfondeur(1);
          const val = await rés.attendreQue((x) => !!x && x.length === 2);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Augmenter profondeur", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 0.8,
              profondeur: 2,
            },
          ];

          fChangerProfondeur(2);

          const val = await rés.attendreQue((x) => !!x && x.length === 3);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
      });

      describe("Suivre comptes réseau et en ligne", function () {
        let fOublier: schémaFonctionOublier;
        let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];

        const rés = new AttendreRésultat<infoMembreRéseau[]>();

        beforeAll(async () => {
          ({ fOublier, fChangerProfondeur } =
            await client.réseau!.suivreComptesRéseauEtEnLigne({
              f: (c) => (rés.mettreÀJour(c)),
              profondeur: 2,
            }));

          await rés.attendreQue(
            (x) =>
              !!x &&
              x.find((x) => x.idBdCompte === client2.idBdCompte)?.confiance ===
                0 &&
              x.find((x) => x.idBdCompte === client3.idBdCompte)?.confiance ===
                0
          );
        });

        afterAll(async () => {
          if (fOublier) await fOublier();

          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client2.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
          rés.toutAnnuler();
        });

        test("Comptes en ligne détectés", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 0,
              profondeur: Infinity,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 0,
              profondeur: Infinity,
            },
          ];

          const val = await rés.attendreQue((x) => !!x && x.length === 3);
          expect(val).toEqual(expect.arrayContaining(réf));
        });

        test("Comptes réseau détectés", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 0,
              profondeur: Infinity,
            },
          ];

          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          const val = await rés.attendreQue(
            (x) =>
              !!x &&
              x.find((x) => x.idBdCompte === client2.idBdCompte)?.confiance ===
                1 &&
              x.find((x) => x.idBdCompte === client3.idBdCompte)?.confiance ===
                0
          );

          expect(val).toEqual(expect.arrayContaining(réf));
        });

        test("Changer profondeur", async () => {
          await client2.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
          await rés.attendreQue(
            (x) =>
              !!x &&
              (x.find((x) => x.idBdCompte === client3.idBdCompte)?.confiance ||
                0) > 0
          );

          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 0,
              profondeur: Infinity,
            },
          ];
          fChangerProfondeur(1);
          const val = await rés.attendreQue((x) =>
              !!x &&
              x.find((x) => x.idBdCompte === client3.idBdCompte)?.confiance ===
                0
          );

          expect(val).toEqual(expect.arrayContaining(réf));
        });
      });

      describe("Suivre confiance mon réseau pour membre", function () {
        let fOublier: schémaFonctionOublier;
        let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];

        const rés = new AttendreRésultat<number>();

        beforeAll(async () => {
          ({ fOublier, fChangerProfondeur } =
            await client.réseau!.suivreConfianceMonRéseauPourMembre({
              idBdCompte: idBdCompte3,
              f: (confiance) => (rés.mettreÀJour(confiance)),
              profondeur: 4
            }));
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client2.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
          rés.toutAnnuler();
        });

        test("Confiance initiale 0", async () => {
          rés.attendreQue((x) => x === 0);
        });

        test("Faire confiance au membre", async () => {
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client2.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });

          const val = await rés.attendreQue((x) => !!x && x > 0);
          expect(val).toEqual(0.8);
        });

        test("Changer profondeur", async () => {
          fChangerProfondeur(1);
          rés.attendreQue((x) => x === 0);
        });
      });

      describe("Suivre confiance auteurs", function () {
        let fOublier: schémaFonctionOublier;
        let idMotClef: string;

        const rés = new AttendreRésultat<number>();

        beforeAll(async () => {
          idMotClef = await client2.motsClefs!.créerMotClef();

          fOublier = await client.réseau!.suivreConfianceAuteurs({
            idItem: idMotClef,
            clef: "motsClefs",
            f: (confiance) => (rés.mettreÀJour(confiance)),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
          if (idMotClef)
            await client2.motsClefs!.effacerMotClef({ id: idMotClef });

          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
          rés.toutAnnuler();
        });

        test("Confiance 0 pour commencer", async () => {
          rés.attendreQue((x) => x === 0);
        });

        test("Ajout auteur au réseau", async () => {
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });

          const val = await rés.attendreQue((x) => !!x && x > 0);
          expect(val).toEqual(1);
        });

        test("Ajout coauteur au réseau", async () => {
          await client2.motsClefs!.inviterAuteur({
            idMotClef,
            idBdCompteAuteur: idBdCompte3,
            rôle: MEMBRE,
          });
          await client3.motsClefs!.ajouterÀMesMotsClefs({ id: idMotClef });
          const valAvant = await rés.attendreQue((x) => !!x && x > 1);

          expect(valAvant).toBeGreaterThan(1);
          expect(valAvant).toBeLessThan(2);

          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
          const val = await rés.attendreQue((x) => !!x && x > valAvant);

          expect(val).toEqual(2);
        });

        test("Coauteur se retire", async () => {
          await client3.motsClefs!.enleverDeMesMotsClefs({ id: idMotClef });
          const val = await rés.attendreQue((x) => !!x && x < 2);

          expect(val).toEqual(1);
        });
      });

      describe("Auteurs", function () {
        describe("Mots-clefs", function () {
          let idMotClef: string;
          let fOublier: schémaFonctionOublier;

          const rés = new AttendreRésultat<infoAuteur[]>();

          beforeAll(async () => {
            idMotClef = await client.motsClefs!.créerMotClef();
            fOublier = await client.réseau!.suivreAuteursMotClef({
              idMotClef,
              f: (auteurs) => (rés.mettreÀJour(auteurs)),
            });
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            if (idMotClef) {
              await client.motsClefs!.effacerMotClef({ id: idMotClef });
              await client2.motsClefs!.enleverDeMesMotsClefs({ id: idMotClef });
            }
            rés.toutAnnuler();
          });

          test("Inviter auteur", async () => {
            const réf: infoAuteur[] = [
              {
                idBdCompte: idBdCompte1,
                accepté: true,
                rôle: MODÉRATEUR,
              },
              {
                idBdCompte: idBdCompte2,
                accepté: false,
                rôle: MEMBRE,
              },
            ];
            await client.motsClefs!.inviterAuteur({
              idMotClef,
              idBdCompteAuteur: idBdCompte2,
              rôle: MEMBRE,
            });

            const val = await rés.attendreQue((x) => !!x && x.length > 1);
            expect(val).toEqual(réf);
          });
          test("Accepter invitation", async () => {
            const réf: infoAuteur[] = [
              {
                idBdCompte: idBdCompte1,
                accepté: true,
                rôle: MODÉRATEUR,
              },
              {
                idBdCompte: idBdCompte2,
                accepté: true,
                rôle: MEMBRE,
              },
            ];

            await client2.motsClefs!.ajouterÀMesMotsClefs({ id: idMotClef });
            const val = await rés.attendreQue((x) =>
              Boolean(
                !!x &&
                  x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
              )
            );

            expect(val).toEqual(réf);
          });
          test("Refuser invitation", async () => {
            const réf: infoAuteur[] = [
              {
                idBdCompte: idBdCompte1,
                accepté: true,
                rôle: MODÉRATEUR,
              },
              {
                idBdCompte: idBdCompte2,
                accepté: false,
                rôle: MEMBRE,
              },
            ];

            await client2.motsClefs!.enleverDeMesMotsClefs({ id: idMotClef });
            const val = await rés.attendreQue(
              (x) =>
                !!x &&
                !x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
            );

            expect(val).toEqual(réf);
          });
          test("Promotion à modérateur", async () => {
            await client.motsClefs!.inviterAuteur({
              idMotClef,
              idBdCompteAuteur: idBdCompte2,
              rôle: MODÉRATEUR,
            });

            await rés.attendreQue(
              (auteurs) =>
                !!auteurs &&
                auteurs.find((a) => a.idBdCompte === idBdCompte2)?.rôle ===
                  MODÉRATEUR
            );
          });
        });

        describe("Variables", function () {
          let idVariable: string;
          let fOublier: schémaFonctionOublier;

          const rés = new AttendreRésultat<infoAuteur[]>();

          beforeAll(async () => {
            idVariable = await client.variables!.créerVariable({
              catégorie: "numérique",
            });
            fOublier = await client.réseau!.suivreAuteursVariable({
              idVariable,
              f: (auteurs) => (rés.mettreÀJour(auteurs)),
            });
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            if (idVariable)
              await client.variables!.effacerVariable({ id: idVariable });
            rés.toutAnnuler()
          });

          test("Inviter auteur", async () => {
            const réf: infoAuteur[] = [
              {
                idBdCompte: idBdCompte1,
                accepté: true,
                rôle: MODÉRATEUR,
              },
              {
                idBdCompte: idBdCompte2,
                accepté: false,
                rôle: MEMBRE,
              },
            ];
            await client.variables!.inviterAuteur({
              idVariable,
              idBdCompteAuteur: idBdCompte2,
              rôle: MEMBRE,
            });

            const val = await rés.attendreQue((x) => !!x && x.length > 1);
            expect(val).toEqual(réf);
          });
          test("Accepter invitation", async () => {
            const réf: infoAuteur[] = [
              {
                idBdCompte: idBdCompte1,
                accepté: true,
                rôle: MODÉRATEUR,
              },
              {
                idBdCompte: idBdCompte2,
                accepté: true,
                rôle: MEMBRE,
              },
            ];

            await client2.variables!.ajouterÀMesVariables({ id: idVariable });
            const val = await rés.attendreQue((x) =>
              Boolean(
                !!x &&
                  x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
              )
            );

            expect(val).toEqual(réf);
          });
          test("Refuser invitation", async () => {
            const réf: infoAuteur[] = [
              {
                idBdCompte: idBdCompte1,
                accepté: true,
                rôle: MODÉRATEUR,
              },
              {
                idBdCompte: idBdCompte2,
                accepté: false,
                rôle: MEMBRE,
              },
            ];

            await client2.variables!.enleverDeMesVariables({ id: idVariable });
            const val = await rés.attendreQue(
              (x) =>
                !!x &&
                !x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
            );

            expect(val).toEqual(réf);
          });
          test("Promotion à modérateur", async () => {
            await client.variables!.inviterAuteur({
              idVariable,
              idBdCompteAuteur: idBdCompte2,
              rôle: MODÉRATEUR,
            });

            await rés.attendreQue(
              (auteurs) =>
                !!auteurs &&
                auteurs.find((a) => a.idBdCompte === idBdCompte2)?.rôle ===
                  MODÉRATEUR
            );
          });
        });

        describe("Bds", function () {
          let idBd: string;
          let fOublier: schémaFonctionOublier;

          const rés = new AttendreRésultat<infoAuteur[]>();

          beforeAll(async () => {
            idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
            fOublier = await client.réseau!.suivreAuteursBd({
              idBd,
              f: (auteurs) => (rés.mettreÀJour(auteurs)),
            });
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            if (idBd) await client.bds!.effacerBd({ id: idBd });
            rés.toutAnnuler();
          });

          test("Inviter auteur", async () => {
            const réf: infoAuteur[] = [
              {
                idBdCompte: idBdCompte1,
                accepté: true,
                rôle: MODÉRATEUR,
              },
              {
                idBdCompte: idBdCompte2,
                accepté: false,
                rôle: MEMBRE,
              },
            ];
            await client.bds!.inviterAuteur({
              idBd,
              idBdCompteAuteur: idBdCompte2,
              rôle: MEMBRE,
            });

            const val = await rés.attendreQue((x) => !!x && x.length > 1);
            expect(val).toEqual(réf);
          });

          test("Accepter invitation", async () => {
            const réf: infoAuteur[] = [
              {
                idBdCompte: idBdCompte1,
                accepté: true,
                rôle: MODÉRATEUR,
              },
              {
                idBdCompte: idBdCompte2,
                accepté: true,
                rôle: MEMBRE,
              },
            ];

            await client2.bds!.ajouterÀMesBds({ id: idBd });
            const val = await rés.attendreQue((x) =>
              Boolean(
                !!x &&
                  x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
              )
            );

            expect(val).toEqual(réf);
          });

          test("Refuser invitation", async () => {
            const réf: infoAuteur[] = [
              {
                idBdCompte: idBdCompte1,
                accepté: true,
                rôle: MODÉRATEUR,
              },
              {
                idBdCompte: idBdCompte2,
                accepté: false,
                rôle: MEMBRE,
              },
            ];

            await client2.bds!.enleverDeMesBds({ id: idBd });
            const val = await rés.attendreQue(
              (x) =>
                !!x &&
                !x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
            );

            expect(val).toEqual(réf);
          });

          test("Promotion à modérateur", async () => {
            await client.bds!.inviterAuteur({
              idBd,
              idBdCompteAuteur: idBdCompte2,
              rôle: MODÉRATEUR,
            });

            await rés.attendreQue(
              (auteurs) =>
                !!auteurs &&
                auteurs.find((a) => a.idBdCompte === idBdCompte2)?.rôle ===
                  MODÉRATEUR
            );
          });
        });

        describe("Projets", function () {
          let idProjet: string;
          let fOublier: schémaFonctionOublier;

          const rés = new AttendreRésultat<infoAuteur[]>();

          beforeAll(async () => {
            idProjet = await client.projets!.créerProjet();
            fOublier = await client.réseau!.suivreAuteursProjet({
              idProjet,
              f: (auteurs) => (rés.mettreÀJour(auteurs)),
            });
          });

          afterAll(async () => {
            if (fOublier) await fOublier();
            if (idProjet) await client.projets!.effacerProjet({ id: idProjet });
          });

          test("Inviter auteur", async () => {
            const réf: infoAuteur[] = [
              {
                idBdCompte: idBdCompte1,
                accepté: true,
                rôle: MODÉRATEUR,
              },
              {
                idBdCompte: idBdCompte2,
                accepté: false,
                rôle: MEMBRE,
              },
            ];
            await client.projets!.inviterAuteur({
              idProjet,
              idBdCompteAuteur: idBdCompte2,
              rôle: MEMBRE,
            });

            const val = await rés.attendreQue((x) => !!x && x.length > 1);
            expect(val).toEqual(réf);
          });

          test("Accepter invitation", async () => {
            const réf: infoAuteur[] = [
              {
                idBdCompte: idBdCompte1,
                accepté: true,
                rôle: MODÉRATEUR,
              },
              {
                idBdCompte: idBdCompte2,
                accepté: true,
                rôle: MEMBRE,
              },
            ];

            await client2.projets!.ajouterÀMesProjets({ idProjet });
            const val = await rés.attendreQue((x) =>
              Boolean(
                !!x &&
                  x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
              )
            );

            expect(val).toEqual(réf);
          });
          test("Refuser invitation", async () => {
            const réf: infoAuteur[] = [
              {
                idBdCompte: idBdCompte1,
                accepté: true,
                rôle: MODÉRATEUR,
              },
              {
                idBdCompte: idBdCompte2,
                accepté: false,
                rôle: MEMBRE,
              },
            ];

            await client2.projets!.enleverDeMesProjets({ idProjet });
            const val = await rés.attendreQue(
              (x) =>
                !!x &&
                !x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
            );

            expect(val).toEqual(réf);
          });
          test("Promotion à modérateur", async () => {
            await client.projets!.inviterAuteur({
              idProjet,
              idBdCompteAuteur: idBdCompte2,
              rôle: MODÉRATEUR,
            });

            await rés.attendreQue(
              (auteurs) =>
                !!auteurs &&
                auteurs.find((a) => a.idBdCompte === idBdCompte2)?.rôle ===
                  MODÉRATEUR
            );
          });
        });
      });

      describe("Suivre noms membre", function () {
        const rés = new AttendreRésultat<{ [key: string]: string }>();
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          await client.profil!.sauvegarderNom({ langue: "fr", nom: "Julien" });
          fOublier = await client2.réseau!.suivreNomsMembre({
            idCompte: idBdCompte1,
            f: (n) => (rés.mettreÀJour(n)),
          });
          rés.toutAnnuler();
        });

        test("Noms détectés", async () => {
          const val = await rés.attendreQue((x) => !!x && Boolean(x.fr));
          expect(val.fr).toEqual("Julien");
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
        });
      });

      describe("Suivre courriel membre", function () {
        const rés = new AttendreRésultat<string | null>();
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          await client.profil!.sauvegarderCourriel({
            courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
          });
          fOublier = await client2.réseau!.suivreCourrielMembre({
            idCompte: idBdCompte1,
            f: (c) => (rés.mettreÀJour(c)),
          });
        });
        afterAll(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });

        test("Courriel détecté", async () => {
          const val = await rés.attendreQue((x: string | null | undefined) =>
            Boolean(x)
          );
          expect(val).toEqual("தொடர்பு@லஸ்ஸி.இந்தியா");
        });


      });

      describe("Suivre image membre", function () {
        const rés = new AttendreRésultat<Uint8Array | null>();
        let fOublier: schémaFonctionOublier;

        const IMAGE = fs.readFileSync(
          path.join(dirRessourcesTests(), "logo.svg")
        );

        beforeAll(async () => {
          await client.profil!.sauvegarderImage({ image: IMAGE });
          fOublier = await client2.réseau!.suivreImageMembre({
            idCompte: idBdCompte1,
            f: (i) => rés.mettreÀJour(i),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });

        test("Image détectée", async () => {
          const val = await rés.attendreExiste();
          expect(val).toEqual(new Uint8Array(IMAGE));
        });
      });

      describe("Suivre mots-clefs", function () {
        let idMotClef1: string;
        let idMotClef2: string;

        const résPropres = new AttendreRésultat<string[]>();
        const résAutres = new AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client2.réseau!.suivreMotsClefsMembre({
              idCompte: idBdCompte1,
              f: (motsClefs) => (résAutres.mettreÀJour(motsClefs)),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreMotsClefsMembre({
              idCompte: idBdCompte2,
              f: (motsClefs) => (résPropres.mettreÀJour(motsClefs)),
            })
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (idMotClef1)
            await client.motsClefs!.effacerMotClef({ id: idMotClef1 });
          if (idMotClef2)
            await client.motsClefs!.effacerMotClef({ id: idMotClef2 });

          résPropres.toutAnnuler();
          résAutres.toutAnnuler();
        });

        test("Mes propres mots-clefs détectés", async () => {
          idMotClef2 = await client2.motsClefs!.créerMotClef();

          const val = await résPropres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idMotClef2);
        });

        test("Mot-clef d'un autre membre détecté", async () => {
          idMotClef1 = await client.motsClefs!.créerMotClef();
          const val = await résAutres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idMotClef1);
        });
      });

      describe("Suivre variables", function () {
        let idVariable1: string;
        let idVariable2: string;


        const résPropres = new AttendreRésultat<string[]>();
        const résAutres = new AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client2.réseau!.suivreVariablesMembre({
              idCompte: idBdCompte1,
              f: (variables) => (résAutres.mettreÀJour(variables)),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreVariablesMembre({
              idCompte: idBdCompte2,
              f: (variables) => (résPropres.mettreÀJour(variables)),
            })
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (idVariable1)
            await client.variables!.effacerVariable({ id: idVariable1 });
          if (idVariable2)
            await client2.variables!.effacerVariable({ id: idVariable2 });

          résPropres.toutAnnuler();
          résAutres.toutAnnuler();
        });

        test("Mes variables détectées", async () => {
          idVariable2 = await client2.variables!.créerVariable({
            catégorie: "numérique",
          });

          const val = await résPropres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idVariable2);
        });

        test("Variable d'un autre membre détectée", async () => {
          idVariable1 = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          const val = await résAutres.attendreQue((x) => Boolean(x?.length));
          expect(val).toContain(idVariable1);
        });
      });

      describe("Suivre BDs", function () {
        const résPropres = new AttendreRésultat<string[]>();
        const résAutres = new AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client2.réseau!.suivreBdsMembre({
              idCompte: idBdCompte1,
              f: (bds) => (résAutres.mettreÀJour(bds)),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreBdsMembre({
              idCompte: idBdCompte2,
              f: (bds) => (résPropres.mettreÀJour(bds)),
            })
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          résPropres.toutAnnuler()
          résAutres.toutAnnuler()
        });

        test("Mes BDs détectées", async () => {
          const idBd = await client2.bds!.créerBd({ licence: "ODbl-1_0" });

          const val = await résPropres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idBd);
        });

        test("BD d'un autre membre détectée", async () => {
          const idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          const val = await résAutres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idBd);
        });
      });

      describe("Suivre projets", function () {

        const résPropres = new AttendreRésultat<string[]>();
        const résAutres = new AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client2.réseau!.suivreProjetsMembre({
              idCompte: idBdCompte1,
              f: (projets) => (résAutres.mettreÀJour(projets)),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreProjetsMembre({
              idCompte: idBdCompte2,
              f: (projets) => (résPropres.mettreÀJour(projets)),
            })
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          résPropres.toutAnnuler()
          résAutres.toutAnnuler()
        });

        test("Mes projets détectés", async () => {
          const idProjet = await client2.projets!.créerProjet();

          const val = await résPropres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idProjet);
        });

        test("Projet d'un autre membre détecté", async () => {
          const idProjet = await client.projets!.créerProjet();
          const val = await résAutres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idProjet);
        });
      });

      describe("Suivre favoris", function () {
        let idMotClef: string;

        const résPropres = new AttendreRésultat<ÉlémentFavorisAvecObjet[]>();
        const résAutres = new AttendreRésultat<ÉlémentFavorisAvecObjet[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client2.réseau!.suivreFavorisMembre({
              idCompte: idBdCompte1,
              f: (favoris) => (résAutres.mettreÀJour(favoris)),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreFavorisMembre({
              idCompte: idBdCompte2,
              f: (favoris) => (résPropres.mettreÀJour(favoris)),
            })
          );

          idMotClef = await client.motsClefs!.créerMotClef();
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (idMotClef)
            await client.motsClefs!.effacerMotClef({ id: idMotClef });
          résPropres.toutAnnuler();
        });

        test("Mes favoris détectés", async () => {
          const réf: ÉlémentFavorisAvecObjet[] = [
            {
              récursif: true,
              dispositifs: "TOUS",
              dispositifsFichiers: "INSTALLÉ",
              idObjet: idMotClef,
            },
          ];

          await client2.favoris!.épinglerFavori({
            id: idMotClef,
            dispositifs: "TOUS",
          });
          const val = await résPropres.attendreQue((x) => !!x && !!x.length);
          expect(val).toEqual(réf);
        });

        test("Favoris d'un autre membre détectés", async () => {
          const réf: ÉlémentFavorisAvecObjet[] = [
            {
              récursif: true,
              dispositifs: "TOUS",
              dispositifsFichiers: "INSTALLÉ",
              idObjet: idMotClef,
            },
          ];

          await client.favoris!.épinglerFavori({
            id: idMotClef,
            dispositifs: "TOUS",
          });
          const val = await résAutres.attendreQue((x) => !!x && !!x.length);
          expect(val).toEqual(réf);
        });
      });

      describe("Suivre favoris objet", function () {
        let idMotClef: string;
        let fOublier: schémaFonctionOublier;

        const rés = new AttendreRésultat<(ÉlémentFavorisAvecObjet & { idBdCompte: string })[]>();

        beforeAll(async () => {
          idMotClef = await client.motsClefs!.créerMotClef();

          ({ fOublier } = await client.réseau!.suivreFavorisObjet({
            idObjet: idMotClef,
            f: (favoris) => (rés.mettreÀJour(favoris)),
            profondeur: 4
          }));
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
          if (idMotClef)
            await client.motsClefs!.effacerMotClef({ id: idMotClef });
          rés.toutAnnuler();
        });

        test("Aucun favoris pour commencer", async () => {
          const val = await rés.attendreExiste();
          expect(val).toHaveLength(0);
        });

        test("Ajout à mes favoris détecté", async () => {
          const réf: (ÉlémentFavorisAvecObjet & { idBdCompte: string })[] = [
            {
              récursif: true,
              dispositifs: "TOUS",
              dispositifsFichiers: "INSTALLÉ",
              idObjet: idMotClef,
              idBdCompte: idBdCompte1,
            },
          ];
          await client.favoris!.épinglerFavori({
            id: idMotClef,
            dispositifs: "TOUS",
          });
          const val = await rés.attendreQue((x) => !!x && !!x.length);

          expect(val).toEqual(réf);
        });

        test("Ajout aux favoris d'un autre membre détecté", async () => {
          const réf: (ÉlémentFavorisAvecObjet & { idBdCompte: string })[] = [
            {
              récursif: true,
              dispositifs: "TOUS",
              dispositifsFichiers: "INSTALLÉ",
              idObjet: idMotClef,
              idBdCompte: idBdCompte1,
            },
            {
              récursif: true,
              dispositifs: "TOUS",
              dispositifsFichiers: "INSTALLÉ",
              idObjet: idMotClef,
              idBdCompte: idBdCompte2,
            },
          ];
          await client2.favoris!.épinglerFavori({
            id: idMotClef,
            dispositifs: "TOUS",
          });
          const val = await rés.attendreQue((x) => !!x && x.length === 2);

          expect(val).toEqual(réf);
        });
      });

      describe("Suivre réplications", function () {
        let idBd: string;

        const rés = new AttendreRésultat<infoRéplications>();
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          fsOublier.push(
            (
              await client.réseau!.suivreRéplications({
                idObjet: idBd,
                f: (bds) => (rés.mettreÀJour(bds)),
                profondeur: 4
              })
            ).fOublier
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (idBd) {
            await client.bds!.effacerBd({ id: idBd });
            await client2.favoris!.désépinglerFavori({ id: idBd });
          }
          rés.toutAnnuler();
        });

        test("Auteur de la BD pour commencer", async () => {
          await client.favoris!.épinglerFavori({
            id: idBd,
            dispositifs: "TOUS",
          });

          const val = await rés.attendreQue(
            (x) => !!x && x.membres.length > 0
          );

          expect(
            val.membres.map((m) => m.infoMembre.idBdCompte)
          ).toContain(idBdCompte1);
          expect(val.dispositifs.map((d) => d.idDispositif)).toContain(
            idOrbite1
          );
        });

        test("Ajout d'une réplication détectée", async () => {
          await client2.favoris!.épinglerFavori({
            id: idBd,
            dispositifs: "TOUS",
          });

          const val = await rés.attendreQue(
            (x) => !!x && x.membres.length > 1
          );

          expect(
            val.membres.map((m) => m.infoMembre.idBdCompte)
          ).toEqual(expect.arrayContaining([idBdCompte1, idBdCompte2]));
          expect(val.dispositifs.map((d) => d.idDispositif)).toEqual(
            expect.arrayContaining([idOrbite1, idOrbite2])
          );
        });
      });

      describe("Suivre BD par mot-clef unique", function () {
        let motClef: string;
        let idBd1: string;
        let idBd2: string;
        let idTableau1: string | undefined;
        let idTableau2: string | undefined;

        let empreinte1: string;
        let empreinte2: string;
        let empreinte3: string;

        const clefTableau = "tableau trads";
        const données1 = {
          clef: "titre",
          langue: "fr",
          trad: "Constellation",
        };
        const données2 = { clef: "titre", langue: "हिं", trad: "तारामंडल" };
        const données3 = { clef: "titre", langue: "kaq", trad: "Ch'umil" };

        const résBds = new AttendreRésultat<string[]>;
        const résÉléments = new AttendreRésultat<élémentDeMembre<élémentBdListeDonnées>[]>;

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          const idVarClef = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          const idVarLangue = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          const idVarTrad = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });

          motClef = await client.motsClefs!.créerMotClef();

          const schéma: schémaSpécificationBd = {
            licence: "ODbl-1_0",
            motsClefs: [motClef],
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

          idBd1 = await client.bds!.créerBdDeSchéma({ schéma });
          idBd2 = await client2.bds!.créerBdDeSchéma({ schéma });

          idTableau1 = (
            await uneFois(
              async (
                fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>
              ): Promise<schémaFonctionOublier> => {
                return await client.bds!.suivreTableauxBd({
                  id: idBd1,
                  f: fSuivi,
                });
              }
            )
          )[0].id;

          idTableau2 = (
            await uneFois(
              async (
                fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>
              ): Promise<schémaFonctionOublier> => {
                return await client2.bds!.suivreTableauxBd({
                  id: idBd2,
                  f: fSuivi,
                });
              }
            )
          )[0].id;

          fsOublier.push(
            (
              await client.réseau!.suivreBdsDeMotClef({
                motClefUnique: motClef,
                f: (bds) => résBds.mettreÀJour(bds),
                nRésultatsDésirés: 100,
              })
            ).fOublier
          );
          fsOublier.push(
            (
              await client.réseau!.suivreÉlémentsDeTableauxUniques({
                motClefUnique: motClef,
                clef: clefTableau,
                f: (éléments) => résÉléments.mettreÀJour(éléments),
              })
            ).fOublier
          );

          empreinte1 = await client.tableaux!.ajouterÉlément({
            idTableau: idTableau1,
            vals: données1,
          });
          empreinte2 = await client.tableaux!.ajouterÉlément({
            idTableau: idTableau1,
            vals: données2,
          });
          empreinte3 = await client2.tableaux!.ajouterÉlément({
            idTableau: idTableau2,
            vals: données3,
          });
        }, config.patience);

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          résBds.toutAnnuler();
          résÉléments.toutAnnuler();
        });

        test(
          "Suivre BDs du réseau",
          async () => {
            const val = await résBds.attendreQue(
              (x?: string[]) => x && x.length === 2
            );
            expect(val).toHaveLength(2);
            expect(val).toEqual(expect.arrayContaining([idBd1, idBd2]));
          },
          config.patience
        );

        test(
          "Suivre éléments des BDs",
          async () => {
            const val = await résÉléments.attendreQue(
              (x) =>
                x && x.length === 3
            );
            const élémentsSansId = val.map((r) => {
              delete r.élément.données.id;
              return r;
            });

            const réf: élémentDeMembre<élémentBdListeDonnées>[] = [
              {
                idBdCompte: idBdCompte1,
                élément: {
                  empreinte: empreinte1,
                  données: données1,
                },
              },
              {
                idBdCompte: idBdCompte1,
                élément: {
                  empreinte: empreinte2,
                  données: données2,
                },
              },
              {
                idBdCompte: idBdCompte2,
                élément: {
                  empreinte: empreinte3,
                  données: données3,
                },
              },
            ];

            expect(élémentsSansId).toEqual(expect.arrayContaining(réf));
          },
          config.patience
        );
      });
    });
  });
});
