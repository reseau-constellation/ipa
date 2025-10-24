export type Suivi<T> = (x: T) => void | Promise<void>;

export type Oublier = () => Promise<void>;

export type RetourRecherche = { oublier: Oublier; n: (n: number) => void };
