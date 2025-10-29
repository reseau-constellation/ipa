import { JSONSchemaType } from "ajv";
import { TypedNested, typedNested } from "@constl/bohr-db";
import {
  attendreStabilité,
  idcValide,
  ignorerNonDéfinis,
  suivreDeFonctionListe,
  traduire,
  uneFois,
} from "@constl/utils-ipa";
import { NestedObjectToMap, toObject } from "@orbitdb/nested-db";
import { v4 as uuidv4 } from "uuid";
import xlsx, { utils as xlsxUtils } from "xlsx";
import { DagCborEncodable } from "@orbitdb/core";
import { cacheSuivi } from "@/décorateursCache.js";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { PartielRécursif, StatutDonnées, TraducsTexte } from "./types.js";
import { Constellation, ServicesConstellation } from "./constellation.js";
import { Oublier, Suivi } from "./crabe/types.js";
import { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import {
  BaseÉpingleFavoris,
  DISPOSITIFS_INSTALLÉS,
  DispositifsÉpingle,
  TOUS_DISPOSITIFS,
  résoudreDéfauts,
  ÉpingleFavorisAvecIdBooléennisée,
} from "./favoris.js";
import { schémaStatutDonnées, schémaTraducsTexte } from "./schémas.js";
import {
  DonnéesFileTableauAvecId,
  DonnéesTableauExportées,
  InfoTableau,
} from "./tableaux.js";
import { mapÀObjet } from "./crabe/utils.js";
import {
  DonnéesFichierBdExportées,
  sauvegarderDonnéesExportées,
} from "./utils.js";

// Types épingles
export type ÉpingleBd = BaseÉpingleFavoris & {
  type: "bd";
  données: {
    tableaux: DispositifsÉpingle;
    fichiers: DispositifsÉpingle;
  };
};

// Types données

export type DonnéesBdExportées = {
  nomBd: string;
  tableaux: DonnéesTableauExportées[];
};

// Types structure

export type StructureBd = {
  type: "bd";
  noms: TraducsTexte;
  descriptions: TraducsTexte;
  image: string;
  licence: string;
  licenceContenu: string;
  métadonnées: { [clef: string]: DagCborEncodable };
  statut: StatutDonnées;
  tableaux: { [clef: string]: { id: string } };
  motsClefs: { [id: string]: null };
  copiéDe?: { id: string };
};

export const schémaBd: JSONSchemaType<PartielRécursif<StructureBd>> = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    noms: schémaTraducsTexte,
    descriptions: schémaTraducsTexte,
    image: { type: "string", nullable: true },
    licence: { type: "string", nullable: true },
    licenceContenu: { type: "string", nullable: true },
    métadonnées: {
      type: "object",
      oneOf: [],
      additionalProperties: {},
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
    tableaux: {
      type: "object",
      nullable: true,
      additionalProperties: {
        type: "object",
        nullable: true,
        properties: {
          id: { type: "string", nullable: true },
        },
        required: [],
      },
      required: [],
    },
    copiéDe: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      nullable: true,
    },
  },
};

export type StructureServiceBds = {
  [motClef: string]: null;
};

export const SchémaServiceBds: JSONSchemaType<
  PartielRécursif<StructureServiceBds>
> = {
  type: "object",
  additionalProperties: {
    type: "null",
    nullable: true,
  },
  required: [],
};

export class Bds<L extends ServicesLibp2pCrabe> extends ServiceDonnéesNébuleuse<
  "bds",
  StructureServiceBds,
  L,
  ServicesConstellation<L>
