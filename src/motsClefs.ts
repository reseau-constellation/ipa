import { FeedStore, KeyValueStore } from "orbit-db";
import ClientConstellation, {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  élémentBdListe,
} from "./client";
import ContrôleurConstellation from "./accès/cntrlConstellation";

export default class MotsClefs {
  client: ClientConstellation;
  idBd: string;

  constructor(client: ClientConstellation, id: string) {
    this.client = client;
    this.idBd = id;
  }

  async suivreMotsClefs(
    f: schémaFonctionSuivi<string[]>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListe<string>(this.idBd, f);
  }

  async créerMotClef(): Promise<string> {
    const bdRacine = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
    const idBdMotClef = await this.client.créerBdIndépendante("kvstore", {
      adresseBd: undefined,
      premierMod: this.client.bdRacine!.id,
    });
    await bdRacine.add(idBdMotClef);

    const bdMotClef = (await this.client.ouvrirBd(
      idBdMotClef
    )) as KeyValueStore;

    const accès = bdMotClef.access as unknown as ContrôleurConstellation;
    const optionsAccès = { adresseBd: accès.adresseBd };

    const idBdNoms = await this.client.créerBdIndépendante(
      "kvstore",
      optionsAccès
    );
    await bdMotClef.set("noms", idBdNoms);

    return idBdMotClef;
  }

  async copierMotClef(id: string): Promise<string> {
    const bdBase = (await this.client.ouvrirBd(id)) as KeyValueStore;

    const idNouveauMotClef = await this.créerMotClef();

    const idBdNoms = await bdBase.get("noms");
    const bdNoms = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    const noms = ClientConstellation.obtObjetdeBdDic(bdNoms) as {
      [key: string]: string;
    };
    await this.ajouterNomsMotClef(idNouveauMotClef, noms);

    return idNouveauMotClef;
  }

  async ajouterNomsMotClef(
    id: string,
    noms: { [key: string]: string }
  ): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", id, "kvstore");
    if (!idBdNoms)
      throw `Permission de modification refusée pour mot clef ${id}.`;

    const bdNoms = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
  }

  async sauvegarderNomMotClef(
    id: string,
    langue: string,
    nom: string
  ): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", id, "kvstore");
    if (!idBdNoms)
      throw `Permission de modification refusée pour mot clef ${id}.`;

    const bdNoms = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    await bdNoms.set(langue, nom);
  }

  async effacerNomMotClef(id: string, langue: string): Promise<void> {
    const idBdNoms = await this.client.obtIdBd("noms", id, "kvstore");
    if (!idBdNoms)
      throw `Permission de modification refusée pour mot clef ${id}.`;

    const bdNoms = (await this.client.ouvrirBd(idBdNoms)) as KeyValueStore;
    await bdNoms.del(langue);
  }

  async suivreNomsMotClef(
    id: string,
    f: schémaFonctionSuivi<{ [key: string]: string }>
  ): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef(id, "noms", f);
  }

  async effacerMotClef(id: string): Promise<void> {
    // Effacer l'entrée dans notre liste de mots clefs
    const bdRacine = (await this.client.ouvrirBd(this.idBd)) as FeedStore;
    const entrée = bdRacine
      .iterator({ limit: -1 })
      .collect()
      .find((e: élémentBdListe<string>) => e.payload.value === id);
    await bdRacine.remove(entrée.hash);
    await this.client.effacerBd(id);
  }
}
