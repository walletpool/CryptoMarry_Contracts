/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const {
  loadFixture,
  mine,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { deployTest } = require('../scripts/deployForTest');


describe("Testing voting interactions", function () {
  async function deployTokenFixture() {
    const {WavePortal7, WaverImplementation,nftContract,accounts, nftSplit}  = await deployTest();
    
    let txn;
    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.connect(accounts[1]).response("Yes", 1, 0);

    txn = await WavePortal7.checkMarriageStatus();

    const instance = await WaverImplementation.attach(txn.marriageContract);

    txn = await WavePortal7.connect(accounts[0]).claimToken();
    txn = await WavePortal7.connect(accounts[1]).claimToken();

    return { WavePortal7, instance, accounts, nftContract };
  }

  it("Third parties cannot create voting proposal", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    await expect(
      instance
        .connect(accounts[2])
        .createProposal(
          "test1",
          1,
          1,
          1,
          hre.ethers.utils.parseEther("100"),
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          0,
          1
        )
    ).to.reverted;
  });

  it("Partners can create proposals --> LOVE tokens decrease", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = instance
      .connect(accounts[0])
      .createProposal(
        "test1",
        1,
        1,
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        1
      );
    txn = instance
      .connect(accounts[1])
      .createProposal(
        "test2",
        1,
        1,
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        1
      );
    expect(await WavePortal7.balanceOf(accounts[0].address)).to.equal(
      hre.ethers.utils.parseEther("395")
    );

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("395")
    );

    txn = await instance.getVotingStatuses(1);

    expect(txn.length).to.equal(2);
  });

  it("Partners can create and cancel proposals at proposed stage", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "test1",
        1,
        1,
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        1
      );
    txn = await instance.connect(accounts[0]).cancelVoting(1, 0);

    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteStatus).to.equal(4);
  });

  it("Non-initiators cannot cancel voting", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "test1",
        1,
        1,
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        1
      );
    await expect(instance.connect(accounts[1]).cancelVoting(1, 0)).to.reverted;
    await expect(instance.connect(accounts[2]).cancelVoting(1, 0)).to.reverted;
  });

  it("Initiator cannot vote for its proposal again", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "test1",
        1,
        1,
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        1
      );
    await expect(
      instance
        .connect(accounts[0])
        .voteResponse(1, hre.ethers.utils.parseEther("100"), 2, 0)
    ).to.reverted;
    await expect(
      instance
        .connect(accounts[0])
        .voteResponse(1, hre.ethers.utils.parseEther("100"), 1, 0)
    ).to.reverted;
  });

  it("Partner can vote for the proposal --> Love Tokens decrease --> Vote status change", async function () {
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
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        1
      );
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 2, 0);

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("395")
    );

    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteStatus).to.equal(2);
  });
  it("Partner cannot vote again on the same proposal", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "test1",
        1,
        1,
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        1
      );
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 1, 0);
    await expect(
      instance
        .connect(accounts[1])
        .voteResponse(1, hre.ethers.utils.parseEther("100"), 2, 0)
    ).to.reverted;
  });

  it("Partner can vote against the proposal with less or equal LOVE tokens --> Love Tokens decrease --> Vote status accepted", async function () {
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
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        1
      );
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 1, 0);

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("395")
    );

    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteStatus).to.equal(2);
  });

  it("Partner can vote against the proposal with more LOVE tokens --> Love Tokens decrease --> Vote status declined", async function () {
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
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        1
      );
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("101"), 1, 0);

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("394")
    );

    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteStatus).to.equal(3);
  });

  it("Initiator cannot end voting before deadline", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "test1",
        1,
        1000,
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        1
      );
    await expect(instance.connect(accounts[0]).endVotingByTime(1, 0)).to
      .reverted;
  });

  it("Initiator can end voting after deadline", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "test1",
        1,
        1000,
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        1
      );
    await mine(1000);
    txn = instance.connect(accounts[0]).endVotingByTime(1, 0);
    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteStatus).to.equal(2);
  });

  it("Partner cannot propose divorce before cooldown", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    await expect(
      instance
        .connect(accounts[0])
        .createProposal(
          "Divorce",
          4,
          1,
          1,
          hre.ethers.utils.parseEther("100"),
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          0,
          1
        )
    ).to.reverted;
  });

  it("Partner can propose divorce after cooldown", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    await mine(1000);
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "Divorce",
        4,
        1,
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        1
      );
    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteType).to.equal(4);
  });

  it("ETH can be sent from the contract", async function () {
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
        1,
        hre.ethers.utils.parseEther("100"),
        accounts[3].address,
        "0x0000000000000000000000000000000000000000",
        hre.ethers.utils.parseEther("5"),
        1
      );
    txn = await instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 2, 0);
    await expect(
      await instance.connect(accounts[0]).executeVoting(1, 0, 0)
    ).to.changeEtherBalances(
      [instance, WavePortal7, accounts[3]],
      [
        hre.ethers.utils.parseEther("-5"),
        hre.ethers.utils.parseEther("0.05"),
        hre.ethers.utils.parseEther("4.95"),
      ]
    );
  });

  it("ETH cannot be sent from the contract if amount exceeds balance", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "Send ETH",
        3,
        1,
        1,
        hre.ethers.utils.parseEther("100"),
        accounts[3].address,
        "0x0000000000000000000000000000000000000000",
        hre.ethers.utils.parseEther("15"),
        1
      );
    txn = await instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 2, 0);
    await expect(instance.connect(accounts[0]).executeVoting(1, 0, 0)).to
      .reverted;
  });

  it("ETH cannot be sent if vote has been declined", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "Send ETH",
        3,
        1,
        1,
        hre.ethers.utils.parseEther("100"),
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        hre.ethers.utils.parseEther("5"),
        1
      );
    txn = await instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("101"), 1, 0);
    await expect(instance.connect(accounts[0]).executeVoting(1, 0, 0)).to
      .reverted;
  });

  it("ERC20 cannot be sent from the contract if amount exceeds balance", async function () {
    const { instance, accounts, WavePortal7 } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "Send ERC20",
        2,
        1,
        1,
        hre.ethers.utils.parseEther("100"),
        accounts[3].address,
        WavePortal7.address,
        hre.ethers.utils.parseEther("5"),
        1
      );
    txn = await instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 2, 0);
    await expect(instance.connect(accounts[0]).executeVoting(1, 0, 0)).to
      .reverted;
  });

  it("ERC20 can be sent from the contract", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    await expect(() =>
      WavePortal7.connect(accounts[0]).transfer(
        instance.address,
        hre.ethers.utils.parseEther("50")
      )
    ).to.changeTokenBalances(
      WavePortal7,
      [accounts[0], instance],
      [hre.ethers.utils.parseEther("-50"), hre.ethers.utils.parseEther("50")]
    );
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "Send ERC20",
        2,
        1,
        1,
        hre.ethers.utils.parseEther("100"),
        accounts[3].address,
        WavePortal7.address,
        hre.ethers.utils.parseEther("5"),
        1
      );
    txn = await instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 2, 0);
    await expect(() =>
      instance.connect(accounts[0]).executeVoting(1, 0, 0)
    ).to.changeTokenBalances(
      WavePortal7,
      [instance, WavePortal7, accounts[3]],
      [
        hre.ethers.utils.parseEther("-5"),
        hre.ethers.utils.parseEther("0.05"),
        hre.ethers.utils.parseEther("4.95"),
      ]
    );
  });

  it("NFT cannot be sent from the contract, if proxy does not have it", async function () {
    const { instance, accounts, nftContract } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "Send NFT",
        5,
        1,
        1,
        hre.ethers.utils.parseEther("100"),
        accounts[3].address,
        nftContract.address,
        1,
        1
      );
    txn = await instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 2, 0);
    await expect(instance.connect(accounts[0]).executeVoting(1, 0, 0)).to
      .reverted;
  });

  it("NFT can be sent from the contract ", async function () {
    const { WavePortal7, instance, accounts, nftContract } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.connect(accounts[0]).MintCertificate(0, 0, 0, {
      value: hre.ethers.utils.parseEther("1"),
    });
    txn = await nftContract
      .connect(accounts[0])
      .transferFrom(accounts[0].address, instance.address, 1);
    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "Send NFT",
        5,
        1,
        1,
        hre.ethers.utils.parseEther("100"),
        accounts[3].address,
        nftContract.address,
        1,
        1
      );
    txn = await instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 2, 0);
    txn = await instance.connect(accounts[0]).executeVoting(1, 0, 0);
    await expect(await nftContract.ownerOf(1)).to.be.equal(accounts[3].address);
  });
});
