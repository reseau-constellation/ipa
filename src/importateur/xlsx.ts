import XLSX from "xlsx";
// '/Users/julienmalard/Documents/Projet Wietske Medema/BD test/Copy of Wilmot_2016-2018_FWIS.xlsm'
// XLSX.readFile('test.xlsx')

export default class ImportateurFeuilleCalcul {
  doc: XLSX.WorkBook;

  constructor(données: XLSX.WorkBook) {
    this.doc = données;
  }

  obtNomsTableaux(): string[] {
    return this.doc.SheetNames;
  }

  obtColsTableau(nomTableau: string): string[] {
    const feuille = this.doc.Sheets[nomTableau];
    const données = XLSX.utils.sheet_to_json(feuille, { header: 1 });
    return données[0] as string[];
  }

  obtDonnées(
    nomTableau: string,
    cols: { [key: string]: string }
  ): { [key: string]: string | number }[] {
    const feuille = this.doc.Sheets[nomTableau];
    const données = XLSX.utils.sheet_to_json(feuille) as {
      [key: string]: string | number;
    }[];

    return données.map((d) =>
      Object.fromEntries(
        Object.keys(d)
          .filter((c) => Object.keys(cols).includes(c))
          .map((c) => [cols[c], d[c]])
      )
    );
  }
}
