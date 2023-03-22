/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const {
  loadFixture,
  mine,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { deployTest } = require("../scripts/deployForTest");

describe("Testing voting interactions", function () {
  async function deployTokenFixture() {
    const {
      WavePortal7,
      WaverImplementation,
      nftContract,
      accounts,
      nftSplit,
    } = await deployTest();

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

    return { WavePortal7, instance, accounts, nftContract };
  }
  it("Third parties cannot create voting proposal", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    await expect(
      instance
        .connect(accounts[2])
        .createProposal(
          0x1,
          1,
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          0,
          0,
          false
        )
    ).to.reverted;
  });

  it("Partners can create MultiSig proposals --> LOVE tokens balance do not change", async function () {
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
        0,
        0,
        false
      );
    txn = await instance
      .connect(accounts[1])
      .createProposal(
        0x2,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        0,
        false
      );
    expect(await WavePortal7.balanceOf(accounts[0].address)).to.equal(
      hre.ethers.utils.parseEther("250")
    );

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("250")
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
        0x2,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        0,
        false
      );
    txn = await instance.connect(accounts[0]).cancelVoting(1);

    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteStatus).to.equal(4);
  });

  it("Non-initiators cannot cancel voting", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x2,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        0,
        false
      );
    await expect(instance.connect(accounts[1]).cancelVoting(1)).to.reverted;
    await expect(instance.connect(accounts[2]).cancelVoting(1)).to.reverted;
  });

  it("Initiator cannot vote for its proposal again", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x2,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        0,
        false
      );
    await expect(instance.connect(accounts[0]).voteResponse(1, 2, false)).to
      .reverted;
  });

  it("Partner can vote for the proposal --> Vote status change", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x2,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        0,
        false
      );
    txn = await instance.getVotingStatuses(1);
    txn = await instance.connect(accounts[1]).voteResponse(1, 2, false);

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("250")
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
        0x2,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        0,
        false
      );
    txn = await instance.connect(accounts[1]).voteResponse(1, 2, false);
    await expect(instance.connect(accounts[1]).voteResponse(1, 1, false)).to
      .reverted;
  });

  it("Partner can vote against the proposal--> Threshold is passed --> Vote status accepted", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x2,
        1,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        0,
        false
      );
    txn = await instance.connect(accounts[1]).voteResponse(1, 1, false);

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("250")
    );

    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteStatus).to.equal(2);
  });

  it("Partner cannot propose divorce before cooldown", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    await expect(
      instance
        .connect(accounts[0])
        .createProposal(
          0x4,
          4,
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          0,
          0,
          false
        )
    ).to.reverted;
  });

  it("Partner can propose divorce after cooldown", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    await mine(100000);
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x4,
        4,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        0,
        false
      );
    txn = await instance.getVotingStatuses(1);
    expect(txn[0].voteType).to.equal(4);
  });

  it("ETH can be sent from the contract, executed in three steps", async function () {
    const { instance, accounts, WavePortal7 } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x4,
        3,
        accounts[3].address,
        "0x0000000000000000000000000000000000000000",
        hre.ethers.utils.parseEther("5"),
        0,
        false
      );
    txn = await instance.connect(accounts[1]).voteResponse(1, 2, false);
    await expect(
      await instance.connect(accounts[0]).executeVoting(1)
    ).to.changeEtherBalances(
      [instance, WavePortal7, accounts[3]],
      [
        hre.ethers.utils.parseEther("-5"),
        hre.ethers.utils.parseEther("0"),
        hre.ethers.utils.parseEther("5"),
      ]
    );
  });

  it("ETH can be sent from the contract after proposal has been created and threshold is 1 in one step", async function () {
    const { instance, accounts, WavePortal7 } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await expect(
      await instance
        .connect(accounts[0])
        .createProposal(
          0x4,
          3,
          accounts[3].address,
          "0x0000000000000000000000000000000000000000",
          hre.ethers.utils.parseEther("5"),
          0,
          true
        )
    ).to.changeEtherBalances(
      [instance, WavePortal7, accounts[3]],
      [
        hre.ethers.utils.parseEther("-5"),
        hre.ethers.utils.parseEther("0"),
        hre.ethers.utils.parseEther("5"),
      ]
    );
  });

  it("ETH can be sent from the contract, executed in two steps", async function () {
    const { instance, accounts, WavePortal7 } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x4,
        3,
        accounts[3].address,
        "0x0000000000000000000000000000000000000000",
        hre.ethers.utils.parseEther("5"),
        0,
        false
      );
    await expect(
      await instance.connect(accounts[1]).voteResponse(1, 2, true)
    ).to.changeEtherBalances(
      [instance, WavePortal7, accounts[3]],
      [
        hre.ethers.utils.parseEther("-5"),
        hre.ethers.utils.parseEther("0"),
        hre.ethers.utils.parseEther("5"),
      ]
    );
  });

  it("ETH cannot be sent from the contract if amount exceeds balance", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x4,
        3,
        accounts[3].address,
        "0x0000000000000000000000000000000000000000",
        hre.ethers.utils.parseEther("50"),
        0,
        false
      );
    txn = await instance.connect(accounts[1]).voteResponse(1, 2, false);
    await expect(instance.connect(accounts[0]).executeVoting(1)).to.reverted;
  });

  it("ERC20 cannot be sent from the contract if amount exceeds balance", async function () {
    const { instance, accounts, WavePortal7 } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x5,
        2,
        accounts[3].address,
        WavePortal7.address,
        hre.ethers.utils.parseEther("5"),
        0,
        false
      );
    txn = await instance.connect(accounts[1]).voteResponse(1, 2, false);
    await expect(instance.connect(accounts[0]).executeVoting(1)).to.reverted;
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
        0x5,
        2,
        accounts[3].address,
        WavePortal7.address,
        hre.ethers.utils.parseEther("5"),
        0,
        false
      );
    txn = await instance.connect(accounts[1]).voteResponse(1, 2, false);
    await expect(() =>
      instance.connect(accounts[0]).executeVoting(1)
    ).to.changeTokenBalances(
      WavePortal7,
      [instance, WavePortal7, accounts[3]],
      [
        hre.ethers.utils.parseEther("-5"),
        hre.ethers.utils.parseEther("0"),
        hre.ethers.utils.parseEther("5"),
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
        0x6,
        5,
        accounts[3].address,
        nftContract.address,
        1,
        0,
        false
      );
    txn = await instance.connect(accounts[1]).voteResponse(1, 2, false);
    await expect(instance.connect(accounts[0]).executeVoting(1)).to.reverted;
  });

  it("NFT can be sent from the contract ", async function () {
    const { WavePortal7, instance, accounts, nftContract } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await instance
      .connect(accounts[0])
      ._mintCertificate(0, 0, 0, hre.ethers.utils.parseEther("50"));

    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x6,
        5,
        accounts[3].address,
        nftContract.address,
        1,
        0,
        false
      );
    txn = await instance.connect(accounts[1]).voteResponse(1, 2, false);
    txn = await instance.connect(accounts[0]).executeVoting(1);
    await expect(await nftContract.ownerOf(1)).to.be.equal(accounts[3].address);
  });
});
