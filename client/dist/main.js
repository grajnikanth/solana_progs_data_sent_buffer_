"use strict";
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
const index_1 = require("./index");
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, index_1.establishConnection)();
    yield (0, index_1.establishPayer)();
    yield (0, index_1.checkProgram)();
    yield (0, index_1.setUpProfileProgramParams)();
    // await profilePDAInitialize();
    yield (0, index_1.updateProfile)("John Smith", 1, 1, 1970);
    // await initialize();
    // await updateAddress("25 Vialdo, RSM, CA, India");
    // await getAddress();
});
main();
//# sourceMappingURL=main.js.map