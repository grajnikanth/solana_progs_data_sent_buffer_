import {checkProgram, 
    establishConnection, 
    establishPayer, 
    initialize, 
    updateAddress, 
    getAddress,
    setUpProfileProgramParams,
    profilePDAInitialize,
    updateProfile
} from "./index";

const main = async() => {
    await establishConnection();
    await establishPayer();
    await checkProgram();
    await setUpProfileProgramParams();
    // await profilePDAInitialize();
    await updateProfile("John Smith", 1, 1, 1970);
    // await initialize();
   // await updateAddress("25 Vialdo, RSM, CA, India");
    // await getAddress();
}

main()