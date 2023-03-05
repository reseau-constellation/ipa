import fs from "fs";
import path from "path";
import rtl from "postcss-rtl";

import { Extention } from "./extentions/extention.js";
import { empreinte } from "./utils.js";

import type { UserConfig, DefaultTheme } from "vitepress";
import type { Nuchabäl } from "nuchabal";
import { ExtentionMd } from "./extentions/md.js";
import { ExtentionSvg } from "./extentions/svg.js";

export class Compilateur {
  languePrincipale: string;
  languesCibles: string[];
  dossierSource: string;
  dossierTraductions: string;
  racineProjet: string;
  configVitePress: UserConfig<DefaultTheme.Config>;
  extentions: Extention[];

  dossiersIgnorés: string[];

  nuchabäl?: Nuchabäl;

  constructor({
    languePrincipale,
    languesCibles,
    dossierSource,
    dossierTraductions,
    racineProjet = ".",
    configVitePress,
    extentions = [],
    nuchabäl,
  }: {
    languePrincipale: string;
    languesCibles: string[];
    dossierSource: string;
    dossierTraductions: string;
    racineProjet?: string;
    configVitePress: UserConfig<DefaultTheme.Config>;
    extentions?: Extention[];
    nuchabäl?: Nuchabäl;
  }) {
    this.languePrincipale = languePrincipale;
    this.languesCibles = languesCibles.filter(
      (lng) => lng !== languePrincipale
    ); // Au cas où
    this.racineProjet = path.resolve(racineProjet);
    this.dossierSource = path.join(this.racineProjet, dossierSource);
    this.dossierTraductions = path.join(this.racineProjet, dossierTraductions);
    this.configVitePress = configVitePress;
    this.extentions = [new ExtentionMd(), new ExtentionSvg(), ...extentions];
    
    this.dossiersIgnorés = [
      path.join(this.dossierSource, ".vitepress")
    ]

    this.nuchabäl = nuchabäl;
  }

  obtCompilateur({ ext }: { ext: string }): Extention {
    const compilateur = this.extentions.find((e) => e.ext === ext);
    if (!compilateur)
      throw new Error(`Compilateur introuvable pour fichiers .${ext}.`);

    return compilateur;
  }

  obtTraductions({ langue }: { langue: string }) {
    const fichierTraducsLangue = path.join(
      this.dossierTraductions,
      langue + ".json"
    );
    return fs.existsSync(fichierTraducsLangue)
      ? JSON.parse(fs.readFileSync(fichierTraducsLangue).toString())
      : {};
  }

  *itérerDossier({
    dossier,
  }: {
    dossier: string;
  }): Generator<{ ext: string; fichier: string }> {
    const fichiers = fs.readdirSync(dossier);
    const exts = this.extentions.map((x) => x.ext);

    for (const fichier of fichiers) {
      const adresseAbsolue = path.join(dossier, fichier)
      const f = fs.statSync(adresseAbsolue);
      if (f.isDirectory()) {
        if (this.dossiersIgnorés.includes(adresseAbsolue)) continue
        for (const x of this.itérerDossier({
          dossier: adresseAbsolue,
        })) {
          yield x;
        }
      } else {
        const ext = fichier.split(".").pop();
        // Pour éviter d'inclure les fichiers déjà traduits...VitePresse à une drôle de structure de fichiers !
        // Mais je n'y suis pour rien.
        const premièrePartieDossier = path.relative(this.dossierSource, dossier).split(path.sep)[0];
        if (
          ext &&
          exts.includes(ext) &&
          !this.languesCibles.includes(premièrePartieDossier)
        ) {
          yield { ext, fichier: adresseAbsolue };
        }
      }
    }
  }

  extraireTexteDict({
    dict = {},
    racineClef = "",
  }: {
    dict?: DefaultTheme.Config[keyof DefaultTheme.Config];
    racineClef?: string;
  }): { clef: string; valeur: string }[] {
    if (Array.isArray(dict)) {
      return Object.entries(dict)
        .map(([i, x]) =>
          this.extraireTexteDict({
            dict: x,
            racineClef: racineClef + "." + String(i),
          })
        )
        .flat();
    } else if (typeof dict === "object") {
      return Object.entries(dict)
        .map(([clef, valeur]) => {
          if (typeof valeur === 'string' && valeur[0] !== "/") {
            return { clef: racineClef + "." + clef, valeur };
          } else if (typeof valeur === 'object') {
            return this.extraireTexteDict({
              dict: valeur,
              racineClef: racineClef + "." + clef,
            });
          } else {
            return undefined
          }
        })
        .flat().filter(x=>!!x) as {clef: string, valeur: string}[];
    } else {
      throw new Error(`Oups ! Ça devrait vraiment pas arriver. ${dict}`);
    }
  }

