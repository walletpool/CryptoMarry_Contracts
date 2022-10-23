const { ethers } = require("hardhat");

async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then((f) => f.deployed());
}


async function main() {
  console.log("Construction started.....");
  
 const UniSwapFacet = await deploy('UniSwapFacet', "0xE592427A0AEce92De3Edee1F18E0157C05861564","0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6");
 //0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 --> Mainnet weth9 address
 console.log(
  "UniSwapFacet deployed:",
  UniSwapFacet.address,
  UniSwapFacet.deployTransaction.gasLimit
);
 
 console.log("Construction completed!");
 
}
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}