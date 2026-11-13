export const attendreQue = async (
  f: () => boolean | Promise<boolean>,
  t = 10,
): Promise<void> => {
  return new Promise((compléter, rompre) => {
    const fFinale = async () => {
      try {
        if (await f()) {
          clearTimeout(chrono);
          compléter();
        } else {
          t *= 1.5;
          setTimeout(fFinale, t);
        }
      } catch {
        clearTimeout(chrono);
        rompre();
      }
    };
    const chrono = setTimeout(fFinale, t);
    fFinale();
  });
};