  obtConfigNav(): DefaultTheme.Config["nav"] {
    return this.configVitePress.themeConfig?.nav;
  }
  obtConfigPiedDePage(): DefaultTheme.Config["footer"] {
    return this.configVitePress.themeConfig?.footer;
  }
  obtConfigPanneau(): DefaultTheme.Config["sidebar"] {
    return this.configVitePress.themeConfig?.sidebar;
  }
  obtConfigLiensÉditer(): DefaultTheme.Config["socialLinks"] {
    return this.configVitePress.themeConfig?.socialLinks;
  }

  async extraireMessages(): Promise<{ clef: string; valeur: string }[]> {
    let messages: { clef: string; valeur: string }[] = [];
    for (const { fichier, ext } of this.itérerDossier({
      dossier: this.dossierSource,
    })) {
      const fichierRelatif = path.relative(this.dossierSource, fichier);
      const texte = fs.readFileSync(fichier).toString();

      const compilateur = this.obtCompilateur({ ext });
      const messagesFichier = await compilateur.extraireMessages({ texte });

      const messagesFichierFinal = messagesFichier.map(({ clef, valeur }) => {
        return {
          clef: clef ? `${fichierRelatif}.${clef}` : fichierRelatif,
          valeur,
        };
      });
      messages = [...messages, ...messagesFichierFinal];
    }

    const nav = this.obtConfigNav();
    const piedDePage = this.obtConfigPiedDePage();
    const panneau = this.obtConfigPanneau();
    const liensÉditer = this.obtConfigLiensÉditer();
    messages = [
      ...messages,
      ...this.extraireTexteDict({ dict: nav, racineClef: "nav" }),
      ...this.extraireTexteDict({ dict: piedDePage, racineClef: "pied" }),
      ...this.extraireTexteDict({ dict: panneau, racineClef: "panneau" }),
      ...this.extraireTexteDict({
        dict: liensÉditer,
        racineClef: "liensÉditer",
      }),
    ];
    if (this.configVitePress.title) {
      messages.push({ clef: "titre", valeur: this.configVitePress.title });
    }

    return messages;
  }

  async mettreFichiersTraducsÀJour(): Promise<void> {
    const messages = await this.extraireMessages();
    const messagesJSON: { [clef: string]: string } = Object.fromEntries(
      messages.map(({ clef, valeur }) => {
        return [clef + "." + empreinte(valeur), valeur];
      })
    );
    if (
      !fs.existsSync(this.dossierTraductions) ||
      !fs.statSync(this.dossierTraductions).isDirectory()
    ) {
      fs.mkdirSync(this.dossierTraductions, { recursive: true });
    }
    const fichierTraducs = path.join(
      this.dossierTraductions,
      this.languePrincipale + ".json"
    );
    fs.writeFileSync(fichierTraducs, JSON.stringify(messagesJSON, null, 4));

    for (const langue of this.languesCibles) {
      const traducsLangue = this.obtTraductions({ langue });
      const fichierTraducsLangue = path.join(
        this.dossierTraductions,
        langue + ".json"
      );
      fs.writeFileSync(
        fichierTraducsLangue,
        JSON.stringify(traducsLangue, null, 2) + "\n"
      );
    }
  }

  async compiler(): Promise<void> {
    for (const langue of this.languesCibles) {
      const dossierSourcesTraduites = path.join(this.dossierSource, langue);
      if (fs.existsSync(dossierSourcesTraduites))
        fs.rmdirSync(dossierSourcesTraduites, { recursive: true });
      fs.mkdirSync(dossierSourcesTraduites, { recursive: true });

      const traducs = this.obtTraductions({ langue });

      for (const { fichier, ext } of this.itérerDossier({
        dossier: this.dossierSource,
      })) {
        const texte = fs.readFileSync(fichier).toString();

        const compilateur = this.obtCompilateur({ ext });
        const compilé = await compilateur.compiler({ texte, traducs, fichier });

        const composantesAdresseFichier = path.relative(this.dossierSource, fichier);
        const fichierSourceTraduite = path.join(
          this.dossierSource,
          langue,
          composantesAdresseFichier
        );

        const dossierSourceTraduite = fichierSourceTraduite
          .split(path.sep)
          .slice(0, -1)
          .join(path.sep);
        if (!fs.existsSync(dossierSourceTraduite))
          fs.mkdirSync(dossierSourceTraduite, { recursive: true });

        fs.writeFileSync(fichierSourceTraduite, compilé);
      }
    }
  }

