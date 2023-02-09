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

  it("Family Members can create proposals --> LOVE tokens decrease", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = instance
      .connect(accounts[4])
      .createProposal(
        "test1",
        1,
   
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0
      );
    txn = instance
      .connect(accounts[5])
      .createProposal(
        "test2",
        1,

        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0
      );
    expect(await WavePortal7.balanceOf(accounts[4].address)).to.equal(
      hre.ethers.utils.parseEther("147.5")
    );

    expect(await WavePortal7.balanceOf(accounts[5].address)).to.equal(
      hre.ethers.utils.parseEther("147.5")
    );

    txn = await instance.getVotingStatuses(1);
    expect(txn.length).to.equal(2);
  });

  it("Family Members can create and cancel proposals at initial stage", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[4])
      .createProposal(
        "test1",
        1,

        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0
      );
    txn = await instance.connect(accounts[4]).cancelVoting(1);

    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteStatus).to.equal(4);
  });

  it("Family Members can not end voting after deadline", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[5])
      .createProposal(
        "test1",
        1,
        parseInt(Date.now()/1000) + 1000,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0
      );
    await mine(1000);
    await expect(
      instance
        .connect(accounts[5])
        .endVotingByTime(1)
    ).to.reverted;
    
    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteStatus).to.equal(1);
  });

  it("Family Member cannot vote again on the same proposal", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "test1",
        1,
  
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0
      );
    txn = instance
      .connect(accounts[5])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 1);
    await expect(
      instance
        .connect(accounts[5])
        .voteResponse(1, hre.ethers.utils.parseEther("100"), 2)
    ).to.reverted;
  });

  it("Family Members can vote against the proposal with less or equal LOVE tokens --> Love Tokens decrease --> Vote status accepted", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "test1",
        1,
      
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0
      );
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1);
    txn = instance
      .connect(accounts[4])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1);
    txn = instance
      .connect(accounts[5])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1);

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("237.5")
    );
    expect(await WavePortal7.balanceOf(accounts[4].address)).to.equal(
      hre.ethers.utils.parseEther("237.5")
    );
    expect(await WavePortal7.balanceOf(accounts[5].address)).to.equal(
      hre.ethers.utils.parseEther("237.5")
    );

    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteStatus).to.equal(2);
  });

  it("Vote is in `proposed` state if not everyone voted", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "test1",
        1,

        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0
      );
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1);
    txn = instance
      .connect(accounts[4])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1);

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("237.5")
    );
    expect(await WavePortal7.balanceOf(accounts[4].address)).to.equal(
      hre.ethers.utils.parseEther("237.5")
    );
    expect(await WavePortal7.balanceOf(accounts[5].address)).to.equal(
      hre.ethers.utils.parseEther("247.5")
    );

    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteStatus).to.equal(1);
  });

  it("Vote is in `declined` state if Tokens against exceed that of for", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "test1",
        1,

        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0      );
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("50"), 2);
    txn = instance
      .connect(accounts[4])
      .voteResponse(1, hre.ethers.utils.parseEther("50"), 1);
    txn = instance
      .connect(accounts[5])
      .voteResponse(1, hre.ethers.utils.parseEther("210"), 1);

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("197.5")
    );
    expect(await WavePortal7.balanceOf(accounts[4].address)).to.equal(
      hre.ethers.utils.parseEther("197.5")
    );
    expect(await WavePortal7.balanceOf(accounts[5].address)).to.equal(
      hre.ethers.utils.parseEther("37.5")
    );

    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteStatus).to.equal(3);
  });

  it("Family member cannot propose divorce of partners even after cooldown", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    await mine(1000);
    await expect(
      instance
        .connect(accounts[5])
        .createProposal(
          "Divorce",
          4,

          1,
          hre.ethers.utils.parseEther("100"),
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          0
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
        "Send ETH",
        3,
        1,
        hre.ethers.utils.parseEther("100"),
        accounts[3].address,
        "0x0000000000000000000000000000000000000000",
        hre.ethers.utils.parseEther("5")
      );
    txn = await instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 2);
    txn = await instance
      .connect(accounts[4])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 2);
    txn = await instance
      .connect(accounts[5])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 2);
    await expect(
      await instance.connect(accounts[4]).executeVoting(1)
    ).to.changeEtherBalances(
      [instance, WavePortal7, accounts[3]],
      [
        hre.ethers.utils.parseEther("-5"),
        hre.ethers.utils.parseEther("0.05"),
        hre.ethers.utils.parseEther("4.95"),
      ]
    );
  });
});
