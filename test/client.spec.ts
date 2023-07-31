import all from "it-all";
import toBuffer from "it-to-buffer";

import ClientConstellation, { infoAccès } from "@/client.js";
import {
  adresseOrbiteValide,
  schémaFonctionSuivi,
  schémaFonctionOublier,
  faisRien,
} from "@/utils/index.js";

import { MEMBRE, MODÉRATEUR } from "@/accès/consts.js";

import type KeyValueStore from "orbit-db-kvstore";

import { générerClients } from "@/utilsTests/client.js";
import { AttendreRésultat } from "@/utilsTests/attente.js";

import type { OptionsContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import { peutÉcrire } from "@/utilsTests/index.js";

import { isNode, isElectronMain } from "wherearewe";

import { expect } from "aegir/chai";
import FeedStore from "orbit-db-feedstore";

describe("adresseOrbiteValide", function () {
  it("adresse orbite est valide", () => {
    const valide = adresseOrbiteValide(
      "/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX/7e0cde32-7fee-487c-ad6e-4247f627488e"
    );
    expect(valide).to.be.true();
  });
  it("CID SFIP n'est pas valide", () => {
    const valide = adresseOrbiteValide(
      "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ"
    );
    expect(valide).to.be.false();
  });
});

if (isNode || isElectronMain) {
  describe("Contrôle dispositifs", function () {
    let fOublierClients: () => Promise<void>;
    let clients: ClientConstellation[];
    let client: ClientConstellation,
      client2: ClientConstellation,
      client3: ClientConstellation;

    let fOublierDispositifs: schémaFonctionOublier;
    let fOublieridCompte: schémaFonctionOublier;

    let idDispositif1: string;
    let idDispositif2: string;
    let idDispositif3: string;

    let idCompte1: string;

    let idCompte2EnDirecte: string | undefined;

    const mesDispositifs = new AttendreRésultat<string[]>();

    before(async () => {
      ({ fOublier: fOublierClients, clients } = await générerClients(3));
      [client, client2, client3] = clients;

      idCompte1 = await client.obtIdCompte();

      idDispositif1 = await client.obtIdDispositif();
      idDispositif2 = await client2.obtIdDispositif();
      idDispositif3 = await client3.obtIdDispositif();

      fOublierDispositifs = await client.suivreDispositifs({
        f: (dispositifs) => mesDispositifs.mettreÀJour(dispositifs),
      });
      fOublieridCompte = await client2.suivreIdCompte({
        f: (id) => (idCompte2EnDirecte = id),
      });
    });

    after(async () => {
      if (fOublierDispositifs) await fOublierDispositifs();
      if (fOublieridCompte) await fOublieridCompte();
      if (fOublierClients) await fOublierClients();
    });

    it("Mon dispositif est présent", async () => {
      const val = await mesDispositifs.attendreExiste();
      expect(val).to.have.members([idDispositif1]);
    });

    describe("Ajouter dispositif manuellement", function () {
      let idBd: string;

      const fsOublier: schémaFonctionOublier[] = [];
      const résNom = new AttendreRésultat<{ [lng: string]: string }>();

      before(async () => {
        fsOublier.push(
          await client2.profil!.suivreNoms({
            f: (noms) => résNom.mettreÀJour(noms),
          })
        );

        await client.profil!.sauvegarderNom({
          nom: "Julien Malard-Adam",
          langue: "fr",
        });

        await client.ajouterDispositif({ idDispositif: idDispositif2 });
        await client2.rejoindreCompte({ idCompte: idCompte1 });
        idBd = await client.créerBdIndépendante({ type: "kvstore" });
      });

      after(async () => {
        résNom.toutAnnuler();
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("Mes dispositifs sont mis à jour", async () => {
        const val = await mesDispositifs.attendreQue((x) => x.length > 1);
        expect(val).to.have.members([idDispositif1, idDispositif2]);
      });

      it("Le nouveau dispositif a rejoint notre compte", () => {
        expect(idCompte2EnDirecte).to.equal(idCompte1);
      });

      it("idDispositif ne change pas", async () => {
        const idDispositifClient2Après = await client2.obtIdDispositif();
        expect(idDispositifClient2Après).to.equal(idDispositif2);
      });

      it("Le nouveau dispositif peut modifier mes BDs", async () => {
        const { bd: bd_orbite2, fOublier } = await client2.ouvrirBd<{
          test: number;
        }>({ id: idBd, type: "kvstore" });
        fsOublier.push(fOublier);
        const autorisé = await peutÉcrire(bd_orbite2, client2.orbite?.orbite);
        expect(autorisé).to.be.true();
      });

      it("Le nouveau dispositif suit mon profil", async () => {
        const val = await résNom.attendreQue((x) =>
          Object.keys(x).includes("fr")
        );
        expect(val.fr).to.equal("Julien Malard-Adam");
      });
    });

    describe("Automatiser ajout dispositif", function () {
      let idBd: string;

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "kvstore" });

        const invitation = await client.générerInvitationRejoindreCompte();
        await client3.demanderEtPuisRejoindreCompte(invitation);
      });

      it("Nouveau dispositif ajouté au compte", async () => {
        const val = await mesDispositifs.attendreQue((x) => x.length > 2);
        expect(val).to.have.members([idDispositif1, idDispositif2, idDispositif3]);
      });

      it("Nouveau dispositif indique le nouveau compte", async () => {
        const idCompte3 = await client3.obtIdCompte();
        expect(idCompte3).to.equal(idCompte1);
      });

      it("Le nouveau dispositif peut modifier mes BDs", async () => {
        const { bd: bd_orbite3, fOublier } = await client3.ouvrirBd<{
          test: number;
        }>({ id: idBd, type: "keyvalue" });
        const autorisé = await peutÉcrire(bd_orbite3, client3.orbite?.orbite);
        await fOublier();
        expect(autorisé).to.be.true();
      });

      it.skip("Mauvais mot de passe");
    });
  });

  describe("Fonctionalités client", function () {
    let fOublierClients: () => Promise<void>;
    let clients: ClientConstellation[];
    let client: ClientConstellation, client2: ClientConstellation;

    let idCompte2: string;

    before(async () => {
      ({ fOublier: fOublierClients, clients } = await générerClients(2));
      [client, client2] = clients;

      idCompte2 = await client2.obtIdCompte();
    });

    after(async () => {
      if (fOublierClients) await fOublierClients();
    });

    it("Le client devrait être initialisé", async () => {
      expect(client.prêt).to.be.true();
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

    describe("Suivre BD", function () {
      let idBd: string;
      let fOublier: schémaFonctionOublier;
      let bd: KeyValueStore<{ [clef: string]: number }>;
      let fOublierBd: schémaFonctionOublier;
      let données: { [key: string]: number | undefined };

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "kvstore" });
        ({ bd, fOublier: fOublierBd } = await client.ouvrirBd<{
          [clef: string]: number;
        }>({ id: idBd, type: "keyvalue" }));
        await bd.put("a", 1);
        const fSuivre = (_bd: KeyValueStore<{ [clef: string]: number }>) => {
          const d = _bd.all;
          données = d;
        };
        const fOublierSuivre = await client.suivreBd({
          id: idBd,
          f: fSuivre,
          type: "keyvalue",
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
        expect(données.a).to.equal(1);
      });

      it("Les changements sont détectés", async () => {
        await bd.put("b", 2);
        expect(données.b).to.equal(2);
      });
    });

    describe("Suivre BD de fonction", function () {
      let idBd: string;
      let idBd2: string;
      let bd: KeyValueStore<{ [clef: string]: number }>;
      let bd2: KeyValueStore<{ [clef: string]: number }>;
      let fOublierBd: schémaFonctionOublier;
      let fOublierBd2: schémaFonctionOublier;
      let fSuivre: (id: string) => Promise<void>;
      let fOublier: schémaFonctionOublier;

      const données = new AttendreRésultat<{ [key: string]: number }>();

      const changerBd = async (id: string) => {
        await fSuivre(id);
      };
      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "kvstore" });
        idBd2 = await client.créerBdIndépendante({ type: "kvstore" });
        ({ bd, fOublier: fOublierBd } = await client.ouvrirBd<{
          [clef: string]: number;
        }>({ id: idBd, type: "keyvalue" }));
        ({ bd: bd2, fOublier: fOublierBd2 } = await client.ouvrirBd<{
          [clef: string]: number;
        }>({
          id: idBd2,
          type: "keyvalue",
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
          return await client.suivreBdDic({ id, f: fSuivreBd });
        };
        const fOublierSuivre = await client.suivreBdDeFonction({
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

        const val = await données.attendreExiste();
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
      let bdBase: KeyValueStore<{ [clef: string]: string }>;
      let idBd: string | undefined;

      const données = new AttendreRésultat<{ [key: string]: number }>();

      const CLEF = "clef";
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBdBase = await client.créerBdIndépendante({ type: "kvstore" });
        const { bd: bd_, fOublier } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({ id: idBdBase, type: "keyvalue" });
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
          return await client.suivreBdDic({ id, f: fSuivreBd });
        };
        fsOublier.push(
          await client.suivreBdDeClef({ id: idBdBase, clef: CLEF, f, fSuivre })
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
        idBd = await client.obtIdBd({
          nom: CLEF,
          racine: idBdBase,
          type: "kvstore",
        });
        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: number;
        }>({
          id: idBd!,
          type: "keyvalue",
        });
        fsOublier.push(fOublier);

        await bd.put("a", 1);
        const val = await données.attendreExiste();
        expect(val.a).to.equal(1);
      });

      it("Les changements à la clef sont détectés", async () => {
        const idBd2 = await client.créerBdIndépendante({ type: "kvstore" });
        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: number;
        }>({
          id: idBd2,
          type: "keyvalue",
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
      const données = new AttendreRésultat<{ [key: string]: number }>();
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBdBase = await client.créerBdIndépendante({ type: "kvstore" });

        idBd = await client.créerBdIndépendante({ type: "kvstore" });

        const fSuivre = (d: { [key: string]: number }) => (données.mettreÀJour(d));
        await client.suivreBdDicDeClef({
          id: idBdBase,
          clef: CLEF,
          schéma: { type: "object", additionalProperties: true, required: [] },
          f: fSuivre,
        });
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("`{}` est retourné si la clef n'existe pas", async () => {
        const val = await données.attendreExiste();
        expect(val).to.be.an.empty("object");
      });

      it("Les données sont retournés en format objet", async () => {
        const { bd: bdBase, fOublier: fOublierBase } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({ id: idBdBase, type: "keyvalue" });
        fsOublier.push(fOublierBase);
        await bdBase.put(CLEF, idBd);

        const val1 = await données.attendreExiste();
        expect(Object.keys(val1).length).to.equal(0);

        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: number;
        }>({
          id: idBd,
          type: "keyvalue",
        });
        fsOublier.push(fOublier);
        await bd.put("a", 1);
        const val2 = await données.attendreQue(x=>Object.keys(x).length > 0);
        expect(val2.a).to.equal(1);
      });
    });

    describe("Suivre BD liste de clef", function () {
      let idBdBase: string;
      let idBd: string;
      let donnéesValeur: number[];
      let données: LogEntry<number>[];

      const CLEF = "clef";
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBdBase = await client.créerBdIndépendante({ type: "kvstore" });

        idBd = await client.créerBdIndépendante({ type: "feed" });

        const fSuivreValeur = (d: number[]) => (donnéesValeur = d);
        const fSuivre = (d: LogEntry<number>[]) => (données = d);
        await client.suivreBdListeDeClef({
          id: idBdBase,
          clef: CLEF,
          f: fSuivreValeur,
          renvoyerValeur: true,
        });
        await client.suivreBdListeDeClef({
          id: idBdBase,
          clef: CLEF,
          f: fSuivre,
          renvoyerValeur: false,
        });
      });
      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });
      it("`[]` est retourné si la clef n'existe pas", async () => {
        expect(Array.isArray(donnéesValeur)).to.be.true();
        expect(donnéesValeur.length).to.equal(0);
        expect(Array.isArray(données)).to.be.true();
        expect(données.length).to.equal(0);
      });
      it("Avec renvoyer valeur", async () => {
        const { bd: bdBase, fOublier: fOublierBase } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({ id: idBdBase, type: "keyvalue" });
        fsOublier.push(fOublierBase);

        await bdBase.put(CLEF, idBd);
        expect(donnéesValeur.length).to.equal(0);

        const { bd, fOublier } = await client.ouvrirBd<number>({
          id: idBd,
          type: "feed",
        });
        fsOublier.push(fOublier);

        await bd.add(1);
        await bd.add(2);
        expect(donnéesValeur).to.have.members([1, 2]);
      });
      it("Sans renvoyer valeur", async () => {
        expect(données.length).to.equal(2);
        expect(données.map((d) => d.payload.value)).to.have.members([1, 2]);
      });
    });

    describe("Suivre BD liste", function () {
      let idBd: string;
      let donnéesValeur: number[];
      let données: LogEntry<number>[];

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "feed" });

        const fSuivreValeur = (d: number[]) => (donnéesValeur = d);
        const fSuivre = (d: LogEntry<number>[]) => (données = d);
        fsOublier.push(
          await client.suivreBdListe({
            id: idBd,
            f: fSuivreValeur,
            renvoyerValeur: true,
          })
        );
        fsOublier.push(
          await client.suivreBdListe({
            id: idBd,
            f: fSuivre,
            renvoyerValeur: false,
          })
        );
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("Avec renvoyer valeur", async () => {
        expect(donnéesValeur.length).to.equal(0);

        const { bd, fOublier } = await client.ouvrirBd<number>({
          id: idBd,
          type: "feed",
        });
        fsOublier.push(fOublier);

        await bd.add(1);
        await bd.add(2);
        expect(donnéesValeur).to.have.members([1, 2]);
      });

      it("Sans renvoyer valeur", async () => {
        expect(données.length).to.equal(2);
        expect(données.map((d) => d.payload.value)).to.have.members([1, 2]);
      });
    });

    describe("Suivre BDs récursives", function () {
      let idBd: string;
      let idBdListe: string;
      let idBd2: string;
      let fOublier: schémaFonctionOublier;

      const rés = new AttendreRésultat<string[]>();

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "kvstore" });
        idBdListe = await client.créerBdIndépendante({ type: "feed" });
        idBd2 = await client.créerBdIndépendante({ type: "feed" });

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
        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({
          id: idBd,
          type: "keyvalue",
        });
        await bd.set("clef", idBd2);
        await fOublier();

        const val = await rés.attendreQue((x) => !!x && x.length > 1);
        expect(val).to.have.members([idBd, idBd2]);
      });

      it("Enlever idBd", async () => {
        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({
          id: idBd,
          type: "keyvalue",
        });
        await bd.del("clef");
        await fOublier();

        const val = await rés.attendreQue((x) => !!x && x.length === 1);
        expect(val).to.have.members([idBd]);
      });

      it("Ajout récursif", async () => {
        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({
          id: idBd,
          type: "keyvalue",
        });
        await bd.set("clef", idBdListe);
        await fOublier();

        const { bd: bdListe, fOublier: fOublierBdListe } =
          await client.ouvrirBd<string>({ id: idBdListe, type: "feed" });
        await bdListe.add(idBd2);
        fOublierBdListe();

        const val = await rés.attendreQue((x) => !!x && x.length === 3);
        expect(val).to.have.members([idBd, idBdListe, idBd2]);
      });

      it("Enlever récursif", async () => {
        const { bd: bdListe, fOublier: fOublierBdListe } =
          await client.ouvrirBd<string>({ id: idBdListe, type: "feed" });
        await client.effacerÉlémentDeBdListe({ bd: bdListe, élément: idBd2 });
        fOublierBdListe();

        const val = await rés.attendreQue((x) => !!x && x.length === 2);
        expect(val).to.have.members([idBd, idBdListe]);
      });

      it("Ajouter dictionnaire à liste", async () => {
        const { bd: bdListe, fOublier: fOublierBdListe } =
          await client.ouvrirBd<string | { [key: string]: string }>({
            id: idBdListe,
            type: "feed",
          });
        await bdListe.add({ maBd: idBd2 });
        fOublierBdListe();

        const val = await rés.attendreQue((x) => !!x && x.length === 3);
        expect(val).to.have.members([idBd, idBdListe, idBd2]);
      });

      it("Enlever dictionnaire de liste", async () => {
        const { bd: bdListe, fOublier: fOublierBdListe } =
          await client.ouvrirBd<string | { [key: string]: string }>({
            id: idBdListe,
            type: "feed",
          });
        await client.effacerÉlémentDeBdListe({
          bd: bdListe,
          élément: (x) =>
            typeof x.payload.value !== "string" &&
            x.payload.value.maBd === idBd2,
        });
        fOublierBdListe();

        const val = await rés.attendreQue((x) => !!x && x.length === 2);
        expect(val).to.have.members([idBd, idBdListe]);
      });

      it("Ajout clef dictionnaire", async () => {
        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({
          id: idBd,
          type: "keyvalue",
        });
        await bd.set(idBd2, "je suis là !");
        await fOublier();

        const val = await rés.attendreQue((x) => !!x && x.length > 2);
        expect(val).to.have.members([idBd, idBd2, idBdListe]);
      });

      it("Enlever clef dictionnaire", async () => {
        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({
          id: idBd,
          type: "keyvalue",
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

      const rés = new AttendreRésultat<string>();

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "kvstore" });
        idBdListe = await client.créerBdIndépendante({ type: "feed" });
        idBd2 = await client.créerBdIndépendante({ type: "feed" });

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
        const empreinteAvant = await rés.attendreExiste();

        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({
          id: idBd,
          type: "keyvalue",
        });
        await bd.set("clef", idBd2);
        await fOublier();

        await rés.attendreQue((x) => !!x && x !== empreinteAvant);
      });

      it("Enlever élément", async () => {
        const empreinteAvant = await rés.attendreExiste();

        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({
          id: idBd,
          type: "keyvalue",
        });
        await bd.del("clef");
        await fOublier();

        await rés.attendreQue((x) => !!x && x !== empreinteAvant);
      });

      it("Ajout récursif", async () => {
        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({
          id: idBd,
          type: "keyvalue",
        });
        await bd.set("clef", idBdListe);
        await fOublier();

        const empreinteDébut = await rés.attendreExiste();

        const { bd: bdListe, fOublier: fOublierBdListe } =
          await client.ouvrirBd<string>({ id: idBdListe, type: "feed" });
        await bdListe.add(idBd2);
        fOublierBdListe();

        const empreinteAvant = await rés.attendreQue(
          (x) => !!x && x !== empreinteDébut
        );

        const { bd: bd2, fOublier: fOublierBd2 } =
          await client.ouvrirBd<string>({ id: idBd2, type: "feed" });
        await bd2.add("abc");
        fOublierBd2();

        await rés.attendreQue((x) => !!x && x !== empreinteAvant);
      });

      it("Enlever récursif", async () => {
        const empreinteAvant = await rés.attendreExiste();

        const { bd: bdListe, fOublier: fOublierBdListe } =
          await client.ouvrirBd<string>({ id: idBdListe, type: "feed" });
        await client.effacerÉlémentDeBdListe({ bd: bdListe, élément: idBd2 });
        fOublierBdListe();

        await rés.attendreQue((x) => !!x && x !== empreinteAvant);
      });
    });

    describe("Rechercher élément BD liste selon empreinte", function () {
      let idBd: string;
      let bd: FeedStore<string>;
      let fOublier: schémaFonctionOublier;

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "feed" });
        ({ bd, fOublier } = await client.ouvrirBd<string>({
          id: idBd,
          type: "feed",
        }));
        await bd.add("abc");
      });

      after(async () => {
        if (fOublier) await fOublier();
      });

      it("On retrouve le bon élément", async () => {
        const fRecherche = (e: LogEntry<string>): boolean => {
          return e.payload.value === "abc";
        };
        const résultat = await client.rechercherBdListe({
          id: idBd,
          f: fRecherche,
        });
        expect(résultat?.payload.value).to.equal("abc");
      });

      it("`undefined` est retourné si l'empreinte n'existe pas", async () => {
        const fRecherche = (e: LogEntry<string>): boolean => {
          return e.payload.value === "def";
        };
        const résultat = await client.rechercherBdListe({
          id: idBd,
          f: fRecherche,
        });
        expect(résultat).to.be.undefined();
      });
    });

    describe("Suivre BDs de BD liste", function () {
      let idBdListe: string;
      let idBd1: string;
      let idBd2: string;

      type branche = { [key: string]: number | undefined };
      let données: branche[];
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBdListe = await client.créerBdIndépendante({ type: "feed" });
        const { bd: bdListe, fOublier } = await client.ouvrirBd<string>({
          id: idBdListe,
          type: "feed",
        });
        fsOublier.push(fOublier);

        const fBranche = async (
          id: string,
          f: schémaFonctionSuivi<branche>
        ) => {
          return await client.suivreBd<{ [clef: string]: number }>({
            id,
            type: "keyvalue",
            f: (_bd) => f(_bd.all),
          });
        };
        const fSuivi = (x: branche[]) => {
          données = x;
        };
        fsOublier.push(
          await client.suivreBdsDeBdListe({
            id: idBdListe,
            f: fSuivi,
            fBranche,
          })
        );

        idBd1 = await client.créerBdIndépendante({ type: "kvstore" });
        idBd2 = await client.créerBdIndépendante({ type: "kvstore" });
        const { bd: bd1, fOublier: fOublier1 } = await client.ouvrirBd<{
          [clef: string]: number;
        }>({
          id: idBd1,
          type: "keyvalue",
        });
        fsOublier.push(fOublier1);
        const { bd: bd2, fOublier: fOublier2 } = await client.ouvrirBd<{
          [clef: string]: number;
        }>({
          id: idBd2,
          type: "keyvalue",
        });
        fsOublier.push(fOublier2);

        await bd1.put("a", 1);
        await bd2.put("b", 2);

        await bdListe.add(idBd1);
        await bdListe.add(idBd2);
      });
      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });
      it("Les éléments sont retournés", async () => {
        expect(Array.isArray(données)).to.be.true();
        expect(données).to.have.deep.members([{ a: 1 }, { b: 2 }]);
      });
    });

    describe("Suivre BDs de fonction", function () {
      describe("De liste ids BDs", function () {
        let fSuivre: (ids: string[]) => Promise<void>;
        let résultats: number[];
        let idBd1: string;
        let idBd2: string;

        const fsOublier: schémaFonctionOublier[] = [];

        const changerBds = async (ids: string[]) => {
          await fSuivre(ids);
        };

        before(async () => {
          idBd1 = await client.créerBdIndépendante({ type: "kvstore" });
          idBd2 = await client.créerBdIndépendante({ type: "kvstore" });
          const { bd: bd1, fOublier: fOublier1 } = await client.ouvrirBd<{
            [clef: string]: number;
          }>({ id: idBd1, type: "keyvalue" });
          fsOublier.push(fOublier1);
          const { bd: bd2, fOublier: fOublier2 } = await client.ouvrirBd<{
            [clef: string]: number;
          }>({ id: idBd2, type: "keyvalue" });
          fsOublier.push(fOublier2);

          await bd1.put("a", 1);
          await bd1.put("b", 2);
          await bd2.put("c", 3);

          const fListe = async (
            fSuivreRacine: (éléments: string[]) => Promise<void>
          ): Promise<schémaFonctionOublier> => {
            fSuivre = fSuivreRacine;
            return faisRien;
          };
          const f = (x: number[]) => (résultats = x);
          const fBranche = async (
            id: string,
            f: schémaFonctionSuivi<number[]>
          ): Promise<schémaFonctionOublier> => {
            return await client.suivreBd({
              id,
              type: "keyvalue",
              f: (bd: { [clef: string]: number }) => {
                const vals: number[] = Object.values(bd.all);
                f(vals);
              },
            });
          };
          fsOublier.push(
            await client.suivreBdsDeFonctionListe({ fListe, f, fBranche })
          );
        });
        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        it("Sans branches", async () => {
          expect(résultats).to.be.undefined();
        });
        it("Ajout d'une branche ou deux", async () => {
          await changerBds([idBd1, idBd2]);
          expect(Array.isArray(résultats)).to.be.true();
          expect(résultats.length).to.equal(3);
          expect(résultats).to.have.members([1, 2, 3]);
        });
        it("Enlever une branche", async () => {
          await changerBds([idBd1]);
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

        let résultats: number[];

        let idBd1: string;
        let idBd2: string;

        const fsOublier: schémaFonctionOublier[] = [];

        const fListe = async (
          fSuivreRacine: (éléments: branche[]) => Promise<void>
        ): Promise<schémaFonctionOublier> => {
          fSuivre = fSuivreRacine;
          return faisRien;
        };
        const f = (x: number[]) => (résultats = x);
        const fBranche = async (
          id: string,
          f: schémaFonctionSuivi<number[]>
        ): Promise<schémaFonctionOublier> => {
          return await client.suivreBd({
            id,
            type: "keyvalue",
            f: (bd: { [clef: string]: number }) => {
              const vals: number[] = Object.values(bd.all);
              f(vals);
            },
          });
        };

        const fIdBdDeBranche = (x: branche) => x.id;
        const fCode = (x: branche) => x.id;

        const changerBds = async (ids: string[]) => {
          await fSuivre(
            ids.map((id) => {
              return { nom: "abc", id: id };
            })
          );
        };
        before(async () => {
          idBd1 = await client.créerBdIndépendante({ type: "kvstore" });
          idBd2 = await client.créerBdIndépendante({ type: "kvstore" });

          const { bd: bd1, fOublier: fOublier1 } = await client.ouvrirBd<{
            [clef: string]: number;
          }>({ id: idBd1, type: "keyvalue" });
          fsOublier.push(fOublier1);
          const { bd: bd2, fOublier: fOublier2 } = await client.ouvrirBd<{
            [clef: string]: number;
          }>({ id: idBd2, type: "keyvalue" });
          fsOublier.push(fOublier2);

          await bd1.put("a", 1);
          await bd1.put("b", 2);
          await bd2.put("c", 3);

          fsOublier.push(
            await client.suivreBdsDeFonctionListe({
              fListe,
              f,
              fBranche,
              fIdBdDeBranche,
              fCode,
            })
          );
          await changerBds([idBd1, idBd2]);
        });
        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        it("Ajout d'une branche ou deux", async () => {
          expect(Array.isArray(résultats)).to.be.true();
          expect(résultats.length).to.equal(3);
          expect(résultats).to.have.members([1, 2, 3]);
        });

        it("Avec fRéduction complèxe", async () => {
          const fRéduction = (branches: number[][]) => [
            ...branches.map((b) => b[0]),
          ];

          fsOublier.push(
            await client.suivreBdsDeFonctionListe({
              fListe,
              f,
              fBranche,
              fIdBdDeBranche,
              fRéduction,
              fCode,
            })
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
          fSuivreRacine: (éléments: branche[]) => Promise<void>
        ): Promise<schémaFonctionOublier> => {
          fSuivre = fSuivreRacine;
          return faisRien;
        };

        before(async () => {
          fOublier = await client.suivreBdsDeFonctionListe({
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

      let sélectionnées: string[];
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBd1 = await client.créerBdIndépendante({ type: "kvstore" });
        idBd2 = await client.créerBdIndépendante({ type: "kvstore" });

        const fListe = async (
          fSuivreRacine: (ids: string[]) => Promise<void>
        ): Promise<schémaFonctionOublier> => {
          fSuivreRacine([idBd1, idBd2]);
          return faisRien;
        };
        const fCondition = async (
          id: string,
          fSuivreCondition: (état: boolean) => void
        ): Promise<schémaFonctionOublier> => {
          const f = (bd: { [clef: string]: number }) =>
            fSuivreCondition(Object.keys(bd.all).length > 0);
          return await client.suivreBd({ id, type: "keyvalue", f });
        };
        fsOublier.push(
          await client.suivreBdsSelonCondition({
            fListe,
            fCondition,
            f: (idsBds) => (sélectionnées = idsBds),
          })
        );
      });
      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });
      it("Seules les bonnes BDs sont retournées", async () => {
        expect(Array.isArray(sélectionnées));
        expect(sélectionnées.length).to.equal(0);

        const { bd: bd1, fOublier: fOublier1 } = await client.ouvrirBd<{
          [clef: string]: number;
        }>({ id: idBd1, type: "keyvalue" });
        fsOublier.push(fOublier1);
        await bd1.put("a", 1);

        expect(Array.isArray(sélectionnées));
        expect(sélectionnées.length).to.equal(1);
        expect(sélectionnées).to.have.members([idBd1]);
      });
      it("Les changements aux conditions sont détectés", async () => {
        const { bd: bd2, fOublier: fOublier2 } = await client.ouvrirBd<{
          [clef: string]: number;
        }>({ id: idBd2, type: "keyvalue" });
        fsOublier.push(fOublier2);

        await bd2.put("a", 1);
        expect(sélectionnées).to.have.members([idBd1, idBd2]);
      });
    });

    describe("Opérations SFIP", function () {
      let cid: string;
      const texte = "வணக்கம்";
      it("On ajoute un fichier au SFIP", async () => {
        cid = await client.ajouterÀSFIP({ fichier: texte });
      });
      it("On télécharge le fichier du SFIP", async () => {
        const données = await client.obtFichierSFIP({ id: cid });
        expect(new TextDecoder().decode(données!)).to.equal(texte);
      });
      it("On télécharge le fichier en tant qu'itérable", async () => {
        const flux = client.obtItérableAsyncSFIP({ id: cid });
        const données = await toBuffer(flux);
        expect(new TextDecoder().decode(données!)).to.equal(texte);
      });
    });

    describe("Ouvrir BD", function () {
      let idBd: string;
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "kvstore" });
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("On obtient la BD", async () => {
        const { bd, fOublier } = await client.ouvrirBd({ id: idBd });
        fsOublier.push(fOublier);
        expect(adresseOrbiteValide(bd.address.toString())).to.be.true();
      });
      it("On évite la concurrence", async () => {
        const bds = await Promise.all(
          [1, 2].map(async () => {
            const { bd, fOublier } = await client.ouvrirBd({ id: idBd });
            fsOublier.push(fOublier);
            return bd;
          })
        );
        expect(bds[0] === bds[1]).to.be.true();
      });
    });

    describe("Obtenir ID BD", function () {
      let idRacine: string;
      let idBd: string;

      let bdRacine: KeyValueStore<{ [clef: string]: string }>;
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idRacine = await client.créerBdIndépendante({ type: "kvstore" });
        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({
          id: idRacine,
          type: "keyvalue",
        });
        bdRacine = bd;
        fsOublier.push(fOublier);

        idBd = await client.créerBdIndépendante({ type: "feed" });
        await bdRacine.put("clef", idBd);
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("Avec racine chaîne", async () => {
        const idBdRetrouvée = await client.obtIdBd({
          nom: "clef",
          racine: idRacine,
          type: "feed",
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
            type: "kvstore",
          })
        ).rejected();
      });

      it("On crée la BD si elle n'existait pas", async () => {
        const idBdRetrouvée = await client.obtIdBd({
          nom: "je n'existe pas encore",
          racine: bdRacine,
          type: "feed",
        });
        expect(adresseOrbiteValide(idBdRetrouvée)).to.be.true();
      });

      it("Mais on ne crée pas la BD on n'a pas la permission sur la BD racine", async () => {
        const idBdRetrouvée = await client2.obtIdBd({
          nom: "et moi je n'existerai jamais",
          racine: bdRacine,
          type: "feed",
        });
        expect(idBdRetrouvée).to.be.undefined();
      });

      it("On ne perd pas les données en cas de concurrence entre dispositifs", async () => {
        // Créons une nouvelle BD avec des données
        const NOUVELLE_CLEF = "nouvelle clef";
        const idNouvelleBd = await client.obtIdBd({
          nom: NOUVELLE_CLEF,
          racine: idRacine,
          type: "feed",
        });
        expect(idNouvelleBd).to.be.a("string");

        const { bd, fOublier } = await client.ouvrirBd<string>({
          id: idNouvelleBd!,
          type: "feed",
        });
        fsOublier.push(fOublier);

        await bd.add("Salut !");
        await bd.add("வணக்கம்!");

        // Simulons un autre dispositif qui écrit à la même clef de manière concurrente
        const idBdConcurrente = await client.créerBdIndépendante({
          type: "feed",
        });
        const { bd: bdConcurrent, fOublier: fOublierConcurrente } =
          await client.ouvrirBd<string>({ id: idBdConcurrente, type: "feed" });
        fsOublier.push(fOublierConcurrente);

        await bdConcurrent.add("કેમ છો");
        await bdRacine.put(NOUVELLE_CLEF, idBdConcurrente);

        // Il ne devrait tout de même pas y avoir perte de données
        const idBdRetrouvée = await client.obtIdBd({
          nom: NOUVELLE_CLEF,
          racine: idRacine,
          type: "feed",
        });
        const { bd: bdRetrouvée, fOublier: fOublierRetrouvée } =
          await client.ouvrirBd<string>({ id: idBdRetrouvée!, type: "feed" });
        fsOublier.push(fOublierRetrouvée);

        const éléments = ClientConstellation.obtÉlémentsDeBdListe({
          bd: bdRetrouvée,
        });
        expect(éléments).to.have.members(["Salut !", "வணக்கம்!", "કેમ છો"]);
      });
    });

    describe("Créer BD indépendante", function () {
      const fsOublier: schémaFonctionOublier[] = [];

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("La BD est crée", async () => {
        const idBd = await client.créerBdIndépendante({ type: "kvstore" });
        expect(adresseOrbiteValide(idBd)).to.be.true();
      });
      it("Avec sa propre bd accès utilisateur", async () => {
        const optionsAccès: OptionsContrôleurConstellation = {
          address: undefined,
          premierMod: client.bdCompte!.id,
        };
        const idBd = await client.créerBdIndépendante({
          type: "kvstore",
          optionsAccès,
        });

        const { bd, fOublier } = await client.ouvrirBd<{ test: number }>({
          id: idBd,
          type: "keyvalue",
        });
        fsOublier.push(fOublier);

        const autorisé = await peutÉcrire(bd, client.orbite?.orbite);
        expect(autorisé).to.be.true();
      });
      it("Avec accès personalisé", async () => {
        const optionsAccès = { premierMod: client2.orbite!.identity.id };
        const idBd = await client.créerBdIndépendante({
          type: "kvstore",
          optionsAccès,
        });

        const { bd: bd_orbite2, fOublier } = await client2.ouvrirBd<{
          test: number;
        }>({ id: idBd, type: "keyvalue" });
        fsOublier.push(fOublier);

        const autorisé = await peutÉcrire(bd_orbite2, client2.orbite?.orbite);

        expect(autorisé).to.be.true();
      });
    });

    describe("Combiner BDs", function () {
      const fsOublier: schémaFonctionOublier[] = [];

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("Combiner BD dic", async () => {
        const idBdDic1 = await client.créerBdIndépendante({ type: "kvstore" });
        const idBdDic2 = await client.créerBdIndépendante({ type: "kvstore" });

        const { bd: bdDic1, fOublier: fOublierDic1 } = await client.ouvrirBd<{
          [clef: string]: number;
        }>({ id: idBdDic1, type: "keyvalue" });
        const { bd: bdDic2, fOublier: fOublierDic2 } = await client.ouvrirBd<{
          [clef: string]: number;
        }>({ id: idBdDic2, type: "keyvalue" });

        fsOublier.push(fOublierDic1);
        fsOublier.push(fOublierDic2);

        await bdDic1.put("clef 1", 1);
        await bdDic1.put("clef 2", 2);
        await bdDic2.put("clef 1", -1);
        await bdDic2.put("clef 3", 3);

        await client.combinerBdsDict({ bdBase: bdDic1, bd2: bdDic2 });
        const données = bdDic1.all;

        expect(données).to.deep.equal({
          "clef 1": 1,
          "clef 2": 2,
          "clef 3": 3,
        });
      });

      it("Combiner BD liste", async () => {
        const idBdListe1 = await client.créerBdIndépendante({ type: "feed" });
        const idBdListe2 = await client.créerBdIndépendante({ type: "feed" });

        const { bd: bdListe1, fOublier: fOublierListe1 } =
          await client.ouvrirBd<number>({ id: idBdListe1, type: "feed" });
        const { bd: bdListe2, fOublier: fOublierListe2 } =
          await client.ouvrirBd<number>({ id: idBdListe2, type: "feed" });

        fsOublier.push(fOublierListe1);
        fsOublier.push(fOublierListe2);

        await bdListe1.add(1);
        await bdListe1.add(2);
        await bdListe2.add(1);
        await bdListe2.add(3);

        await client.combinerBdsListe({ bdBase: bdListe1, bd2: bdListe2 });
        const données = ClientConstellation.obtÉlémentsDeBdListe({
          bd: bdListe1,
        });

        expect(Array.isArray(données)).to.be.true();
        expect(données.length).to.equal(3);
        expect(données).to.have.members([1, 2, 3]);
      });

      it("Combiner BD liste avec indexe", async () => {
        const idBdListe1 = await client.créerBdIndépendante({ type: "feed" });
        const idBdListe2 = await client.créerBdIndépendante({ type: "feed" });

        const { bd: bdListe1, fOublier: fOublierListe1 } =
          await client.ouvrirBd<{ temps: number; val: number }>({
            id: idBdListe1,
            type: "feed",
          });
        const { bd: bdListe2, fOublier: fOublierListe2 } =
          await client.ouvrirBd<{ temps: number; val: number }>({
            id: idBdListe2,
            type: "feed",
          });

        fsOublier.push(fOublierListe1);
        fsOublier.push(fOublierListe2);

        await bdListe1.add({ temps: 1, val: 1 });
        await bdListe1.add({ temps: 2, val: 2 });
        await bdListe2.add({ temps: 1, val: 2 });
        await bdListe2.add({ temps: 3, val: 3 });

        await client.combinerBdsListe({
          bdBase: bdListe1,
          bd2: bdListe2,
          index: ["temps"],
        });
        const données = ClientConstellation.obtÉlémentsDeBdListe({
          bd: bdListe1,
        });

        expect(Array.isArray(données)).to.be.true();
        expect(données.length).to.equal(3);
        expect(données).to.have.deep.members([
          { temps: 1, val: 1 },
          { temps: 2, val: 2 },
          { temps: 3, val: 3 },
        ]);
      });

      it("Combiner BD dic récursif", async () => {
        const idBdDic1 = await client.créerBdIndépendante({ type: "kvstore" });
        const idBdDic2 = await client.créerBdIndépendante({ type: "kvstore" });

        const { bd: bdDic1, fOublier: fOublierDic1 } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({
          id: idBdDic1,
          type: "keyvalue",
        });
        const { bd: bdDic2, fOublier: fOublierDic2 } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({
          id: idBdDic2,
          type: "keyvalue",
        });

        fsOublier.push(fOublierDic1);
        fsOublier.push(fOublierDic2);

        const idBdListe1 = await client.créerBdIndépendante({ type: "feed" });
        const idBdListe2 = await client.créerBdIndépendante({ type: "feed" });

        const { bd: bdListe1, fOublier: fOublierListe1 } =
          await client.ouvrirBd<number>({ id: idBdListe1, type: "feed" });
        const { bd: bdListe2, fOublier: fOublierListe2 } =
          await client.ouvrirBd<number>({ id: idBdListe2, type: "feed" });

        fsOublier.push(fOublierListe1);
        fsOublier.push(fOublierListe2);

        await bdListe1.add(1);
        await bdListe2.add(1);
        await bdListe2.add(2);

        await bdDic1.put("clef", idBdListe1);
        await bdDic2.put("clef", idBdListe2);

        await client.combinerBdsDict({ bdBase: bdDic1, bd2: bdDic2 });

        const idBdListeFinale = bdDic1.get("clef");
        if (!idBdListeFinale) throw new Error("idBdListeFinale non définie");
        const { bd: bdListeFinale, fOublier: fOublierBdListeFinale } =
          await client.ouvrirBd<number>({ id: idBdListeFinale, type: "feed" });

        fsOublier.push(fOublierBdListeFinale);

        const données = ClientConstellation.obtÉlémentsDeBdListe({
          bd: bdListeFinale,
        });

        expect(Array.isArray(données)).to.be.true();
        expect(données.length).to.equal(2);
        expect(données).to.have.members([1, 2]);
      });

      it("Combiner BD liste récursif", async () => {
        const idBdListe1 = await client.créerBdIndépendante({ type: "feed" });
        const idBdListe2 = await client.créerBdIndépendante({ type: "feed" });

        const { bd: bdListe1, fOublier: fOublierBdListe1 } =
          await client.ouvrirBd<{ indexe: number; idBd: string }>({
            id: idBdListe1,
            type: "feed",
          });
        const { bd: bdListe2, fOublier: fOublierBdListe2 } =
          await client.ouvrirBd<{ indexe: number; idBd: string }>({
            id: idBdListe2,
            type: "feed",
          });

        fsOublier.push(fOublierBdListe1);
        fsOublier.push(fOublierBdListe2);

        const idSubBd1 = await client.créerBdIndépendante({ type: "feed" });
        const idSubBd2 = await client.créerBdIndépendante({ type: "feed" });

        const { bd: subBd1, fOublier: fOublierSubBd1 } =
          await client.ouvrirBd<number>({ id: idSubBd1, type: "feed" });
        const { bd: subBd2, fOublier: fOublierSubBd2 } =
          await client.ouvrirBd<number>({ id: idSubBd2, type: "feed" });

        fsOublier.push(fOublierSubBd1);
        fsOublier.push(fOublierSubBd2);

        await subBd1.add(1);
        await subBd2.add(1);
        await subBd2.add(2);

        type élément = { indexe: number; idBd: string };
        await bdListe1.add({ indexe: 1, idBd: idSubBd1 });
        await bdListe2.add({ indexe: 1, idBd: idSubBd2 });

        await client.combinerBdsListe({
          bdBase: bdListe1,
          bd2: bdListe2,
          index: ["indexe"],
        });

        const donnéesBdListe: élément[] =
          ClientConstellation.obtÉlémentsDeBdListe({ bd: bdListe1 });
        expect(Array.isArray(donnéesBdListe)).to.be.true();
        expect(donnéesBdListe.length).to.equal(1);

        const idBdListeFinale = donnéesBdListe[0]!.idBd;
        const { bd: subBdFinale, fOublier: fOublierSubBdFinale } =
          await client.ouvrirBd<number>({ id: idBdListeFinale, type: "feed" });

        fsOublier.push(fOublierSubBdFinale);

        const données = ClientConstellation.obtÉlémentsDeBdListe({
          bd: subBdFinale,
        });

        expect(Array.isArray(données)).to.be.true();
        expect(données.length).to.equal(2);
        expect(données).to.have.members([1, 2]);
      });
    });

    describe("Effacer BD", function () {
      let idBd: string;
      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "kvstore" });
        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: number;
        }>({
          id: idBd,
          type: "keyvalue",
        });
        fsOublier.push(fOublier);

        await bd.put("test", 123);
        await bd.close();
      });

      after(async () => {
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("Les données n'existent plus", async () => {
        await client.effacerBd({ id: idBd });
        const { bd, fOublier } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({
          id: idBd,
          type: "keyvalue",
        });

        fsOublier.push(fOublier);

        const val = bd.get("test");

        expect(val).to.be.undefined();
      });
    });

    describe("Suivre mes permissions", function () {
      const rés = new AttendreRésultat<string>();
      let idBd: string;

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBd = await client.créerBdIndépendante({
          type: "kvstore",
          optionsAccès: {
            address: undefined,
            premierMod: client.bdCompte!.id,
          },
        });

        fsOublier.push(
          await client2.suivrePermission({
            idObjet: idBd,
            f: (p) => {
              rés.mettreÀJour(p);
            },
          })
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
        const { bd, fOublier } = await client2.ouvrirBd<{ test: number }>({
          id: idBd,
          type: "keyvalue",
        });

        fsOublier.push(fOublier);

        const permission = await peutÉcrire(bd, client2.orbite?.orbite);
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
      const résultatPermission = new AttendreRésultat<
        typeof MODÉRATEUR | typeof MEMBRE
      >();

      let permissionÉcrire = false;

      before(async () => {
        idBd = await client.créerBdIndépendante({
          type: "kvstore",
          optionsAccès: {
            address: undefined,
            premierMod: client.bdCompte!.id,
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

    describe("Épingler BD", function () {
      let idBdKv: string;
      let idBdListe: string;
      let idBdKv2: string;

      let cidTexte: string;
      let interval: NodeJS.Timer | undefined = undefined;

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        idBdKv = await client.créerBdIndépendante({ type: "kvstore" });
        const { bd: bdKv, fOublier: fOublierKv } = await client.ouvrirBd<{
          [clef: string]: string;
        }>({ id: idBdKv, type: "keyvalue" });

        fsOublier.push(fOublierKv);

        idBdListe = await client.créerBdIndépendante({ type: "feed" });
        const { bd: bdListe, fOublier: fOublierBdListe } =
          await client.ouvrirBd<string>({ id: idBdListe, type: "feed" });

        fsOublier.push(fOublierBdListe);

        idBdKv2 = await client.créerBdIndépendante({ type: "kvstore" });

        await bdKv.put("ma bd liste", idBdListe);
        await bdListe.add(idBdKv2);

        cidTexte = (await client2.sfip!.add("Bonjour !")).cid.toString(); // Utiliser ipfs2 pour ne pas l'ajouter à ipfs1 directement (simuler adition d'un autre membre)
        await bdListe.add(cidTexte);

        await client.épingles!.épinglerBd({ id: idBdKv, récursif: true });
      });

      after(async () => {
        if (interval) clearInterval(interval);
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("La BD est épinglée", async () => {
        expect(client.orbite?._bdsOrbite[idBdKv]).to.exist();
      });
      it("Récursion KVStore", async () => {
        expect(client.orbite?._bdsOrbite[idBdListe]).to.exist();
      });
      it("Récursion FeedStore", async () => {
        expect(client.orbite?._bdsOrbite[idBdKv2]).to.exist();
      });
      it("Les fichiers SFIP sont également épinglés", async () => {
        let fichierEstÉpinglé = false;
        await new Promise<void>((résoudre) => {
          interval = setInterval(async () => {
            const épinglés = await all(client.sfip!.pin.ls());
            fichierEstÉpinglé = épinglés
              .map((x) => x.cid.toString())
              .includes(cidTexte);
            if (fichierEstÉpinglé) {
              clearInterval(interval);
              résoudre();
            }
          }, 50);
        });

        expect(fichierEstÉpinglé).to.be.true();
      });
    });
  });
}
