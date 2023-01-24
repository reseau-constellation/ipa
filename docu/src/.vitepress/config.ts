import { defineConfig } from 'vitepress'

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
  head: [
    ["meta", { name: "theme-color", content: "#1697f6" }],
  ],

  /**
   * Theme configuration, here is the default theme configuration for VuePress.
   *
   * ref：https://v1.vuepress.vuejs.org/theme/default-theme-config.html
   */
  themeConfig: {
    editLink: {
      pattern: 'https://github.com/reseau-constellation/ipa/edit/main/docu/src/:path',
      text: 'Éditer sur GitHub'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/reseau-constellation/' }
    ],


    footer: {
      message: 'Disponible sous licence AGPL-3.0',
      copyright: '© 2021+ Julien Malard-Adam'
    },

    nav: générerNav(),
    sidebar: générerPaneau(),

  },

  locales: {
    'root': {
      lang: 'fr',
      label: "français"
    },
    த: {
      lang: 'த',
      label: 'தமிழ்',
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
        ]
      }
    },
    es: {
      lang: 'es',
      label: 'español',
      title: "Constelación",
    },

  },
});

function générerNav () {
  return [
    {
      text: "Guide",
      link: "/guide/introduction",
    },
    {
      text: "Appli",
      link: "https://réseau-constellation.ca",
    },
  ]
}

function générerPaneau () {
  return [
    {
      text: "Guide",
      items: [
        { text: "Introduction", link: "/guide/introduction" },
        { text: "Installation", link: "/guide/installation" },
        { text: "Pair à pair", link: "/guide/pairÀPair" }
      ]
    },
    {
      text: "Exemples",
      items: [
        { text: "Science citoyenne", link: "/exemples/scienceCitoyenne" },
        { text: "Diffusion de données", link: "/exemples/diffusion" }
      ],
    },
    {
      text: "Avancé",
      items: [
        { text: "Autres langages", items: [
          { text: "Introduction", link: "/avancé/autresLangages/introduction"},
          { text: "Python", link: "/avancé/autresLangages/python"},
          { text: "Julia", link: "/avancé/autresLangages/julia"},
        ] },
        { text: "Développement d'applis", items: [
          { text: "Introduction", link: "/avancé/applications/introduction" },
          { text: "Applis Internet", link: "/avancé/applications/internet" },
          { text: "Applis Électron", link: "/avancé/applications/électron" },
        ]},
        { text: "Mandataires", link: "/avancé/mandataires" },
        { text: "Configuration SFIP et Orbite", link: "/avancé/sfipEtOrbite" },
      ],
    },
    {
      text: "Documentation IPA",
      collapsible: true,
      items: [
        { text: "Introduction", link: "/ipa/introduction" },
        { text: "Profil", link: "/ipa/profil" },
        { text: "Variables", link: "/ipa/variables" },
      ],
    },
  ]
}