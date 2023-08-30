# Julia
Le client Julia vous permet d'accéder au réseau Constellation à partir d'un programme en [Julia](https://julialang.org/).

[![Client Julia](https://github.com/reseau-constellation/Constellation.jl/actions/workflows/CI.yml/badge.svg)](https://github.com/reseau-constellation/Constellation.jl/actions/workflows/CI.yml)

[![Couverture](https://codecov.io/gh/reseau-constellation/Constellation.jl/branch/principale/graph/badge.svg?token=1HbFsyDC8y)](https://codecov.io/gh/reseau-constellation/Constellation.jl)

## Installation
Vous pouvez installer le client Julia ainsi :

```
pkg> add Constellation
```

## Utilisation
Vous pouvez accéder à toutes les fonctions de Constellation de type action ou suivi avec le client Julia. Les actions sont les fonctions qui vous redonnent immédiatement une valeur, tandis que les [fonctions de suivi](../../ipa/introduction.md#quelques-concepts) sont celles qui écoutent des changements du réseau et vous renvoient les nouvelles données en temps réel, au fur et à mesure qu'elles changent.

### Initialisation
Vous devrez d'abord initialiser un nœud Constellation local sur votre machine. Vous pouvez le lancer manuellement à travers l'interface, ou bien le lancer directement en Julia :

```Julia
import Constellation

# D'abord, lancer le nœud local
Constellation.avecServeur() do port
    Constellation.avecClient(port) do client
        # Faire quelque chose avec Constellation...
    end
end

# Ou, si vous avez lancé le nœud local à travers l'interface, notez le numéro de port et puis lancer le client directement
port = 5123  # Changer comme nécessaire

Constellation.avecClient(port) do client
    # Faire quelque chose avec Constellation...
end
```

### Actions et suivis
Pour appeller une fonction d'action, utilisez `Constellation.action`. Cette fonction prend le client, le nom de la fonction Constellation telle que [documentée](../../ipa/introduction.md) et puis, s'il y a lieu, un dictionnaire des paramètres de la fonction.

Pour appeller une fonction de suivi, utilisez `Constellation.suivi`. Cette fonction prend les mêmes paramètres que `Constellation.action`, mais mettra les résultats à jour automatiquement chaque fois que ceux-ci changent.

```Julia
import Constellation

# D'abord, lancer le nœud local
Constellation.avecServeur() do port
    Constellation.avecClient(port) do client
        
        # Vous pouvez appeler une fonction sans argument...
        idCompte = Constellation.action(client, "obtIdCompte")

        # ...ou avec arguments
        idBd = Constellation.action(client, "bds.créerBd", Dict([("licence", "ODbl-1_0")]))

        # Nous pouvons aussi appeler des fonctions de suivi
        Constellation.action(
            client, 
            "bds.sauvegarderNomsBd", 
            Dict([("idBd", idBd), ("noms", Dict([("fr", "Météo"), ("த", "காலநிலை")]))])
        )
        
        dicNoms = Dict([])
        réponse = Constellation.suivre(client, "bds.suivreNomsBd", Dict([("id", idBd)])) do noms
            dicNoms = noms
        end
        
        print(dicNoms)

        # Annuler le suivi
        réponse["fOublier"]()  
        
        # Il est probablement plus commode d'obtenir une image instantanée du résultat
        nomsÀCetInstant = Constellation.suivreUneFois(client, "bds.suivreNomsBd", Dict([("id", idBd)]))

    end
end

```

### Fonctions raccourci
Quelques fonctions spéciales vous permettent d'effectuer rapidement des actions communes, dont `Constellation.obtDonnéesTableau` qui permet d'obtenir les données d'un `Tableau` Constellation et `Constellation.obtDonnéesNuée` qui résume les données d'une `Nuée`, tous en format [`DataFrames.DataFrame`](https://dataframes.juliadata.org/stable/).

```Julia
import Constellation

# D'abord, lancer le nœud local
Constellation.avecServeur() do port
    Constellation.avecClient(port) do client

        # Obtenir les données d'un Tableau
        donnéesTableau = Constellation.obtDonnéesTableau(client, idTableau)

        # Obtenir les données d'une Nuée, en français si possible, sinon en alemand
        donnéesRéseau = Constellation.obtDonnéesNuée(client, idNuée, clefTableau, ["fr", "de"])
    end
end
```

### Recherche
Les fonctions de recherche fonctionnent comme `Constellation.suivi`, mais elles envoient deux fonctions en guise de réponse plutôt qu'une seule : une pour annuler la recherche (`fOublier`), et une pour modifier le nombre de résultats désirés (`fChangerN`).

```Julia
import Constellation

# D'abord, lancer le nœud local
Constellation.avecServeur() do port
    Constellation.avecClient(port) do client
        
        # Créer 5 variables pour rechercher
        variables = [
            Constellation.action(
                client, 
                "variables.créerVariable", 
                Dict([("catégorie", "numérique")])
            ) for _ in 1:4
        ]

        résultatsRecherche = []
        réponse = Constellation.suivre(
            client, 
            "recherche.rechercherVariableSelonNom", 
            Dict([("nomVariable", "humidité"), ("nRésultatsDésirés", 3)])
        ) do résultat
            résultatsRecherche = résultat
        end

        # Nos fonctions de contrôle
        fOublier = réponse["fOublier"]
        fChangerN = réponse["fChangerN"]

        # Détecter nouvelles variables
        Constellation.action(
            client, 
            "variables.sauvegarderNomsVariable", 
            Dict([("idVariable", variables[1]), ("noms", Dict([("fr", "Humidite")]))])
        )
        Constellation.action(
            client, 
            "variables.sauvegarderNomsVariable", 
            Dict([("idVariable", variables[2]), ("noms", Dict([("fr", "humidite")]))])
        )
        
        print([r["id"] for r in résultatsRecherche] == [variables[2], variables[1]])

        # Diminuer N
        fChangerN(1)
        sleep(1)  # Laisser le temps que ça aie effet
        print(length(résultatsRecherche))  # == 1
        print(résultatsRecherche[1]["id"] == variables[2])  # Le meilleur résultat devrait être retenu

        # Améliorer résultat recherche
        Constellation.action(
            client, 
            "variables.sauvegarderNomsVariable", 
            Dict([
                ("idVariable", variables[3]), 
                ("noms", Dict([("fr", "humidité")]))
            ])
        )
        print(résultatsRecherche[1]["id"])  # == variables[3]

        # Augmenter N
        fChangerN(4)
        sleep(1)
        print(length(résultatsRecherche))  # == 3

        # Arrêter le suivi
        fOublier()

        # Maintenant, les résultats ne sont plus réactifs
        Constellation.action(
            client, 
            "variables.sauvegarderNomsVariable", 
            Dict([
                ("idVariable", variables[4]), 
                ("noms", Dict([("fr", "humidité")]))
            ])
        )
        print(length(résultatsRecherche))  # Toujours égal à 3

    end
end
```