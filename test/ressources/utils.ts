import { client as utilsClientTest } from "@constl/utils-tests";

// Pour régler des problèmes de version entre @constl/utils-tests et le code en développement. Peut-être y a-t-il une meilleure solution...
export type ClientConstellation = Awaited<ReturnType<typeof utilsClientTest.générerClients>>["clients"][number]