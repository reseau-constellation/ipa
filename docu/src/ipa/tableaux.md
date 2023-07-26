# Tableaux

[[toc]]

## Général

## Noms

## Données

## Règles

## Importation et exportation

## Types
Plusieurs types sont associés aux tableaux Constellation et à leurs données.

### Types données
```ts
// Représente une rangé de données provenant d'un tableau
interface élémentDonnées<
  T extends élémentBdListeDonnées = élémentBdListeDonnées
> {
  données: T;
  empreinte: string;  // Identifiant unique de la rangé de données
}

type élémentBdListeDonnées = {
  [key: string]: élémentsBd;
};

// Représente tout type de données pouvant être sauvegardé à orbit-db
type élémentsBd =
  | number
  | boolean
  | string
  | { [clef: string]: élémentsBd }
  | Array<élémentsBd>;

```