  compilerConfig<T extends Record<string, any> | Array<any>>({
    langue,
    config,
    clefRacine,
  }: {
    langue: string;
    config?: T;
    clefRacine?: string;
  }): any {
    if (Array.isArray(config)) {
      return Object.entries(config)
        .map(([i, x]) => {
          return this.compilerConfig({
            langue,
            config: x,
            clefRacine: clefRacine + "." + String(i),
          });
        })
        .flat();
    } else if (typeof config === "object") {
      return Object.fromEntries(
        Object.entries(config).map(([clef, valeur]) => {
          if (clef === "link" && valeur[0] === "/") {
            return [clef, "/" + langue + valeur];
          } else if (clef === "text") {
            const traductions = this.obtTraductions({ langue });
            const clefTraduc = clefRacine + "." + clef;
            const traduc = traductions[clefTraduc];
            return [clef, traduc || valeur];
          } else {
            return [
              clef,
              this.compilerConfig({
                langue,
                config: valeur,
                clefRacine: clefRacine + "." + clef,
              }),
            ];
          }
        })
      );
    } else {
      return config;
    }
  }

  générerTitre({ langue }: { langue: string }): string {
    const traductions = this.obtTraductions({ langue });
    return traductions["titre"];
  }

  async générerConfigVitePress(): Promise<UserConfig<DefaultTheme.Config>> {
    const config = this.configVitePress;

    const nuchabäl =
      this.nuchabäl || new (await import("nuchabal")).Nuchabäl({});

    const configNav = this.obtConfigNav();
    const configPiedDePage = this.obtConfigPiedDePage();
    const configPanneau = this.obtConfigPanneau();
    const configLiensÉditer = this.obtConfigLiensÉditer();

    config.locales = {
      root: {
        lang: this.languePrincipale,
        label:
          nuchabäl.rubiChabäl({ runuk: this.languePrincipale }) ||
          this.languePrincipale,
      },
      ...Object.fromEntries(
        this.languesCibles.map((langue) => {
          const écriture = nuchabäl.rutzibChabäl({ runuk: langue }) || "";
          return [
            langue,
            {
              lang: langue,
              label: nuchabäl.rubiChabäl({ runuk: langue }) || langue,
              title: this.générerTitre({ langue }) || config.title,
              dir:
                nuchabäl.rucholanemTzibanem({ runuk: écriture }) === "←↓"
                  ? "rtl"
                  : "ltr",

              themeConfig: {
                nav: this.compilerConfig({
                  langue,
                  config: configNav,
                  clefRacine: "nav",
                }),
                sidebar: this.compilerConfig({
                  langue,
                  config: configPanneau,
                  clefRacine: "panneau",
                }),
                editLink: this.compilerConfig({
                  langue,
                  config: configLiensÉditer,
                  clefRacine: "liensÉditer",
                }),
                footer: this.compilerConfig({
                  langue,
                  config: configPiedDePage,
                  clefRacine: "piedDePage",
                }),
              },
            },
          ];
        })
      ),
    };

    config.vite = {
      css: {
        postcss: {
          plugins: [rtl()],
        },
      },
    };
    return config;
  }

  ajusterGitIgnore() {
    const lignes = fs
      .readFileSync(`${this.racineProjet}/.gitignore`, "utf-8")
      .split("\n");
    const déjàLà: string[] = [];
    const dossierSourceRelatif = path.relative(this.racineProjet, this.dossierSource)
    for (const l of lignes) {
      const existe = this.languesCibles.find(
        (lng) => l === `${dossierSourceRelatif}/${lng}`
      );
      if (existe) déjàLà.push(existe);
    }
    let modifié = false;
    for (const lng of this.languesCibles.filter(
      (lng) => !déjàLà.includes(lng)
    )) {
      lignes.push(`${dossierSourceRelatif}/${lng}`);
      modifié = true;
    }
    if (modifié) lignes.push("");

    fs.writeFileSync(`.gitignore`, lignes.join("\n"));
  }
}
