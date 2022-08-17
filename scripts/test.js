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
    "0xE592427A0AEce92De3Edee1F18E0157C05861564"
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

  

  const accounts = await ethers.getSigners();
  console.log("*************************************")
      console.log("Balance of ETH :",await hre.ethers.provider.getBalance(accounts[0].address));
  let txn;
  //    Proposing
  txn = await WavePortal7.wave(
    accounts[1].address,
    hre.ethers.utils.parseEther("10"),
    "I love you so much!!!",
    0,
    { value: hre.ethers.utils.parseEther("10") }
  );


  console.log("Proposal has been sent! Gas Cost:---->",txn.gasLimit);

  txn = await WavePortal7.connect(accounts[1]).approvals(
    "I love you too",
    1,
    0
  );

  console.log("Proposal has been accepted");



  txn = await WavePortal7.checkMarriageStatus();

  console.log("Marriage Status:", txn.marriageContract);

  const instance = await WaverImplementation.attach(txn.marriageContract);

  expect(await hre.ethers.provider.getBalance(instance.address)).to.equal(
    hre.ethers.utils.parseEther("9.9")
  );

  
  txn = await WavePortal7.NftMinted(instance.address);
  console.log("NFT Status:", txn);

  txn = await WavePortal7.MintCertificate(101, 0, 0, {
    value: hre.ethers.utils.parseEther("1"),
  });

  txn = await nftContract.nftHolders(accounts[0].address, accounts[1].address);
  console.log("Your NFT ID is", txn.toNumber());
   const txn2 = await nftContract.tokenURI(txn.toNumber());
   console.log("Your NFT URI is", txn2); 

  //  Checking Buying of LOV tokens
 
  txn = await WavePortal7.buyLovToken({ value: hre.ethers.utils.parseEther("1") });
  expect(await WavePortal7.balanceOf(accounts[0].address)).to.equal(
    hre.ethers.utils.parseEther("150")
  );
  expect(await WavePortal7.saleCap()).to.equal(
    hre.ethers.utils.parseEther("800")
  );


  txn = await WavePortal7.claimToken();
  expect(await WavePortal7.balanceOf(accounts[0].address)).to.equal(
    hre.ethers.utils.parseEther("199.5")
  );

  // txn = await WavePortal7.connect(accounts[3]).claimToken(1);
  

 txn = await instance.addstake({ value: hre.ethers.utils.parseEther("1") })
 console.log("*************************************")
 console.log("Balance of ETH :",await hre.ethers.provider.getBalance(instance.address));

  expect(await hre.ethers.provider.getBalance(instance.address)).to.equal(
    hre.ethers.utils.parseEther("10.89")
  );

  txn = await WavePortal7.checkMarriageStatus();
  console.log("Marriage Status", txn);
  
  txn = await instance.createProposal("test1", 1,1,1, hre.ethers.utils.parseEther("100"),"0x0000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000",0,1);
  expect(await WavePortal7.balanceOf(accounts[0].address)).to.equal(
    hre.ethers.utils.parseEther("99.5")
  );

 

  txn = await instance.createProposal("test2", 2,1,1, hre.ethers.utils.parseEther("1"),accounts[2].address,"0x0000000000000000000000000000000000000000",hre.ethers.utils.parseEther("1"),1);
  expect(await WavePortal7.balanceOf(accounts[0].address)).to.equal(
    hre.ethers.utils.parseEther("98.5") );
   
    txn = await instance.getVotingStatuses(1);
    console.log("Voting Status", txn);

    txn = await WavePortal7.connect(accounts[1]).claimToken();
    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("104.45")
    );

    txn = await instance.connect(accounts[1]).voteResponse(1,hre.ethers.utils.parseEther("1"), 2,1);
    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("103.45") );
     


      txn = await instance.connect(accounts[1]).voteResponse(2,hre.ethers.utils.parseEther("2"), 2,1);
      expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
        hre.ethers.utils.parseEther("101.45") );
      
        txn = await instance.getVotingStatuses(1);
        console.log("Voting Status", txn)          
        
        var balance = await hre.ethers.provider.getBalance(instance.address);
        console.log("Contract Balance before transfer",hre.ethers.utils.formatEther(balance))
        console.log("Balance before",await hre.ethers.provider.getBalance(accounts[2].address))
        txn = await instance.connect(accounts[1]).executeVoting(2,1,0);
        balance = await hre.ethers.provider.getBalance(instance.address);
        console.log("Contract Balance after transfer",hre.ethers.utils.formatEther(balance))
    
       // expect(await hre.ethers.provider.getBalance(accounts[2].address)).to.equal(
         //   hre.ethers.utils.parseEther("10002.97")
          // );
          expect(await hre.ethers.provider.getBalance(instance.address)).to.equal(
            hre.ethers.utils.parseEther("10.89")
          ); 

    txn = await WavePortal7.connect(accounts[0]).transfer(instance.address,hre.ethers.utils.parseEther("10"));
    expect(await WavePortal7.balanceOf(instance.address)).to.equal(
        hre.ethers.utils.parseEther("10") );

    
      txn = await nftContract.connect(accounts[0]).transferFrom(accounts[0].address, instance.address, 1);
      expect(await nftContract.ownerOf(1)).to.equal(instance.address);


