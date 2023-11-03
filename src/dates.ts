// Temporaire, avant de crée une nouvelle librairie pour les dates
export type spécificationHoroDatage = {
  système: string;
  val: string;
  format?: string;
};
export const estSpécificationHoroDatage = (
  val: unknown,
): val is spécificationHoroDatage => {
  return (
    !!val &&
    typeof (val as spécificationHoroDatage).système === "string" &&
    typeof (val as spécificationHoroDatage).val === "string"
  );
};
export class Cholqij {
  lireDate(date: spécificationHoroDatage): Date {
    const { système, val } = date;
    switch (système) {
      case "dateJS":
      case "grégorien": {
        const date_ = new Date(val);
        if (isNaN(date_.valueOf())) throw new Error(val);
        return date_;
      }
      default:
        throw new Error(système);
    }
  }

  dateValide(val: unknown): boolean {
    if (!estSpécificationHoroDatage(val)) return false;
    try {
      this.lireDate(val);
      return true;
    } catch {
      return false;
    }
  }
}

export const cholqij = new Cholqij();
