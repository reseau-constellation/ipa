import { utils, WorkBook } from "xlsx";

export default class ImportateurFeuilleCalcul {
  doc: WorkBook;

  constructor(données: WorkBook) {
    this.doc = données;
  }

  obtNomsTableaux(): string[] {
    return this.doc.SheetNames;
  }

  obtColsTableau(nomTableau: string): string[] {
    const feuille = this.doc.Sheets[nomTableau];
    const données = utils.sheet_to_json(feuille, { header: 1 });
    return données[0] as string[];
  }

  obtDonnées(
    nomTableau: string,
    cols: { [key: string]: string } | string[]
  ): { [key: string]: string | number }[] {
    const feuille = this.doc.Sheets[nomTableau];
    const données = utils.sheet_to_json(feuille) as {
      [key: string]: string | number;
    }[];
    if (Array.isArray(cols)) {
      return données.map((d) =>
        Object.fromEntries(
          Object.keys(d)
            .filter((c) => cols.includes(c))
            .map((c) => [c, d[c]])
        )
      );
    } else {
      const colsInversées = Object.fromEntries(
        Object.entries(cols).map(([c, v]) => [v, c])
      );
      return données.map((d) =>
        Object.fromEntries(
          Object.keys(d)
            .filter((c) => Object.keys(colsInversées).includes(c))
            .map((c) => [colsInversées[c], d[c]])
        )
      );
    }
  }
}
