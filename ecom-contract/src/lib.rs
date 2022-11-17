// simplified ecom-contract with only address CPI and PDA

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    system_instruction,
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::{rent::Rent, Sysvar},
};
use solana_program::instruction::Instruction;
use solana_program::instruction::AccountMeta;
use solana_program::program::invoke_signed;

// Represents the various instructions this program can process
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, PartialEq)]
pub enum InstructionData {
    UpdateAdddress {
        address: [u8; 512]
    },
    Initialize {

    },
    InitializeUserProfilePDA {},
    UpdateUserInfo {
        name: [u8; 64], // appears the bytes have to be multiples of 8 for Borsh to work
        date: u32,
        month: u32,
        year: u32
    }
}

// used to send instruction to address-contract
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, PartialEq)]
pub struct AddressInstructionData {
    address: [u8; 512]
}

// Used to define profile-conctract instruction
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, PartialEq)]
pub struct UserProfileInstructionData {
    name: [u8; 64],
    date: u32,
    month: u32,
    year: u32
}


// used to represent the data to be stored in the account address PDA
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct AddressSchema {
    address: [u8; 512]
}

// used to represent the data to be stored in the user profile PDA
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct UserProfileSchema {
    name: [u8; 64],
    date: u32,
    month: u32,
    year: u32
}




pub fn get_address_account_pda(account: &AccountInfo, program_id: &Pubkey)  -> (Pubkey, u8) {
    return Pubkey::find_program_address(&[b"address", &account.key.to_bytes()[..32]], program_id);
}

// Returns PDA of user Profile and bump
pub fn get_user_profile_account_pda(account: &AccountInfo, program_id: &Pubkey) -> (Pubkey, u8) {
    return Pubkey::find_program_address(&[b"profile", &account.key.to_bytes()[..32]], program_id);
}


// Declare and export the program's entrypoint
entrypoint!(process_instruction);

