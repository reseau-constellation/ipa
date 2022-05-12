import { expect } from "chai";
import { step } from "mocha-steps";

import fs from "fs";
import path from "path";

import { enregistrerContrôleurs } from "@/accès";
import { MODÉRATEUR, MEMBRE } from "@/accès/consts";
import ClientConstellation from "@/client";
import {
  schémaFonctionSuivi,
  schémaRetourFonctionRecherche,
  schémaFonctionOublier,
  uneFois,
  infoAuteur,
} from "@/utils";
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
import { schémaSpécificationBd } from "@/bds";
import { élémentBdListeDonnées } from "@/tableaux";

import { testAPIs, config } from "./sfipTest";
import { attendreRésultat, générerClients, typesClients } from "./utils";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Réseau", function () {
        this.timeout(config.timeout);

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

        before(async () => {
          ({ fOublier: fOublierClients, clients } = await générerClients(
            3,
            API,
            type
          ));
          [client, client2, client3] = clients;

          enregistrerContrôleurs();

          idNodeSFIP1 = (await client.obtIdSFIP()).id;
          idNodeSFIP2 = (await client2.obtIdSFIP()).id;
          idNodeSFIP3 = (await client3.obtIdSFIP()).id;
          console.log({ idNodeSFIP1, idNodeSFIP2, idNodeSFIP3 });

          idOrbite1 = await client.obtIdOrbite();
          idOrbite2 = await client2.obtIdOrbite();
          idOrbite3 = await client3.obtIdOrbite();
          console.log({ idOrbite1, idOrbite2, idOrbite3 });

          idBdCompte1 = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string>
            ): Promise<schémaFonctionOublier> => {
              return await client.suivreIdBdCompte(fSuivi);
            }
          );

          idBdCompte2 = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string>
            ): Promise<schémaFonctionOublier> => {
              return await client2.suivreIdBdCompte(fSuivi);
            }
          );

          idBdCompte3 = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string>
            ): Promise<schémaFonctionOublier> => {
              return await client3.suivreIdBdCompte(fSuivi);
            }
          );

          console.log({ idBdCompte1, idBdCompte2, idBdCompte3 });
        });

        after(async () => {
          if (fOublierClients) await fOublierClients();
        });

        describe("Suivre postes", function () {
          const rés: { ultat: { addr: string; peer: string }[] | undefined } = {
            ultat: undefined,
          };
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.réseau!.suivreConnexionsPostesSFIP(
              (c) => (rés.ultat = c)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Autres postes détectés", async () => {
            expect(rés.ultat!.map((r) => r.peer)).to.have.members([
              idNodeSFIP2,
              idNodeSFIP3,
            ]);
          });
        });

        describe("Suivre dispositifs en ligne", function () {
          const dis: { positifs?: statutDispositif[] } = {};
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.réseau!.suivreConnexionsDispositifs(
              (d) => (dis.positifs = d)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Autres dispositifs détectés", async () => {
            await attendreRésultat(
              dis,
              "positifs",
              (x?: statutDispositif[]) => !!x && x.length === 3
            );
            expect(
              dis.positifs!.map((d) => d.infoDispositif.idOrbite)
            ).to.have.members([idOrbite1, idOrbite2, idOrbite3]);
          });
        });

        describe("Suivre membres en ligne", function () {
          const rés: { ultat?: statutMembre[] } = {};
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.réseau!.suivreConnexionsMembres(
              (c) => (rés.ultat = c)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Autres membres détectés", async () => {
            const réfRés: infoMembre[] = [
              {
                idBdCompte: idBdCompte2,
                dispositifs: [
                  {
                    idSFIP: idNodeSFIP2,
                    idOrbite: idOrbite2,
                    idCompte: idBdCompte2,
                    clefPublique: client2.orbite!.identity.publicKey,
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
                    signatures: client3.orbite!.identity.signatures,
                  },
                ],
              },
            ];
            expect(rés.ultat!.map((r) => r.infoMembre)).to.include.deep.members(
              réfRés
            );
          });
        });

        describe("Membres fiables", function () {
          const fiables: { propres?: string[]; autre?: string[] } = {};
          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            fsOublier.push(
              await client.réseau!.suivreFiables((m) => (fiables.propres = m))
            );
            fsOublier.push(
              await client2.réseau!.suivreFiables(
                (m) => (fiables.autre = m),
                idBdCompte1
              )
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          step("Personne pour commencer", async () => {
            expect(fiables.propres).to.be.empty;
          });

          step("Faire confiance", async () => {
            await client.réseau!.faireConfianceAuMembre(idBdCompte2);
            expect(fiables.propres)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.deep.members([idBdCompte2]);
          });

          step("Détecter confiance d'autre membre", async () => {
            await attendreRésultat(
              fiables,
              "autre",
              (x: string[]) => x.length > 0
            );
            expect(fiables.autre)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.deep.members([idBdCompte2]);
          });

          step("Un débloquage accidental ne fait rien", async () => {
            await client.réseau!.débloquerMembre(idBdCompte2);
            expect(fiables.propres)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.deep.members([idBdCompte2]);
          });

          step("Changer d'avis", async () => {
            await client.réseau!.nePlusFaireConfianceAuMembre(idBdCompte2);
            expect(fiables.propres).to.be.empty;
          });
        });

        describe("Membres bloqués", function () {
          const bloqués: {
            tous?: infoBloqué[];
            publiques?: string[];
            autreMembre?: infoBloqué[];
          } = {};

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            fsOublier.push(
              await client.réseau!.suivreBloqués((m) => (bloqués.tous = m))
            );
            fsOublier.push(
              await client.réseau!.suivreBloquésPubliques(
                (m) => (bloqués.publiques = m)
              )
            );
            fsOublier.push(
              await client2.réseau!.suivreBloqués(
                (m) => (bloqués.autreMembre = m),
                idBdCompte1
              )
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
            await client.réseau!.débloquerMembre(idBdCompte2);
            await client.réseau!.débloquerMembre(idBdCompte3);
          });

          step("Personne pour commencer", async () => {
            expect(bloqués.publiques).to.be.empty;
          });

          step("Bloquer quelqu'un", async () => {
            await client.réseau!.bloquerMembre(idBdCompte2);
            expect(bloqués.tous)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.deep.members([
                {
                  idBdCompte: idBdCompte2,
                  privé: false,
                },
              ]);
            expect(bloqués.publiques)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.members([idBdCompte2]);
          });

          step("Un dé-confiance accidental ne fait rien", async () => {
            await client.réseau!.nePlusFaireConfianceAuMembre(idBdCompte2);
            expect(bloqués.tous)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.deep.members([
                {
                  idBdCompte: idBdCompte2,
                  privé: false,
                },
              ]);
          });

          step("Bloquer privé", async () => {
            await client.réseau!.bloquerMembre(idBdCompte3, true);
            expect(bloqués.tous)
              .to.be.an("array")
              .with.lengthOf(2)
              .and.deep.members([
                {
                  idBdCompte: idBdCompte2,
                  privé: false,
                },
                {
                  idBdCompte: idBdCompte3,
                  privé: true,
                },
              ]);
          });

          step("On détecte bloqué publique d'un autre membre", async () => {
            await attendreRésultat(bloqués, "autreMembre", (x) => x.length > 0);
            expect(bloqués.autreMembre)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.deep.members([
                {
                  idBdCompte: idBdCompte2,
                  privé: false,
                },
              ]);
          });

          step(
            "On ne détecte pas le bloqué privé d'un autre membre",
            async () => {
              expect(bloqués.autreMembre).to.be.an("array");
              expect(
                bloqués.autreMembre!.map((b) => b.idBdCompte)
              ).to.not.include(idBdCompte3);
            }
          );

          step("Débloquer publique", async () => {
            await client.réseau!.débloquerMembre(idBdCompte2);
            expect(bloqués.publiques).to.be.empty;
          });

          step("Débloquer privé", async () => {
            await client.réseau!.débloquerMembre(idBdCompte3);
            expect(bloqués.tous).to.be.empty;
          });
        });

        describe("Suivre relations immédiates", function () {
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

          before(async () => {
            fsOublier.push(
              await client.réseau!.suivreRelationsImmédiates(
                (c) => (relations.propres = c)
              )
            );
            fsOublier.push(
              await client2.réseau!.suivreRelationsImmédiates(
                (c) => (relations.autre = c),
                idBdCompte1
              )
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
            if (idMotClef1) await client2.motsClefs!.effacerMotClef(idMotClef1);
            if (idMotClef2) await client2.motsClefs!.effacerMotClef(idMotClef2);
            if (idBd) await client.bds!.effacerBd(idBd);
            if (idProjet) await client.projets!.effacerProjet(idProjet);
          });

          step("Personne pour commencer", async () => {
            await attendreRésultat(
              relations,
              "propres",
              (x) => x?.length === 0
            );
            await attendreRésultat(relations, "autre", (x) => x?.length === 0);

            expect(relations.propres).to.be.an.empty("array");
            expect(relations.autre).to.be.an.empty("array");
          });

          step("Ajout membre de confiance détecté", async () => {
            await client.réseau!.faireConfianceAuMembre(idBdCompte2);
            await attendreRésultat(relations, "propres", (x) =>
              Boolean(x.length)
            );
            expect(
              relations.propres!.map((r) => r.idBdCompte)
            ).to.include.members([idBdCompte2]);
          });

          step("Bloquer membre détecté", async () => {
            await client.réseau!.bloquerMembre(idBdCompte3);
            await attendreRésultat(relations, "propres", (x) => x.length === 2);
            expect(
              relations.propres!.map((r) => r.idBdCompte)
            ).to.include.members([idBdCompte3]);
          });

          step("Débloquer membre détecté", async () => {
            await client.réseau!.débloquerMembre(idBdCompte3);
            await attendreRésultat(relations, "propres", (x) => x.length === 1);
          });

          step(
            "Ajout membres au réseau d'un autre membre détecté",
            async () => {
              await attendreRésultat(
                relations,
                "autre",
                (x?: infoConfiance[]) => x?.length === 1
              );
              expect(relations.autre).to.be.an("array").with.lengthOf(1);
              expect(
                relations.autre!.map((r) => r.idBdCompte)
              ).to.include.members([idBdCompte2]);
            }
          );

          step("Enlever membre de confiance détecté", async () => {
            await client.réseau!.nePlusFaireConfianceAuMembre(idBdCompte2);
            expect(relations.propres).to.be.empty;
          });

          step("Ajout aux favoris détecté", async () => {
            idMotClef2 = await client2.motsClefs!.créerMotClef();
            await client.favoris!.épinglerFavori(idMotClef2, "TOUS");

            await attendreRésultat(
              relations,
              "propres",
              (x) => !!x && Boolean(x.length)
            );
            expect(relations.propres!.map((r) => r.idBdCompte)).to.include(
              idBdCompte2
            );
          });

          step("Ajout aux favoris d'un tiers détecté", async () => {
            await attendreRésultat(
              relations,
              "autre",
              (x) => !!x && Boolean(x.length)
            );
            expect(relations.autre!.map((r) => r.idBdCompte)).to.include(
              idBdCompte2
            );
          });

          step("Enlever favori détecté", async () => {
            await client.favoris!.désépinglerFavori(idMotClef2);
            expect(relations.propres).to.be.empty;

            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => !!x && !x.length
            );
            expect(relations.autre).to.be.empty;
          });

          step("Ajout coauteur BD détecté", async () => {
            idBd = await client.bds!.créerBd("ODbl-1_0");
            await client.bds!.inviterAuteur(idBd, idBdCompte2, MEMBRE);

            await attendreRésultat(
              relations,
              "propres",
              (x) => !!x && Boolean(x.length)
            );

            expect(relations.propres!.map((r) => r.idBdCompte)).to.include(
              idBdCompte2
            );
          });

          step("Ajout coauteur BD d'un tiers détecté", async () => {
            await attendreRésultat(
              relations,
              "autre",
              (x) => !!x && Boolean(x.length)
            );
            expect(relations.autre!.map((r) => r.idBdCompte)).to.include(
              idBdCompte2
            );
          });

          step("Enlever bd détecté", async () => {
            await client.bds!.effacerBd(idBd);

            expect(relations.propres).to.be.empty;

            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => !!x && !x.length
            );
            expect(relations.autre).to.be.empty;
          });

          step("Ajout coauteur projet détecté", async () => {
            idProjet = await client.projets!.créerProjet();
            await client.projets!.inviterAuteur(idProjet, idBdCompte2, MEMBRE);

            await attendreRésultat(
              relations,
              "propres",
              (x) => !!x && Boolean(x.length)
            );
            expect(relations.propres!.map((r) => r.idBdCompte)).to.include(
              idBdCompte2
            );
          });

          step("Ajout coauteur projet d'un tiers détecté", async () => {
            await attendreRésultat(
              relations,
              "autre",
              (x) => !!x && Boolean(x.length)
            );
            expect(relations.autre!.map((r) => r.idBdCompte)).to.include(
              idBdCompte2
            );
          });

          step("Enlever projet détecté", async () => {
            await client.projets!.effacerProjet(idProjet);

            expect(relations.propres).to.be.empty;

            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => !!x && !x.length
            );
            expect(relations.autre).to.be.empty;
          });

          step("Ajout coauteur variable détecté", async () => {
            idVariable = await client.variables!.créerVariable("numérique");
            await client.variables!.inviterAuteur(
              idVariable,
              idBdCompte2,
              MEMBRE
            );

            await attendreRésultat(
              relations,
              "propres",
              (x) => !!x && Boolean(x.length)
            );

            expect(relations.propres!.map((r) => r.idBdCompte)).to.include(
              idBdCompte2
            );
          });

          step("Ajout coauteur variable d'un tiers détecté", async () => {
            await attendreRésultat(
              relations,
              "autre",
              (x) => !!x && Boolean(x.length)
            );
            expect(relations.autre!.map((r) => r.idBdCompte)).to.include(
              idBdCompte2
            );
          });

          step("Enlever variable détecté", async () => {
            await client.variables!.effacerVariable(idVariable);

            expect(relations.propres).to.be.empty;

            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => !!x && !x.length
            );
            expect(relations.autre).to.be.empty;
          });

          step("Ajout coauteur mot-clef détecté", async () => {
            idMotClef1 = await client.motsClefs!.créerMotClef();
            await client.motsClefs!.inviterAuteur(
              idMotClef1,
              idBdCompte2,
              MEMBRE
            );

            await attendreRésultat(
              relations,
              "propres",
              (x) => !!x && Boolean(x.length)
            );
            expect(relations.propres!.map((r) => r.idBdCompte)).to.include(
              idBdCompte2
            );
          });

          step("Ajout coauteur mot-clef d'un tiers détecté", async () => {
            await attendreRésultat(
              relations,
              "autre",
              (x) => !!x && Boolean(x.length)
            );
            expect(relations.autre!.map((r) => r.idBdCompte)).to.include(
              idBdCompte2
            );
          });

          step("Enlever mot-clef détecté", async () => {
            await client.motsClefs!.effacerMotClef(idMotClef1);

            expect(relations.propres).to.be.empty;

            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => !!x && !x.length
            );
            expect(relations.autre).to.be.empty;
          });
        });

        describe("Suivre relations confiance", async () => {
          let fOublier: schémaFonctionOublier;
          let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];
          const rés: { ultat?: infoRelation[] } = {};

          before(async () => {
            ({ fOublier, fChangerProfondeur } =
              await client.réseau!.suivreRelationsConfiance(
                (r) => (rés.ultat = r),
                1
              ));
          });

          after(async () => {
            if (fOublier) fOublier();
            await client.réseau!.nePlusFaireConfianceAuMembre(
              client2.idBdCompte!
            );
            await client2.réseau!.nePlusFaireConfianceAuMembre(
              client3.idBdCompte!
            );
          });

          step("Relations immédiates", async () => {
            const réf: infoRelation[] = [
              {
                de: client.idBdCompte!,
                pour: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
            ];
            await client.réseau!.faireConfianceAuMembre(client2.idBdCompte!);

            await attendreRésultat(rés, "ultat", (x) => !!x.length);
            expect(rés.ultat).to.have.deep.members(réf);
          });
          step("Relations indirectes", async () => {
            const réf: infoRelation[] = [
              {
                de: client.idBdCompte!,
                pour: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
              {
                de: client2.idBdCompte!,
                pour: client3.idBdCompte!,
                confiance: 1,
                profondeur: 1,
              },
            ];
            await client2.réseau!.faireConfianceAuMembre(client3.idBdCompte!);

            await attendreRésultat(rés, "ultat", (x) => x.length === 2);
            expect(rés.ultat).to.have.deep.members(réf);
          });

          step("Diminuer profondeur", async () => {
            const réf: infoRelation[] = [
              {
                de: client.idBdCompte!,
                pour: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
            ];
            fChangerProfondeur(0);
            await attendreRésultat(rés, "ultat", (x) => x.length === 1);
            expect(rés.ultat).to.have.deep.members(réf);
          });

          step("Augmenter profondeur", async () => {
            const réf: infoRelation[] = [
              {
                de: client.idBdCompte!,
                pour: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
              {
                de: client2.idBdCompte!,
                pour: client3.idBdCompte!,
                confiance: 1,
                profondeur: 1,
              },
            ];

            fChangerProfondeur(1);

            await attendreRésultat(rés, "ultat", (x) => x.length === 2);
            expect(rés.ultat).to.have.deep.members(réf);
          });
        });

        describe("Suivre comptes réseau", async () => {
          let fOublier: schémaFonctionOublier;
          let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];

          const rés: { ultat?: infoMembreRéseau[] } = {};

          before(async () => {
            ({ fOublier, fChangerProfondeur } =
              await client.réseau!.suivreComptesRéseau(
                (c) => (rés.ultat = c),
                1
              ));
          });

          after(async () => {
            if (fOublier) fOublier();

            await client.réseau!.nePlusFaireConfianceAuMembre(
              client2.idBdCompte!
            );
            await client.réseau!.nePlusFaireConfianceAuMembre(
              client3.idBdCompte!
            );
            await client2.réseau!.nePlusFaireConfianceAuMembre(
              client3.idBdCompte!
            );
            await client2.réseau!.débloquerMembre(client3.idBdCompte!);
            await client.réseau!.débloquerMembre(client2.idBdCompte!);
          });

          step("Relations confiance immédiates", async () => {
            const réf: infoMembreRéseau[] = [
              {
                idBdCompte: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
            ];
            await client.réseau!.faireConfianceAuMembre(client2.idBdCompte!);

            await attendreRésultat(rés, "ultat", (x) => !!x.length);
            expect(rés.ultat).to.have.deep.members(réf);
          });
          step("Relations confiance indirectes", async () => {
            const réf: infoMembreRéseau[] = [
              {
                idBdCompte: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
              {
                idBdCompte: client3.idBdCompte!,
                confiance: 0.8,
                profondeur: 1,
              },
            ];
            await client2.réseau!.faireConfianceAuMembre(client3.idBdCompte!);

            await attendreRésultat(rés, "ultat", (x) => x.length > 1);
            expect(rés.ultat).to.have.deep.members(réf);
          });
          step("Relations confiance directes et indirectes", async () => {
            const réf: infoMembreRéseau[] = [
              {
                idBdCompte: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
              {
                idBdCompte: client3.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
            ];
            await client.réseau!.faireConfianceAuMembre(client3.idBdCompte!);

            await attendreRésultat(
              rés,
              "ultat",
              (x) => x.map((y) => y.confiance).reduce((i, j) => i * j, 1) === 1
            );
            expect(rés.ultat).to.have.deep.members(réf);
          });
          step("Enlever relation confiance directe (en double)", async () => {
            const réf: infoMembreRéseau[] = [
              {
                idBdCompte: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
              {
                idBdCompte: client3.idBdCompte!,
                confiance: 0.8,
                profondeur: 1,
              },
            ];
            await client.réseau!.nePlusFaireConfianceAuMembre(
              client3.idBdCompte!
            );

            await attendreRésultat(
              rés,
              "ultat",
              (x) => x.map((y) => y.confiance).reduce((i, j) => i * j, 1) < 1
            );
            expect(rés.ultat).to.have.deep.members(réf);
          });
          step("Enlever relation confiance indirecte", async () => {
            const réf: infoMembreRéseau[] = [
              {
                idBdCompte: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
            ];
            await client2.réseau!.nePlusFaireConfianceAuMembre(
              client3.idBdCompte!
            );

            await attendreRésultat(rés, "ultat", (x) => x.length === 1);
            expect(rés.ultat).to.have.deep.members(réf);
          });
          step("Enlever relation confiance directe", async () => {
            await client.réseau!.nePlusFaireConfianceAuMembre(
              client2.idBdCompte!
            );

            await attendreRésultat(rés, "ultat", (x) => !x.length);
            expect(rés.ultat).to.be.empty;
          });
          step("Membre bloqué directement", async () => {
            const réf: infoMembreRéseau[] = [
              {
                idBdCompte: client2.idBdCompte!,
                confiance: -1,
                profondeur: 0,
              },
            ];
            await client.réseau!.bloquerMembre(client2.idBdCompte!);

            await attendreRésultat(rés, "ultat", (x) => !!x.length);
            expect(rés.ultat).to.have.deep.members(réf);
          });
          step("Membre débloqué directement", async () => {
            await client.réseau!.débloquerMembre(client2.idBdCompte!);

            await attendreRésultat(rés, "ultat", (x) => !x.length);
            expect(rés.ultat).to.be.empty;
          });
          step("Membre bloqué indirectement", async () => {
            const réf: infoMembreRéseau[] = [
              {
                idBdCompte: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
              {
                idBdCompte: client3.idBdCompte!,
                confiance: -0.9,
                profondeur: 1,
              },
            ];
            await client.réseau!.faireConfianceAuMembre(client2.idBdCompte!);
            await client2.réseau!.bloquerMembre(client3.idBdCompte!);

            await attendreRésultat(rés, "ultat", (x) => x.length === 2);
            expect(rés.ultat).to.have.deep.members(réf);
          });
          step("Précédence confiance propre", async () => {
            const réf: infoMembreRéseau[] = [
              {
                idBdCompte: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
              {
                idBdCompte: client3.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
            ];
            await client.réseau!.faireConfianceAuMembre(client3.idBdCompte!);

            await attendreRésultat(
              rés,
              "ultat",
              (x) =>
                x.find((y) => y.idBdCompte === client3.idBdCompte)
                  ?.confiance === 1
            );
            expect(rés.ultat).to.have.deep.members(réf);

            await client.réseau!.nePlusFaireConfianceAuMembre(
              client3.idBdCompte!
            );
            await client.réseau!.nePlusFaireConfianceAuMembre(
              client2.idBdCompte!
            );
            await client2.réseau!.débloquerMembre(client3.idBdCompte!);
          });
          step("Diminuer profondeur", async () => {
            const réf: infoMembreRéseau[] = [
              {
                idBdCompte: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
            ];
            await client.réseau!.faireConfianceAuMembre(client2.idBdCompte!);
            await client2.réseau!.faireConfianceAuMembre(client3.idBdCompte!);
            await attendreRésultat(rés, "ultat", (x) => x.length === 2);

            fChangerProfondeur(0);
            await attendreRésultat(rés, "ultat", (x) => x.length === 1);
            expect(rés.ultat).to.have.deep.members(réf);
          });
          step("Augmenter profondeur", async () => {
            const réf: infoMembreRéseau[] = [
              {
                idBdCompte: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
              {
                idBdCompte: client3.idBdCompte!,
                confiance: 0.8,
                profondeur: 1,
              },
            ];

            fChangerProfondeur(1);

            await attendreRésultat(rés, "ultat", (x) => x.length === 2);
            expect(rés.ultat).to.have.deep.members(réf);
          });
        });

        describe("Suivre comptes réseau et en ligne", async () => {
          let fOublier: schémaFonctionOublier;
          let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];

          const rés: { ultat?: infoMembreRéseau[] } = {};

          before(async () => {
            ({ fOublier, fChangerProfondeur } =
              await client.réseau!.suivreComptesRéseauEtEnLigne(
                (c) => (rés.ultat = c),
                1
              ));
          });

          after(async () => {
            if (fOublier) fOublier();

            await client.réseau!.nePlusFaireConfianceAuMembre(
              client2.idBdCompte!
            );
            await client2.réseau!.nePlusFaireConfianceAuMembre(
              client3.idBdCompte!
            );
          });

          step("Comptes en ligne détectés", async () => {
            const réf: infoMembreRéseau[] = [
              {
                idBdCompte: client2.idBdCompte!,
                confiance: 0,
                profondeur: -1,
              },
              {
                idBdCompte: client3.idBdCompte!,
                confiance: 0,
                profondeur: -1,
              },
            ];

            await attendreRésultat(rés, "ultat", (x) => x.length === 2);
            expect(rés.ultat).to.have.deep.members(réf);
          });

          step("Comptes réseau détectés", async () => {
            const réf: infoMembreRéseau[] = [
              {
                idBdCompte: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
              {
                idBdCompte: client3.idBdCompte!,
                confiance: 0,
                profondeur: -1,
              },
            ];

            await client.réseau!.faireConfianceAuMembre(client2.idBdCompte!);
            await attendreRésultat(
              rés,
              "ultat",
              (x) =>
                x.find((x) => x.idBdCompte === client2.idBdCompte)
                  ?.confiance === 1
            );

            expect(rés.ultat).to.have.deep.members(réf);
          });

          step("Changer profondeur", async () => {
            await client2.réseau!.faireConfianceAuMembre(client3.idBdCompte!);
            await attendreRésultat(
              rés,
              "ultat",
              (x) =>
                (x.find((x) => x.idBdCompte === client3.idBdCompte)
                  ?.confiance || 0) > 0
            );

            const réf: infoMembreRéseau[] = [
              {
                idBdCompte: client2.idBdCompte!,
                confiance: 1,
                profondeur: 0,
              },
              {
                idBdCompte: client3.idBdCompte!,
                confiance: 0,
                profondeur: -1,
              },
            ];
            fChangerProfondeur(0);
            await attendreRésultat(
              rés,
              "ultat",
              (x) =>
                x.find((x) => x.idBdCompte === client3.idBdCompte)
                  ?.confiance === 0
            );

            expect(rés.ultat).to.have.deep.members(réf);
          });
        });

        describe("Suivre confiance mon réseau pour membre", async () => {
          let fOublier: schémaFonctionOublier;
          let fChangerProfondeur: schémaRetourFonctionRecherche["fChangerProfondeur"];

          const rés: { ultat?: number } = {};

          before(async () => {
            ({ fOublier, fChangerProfondeur } =
              await client.réseau!.suivreConfianceMonRéseauPourMembre(
                client3.idBdCompte!,
                (confiance) => (rés.ultat = confiance)
              ));
          });

          after(async () => {
            if (fOublier) fOublier();
            await client.réseau!.nePlusFaireConfianceAuMembre(
              client2.idBdCompte!
            );
            await client2.réseau!.nePlusFaireConfianceAuMembre(
              client3.idBdCompte!
            );
          });

          step("Confiance initiale 0", async () => {
            await attendreRésultat(rés, "ultat", (x) => x === 0);
          });

          step("Faire confiance au membre", async () => {
            await client.réseau!.faireConfianceAuMembre(client2.idBdCompte!);
            await client2.réseau!.faireConfianceAuMembre(client3.idBdCompte!);

            await attendreRésultat(rés, "ultat", (x) => x > 0);
            expect(rés.ultat).to.equal(0.8);
          });

          step("Changer profondeur", async () => {
            fChangerProfondeur(0);
            await attendreRésultat(rés, "ultat", (x) => x === 0);
          });
        });

        describe("Suivre confiance auteurs", async () => {
          let fOublier: schémaFonctionOublier;
          let idMotClef: string;

          const rés: { ultat?: number } = {};

          before(async () => {
            idMotClef = await client2.motsClefs!.créerMotClef();

            fOublier = await client.réseau!.suivreConfianceAuteurs(
              idMotClef,
              "motsClefs",
              (confiance) => (rés.ultat = confiance)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
            if (idMotClef) await client2.motsClefs!.effacerMotClef(idMotClef);

            await client.réseau!.nePlusFaireConfianceAuMembre(
              client2.idBdCompte!
            );
            await client.réseau!.nePlusFaireConfianceAuMembre(
              client3.idBdCompte!
            );
          });

          step("Confiance 0 pour commencer", async () => {
            await attendreRésultat(rés, "ultat", (x) => x === 0);
          });

          step("Ajout auteur au réseau", async () => {
            await client.réseau!.faireConfianceAuMembre(client2.idBdCompte!);

            await attendreRésultat(rés, "ultat", (x) => x > 0);
            expect(rés.ultat).to.equal(1);
          });

          step("Ajout coauteur au réseau", async () => {
            await client2.motsClefs!.inviterAuteur(
              idMotClef,
              client3.idBdCompte!,
              MEMBRE
            );
            await client3.motsClefs!.ajouterÀMesMotsClefs(idMotClef);
            await attendreRésultat(rés, "ultat", (x) => x > 1);

            expect(rés.ultat).to.approximately(1.72, 0.01);

            await client.réseau!.faireConfianceAuMembre(client3.idBdCompte!);
            await attendreRésultat(rés, "ultat", (x) => x > 1.8);

            expect(rés.ultat).to.equal(2);
          });

          step("Coauteur se retire", async () => {
            await client3.motsClefs!.enleverDeMesMotsClefs(idMotClef);
            await attendreRésultat(rés, "ultat", (x) => x < 2);

            expect(rés.ultat).to.equal(1);
          });
        });

        describe("Auteurs", function () {
          describe("Mots-clefs", function () {
            let idMotClef: string;
            let fOublier: schémaFonctionOublier;

            const rés: { ultat?: infoAuteur[] } = {};

            before(async () => {
              idMotClef = await client.motsClefs!.créerMotClef();
              fOublier = await client.réseau!.suivreAuteursMotClef(
                idMotClef,
                (auteurs) => (rés.ultat = auteurs)
              );
            });

            after(async () => {
              if (fOublier) fOublier();
              if (idMotClef) {
                await client.motsClefs!.effacerMotClef(idMotClef);
                await client2.motsClefs!.enleverDeMesMotsClefs(idMotClef);
              }
            });

            step("Inviter auteur", async () => {
              const réf: infoAuteur[] = [
                {
                  idBdCompte: client.idBdCompte!,
                  accepté: true,
                  rôle: MODÉRATEUR,
                },
                {
                  idBdCompte: client2.idBdCompte!,
                  accepté: false,
                  rôle: MEMBRE,
                },
              ];
              await client.motsClefs!.inviterAuteur(
                idMotClef,
                client2.idBdCompte!,
                MEMBRE
              );

              await attendreRésultat(rés, "ultat", (x) => !!x && x.length > 1);
              expect(rés.ultat).to.have.deep.members(réf);
            });
            step("Accepter invitation", async () => {
              const réf: infoAuteur[] = [
                {
                  idBdCompte: client.idBdCompte!,
                  accepté: true,
                  rôle: MODÉRATEUR,
                },
                {
                  idBdCompte: client2.idBdCompte!,
                  accepté: true,
                  rôle: MEMBRE,
                },
              ];

              await client2.motsClefs!.ajouterÀMesMotsClefs(idMotClef);
              await attendreRésultat(rés, "ultat", (x) =>
                Boolean(
                  x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
                )
              );

              expect(rés.ultat).to.have.deep.members(réf);
            });
            step("Refuser invitation", async () => {
              const réf: infoAuteur[] = [
                {
                  idBdCompte: client.idBdCompte!,
                  accepté: true,
                  rôle: MODÉRATEUR,
                },
                {
                  idBdCompte: client2.idBdCompte!,
                  accepté: false,
                  rôle: MEMBRE,
                },
              ];

              await client2.motsClefs!.enleverDeMesMotsClefs(idMotClef);
              await attendreRésultat(
                rés,
                "ultat",
                (x) =>
                  !x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
              );

              expect(rés.ultat).to.have.deep.members(réf);
            });
            step("Promotion à modérateur", async () => {
              await client.motsClefs!.inviterAuteur(
                idMotClef,
                idBdCompte2,
                MODÉRATEUR
              );

              await attendreRésultat(
                rés,
                "ultat",
                (auteurs: infoAuteur[]) =>
                  auteurs.find((a) => a.idBdCompte === idBdCompte2)?.rôle ===
                  MODÉRATEUR
              );
            });
          });
          describe("Variables", function () {
            let idVariable: string;
            let fOublier: schémaFonctionOublier;

            const rés: { ultat?: infoAuteur[] } = {};

            before(async () => {
              idVariable = await client.variables!.créerVariable("numérique");
              fOublier = await client.réseau!.suivreAuteursVariable(
                idVariable,
                (auteurs) => (rés.ultat = auteurs)
              );
            });

            after(async () => {
              if (fOublier) fOublier();
              if (idVariable)
                await client.variables!.effacerVariable(idVariable);
            });

            step("Inviter auteur", async () => {
              const réf: infoAuteur[] = [
                {
                  idBdCompte: client.idBdCompte!,
                  accepté: true,
                  rôle: MODÉRATEUR,
                },
                {
                  idBdCompte: client2.idBdCompte!,
                  accepté: false,
                  rôle: MEMBRE,
                },
              ];
              await client.variables!.inviterAuteur(
                idVariable,
                client2.idBdCompte!,
                MEMBRE
              );

              await attendreRésultat(rés, "ultat", (x) => !!x && x.length > 1);
              expect(rés.ultat).to.have.deep.members(réf);
            });
            step("Accepter invitation", async () => {
              const réf: infoAuteur[] = [
                {
                  idBdCompte: client.idBdCompte!,
                  accepté: true,
                  rôle: MODÉRATEUR,
                },
                {
                  idBdCompte: client2.idBdCompte!,
                  accepté: true,
                  rôle: MEMBRE,
                },
              ];

              await client2.variables!.ajouterÀMesVariables(idVariable);
              await attendreRésultat(rés, "ultat", (x) =>
                Boolean(
                  x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
                )
              );

              expect(rés.ultat).to.have.deep.members(réf);
            });
            step("Refuser invitation", async () => {
              const réf: infoAuteur[] = [
                {
                  idBdCompte: client.idBdCompte!,
                  accepté: true,
                  rôle: MODÉRATEUR,
                },
                {
                  idBdCompte: client2.idBdCompte!,
                  accepté: false,
                  rôle: MEMBRE,
                },
              ];

              await client2.variables!.enleverDeMesVariables(idVariable);
              await attendreRésultat(
                rés,
                "ultat",
                (x) =>
                  !x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
              );

              expect(rés.ultat).to.have.deep.members(réf);
            });
            step("Promotion à modérateur", async () => {
              await client.variables!.inviterAuteur(
                idVariable,
                idBdCompte2,
                MODÉRATEUR
              );

              await attendreRésultat(
                rés,
                "ultat",
                (auteurs: infoAuteur[]) =>
                  auteurs.find((a) => a.idBdCompte === idBdCompte2)?.rôle ===
                  MODÉRATEUR
              );
            });
          });
          describe("Bds", function () {
            let idBd: string;
            let fOublier: schémaFonctionOublier;

            const rés: { ultat?: infoAuteur[] } = {};

            before(async () => {
              idBd = await client.bds!.créerBd("ODbl-1_0");
              fOublier = await client.réseau!.suivreAuteursBd(
                idBd,
                (auteurs) => (rés.ultat = auteurs)
              );
            });

            after(async () => {
              if (fOublier) fOublier();
              if (idBd) await client.bds!.effacerBd(idBd);
            });

            step("Inviter auteur", async () => {
              const réf: infoAuteur[] = [
                {
                  idBdCompte: client.idBdCompte!,
                  accepté: true,
                  rôle: MODÉRATEUR,
                },
                {
                  idBdCompte: client2.idBdCompte!,
                  accepté: false,
                  rôle: MEMBRE,
                },
              ];
              await client.bds!.inviterAuteur(idBd, idBdCompte2, MEMBRE);

              await attendreRésultat(rés, "ultat", (x) => !!x && x.length > 1);
              expect(rés.ultat).to.have.deep.members(réf);
            });

            step("Accepter invitation", async () => {
              const réf: infoAuteur[] = [
                {
                  idBdCompte: client.idBdCompte!,
                  accepté: true,
                  rôle: MODÉRATEUR,
                },
                {
                  idBdCompte: client2.idBdCompte!,
                  accepté: true,
                  rôle: MEMBRE,
                },
              ];

              await client2.bds!.ajouterÀMesBds(idBd);
              await attendreRésultat(rés, "ultat", (x) =>
                Boolean(
                  x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
                )
              );

              expect(rés.ultat).to.have.deep.members(réf);
            });

            step("Refuser invitation", async () => {
              const réf: infoAuteur[] = [
                {
                  idBdCompte: client.idBdCompte!,
                  accepté: true,
                  rôle: MODÉRATEUR,
                },
                {
                  idBdCompte: client2.idBdCompte!,
                  accepté: false,
                  rôle: MEMBRE,
                },
              ];

              await client2.bds!.enleverDeMesBds(idBd);
              await attendreRésultat(
                rés,
                "ultat",
                (x) =>
                  !x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
              );

              expect(rés.ultat).to.have.deep.members(réf);
            });

            step("Promotion à modérateur", async () => {
              await client.bds!.inviterAuteur(idBd, idBdCompte2, MODÉRATEUR);

              await attendreRésultat(
                rés,
                "ultat",
                (auteurs: infoAuteur[]) =>
                  auteurs.find((a) => a.idBdCompte === idBdCompte2)?.rôle ===
                  MODÉRATEUR
              );
            });
          });

          describe("Projets", function () {
            let idProjet: string;
            let fOublier: schémaFonctionOublier;

            const rés: { ultat?: infoAuteur[] } = {};

            before(async () => {
              idProjet = await client.projets!.créerProjet();
              fOublier = await client.réseau!.suivreAuteursProjet(
                idProjet,
                (auteurs) => (rés.ultat = auteurs)
              );
            });

            after(async () => {
              if (fOublier) fOublier();
              if (idProjet) await client.projets!.effacerProjet(idProjet);
            });

            step("Inviter auteur", async () => {
              const réf: infoAuteur[] = [
                {
                  idBdCompte: client.idBdCompte!,
                  accepté: true,
                  rôle: MODÉRATEUR,
                },
                {
                  idBdCompte: client2.idBdCompte!,
                  accepté: false,
                  rôle: MEMBRE,
                },
              ];
              await client.projets!.inviterAuteur(
                idProjet,
                client2.idBdCompte!,
                MEMBRE
              );

              await attendreRésultat(rés, "ultat", (x) => !!x && x.length > 1);
              expect(rés.ultat).to.have.deep.members(réf);
            });

            step("Accepter invitation", async () => {
              const réf: infoAuteur[] = [
                {
                  idBdCompte: client.idBdCompte!,
                  accepté: true,
                  rôle: MODÉRATEUR,
                },
                {
                  idBdCompte: client2.idBdCompte!,
                  accepté: true,
                  rôle: MEMBRE,
                },
              ];

              await client2.projets!.ajouterÀMesProjets(idProjet);
              await attendreRésultat(rés, "ultat", (x) =>
                Boolean(
                  x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
                )
              );

              expect(rés.ultat).to.have.deep.members(réf);
            });
            step("Refuser invitation", async () => {
              const réf: infoAuteur[] = [
                {
                  idBdCompte: client.idBdCompte!,
                  accepté: true,
                  rôle: MODÉRATEUR,
                },
                {
                  idBdCompte: client2.idBdCompte!,
                  accepté: false,
                  rôle: MEMBRE,
                },
              ];

              await client2.projets!.enleverDeMesProjets(idProjet);
              await attendreRésultat(
                rés,
                "ultat",
                (x) =>
                  !x.find((y) => y.idBdCompte === client2.idBdCompte)?.accepté
              );

              expect(rés.ultat).to.have.deep.members(réf);
            });
            step("Promotion à modérateur", async () => {
              await client.projets!.inviterAuteur(
                idProjet,
                idBdCompte2,
                MODÉRATEUR
              );

              await attendreRésultat(
                rés,
                "ultat",
                (auteurs: infoAuteur[]) =>
                  auteurs.find((a) => a.idBdCompte === idBdCompte2)?.rôle ===
                  MODÉRATEUR
              );
            });
          });
        });

        describe("Suivre noms membre", function () {
          const rés: { ultat: { [key: string]: string } | undefined } = {
            ultat: undefined,
          };
          let fOublier: schémaFonctionOublier;

          before(async () => {
            await client.profil!.sauvegarderNom("fr", "Julien");
            fOublier = await client2.réseau!.suivreNomsMembre(
              idBdCompte1,
              (n) => (rés.ultat = n)
            );
          });

          step("Noms détectés", async () => {
            await attendreRésultat(rés, "ultat", (x) => !!x && Boolean(x.fr));
            expect(rés.ultat?.fr).to.exist;
            expect(rés.ultat?.fr).to.equal("Julien");
          });

          after(async () => {
            if (fOublier) fOublier();
          });
        });

        describe("Suivre courriel membre", function () {
          const rés: { ultat: string | null | undefined } = {
            ultat: undefined,
          };
          let fOublier: schémaFonctionOublier;

          before(async () => {
            await client.profil!.sauvegarderCourriel("தொடர்பு@லஸ்ஸி.இந்தியா");
            fOublier = await client2.réseau!.suivreCourrielMembre(
              idBdCompte1,
              (c) => (rés.ultat = c)
            );
          });

          step("Courriel détecté", async () => {
            await attendreRésultat(
              rés,
              "ultat",
              (x: string | null | undefined) => Boolean(x)
            );
            expect(rés.ultat).to.equal("தொடர்பு@லஸ்ஸி.இந்தியா");
          });

          after(async () => {
            if (fOublier) fOublier();
          });
        });

        describe("Suivre image membre", function () {
          const rés: { ultat: Uint8Array | undefined | null } = {
            ultat: undefined,
          };
          let fOublier: schémaFonctionOublier;

          const IMAGE = fs.readFileSync(
            path.resolve(__dirname, "_ressources/logo.svg")
          );

          before(async () => {
            await client.profil!.sauvegarderImage(IMAGE);
            fOublier = await client2.réseau!.suivreImageMembre(
              idBdCompte1,
              (i) => (rés.ultat = i)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Image détectée", async () => {
            await attendreRésultat(
              rés,
              "ultat",
              (x: Uint8Array | undefined | null) => Boolean(x)
            );
            expect(rés.ultat).to.deep.equal(new Uint8Array(IMAGE));
          });
        });

        describe("Suivre mots-clefs", function () {
          let idMotClef1: string;
          let idMotClef2: string;

          const rés: { propre?: string[]; autre?: string[] } = {};
          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            fsOublier.push(
              await client2.réseau!.suivreMotsClefsMembre(
                idBdCompte1,
                (motsClefs) => (rés.autre = motsClefs)
              )
            );
            fsOublier.push(
              await client2.réseau!.suivreMotsClefsMembre(
                idBdCompte2,
                (motsClefs) => (rés.propre = motsClefs)
              )
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
            if (idMotClef1) await client.motsClefs!.effacerMotClef(idMotClef1);
            if (idMotClef2) await client.motsClefs!.effacerMotClef(idMotClef2);
          });

          step("Mes propres mots-clefs détectés", async () => {
            idMotClef2 = await client2.motsClefs!.créerMotClef();

            await attendreRésultat(rés, "propre", (x) => x && !!x.length);
            expect(rés.propre).to.have.members([idMotClef2]);
          });

          step("Mot-clef d'un autre membre détecté", async () => {
            idMotClef1 = await client.motsClefs!.créerMotClef();
            await attendreRésultat(rés, "autre", (x) => x && !!x.length);
            expect(rés.autre).to.have.members([idMotClef1]);
          });
        });

        describe("Suivre variables", function () {
          let idVariable1: string;
          let idVariable2: string;

          const rés: { propres?: string[]; autres?: string[] } = {};
          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            fsOublier.push(
              await client2.réseau!.suivreVariablesMembre(
                idBdCompte1,
                (variables) => (rés.autres = variables)
              )
            );
            fsOublier.push(
              await client2.réseau!.suivreVariablesMembre(
                idBdCompte2,
                (variables) => (rés.propres = variables)
              )
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
            if (idVariable1)
              await client.variables!.effacerVariable(idVariable1);
            if (idVariable2)
              await client2.variables!.effacerVariable(idVariable2);
          });

          step("Mes variables détectées", async () => {
            idVariable2 = await client2.variables!.créerVariable("numérique");

            await attendreRésultat(rés, "propres", (x) => x && !!x.length);
            expect(rés.propres).to.have.members([idVariable2]);
          });

          step("Variable d'un autre membre détectée", async () => {
            idVariable1 = await client.variables!.créerVariable("numérique");
            await attendreRésultat(rés, "autres", (x) => Boolean(x?.length));
            expect(rés.autres).to.have.members([idVariable1]);
          });
        });

        describe("Suivre BDs", function () {
          const rés: { propres?: string[]; autres?: string[] } = {};
          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            fsOublier.push(
              await client2.réseau!.suivreBdsMembre(
                idBdCompte1,
                (bds) => (rés.autres = bds)
              )
            );
            fsOublier.push(
              await client2.réseau!.suivreBdsMembre(
                idBdCompte2,
                (bds) => (rés.propres = bds)
              )
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          step("Mes BDs détectées", async () => {
            const idBd = await client2.bds!.créerBd("ODbl-1_0");

            await attendreRésultat(rés, "propres", (x) => x && !!x.length);
            expect(rés.propres).to.have.members([idBd]);
          });

          step("BD d'un autre membre détectée", async () => {
            const idBd = await client.bds!.créerBd("ODbl-1_0");
            await attendreRésultat(rés, "autres", (x) => x && !!x.length);
            expect(rés.autres).to.have.members([idBd]);
          });
        });

        describe("Suivre projets", function () {
          const rés: { propres?: string[]; autres?: string[] } = {};
          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            fsOublier.push(
              await client2.réseau!.suivreProjetsMembre(
                idBdCompte1,
                (projets) => (rés.autres = projets)
              )
            );
            fsOublier.push(
              await client2.réseau!.suivreProjetsMembre(
                idBdCompte2,
                (projets) => (rés.propres = projets)
              )
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          step("Mes projets détectés", async () => {
            const idProjet = await client2.projets!.créerProjet();

            await attendreRésultat(rés, "propres", (x) => x && !!x.length);
            expect(rés.propres).to.have.members([idProjet]);
          });

          step("Projet d'un autre membre détecté", async () => {
            const idProjet = await client.projets!.créerProjet();
            await attendreRésultat(rés, "autres", (x) => x && !!x.length);
            expect(rés.autres).to.have.members([idProjet]);
          });
        });

        describe("Suivre favoris", function () {
          let idMotClef: string;

          const rés: {
            propres?: ÉlémentFavorisAvecObjet[];
            autres?: ÉlémentFavorisAvecObjet[];
          } = {};
          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            fsOublier.push(
              await client2.réseau!.suivreFavorisMembre(
                idBdCompte1,
                (favoris) => (rés.autres = favoris)
              )
            );
            fsOublier.push(
              await client2.réseau!.suivreFavorisMembre(
                idBdCompte2,
                (favoris) => (rés.propres = favoris)
              )
            );

            idMotClef = await client.motsClefs!.créerMotClef();
          });

          after(async () => {
            fsOublier.forEach((f) => f());
            if (idMotClef) await client.motsClefs!.effacerMotClef(idMotClef);
          });

          step("Mes favoris détectés", async () => {
            const réf: ÉlémentFavorisAvecObjet[] = [
              {
                récursif: true,
                dispositifs: "TOUS",
                dispositifsFichiers: "INSTALLÉ",
                idObjet: idMotClef,
              },
            ];

            await client2.favoris!.épinglerFavori(idMotClef, "TOUS");
            await attendreRésultat(rés, "propres", (x) => x && !!x.length);
            expect(rés.propres).to.have.deep.members(réf);
          });

          step("Favoris d'un autre membre détectés", async () => {
            const réf: ÉlémentFavorisAvecObjet[] = [
              {
                récursif: true,
                dispositifs: "TOUS",
                dispositifsFichiers: "INSTALLÉ",
                idObjet: idMotClef,
              },
            ];

            await client.favoris!.épinglerFavori(idMotClef, "TOUS");
            await attendreRésultat(rés, "autres", (x) => x && !!x.length);
            expect(rés.autres).to.have.deep.members(réf);
          });
        });

        describe("Suivre favoris objet", function () {
          let idMotClef: string;
          let fOublier: schémaFonctionOublier;

          const rés: {
            ultat?: (ÉlémentFavorisAvecObjet & { idBdCompte: string })[];
          } = {};

          before(async () => {
            idMotClef = await client.motsClefs!.créerMotClef();

            ({ fOublier } = await client.réseau!.suivreFavorisObjet(
              idMotClef,
              (favoris) => (rés.ultat = favoris)
            ));
          });

          after(async () => {
            if (fOublier) fOublier();
            if (idMotClef) await client.motsClefs!.effacerMotClef(idMotClef);
          });

          step("Aucun favoris pour commencer", async () => {
            await attendreRésultat(rés, "ultat");
            expect(rés.ultat).to.be.empty;
          });

          step("Ajout à mes favoris détecté", async () => {
            const réf: (ÉlémentFavorisAvecObjet & { idBdCompte: string })[] = [
              {
                récursif: true,
                dispositifs: "TOUS",
                dispositifsFichiers: "INSTALLÉ",
                idObjet: idMotClef,
                idBdCompte: idBdCompte1,
              },
            ];
            await client.favoris!.épinglerFavori(idMotClef, "TOUS");
            await attendreRésultat(rés, "ultat", (x) => x && !!x.length);

            expect(rés.ultat).to.have.deep.members(réf);
          });

          step("Ajout aux favoris d'un autre membre détecté", async () => {
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
            await client2.favoris!.épinglerFavori(idMotClef, "TOUS");
            await attendreRésultat(rés, "ultat", (x) => x && x.length === 2);

            expect(rés.ultat).to.have.deep.members(réf);
          });
        });

        describe("Suivre réplications", function () {
          let idBd: string;

          const rés: { ultat?: infoRéplications } = {
            ultat: undefined,
          };
          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            idBd = await client.bds!.créerBd("ODbl-1_0");
            fsOublier.push(
              (
                await client.réseau!.suivreRéplications(
                  idBd,
                  (bds) => (rés.ultat = bds)
                )
              ).fOublier
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
            if (idBd) {
              await client.bds!.effacerBd(idBd);
              await client2.favoris!.désépinglerFavori(idBd);
            }
          });

          step("Auteur de la BD pour commencer", async () => {
            await client.favoris!.épinglerFavori(idBd, "TOUS");

            await attendreRésultat(
              rés,
              "ultat",
              (x) => x && x.membres.length > 0
            );

            expect(
              rés.ultat!.membres.map((m) => m.infoMembre.idBdCompte)
            ).to.have.members([idBdCompte1]);
            expect(
              rés.ultat!.dispositifs.map((d) => d.idDispositif)
            ).to.have.members([idOrbite1]);
          });

          step("Ajout d'une réplication détectée", async () => {
            await client2.favoris!.épinglerFavori(idBd, "TOUS");

            await attendreRésultat(
              rés,
              "ultat",
              (x) => x && x.membres.length > 1
            );

            expect(
              rés.ultat!.membres.map((m) => m.infoMembre.idBdCompte)
            ).to.have.members([idBdCompte1, idBdCompte2]);
            expect(
              rés.ultat!.dispositifs.map((d) => d.idDispositif)
            ).to.have.members([idOrbite1, idOrbite2]);
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

          const idUniqueTableau = "tableau trads";
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

          before(async () => {
            const idVarClef = await client.variables!.créerVariable("chaîne");
            const idVarLangue = await client.variables!.créerVariable("chaîne");
            const idVarTrad = await client.variables!.créerVariable("chaîne");

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
                  idUnique: idUniqueTableau,
                },
              ],
            };

            idBd1 = await client.bds!.créerBdDeSchéma(schéma);
            idBd2 = await client2.bds!.créerBdDeSchéma(schéma);

            idTableau1 = (
              await uneFois(
                async (
                  fSuivi: schémaFonctionSuivi<string[]>
                ): Promise<schémaFonctionOublier> => {
                  return await client.bds!.suivreTableauxBd(idBd1, fSuivi);
                }
              )
            )[0];

            idTableau2 = (
              await uneFois(
                async (
                  fSuivi: schémaFonctionSuivi<string[]>
                ): Promise<schémaFonctionOublier> => {
                  return await client2.bds!.suivreTableauxBd(idBd2, fSuivi);
                }
              )
            )[0];

            fsOublier.push(
              (
                await client.réseau!.suivreBdsDeMotClef(
                  motClef,
                  (bds) => (rés.ultat = bds),
                  100
                )
              ).fOublier
            );
            fsOublier.push(
              (
                await client.réseau!.suivreÉlémentsDeTableauxUniques(
                  motClef,
                  idUniqueTableau,
                  (éléments) => (rés.ultat2 = éléments)
                )
              ).fOublier
            );

            empreinte1 = await client.tableaux!.ajouterÉlément(
              idTableau1,
              données1
            );
            empreinte2 = await client.tableaux!.ajouterÉlément(
              idTableau1,
              données2
            );
            empreinte3 = await client2.tableaux!.ajouterÉlément(
              idTableau2,
              données3
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          step("Suivre BDs du réseau", async () => {
            /*await attendreRésultat(
              rés,
              "ultat",
              (x?: string[]) => x && x.length === 2
            );*/
            expect(rés.ultat)
              .to.be.an("array")
              .with.lengthOf(2)
              .and.members([idBd1, idBd2]);
          });
          step("Suivre éléments des BDs", async () => {
            /*await attendreRésultat(
              rés,
              "ultat2",
              (x?: string[]) => x && x.length === 3
            );*/
            expect(
              rés.ultat2!.map((r) => {
                delete r.élément.données.id;
                return r;
              })
            )
              .to.be.an("array")
              .with.lengthOf(3)
              .and.deep.members([
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
              ]);
          });
        });
      });
    });
  });
});
