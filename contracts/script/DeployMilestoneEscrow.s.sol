// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {MilestoneEscrow} from "../src/MilestoneEscrow.sol";

contract DeployMilestoneEscrow is Script {
    function run() external returns (MilestoneEscrow escrow) {
        address client = vm.envAddress("CLIENT_ADDR");
        address provider = vm.envAddress("PROVIDER_ADDR");

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0.3 ether;
        amounts[1] = 0.7 ether;

        uint64[] memory deadlines = new uint64[](2);
        deadlines[0] = uint64(block.timestamp + 7 days);
        deadlines[1] = uint64(block.timestamp + 14 days);

        vm.startBroadcast();
        escrow = new MilestoneEscrow(client, provider, amounts, deadlines);
        vm.stopBroadcast();
    }
}
