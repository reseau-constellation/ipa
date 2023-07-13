import type {
  schémaFonctionSuivi,
  schémaFonctionOublier,
} from "@/utils/index.js";
import type { objRôles } from "@/accès/types.js";

import ClientConstellation from "@/client.js";
import type { default as ContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import { cacheSuivi } from "@/décorateursCache.js";
import { ComposanteClientListe } from "@/composanteClient.js";
import { JSONSchemaType } from "ajv";

type structureBdMotClef = {
  type: string;
  noms: string;
  descriptions: string;
};
const schémaBdMotClef: JSONSchemaType<structureBdMotClef> = {
  type: "object",
  properties: {
    type: {type: "string"},
    noms: {type: "string"},
    descriptions: {type: "string"}
  },
  required: ["type", "noms", "descriptions"]
}

export default class MotsClefs extends ComposanteClientListe<string> {

  constructor({ client }: { client: ClientConstellation }) {
    super({client, clef: "motsClefs"});
  }

  async épingler() {
    const idBd = await this.obtIdBd();
    await this.client.épingles?.épinglerBd({
      id: idBd,
      récursif: false,
      fichiers: false,
    });
  }

  @cacheSuivi
  async suivreMotsClefs({
    f,
    idBdMotsClefs,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idBdMotsClefs?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({ idBd: idBdMotsClefs, f});
  }

  async créerMotClef(): Promise<string> {
    const idMotClef = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès: {
        address: undefined,
        premierMod: this.client.bdCompte!.id,
      },
    });

    await this.ajouterÀMesMotsClefs({ idMotClef });

    const { bd: bdMotClef, fOublier: fOublierMotClef } =
      await this.client.ouvrirBd<structureBdMotClef>({
        id: idMotClef,
        type: "kvstore",
        schéma: schémaBdMotClef
      });

    const accès = bdMotClef.access as unknown as ContrôleurConstellation;
    const optionsAccès = { address: accès.address };

    await bdMotClef.set("type", "motClef");

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdMotClef.set("noms", idBdNoms);

    const idBdDescriptions = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdMotClef.set("descriptions", idBdDescriptions);

    fOublierMotClef();
    return idMotClef;
  }

  async ajouterÀMesMotsClefs({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<string>({
      id: await this.obtIdBd(),
      type: "feed",
    });
    await bd.add(idMotClef);
    await fOublier();
  }

  async enleverDeMesMotsClefs({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<string>({ id: await this.obtIdBd(), type: "feed" });
    await this.client.effacerÉlémentDeBdListe({
      bd: bdRacine,
      élément: idMotClef,
    });
    await fOublier();
  }

  async copierMotClef({ idMotClef }: { idMotClef: string }): Promise<string> {
    const { bd: bdBase, fOublier: fOublierBase } = await this.client.ouvrirBd({ id: idMotClef, type: "keyvalue", schéma: schémaBdMotClef });

    const idNouveauMotClef = await this.créerMotClef();

    const idBdNoms = bdBase.get("noms");
    const { bd: bdNoms, fOublier: fOublierNoms } = await this.client.ouvrirBd<
      structureBdMotClef
    >({ id: idBdNoms, type: "keyvalue" });
    const noms = ClientConstellation.obtObjetdeBdDic({ bd: bdNoms }) as {
      [key: string]: string;
    };
    await this.sauvegarderNomsMotClef({ idMotClef: idNouveauMotClef, noms });

    const idBdDescriptions = bdBase.get("descriptions");
    const { bd: bdDescriptions, fOublier: fOublierDescriptions } =
      await this.client.ouvrirBd<{[langue: string]: string}>({
        id: idBdDescriptions,
        type: "keyvalue"
      });
    const descriptions = ClientConstellation.obtObjetdeBdDic({
      bd: bdDescriptions,
    }) as {
      [key: string]: string;
    };
    await this.sauvegarderDescriptionsMotClef({
      idMotClef: idNouveauMotClef,
      descriptions,
    });

    await fOublierBase();
    await fOublierNoms();
    await fOublierDescriptions();
    return idNouveauMotClef;
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
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idMotClef,
      type: "kvstore",
    });
    if (!idBdNoms) {
      throw new Error(
        `Permission de modification refusée pour mot clef ${idMotClef}.`
      );
    }

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      {[langue: string]: string}
    >({ id: idBdNoms, type: "keyvalue" });
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
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idMotClef,
      type: "kvstore",
    });
    if (!idBdNoms) {
      throw new Error(
        `Permission de modification refusée pour mot clef ${idMotClef}.`
      );
    }

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      {[langue: string]: string}
    >({ id: idBdNoms, type: "keyvalue" });
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
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idMotClef,
      type: "kvstore",
    });
    if (!idBdNoms) {
      throw new Error(
        `Permission de modification refusée pour mot clef ${idMotClef}.`
      );
    }

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      {[langue: string]: string}
    >({ id: idBdNoms, type: "keyvalue" });
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
    const idBdDescriptions = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idMotClef,
      type: "kvstore",
    });
    if (!idBdDescriptions) {
      throw new Error(
        `Permission de modification refusée pour mot clef ${idMotClef}.`
      );
    }

    const { bd: bdDescriptions, fOublier } = await this.client.ouvrirBd<
      {[langue: string]: string}
    >({ id: idBdDescriptions, type: "keyvalue" });
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
    const idBdDescriptions = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idMotClef,
      type: "kvstore",
    });
    if (!idBdDescriptions) {
      throw new Error(
        `Permission de modification refusée pour mot clef ${idMotClef}.`
      );
    }

    const { bd: bdDescriptions, fOublier } = await this.client.ouvrirBd<
      {[langue: string]: string}
    >({ id: idBdDescriptions, type: "keyvalue" });
    await bdDescriptions.set(langue, description);
    await fOublier();
  }

  async effacerDescriptionMotClef({
    id,
    langue,
  }: {
    id: string;
    langue: string;
  }): Promise<void> {
    const idBdDescriptions = await this.client.obtIdBd({
      nom: "descriptions",
      racine: id,
      type: "kvstore",
    });
    if (!idBdDescriptions) {
      throw new Error(
        `Permission de modification refusée pour mot clef ${id}.`
      );
    }

    const { bd: bdDescriptions, fOublier } = await this.client.ouvrirBd<
     {[langue: string]: string}
    >({ id: idBdDescriptions, type: "keyvalue" });
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
      f,
    });
  }

  async effacerMotClef({ idMotClef }: { idMotClef: string }): Promise<void> {
    // Effacer l'entrée dans notre liste de mots clefs
    await this.enleverDeMesMotsClefs({ idMotClef });

    // Effacer le mot-clef lui-même
    const optionsAccès = await this.client.obtOpsAccès({ idBd: idMotClef });
    for (const clef in ["noms"]) {
      const idBd = await this.client.obtIdBd({
        nom: clef,
        racine: idMotClef,
        optionsAccès,
      });
      if (idBd) await this.client.effacerBd({ id: idBd });
    }
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
