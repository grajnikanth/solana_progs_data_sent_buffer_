"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAddress = exports.updateProfile = exports.updateAddress = exports.profilePDAInitialize = exports.initialize = exports.setUpProfileProgramParams = exports.checkProgram = exports.establishPayer = exports.establishConnection = void 0;
const web3_js_1 = require("@solana/web3.js");
const borsh = __importStar(require("borsh"));
const utils_1 = require("./utils");
const MAX_SIZE = 1000;
const ECOM_CONTRACT_ID = "3UZyBATBCicUJKvugfRumdkcizwCPpRxhJk1y6hdDH4c";
const ADDRESS_CONTRACT_ID = "2CDJB562bCPbVPfu1DyRtwY4AkbkKcXPjihF1VGLzbdJ";
const PROFILE_CONTRACT_ID = "FgSifk2ZCD75hy1dBr155ag73yvJekzyPd2BxvZo3B5e";
let connection;
let payer;
let ecomProgramId;
let addressProgramId;
let addressAccountPDA;
let profileProgramId;
let profileAccountPDA;
class AddressAccount {
    constructor(fields = undefined) {
        this.address = new Uint8Array([]);
        if (fields) {
            this.address = fields.address;
        }
    }
}
class ProfileAccount {
    constructor(fields = undefined) {
        this.name = new Uint8Array([]);
        if (fields) {
            this.name = fields.name;
            this.date = fields.date;
            this.month = fields.month;
            this.year = fields.year;
        }
    }
    ;
}
const AddressSchema = new Map([
    [AddressAccount, { kind: 'struct', fields: [['address', [512]]] }],
]);
const ProfileSchema = new Map([
    [ProfileAccount, {
            kind: 'struct',
            fields: [
                ['name', [64]],
                ['date', 'number'],
                ['month', 'number'],
                ['year', 'number']
            ]
        }]
]);
const strToBuffer = (str, len) => {
    const buf = Buffer.alloc(len);
    buf.write(str);
    console.log("After buf.write, buf = ", buf);
    return buf;
};
const numberToBuffer = (value, len) => {
    const buf = Buffer.alloc(len);
    buf.writeUInt32LE(value);
    console.log("4 bytes of  number ", buf);
    return buf;
};
/**
 * Establish a connection to the cluster
 */
function establishConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        const rpcUrl = yield (0, utils_1.getRpcUrl)();
        connection = new web3_js_1.Connection(rpcUrl, 'confirmed');
        const version = yield connection.getVersion();
        console.log('Connection to cluster established:', rpcUrl, version);
    });
}
exports.establishConnection = establishConnection;
/**
 * Establish an account to pay for everything
 */
function establishPayer() {
    return __awaiter(this, void 0, void 0, function* () {
        let fees = 0;
        if (!payer) {
            const { feeCalculator } = yield connection.getRecentBlockhash();
            // Calculate the cost to fund the greeter account
            fees += yield connection.getMinimumBalanceForRentExemption(MAX_SIZE);
            // Calculate the cost of sending transactions
            fees += feeCalculator.lamportsPerSignature * 100; // wag
            payer = yield (0, utils_1.getPayer)();
        }
        let lamports = yield connection.getBalance(payer.publicKey);
        if (lamports < fees) {
            // If current balance is not enough to pay for fees, request an airdrop
            const sig = yield connection.requestAirdrop(payer.publicKey, fees - lamports);
            yield connection.confirmTransaction(sig);
            lamports = yield connection.getBalance(payer.publicKey);
        }
        console.log('Using account', payer.publicKey.toBase58(), 'containing', lamports / web3_js_1.LAMPORTS_PER_SOL, 'SOL to pay for fees');
    });
}
exports.establishPayer = establishPayer;
/**
 * Check if the ecom-contract and address-contract BPF programs have been deployed
 */
