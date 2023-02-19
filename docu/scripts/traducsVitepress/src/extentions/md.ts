import { empreinte } from "@/utils.js";
import { marked } from "marked";
import { Extention } from "./extention.js";

export class ExtentionMd extends Extention {
  ext = "md";

  async extraireMessages({texte}: {texte: string}): Promise<{ [clef: string]: string }> {
    const lexé = marked.lexer(texte);
    return Object.fromEntries(
      lexé.filter((l) => l.type !== "space").map((l) => {
        return [{
          clef: "",
          valeur: l.raw
        }]
      })
    );
  }

  async compiler({ texte, traducs, fichier }: { texte: string; traducs: { [clef: string]: string; }; fichier: string; }): Promise<string> {
    const texteFinal: string[] = []
    const lexée = marked.lexer(texte);
    for (const élément of lexée) {
      const clef = fichier +"."+ empreinte(élément.raw);
      const traduction = traducs[clef];
      texteFinal.push(traduction || élément.raw);
    }
    return texteFinal.join("\n");
  }
}
