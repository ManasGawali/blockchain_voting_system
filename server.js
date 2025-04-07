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

async function getSignerForAdmin(admin) {
    const adminAddress = String(admin).toLowerCase(); // ensure string
    const accounts = await provider.listAccounts();

    console.log("Available accounts:", accounts); // 🔍 debug log

    for (const addr of accounts) {
        const address = String(addr); // ensure it's string
        if (address.toLowerCase() === adminAddress) {
            return provider.getSigner(address);
        }
    }
    throw new Error("Admin signer not found");
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
const { isAddress } = require("ethers");

app.get("/contract-balance/:admin", async (req, res) => {
    try {
        const admin = req.params.admin;

        if (!isAddress(admin)) {
            return res.status(400).json({ error: "Invalid Ethereum address" });
        }

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

app.post("/results", async (req, res) => {
    try {
        const { admin } = req.body;

        if (!admin) {
            return res.status(400).json({ error: "Admin address is required" });
        }

        const electionContract = await getElectionContract(admin);

        // Get all candidates by indexing
        const candidates = [];
        let i = 0;
        while (true) {
            try {
                const candidate = await electionContract.candidates(i);
                candidates.push(candidate);
                i++;
            } catch (e) {
                break; // End of array
            }
        }

        const votes = await electionContract.getAllVotes();

        const result = {};
        for (let j = 0; j < candidates.length; j++) {
            result[candidates[j]] = parseInt(votes[j]);
        }

        res.json({ success: true, result });
    } catch (err) {
        console.error("❌ Error in /results:", err);
        res.status(500).json({ error: "Failed to fetch results" });
    }
});

app.post("/withdraw", async (req, res) => {
    try {
        const { admin } = req.body;
        if (!admin) return res.status(400).json({ error: "Admin address required" });

        const electionContract = await getElectionContract(admin);

        // OPTIONAL: You can check if the backend wallet is actually the admin on-chain
        const contractAdmin = await electionContract.admin();
        if (wallet.address.toLowerCase() !== contractAdmin.toLowerCase()) {
            return res.status(403).json({ error: "Backend wallet is not the election admin" });
        }

        // Call withdrawAllFunds()
        const tx = await electionContract.withdrawAllFunds();
        await tx.wait();

        res.json({ success: true, txHash: tx.hash });
    } catch (error) {
        console.error("❌ Error in /withdraw:", error);
        res.status(500).json({ error: "Withdrawal failed" });
    }
});



// ✅ Event Listener for Votes
async function listenToElectionEvents() {
    try {
        const elections = await factoryContract.getDeployedElections();
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
