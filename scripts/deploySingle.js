const { ethers } = require("hardhat");
const { writeFileSync } = require("fs");

async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then((f) => f.deployed());
}

function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

async function main() {
  console.log("Construction started.....");
 
const DiamondCutFacet = await deploy('DiamondCutFacet');
  console.log(
   "DiamondCutFacet deployed:",
   DiamondCutFacet.address,
   DiamondCutFacet.deployTransaction.gasLimit
 );

 sleep(10000);
 const CompoundFacet = await deploy('CompoundFacet');
  console.log(
   "CompoundFacet deployed:",
   CompoundFacet.address,
   CompoundFacet.deployTransaction.gasLimit
 );

  const UniSwapFacet = await deploy('UniSwapFacet', "0xE592427A0AEce92De3Edee1F18E0157C05861564","0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270");
  //0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 --> Mainnet weth9 address
  //0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6 -->Goerli weth9 address
  //0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270 --> Polygon WMATIC
  console.log(
   "UniSwapFacet deployed:",
   UniSwapFacet.address,
   UniSwapFacet.deployTransaction.gasLimit
 );
 
 sleep(10000);
  const WaverImplementation = await deploy("WaverIDiamond","0x09FAd7D8bEe2dbf01391CdEcB48b9036B498f86B", DiamondCutFacet.address);
 
  console.log(
   "Waver Implementation Contract deployed:",
   WaverImplementation.address,
   WaverImplementation.deployTransaction.gasLimit
 );
 
 sleep(10000);
  const WaverFactory = await deploy(
    "WaverFactory",
    WaverImplementation.address
  );
 
  console.log(
   "Wave Factory Contract deployed:",
   WaverFactory.address,
   WaverFactory.deployTransaction.gasLimit
 );
 sleep(10000);
  const WavePortal7 = await deploy(
    "WavePortal7",
    "0x09FAd7D8bEe2dbf01391CdEcB48b9036B498f86B",
    "0x46e7Dc5d4c41398496F848957528345F70B96F91",
    WaverFactory.address,
    "0xe9107E13FeDd47bBb5c8DB52c03f1d06e73F2Ff6",
    DiamondCutFacet.address,
    UniSwapFacet.address,
    CompoundFacet.address,
  );
 
  console.log(
   "Wave Portal Contract deployed:",
   WavePortal7.address,
   WavePortal7.deployTransaction.gasLimit
 );
 
 
  writeFileSync(
   "deploytest-polygon-updated2.json",
   JSON.stringify(
     { 
       DiamondCutFacet: DiamondCutFacet.address,
       CompoundFacet: CompoundFacet.address, 
       UniSwapFacet: UniSwapFacet.address, 
       nftViewContract: "0x0EEf70a289962945f8B02d4F615cB611b8fB5f9b",
       nftContract: "0x46e7Dc5d4c41398496F848957528345F70B96F91",
       MinimalForwarder: "0x09FAd7D8bEe2dbf01391CdEcB48b9036B498f86B",
       WaverImplementation: WaverImplementation.address,
       WaverFactory: WaverFactory.address,
       WavePortal: WavePortal7.address,
       nftSplit: "0x527EE6c640B0fa7A3Fb27445E48578d3d59243D5",
     },
     null,
     2
   )
 );
 
 
console.log( "Passing parameters ----->");
 var txn;
 const nftViewContract = await hre.ethers.getContractAt("nftview", "0x0EEf70a289962945f8B02d4F615cB611b8fB5f9b");
 const nftContract = await hre.ethers.getContractAt("nftmint2", "0x46e7Dc5d4c41398496F848957528345F70B96F91");
 const nftSplit = await hre.ethers.getContractAt("nftSplit", "0x527EE6c640B0fa7A3Fb27445E48578d3d59243D5");

 sleep(10000);
 txn = await nftViewContract.changeMainAddress(WavePortal7.address);
 console.log("NFT Address updated in View");
 txn.wait();
 sleep(10000);
 txn = await nftContract.changeMainAddress(WavePortal7.address);
 console.log("NFT Address updated");
 txn.wait();
 sleep(10000);
  
  txn = await WaverFactory.changeAddress(WavePortal7.address);
  console.log("Wavefactory Main Address updated");
  txn.wait();
  sleep(10000);
  
  txn = await WavePortal7.changeaddressNFT(nftContract.address,"0x527EE6c640B0fa7A3Fb27445E48578d3d59243D5");
  console.log("WavePortal Split Address updated");
  txn.wait();
  sleep(10000);

  txn = await nftSplit.changeMainAddress(WavePortal7.address);
  console.log("NFT Split Address updated");
  txn.wait();
  sleep(10000);

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