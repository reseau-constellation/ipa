import isArray from "lodash/isArray";
import fs from "fs";
import path from "path";

import { MODÉRATEUR, MEMBRE } from "@/accès/consts.js";
import ClientConstellation from "@/client.js";
import {
  schémaFonctionSuivi,
  schémaRetourFonctionRecherche,
  schémaFonctionOublier,
  uneFois,
  infoAuteur,
} from "@/utils/index.js";
import { ÉlémentFavorisAvecObjet } from "@/favoris.js";
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
} from "@/reseau.js";
import { schémaSpécificationBd, infoTableauAvecId } from "@/bds.js";
import { élémentBdListeDonnées } from "@/tableaux.js";

import {
  AttendreRésultat,
  générerClients,
  typesClients,
  dirRessourcesTests,
  typeClient
} from "@/utilsTests/index.js";
import { config } from "@/utilsTests/sfipTest.js";


async function toutPréparer(n: number, type: typeClient) {
  const { fOublier: fOublierClients, clients } = await générerClients(
    n,
    type
  );
  const idsNodesSFIP = await Promise.all(clients.map(async c=> (await c.obtIdSFIP()).id.toCID().toString()))
  const idsOrbite = await Promise.all(clients.map(async c => await c.obtIdOrbite()))
  const idsBdCompte = await Promise.all(clients.map(async c => await c.obtIdCompte()))
  return {
    clients, fOublierClients, idsNodesSFIP, idsOrbite, idsBdCompte
  }
}

