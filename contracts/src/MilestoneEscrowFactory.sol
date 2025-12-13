// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MilestoneEscrow} from "./MilestoneEscrow.sol";

contract MilestoneEscrowFactory {
    event EscrowCreated(address indexed escrow, address indexed client, address indexed provider);

    function createEscrow(
        address client,
        address provider,
        uint256[] calldata amounts,
        uint64[] calldata deadlines
    ) external returns (address escrow) {
        MilestoneEscrow e = new MilestoneEscrow(client, provider, amounts, deadlines);
        escrow = address(e);
        emit EscrowCreated(escrow, client, provider);
    }
}
