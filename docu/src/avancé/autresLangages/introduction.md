# Autres langages
Constellation a beau être un projet JavaScript, il est possible d'accéder au réseau distribué à partir de clients
dans d'autres langages informatiques. Des clients sont disposibles dans les langages suivants :

* [Python](./python.md) : Fonctionnel
* [Julia](./julia.md) : Fonctionnel
* [R](https://github.com/reseau-constellation/client-r) : En progrès.
* Autres langages : Si vous développez un client Constellation dans un autre langage, [contactez-nous](julien.malard@mail.mcgill.ca) et nous l'annoncerons ici. 

Tous ces clients fonctionnent en ouvrant un serveur WS Constellation local sur votre machine. Le client Python, Julia ou autre communiquera ensuite avec ce serveur local par messages WS et vous permettent d'utiliser Constellation dans le langage de votre choix.

Vous devrez donc toujours installer Constellation sur votre machine avant de pouvoir utiliser ces clients. La manière la plus facile est d'installer [l'interface graphique](https://réseau-constellation.ca/téléchargements) et puis d'activer le serveur WS sur la page de configuration. Alternativement, vous pouvez installer le serveur WS de Constellation sans interface graphique. Vous aurez besoin de [Node.js](https://nodejs.org/fr/) et de [pnpm](https://pnpm.io/fr/).

Si nécessaire, installer pnpm :

```sh
$ npm add -g pnpm
```

Et puis installer Constellation :

```sh
$ pnpm global add -g @constl/ipa @constl/serveur
```
