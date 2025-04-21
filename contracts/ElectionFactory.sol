// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Election.sol";

contract ElectionFactory {
    address[] public deployedElections;
    mapping(address => address) public adminToElection;

    event ElectionCreated(address indexed admin, address indexed ElectionAddress, string name);

    function createElection(
        string memory name,
        string[] memory voters,
        string[] memory candidates
    ) external payable {
        require(voters.length > 0, "At least one voter required");
        require(candidates.length >= 2, "At least two candidates required");
        require(voters.length <= 1000, "Too many voters");
        require(adminToElection[msg.sender] == address(0), "You have already created a community");
        require(msg.value >= 0.01 ether * voters.length, "Not enough ETH to cover gas fees");

        Election newElection = (new Election){value: msg.value}(msg.sender, name, candidates, voters);
        deployedElections.push(address(newElection));
        adminToElection[msg.sender] = address(newElection);
        
        emit ElectionCreated(msg.sender, address(newElection), name);
    }

    function getDeployedElections() public view returns (address[] memory) {
        return deployedElections;
    }

    function getElectionByAdmin(address admin) public view returns (address) {
        return adminToElection[admin];
    }
}