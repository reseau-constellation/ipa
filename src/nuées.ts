import {
  faisRien,
  ignorerNonDéfinis,
  suivreFonctionImbriquée,
  suivreDeFonctionListe,
  traduire,
} from "@constl/utils-ipa";
import Base64 from "crypto-js/enc-base64.js";
import md5 from "crypto-js/md5.js";

import { ComposanteClientListe } from "./v2/nébuleuse/services.js";
import type {
  donnéesTableauExportation,
  élémentDonnées,
  différenceTableaux,
  InfoColAvecCatégorie,
  élémentBdListeDonnées,
} from "@/tableaux.js";
import type { Constellation } from "@/client.js";
import type {
  différenceBds,
  différenceTableauxBds,
  infoTableauAvecId,
} from "@/bds.js";
import type { élémentDeMembreAvecValid } from "@/reseau.js";
import type {
  TraducsTexte,
  schémaRetourFonctionRechercheParN,
  infoAuteur,
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaRetourFonctionRechercheParProfondeur,
} from "@/types.js";
import type { erreurValidation, règleVariable } from "@/valid.js";
import { cacheRechercheParProfondeur, cacheSuivi } from "@/décorateursCache.js";
import { schémaBdTableauxDeBd } from "@/bds.js";

export type correspondanceBdEtNuée = {
  nuée: string;
  différences: différenceBds[];
};

export type statutMembreNuée = {
  idCompte: string;
  statut: "exclus" | "accepté";
};

export type donnéesNuéeExportation = {
  nomNuée: string;
  tableaux: donnéesTableauExportation[];
};

export class Nuées extends ComposanteClientListe<string> {
  constructor({ client }: { client: Constellation }) {
    super({ client, clef: "nuées", schémaBdPrincipale: { type: "string" } });
  }

  /*
  async bloquerContenu({
    idNuée,
    // contenu,
  }: {
    idNuée: string;
    contenu: élémentsBd;
  }): Promise<void> {

    throw new Error("Pas encore implémenté")

    await this._confirmerPermission({idNuée});
    const idBdBloqués = await this.client.obtIdBd({
      nom: "bloqués",
      racine: idNuée,
      type: "keyvalue",
    });
    

    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdBloqués,
      type: "set",
      schéma: schémaBdContenuBloqué,
    });
    await bd.add({
      contenu,
    });
    fOublier(); 
  }*/

  async suivreContenuBloqué() {}

