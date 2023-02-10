/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const {
  loadFixture,
  mine,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { deployTest } = require('../scripts/deployForTest');


describe("Voting with family members", function () {
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
      "0x49206c6f766520796f7520736f206d75636821", 
      "0x49206c6f766520796f7520736f206d75636821", 
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );

    txn = await WavePortal7.connect(accounts[1]).response(1, 0, 1);

    txn = await WavePortal7.checkMarriageStatus(1);

    const instance = await WaverImplementation.attach(txn[0].marriageContract);

    txn = await instance.connect(accounts[0]).createProposal(
      0x7,
      7,
      accounts[4].address,
      "0x0000000000000000000000000000000000000000",
      3,
      false
    )

    txn = await instance.connect(accounts[1]).createProposal(
      0x7,
      7,
      accounts[5].address,
      "0x0000000000000000000000000000000000000000",
      3,
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

    txn = await instance.connect(accounts[0])._claimToken();
    txn = await instance.connect(accounts[1])._claimToken();
    txn = await instance.connect(accounts[4])._claimToken();
    txn = await instance.connect(accounts[5])._claimToken();

    return {
      WavePortal7,
      instance,
      accounts,
      nftContract,
      WaverImplementation,
    };
  }

  it("Family Members can create proposals and they are registered", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[4])
      .createProposal(
        0x1,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        4,
        false
      );
    txn = await instance
      .connect(accounts[5])
      .createProposal(
        0x1,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        4,
        false
      );
    expect(await WavePortal7.balanceOf(accounts[4].address)).to.equal(
      hre.ethers.utils.parseEther("125")
    );

    expect(await WavePortal7.balanceOf(accounts[5].address)).to.equal(
      hre.ethers.utils.parseEther("125")
    );

    txn = await instance.getVotingStatuses(1);
    expect(txn.length).to.equal(4); // two other proposals were created to invite family members.
  });
 
  it("Family Members can cancel voting", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[5])
      .createProposal(
        0x1,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        4,
        false
      );
  
    await expect(
      instance
        .connect(accounts[4])
        .cancelVoting(3)
    ).to.reverted;

    txn = await instance
    .connect(accounts[5])
    .cancelVoting(3)
    
    txn = await instance.getVotingStatuses(1);
    expect(txn[2].voteStatus).to.equal(4);
  });

  it("Family Member cannot vote again on the same proposal", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x1,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        4,
        false
      );
    txn = await instance
      .connect(accounts[5])
      .voteResponse(3, 2, false);

    await expect(
      instance
        .connect(accounts[5])
        .voteResponse(3, 2, false)
    ).to.reverted;
  });

  it("Family Member can vote against the proposal -> but if threshold met Vote is accepted", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x1,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        4,
        false
      );
    txn =await  instance
      .connect(accounts[1])
      .voteResponse(3, 1, false);
    txn =await instance
      .connect(accounts[4])
      .voteResponse(3,2, false);
    txn = await instance
      .connect(accounts[5])
      .voteResponse(3,2, false);

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("125")
    );
    expect(await WavePortal7.balanceOf(accounts[4].address)).to.equal(
      hre.ethers.utils.parseEther("125")
    );
    expect(await WavePortal7.balanceOf(accounts[5].address)).to.equal(
      hre.ethers.utils.parseEther("125")
    );

    txn = await instance.getVotingStatuses(1);
    expect(txn[2].voteStatus).to.equal(2);
  });

  it("Vote is in `proposed` state if not everyone voted", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x1,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        4,
        false
      );
    txn = await instance
      .connect(accounts[4])
      .voteResponse(3,2,true);

    txn = await instance.getVotingStatuses(1);
    expect(txn[2].voteStatus).to.equal(1);
  });

  it("Vote is in `declined` state if threshold is not met", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x1,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        4,
        false      
        );
    txn = await instance
      .connect(accounts[1])
      .voteResponse(3,1, true);
    txn = await instance
      .connect(accounts[4])
      .voteResponse(3,1, true);
    txn = await instance
      .connect(accounts[5])
      .voteResponse(3,2, true);

    txn = await instance.getVotingStatuses(1);
    expect(txn[2].voteStatus).to.equal(3);
  });

  it("Family members cannot propose divorce of partners even after cooldown", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    await mine(10000);
    await expect(
      instance
        .connect(accounts[5])
        .createProposal(
          0x4,
          4,
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          0,
          false
        )
    ).to.reverted;
  });

  it("Family Member can send  ETH (execute voting) thourgh voting", async function () {
    const { instance, accounts, WavePortal7 } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x3,
        3,
        accounts[3].address,
        "0x0000000000000000000000000000000000000000",
        hre.ethers.utils.parseEther("5"),
        false,        
      );
    txn = await instance
      .connect(accounts[1])
      .voteResponse(3,1,false);
    txn = await instance
      .connect(accounts[4])
      .voteResponse(3,2,false);

    await expect(
      await instance
      .connect(accounts[5])
      .voteResponse(3,2,true)
    ).to.changeEtherBalances(
      [instance, WavePortal7, accounts[3]],
      [
        hre.ethers.utils.parseEther("-5"),
        hre.ethers.utils.parseEther("0"),
        hre.ethers.utils.parseEther("5"),
      ]
    );
  });
});
