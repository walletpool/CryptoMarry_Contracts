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
  
 //Deploying Cuts etc... 

 const DiamondCutFacet = await deploy('DiamondCutFacet');
 console.log(
  "DiamondCutFacet deployed:",
  DiamondCutFacet.address,
  DiamondCutFacet.deployTransaction.gasLimit
);
 const DiamondLoupeFacet = await deploy('DiamondLoupeFacet');
 console.log(
  "DiamondLoupeFacet deployed:",
  DiamondLoupeFacet.address,
  DiamondLoupeFacet.deployTransaction.gasLimit
);
 const CompoundFacet = await deploy('CompoundFacet');
 console.log(
  "CompoundFacet deployed:",
  CompoundFacet.address,
  CompoundFacet.deployTransaction.gasLimit
);
 const UniSwapFacet = await deploy('UniSwapFacet');
 console.log(
  "UniSwapFacet deployed:",
  UniSwapFacet.address,
  UniSwapFacet.deployTransaction.gasLimit
);

 //const diamondInit = await deploy('DiamondInit');
 const nftViewContract = await deploy(
   "nftview",
   "0x196eC7109e127A353B709a20da25052617295F6f"
 );

 console.log(
  "NFT View Contract deployed:",
  nftViewContract.address,
  nftViewContract.deployTransaction.gasLimit
);

 const nftContract = await deploy("nftmint2", nftViewContract.address);

 console.log(
  "NFT Contract deployed:",
  nftContract.address,
  nftContract.deployTransaction.gasLimit
);

 const forwarder = await deploy("MinimalForwarder");

 console.log(
  "Minimal Forwarder Contract deployed:",
  forwarder.address,
  forwarder.deployTransaction.gasLimit
);

 const WaverImplementation = await deploy("WaverIDiamond",forwarder.address);

 console.log(
  "Waver Implementation Contract deployed:",
  WaverImplementation.address,
  WaverImplementation.deployTransaction.gasLimit
);


 const WaverFactory = await deploy(
   "WaverFactory",
   WaverImplementation.address
 );

 console.log(
  "Wave Factory Contract deployed:",
  WaverFactory.address,
  WaverFactory.deployTransaction.gasLimit
);

 const WavePortal7 = await deploy(
   "WavePortal7",
   forwarder.address,
   nftContract.address,
   WaverFactory.address,
   DiamondCutFacet.address,
   "0xEC3215C0ba03fA75c8291Ce92ace346589483E26"
 );

 console.log(
  "Wave Portal Contract deployed:",
  WavePortal7.address,
  WavePortal7.deployTransaction.gasLimit
);

 const nftSplit = await deploy("nftSplit", WavePortal7.address);

 console.log(
  "NFT Split Contract deployed:",
  nftSplit.address,
  nftSplit.deployTransaction.gasLimit
);

 writeFileSync(
  "deploytest.json",
  JSON.stringify(
    { 
      DiamondCutFacet: DiamondCutFacet.address,
      DiamondLoupeFacet: DiamondLoupeFacet.address,
      CompoundFacet: CompoundFacet.address, 
      UniSwapFacet: UniSwapFacet.address, 
      nftViewContract: nftViewContract.address,
      nftContract: nftContract.address,
      MinimalForwarder: forwarder.address,
      WaverImplementation: WaverImplementation.address,
      WaverFactory: WaverFactory.address,
      WavePortal: WavePortal7.address,
    },
    null,
    2
  )
);
}

 console.log( "Passing parameters ----->");
 var txn;
 txn =  await nftViewContract.changenftmainAddress(nftContract.address);
 console.log("NFT Main Address updated");
 txn.wait();
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
  txn = await WavePortal7.changeaddressNFTSplit(nftSplit.address);
  console.log("WavePortal Split Address updated");
  txn.wait();
  sleep(10000);

  txn =  await nftViewContract.addheartPatterns(0, "0x3c726563742f3e");
  txn.wait();
  sleep(10000);
  txn = await nftViewContract.addadditionalGraphics(0, "0x3c726563742f3e");
  txn.wait();
  sleep(10000);
  txn =  await nftViewContract.addcertBackground(
   0,
   "0x3c6c696e6561724772616469656e742069643d2242222078313d2230222079313d2230222078323d22333135222079323d2233313022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f702073746f702d636f6c6f723d2223636235656565222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223306364376534222073746f702d6f7061636974793d222e3939222f3e3c2f6c696e6561724772616469656e743e"
 );
 txn.wait();
  sleep(10000);
  txn =   await nftViewContract.addcertBackground(
   1001,
   "0x3c6c696e6561724772616469656e742069643d2242222078313d22353025222079313d223025222078323d22353025222079323d2231303025223e3c73746f70206f66667365743d223025222073746f702d636f6c6f723d2223374135464646223e3c616e696d617465206174747269627574654e616d653d2273746f702d636f6c6f72222076616c7565733d22233741354646463b20233031464638393b202337413546464622206475723d2234732220726570656174436f756e743d22696e646566696e697465222f3e3c2f73746f703e3c73746f70206f66667365743d2231303025222073746f702d636f6c6f723d2223303146463839223e3c616e696d617465206174747269627574654e616d653d2273746f702d636f6c6f72222076616c7565733d22233031464638393b20233741354646463b202330314646383922206475723d2234732220726570656174436f756e743d22696e646566696e697465222f3e3c2f73746f703e3c2f6c696e6561724772616469656e743e"
 );
 txn.wait();
 sleep(10000);
 txn = await nftViewContract.addheartPatterns(
   101,
   "0x3c6c696e6561724772616469656e742069643d2270222078313d2230222078323d22313131222079313d223330222079323d22323022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f702073746f702d636f6c6f723d222346463542393922206f66667365743d22313025222f3e3c73746f702073746f702d636f6c6f723d222346463534343722206f66667365743d22323025222f3e3c73746f702073746f702d636f6c6f723d222346463742323122206f66667365743d22343025222f3e3c73746f702073746f702d636f6c6f723d222345414643333722206f66667365743d22363025222f3e3c73746f702073746f702d636f6c6f723d222334464342364222206f66667365743d22383025222f3e3c73746f702073746f702d636f6c6f723d222335314637464522206f66667365743d2231303025222f3e3c2f6c696e6561724772616469656e743e"
 );
 txn.wait();
 sleep(10000);

 console.log("Construction completed!");
 

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
