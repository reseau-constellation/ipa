# Science citoyenne

Nous y travaillons... revenez plus tard, ou, encore mieux, [contactez-nous !](mailto:julien.malard@mail.mcgill.ca)

## Le projet
Présentation du but du projet

Qu'est-ce qu'une nuée

Autorisations

## Les données
Maintenant, nous allons choisir la structure de nos données.

| Date | Endroit | Niveau d'eau | Image |
| --- | --- | --- | --- |
| 01 - 01 -2023 | A | 40 | photo325.jpeg |

Ensuite, pour garder compte de l'information sur nos zônes d'observation, nous allons créer un second tableau. Comme ça, nous ne dédoublons pas l'information de latitude, longitude et altitude à chaque observation dans le tableau ci-dessus.

| Endroit | Latitude | Longitude | Altitude |
| --- | --- | --- | --- |
| A | 1 | 2 | 3 |

:::tip CONSEIL
Nous avons deux possibilités pour le tableau des informations de site. Nous pouvions soit préciser les endroits permis pour l'entrée de données et ainsi limiter les contributions à des endroits géographiques que nous aurions pré-choisis, soit inclure le tableau des endroits d'observation dans notre nuée et ainsi permettre aux utilisatrices d'ajouter ou de définir leurs propres endroits d'observation. Pour ce tutoriel, nous avons choisi la seconde option.
:::

Chaque personne qui participe au projet de science citoyenne aura sa propre copie des données ci-dessus. Celles-ci seront regroupées par notre nuées, qui définira les règles de participation et de contribution de données.

Nous avons donc sept variables, dont 1 date, 3 numériques, 1 image et 1 chaîne (texte).

### Création des variables
Nous allons maintenant construire notre structure de données selon le schéma que nous avons établit ci-dessus. Nous allons ajouter deux tableaux à notre nuée et spécifier leurs colonnes et variables.
Pour le premier tableau, vous pouvez spécifier les colonnes de date et d'endroit en tant que colonnes indexes, et, pour le deuxième, la colonne endroit.

:::info INFO
Une colonne indexe est une colonne (ou un groupe de colonnes) dont les valeurs ne peuvent être répétées dans le tableau. Dans notre cas, chaque endroit, à un moment précis, ne peut avoir qu'une observation.
:::

[Image à inclure]

Et voici l'équivalent en code :

```ts
import { générerClient } from "@constl/ipa";

const client = générerClient();

const idVarDate = await client.variables.créerVariable({ catégorie: "horoDatage" });

// Il s'agit d'un code unique pour chaque endroit, donc pas de traductions
const idVarEndroit = await client.variables.créerVariable({
    catégorie: "chaîneNonTraduisible"
});

const idVarNiveauDEau = await client.variables.créerVariable({
    catégorie: "numérique"
})

const idVarImage = await client.variables.créerVariable({
    catégorie: "image"
})

// Continuer pour les autre variables...

// Ajouter noms
await client.variables.sauvegarderNomVariable({
    idVariable: idVarNiveauDEau,
    langue: "fr",
    nom: "Niveau d'eau"
})
// ...continuer pour les autres variables aussi

// Créer nuée
const idNuée = await client.nuées.créerNuée({});

// Créer tableaux nuée
const idTableauObs = await client.nuées.ajouterTableauNuée({
    idNuée,
    clefTableau: "observations"  // Une clef unique pour le tableau
});
const idTableauEndroits = await client.nuées.ajouterTableauNuée({
    idNuée,
    clefTableau: "endroits"
})

// Ajouter les variables au tableau d'observation
for (idVariable of [idVarEndroit, idVarDate, idVarNiveauDEau, idVarImage]) {
    await client.nuées.ajouterColonneTableauNuée({
        idTableau: idTableauObs,
        idVariable,
        // Indexer les données selon l'endroit et la date
        index: [idVarEndroit, idVarDate].includes(idVariable),
    })
}

// ... et faire de même pour le tableau des endroits d'observation

```

### Validation

[Image à inclure]

```ts
import { générerClient } from "@constl/ipa";

const client = générerClient();

await client.nuées.ajouterRègleTableauNuée({
    idTableau: idTableauObs,
    idColonne: idColNiveauDEau,
    règle: {
        typeRègle: "bornes",
        détails: {
            type: "fixe";
            val: 0,
            op: ">="
        }
    },
});
```

## Autorisations
Nous pouvons également changer les autorisations de la nuée. Vous pouvez rendre une nuée prive publique et vice-versa, ou bien inviter ou exclure des personnes.

[Image à inclure]


