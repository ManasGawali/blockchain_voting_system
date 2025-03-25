const hre = require("hardhat");

async function main() {
  const Factory = await hre.ethers.getContractFactory("ElectionFactory"); 
  const factory = await Factory.deploy(); 

  await factory.waitForDeployment(); 

  console.log(`Factory contract deployed at: ${await factory.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
