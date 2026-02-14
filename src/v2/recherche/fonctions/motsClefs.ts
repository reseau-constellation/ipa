import { ignorerNonDéfinis } from "@constl/utils-ipa";
import {
  combinerRecherches,
  rechercherSelonId,
  rechercherTousSiVide,
  similTexte,
} from "./utils.js";
import type { ServicesNécessairesRechercheObjets } from "../recherche.js";
import type { TraducsTexte } from "@/v2/types.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type {
  AccesseurService,
  InfoRésultatTexte,
  InfoRésultatVide,
  SuiviRecherche,
  SuivreObjectifRecherche,
} from "../types.js";
import type { ServicesLibp2pNébuleuse } from "@/v2/nébuleuse/services/libp2p/libp2p.js";
import type { MotsClefs } from "@/v2/motsClefs.js";

export type ServicesNécessairesRechercheMotsClefs =
  ServicesNécessairesRechercheObjets<ServicesLibp2pNébuleuse> & {
    motsClefs: MotsClefs<ServicesLibp2pNébuleuse>;
  };

export const rechercherMotsClefsSelonNom = (
  nomMotClef: string,
): SuivreObjectifRecherche<
  InfoRésultatTexte,
  ServicesNécessairesRechercheMotsClefs
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheMotsClefs>;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = async (noms: TraducsTexte) => {
      const corresp = similTexte({ texte: nomMotClef, possibilités: noms });
      if (corresp) {
        const { score, clef, info } = corresp;
        return await f({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        return await f();
      }
    };
    const oublier = await services("motsClefs").suivreNoms({
      idMotClef: idObjet,
      f: ignorerNonDéfinis(fSuivre),
    });
    return oublier;
  };
};

export const rechercherMotsClefsSelonDescription = (
  descriptionMotClef: string,
): SuivreObjectifRecherche<
  InfoRésultatTexte,
  ServicesNécessairesRechercheMotsClefs
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheMotsClefs>;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = async (noms: TraducsTexte) => {
      const corresp = similTexte({
        texte: descriptionMotClef,
        possibilités: noms,
      });
      if (corresp) {
        const { score, clef, info } = corresp;
        return await f({
          type: "résultat",
          score,
          clef,
          info,
          de: "descriptions",
        });
      } else {
        return await f();
      }
    };
    const oublier = await services("motsClefs").suivreDescriptions({
      idMotClef: idObjet,
      f: fSuivre,
    });
    return oublier;
  };
};

export const rechercherMotsClefsSelonTexte = (
  texte: string,
): SuivreObjectifRecherche<
  InfoRésultatTexte | InfoRésultatVide,
  ServicesNécessairesRechercheMotsClefs
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheMotsClefs>;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte | InfoRésultatVide>;
  }): Promise<Oublier> => {
    const fRechercherNoms = rechercherMotsClefsSelonNom(texte);
    const fRechercherDescriptions = rechercherMotsClefsSelonDescription(texte);
    const fRechercherId = rechercherSelonId(texte);
    const fRechercherTous = rechercherTousSiVide(texte);

    return await combinerRecherches({
      fsRecherche: {
        noms: fRechercherNoms,
        id: fRechercherId,
        descriptions: fRechercherDescriptions,
        vide: fRechercherTous,
      },
      services,
      idObjet,
      fSuivreRecherche: f,
    });
  };
};
