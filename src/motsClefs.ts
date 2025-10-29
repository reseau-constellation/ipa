import { JSONSchemaType } from "ajv";
import { adresseOrbiteValide } from "@constl/utils-ipa";
import {
  type schémaFonctionOublier,
  type schémaFonctionSuivi,
  schémaStructureBdNoms,
  RecursivePartial,
} from "@/types.js";

import { Constellation } from "@/client.js";

import { ComposanteClientListe } from "@/services.js";
import { cacheSuivi } from "@/décorateursCache.js";

import { ContrôleurConstellation as générerContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import {
  TOUS,
  résoudreDéfauts,
  ÉpingleFavorisAvecId,
  ÉpingleMotClef,
} from "./favoris.js";
import type { objRôles } from "@/accès/types.js";

type ContrôleurConstellation = Awaited<
  ReturnType<ReturnType<typeof générerContrôleurConstellation>>
>;

const schémaBdPrincipale: JSONSchemaType<string> = { type: "string" };

type structureBdMotClef = {
  type: string;
  noms: string;
  descriptions: string;
};
const schémaBdMotClef: JSONSchemaType<Partial<structureBdMotClef>> = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    noms: { type: "string", nullable: true },
    descriptions: { type: "string", nullable: true },
  },
  required: [],
};

