
# Applis Électron
Si vous développez une appli Électron, vous pourriez évidemment simplement utiliser Constellation dans le [processus de rendu](https://www.electronjs.org/fr/docs/latest/tutorial/process-model#the-renderer-process) comme s'il s'agissait d'un site web. Les processus rendu, cependant, ont les mêmes limitations que les sites webs - notamment, ils ne peuvent pas accéder au système de fichier de l'ordinateur, et sont limités en mémoire. Afin d'activer les fonctionnalités plus puissantes de Constellation telles la sauvegarde et l'importation automatisées, vous devriez utiliser Constellation dans le [processus principal](https://www.electronjs.org/fr/docs/latest/tutorial/process-model#the-main-process) d'Électron.

Vu que c'est un peu compliqué d'accéder aux fonctionnalités du processus principal à partir du processus de rendu d'où vous voudrez utiliser Constellation (ils on rendu ça [bien compliqué](https://www.electronjs.org/fr/docs/latest/tutorial/tutorial-preload), pour des raisons de sécurité), on vous a créé une petite librairie qui s'occupe de tout ça pour vous !

## Installation
D'abord, ajoutez `@constl/mandataire-electron-principal` et `@constl/mandataire-electron-rendu` à votre projet :

```sh
$ pnpm add @constl/mandataire-electron-rendu @constl/mandataire-electron-principal
```

## Configuration initiale
On vous recommande d'initialiser votre projet Électron avec ce [gabarit-ci](https://github.com/cawa-93/vite-electron-builder). Ça nous a sauvé beaucoup de maux de tête.

## Comment ça fonctionne
Le mandataire Électron vous permet de faire rouler Constellation dans le processus principal d'Électron avec tous les avantages (accès aux système de fichiers, plus de mémoire, meilleure connectivité) mais de faire *semblant* qu'il roule dans le processus de rendu Électron. Comme ça, vous pouvez utiliser Constellation dans vos pages de site web (Vue, React, etc.) comme si de rien n'était !
Comment c'est possible ? En bref, ça fonctionne en créant une seule instance de Constellation dans le processus principal, qu'on attachera à chaque fenêtre ouverte de votre appli. Ensuite, on fait un peu de magie pour permettre au processus de rendu de communiquer avec Constellation dans le processus principal.

## Utilisation : processus principal

Dans un fichier séparé, initialisez le gestionnaire qui connectra les fenêtres de votre appli Éllectron à Constellation.

```TypeScript
// constellation.ts
import { GestionnaireFenêtres } from '@constl/mandataire-electron-principal';

const enDéveloppement = process.env.NODE_ENV !== 'production';  // Changer selon votre configuration

const importationIPA = import('@constl/ipa');

const importationServeur = import('@constl/serveur');  // Uniquement si vous voulez aussi activer un serveur WS local.

export const gestionnaireFenêtres = new GestionnaireFenêtres({ 
  enDéveloppement,
  importationIPA,
  importationServeur,  // Uniquement si vous voulez aussi activer un serveur WS local.
});
```

Connecter chaque nouvelle fenêtre de votre appli à Constellation au moment où vous la créez :
```TypeScript
// main.ts
import {BrowserWindow} from 'electron';

fenêtre = new BrowserWindow();
gestionnaireFenêtres.connecterFenêtreÀConstellation(fenêtre);
```

Et surtout, n'oubliez pas de fermer Constellation lorsqu'on a fini.

```TypeScript
// main.ts
app.on('will-quit', async () => {
  await gestionnaireFenêtres.fermerConstellation();
});
```

## Utilisation : Processus de rendu
Vous pouvez maintenant connecter Constellation à votre processus de rendu. Vous devriez utiliser une seule instance
de Constellation dans votre application. Voici ci-dessous un exemple avec [Vue.js](https://fr.vuejs.org/) et [vuetify]https://next.vuetifyjs.com/).

```TypeScript
// plugins/constellation.ts

import {
  envoyerMessageÀConstellation,
  écouterMessagesDeConstellation,
  envoyerMessageÀServeurConstellation,
  écouterMessagesDeServeurConstellation,
} from '#preload';
import type {App} from 'vue';

import {
  générerMandataireÉlectronPrincipal,
  GestionnaireServeur,
} from '@constl/mandataire-electron-rendu';

export default {
  install: (app: App) => {
    app.provide('constl', générerMandataireÉlectronPrincipal({
      envoyerMessageÀConstellation,
      écouterMessagesDeConstellation,
    }));

    // Uniquement si vous voulez aussi activer un serveur WS local.
    app.provide('serveurConstl', new GestionnaireServeur({
      écouterMessagesDeServeurConstellation,
      envoyerMessageÀServeurConstellation,
    }));
  },
};

```

Et voilà, le tour est joué ! Vous pouvez maintenant utiliser Constellation directement dans votre application Électron, directement du processus de rendu :

```Vue
<script setup lang="ts">
import { ref, inject } from 'vue';

const constellation = inject('constl');
const idBd = ref<string>();

const créerBd = async () => {
  idBd.value = await constellation.bds.créerBd({ licence: 'ODbl-1_0' })
};
</script>
```

Vous pouvez également activer le serveur WS local, ce qui rendra l'instance de Constellation de votre appli
également accessible à d'autres programmes locaux sur votre ordinateur. Ceci permet, par exemple,
de connecter un client [Python](https://github.com/reseau-constellation/client-python) ou 
[Julia](https://github.com/reseau-constellation/Constellation.js) à l'instance Constellation de votre appli.

```Vue
<template>
  <div>
    <p v-if="port">
      Serveur actif sur port {{ port }}
      <v-btn @click="fermerServeurLocal">
        Fermer le serveur
      </v-btn>
    </p>
    <p v-else>
      Serveur non initialisé
      <v-btn @click="initialiserServeurLocal">
        Initialiser le serveur
      </v-btn>
    </p>
  </div>
</template>

<script lang="ts">
import { inject, ref } from 'vue';

const serveur = inject('serveurConstl');
const port = ref<number>();

const initialiserServeurLocal = async () => {
  port.value = await serveur.initialiser();  // Ou spécifier le port avec serveur.initialiser(PORT);
}

const fermerServeurLocal = async () => {
  await serveur.fermer()  // Quand on a fini
  port.value = undefined
}
</script>
```


