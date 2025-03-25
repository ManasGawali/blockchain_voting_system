require("dotenv").config();
const express = require("express");
const { ethers } = require("ethers");

const app = express();
const PORT = 3000;

app.use(express.json());

const factoryAddress = process.env.FACTORY_CONTRACT;
const privateKey = process.env.ADMIN_PRIVATE_KEY;

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const wallet = new ethers.Wallet(privateKey, provider);

const factoryABI = require("./artifacts/contracts/ElectionFactory.sol/ElectionFactory.json").abi;
const electionABI = require("./artifacts/contracts/Election.sol/Election.json").abi;

const factoryContract = new ethers.Contract(factoryAddress, factoryABI, wallet);

async function getElectionContract(adminAddress) {
    const electionAddress = await factoryContract.getElectionByAdmin(adminAddress);
    if (electionAddress.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
        throw new Error("No election found for this admin");
    }
    return new ethers.Contract(electionAddress, electionABI, wallet);
}

// ✅ API to Create an Election with ETH
app.post("/create-election", async (req, res) => {
    try {
        const { electionName, voters, candidates, depositAmount } = req.body;

        if (!electionName || !Array.isArray(voters) || !Array.isArray(candidates) || isNaN(depositAmount) || depositAmount <= 0) {
            return res.status(400).json({ error: "Invalid parameters. Ensure depositAmount is a positive number." });
        }

        console.log(`Creating election: ${electionName} with voters and candidates`);

        const tx = await factoryContract.createElection(electionName, voters, candidates, {
            value: ethers.parseEther(depositAmount.toString()) // Send ETH
        });
        await tx.wait();

        console.log(`Election created: TX Hash - ${tx.hash}`);
        res.json({ success: true, txHash: tx.hash });
    } catch (error) {
        console.error("Error creating election:", error);
        res.status(500).json({ error: "Failed to create election" });
    }
});

// ✅ API to Get Contract Balance
app.get("/contract-balance/:admin", async (req, res) => {
    try {
        const admin = req.params.admin;
        const electionContract = await getElectionContract(admin);
        const balance = await provider.getBalance(electionContract.target);

        res.json({ balance: ethers.formatEther(balance) + " ETH" });
    } catch (error) {
        console.error("❌ Error fetching contract balance:", error);
        res.status(500).json({ error: "Failed to get balance" });
    }
});

// ✅ API to Cast a Vote
app.post("/vote", async (req, res) => {
    try {
        const { admin, voter, candidate } = req.body;
        if (!admin || !voter || !candidate) {
            return res.status(400).json({ error: "Missing admin, voter, or candidate" });
        }

        const electionContract = await getElectionContract(admin);

        const beforeBalance = await provider.getBalance(electionContract.target);

        const tx = await electionContract.vote(voter, candidate, { value: 0 });
        await tx.wait();

        const afterBalance = await provider.getBalance(electionContract.target);

        console.log(`${voter} voted for ${candidate}`);
        console.log(`Contract Balance Before: ${ethers.formatEther(beforeBalance)} ETH`);
        console.log(`Contract Balance After: ${ethers.formatEther(afterBalance)} ETH`);

        res.json({ 
            success: true, 
            txHash: tx.hash, 
            beforeBalance: ethers.formatEther(beforeBalance), 
            afterBalance: ethers.formatEther(afterBalance) 
        });

    } catch (error) {
        console.error("❌ Error casting vote:", error);
        res.status(500).json({ error: "Failed to cast vote" });
    }
});

// ✅ Event Listener for Votes
async function listenToElectionEvents() {
    try {
        const elections = await factoryContract.getAllElections();
        for (const electionAddress of elections) {
            const electionContract = new ethers.Contract(electionAddress, electionABI, wallet);
            electionContract.on("VoteCasted", (voter, candidate, beforeBalance, afterBalance) => {
                console.log(`🔔 Vote Event: ${voter} voted for ${candidate}`);
                console.log(`🔹 Balance Before: ${ethers.formatEther(beforeBalance)} ETH`);
                console.log(`🔹 Balance After: ${ethers.formatEther(afterBalance)} ETH`);
            });
        }
        console.log("✅ Listening for VoteCasted events...");
    } catch (error) {
        console.error("❌ Error setting up event listener:", error);
    }
}

// Start event listener
listenToElectionEvents();

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
