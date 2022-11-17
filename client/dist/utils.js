"use strict";
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createKeypairFromFile = exports.getPayer = exports.getRpcUrl = void 0;
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("mz/fs"));
const path_1 = __importDefault(require("path"));
const yaml_1 = __importDefault(require("yaml"));
const web3_js_1 = require("@solana/web3.js");
/**
 * @private
 */
function getConfig() {
    return __awaiter(this, void 0, void 0, function* () {
        // Path to Solana CLI config file
        const CONFIG_FILE_PATH = path_1.default.resolve(os_1.default.homedir(), '.config', 'solana', 'cli', 'config.yml');
        const configYml = yield fs_1.default.readFile(CONFIG_FILE_PATH, { encoding: 'utf8' });
        return yaml_1.default.parse(configYml);
    });
}
/**
 * Load and parse the Solana CLI config file to determine which RPC url to use
 */
function getRpcUrl() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const config = yield getConfig();
            if (!config.json_rpc_url)
                throw new Error('Missing RPC URL');
            return config.json_rpc_url;
        }
        catch (err) {
            console.warn('Failed to read RPC url from CLI config file, falling back to localhost');
            return 'http://127.0.0.1:8899';
        }
    });
}
exports.getRpcUrl = getRpcUrl;
/**
 * Load and parse the Solana CLI config file to determine which payer to use
 */
function getPayer() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const config = yield getConfig();
            if (!config.keypair_path)
                throw new Error('Missing keypair path');
            return yield createKeypairFromFile(config.keypair_path);
        }
        catch (err) {
            console.warn('Failed to create keypair from CLI config file, falling back to new random keypair');
            return web3_js_1.Keypair.generate();
        }
    });
}
exports.getPayer = getPayer;
/**
 * Create a Keypair from a secret key stored in file as bytes' array
 */
function createKeypairFromFile(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const secretKeyString = yield fs_1.default.readFile(filePath, { encoding: 'utf8' });
        const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
        return web3_js_1.Keypair.fromSecretKey(secretKey);
    });
}
exports.createKeypairFromFile = createKeypairFromFile;
//# sourceMappingURL=utils.js.map