/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const {
  loadFixture,
  mine,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { deployTest } = require('../scripts/deployForTest');


describe("Divorce Settlement Functions Assymetric - Proposer - 90%, Proposed - 10%", function () {
  async function deployTokenFixture() {
    const {WavePortal7, WaverImplementation,nftContract,accounts, nftSplit}  = await deployTest();
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      86400,
      86400,
      9,
      { value: hre.ethers.utils.parseEther("10") }
    );
  

    txn = await WavePortal7.connect(accounts[1]).response(1, 0);

    txn = await WavePortal7.checkMarriageStatus();

    const instance = await WaverImplementation.attach(txn.marriageContract);

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address);

    txn = await WavePortal7.connect(accounts[4]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(2);

    txn = await WavePortal7.connect(accounts[0]).claimToken();
    txn = await WavePortal7.connect(accounts[1]).claimToken();
    txn = await WavePortal7.connect(accounts[4]).claimToken();
    txn = await WavePortal7.connect(accounts[5]).claimToken();

    return {
      WavePortal7,
      instance,
      accounts,
      nftContract,
      WaverImplementation,
      nftSplit,
    };
  }


  it("Divorce will divide ETH balance according to share (90/10)", async function () {
    const { instance, accounts, WavePortal7 } = await loadFixture(
      deployTokenFixture
    );
    await mine(100000);
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "Divorce",
        4,
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
    await expect(
      await instance.connect(accounts[0]).executeVoting(1)
    ).to.changeEtherBalances(
      [instance, WavePortal7, accounts[0], accounts[1]],
      [
        hre.ethers.utils.parseEther("-9.9"),
        hre.ethers.utils.parseEther("0.099"),
        hre.ethers.utils.parseEther("8.8209"),
        hre.ethers.utils.parseEther("0.9801"),
      ]
    );
  });

  it("After divorce ERC20 tokens can be split according to share (90/10)", async function () {
    const { instance, accounts, WavePortal7 } = await loadFixture(
      deployTokenFixture
    );

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

    await mine(100000);
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "Divorce",
        4,

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
    txn = await instance.connect(accounts[0]).executeVoting(1);

    await expect(() =>
      instance.connect(accounts[1]).withdrawERC20(WavePortal7.address)
    ).to.changeTokenBalances(
      WavePortal7,
      [instance, accounts[0], accounts[1], WavePortal7],
      [
        hre.ethers.utils.parseEther("-50"),
        hre.ethers.utils.parseEther("44.55"),
        hre.ethers.utils.parseEther("4.95"),
        hre.ethers.utils.parseEther("0.5"),
      ]
    );
  });


  it("After divorce NFT tokens can be split between partners according to share (9/1)", async function () {
    const { instance, accounts, WavePortal7, nftContract, nftSplit } =
      await loadFixture(deployTokenFixture);

    txn = await WavePortal7.connect(accounts[0]).MintCertificate(0, 0, 0, {
      value: hre.ethers.utils.parseEther("1"),
    });

    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

    await mine(100000);
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "Divorce",
        4,

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
    txn = await instance.connect(accounts[0]).executeVoting(1);

    txn = await instance
      .connect(accounts[0])
      .SplitNFT(nftContract.address, 1, "json1");
    const id = await nftSplit.tokenTracker(nftContract.address, 1);
    const resp = await nftSplit.uri(id);

    await expect(await nftSplit.balanceOf(accounts[0].address, id)).to.equal(9);
    await expect(await nftSplit.balanceOf(accounts[1].address, id)).to.equal(1);
  });

  it("Partner can acquire all copies of split NFT and receive it", async function () {
    const { instance, accounts, WavePortal7, nftContract, nftSplit } =
      await loadFixture(deployTokenFixture);

    txn = await WavePortal7.connect(accounts[0]).MintCertificate(0, 0, 0, {
      value: hre.ethers.utils.parseEther("1"),
    });
 
    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

    await mine(100000);
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "Divorce",
        4,
    
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
    txn = await instance.connect(accounts[0]).executeVoting(1);

    txn = await instance
      .connect(accounts[0])
      .SplitNFT(nftContract.address, 1, "json1");
    const id = await nftSplit.tokenTracker(nftContract.address, 1);

    txn = await nftSplit
      .uri(1);

    txn = await nftSplit
      .connect(accounts[0])
      .safeTransferFrom(accounts[0].address, accounts[1].address, id, 9, 0x0);

    txn = await nftSplit.connect(accounts[1]).joinNFT(id);

    await expect(await nftContract.ownerOf(1)).to.be.equal(accounts[1].address);
  });

  it("Partner cannot retreive original NFT if it hasn't all copies of splitted NFT", async function () {
    const { instance, accounts, WavePortal7, nftContract, nftSplit } =
      await loadFixture(deployTokenFixture);

    txn = await WavePortal7.connect(accounts[0]).MintCertificate(0, 0, 0, {
      value: hre.ethers.utils.parseEther("1"),
    });
  
    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

    await mine(100000);
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        "Divorce",
        4,
    
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
    txn = await instance.connect(accounts[0]).executeVoting(1);

    txn = await instance
      .connect(accounts[0])
      .SplitNFT(nftContract.address, 1, "json1");
    const id = await nftSplit.tokenTracker(nftContract.address, 1);

    txn = await nftSplit
      .connect(accounts[0])
      .safeTransferFrom(accounts[0].address, accounts[1].address, id, 5, 0x0);

    await expect(nftSplit.connect(accounts[1]).joinNFT(id)).to.reverted;
  });
});
