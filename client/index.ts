import {
    Keypair,
    Connection,
    PublicKey,
    LAMPORTS_PER_SOL,
    SystemProgram,
    TransactionInstruction,
    Transaction,
    sendAndConfirmTransaction,
  } from '@solana/web3.js';
import * as borsh from 'borsh';
import {getPayer, getRpcUrl} from './utils';

const MAX_SIZE = 1000;

const ECOM_CONTRACT_ID = "3UZyBATBCicUJKvugfRumdkcizwCPpRxhJk1y6hdDH4c";
const ADDRESS_CONTRACT_ID = "2CDJB562bCPbVPfu1DyRtwY4AkbkKcXPjihF1VGLzbdJ";
const PROFILE_CONTRACT_ID = "FgSifk2ZCD75hy1dBr155ag73yvJekzyPd2BxvZo3B5e";

let connection;
let payer: Keypair;
let ecomProgramId: PublicKey;
let addressProgramId: PublicKey;
let addressAccountPDA: PublicKey;
let profileProgramId: PublicKey;
let profileAccountPDA: PublicKey;

class AddressAccount {
    address : Uint8Array = new Uint8Array([]);
    constructor(fields: {address: Uint8Array} | undefined = undefined) {
        if (fields) {
            this.address = fields.address;
        }
    }
}

class ProfileAccount {
    name: Uint8Array = new Uint8Array([]);
    // borsh npm document says u32 borsh is mapped to number on typescript
    date: number;
    month: number;
    year: number;

    constructor(fields: {
        name: Uint8Array,
        date: number,
        month: number,
        year: number
    } | undefined = undefined) {
        if(fields) {
            this.name = fields.name;
            this.date = fields.date;
            this.month = fields.month;
            this.year = fields.year;
        }
    };
}

const AddressSchema = new Map([
    [AddressAccount, {kind: 'struct', fields: [['address', [512]]]}],
]);

const ProfileSchema = new Map([
    [ProfileAccount, {
        kind: 'struct', 
        fields: [
                ['name', [64]], 
                ['date', 'number'],
                ['month', 'number'],
                ['year', 'number']
        ]}]
]);


const strToBuffer = (str, len) => {
    const buf = Buffer.alloc(len);
    buf.write(str);
    console.log("After buf.write, buf = ", buf);
    return buf;
}

const numberToBuffer = (value, len) => {
    const buf = Buffer.alloc(len);
    buf.writeUInt32LE(value);
    console.log("4 bytes of  number ", buf);
    return buf;
}


/**
 * Establish a connection to the cluster
 */
 export async function establishConnection(): Promise<void> {
    const rpcUrl = await getRpcUrl();
    connection = new Connection(rpcUrl, 'confirmed');
    const version = await connection.getVersion();
    console.log('Connection to cluster established:', rpcUrl, version);
  }
  

/**
 * Establish an account to pay for everything
 */
export async function establishPayer(): Promise<void> {
    let fees = 0;
    if (!payer) {
      const {feeCalculator} = await connection.getRecentBlockhash();
  
      // Calculate the cost to fund the greeter account
      fees += await connection.getMinimumBalanceForRentExemption(MAX_SIZE);
  
      // Calculate the cost of sending transactions
      fees += feeCalculator.lamportsPerSignature * 100; // wag
  
      payer = await getPayer();
    }
  
    let lamports = await connection.getBalance(payer.publicKey);
    if (lamports < fees) {
      // If current balance is not enough to pay for fees, request an airdrop
      const sig = await connection.requestAirdrop(
        payer.publicKey,
        fees - lamports,
      );
      await connection.confirmTransaction(sig);
      lamports = await connection.getBalance(payer.publicKey);
    }
  
    console.log(
      'Using account',
      payer.publicKey.toBase58(),
      'containing',
      lamports / LAMPORTS_PER_SOL,
      'SOL to pay for fees',
    );
}



/**
 * Check if the ecom-contract and address-contract BPF programs have been deployed
 */
 export async function checkProgram(): Promise<void> {
    ecomProgramId = new PublicKey(ECOM_CONTRACT_ID);
    addressProgramId = new PublicKey(ADDRESS_CONTRACT_ID);

    const ecomProgramInfo = await connection.getAccountInfo(ecomProgramId);
    if (ecomProgramInfo === null) {
        throw new Error(`Ecom program not found`);
    } else if (!ecomProgramInfo.executable) {
        throw new Error(`Ecom program is not executable`);
    }
    console.log(`Ecom program ID being used is ${ecomProgramId.toBase58()}`);

    const addressProgramInfo = await connection.getAccountInfo(addressProgramId);
    if (addressProgramInfo === null) {
        throw new Error(`Address program not found`);
    } else if (!addressProgramInfo.executable) {
        throw new Error(`Address program is not executable`);
    }
    console.log(`Address program ID being used is ${addressProgramId.toBase58()}`);

    addressAccountPDA = (await PublicKey.findProgramAddress(
        [Buffer.from("address"), payer.publicKey.toBytes()],
        ecomProgramId,
    ))[0];
    console.log(`Address Account PDA is ${addressAccountPDA.toBase58()}`)
}

