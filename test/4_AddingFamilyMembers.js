/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const {
  loadFixture,
  mine,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { deployTest } = require('../scripts/deployForTest');


describe("Adding Family Members Testing", function () {
  async function deployTokenFixture() {
    const {WavePortal7, WaverImplementation,nftContract,accounts, nftSplit}  = await deployTest();
    let txn;
    txn = await WavePortal7.propose(
      accounts[1].address,
       "0x49206c6f766520796f7520736f206d75636821", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );

    txn = await WavePortal7.connect(accounts[1]).response(1, 0, 1);

    txn = await WavePortal7.checkMarriageStatus(1);

    const instance = await WaverImplementation.attach(txn[0].marriageContract);

    txn = await instance.connect(accounts[0])._claimToken();
    txn = await instance.connect(accounts[1])._claimToken();

    return {
      WavePortal7,
      instance,
      accounts,
      nftContract,
      WaverImplementation,
    };
  }


  it("Partners cannot propose to invite as a family members themselves", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    await expect(
      instance.connect(accounts[0]).createProposal(
        0x7,
        7,
        accounts[0].address,
        "0x0000000000000000000000000000000000000000",
        0,
        false
      )
  ).to.reverted;
    await expect(
      instance.connect(accounts[1]).createProposal(
        0x7,
        7,
        accounts[0].address,
        "0x0000000000000000000000000000000000000000",
        0,
        false
      )).to.reverted;
    await expect(
      instance.connect(accounts[0]).createProposal(
        0x7,
        7,
        accounts[1].address,
        "0x0000000000000000000000000000000000000000",
        0,
        false
      )).to.reverted;
    await expect(
      instance.connect(accounts[1]).createProposal(
        0x7,
        7,
        accounts[1].address,
        "0x0000000000000000000000000000000000000000",
        0,
        false
      )).to.reverted;
  });

  it("Partners can propose to invite as a family members the ones who are already partners or family members somewhere else in CM", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await WavePortal7.connect(accounts[2]).propose(
      accounts[3].address,
      "0x49206c6f766520796f7520736f206d75636821", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );

    txn = await instance.connect(accounts[1]).createProposal(
      0x7,
      7,
      accounts[2].address,
      "0x0000000000000000000000000000000000000000",
      0,
      false
    )

    txn = await instance.connect(accounts[1]).createProposal(
      0x7,
      7,
      accounts[3].address,
      "0x0000000000000000000000000000000000000000",
      0,
      false
    )
   
  });

  it("Partners can invite a family member through voting", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    let txn;
    txn = await instance.connect(accounts[0]).createProposal(
      0x7,
      7,
      accounts[2].address,
      "0x0000000000000000000000000000000000000000",
      0,
      false
    )

    txn = await instance.connect(accounts[1]).createProposal(
      0x7,
      7,
      accounts[3].address,
      "0x0000000000000000000000000000000000000000",
      0,
      false
    )

    txn = await  instance
      .connect(accounts[1])
      .voteResponse(1, 2, true);

      txn = await  instance
      .connect(accounts[0])
      .voteResponse(2, 2, true);
    

    await expect(await WavePortal7.isMember(accounts[2].address, 1)).to.equal(
      10
    );
    await expect(await WavePortal7.isMember(accounts[3].address, 1)).to.equal(
      10
    );
   
    txn = await WavePortal7.getFamilyMembers(instance.address);
    await expect(txn[0]).to.equal(accounts[2].address);
    await expect(txn[1]).to.equal(accounts[3].address);
  });

  it("Invited family members can decline inviation ", async function () {
    const { WavePortal7, instance, accounts, WaverImplementation } =
      await loadFixture(deployTokenFixture);

    txn = await WavePortal7.connect(accounts[2]).propose(
      accounts[3].address,
      "0x49206c6f766520796f7520736f206d75636821", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );

    txn = await WavePortal7.connect(accounts[3]).response(1, 0, 2);

    txn = await instance.connect(accounts[0]).createProposal(
      0x7,
      7,
      accounts[4].address,
      "0x0000000000000000000000000000000000000000",
      0,
      false
    )

    txn = await instance.connect(accounts[1]).createProposal(
      0x7,
      7,
      accounts[5].address,
      "0x0000000000000000000000000000000000000000",
      0,
      false
    )

    txn = await instance
      .connect(accounts[1])
      .voteResponse(1, 2, true);

      txn = await instance
      .connect(accounts[0])
      .voteResponse(2, 2, true);

 

    txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus(1);

    const instance2 = await WaverImplementation.attach(txn[0].marriageContract);


    txn = await instance2.connect(accounts[2]).createProposal(
      0x7,
      7,
      accounts[6].address,
      "0x0000000000000000000000000000000000000000",
      0,
      false
    )

    txn = await instance2.connect(accounts[3]).createProposal(
      0x7,
      7,
      accounts[7].address,
      "0x0000000000000000000000000000000000000000",
      0,
      false
    )

    txn = await instance2
      .connect(accounts[3])
      .voteResponse(1, 2, true);

      txn = await instance2
      .connect(accounts[2])
      .voteResponse(2, 2, true);

      await expect(await WavePortal7.isMember(accounts[4].address, 1)).to.equal(
        10
      );
      await expect(await WavePortal7.isMember(accounts[5].address, 1)).to.equal(
        10
      );
      
      await expect(await WavePortal7.isMember(accounts[6].address, 2)).to.equal(
        10
      );
      await expect(await WavePortal7.isMember(accounts[7].address, 2)).to.equal(
        10
      );

  
    txn = await WavePortal7.connect(accounts[4]).joinFamily(1,1);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(1,1);
    txn = await WavePortal7.connect(accounts[6]).joinFamily(1,2);
    txn = await WavePortal7.connect(accounts[7]).joinFamily(1,2);

    await expect(await WavePortal7.isMember(accounts[4].address, 1)).to.equal(
      0
    );
    await expect(await WavePortal7.isMember(accounts[5].address, 1)).to.equal(
      0
    );
    
    await expect(await WavePortal7.isMember(accounts[6].address, 2)).to.equal(
      0
    );
    await expect(await WavePortal7.isMember(accounts[7].address, 2)).to.equal(
      0
    );

  });

  it("Invited family members can accept inviation", async function () {
    const { WavePortal7, instance, accounts, WaverImplementation } =
      await loadFixture(deployTokenFixture);

      txn = await WavePortal7.connect(accounts[2]).propose(
        accounts[3].address,
        "0x49206c6f766520796f7520736f206d75636821", 
        0, 
        86400,
        5,
        1,
        {
          value: hre.ethers.utils.parseEther("10"),
        }
      );
  
      txn = await WavePortal7.connect(accounts[3]).response(1, 0, 2);
  
      txn = await instance.connect(accounts[0]).createProposal(
        0x7,
        7,
        accounts[4].address,
        "0x0000000000000000000000000000000000000000",
        10,
        false
      )
  
      txn = await instance.connect(accounts[1]).createProposal(
        0x7,
        7,
        accounts[5].address,
        "0x0000000000000000000000000000000000000000",
        4,
        false
      )
  
      txn = await instance
        .connect(accounts[1])
        .voteResponse(1, 2, true);
  
        txn = await instance
        .connect(accounts[0])
        .voteResponse(2, 2, true);
  
   
  
      txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus(1);
  
      const instance2 = await WaverImplementation.attach(txn[0].marriageContract);
  
  
      txn = await instance2.connect(accounts[2]).createProposal(
        0x7,
        7,
        accounts[6].address,
        "0x0000000000000000000000000000000000000000",
        3,
        false
      )
  
      txn = await instance2.connect(accounts[3]).createProposal(
        0x7,
        7,
        accounts[7].address,
        "0x0000000000000000000000000000000000000000",
        4,
        false
      )
  
      txn = await instance2
        .connect(accounts[3])
        .voteResponse(1, 2, true);
  
        txn = await instance2
        .connect(accounts[2])
        .voteResponse(2, 2, true);
  

    txn = await WavePortal7.connect(accounts[4]).joinFamily(2,1);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(2,1);
    txn = await WavePortal7.connect(accounts[6]).joinFamily(2,2);
    txn = await WavePortal7.connect(accounts[7]).joinFamily(2,2);

    await expect(await WavePortal7.isMember(accounts[4].address, 1)).to.equal(
      3
    );
    await expect(await WavePortal7.isMember(accounts[5].address, 1)).to.equal(
      3
    );
    
    await expect(await WavePortal7.isMember(accounts[6].address, 2)).to.equal(
      3
    );
    await expect(await WavePortal7.isMember(accounts[7].address, 2)).to.equal(
      3
    );

    txn = await WavePortal7.connect(accounts[7]).checkMarriageStatus(1);

    await expect(txn[0].marriageContract).to.equal(
      instance2.address
    );
  });

  it("Partners can invite family members from other families", async function () {
    const { WavePortal7, instance, accounts, WaverImplementation } =
      await loadFixture(deployTokenFixture);

      txn = await WavePortal7.connect(accounts[2]).propose(
        accounts[3].address,
        "0x49206c6f766520796f7520736f206d75636821", 
        0, 
        86400,
        5,
        1,
        {
          value: hre.ethers.utils.parseEther("10"),
        }
      );
  
      txn = await WavePortal7.connect(accounts[3]).response(1, 0, 2);
  
      txn = await instance.connect(accounts[0]).createProposal(
        0x7,
        7,
        accounts[4].address,
        "0x0000000000000000000000000000000000000000",
        10,
        false
      )
  
      txn = await instance.connect(accounts[1]).createProposal(
        0x7,
        7,
        accounts[5].address,
        "0x0000000000000000000000000000000000000000",
        4,
        false
      )
  
      txn = await instance
        .connect(accounts[1])
        .voteResponse(1, 2, true);
  
        txn = await instance
        .connect(accounts[0])
        .voteResponse(2, 2, true);
  
   
  
      txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus(1);
  
      const instance2 = await WaverImplementation.attach(txn[0].marriageContract);
  
  
      txn = await instance2.connect(accounts[2]).createProposal(
        0x7,
        7,
        accounts[4].address,
        "0x0000000000000000000000000000000000000000",
        3,
        false
      )
  
      txn = await instance2.connect(accounts[3]).createProposal(
        0x7,
        7,
        accounts[5].address,
        "0x0000000000000000000000000000000000000000",
        4,
        false
      )
  
      txn = await instance2
        .connect(accounts[3])
        .voteResponse(1, 2, true);
  
        txn = await instance2
        .connect(accounts[2])
        .voteResponse(2, 2, true);
  

    txn = await WavePortal7.connect(accounts[4]).joinFamily(2,1);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(2,1);
    txn = await WavePortal7.connect(accounts[4]).joinFamily(2,2);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(2,2);

    await expect(await WavePortal7.isMember(accounts[4].address, 1)).to.equal(
      3
    );
    await expect(await WavePortal7.isMember(accounts[5].address, 1)).to.equal(
      3
    );
    
    await expect(await WavePortal7.isMember(accounts[4].address, 2)).to.equal(
      3
    );
    await expect(await WavePortal7.isMember(accounts[5].address, 2)).to.equal(
      3
    );

    txn = await WavePortal7.connect(accounts[4]).checkMarriageStatus(1);

    await expect(txn[0].marriageContract).to.equal(
      instance.address);
      await expect(txn[1].marriageContract).to.equal(
        instance2.address);

  });

  it("Partners can invite family members that declined others invitation", async function () {
    const { WavePortal7, instance, accounts, WaverImplementation } =
      await loadFixture(deployTokenFixture);

      txn = await WavePortal7.connect(accounts[2]).propose(
        accounts[3].address,
        "0x49206c6f766520796f7520736f206d75636821", 
        0, 
        86400,
        5,
        1,
        {
          value: hre.ethers.utils.parseEther("10"),
        }
      );
  
      txn = await WavePortal7.connect(accounts[3]).response(1, 0, 2);
  
      txn = await instance.connect(accounts[0]).createProposal(
        0x7,
        7,
        accounts[4].address,
        "0x0000000000000000000000000000000000000000",
        10,
        false
      )
  
      txn = await instance.connect(accounts[1]).createProposal(
        0x7,
        7,
        accounts[5].address,
        "0x0000000000000000000000000000000000000000",
        4,
        false
      )
  
      txn = await instance
        .connect(accounts[1])
        .voteResponse(1, 2, true);
  
        txn = await instance
        .connect(accounts[0])
        .voteResponse(2, 2, true);
  
        txn = await WavePortal7.connect(accounts[4]).joinFamily(1,1);
        txn = await WavePortal7.connect(accounts[5]).joinFamily(1,1);
  
      txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus(1);
  
      const instance2 = await WaverImplementation.attach(txn[0].marriageContract);
  
  
      txn = await instance2.connect(accounts[2]).createProposal(
        0x7,
        7,
        accounts[4].address,
        "0x0000000000000000000000000000000000000000",
        3,
        false
      )
  
      txn = await instance2.connect(accounts[3]).createProposal(
        0x7,
        7,
        accounts[5].address,
        "0x0000000000000000000000000000000000000000",
        4,
        false
      )
  
      txn = await instance2
        .connect(accounts[3])
        .voteResponse(1, 2, true);
  
        txn = await instance2
        .connect(accounts[2])
        .voteResponse(2, 2, true);
  

   
    txn = await WavePortal7.connect(accounts[4]).joinFamily(2,2);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(2,2);

    await expect(await WavePortal7.isMember(accounts[4].address, 1)).to.equal(
      0
    );
    await expect(await WavePortal7.isMember(accounts[5].address, 1)).to.equal(
      0
    );
    
    await expect(await WavePortal7.isMember(accounts[4].address, 2)).to.equal(
      3
    );
    await expect(await WavePortal7.isMember(accounts[5].address, 2)).to.equal(
      3
    );

    txn = await WavePortal7.connect(accounts[4]).checkMarriageStatus(1);

    await expect(txn[0].marriageContract).to.equal(
      instance2.address);
  });

  it("Invited Family Members cannot claim LOVE token before joining", async function () {
    const { WavePortal7, instance, accounts, WaverImplementation } =
      await loadFixture(deployTokenFixture);

      txn = await instance.connect(accounts[0]).createProposal(
        0x7,
        7,
        accounts[4].address,
        "0x0000000000000000000000000000000000000000",
        10,
        false
      )
  
      txn = await instance.connect(accounts[1]).createProposal(
        0x7,
        7,
        accounts[5].address,
        "0x0000000000000000000000000000000000000000",
        4,
        false
      )
  
      txn = await instance
        .connect(accounts[1])
        .voteResponse(1, 2, true);
  
        txn = await instance
        .connect(accounts[0])
        .voteResponse(2, 2, true);

   

    await expect(instance.connect(accounts[4])._claimToken()).to.reverted;
    await expect(instance.connect(accounts[5])._claimToken()).to.reverted;
  });

  it("Invited Family Members can claim LOVE token after joining", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await instance.connect(accounts[0]).createProposal(
      0x7,
      7,
      accounts[4].address,
      "0x0000000000000000000000000000000000000000",
      10,
      false
    )

    txn = await instance.connect(accounts[1]).createProposal(
      0x7,
      7,
      accounts[5].address,
      "0x0000000000000000000000000000000000000000",
      4,
      false
    )

    txn = await instance
      .connect(accounts[1])
      .voteResponse(1, 2, true);

      txn = await instance
      .connect(accounts[0])
      .voteResponse(2, 2, true);

      txn = await WavePortal7.connect(accounts[4]).joinFamily(2,1);
      txn = await WavePortal7.connect(accounts[5]).joinFamily(2,1);


  await instance.connect(accounts[4])._claimToken();
  await instance.connect(accounts[5])._claimToken();

    expect(await WavePortal7.balanceOf(accounts[4].address)).to.equal(
      hre.ethers.utils.parseEther("125")
    );

    expect(await WavePortal7.balanceOf(accounts[5].address)).to.equal(
      hre.ethers.utils.parseEther("125")
    );
  });

  it("Invited Family Members can add other members ", async function () {
    const { WavePortal7, instance, accounts, WaverImplementation } =
      await loadFixture(deployTokenFixture);

      txn = await instance.connect(accounts[0]).createProposal(
        0x7,
        7,
        accounts[4].address,
        "0x0000000000000000000000000000000000000000",
        10,
        false
      )
  
      txn = await instance.connect(accounts[1]).createProposal(
        0x7,
        7,
        accounts[5].address,
        "0x0000000000000000000000000000000000000000",
        4,
        false
      )
  
      txn = await instance
        .connect(accounts[1])
        .voteResponse(1, 2, true);
  
        txn = await instance
        .connect(accounts[0])
        .voteResponse(2, 2, true);
  
        txn = await WavePortal7.connect(accounts[4]).joinFamily(2,1);
        txn = await WavePortal7.connect(accounts[5]).joinFamily(2,1);

    txn = await WavePortal7.connect(accounts[4]).checkMarriageStatus(1);

    const instance2 = await WaverImplementation.attach(txn[0].marriageContract);

    await expect(instance2.connect(accounts[4]).createProposal(
      0x7,
      7,
      accounts[4].address,
      "0x0000000000000000000000000000000000000000",
      10,
      false
    )).to.reverted

    await expect(instance2.connect(accounts[5]).createProposal(
      0x7,
      7,
      accounts[5].address,
      "0x0000000000000000000000000000000000000000",
      4,
      false
    )).to.reverted

    txn = await instance2.connect(accounts[4]).createProposal(
      0x7,
      7,
      accounts[6].address,
      "0x0000000000000000000000000000000000000000",
      10,
      false
    )

    txn = await instance2.connect(accounts[5]).createProposal(
      0x7,
      7,
      accounts[7].address,
      "0x0000000000000000000000000000000000000000",
      4,
      false
    )
   
  });

  it("Partners can delete invited and inviation accepted members. Deleted members lose access to proxy", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await instance.connect(accounts[0]).createProposal(
      0x7,
      7,
      accounts[4].address,
      "0x0000000000000000000000000000000000000000",
      2,
      false
    )

    txn = await instance.connect(accounts[1]).createProposal(
      0x7,
      7,
      accounts[5].address,
      "0x0000000000000000000000000000000000000000",
      2,
      false
    )

    txn = await instance
      .connect(accounts[1])
      .voteResponse(1, 2, true);

      txn = await instance
      .connect(accounts[0])
      .voteResponse(2, 2, true);

      txn = await WavePortal7.connect(accounts[5]).joinFamily(2,1);

      txn = await instance.connect(accounts[0]).createProposal(
        0x7,
        8,
        accounts[4].address,
        "0x0000000000000000000000000000000000000000",
        2,
        false
      )
  
      txn = await instance.connect(accounts[1]).createProposal(
        0x7,
        8,
        accounts[5].address,
        "0x0000000000000000000000000000000000000000",
        2,
        false
      )
  
      txn = await instance
        .connect(accounts[1])
        .voteResponse(3, 2, true);
  
        txn = await instance
        .connect(accounts[0])
        .voteResponse(4, 2, true);

        await expect(await WavePortal7.isMember(accounts[5].address, 1)).to.equal(
          0
        );

        await expect(await WavePortal7.isMember(accounts[4].address, 1)).to.equal(
          0
        );

  });

  it("Threshold can be is changed through proposal", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await instance.connect(accounts[0]).createProposal(
      0x7,
      7,
      accounts[4].address,
      "0x0000000000000000000000000000000000000000",
      4,
      false
    )

    txn = await instance.connect(accounts[1]).createProposal(
      0x7,
      7,
      accounts[5].address,
      "0x0000000000000000000000000000000000000000",
      4,
      false
    )

    txn = await instance
      .connect(accounts[1])
      .voteResponse(1, 2, true);

      txn = await instance
      .connect(accounts[0])
      .voteResponse(2, 2, true);

      txn = await WavePortal7.connect(accounts[5]).joinFamily(2,1);
      txn = await WavePortal7.connect(accounts[4]).joinFamily(2,1);

      txn = await instance.connect(accounts[0]).createProposal(
        0x7,
        9,
        accounts[4].address,
        "0x0000000000000000000000000000000000000000",
        2,
        false
      )
    
      txn = await instance
        .connect(accounts[1])
        .voteResponse(3, 2, true);
  
    
        txn = await instance
        .connect(accounts[5])
        .voteResponse(3, 2, true);
  
        txn = await instance
        .connect(accounts[4])
        .voteResponse(3, 2, true);
        txn= await instance.getPolicies()
        await expect(txn.threshold).to.equal(
          2
        );
  });

  it("Partners cannot delete invited members two times ", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await instance.connect(accounts[0]).createProposal(
      0x7,
      7,
      accounts[4].address,
      "0x0000000000000000000000000000000000000000",
      2,
      false
    )

    txn = await instance.connect(accounts[1]).createProposal(
      0x7,
      7,
      accounts[5].address,
      "0x0000000000000000000000000000000000000000",
      2,
      false
    )

    txn = await instance
      .connect(accounts[1])
      .voteResponse(1, 2, true);

      txn = await instance
      .connect(accounts[0])
      .voteResponse(2, 2, true);

      txn = await WavePortal7.connect(accounts[5]).joinFamily(2,1);

      txn = await instance.connect(accounts[0]).createProposal(
        0x7,
        8,
        accounts[4].address,
        "0x0000000000000000000000000000000000000000",
        2,
        false
      )
  
      txn = await instance.connect(accounts[1]).createProposal(
        0x7,
        8,
        accounts[5].address,
        "0x0000000000000000000000000000000000000000",
        2,
        false
      )
  
      txn = await instance
        .connect(accounts[1])
        .voteResponse(3, 2, true);
  
        txn = await instance
        .connect(accounts[0])
        .voteResponse(4, 2, true);

        await expect(await WavePortal7.isMember(accounts[5].address, 1)).to.equal(
          0
        );

        await expect(await WavePortal7.isMember(accounts[4].address, 1)).to.equal(
          0
        );


         await expect( instance.connect(accounts[1]).createProposal(
          0x7,
          8,
          accounts[5].address,
          "0x0000000000000000000000000000000000000000",
          2,
          false
        )).to.reverted;
  });
});
