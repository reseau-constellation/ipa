const { defineConfig } = require("vitepress");
const rtl = require("postcss-rtl");

module.exports.configVitePress = defineConfig({
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
    nav: [
      {
        text: "Guide",
        link: "/guide/introduction",
      },
      {
        text: "Appli",
        link: "https://réseau-constellation.ca",
      },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Introduction", link: "/guide/introduction" },
          { text: "Installation", link: "/guide/installation" },
          { text: "Pair à pair", link: "/guide/pairÀPair" },
          { text: "Concepts", link: "/guide/concepts" },
        ],
      },
      {
        text: "Exemples",
        items: [
          { text: "Science citoyenne", link: "/exemples/scienceCitoyenne" },
          { text: "Diffusion de données", link: "/exemples/diffusion" },
        ],
      },
      {
        text: "Avancé",
        items: [
          {
            text: "Autres langages",
            items: [
              {
                text: "Introduction",
                link: "/avancé/autresLangages/introduction",
              },
              { text: "Python", link: "/avancé/autresLangages/python" },
              { text: "Julia", link: "/avancé/autresLangages/julia" },
            ],
          },
          {
            text: "Développement d'applis",
            items: [
              {
                text: "Introduction",
                link: "/avancé/applications/introduction",
              },
              {
                text: "Applis Internet",
                link: "/avancé/applications/internet",
              },
              {
                text: "Applis Électron",
                link: "/avancé/applications/électron",
              },
              { text: "Nuées", link: "/avancé/applications/nuées" },
            ],
          },
          { text: "Mandataires", link: "/avancé/mandataires" },
          {
            text: "Configuration SFIP et Orbite",
            link: "/avancé/sfipEtOrbite",
          },
        ],
      },
      {
        text: "Documentation IPA",
        collapsible: true,
        items: [
          { text: "Introduction", link: "/ipa/introduction" },
          { text: "Client", link: "/ipa/client" },
          { text: "Profil", link: "/ipa/profil" },
          { text: "Variables", link: "/ipa/variables" },
          { text: "Mots-clefs", link: "/ipa/motsClefs" },
          { text: "Tableaux", link: "/ipa/tableaux" },
          { text: "Bases de données", link: "/ipa/bds" },
          { text: "Projets", link: "/ipa/projets" },
          { text: "Recherche", link: "/ipa/recherche" },
          { text: "Réseau", link: "/ipa/réseau" },
          { text: "Nuées", link: "/ipa/nuées" },
        ],
      },
    ],
    footer: {
      message: "Disponible sous licence AGPL-3.0",
      copyright: "© 2021+ Contributeurs Constellation",
    },
    editLink: {
      pattern:
        "https://github.com/reseau-constellation/ipa/edit/main/docu/src/:path",
      text: "Éditer sur GitHub",
    },
  },
  vite: {
    css: {
      postcss: {
        plugins: [rtl()],
      },
    },
  },
});
