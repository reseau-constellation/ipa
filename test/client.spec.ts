import toBuffer from "it-to-buffer";

import { OrbitDB, isValidAddress } from "@orbitdb/core";

import {
  faisRien,
  suivreBdDeFonction,
  suivreBdsDeFonctionListe,
} from "@constl/utils-ipa";

import {
  attente,
  dossiers,
  orbite,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";

import { isElectronMain, isNode } from "wherearewe";

import { expect } from "aegir/chai";

import { TypedKeyValue } from "@constl/bohr-db";
import { JSONSchemaType } from "ajv";
import { statutDispositif } from "@/reseau.js";
import { créerConstellation } from "@/index.js";
import { MEMBRE, MODÉRATEUR } from "@/accès/consts.js";
import { schémaFonctionOublier, schémaFonctionSuivi } from "@/types.js";
import { Constellation, infoAccès } from "@/client.js";
import { générerClientsInternes } from "./ressources/utils.js";
import type { OptionsContrôleurConstellation } from "@/accès/cntrlConstellation.js";

const { créerConstellationsTest } = utilsTestConstellation;

const schémaKVNumérique: JSONSchemaType<{ [clef: string]: number }> = {
  type: "object",
  additionalProperties: {
    type: "number",
  },
  required: [],
};

const schémaKVChaîne: JSONSchemaType<{ [clef: string]: string }> = {
  type: "object",
  additionalProperties: {
    type: "string",
  },
  required: [],
};

const schémaListeNumérique: JSONSchemaType<number> = { type: "number" };
const schémaListeChaîne: JSONSchemaType<string> = { type: "string" };

describe("Fermeture sécuritaire", function () {
  let dossier: string;
  let fEffacer: () => void;

  before(async () => {
    ({ dossier, fEffacer } = await dossiers.dossierTempo());
  });

  after(async () => {
    fEffacer?.();
  });

  it("Fermeture immédiatement après ouverture", async function () {
    if (!isNode || process.platform === "win32") this.skip(); // Pour l'instant

    const client = créerConstellation({
      dossier,
    });
    await client.fermer();
  });
});

if (isNode || isElectronMain) {
  describe("Contrôle dispositifs", function () {
    let fOublierClients: () => Promise<void>;
    let orbites: OrbitDB[];
    let orbite2: OrbitDB, orbite3: OrbitDB;
    let clients: Constellation[];
    let client: Constellation,
      client2: Constellation,
      client3: Constellation,
      client4: Constellation;

    let fOublierDispositifs: schémaFonctionOublier;
    let fOublierIdCompte: schémaFonctionOublier;

    let idDispositif1: string;
    let idDispositif2: string;
    let idDispositif3: string;

    let idCompte1: string;
    let idCompte2: string;

    const idClient2EnDirecte = new attente.AttendreRésultat<string>();

    const mesDispositifs = new attente.AttendreRésultat<string[]>();

    before(async () => {
      ({
        fOublier: fOublierClients,
        clients,
        orbites,
      } = await créerConstellationsTest({
        n: 4,
        créerConstellation,
      }));
      [client, client2, client3, client4] = clients;
      orbite2 = orbites[1];
      orbite3 = orbites[2];

      idCompte1 = await client.obtIdCompte();
      idCompte2 = await client2.obtIdCompte();

      idDispositif1 = await client.obtIdDispositif();
      idDispositif2 = await client2.obtIdDispositif();
      idDispositif3 = await client3.obtIdDispositif();

      fOublierDispositifs = await client.suivreDispositifs({
        f: (dispositifs) => mesDispositifs.mettreÀJour(dispositifs),
      });
      fOublierIdCompte = await client2.suivreIdCompte({
        f: (id) => idClient2EnDirecte.mettreÀJour(id),
      });
    });

    after(async () => {
      idClient2EnDirecte.toutAnnuler();
      mesDispositifs.toutAnnuler();

      if (fOublierDispositifs) await fOublierDispositifs();
      if (fOublierIdCompte) await fOublierIdCompte();
      if (fOublierClients) await fOublierClients();
    });

    describe("Initiale", function () {
      it("Mon dispositif est présent", async () => {
        const val = await mesDispositifs.attendreExiste();
        expect(val).to.have.members([idDispositif1]);
      });
    });

    describe("Ajouter dispositif manuellement", function () {
      let idBd: string;

      const fsOublier: schémaFonctionOublier[] = [];
      const résNom = new attente.AttendreRésultat<{
        [lng: string]: string;
      }>();

      before(async () => {
        fsOublier.push(
          await client2.profil.suivreNoms({
            f: (noms) => résNom.mettreÀJour(noms),
          }),
        );

        await client.profil.sauvegarderNom({
          nom: "Julien Malard-Adam",
          langue: "fr",
        });

        await client.ajouterDispositif({ idDispositif: idDispositif2 });
        await client2.rejoindreCompte({ idCompte: idCompte1 });
        idBd = await client.créerBdIndépendante({ type: "keyvalue" });
      });

      after(async () => {
        résNom.toutAnnuler();
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("Mes dispositifs sont mis à jour", async () => {
        const val = await mesDispositifs.attendreQue((x) => x.length > 1);
        expect(val).to.have.members([idDispositif1, idDispositif2]);
      });

      it("Le nouveau dispositif a rejoint notre compte", async () => {
        const nouvelIdCompte2 = await idClient2EnDirecte.attendreQue(
          (x) => x !== idCompte2,
        );
        expect(nouvelIdCompte2).to.equal(idCompte1);
      });

      it("idDispositif ne change pas", async () => {
        const idDispositifClient2Après = await client2.obtIdDispositif();
        expect(idDispositifClient2Après).to.equal(idDispositif2);
      });

      it("Le nouveau dispositif peut modifier mes BDs", async () => {
        const { bd: bd_orbite2, fOublier } = await client2.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });
        fsOublier.push(fOublier);
        const autorisé = await orbite.peutÉcrire(bd_orbite2, orbite2);
        expect(autorisé).to.be.true();
      });

      it("Le nouveau dispositif suit mon profil", async () => {
        // Pour une drôle de raison, il faut accéder la BD avant qu'elle ne s'actualise...
        await client.profil.effacerNom({ langue: "de" });

        const val = await résNom.attendreQue((x) =>
          Object.keys(x).includes("fr"),
        );
        expect(val.fr).to.equal("Julien Malard-Adam");
      });
    });

    describe("Automatiser ajout dispositif", function () {
      let idBd: string;

      const attendreConnectés = new attente.AttendreRésultat<
        statutDispositif[]
      >();
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        const fOublierConnexions =
          await client3.réseau.suivreConnexionsDispositifs({
            f: (x) => attendreConnectés.mettreÀJour(x),
          });
        fsOublier.push(fOublierConnexions);

        idBd = await client.créerBdIndépendante({ type: "keyvalue" });
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("Nouveau dispositif ajouté au compte", async () => {
        const invitation = await client.générerInvitationRejoindreCompte();

        client4.demanderEtPuisRejoindreCompte({
          idCompte: invitation.idCompte,
          codeSecret: "code secret invalid:",
        });
        await client3.demanderEtPuisRejoindreCompte(invitation);

        const val = await mesDispositifs.attendreQue((x) => x.length > 2);
        expect(val).to.have.members([
          idDispositif1,
          idDispositif2,
          idDispositif3,
        ]);
      });

      it("Nouveau dispositif indique le nouveau compte", async () => {
        const idCompte3 = await client3.obtIdCompte();
        expect(idCompte3).to.equal(idCompte1);
      });

      it("Le nouveau dispositif peut modifier mes BDs", async () => {
        const { bd: bd_orbite3, fOublier } = await client3.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });
        const autorisé = await orbite.peutÉcrire(bd_orbite3, orbite3);
        await fOublier();
        expect(autorisé).to.be.true();
      });
    });
  });

  describe("Concurrence", function () {
    describe("Différents dossiers", async () => {
      let constl1: Constellation;
      let constl2: Constellation;

      let dossier1: string;
      let fEffacer1: () => void;
      let dossier2: string;
      let fEffacer2: () => void;

      before(async () => {
        ({ dossier: dossier1, fEffacer: fEffacer1 } =
          await dossiers.dossierTempo());
        ({ dossier: dossier2, fEffacer: fEffacer2 } =
          await dossiers.dossierTempo());
        constl1 = créerConstellation({ dossier: dossier1 });
      });

      after(async () => {
        await constl1?.fermer();
        await constl2?.fermer();
        try {
          fEffacer1?.();
          fEffacer2?.();
        } catch (e) {
          if ((isNode || isElectronMain) && process.platform === "win32") {
            console.log("On ignore ça sur Windows\n", e);
            return;
          } else {
            throw e;
          }
        }
      });

      it("Création de la deuxième instance", async () => {
        const constl2 = créerConstellation({ dossier: dossier2 });
        const idCompte1 = await constl1.obtIdCompte();
        const idCompte2 = await constl2.obtIdCompte();

        expect(idCompte1).to.be.a("string");
        expect(idCompte2).to.be.a("string");
        expect(idCompte1).to.not.equal(idCompte2);
      });
    });
    describe("Même dossier", async () => {
      let constl1: Constellation;

      let dossier: string;
      let fEffacer: () => void;

      before(async () => {
        ({ dossier, fEffacer } = await dossiers.dossierTempo());
        constl1 = créerConstellation({ dossier });
      });

      after(async () => {
        await constl1.fermer();
        try {
          fEffacer?.();
        } catch (e) {
          if ((isNode || isElectronMain) && process.platform === "win32") {
            console.log("On ignore ça sur Windows\n", e);
            return;
          } else {
            throw e;
          }
        }
      });

      it("Erreur pour la deuxième instance", async () => {
        const constl2 = créerConstellation({ dossier });
        await expect(constl2.obtIdCompte()).to.be.rejectedWith(
          "Constellation est déjà lancée.",
        );
      });
    });

    describe.skip("Même dossier - serveur local", async () => {
      let fermerServeur: schémaFonctionOublier;
      let port: number;

      let dossier: string;
      let fEffacer: () => void;

      before(async () => {
        /*const {lancerServeur} = await import("@constl/serveur");
        ({ dossier, fEffacer } = await dossiers.dossierTempo());
        ({fermerServeur, port} = await lancerServeur({ optsConstellation: { dossier }}));
        */
      });

      after(async () => {
        await fermerServeur();
        try {
          fEffacer?.();
        } catch (e) {
          if ((isNode || isElectronMain) && process.platform === "win32") {
            console.log("On ignore ça sur Windows\n", e);
            return;
          } else {
            throw e;
          }
        }
      });

      it("Erreur pour la deuxième instance, avec port disponible", async () => {
        const constl2 = créerConstellation({ dossier });
        await expect(constl2.obtIdCompte()).to.be.rejectedWith(
          `Ce compte est déjà lancé, et le serveur local est disponible sur le port ${port}.`,
        );
        await fermerServeur();
      });
    });
  });

  describe("Fonctionalités client", function () {
    let fOublierClients: () => Promise<void>;
    let clients: Constellation[];
    let client: Constellation, client2: Constellation;

    let idCompte2: string;

    before(async () => {
      ({ fOublier: fOublierClients, clients } = await générerClientsInternes({
        n: 2,
      }));
      [client, client2] = clients;

      idCompte2 = await client2.obtIdCompte();
    });

    after(async () => {
      if (fOublierClients) await fOublierClients();
    });

    describe("Signer", function () {
      it("La signature devrait être valide", async () => {
        const message = "Je suis un message";
        const signature = await client.signer({ message });
        const valide = await client.vérifierSignature({ signature, message });
        expect(valide).to.be.true();
      });
      it("La signature ne devrait pas être valide pour un autre message", async () => {
        const message = "Je suis un message";
        const autreMessage = "Je suis un message!";
        const signature = await client.signer({ message });
        const valide = await client.vérifierSignature({
          signature,
          message: autreMessage,
        });
        expect(valide).to.be.false();
      });
    });

    describe("Suivre protocoles", function () {
      it.skip("Suivre protocoles compte");
    });

    describe("Dispositif", function () {
      it("Détecter type dispositif", async () => {
        const typeDispositif = client.détecterTypeDispositif();
        if (isElectronMain) expect(typeDispositif).to.eq("ordinateur");
        else if (isNode) expect(typeDispositif).to.eq("serveur");
        else expect(typeDispositif).to.eq("navigateur");
      });
    });

    describe("Suivre BD", function () {
      let idBd: string;
      let fOublier: schémaFonctionOublier;
      let bd: TypedKeyValue<{ [clef: string]: number }>;
      let fOublierBd: schémaFonctionOublier;

      const attendreDonnées = new attente.AttendreRésultat<{
        [key: string]: number | undefined;
      }>();

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "keyvalue" });
        const { orbite } = await client.attendreSfipEtOrbite();
        ({ bd, fOublier: fOublierBd } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        }));
        await bd.put("a", 1);
        const fSuivre = async (
          _bd: TypedKeyValue<{ [clef: string]: number }>,
        ) => {
          const d = await _bd.allAsJSON();
          attendreDonnées.mettreÀJour(d);
        };
        const fOublierSuivre = await client.suivreBd({
          id: idBd,
          f: fSuivre,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });
        fOublier = async () => {
          await fOublierBd();
          await fOublierSuivre();
        };
      });

      after(async () => {
        await fOublier();
      });

      it("Les données initiales sont détectées", async () => {
        const données = await attendreDonnées.attendreQue((x) => !!x["a"]);
        expect(données.a).to.equal(1);
      });

      it("Les changements sont détectés", async () => {
        await bd.put("b", 2);

        const données = await attendreDonnées.attendreQue((x) => !!x["b"]);
        expect(données.b).to.equal(2);
      });
    });

    describe("Suivre BD de fonction", function () {
      let idBd: string;
      let idBd2: string;
      let bd: TypedKeyValue<{ [clef: string]: number }>;
      let bd2: TypedKeyValue<{ [clef: string]: number }>;
      let fOublierBd: schémaFonctionOublier;
      let fOublierBd2: schémaFonctionOublier;
      let fSuivre: (id: string) => Promise<void>;
      let fOublier: schémaFonctionOublier;

      const données = new attente.AttendreRésultat<{
        [key: string]: number;
      }>();

      const changerBd = async (id: string) => {
        await fSuivre(id);
      };
      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "keyvalue" });
        idBd2 = await client.créerBdIndépendante({ type: "keyvalue" });
        const { orbite } = await client.attendreSfipEtOrbite();

        ({ bd, fOublier: fOublierBd } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        }));
        ({ bd: bd2, fOublier: fOublierBd2 } = await orbite.ouvrirBdTypée({
          id: idBd2,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        }));
        const fRacine = async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (nouvelIdBdCible: string) => Promise<void>;
        }): Promise<schémaFonctionOublier> => {
          fSuivre = fSuivreRacine;
          return faisRien;
        };
        const f = (valeurs?: { [key: string]: number }) => {
          données.mettreÀJour(valeurs);
        };
        const fSuivre_ = async ({
          id,
          fSuivreBd,
        }: {
          id: string;
          fSuivreBd: schémaFonctionSuivi<{ [key: string]: number }>;
        }): Promise<schémaFonctionOublier> => {
          return await client.suivreBdDic({
            id,
            f: fSuivreBd,
            schéma: schémaKVNumérique,
          });
        };
        const fOublierSuivre = await suivreBdDeFonction({
          fRacine,
          f,
          fSuivre: fSuivre_,
        });
        fOublier = async () => {
          await fOublierSuivre();
          await fOublierBd();
          await fOublierBd2();
        };
      });
      after(async () => {
        if (bd) await bd.close();
        if (bd2) await bd2.close();
        if (fOublier) await fOublier();
        données.toutAnnuler();
      });
      it("`undefined` est retourné si la fonction ne renvoie pas de BD", async () => {
        expect(données.val).to.be.undefined();
      });
      it("Les changements à la BD suivie sont détectés", async () => {
        await changerBd(idBd);
        await bd.put("a", 1);

        const val = await données.attendreQue((x) => !!x["a"]);
        expect(val.a).to.equal(1);
      });
      it("Les changements à l'id de la BD suivie sont détectés", async () => {
        await bd2.put("a", 2);
        await changerBd(idBd2);

        const val = await données.attendreQue((x) => x.a !== 1);
        expect(val.a).to.equal(2);
      });
    });

    describe("Suivre BD de clef", function () {
      let idBdBase: string;
      let bdBase: TypedKeyValue<{ [clef: string]: string }>;
      let idBd: string | undefined;

      const données = new attente.AttendreRésultat<{
        [key: string]: number;
      }>();

      const CLEF = "clef";
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBdBase = await client.créerBdIndépendante({ type: "keyvalue" });
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd: bd_, fOublier } = await orbite.ouvrirBdTypée({
          id: idBdBase,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });
        bdBase = bd_;
        fsOublier.push(fOublier);

        const f = (valeurs: { [key: string]: number } | undefined) => {
          données.mettreÀJour(valeurs);
        };
        const fSuivre = async ({
          id,
          fSuivreBd,
        }: {
          id: string;
          fSuivreBd: schémaFonctionSuivi<{ [key: string]: number }>;
        }): Promise<schémaFonctionOublier> => {
          return await client.suivreBdDic({
            id,
            f: fSuivreBd,
            schéma: schémaKVNumérique,
          });
        };
        fsOublier.push(
          await client.suivreBdDeClef({ id: idBdBase, clef: CLEF, f, fSuivre }),
        );
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        données.toutAnnuler();
      });

      it("`undefined` est retourné si la clef n'existe pas", async () => {
        expect(données.val).to.be.undefined();
      });

      it("Les changements à la BD suivie sont détectés", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        idBd = await client.obtIdBd({
          nom: CLEF,
          racine: idBdBase,
          type: "keyvalue",
        });
        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd!,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });
        fsOublier.push(fOublier);

        await bd.put("a", 1);
        const val = await données.attendreQue((x) => !!x["a"]);
        expect(val.a).to.equal(1);
      });

      it("Les changements à la clef sont détectés", async () => {
        const idBd2 = await client.créerBdIndépendante({ type: "keyvalue" });
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd2,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });
        fsOublier.push(fOublier);

        await bd.put("a", 2);
        await bdBase.put(CLEF, idBd2);
        const val = await données.attendreQue((x) => x.a !== 1);
        expect(val.a).to.equal(2);
      });
    });

    describe("Suivre BD dic de clef", function () {
      let idBdBase: string;
      let idBd: string;

      const CLEF = "clef";
      const données = new attente.AttendreRésultat<{
        [key: string]: number;
      }>();
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBdBase = await client.créerBdIndépendante({ type: "keyvalue" });

        idBd = await client.créerBdIndépendante({ type: "keyvalue" });

        const fSuivre = (d: { [key: string]: number }) =>
          données.mettreÀJour(d);
        await client.suivreBdDicDeClef({
          id: idBdBase,
          clef: CLEF,
          schéma: { type: "object", additionalProperties: true, required: [] },
          f: fSuivre,
        });
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        données.toutAnnuler();
      });

      it("`{}` est retourné si la clef n'existe pas", async () => {
        const val = await données.attendreExiste();
        expect(val).to.be.an.empty("object");
      });

      it("Les données sont retournés en format objet", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd: bdBase, fOublier: fOublierBase } =
          await orbite.ouvrirBdTypée({
            id: idBdBase,
            type: "keyvalue",
            schéma: schémaKVChaîne,
          });
        fsOublier.push(fOublierBase);
        await bdBase.put(CLEF, idBd);

        const val1 = await données.attendreExiste();
        expect(Object.keys(val1).length).to.equal(0);

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });
        fsOublier.push(fOublier);
        await bd.put("a", 1);
        const val2 = await données.attendreQue(
          (x) => Object.keys(x).length > 0,
        );
        expect(val2.a).to.equal(1);
      });
    });

    describe("Suivre BD liste de clef", function () {
      let idBdBase: string;
      let idBd: string;

      const CLEF = "clef";
      const données = new attente.AttendreRésultat<
        { value: number; hash: string }[]
      >();
      const donnéesValeur = new attente.AttendreRésultat<number[]>();
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBdBase = await client.créerBdIndépendante({ type: "keyvalue" });

        idBd = await client.créerBdIndépendante({ type: "set" });

        const fSuivreValeur = (d: number[]) => donnéesValeur.mettreÀJour(d);
        const fSuivre = (d: { value: number; hash: string }[]) =>
          données.mettreÀJour(d);
        await client.suivreBdListeDeClef({
          id: idBdBase,
          clef: CLEF,
          f: fSuivreValeur,
          schéma: schémaListeNumérique,
          renvoyerValeur: true,
        });
        await client.suivreBdListeDeClef({
          id: idBdBase,
          clef: CLEF,
          f: fSuivre,
          schéma: schémaListeNumérique,
          renvoyerValeur: false,
        });
      });
      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        donnéesValeur.toutAnnuler();
        données.toutAnnuler();
      });
      it("`[]` est retourné si la clef n'existe pas", async () => {
        const val = await donnéesValeur.attendreExiste();
        expect(val).to.be.an.empty("array");

        const valDonnées = await données.attendreExiste();
        expect(valDonnées).to.be.an.empty("array");
      });
      it("Avec renvoyer valeur", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd: bdBase, fOublier: fOublierBase } =
          await orbite.ouvrirBdTypée({
            id: idBdBase,
            type: "keyvalue",
            schéma: schémaKVChaîne,
          });
        fsOublier.push(fOublierBase);

        await bdBase.put(CLEF, idBd);
        let val = await donnéesValeur.attendreExiste();
        expect(val.length).to.equal(0);

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "set",
          schéma: schémaListeNumérique,
        });
        fsOublier.push(fOublier);

        await bd.add(1);
        await bd.add(2);

        val = await donnéesValeur.attendreQue((x) => x.length > 1);
        expect(val).to.have.members([1, 2]);
      });
      it("Sans renvoyer valeur", async () => {
        const val = await données.attendreQue((x) => x.length > 1);

        expect(val.length).to.equal(2);
        expect(val.map((d) => d.value)).to.have.members([1, 2]);
      });
    });

    describe("Suivre BD liste", function () {
      let idBd: string;
      const attenteDonnéesValeur = new attente.AttendreRésultat<number[]>();
      const attenteDonnées = new attente.AttendreRésultat<
        { value: number; hash: string }[]
      >();

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "set" });

        const fSuivreValeur = (d: number[]) =>
          attenteDonnéesValeur.mettreÀJour(d);
        const fSuivre = (d: { value: number; hash: string }[]) =>
          attenteDonnées.mettreÀJour(d);
        fsOublier.push(
          await client.suivreBdListe({
            id: idBd,
            f: fSuivreValeur,
            schéma: schémaListeNumérique,
            renvoyerValeur: true,
          }),
        );
        fsOublier.push(
          await client.suivreBdListe({
            id: idBd,
            f: fSuivre,
            schéma: schémaListeNumérique,
            renvoyerValeur: false,
          }),
        );
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        attenteDonnées.toutAnnuler();
        attenteDonnéesValeur.toutAnnuler();
      });

      it("Avec renvoyer valeur", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        let donnéesValeur = await attenteDonnéesValeur.attendreExiste();
        expect(donnéesValeur.length).to.equal(0);

        const { bd, fOublier } = await orbite.ouvrirBd({
          id: idBd,
          type: "set",
        });
        fsOublier.push(fOublier);

        await bd.add(1);
        await bd.add(2);

        donnéesValeur = await attenteDonnéesValeur.attendreQue(
          (x) => x.length > 1,
        );
        expect(donnéesValeur).to.have.members([1, 2]);
      });

      it("Sans renvoyer valeur", async () => {
        const données = await attenteDonnées.attendreQue((x) => x.length > 1);

        expect(données.length).to.equal(2);
        expect(données.map((d) => d.value)).to.have.members([1, 2]);
      });
    });

    describe("Suivre BDs récursives", function () {
      let idBd: string;
      let idBdListe: string;
      let idBd2: string;
      let fOublier: schémaFonctionOublier;

      const rés = new attente.AttendreRésultat<string[]>();

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "keyvalue" });
        idBdListe = await client.créerBdIndépendante({ type: "set" });
        idBd2 = await client.créerBdIndépendante({ type: "set" });

        fOublier = await client.suivreBdsRécursives({
          idBd,
          f: (ids) => rés.mettreÀJour(ids),
        });
      });

      after(async () => {
        if (fOublier) await fOublier();
        rés.toutAnnuler();
      });

      it("Ajout idBd", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });
        await bd.set("clef", idBd2);
        await fOublier();

        const val = await rés.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.have.members([idBd, idBd2]);
      });

      it("Enlever idBd", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });
        await bd.del("clef");
        await fOublier();

        const val = await rés.attendreQue((x) => !!x && x.length === 1);
        expect(val).to.have.members([idBd]);
      });

      it("Ajout récursif", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });
        await bd.set("clef", idBdListe);
        await fOublier();

        const { bd: bdListe, fOublier: fOublierBdListe } =
          await orbite.ouvrirBd({
            id: idBdListe,
            type: "set",
          });
        await bdListe.add(idBd2);
        fOublierBdListe();

        const val = await rés.attendreQue((x) => !!x && x.length === 3);
        expect(val).to.have.members([idBd, idBdListe, idBd2]);
      });

      it("Enlever récursif", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd: bdListe, fOublier: fOublierBdListe } =
          await orbite.ouvrirBdTypée({
            id: idBdListe,
            type: "set",
            schéma: schémaListeChaîne,
          });
        await bdListe.del(idBd2);
        fOublierBdListe();

        const val = await rés.attendreQue((x) => !!x && x.length === 2);
        expect(val).to.have.members([idBd, idBdListe]);
      });

      it("Ajouter dictionnaire à liste", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd: bdListe, fOublier: fOublierBdListe } =
          await orbite.ouvrirBd({
            id: idBdListe,
            type: "set",
          });
        await bdListe.add({ maBd: idBd2 });
        fOublierBdListe();

        const val = await rés.attendreQue((x) => !!x && x.length === 3);
        expect(val).to.have.members([idBd, idBdListe, idBd2]);
      });

      it("Enlever dictionnaire de liste", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const schémaListe: JSONSchemaType<string | { [clef: string]: string }> =
          {
            anyOf: [
              {
                type: "string",
              },
              {
                type: "object",
                additionalProperties: {
                  type: "string",
                },
                required: [],
              },
            ],
          };
        const { bd: bdListe, fOublier: fOublierBdListe } =
          await orbite.ouvrirBdTypée({
            id: idBdListe,
            type: "set",
            schéma: schémaListe,
          });
        (await bdListe.all()).find((x) => x.value);
        await bdListe.del(
          (await bdListe.all()).find(
            (x) => typeof x.value !== "string" && x.value.maBd === idBd2,
          )!.value,
        );
        fOublierBdListe();

        const val = await rés.attendreQue((x) => !!x && x.length === 2);
        expect(val).to.have.members([idBd, idBdListe]);
      });

      it("Ajout clef dictionnaire", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });
        await bd.set(idBd2, "je suis là !");
        await fOublier();

        const val = await rés.attendreQue((x) => !!x && x.length > 2);
        expect(val).to.have.members([idBd, idBd2, idBdListe]);
      });

      it("Enlever clef dictionnaire", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });
        await bd.del(idBd2);
        await fOublier();

        const val = await rés.attendreQue((x) => !!x && x.length <= 2);
        expect(val).to.have.members([idBd, idBdListe]);
      });
    });

    describe("Suivre empreinte têtes", function () {
      let idBd: string;
      let idBdListe: string;
      let idBd2: string;
      let fOublier: schémaFonctionOublier;

      const rés = new attente.AttendreRésultat<string>();

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "keyvalue" });
        idBdListe = await client.créerBdIndépendante({ type: "set" });
        idBd2 = await client.créerBdIndépendante({ type: "set" });

        fOublier = await client.suivreEmpreinteTêtesBdRécursive({
          idBd,
          f: (empr) => rés.mettreÀJour(empr),
        });
      });

      after(async () => {
        if (fOublier) await fOublier();
        rés.toutAnnuler();
      });

      it("Ajout élément", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const empreinteAvant = await rés.attendreExiste();

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });
        await bd.set("clef", idBd2);
        await fOublier();

        await rés.attendreQue((x) => !!x && x !== empreinteAvant);
      });

      it("Enlever élément", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const empreinteAvant = await rés.attendreExiste();

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });
        await bd.del("clef");
        await fOublier();

        await rés.attendreQue((x) => !!x && x !== empreinteAvant);
      });

      it("Ajout récursif", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });
        await bd.set("clef", idBdListe);
        await fOublier();

        const empreinteDébut = await rés.attendreExiste();

        const { bd: bdListe, fOublier: fOublierBdListe } =
          await orbite.ouvrirBdTypée({
            id: idBdListe,
            type: "set",
            schéma: schémaListeChaîne,
          });
        await bdListe.add(idBd2);
        fOublierBdListe();

        const empreinteAvant = await rés.attendreQue(
          (x) => !!x && x !== empreinteDébut,
        );

        const { bd: bd2, fOublier: fOublierBd2 } = await orbite.ouvrirBdTypée({
          id: idBd2,
          type: "set",
          schéma: schémaListeChaîne,
        });
        await bd2.add("abc");
        fOublierBd2();

        await rés.attendreQue((x) => !!x && x !== empreinteAvant);
      });

      it("Enlever récursif", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const empreinteAvant = await rés.attendreExiste();

        const { bd: bdListe, fOublier: fOublierBdListe } =
          await orbite.ouvrirBdTypée({
            id: idBdListe,
            type: "set",
            schéma: schémaListeChaîne,
          });
        await bdListe.del(idBd2);
        fOublierBdListe();

        await rés.attendreQue((x) => !!x && x !== empreinteAvant);
      });
    });

    describe("Suivre BDs de BD liste", function () {
      let idBdListe: string;
      let idBd1: string;
      let idBd2: string;

      type branche = { [key: string]: number | undefined };

      const attenteDonnées = new attente.AttendreRésultat<branche[]>();
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        idBdListe = await client.créerBdIndépendante({ type: "set" });
        const { bd: bdListe, fOublier } = await orbite.ouvrirBdTypée({
          id: idBdListe,
          type: "set",
          schéma: schémaListeChaîne,
        });
        fsOublier.push(fOublier);

        const fBranche = async (
          id: string,
          f: schémaFonctionSuivi<branche>,
        ) => {
          return await client.suivreBd({
            id,
            type: "keyvalue",
            schéma: schémaKVNumérique,
            f: async (_bd) => f(await _bd.allAsJSON()),
          });
        };
        const fSuivi = (x: branche[]) => {
          attenteDonnées.mettreÀJour(x);
        };
        fsOublier.push(
          await client.suivreBdsDeBdListe({
            id: idBdListe,
            f: fSuivi,
            fBranche,
          }),
        );

        idBd1 = await client.créerBdIndépendante({ type: "keyvalue" });
        idBd2 = await client.créerBdIndépendante({ type: "keyvalue" });

        const { bd: bd1, fOublier: fOublier1 } = await orbite.ouvrirBdTypée({
          id: idBd1,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });
        fsOublier.push(fOublier1);
        const { bd: bd2, fOublier: fOublier2 } = await orbite.ouvrirBdTypée({
          id: idBd2,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });
        fsOublier.push(fOublier2);

        await bd1.put("a", 1);
        await bd2.put("b", 2);

        await bdListe.add(idBd1);
        await bdListe.add(idBd2);
      });
      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        attenteDonnées.toutAnnuler();
      });
      it("Les éléments sont retournés", async () => {
        const données = await attenteDonnées.attendreQue((x) => x.length > 1);
        expect(Array.isArray(données)).to.be.true();
        expect(données).to.have.deep.members([{ a: 1 }, { b: 2 }]);
      });
    });

    describe("Suivre BDs de fonction", function () {
      describe("De liste ids BDs", function () {
        let fSuivre: (ids: string[]) => Promise<void>;
        let idBd1: string;
        let idBd2: string;

        const attendre = new attente.AttendreRésultat<number[]>();
        const fsOublier: schémaFonctionOublier[] = [];

        const changerBds = async (ids: string[]) => {
          await fSuivre(ids);
        };

        before(async () => {
          const { orbite } = await client.attendreSfipEtOrbite();

          idBd1 = await client.créerBdIndépendante({ type: "keyvalue" });
          idBd2 = await client.créerBdIndépendante({ type: "keyvalue" });
          const { bd: bd1, fOublier: fOublier1 } = await orbite.ouvrirBdTypée({
            id: idBd1,
            type: "keyvalue",
            schéma: schémaKVNumérique,
          });
          fsOublier.push(fOublier1);
          const { bd: bd2, fOublier: fOublier2 } = await orbite.ouvrirBdTypée({
            id: idBd2,
            type: "keyvalue",
            schéma: schémaKVNumérique,
          });
          fsOublier.push(fOublier2);

          await bd1.put("a", 1);
          await bd1.put("b", 2);
          await bd2.put("c", 3);

          const fListe = async (
            fSuivreRacine: (éléments: string[]) => Promise<void>,
          ): Promise<schémaFonctionOublier> => {
            fSuivre = fSuivreRacine;
            return faisRien;
          };
          const f = (x: number[]) => attendre.mettreÀJour(x);
          const fBranche = async (
            id: string,
            f: schémaFonctionSuivi<number[]>,
          ): Promise<schémaFonctionOublier> => {
            return await client.suivreBd({
              id,
              type: "keyvalue",
              schéma: schémaKVNumérique,
              f: async (bd) => {
                const vals: number[] = Object.values(await bd.allAsJSON());
                await f(vals);
              },
            });
          };
          fsOublier.push(
            await suivreBdsDeFonctionListe({ fListe, f, fBranche }),
          );
        });
        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          attendre.toutAnnuler();
        });

        it("Sans branches", async () => {
          expect(attendre.val).to.be.undefined();
        });
        it("Ajout d'une branche ou deux", async () => {
          await changerBds([idBd1, idBd2]);

          const résultats = await attendre.attendreQue((x) => x.length > 2);
          expect(Array.isArray(résultats)).to.be.true();
          expect(résultats.length).to.equal(3);
          expect(résultats).to.have.members([1, 2, 3]);
        });
        it("Enlever une branche", async () => {
          await changerBds([idBd1]);

          const résultats = await attendre.attendreQue((x) => x.length < 3);
          expect(Array.isArray(résultats)).to.be.true();
          expect(résultats.length).to.equal(2);
          expect(résultats).to.have.members([1, 2]);
        });
      });

      describe("Avec branches complexes", function () {
        type branche = {
          nom: string;
          id: string;
        };
        let fSuivre: (ids: branche[]) => Promise<void>;

        let idBd1: string;
        let idBd2: string;

        const attendre = new attente.AttendreRésultat<number[]>();
        const fsOublier: schémaFonctionOublier[] = [];

        const fListe = async (
          fSuivreRacine: (éléments: branche[]) => Promise<void>,
        ): Promise<schémaFonctionOublier> => {
          fSuivre = fSuivreRacine;
          return faisRien;
        };
        const f = (x: number[]) => attendre.mettreÀJour(x);
        const fBranche = async (
          id: string,
          f: schémaFonctionSuivi<number[]>,
        ): Promise<schémaFonctionOublier> => {
          return await client.suivreBd({
            id,
            type: "keyvalue",
            schéma: schémaKVNumérique,
            f: async (bd) => {
              const vals: number[] = Object.values(await bd.allAsJSON());
              return await f(vals);
            },
          });
        };

        const fIdBdDeBranche = (x: branche) => x.id;
        const fCode = (x: branche) => x.id;

        const changerBds = async (ids: string[]) => {
          await fSuivre(
            ids.map((id) => {
              return { nom: "abc", id: id };
            }),
          );
        };
        before(async () => {
          const { orbite } = await client.attendreSfipEtOrbite();

          idBd1 = await client.créerBdIndépendante({ type: "keyvalue" });
          idBd2 = await client.créerBdIndépendante({ type: "keyvalue" });

          const { bd: bd1, fOublier: fOublier1 } = await orbite.ouvrirBdTypée({
            id: idBd1,
            type: "keyvalue",
            schéma: schémaKVNumérique,
          });
          fsOublier.push(fOublier1);
          const { bd: bd2, fOublier: fOublier2 } = await orbite.ouvrirBdTypée({
            id: idBd2,
            type: "keyvalue",
            schéma: schémaKVNumérique,
          });
          fsOublier.push(fOublier2);

          await bd1.put("a", 1);
          await bd1.put("b", 2);
          await bd2.put("c", 3);

          fsOublier.push(
            await suivreBdsDeFonctionListe({
              fListe,
              f,
              fBranche,
              fIdBdDeBranche,
              fCode,
            }),
          );
          await changerBds([idBd1, idBd2]);
        });
        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
          attendre.toutAnnuler();
        });

        it("Ajout d'une branche ou deux", async () => {
          const résultats = await attendre.attendreQue((x) => x.length > 2);
          expect(Array.isArray(résultats)).to.be.true();
          expect(résultats.length).to.equal(3);
          expect(résultats).to.have.members([1, 2, 3]);
        });

        it("Avec fRéduction complèxe", async () => {
          const fRéduction = (branches: number[][]) => [
            ...branches.map((b) => b[0]),
          ];

          fsOublier.push(
            await suivreBdsDeFonctionListe({
              fListe,
              f,
              fBranche,
              fIdBdDeBranche,
              fRéduction,
              fCode,
            }),
          );
        });
      });

      describe("Avec branches complexes sans fCode", function () {
        type branche = {
          nom: string;
        };
        let fSuivre: (ids: branche[]) => Promise<void>;
        let fOublier: schémaFonctionOublier;

        const fListe = async (
          fSuivreRacine: (éléments: branche[]) => Promise<void>,
        ): Promise<schémaFonctionOublier> => {
          fSuivre = fSuivreRacine;
          return faisRien;
        };

        before(async () => {
          fOublier = await suivreBdsDeFonctionListe({
            fListe,
            f: faisRien,
            fBranche: async () => faisRien,
          });
        });
        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Ajout d'une branche ou deux", async () => {
          await expect(fSuivre([{ nom: "abc" }])).rejected();
        });
      });
    });

    describe("Suivre BDs selon condition", function () {
      let idBd1: string;
      let idBd2: string;

      const sélectionnées = new attente.AttendreRésultat<string[]>();
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBd1 = await client.créerBdIndépendante({ type: "keyvalue" });
        idBd2 = await client.créerBdIndépendante({ type: "keyvalue" });

        const fListe = async (
          fSuivreRacine: (ids: string[]) => Promise<void>,
        ): Promise<schémaFonctionOublier> => {
          await fSuivreRacine([idBd1, idBd2]);
          return faisRien;
        };
        const fCondition = async (
          id: string,
          fSuivreCondition: (état: boolean) => void,
        ): Promise<schémaFonctionOublier> => {
          const f = async (bd: TypedKeyValue<{ [clef: string]: number }>) =>
            fSuivreCondition(Object.keys(await bd.allAsJSON()).length > 0);
          return await client.suivreBd({
            id,
            type: "keyvalue",
            f,
            schéma: schémaKVNumérique,
          });
        };
        fsOublier.push(
          await client.suivreBdsSelonCondition({
            fListe,
            fCondition,
            f: (idsBds) => sélectionnées.mettreÀJour(idsBds),
          }),
        );
      });
      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });
      it("Seules les bonnes BDs sont retournées", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const val = await sélectionnées.attendreExiste();
        expect(val).to.be.an.empty("array");

        const { bd: bd1, fOublier: fOublier1 } = await orbite.ouvrirBdTypée({
          id: idBd1,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });
        fsOublier.push(fOublier1);
        await bd1.put("a", 1);

        const val2 = await sélectionnées.attendreQue((x) => x.length > 0);
        expect(val2).to.be.an("array").with.length(1).and.members([idBd1]);
      });
      it("Les changements aux conditions sont détectés", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd: bd2, fOublier: fOublier2 } = await orbite.ouvrirBdTypée({
          id: idBd2,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });
        fsOublier.push(fOublier2);

        await bd2.put("a", 1);
        const val = await sélectionnées.attendreQue((x) => x.length > 1);
        expect(val).to.have.members([idBd1, idBd2]);
      });
    });

    describe("Opérations SFIP", function () {
      let cid: string;
      const texte = "வணக்கம்";
      it("On ajoute un fichier au SFIP", async () => {
        cid = await client.ajouterÀSFIP({
          nomFichier: "texte.txt",
          contenu: new TextEncoder().encode(texte),
        });
      });
      it("On télécharge le fichier du SFIP", async () => {
        const données = await client.obtFichierSFIP({ id: cid });
        expect(new TextDecoder().decode(données!)).to.equal(texte);
      });
      it("On télécharge le fichier en tant qu'itérable", async () => {
        const flux = await client.obtItérableAsyncSFIP({ id: cid });
        const données = await toBuffer(flux);
        expect(new TextDecoder().decode(données!)).to.equal(texte);
      });
    });

    describe("Ouvrir BD", function () {
      let idBd: string;
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "keyvalue" });
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("On obtient la BD", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd, fOublier } = await orbite.ouvrirBd({ id: idBd });
        fsOublier.push(fOublier);
        expect(isValidAddress(bd.address.toString())).to.be.true();
      });
      it("On évite la concurrence", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const bds = await Promise.all(
          [1, 2].map(async () => {
            const { bd, fOublier } = await orbite.ouvrirBd({
              id: idBd,
            });
            fsOublier.push(fOublier);
            return bd;
          }),
        );
        expect(bds[0] === bds[1]).to.be.true();
      });
    });

    describe("Obtenir ID BD", function () {
      let idRacine: string;
      let idBd: string;

      let bdRacine: TypedKeyValue<{ [clef: string]: string }>;
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        idRacine = await client.créerBdIndépendante({ type: "keyvalue" });
        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idRacine,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });
        bdRacine = bd;
        fsOublier.push(fOublier);

        idBd = await client.créerBdIndépendante({ type: "set" });
        await bdRacine.put("clef", idBd);
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("Avec racine chaîne", async () => {
        const idBdRetrouvée = await client.obtIdBd({
          nom: "clef",
          racine: idRacine,
          type: "set",
        });
        expect(idBdRetrouvée).to.equal(idBd);
      });

      it("Avec racine BD", async () => {
        const idBdRetrouvée = await client.obtIdBd({
          nom: "clef",
          racine: bdRacine,
        });
        expect(idBdRetrouvée).to.equal(idBd);
      });

      it("Avec mauvais type spécifié", async () => {
        await expect(
          client.obtIdBd({
            nom: "clef",
            racine: bdRacine,
            type: "keyvalue",
          }),
        ).rejected();
      });

      it("On crée la BD si elle n'existait pas", async () => {
        const idBdRetrouvée = await client.obtIdBd({
          nom: "je n'existe pas encore",
          racine: bdRacine,
          type: "set",
        });
        expect(isValidAddress(idBdRetrouvée)).to.be.true();
      });

      it("Mais on ne crée pas la BD on n'a pas la permission sur la BD racine", async () => {
        const idBdRetrouvée = await client2.obtIdBd({
          nom: "et moi je n'existerai jamais",
          racine: bdRacine,
          type: "set",
        });
        expect(idBdRetrouvée).to.be.undefined();
      });

      it("On ne perd pas les données en cas de concurrence entre dispositifs", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        // Créons une nouvelle BD avec des données
        const NOUVELLE_CLEF = "nouvelle clef";
        const idNouvelleBd = await client.obtIdBd({
          nom: NOUVELLE_CLEF,
          racine: idRacine,
          type: "set",
        });
        expect(idNouvelleBd).to.be.a("string");

        const { bd, fOublier } = await orbite.ouvrirBd({
          id: idNouvelleBd!,
          type: "set",
        });
        fsOublier.push(fOublier);

        await bd.add("Salut !");
        await bd.add("வணக்கம்!");

        // Simulons un autre dispositif qui écrit à la même clef de manière concurrente
        const idBdConcurrente = await client.créerBdIndépendante({
          type: "set",
        });
        const { bd: bdConcurrent, fOublier: fOublierConcurrente } =
          await orbite.ouvrirBdTypée({
            id: idBdConcurrente,
            type: "set",
            schéma: schémaListeChaîne,
          });
        fsOublier.push(fOublierConcurrente);

        await bdConcurrent.add("કેમ છો");
        await bdRacine.put(NOUVELLE_CLEF, idBdConcurrente);

        // Il ne devrait tout de même pas y avoir perte de données
        const idBdRetrouvée = await client.obtIdBd({
          nom: NOUVELLE_CLEF,
          racine: idRacine,
          type: "set",
        });
        const { bd: bdRetrouvée, fOublier: fOublierRetrouvée } =
          await orbite.ouvrirBdTypée({
            id: idBdRetrouvée!,
            type: "set",
            schéma: schémaListeChaîne,
          });
        fsOublier.push(fOublierRetrouvée);

        const éléments = (await bdRetrouvée.all()).map((x) => x.value);
        expect(éléments).to.have.members(["Salut !", "வணக்கம்!", "કેમ છો"]);
      });
    });

    describe("Créer BD indépendante", function () {
      const fsOublier: schémaFonctionOublier[] = [];

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("La BD est crée", async () => {
        const idBd = await client.créerBdIndépendante({ type: "keyvalue" });
        expect(isValidAddress(idBd)).to.be.true();
      });
      it("Avec sa propre bd accès utilisateur", async () => {
        const { orbite: orbiteClient } = await client.attendreSfipEtOrbite();

        const optionsAccès: OptionsContrôleurConstellation = {
          write: await client.obtIdCompte(),
        };
        const idBd = await client.créerBdIndépendante({
          type: "keyvalue",
          optionsAccès,
        });

        const { bd, fOublier } = await orbiteClient.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });
        fsOublier.push(fOublier);

        const autorisé = await orbite.peutÉcrire(bd, client.orbite?.orbite);
        expect(autorisé).to.be.true();
      });

      it("Avec accès personalisé", async () => {
        const { orbite: orbite2 } = await client2.attendreSfipEtOrbite();
        const optionsAccès = { write: orbite2.identity.id };

        const idBd = await client.créerBdIndépendante({
          type: "keyvalue",
          optionsAccès,
        });

        const { bd: bd_orbite2, fOublier } = await orbite2.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });
        fsOublier.push(fOublier);

        const autorisé = await orbite.peutÉcrire(
          bd_orbite2,
          client2.orbite?.orbite,
        );

        expect(autorisé).to.be.true();
      });
    });

    describe("Combiner BDs", function () {
      const fsOublier: schémaFonctionOublier[] = [];

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("Combiner BD dic", async () => {
        const idBdDic1 = await client.créerBdIndépendante({ type: "keyvalue" });
        const idBdDic2 = await client.créerBdIndépendante({ type: "keyvalue" });
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd: bdDic1, fOublier: fOublierDic1 } =
          await orbite.ouvrirBdTypée({
            id: idBdDic1,
            type: "keyvalue",
            schéma: schémaKVNumérique,
          });
        const { bd: bdDic2, fOublier: fOublierDic2 } =
          await orbite.ouvrirBdTypée({
            id: idBdDic2,
            type: "keyvalue",
            schéma: schémaKVNumérique,
          });

        fsOublier.push(fOublierDic1);
        fsOublier.push(fOublierDic2);

        await bdDic1.put("clef 1", 1);
        await bdDic1.put("clef 2", 2);
        await bdDic2.put("clef 1", -1);
        await bdDic2.put("clef 3", 3);

        await client.combinerBdsDict({ bdBase: bdDic1, bd2: bdDic2 });
        const données = await bdDic1.allAsJSON();

        expect(données).to.deep.equal({
          "clef 1": 1,
          "clef 2": 2,
          "clef 3": 3,
        });
      });

      it("Combiner BD liste", async () => {
        const idBdListe1 = await client.créerBdIndépendante({ type: "set" });
        const idBdListe2 = await client.créerBdIndépendante({ type: "set" });
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd: bdListe1, fOublier: fOublierListe1 } =
          await orbite.ouvrirBdTypée({
            id: idBdListe1,
            type: "set",
            schéma: schémaListeNumérique,
          });
        const { bd: bdListe2, fOublier: fOublierListe2 } =
          await orbite.ouvrirBdTypée({
            id: idBdListe2,
            type: "set",
            schéma: schémaListeNumérique,
          });

        fsOublier.push(fOublierListe1);
        fsOublier.push(fOublierListe2);

        await bdListe1.add(1);
        await bdListe1.add(2);
        await bdListe2.add(1);
        await bdListe2.add(3);

        await client.combinerBdsEnsemble({ bdBase: bdListe1, bd2: bdListe2 });
        const données = (await bdListe1.all()).map((x) => x.value);

        expect(Array.isArray(données)).to.be.true();
        expect(données.length).to.equal(3);
        expect(données).to.have.members([1, 2, 3]);
      });

      it("Combiner BD liste avec index", async () => {
        const idBdListe1 = await client.créerBdIndépendante({ type: "set" });
        const idBdListe2 = await client.créerBdIndépendante({ type: "set" });
        const { orbite } = await client.attendreSfipEtOrbite();

        const schéma: JSONSchemaType<{ temps: number; val: number }> = {
          type: "object",
          properties: { temps: { type: "number" }, val: { type: "number" } },
          required: ["temps", "val"],
        };

        const { bd: bdListe1, fOublier: fOublierListe1 } =
          await orbite.ouvrirBdTypée({
            id: idBdListe1,
            type: "set",
            schéma,
          });
        const { bd: bdListe2, fOublier: fOublierListe2 } =
          await orbite.ouvrirBdTypée({
            id: idBdListe2,
            type: "set",
            schéma,
          });

        fsOublier.push(fOublierListe1);
        fsOublier.push(fOublierListe2);

        await bdListe1.add({ temps: 1, val: 1 });
        await bdListe1.add({ temps: 2, val: 2 });
        await bdListe2.add({ temps: 1, val: 2 });
        await bdListe2.add({ temps: 3, val: 3 });

        await client.combinerBdsEnsemble({
          bdBase: bdListe1,
          bd2: bdListe2,
          index: ["temps"],
        });
        const données = (await bdListe1.all()).map((x) => x.value);

        expect(Array.isArray(données)).to.be.true();
        expect(données.length).to.equal(3);
        expect(données).to.have.deep.members([
          { temps: 1, val: 1 },
          { temps: 2, val: 2 },
          { temps: 3, val: 3 },
        ]);
      });

      it("Combiner BD dic récursif", async () => {
        const idBdDic1 = await client.créerBdIndépendante({ type: "keyvalue" });
        const idBdDic2 = await client.créerBdIndépendante({ type: "keyvalue" });
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd: bdDic1, fOublier: fOublierDic1 } =
          await orbite.ouvrirBdTypée({
            id: idBdDic1,
            type: "keyvalue",
            schéma: schémaKVChaîne,
          });
        const { bd: bdDic2, fOublier: fOublierDic2 } =
          await orbite.ouvrirBdTypée({
            id: idBdDic2,
            type: "keyvalue",
            schéma: schémaKVChaîne,
          });

        fsOublier.push(fOublierDic1);
        fsOublier.push(fOublierDic2);

        const idBdListe1 = await client.créerBdIndépendante({ type: "set" });
        const idBdListe2 = await client.créerBdIndépendante({ type: "set" });

        const { bd: bdListe1, fOublier: fOublierListe1 } =
          await orbite.ouvrirBd({
            id: idBdListe1,
            type: "set",
          });
        const { bd: bdListe2, fOublier: fOublierListe2 } =
          await orbite.ouvrirBd({
            id: idBdListe2,
            type: "set",
          });

        fsOublier.push(fOublierListe1);
        fsOublier.push(fOublierListe2);

        await bdListe1.add(1);
        await bdListe2.add(1);
        await bdListe2.add(2);

        await bdDic1.put("clef", idBdListe1);
        await bdDic2.put("clef", idBdListe2);

        await client.combinerBdsDict({ bdBase: bdDic1, bd2: bdDic2 });

        const idBdListeFinale = await bdDic1.get("clef");
        if (!idBdListeFinale) throw new Error("idBdListeFinale non définie");
        const { bd: bdListeFinale, fOublier: fOublierBdListeFinale } =
          await orbite.ouvrirBd({
            id: idBdListeFinale,
            type: "set",
          });

        fsOublier.push(fOublierBdListeFinale);

        const données = (await bdListeFinale.all()).map((x) => x.value);

        expect(Array.isArray(données)).to.be.true();
        expect(données.length).to.equal(2);
        expect(données).to.have.members([1, 2]);
      });

      it("Combiner BD liste récursif", async () => {
        const schéma: JSONSchemaType<élément> = {
          type: "object",
          properties: {
            index: {
              type: "number",
            },
            idBd: {
              type: "string",
            },
          },
          required: ["index", "idBd"],
        };

        const idBdListe1 = await client.créerBdIndépendante({ type: "set" });
        const idBdListe2 = await client.créerBdIndépendante({ type: "set" });
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd: bdListe1, fOublier: fOublierBdListe1 } =
          await orbite.ouvrirBdTypée({
            id: idBdListe1,
            type: "set",
            schéma,
          });
        const { bd: bdListe2, fOublier: fOublierBdListe2 } =
          await orbite.ouvrirBdTypée({
            id: idBdListe2,
            type: "set",
            schéma,
          });

        fsOublier.push(fOublierBdListe1);
        fsOublier.push(fOublierBdListe2);

        const idSubBd1 = await client.créerBdIndépendante({ type: "set" });
        const idSubBd2 = await client.créerBdIndépendante({ type: "set" });

        const { bd: subBd1, fOublier: fOublierSubBd1 } = await orbite.ouvrirBd({
          id: idSubBd1,
          type: "set",
        });
        const { bd: subBd2, fOublier: fOublierSubBd2 } = await orbite.ouvrirBd({
          id: idSubBd2,
          type: "set",
        });

        fsOublier.push(fOublierSubBd1);
        fsOublier.push(fOublierSubBd2);

        await subBd1.add(1);
        await subBd2.add(1);
        await subBd2.add(2);

        type élément = { index: number; idBd: string };
        await bdListe1.add({ index: 1, idBd: idSubBd1 });
        await bdListe2.add({ index: 1, idBd: idSubBd2 });

        await client.combinerBdsEnsemble({
          bdBase: bdListe1,
          bd2: bdListe2,
          index: ["index"],
        });

        const donnéesBdListe: élément[] = (await bdListe1.all()).map(
          (x) => x.value,
        );
        expect(Array.isArray(donnéesBdListe)).to.be.true();
        expect(donnéesBdListe.length).to.equal(1);

        const idBdListeFinale = donnéesBdListe[0].idBd;

        const { bd: subBdFinale, fOublier: fOublierSubBdFinale } =
          await orbite.ouvrirBd({
            id: idBdListeFinale,
            type: "set",
          });

        fsOublier.push(fOublierSubBdFinale);

        const données = (await subBdFinale.all()).map((x) => x.value);

        expect(Array.isArray(données)).to.be.true();
        expect(données.length).to.equal(2);
        expect(données).to.have.members([1, 2]);
      });
    });

    describe("Effacer BD", function () {
      let idBd: string;
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "keyvalue" });
        const { orbite } = await client.attendreSfipEtOrbite();
        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });
        fsOublier.push(fOublier);

        await bd.put("test", 123);
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("Les données n'existent plus", async () => {
        await client.effacerBd({ id: idBd });
        const { orbite } = await client.attendreSfipEtOrbite();
        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });

        fsOublier.push(fOublier);

        const val = await bd.get("test");

        expect(val).to.be.undefined();
      });
    });

    describe("Suivre mes permissions", function () {
      const rés = new attente.AttendreRésultat<string>();
      let idBd: string;

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBd = await client.créerBdIndépendante({
          type: "keyvalue",
          optionsAccès: {
            address: undefined,
            write: await client.obtIdCompte(),
          },
        });

        fsOublier.push(
          await client2.suivrePermission({
            idObjet: idBd,
            f: (p) => {
              rés.mettreÀJour(p);
            },
          }),
        );
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
        rés.toutAnnuler();
      });

      it("On n'a pas d'accès avant", async () => {
        expect(rés.val).to.be.undefined();
      });

      it("On détecte l'ajout d'une permission membre", async () => {
        await client.donnerAccès({ idBd, identité: idCompte2, rôle: MEMBRE });
        const val = await rés.attendreExiste();
        expect(val).to.equal(MEMBRE);
      });

      it("Le nouveau membre peut modifier la BD", async () => {
        const { orbite: orbiteClient } = await client.attendreSfipEtOrbite();
        const { bd, fOublier } = await orbiteClient.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVNumérique,
        });

        fsOublier.push(fOublier);

        const permission = await orbite.peutÉcrire(bd, client2.orbite?.orbite);
        expect(permission).to.be.true();
      });

      it("On détecte l'ajout d'une permission modératrice", async () => {
        await client.donnerAccès({
          idBd,
          identité: idCompte2,
          rôle: MODÉRATEUR,
        });
        await rés.attendreQue((x) => x === MODÉRATEUR);
      });
    });

    describe("Suivre accès et permissions BD", function () {
      let fOublier: schémaFonctionOublier;
      let fOublierÉcrire: schémaFonctionOublier;
      let fOublierPermission: schémaFonctionOublier;

      let lAccès: infoAccès[];
      let idBd: string;
      const résultatPermission = new attente.AttendreRésultat<
        typeof MODÉRATEUR | typeof MEMBRE
      >();

      let permissionÉcrire = false;

      before(async () => {
        idBd = await client.créerBdIndépendante({
          type: "keyvalue",
          optionsAccès: {
            write: await client.obtIdCompte(),
          },
        });
        const f = (accès: infoAccès[]) => {
          lAccès = accès;
        };
        fOublier = await client.suivreAccèsBd({ id: idBd, f });

        const fÉcrire = (accès: boolean) => {
          permissionÉcrire = accès;
        };
        fOublierÉcrire = await client2.suivrePermissionÉcrire({
          id: idBd,
          f: fÉcrire,
        });

        const fPermission = (accès?: typeof MODÉRATEUR | typeof MEMBRE) => {
          résultatPermission.mettreÀJour(accès);
        };
        fOublierPermission = await client2.suivrePermission({
          idObjet: idBd,
          f: fPermission,
        });
      });
      after(async () => {
        if (fOublier) await fOublier();
        if (fOublierÉcrire) await fOublierÉcrire();
        if (fOublierPermission) await fOublierPermission();

        résultatPermission.toutAnnuler();
      });
      it("On détecte l'ajout d'une permission membre", async () => {
        await client.donnerAccès({ idBd, identité: idCompte2, rôle: MEMBRE });
        await résultatPermission.attendreQue((x) => x === MEMBRE);

        const infoInvité = lAccès.find((a) => a.idCompte === idCompte2);
        expect(infoInvité?.rôle).to.equal(MEMBRE);
      });

      it("L'invité détecte l'ajout de sa permission membre", async () => {
        expect(permissionÉcrire).to.be.true();
        expect(résultatPermission.val).to.equal(MEMBRE);
      });

      it("On détecte l'ajout d'une permission modératrice", async () => {
        await client.donnerAccès({
          idBd,
          identité: idCompte2,
          rôle: MODÉRATEUR,
        });
        await résultatPermission.attendreQue((x) => x === MODÉRATEUR);

        const infoInvité = lAccès.find((a) => a.idCompte === idCompte2);
        expect(infoInvité?.rôle).to.equal(MODÉRATEUR);
      });

      it("L'invité détecte l'ajout de sa permission modératrice", async () => {
        expect(permissionÉcrire).to.be.true();
        expect(résultatPermission.val).to.equal(MODÉRATEUR);
      });
    });
  });
}
