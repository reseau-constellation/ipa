export abstract class Extention {
  abstract exts?: string[];

  abstract extraireMessages({
    texte,
  }: {
    texte: string;
  }): Promise<{ clef: string; valeur: string }[]>;

  abstract compiler({
    contenu,
    traducs,
    fichier,
    langue,
  }: {
    contenu: Buffer;
    traducs: { [clef: string]: string };
    fichier: string;
    langue: string;
  }): Promise<string|NodeJS.ArrayBufferView>;
}

export class ExtentionDéfaut extends Extention {
  exts = undefined;
  async extraireMessages({ texte, }: { texte: string; }): Promise<{ clef: string; valeur: string; }[]> {
    return [];
  }
  async compiler({ contenu, traducs, fichier, langue, }: { contenu: Buffer; traducs: { [clef: string]: string; }; fichier: string; langue: string; }): Promise<Buffer> {
    return contenu
  }

}