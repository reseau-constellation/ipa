import { empreinte } from "../utils.js";
import { marked } from "marked";
import { Extention } from "./extention.js";
import type { Message } from "@/types.js";

export class ExtentionMd extends Extention {
  ext = "md";

  constructor() {
    super();
  }

  analyserComposante({
    composante,
  }: {
    composante: marked.Token;
  }): { clef: string; valeur: string }[] {
    switch (composante.type) {
      case "space":
        return [];
      case "heading": {
        return [
          {
            clef: "",
            valeur: composante.tokens
              .map((t) =>
                this.analyserComposante({ composante: t }).map((x) => x.valeur)
              )
              .join(""),
          },
        ];
      }
      case "table": {
        const entête = composante.header
          .map((e) =>
            e.tokens
              .map((j) => this.analyserComposante({ composante: j }).flat())
              .flat()
          )
          .flat();
        const files = composante.rows
          .map((f) =>
            f
              .map((c) =>
                c.tokens
                  .map((j) => this.analyserComposante({ composante: j }).flat())
                  .flat()
              )
              .flat()
          )
          .flat();
        return [...entête, ...files];
      }
      case "image":
      case "link": {
        const items = [{ clef: "", valeur: composante.text }];
        if (!composante.href.startsWith("/")) {
          items.push({ clef: "", valeur: composante.href });
        }
        return items;
      }
      case "paragraph":
        if (composante.tokens.length === 1)
          return this.analyserComposante({ composante: composante.tokens[0] });
        return [
          {
            clef: "",
            valeur: composante.raw,
          },
        ];
      case "text":
      case "codespan":
      default:
        return [
          {
            clef: "",
            valeur: composante.raw,
          },
        ];
    }
  }

  reconstruireComposante({
    composante,
    fichier,
    traducs,
    langue,
  }: {
    composante: marked.Token;
    fichier: string;
    traducs: { [clef: string]: string };
    langue: string;
  }): string {
    const obtTrad = (texte: string): string => {
      const clef = fichier + "." + empreinte(texte);
      const traduction = traducs[clef];
      return traduction || texte;
    };
    const traduireLien = (lien: string): string => {
      if (lien.startsWith("/")) return `/${langue}${lien}`;
      else return obtTrad(lien);
    };
    switch (composante.type) {
      case "space":
        return composante.raw;
      case "heading":
        return (
          "#".repeat(composante.depth) +
          " " +
          composante.tokens
            .map((j) =>
              this.reconstruireComposante({
                composante: j,
                fichier,
                traducs,
                langue,
              })
            )
            .join("") +
          "\n"
        );
      case "table":
        return (
          composante.header
            .map((e) =>
              e.tokens
                .map((j) =>
                  this.reconstruireComposante({
                    composante: j,
                    fichier,
                    traducs,
                    langue,
                  })
                )
                .join("")
            )
            .join(" | ") +
          "\n" +
          composante.align
            .map((a) => {
              switch (a) {
                case "center":
                  return ":---:";
                case "left":
                  return ":---";
                case "right":
                  return "---:";
                case null:
                default:
                  return "---";
              }
            })
            .join(" | ") +
          "\n" +
          composante.rows
            .map((f) =>
              f
                .map((c) =>
                  c.tokens
                    .map((j) =>
                      this.reconstruireComposante({
                        composante: j,
                        fichier,
                        traducs,
                        langue,
                      })
                    )
                    .join("")
                )
                .join(" | ")
            )
            .join("\n") +
          "\n"
        );
      case "link":
        return `[${obtTrad(composante.text)}](${traduireLien(
          composante.href
        )})`;
      case "image":
        return `![${obtTrad(composante.text)}](${traduireLien(
          composante.href
        )})`;
      case "paragraph":
        return composante.tokens
          .map((x) =>
            this.reconstruireComposante({
              composante: x,
              fichier,
              traducs,
              langue,
            })
          )
          .join("");
      case "text":
      case "codespan":
        return obtTrad(composante.raw);
      default:
        return obtTrad(composante.raw);
    }
  }

  async extraireMessages({ texte }: { texte: string }): Promise<Message[]> {
    const lexé = marked.lexer(texte);
    return lexé
      .map((l) => {
        return this.analyserComposante({ composante: l });
      })
      .filter((c) => !!c)
      .flat() as Message[];
  }

  async compiler({
    texte,
    traducs,
    fichier,
    langue,
  }: {
    texte: string;
    traducs: { [clef: string]: string };
    fichier: string;
    langue: string;
  }): Promise<string> {
    const texteFinal: string[] = [];
    const lexée = marked.lexer(texte);
    for (const composante of lexée) {
      texteFinal.push(
        this.reconstruireComposante({ composante, fichier, traducs, langue })
      );
    }
    return texteFinal.join("") + "\n";
  }
}
