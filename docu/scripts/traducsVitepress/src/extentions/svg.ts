import { JSDOM } from "jsdom";

import { Extention } from "./extention.js";

export class ExtentionSvg extends Extention {
  ext = "svg";

  async extraireMessages({
    texte,
  }: {
    texte: string;
  }): Promise<{ [clef: string]: string }> {
    const lexé = await xml2js.Parser().parseStringPromise(svg);
    return lexé.svg.text.map((t) => t._);
  };

  async compiler({ texte, traducs, fichier }: { texte: string; traducs: { [clef: string]: string; }; fichier: string; }): Promise<string> {
    const lexé = await xml2js.Parser().parseStringPromise(texte);
          for (const t of lexé.svg.text) {
            const clef = calculerClef(fichier, t._);
            t._ = traductions[clef] || t._;
          }
          const reconstitué = new xml2js.Builder().buildObject(lexé);
          texteFinal.push(reconstitué);
          break;
  }
  
}

