# Applis Internet
C'est très facile d'incorporer Constellation à vos applications. Le point important est de créer une seule instance de Constellation qui sera utilisée par toutes les partis de votre appli.

## Exemple Vue 3
Voici un exemple d'extention [Vue.js 3](https://fr.vuejs.org/) qui crée une instance de Constellation et la rend disponible à l'ensemble de votre application.

```TypeScript
// extentions/constellation.ts
import type {App} from 'vue';

import {mandataire} from '@constl/ipa';

export default {
  install: (app: App) => {
    const client = mandataire.ipa.générerMandataireProc();
    app.provide('constl', client);
  },
};

```

Nous enrégistrerons notre extention lors de la création de l'appli :

```TypeScript
// index.ts
import {createApp} from 'vue';
import App from '/@/App.vue';
import constellation from './extentions/constellation.js';

const app = createApp(App);

app.use(constellation);

app.mount('#app');
```

Et c'est tout ! Vous pouvez maintenant utiliser Constellation dans l'ensemble de votre appli. Amusez-vous !

```Vue
<script setup lang="ts">
// composantes/MonCompte.vue
import { ref, inject, onMounted, onUnmounted } from 'vue';
import type ClientConstellation from "@constl/ipa";

const constellation = inject<ClientConstellation>('constl');
const idCompte = ref<string>();

let fOublierIdCompte: () => Promise<void> | undefined;
onMounted(async () => {
    fOublierIdCompte = await constellation.suivreIdBdCompte({ 
        f: id => idCompte.value = id
    });
})

// Il faut arrêter le suivi lorsque la composante n'est plus utilisée
onUnmounted(async () => {
    if (fOublierIdCompte) await fOublierIdCompte();
})
</script>

<template>
    <h1>Mon compte : {{ idCompte }}</h1>
</template>
```
