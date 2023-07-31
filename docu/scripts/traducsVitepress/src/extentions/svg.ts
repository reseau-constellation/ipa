import type { Message } from "@/types.js";
import { empreinte } from "../utils.js";
import { JSDOM } from "jsdom";
import xml2js from "xml2js";

import { Extention } from "./extention.js";

export class ExtentionSvg extends Extention {
  exts = ["svg"];

  async extraireMessages({ texte }: { texte: string }): Promise<Message[]> {
    const lexé = await new xml2js.Parser().parseStringPromise(texte);
    return (
      lexé.svg.text?.map((t: { _: string }) => ({ clef: "", valeur: t._ })) ||
      []
    );
  }

  async compiler({
    contenu,
    traducs,
    fichier,
  }: {
    contenu: Buffer;
    traducs: { [clef: string]: string };
    fichier: string;
  }): Promise<string> {
    const texte = contenu.toString();
    const lexé = await new xml2js.Parser().parseStringPromise(texte);
    const texteFinal: string[] = [];
    for (const t of lexé.svg.text || []) {
      const clef = fichier + "." + empreinte(t._);
      t._ = traducs[clef] || t._;
    }
    const reconstitué = new xml2js.Builder().buildObject(lexé);
    texteFinal.push(reconstitué);
    return texteFinal.join("\n");
  }
}
