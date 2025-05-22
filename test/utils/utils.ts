import axios from "axios";
import { TypedEmitter } from "tiny-typed-emitter";
import { isNull } from "lodash-es";
import { schémaFonctionOublier } from "@/types";

export const obtIdsPairs = async (): Promise<{
  idPairNode: string;
  idPairNavig: string;
}> => {
  const rés = await axios.get(`http://localhost:3000/idsPairs`);
  return rés.data;
};

export const obtenir = async <T>(
  f: (args: {
    si: (f: (x: T) => boolean) => (x: T) => void;
    siDéfini: () => (x: T | undefined) => void;
    siVide: () => (x: T) => void;
    siNul: () => (x: T) => void;
    siPasVide: () => (x: T) => void;
    siPasNul: () => (x: T) => void;
    tous: () => (x: T) => void;
  }) => Promise<schémaFonctionOublier>,
): Promise<T> => {
  const événements = new TypedEmitter<{ résolu: (x: T) => void }>();
  const si = (fTest: (x: T) => boolean): ((x: T) => void) => {
    return (x: T) => {
      const passe = fTest(x);
      if (passe) {
        événements.emit("résolu", x);
      }
    };
  };
  const siDéfini = (): ((x: T | undefined) => void) => {
    // @ts-expect-error Je ne sais pas pourquoi
    return si((x: T | undefined): x is T => x !== undefined);
  };
  const siVide = (): ((x: T) => void) => {
    return si((x) => {
      if (Array.isArray(x)) return x.length === 0;
      else if (typeof x === "object" && !isNull(x))
        return Object.keys(x).length === 0;
      else return false;
    });
  };
  const siNul = (): ((x: T) => void) => {
    return si((x: T) => isNull(x));
  };
  const siPasVide = (): ((x: T) => void) => {
    return si((x) => {
      if (Array.isArray(x)) return x.length > 0;
      else if (typeof x === "object" && !isNull(x))
        return Object.keys(x).length > 0;
      else return false;
    });
  };
  const siPasNul = (): ((x: T) => void) => {
    return si((x: T) => !isNull(x));
  };
  const tous = (): ((x: T) => void) => {
    return si(() => true);
  };

  const promesse = new Promise<T>((résoudre) =>
    événements.once("résolu", résoudre),
  );
  const fOublier = await f({
    si,
    siDéfini,
    siVide,
    siNul,
    siPasVide,
    siPasNul,
    tous,
  });
  after(async () => await fOublier());

  return promesse;
};
