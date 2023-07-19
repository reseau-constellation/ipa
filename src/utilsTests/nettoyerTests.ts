import { rimraf } from "rimraf";

import path from "path";

export default () =>
rimraf.sync(path.resolve(path.dirname(""), "src", "utilsTests", "_tempo"));
