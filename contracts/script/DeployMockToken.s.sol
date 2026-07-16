// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockToken} from "../src/MockToken.sol";

/// @notice Deploys MockToken. Requires env var PRIVATE_KEY (a funded testnet deployer).
/// Usage:
///   forge script script/DeployMockToken.s.sol:DeployMockToken --rpc-url monad_testnet --broadcast
contract DeployMockToken is Script {
    function run() external returns (MockToken token) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        token = new MockToken(1_000_000 ether);
        vm.stopBroadcast();
        console.log("MockToken deployed at:", address(token));
    }
}