typesClients.forEach((type) => {
  describe("Client " + type, function () {

    describe("Réseau", function () {

      describe("Suivre en ligne", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let idsNodesSFIP: string[];
        let idsOrbite: string[];
        let clients: ClientConstellation[];

        const rés = new AttendreRésultat<{ addr: string; peer: string }[]>();
        const dispositifs = new AttendreRésultat<statutDispositif[]>();
        const membresEnLigne = new AttendreRésultat<statutMembre[]>();
        const fsOublier: schémaFonctionOublier[] = [];
        
        beforeAll(async () => {
          ({ idsBdCompte, idsNodesSFIP, idsOrbite, clients, fOublierClients } = await toutPréparer(3, type));

          fsOublier.push(await clients[0].réseau!.suivreConnexionsPostesSFIP({
            f: (c) => rés.mettreÀJour(c),
          }));
          fsOublier.push(await clients[0].réseau!.suivreConnexionsDispositifs({
            f: (d) => dispositifs.mettreÀJour(d),
          }));
          fsOublier.push(await clients[0].réseau!.suivreConnexionsMembres({
            f: (c) => membresEnLigne.mettreÀJour(c),
          }));
  
        }, config.patienceInit * 3)

        afterAll(async () => {
          await Promise.all(fsOublier.map(f=>f()));
          if (fOublierClients) await fOublierClients();
          rés.toutAnnuler();
          dispositifs.toutAnnuler();
          membresEnLigne.toutAnnuler();
        });

        test("Autres postes détectés", async () => {
          expect(rés.val.map((r) => r.peer)).toEqual(
            expect.arrayContaining([idsNodesSFIP[1], idsNodesSFIP[2]])
          );
        });

        test("Autres dispositifs détectés", async () => {
          const val = await dispositifs.attendreQue(
            (x?: statutDispositif[]) => !!x && x.length === 3
          );
          expect(val.map((d) => d.infoDispositif.idOrbite)).toEqual(
            expect.arrayContaining(idsOrbite)
          );
        });
          
        test("Autres membres détectés", async () => {
          const réfRés: infoMembre[] = []
          for (let i = 0; i <= clients.length -1; i++) {
            const identitéOrbite = await clients[i].obtIdentitéOrbite();
            réfRés.push(
              {
                idBdCompte: idsBdCompte[i],
                dispositifs: [
                  {
                    idSFIP: idsNodesSFIP[i],
                    idOrbite: idsOrbite[i],
                    idCompte: idsBdCompte[i],
                    clefPublique: identitéOrbite.publicKey,
                    encryption: {
                      type: await clients[i].encryption.obtNom(),
                      clefPublique: (await clients[i].encryption.obtClefs()).publique,
                    },
                    signatures: identitéOrbite.signatures,
                  },
                ],
              }
            )
          }
          const val = await membresEnLigne.attendreQue((x) => x.length >= 3);
          expect(val.map((r) => r.infoMembre)).toEqual(
            expect.arrayContaining(réfRés)
          );
        });

      });

      describe("Membres fiables", function () {
        const fiablesPropres = new AttendreRésultat<string[]>();
        const fiablesAutres = new AttendreRésultat<string[]>();

        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];

        let clients: ClientConstellation[];

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2, type));
          fsOublier.push(
            await clients[0].réseau!.suivreFiables({
              f: (m) => fiablesPropres.mettreÀJour(m),
            })
          );
          fsOublier.push(
            await clients[1].réseau!.suivreFiables({
              f: (m) => fiablesAutres.mettreÀJour(m),
              idBdCompte: idsBdCompte[0],
            })
          );
        }, config.patienceInit);

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (fOublierClients) await fOublierClients();
          fiablesPropres.toutAnnuler();
          fiablesAutres.toutAnnuler();
        });

        test("Personne pour commencer", async () => {
          await fiablesPropres.attendreExiste();
          expect(fiablesPropres.val).toHaveLength(0);
        });

        test("Faire confiance", async () => {
          await clients[0].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
          });
          await fiablesPropres.attendreQue(x=>x!! && x.length > 0);
          expect(fiablesPropres.val).toHaveLength(1);
          expect(fiablesPropres.val).toEqual(
            expect.arrayContaining([idsBdCompte[1]])
          );
        });

        test("Détecter confiance d'autre membre", async () => {
          const val = await fiablesAutres.attendreQue(
            (x) => !!x && x.length > 0
          );
          expect(val).toHaveLength(1);
          expect(val).toEqual(expect.arrayContaining([idsBdCompte[1]]));
        });

        test("Un débloquage accidental ne fait rien", async () => {
          await clients[0].réseau!.débloquerMembre({ idBdCompte: idsBdCompte[1] });
          expect(isArray(fiablesPropres.val)).toBe(true);
          expect(fiablesPropres.val).toHaveLength(1);
          expect(fiablesPropres.val).toEqual(
            expect.arrayContaining([idsBdCompte[1]])
          );
        });

        test("Il n'était pas si chouette que ça après tout", async () => {
          await clients[0].réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
          });
          expect(fiablesPropres.val).toHaveLength(0);
        });
      });

      describe("Membres bloqués", function () {

        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];


        const bloquésTous = new AttendreRésultat<infoBloqué[]>();
        const bloquésPubliques = new AttendreRésultat<string[]>();
        const bloquésAutreMembre = new AttendreRésultat<infoBloqué[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3, type));
          fsOublier.push(
            await clients[0].réseau!.suivreBloqués({
              f: (m) => bloquésTous.mettreÀJour(m),
            })
          );
          fsOublier.push(
            await clients[0].réseau!.suivreBloquésPubliques({
              f: (m) => bloquésPubliques.mettreÀJour(m),
            })
          );
          fsOublier.push(
            await clients[1].réseau!.suivreBloqués({
              f: (m) => bloquésAutreMembre.mettreÀJour(m),
              idBdCompte: idsBdCompte[0],
            })
          );
        }, config.patienceInit);

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (fOublierClients) await fOublierClients();

          bloquésTous.toutAnnuler();
          bloquésPubliques.toutAnnuler();
          bloquésAutreMembre.toutAnnuler();
        });

        test("Personne pour commencer", async () => {
          await bloquésPubliques.attendreExiste();
          expect(bloquésPubliques.val).toHaveLength(0);
        });

        test("Bloquer quelqu'un", async () => {
          await clients[0].réseau!.bloquerMembre({ idBdCompte: idsBdCompte[1] });
          await bloquésTous.attendreQue(x=>!!x && x.length > 0)

          expect(bloquésTous.val).toHaveLength(1);
          expect(bloquésTous.val).toEqual(
            expect.arrayContaining([
              {
                idBdCompte: idsBdCompte[1],
                privé: false,
              },
            ])
          );
          expect(bloquésPubliques.val).toEqual(
            expect.arrayContaining([idsBdCompte[1]])
          );
        });

        test("Un dé-confiance accidental ne fait rien", async () => {
          await clients[0].réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
          });

          const bloqués = await bloquésTous.attendreQue(x=>!!x && x.length > 0)

          expect(bloqués).toEqual(
            expect.arrayContaining([
              {
                idBdCompte: idsBdCompte[1],
                privé: false,
              },
            ])
          );
        });

        test("Bloquer privé", async () => {
          await clients[0].réseau!.bloquerMembre({
            idBdCompte: idsBdCompte[2],
            privé: true,
          });

          const bloqués = await bloquésTous.attendreQue(x=>!!x && x.length > 1) 
          expect(bloqués).toEqual(
            expect.arrayContaining([
              {
                idBdCompte: idsBdCompte[1],
                privé: false,
              },
              {
                idBdCompte: idsBdCompte[2],
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
                idBdCompte: idsBdCompte[1],
                privé: false,
              },
            ])
          );
        });

        test("On ne détecte pas le bloqué privé d'un autre membre", async () => {
          expect(bloquésAutreMembre.val.map((b) => b.idBdCompte)).not.toContain(
            idsBdCompte[2]
          );
        });

        test("Débloquer publique", async () => {
          await clients[0].réseau!.débloquerMembre({ idBdCompte: idsBdCompte[1] });
          expect(bloquésPubliques.val).toHaveLength(0);
        });

        test("Débloquer privé", async () => {
          await clients[0].réseau!.débloquerMembre({ idBdCompte: idsBdCompte[2] });
          expect(bloquésTous.val).toHaveLength(0);
        });
      });

      describe("Suivre relations immédiates", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];

        let idMotClef1: string;
        let idMotClef2: string;
        let idBd: string;
        let idVariable: string;
        let idProjet: string;

        const relationsPropres = new AttendreRésultat<infoConfiance[]>();
        const relationsAutres = new AttendreRésultat<infoConfiance[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3, type));
          fsOublier.push(
            await clients[0].réseau!.suivreRelationsImmédiates({
              f: (c) => relationsPropres.mettreÀJour(c),
            })
          );
          fsOublier.push(
            await clients[1].réseau!.suivreRelationsImmédiates({
              f: (c) => relationsAutres.mettreÀJour(c),
              idBdCompte: idsBdCompte[0],
            })
          );
        }, config.patienceInit);

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (fOublierClients) await fOublierClients()

          relationsPropres.toutAnnuler();
          relationsAutres.toutAnnuler();
        });

        test("Personne pour commencer", async () => {
          const propres = await relationsPropres.attendreExiste();
          const autres = await relationsAutres.attendreExiste();

          expect(isArray(propres)).toBe(true);
          expect(propres).toHaveLength(0);

          expect(isArray(autres)).toBe(true);
          expect(autres).toHaveLength(0);
        });

        test("Ajout membre de confiance détecté", async () => {
          await clients[0].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
          });
          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toEqual(
            expect.arrayContaining([idsBdCompte[1]])
          );
        });

        test("Bloquer membre détecté", async () => {
          await clients[0].réseau!.bloquerMembre({ idBdCompte: idsBdCompte[2] });
          const val = await relationsPropres.attendreQue(
            (x) => !!x && x.length === 2
          );
          expect(val.map((r) => r.idBdCompte)).toEqual(
            expect.arrayContaining([idsBdCompte[2]])
          );
        });

        test("Débloquer membre détecté", async () => {
          await clients[0].réseau!.débloquerMembre({ idBdCompte: idsBdCompte[2] });
          await relationsPropres.attendreQue((x) => !!x && x.length === 1);
        });

        test("Ajout membres au réseau d'un autre membre détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x?: infoConfiance[]) => x?.length === 2
          );

          expect(val.map((r) => r.idBdCompte)).toEqual(
            expect.arrayContaining([idsBdCompte[1]])
          );
        });

        test("Enlever membre de confiance détecté", async () => {
          await clients[0].réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
          });
          expect(relationsPropres.val).toHaveLength(0);
        });

        test("Ajout aux favoris détecté", async () => {
          idMotClef2 = await clients[1].motsClefs!.créerMotClef();
          await clients[0].favoris!.épinglerFavori({
            id: idMotClef2,
            dispositifs: "TOUS",
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(idsBdCompte[1]);
        });

        test("Ajout aux favoris d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(idsBdCompte[1]);
        });

        test("Enlever favori détecté", async () => {
          await clients[0].favoris!.désépinglerFavori({ id: idMotClef2 });
          expect(relationsPropres.val).toHaveLength(0);

          const val = await relationsAutres.attendreQue(
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(val).toHaveLength(0);
        });

        test("Ajout coauteur BD détecté", async () => {
          idBd = await clients[0].bds!.créerBd({ licence: "ODbl-1_0" });
          await clients[0].bds!.inviterAuteur({
            idBd,
            idBdCompteAuteur: idsBdCompte[1],
            rôle: MEMBRE,
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );

          expect(val.map((r) => r.idBdCompte)).toContain(idsBdCompte[1]);
        });

        test("Ajout coauteur BD d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(idsBdCompte[1]);
        });

        test("Enlever bd détecté", async () => {
          await clients[0].bds!.effacerBd({ id: idBd });

          expect(relationsPropres.val).toHaveLength(0);

          const val = await relationsAutres.attendreQue(
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(val).toHaveLength(0);
        });

        test("Ajout coauteur projet détecté", async () => {
          idProjet = await clients[0].projets!.créerProjet();
          await clients[0].projets!.inviterAuteur({
            idProjet,
            idBdCompteAuteur: idsBdCompte[1],
            rôle: MEMBRE,
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(idsBdCompte[1]);
        });

        test("Ajout coauteur projet d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(idsBdCompte[1]);
        });

        test("Enlever projet détecté", async () => {
          await clients[0].projets!.effacerProjet({ id: idProjet });

          expect(relationsPropres.val).toHaveLength(0);

          const val = await relationsAutres.attendreQue(
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(val).toHaveLength(0);
        });

        test("Ajout coauteur variable détecté", async () => {
          idVariable = await clients[0].variables!.créerVariable({
            catégorie: "numérique",
          });
          await clients[0].variables!.inviterAuteur({
            idVariable,
            idBdCompteAuteur: idsBdCompte[1],
            rôle: MEMBRE,
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );

          expect(val.map((r) => r.idBdCompte)).toContain(idsBdCompte[1]);
        });

        test("Ajout coauteur variable d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(idsBdCompte[1]);
        });

        test("Enlever variable détecté", async () => {
          await clients[0].variables!.effacerVariable({ id: idVariable });

          expect(relationsPropres.val).toHaveLength(0);

          const val = await relationsAutres.attendreQue(
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(val).toHaveLength(0);
        });

        test("Ajout coauteur mot-clef détecté", async () => {
          idMotClef1 = await clients[0].motsClefs!.créerMotClef();
          await clients[0].motsClefs!.inviterAuteur({
            idMotClef: idMotClef1,
            idBdCompteAuteur: idsBdCompte[1],
            rôle: MEMBRE,
          });

          const val = await relationsPropres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(idsBdCompte[1]);
        });

        test("Ajout coauteur mot-clef d'un tiers détecté", async () => {
          const val = await relationsAutres.attendreQue(
            (x) => !!x && Boolean(x.length)
          );
          expect(val.map((r) => r.idBdCompte)).toContain(idsBdCompte[1]);
        });

        test("Enlever mot-clef détecté", async () => {
          await clients[0].motsClefs!.effacerMotClef({ id: idMotClef1 });

          expect(relationsPropres.val).toHaveLength(0);

          await relationsAutres.attendreQue(
            (x?: infoConfiance[]) => !!x && !x.length
          );
          expect(relationsAutres.val).toHaveLength(0);
        });
      });

      describe("Suivre relations confiance", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];

        let fOublier: schémaFonctionOublier;
        let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];
        const rés = new AttendreRésultat<infoRelation[]>();

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3, type));
          ({ fOublier, fChangerProfondeur } =
            await clients[0].réseau!.suivreRelationsConfiance({
              f: (r) => rés.mettreÀJour(r),
              profondeur: 2,
            }));
        }, config.patienceInit);

        afterAll(async () => {
          if (fOublier) await fOublier();
          if (fOublierClients) await fOublierClients();

          rés.toutAnnuler();
        });

        test("Relations immédiates", async () => {
          const réf: infoRelation[] = [
            {
              de: idsBdCompte[0],
              pour: idsBdCompte[1],
              confiance: 1,
              profondeur: 1,
            },
          ];
          await clients[0].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
          });

          const val = await rés.attendreQue((x) => !!x && !!x.length);
          expect(val).toEqual(réf);
        });
        test("Relations indirectes", async () => {
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
          await clients[1].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[2],
          });

          const val = await rés.attendreQue((x) => !!x && x.length > 1);
          expect(val).toEqual(réf);
        });

        test("Diminuer profondeur", async () => {
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
          expect(val).toEqual(réf);
        });

        test("Augmenter profondeur", async () => {
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
          expect(val).toEqual(réf);
        });
      });

      describe("Suivre comptes réseau", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let moiMême: infoMembreRéseau;
        let clients: ClientConstellation[];

        let fOublier: schémaFonctionOublier;
        let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];

        const rés = new AttendreRésultat<infoMembreRéseau[]>();

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3, type));
          moiMême = {
            idBdCompte: idsBdCompte[0],
            profondeur: 0,
            confiance: 1
          };
          ({ fOublier, fChangerProfondeur } =
            await clients[0].réseau!.suivreComptesRéseau({
              f: (c) => rés.mettreÀJour(c),
              profondeur: 2,
            }));
        }, config.patienceInit);

        afterAll(async () => {
          if (fOublier) await fOublier();
          if (fOublierClients) await fOublierClients();
          rés.toutAnnuler();
        }, config.patience);

        test("Relations confiance immédiates", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idsBdCompte[1],
              confiance: 1,
              profondeur: 1,
            },
          ];
          await clients[0].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
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
                idBdCompte: idsBdCompte[1],
                confiance: 1,
                profondeur: 1,
              },
              {
                idBdCompte: idsBdCompte[2],
                confiance: 0.8,
                profondeur: 2,
              },
            ];
            await clients[1].réseau!.faireConfianceAuMembre({
              idBdCompte: idsBdCompte[2],
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
              idBdCompte: idsBdCompte[1],
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idsBdCompte[2],
              confiance: 1,
              profondeur: 1,
            },
          ];
          await clients[0].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[2],
          });

          const val = await rés.attendreQue(
            (x) =>
              x.length > 2 &&
              x.map((y) => y.confiance).reduce((i, j) => i * j, 1) === 1
          );
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Enlever relation confiance directe (en double)", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idsBdCompte[1],
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idsBdCompte[2],
              confiance: 0.8,
              profondeur: 2,
            },
          ];
          await clients[0].réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idsBdCompte[2],
          });

          const val = await rés.attendreQue(
            (x) =>
              x.length > 2 &&
              x.map((y) => y.confiance).reduce((i, j) => i * j, 1) < 1
          );
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Enlever relation confiance indirecte", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idsBdCompte[1],
              confiance: 1,
              profondeur: 1,
            },
          ];
          await clients[1].réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idsBdCompte[2],
          });

          const val = await rés.attendreQue((x) => x.length === 2);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Enlever relation confiance directe", async () => {
          const réf = [moiMême];

          await clients[0].réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
          });

          const val = await rés.attendreQue((x) => !!x && x.length === 1);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Membre bloqué directement", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idsBdCompte[1],
              confiance: -1,
              profondeur: 1,
            },
          ];
          await clients[0].réseau!.bloquerMembre({
            idBdCompte: idsBdCompte[1],
          });

          const val = await rés.attendreQue((x) => !!x && x.length > 1);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Membre débloqué directement", async () => {
          const réf = [moiMême];

          await clients[0].réseau!.débloquerMembre({
            idBdCompte: idsBdCompte[1],
          });

          const val = await rés.attendreQue((x) => !!x && x.length === 1);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Membre bloqué indirectement", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idsBdCompte[1],
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idsBdCompte[2],
              confiance: -0.9,
              profondeur: 2,
            },
          ];
          await clients[0].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
          });
          await clients[1].réseau!.bloquerMembre({
            idBdCompte: idsBdCompte[2],
          });

          const val = await rés.attendreQue((x) => !!x && x.length === 3);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Précédence confiance propre", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idsBdCompte[1],
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idsBdCompte[2],
              confiance: 1,
              profondeur: 1,
            },
          ];
          await clients[0].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[2],
          });

          const val = await rés.attendreQue(
            (x) =>
              !!x &&
              x.find((y) => y.idBdCompte === idsBdCompte[2])?.confiance ===
                1
          );
          expect(val).toEqual(expect.arrayContaining(réf));

          await clients[0].réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idsBdCompte[2],
          });
          await clients[0].réseau!.nePlusFaireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
          });
          await clients[1].réseau!.débloquerMembre({
            idBdCompte: idsBdCompte[2],
          });
        });
        test("Diminuer profondeur", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idsBdCompte[1],
              confiance: 1,
              profondeur: 1,
            },
          ];
          await clients[0].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
          });
          await clients[1].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[2],
          });
          rés.attendreQue((x) => !!x && x.length === 3 && x.every(r=>r.confiance > 0));

          fChangerProfondeur(1);
          const val = await rés.attendreQue((x) => !!x && x.length === 2);
          expect(val).toEqual(expect.arrayContaining(réf));
        });
        test("Augmenter profondeur", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idsBdCompte[1],
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idsBdCompte[2],
              confiance: 0.8,
              profondeur: 2,
            },
          ];

          fChangerProfondeur(2);

          const val = await rés.attendreQue((x) => !!x && x.length === 3 && x.every(y=>y.confiance > 0));
          expect(val).toEqual(expect.arrayContaining(réf));
        });
      });

      describe("Suivre comptes réseau et en ligne", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let moiMême: infoMembreRéseau;
        let clients: ClientConstellation[];

        let fOublier: schémaFonctionOublier;
        let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];

        const rés = new AttendreRésultat<infoMembreRéseau[]>();

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3, type));
          moiMême = {
            idBdCompte: idsBdCompte[0],
            profondeur: 0,
            confiance: 1
          };
          ({ fOublier, fChangerProfondeur } =
            await clients[0].réseau!.suivreComptesRéseauEtEnLigne({
              f: (c) => rés.mettreÀJour(c),
              profondeur: 2,
            }));
        }, config.patienceInit);

        afterAll(async () => {
          if (fOublier) await fOublier();
          if (fOublierClients) await fOublierClients();
          rés.toutAnnuler();
        });

        test("Comptes en ligne détectés", async () => {
          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idsBdCompte[1],
              confiance: 0,
              profondeur: Infinity,
            },
            {
              idBdCompte: idsBdCompte[2],
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
              idBdCompte: idsBdCompte[1],
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idsBdCompte[2],
              confiance: 0,
              profondeur: Infinity,
            },
          ];

          await clients[0].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
          });
          const val = await rés.attendreQue(
            (x) =>
              !!x &&
              x.find((x) => x.idBdCompte === idsBdCompte[1])?.confiance ===
                1 &&
              x.find((x) => x.idBdCompte === idsBdCompte[2])?.confiance ===
                0
          );

          expect(val).toEqual(expect.arrayContaining(réf));
        });

        test("Changer profondeur", async () => {
          await clients[1].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[2],
          });
          await rés.attendreQue(
            (x) =>
              !!x &&
              (x.find((x) => x.idBdCompte === idsBdCompte[2])?.confiance ||
                0) > 0
          );

          const réf: infoMembreRéseau[] = [
            moiMême,
            {
              idBdCompte: idsBdCompte[1],
              confiance: 1,
              profondeur: 1,
            },
            {
              idBdCompte: idsBdCompte[2],
              confiance: 0,
              profondeur: Infinity,
            },
          ];
          fChangerProfondeur(1);
          const val = await rés.attendreQue(
            (x) =>
              !!x &&
              x.find((x) => x.idBdCompte === idsBdCompte[2])?.confiance ===
                0
          );

          expect(val).toEqual(expect.arrayContaining(réf));
        });
      });

      describe("Suivre confiance mon réseau pour membre", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];

        let fOublier: schémaFonctionOublier;
        let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];

        const rés = new AttendreRésultat<number>();

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3, type));
          ({ fOublier, fChangerProfondeur } =
            await clients[0].réseau!.suivreConfianceMonRéseauPourMembre({
              idBdCompte: idsBdCompte[2],
              f: (confiance) => rés.mettreÀJour(confiance),
              profondeur: 4,
            }));
        }, config.patienceInit);

        afterAll(async () => {
          if (fOublier) await fOublier();
          if (fOublierClients) await fOublierClients();
          rés.toutAnnuler();
        });

        test("Confiance initiale 0", async () => {
          rés.attendreQue((x) => x === 0);
        });

        test("Faire confiance au membre", async () => {
          await clients[0].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
          });
          await clients[1].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[2],
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
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];

        let fOublier: schémaFonctionOublier;
        let idMotClef: string;

        const rés = new AttendreRésultat<number>();

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(3, type));
          idMotClef = await clients[1].motsClefs!.créerMotClef();

          fOublier = await clients[0].réseau!.suivreConfianceAuteurs({
            idItem: idMotClef,
            clef: "motsClefs",
            f: (confiance) => rés.mettreÀJour(confiance),
          });
        }, config.patienceInit);

        afterAll(async () => {
          if (fOublier) await fOublier();
          if (fOublierClients) await fOublierClients();
          rés.toutAnnuler();
        });

        test("Confiance 0 pour commencer", async () => {
          rés.attendreQue((x) => x === 0);
        });

        test("Ajout auteur au réseau", async () => {
          await clients[0].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[1],
          });

          const val = await rés.attendreQue((x) => !!x && x > 0);
          expect(val).toEqual(1);
        });

        test("Ajout coauteur au réseau", async () => {
          await clients[1].motsClefs!.inviterAuteur({
            idMotClef,
            idBdCompteAuteur: idsBdCompte[2],
            rôle: MEMBRE,
          });
          await clients[2].motsClefs!.ajouterÀMesMotsClefs({ id: idMotClef });
          const valAvant = await rés.attendreQue((x) => !!x && x > 1);

          expect(valAvant).toBeGreaterThan(1);
          expect(valAvant).toBeLessThan(2);

          await clients[0].réseau!.faireConfianceAuMembre({
            idBdCompte: idsBdCompte[2],
          });
          const val = await rés.attendreQue((x) => !!x && x > valAvant);

          expect(val).toEqual(2);
        });

        test("Coauteur se retire", async () => {
          await clients[2].motsClefs!.enleverDeMesMotsClefs({ id: idMotClef });
          const val = await rés.attendreQue((x) => !!x && x < 2);

          expect(val).toEqual(1);
        });
      });

      describe("Auteurs", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];

        let idMotClef: string;
        let idVariable: string;
        let idBd: string;
        let idProjet: string;

        const résMotClef = new AttendreRésultat<infoAuteur[]>();
        const résVariable = new AttendreRésultat<infoAuteur[]>();
        const résBds = new AttendreRésultat<infoAuteur[]>();
        const résProjet = new AttendreRésultat<infoAuteur[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2, type));

          idMotClef = await clients[0].motsClefs!.créerMotClef();
          fsOublier.push(await clients[0].réseau!.suivreAuteursMotClef({
            idMotClef,
            f: (auteurs) => résMotClef.mettreÀJour(auteurs),
          }));

          idVariable = await clients[0].variables!.créerVariable({
            catégorie: "numérique",
          });
          fsOublier.push(await clients[0].réseau!.suivreAuteursVariable({
            idVariable,
            f: (auteurs) => résVariable.mettreÀJour(auteurs),
          }));

          idBd = await clients[0].bds!.créerBd({ licence: "ODbl-1_0" });
          fsOublier.push(await clients[0].réseau!.suivreAuteursBd({
            idBd,
            f: (auteurs) => résBds.mettreÀJour(auteurs),
          }));

          idProjet = await clients[0].projets!.créerProjet();
          fsOublier.push(await clients[0].réseau!.suivreAuteursProjet({
            idProjet,
            f: (auteurs) => résProjet.mettreÀJour(auteurs),
          }));

        }, config.patienceInit);

        afterAll(async () => {
          await Promise.all(fsOublier.map(f=>f()));
          if (fOublierClients) await fOublierClients();
          résMotClef.toutAnnuler();
          résVariable.toutAnnuler();
        });

        test("Mots-clefs : Inviter auteur", async () => {
          const réf: infoAuteur[] = [
            {
              idBdCompte: idsBdCompte[0],
              accepté: true,
              rôle: MODÉRATEUR,
            },
            {
              idBdCompte: idsBdCompte[1],
              accepté: false,
              rôle: MEMBRE,
            },
          ];
          await clients[0].motsClefs!.inviterAuteur({
            idMotClef,
            idBdCompteAuteur: idsBdCompte[1],
            rôle: MEMBRE,
          });

          const val = await résMotClef.attendreQue((x) => !!x && x.length > 1);
          expect(val).toEqual(réf);
        });
        test("Mots-clefs : Accepter invitation", async () => {
          const réf: infoAuteur[] = [
            {
              idBdCompte: idsBdCompte[0],
              accepté: true,
              rôle: MODÉRATEUR,
            },
            {
              idBdCompte: idsBdCompte[1],
              accepté: true,
              rôle: MEMBRE,
            },
          ];

          await clients[1].motsClefs!.ajouterÀMesMotsClefs({ id: idMotClef });
          const val = await résMotClef.attendreQue((x) =>
            Boolean(
              !!x &&
                x.find((y) => y.idBdCompte === idsBdCompte[1])?.accepté
            )
          );

          expect(val).toEqual(réf);
        });
        test("Mots-clefs : Refuser invitation", async () => {
          const réf: infoAuteur[] = [
            {
              idBdCompte: idsBdCompte[0],
              accepté: true,
              rôle: MODÉRATEUR,
            },
            {
              idBdCompte: idsBdCompte[1],
              accepté: false,
              rôle: MEMBRE,
            },
          ];

          await clients[1].motsClefs!.enleverDeMesMotsClefs({ id: idMotClef });
          const val = await résMotClef.attendreQue(
            (x) =>
              !!x &&
              !x.find((y) => y.idBdCompte === idsBdCompte[1])?.accepté
          );

          expect(val).toEqual(réf);
        });
        test("Mots-clefs : Promotion à modérateur", async () => {
          await clients[0].motsClefs!.inviterAuteur({
            idMotClef,
            idBdCompteAuteur: idsBdCompte[1],
            rôle: MODÉRATEUR,
          });

          await résMotClef.attendreQue(
            (auteurs) =>
              !!auteurs &&
              auteurs.find((a) => a.idBdCompte === idsBdCompte[1])?.rôle ===
                MODÉRATEUR
          );
        });

        test("Variables : Inviter auteur", async () => {
          
          const réf: infoAuteur[] = [
            {
              idBdCompte: idsBdCompte[0],
              accepté: true,
              rôle: MODÉRATEUR,
            },
            {
              idBdCompte: idsBdCompte[1],
              accepté: false,
              rôle: MEMBRE,
            },
          ];
          await clients[0].variables!.inviterAuteur({
            idVariable,
            idBdCompteAuteur: idsBdCompte[1],
            rôle: MEMBRE,
          });

          const val = await résVariable.attendreQue((x) => !!x && x.length > 1);
          expect(val).toEqual(réf);
        });
        test("Variables : Accepter invitation", async () => {
          const réf: infoAuteur[] = [
            {
              idBdCompte: idsBdCompte[0],
              accepté: true,
              rôle: MODÉRATEUR,
            },
            {
              idBdCompte: idsBdCompte[1],
              accepté: true,
              rôle: MEMBRE,
            },
          ];

          await clients[1].variables!.ajouterÀMesVariables({ id: idVariable });
          const val = await résVariable.attendreQue(
              (x) => x.find((y) => y.idBdCompte === idsBdCompte[1])?.accepté
            );

            expect(val).toEqual(réf);
          });
        test("Variables : Refuser invitation", async () => {
          const réf: infoAuteur[] = [
            {
              idBdCompte: idsBdCompte[0],
              accepté: true,
              rôle: MODÉRATEUR,
            },
            {
              idBdCompte: idsBdCompte[1],
              accepté: false,
              rôle: MEMBRE,
            },
          ];

          await clients[1].variables!.enleverDeMesVariables({ id: idVariable });
          const val = await résVariable.attendreQue(
            (x) =>
              !!x &&
              !x.find((y) => y.idBdCompte === idsBdCompte[1])?.accepté
          );

          expect(val).toEqual(réf);
        });
        test("Variables : Promotion à modérateur", async () => {
          await clients[0].variables!.inviterAuteur({
            idVariable,
            idBdCompteAuteur: idsBdCompte[1],
            rôle: MODÉRATEUR,
          });

          await résVariable.attendreQue(
            (auteurs) =>
              !!auteurs &&
              auteurs.find((a) => a.idBdCompte === idsBdCompte[1])?.rôle ===
                MODÉRATEUR
          );
        });

        test("Bds : Inviter auteur", async () => {
          const réf: infoAuteur[] = [
            {
              idBdCompte: idsBdCompte[0],
              accepté: true,
              rôle: MODÉRATEUR,
            },
            {
              idBdCompte: idsBdCompte[1],
              accepté: false,
              rôle: MEMBRE,
            },
          ];
          await clients[0].bds!.inviterAuteur({
            idBd,
            idBdCompteAuteur: idsBdCompte[1],
            rôle: MEMBRE,
          });

          const val = await résBds.attendreQue((x) => !!x && x.length > 1);
          expect(val).toEqual(réf);
        });
        test("Bds : Accepter invitation", async () => {
          const réf: infoAuteur[] = [
            {
              idBdCompte: idsBdCompte[0],
              accepté: true,
              rôle: MODÉRATEUR,
            },
            {
              idBdCompte: idsBdCompte[1],
              accepté: true,
              rôle: MEMBRE,
            },
          ];

          await clients[1].bds!.ajouterÀMesBds({ id: idBd });
          const val = await résBds.attendreQue((x) =>
            Boolean(
              !!x &&
                x.find((y) => y.idBdCompte === idsBdCompte[1])?.accepté
            )
          );

          expect(val).toEqual(réf);
        });
        test("Bds : Refuser invitation", async () => {
          const réf: infoAuteur[] = [
            {
              idBdCompte: idsBdCompte[0],
              accepté: true,
              rôle: MODÉRATEUR,
            },
            {
              idBdCompte: idsBdCompte[1],
              accepté: false,
              rôle: MEMBRE,
            },
          ];

          await clients[1].bds!.enleverDeMesBds({ id: idBd });
          const val = await résBds.attendreQue(
            (x) =>
              !!x &&
              !x.find((y) => y.idBdCompte === idsBdCompte[1])?.accepté
          );

          expect(val).toEqual(réf);
        });
        test("Bds : Promotion à modérateur", async () => {
          await clients[0].bds!.inviterAuteur({
            idBd,
            idBdCompteAuteur: idsBdCompte[1],
            rôle: MODÉRATEUR,
          });

          await résBds.attendreQue(
            (auteurs) =>
              !!auteurs &&
              auteurs.find((a) => a.idBdCompte === idsBdCompte[1])?.rôle ===
                MODÉRATEUR
          );
        });

        test("Projets : Inviter auteur", async () => {
          const réf: infoAuteur[] = [
            {
              idBdCompte: idsBdCompte[0],
              accepté: true,
              rôle: MODÉRATEUR,
            },
            {
              idBdCompte: idsBdCompte[1],
              accepté: false,
              rôle: MEMBRE,
            },
          ];
          await clients[0].projets!.inviterAuteur({
            idProjet,
            idBdCompteAuteur: idsBdCompte[1],
            rôle: MEMBRE,
          });

          const val = await résProjet.attendreQue((x) => !!x && x.length > 1);
          expect(val).toEqual(réf);
        });
        test("Projets : Accepter invitation", async () => {
          const réf: infoAuteur[] = [
            {
              idBdCompte: idsBdCompte[0],
              accepté: true,
              rôle: MODÉRATEUR,
            },
            {
              idBdCompte: idsBdCompte[1],
              accepté: true,
              rôle: MEMBRE,
            },
          ];

          await clients[1].projets!.ajouterÀMesProjets({ idProjet });
          const val = await résProjet.attendreQue((x) =>
            Boolean(
              !!x &&
                x.find((y) => y.idBdCompte === idsBdCompte[1])?.accepté
            )
          );

          expect(val).toEqual(réf);
        });
        test("Projets : Refuser invitation", async () => {
          const réf: infoAuteur[] = [
            {
              idBdCompte: idsBdCompte[0],
              accepté: true,
              rôle: MODÉRATEUR,
            },
            {
              idBdCompte: idsBdCompte[1],
              accepté: false,
              rôle: MEMBRE,
            },
          ];

          await clients[1].projets!.enleverDeMesProjets({ idProjet });
          const val = await résProjet.attendreQue(
            (x) =>
              !!x &&
              !x.find((y) => y.idBdCompte === idsBdCompte[1])?.accepté
          );

          expect(val).toEqual(réf);
        });
        test("Projets : Promotion à modérateur", async () => {
          await clients[0].projets!.inviterAuteur({
            idProjet,
            idBdCompteAuteur: idsBdCompte[1],
            rôle: MODÉRATEUR,
          });

          await résProjet.attendreQue(
            (auteurs) =>
              !!auteurs &&
              auteurs.find((a) => a.idBdCompte === idsBdCompte[1])?.rôle ===
                MODÉRATEUR
          );
        });
      });

      describe("Suivre membre", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];

        const résNom = new AttendreRésultat<{ [key: string]: string }>();
        const résCourriel = new AttendreRésultat<string | null>();
        const résImage = new AttendreRésultat<Uint8Array | null>();

        const IMAGE = fs.readFileSync(
          path.join(dirRessourcesTests(), "logo.svg")
        );

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2, type));
          
          fsOublier.push(await clients[1].réseau!.suivreNomsMembre({
            idCompte: idsBdCompte[0],
            f: (n) => résNom.mettreÀJour(n),
          }));
          fsOublier.push(await clients[1].réseau!.suivreCourrielMembre({
            idCompte: idsBdCompte[0],
            f: (c) => résCourriel.mettreÀJour(c),
          }));
          fsOublier.push(await clients[1].réseau!.suivreImageMembre({
            idCompte: idsBdCompte[0],
            f: (i) => résImage.mettreÀJour(i),
          }));
          
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map(f=>f()));
          if (fOublierClients) await fOublierClients();
          résNom.toutAnnuler();
          résCourriel.toutAnnuler();
          résImage.toutAnnuler();
        });

        test("Nom détecté", async () => {
          await clients[0].profil!.sauvegarderNom({ langue: "fr", nom: "Julien" });

          const val = await résNom.attendreQue((x) => !!x && Boolean(x.fr));
          expect(val.fr).toEqual("Julien");
        });

        test("Courriel détecté", async () => {
          await clients[0].profil!.sauvegarderCourriel({
            courriel: "தொடர்பு@லஸ்ஸி.இந்தியா",
          });

          const val = await résCourriel.attendreQue((x: string | null | undefined) =>
            Boolean(x)
          );
          expect(val).toEqual("தொடர்பு@லஸ்ஸி.இந்தியா");
        });

        test("Image détectée", async () => {
          await clients[0].profil!.sauvegarderImage({ image: IMAGE });

          const val = await résImage.attendreExiste();
          expect(val).toEqual(new Uint8Array(IMAGE));
        });


      });

      describe("Suivre mots-clefs", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];

        let idMotClef1: string;
        let idMotClef2: string;

        const résPropres = new AttendreRésultat<string[]>();
        const résAutres = new AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2, type));
          fsOublier.push(
            await clients[1].réseau!.suivreMotsClefsMembre({
              idCompte: idsBdCompte[0],
              f: (motsClefs) => résAutres.mettreÀJour(motsClefs),
            })
          );
          fsOublier.push(
            await clients[1].réseau!.suivreMotsClefsMembre({
              idCompte: idsBdCompte[1],
              f: (motsClefs) => résPropres.mettreÀJour(motsClefs),
            })
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (fOublierClients) await fOublierClients();
          résPropres.toutAnnuler();
          résAutres.toutAnnuler();
        });

        test("Mes propres mots-clefs détectés", async () => {
          idMotClef2 = await clients[1].motsClefs!.créerMotClef();

          const val = await résPropres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idMotClef2);
        });

        test("Mot-clef d'un autre membre détecté", async () => {
          idMotClef1 = await clients[0].motsClefs!.créerMotClef();
          const val = await résAutres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idMotClef1);
        });
      });

      describe("Suivre variables", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];

        let idVariable1: string;
        let idVariable2: string;

        const résPropres = new AttendreRésultat<string[]>();
        const résAutres = new AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2, type));
          fsOublier.push(
            await clients[1].réseau!.suivreVariablesMembre({
              idCompte: idsBdCompte[0],
              f: (variables) => résAutres.mettreÀJour(variables),
            })
          );
          fsOublier.push(
            await clients[1].réseau!.suivreVariablesMembre({
              idCompte: idsBdCompte[1],
              f: (variables) => résPropres.mettreÀJour(variables),
            })
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (fOublierClients) await fOublierClients();

          résPropres.toutAnnuler();
          résAutres.toutAnnuler();
        });

        test("Mes variables détectées", async () => {
          idVariable2 = await clients[1].variables!.créerVariable({
            catégorie: "numérique",
          });

          const val = await résPropres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idVariable2);
        });

        test("Variable d'un autre membre détectée", async () => {
          idVariable1 = await clients[0].variables!.créerVariable({
            catégorie: "numérique",
          });
          const val = await résAutres.attendreQue((x) => Boolean(x?.length));
          expect(val).toContain(idVariable1);
        });
      });

      describe("Suivre BDs", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];

        const résPropres = new AttendreRésultat<string[]>();
        const résAutres = new AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2, type));
          fsOublier.push(
            await clients[1].réseau!.suivreBdsMembre({
              idCompte: idsBdCompte[0],
              f: (bds) => résAutres.mettreÀJour(bds),
            })
          );
          fsOublier.push(
            await clients[1].réseau!.suivreBdsMembre({
              idCompte: idsBdCompte[1],
              f: (bds) => résPropres.mettreÀJour(bds),
            })
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (fOublierClients) await fOublierClients();
          résPropres.toutAnnuler();
          résAutres.toutAnnuler();
        });

        test("Mes BDs détectées", async () => {
          const idBd = await clients[1].bds!.créerBd({ licence: "ODbl-1_0" });

          const val = await résPropres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idBd);
        });

        test("BD d'un autre membre détectée", async () => {
          const idBd = await clients[0].bds!.créerBd({ licence: "ODbl-1_0" });
          const val = await résAutres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idBd);
        });
      });

      describe("Suivre projets", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];

        const résPropres = new AttendreRésultat<string[]>();
        const résAutres = new AttendreRésultat<string[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2, type));
          fsOublier.push(
            await clients[1].réseau!.suivreProjetsMembre({
              idCompte: idsBdCompte[0],
              f: (projets) => résAutres.mettreÀJour(projets),
            })
          );
          fsOublier.push(
            await clients[1].réseau!.suivreProjetsMembre({
              idCompte: idsBdCompte[1],
              f: (projets) => résPropres.mettreÀJour(projets),
            })
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (fOublierClients) await fOublierClients();
          résPropres.toutAnnuler();
          résAutres.toutAnnuler();
        });

        test("Mes projets détectés", async () => {
          const idProjet = await clients[1].projets!.créerProjet();

          const val = await résPropres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idProjet);
        });

        test("Projet d'un autre membre détecté", async () => {
          const idProjet = await clients[0].projets!.créerProjet();
          const val = await résAutres.attendreQue((x) => !!x && !!x.length);
          expect(val).toContain(idProjet);
        });
      });

      describe("Suivre favoris", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];

        let idMotClef: string;

        const résPropres = new AttendreRésultat<ÉlémentFavorisAvecObjet[]>();
        const résAutres = new AttendreRésultat<ÉlémentFavorisAvecObjet[]>();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2, type));
          fsOublier.push(
            await clients[1].réseau!.suivreFavorisMembre({
              idCompte: idsBdCompte[0],
              f: (favoris) => résAutres.mettreÀJour(favoris),
            })
          );
          fsOublier.push(
            await clients[1].réseau!.suivreFavorisMembre({
              idCompte: idsBdCompte[1],
              f: (favoris) => résPropres.mettreÀJour(favoris),
            })
          );

          idMotClef = await clients[0].motsClefs!.créerMotClef();
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (fOublierClients) await fOublierClients();
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

          await clients[1].favoris!.épinglerFavori({
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

          await clients[0].favoris!.épinglerFavori({
            id: idMotClef,
            dispositifs: "TOUS",
          });
          const val = await résAutres.attendreQue((x) => !!x && !!x.length);
          expect(val).toEqual(réf);
        });
      });

      describe("Suivre favoris objet", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];

        let idMotClef: string;
        let fOublier: schémaFonctionOublier;

        const rés = new AttendreRésultat<
          (ÉlémentFavorisAvecObjet & { idBdCompte: string })[]
        >();

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2, type));
          idMotClef = await clients[0].motsClefs!.créerMotClef();

          ({ fOublier } = await clients[0].réseau!.suivreFavorisObjet({
            idObjet: idMotClef,
            f: (favoris) => rés.mettreÀJour(favoris),
            profondeur: 4,
          }));
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
          if (fOublierClients) await fOublierClients();
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
              idBdCompte: idsBdCompte[0],
            },
          ];
          await clients[0].favoris!.épinglerFavori({
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
              idBdCompte: idsBdCompte[0],
            },
            {
              récursif: true,
              dispositifs: "TOUS",
              dispositifsFichiers: "INSTALLÉ",
              idObjet: idMotClef,
              idBdCompte: idsBdCompte[1],
            },
          ];
          await clients[1].favoris!.épinglerFavori({
            id: idMotClef,
            dispositifs: "TOUS",
          });
          const val = await rés.attendreQue((x) => !!x && x.length === 2);

          expect(val).toEqual(réf);
        });
      });

      describe("Suivre réplications", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let idsOrbite: string[];
        let clients: ClientConstellation[];

        let idBd: string;

        const rés = new AttendreRésultat<infoRéplications>();
        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idsBdCompte, idsOrbite, clients, fOublierClients } = await toutPréparer(2, type));
          idBd = await clients[0].bds!.créerBd({ licence: "ODbl-1_0" });
          fsOublier.push(
            (
              await clients[0].réseau!.suivreRéplications({
                idObjet: idBd,
                f: (bds) => rés.mettreÀJour(bds),
                profondeur: 4,
              })
            ).fOublier
          );
        }, config.patienceInit);

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (fOublierClients) await fOublierClients();
          rés.toutAnnuler();
        });

        test("Auteur de la BD pour commencer", async () => {
          await clients[0].favoris!.épinglerFavori({
            id: idBd,
            dispositifs: "TOUS",
          });

          const val = await rés.attendreQue((x) => !!x && x.membres.length > 0);

          expect(val.membres.map((m) => m.infoMembre.idBdCompte)).toContain(
            idsBdCompte[0]
          );
          expect(val.dispositifs.map((d) => d.idDispositif)).toContain(
            idsOrbite[0]
          );
        });

        test("Ajout d'une réplication détectée", async () => {
          await clients[1].favoris!.épinglerFavori({
            id: idBd,
            dispositifs: "TOUS",
          });

          const val = await rés.attendreQue((x) => !!x && x.membres.length > 1);

          expect(val.membres.map((m) => m.infoMembre.idBdCompte)).toEqual(
            expect.arrayContaining([idsBdCompte[0], idsBdCompte[1]])
          );
          expect(val.dispositifs.map((d) => d.idDispositif)).toEqual(
            expect.arrayContaining([idsOrbite[0], idsOrbite[1]])
          );
        });
      });

      describe("Suivre BD par mot-clef unique", function () {
        let fOublierClients: () => Promise<void>;
        let idsBdCompte: string[];
        let clients: ClientConstellation[];
        
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

        const résBds = new AttendreRésultat<string[]>();
        const résÉléments = new AttendreRésultat<
          élémentDeMembre<élémentBdListeDonnées>[]
        >();

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          ({ idsBdCompte, clients, fOublierClients } = await toutPréparer(2, type));
          const idVarClef = await clients[0].variables!.créerVariable({
            catégorie: "chaîne",
          });
          const idVarLangue = await clients[0].variables!.créerVariable({
            catégorie: "chaîne",
          });
          const idVarTrad = await clients[0].variables!.créerVariable({
            catégorie: "chaîne",
          });

          motClef = await clients[0].motsClefs!.créerMotClef();

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

          idBd1 = await clients[0].bds!.créerBdDeSchéma({ schéma });
          idBd2 = await clients[1].bds!.créerBdDeSchéma({ schéma });

          idTableau1 = (
            await uneFois(
              async (
                fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>
              ): Promise<schémaFonctionOublier> => {
                return await clients[0].bds!.suivreTableauxBd({
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
                return await clients[1].bds!.suivreTableauxBd({
                  id: idBd2,
                  f: fSuivi,
                });
              }
            )
          )[0].id;

          fsOublier.push(
            (
              await clients[0].réseau!.suivreBdsDeMotClef({
                motClefUnique: motClef,
                f: (bds) => résBds.mettreÀJour(bds),
                nRésultatsDésirés: 100,
              })
            ).fOublier
          );
          fsOublier.push(
            (
              await clients[0].réseau!.suivreÉlémentsDeTableauxUniques({
                motClefUnique: motClef,
                clef: clefTableau,
                f: (éléments) => résÉléments.mettreÀJour(éléments),
              })
            ).fOublier
          );

          empreinte1 = await clients[0].tableaux!.ajouterÉlément({
            idTableau: idTableau1,
            vals: données1,
          });
          empreinte2 = await clients[0].tableaux!.ajouterÉlément({
            idTableau: idTableau1,
            vals: données2,
          });
          empreinte3 = await clients[1].tableaux!.ajouterÉlément({
            idTableau: idTableau2,
            vals: données3,
          });
        }, config.patience);

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          if (fOublierClients) await fOublierClients();
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
              (x) => x && x.length === 3
            );
            const élémentsSansId = val.map((r) => {
              delete r.élément.données.id;
              return r;
            });

            const réf: élémentDeMembre<élémentBdListeDonnées>[] = [
              {
                idBdCompte: idsBdCompte[0],
                élément: {
                  empreinte: empreinte1,
                  données: données1,
                },
              },
              {
                idBdCompte: idsBdCompte[0],
                élément: {
                  empreinte: empreinte2,
                  données: données2,
                },
              },
              {
                idBdCompte: idsBdCompte[1],
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
