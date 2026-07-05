// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {RotatingSavingsPool} from "../src/RotatingSavingsPool.sol";

contract DeployRotatingSavingsPool is Script {
    function run() external returns (RotatingSavingsPool deployed) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(privateKey);
        deployed = new RotatingSavingsPool();
        vm.stopBroadcast();
    }
}