  async réordonnerTableauNuée({
    idNuée,
    idTableau,
    position,
  }: {
    idNuée: string;
    idTableau: string;
    position: number;
  }): Promise<void> {
    await this._confirmerPermission({ idNuée });
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idNuée,
      type: "ordered-keyvalue",
    });

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdTableaux,
      type: "ordered-keyvalue",
      schéma: schémaBdTableauxDeBd,
    });

    const tableauxExistants = await bdTableaux.all();
    const positionExistante = tableauxExistants.findIndex(
      (t) => t.key === idTableau,
    );
    if (position !== positionExistante)
      await bdTableaux.move(idTableau, position);
    await fOublier();
  }

  @cacheSuivi
  async suivreCorrespondanceBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<correspondanceBdEtNuée[]>;
  }): Promise<schémaFonctionOublier> {
    const fSuivreNuéesDeBd = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsNuées: string[]) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.bds.suivreNuéesBd({
        idBd,
        f: fSuivreRacine,
      });
    };
    const fSuivreNuée = async ({
      id: idNuée,
      fSuivreBranche: fSuivreBrancheNuée,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<différenceBds[]>;
    }): Promise<schémaFonctionOublier> => {
      const info: {
        différencesBds: différenceBds[];
        différencesTableaux: différenceTableauxBds[];
      } = {
        différencesBds: [],
        différencesTableaux: [],
      };

      const fFinaleNuée = async () => {
        fSuivreBrancheNuée([
          ...info.différencesBds,
          ...info.différencesTableaux,
        ]);
      };

      const fOublierDifférencesBd = await this.suivreDifférencesNuéeEtBd({
        idNuée,
        idBd,
        f: async (différences) => {
          info.différencesBds = différences;
          await fFinaleNuée();
        },
      });

      const fBranche = async ({
        id,
        fSuivreBranche,
        branche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<différenceTableauxBds[]>;
        branche: infoTableauAvecId;
      }): Promise<schémaFonctionOublier> => {
        return await this.suivreDifférencesNuéeEtTableau({
          idNuée,
          clefTableau: branche.clef,
          idTableau: id,
          f: async (diffs) => {
            await fSuivreBranche(
              diffs.map((d) => {
                return {
                  type: "tableau",
                  sévère: d.sévère,
                  idTableau: id,
                  différence: d,
                };
              }),
            );
          },
        });
      };

      const fOublierDifférencesTableaux = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (idsTableaux: infoTableauAvecId[]) => Promise<void>;
        }): Promise<schémaFonctionOublier> => {
          return await this.client.bds.suivreTableauxBd({
            idBd,
            f: fSuivreRacine,
          });
        },
        f: async (diffs: différenceTableauxBds[]) => {
          info.différencesTableaux = diffs;
          await fFinaleNuée();
        },
        fBranche,
        fIdDeBranche: (t) => t.id,
      });

      return async () => {
        await Promise.allSettled([
          fOublierDifférencesBd,
          fOublierDifférencesTableaux,
        ]);
      };
    };

    return await suivreDeFonctionListe({
      fListe: fSuivreNuéesDeBd,
      f,
      fBranche: fSuivreNuée,
    });
  }

  @cacheSuivi
  async suivreNuéesParents({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    let annulé = false;
    const ascendance: {
      [nuée: string]: { parent: string; fOublier: schémaFonctionOublier };
    } = {};

    const fFinale = async () => {
      await f(Object.values(Object.values(ascendance).map((a) => a.parent)));
    };
    const suivreParent = async ({
      id,
    }: {
      id: string;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.suivreBd({
        id,
        type: "keyvalue",
        schéma: schémaStructureBdNuée,
        f: async (bd) => {
          if (annulé) return;

          const parent = await bd.get("parent");
          if (ascendance[id]?.parent === parent) {
            if (!parent) await fFinale();
            return;
          }

          await ascendance[id]?.fOublier();
          if (parent) {
            const fOublierParent = await suivreParent({ id: parent });
            ascendance[id] = {
              parent,
              fOublier: async () => {
                await fOublierParent();
                await ascendance[parent]?.fOublier();
                delete ascendance[id];
                await fFinale();
              },
            };
          } else {
            delete ascendance[id];
          }

          await fFinale();
        },
      });
    };
    const fOublier = await suivreParent({ id: idNuée });
    return async () => {
      annulé = true;
      await fOublier();
      await Promise.allSettled(
        Object.values(ascendance).map((a) => a.fOublier()),
      );
    };
  }

  @cacheRechercheParProfondeur
  async suivreBdsCorrespondantes({
    idNuée,
    f,
    nRésultatsDésirés,
    héritage,
    vérifierAutorisation = true,
    toujoursInclureLesMiennes = true,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
    nRésultatsDésirés?: number;
    héritage?: ("descendance" | "ascendance")[];
    vérifierAutorisation?: boolean;
    toujoursInclureLesMiennes?: boolean;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const info: {
      ascendance?: string[];
      descendance?: string[];
      directes?: string[];
    } = {};
    const fsOublier: schémaFonctionOublier[] = [];

    const fFinale = async () => {
      if (!info.directes) return;
      const finaux = [
        ...new Set([
          ...(info.ascendance || []),
          ...(info.descendance || []),
          ...info.directes,
        ]),
      ];
      return await f(finaux);
    };

    if (héritage && héritage.includes("ascendance")) {
      const fOublierAscendance = await this.suivreDeParents({
        idNuée,
        f: async (bds: string[][]) => {
          const finales: string[] = [];
          bds.forEach((l) =>
            l.forEach((bd) => {
              if (!finales.includes(bd)) finales.push(bd);
            }),
          );
          info.ascendance = finales;
          await fFinale();
        },
        fParents: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: schémaFonctionSuivi<string[]>;
        }): Promise<schémaFonctionOublier> => {
          return (
            await this.suivreBdsCorrespondantesDUneNuée({
              idNuée: id,
              f: fSuivreBranche,
              nRésultatsDésirés,
              vérifierAutorisation,
              toujoursInclureLesMiennes,
            })
          ).fOublier;
        },
      });
      fsOublier.push(fOublierAscendance);
    }
    if (héritage && héritage.includes("descendance")) {
      const { fOublier: fOublierDescendance } = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (parents: string[]) => Promise<void>;
        }): Promise<schémaRetourFonctionRechercheParN> => {
          return await this.rechercherNuéesDéscendantes({
            idNuée,
            f: (parents) => fSuivreRacine([idNuée, ...parents].reverse()),
          });
        },
        f: async (bds: string[]) => {
          info.descendance = bds;
          await fFinale();
        },
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: schémaFonctionSuivi<string[]>;
        }): Promise<schémaFonctionOublier> => {
          return (
            await this.suivreBdsCorrespondantesDUneNuée({
              idNuée: id,
              f: fSuivreBranche,
              nRésultatsDésirés,
              vérifierAutorisation,
              toujoursInclureLesMiennes,
            })
          ).fOublier;
        },
      });
      fsOublier.push(fOublierDescendance);
    }

    const { fOublier: fOublierDirectes, fChangerProfondeur } =
      await this.suivreBdsCorrespondantesDUneNuée({
        idNuée,
        f: async (bds) => {
          info.directes = bds;
          await fFinale();
        },
        nRésultatsDésirés,
        vérifierAutorisation,
        toujoursInclureLesMiennes,
      });
    fsOublier.push(fOublierDirectes);

    return {
      fOublier: async () => {
        await Promise.allSettled(fsOublier.map((f) => f()));
      },
      fChangerProfondeur,
    };
  }

  @cacheSuivi
  async suivreEmpreinteTêtesBdsNuée({
    idNuée,
    f,
    héritage,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string>;
    héritage?: ("descendance" | "ascendance")[];
  }): Promise<schémaFonctionOublier> {
    return await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: string[]) => Promise<void>;
      }) => {
        const { fOublier } = await this.suivreBdsCorrespondantes({
          idNuée,
          f: async (bds) => await fSuivreRacine([idNuée, ...bds]),
          héritage,
        });
        return fOublier;
      },
      f: async (empreintes: string[]) => {
        const empreinte = Base64.stringify(md5(empreintes.join(":")));
        return await f(empreinte);
      },
      fBranche: async ({
        id,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: schémaFonctionSuivi<string>;
      }) => {
        return await this.client.suivreEmpreinteTêtesBdRécursive({
          idBd: id,
          f: fSuivreBranche,
        });
      },
    });
  }

  @cacheRechercheParProfondeur
  async suivreDonnéesTableauNuée<T extends élémentBdListeDonnées>({
    idNuée,
    clefTableau,
    f,
    nRésultatsDésirés,
  }: {
    idNuée: string;
    clefTableau: string;
    f: schémaFonctionSuivi<élémentDeMembreAvecValid<T>[]>;
    nRésultatsDésirés?: number;
    héritage?: ("descendance" | "ascendance")[];
    ignorerErreursFormatBd?: boolean;
    ignorerErreursFormatTableau?: boolean;
    ignorerErreursDonnéesTableau?: boolean;
    licencesPermises?: string[];
    toujoursInclureLesMiennes?: boolean;
    clefsSelonVariables?: boolean;
    vérifierAutorisation?: boolean;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const fFinale = async (
      donnéesTableaux: élémentDeMembreAvecValid<T>[][],
    ) => {
      const éléments = donnéesTableaux.flat();
      await f(éléments);
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (bds: string[]) => Promise<void>;
    }): Promise<schémaRetourFonctionRechercheParProfondeur> => {
      return await this.suivreBdsCorrespondantes({
        idNuée,
        f: async (bds) => {
          return await fSuivreRacine(bds);
        },
        nRésultatsDésirés,
        héritage,
        toujoursInclureLesMiennes,
        vérifierAutorisation,
      });
    };

    const fSuivreBdsConformes = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (bds: string[]) => Promise<void>;
    }): Promise<schémaRetourFonctionRechercheParProfondeur> => {
      const fCondition = async (
        idBd: string,
        fSuivreCondition: schémaFonctionSuivi<boolean>,
      ): Promise<schémaFonctionOublier> => {
        const conformes: { licence: boolean; formatBd: boolean } = {
          licence: false,
          formatBd: true, // Ça doit être vrai par défaut, en attendant de rejoindre la nuée distante
        };
        const fsOublier: schémaFonctionOublier[] = [];

        const fFinaleBdConforme = async () => {
          const conforme = Object.values(conformes).every((x) => x);
          await fSuivreCondition(conforme);
        };

        if (licencesPermises) {
          const fOublierLicence = await this.client.bds.suivreLicenceBd({
            idBd,
            f: async (licence) => {
              conformes.licence = licencesPermises.includes(licence);
              return await fFinaleBdConforme();
            },
          });
          fsOublier.push(fOublierLicence);
        } else {
          conformes.licence = true;
        }

        if (ignorerErreursFormatBd) {
          conformes.formatBd = true;
        } else {
          const fOublierErreursFormatBd = await this.suivreDifférencesNuéeEtBd({
            idBd,
            idNuée,
            f: async (différences) => {
              conformes.formatBd = !différences.length;
              return await fFinaleBdConforme();
            },
          });
          fsOublier.push(fOublierErreursFormatBd);
        }
        await fFinaleBdConforme();

        return async () => {
          await Promise.allSettled(fsOublier.map((f) => f()));
        };
      };
      return await this.client.suivreBdsSelonCondition({
        fListe,
        fCondition,
        f: fSuivreRacine,
      });
    };

    const fBranche = async ({
      id: idBd,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: schémaFonctionSuivi<élémentDeMembreAvecValid<T>[]>;
    }): Promise<schémaFonctionOublier> => {
      const info: {
        auteurs?: infoAuteur[];
        données?: élémentDonnées<T>[];
        erreursÉléments?: erreurValidation[];
        erreursTableau?: différenceTableaux[];
      } = {};

      const fFinaleBranche = async () => {
        const { données, erreursÉléments, auteurs } = info;
        if (données && erreursÉléments && auteurs && auteurs.length) {
          const auteur = auteurs.find((a) => a.accepté)?.idCompte;
          if (!auteur) return;

          const donnéesMembres: élémentDeMembreAvecValid<T>[] = données
            .map((d) => {
              return {
                idCompte: auteur,
                élément: d,
                valid: erreursÉléments.filter((e) => e.id == d.id),
              };
            })
            .filter((d) => ignorerErreursDonnéesTableau || !d.valid.length);
          await fSuivreBranche(donnéesMembres);
        }
      };

      const fSuivreTableau = async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<{
          données?: élémentDonnées<T>[];
          erreurs?: erreurValidation<règleVariable>[];
        }>;
      }): Promise<schémaFonctionOublier> => {
        const infoTableau: {
          données?: élémentDonnées<T>[];
          erreurs?: erreurValidation<règleVariable>[];
        } = {};
        const fsOublier: schémaFonctionOublier[] = [];

        const fFinaleTableau = async () => {
          const { données, erreurs } = infoTableau;
          if (données) {
            await fSuivreBd({ données, erreurs: erreurs || [] });
          }
        };
        const fOublierDonnnées = await this.client.tableaux.suivreDonnées<T>({
          idTableau: id,
          f: async (données) => {
            infoTableau.données = données;
            await fFinaleTableau();
          },
          clefsSelonVariables,
        });
        fsOublier.push(fOublierDonnnées);

        const fOublierErreurs = await this.client.tableaux.suivreValidDonnées({
          idTableau: id,
          f: async (erreurs) => {
            infoTableau.erreurs = erreurs;
            await fFinaleTableau();
          },
        });
        fsOublier.push(fOublierErreurs);

        return async () => {
          await Promise.allSettled(fsOublier.map((f) => f()));
        };
      };

      const fOublierSuivreTableau = await suivreFonctionImbriquée<{
        données?: élémentDonnées<T>[];
        erreurs?: erreurValidation<règleVariable>[];
      }>({
        fRacine: async ({ fSuivreRacine }) => {
          return await this.client.suivreBdSelonCondition({
            fRacine: async (
              fSuivreRacineListe: (id: string) => Promise<void>,
            ) => {
              return await this.client.bds.suivreIdTableauParClef({
                idBd,
                clef: clefTableau,
                f: ignorerNonDéfinis(fSuivreRacineListe),
              });
            },
            fCondition: async (
              idTableau: string,
              fSuivreCondition: schémaFonctionSuivi<boolean>,
            ) => {
              if (ignorerErreursFormatTableau) {
                await fSuivreCondition(true);
                return faisRien;
              } else {
                // Il faut envoyer une condition vraie par défaut au début au cas où la nuée ne serait pas rejoignable
                await fSuivreCondition(true);

                return await this.suivreDifférencesNuéeEtTableau({
                  idNuée,
                  clefTableau,
                  idTableau,
                  f: async (différences) =>
                    await fSuivreCondition(!différences.length),
                  stricte: false,
                });
              }
            },
            f: fSuivreRacine,
          });
        },
        f: async (x) => {
          info.données = x?.données;
          info.erreursÉléments = x?.erreurs;
          await fFinaleBranche();
        },
        fSuivre: fSuivreTableau,
      });

      const fOublierAuteursBd = await this.client.réseau.suivreAuteursBd({
        idBd,
        f: async (auteurs) => {
          info.auteurs = auteurs;
          await fFinaleBranche();
        },
      });

      return async () => {
        await Promise.allSettled([fOublierSuivreTableau, fOublierAuteursBd]);
      };
    };

    return await suivreDeFonctionListe({
      fListe: fSuivreBdsConformes,
      f: fFinale,
      fBranche,
    });
  }
}
