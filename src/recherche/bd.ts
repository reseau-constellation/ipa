import ClientConstellation from "@/client";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaFonctionRecherche,
} from "@/utils"

import {
  maxLevenshtein01,
  combinerRecherches,
 } from "./utils";

export const rechercherBdSelonIdVariable: (idVariable: string) => schémaFonctionRecherche = (
  idVariable: string
) => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuivi<number>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (variables: string[]) => {
      const score = maxLevenshtein01(idVariable, variables);
      fSuivreRecherche(score);
    }
    const fOublier = await client.bds!.suivreVariablesBd(idBd, fSuivre)
    return fOublier;
  }
}

export const rechercherBdSelonNomVariable: (nomVariable: string) => schémaFonctionRecherche = (
  nomVariable: string
) => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuivi<number>
  ): Promise<schémaFonctionOublier> => {
    const fSuivreNomsVar = (variables: string[]) => {
      const score = maxLevenshtein01(nomVariable, variables);
      fSuivreRecherche(score);
    }

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await client.bds!.suivreVariablesBd(idBd, fSuivreRacine);
    };

    const fBranche = async (
      idVariable: string,
      f: schémaFonctionSuivi<{[key: string]: string}>
    ) => {
      return await client.variables!.suivreNomsVariable(
        idVariable,
        f
      )
    }

    const fOublier = await client.suivreBdsDeFonctionListe(fListe, fSuivreNomsVar, fBranche)
    return fOublier;
  }
}

export const rechercherBdSelonVariable: (texte: string) => schémaFonctionRecherche = (
  texte: string
) => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuivi<number>
  ) => {
    return await combinerRecherches(
      {
        id: rechercherBdSelonIdVariable(texte),
        nom: rechercherBdSelonNomVariable(texte)
      },
      client,
      idBd,
      fSuivreRecherche
    )
  }
}

export const rechercherBdSelonIdMotClef: (idMotClef: string) => schémaFonctionRecherche = (
  idMotClef: string
) => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuivi<number>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (motClefs: string[]) => {
      const score = maxLevenshtein01(idMotClef, motClefs);
      fSuivreRecherche(score);
    }
    const fOublier = await client.bds!.suivreMotsClefsBd(idBd, fSuivre)
    return fOublier;
  }
}

export const rechercherBdSelonNomMotClef: (nomMotClef: string) => schémaFonctionRecherche = (
  nomMotClef: string
) => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuivi<number>
  ): Promise<schémaFonctionOublier> => {
    const fSuivreNomsMotClef = (motsClefs: string[]) => {
      const score = maxLevenshtein01(nomMotClef, motsClefs);
      fSuivreRecherche(score);
    }

    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await client.bds!.suivreMotsClefsBd(idBd, fSuivreRacine);
    };

    const fBranche = async (
      idMotClef: string,
      f: schémaFonctionSuivi<{[key: string]: string}>
    ) => {
      return await client.motsClefs!.suivreNomsMotClef(
        idMotClef,
        f
      )
    }

    const fOublier = await client.suivreBdsDeFonctionListe(fListe, fSuivreNomsMotClef, fBranche)
    return fOublier;
  }
}

export const rechercherBdSelonMotClef: (texte: string) => schémaFonctionRecherche = (
  texte: string
) => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuivi<number>
  ) => {
    return await combinerRecherches(
      {
        id: rechercherBdSelonIdMotClef(texte),
        nom: rechercherBdSelonNomMotClef(texte)
      },
      client,
      idBd,
      fSuivreRecherche
    )
  }
}
