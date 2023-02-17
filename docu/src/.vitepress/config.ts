import { DefaultTheme, defineConfig, LocaleConfig } from "vitepress";
import { languePrincipale, langues } from "../../scripts/consts.js";
import { générerPaneau } from "../../scripts/traducsVitePress.js";


export default defineConfig({
  lang: "fr",
  title: "Constellation",
  description: "Le réseau distribué pour les données scientifiques",
  // base: "/ipa/",  // Uniquement nécessaire sur https://réseau-constellation.github.io/ipa

  /**
   * Extra tags to be injected to the page HTML `<head>`
   *
   * ref：https://v1.vuepress.vuejs.org/config/#head
   */
  head: [["meta", { name: "theme-color", content: "#1697f6" }]],

  /**
   * Theme configuration, here is the default theme configuration for VuePress.
   *
   * ref：https://v1.vuepress.vuejs.org/theme/default-theme-config.html
   */
  themeConfig: {
    editLink: {
      pattern:
        "https://github.com/reseau-constellation/ipa/edit/main/docu/src/:path",
      text: "Éditer sur GitHub",
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/reseau-constellation/" },
    ],

    footer: {
      message: "Disponible sous licence AGPL-3.0",
      copyright: "© 2021+ Julien Malard-Adam",
    },

    nav: générerNav(),
    sidebar: générerPaneau(),
  },

  locales: générerLocales(),
});

function générerLocales (): LocaleConfig<DefaultTheme.Config> {
  return  {
    root: {
      lang: languePrincipale,
      label: languePrincipale,
    },
    ...Object.fromEntries(langues.map(lng=>{
      return [lng, {
        lang: lng,
        label: lng,
        title: "வீண்மீன்",
        themeConfig: {
          nav: [
            {
              text: "வழிகாட்டி",
              link: "/த/guide/introduction",
            },
            {
              text: "செயலி",
              link: "https://réseau-constellation.ca/?lg=த",
            },
          ],
          sidebar: générerPaneau(lng),
        },
      }]
    }))

  }
}

function générerNav() {
  return [
    {
      text: "Guide",
      link: "/guide/introduction",
    },
    {
      text: "Appli",
      link: "https://réseau-constellation.ca",
    },
  ];
}
