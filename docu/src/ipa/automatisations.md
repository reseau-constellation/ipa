# Automatisations
Les automatisations vous permettent d'importer ou d'exporter des données de Constellation de manière indépendante soit selon un horaire prédéterminé, soit chaque fois que Constellation détecte des changements aux données.

[[toc]]

## Fonctions
Vous pouvez automatiser l'importation ou l'exportation de [tableaux](./tableaux.md). Les [bases de données](./bds.md), les [projets](./projets.md) et les [nuées](./nuées.md) ne peuvent être qu'exportées.

:::tip ASTUCE
Les importations peuvent provenir de fichiers locaux ou bien d'URLs et fonctionnent dans le navigateur aussi bien que dans le version installée de Constellation. Cependant, il n'est poas possible d'importer automatiquement d'un fichier local dans le navigateur (vous devrez l'importer manuellement, car les navigateurs ne peuvent pas accéder vos fichiers locaux).

Les URLs ne peuvent être importés qu'à des fréquences fixes, car il est impossible de savoir si les données disponibles sur un URL externe ont été modifiées sans aller les rechercher à nouveau.
:::


| Opération | Node.js/Électron | Navigateur | Fréquence temporelle | Selon modifications | Tableaux | Projets | Bds | Nuées |
| --- | :---: | :---: | :---: |:---: |:---: | :---: |:---: |:---: |
| Importer d'URL | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Importer de fichier local | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Exporter | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |


### `client.automatisations.ajouterAutomatisationExporter({ ... })`
Cette fonction automatise une exportation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `id` | `string` | L'identifiant de l'objet à exporter. |
| `typeObjet` | `"nuée" \| "projet" \| "bd" \| "tableau"` | Le type d'objet à exporter. |
| `formatDoc` | `xlsx.BookType \| "xls"` | Le format du fichier (`odt`, `xlsx`, `csv`, `txt` ou n'importe quel autre type supporté par [SheetJS](https://docs.sheetjs.com/docs/api/write-options/#supported-output-formats). |
| `inclureFichiersSFIP` | `boolean` | Si nous voulons sauvegarder les fichiers (images, vidéos ou autres) incluses dans les données. |
| `dossier` | `string \| undefined` | Le dossier (optionnel) où sauvegarder les données. Si non spécifié, les données seront sauvegardées sous un dossié nommé `constellation`. |
| `langues` | `string[] \| undefined` | Si vous voulez que les colonnes et les tableaux portent leurs noms respectifs au lieu de leurs identifiants uniques, la liste de langues (en ordre de préférence) dans laquelle vous souhaitez recevoir les données. Une liste vide utilisera, sans préférence, n'importe quelle langue parmi celles disponibles. |
| `fréquence` | [`fréquence`](#types-frequence) `\| undefined` | La fréquence à laquelle les données devraient être exportées. Si non spécifiée, les données seront exportées chaque fois que Constellation y détecte des changements. |
| `dispositifs` | `string[] \| undefined` | Les identifiants des dispositifs sur lesquels les données devraient être exportés. Si non spécifié, utilisera le dispositif présent. **Pas compatible avec `dossier`.** |
| `nRésultatsDésirésNuée` | `number \| undefined` | **Uniquement pour les nuées:** combien d'entrées de données nous devrions rechercher du réseau (il peut être grand !) |
| `copie` | [`copiesExportation`](#types-copies) `\| undefined` | Le nombre de copies maximales des données en sauvegarde, ou bien la quantité de temps que les sauvegardes doivent être gardées. Si non spécifiée, chaque exportation plus récente remplacera la dernière exportation. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant unique de l'automatisation. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
import { ref } from "vue";

const client = générerClient({});

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idAuto = await client.automatisations.ajouterAutomatisationExporter({
  id: idBd,
  typeObjet: "bd",
  formatDoc: "ods",  // Ou bien xlsx, txt, csv...
  langues: ["fr", "de"],  // En français ou bien en alemand SVP
  
  // Exporter une fois par semaine
  fréquence: temps: {
    unités: "semaines",
    n: 1
  },
  
  // Garder les données exportées pour 2 mois
  copie: {
    type: "temps",
    temps: {
      unités: "mois",
      n: 2
    }
  }
})

// ...ajouter données...
```

### `client.automatisations.ajouterAutomatisationImporter({ ... })`
Cette fonction automatise l'importation de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant de l'objet à exporter. |
| `source` | [`SourceDonnéesImportation`](#types-sources) | La source des données. |
| `fréquence` | [`fréquence`](#types-frequence) `\| undefined` | La fréquence à laquelle les données devraient être importées. Si non spécifiée, les données seront importées chaque fois que Constellation détecte des changements au fichier source. **Obligatoire si la source des données est un URL.** |
| `dispositif` | `string \| undefined` | L'identifiant du dispositif qui importera les données. Si non spécifié, utilisera le dispositif présent. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant unique de l'automatisation. |

#### Exemple
```ts
import { générerClient, type automatisations as autos } from "@constl/ipa";
import { ref } from "vue";

const client = générerClient({});

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idTableau = await client.tableaux.créerTableau({ idBd });
const idVariablePluie = await client.variables.créerVariable({ catégorie: "numérique" });
const idVariableDate = await client.variables.créerVariable({ catégorie: "horodatage" });

const idColonnePluie = await client.tableaux.ajouterColonneTableau({ 
  idTableau, 
  idVariable: idVariablePluie 
});
const idColonneDate = await client.tableaux.ajouterColonneTableau({ 
  idTableau, 
  idVariable: idVariableDate 
});

const source: autos.SourceDonnéesImportationFichier<autos.infoImporterFeuilleCalcul> = {
  typeSource: "fichier",
  adresseFichier: "mon/fichier/local.xlsx",
  info: {
    nomTableau: "tableau",  // Le nom de l'onglet avec les données dans le document Excel/LibreOffice
    formatDonnées: "feuilleCalcul",
    cols: {
      [idColonnePluie]: "précipitation",  // "précipitation" étant le nom de la colonne dans Excel/LibreOffice
      [idColonneData]: "date",
    },
  },
};
const idAuto = await client.automatisations.ajouterAutomatisationImporter({
  idTableau,
  source,
  fréquence: {
    unités: "jours",
    n: 2
  }  // Importer tous les 2 jours
});

```

### `client.automatisations.suivreAutomatisations({ f, idCompte })`
Cette fonction vous permet de suivre les automatisations spécifiées sur votre compte.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(automatisations: `[`SpécificationAutomatisation`](#types-specification)`[]) => void` | Une fonction qui sera appelée avec la liste des automatisations associées à ce compte chaque fois que celle-ci change. |
| `idCompte` | `string \| undefined` | L'identifiant du compte d'intérêt. Si non spécifié, utilisera le compte présent. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type automatisations } from "@constl/ipa";

const client = générerClient({});

const autos = ref<automatisations.SpécificationAutomatisation[]>();
const fOublier = await client.automatisations.suivreAutomatisations({
  f: x => autos.value = x,
});
```

### `client.automatisations.suivreÉtatAutomatisations({ f })`
Cette fonction vous permet de suivre l'état des automatisations (en attente, en cours, erronnées) sur votre dispositif.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(états: { [id: string]: `[`ÉtatAutomatisation`](#types-statut)` }) => void` | Une fonction qui sera appelée avec le statut des automatisations associées à votre compte chaque fois que l'un de ces statuts change. |

#### Statuts possibles
Note: les heures ci-dessous sont exprimées en horodatages JavaScript (utiliser `new Date(heure)` pour obtenir un format plus lisible).
| Statut | Explication |
| --- | ---- |
| `erreur` | L'automatisation a eu une erreur. Nous allons réessayer à l'heure `prochaineProgramméeÀ`. |
| `écoute` | Tout est beau ; l'automatisation est active et attend des changements aux données. | 
| `sync` | L'automatisation est présentement en train de syncroniser les données (exporter ou importer, selon le cas), depuis l'heure `depuis`. | 
| `programmée` | L'automatisation est programmée à l'heure `à`. | 

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type automatisations } from "@constl/ipa";

const client = générerClient({});

const états = ref<{ [id: string]: automatisations.ÉtatAutomatisation}>();
const fOublier = await client.automatisations.suivreÉtatAutomatisations({
  f: x => états.value = x,
});
```

## Types
Plusieurs types sont associés avec les automatisations Constellation.

### Types spécification

```ts
type SpécificationAutomatisation =
  | SpécificationExporter
  | SpécificationImporter;


type BaseSpécificationAutomatisation = {
  fréquence?: fréquence;
  type: "importation" | "exportation";
  id: string;
};

type SpécificationExporter = BaseSpécificationAutomatisation & {
  type: "exportation";
  idObjet: string;
  typeObjet: "nuée" | "projet" | "bd" | "tableau";
  formatDoc: XLSX.BookType | "xls";
  dossier?: string;
  langues?: string[];
  dispositifs: string[];
  inclureFichiersSFIP: boolean;
  nRésultatsDésirésNuée?: number;
  copies?: copiesExportation;
};

type infoImporter = infoImporterJSON | infoImporterFeuilleCalcul;

type infoImporterJSON = {
  formatDonnées: "json";
  clefsRacine: clefsExtraction;
  clefsÉléments: clefsExtraction;
  cols: { [key: string]: clefsExtraction };
};

type infoImporterFeuilleCalcul = {
  formatDonnées: "feuilleCalcul";
  nomTableau: string;
  cols: { [key: string]: string };
  optionsXLSX?: xlsx.XLSXParsingOptions;
};

```

### Types fréquence

```ts

type fréquence = {
  unités:
    | "années"
    | "mois"
    | "semaines"
    | "jours"
    | "heures"
    | "minutes"
    | "secondes"
    | "millisecondes";
  n: number;
};

```

### Types sources
Ces types correspondent aux sources des données à importer.

```ts
type infoImporter = infoImporterJSON | infoImporterFeuilleCalcul;
type infoImporterFeuilleCalcul = {
  formatDonnées: "feuilleCalcul";
  nomTableau: string;
  cols: { [key: string]: string };
  optionsXLSX?: xlsx.XLSXParsingOptions;
};

type infoImporterJSON = {
  formatDonnées: "json";
  clefsRacine: clefsExtraction;
  clefsÉléments: clefsExtraction;
  cols: { [key: string]: clefsExtraction };
};
type clefsExtraction = (string | number | -1)[];

type SourceDonnéesImportation =
  | SourceDonnéesImportationURL
  | SourceDonnéesImportationFichier;

type SourceDonnéesImportationURL = {
  typeSource: "url";
  url: string;
  info: infoImporter;
};

type SourceDonnéesImportationFichier = {
  typeSource: "fichier";
  adresseFichier: string;
  info: infoImporter;
};

```

### Types copies
```ts
type copiesExportation = copiesExportationN | copiesExportationTemps;

type copiesExportationN = {
  type: "n",
  n: number,
}

type copiesExportationTemps = {
  type: "temps",
  temps: fréquence,
}
```

### Types statut

```ts
type ÉtatAutomatisation =
  | ÉtatErreur
  | ÉtatÉcoute
  | ÉtatEnSync
  | ÉtatProgrammée;

interface ÉtatErreur {
  type: "erreur";
  erreur: string;
  prochaineProgramméeÀ?: number;
}

interface ÉtatÉcoute {
  type: "écoute";
}

interface ÉtatEnSync {
  type: "sync";
  depuis: number;
}

interface ÉtatProgrammée {
  type: "programmée";
  à: number;
}
```