// check if profile-contract has been deployed and create PDA for profile account
export async function setUpProfileProgramParams(): Promise<void> {
    profileProgramId = new PublicKey(PROFILE_CONTRACT_ID);

    const profileProgramInfo = await connection.getAccountInfo(profileProgramId);
    if (profileProgramId === null) {
        throw new Error(`Profile program not found`);
    } else if (!profileProgramInfo.executable) {
        throw new Error(`Profile program is not executable`);
    }
    console.log(`Profile program ID being used is ${profileProgramId.toBase58()}`);

    profileAccountPDA = (await PublicKey.findProgramAddress(
        [Buffer.from("profile"), payer.publicKey.toBytes()],
        ecomProgramId
    ))[0];
    console.log(`Profile Account PDA is ${profileAccountPDA.toBase58()}`);
}

export async function initialize(): Promise<void> {
    const buffers = [Buffer.from(Int8Array.from([1]))];
    const data = Buffer.concat(buffers);
    const instruction = new TransactionInstruction({
        keys: [
            {pubkey: payer.publicKey, isSigner: true, isWritable: true},
            {pubkey: addressAccountPDA, isSigner: false, isWritable: true},
            {pubkey: addressProgramId, isSigner: false, isWritable: false},
            {pubkey: SystemProgram.programId, isSigner: false, isWritable: false}
        ],
        programId: ecomProgramId,
        data: data
    });
    await sendAndConfirmTransaction(
        connection,
        new Transaction().add(instruction),
        [payer],
    );
}

// function to initialize profile PDA account on chain
export async function profilePDAInitialize(): Promise<void> {
    // variant index 2 is the profile address Initialize instruction in ecom contract
    const buffers = [Buffer.from(Int8Array.from([2]))];
    const data = Buffer.concat(buffers);
    const instruction = new TransactionInstruction({
        keys: [
            {pubkey: payer.publicKey, isSigner: true, isWritable: true},
            {pubkey: profileAccountPDA, isSigner: false, isWritable: true},
            {pubkey: profileProgramId, isSigner: false, isWritable: false},
            {pubkey: SystemProgram.programId, isSigner: false, isWritable: false}
        ],
        programId: ecomProgramId,
        data: data
    });

    await sendAndConfirmTransaction(
        connection,
        new Transaction().add(instruction),
        [payer]
    );
}

export const updateAddress = async (address: string) => {
    
    // ecom-contract instructionData enum updateAddress field is the first. So first bytes
    // shall be set to 0. Next need a 512 bytes to represent the new address
    const buffers = [Buffer.from(Int8Array.from([0])), strToBuffer(address, 512)];
    console.log("Buffer array buffers = ", buffers);
    // Buffer.concat takes all buffers objects in an array and converts into one 
    // buffer object. Transaction instruction takes a buffer as data. So below
    // is needed to convert an array to a buffer
    const data = Buffer.concat(buffers);
    console.log("Data buffer for Address update Instruction data", data);
    
    const instruction = new TransactionInstruction({
        keys: [
            {pubkey: payer.publicKey, isSigner: true, isWritable: true},
            {pubkey: addressAccountPDA, isSigner: false, isWritable: true},
            {pubkey: addressProgramId, isSigner: false, isWritable: false},
        ],
        programId: ecomProgramId,
        data: data
    });
    await sendAndConfirmTransaction(
        connection,
        new Transaction().add(instruction),
        [payer],
    );
}

export const updateProfile = async(name: string, date: number, month: number, year: number) => {
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

    const instruction = new TransactionInstruction({
        keys: [
            {pubkey: payer.publicKey, isSigner: true, isWritable: true},
            {pubkey: profileAccountPDA, isSigner: false, isWritable: true},
            {pubkey: profileProgramId, isSigner: false, isWritable: false}
        ],
        programId: ecomProgramId,
        data: data
    });

    await sendAndConfirmTransaction(
        connection,
        new Transaction().add(instruction),
        [payer]
    );
}

export const getAddress = async () => {
    const accountInfo = await connection.getAccountInfo(addressAccountPDA);
    const address = borsh.deserialize(
        AddressSchema,
        AddressAccount,
        accountInfo.data,
    );

    console.log("AccountInfo<buffer> from blockchain is ", accountInfo);
    console.log("PDA account data from Blockchain ", accountInfo.data);
    console.log("AddressAccount instance address is ", address);    
    console.log("address.address after deserialization from borsh", address.address)

    // looks like TextDecoder converts bytes to text
    console.log(new TextDecoder().decode(address.address))
}

