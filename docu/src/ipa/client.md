# Client

[[toc]]

## Initialisation


## Identité
obtIdCompte
Obtenir l'identifiant du compte Constellation.

suivreIdBdCompte
Suivre l'identifiant du compte Constellation. Celui-ci ne changera que si le dispositif se rejoint à un compte existant.

obtIdOrbite
Obtenir l'identifiant [bd-orbite](https://github.com/orbitdb/orbit-db) du compte Constellation.

obtIdSFIP
Obtenir l'identifiant du nœud de Système de fichiers interplanétaire ([SFIP](https://ipfs.io/)) connecté au compte Constellation.

## Dispositifs
Différents dispositifs (téléphones, ordinateurs) peuvent être connectés au même compte Constellation.

suivreDispositifs
Suivre les dispositifs associés à ce compte.

nommerDispositif
Spécifier un nom pour votre dispositif afin de mieux le reconnaître.

suivreNomsDispositifs
Suivre les noms des dispositifs associés à un compte.

suivreNomDispositif
Suivre le nom d'un dispositif spécifique.

générerInvitationRejoindreCompte
Générer une invitation qu'un autre dispositif peut utiliser pour se joindre à ce compte.

:::danger
**Ne partagez pas l'invitation générée de façon publique !** N'importe qui connaît le secret pourra se connecter à votre compte et agir en tant que vous.
:::

révoquerInvitationRejoindreCompte
Révoquer une invitation. Uniquement possible si l'invitation n'a pas encore été utilisée.

considérerRequèteRejoindreCompte
Considérer une demande de rejoindre ce compte et ajouter le dispositif si l'invitation est valide.

demanderEtPuisRejoindreCompte
Utiliser une invitation pour rejoindre un compte existant.

exporterDispositif
Exporter les données de ce dispositifs pour pouvoir le réinitialiser en cas de perte.

effacerDispositif
Effacer ce dispositif.

:::danger
**Cette action est irréversible** et effacera toutes les données liées à votre dispositif. Pour effacer votre compte Constellation, effacer tous les dispositifs connectés au compte.
:::

## Autre

suivreProtocoles

suivreTypeObjet

suivrePermission

suivrePermissionÉcrire

fermer
