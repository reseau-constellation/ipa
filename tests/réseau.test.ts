import { expect } from "chai";
import { step } from "mocha-steps";

import fs from "fs";
import path from "path";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import { schémaFonctionSuivi, schémaFonctionOublier, uneFois } from "@/utils";
import {
  élémentDeMembre,
  statutDispositif,
  infoBloqué,
  infoConfiance,
  infoMembre,
  statutMembre,
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
        let idBdRacine1: string;
        let idBdRacine2: string;
        let idBdRacine3: string;
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

          idBdRacine1 = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string>
            ): Promise<schémaFonctionOublier> => {
              return await client.suivreIdBdCompte(fSuivi);
            }
          );

          idBdRacine2 = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string>
            ): Promise<schémaFonctionOublier> => {
              return await client2.suivreIdBdCompte(fSuivi);
            }
          );

          idBdRacine3 = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string>
            ): Promise<schémaFonctionOublier> => {
              return await client3.suivreIdBdCompte(fSuivi);
            }
          );

          console.log({ idBdRacine1, idBdRacine2, idBdRacine3 });
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
              (x?: statutDispositif[]) => x && x.length === 3
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
                idBdCompte: idBdRacine2,
                dispositifs: [
                  {
                    idSFIP: idNodeSFIP2,
                    idOrbite: idOrbite2,
                    idCompte: idBdRacine2,
                    clefPublique: client2.orbite!.identity.publicKey,
                    signatures: client2.orbite!.identity.signatures,
                  },
                ],
              },
              {
                idBdCompte: idBdRacine3,
                dispositifs: [
                  {
                    idSFIP: idNodeSFIP3,
                    idOrbite: idOrbite3,
                    idCompte: idBdRacine3,
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
                idBdRacine1
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
            await client.réseau!.faireConfianceAuMembre(idBdRacine2);
            expect(fiables.propres)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.deep.members([idBdRacine2]);
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
              .and.deep.members([idBdRacine2]);
          });

          step("Un débloquage accidental ne fait rien", async () => {
            await client.réseau!.débloquerMembre(idBdRacine2);
            expect(fiables.propres)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.deep.members([idBdRacine2]);
          });

          step("Changer d'avis", async () => {
            await client.réseau!.nePlusFaireConfianceAuMembre(idBdRacine2);
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
                idBdRacine1
              )
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          step("Personne pour commencer", async () => {
            expect(bloqués.publiques).to.be.empty;
          });

          step("Bloquer quelqu'un", async () => {
            await client.réseau!.bloquerMembre(idBdRacine2);
            expect(bloqués.tous)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.deep.members([
                {
                  idBdCompte: idBdRacine2,
                  privé: false,
                },
              ]);
            expect(bloqués.publiques)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.members([idBdRacine2]);
          });

          step("Un dé-confiance accidental ne fait rien", async () => {
            await client.réseau!.nePlusFaireConfianceAuMembre(idBdRacine2);
            expect(bloqués.tous)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.deep.members([
                {
                  idBdCompte: idBdRacine2,
                  privé: false,
                },
              ]);
          });

          step("Bloquer privé", async () => {
            await client.réseau!.bloquerMembre(idBdRacine3, true);
            expect(bloqués.tous)
              .to.be.an("array")
              .with.lengthOf(2)
              .and.deep.members([
                {
                  idBdCompte: idBdRacine2,
                  privé: false,
                },
                {
                  idBdCompte: idBdRacine3,
                  privé: true,
                },
              ]);
          });

          step("On détecte bloqué publique d'un autre membre", async () => {
            await attendreRésultat(
              bloqués,
              "autreMembre",
              (x: infoBloqué[]) => x.length > 0
            );
            expect(bloqués.autreMembre)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.deep.members([
                {
                  idBdCompte: idBdRacine2,
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
              ).to.not.include(idBdRacine3);
            }
          );

          step("Débloquer publique", async () => {
            await client.réseau!.débloquerMembre(idBdRacine2);
            expect(bloqués.publiques).to.be.empty;
          });

          step("Débloquer privé", async () => {
            await client.réseau!.débloquerMembre(idBdRacine3);
            expect(bloqués.tous).to.be.empty;
          });
        });

        describe("Suivre relations immédiates", function () {
          let idMotClef: string;
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
                idBdRacine1
              )
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          step("Personne pour commencer", async () => {
            expect(relations.propres).to.be.an.empty("array");
            expect(relations.autre).to.be.an.empty("array");
          });

          step("Ajout membre de confiance détecté", async () => {
            await client.réseau!.faireConfianceAuMembre(idBdRacine2);
            await attendreRésultat(
              relations,
              "propres",
              (x: infoConfiance[]) => x.length
            );
            expect(
              relations.propres!.map((r) => r.idBdCompte)
            ).to.include.members([idBdRacine2]);
          });

          step(
            "Ajout membres au réseau d'un autre membre détecté",
            async () => {
              await attendreRésultat(
                relations,
                "autre",
                (x?: infoConfiance[]) => x && x.length
              );
              expect(relations.autre).to.be.an("array").with.lengthOf(1);
              expect(
                relations.autre!.map((r) => r.idBdCompte)
              ).to.include.members([idBdRacine2]);
            }
          );

          step("Enlever membre de confiance détecté", async () => {
            await client.réseau!.nePlusFaireConfianceAuMembre(idBdRacine2);
            expect(relations.propres).to.be.empty;
          });

          step("Ajout aux favoris détecté", async () => {
            idMotClef = await client2.motsClefs!.créerMotClef();
            await client.favoris!.épinglerFavori(idMotClef, "TOUS");

            await attendreRésultat(
              relations,
              "propres",
              (x?: infoConfiance[]) => x && x.length
            );
            expect(relations.propres!.map((r) => r.idBdCompte)).to.include(
              idBdRacine2
            );
          });

          step("Ajout aux favoris d'un tiers détecté", async () => {
            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => x && x.length
            );
            expect(relations.autre!.map((r) => r.idBdCompte)).to.include(
              idBdRacine2
            );
          });

          step("Enlever favori détecté", async () => {
            await client.favoris!.désépinglerFavori(idMotClef);
            expect(relations.propres).to.be.empty;

            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => x && !x.length
            );
            expect(relations.autre).to.be.empty;
          });

          step("Ajout coauteur BD détecté", async () => {
            idBd = await client.bds!.créerBd("ODbl-1_0");
            await client.bds!.inviterAuteur(idBd, idBdRacine2, "MEMBRE");

            await attendreRésultat(
              relations,
              "propres",
              (x?: infoConfiance[]) => x && x.length
            );

            expect(relations.propres!.map((r) => r.idBdCompte)).to.include(
              idBdRacine2
            );
          });

          step("Ajout coauteur BD d'un tiers détecté", async () => {
            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => x && x.length
            );
            expect(relations.autre!.map((r) => r.idBdCompte)).to.include(
              idBdRacine2
            );
          });

          step("Enlever bd détecté", async () => {
            await client.bds!.effacerBd(idBd);

            expect(relations.propres).to.be.empty;

            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => x && !x.length
            );
            expect(relations.autre).to.be.empty;
          });

          step("Ajout coauteur projet détecté", async () => {
            idProjet = await client.projets!.créerProjet();
            await client.projets!.inviterAuteur(
              idProjet,
              idBdRacine2,
              "MEMBRE"
            );

            await attendreRésultat(
              relations,
              "propres",
              (x?: infoConfiance[]) => x && x.length
            );
            expect(relations.propres!.map((r) => r.idBdCompte)).to.include(
              idBdRacine2
            );
          });

          step("Ajout coauteur projet d'un tiers détecté", async () => {
            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => x && x.length
            );
            expect(relations.autre!.map((r) => r.idBdCompte)).to.include(
              idBdRacine2
            );
          });

          step("Enlever projet détecté", async () => {
            await client.projets!.effacerProjet(idProjet);

            expect(relations.propres).to.be.empty;

            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => x && !x.length
            );
            expect(relations.autre).to.be.empty;
          });

          step("Ajout coauteur variable détecté", async () => {
            idVariable = await client.variables!.créerVariable("numérique");
            await client.variables!.inviterAuteur(
              idVariable,
              idBdRacine2,
              "MEMBRE"
            );

            await attendreRésultat(
              relations,
              "propres",
              (x?: infoConfiance[]) => x && x.length
            );

            expect(relations.propres!.map((r) => r.idBdCompte)).to.include(
              idBdRacine2
            );
          });

          step("Ajout coauteur variable d'un tiers détecté", async () => {
            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => x && x.length
            );
            expect(relations.autre!.map((r) => r.idBdCompte)).to.include(
              idBdRacine2
            );
          });

          step("Enlever variable détecté", async () => {
            await client.variables!.effacerVariable(idVariable);

            expect(relations.propres).to.be.empty;

            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => x && !x.length
            );
            expect(relations.autre).to.be.empty;
          });

          step("Ajout coauteur mot-clef détecté", async () => {
            idMotClef = await client.motsClefs!.créerMotClef();
            await client.motsClefs!.inviterAuteur(
              idMotClef,
              idBdRacine2,
              "MEMBRE"
            );

            await attendreRésultat(
              relations,
              "propres",
              (x?: infoConfiance[]) => x && x.length
            );
            expect(relations.propres!.map((r) => r.idBdCompte)).to.include(
              idBdRacine2
            );
          });

          step("Ajout coauteur mot-clef d'un tiers détecté", async () => {
            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => x && x.length
            );
            expect(relations.autre!.map((r) => r.idBdCompte)).to.include(
              idBdRacine2
            );
          });

          step("Enlever mot-clef détecté", async () => {
            await client.motsClefs!.effacerMotClef(idMotClef);

            expect(relations.propres).to.be.empty;

            await attendreRésultat(
              relations,
              "autre",
              (x?: infoConfiance[]) => x && !x.length
            );
            expect(relations.autre).to.be.empty;
          });
        });

        describe.skip("Suivre relations confiance", async () => {});
        describe.skip("Suivre comptes réseau", async () => {});
        describe.skip("Suivre comptes réseau et en ligne", async () => {});
        describe.skip("Suivre confiance mon réseau pour membre", async () => {});

        describe("Suivre noms membre", function () {
          const rés: { ultat: { [key: string]: string } | undefined } = {
            ultat: undefined,
          };
          let fOublier: schémaFonctionOublier;

          before(async () => {
            await client.profil!.sauvegarderNom("fr", "Julien");
            fOublier = await client2.réseau!.suivreNomsMembre(
              idBdRacine1,
              (n) => (rés.ultat = n)
            );
          });

          step("Noms détectés", async () => {
            await attendreRésultat(
              rés,
              "ultat",
              (x: { [key: string]: string }) => x && x.fr
            );
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
              idBdRacine1,
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
              idBdRacine1,
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

        describe("Suivre BDs", function () {
          let idBd: string;
          let idBd2: string;

          const rés: { ultat?: string[]; ultat_2?: string[] } = {
            ultat: undefined,
            ultat_2: undefined,
          };
          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            fsOublier.push(
              await client2.réseau!.suivreBdsMembre(
                idBdRacine1,
                (bds) => (rés.ultat = bds)
              )
            );
            fsOublier.push(
              await client2.réseau!.suivreBds((bds) => (rés.ultat_2 = bds))
            );

            idBd = await client.bds!.créerBd("ODbl-1_0");
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          step("BD d'un autre membre détectée", async () => {
            /*await attendreRésultat(
              rés,
              "ultat",
              (x?: string[]) => x && x.length
            );*/
            expect(rés.ultat)
              .to.be.an("array")
              .with.lengthOf(1)
              .and.members([idBd]);
          });

          step("BDs du réseau détectées", async () => {
            idBd2 = await client2.bds!.créerBd("ODbl-1_0");
            /*await attendreRésultat(
              rés,
              "ultat_2",
              (x?: string[]) => x && x.length === 2
            );*/
            expect(rés.ultat_2)
              .to.be.an("array")
              .with.lengthOf(2)
              .and.members([idBd, idBd2]);
          });
        });

        describe("Suivre réplications", function () {
          let idBd: string;

          const rés: { ultat?: infoRéplication[] } = {
            ultat: undefined,
          };
          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            idBd = await client.bds!.créerBd("ODbl-1_0");
            fsOublier.push(
              await client.réseau!.suivreRéplications(
                idBd,
                (bds) => (rés.ultat = bds)
              )
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          step("Auteur de la BD pour commencer", async () => {
            await client.favoris!.épinglerFavori(idBd, "TOUS");
            /*await attendreRésultat(
              rés,
              "ultat",
              (x?: infoRéplication[]) => x && x.length
            );*/
            expect(rés.ultat).to.be.an("array").with.lengthOf(1);
            expect(rés.ultat!.map((r) => r.idOrbite)).to.have.members([
              idOrbite1,
            ]);
          });

          step("Ajout d'une réplication détectée", async () => {
            await client2.favoris!.épinglerFavori(idBd, "TOUS");

            /*await attendreRésultat(
              rés,
              "ultat",
              (x?: infoRéplication[]) => x && x.length === 2
            );*/
            expect(rés.ultat).to.be.an("array").with.lengthOf(2);
            expect(rés.ultat!.map((r) => r.idOrbite)).to.have.members([
              idOrbite1,
              idOrbite2,
            ]);
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
              await client.réseau!.suivreBdsDeMotClefUnique(
                motClef,
                (bds) => (rés.ultat = bds)
              )
            );
            fsOublier.push(
              await client.réseau!.suivreÉlémentsDeTableauxUniques(
                motClef,
                idUniqueTableau,
                (éléments) => (rés.ultat2 = éléments)
              )
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
                  idBdAuteur: idBdRacine1,
                  élément: {
                    empreinte: empreinte1,
                    données: données1,
                  },
                },
                {
                  idBdAuteur: idBdRacine1,
                  élément: {
                    empreinte: empreinte2,
                    données: données2,
                  },
                },
                {
                  idBdAuteur: idBdRacine2,
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
