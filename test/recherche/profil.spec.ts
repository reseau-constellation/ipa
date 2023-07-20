import fs from "fs";
import path from "path";

import type { default as ClientConstellation } from "@/client.js";
import type {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatTexte,
  infoRésultatVide,
} from "@/utils/index.js";
import {
  rechercherProfilSelonNom,
  rechercherProfilSelonTexte,
  rechercherProfilSelonActivité,
  rechercherProfilSelonCourriel,
} from "@/recherche/profil.js";

import { générerClients } from "@/utilsTests/client.js";
import { AttendreRésultat } from "@/utilsTests/attente.js";
import { dossierRessourcesTests } from "@/utilsTests/dossiers.js";

import { expect } from "aegir/chai";

describe("Rechercher profil", function () {

  describe("Selon activité", function () {

    let fOublierClients: () => Promise<void>;
    let clients: ClientConstellation[];
    let client: ClientConstellation;
    let idBdCompte: string;
  
    let fOublier: schémaFonctionOublier;

    const rés = new AttendreRésultat<
      résultatObjectifRecherche<infoRésultatVide>
    >();

    before(async () => {
      ({ fOublier: fOublierClients, clients } = await générerClients(1));
      client = clients[0];
      idBdCompte = await client.obtIdCompte();
      const fRecherche = rechercherProfilSelonActivité();
      fOublier = await fRecherche(client, idBdCompte, (r) =>
        rés.mettreÀJour(r)
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
      await client.profil!.sauvegarderNom({ langue: "த", nom: "ஜூலீஎன்" });
      const val = await rés.attendreQue((x) => !!x && x.score > 0);
      expect(val.score).to.equal(1 / 3);
    });

    it("Encore mieux avec un courriel", async () => {
      await client.profil!.sauvegarderCourriel({
        courriel: "julien.malard@mail.mcgill.ca",
      });
      const val = await rés.attendreQue((x) => !!x && x.score > 1 / 3);
      expect(val.score).to.equal(2 / 3);
    });

    it("C'est parfait avec un photo !", async () => {
      const IMAGE = fs.readFileSync(
        path.join(await dossierRessourcesTests(), "logo.png")
      );

      await client.profil!.sauvegarderImage({ image: IMAGE });
      const val = await rés.attendreQue(
        (x: résultatObjectifRecherche<infoRésultatVide> | undefined) =>
          x?.score === 1
      );

      expect(val.score).to.equal(1);
    });
  });

  describe("Selon nom", function () {
    let fOublierClients: () => Promise<void>;
    let clients: ClientConstellation[];
    let client: ClientConstellation;
    let idBdCompte: string;
    let fOublier: schémaFonctionOublier;

    const rés = new AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte>
    >();
  
    before(async () => {
      ({ fOublier: fOublierClients, clients } = await générerClients(1));
      client = clients[0];
      idBdCompte = await client.obtIdCompte();
      const fRecherche = rechercherProfilSelonNom("Julien");
      fOublier = await fRecherche(client, idBdCompte, (r) =>
        rés.mettreÀJour(r)
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
      await client.profil!.sauvegarderNom({ langue: "es", nom: "Julián" });
      await rés.attendreQue((x) => !!x && x.score > 0);

      expect(rés.val).to.deep.equal({
        type: "résultat",
        clef: "es",
        score: 0.5,
        de: "nom",
        info: { type: "texte", texte: "Julián", début: 0, fin: 6 },
      });
    });

    it("Meilleur nom détecté", async () => {
      await client.profil!.sauvegarderNom({ langue: "fr", nom: "Julien" });
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
    let idBdCompte: string;
    let fOublier: schémaFonctionOublier;

    const rés = new AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte>
    >();
  
    before(async () => {
      ({ fOublier: fOublierClients, clients } = await générerClients(1));
      client = clients[0];
      idBdCompte = await client.obtIdCompte();
      const fRecherche = rechercherProfilSelonCourriel("julien");
      fOublier = await fRecherche(client, idBdCompte, (r) =>
        rés.mettreÀJour(r)
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
      await client.profil!.sauvegarderCourriel({
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
    let idBdCompte: string;
    const fsOublier: schémaFonctionOublier[] = [];
    const résNom = new AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte>
    >();
    const résCourriel = new AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte>
    >();
  
    before(async () => {
      ({ fOublier: fOublierClients, clients } = await générerClients(1));
      client = clients[0];
      
      idBdCompte = await client.obtIdCompte();
      const fRechercheNom = rechercherProfilSelonTexte("Julien Malard");
      fsOublier.push(
        await fRechercheNom(client, idBdCompte, (r) => résNom.mettreÀJour(r))
      );
  
      const fRechercherCourriel = rechercherProfilSelonTexte("julien.");
      fsOublier.push(
        await fRechercherCourriel(client, idBdCompte, (r) =>
          résCourriel.mettreÀJour(r)
        )
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
      await client.profil!.sauvegarderNom({
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
      await client.profil!.sauvegarderCourriel({
        courriel: "julien.malard@mail.mcgill.ca",
      });

      const val = await résCourriel.attendreQue((x) =>
        Boolean(x && x.score > 1 / 3)
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
