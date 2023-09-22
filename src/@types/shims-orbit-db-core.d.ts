declare module "@orbitdb/core" {
    import type { IPFS }from "ipfs-core";
    
    export type OrbitDB = {
        id: string,
        open: (address: string, OrbitDBDatabaseOptions) => Awaited<ReturnType<Database>>,
        stop,
        ipfs,
        directory,
        keystore,
        identity,
        peerId
      }
    export function createOrbitDB (args: {
        ipfs: IPFS,
        directory: string,

    }): Promise<OrbitDB>;

    export function useAccessController(accessController: AccessController): void;
    export function isValidAddress(address: unknown): boolean;

    export function Database (args: {
        ipfs: IPFS,
        identity?: Identity,
        address: string,
        name?: string,
        access?: AccessController,
        directory?: string,
        meta?: object,
        headsStorage?: Storage,
        entryStorage?: Storage,
        indexStorage?: Storage,
        referencesCount?: number,
        syncAutomatically?: boolean,
        onUpdate?: () => void,
    }): Promise<{
        addOperation: (args: { op: string, key: string | null, value: unknown }) => Promise<string>;
        address: string;
        log: Log;
        close(): Promise<void>;
        drop(): Promise<void>;
    }>;
    export type Identity = {
        id: string,
        publicKey: object,
        sigantures: object,
        type: string,
        sign: () => string,
        verify: () => boolean,
    };
    export class AccessController {};
    export class Identities {
        getIdentity;
        verifyIdentity: (identity) => boolean;
    };
    export class Storage {
        put;
        get;
    };
    export function IPFSBlockStorage({ipfs: IPFS, pin: boolean}): Promise<Storage>;
    export function LRUStorage({size: number}): Promise<Storage>;
    export function ComposedStorage(...args: Storage[]): Promise<Storage>;
    
    export type OrbitDBDatabaseOptions = {
        type: string,
        AccessController: AccessController
    };
};
