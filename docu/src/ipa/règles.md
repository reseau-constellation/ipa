# Règles
Les règles vous permettent de contrôler automatiquement la qualité des données dans vos [bases de données](./bds.md) autant que dans vos [nuées](./nuées.md) de données.

## Sources
Les règles peuvent être appliquées soit aux [variables](./variables.md#regles), soit directement aux [tableaux](./tableaux.md#regles).

:::info
Lorsque multiples règles s'appliquent à une colonne d'un tableau, soit-ce par sa variable ou bien directement du tableau lui-même, elles sont toutes appliquées aux valeurs de la colonne. Par exemple, si une variable représentant la température minimale a la règle `tempMin >= -80` et la colonne a la règle `tempMin <= tempMax`, la règle de validation effective sera `-80 <= tempMin <= tempMax`.
:::

## Types de règles
Constellation inclut quatre types de règles.

### 1. Catégorie variable
Ces règles sont appliquées automatiquement selon la catégorie associée à la variable et s'assurent que les valeurs de la variable sont de la bonne catégorie. Vous n'avez pas besoin de les spécifier manuellement.

### 2. Existe
Les règles de type `existe` précisent que les valeurs manquantes ne sont pas acceptables. Elles peuvent être appliquées à tout type de variable.

```TypeScript
import type { valid } from "@constl/ipa";

import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idVariable = await client.variables.créerVariable({ catégorie: "image" });

const règle: valid.règleExiste =  {
    typeRègle: "existe",
    détails: {},
};

// Les colonnes associées à cette variable ne peuvent pas contenir de données manquantes
await client.variables.ajouterRègleVariable({ idVariable, règle })
```

### 3. Bornes
Les règles de type `bornes` limitent les valeurs possibles d'une variable numérique ou d'horodatage. Les bornes peuvent être relatives à une valeur fixe ou bien à une autre variable ou colonne dans le tableau.

::: tip
Chaque règle effectue une seule comparaison. Pour borner une variable des deux côtés, utiliser deux règles bornes.
:::

#### Bornes fixes
Les bornes fixes précisent une valeur contre laquelle les valeurs des données seront comparées. L'opération de comparaison peut être l'une de `'>'`, `'<'`, `'≥' | '>='` ou `'≤' | '<='`.

```TypeScript
import type { valid } from "@constl/ipa";

import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.variables.sauvegarderNomVariable({ 
    idVariable, nom: "précipitation", langue: "fr" 
});

// La précipitation doit être positive
const règle: valid.règleBornes<valid.détailsRègleBornesFixe> = {
    typeRègle: "bornes",
    détails: {
        type: "fixe",
        val: 0,
        op: "≥",  // ou bien ">=" ; c'est pareil
    },
};

await client.variables.ajouterRègleVariable({ idVariable, règle })
```

#### Bornes dynamiques
Les bornes dynamiques comparent les données à une valeur dynamique provenant d'une autre colonne du même tableau. Ces comparaisons s'effectuent ligne par ligne ; c'est-à-dire, chaque valeur sera comparée à la valeur de la variable ou colonne référence dans la même ligne du tableau.

```TypeScript
import type { valid } from "@constl/ipa";

import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idVariableTempMin = await client.variables.créerVariable({ 
    catégorie: "numérique" 
});
await client.variables.sauvegarderNomVariable({ 
    idVariable: idVariableTempMin, nom: "température minimum", langue: "fr" 
});

const idVariableTempMax = await client.variables.créerVariable({ 
    catégorie: "numérique" 
});
await client.variables.sauvegarderNomVariable({ 
    idVariable: idVariableTempMax, nom: "température maximum", langue: "fr" 
});

// La température minimum ne peut pas être supérieure à la température maximum correspondante
const règle: valid.règleBornes<valid.détailsRègleBornesDynamiqueVariable> = {
    typeRègle: "bornes",
    détails: {
        type: "dynamiqueVariable",
        val: idVariableTempMax,
        op: "≤",  // ou bien "<=" ; c'est pareil
    },
};

await client.variables.ajouterRègleVariable({ idVariable: idVariableTempMin, règle });

```

Nous pouvons également ajouter une comparaison directement à un tableau, en connectant la règle à l'identifiant de la colonne au lieu de celui de la variable.

```TypeScript
const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });
const idColonneTempMin = await client.tableaux.ajouterColonneTableau({
    idTableau,
    idVariable: idVariableTempMin,
});
const idColonneTempMax = await client.tableaux.ajouterColonneTableau({
    idTableau,
    idVariable: idVariableTempMax,
});
const règleTempMax: valid.règleBornes<valid.détailsRègleBornesDynamiqueColonne> = {
    typeRègle: "bornes",
    détails: {
        type: "dynamiqueColonne",
        val: idColonneTempMin,
        op: "≥",
    },
};

await client.tableaux.ajouterRègleTableau({
    idTableau,
    idColonne: idColonneTempMax,
    règle: règleTempMax,
});

```


### 4. Valeurs catégoriques
Les règles de type `catégorique` s'appliquent à toute catégorie de variable et indiquent que les valeurs de la variable doivent figurer parmi une liste de valeurs possibles. Ces règles peuvent s'appliquer à des variables autant qu'à des tableaux.

#### Fixes
Les règles catégoriques fixes incluent une liste fixe de valeurs permises.
```TypeScript
import type { valid } from "@constl/ipa";

import { générerClient } from "@constl/ipa";
const client = générerClient({});

// Une base de données
const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idTableauObservations = await client.bds.ajouterTableauBd({ idBd })

// Une variable pour le site d'échantillonnage
const idVariableSiteÉchantillon = await client.variables.créerVariable({ 
    catégorie: "chaîneNonTraductible" 
});
await client.variables.sauvegarderNomVariable({ 
    idVariable: idVariableSiteÉchantillon, 
    nom: "Identifiant site", 
    langue: "fr" 
});
await client.variables.sauvegarderDescriptionVariable({
    idVariable: idVariableSiteÉchantillon, 
    description: "Identifiant du site d'échantillonnage", 
    langue: "fr"
});
const idColonneSiteÉchantillon = await client.tableaux.ajouterColonneTableau({
    idTableau,
    idVariable: idVariableSiteÉchantillon
});

// Une variable pour le niveau d'eau
const idVariableNiveauDEau = await client.variables.créerVariable({ 
    catégorie: "numérique" 
});
await client.variables.sauvegarderNomVariable({ 
    idVariable: idVariableNiveauDEau, nom: "Niveau d'eau", langue: "fr" 
});
const idColonneNiveauDEau = await client.tableaux.ajouterColonneTableau({
    idTableau,
    idVariable: idVariableNiveauDEau
});

// Le site doit être l'un des sites d'échantillonnage connus
const règleFixe: valid.règleValeurCatégorique = {
    typeRègle: "valeurCatégorique",
    détails: { 
        type: "fixe", 
        options: [  // Liste des identifiants pour vos sites
            "Saint-Laurent 1", "Saint-Laurent 2"
        ]
    },
};

await client.tableaux.ajouterRègleTableau({ 
    idTableau: idTableauObservations, 
    idColonne: idColonneSiteÉchantillon,
    règle: règleFixe 
});

```

#### Dynamiques
Mais peut-être que vos sites d'échantillonnage risquent d'évoluer avec le temps. Dans ce cas, il serait mieux de créer un autre tableau avec les informations de vos sites (identifiant, longitude et latitude) et lier les deux tableaux ensemble. Ceci peut se faire avec une règle catégorique dynamique.

:::tip ASTUCE
Dans ce cas-ci, nous ajoutons le tableau à la même base de données, mais il pourrait aussi bien appartenir à une base de données à part.
:::

```TypeScript
// On ajoute un autre tableau.
const idTableauInfoSites = await client.bds.ajouterTableauBd({ idBd });

const idVariableIdSite = await client.variables.créerVariable({ 
    catégorie: "chaîneNonTraductible" 
});
const idColonneIdSite = await client.tableaux.ajouterColonneTableau({
    idTableau: idTableauInfoSites,
    idVariable: idVariableIdSite,
});

const règleDynamique: règleValeurCatégorique = {
    typeRègle: "valeurCatégorique",
    détails: {
        type: "dynamique",
        tableau: idTableauInfoSites,
        colonne: idColonneIdSite,
    },
};

await client.variables.ajouterRègleTableau({ 
    idTableau: idTableauObservations, 
    idColonne: idColonneSiteÉchantillon,
    règle: règleFixe 
});
```

## Types

## Types règles
Ces types spécifient les structures des règles de tableau et de variable.

```ts
type règleColonne<T extends règleVariable = règleVariable> = {
  règle: règleVariableAvecId<T>;
  source: sourceRègle;
  colonne: string;
};

type règleVariableAvecId<T extends règleVariable = règleVariable> = {
  id: string;
  règle: T;
};

type règleVariable =
  | règleExiste
  | règleBornes
  | règleValeurCatégorique
  | règleCatégorie;

```

## Types erreurs
Ces types sont associés aux erreurs de validation des données et des règles elles-mêmes.

```ts
type erreurValidation<T extends règleVariable = règleVariable> = {
  id: string;
  erreur: {
    règle: règleColonne<T>;
  };
};

type erreurRègle =
  | erreurRègleCatégoriqueColonneInexistante
  | erreurRègleBornesColonneInexistante
  | erreurRègleBornesVariableNonPrésente;

type erreurRègleCatégoriqueColonneInexistante = {
  règle: règleColonne<
    règleValeurCatégorique<détailsRègleValeurCatégoriqueDynamique>
  >;
  détails: "colonneCatégInexistante";
};

type erreurRègleBornesColonneInexistante = {
  règle: règleColonne<règleBornes<détailsRègleBornesDynamiqueColonne>>;
  détails: "colonneBornesInexistante";
};

type erreurRègleBornesVariableNonPrésente = {
  règle: règleColonne<règleBornes<détailsRègleBornesDynamiqueVariable>>;
  détails: "variableBornesNonPrésente";
};

```