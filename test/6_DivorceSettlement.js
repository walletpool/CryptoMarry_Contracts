/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const {
  loadFixture,
  mine,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { deployTest } = require('../scripts/deployForTest');


describe("Divorce Settlement Functions", function () {
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

  it("Divorce will split proxy ETH balance to partners", async function () {
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
        hre.ethers.utils.parseEther("4.9005"),
        hre.ethers.utils.parseEther("4.9005"),
      ]
    );
  });

  it("After divorce proposals cannot be created", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
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

    await expect(
      instance
        .connect(accounts[0])
        .createProposal(
          "test1",
          1,

          1,
          hre.ethers.utils.parseEther("100"),
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          0
        )
    ).to.reverted;
    await expect(
      instance
        .connect(accounts[1])
        .createProposal(
          "test1",
          1,
  
          1,
          hre.ethers.utils.parseEther("100"),
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          0,
          1
        )
    ).to.reverted;
    await expect(
      instance
        .connect(accounts[4])
        .createProposal(
          "test1",
          1,

          1,
          hre.ethers.utils.parseEther("100"),
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          0
        )
    ).to.reverted;
    await expect(
      instance
        .connect(accounts[5])
        .createProposal(
          "test1",
          1,
 
          1,
          hre.ethers.utils.parseEther("100"),
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          0
        )
    ).to.reverted;
  });

  it("After divorce ETH cannot be deposited", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
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

    await expect(
      accounts[0].sendTransaction({
        to: instance.address,
        value: hre.ethers.utils.parseEther("10"),
      })
    ).to.reverted;

    await expect(
      instance.addstake({ value: hre.ethers.utils.parseEther("10") })
    ).to.reverted;
  });

  it("After divorce proposals cannot be executed", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
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
      .voteResponse(2, hre.ethers.utils.parseEther("10"), 1);
    txn = instance
      .connect(accounts[4])
      .voteResponse(2, hre.ethers.utils.parseEther("10"), 1);
    txn = instance
      .connect(accounts[5])
      .voteResponse(2, hre.ethers.utils.parseEther("10"), 1);
    txn = await instance.connect(accounts[0]).executeVoting(2);

    await expect(instance.connect(accounts[0]).executeVoting(1)).to
      .reverted;
  });

  it("Before divorce, ERC20 tokens cannot be split between partners", async function () {
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

    
    await expect(
      instance.connect(accounts[1]).withdrawERC20(WavePortal7.address)
    ).to.reverted;
  });

  it("After divorce ERC20 tokens can be split between partners", async function () {
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
        hre.ethers.utils.parseEther("24.75"),
        hre.ethers.utils.parseEther("24.75"),
        hre.ethers.utils.parseEther("0.5"),
      ]
    );
  });

  it("Before divorce NFT tokens cannot be splitted between partners", async function () {
    const { instance, accounts, WavePortal7, nftContract, nftSplit } =
      await loadFixture(deployTokenFixture);

    txn = await WavePortal7.connect(accounts[0]).MintCertificate(0, 0, 0, {
      value: hre.ethers.utils.parseEther("1"),
    });

    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

  
    await expect( instance
      .connect(accounts[0])
      .SplitNFT(nftContract.address, 1, "json1")).to.reverted;
    
  });

  it("After divorce NFT tokens can be split between partners", async function () {
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
    console.log(resp)

    await expect(await nftSplit.balanceOf(accounts[0].address, id)).to.equal(1);
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
      .safeTransferFrom(accounts[0].address, accounts[1].address, id, 1, 0x0);

    txn = await nftSplit.connect(accounts[1]).joinNFT(id);

    await expect(await nftContract.ownerOf(1)).to.be.equal(accounts[1].address);
  });

  it("Partner cannot send NFT if it hasn't both copies of splitted NFT", async function () {
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

    await expect(nftSplit.connect(accounts[1]).joinNFT(id)).to.reverted;
  });
});
