// import log from 'why-is-node-running';

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
  attendreRésultat,
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

        idNodeSFIP1 = (await client.obtIdSFIP()).id.toString();
        idNodeSFIP2 = (await client2.obtIdSFIP()).id.toString();
        idNodeSFIP3 = (await client3.obtIdSFIP()).id.toString();
        console.log({ idNodeSFIP1, idNodeSFIP2, idNodeSFIP3 });

        idOrbite1 = await client.obtIdOrbite();
        idOrbite2 = await client2.obtIdOrbite();
        idOrbite3 = await client3.obtIdOrbite();
        console.log({ idOrbite1, idOrbite2, idOrbite3 });

        idBdCompte1 = await client.obtIdCompte();
        idBdCompte2 = await client2.obtIdCompte();
        idBdCompte3 = await client3.obtIdCompte();
        console.log({ idBdCompte1, idBdCompte2, idBdCompte3 });

        moiMême = {
          idBdCompte: idBdCompte1,
          confiance: 1,
          profondeur: 0,
        };
      }, config.patienceInit * 3);

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();

        /* setTimeout(function () {
          log() // logs out active handles that are keeping node running
        }, 1000) */
      });

      describe.skip("Suivre postes", function () {
        const rés: { ultat: { addr: string; peer: string }[] | undefined } = {
          ultat: undefined,
        };
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.réseau!.suivreConnexionsPostesSFIP({
            f: (c) => (rés.ultat = c),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Autres postes détectés", async () => {
          expect(rés.ultat!.map((r) => r.peer)).toEqual(
            expect.arrayContaining([idNodeSFIP2, idNodeSFIP3])
          );
        });
      });

      describe.skip("Suivre dispositifs en ligne", function () {
        const dis: { positifs?: statutDispositif[] } = {};
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.réseau!.suivreConnexionsDispositifs({
            f: (d) => (dis.positifs = d),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Autres dispositifs détectés", async () => {
          await attendreRésultat(
            dis,
            "positifs",
            (x?: statutDispositif[]) => !!x && x.length === 3
          );
          expect(dis.positifs!.map((d) => d.infoDispositif.idOrbite)).toEqual(
            expect.arrayContaining([idOrbite1, idOrbite2, idOrbite3])
          );
        });
      });

      describe.skip("Suivre membres en ligne", function () {
        const rés: { ultat?: statutMembre[] } = {};
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.réseau!.suivreConnexionsMembres({
            f: (c) => (rés.ultat = c),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Autres membres détectés", async () => {
          const réfRés: infoMembre[] = [
            {
              idBdCompte: idBdCompte1,
              dispositifs: [
                {
                  idSFIP: idNodeSFIP1,
                  idOrbite: idOrbite1,
                  idCompte: idBdCompte1,
                  clefPublique: client.orbite!.identity.publicKey,
                  encryption: {
                    type: client.encryption.nom,
                    clefPublique: client.encryption.clefs.publique,
                  },
                  signatures: client.orbite!.identity.signatures,
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
                  clefPublique: client2.orbite!.identity.publicKey,
                  encryption: {
                    type: client2.encryption.nom,
                    clefPublique: client2.encryption.clefs.publique,
                  },
                  signatures: client2.orbite!.identity.signatures,
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
                  clefPublique: client3.orbite!.identity.publicKey,
                  encryption: {
                    type: client3.encryption.nom,
                    clefPublique: client3.encryption.clefs.publique,
                  },
                  signatures: client3.orbite!.identity.signatures,
                },
              ],
            },
          ];
          expect(rés.ultat!.map((r) => r.infoMembre)).toEqual(
            expect.arrayContaining(réfRés)
          );
        });
      });

      describe.skip("Membres fiables", function () {
        const fiables: { propres?: string[]; autre?: string[] } = {};
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client.réseau!.suivreFiables({
              f: (m) => (fiables.propres = m),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreFiables({
              f: (m) => (fiables.autre = m),
              idBdCompte: idBdCompte1,
            })
          );
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        test("Personne pour commencer", async () => {
          expect(fiables.propres).toHaveLength(0);
        });

        test("Faire confiance", async () => {
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          expect(isArray(fiables.propres)).toBe(true);
          expect(fiables.propres).toHaveLength(1);
          expect(fiables.propres).toEqual(
            expect.arrayContaining([idBdCompte2])
          );
        });

        test("Détecter confiance d'autre membre", async () => {
          await attendreRésultat(fiables, "autre", (x) => !!x && x.length > 0);
          expect(isArray(fiables.autre)).toBe(true);
          expect(fiables.autre).toHaveLength(1);
          expect(fiables.autre).toEqual(expect.arrayContaining([idBdCompte2]));
        });

        test("Un débloquage accidental ne fait rien", async () => {
          await client.réseau!.débloquerMembre({ idBdCompte: idBdCompte2 });
          expect(isArray(fiables.propres)).toBe(true);
          expect(fiables.propres).toHaveLength(1);
          expect(fiables.propres).toEqual(
            expect.arrayContaining([idBdCompte2])
          );
        });

        test("Changer d'avis", async () => {
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          expect(fiables.propres).toHaveLength(0);
        });
      });

      describe.skip("Membres bloqués", function () {
        const bloqués: {
          tous?: infoBloqué[];
          publiques?: string[];
          autreMembre?: infoBloqué[];
        } = {};

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client.réseau!.suivreBloqués({ f: (m) => (bloqués.tous = m) })
          );
          fsOublier.push(
            await client.réseau!.suivreBloquésPubliques({
              f: (m) => (bloqués.publiques = m),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreBloqués({
              f: (m) => (bloqués.autreMembre = m),
              idBdCompte: idBdCompte1,
            })
          );
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
          await client.réseau!.débloquerMembre({ idBdCompte: idBdCompte2 });
          await client.réseau!.débloquerMembre({ idBdCompte: idBdCompte3 });
        });

        test("Personne pour commencer", async () => {
          expect(bloqués.publiques).toHaveLength(0);
        });

        test("Bloquer quelqu'un", async () => {
          await client.réseau!.bloquerMembre({ idBdCompte: idBdCompte2 });
          expect(isArray(bloqués.tous));
          expect(bloqués.tous).toHaveLength(1);
          expect(bloqués.tous).toEqual(
            expect.arrayContaining([
              {
                idBdCompte: idBdCompte2,
                privé: false,
              },
            ])
          );
          expect(isArray(bloqués.publiques));
          expect(bloqués.publiques).toHaveLength(1);
          expect(bloqués.publiques).toEqual(
            expect.arrayContaining([idBdCompte2])
          );
        });

        test("Un dé-confiance accidental ne fait rien", async () => {
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          expect(isArray(bloqués.tous)).toBe(true);
          expect(bloqués.tous).toHaveLength(1);
          expect(bloqués.tous).toEqual(
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
          expect(isArray(bloqués.tous)).toBe(true);
          expect(bloqués.tous).toHaveLength(2);
          expect(bloqués.tous).toEqual(
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
          await attendreRésultat(
            bloqués,
            "autreMembre",
            (x) => !!x && x.length > 0
          );
          expect(isArray(bloqués.autreMembre)).toBe(true);
          expect(bloqués.autreMembre).toHaveLength(1);
          expect(bloqués.autreMembre).toEqual(
            expect.arrayContaining([
              {
                idBdCompte: idBdCompte2,
                privé: false,
              },
            ])
          );
        });

        test("On ne détecte pas le bloqué privé d'un autre membre", async () => {
          expect(isArray(bloqués.autreMembre)).toBe(true);
          expect(bloqués.autreMembre!.map((b) => b.idBdCompte)).not.toContain(
            idBdCompte3
          );
        });

        test("Débloquer publique", async () => {
          await client.réseau!.débloquerMembre({ idBdCompte: idBdCompte2 });
          expect(bloqués.publiques).toHaveLength(0);
        });

        test("Débloquer privé", async () => {
          await client.réseau!.débloquerMembre({ idBdCompte: idBdCompte3 });
          expect(bloqués.tous).toHaveLength(0);
        });
      });

      describe.skip("Suivre relations immédiates", function () {
        let idMotClef1: string;
        let idMotClef2: string;
        let idBd: string;
        let idVariable: string;
        let idProjet: string;

        const relations: {
          propres?: infoConfiance[];
          autre?: infoConfiance[];
        } = {};
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client.réseau!.suivreRelationsImmédiates({
              f: (c) => (relations.propres = c),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreRelationsImmédiates({
              f: (c) => (relations.autre = c),
              idBdCompte: idBdCompte1,
            })
          );
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
          if (idMotClef1)
            await client2.motsClefs!.effacerMotClef({ id: idMotClef1 });
          if (idMotClef2)
            await client2.motsClefs!.effacerMotClef({ id: idMotClef2 });
          if (idBd) await client.bds!.effacerBd({ id: idBd });
          if (idProjet) await client.projets!.effacerProjet({ id: idProjet });
        });

        test("Personne pour commencer", async () => {
          await attendreRésultat(relations, "propres", (x) => x?.length === 0);
          await attendreRésultat(relations, "autre", (x) => x?.length === 0);

          expect(isArray(relations.propres)).toBe(true);
          expect(relations.propres).toHaveLength(0);

          expect(isArray(relations.autre)).toBe(true);
          expect(relations.autre).toHaveLength(0);
        });

        test("Ajout membre de confiance détecté", async () => {
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await attendreRésultat(
            relations,
            "propres",
            (x) => !!x && Boolean(x.length)
          );
          expect(relations.propres!.map((r) => r.idBdCompte)).toEqual(
            expect.arrayContaining([idBdCompte2])
          );
        });

        test("Bloquer membre détecté", async () => {
          await client.réseau!.bloquerMembre({ idBdCompte: idBdCompte3 });
          await attendreRésultat(
            relations,
            "propres",
            (x) => !!x && x.length === 2
          );
          expect(relations.propres!.map((r) => r.idBdCompte)).toEqual(
            expect.arrayContaining([idBdCompte3])
          );
        });

        test("Débloquer membre détecté", async () => {
          await client.réseau!.débloquerMembre({ idBdCompte: idBdCompte3 });
          await attendreRésultat(
            relations,
            "propres",
            (x) => !!x && x.length === 1
          );
        });

        test("Ajout membres au réseau d'un autre membre détecté", async () => {
          await attendreRésultat(
            relations,
            "autre",
            (x?: infoConfiance[]) => x?.length === 1
          );
          expect(isArray(relations.autre));
          expect(relations.autre).toHaveLength(1);
          expect(relations.autre!.map((r) => r.idBdCompte)).toEqual(
            expect.arrayContaining([idBdCompte2])
          );
        });

        test("Enlever membre de confiance détecté", async () => {
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          expect(relations.propres).toHaveLength(0);
        });

        test("Ajout aux favoris détecté", async () => {
          idMotClef2 = await client2.motsClefs!.créerMotClef();
          await client.favoris!.épinglerFavori({
            id: idMotClef2,
            dispositifs: "TOUS",
          });

          await attendreRésultat(
            relations,
            "propres",
            (x) => !!x && Boolean(x.length)
          );
          expect(relations.propres!.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Ajout aux favoris d'un tiers détecté", async () => {
          await attendreRésultat(
            relations,
            "autre",
            (x) => !!x && Boolean(x.length)
          );
          expect(relations.autre!.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Enlever favori détecté", async () => {
          await client.favoris!.désépinglerFavori({ id: idMotClef2 });
          expect(relations.propres).toHaveLength(0);

          await attendreRésultat(
            relations,
            "autre",
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(relations.autre).toHaveLength(0);
        });

        test("Ajout coauteur BD détecté", async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          await client.bds!.inviterAuteur({
            idBd,
            idBdCompteAuteur: idBdCompte2,
            rôle: MEMBRE,
          });

          await attendreRésultat(
            relations,
            "propres",
            (x) => !!x && Boolean(x.length)
          );

          expect(relations.propres!.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Ajout coauteur BD d'un tiers détecté", async () => {
          await attendreRésultat(
            relations,
            "autre",
            (x) => !!x && Boolean(x.length)
          );
          expect(relations.autre!.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Enlever bd détecté", async () => {
          await client.bds!.effacerBd({ id: idBd });

          expect(relations.propres).toHaveLength(0);

          await attendreRésultat(
            relations,
            "autre",
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(relations.autre).toHaveLength(0);
        });

        test("Ajout coauteur projet détecté", async () => {
          idProjet = await client.projets!.créerProjet();
          await client.projets!.inviterAuteur({
            idProjet,
            idBdCompteAuteur: idBdCompte2,
            rôle: MEMBRE,
          });

          await attendreRésultat(
            relations,
            "propres",
            (x) => !!x && Boolean(x.length)
          );
          expect(relations.propres!.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Ajout coauteur projet d'un tiers détecté", async () => {
          await attendreRésultat(
            relations,
            "autre",
            (x) => !!x && Boolean(x.length)
          );
          expect(relations.autre!.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Enlever projet détecté", async () => {
          await client.projets!.effacerProjet({ id: idProjet });

          expect(relations.propres).toHaveLength(0);

          await attendreRésultat(
            relations,
            "autre",
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(relations.autre).toHaveLength(0);
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

          await attendreRésultat(
            relations,
            "propres",
            (x) => !!x && Boolean(x.length)
          );

          expect(relations.propres!.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Ajout coauteur variable d'un tiers détecté", async () => {
          await attendreRésultat(
            relations,
            "autre",
            (x) => !!x && Boolean(x.length)
          );
          expect(relations.autre!.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Enlever variable détecté", async () => {
          await client.variables!.effacerVariable({ id: idVariable });

          expect(relations.propres).toHaveLength(0);

          await attendreRésultat(
            relations,
            "autre",
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(relations.autre).toHaveLength(0);
        });

        test("Ajout coauteur mot-clef détecté", async () => {
          idMotClef1 = await client.motsClefs!.créerMotClef();
          await client.motsClefs!.inviterAuteur({
            idMotClef: idMotClef1,
            idBdCompteAuteur: idBdCompte2,
            rôle: MEMBRE,
          });

          await attendreRésultat(
            relations,
            "propres",
            (x) => !!x && Boolean(x.length)
          );
          expect(relations.propres!.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Ajout coauteur mot-clef d'un tiers détecté", async () => {
          await attendreRésultat(
            relations,
            "autre",
            (x) => !!x && Boolean(x.length)
          );
          expect(relations.autre!.map((r) => r.idBdCompte)).toContain(
            idBdCompte2
          );
        });

        test("Enlever mot-clef détecté", async () => {
          await client.motsClefs!.effacerMotClef({ id: idMotClef1 });

          expect(relations.propres).toHaveLength(0);

          await attendreRésultat(
            relations,
            "autre",
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(relations.autre).toHaveLength(0);
        });
      });

      describe.skip("Suivre relations confiance", function () {
        let fOublier: schémaFonctionOublier;
        let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];
        const rés: { ultat?: infoRelation[] } = {};

        beforeAll(async () => {
          ({ fOublier, fChangerProfondeur } =
            await client.réseau!.suivreRelationsConfiance({
              f: (r) => (rés.ultat = r),
              profondeur: 1,
            }));
        });

        afterAll(async () => {
          if (fOublier) fOublier();
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client2.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
        });

        test("Relations immédiates", async () => {
          const réf: infoRelation[] = [
            {
              de: idBdCompte1,
              pour: idBdCompte2,
              confiance: 1,
              profondeur: 0,
            },
          ];
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });

          await attendreRésultat(rés, "ultat", (x) => !!x && !!x.length);
          expect(rés.ultat).toEqual(réf);
        });
        test("Relations indirectes", async () => {
          const réf: infoRelation[] = [
            {
              de: idBdCompte1,
              pour: idBdCompte2,
              confiance: 1,
              profondeur: 0,
            },
            {
              de: idBdCompte2,
              pour: idBdCompte3,
              confiance: 1,
              profondeur: 1,
            },
          ];
          await client2.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });

          await attendreRésultat(rés, "ultat", (x) => !!x && x.length > 1);
          expect(rés.ultat).toEqual(réf);
        },
        config.patience);

        test(
          "Diminuer profondeur",
          async () => {
            const réf: infoRelation[] = [
              {
                de: idBdCompte1,
                pour: idBdCompte2,
                confiance: 1,
                profondeur: 0,
              },
            ];
            fChangerProfondeur(0);
            await attendreRésultat(rés, "ultat", (x) => !!x && x.length === 1);
            expect(rés.ultat).toEqual(réf);
          },
          config.patience
        );

        test("Augmenter profondeur", async () => {
          const réf: infoRelation[] = [
            {
              de: idBdCompte1,
              pour: idBdCompte2,
              confiance: 1,
              profondeur: 0,
            },
            {
              de: idBdCompte2,
              pour: idBdCompte3,
              confiance: 1,
              profondeur: 1,
            },
          ];

          fChangerProfondeur(1);

          await attendreRésultat(rés, "ultat", (x) => !!x && x.length === 2);
          expect(rés.ultat).toEqual(réf);
        });
      });

      describe("Suivre comptes réseau", function () {
        let fOublier: schémaFonctionOublier;
        let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];

        const rés: { ultat?: infoMembreRéseau[] } = {};

        beforeAll(async () => {
          ({ fOublier, fChangerProfondeur } =
            await client.réseau!.suivreComptesRéseau({
              f: (c) => (rés.ultat = c),
              profondeur: 1,
            }));
        });

        afterAll(async () => {
          if (fOublier) fOublier();

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
        });

        test("Relations confiance immédiates", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 0,
            },
          ];
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });

          await attendreRésultat(rés, "ultat", (x) => !!x && x.length > 1);
          expect(rés.ultat).toEqual(expect.arrayContaining(réf));
        });
        test("Relations confiance indirectes", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 0,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 0.8,
              profondeur: 1,
            },
          ];
          await client2.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });

          await attendreRésultat(rés, "ultat", (x) => !!x && x.length > 2);
          expect(rés.ultat).toEqual(expect.arrayContaining(réf));
        }, config.patience);
        test("Relations confiance directes et indirectes", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 0,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 1,
              profondeur: 0,
            },
          ];
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });

          await attendreRésultat(
            rés,
            "ultat",
            (x) =>
              !!x && x.map((y) => y.confiance).reduce((i, j) => i * j, 1) === 1
          );
          expect(rés.ultat).toEqual(expect.arrayContaining(réf));
        });
        test("Enlever relation confiance directe (en double)", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 0,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 0.8,
              profondeur: 1,
            },
          ];
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });

          await attendreRésultat(
            rés,
            "ultat",
            (x) =>
              !!x && x.map((y) => y.confiance).reduce((i, j) => i * j, 1) < 1
          );
          expect(rés.ultat).toEqual(expect.arrayContaining(réf));
        });
        test("Enlever relation confiance indirecte", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 0,
            },
          ];
          await client2.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });

          await attendreRésultat(rés, "ultat", (x) => !!x && x.length === 2);
          expect(rés.ultat).toEqual(expect.arrayContaining(réf));
        });
        test("Enlever relation confiance directe", async () => {
          const réf = [moiMême];

          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });

          await attendreRésultat(rés, "ultat", (x) => !!x && x.length === 1);
          expect(rés.ultat).toEqual(expect.arrayContaining(réf));
        });
        test("Membre bloqué directement", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: -1,
              profondeur: 0,
            },
          ];
          await client.réseau!.bloquerMembre({
            idBdCompte: idBdCompte2,
          });

          await attendreRésultat(rés, "ultat", (x) => !!x && x.length > 1);
          expect(rés.ultat).toEqual(expect.arrayContaining(réf));
        });
        test("Membre débloqué directement", async () => {
          const réf = [moiMême];

          await client.réseau!.débloquerMembre({
            idBdCompte: idBdCompte2,
          });

          await attendreRésultat(rés, "ultat", (x) => !!x && x.length === 1);
          expect(rés.ultat).toEqual(expect.arrayContaining(réf));
        });
        test("Membre bloqué indirectement", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 0,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: -0.9,
              profondeur: 1,
            },
          ];
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client2.réseau!.bloquerMembre({
            idBdCompte: idBdCompte3,
          });

          await attendreRésultat(rés, "ultat", (x) => !!x && x.length === 3);
          expect(rés.ultat).toEqual(expect.arrayContaining(réf));
        });
        test("Précédence confiance propre", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 0,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 1,
              profondeur: 0,
            },
          ];
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });

          await attendreRésultat(
            rés,
            "ultat",
            (x) =>
              !!x &&
              x.find((y) => y.idBdCompte === client3.idBdCompte)?.confiance ===
                1
          );
          expect(rés.ultat).toEqual(expect.arrayContaining(réf));

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
        test(
          "Diminuer profondeur",
          async () => {
            const réf: infoMembreRéseau[] = [
              moiMême,
              {
                idBdCompte: idBdCompte2,
                confiance: 1,
                profondeur: 0,
              },
            ];
            await client.réseau!.faireConfianceAuMembre({
              idBdCompte: idBdCompte2,
            });
            await client2.réseau!.faireConfianceAuMembre({
              idBdCompte: idBdCompte3,
            });
            await attendreRésultat(rés, "ultat", (x) => !!x && x.length === 2);

            fChangerProfondeur(0);
            await attendreRésultat(rés, "ultat", (x) => !!x && x.length === 1);
            expect(rés.ultat).toEqual(expect.arrayContaining(réf));
          },
          config.patience
        );
        test("Augmenter profondeur", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 0,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 0.8,
              profondeur: 1,
            },
          ];

          fChangerProfondeur(1);

          await attendreRésultat(rés, "ultat", (x) => !!x && x.length === 3);
          expect(rés.ultat).toEqual(expect.arrayContaining(réf));
        });
      });

      describe.skip("Suivre comptes réseau et en ligne", function () {
        let fOublier: schémaFonctionOublier;
        let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];

        const rés: { ultat?: infoMembreRéseau[] } = {};

        beforeAll(async () => {
          ({ fOublier, fChangerProfondeur } =
            await client.réseau!.suivreComptesRéseauEtEnLigne({
              f: (c) => (rés.ultat = c),
              profondeur: 1,
            }));
        });

        afterAll(async () => {
          if (fOublier) fOublier();

          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client2.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
        });

        test("Comptes en ligne détectés", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 0,
              profondeur: -1,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 0,
              profondeur: -1,
            },
          ];

          await attendreRésultat(rés, "ultat", (x) => !!x && x.length === 3);
          expect(rés.ultat).toEqual(expect.arrayContaining(réf));
        });

        test("Comptes réseau détectés", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idBdCompte2,
              confiance: 1,
              profondeur: 0,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 0,
              profondeur: -1,
            },
          ];

          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await attendreRésultat(
            rés,
            "ultat",
            (x) =>
              !!x &&
              x.find((x) => x.idBdCompte === client2.idBdCompte)?.confiance ===
                1
          );

          expect(rés.ultat).toEqual(expect.arrayContaining(réf));
        });

        test("Changer profondeur", async () => {
          await client2.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
          await attendreRésultat(
            rés,
            "ultat",
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
              profondeur: 0,
            },
            {
              idBdCompte: idBdCompte3,
              confiance: 0,
              profondeur: -1,
            },
          ];
          fChangerProfondeur(0);
          await attendreRésultat(
            rés,
            "ultat",
            (x) =>
              !!x &&
              x.find((x) => x.idBdCompte === client3.idBdCompte)?.confiance ===
                0
          );

          expect(rés.ultat).toEqual(expect.arrayContaining(réf));
        });
      });

      describe.skip("Suivre confiance mon réseau pour membre", function () {
        let fOublier: schémaFonctionOublier;
        let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];

        const rés: { ultat?: number } = {};

        beforeAll(async () => {
          ({ fOublier, fChangerProfondeur } =
            await client.réseau!.suivreConfianceMonRéseauPourMembre({
              idBdCompte: idBdCompte3,
              f: (confiance) => (rés.ultat = confiance),
            }));
        });

        afterAll(async () => {
          if (fOublier) fOublier();
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client2.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
        });

        test("Confiance initiale 0", async () => {
          await attendreRésultat(rés, "ultat", (x) => x === 0);
        });

        test("Faire confiance au membre", async () => {
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client2.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });

          await attendreRésultat(rés, "ultat", (x) => !!x && x > 0);
          expect(rés.ultat).toEqual(0.8);
        });

        test("Changer profondeur", async () => {
          fChangerProfondeur(0);
          await attendreRésultat(rés, "ultat", (x) => x === 0);
        });
      });

      describe.skip("Suivre confiance auteurs", function () {
        let fOublier: schémaFonctionOublier;
        let idMotClef: string;

        const rés: { ultat?: number } = {};

        beforeAll(async () => {
          idMotClef = await client2.motsClefs!.créerMotClef();

          fOublier = await client.réseau!.suivreConfianceAuteurs({
            idItem: idMotClef,
            clef: "motsClefs",
            f: (confiance) => (rés.ultat = confiance),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
          if (idMotClef)
            await client2.motsClefs!.effacerMotClef({ id: idMotClef });

          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });
          await client.réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
        });

        test("Confiance 0 pour commencer", async () => {
          await attendreRésultat(rés, "ultat", (x) => x === 0);
        });

        test("Ajout auteur au réseau", async () => {
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte2,
          });

          await attendreRésultat(rés, "ultat", (x) => !!x && x > 0);
          expect(rés.ultat).toEqual(1);
        });

        test("Ajout coauteur au réseau", async () => {
          await client2.motsClefs!.inviterAuteur({
            idMotClef,
            idBdCompteAuteur: idBdCompte3,
            rôle: MEMBRE,
          });
          await client3.motsClefs!.ajouterÀMesMotsClefs({ id: idMotClef });
          await attendreRésultat(rés, "ultat", (x) => !!x && x > 1);

          expect(rés.ultat).toBeGreaterThan(1);
          expect(rés.ultat).toBeLessThan(2);

          const avant = rés.ultat!;
          await client.réseau!.faireConfianceAuMembre({
            idBdCompte: idBdCompte3,
          });
          await attendreRésultat(rés, "ultat", (x) => !!x && x > avant);

          expect(rés.ultat).toEqual(2);
        });

        test("Coauteur se retire", async () => {
          await client3.motsClefs!.enleverDeMesMotsClefs({ id: idMotClef });
          await attendreRésultat(rés, "ultat", (x) => !!x && x < 2);

          expect(rés.ultat).toEqual(1);
        });
      });

      describe.skip("Auteurs", function () {
        describe.skip("Mots-clefs", function () {
          let idMotClef: string;
          let fOublier: schémaFonctionOublier;

          const rés: { ultat?: infoAuteur[] } = {};

          beforeAll(async () => {
            idMotClef = await client.motsClefs!.créerMotClef();
            fOublier = await client.réseau!.suivreAuteursMotClef({
              idMotClef,
              f: (auteurs) => (rés.ultat = auteurs),
            });
          });

          afterAll(async () => {
            if (fOublier) fOublier();
            if (idMotClef) {
              await client.motsClefs!.effacerMotClef({ id: idMotClef });
              await client2.motsClefs!.enleverDeMesMotsClefs({ id: idMotClef });
            }
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

            await attendreRésultat(rés, "ultat", (x) => !!x && x.length > 1);
            expect(rés.ultat).toEqual(réf);
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
            await attendreRésultat(rés, "ultat", (x) =>
              Boolean(
                !!x &&
                  x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
              )
            );

            expect(rés.ultat).toEqual(réf);
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
            await attendreRésultat(
              rés,
              "ultat",
              (x) =>
                !!x &&
                !x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
            );

            expect(rés.ultat).toEqual(réf);
          });
          test("Promotion à modérateur", async () => {
            await client.motsClefs!.inviterAuteur({
              idMotClef,
              idBdCompteAuteur: idBdCompte2,
              rôle: MODÉRATEUR,
            });

            await attendreRésultat(
              rés,
              "ultat",
              (auteurs) =>
                !!auteurs &&
                auteurs.find((a) => a.idBdCompte === idBdCompte2)?.rôle ===
                  MODÉRATEUR
            );
          });
        });

        describe.skip("Variables", function () {
          let idVariable: string;
          let fOublier: schémaFonctionOublier;

          const rés: { ultat?: infoAuteur[] } = {};

          beforeAll(async () => {
            idVariable = await client.variables!.créerVariable({
              catégorie: "numérique",
            });
            fOublier = await client.réseau!.suivreAuteursVariable({
              idVariable,
              f: (auteurs) => (rés.ultat = auteurs),
            });
          });

          afterAll(async () => {
            if (fOublier) fOublier();
            if (idVariable)
              await client.variables!.effacerVariable({ id: idVariable });
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

            await attendreRésultat(rés, "ultat", (x) => !!x && x.length > 1);
            expect(rés.ultat).toEqual(réf);
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
            await attendreRésultat(rés, "ultat", (x) =>
              Boolean(
                !!x &&
                  x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
              )
            );

            expect(rés.ultat).toEqual(réf);
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
            await attendreRésultat(
              rés,
              "ultat",
              (x) =>
                !!x &&
                !x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
            );

            expect(rés.ultat).toEqual(réf);
          });
          test("Promotion à modérateur", async () => {
            await client.variables!.inviterAuteur({
              idVariable,
              idBdCompteAuteur: idBdCompte2,
              rôle: MODÉRATEUR,
            });

            await attendreRésultat(
              rés,
              "ultat",
              (auteurs) =>
                !!auteurs &&
                auteurs.find((a) => a.idBdCompte === idBdCompte2)?.rôle ===
                  MODÉRATEUR
            );
          });
        });

        describe.skip("Bds", function () {
          let idBd: string;
          let fOublier: schémaFonctionOublier;

          const rés: { ultat?: infoAuteur[] } = {};

          beforeAll(async () => {
            idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
            fOublier = await client.réseau!.suivreAuteursBd({
              idBd,
              f: (auteurs) => (rés.ultat = auteurs),
            });
          });

          afterAll(async () => {
            if (fOublier) fOublier();
            if (idBd) await client.bds!.effacerBd({ id: idBd });
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

            await attendreRésultat(rés, "ultat", (x) => !!x && x.length > 1);
            expect(rés.ultat).toEqual(réf);
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
            await attendreRésultat(rés, "ultat", (x) =>
              Boolean(
                !!x &&
                  x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
              )
            );

            expect(rés.ultat).toEqual(réf);
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
            await attendreRésultat(
              rés,
              "ultat",
              (x) =>
                !!x &&
                !x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
            );

            expect(rés.ultat).toEqual(réf);
          });

          test("Promotion à modérateur", async () => {
            await client.bds!.inviterAuteur({
              idBd,
              idBdCompteAuteur: idBdCompte2,
              rôle: MODÉRATEUR,
            });

            await attendreRésultat(
              rés,
              "ultat",
              (auteurs) =>
                !!auteurs &&
                auteurs.find((a) => a.idBdCompte === idBdCompte2)?.rôle ===
                  MODÉRATEUR
            );
          });
        });

        describe.skip("Projets", function () {
          let idProjet: string;
          let fOublier: schémaFonctionOublier;

          const rés: { ultat?: infoAuteur[] } = {};

          beforeAll(async () => {
            idProjet = await client.projets!.créerProjet();
            fOublier = await client.réseau!.suivreAuteursProjet({
              idProjet,
              f: (auteurs) => (rés.ultat = auteurs),
            });
          });

          afterAll(async () => {
            if (fOublier) fOublier();
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

            await attendreRésultat(rés, "ultat", (x) => !!x && x.length > 1);
            expect(rés.ultat).toEqual(réf);
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

            await client2.projets!.ajouterÀMesProjets(idProjet);
            await attendreRésultat(rés, "ultat", (x) =>
              Boolean(
                !!x &&
                  x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
              )
            );

            expect(rés.ultat).toEqual(réf);
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

            await client2.projets!.enleverDeMesProjets(idProjet);
            await attendreRésultat(
              rés,
              "ultat",
              (x) =>
                !!x &&
                !x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
            );

            expect(rés.ultat).toEqual(réf);
          });
          test("Promotion à modérateur", async () => {
            await client.projets!.inviterAuteur({
              idProjet,
              idBdCompteAuteur: idBdCompte2,
              rôle: MODÉRATEUR,
            });

            await attendreRésultat(
              rés,
              "ultat",
              (auteurs) =>
                !!auteurs &&
                auteurs.find((a) => a.idBdCompte === idBdCompte2)?.rôle ===
                  MODÉRATEUR
            );
          });
        });
      });

      describe.skip("Suivre noms membre", function () {
        const rés: { ultat: { [key: string]: string } | undefined } = {
          ultat: undefined,
        };
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          await client.profil!.sauvegarderNom({ langue: "fr", nom: "Julien" });
          fOublier = await client2.réseau!.suivreNomsMembre({
            idCompte: idBdCompte1,
            f: (n) => (rés.ultat = n),
          });
        });

        test("Noms détectés", async () => {
          await attendreRésultat(rés, "ultat", (x) => !!x && Boolean(x.fr));
          expect(rés.ultat?.fr).toEqual("Julien");
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });
      });

      describe.skip("Suivre courriel membre", function () {
        const rés: { ultat: string | null | undefined } = {
          ultat: undefined,
        };
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          await client.profil!.sauvegarderCourriel({
            courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
          });
          fOublier = await client2.réseau!.suivreCourrielMembre({
            idCompte: idBdCompte1,
            f: (c) => (rés.ultat = c),
          });
        });

        test("Courriel détecté", async () => {
          await attendreRésultat(rés, "ultat", (x: string | null | undefined) =>
            Boolean(x)
          );
          expect(rés.ultat).toEqual("தொடர்பு@லஸ்ஸி.இந்தியா");
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });
      });

      describe.skip("Suivre image membre", function () {
        const rés: { ultat: Uint8Array | undefined | null } = {
          ultat: undefined,
        };
        let fOublier: schémaFonctionOublier;

        const IMAGE = fs.readFileSync(
          path.join(dirRessourcesTests(), "logo.svg")
        );

        beforeAll(async () => {
          await client.profil!.sauvegarderImage({ image: IMAGE });
          fOublier = await client2.réseau!.suivreImageMembre({
            idCompte: idBdCompte1,
            f: (i) => (rés.ultat = i),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Image détectée", async () => {
          await attendreRésultat(
            rés,
            "ultat",
            (x: Uint8Array | undefined | null) => Boolean(x)
          );
          expect(rés.ultat).toEqual(new Uint8Array(IMAGE));
        });
      });

      describe.skip("Suivre mots-clefs", function () {
        let idMotClef1: string;
        let idMotClef2: string;

        const rés: { propre?: string[]; autre?: string[] } = {};
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client2.réseau!.suivreMotsClefsMembre({
              idCompte: idBdCompte1,
              f: (motsClefs) => (rés.autre = motsClefs),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreMotsClefsMembre({
              idCompte: idBdCompte2,
              f: (motsClefs) => (rés.propre = motsClefs),
            })
          );
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
          if (idMotClef1)
            await client.motsClefs!.effacerMotClef({ id: idMotClef1 });
          if (idMotClef2)
            await client.motsClefs!.effacerMotClef({ id: idMotClef2 });
        });

        test("Mes propres mots-clefs détectés", async () => {
          idMotClef2 = await client2.motsClefs!.créerMotClef();

          await attendreRésultat(rés, "propre", (x) => !!x && !!x.length);
          expect(rés.propre).toContain(idMotClef2);
        });

        test("Mot-clef d'un autre membre détecté", async () => {
          idMotClef1 = await client.motsClefs!.créerMotClef();
          await attendreRésultat(rés, "autre", (x) => !!x && !!x.length);
          expect(rés.autre).toContain(idMotClef1);
        });
      });

      describe.skip("Suivre variables", function () {
        let idVariable1: string;
        let idVariable2: string;

        const rés: { propres?: string[]; autres?: string[] } = {};
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client2.réseau!.suivreVariablesMembre({
              idCompte: idBdCompte1,
              f: (variables) => (rés.autres = variables),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreVariablesMembre({
              idCompte: idBdCompte2,
              f: (variables) => (rés.propres = variables),
            })
          );
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
          if (idVariable1)
            await client.variables!.effacerVariable({ id: idVariable1 });
          if (idVariable2)
            await client2.variables!.effacerVariable({ id: idVariable2 });
        });

        test("Mes variables détectées", async () => {
          idVariable2 = await client2.variables!.créerVariable({
            catégorie: "numérique",
          });

          await attendreRésultat(rés, "propres", (x) => !!x && !!x.length);
          expect(rés.propres).toContain(idVariable2);
        });

        test("Variable d'un autre membre détectée", async () => {
          idVariable1 = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          await attendreRésultat(rés, "autres", (x) => Boolean(x?.length));
          expect(rés.autres).toContain(idVariable1);
        });
      });

      describe.skip("Suivre BDs", function () {
        const rés: { propres?: string[]; autres?: string[] } = {};
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client2.réseau!.suivreBdsMembre({
              idCompte: idBdCompte1,
              f: (bds) => (rés.autres = bds),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreBdsMembre({
              idCompte: idBdCompte2,
              f: (bds) => (rés.propres = bds),
            })
          );
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        test("Mes BDs détectées", async () => {
          const idBd = await client2.bds!.créerBd({ licence: "ODbl-1_0" });

          await attendreRésultat(rés, "propres", (x) => !!x && !!x.length);
          expect(rés.propres).toContain(idBd);
        });

        test("BD d'un autre membre détectée", async () => {
          const idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          await attendreRésultat(rés, "autres", (x) => !!x && !!x.length);
          expect(rés.autres).toContain(idBd);
        });
      });

      describe.skip("Suivre projets", function () {
        const rés: { propres?: string[]; autres?: string[] } = {};
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client2.réseau!.suivreProjetsMembre({
              idCompte: idBdCompte1,
              f: (projets) => (rés.autres = projets),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreProjetsMembre({
              idCompte: idBdCompte2,
              f: (projets) => (rés.propres = projets),
            })
          );
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        test("Mes projets détectés", async () => {
          const idProjet = await client2.projets!.créerProjet();

          await attendreRésultat(rés, "propres", (x) => !!x && !!x.length);
          expect(rés.propres).toContain(idProjet);
        });

        test("Projet d'un autre membre détecté", async () => {
          const idProjet = await client.projets!.créerProjet();
          await attendreRésultat(rés, "autres", (x) => !!x && !!x.length);
          expect(rés.autres).toContain(idProjet);
        });
      });

      describe.skip("Suivre favoris", function () {
        let idMotClef: string;

        const rés: {
          propres?: ÉlémentFavorisAvecObjet[];
          autres?: ÉlémentFavorisAvecObjet[];
        } = {};
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client2.réseau!.suivreFavorisMembre({
              idCompte: idBdCompte1,
              f: (favoris) => (rés.autres = favoris),
            })
          );
          fsOublier.push(
            await client2.réseau!.suivreFavorisMembre({
              idCompte: idBdCompte2,
              f: (favoris) => (rés.propres = favoris),
            })
          );

          idMotClef = await client.motsClefs!.créerMotClef();
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
          if (idMotClef)
            await client.motsClefs!.effacerMotClef({ id: idMotClef });
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
          await attendreRésultat(rés, "propres", (x) => !!x && !!x.length);
          expect(rés.propres).toEqual(réf);
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
          await attendreRésultat(rés, "autres", (x) => !!x && !!x.length);
          expect(rés.autres).toEqual(réf);
        });
      });

      describe.skip("Suivre favoris objet", function () {
        let idMotClef: string;
        let fOublier: schémaFonctionOublier;

        const rés: {
          ultat?: (ÉlémentFavorisAvecObjet & { idBdCompte: string })[];
        } = {};

        beforeAll(async () => {
          idMotClef = await client.motsClefs!.créerMotClef();

          ({ fOublier } = await client.réseau!.suivreFavorisObjet({
            idObjet: idMotClef,
            f: (favoris) => (rés.ultat = favoris),
          }));
        });

        afterAll(async () => {
          if (fOublier) fOublier();
          if (idMotClef)
            await client.motsClefs!.effacerMotClef({ id: idMotClef });
        });

        test("Aucun favoris pour commencer", async () => {
          await attendreRésultat(rés, "ultat");
          expect(rés.ultat).toHaveLength(0);
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
          await attendreRésultat(rés, "ultat", (x) => !!x && !!x.length);

          expect(rés.ultat).toEqual(réf);
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
          await attendreRésultat(rés, "ultat", (x) => !!x && x.length === 2);

          expect(rés.ultat).toEqual(réf);
        });
      });

      describe.skip("Suivre réplications", function () {
        let idBd: string;

        const rés: { ultat?: infoRéplications } = {
          ultat: undefined,
        };
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          fsOublier.push(
            (
              await client.réseau!.suivreRéplications({
                idObjet: idBd,
                f: (bds) => (rés.ultat = bds),
              })
            ).fOublier
          );
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
          if (idBd) {
            await client.bds!.effacerBd({ id: idBd });
            await client2.favoris!.désépinglerFavori({ id: idBd });
          }
        });

        test("Auteur de la BD pour commencer", async () => {
          await client.favoris!.épinglerFavori({
            id: idBd,
            dispositifs: "TOUS",
          });

          await attendreRésultat(
            rés,
            "ultat",
            (x) => !!x && x.membres.length > 0
          );

          expect(
            rés.ultat!.membres.map((m) => m.infoMembre.idBdCompte)
          ).toContain(idBdCompte1);
          expect(rés.ultat!.dispositifs.map((d) => d.idDispositif)).toContain(
            idOrbite1
          );
        });

        test("Ajout d'une réplication détectée", async () => {
          await client2.favoris!.épinglerFavori({
            id: idBd,
            dispositifs: "TOUS",
          });

          await attendreRésultat(
            rés,
            "ultat",
            (x) => !!x && x.membres.length > 1
          );

          expect(
            rés.ultat!.membres.map((m) => m.infoMembre.idBdCompte)
          ).toEqual(expect.arrayContaining([idBdCompte1, idBdCompte2]));
          expect(rés.ultat!.dispositifs.map((d) => d.idDispositif)).toEqual(
            expect.arrayContaining([idOrbite1, idOrbite2])
          );
        });
      });

      describe.skip("Suivre BD par mot-clef unique", function () {
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

        const rés: {
          ultat?: string[];
          ultat2?: élémentDeMembre<élémentBdListeDonnées>[];
        } = { ultat: undefined, ultat2: undefined };
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
          )[0].id

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
                f: (bds) => (rés.ultat = bds),
                nRésultatsDésirés: 100,
              })
            ).fOublier
          );
          fsOublier.push(
            (
              await client.réseau!.suivreÉlémentsDeTableauxUniques({
                motClefUnique: motClef,
                clef: clefTableau,
                f: (éléments) => (rés.ultat2 = éléments),
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
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        test("Suivre BDs du réseau", async () => {
          /*await attendreRésultat(
            rés,
            "ultat",
            (x?: string[]) => x && x.length === 2
          );*/
          expect(isArray(rés.ultat)).toBe(true);
          expect(rés.ultat).toHaveLength(2);
          expect(rés.ultat).toEqual(expect.arrayContaining([idBd1, idBd2]));
        });
        test("Suivre éléments des BDs", async () => {
          /*await attendreRésultat(
            rés,
            "ultat2",
            (x?: string[]) => x && x.length === 3
          );*/
          const élémentsSansId = rés.ultat2!.map((r) => {
            delete r.élément.données.id;
            return r;
          });
          expect(isArray(élémentsSansId)).toBe(true);
          expect(élémentsSansId).toHaveLength(3);
          expect(élémentsSansId).toEqual(
            expect.arrayContaining([
              {
                idBdAuteur: idBdCompte1,
                élément: {
                  empreinte: empreinte1,
                  données: données1,
                },
              },
              {
                idBdAuteur: idBdCompte1,
                élément: {
                  empreinte: empreinte2,
                  données: données2,
                },
              },
              {
                idBdAuteur: idBdCompte2,
                élément: {
                  empreinte: empreinte3,
                  données: données3,
                },
              },
            ])
          );
        });
      });
    });
  });
});
