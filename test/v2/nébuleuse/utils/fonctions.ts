export const attendreQue = async (
  f: () => boolean | Promise<boolean>,
  t = 10,
): Promise<void> => {
  return new Promise((résoudre, rejeter) => {
    const fFinale = async () => {
      try {
        if (await f()) {
          clearTimeout(chrono);
          résoudre();
        } else {
          t *= 1.5
          setTimeout(fFinale, t)
        }
      } catch {
        clearTimeout(chrono);
        rejeter();
      }
    };
    const chrono = setTimeout(fFinale, t);
    fFinale();
  });
};