> {
  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "bds",
      nébuleuse,
      dépendances: ["compte", "orbite", "hélia", "tableaux"],
      options: {
        schéma: SchémaServiceBds,
      },
    });
  }

  // Création et gestion

  @cacheSuivi
  async suivreBds({
    f,
    idCompte,
  }: {
    f: Suivi<string[] | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreBd({
      idCompte,
      f: (bds) => f(bds ? Object.keys(bds) : undefined),
    });
  }

  async créerBd({
    licence,
    licenceContenu,
    épingler = true,
  }: {
    licence: string;
    licenceContenu?: string;
    épingler?: boolean;
  }): Promise<string> {
    const compte = this.service("compte");

    const { bd, oublier: oublierBd } = await compte.créerObjet({
      type: "nested",
    });
    const idBd = bd.address;
    await oublierBd();
    const { bd: bdBd, oublier } = await this.ouvrirBd({ idBd });

    await this.ajouterÀMesBds({ idBd });

    if (épingler) await this.épinglerBd({ idBd });

    await bdBd.put({ type: "bd", licence, statut: { statut: "active" } });
    if (licenceContenu) await bdBd.put({ licenceContenu });

    await oublier();
    return idBd;
  }

  async effacerBd({ idBd }: { idBd: string }): Promise<void> {
    const orbite = this.service("orbite");

    // D'abord effacer l'entrée dans notre liste de BDs
    await this.enleverDeMesBds({ idBd });
    await this.service("favoris").désépinglerFavori({ idObjet: idBd });

    // aussi effacer les tableaux
    const tableaux = await uneFois<string[]>((f) =>
      this.suivreTableaux({
        idBd,
        f: (tbx) => tbx && f(tbx.map((t) => t.id)),
      }),
    );
    await Promise.all(
      tableaux.map(
        async (idTableau) =>
          await this.service("tableaux").effacerTableau({ idTableau }),
      ),
    );

    // enfin, effacer la BD elle-même
    await orbite.effacerBd({ id: idBd });
  }

  async ajouterÀMesBds({ idBd }: { idBd: string }): Promise<void> {
    const bd = await this.bd();
    await bd.put(idBd, null);
  }

  async enleverDeMesBds({ idBd }: { idBd: string }): Promise<void> {
    const bd = await this.bd();
    await bd.del(idBd);
  }

  async confirmerPermission({ idBd }: { idBd: string }): Promise<void> {
    const compte = this.service("compte");

    if (!(await compte.permission({ idObjet: idBd })))
      throw new Error(
        `Permission de modification refusée pour la base de données ${idBd}.`,
      );
  }

  async ouvrirBd({
    idBd,
  }: {
    idBd: string;
  }): Promise<{ bd: TypedNested<StructureBd>; oublier: Oublier }> {
    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: idBd,
      type: "nested",
    });
    return {
      bd: typedNested<StructureBd>({ db: bd, schema: schémaBd }),
      oublier,
    };
  }

  // Épingles
  async épinglerBd({
    idBd,
    options = {},
  }: {
    idBd: string;
    options?: PartielRécursif<ÉpingleBd>;
  }) {
    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];

    const épingle: ÉpingleBd = résoudreDéfauts(options, {
      type: "bd",
      base: TOUS_DISPOSITIFS,
      données: {
        tableaux: TOUS_DISPOSITIFS,
        fichiers: DISPOSITIFS_INSTALLÉS,
      },
    });

    await favoris.épinglerFavori({ idObjet: idBd, épingle });
  }

  async désépinglerBd({ idBd }: { idBd: string }): Promise<void> {
    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];

    await favoris.désépinglerFavori({ idObjet: idBd });
  }

  async suivreÉpingleBd({
    idBd,
    f,
    idCompte,
  }: {
    idBd: string;
    f: Suivi<PartielRécursif<ÉpingleBd> | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];

    return await favoris.suivreÉtatFavori({
      idObjet: idBd,
      f: async (épingle) => {
        if (épingle?.type === "bd")
          await f(épingle as PartielRécursif<ÉpingleBd>);
        else await f(undefined);
      },
      idCompte,
    });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisAvecIdBooléennisée<ÉpingleBd>;
    f: Suivi<Set<string>>;
  }): Promise<Oublier> {
    const info: {
      base?: (string | undefined)[];
      données?: (string | undefined)[];
      fichiers?: (string | undefined)[];
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
    if (épingle.épingle.base) {
      const fOublierBase = await orbite.suivreBdTypée({
        id: épingle.idObjet,
        type: "nested",
        schéma: schémaBd,
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
      fsOublier.push(fOublierBase);
    }

    // Données des tableaux
    if (épingle.épingle.données?.tableaux) {
      const fOublierTableaux = await this.suivreTableaux({
        idBd: épingle.idObjet,
        f: async (tableaux) => {
          info.données = tableaux?.map((t) => t.id);
          await fFinale();
        },
      });
      fsOublier.push(fOublierTableaux);
    }

    // Fichiers présents dans les données
    if (épingle.épingle.données?.fichiers) {
      const tableaux = this.service("tableaux");

      const fOublierDonnées = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }) => {
          return await this.suivreTableaux({
            idBd: épingle.idObjet,
            f: (tbx) => fSuivreRacine(tbx?.map((t) => t.id) || []),
          });
        },
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: Suivi<DonnéesFileTableauAvecId[]>;
        }) => {
          return await tableaux.suivreDonnées({
            idTableau: id,
            f: fSuivreBranche,
          });
        },
        f: async (données: DonnéesFileTableauAvecId[]) => {
          const idcs = données
            .map((file) =>
              Object.values(file.données).filter((x) => idcValide(x)),
            )
            .flat() as string[];
          info.fichiers = idcs;
          await fFinale();
        },
      });
      fsOublier.push(fOublierDonnées);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  // Noms

  async sauvegarderNomsBd({
    idBd,
    noms,
  }: {
    idBd: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });

    await bd.put("noms", noms);
    await oublier();
  }

  async sauvegarderNomBd({
    idBd,
    langue,
    nom,
  }: {
    idBd: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set(`noms/${langue}`, nom);
    await oublier();
  }

  async effacerNomBd({
    idBd,
    langue,
  }: {
    idBd: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.del(`noms/${langue}`);
    await oublier();
  }

  @cacheSuivi
  async suivreNomsBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<TraducsTexte | undefined>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");
    // const nuées = this.service("nuées");

    const noms: {
      deNuées: TraducsTexte[];
      deBd: TraducsTexte;
    } = { deNuées: [], deBd: {} };

    const fFinale = async () => {
      const nomsFinaux = {};
      for (const source of [...noms.deNuées, noms.deBd]) {
        Object.assign(nomsFinaux, source);
      }
      return await f(nomsFinaux);
    };

    /*const oublierNomsNuées = await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: string[]) => Promise<void>;
      }) => {
        return await this.suivreNuéesBd({ idBd, f: fSuivreRacine });
      },
      fBranche: async ({
        id: idNuée,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: Suivi<TraducsTexte>;
      }): Promise<Oublier> => {
        return await nuées.suivreNomsNuée({ idNuée, f: fSuivreBranche });
      },
      f: async (nomsNuées: TraducsTexte[]) => {
        noms.deNuées = nomsNuées;
        await fFinale();
      },
    }); */

    const oublierNomsBd = await orbite.suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: (bd) => f(toObject(bd).noms),
    });

    return async () => {
      await oublierNomsBd();
      // await oublierNomsNuées();
    };
  }

  // Descriptions

  async sauvegarderDescriptionsBd({
    idBd,
    descriptions,
  }: {
    idBd: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.put("descriptions", descriptions);
    await oublier();
  }

  async sauvegarderDescriptionBd({
    idBd,
    langue,
    description,
  }: {
    idBd: string;
    langue: string;
    description: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set(`descriptions/${langue}`, description);
    await oublier();
  }

  async effacerDescriptionBd({
    idBd,
    langue,
  }: {
    idBd: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.del(`descriptions/${langue}`);
    await oublier();
  }

  @cacheSuivi
  async suivreDescriptionsBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<TraducsTexte | undefined>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: async (bd) => {
        await f(mapÀObjet(bd.get("descriptions")));
      },
    });
  }

  // Image

  async sauvegarderImage({
    idBd,
    image,
  }: {
    idBd: string;
    image: { contenu: Uint8Array; nomFichier: string };
  }): Promise<void> {
    const maxTailleImage =
      this.service("compte").options.consts.maxTailleImageSauvegarder;

    if (image.contenu.byteLength > maxTailleImage) {
      throw new Error("Taille maximale excédée");
    }

    const idImage = await this.service("hélia").ajouterFichierÀSFIP(image);

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set("image", idImage);
    await oublier();
  }

  async effacerImage({ idBd }: { idBd: string }): Promise<void> {
    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.del("image");
    await oublier();
  }

  @cacheSuivi
  async suivreImage({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<{ image: Uint8Array; idImage: string } | null>;
  }): Promise<Oublier> {
    const maxTailleImage =
      this.service("compte").options.consts.maxTailleImageVisualiser;

    return await this.service("orbite").suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: async (bd) => {
        const idImage = bd.get("image");
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

  // Licences

  async changerLicenceBd({
    idBd,
    licence,
  }: {
    idBd: string;
    licence: string;
  }): Promise<void> {
    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set("licence", licence);
    await oublier();
  }

  async changerLicenceContenuBd({
    idBd,
    licenceContenu,
  }: {
    idBd: string;
    licenceContenu?: string;
  }): Promise<void> {
    const { bd, oublier } = await this.ouvrirBd({ idBd });

    if (licenceContenu) {
      await bd.set("licenceContenu", licenceContenu);
    } else {
      await bd.del("licenceContenu");
    }
    await oublier();
  }

  @cacheSuivi
  async suivreLicenceBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: async (bd) => {
        const licence = await bd.get("licence");
        if (licence) await f(licence);
      },
    });
  }

  @cacheSuivi
  async suivreLicenceContenuBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string | undefined>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: async (bd) => {
        const licenceContenu = await bd.get("licenceContenu");
        await f(licenceContenu);
      },
    });
  }

  // Mots-clefs

  async ajouterMotsClefsBd({
    idBd,
    idsMotsClefs,
  }: {
    idBd: string;
    idsMotsClefs: string | string[];
  }): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];

    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });

    for (const id of idsMotsClefs) {
      await bd.put(`motsClefs/${id}`, null);
    }
    await oublier();
  }

  async effacerMotClefBd({
    idBd,
    idMotClef,
  }: {
    idBd: string;
    idMotClef: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });

    await bd.del(`motsClefs/${idMotClef}`);

    await oublier();
  }

  // Tableaux

  @cacheSuivi
  async suivreTableaux({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<InfoTableau[] | undefined>;
  }): Promise<Oublier> {
    const fFinale = async (
      infos: NestedObjectToMap<{ [clef: string]: { id: string } }> | undefined,
    ) => {
      if (!infos) return await f(undefined);
      const tableaux: InfoTableau[] = [...infos.entries()]
        .map(([clef, valeur]) => {
          return {
            clef,
            id: valeur.get("id"),
          };
        })
        .filter((x): x is InfoTableau => !!(x.clef && x.id));
      await f(tableaux);
    };

    return await this.service("orbite").suivreDonnéesBd({
      id: idBd,
      type: "nested",
      schéma: schémaBd,
      f: (bd) => fFinale(bd.get("tableaux")),
    });
  }

  async ajouterTableau({
    idBd,
    clefTableau,
  }: {
    idBd: string;
    clefTableau?: string;
  }): Promise<string> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });

    const tableaux = this.service("tableaux");
    clefTableau = clefTableau || uuidv4();
    const idTableau = await tableaux.créerTableau({ idStructure: idBd });

    await bd.set(`tableaux/${clefTableau}`, {
      id: idTableau,
    });

    await oublier();
    return idTableau;
  }

  async effacerTableauBd({
    idBd,
    idTableau,
  }: {
    idBd: string;
    idTableau: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    // D'abord effacer l'entrée dans notre liste de tableaux
    const { bd, oublier } = await this.ouvrirBd({ idBd });

    const clefTableau = Object.entries(
      mapÀObjet(await bd.get(`tableaux`)) || {},
    ).find(([_clef, { id }]) => id === idTableau)?.[0];
    if (!clefTableau) throw new Error(`Tableau non existant : ${idTableau}`);

    await bd.del(`tableaux/${clefTableau}`);
    await oublier();

    // Enfin, effacer les données et le tableau lui-même
    const tableaux = this.service("tableaux");
    await tableaux.effacerTableau({ idTableau });
  }

  async réordonnerTableauBd({
    idBd,
    idTableau,
    position,
  }: {
    idBd: string;
    idTableau: string;
    position: number;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });

    const tableauxExistants = await bd.get("tableaux");
    const positionExistante = [
      ...(tableauxExistants?.values() || []),
    ].findIndex((t) => t.get("id") === idTableau);
    if (position !== positionExistante)
      await bd.move(`tableaux/${idTableau}`, position);
    await oublier();
  }

  // Variables

  @cacheSuivi
  async suivreVariablesBd({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const tableaux = this.service("tableaux");

    const fFinale = async (variables?: string[]) => {
      return await f(variables || []);
    };

    const fBranche = async ({
      id: idTableau,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: Suivi<string[]>;
    }): Promise<Oublier> => {
      return await tableaux.suivreVariables({
        idTableau,
        f: fSuivreBranche,
      });
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreTableaux({
        idBd,
        f: (x) => fSuivreRacine((x || []).map((x) => x.id)),
      });
    };

    return await suivreDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  // Données

  // Exportations

  async suivreDonnéesExportation({
    idBd,
    langues,
    f,
  }: {
    idBd: string;
    langues?: string[];
    f: Suivi<DonnéesBdExportées>;
  }): Promise<Oublier> {
    const info: {
      nomsBd?: TraducsTexte;
      données?: DonnéesTableauExportées[];
    } = {};
    const fsOublier: Oublier[] = [];

    const tableaux = this.service("tableaux");

    const fFinale = async () => {
      const { nomsBd, données } = info;
      if (!données) return;

      const idCourt = idBd.split("/").pop()!;
      const nomBd =
        nomsBd && langues ? traduire(nomsBd, langues) || idCourt : idCourt;
      await f({
        nomBd,
        tableaux: données,
      });
    };

    const fOublierDonnées = await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: InfoTableau[]) => Promise<void>;
      }) => {
        return await this.suivreTableaux({
          idBd,
          f: ignorerNonDéfinis(fSuivreRacine),
        });
      },
      f: async (données: DonnéesTableauExportées[]) => {
        info.données = données;
        await fFinale();
      },
      fBranche: async ({
        id,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: Suivi<DonnéesTableauExportées>;
      }): Promise<Oublier> => {
        return await tableaux.suivreDonnéesExportation({
          idTableau: id,
          langues,
          f: async (données) => {
            return await fSuivreBranche(données);
          },
        });
      },
      fIdDeBranche: (x) => x.id,
    });
    fsOublier.push(fOublierDonnées);

    if (langues) {
      const fOublierNomsBd = await this.suivreNomsBd({
        idBd,
        f: async (noms) => {
          info.nomsBd = noms;
          await fFinale();
        },
      });
      fsOublier.push(fOublierNomsBd);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  async exporterDonnées({
    idBd,
    langues,
    nomFichier,
    patience = 500,
  }: {
    idBd: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
  }): Promise<DonnéesFichierBdExportées> {
    const doc = xlsxUtils.book_new();

    const données = await uneFois(
      async (fSuivi: Suivi<DonnéesBdExportées>): Promise<Oublier> => {
        return await this.suivreDonnéesExportation({
          idBd,
          langues,
          f: fSuivi,
        });
      },
      attendreStabilité(patience),
    );

    nomFichier = nomFichier || données.nomBd;

    const fichiersSFIP = new Set<string>();

    for (const tableau of données.tableaux) {
      tableau.fichiersSFIP.forEach((x) => fichiersSFIP.add(x));

      /* Créer le tableau */
      const tableauXLSX = xlsxUtils.json_to_sheet(tableau.données);

      /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
      xlsxUtils.book_append_sheet(
        doc,
        tableauXLSX,
        tableau.nomTableau.slice(0, 30),
      );
    }
    return { doc, fichiersSFIP, nomFichier };
  }

  async exporterÀFichier({
    idBd,
    langues,
    nomFichier,
    patience = 500,
    formatDoc,
    dossier = "",
    inclureDocuments = true,
  }: {
    idBd: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
    formatDoc: xlsx.BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
  }): Promise<string> {
    const donnéesExportées = await this.exporterDonnées({
      idBd,
      langues,
      nomFichier,
      patience,
    });

    const hélia = this.service("hélia");
    return await sauvegarderDonnéesExportées({
      données: donnéesExportées,
      formatDoc,
      obtItérableAsyncSFIP: hélia.obtItérableAsyncSFIP.bind(hélia),
      dossier,
      inclureDocuments,
    });
  }
}
