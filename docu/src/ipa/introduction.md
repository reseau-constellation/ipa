# Interface de programmation d'application (IPA)
L'interface de programmation d'application (IPA) de Constellation vous permet d'utiliser Constellation dans vos propres logiciels et applications. Cette section documente les fonctions de Constellation en JavaScript/TypeScript, son langage principa. Pour utiliser Constellation dans d'autres langages informatiques, voir la section sur les [autres langages](/avancé/autresLangages/introduction.md).

[[toc]]

## Installation
Pour ajouter l'IPA de Constellation à votre projet, installez la librarie `@constl/ipa`:

```sh
$ pnpm add @constl/ipa
```

## Quelques concepts
Constellation étant une base de données distribuée **et locale**, les données sont immédiatement disponibles sur le dispositif, mais peuvent changer avec le temps si des nouvelles données sont obtenues du réseau. Cette différence avec les bases de données centralisées mène à quelques différences conceptuelles dans notre façon d'écrire le code.

Pour obtenir des données d'un système centralisé, on écrirait quelque chose du genre :
```TypeScript
const BD = ouvrirConnexionÀBaseDeDonnéesÀLautreBoutDuMonde("Mon mot de passe")

const imageDeProfil = (await BD.rechercher({id: "ID de compte"})).image;
```

Mais si jamais la personne change son image, nous n'avons aucune façon de le savoir. Il va falloir rafraîchir la page, ou bien faire quelque chose de bien inefficace et laid, et redemander les données à toutes les 5 secondes :

```TypeScript
let imageDeProfil: string|undefined
setInterval(async ()=>{
    imageDeProfil = (await BD.rechercher({id: "ID de compte"})).image;
}, 5000)
```

Constellation est bien plus simple. On ne demande pas à Constellation de nous donner la réponse à notre requète, mais plutôt de nous prévenir chaque fois que la réponse change ! Ça prend un peu de temps à s'y habituer, mais c'est bien plus pratique.

```TypeScript
import ClientConstellation from "@constl/ipa"

const client = ClientConstellation();

let image: Uint8Array | null;

const oublierImage = await client.réseau.suivreImageMembre({ 
    idCompte: "id du compte qui m'intéresse",
    f: x => image.value = x 
});

// Arrêter le suivi
await oublierImage();
```

Comme ça, chaque fois que l'image de profil de cette personne changera sur le réseau, vous obtiendrez automagiquement la valeur à jour dans la variable `image`. Notez que chaque fonction de suivi retourne une fonction d'oubli; lorsque vous l'invoquez, le suivi des résultats sera interrompu.

Ou bien, si vous préférez un exemple plus complet avec Vue.js :

```Vue
<template>
    <img :src="imageURL" />
</template>

<script setup lang="ts">
import ClientConstellation from "@constl/ipa"
import { ref, inject, computed, onMounted, onUnmounted } from "vue";

const client = inject<ClientConstellation>("constl")  // Initialiser le client dans une extention Vue

const image = ref<Uint8Array | null>();

const imageURL = computed(() => {
    if (image.value){
        return URL.createObjectURL(
            new Blob([image.value.buffer], { type: `image/png` })
        );
    } else {
        return undefined
    }
})
let oublierImage: undefined | () => Promise<void>

onMounted(async () => {
    // Mettre l'image à jour chaque fois qu'elle change
    oublierImage = await client.réseau.suivreImageMembre({ 
        idCompte: "id du compte qui m'intéresse",
        f: x => image.value = x 
    });
})
onUnmounted(async () => {
    // Éviter une fuite de mémoire lorsqu'on ferme la composante
    if (oublierImage) await oublierImage();
})

</script>

```


## Composantes de Constellation

### Profil
Le [profil](/ipa/profil.md) de Constellation organise les information du compte d'utilisateur.

### Mots-clefs
Les [mots-clefs](/ipa/motsClefs.md) servent à indexer les bases de données.

### Bases de données
L'unité centrale de Constellation est la [base de données](/ipa/bds.md).

### Tableaux
Chaque base de données à un ou plusieurs [tableaux](/ipa/bds.md).

### Variables
Chaque colonne d'un tableau est associée à une [variable](/ipa/variables.md).

### Projet
Un [projet](/ipa/projets.md) regroupe plusieurs bases de données traitant du même sujet.

### Réseau
Le [réseau](/ipa/réseau.md) vous permet d'accéder aux informations des autres membres connectés.

### Recherche
Vous pouvez également [rechercher](/ipa/recherche.md) les données qui vous intéressent.

### Nuée
Les [nuées](/ipa/nuée.md) vous permettent de créer des projets de science citoyenne et de collecter toutes les contributions de vos participants à la même place.