export class MotsClefs extends ComposanteClientListe<string> {
  constructor({ client }: { client: Constellation }) {
    super({ client, clef: "motsClefs", schémaBdPrincipale });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisAvecId<ÉpingleMotClef>;
    f: schémaFonctionSuivi<Set<string>>;
  }): Promise<schémaFonctionOublier> {
    const épinglerMétaDonnées =
      await this.client.favoris.estÉpingléSurDispositif({
        dispositifs: épingle.épingle.base || "TOUS",
      });

    const fOublier = await this.client.suivreBd({
      id: épingle.idObjet,
      type: "keyvalue",
      schéma: schémaBdMotClef,
      f: async (bd) => {
        try {
          const contenuBd = await bd.allAsJSON();
          return await f(
            new Set(
              épinglerMétaDonnées
                ? ([
                    épingle.idObjet,
                    contenuBd.descriptions,
                    contenuBd.noms,
                  ].filter((x) => !!x) as string[])
                : [],
            ),
          );
        } catch {
          return; // Si la structure n'est pas valide.
        }
      },
    });
    return fOublier;
  }

  @cacheSuivi
  async suivreMotsClefs({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({ idCompte, f });
  }

  async créerMotClef({
    épingler = true,
  }: { épingler?: boolean } = {}): Promise<string> {
    const idMotClef = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès: {
        address: undefined,
        write: await this.client.obtIdCompte(),
      },
    });

    await this.ajouterÀMesMotsClefs({ idMotClef });

    if (épingler) await this.épinglerMotClef({ idMotClef });

    const { bd: bdMotClef, fOublier: fOublierMotClef } =
      await this.client.ouvrirBdTypée({
        id: idMotClef,
        type: "keyvalue",
        schéma: schémaBdMotClef,
      });

    const accès = bdMotClef.access as unknown as ContrôleurConstellation;
    const optionsAccès = { write: accès.address };

    await bdMotClef.set("type", "motClef");

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdMotClef.set("noms", idBdNoms);

    const idBdDescriptions = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdMotClef.set("descriptions", idBdDescriptions);

    await fOublierMotClef();
    return idMotClef;
  }

  async ajouterÀMesMotsClefs({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    await bd.add(idMotClef);
    await fOublier();
  }

  async enleverDeMesMotsClefs({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.obtBd();
    await bdRacine.del(idMotClef);
    await fOublier();
  }

  async épinglerMotClef({
    idMotClef,
    options = {},
  }: {
    idMotClef: string;
    options?: RecursivePartial<ÉpingleMotClef>;
  }) {
    const épingle: ÉpingleMotClef = résoudreDéfauts(options, {
      type: "motClef",
      base: TOUS,
    });
    await this.client.favoris.épinglerFavori({ idObjet: idMotClef, épingle });
  }

  async suivreÉpingleMotClef({
    idMotClef,
    f,
    idCompte,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<ÉpingleMotClef | undefined>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.client.favoris.suivreÉtatFavori({
      idObjet: idMotClef,
      f: async (épingle) => {
        if (épingle?.type === "motClef") await f(épingle);
        else await f(undefined);
      },
      idCompte,
    });
  }

  async copierMotClef({ idMotClef }: { idMotClef: string }): Promise<string> {
    const { bd: bdBase, fOublier: fOublierBase } =
      await this.client.ouvrirBdTypée({
        id: idMotClef,
        type: "keyvalue",
        schéma: schémaBdMotClef,
      });

    const idNouveauMotClef = await this.créerMotClef();

    const idBdNoms = await bdBase.get("noms");
    if (idBdNoms) {
      const { bd: bdNoms, fOublier: fOublierNoms } =
        await this.client.ouvrirBdTypée({
          id: idBdNoms,
          type: "keyvalue",
          schéma: schémaStructureBdNoms,
        });
      const noms = await bdNoms.allAsJSON();
      await this.sauvegarderNomsMotClef({ idMotClef: idNouveauMotClef, noms });
      await fOublierNoms();
    }

    const idBdDescriptions = await bdBase.get("descriptions");
    if (idBdDescriptions) {
      const { bd: bdDescriptions, fOublier: fOublierDescriptions } =
        await this.client.ouvrirBdTypée({
          id: idBdDescriptions,
          type: "keyvalue",
          schéma: schémaStructureBdNoms,
        });
      const descriptions = await bdDescriptions.allAsJSON();
      await this.sauvegarderDescriptionsMotClef({
        idMotClef: idNouveauMotClef,
        descriptions,
      });
      await fOublierDescriptions();
    }

    await fOublierBase();
    return idNouveauMotClef;
  }

  async _confirmerPermission({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    if (!(await this.client.permission({ idObjet: idMotClef })))
      throw new Error(
        `Permission de modification refusée pour le mot-clef ${idMotClef}.`,
      );
  }

  async inviterAuteur({
    idMotClef,
    idCompteAuteur,
    rôle,
  }: {
    idMotClef: string;
    idCompteAuteur: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    await this.client.donnerAccès({
      idBd: idMotClef,
      identité: idCompteAuteur,
      rôle,
    });
  }

  async sauvegarderNomsMotClef({
    idMotClef,
    noms,
  }: {
    idMotClef: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    await this._confirmerPermission({ idMotClef });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idMotClef,
      type: "keyvalue",
    });

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    await fOublier();
  }

  async sauvegarderNomMotClef({
    idMotClef,
    langue,
    nom,
  }: {
    idMotClef: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    await this._confirmerPermission({ idMotClef });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idMotClef,
      type: "keyvalue",
    });

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdNoms.set(langue, nom);
    await fOublier();
  }

  async effacerNomMotClef({
    idMotClef,
    langue,
  }: {
    idMotClef: string;
    langue: string;
  }): Promise<void> {
    await this._confirmerPermission({ idMotClef });
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idMotClef,
      type: "keyvalue",
    });

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdNoms.del(langue);
    await fOublier();
  }

  @cacheSuivi
  async suivreNomsMotClef({
    idMotClef,
    f,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id: idMotClef,
      clef: "noms",
      schéma: schémaStructureBdNoms,
      f,
    });
  }

  async sauvegarderDescriptionsMotClef({
    idMotClef,
    descriptions,
  }: {
    idMotClef: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    await this._confirmerPermission({ idMotClef });
    const idBdDescriptions = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idMotClef,
      type: "keyvalue",
    });

    const { bd: bdDescriptions, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdDescriptions,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    for (const lng in descriptions) {
      await bdDescriptions.set(lng, descriptions[lng]);
    }
    await fOublier();
  }

  async sauvegarderDescriptionMotClef({
    idMotClef,
    langue,
    description,
  }: {
    idMotClef: string;
    langue: string;
    description: string;
  }): Promise<void> {
    await this._confirmerPermission({ idMotClef });
    const idBdDescriptions = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idMotClef,
      type: "keyvalue",
    });

    const { bd: bdDescriptions, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdDescriptions,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdDescriptions.set(langue, description);
    await fOublier();
  }

  async effacerDescriptionMotClef({
    idMotClef,
    langue,
  }: {
    idMotClef: string;
    langue: string;
  }): Promise<void> {
    await this._confirmerPermission({ idMotClef });
    const idBdDescriptions = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idMotClef,
      type: "keyvalue",
    });

    const { bd: bdDescriptions, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdDescriptions,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdDescriptions.del(langue);
    await fOublier();
  }

  @cacheSuivi
  async suivreDescriptionsMotClef({
    idMotClef,
    f,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id: idMotClef,
      clef: "descriptions",
      schéma: schémaStructureBdNoms,
      f,
    });
  }

  async effacerMotClef({ idMotClef }: { idMotClef: string }): Promise<void> {
    // Effacer l'entrée dans notre liste de mots clefs
    await this.enleverDeMesMotsClefs({ idMotClef });
    await this.client.favoris.désépinglerFavori({ idObjet: idMotClef });

    // Effacer le mot-clef lui-même
    const { bd: bdMotClef, fOublier } = await this.client.ouvrirBdTypée({
      id: idMotClef,
      type: "keyvalue",
      schéma: schémaBdMotClef,
    });
    const contenuBd = await bdMotClef.all();
    for (const item of contenuBd) {
      if (item.value && adresseOrbiteValide(item.value))
        await this.client.effacerBd({ id: item.value });
    }
    await fOublier();
    await this.client.effacerBd({ id: idMotClef });
  }

  @cacheSuivi
  async suivreQualitéMotClef({
    idMotClef,
    f,
  }: {
    idMotClef: string;
    f: schémaFonctionSuivi<number>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreNomsMotClef({
      idMotClef,
      f: (noms) => f(Object.keys(noms).length ? 1 : 0),
    });
  }
}
