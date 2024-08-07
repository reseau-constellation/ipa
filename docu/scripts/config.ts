import { defineConfig } from "vitepress";

export const configVitePress = defineConfig({
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
        link: "https://appli.réseau-constellation.ca/?lg=fr",
      },
    ],
    sidebar: [
      {
        // @ts-expect-error Je ne sais pas pourquoi
        text: "Guide",
        items: [
          { text: "Introduction", link: "/guide/introduction" },
          { text: "Installation", link: "/guide/installation" },
          { text: "Pair à pair", link: "/guide/pairÀPair" },
          { text: "Terminologie", link: "/guide/concepts" },
          { text: "Questions fréquentes", link: "/guide/questions" },
        ],
      },
      {
        // @ts-expect-error Je ne sais pas pourquoi
        text: "Exemples",
        items: [
          { text: "Démarrage", link: "/exemples/créationCompte" },
          { text: "Gestion de compte", link: "/exemples/monCompte" },
          { text: "Ajout de données", link: "/exemples/mesDonnées" },
          { text: "Science citoyenne", link: "/exemples/scienceCitoyenne" },
          { text: "Diffusion de données", link: "/exemples/diffusion" },
        ],
      },
      {
        // @ts-expect-error Je ne sais pas pourquoi
        text: "Avancé",
        items: [
          {
            text: "Autres langages",
            items: [
              {
                text: "Introduction",
                link: "/avancé/autresLangages/introduction",
              },
              { text: "Julia", link: "/avancé/autresLangages/julia" },
              { text: "Python", link: "/avancé/autresLangages/python" },
              { text: "R", link: "/avancé/autresLangages/r" },
              { text: "Nœud local", link: "/avancé/autresLangages/nœudLocal" },
              {
                text: "Nouveaux langages",
                link: "/avancé/autresLangages/nouveauxLangages",
              },
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
        ],
      },
      {
        // @ts-expect-error Je ne sais pas pourquoi
        text: "Documentation IPA",
        collapsible: true,
        items: [
          { text: "Introduction", link: "/ipa/introduction" },
          { text: "Client", link: "/ipa/client" },
          { text: "Profil", link: "/ipa/profil" },
          { text: "Mots-clefs", link: "/ipa/motsClefs" },
          { text: "Variables", link: "/ipa/variables" },
          { text: "Licences", link: "/ipa/licences" },
          { text: "Bases de données", link: "/ipa/bds" },
          { text: "Tableaux", link: "/ipa/tableaux" },
          { text: "Projets", link: "/ipa/projets" },
          { text: "Nuées", link: "/ipa/nuées" },
          { text: "Favoris", link: "/ipa/favoris" },
          { text: "Automatisations", link: "/ipa/automatisations" },
          { text: "Règles", link: "/ipa/règles" },
          { text: "Recherche", link: "/ipa/recherche" },
          { text: "Réseau", link: "/ipa/réseau" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/reseau-constellation" },
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
    docFooter: {
      prev: "Page précédente",
      next: "Prochaine page",
    },
    darkModeSwitchLabel: "Thème",
    search: {
      provider: "local",
    },
    outlineTitle: "Sur cette page",
    sidebarMenuLabel: "Menu",
    lastUpdatedText: "Dernière mise à jour",
    returnToTopLabel: "Haut de page",
  },
});
