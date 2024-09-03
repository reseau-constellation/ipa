import axios from "axios";

export const obtIdsPairs = async (): Promise<{idPairNode: string; idPairNavig: string}> => {
    const rés = await axios.get(
        `http://localhost:3000/idsPairs`,
      );
      return rés.data;
};
