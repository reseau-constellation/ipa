import FeedStore from "orbit-db-feedstore";
import KeyValueStore from "orbit-db-kvstore";

import type {
  schémaFonctionSuivi,
  schémaFonctionOublier,
} from "@/utils/index.js";
import { objRôles } from "@/accès/types.js";

import ClientConstellation from "@/client.js";
import ContrôleurConstellation from "@/accès/cntrlConstellation.js";

type typeÉlémentsBdMotClef = string;

export default class MotsClefs {
  client: ClientConstellation;
  idBd: string;

  constructor({ client, id }: { client: ClientConstellation; id: string }) {
    this.client = client;
    this.idBd = id;
  }

  async suivreMotsClefs({
    f,
    idBdMotsClefs,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idBdMotsClefs?: string;
  }): Promise<schémaFonctionOublier> {
    idBdMotsClefs = idBdMotsClefs || this.idBd;
    return await this.client.suivreBdListe<string>({ id: idBdMotsClefs, f });
  }

  async créerMotClef(): Promise<string> {
    const idBdMotClef = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès: {
        address: undefined,
        premierMod: this.client.bdCompte!.id,
      },
    });

    await this.ajouterÀMesMotsClefs({ id: idBdMotClef });

    const { bd: bdMotClef, fOublier: fOublierMotClef } =
      await this.client.ouvrirBd<KeyValueStore<typeÉlémentsBdMotClef>>({
        id: idBdMotClef,
      });

    const accès = bdMotClef.access as unknown as ContrôleurConstellation;
    const optionsAccès = { address: accès.address };

    await bdMotClef.set("type", "motClef");

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdMotClef.set("noms", idBdNoms);

    fOublierMotClef();
    return idBdMotClef;
  }

  async ajouterÀMesMotsClefs({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd<FeedStore<string>>({
      id: this.idBd,
    });
    await bd.add(id);
    fOublier();
  }

  async enleverDeMesMotsClefs({ id }: { id: string }): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >({ id: this.idBd });
    await this.client.effacerÉlémentDeBdListe({ bd: bdRacine, élément: id });
    fOublier();
  }

  async copierMotClef({ id }: { id: string }): Promise<string> {
    const { bd: bdBase, fOublier: fOublierBase } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id });

    const idNouveauMotClef = await this.créerMotClef();

    const idBdNoms = bdBase.get("noms");
    const { bd: bdNoms, fOublier: fOublierNoms } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    const noms = ClientConstellation.obtObjetdeBdDic({ bd: bdNoms }) as {
      [key: string]: string;
    };
    await this.ajouterNomsMotClef({ id: idNouveauMotClef, noms });

    fOublierBase();
    fOublierNoms();
    return idNouveauMotClef;
  }

  async inviterAuteur({
    idMotClef,
    idBdCompteAuteur,
    rôle,
  }: {
    idMotClef: string;
    idBdCompteAuteur: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    await this.client.donnerAccès({
      idBd: idMotClef,
      identité: idBdCompteAuteur,
      rôle,
    });
  }

  async ajouterNomsMotClef({
    id,
    noms,
  }: {
    id: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
    });
    if (!idBdNoms) {
      throw `Permission de modification refusée pour mot clef ${id}.`;
    }

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    fOublier();
  }

  async sauvegarderNomMotClef({
    id,
    langue,
    nom,
  }: {
    id: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
    });
    if (!idBdNoms) {
      throw `Permission de modification refusée pour mot clef ${id}.`;
    }

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.set(langue, nom);
    fOublier();
  }

  async effacerNomMotClef({
    id,
    langue,
  }: {
    id: string;
    langue: string;
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
    });
    if (!idBdNoms) {
      throw `Permission de modification refusée pour mot clef ${id}.`;
    }

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBd<
      KeyValueStore<string>
    >({ id: idBdNoms });
    await bdNoms.del(langue);
    fOublier();
  }

  async suivreNomsMotClef({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({ id, clef: "noms", f });
  }

  async effacerMotClef({ id }: { id: string }): Promise<void> {
    // Effacer l'entrée dans notre liste de mots clefs
    await this.enleverDeMesMotsClefs({ id });

    // Effacer le mot-clef lui-même
    const optionsAccès = await this.client.obtOpsAccès({ idBd: id });
    for (const clef in ["noms"]) {
      const idBd = await this.client.obtIdBd({
        nom: clef,
        racine: id,
        optionsAccès,
      });
      if (idBd) await this.client.effacerBd({ id: idBd });
    }
    await this.client.effacerBd({ id });
  }

  async suivreQualitéMotClef({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<number>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreNomsMotClef({
      id,
      f: (noms) => f(Object.keys(noms).length ? 1 : 0),
    });
  }
}
