// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {MilestoneEscrowFactory} from "../src/MilestoneEscrowFactory.sol";

contract DeployFactory is Script {
    function run() external returns (MilestoneEscrowFactory f) {
        vm.startBroadcast();
        f = new MilestoneEscrowFactory();
        vm.stopBroadcast();
    }
}
