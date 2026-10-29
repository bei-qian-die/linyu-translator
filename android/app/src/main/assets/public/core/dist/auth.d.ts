declare const DEFAULT_USER = "linyu";
declare const DEFAULT_PASSWORD = "linyu130";
declare const KEY = "dev_user";
declare const SALT = "dev_salt";
declare const HASH = "dev_hash";
interface SettingsStore {
    getSetting: (key: string) => any;
    setSetting: (key: string, value: any) => void;
}
declare function hashPassword(password: string, salt: string): string;
declare function toUtf8(str: string): Uint8Array;
declare function safeEqual(a: string, b: string): boolean;
declare function randomSaltHex(len: number): string;
declare function createAuth({ getSetting, setSetting }: SettingsStore): {
    ensureInit: () => {
        created: boolean;
    };
    status: () => {
        user: string;
        initialized: boolean;
    };
    verify: (username: string, password: string) => boolean;
    changePassword: (oldPassword: string, newPassword: string) => {
        ok?: boolean;
        error?: string;
    };
    resetToDefault: () => {
        ok: boolean;
        user: string;
    };
    usesDefaultPassword: () => boolean;
    DEFAULT_USER: string;
    DEFAULT_PASSWORD: string;
};