// Sending ERC20 Token 
   txn = await instance.createProposal("test3", 2,1,0, hre.ethers.utils.parseEther("1"),accounts[2].address,WavePortal7.address,hre.ethers.utils.parseEther("5"),1);
   console.log(await instance.connect(accounts[1]).getVotingStatuses(1))
   txn = await instance.connect(accounts[1]).voteResponse(3,hre.ethers.utils.parseEther("1"), 2,1);
    txn = await instance.connect(accounts[1]).executeVoting(3,1,0);
    expect(await WavePortal7.balanceOf(accounts[2].address)).to.equal(
       hre.ethers.utils.parseEther("4.95") );

      console.log(await instance.connect(accounts[1]).getVotingStatuses(1)) 

// Sending ERC721 Token 
    txn = await instance.createProposal("test4", 5,1,0, hre.ethers.utils.parseEther("1"),accounts[2].address,nftContract.address,1,1);
      console.log(await instance.connect(accounts[1]).getVotingStatuses(1))
      // txn = await instance.connect(accounts[0]).cancelVoting(4,1);
      console.log(await instance.connect(accounts[1]).getVotingStatuses(1)) 

      txn = await instance.connect(accounts[1]).voteResponse(4,hre.ethers.utils.parseEther("1"), 2,1);
       txn = await instance.connect(accounts[1]).executeVoting(4,1,0);
       expect(await nftContract.ownerOf(1)).to.equal(accounts[2].address);
         

      txn = await instance.connect(accounts[1]).addFamilyMember(accounts[2].address,1);
      txn = await WavePortal7.connect(accounts[2]).joinFamily(true);

      txn = await WavePortal7.connect(accounts[2]).claimToken();
      console.log("Balance of:",accounts[2].address, await WavePortal7.balanceOf(accounts[2].address) )
 
      txn = await instance.connect(accounts[1]).addFamilyMember(accounts[3].address,1);
      txn = await WavePortal7.connect(accounts[3]).joinFamily(true);
      txn = await WavePortal7.connect(accounts[3]).claimToken();
      console.log("Balance of:",accounts[3].address, await WavePortal7.balanceOf(accounts[3].address) )
      
      txn = await instance.connect(accounts[1]).addFamilyMember(accounts[4].address,1);
      txn = await WavePortal7.connect(accounts[4]).joinFamily(true);
      txn = await WavePortal7.connect(accounts[4]).claimToken();
      console.log("Balance of:",accounts[4].address, await WavePortal7.balanceOf(accounts[4].address) )

      txn = await instance.connect(accounts[1]).addFamilyMember(accounts[5].address,1);
      txn = await WavePortal7.connect(accounts[5]).joinFamily(true);
      txn = await WavePortal7.connect(accounts[5]).claimToken();
      console.log("Balance of:",accounts[5].address, await WavePortal7.balanceOf(accounts[5].address) )
      
      txn = await instance.connect(accounts[1]).addFamilyMember(accounts[6].address,1);
      txn = await WavePortal7.connect(accounts[6]).joinFamily(true);
      txn = await WavePortal7.connect(accounts[6]).claimToken();
      console.log("Balance of:",accounts[6].address, await WavePortal7.balanceOf(accounts[6].address) )
 
     
      txn = await instance.createProposal("test5", 1,1,0, hre.ethers.utils.parseEther("1"),"0x0000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000",0,1);
      txn = await instance.connect(accounts[1]).voteResponse(5,hre.ethers.utils.parseEther("1"), 2,1);
      txn = await instance.connect(accounts[2]).voteResponse(5,hre.ethers.utils.parseEther("1"), 3,1);
      txn = await instance.connect(accounts[3]).voteResponse(5,hre.ethers.utils.parseEther("1"), 2,1);
      txn = await instance.connect(accounts[4]).voteResponse(5,hre.ethers.utils.parseEther("1"), 2,1);
      txn = await instance.connect(accounts[5]).voteResponse(5,hre.ethers.utils.parseEther("1"), 2,1);
      txn = await instance.connect(accounts[6]).voteResponse(5,hre.ethers.utils.parseEther("1"), 3,1);
      console.log(await instance.connect(accounts[1]).getVotingStatuses(1)) 
     

      

      txn = await instance.createProposal("test6", 1,1,0, hre.ethers.utils.parseEther("1"),"0x0000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000",0,1);
      txn = await instance.connect(accounts[1]).deleteFamilyMember(accounts[2].address,1);
      txn = await instance.connect(accounts[1]).voteResponse(6,hre.ethers.utils.parseEther("0.1"), 2,1);
      txn = await instance.connect(accounts[3]).voteResponse(6,hre.ethers.utils.parseEther("0.1"), 2,1);
      txn = await instance.connect(accounts[4]).voteResponse(6,hre.ethers.utils.parseEther("0.1"), 3,1);
      txn = await instance.connect(accounts[5]).voteResponse(6,hre.ethers.utils.parseEther("0.1"), 3,1);
      txn = await instance.connect(accounts[6]).voteResponse(6,hre.ethers.utils.parseEther("0.1"), 2,1);
      txn = await instance.endVotingByTime(6,1);
      console.log(await instance.connect(accounts[1]).getVotingStatuses(1)) 

      console.log("*************************************")
      
      console.log("Balance of:",accounts[2].address, await WavePortal7.balanceOf(accounts[2].address) )
      console.log("Balance of:",accounts[3].address, await WavePortal7.balanceOf(accounts[3].address) )
      console.log("Balance of:",accounts[4].address, await WavePortal7.balanceOf(accounts[4].address) )
      console.log("Balance of:",accounts[5].address, await WavePortal7.balanceOf(accounts[5].address) )
      console.log("Balance of:",accounts[6].address, await WavePortal7.balanceOf(accounts[6].address) ) 
      
      console.log("*************************************")
     
      txn = await WavePortal7.changePolicy(1);
      console.log("policy changed")

      txn = await instance.createProposal("test7", 4,1,0, hre.ethers.utils.parseEther("10"),"0x0000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000",0,1);
      console.log("Divorce initiated ")
      txn = await WavePortal7.connect(accounts[0]).transfer(instance.address,hre.ethers.utils.parseEther("10"));
      console.log("LOVE sent ")
      
      txn = await instance.connect(accounts[1]).voteResponse(7,hre.ethers.utils.parseEther("10"), 2,1);
      txn = await instance.endVotingByTime(7,1);
      
      console.log("*************************************")
      console.log("Balance of LOV :",accounts[0].address, await WavePortal7.balanceOf(accounts[0].address) )
      console.log("Balance of LOV:",accounts[1].address, await WavePortal7.balanceOf(accounts[1].address) )
      console.log("Balance of LOV:",instance.address, await WavePortal7.balanceOf(instance.address) )
      console.log("*************************************")
      console.log("Balance of ETH :",await hre.ethers.provider.getBalance(accounts[0].address));
      console.log("Balance of ETH :",await hre.ethers.provider.getBalance(accounts[1].address));
      console.log("Balance of ETH :",await hre.ethers.provider.getBalance(instance.address));
      console.log("=====================================")
      
      console.log(await instance.connect(accounts[1]).getVotingStatuses(1)) 

      txn = await nftContract.connect(accounts[2]).transferFrom(accounts[2].address, instance.address, 1);
      expect(await nftContract.ownerOf(1)).to.equal(instance.address);

      console.log("Checkpoint 1 *****")

      txn = await instance.connect(accounts[0]).executeVoting(7,1,0);
      
      console.log("=====================================")
      console.log("Balance of ETH :",await hre.ethers.provider.getBalance(accounts[0].address));
      console.log("Balance of ETH :",await hre.ethers.provider.getBalance(accounts[1].address));
      console.log("Balance of ETH :",await hre.ethers.provider.getBalance(instance.address));
      console.log("=====================================")

      txn = await instance.withdrawERC20(WavePortal7.address);
      console.log("Balance of LOV :",accounts[0].address, await WavePortal7.balanceOf(accounts[0].address) )
      console.log("Balance of LOV:",accounts[1].address, await WavePortal7.balanceOf(accounts[1].address) )
      console.log("Balance of LOV:",instance.address, await WavePortal7.balanceOf(instance.address) )
      console.log("*************************************")
      txn = await nftContract.nftHolders(accounts[0].address, accounts[1].address);
      console.log("Your NFT ID is", txn.toNumber());
      
      txn8 = await nftContract.tokenURI(txn.toNumber());
      console.log("Your NFT URI is", txn8);

      txn = await instance.SplitNFT(nftContract.address,1,"{first,", "second}");
      txn = await  nftSplit.uri(1); 
      console.log("Your NFT URI is", txn);

      txn = await nftSplit.connect(accounts[1]).balanceOf(accounts[1].address,1);
      console.log("Balance 1155", txn);


      txn = await nftSplit.connect(accounts[1]).safeTransferFrom(accounts[1].address,accounts[0].address,1,1,0);
      txn = await nftSplit.connect(accounts[1]).balanceOf(accounts[1].address,1);
      console.log("Balance 1155", txn);
      txn = await nftSplit.connect(accounts[0]).balanceOf(accounts[0].address,1);
      console.log("Balance 1155", txn);

      txn = await nftSplit.connect(accounts[0]).joinNFT(1);
      txn = await nftSplit.connect(accounts[0]).balanceOf(accounts[0].address,1);
      console.log("Balance 1155", txn);
      expect(await nftContract.ownerOf(1)).to.equal(accounts[0].address);



      
    

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