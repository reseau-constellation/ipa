import type { Nuchabäl } from "nuchabal";
import { DefaultTheme, defineConfig, LocaleConfig } from "vitepress";
import { languePrincipale, langues } from "../../scripts/consts.js";
import { générerNav, générerPaneau, générerPiedDePage, générerTitre, générerLienÉditer } from "../../scripts/traducsVitePress.js";
import rtl from "postcss-rtl";

export default async () => {
  const { Nuchabäl } = await import("nuchabal");
  const nuchabäl = new Nuchabäl({})
  return defineConfig({
  lang: languePrincipale,
  title: générerTitre(languePrincipale),
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
    editLink: générerLienÉditer(),

    socialLinks: [
      { icon: "github", link: "https://github.com/reseau-constellation/" },
    ],

    footer: générerPiedDePage(),

    nav: générerNav(),
    sidebar: générerPaneau(),
  },

  locales: générerLocales(nuchabäl),
  vite: {
    css: {
      postcss: {
        plugins: [
          rtl()
        ]
      }
      
    }
  }
})};

function générerLocales (nuchabäl: Nuchabäl): LocaleConfig<DefaultTheme.Config> {
  return  {
    root: {
      lang: languePrincipale,
      label: nuchabäl?.rubiChabäl({runuk: languePrincipale}) || languePrincipale,
    },
    ...Object.fromEntries(langues.map(lng=>{
      const écriture = nuchabäl?.rutzibChabäl({runuk: lng}) || "";
      return [lng, {
        lang: lng,
        label: nuchabäl?.rubiChabäl({runuk: lng}) || lng,
        title: générerTitre(lng),
        dir: nuchabäl?.rucholanemTzibanem({runuk: écriture}) === "←↓" ? 'rtl': 'ltr',

        themeConfig: {
          nav: générerNav(lng),
          sidebar: générerPaneau(lng),
          editLink: générerLienÉditer(lng),
          footer: générerPiedDePage(lng)
        },
      }]
    }))

  }
}


