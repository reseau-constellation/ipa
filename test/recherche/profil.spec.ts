import type { ClientConstellation } from "@/client.js";
import type {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatTexte,
  infoRésultatVide,
} from "@/types.js";
import {
  rechercherProfilsSelonNom,
  rechercherProfilsSelonTexte,
  rechercherProfilsSelonActivité,
  rechercherProfilsSelonCourriel,
} from "@/recherche/profil.js";

import { attente as utilsTestAttente } from "@constl/utils-tests";
import { générerClientsInternes } from "../ressources/utils.js";
import { obtRessourceTest } from "../ressources/index.js";

import { expect } from "aegir/chai";

describe("Rechercher profil", function () {
  describe("Selon activité", function () {
    let fOublierClients: () => Promise<void>;
    let clients: ClientConstellation[];
    let client: ClientConstellation;
    let idCompte: string;

    let fOublier: schémaFonctionOublier;

    const rés = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatVide>
    >();

    before(async () => {
      ({ fOublier: fOublierClients, clients: clients as unknown } =
        await générerClientsInternes({ n: 1 }));
      client = clients[0];
      idCompte = await client.obtIdCompte();
      const fRecherche = rechercherProfilsSelonActivité();
      fOublier = await fRecherche(client, idCompte, async (r) =>
        rés.mettreÀJour(r),
      );
    });

    after(async () => {
      rés.toutAnnuler();
      if (fOublierClients) await fOublierClients();
      if (fOublier) await fOublier();
    });

    it("Score 0 pour commencer", async () => {
      const val = await rés.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        score: 0,
        de: "activité",
        info: { type: "vide" },
      });
    });

    it("On améliore le score en ajoutant notre nom", async () => {
      await client.profil.sauvegarderNom({ langue: "த", nom: "ஜூலீஎன்" });
      const val = await rés.attendreQue((x) => !!x && x.score > 0);
      expect(val.score).to.equal(1 / 3);
    });

    it("Encore mieux avec un courriel", async () => {
      await client.profil.sauvegarderCourriel({
        courriel: "julien.malard@mail.mcgill.ca",
      });
      const val = await rés.attendreQue((x) => !!x && x.score > 1 / 3);
      expect(val.score).to.equal(2 / 3);
    });

    it("C'est parfait avec un photo !", async () => {
      const IMAGE = await obtRessourceTest({
        nomFichier: "logo.png",
        optsAxios: { responseType: "arraybuffer" },
      });

      await client.profil.sauvegarderImage({
        image: { contenu: IMAGE, nomFichier: "logo.png" },
      });
      const val = await rés.attendreQue(
        (x: résultatObjectifRecherche<infoRésultatVide> | undefined) =>
          x?.score === 1,
      );

      expect(val.score).to.equal(1);
    });
  });

  describe("Selon nom", function () {
    let fOublierClients: () => Promise<void>;
    let clients: ClientConstellation[];
    let client: ClientConstellation;
    let idCompte: string;
    let fOublier: schémaFonctionOublier;

    const rés = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte>
    >();

    before(async () => {
      ({ fOublier: fOublierClients, clients: clients as unknown } =
        await générerClientsInternes({ n: 1 }));
      client = clients[0];
      idCompte = await client.obtIdCompte();
      const fRecherche = rechercherProfilsSelonNom("Julien");
      fOublier = await fRecherche(client, idCompte, async (r) =>
        rés.mettreÀJour(r),
      );
    });

    after(async () => {
      rés.toutAnnuler();
      if (fOublierClients) await fOublierClients();
      if (fOublier) await fOublier();
    });

    it("Rien pour commencer", async () => {
      expect(rés.val).to.be.undefined();
    });

    it("Ajout nom détecté", async () => {
      await client.profil.sauvegarderNom({ langue: "cst", nom: "Julián" });
      await rés.attendreQue((x) => !!x && x.score > 0);

      expect(rés.val).to.deep.equal({
        type: "résultat",
        clef: "cst",
        score: 0.5,
        de: "nom",
        info: { type: "texte", texte: "Julián", début: 0, fin: 6 },
      });
    });

    it("Meilleur nom détecté", async () => {
      await client.profil.sauvegarderNom({ langue: "fr", nom: "Julien" });
      await rés.attendreQue((x) => !!x && x.score > 0.5);

      expect(rés.val).to.deep.equal({
        type: "résultat",
        clef: "fr",
        score: 1,
        de: "nom",
        info: { type: "texte", texte: "Julien", début: 0, fin: 6 },
      });
    });
  });

  describe("Selon courriel", function () {
    let fOublierClients: () => Promise<void>;
    let clients: ClientConstellation[];
    let client: ClientConstellation;
    let idCompte: string;
    let fOublier: schémaFonctionOublier;

    const rés = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte>
    >();

    before(async () => {
      ({ fOublier: fOublierClients, clients: clients as unknown } =
        await générerClientsInternes({ n: 1 }));
      client = clients[0];
      idCompte = await client.obtIdCompte();
      const fRecherche = rechercherProfilsSelonCourriel("julien");
      fOublier = await fRecherche(client, idCompte, async (r) =>
        rés.mettreÀJour(r),
      );
    });

    after(async () => {
      rés.toutAnnuler();
      if (fOublier) await fOublier();
      if (fOublierClients) await fOublierClients();
    });

    it("Rien pour commencer", async () => {
      expect(rés.val).to.be.undefined();
    });

    it("Ajout courriel détecté", async () => {
      await client.profil.sauvegarderCourriel({
        courriel: "julien.malard@mail.mcgill.ca",
      });

      await rés.attendreQue((x) => !!x && x.score > 0);

      expect(rés.val).to.deep.equal({
        type: "résultat",
        score: 1,
        de: "courriel",
        info: {
          type: "texte",
          texte: "julien.malard@mail.mcgill.ca",
          début: 0,
          fin: 6,
        },
      });
    });
  });

  describe("Selon texte", function () {
    let fOublierClients: () => Promise<void>;
    let clients: ClientConstellation[];
    let client: ClientConstellation;
    let idCompte: string;
    const fsOublier: schémaFonctionOublier[] = [];
    const résNom = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte>
    >();
    const résCourriel = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte>
    >();

    before(async () => {
      ({ fOublier: fOublierClients, clients: clients as unknown } =
        await générerClientsInternes({ n: 1 }));
      client = clients[0];

      idCompte = await client.obtIdCompte();
      const fRechercheNom = rechercherProfilsSelonTexte("Julien Malard");
      fsOublier.push(
        await fRechercheNom(client, idCompte, async (r) =>
          résNom.mettreÀJour(r),
        ),
      );

      const fRechercherCourriel = rechercherProfilsSelonTexte("julien.");
      fsOublier.push(
        await fRechercherCourriel(client, idCompte, async (r) =>
          résCourriel.mettreÀJour(r),
        ),
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
      résNom.toutAnnuler();
      résCourriel.toutAnnuler();
      if (fOublierClients) await fOublierClients();
    });

    it("Rien pour commencer", async () => {
      expect(résNom.val).to.be.undefined();
      expect(résCourriel.val).to.be.undefined();
    });

    it("Ajout nom détecté", async () => {
      await client.profil.sauvegarderNom({
        langue: "fr",
        nom: "Julien Malard-Adam",
      });
      const valNom = await résNom.attendreExiste();
      expect(valNom).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 13,
          texte: "Julien Malard-Adam",
        },
        score: 1,
      });

      const valCourriel = await résCourriel.attendreExiste();
      expect(valCourriel).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 7,
          texte: "Julien Malard-Adam",
        },
        score: 1 / 3,
      });
    });

    it("Ajout courriel détecté", async () => {
      await client.profil.sauvegarderCourriel({
        courriel: "julien.malard@mail.mcgill.ca",
      });

      const val = await résCourriel.attendreQue((x) =>
        Boolean(x && x.score > 1 / 3),
      );
      expect(val).to.deep.equal({
        type: "résultat",
        de: "courriel",
        info: {
          type: "texte",
          début: 0,
          fin: 7,
          texte: "julien.malard@mail.mcgill.ca",
        },
        score: 1,
      });
    });
  });
});
