import { ignorerNonDéfinis } from "@constl/utils-ipa";
import {
  combinerRecherches,
  rechercherSelonId,
  rechercherTousSiVide,
  similTexte,
} from "./utils.js";
import type {
  InfoRésultatTexte,
  InfoRésultatVide,
  SuiviRecherche,
  SuivreObjectifRecherche,
} from "../types.js";
import type { Constellation } from "@/v2/index.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";

export const rechercherVariablesSelonNom = (
  nom: string,
): SuivreObjectifRecherche<InfoRésultatTexte> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = async (nomsVariable: { [key: string]: string }) => {
      const résultat = similTexte({ texte: nom, possibilités: nomsVariable });
      if (résultat) {
        const { score, clef, info } = résultat;
        return await f({
          type: "résultat",
          score,
          de: "nom",
          clef,
          info,
        });
      } else {
        return await f();
      }
    };
    const oublier = await constl.variables.suivreNoms({
      idVariable: idObjet,
      f: ignorerNonDéfinis(fSuivre),
    });
    return oublier;
  };
};

export const rechercherVariablesSelonDescription = (
  description: string,
): SuivreObjectifRecherche<InfoRésultatTexte> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = async (nomsVariable: { [key: string]: string }) => {
      const résultat = similTexte({
        texte: description,
        possibilités: nomsVariable,
      });
      if (résultat) {
        const { score, clef, info } = résultat;
        return await f({
          type: "résultat",
          score,
          de: "descriptions",
          clef,
          info,
        });
      } else {
        return await f();
      }
    };
    const oublier = await constl.variables.suivreDescriptions({
      idVariable: idObjet,
      f: fSuivre,
    });
    return oublier;
  };
};

export const rechercherVariablesSelonTexte = (
  texte: string,
): SuivreObjectifRecherche<InfoRésultatTexte | InfoRésultatVide> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte | InfoRésultatVide>;
  }): Promise<Oublier> => {
    const fRechercherNoms = rechercherVariablesSelonNom(texte);
    const fRechercherDescriptions = rechercherVariablesSelonDescription(texte);
    const fRechercherId = rechercherSelonId(texte);
    const fRechercherTous = rechercherTousSiVide(texte);

    return await combinerRecherches({
      fsRecherche: {
        noms: fRechercherNoms,
        descriptions: fRechercherDescriptions,
        id: fRechercherId,
        vide: fRechercherTous,
      },
      constl,
      idObjet,
      fSuivreRecherche: f,
    });
  };
};