```ts
await client.nuées.exclureMembreDeNuée({
    idNuée,
    idCompte: "id du compte de quelqu'un que je n'aime pas"
});
```

## Collecte de données
Les participants à votre projet peuvent maintenant collecter des données. Il suffit pour eux d'ouvrir le lien vers votre nuée sur leur propre compte Constellation, de choisir l'option « Créer une base de données » et d'entrer leurs données - soit manuellement, soit d'un fichier existant - dans la nouvelle base de données. 

[Image à inclure]

Cependant, ce n'est peut-être pas l'expérience que vous désirez pour vous scientifiques citoyens. L'interface de Constellation est conçue pour des chercheuses, avec beaucoup d'options et de boutons, et il serait mieux d'avoir une interface plus simple et dirigée à votre projet. Constellation vous donne donc l'option de créer, automagiquement, une application spécifique à votre projet. Vous pouvez ensuite la distribuer à vos utilisateurs, et leurs contributions apparaîtront directement sur votre tableau de bord.

[Image à inclure]

## Visualisation
Nous pouvons maintenant visualiser les données dans l'interface Constellation. Créez une base de données sur le gabarit de votre nuée et puis ajoutez-y des données. En retournant sur la page de la nuée, vous verrez que vos données apparaissent dans la nuée.

Si vous avez une amie dans les parages, partagez-lui l'identifiant de votre nuée et demandez-lui de créer sa propre base de données et d'y ajouter des données. Elles apparaîteront dans la nuée !

[Image à inclure]

Vous pouvez également accéder aux données programmatiquement en TypeScript ou JavaScript : 

```ts
const données = await client.nuées.suivreDonnéesTableauNuée({
    idNuée,
    clefTableau: "observations",
    f: console.log,  // Ou quelque chose de plus intelligent
    nRésultatsDésirés: 1000,
})
```

## Accès programmatique
Mais ce n'est pas tout ! Vous pouvez également analyser vos données de science citoyenne dans un autre logiciel et faire des analyses en temps réel.

Tout d'abord, nous allons activer le nœud local Constellation sur l'interface et noter le numéro de port. Ceci nous permettra d'accéder Constellation à partir de notre code Python.

:::tip CONSEIL
Vous devrez installer `constellationPy` et `trio` pour suivre l'exemple ci-dessous. Nous vous recommandons **fortement** l'utilisation de [poetry](https://python-poetry.org/) pour gérer vos dépendances Python.
:::

[Image à inclure]

Voici un exemple de code Python qui vous permettra d'accéder à vos donneés de science citoyenne.

:::tip CONSEIL
Avions-nous dit que nous recommandons **fortement** l'utilisation de [poetry](https://python-poetry.org/) ?
:::

```py
import trio

from constellationPy import Serveur, ouvrir_client

# Copier l'identifiant de la nuée que vous avez créée
id_nuée = "/orbitdb/zdpu..."
clef_tableau = ""

# Le numéro de port que l'interface de Constellation vous a donné
port = 5004

# Cette fonction sera appelée chaque fois que des nouvelles données sont disponibles sur la nuée
def ma_fonction_danalyse(données):
    print(données)
    
    # Executer votre brillante analyse ici
    # ...

async def principale():
    async with ouvrir_client(port) as client:
        données = await client.suivre_données_tableau_nuée(
            id_nuée=id_nuée,
            clef_tableau=clef_tableau,
            f=ma_fonction_danalyse
        )

trio.run(principale)
```

Si vous n'êtes pas très très Python, vous pouvez aussi faire la même chose en R ou bien en Julia.

```r
library("constellationR")

# Copier l'identifiant de la nuée que vous avez créée
id_nuée = "/orbitdb/zdpu..."
clef_tableau = ""

# Le numéro de port que l'interface de Constellation vous a donné
port <- 5004

analyserDonnées <- function(données) {
    print(données)
    # Faire le reste de votre analyse...
}

avecClient(
    function(client) {
        données <- client$obtDonnéesNuée(
            idNuée = idNuée, clefTableau = clefTableau
        )
        analyserDonnées(données)
    },
    port = port
)
```

Et en Julia !

```julia
import Constellation

# L'identifiant de la nuée et du tableau d'intérêt
idNuée = "/orbitdb/zdpu..."
clefTableau = ""

# Le numéro de port que l'interface de Constellation vous a donné
port = 5004

Constellation.avecClient(port) do client
    # Obtenir les données, en français si possible, sinon en alemand
    donnéesRéseau = Constellation.obtDonnéesNuée(
        client, idNuée, clefTableau, ["fr", "de"]
    )
end
```

Pour plus d'information, voir la section sur les [autres langages](../avancé/autresLangages/introduction.md).