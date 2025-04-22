// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Election {
    address public admin;
    string public communityName;
    string[] public candidates;
    int[] public votes;
    mapping(string => bool) public isVoter; // Voter validation
    mapping(string => bool) public hasVoted; // Track if voter has voted
    uint256 public contractBalance; // Store ETH for gas fees

    event ElectionStarted(address indexed admin, string electionType);
    event VoteCasted(
        string voter,
        string candidateName,
        uint256 beforeBalance,
        uint256 afterBalance
    );
    event FundsDeposited(address indexed admin, uint256 amount);
    event FundsWithdrawn(address indexed admin, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    constructor(
        address _admin,
        string memory _name,
        string[] memory _candidates,
        string[] memory _voters
    ) payable {
        require(
            msg.value > 0.01 ether * _voters.length,
            "Not enough ETH to cover gas fees"
        );
        admin = _admin;
        communityName = _name;
        contractBalance = msg.value;

        candidates = _candidates;
        votes = new int[](_candidates.length);

        for (uint256 i = 0; i < _voters.length; i++) {
            isVoter[_voters[i]] = true;
        }

        emit ElectionStarted(admin, "General Election");
    }

    function findCandidate(
        string memory candidateName
    ) public view returns (int256) {
        for (uint256 i = 0; i < candidates.length; i++) {
            if (
                keccak256(abi.encodePacked(candidates[i])) ==
                keccak256(abi.encodePacked(candidateName))
            ) {
                return int256(i);
            }
        }
        return -1; // Candidate not found
    }

    function vote(string memory voter, string memory candidateName) public {
        require(isVoter[voter], "Not a registered voter");
        require(!hasVoted[voter], "Voter has already voted");
        require(
            address(this).balance >= 0.01 ether,
            "Not enough ETH to cover gas fees"
        );

        int256 candidateIndex = findCandidate(candidateName);
        require(candidateIndex != -1, "Candidate not found");

        uint256 beforeBalance = address(this).balance;

        votes[uint256(candidateIndex)] += 1;
        hasVoted[voter] = true;

        // Reimburse company account with 0.01 ETH
        contractBalance -= 0.01 ether;
        (bool sent, ) = msg.sender.call{value: 0.01 ether}("");
        require(sent, "Failed to reimburse company account");

        emit VoteCasted(voter, candidateName, beforeBalance, address(this).balance);
    }

    function getVotes(string memory candidateName) public view returns (int) {
        int256 candidateIndex = findCandidate(candidateName);
        require(candidateIndex != -1, "Candidate not found");
        return votes[uint256(candidateIndex)];
    }

    function getAllVotes() public view returns (int[] memory) {
        return votes;
    }

    function depositFunds() public payable onlyAdmin {
        require(msg.value > 0, "Must deposit some ETH");
        contractBalance += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    function withdrawAllFunds() public onlyAdmin {
        uint256 amount = contractBalance;
        require(amount > 0, "No funds to withdraw");
        contractBalance = 0;
        payable(admin).transfer(amount);
        emit FundsWithdrawn(admin, amount);
    }

    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }
}