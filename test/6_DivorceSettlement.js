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

    txn = await instance.connect(accounts[0]).createProposal(
      0x7,
      7,
      accounts[4].address,
      "0x0000000000000000000000000000000000000000",
      4,
      0,
      false
    )

    txn = await instance.connect(accounts[1]).createProposal(
      0x7,
      7,
      accounts[5].address,
      "0x0000000000000000000000000000000000000000",
      4,
      0,
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
      0x4,
      4,
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      0,
      0,
      false
      );

    txn = await instance
      .connect(accounts[1])
      .voteResponse(3, 2, false);
    txn = await instance
      .connect(accounts[4])
      .voteResponse(3, 2, false);
    txn = await instance
      .connect(accounts[5])
      .voteResponse(3,2, false);
    await expect(
      await instance.connect(accounts[0]).settleDivorce(3)
    ).to.changeEtherBalances(
      [instance, WavePortal7, accounts[0], accounts[1]],
      [
        hre.ethers.utils.parseEther("-10"),
        hre.ethers.utils.parseEther("0"),
        hre.ethers.utils.parseEther("5"),
        hre.ethers.utils.parseEther("5"),
      ]
    );
  });

  it("Divorce will not happen before deadline if it has not passed ", async function () {
    const { instance, accounts, WavePortal7 } = await loadFixture(
      deployTokenFixture
    );
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

    await expect(
       instance.connect(accounts[0]).settleDivorce(3)
    ).to.reverted
  });

  it("Divorce will pass after deadline event if no one has voted ", async function () {
    const { instance, accounts, WavePortal7 } = await loadFixture(
      deployTokenFixture
    );
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
      await mine(10000000);
      await expect(
        await instance.connect(accounts[0]).settleDivorce(3)
      ).to.changeEtherBalances(
        [instance, WavePortal7, accounts[0], accounts[1]],
        [
          hre.ethers.utils.parseEther("-10"),
          hre.ethers.utils.parseEther("0"),
          hre.ethers.utils.parseEther("5"),
          hre.ethers.utils.parseEther("5"),
        ]
      );
  });

  it("After divorce proposals cannot be created", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
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
    txn = await instance
      .connect(accounts[1])
      .voteResponse(3, 2, false);;
    txn = await instance
      .connect(accounts[4])
      .voteResponse(3, 2, false);;
    txn = await instance
      .connect(accounts[5])
      .voteResponse(3, 2, false);;
    txn = await instance.connect(accounts[0]).settleDivorce(3);

    await expect(
      instance
        .connect(accounts[0])
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
    await expect(
      instance
        .connect(accounts[1])
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
    await expect(
      instance
        .connect(accounts[4])
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
    await expect(
      instance
        .connect(accounts[5])
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

  it("After divorce ETH cannot be deposited", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
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
    txn = await instance
      .connect(accounts[1])
      .voteResponse(3, 2, false);;
    txn = await instance
      .connect(accounts[4])
      .voteResponse(3, 2, false);;
    txn = await instance
      .connect(accounts[5])
      .voteResponse(3, 2, false);;
    txn = await instance.connect(accounts[0]).settleDivorce(3);

    await expect(
      accounts[0].sendTransaction({
        to: instance.address,
        value: hre.ethers.utils.parseEther("10"),
      })
    ).to.reverted;

    const TX = {
      to: instance.address,
      value: hre.ethers.utils.parseEther("10"),
    };

    await expect(
      accounts[0].sendTransaction(TX)
    ).to.reverted;
  });


  it("After divorce proposals cannot be executed", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    txn = await instance
      .connect(accounts[0])
      .createProposal(
        0x3,
        3,
        accounts[3].address,
        "0x0000000000000000000000000000000000000000",
        hre.ethers.utils.parseEther("5"),
         0,
        false
      );

    txn = await instance
      .connect(accounts[1])
      .voteResponse(3, 2, false);;
    txn = await instance
      .connect(accounts[4])
      .voteResponse(3,2,false); /// If vote already is passed by threshold the voting will stop. 
    txn = await instance
      .connect(accounts[5])
      .voteResponse(3, 2, false);;

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
    txn = await instance
      .connect(accounts[1])
      .voteResponse(4,2,false);
    txn = await instance
      .connect(accounts[4])
      .voteResponse(4,2,false);
    txn = await instance
      .connect(accounts[5])
      .voteResponse(4,2,false);
    txn = await instance.connect(accounts[0]).settleDivorce(4);

    await expect(instance.connect(accounts[0]).executeVoting(3)).to
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
      0x4,
      4,
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      0,
      0,
      false
    );

  txn = await instance
    .connect(accounts[1])
    .voteResponse(3, 2, false);;
  txn = await instance
    .connect(accounts[4])
    .voteResponse(3,2,false);
  txn = await instance
    .connect(accounts[5])
    .voteResponse(3, 2, false);;
  txn = await instance.connect(accounts[0]).settleDivorce(3);

    await expect(() =>
      instance.connect(accounts[1]).withdrawERC20(WavePortal7.address)
    ).to.changeTokenBalances(
      WavePortal7,
      [instance, accounts[0], accounts[1], WavePortal7],
      [
        hre.ethers.utils.parseEther("-50"),
        hre.ethers.utils.parseEther("25"),
        hre.ethers.utils.parseEther("25"),
        hre.ethers.utils.parseEther("0"),
      ]
    );
  });

  it("Before divorce NFT tokens cannot be splitted between partners", async function () {
    const { instance, accounts, WavePortal7, nftContract, nftSplit } =
      await loadFixture(deployTokenFixture);

    txn = await instance.connect(accounts[0])._mintCertificate(0, 0, 0, hre.ethers.utils.parseEther("50"),
    );

    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

  
    await expect( instance
      .connect(accounts[0])
      .SplitNFT(nftContract.address, 1, "json1")).to.reverted;
    
  });

  it("After divorce NFT tokens can be split between partners", async function () {
    const { instance, accounts, WavePortal7, nftContract, nftSplit } =
      await loadFixture(deployTokenFixture);

      txn = await instance.connect(accounts[0])._mintCertificate(0, 0, 0, hre.ethers.utils.parseEther("50"),
      );

    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

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

  txn = await instance
    .connect(accounts[1])
    .voteResponse(3, 2, false);;
  txn = await instance
    .connect(accounts[4])
    .voteResponse(3,2,false);
  txn = await instance
    .connect(accounts[5])
    .voteResponse(3, 2, false);;
  txn = await instance.connect(accounts[0]).settleDivorce(3);

    txn = await instance
      .connect(accounts[0])
      .SplitNFT(nftContract.address, 1, "json1");
    const id = await nftSplit.tokenTracker(nftContract.address, 1);
    const resp = await nftSplit.uri(id);
  
    await expect(await nftSplit.balanceOf(accounts[0].address, id)).to.equal(5);
    await expect(await nftSplit.balanceOf(accounts[1].address, id)).to.equal(5);
  });

  it("Partner can acquire all copies of split NFT and receive it", async function () {
    const { instance, accounts, WavePortal7, nftContract, nftSplit } =
      await loadFixture(deployTokenFixture);

      txn = await instance.connect(accounts[0])._mintCertificate(0, 0, 0, hre.ethers.utils.parseEther("50"),
      );
 
    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

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

  txn = await instance
    .connect(accounts[1])
    .voteResponse(3, 2, false);;
  txn = await instance
    .connect(accounts[4])
    .voteResponse(3,2,false);
  txn = await instance
    .connect(accounts[5])
    .voteResponse(3, 2, false);;
  txn = await instance.connect(accounts[0]).settleDivorce(3);


    txn = await instance
      .connect(accounts[0])
      .SplitNFT(nftContract.address, 1, "json1");
    const id = await nftSplit.tokenTracker(nftContract.address, 1);

    txn = await nftSplit
      .uri(1);

    txn = await nftSplit
      .connect(accounts[0])
      .safeTransferFrom(accounts[0].address, accounts[1].address, id, 5, 0x0);

    txn = await nftSplit.connect(accounts[1]).joinNFT(id);

    await expect(await nftContract.ownerOf(1)).to.be.equal(accounts[1].address);
  });


  it("Partner cannot send NFT if it hasn't both copies of splitted NFT", async function () {
    const { instance, accounts, WavePortal7, nftContract, nftSplit } =
      await loadFixture(deployTokenFixture);

    
      txn = await instance.connect(accounts[0])._mintCertificate(0, 0, 0, hre.ethers.utils.parseEther("50"),
      );

    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

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

  txn = await instance
    .connect(accounts[1])
    .voteResponse(3, 2, false);;
  txn = await instance
    .connect(accounts[4])
    .voteResponse(3,2,false);
  txn = await instance
    .connect(accounts[5])
    .voteResponse(3, 2, false);;
  txn = await instance.connect(accounts[0]).settleDivorce(3);

    txn = await instance
      .connect(accounts[0])
      .SplitNFT(nftContract.address, 1, "json1");
    const id = await nftSplit.tokenTracker(nftContract.address, 1);

    await expect(nftSplit.connect(accounts[1]).joinNFT(id)).to.reverted;
  });
});
