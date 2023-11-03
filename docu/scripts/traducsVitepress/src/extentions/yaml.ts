import type { Message } from "@/types.js";
import { empreinte } from "../utils.js";

import { parse, stringify } from "yaml";
import { Extention } from "./extention.js";

type ComposanteYaml =
  | { [clef: string]: ComposanteYaml }
  | ComposanteYaml[]
  | string;
type DocYaml = { [clef: string]: ComposanteYaml };

export class ExtentionYaml extends Extention {
  exts = ["md"];

  constructor() {
    super();
  }

  extraireComposanteYaml({
    composante,
    adresse = [],
  }: {
    composante: ComposanteYaml;
    adresse?: string[];
  }): Message[] {
    if (typeof composante === "string") {
      return [{ clef: "", valeur: composante }];
    } else if (Array.isArray(composante)) {
      return composante
        .map((c) => this.extraireComposanteYaml({ composante: c, adresse }))
        .flat();
    } else {
      return Object.entries(composante)
        .map(([clef, val]) => {
          if (adresse.join("/") === "hero/actions" && clef === "theme") return;
          if (clef === "layout") return;
          if (clef === "link" && typeof val === "string") {
            return val.startsWith("/")
              ? undefined
              : {
                  clef: "",
                  valeur: val,
                };
          } else {
            return this.extraireComposanteYaml({
              composante: val,
              adresse: [...adresse, clef],
            });
          }
        })
        .flat()
        .filter((x) => !!x) as Message[];
    }
  }

  reconstruireComposanteYaml({
    composante,
    traducs,
    fichier,
    langue,
    adresse = [],
  }: {
    composante: ComposanteYaml;
    traducs: { [clef: string]: string };
    fichier: string;
    langue: string;
    adresse?: string[];
  }): ComposanteYaml {
    const obtTrad = (texte: string): string => {
      const clef = fichier + "." + empreinte(texte);
      const traduction = traducs[clef];
      return traduction || texte;
    };

    const traduireLien = (lien: string): string => {
      if (lien.startsWith("/")) return `/${langue}${lien}`;
      else return obtTrad(lien);
    };

    if (typeof composante === "string") {
      return adresse.splice(-1)[0] === "link"
        ? traduireLien(composante)
        : obtTrad(composante);
    } else if (Array.isArray(composante)) {
      return composante.map((c) =>
        this.reconstruireComposanteYaml({
          composante: c,
          traducs,
          fichier,
          langue,
          adresse,
        }),
      );
    } else {
      return Object.fromEntries(
        Object.entries(composante).map(([clef, val]) => [
          clef,
          this.reconstruireComposanteYaml({
            composante: val,
            traducs,
            fichier,
            langue,
            adresse: [...adresse, clef],
          }),
        ]),
      );
    }
  }

  async extraireMessages({ texte }: { texte: string }): Promise<Message[]> {
    const texteYaml = texte.slice(
      texte.indexOf("---\n") + 4,
      texte.indexOf("---\n", 1),
    );
    const yaml = parse(texteYaml) as DocYaml;
    return this.extraireComposanteYaml({ composante: yaml });
  }

  async compiler({
    contenu,
    traducs,
    fichier,
    langue,
  }: {
    contenu: Buffer;
    traducs: { [clef: string]: string };
    fichier: string;
    langue: string;
  }): Promise<string> {
    const texte = contenu.toString();

    const texteYaml = texte.slice(
      texte.indexOf("---\n") + 4,
      texte.indexOf("---\n", 1),
    );
    const yaml = parse(texteYaml) as DocYaml;
    const yamlTraduit = this.reconstruireComposanteYaml({
      composante: yaml,
      traducs,
      fichier,
      langue,
    });
    return "---\n" + stringify(yamlTraduit) + "---\n";
  }
}
