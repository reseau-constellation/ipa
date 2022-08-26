import rmrf from "rimraf";

import path from "path";

export default () =>
  rmrf.sync(path.resolve(path.dirname(""), "src", "utilsTests", "_tempo"));
