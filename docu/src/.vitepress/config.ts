import {obtCompilateur} from "../../scripts/compilateur";

export default async () => {
  const compilateur = await obtCompilateur();
  return await compilateur.générerConfigVitePress()
};
