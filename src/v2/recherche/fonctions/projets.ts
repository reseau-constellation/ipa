import { rechercherBdsSelonTexte } from "./bds.js";
import {
  rechercherMotsClefsSelonNom,
  rechercherMotsClefsSelonTexte,
} from "./motsClefs.js";
import {
  similTexte,
  rechercherSelonId,
  sousRecherche,
  rechercherTousSiVide,
  combinerRecherches,
} from "./utils.js";
import {
  rechercherVariablesSelonNom,
  rechercherVariablesSelonTexte,
} from "./variables.js";
import type { ServicesConstellation } from "@/v2/constellation.js";
import type {
  SuivreObjectifRecherche,
  InfoRésultatTexte,
  SuiviRecherche,
  InfoRésultatRecherche,
  InfoRésultatVide,
} from "../types.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";

export const rechercherProjetsSelonNom = (
  nomProjet: string,
): SuivreObjectifRecherche<InfoRésultatTexte> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: ServicesConstellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = (noms: TraducsTexte) => {
      const corresp = similTexte({ texte: nomProjet, possibilités: noms });
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
    const oublier = await services.projets.suivreNoms({
      idProjet: idObjet,
      f: fSuivre,
    });
    return oublier;
  };
};

export const rechercherProjetsSelonDescription = (
  descProjet: string,
): SuivreObjectifRecherche<InfoRésultatTexte> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: ServicesConstellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = (descrs: TraducsTexte) => {
      const corresp = similTexte({ texte: descProjet, possibilités: descrs });
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
    const oublier = await services.projets.suivreDescriptions({
      idProjet: idObjet,
      f: fSuivre,
    });
    return oublier;
  };
};

export const rechercherProjetsSelonIdBd = (
  idBd: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: ServicesConstellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await services.projets.suivreBds({
        idProjet: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idBd);

    return await sousRecherche({
      de: "bd",
      fListe,
      fRechercher,
      services,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherProjetsSelonBd = (
  texte: string,
): SuivreObjectifRecherche<
  InfoRésultatRecherche<
    | InfoRésultatTexte
    | InfoRésultatRecherche<InfoRésultatTexte>
    | InfoRésultatVide
  >
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: ServicesConstellation;
    idObjet: string;
    f: SuiviRecherche<
      InfoRésultatRecherche<
        | InfoRésultatTexte
        | InfoRésultatRecherche<InfoRésultatTexte>
        | InfoRésultatVide
      >
    >;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await services.projets.suivreBds({
        idProjet: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherBdsSelonTexte(texte);

    return await sousRecherche({
      de: "bd",
      fListe,
      fRechercher,
      services,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherProjetsSelonIdVariable = (
  idVariable: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: ServicesConstellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await services.projets.suivreVariables({
        idProjet: idObjet,
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

export const rechercherProjetsSelonNomVariable = (
  nomVariable: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: ServicesConstellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await services.projets.suivreVariables({
        idProjet: idObjet,
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

export const rechercherProjetsSelonVariable = (
  texte: string,
): SuivreObjectifRecherche<
  InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: ServicesConstellation;
    idObjet: string;
    f: SuiviRecherche<
      InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
    >;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await services.projets.suivreVariables({
        idProjet: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherVariablesSelonTexte(texte);

    return await sousRecherche({
      de: "variable",
      fListe,
      fRechercher,
      services,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherProjetsSelonIdMotClef = (
  idMotClef: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: ServicesConstellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (motsClefs: string[]) => void;
    }): Promise<Oublier> => {
      return await services.projets.suivreMotsClefs({
        idProjet: idObjet,
        f: (motsClefs) => fSuivreRacine(motsClefs.map((m) => m.idMotClef)),
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

export const rechercherProjetsSelonNomMotClef = (
  nomMotClef: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: ServicesConstellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (motsClefs: string[]) => void;
    }): Promise<Oublier> => {
      return await services.projets.suivreMotsClefs({
        idProjet: idObjet,
        f: (motsClefs) => fSuivreRacine(motsClefs.map((m) => m.idMotClef)),
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

export const rechercherProjetsSelonMotClef = (
  texte: string,
): SuivreObjectifRecherche<
  InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: ServicesConstellation;
    idObjet: string;
    f: SuiviRecherche<
      InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
    >;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (motsClefs: string[]) => void;
    }): Promise<Oublier> => {
      return await services.projets.suivreMotsClefs({
        idProjet: idObjet,
        f: (motsClefs) => fSuivreRacine(motsClefs.map((m) => m.idMotClef)),
      });
    };

    const fRechercher = rechercherMotsClefsSelonTexte(texte);

    return await sousRecherche({
      de: "motClef",
      fListe,
      fRechercher,
      services,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherProjetsSelonTexte = (
  texte: string,
): SuivreObjectifRecherche<
  | InfoRésultatTexte
  | InfoRésultatRecherche<
      | InfoRésultatTexte
      | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
      | InfoRésultatVide
    >
  | InfoRésultatVide
> => {
  return async ({
    services,
    idObjet,
    f,
  }: {
    services: ServicesConstellation;
    idObjet: string;
    f: SuiviRecherche<
      | InfoRésultatTexte
      | InfoRésultatRecherche<
          | InfoRésultatTexte
          | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
          | InfoRésultatVide
        >
      | InfoRésultatVide
    >;
  }): Promise<Oublier> => {
    const fRechercherNoms = rechercherProjetsSelonNom(texte);
    const fRechercherDescription = rechercherProjetsSelonDescription(texte);
    const fRechercherBd = rechercherProjetsSelonBd(texte);
    const fRechercherVariable = rechercherProjetsSelonVariable(texte);
    const fRechercherMotClef = rechercherProjetsSelonMotClef(texte);
    const fRechercherId = rechercherSelonId(texte);
    const fRechercherTous = rechercherTousSiVide(texte);

    return await combinerRecherches<
      | InfoRésultatTexte
      | InfoRésultatRecherche<
          | InfoRésultatTexte
          | InfoRésultatVide
          | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
        >
      | InfoRésultatVide
    >({
      fsRecherche: {
        noms: fRechercherNoms,
        descriptions: fRechercherDescription,
        bd: fRechercherBd,
        variable: fRechercherVariable,
        motClef: fRechercherMotClef,
        id: fRechercherId,
        tous: fRechercherTous,
      },
      services,
      idObjet,
      fSuivreRecherche: f,
    });
  };
};
