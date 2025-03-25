const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Election Contract", function () {
  let election, admin, accounts;
  const communityName = "Blockchain Club";
  const candidates = ["Alice", "Bob", "Charlie"];
  const voters = ["Voter1", "Voter2", "Voter3"]; // Using string IDs

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    admin = accounts[0];

    const Election = await ethers.getContractFactory("Election");
    election = await Election.deploy(
      admin.address,
      communityName,
      candidates,
      voters,
      { value: ethers.parseEther("0.05") } // Admin deposits 0.05 ETH
    );
    await election.waitForDeployment();
  });

  it("deploys successfully", async function () {
    expect(await election.getAddress()).to.be.a("string");
  });

  it("sets the admin correctly", async function () {
    expect(await election.admin()).to.equal(admin.address);
  });

  it("registers candidates correctly", async function () {
    for (let i = 0; i < candidates.length; i++) {
      expect(await election.candidates(i)).to.equal(candidates[i]);
    }
  });

  it("registers voters correctly", async function () {
    for (let voterID of voters) {
      expect(await election.isVoter(voterID)).to.equal(true);
    }
  });

  it("allows admin to deposit more funds", async function () {
    await election.depositFunds({ value: ethers.parseEther("0.02") });

    const balance = await ethers.provider.getBalance(await election.getAddress());
    expect(balance).to.be.above(ethers.parseEther("0.05"));
  });

  it("allows registered voters to vote", async function () {
    await election.vote(voters[0], "Alice");

    const votes = await election.getVotes("Alice");
    expect(Number(votes)).to.equal(1); // Alice should have 1 vote
  });

  it("prevents unregistered voters from voting", async function () {
    await expect(election.vote("UnknownVoter", "Alice")).to.be.revertedWith("Not a registered voter");
  });

  it("prevents voters from voting more than once", async function () {
    await election.vote(voters[0], "Alice");

    await expect(election.vote(voters[0], "Bob")).to.be.revertedWith("Voter has already voted");
  });

  it("prevents voting if contract balance is too low", async function () {
    const ElectionLowFunds = await ethers.getContractFactory("Election");

    await expect(
      ElectionLowFunds.deploy(
        admin.address,
        communityName,
        candidates,
        voters,
        { value: ethers.parseEther("0.002") } // Less than required 0.01 * voters.length
      )
    ).to.be.revertedWith("Not enough ETH to cover gas fees");
  });

  it("counts votes correctly", async function () {
    await election.vote(voters[0], "Alice");
    await election.vote(voters[1], "Alice");
    await election.vote(voters[2], "Bob");

    const aliceVotes = await election.getVotes("Alice");
    expect(Number(aliceVotes)).to.equal(2);

    const bobVotes = await election.getVotes("Bob");
    expect(Number(bobVotes)).to.equal(1);

    const charlieVotes = await election.getVotes("Charlie");
    expect(Number(charlieVotes)).to.equal(0);
  });

  it("emits an event when a vote is cast", async function () {
    await expect(election.vote(voters[0], "Alice"))
      .to.emit(election, "VoteCasted")
      .withArgs(voters[0], "Alice");
  });

  it("emits an event when funds are deposited", async function () {
    await expect(election.depositFunds({ value: ethers.parseEther("0.02") }))
      .to.emit(election, "FundsDeposited")
      .withArgs(admin.address, ethers.parseEther("0.02"));
  });
});
