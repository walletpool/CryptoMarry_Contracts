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
       "0x49206c6f766520796f7520736f206d75636821", 
      0, 
      86400,
      9,
      1,
       
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

    txn = await instance.connect(accounts[0])._claimToken();
    txn = await instance.connect(accounts[1])._claimToken();
    txn = await instance.connect(accounts[4])._claimToken();
    txn = await instance.connect(accounts[5])._claimToken();
    
    txn = await WavePortal7.connect(accounts[0]).transfer(
      instance.address,
      hre.ethers.utils.parseEther("50")
    )

    txn = await instance.connect(accounts[0])._mintCertificate(0, 0, 0, hre.ethers.utils.parseEther("50"));
    await mine(1000000);
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x4,
        4,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0,
        false
      );
    txn = await instance
      .connect(accounts[1])
      .voteResponse(3,2,false);
    txn = await instance
      .connect(accounts[4])
      .voteResponse(3,2,false);
    txn = await instance
      .connect(accounts[5])
      .voteResponse(3,2,false);

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
    
    await expect(
      await instance.connect(accounts[0]).settleDivorce(3)
    ).to.changeEtherBalances(
      [instance, WavePortal7, accounts[0], accounts[1]],
      [
        hre.ethers.utils.parseEther("-10"),
        hre.ethers.utils.parseEther("0"),
        hre.ethers.utils.parseEther("9"),
        hre.ethers.utils.parseEther("1"),
      ]
    );
  });

  it("After divorce ERC20 tokens can be split according to share (90/10)", async function () {
    const { instance, accounts, WavePortal7 } = await loadFixture(
      deployTokenFixture
    );
    txn = await instance.connect(accounts[0]).settleDivorce(3);
    await expect(() =>
      instance.connect(accounts[1]).withdrawERC20(WavePortal7.address)
    ).to.changeTokenBalances(
      WavePortal7,
      [instance, WavePortal7, accounts[0], accounts[1]],
      [
        hre.ethers.utils.parseEther("-50"),
        hre.ethers.utils.parseEther("0"),
        hre.ethers.utils.parseEther("45"),
        hre.ethers.utils.parseEther("5"),
      ]
    );
  });


  it("After divorce NFT tokens can be split between partners according to share (90/10)", async function () {
    const { instance, accounts, WavePortal7, nftContract, nftSplit } =
      await loadFixture(deployTokenFixture);

    txn = await instance.connect(accounts[0]).settleDivorce(3); //!

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

      txn = await instance.connect(accounts[0]).settleDivorce(3); //!

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

    txn = await instance.connect(accounts[0]).settleDivorce(3); //!

    txn = await instance
      .connect(accounts[0])
      .SplitNFT(nftContract.address, 1, "json1");
    const id = await nftSplit.tokenTracker(nftContract.address, 1);
    txn = await nftSplit
    .connect(accounts[0])
    .safeTransferFrom(accounts[0].address, accounts[1].address, id, 7, 0x0);

    await expect(nftSplit.connect(accounts[1]).joinNFT(id)).to.reverted;
  });
});
