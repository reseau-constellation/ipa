import ssim from "ssim";

import ClientConstellation from "@/client";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaFonctionRecherche,
} from "@/utils"

import {
  levenshtein01,
  maxLevenshtein01,
  combinerRecherches,
 } from "./utils";


export const rechercherProfilSelonActivité: () => schémaFonctionRecherche = () => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuivi<number>
  ): Promise<schémaFonctionOublier> => {
    const infosCompte: {
      noms: {[key: string]: string},
      image?: Uint8Array | null,
      courriel?: string | null
    } = {
      noms: {},
      image: undefined,
      courriel: undefined
    }
    const calculerScore = () => {
      return [
        Object.keys(infosCompte.noms).length > 0,
        infosCompte.image,
        infosCompte.courriel
      ].filter(Boolean).length
    }
    const fSuivreNoms = (noms: {[key: string]: string}) => {
      infosCompte.noms = noms
      fSuivreRecherche(calculerScore())
    }
    const fSuivreImage = (image: Uint8Array | null) => {
      infosCompte.image = image;
      fSuivreRecherche(calculerScore())
    }
    const fSuivreCourriel = (courriel: string | null) => {
      infosCompte.courriel = courriel;
      fSuivreRecherche(calculerScore())
    }
    const fOublierNoms = await client.profil!.suivreNoms(fSuivreNoms, idCompte);
    const fOublierImage = await client.profil!.suivreImage(fSuivreImage, idCompte);
    const fOublierCourriel = await client.profil!.suivreCourriel(fSuivreCourriel, idCompte);

    const fOublier = () => {
      fOublierNoms();
      fOublierImage();
      fOublierCourriel();
    }
    return fOublier
  }
}

export const rechercherProfilSelonNom: (nom: string) => schémaFonctionRecherche = (
  nom: string
) => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuivi<number>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (noms: {[key: string]: string}) => {
      const score = maxLevenshtein01(nom, Object.values(noms).filter(x=>x))
      fSuivreRecherche(Math.max(score, 0));
    }
    const fOublier = await client.profil!.suivreNoms(fSuivre, idCompte);
    return fOublier;
  }
}

export const rechercherProfilSelonCourriel: (courriel: string) => schémaFonctionRecherche = (
  courriel: string
) => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuivi<number>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (courrielProfil: string | null) => {
      const score = courrielProfil ? levenshtein01(courrielProfil, courriel): 0;
      fSuivreRecherche(score);
    }
    const fOublier = await client.profil!.suivreCourriel(fSuivre, idCompte)
    return fOublier;
  }
}

export const rechercherProfilSelonTexte: (texte: string) => schémaFonctionRecherche = (
  texte: string
) => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuivi<number>
  ): Promise<schémaFonctionOublier> => {

    const fRechercherNoms = rechercherProfilSelonNom(texte);
    const fRechercherCourriel = rechercherProfilSelonCourriel(texte);

    return await combinerRecherches(
      { noms: fRechercherNoms, courriel: fRechercherCourriel },
      client,
      idCompte,
      fSuivreRecherche
    )
  }
}

export const rechercherProfilSelonImage: (image: Uint8Array) => schémaFonctionRecherche = (
  image: Uint8Array
) => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuivi<number>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (imageCompte: Uint8Array | null) => {
      const { mssim } = ssim(image, imageCompte);
      fSuivreRecherche(mssim);
    }
    const fOublier = await client.profil!.suivreImage(fSuivre, idCompte)
    return fOublier;
  }
}
