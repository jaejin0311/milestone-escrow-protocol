// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {MilestoneEscrow} from "../src/MilestoneEscrow.sol";

contract MilestoneEscrowTest is Test {
    address client = vm.addr(1);
    address provider = vm.addr(2);

    function _deploy2Milestones() internal returns (MilestoneEscrow e) {
        uint256;
        amounts[0] = 0.3 ether;
        amounts[1] = 0.7 ether;

        uint64;
        deadlines[0] = uint64(block.timestamp + 7 days);
        deadlines[1] = uint64(block.timestamp + 14 days);

        e = new MilestoneEscrow(client, provider, amounts, deadlines);
    }

    function test_happyPath_submitApprovePays() public {
        MilestoneEscrow e = _deploy2Milestones();
        vm.deal(client, 1 ether);

        vm.prank(client);
        e.fund{value: 1 ether}();

        vm.prank(provider);
        e.submit(0, "ipfs://proof-0");

        uint256 beforeBal = provider.balance;

        vm.prank(client);
        e.approve(0);

        assertEq(provider.balance - beforeBal, 0.3 ether);

        MilestoneEscrow.Milestone memory m = e.getMilestone(0);
        assertEq(uint256(m.status), uint256(MilestoneEscrow.Status.Paid));
    }

    function test_rejectThenResubmit() public {
        MilestoneEscrow e = _deploy2Milestones();
        vm.deal(client, 1 ether);

        vm.prank(client);
        e.fund{value: 1 ether}();

        vm.prank(provider);
        e.submit(0, "ipfs://proof-0");

        vm.prank(client);
        e.reject(0, "ipfs://reason");

        vm.prank(provider);
        e.submit(0, "ipfs://proof-0-v2");

        MilestoneEscrow.Milestone memory m = e.getMilestone(0);
        assertEq(uint256(m.status), uint256(MilestoneEscrow.Status.Submitted));
    }

    function test_fail_submitNotProvider() public {
        MilestoneEscrow e = _deploy2Milestones();
        vm.deal(client, 1 ether);

        vm.prank(client);
        e.fund{value: 1 ether}();

        vm.expectRevert("NOT_PROVIDER");
        e.submit(0, "ipfs://proof");
    }

    function test_fail_submitBeforeFund() public {
        MilestoneEscrow e = _deploy2Milestones();

        vm.prank(provider);
        vm.expectRevert("NOT_FUNDED");
        e.submit(0, "ipfs://proof");
    }
}
