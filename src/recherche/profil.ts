import ClientConstellation from "@/client.js";
import {
  schémaFonctionOublier,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuiviRecherche,
  résultatObjectifRecherche,
  infoRésultatTexte,
  infoRésultatVide,
} from "@/utils/index.js";

import {
  similImages,
  similTexte,
  rechercherDansTexte,
  combinerRecherches,
  rechercherSelonId,
} from "./utils.js";

export const rechercherProfilSelonActivité =
  (): schémaFonctionSuivreObjectifRecherche<infoRésultatVide> => {
    return async (
      client: ClientConstellation,
      idCompte: string,
      fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatVide>
    ): Promise<schémaFonctionOublier> => {
      const infosCompte: {
        noms: { [key: string]: string };
        image?: Uint8Array | null;
        courriel?: string | null;
      } = {
        noms: {},
        image: undefined,
        courriel: undefined,
      };
      const calculerScore = (): résultatObjectifRecherche<infoRésultatVide> => {
        const score =
          [
            Object.keys(infosCompte.noms).length > 0,
            infosCompte.image,
            infosCompte.courriel,
          ].filter(Boolean).length / 3;

        return {
          type: "résultat",
          score,
          de: "activité",
          info: { type: "vide" },
        };
      };
      const fSuivreNoms = (noms: { [key: string]: string }) => {
        infosCompte.noms = noms;
        fSuivreRecherche(calculerScore());
      };
      const fSuivreImage = (image: Uint8Array | null) => {
        infosCompte.image = image;
        fSuivreRecherche(calculerScore());
      };
      const fSuivreCourriel = (courriel: string | null | undefined) => {
        infosCompte.courriel = courriel;
        fSuivreRecherche(calculerScore());
      };

      const fOublierNoms = await client.réseau!.suivreNomsMembre({
        idCompte,
        f: fSuivreNoms,
      });
      const fOublierImage = await client.réseau!.suivreImageMembre({
        idCompte,
        f: fSuivreImage,
      });
      const fOublierCourriel = await client.réseau!.suivreCourrielMembre({
        idCompte,
        f: fSuivreCourriel,
      });

      const fOublier = () => {
        fOublierNoms();
        fOublierImage();
        fOublierCourriel();
      };

      return fOublier;
    };
  };

export const rechercherProfilSelonNom = (
  nom: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (noms: { [key: string]: string }) => {
      const corresp = similTexte(nom, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.réseau!.suivreNomsMembre({
      idCompte,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherProfilSelonCourriel = (
  courriel: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (courrielProfil: string | null | undefined) => {
      const corresp = courrielProfil
        ? rechercherDansTexte(courriel, courrielProfil)
        : undefined;

      if (corresp) {
        const { score, début, fin } = corresp;
        fSuivreRecherche({
          type: "résultat",
          score,
          de: "courriel",
          info: { type: "texte", début, fin, texte: courrielProfil! },
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.réseau!.suivreCourrielMembre({
      idCompte,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherProfilSelonTexte = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fRechercherNoms = rechercherProfilSelonNom(texte);
    const fRechercherCourriel = rechercherProfilSelonCourriel(texte);
    const fRechercherId = rechercherSelonId(texte);

    return await combinerRecherches(
      {
        noms: fRechercherNoms,
        courriel: fRechercherCourriel,
        id: fRechercherId,
      },
      client,
      idCompte,
      fSuivreRecherche
    );
  };
};

export const rechercherProfilSelonImage = (
  image: Uint8Array
): schémaFonctionSuivreObjectifRecherche<infoRésultatVide> => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatVide>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (imageCompte: Uint8Array | null) => {
      const score = similImages(image, imageCompte);
      fSuivreRecherche({
        type: "résultat",
        score,
        de: "image",
        info: { type: "vide" },
      });
    };
    const fOublier = await client.réseau!.suivreImageMembre({
      idCompte,
      f: fSuivre,
    });
    return fOublier;
  };
};
