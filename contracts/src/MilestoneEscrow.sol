// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MilestoneEscrow {
    enum Status { Pending, Submitted, Approved, Rejected, Paid }

    struct Milestone {
        uint256 amount;
        uint64 deadline;
        Status status;
        string proofURI;   // 제출물 링크(노션/깃/드라이브)
        string reasonURI;  // 거절 사유 링크(선택)
    }

    address public immutable client;
    address public immutable provider;

    bool public funded;
    uint256 public totalAmount;

    Milestone[] private _milestones;

    event EscrowCreated(address indexed client, address indexed provider, uint256 milestones, uint256 totalAmount);
    event Funded(address indexed client, uint256 amount);
    event Submitted(uint256 indexed milestoneIndex, string proofURI);
    event Approved(uint256 indexed milestoneIndex);
    event Rejected(uint256 indexed milestoneIndex, string reasonURI);
    event Paid(uint256 indexed milestoneIndex, address indexed to, uint256 amount);

    modifier onlyClient() {
        require(msg.sender == client, "NOT_CLIENT");
        _;
    }

    modifier onlyProvider() {
        require(msg.sender == provider, "NOT_PROVIDER");
        _;
    }

    constructor(
        address _client,
        address _provider,
        uint256[] memory amounts,
        uint64[] memory deadlines
    ) {
        require(_client != address(0) && _provider != address(0), "ZERO_ADDR");
        require(amounts.length > 0, "NO_MILESTONES");
        require(amounts.length == deadlines.length, "LEN_MISMATCH");

        client = _client;
        provider = _provider;

        uint256 sum;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "ZERO_AMOUNT");
            _milestones.push(Milestone({
                amount: amounts[i],
                deadline: deadlines[i],
                status: Status.Pending,
                proofURI: "",
                reasonURI: ""
            }));
            sum += amounts[i];
        }
        totalAmount = sum;

        emit EscrowCreated(client, provider, amounts.length, sum);
    }

    function milestonesCount() external view returns (uint256) {
        return _milestones.length;
    }

    function getMilestone(uint256 i) external view returns (Milestone memory) {
        require(i < _milestones.length, "OOB");
        return _milestones[i];
    }

    function fund() external payable onlyClient {
        require(!funded, "ALREADY_FUNDED");
        require(msg.value == totalAmount, "BAD_VALUE");
        funded = true;
        emit Funded(msg.sender, msg.value);
    }

    function submit(uint256 i, string calldata proofURI) external onlyProvider {
        require(funded, "NOT_FUNDED");
        require(i < _milestones.length, "OOB");
        Milestone storage m = _milestones[i];
        require(m.status == Status.Pending || m.status == Status.Rejected, "BAD_STATUS");
        require(bytes(proofURI).length > 0, "EMPTY_PROOF");

        m.status = Status.Submitted;
        m.proofURI = proofURI;

        emit Submitted(i, proofURI);
    }

    function approve(uint256 i) external onlyClient {
        require(funded, "NOT_FUNDED");
        require(i < _milestones.length, "OOB");
        Milestone storage m = _milestones[i];
        require(m.status == Status.Submitted, "NOT_SUBMITTED");

        m.status = Status.Approved;
        emit Approved(i);

        // pay
        m.status = Status.Paid;
        (bool ok, ) = provider.call{value: m.amount}("");
        require(ok, "PAY_FAILED");
        emit Paid(i, provider, m.amount);
    }

    function reject(uint256 i, string calldata reasonURI) external onlyClient {
        require(funded, "NOT_FUNDED");
        require(i < _milestones.length, "OOB");
        Milestone storage m = _milestones[i];
        require(m.status == Status.Submitted, "NOT_SUBMITTED");

        m.status = Status.Rejected;
        m.reasonURI = reasonURI;

        emit Rejected(i, reasonURI);
    }
}
