/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')
 
async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then((f) => f.deployed());
}

async function main() {
  console.log("Construction started.....");
  const accounts = await ethers.getSigners();
  
 //Deploying Cuts etc... 

 const DiamondCutFacet = await deploy('DiamondCutFacet');
 const diamondInit = await deploy('DiamondInit');
 const nftViewContract = await deploy(
   "nftview",
   "0x196eC7109e127A353B709a20da25052617295F6f"
 );

 const nftContract = await deploy("nftmint2", nftViewContract.address);

 const forwarder = await deploy("MinimalForwarder");

 const WaverImplementation = await deploy("WaverIDiamond",forwarder.address);

 const WaverFactory = await deploy(
   "WaverFactory",
   WaverImplementation.address
 );

 const WavePortal7 = await deploy(
   "WavePortal7",
   forwarder.address,
   nftContract.address,
   WaverFactory.address,
   DiamondCutFacet.address,
   "0xEC3215C0ba03fA75c8291Ce92ace346589483E26"
 );

 const nftSplit = await deploy("nftSplit", WavePortal7.address);

 //    Passing parameters

 await nftViewContract.changenftmainAddress(nftContract.address);
 await nftViewContract.changeMainAddress(WavePortal7.address);
 await nftContract.changeMainAddress(WavePortal7.address);
 await WaverFactory.changeAddress(WavePortal7.address);
 await WavePortal7.changeaddressNFTSplit(nftSplit.address);

 await nftViewContract.addheartPatterns(0, "0x3c6c696e6561724772616469656e742069643d227022203e3c73746f70206f66667365743d22302522207374796c653d2273746f702d636f6c6f723a20233930363b2073746f702d6f7061636974793a2030222f3e3c2f6c696e6561724772616469656e743e");
 await nftViewContract.addadditionalGraphics(0, "0x3c6c696e6561724772616469656e742069643d227022203e3c73746f70206f66667365743d22302522207374796c653d2273746f702d636f6c6f723a20233930363b2073746f702d6f7061636974793a2030222f3e3c2f6c696e6561724772616469656e743e");
 await nftViewContract.addcertBackground(
   0,
   "0x3c6c696e6561724772616469656e742069643d2242222078313d2230222079313d2230222078323d22333135222079323d2233313022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f702073746f702d636f6c6f723d2223636235656565222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223306364376534222073746f702d6f7061636974793d222e3939222f3e3c2f6c696e6561724772616469656e743e"
 );
 await nftViewContract.addcertBackground(
   1001,
   "0x3c6c696e6561724772616469656e742069643d2242222078313d22353025222079313d223025222078323d22353025222079323d2231303025223e3c73746f70206f66667365743d223025222073746f702d636f6c6f723d2223374135464646223e3c616e696d617465206174747269627574654e616d653d2273746f702d636f6c6f72222076616c7565733d22233741354646463b20233031464638393b202337413546464622206475723d2234732220726570656174436f756e743d22696e646566696e697465222f3e3c2f73746f703e3c73746f70206f66667365743d2231303025222073746f702d636f6c6f723d2223303146463839223e3c616e696d617465206174747269627574654e616d653d2273746f702d636f6c6f72222076616c7565733d22233031464638393b20233741354646463b202330314646383922206475723d2234732220726570656174436f756e743d22696e646566696e697465222f3e3c2f73746f703e3c2f6c696e6561724772616469656e743e"
 );
 await nftViewContract.addheartPatterns(
   101,
   "0x3c6c696e6561724772616469656e742069643d2270222078313d2230222078323d22313131222079313d223330222079323d22323022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f702073746f702d636f6c6f723d222346463542393922206f66667365743d22313025222f3e3c73746f702073746f702d636f6c6f723d222346463534343722206f66667365743d22323025222f3e3c73746f702073746f702d636f6c6f723d222346463742323122206f66667365743d22343025222f3e3c73746f702073746f702d636f6c6f723d222345414643333722206f66667365743d22363025222f3e3c73746f702073746f702d636f6c6f723d222334464342364222206f66667365743d22383025222f3e3c73746f702073746f702d636f6c6f723d222335314637464522206f66667365743d2231303025222f3e3c2f6c696e6561724772616469656e743e"
 );
 
  console.log("*************************************")
      console.log("Balance of ETH :",await hre.ethers.provider.getBalance(accounts[0].address));
  let txn;
  //    Proposing
  txn = await WavePortal7.propose(
    accounts[1].address,
    "I love you so much!!!",
    0,
    { value: hre.ethers.utils.parseEther("100") }
  );


  console.log("Proposal has been sent! Gas Cost:---->",txn.gasLimit);

  txn = await WavePortal7.connect(accounts[1]).response(
    "I love you too",
    1,
    0
  );

  console.log("Proposal has been accepted  ---- >", txn.gasLimit);



  txn = await WavePortal7.checkMarriageStatus();

  console.log("Marriage Status:", txn.marriageContract);

  const instance = await WaverImplementation.attach(txn.marriageContract);

  
  //  Checking Buying of LOV tokens
 
 
  txn = await WavePortal7.claimToken();
  
 txn = await WavePortal7.connect(accounts[1]).claimToken();
  
 txn = await instance.addstake({ value: hre.ethers.utils.parseEther("100") })
 console.log("*************************************")
 console.log("Balance of ETH :",await hre.ethers.provider.getBalance(instance.address));


  txn = await WavePortal7.checkMarriageStatus();
  console.log("Marriage Status", txn);

  console.log('Deploying facets');
  const FacetNames = [
    'DiamondLoupeFacet',
    'CompoundFacet',
    'UniSwapFacet'
  ]
  const cut = []
  for (const FacetName of FacetNames) {
    const Facet = await ethers.getContractFactory(FacetName)
    const facet = await Facet.deploy()
    await facet.deployed()
    console.log(`${FacetName} deployed: ${facet.address}`)
    cut.push({
      facetAddress: facet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet)
    })
  }

  // upgrade diamond with facets
  console.log('')
  console.log('Diamond Cut:', cut)

  const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
  let tx;
  let receipt;
  // call to init function
  let functionCall = diamondInit.interface.encodeFunctionData('init');
  console.log(cut);
  tx = await diamondCut.diamondCut(cut, diamondInit.address, functionCall);
  console.log('Diamond cut tx: ', tx.hash)
  receipt = await tx.wait()
  if (!receipt.status) {
    throw Error(`Diamond upgrade failed: ${tx.hash}`)
  }
  console.log('Completed diamond cut')
  
  txn = await instance.createProposal(
    "Staking ETH", 103,0, 
  hre.ethers.utils.parseEther("1"),"0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
  "0x0000000000000000000000000000000000000000", hre.ethers.utils.parseEther("10"));


  console.log("Voting costs ----> ", txn.gasLimit)
  
  txn = await instance.getVotingStatuses(1);
  console.log("Voting Status", txn);

  txn = await instance.connect(accounts[1]).voteResponse(1,hre.ethers.utils.parseEther("1"),2);

  txn = await instance.getVotingStatuses(1);
  console.log("Voting Status 3", txn);

  const stakeETH = await ethers.getContractAt('CompoundFacet', instance.address);
  txn = await stakeETH.executeInvest(1);
  console.log("INVESTMENT costs ----> ", txn.gasLimit)


  const cETH =  await WavePortal7.attach("0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5");

  console.log("Balance cETH", await cETH.balanceOf(instance.address));


  txn = await instance.createProposal(
    "Swapping ETH", 101,0, 
  hre.ethers.utils.parseEther("1"),"0xdac17f958d2ee523a2206206994597c13d831ec7",
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", hre.ethers.utils.parseEther("10"));
  
  txn = await instance.getVotingStatuses(1);
  console.log("Voting Status 3", txn);

  txn = await instance.connect(accounts[1]).voteResponse(2,hre.ethers.utils.parseEther("1"),2);

  txn = await instance.getVotingStatuses(1);
  console.log("Voting Status 4", txn);

  const swapETH = await ethers.getContractAt('UniSwapFacet', instance.address);
  txn = await swapETH.executeSwap(2,1550,"0xE592427A0AEce92De3Edee1F18E0157C05861564",3000);

  console.log("SWAP costs ----> ", txn.gasLimit)

  const USDT =  await WavePortal7.attach("0xdac17f958d2ee523a2206206994597c13d831ec7");

  console.log("Balance USDT", await USDT.balanceOf(instance.address));


  txn = await instance.createProposal(
    "Staking USDT", 104,0, 
  hre.ethers.utils.parseEther("1"),"0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
 "0xdac17f958d2ee523a2206206994597c13d831ec7", 1000000000);

  txn = await instance.connect(accounts[1]).voteResponse(3,hre.ethers.utils.parseEther("1"),2);

  txn = await instance.getVotingStatuses(1);
  console.log("Voting Status 3", txn);

  const stakeERC = await ethers.getContractAt('CompoundFacet', instance.address);
  await stakeERC.executeInvest(3);


  const cUSDT =  await WavePortal7.attach("0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9");

  console.log("Balance cUSDT", await cUSDT.balanceOf(instance.address));



  txn = await instance.createProposal(
    "Redeeming cUSDT on compound", 106,0, 
  hre.ethers.utils.parseEther("1"),"0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
  "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",cUSDT.balanceOf(instance.address));

  console.log("Balance cUSDT", await cUSDT.balanceOf(instance.address));
  console.log("Balance USDT", await USDT.balanceOf(instance.address));
  
  txn = await instance.connect(accounts[1]).voteResponse(4,hre.ethers.utils.parseEther("1"),2);

  
  const redeemUSDT = await ethers.getContractAt('CompoundFacet', instance.address);
  await redeemUSDT.executeInvest(4);

console.log("Balance cUSDT", await cUSDT.balanceOf(instance.address));
console.log("Balance USDT", await USDT.balanceOf(instance.address));



txn = await instance.createProposal(
    "Redeeming cETH on compound", 105,0, 
  hre.ethers.utils.parseEther("1"),"0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
  "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",cETH.balanceOf(instance.address));

  console.log("Balance cETH", await cETH.balanceOf(instance.address));
  console.log("Balance of ETH :",await hre.ethers.provider.getBalance(instance.address));
  
  txn = await instance.connect(accounts[1]).voteResponse(5,hre.ethers.utils.parseEther("1"),2);

  const redeemETH = await ethers.getContractAt('CompoundFacet', instance.address);
  await redeemETH.executeInvest(5);

console.log("Balance cETH", await cETH.balanceOf(instance.address));
console.log("Balance of ETH :",await hre.ethers.provider.getBalance(instance.address));


txn = await instance.createProposal(
    "Swapping ERC", 103,0, 
  hre.ethers.utils.parseEther("1"),"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "0xdac17f958d2ee523a2206206994597c13d831ec7",
  USDT.balanceOf(instance.address));

  const wETH =  await WavePortal7.attach("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
  
  console.log("Balance USDT", await USDT.balanceOf(instance.address));
  console.log("Balance of ETH :",await hre.ethers.provider.getBalance(instance.address));
  console.log("Balance of wETH :",await wETH.balanceOf(instance.address));

  txn = await instance.connect(accounts[1]).voteResponse(6,hre.ethers.utils.parseEther("1"),2);
  const swapERC = await ethers.getContractAt('UniSwapFacet', instance.address);
  await swapERC.executeSwap(6,hre.ethers.utils.parseEther("9.7"),"0xE592427A0AEce92De3Edee1F18E0157C05861564",3000);


  console.log("Balance USDT", await USDT.balanceOf(instance.address));
  console.log("Balance of ETH :",await hre.ethers.provider.getBalance(instance.address));
  console.log("Balance of wETH :",await wETH.balanceOf(instance.address));

  const withdrawWETH = await ethers.getContractAt('UniSwapFacet', instance.address);
  const balance = await wETH.balanceOf(instance.address)
  console.log(instance.address);
  await withdrawWETH.withdrawWeth(balance,"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
  console.log("Balance of ETH :",await hre.ethers.provider.getBalance(instance.address));
  
  console.log("Balance of wETH :",await wETH.balanceOf(instance.address));

// Checking
}
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}