// Program entrypoint's implementation
pub fn process_instruction(
    program_id: &Pubkey, // Public key of the account the hello world program was loaded into
    accounts: &[AccountInfo], // The account to say hello to
    instruction_data: &[u8], // Ignored, all helloworld instructions are hellos
) -> ProgramResult {
    msg!("Hello World Rust program entrypoint");

    let instruction = InstructionData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    
    // msg!("Instruction_data: &[u8] value received by smart contract is {:?}", instruction_data);
    // Iterating accounts is safer than indexing
    let accounts_iter = &mut accounts.iter();

    match instruction {
        InstructionData::Initialize {

        } => {
          msg!("Initialise PDAs");

 
          let account = next_account_info(accounts_iter)?; 
          let update_address_account = next_account_info(accounts_iter)?;
          let update_address_contract = next_account_info(accounts_iter)?;
          let system_program = next_account_info(accounts_iter)?;

          // obtain the PDA and address_bump for the address account
          let (found_address_account, address_bump) = get_address_account_pda(account, program_id);
          // msg!("Rust derived PDA and address_bump is {} and {}", &found_address_account.to_string(), address_bump);
          
          if found_address_account != *update_address_account.key {
              msg!("Incorrect address PDA as input");
              msg!(&update_address_account.key.to_string());
              return Err(ProgramError::InvalidInstructionData)
          }

          msg!("space needed to store address data is {}",std::mem::size_of::<AddressSchema>());
          msg!("lamports needed to store above space {}",Rent::get()?.minimum_balance(std::mem::size_of::<AddressSchema>()));

          // First CPI call to create an account from this program for the address_acctount PDA
          invoke_signed(
            &system_instruction::create_account(
                account.key, 
                update_address_account.key,
                Rent::get()?.minimum_balance(std::mem::size_of::<AddressSchema>()),
                std::mem::size_of::<AddressSchema>().try_into().unwrap(),
                update_address_contract.key,
            ),
            &[update_address_account.clone(), account.clone(), system_program.clone()],
            &[&[b"address", account.key.as_ref(), &[address_bump]]],
          )?;
        }
        InstructionData::UpdateAdddress {
            address
         } => {
            msg!("Update address Instruction reached");

            let account = next_account_info(accounts_iter)?; 
            let update_address_account = next_account_info(accounts_iter)?;
            let update_address_contract = next_account_info(accounts_iter)?;

            // calculate the address account PDA for the account.key and validate
            // client sent PDA
            let (found_address_account, address_bump) = get_address_account_pda(account, program_id);
            msg!("Rust derived PDA and address_bump is {} and {}", &found_address_account.to_string(), address_bump);
            
            if found_address_account != *update_address_account.key {
                msg!("Incorrect address PDA as input");
                msg!(&update_address_account.key.to_string());
                return Err(ProgramError::InvalidInstructionData)
            }
            
            // prepare the CPI to address-contract to update the address in the PDA data

            // prepare the contents of the Instruction struct instance for our instruction

            // Prepare the accounts field of the Instruction struct
            // acount is of type Vec<AccountMeta> per source code of Instruction struct
            let mut accounts_meta = Vec::new();
            accounts_meta.push(
                AccountMeta {
                    pubkey: *update_address_account.key,
                    is_signer: true,
                    is_writable: true
            });

            msg!("Accounts_meta vector is {:?}", accounts_meta);

            // Prepare the data field of Instruction struct: type is Vec<u8>
            // address-contract expects to receive a array [u8: 512] to represent the
            // address field of the InstructionData inside the address-contract
            // to the address-contract we have to send &[u8] a slice reference
            // the addressInstructionData struct in this program is the same as the InstructionData 
            // struct in address-contract. So create an instance of this struct here
            // and borsh serialize it to the required type for instruction
            let instruction_data_address = AddressInstructionData {
                // InstructionData::UpdateAddress enum carries this data from the client
                // in it's address field
                address: address 
            };

            // create the insruction instance.
            // borsh serialize the above instruction_data_address struct to binary data 
            // as needed by the data field of instruction

            msg!("data vec<u8> being sent to address-contract is {:?}", instruction_data_address.try_to_vec()?);

            let update_address_instruction = Instruction {
                program_id: *update_address_contract.key,
                accounts: accounts_meta,
                // per Instruction struct source code data shall be Vec<u8>
                // try_to_vec() borsh function provides a Vec<u8>
                data: instruction_data_address.try_to_vec()?
            };

            // send the instruction with signature using CPI call to the address-contract
            invoke_signed(
                &update_address_instruction, 
                &[update_address_account.clone()], 
                &[&[b"address", account.key.as_ref(), &[address_bump]]],
            ).map_err(|_| ProgramError::IncorrectProgramId)?;
        },
        InstructionData::InitializeUserProfilePDA {  
        } => {
            let account = next_account_info(accounts_iter)?; 
            let user_profile_account_pda_client = next_account_info(accounts_iter)?;
            let update_profile_contract = next_account_info(accounts_iter)?;
            let system_program = next_account_info(accounts_iter)?;

            let (user_profile_account_pda_program, profile_bump) = get_user_profile_account_pda(account, program_id);
          
            if user_profile_account_pda_program != *user_profile_account_pda_client.key {
              msg!("Incorrect user Profile PDA as input");
              msg!(&user_profile_account_pda_client.key.to_string());
              return Err(ProgramError::InvalidInstructionData)
            }

            msg!("space needed to store user profile data is {}",std::mem::size_of::<UserProfileSchema>());
            msg!("lamports needed to store above space {}",Rent::get()?.minimum_balance(std::mem::size_of::<UserProfileSchema>()));

            invoke_signed(
                &system_instruction::create_account(
                    account.key, 
                    user_profile_account_pda_client.key,
                    Rent::get()?.minimum_balance(std::mem::size_of::<UserProfileSchema>()),
                    std::mem::size_of::<UserProfileSchema>().try_into().unwrap(),
                    update_profile_contract.key,
                ),
                &[user_profile_account_pda_client.clone(), account.clone(), system_program.clone()],
                &[&[b"profile", account.key.as_ref(), &[profile_bump]]],
            )?;
        },
        
        InstructionData::UpdateUserInfo { name, date, month, year } => {
            msg!("Update proofile Instruction reached");

            let account = next_account_info(accounts_iter)?;
            let user_profile_account_pda_client = next_account_info(accounts_iter)?;
            let profile_address_contract = next_account_info(accounts_iter)?;

            let (user_profile_account_pda_program, profile_bump) = get_user_profile_account_pda(account, program_id);
          
            if user_profile_account_pda_program != *user_profile_account_pda_client.key {
              msg!("Incorrect user Profile PDA as input");
              msg!(&user_profile_account_pda_client.key.to_string());
              return Err(ProgramError::InvalidInstructionData)
            }

            let mut accounts_meta = Vec::new();
            accounts_meta.push(
                AccountMeta {
                    pubkey: *user_profile_account_pda_client.key,
                    is_signer: true,
                    is_writable: true
                }
            );

            let instruction_data_struct = UserProfileInstructionData {
                name: name,
                date: date,
                month: month,
                year: year
            };

            let instruction = Instruction {
                program_id: *profile_address_contract.key,
                accounts: accounts_meta,
                data: instruction_data_struct.try_to_vec()?
            };

            invoke_signed(
                &instruction,
                &[user_profile_account_pda_client.clone()],
                &[&[b"profile", account.key.as_ref(), &[profile_bump]]]
            ).map_err(|_| ProgramError::IncorrectProgramId)?;
        }

    }

    Ok(())
}

// Sanity tests
#[cfg(test)]
mod test {
    use super::*;
    use solana_program::clock::Epoch;
    use std::mem;
    #[test]
    fn test_sanity() {
        
    }
}