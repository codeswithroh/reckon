// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GuardedExecutor} from "../src/GuardedExecutor.sol";

/// @notice Deploys GuardedExecutor. Requires env var PRIVATE_KEY (a funded testnet deployer).
/// Usage:
///   forge script script/Deploy.s.sol:Deploy --rpc-url monad_testnet --broadcast
contract Deploy is Script {
    function run() external returns (GuardedExecutor exec) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        exec = new GuardedExecutor();
        vm.stopBroadcast();
        console.log("GuardedExecutor deployed at:", address(exec));
    }
}
