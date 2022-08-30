/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const { writeFileSync } = require("fs");
const { expect } = require("chai");
 
async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then((f) => f.deployed());
}

async function main() {
  console.log("Construction started.....");
  const accounts = await ethers.getSigners();
  
  const nftViewContract = await deploy(
    "nftview",
    "0x196eC7109e127A353B709a20da25052617295F6f"
  );

  console.log(
    "NFT View Contract deployed:",
    nftViewContract.address,
    nftViewContract.deployTransaction.gasLimit
  );

  const nftContract = await deploy(
    "nftmint2",
    nftViewContract.address
  );

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

  const WaverImplementation = await deploy("WaverImplementation");
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
    "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    accounts[0].address
  );
  console.log(
    "Wave Portal Contract deployed:",
    WavePortal7.address,
    WavePortal7.deployTransaction.gasLimit
  );

  const nftSplit = await deploy(
    "nftSplit",
    WavePortal7.address
  );

  console.log(
    "NFT Split Contract deployed:",
    nftSplit.address,
    nftSplit.deployTransaction.gasLimit
  );


  //    Passing parameters

  await nftViewContract.changenftmainAddress(nftContract.address);
  console.log("NFT Main Address updated");

  await nftViewContract.changeMainAddress(WavePortal7.address);
  console.log("NFT Address updated in View");

  await nftContract.changeMainAddress(WavePortal7.address);
  console.log("NFT Address updated");

  await WaverFactory.changeAddress(WavePortal7.address);
  console.log("Wavefactory Main Address updated");

  await WavePortal7.changeaddressNFTSplit(nftSplit.address);
  console.log("WavePortal Split Address updated");

  await nftViewContract.addheartPatterns(0, "0x3c726563742f3e");
  await nftViewContract.addadditionalGraphics(0, "0x3c726563742f3e");
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
  writeFileSync(
    "deploytest.json",
    JSON.stringify(
      {
        MinimalForwarder: forwarder.address,
        WavePortal: WavePortal7.address,
        nftContract: nftContract.address,
        WaverImplementation: WaverImplementation.address,
        WaverFactory: WaverFactory.address,
      },
      null,
      2
    )
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

  console.log("Proposal has been accepted");


  txn = await WavePortal7.checkMarriageStatus();

  console.log("Marriage Status:", txn.marriageContract);

  const instance = await WaverImplementation.attach(txn.marriageContract);
/*
  expect(await hre.ethers.provider.getBalance(instance.address)).to.equal(
    hre.ethers.utils.parseEther("99")
  );
*/
  
  //  Checking Buying of LOV tokens
 
 
  txn = await WavePortal7.claimToken();
  
 txn = await WavePortal7.connect(accounts[1]).claimToken();
  
 txn = await instance.addstake({ value: hre.ethers.utils.parseEther("100") })
 console.log("*************************************")
 console.log("Balance of ETH :",await hre.ethers.provider.getBalance(instance.address));


  txn = await WavePortal7.checkMarriageStatus();
  console.log("Marriage Status", txn);
  

  txn = await instance.createProposal(
    "Staking ETH", 6,0,0, 
  hre.ethers.utils.parseEther("1"),"0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
  "0x0000000000000000000000000000000000000000", hre.ethers.utils.parseEther("10"),0);
  
  txn = await instance.getVotingStatuses(1);
  console.log("Voting Status", txn);

  txn = await instance.connect(accounts[1]).voteResponse(1,hre.ethers.utils.parseEther("1"),2,0);

  txn = await instance.getVotingStatuses(1);
  console.log("Voting Status 3", txn);

  txn = await instance.connect(accounts[1]).executeVoting(1,0,0);

  const cETH =  await WavePortal7.attach("0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5");

  console.log("Balance cETH", await cETH.balanceOf(instance.address));


  txn = await instance.createProposal(
    "Swapping ETH", 11,0,0, 
  hre.ethers.utils.parseEther("1"),"0xdac17f958d2ee523a2206206994597c13d831ec7",
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", hre.ethers.utils.parseEther("10"),0);
  
  txn = await instance.getVotingStatuses(1);
  console.log("Voting Status 3", txn);

  txn = await instance.connect(accounts[1]).voteResponse(2,hre.ethers.utils.parseEther("1"),2,0);

  txn = await instance.getVotingStatuses(1);
  console.log("Voting Status 3", txn);

  txn = await instance.connect(accounts[1]).executeVoting(2,0,1890);

  const USDT =  await WavePortal7.attach("0xdac17f958d2ee523a2206206994597c13d831ec7");

  console.log("Balance USDT", await USDT.balanceOf(instance.address));


  txn = await instance.createProposal(
    "Staking USDT", 7,0,0, 
  hre.ethers.utils.parseEther("1"),"0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
 "0xdac17f958d2ee523a2206206994597c13d831ec7", 1000000000,0);

  txn = await instance.connect(accounts[1]).voteResponse(3,hre.ethers.utils.parseEther("1"),2,0);

  txn = await instance.getVotingStatuses(1);
  console.log("Voting Status 3", txn);

  txn = await instance.connect(accounts[1]).executeVoting(3,0,0);
  console.log("Balance USDT", await USDT.balanceOf(instance.address));


  const cUSDT =  await WavePortal7.attach("0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9");

  console.log("Balance cUSDT", await cUSDT.balanceOf(instance.address));





  txn = await instance.createProposal(
    "Redeeming cUSDT on compound", 9,0,0, 
  hre.ethers.utils.parseEther("1"),"0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
  "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",cUSDT.balanceOf(instance.address),0);

  console.log("Balance cUSDT", await cUSDT.balanceOf(instance.address));
  console.log("Balance USDT", await USDT.balanceOf(instance.address));
  
  txn = await instance.connect(accounts[1]).voteResponse(4,hre.ethers.utils.parseEther("1"),2,0);

  
txn = await instance.connect(accounts[1]).executeVoting(4,0,0);

console.log("Balance cUSDT", await cUSDT.balanceOf(instance.address));
console.log("Balance USDT", await USDT.balanceOf(instance.address));



txn = await instance.createProposal(
    "Redeeming cETH on compound", 8,0,0, 
  hre.ethers.utils.parseEther("1"),"0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
  "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",cETH.balanceOf(instance.address),0);

  console.log("Balance cETH", await cETH.balanceOf(instance.address));
  console.log("Balance of ETH :",await hre.ethers.provider.getBalance(instance.address));
  
  txn = await instance.connect(accounts[1]).voteResponse(5,hre.ethers.utils.parseEther("1"),2,0);

txn = await instance.connect(accounts[1]).executeVoting(5,0,0);

console.log("Balance cETH", await cETH.balanceOf(instance.address));
console.log("Balance of ETH :",await hre.ethers.provider.getBalance(instance.address));



txn = await instance.createProposal(
    "Swapping ETH", 10,0,0, 
  hre.ethers.utils.parseEther("1"),"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "0xdac17f958d2ee523a2206206994597c13d831ec7",
  USDT.balanceOf(instance.address),0);

  const wETH =  await WavePortal7.attach("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
  
  console.log("Balance USDT", await USDT.balanceOf(instance.address));
  console.log("Balance of ETH :",await hre.ethers.provider.getBalance(instance.address));
  console.log("Balance of wETH :",await wETH.balanceOf(instance.address));

  txn = await instance.connect(accounts[1]).voteResponse(6,hre.ethers.utils.parseEther("1"),2,0);

  txn = await instance.connect(accounts[1]).executeVoting(6,0,hre.ethers.utils.parseEther("9.7"));


  console.log("Balance USDT", await USDT.balanceOf(instance.address));
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