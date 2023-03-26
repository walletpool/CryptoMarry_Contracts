const { ethers } = require("hardhat");

async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then((f) => f.deployed());
}

module.exports = {deployTest: async function deployTest(){
  const accounts = await ethers.getSigners();

  const forwarder = await deploy("MinimalForwarder");


  let WhiteListAddr = [];

 //Deploying Cuts etc... 

 const DiamondCutFacet = await deploy('DiamondCutFacet',forwarder.address);

 const diamondLoupeFacet = await deploy('DiamondLoupeFacet',forwarder.address);
 const CompoundFacet = await deploy('CompoundFacet',forwarder.address);
WhiteListAddr.push({
  ContractAddress: CompoundFacet.address,
  Status: 1
})

 const UniSwapFacet = await deploy('UniSwapFacet', "0xE592427A0AEce92De3Edee1F18E0157C05861564","0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",forwarder.address);
WhiteListAddr.push({
  ContractAddress: UniSwapFacet.address,
  Status: 1
})

  const familyDao = await deploy('FamilyDAOFacet',forwarder.address);
  WhiteListAddr.push({
  ContractAddress:familyDao.address,
  Status: 1
})
 const diamondInit = await deploy('DiamondInit');

 WhiteListAddr.push({
  ContractAddress: diamondInit.address,
  Status: 1
})
 const nftViewContract = await deploy(
   "nftview",
   "0x333Fc8f550043f239a2CF79aEd5e9cF4A20Eb41e"
 );
 const nftContract = await deploy("nftmint2", nftViewContract.address);

 const WaverImplementation = await deploy("WaverIDiamond",forwarder.address, DiamondCutFacet.address,"0xE592427A0AEce92De3Edee1F18E0157C05861564");

 const WaverFactory = await deploy(
   "WaverFactory",
   WaverImplementation.address
 );
 const WavePortal7 = await deploy(
   "WavePortal7",
   forwarder.address,
   nftContract.address,
   WaverFactory.address,
   "0xEC3215C0ba03fA75c8291Ce92ace346589483E26",
   DiamondCutFacet.address
 );


 const nftSplit = await deploy("nftSplit", WavePortal7.address);


 var txn;
 txn =  await nftViewContract.changenftmainAddress(nftContract.address);

 txn = await nftViewContract.changeMainAddress(WavePortal7.address);

 txn = await nftContract.changeMainAddress(WavePortal7.address);

  txn = await WaverFactory.changeAddress(WavePortal7.address);

  txn = await WavePortal7.changeaddressNFT(nftContract.address,nftSplit.address);
  txn = await WavePortal7.whiteListAddr(WhiteListAddr);

  txn =  await nftViewContract.addheartPatterns(0, "0x3c6c696e6561724772616469656e742069643d227022203e3c73746f70206f66667365743d22302522207374796c653d2273746f702d636f6c6f723a20233930363b2073746f702d6f7061636974793a2030222f3e3c2f6c696e6561724772616469656e743e");

  txn = await nftViewContract.addadditionalGraphics(0, "0x3c6c696e6561724772616469656e742069643d227022203e3c73746f70206f66667365743d22302522207374796c653d2273746f702d636f6c6f723a20233930363b2073746f702d6f7061636974793a2030222f3e3c2f6c696e6561724772616469656e743e");

  txn =  await nftViewContract.addcertBackground(
   0,
   "0x3c6c696e6561724772616469656e742069643d274227206772616469656e74556e6974733d277573657253706163654f6e557365272078313d272d392e393525272079313d2733302e333225272078323d273130392e393525272079323d2736392e363825273e3c73746f70206f66667365743d272e343438272073746f702d636f6c6f723d2723433537424646272f3e3c73746f70206f66667365743d2731272073746f702d636f6c6f723d2723333035444646272f3e3c2f6c696e6561724772616469656e743e"
 );

  txn =   await nftViewContract.addcertBackground(
   1001,
   "0x3c6c696e6561724772616469656e742069643d2242222078313d22353025222079313d223025222078323d22353025222079323d2231303025223e3c73746f70206f66667365743d223025222073746f702d636f6c6f723d2223374135464646223e3c616e696d617465206174747269627574654e616d653d2273746f702d636f6c6f72222076616c7565733d22233741354646463b20233031464638393b202337413546464622206475723d2234732220726570656174436f756e743d22696e646566696e697465222f3e3c2f73746f703e3c73746f70206f66667365743d2231303025222073746f702d636f6c6f723d2223303146463839223e3c616e696d617465206174747269627574654e616d653d2273746f702d636f6c6f72222076616c7565733d22233031464638393b20233741354646463b202330314646383922206475723d2234732220726570656174436f756e743d22696e646566696e697465222f3e3c2f73746f703e3c2f6c696e6561724772616469656e743e"
 );

 txn = await nftViewContract.addheartPatterns(
   101,
   "0x3c6c696e6561724772616469656e742069643d2270222078313d2230222078323d22313131222079313d223330222079323d22323022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f702073746f702d636f6c6f723d222346463542393922206f66667365743d22313025222f3e3c73746f702073746f702d636f6c6f723d222346463534343722206f66667365743d22323025222f3e3c73746f702073746f702d636f6c6f723d222346463742323122206f66667365743d22343025222f3e3c73746f702073746f702d636f6c6f723d222345414643333722206f66667365743d22363025222f3e3c73746f702073746f702d636f6c6f723d222334464342364222206f66667365743d22383025222f3e3c73746f702073746f702d636f6c6f723d222335314637464522206f66667365743d2231303025222f3e3c2f6c696e6561724772616469656e743e"
 );

  return { WavePortal7, WaverImplementation,nftContract, accounts,nftSplit, diamondInit, diamondLoupeFacet, DiamondCutFacet , CompoundFacet, forwarder };
}

}