function checkProgram() {
    return __awaiter(this, void 0, void 0, function* () {
        ecomProgramId = new web3_js_1.PublicKey(ECOM_CONTRACT_ID);
        addressProgramId = new web3_js_1.PublicKey(ADDRESS_CONTRACT_ID);
        const ecomProgramInfo = yield connection.getAccountInfo(ecomProgramId);
        if (ecomProgramInfo === null) {
            throw new Error(`Ecom program not found`);
        }
        else if (!ecomProgramInfo.executable) {
            throw new Error(`Ecom program is not executable`);
        }
        console.log(`Ecom program ID being used is ${ecomProgramId.toBase58()}`);
        const addressProgramInfo = yield connection.getAccountInfo(addressProgramId);
        if (addressProgramInfo === null) {
            throw new Error(`Address program not found`);
        }
        else if (!addressProgramInfo.executable) {
            throw new Error(`Address program is not executable`);
        }
        console.log(`Address program ID being used is ${addressProgramId.toBase58()}`);
        addressAccountPDA = (yield web3_js_1.PublicKey.findProgramAddress([Buffer.from("address"), payer.publicKey.toBytes()], ecomProgramId))[0];
        console.log(`Address Account PDA is ${addressAccountPDA.toBase58()}`);
    });
}
exports.checkProgram = checkProgram;
// check if profile-contract has been deployed and create PDA for profile account
function setUpProfileProgramParams() {
    return __awaiter(this, void 0, void 0, function* () {
        profileProgramId = new web3_js_1.PublicKey(PROFILE_CONTRACT_ID);
        const profileProgramInfo = yield connection.getAccountInfo(profileProgramId);
        if (profileProgramId === null) {
            throw new Error(`Profile program not found`);
        }
        else if (!profileProgramInfo.executable) {
            throw new Error(`Profile program is not executable`);
        }
        console.log(`Profile program ID being used is ${profileProgramId.toBase58()}`);
        profileAccountPDA = (yield web3_js_1.PublicKey.findProgramAddress([Buffer.from("profile"), payer.publicKey.toBytes()], ecomProgramId))[0];
        console.log(`Profile Account PDA is ${profileAccountPDA.toBase58()}`);
    });
}
exports.setUpProfileProgramParams = setUpProfileProgramParams;
function initialize() {
    return __awaiter(this, void 0, void 0, function* () {
        const buffers = [Buffer.from(Int8Array.from([1]))];
        const data = Buffer.concat(buffers);
        const instruction = new web3_js_1.TransactionInstruction({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: addressAccountPDA, isSigner: false, isWritable: true },
                { pubkey: addressProgramId, isSigner: false, isWritable: false },
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false }
            ],
            programId: ecomProgramId,
            data: data
        });
        yield (0, web3_js_1.sendAndConfirmTransaction)(connection, new web3_js_1.Transaction().add(instruction), [payer]);
    });
}
exports.initialize = initialize;
// function to initialize profile PDA account on chain
function profilePDAInitialize() {
    return __awaiter(this, void 0, void 0, function* () {
        // variant index 2 is the profile address Initialize instruction in ecom contract
        const buffers = [Buffer.from(Int8Array.from([2]))];
        const data = Buffer.concat(buffers);
        const instruction = new web3_js_1.TransactionInstruction({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: profileAccountPDA, isSigner: false, isWritable: true },
                { pubkey: profileProgramId, isSigner: false, isWritable: false },
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false }
            ],
            programId: ecomProgramId,
            data: data
        });
        yield (0, web3_js_1.sendAndConfirmTransaction)(connection, new web3_js_1.Transaction().add(instruction), [payer]);
    });
}
exports.profilePDAInitialize = profilePDAInitialize;
const updateAddress = (address) => __awaiter(void 0, void 0, void 0, function* () {
    // ecom-contract instructionData enum updateAddress field is the first. So first bytes
    // shall be set to 0. Next need a 512 bytes to represent the new address
    const buffers = [Buffer.from(Int8Array.from([0])), strToBuffer(address, 512)];
    console.log("Buffer array buffers = ", buffers);
    // Buffer.concat takes all buffers objects in an array and converts into one 
    // buffer object. Transaction instruction takes a buffer as data. So below
    // is needed to convert an array to a buffer
    const data = Buffer.concat(buffers);
    console.log("Data buffer for Address update Instruction data", data);
    const instruction = new web3_js_1.TransactionInstruction({
        keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: addressAccountPDA, isSigner: false, isWritable: true },
            { pubkey: addressProgramId, isSigner: false, isWritable: false },
        ],
        programId: ecomProgramId,
        data: data
    });
    yield (0, web3_js_1.sendAndConfirmTransaction)(connection, new web3_js_1.Transaction().add(instruction), [payer]);
});
exports.updateAddress = updateAddress;
const updateProfile = (name, date, month, year) => __awaiter(void 0, void 0, void 0, function* () {
    const buffers = [
        Buffer.from(Uint8Array.from([3])),
        strToBuffer(name, 64),
        numberToBuffer(date, 4),
        numberToBuffer(month, 4),
        numberToBuffer(year, 4),
    ];
    console.log('buffers value = ', buffers);
    const data = Buffer.concat(buffers);
    console.log("Instruction data buffer in updateProfile function is ", data);
    const instruction = new web3_js_1.TransactionInstruction({
        keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: profileAccountPDA, isSigner: false, isWritable: true },
            { pubkey: profileProgramId, isSigner: false, isWritable: false }
        ],
        programId: ecomProgramId,
        data: data
    });
    yield (0, web3_js_1.sendAndConfirmTransaction)(connection, new web3_js_1.Transaction().add(instruction), [payer]);
});
exports.updateProfile = updateProfile;
const getAddress = () => __awaiter(void 0, void 0, void 0, function* () {
    const accountInfo = yield connection.getAccountInfo(addressAccountPDA);
    const address = borsh.deserialize(AddressSchema, AddressAccount, accountInfo.data);
    console.log("AccountInfo<buffer> from blockchain is ", accountInfo);
    console.log("PDA account data from Blockchain ", accountInfo.data);
    console.log("AddressAccount instance address is ", address);
    console.log("address.address after deserialization from borsh", address.address);
    // looks like TextDecoder converts bytes to text
    console.log(new TextDecoder().decode(address.address));
});
exports.getAddress = getAddress;
//# sourceMappingURL=index.js.map