import { typedNested } from "@constl/bohr-db";
import { faisRien, ignorerNonDéfinis, suivreDeFonctionListe, suivreFonctionImbriquée, uneFois } from "@constl/utils-ipa";
import { toObject } from "@orbitdb/nested-db";
import { v4 as uuidv4 } from "uuid";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { Tableaux, schémaTableau } from "./tableaux.js";
import { ajouterProtocoleOrbite, extraireEmpreinte as enleverProtocoleOrbite } from "./utils.js";
import { schémaStatutDonnées, schémaTraducsTexte } from "./schémas.js";
import {
  DISPOSITIFS_INSTALLÉS,
  TOUS_DISPOSITIFS,
  résoudreDéfauts,
} from "./favoris.js";
import { cacheSuivi } from "./crabe/cache.js";
import { RechercheNuées } from "./recherche/nuées.js";
import { mapÀObjet } from "./crabe/utils.js";
import type { DagCborEncodable } from "@orbitdb/core";
import type {
  Rôle,
  AccèsUtilisateur,
} from "./crabe/services/compte/accès/types.js";
import type { TypedNested } from "@constl/bohr-db";
import type { Constellation, ServicesConstellation } from "./constellation.js";
import type { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import type { Oublier, Suivi } from "./crabe/types.js";
import type { DifférenceTableaux, InfoColonne, StructureTableau } from "./tableaux.js";
import type {
  InfoAuteur,
  Métadonnées,
  PartielRécursif,
  StatutDonnées,
  TraducsTexte,
} from "./types.js";
import type {
  BaseÉpingleFavoris,
  ÉpingleFavorisBooléenniséeAvecId,
} from "./favoris.js";
import type { DifférenceBDTableauManquant, DifférenceBDTableauSupplémentaire, DifférenceBds, DifférenceTableauxBds, ÉpingleBd } from "./bds/bds.js";
import type { JSONSchemaType } from "ajv";

// Types épingles

export type ÉpingleNuée = {
  type: "nuée";
  épingle: ContenuÉpingleNuée;
};

export type ContenuÉpingleNuée = BaseÉpingleFavoris & {
  bds: ÉpingleBd;
};

// Types spécification

export type SchémaNuée = {
  métadonnées?: Métadonnées;
  motsClefs?: string[];
  parent?: string;
  statut?: StatutDonnées;
  tableaux: {
    [idTableau: string]: {
      cols: {
        idColonne: string;
        idVariable?: string;
        index?: boolean;
      }[];
    };
  };
};

// Types tableaux
export type InfoTableauNuée = {
  id: string;
  source: string
}

// Types structure

export type AutorisationNuée = {
  type: "ouverte" | "par invitation";
  bloqués: { [id: string]: null };
  invités: { [id: string]: null };
};

export type StructureNuée = {
  type: "nuée";
  noms: TraducsTexte;
  descriptions: TraducsTexte;
  image: string;
  motsClefs: { [id: string]: null };
  métadonnées: Métadonnées;
  statut: StatutDonnées;
  autorisation: AutorisationNuée;
  tableaux: { [clef: string]: StructureTableau };
  parent: string;
  copiéeDe: { id: string };
};

export const schémaNuée: JSONSchemaType<PartielRécursif<StructureNuée>> = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    noms: schémaTraducsTexte,
    descriptions: schémaTraducsTexte,
    image: { type: "string", nullable: true },
    métadonnées: {
      type: "object",
      additionalProperties: true,
      required: [],
      nullable: true,
    },
    motsClefs: {
      type: "object",
      nullable: true,
      additionalProperties: {
        type: "null",
        nullable: true,
      },
    },
    statut: schémaStatutDonnées,
    autorisation: {
      type: "object",
      properties: {
        type: { type: "string", nullable: true },
        bloqués: {
          type: "object",
          nullable: true,
          additionalProperties: {
            type: "null",
            nullable: true,
          },
        },
        invités: {
          type: "object",
          nullable: true,
          additionalProperties: {
            type: "null",
            nullable: true,
          },
        },
      },
      nullable: true,
    },
    tableaux: {
      type: "object",
      additionalProperties: schémaTableau,
      nullable: true,
    },
    parent: { type: "string", nullable: true },
    copiéeDe: {
      type: "object",
      properties: {
        id: { type: "string", nullable: true },
      },
      nullable: true,
    },
  },
};

