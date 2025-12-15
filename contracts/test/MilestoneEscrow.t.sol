// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {MilestoneEscrow} from "../src/MilestoneEscrow.sol";

contract MilestoneEscrowTest is Test {
    address client = vm.addr(1);
    address provider = vm.addr(2);

    function _deploy2Milestones() internal returns (MilestoneEscrow e) {
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0.3 ether;
        amounts[1] = 0.7 ether;

        uint64[] memory deadlines = new uint64[](2);
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
    }

    function test_claim_afterDisputeWindow_paysProvider() public {
        MilestoneEscrow e = _deploy2Milestones();
        vm.deal(client, 1 ether);

        vm.prank(client);
        e.fund{value: 1 ether}();

        vm.prank(provider);
        e.submit(0, "ipfs://proof-0");

        // 아직 3일 전이면 claim 불가
        vm.prank(provider);
        vm.expectRevert("DISPUTE_WINDOW");
        e.claim(0);

        // 3일 경과
        vm.warp(block.timestamp + 3 days);

        uint256 beforeBal = provider.balance;

        vm.prank(provider);
        e.claim(0);

        assertEq(provider.balance - beforeBal, 0.3 ether);

        MilestoneEscrow.Milestone memory m = e.getMilestone(0);
        assertEq(uint256(m.status), uint256(MilestoneEscrow.Status.Paid));
    }

    function test_fail_claim_onlyProvider() public {
        MilestoneEscrow e = _deploy2Milestones();
        vm.deal(client, 1 ether);

        vm.prank(client);
        e.fund{value: 1 ether}();

        vm.prank(provider);
        e.submit(0, "ipfs://proof-0");

        vm.warp(block.timestamp + 3 days);

        vm.prank(client);
        vm.expectRevert("NOT_PROVIDER");
        e.claim(0);
    }

    function test_claim_reverts_before_deadline() public {
        MilestoneEscrow e = _deploy2Milestones();
        // fund
        vm.deal(client, 1 ether);
        vm.prank(client);
        e.fund{value: 1 ether}();

        // submit milestone 0
        vm.prank(provider);
        e.submit(0, "ipfs://proof-0");

        // 아직 deadline 전
        vm.expectRevert(bytes("DISPUTE_WINDOW"));
        vm.prank(provider);
        MilestoneEscrow(e).claim(0);
    }

    function test_claim_succeeds_after_deadline_and_pays() public {
        MilestoneEscrow e = _deploy2Milestones();
        vm.deal(client, 1 ether);

        vm.startPrank(client);
        e.fund{value: 1 ether}();
        vm.stopPrank();

        vm.startPrank(provider);
        e.submit(0, "ipfs://proof-0");
        vm.stopPrank();

        // deadline 이후로 워프 (getMilestone은 struct를 리턴하므로 struct로 받는다)
        MilestoneEscrow.Milestone memory m0 = e.getMilestone(0);
        vm.warp(uint256(m0.deadline) + 1);

        uint256 beforeBal = provider.balance;

        vm.prank(provider);
        e.claim(0);

        assertGt(provider.balance, beforeBal);

        // 상태 확인
        MilestoneEscrow.Milestone memory m0After = e.getMilestone(0);
        assertEq(uint256(m0After.status), uint256(MilestoneEscrow.Status.Paid));
    }


    function test_claim_reverts_if_not_submitted() public {
        MilestoneEscrow e = _deploy2Milestones();
        vm.deal(client, 1 ether);

        vm.startPrank(client);
        e.fund{ value: e.totalAmount() }();
        vm.stopPrank();

        // 제출 안 한 상태에서 claim
        vm.expectRevert(("BAD_STATUS"));
        vm.prank(provider);
        e.claim(0);
    }

}
