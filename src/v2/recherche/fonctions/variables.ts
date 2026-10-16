import { ignorerNonDéfinis } from "@constl/utils-ipa";
import {
  combinerRecherches,
  rechercherSelonId,
  rechercherTousSiVide,
  similTexte,
} from "./utils.js";
import type { ServicesNécessairesRechercheObjets } from "../recherche.js";
import type {
  AccesseurService,
  InfoRésultatTexte,
  InfoRésultatVide,
  SuiviRecherche,
  SuivreObjectifRecherche,
} from "../types.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type { Variables } from "@/v2/variables.js";
import type { TraducsTexte } from "@/v2/types.js";

export type ServicesNécessairesRechercheVariables =
  ServicesNécessairesRechercheObjets & {
    variables: Variables;
  };

export const rechercherVariablesSelonNom = (
  nom: string,
): SuivreObjectifRecherche<
  InfoRésultatTexte,
  ServicesNécessairesRechercheVariables
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheVariables>;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = async (nomsVariable: TraducsTexte) => {
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
    const oublier = await services("variables").suivreNoms({
      idVariable: idObjet,
      f: ignorerNonDéfinis(fSuivre),
    });
    return oublier;
  };
};

export const rechercherVariablesSelonDescription = (
  description: string,
): SuivreObjectifRecherche<
  InfoRésultatTexte,
  ServicesNécessairesRechercheVariables
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheVariables>;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = async (nomsVariable: TraducsTexte) => {
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
    const oublier = await services("variables").suivreDescriptions({
      idVariable: idObjet,
      f: fSuivre,
    });
    return oublier;
  };
};

export const rechercherVariablesSelonTexte = (
  texte: string,
): SuivreObjectifRecherche<
  InfoRésultatTexte | InfoRésultatVide,
  ServicesNécessairesRechercheVariables
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheVariables>;
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
      services,
      idObjet,
      fSuivreRecherche: f,
    });
  };
};
