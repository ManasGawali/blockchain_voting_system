// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Election {
    address public admin;
    string public communityName;
    uint256 public contractBalance;
    string[] public candidates;
    int[] public votes;
    mapping(string => bool) public isVoter;
    mapping(string => bool) public hasVoted;
    mapping(bytes32 => bool) public usedSignatures;

    event ElectionStarted(address indexed admin, string electionType);
    event VoteCasted(
        string indexed voter,
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
        require(_candidates.length >= 2, "At least two candidates required");
        require(_voters.length > 0, "At least one voter required");
        require(_voters.length <= 1000, "Too many voters");
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
    ) internal view returns (int256) {
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

    function voteWithSignature(
        string memory voter,
        string memory candidateName,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        bytes32 messageHash = keccak256(abi.encodePacked(voter, candidateName, address(this)));
        bytes32 prefixedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));

        address signer = ecrecover(prefixedHash, v, r, s);
        require(signer != address(0), "Invalid signature");
        require(isVoter[voter], "Not a registered voter");
        require(!hasVoted[voter], "Voter has already voted");
        require(!usedSignatures[prefixedHash], "Signature already used");
        require(address(this).balance >= 0.01 ether, "Not enough ETH to cover gas fees");

        int256 candidateIndex = findCandidate(candidateName);
        require(candidateIndex != -1, "Candidate not found");

        uint256 beforeBalance = address(this).balance;

        votes[uint256(candidateIndex)] += 1;
        hasVoted[voter] = true;
        usedSignatures[prefixedHash] = true;

        uint256 gasReimbursement = 0.01 ether;
        contractBalance -= gasReimbursement;
        (bool sent, ) = msg.sender.call{value: gasReimbursement}("");
        require(sent, "Failed to reimburse relayer");

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
        (bool sent, ) = payable(admin).call{value: amount}("");
        require(sent, "Failed to withdraw funds");
        emit FundsWithdrawn(admin, amount);
    }

    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
        contractBalance += msg.value;
    }
}