import { empreinte } from "../utils.js";
import { marked } from "marked";
import { Extention } from "./extention.js";

export abstract class AnalyseurComposanteMd {
  abstract type: string;

}

export class AnalyseurEntête implements AnalyseurComposanteMd {
  type="heading"

}

export class ExtentionMd extends Extention {
  ext = "md";
  analyseurs: AnalyseurComposanteMd[];

  constructor({ analyseurs= []}: {analyseurs?: AnalyseurComposanteMd[]}) {
    super();
    this.analyseurs = [new AnalyseurEntête(), ...analyseurs]
  }

  analyserComposante({composante}: {composante: marked.Token}): {clef: string, valeur: string}|undefined {
    switch (composante.type) {
      case "space":
        return;
      case "heading":
        return {
          clef: "",
          valeur: composante.tokens.map(t=>this.analyserComposante({composante: t})?.valeur).join("")
        };
      case "table":
        return {
          clef: "",
          valeur: composante.raw
        }
      case 'text':
      case 'codespan':
      default:
        return {
          clef: "",
          valeur: composante.raw,
        };
    }
  }

  reconstruireComposante({composante, fichier, traducs}: {composante: marked.Token, fichier: string, traducs:  { [clef: string]: string }}): string {
    const obtTrad = (texte: string): string => {
      const clef = fichier + "." + empreinte(texte);
      const traduction = traducs[clef];
      return traduction || composante.raw;
    }
    switch (composante.type) {
      case 'space':
        return composante.raw;
      case 'heading':
        return "#".repeat(composante.depth) + " " + obtTrad(this.analyserComposante({composante})?.valeur || composante.raw) + "\n"
      case 'text':
      case 'codespan':
      default:
        return obtTrad(this.analyserComposante({composante})?.valeur || composante.raw);
    }
  }

  async extraireMessages({
    texte,
  }: {
    texte: string;
  }): Promise<{ clef: string; valeur: string }[]> {
    const lexé = marked.lexer(texte);
    return lexé
      .filter((l) => l.type !== "space")
      .map((l) => {
        return this.analyserComposante({composante: l});
      }).filter(c=>!!c) as {clef: string, valeur: string}[];
  }

  async compiler({
    texte,
    traducs,
    fichier,
  }: {
    texte: string;
    traducs: { [clef: string]: string };
    fichier: string;
  }): Promise<string> {
    const texteFinal: string[] = [];
    const lexée = marked.lexer(texte);
    for (const composante of lexée) {
      texteFinal.push(this.reconstruireComposante({composante, fichier, traducs}));
    }
    return texteFinal.join("\n");
  }
}