export type StructureServiceNuées = {
  [nuée: string]: null;
};

export const SchémaServiceNuées: JSONSchemaType<
  PartielRécursif<StructureServiceNuées>
> = {
  type: "object",
  additionalProperties: true,
  required: [],
};

export class Nuées<
  L extends ServicesLibp2pCrabe,
> extends ServiceDonnéesNébuleuse<
  "nuées",
  StructureServiceNuées,
  L,
  ServicesConstellation<L>
> {
  tableaux: Tableaux<L>;
  recherche: RechercheNuées<L>;

  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "nuées",
      nébuleuse,
      dépendances: ["bds", "compte", "orbite", "hélia"],
      options: {
        schéma: SchémaServiceNuées,
      },
    });

    this.tableaux = new Tableaux({
      service: (clef) => this.service(clef),
    });
    this.recherche = new RechercheNuées({
      nuées: this,
      constl: this.nébuleuse,
      service: (clef) => this.service(clef),
    });

    const favoris = this.service("favoris");
    favoris.inscrireRésolution({
      clef: "nuée",
      résolution: this.suivreRésolutionÉpingle.bind(this),
    });
  }

  @cacheSuivi
  async suivreNuées({
    f,
    idCompte,
  }: {
    f: Suivi<string[] | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const compte = this.service("compte");

    return await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }: { fSuivreRacine: Suivi<string[]> }) =>
        await this.suivreBd({
          idCompte,
          f: async (nuées) =>
            await fSuivreRacine(
              nuées ? Object.keys(nuées).map(ajouterProtocoleOrbite) : [],
            ),
        }),
      fBranche: async ({ id: idObjet, fSuivreBranche }) => {
        return await compte.suivrePermission({
          idObjet,
          idCompte,
          f: async (permission) =>
            await fSuivreBranche(permission ? idObjet : undefined),
        });
      },
      f,
    });
  }

  async créerNuée({
    parent,
    autorisation = "ouverte",
    épingler = true,
  }: {
    parent?: string;
    autorisation?: AutorisationNuée["type"];
    épingler?: boolean;
  } = {}): Promise<string> {
    const compte = this.service("compte");

    const { bd, oublier: oublierBd } = await compte.créerObjet({
      type: "nested",
    });
    const idNuée = bd.address;
    await oublierBd();
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    await this.ajouterÀMesNuées({ idNuée });

    if (épingler) await this.épingler({ idNuée });

    await nuée.put({
      type: "nuée",
      autorisation: {
        type: autorisation,
      },
      statut: { statut: "active" },
      parent,
    });

    await oublier();

    return idNuée;
  }

  async effacerNuée({ idNuée }: { idNuée: string }): Promise<void> {
    const orbite = this.service("orbite");

    // D'abord effacer l'entrée dans notre liste de Nuées
    await this.enleverDeMesNuées({ idNuée });

    // Enlever la nuée de nos favoris
    const favoris = this.service("favoris");
    await favoris.désépinglerFavori({ idObjet: idNuée });

    // enfin, effacer la Nuée elle-même
    await orbite.effacerBd({ id: idNuée });
  }

  async ajouterÀMesNuées({ idNuée }: { idNuée: string }): Promise<void> {
    const bd = await this.bd();
    await bd.put(enleverProtocoleOrbite(idNuée), null);
  }

  async enleverDeMesNuées({ idNuée }: { idNuée: string }): Promise<void> {
    const bd = await this.bd();
    await bd.del(enleverProtocoleOrbite(idNuée));
  }

  async créerSchémaDeNuée({ idNuée }: { idNuée: string }): Promise<SchémaBd> {
    const métadonnées = await uneFois<Métadonnées>((f) =>
      this.suivreMétadonnées({ idNuée, f }),
    );

    const motsClefs = await uneFois<string[]>((f) =>
      this.suivreMotsClefs({ idNuée, f }),
    );
    
    const statut = await uneFois<StatutDonnées | null>((f) =>
      this.suivreStatut({ idNuée, f }),
    );

    const idsTableaux = await uneFois<string[]>((f) =>
      this.suivreTableaux({ idNuée, f, ascendance: false }),
    );

    const tableaux: {
      idTableau: string;
      tableau: SchémaNuée["tableaux"][string];
    }[] = await Promise.all(
      idsTableaux.map(async (idTableau) => {
        const infoCols = await uneFois<InfoColonne[]>((f) =>
          this.tableaux.suivreColonnes({
            idStructure: idNuée,
            idTableau,
            f: ignorerNonDéfinis(f),
          }),
        );
        const cols = infoCols.map((col) => ({
          idColonne: col.id,
          idVariable: col.variable,
          index: col.index,
        }));
        return {
          idTableau,
          tableau: {
            cols,
          },
        };
      }),
    );

    const schéma: SchémaNuée = {
      métadonnées,
      motsClefs,
      tableaux: Object.fromEntries(
        tableaux.map((t) => [t.idTableau, t.tableau]),
      ),
    };

    if (statut) schéma.statut = statut;

    return schéma;
  }

  async créerNuéeDeSchéma({
    schéma,
    épingler = true,
  }: {
    schéma: SchémaBd;
    épingler?: boolean;
  }): Promise<string> {
    const {
      tableaux,
      motsClefs,
      nuées,
      statut,
      clefUnique,
    } = schéma;

    const idNuée = await this.créerNuée({
      épingler,
    });

    if (motsClefs) {
      await this.ajouterMotsClefs({ idNuée, idsMotsClefs: motsClefs });
    }

    if (statut) {
      await this.sauvegarderStatut({ idNuée, statut });
    }

    for (const [idTableau, { cols }] of Object.entries(tableaux)) {
      await this.ajouterTableau({ idNuée, idTableau });

      for (const c of cols) {
        const { idColonne, idVariable, index } = c;
        await this.tableaux.ajouterColonne({
          idStructure: idNuée,
          idTableau,
          idVariable,
          idColonne,
        });
        if (index) {
          await this.tableaux.modifierIndexColonne({
            idStructure: idNuée,
            idTableau,
            idColonne,
            index: true,
          });
        }
      }
    }

    return idNuée;
  }

  async ouvrirNuée({
    idNuée,
  }: {
    idNuée: string;
  }): Promise<{ nuée: TypedNested<StructureNuée>; oublier: Oublier }> {
    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: idNuée,
      type: "nested",
    });
    return {
      nuée: typedNested<StructureNuée>({ db: bd, schema: schémaNuée }),
      oublier,
    };
  }

  async copierNuée({
    idNuée,
  }: {
    idNuée: string;
  }): Promise<string> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    const parent = await nuée.get("parent");
    
    const idNouvelleNuée = await this.créerNuée({ parent });

    const métadonnées = mapÀObjet(await nuée.get("métadonnées"));
    if (métadonnées) {
      await this.sauvegarderMétadonnées({ idNuée: idNouvelleNuée, métadonnées });
    }

    const noms = mapÀObjet(await nuée.get("noms"));
    if (noms) {
      await this.sauvegarderNoms({ idNuée: idNouvelleNuée, noms });
    }

    const descriptions = mapÀObjet(await nuée.get("descriptions"));
    if (descriptions) {
      await this.sauvegarderDescriptions({
        idNuée: idNouvelleNuée,
        descriptions,
      });
    }

    const motsClefs = await nuée.get("motsClefs");
    if (motsClefs)
      await this.ajouterMotsClefs({
        idNuée: idNouvelleNuée,
        idsMotsClefs: Object.keys(mapÀObjet(motsClefs)!),
      });

    const tableaux = await uneFois<InfoTableauNuée[]>((f) =>
      this.suivreTableaux({ idNuée, f, ascendance: false }),
    );
    for (const { id: idTableau } of tableaux) {
      await this.tableaux.copierTableau({
        idStructure: idNuée,
        idTableau,
        idStructureDestinataire: idNouvelleNuée,
      });
    }

    const statut = await nuée.get("statut");
    if (statut)
      await this.sauvegarderStatut({
        idNuée: idNouvelleNuée,
        statut: mapÀObjet(statut)!,
      });

    const { nuée: nouvelleNuée, oublier: oublierNouvelle } = await this.ouvrirNuée({
      idNuée: idNouvelleNuée,
    });

    const image = await nuée.get("image");
    if (image) await nouvelleNuée.set(`image`, image);

    const autorisations = mapÀObjet(await nuée.get("autorisation"));
    if (autorisations) await nouvelleNuée.put("autorisation", autorisations);

    await nouvelleNuée.set("copiéeDe", { id: idNuée });

    await Promise.allSettled([oublier(), oublierNouvelle()]);
    return idNouvelleNuée;
  }

  // Accès

  async inviterAuteur({
    idNuée,
    idCompte,
    rôle,
  }: {
    idNuée: string;
    idCompte: string;
    rôle: Rôle;
  }): Promise<void> {
    const compte = this.service("compte");

    return await compte.donnerAccèsObjet({
      idObjet: idNuée,
      identité: idCompte,
      rôle,
    });
  }

  async suivreAuteurs({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<InfoAuteur[]>;
  }): Promise<Oublier> {
    const compte = this.service("compte");

    return await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: Suivi<AccèsUtilisateur[]>;
      }) =>
        await compte.suivreAutorisations({
          idObjet: idNuée,
          f: fSuivreRacine,
        }),
      fBranche: async ({
        id: idCompte,
        fSuivreBranche,
        branche,
      }: {
        id: string;
        fSuivreBranche: Suivi<InfoAuteur>;
        branche: AccèsUtilisateur;
      }) => {
        // On doit appeler ça ici pour avancer même si l'autre compte n'est pas disponible.
        await fSuivreBranche({
          idCompte,
          accepté: false,
          rôle: branche.rôle,
        });
        return await this.suivreNuées({
          idCompte,
          f: async (nuéesCompte) => {
            return await fSuivreBranche({
              idCompte,
              accepté: (nuéesCompte || []).includes(idNuée),
              rôle: branche.rôle,
            });
          },
        });
      },
      fIdDeBranche: (x) => x.idCompte,
      f,
    });
  }

  async confirmerPermission({ idNuée }: { idNuée: string }): Promise<void> {
    const compte = this.service("compte");

    if (!(await compte.permission({ idObjet: idNuée })))
      throw new Error(
        `Permission de modification refusée pour la nuée ${idNuée}.`,
      );
  }

  // Autorisations contribution données 

  async inviter({ idNuée, idCompte }: { idNuée: string; idCompte: string; }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    await nuée.put("autorisation/invités", {[enleverProtocoleOrbite(idCompte)]: null});
    await oublier();
  }

  async désinviter({ idNuée, idCompte }: { idNuée: string; idCompte: string; }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    await nuée.del(`autorisation/invités/${enleverProtocoleOrbite(idCompte)}`);
    await oublier();
  }

  async bloquer({ idNuée, idCompte }: { idNuée: string; idCompte: string; }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    await nuée.put("autorisation/bloqués", {[enleverProtocoleOrbite(idCompte)]: null});
    await oublier();
  }

  async débloquer({ idNuée, idCompte }: { idNuée: string; idCompte: string; }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    await nuée.del(`autorisation/bloqués/${enleverProtocoleOrbite(idCompte)}`);
    await oublier();
  }

  // Épingles

  async épingler({
    idNuée,
    options = {},
  }: {
    idNuée: string;
    options?: PartielRécursif<ContenuÉpingleNuée>;
  }) {
    const favoris = this.service("favoris");

    const épingle: ContenuÉpingleNuée = résoudreDéfauts(options, {
      base: TOUS_DISPOSITIFS,
      bds: {
        type: "bd",
        épingle: {
          base: TOUS_DISPOSITIFS,
          données: {
            tableaux: TOUS_DISPOSITIFS,
            fichiers: DISPOSITIFS_INSTALLÉS,
          },
        }
      },
    });
    await favoris.épinglerFavori({ idObjet: idNuée, épingle: {type: "nuée", épingle} });
  }

  async désépingler({ idNuée }: { idNuée: string }): Promise<void> {
    const favoris = this.service("favoris");

    await favoris.désépinglerFavori({ idObjet: idNuée });
  }

  async suivreÉpingle({
    idNuée,
    f,
    idCompte,
  }: {
    idNuée: string;
    f: Suivi<PartielRécursif<ÉpingleNuée> | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const favoris = this.service("favoris");

    return await favoris.suivreFavorisObjet({
      idObjet: idNuée,
      f: async (épingle) => {
        if (épingle?.type === "nuée")
          await f(épingle as PartielRécursif<ÉpingleNuée>);
        else await f(undefined);
      },
      idCompte,
    });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisBooléenniséeAvecId<ÉpingleNuée>;
    f: Suivi<Set<string>>;
  }): Promise<Oublier> {
    const info: {
      base?: (string | undefined)[];
      bds?: (string | undefined)[];
    } = {};

    const fFinale = async () => {
      return await f(
        new Set(
          Object.values(info)
            .flat()
            .filter((x) => !!x) as string[],
        ),
      );
    };

    const fsOublier: Oublier[] = [];
    const orbite = this.service("orbite");
    if (épingle.épingle.épingle.base) {
      const oublierBase = await orbite.suivreBdTypée({
        id: épingle.idObjet,
        type: "nested",
        schéma: schémaNuée,
        f: async (bd) => {
          try {
            const image = await bd.get("image");
            info.base = [épingle.idObjet, image];
          } catch {
            return; // Si la structure n'est pas valide.
          }
          await fFinale();
        },
      });
      fsOublier.push(oublierBase);
    }

    // Bds associées
    const { bds: épingleBds } = épingle.épingle.épingle;
    if (épingleBds) {
      const serviceBds = this.service("bds");
      const oublierTableaux = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }) => {
          return await this.suivreBds({
            idNuée: épingle.idObjet,
            f: (bds) => fSuivreRacine(bds || []),
          });
        },
        fBranche: async ({
          id: idBd,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: Suivi<Set<string>>;
        }) => {
          if (épingleBds.épingle)
            return await serviceBds.suivreRésolutionÉpingle({
              épingle: {
                idObjet: idBd,
                épingle: {
                  type: "bd",
                  épingle: épingleBds.épingle
                },
              },
              f: fSuivreBranche,
            });
          else 
            return faisRien;
        },
        f: async (bds: string[]) => {
          info.bds = bds;
          await fFinale();
        },
      });
      fsOublier.push(oublierTableaux);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  // Noms

  async sauvegarderNoms({
    idNuée,
    noms,
  }: {
    idNuée: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });

    for (const lng in noms) {
      await nuée.set(`noms/${lng}`, noms[lng]);
    }

    await oublier();
  }

  async sauvegarderNom({
    idNuée,
    langue,
    nom,
  }: {
    idNuée: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });

    await nuée.set(`noms/${langue}`, nom);
    await oublier();
  }

  async effacerNom({
    idNuée,
    langue,
  }: {
    idNuée: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });
    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });
    await nuée.del(`noms/${langue}`);

    await oublier();
  }

  @cacheSuivi
  async suivreNoms({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<TraducsTexte>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idNuée,
      type: "nested",
      schéma: schémaNuée,
      f: (nuée) => f(toObject(nuée).noms || {}),
    });
  }

  // Descriptions

  async sauvegarderDescriptions({
    idNuée,
    descriptions,
  }: {
    idNuée: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });
    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });
    for (const lng in descriptions) {
      await nuée.set(`descriptions/${lng}`, descriptions[lng]);
    }
    await oublier();
  }

  async sauvegarderDescription({
    idNuée,
    langue,
    description,
  }: {
    idNuée: string;
    langue: string;
    description: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });
    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });
    await nuée.set(`descriptions/${langue}`, description);
    await oublier();
  }

  async effacerDescription({
    idNuée,
    langue,
  }: {
    idNuée: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });
    const { nuée, oublier } = await this.ouvrirNuée({
      idNuée,
    });
    await nuée.del(`descriptions/${langue}`);
    await oublier();
  }

  @cacheSuivi
  async suivreDescriptions({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<TraducsTexte>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idNuée,
      type: "nested",
      schéma: schémaNuée,
      f: (nuée) => f(toObject(nuée).descriptions || {}),
    });
  }

  // Image

  async sauvegarderImage({
    idNuée,
    image,
  }: {
    idNuée: string;
    image: { contenu: Uint8Array; nomFichier: string };
  }): Promise<string> {
    const maxTailleImage =
      this.service("compte").options.consts.maxTailleImageSauvegarder;

    if (image.contenu.byteLength > maxTailleImage) {
      throw new Error("Taille maximale excédée");
    }

    const idImage = await this.service("hélia").ajouterFichierÀSFIP(image);

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    await nuée.set("image", idImage);
    await oublier();

    return idImage;
  }

  async effacerImage({ idNuée }: { idNuée: string }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    await nuée.del("image");
    await oublier();
  }

  @cacheSuivi
  async suivreImage({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<{ image: Uint8Array; idImage: string } | null>;
  }): Promise<Oublier> {
    const maxTailleImage =
      this.service("compte").options.consts.maxTailleImageVisualiser;

    return await this.service("orbite").suivreDonnéesBd({
      id: idNuée,
      type: "nested",
      schéma: schémaNuée,
      f: async (nuée) => {
        const idImage = nuée.get("image");
        if (!idImage) {
          return await f(null);
        } else {
          const image = await this.service("hélia").obtFichierDeSFIP({
            id: idImage,
            max: maxTailleImage,
          });
          return await f(image ? { image, idImage } : null);
        }
      },
    });
  }

  // Métadonnées

  async sauvegarderMétadonnées({
    idNuée,
    métadonnées,
  }: {
    idNuée: string;
    métadonnées: Métadonnées;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    await nuée.put("métadonnées", métadonnées);
    await oublier();
  }

  async sauvegarderMétadonnée({
    idNuée,
    clef,
    valeur,
  }: {
    idNuée: string;
    clef: string;
    valeur: DagCborEncodable;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    await nuée.set(`métadonnées/${clef}`, valeur);
    await oublier();
  }

  async effacerMétadonnée({
    idNuée,
    clef,
  }: {
    idNuée: string;
    clef: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    await nuée.del(`métadonnées/${clef}`);
    await oublier();
  }

  @cacheSuivi
  async suivreMétadonnées({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<Métadonnées>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idNuée,
      type: "nested",
      schéma: schémaNuée,
      f: async (nuée) => {
        await f(mapÀObjet(nuée.get("métadonnées")) || {});
      },
    });
  }

  // Mots-clefs

  async ajouterMotsClefs({
    idNuée,
    idsMotsClefs,
  }: {
    idNuée: string;
    idsMotsClefs: string | string[];
  }): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];

    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    for (const id of idsMotsClefs) {
      await nuée.put(`motsClefs/${id}`, null);
    }
    await oublier();
  }

  async effacerMotClef({
    idNuée,
    idMotClef,
  }: {
    idNuée: string;
    idMotClef: string;
  }): Promise<void> {
    await this.confirmerPermission({ idNuée });

    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });

    await nuée.del(`motsClefs/${idMotClef}`);

    await oublier();
  }

  @cacheSuivi
  async suivreMotsClefs({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    return await orbite.suivreDonnéesBd({
      id: idNuée,
      type: "nested",
      schéma: schémaNuée,
      f: (nuée) => f(Object.keys(toObject(nuée).motsClefs)),
    });
  }

  // Tableaux

  async ajouterTableau({
    idNuée,
    idTableau,
  }: {
    idNuée: string;
    idTableau?: string;
  }): Promise<string> {
    await this.confirmerPermission({ idNuée });

    idTableau = idTableau || uuidv4();
    return await this.tableaux.créerTableau({ idStructure: idNuée, idTableau });
  }

  async effacerTableau({
    idNuée,
    idTableau,
  }: {
    idNuée: string;
    idTableau: string;
  }): Promise<void> {
    // L'interface du tableau s'occupe de tout !
    await this.tableaux.effacerTableau({ idStructure: idNuée, idTableau });
  }

  @cacheSuivi
  async suivreTableaux({
    idNuée,
    f,
    ascendance = true,
  }: {
    idNuée: string;
    f: Suivi<InfoTableauNuée[]>;
    ascendance?: boolean;
  }): Promise<Oublier> {
    const suivreTableaux = async ({ idNuée, f }: { idNuée: string, f: Suivi<string[]> }) => await this.service("orbite").suivreDonnéesBd({
      id: idNuée,
      type: "nested",
      schéma: schémaNuée,
      f: (nuée) => f(Object.keys(mapÀObjet(nuée)?.tableaux || {})),
    });

    if (ascendance) {
      return await this.suivreDeParents({
        idNuée,
        f: async nuées => await f(nuées.map(n=>n.val.map(t=>({ id: t, source: n.source }))).flat()),
        fParents: suivreTableaux
      })
    } else {
      return await suivreTableaux({ idNuée, f: async tableaux => await f(tableaux.map(t=>({id: t, source: idNuée}))) })
    }
  }

  // Variables

  async suivreVariables({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const fFinale = async (variables?: string[]) => {
      return await f(variables || []);
    };

    const fBranche = async ({
      id,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: Suivi<string[]>;
    }): Promise<Oublier> => {
      return await this.tableaux.suivreVariables({
        idStructure: idNuée,
        idTableau: id,
        f: fSuivreBranche,
      });
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreTableaux({
        idNuée,
        f: (x) => fSuivreRacine(x.map((x) => x.id)),
      });
    };

    return await suivreDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  // Statut

  async sauvegarderStatut({
    idNuée,
    statut,
  }: {
    idNuée: string;
    statut: StatutDonnées;
  }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    nuée.set("statut", statut);
    await oublier();
  }

  @cacheSuivi
  async suivreStatut({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<StatutDonnées | null>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");
    return await orbite.suivreDonnéesBd({
      id: idNuée,
      type: "nested",
      schéma: schémaNuée,
      f: (nuée) => f(mapÀObjet(nuée)?.statut || null),
    });
  }

  // Comparaisons

  @cacheSuivi
  async suivreDifférencesAvecBd({
    idNuée,
    idBd,
    f,
  }: {
    idNuée: string;
    idBd: string;
    f: Suivi<DifférenceBds[]>;
  }): Promise<Oublier> {
    const bds = this.service("bds");

    const différences: {
      tableauxManquants?: string[];
      tableauxSupplémentaires?: string[];
    } = {};

    const fFinale = async (
      différencesTableaux: { id: string; différence: DifférenceTableaux }[],
    ) => {
      const différencesTableauxManquants: DifférenceBDTableauManquant[] = (
        différences.tableauxManquants || []
      ).map((t) => ({
        type: "tableauManquant",
        sévère: true,
        clefManquante: t,
      }));

      const différencesTableauxSupplémentaires: DifférenceBDTableauSupplémentaire[] =
        (différences.tableauxSupplémentaires || []).map((t) => ({
          type: "tableauSupplémentaire",
          sévère: false,
          clefExtra: t,
        }));

      const différencesTableauxBdEtNuée: DifférenceTableauxBds[] =
        différencesTableaux.map(({ id, différence }) => ({
          type: "tableau",
          idTableau: id,
          différence: différence,
          sévère: différence.sévère,
        }));
      return await f([
        ...différencesTableauxManquants,
        ...différencesTableauxSupplémentaires,
        ...différencesTableauxBdEtNuée
      ]);
    };

    return await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }) => {
        const tableaux: { bd?: string[]; nuée?: string[] } = {};

        const fTableaux = async () => {
          if (!tableaux.bd || !tableaux.nuée) {
            différences.tableauxManquants = [];
            différences.tableauxSupplémentaires = [];
            return;
          }
          différences.tableauxManquants = tableaux.nuée.filter(
            (t) => !tableaux.bd?.includes(t),
          );
          différences.tableauxSupplémentaires = tableaux.bd.filter(
            (t) => !tableaux.nuée?.includes(t),
          );

          const communs = tableaux.nuée.filter((t) =>
            tableaux.bd?.includes(t),
          );
          return await fSuivreRacine(communs);
        };

        const oublierTableauxNuée = await this.suivreTableaux({
          idNuée,
          f: async (tblx) => {
            tableaux.nuée = tblx.map(t => t.id);
            await fTableaux();
          },
        });
        const oublierTableauxBd = await bds.suivreTableaux({
          idBd,
          f: async (tblx) => {
            tableaux.bd = tblx;
            await fTableaux();
          },
        });
        return async () => {
          await oublierTableauxNuée();
          await oublierTableauxBd();
        };
      },
      fBranche: async ({ id: tableau, fSuivreBranche }) => {
        return await this.tableaux.suivreDifférencesAvecTableau({
          tableau: {
            idStructure: idBd,
            idTableau: tableau,
          },
          tableauRéf: {
            idStructure: idNuée,
            idTableau: tableau,
          },
          f: async (différences) =>
            await fSuivreBranche(
              différences.map((différence) => ({ id: tableau, différence })),
            ),
        });
      },
      f: fFinale,
    });
  }

  // Ascendance

  async préciserParent({
    idNuée,
    idNuéeParent,
  }: {
    idNuée: string;
    idNuéeParent: string;
  }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    nuée.set("parent", idNuéeParent);
    await oublier();
  }

  async enleverParent({ idNuée }: { idNuée: string }): Promise<void> {
    const { nuée, oublier } = await this.ouvrirNuée({ idNuée });
    nuée.del("parent");
    await oublier();
  }

  @cacheSuivi
  async suivreAscendants({ idNuée, f }:{ idNuée: string, f: Suivi<string[]> }): Promise<Oublier> {
    const orbite = this.service("orbite");

    const déjàVus = new Set<string>();

    const suivreParent = async ({idNuée, f}: { idNuée: string, f: Suivi<string | undefined> }): Promise<Oublier> => {
      return await orbite.suivreDonnéesBd({
        id: idNuée,
        type: "nested",
        schéma: schémaNuée,
        f: (nuée) => f(mapÀObjet(nuée)?.parent),
      });
    }

    const suivreAscendants = async ({ idNuée, f, ascendants }: { idNuée: string; f: Suivi<string[]>, ascendants?: string[] }): Promise<Oublier> => {
      ascendants ??= [];
      return await suivreParent({
        idNuée, f: async parent => await f({})
      })
    }

    return await suivreFonctionImbriquée({
      fRacine: async ({ fSuivreRacine }) => await suivreParent({ idNuée, f: fSuivreRacine }),
      fSuivre: async ({ id, fSuivreBd }) => {
        return await this.suivreAscendants({ idNuée: id, f: fSuivreBd })
      },
      f: async (parents?: string[]) => await f([idNuée, ...(parents || [])])
    })
  }

  async suivreDeParents<T>({
    idNuée,
    f,
    fParents
  }: {
    idNuée: string,
    f: Suivi<{ source: string, val: T}[]>;
    fParents: ((args: { idNuée: string, f: Suivi<T> }) => Promise<Oublier>)
  }): Promise<Oublier> {
    return await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }: { fSuivreRacine: Suivi<string[]> }) => await this.suivreAscendants({
        idNuée,
        f: ascendants => fSuivreRacine([idNuée, ...ascendants])
      }),
      fBranche: async ({ id, fSuivreBranche }: { id: string; fSuivreBranche: Suivi<{ source: string, val: T}> }) => {
        return await fParents({ idNuée: id, f: val => fSuivreBranche({ source: id, val }) })
      },
      f
    })
  }

  // Bds
  async suivreBds({idNuée, f}: {idNuée: string, f: Suivi<string[]> }): Promise<Oublier> {

  }

  // Qualité

  @cacheSuivi
  async suivreScoreQualité({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: Suivi<number>;
  }): Promise<Oublier> {
    const rés: {
      noms: { [key: string]: string };
      descriptions: { [key: string]: string };
    } = {
      noms: {},
      descriptions: {},
    };
    const fFinale = async () => {
      const scores = [
        Object.keys(rés.noms).length ? 1 : 0,
        Object.keys(rés.descriptions).length ? 1 : 0,
      ];

      const qualité = scores.reduce((a, b) => a + b, 0) / scores.length;
      await f(qualité);
    };
    const oublierNoms = await this.suivreNoms({
      idNuée,
      f: (noms) => {
        rés.noms = noms;
        fFinale();
      },
    });

    const oublierDescr = await this.suivreDescriptions({
      idNuée,
      f: (descriptions) => {
        rés.descriptions = descriptions;
        fFinale();
      },
    });

    const oublier = async () => {
      await oublierNoms();
      await oublierDescr();
    };

    return oublier;
  }
}
