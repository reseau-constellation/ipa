import { rechercherVariablesSelonNom } from "../../../src/recherche/fonctions/variables.ts";
import {
  combinerRecherches,
  rechercherSelonId,
  rechercherTousSiVide,
  similTexte,
  sousRecherche,
} from "../../../src/recherche/fonctions/utils.ts";
import { rechercherMotsClefsSelonNom } from "./motsClefs.ts";
import type { Variables } from "../../../src/variables.ts";
import type { Nuées } from "../../../src/nuées/nuées.ts";
import type { SuivreObjectifRecherche, AccesseurService } from "../types.ts";
import type { ServicesNécessairesRechercheObjets } from "../recherche.ts";
import type { MotsClefs } from "../../../src/motsClefs.ts";
import type { Oublier, TraducsTexte } from "@constl/interface";
import type {
  InfoRésultatTexte,
  SuiviRecherche,
  InfoRésultatRecherche,
  InfoRésultatVide,
} from "@constl/interface/recherche";

export type ServicesNécessairesRechercheNuées =
  ServicesNécessairesRechercheObjets & {
    nuées: Nuées;
    motsClefs: MotsClefs;
    variables: Variables;
  };

export const rechercherNuéesSelonNom = (
  nomNuée: string,
): SuivreObjectifRecherche<
  InfoRésultatTexte,
  ServicesNécessairesRechercheNuées
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheNuées>;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = (noms: TraducsTexte) => {
      const corresp = similTexte({ texte: nomNuée, possibilités: noms });
      if (corresp) {
        const { score, clef, info } = corresp;
        f({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        f();
      }
    };
    const oublier = await services("nuées").suivreNoms({
      idNuée: idObjet,
      f: fSuivre,
    });
    return oublier;
  };
};

export const rechercherNuéesSelonDescription = (
  descriptionNuée: string,
): SuivreObjectifRecherche<
  InfoRésultatTexte,
  ServicesNécessairesRechercheNuées
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheNuées>;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = (descriptions: TraducsTexte) => {
      const corresp = similTexte({
        texte: descriptionNuée,
        possibilités: descriptions,
      });
      if (corresp) {
        const { score, clef, info } = corresp;
        f({
          type: "résultat",
          score,
          clef,
          info,
          de: "descriptions",
        });
      } else {
        f();
      }
    };
    const oublier = await services("nuées").suivreDescriptions({
      idNuée: idObjet,
      f: fSuivre,
    });
    return oublier;
  };
};

export const rechercherNuéesSelonIdVariable = (
  idVariable: string,
): SuivreObjectifRecherche<
  InfoRésultatRecherche<InfoRésultatTexte>,
  ServicesNécessairesRechercheNuées
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheNuées>;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await services("nuées").suivreVariables({
        idNuée: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idVariable);

    return await sousRecherche({
      de: "variable",
      fListe,
      fRechercher,
      services,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherNuéesSelonNomVariable = (
  nomVariable: string,
): SuivreObjectifRecherche<
  InfoRésultatRecherche<InfoRésultatTexte>,
  ServicesNécessairesRechercheNuées
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheNuées>;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await services("nuées").suivreVariables({
        idNuée: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherVariablesSelonNom(nomVariable);

    return await sousRecherche({
      de: "variable",
      fListe,
      fRechercher,
      services,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherNuéesSelonVariable = (
  texte: string,
): SuivreObjectifRecherche<
  InfoRésultatRecherche<InfoRésultatTexte>,
  ServicesNécessairesRechercheNuées
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheNuées>;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }) => {
    return await combinerRecherches({
      fsRecherche: {
        id: rechercherNuéesSelonIdVariable(texte),
        nom: rechercherNuéesSelonNomVariable(texte),
      },
      services,
      idObjet,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherNuéesSelonIdMotClef = (
  idMotClef: string,
): SuivreObjectifRecherche<
  InfoRésultatRecherche<InfoRésultatTexte>,
  ServicesNécessairesRechercheNuées
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheNuées>;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await services("nuées").suivreMotsClefs({
        idNuée: idObjet,
        f: (motsClefs) => fSuivreRacine(motsClefs.map((m) => m.val)),
      });
    };

    const fRechercher = rechercherSelonId(idMotClef);

    return await sousRecherche({
      de: "motClef",
      fListe,
      fRechercher,
      services,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherNuéesSelonNomMotClef = (
  nomMotClef: string,
): SuivreObjectifRecherche<
  InfoRésultatRecherche<InfoRésultatTexte>,
  ServicesNécessairesRechercheNuées
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheNuées>;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await services("nuées").suivreMotsClefs({
        idNuée: idObjet,
        f: (motsClefs) => fSuivreRacine(motsClefs.map((m) => m.val)),
      });
    };

    const fRechercher = rechercherMotsClefsSelonNom(nomMotClef);

    return await sousRecherche({
      de: "motClef",
      fListe,
      fRechercher,
      services,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherNuéesSelonMotClef = (
  texte: string,
): SuivreObjectifRecherche<
  InfoRésultatRecherche<InfoRésultatTexte>,
  ServicesNécessairesRechercheNuées
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheNuées>;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }) => {
    return await combinerRecherches({
      fsRecherche: {
        id: rechercherNuéesSelonIdMotClef(texte),
        nom: rechercherNuéesSelonNomMotClef(texte),
      },
      services,
      idObjet,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherNuéesSelonTexte = (
  texte: string,
): SuivreObjectifRecherche<
  | InfoRésultatRecherche<InfoRésultatTexte>
  | InfoRésultatTexte
  | InfoRésultatVide,
  ServicesNécessairesRechercheNuées
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: AccesseurService<ServicesNécessairesRechercheNuées>;
    idObjet: string;
    f: SuiviRecherche<
      | InfoRésultatRecherche<InfoRésultatTexte>
      | InfoRésultatTexte
      | InfoRésultatVide
    >;
  }) => {
    return await combinerRecherches<
      | InfoRésultatRecherche<InfoRésultatTexte>
      | InfoRésultatTexte
      | InfoRésultatVide,
      ServicesNécessairesRechercheNuées
    >({
      fsRecherche: {
        nom: rechercherNuéesSelonNom(texte),
        descriptions: rechercherNuéesSelonDescription(texte),
        variables: rechercherNuéesSelonVariable(texte),
        motsClefs: rechercherNuéesSelonMotClef(texte),
        id: rechercherSelonId(texte),
        tous: rechercherTousSiVide(texte),
      },
      services,
      idObjet,
      fSuivreRecherche: f,
    });
  };
};
