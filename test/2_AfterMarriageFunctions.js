/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const {
  loadFixture,
  mine,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { deployTest } = require('../scripts/deployForTest');


describe("Testing after marriage interactions", function () {
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

    return { WavePortal7, instance, accounts, nftContract };
  }

  it("ETH can be staked after marriage", async function () {
    const { WavePortal7, accounts, instance } = await loadFixture(
      deployTokenFixture
    );
    await expect(
      await accounts[0].sendTransaction({
        to: instance.address,
        value: hre.ethers.utils.parseEther("10"),
      })
    ).to.changeEtherBalances(
      [instance, WavePortal7, accounts[0]],
      [
        hre.ethers.utils.parseEther("10"),
        hre.ethers.utils.parseEther("0"),
        hre.ethers.utils.parseEther("-10"),
      ]
    );
    const TX = {
      to: instance.address,
      value: hre.ethers.utils.parseEther("10"),
    };

    await expect(
      await accounts[0].sendTransaction(TX)
    ).to.changeEtherBalances(
      [instance, WavePortal7, accounts[0]],
      [
        hre.ethers.utils.parseEther("10"),
        hre.ethers.utils.parseEther("0"),
        hre.ethers.utils.parseEther("-10"),
      ]
    );
  });

  it("Once LOVE tokens claimed, user cannot claim tokens before cooldown", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    let txn;

    await expect(instance.connect(accounts[0])._claimToken()).to.reverted;
    await expect(instance.connect(accounts[1])._claimToken()).to.reverted;
    await expect(instance.connect(accounts[2])._claimToken()).to.reverted;
  });

  it("Once LOVE tokens claimed, user can claim LOVE tokens after cooldown passed", async function () {
    const { WavePortal7, accounts, instance } = await loadFixture(deployTokenFixture);
    let txn;
    await mine(1000000);


    txn = await instance.connect(accounts[0])._claimToken();
    txn = await instance.connect(accounts[1])._claimToken();

    expect(await WavePortal7.balanceOf(accounts[0].address)).to.equal(
      hre.ethers.utils.parseEther("500")
    );

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("500")
    );
  });

  it("Users can buy LOVE tokens", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.connect(accounts[0]).buyLovToken({
      value: hre.ethers.utils.parseEther("0.01"),
    });
    txn = await WavePortal7.connect(accounts[1]).buyLovToken({
      value: hre.ethers.utils.parseEther("0.01"),
    });

    expect(await WavePortal7.balanceOf(accounts[0].address)).to.equal(
      hre.ethers.utils.parseEther("270")
    );

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("270")
    );
  });

  it("Users cannot buy LOVE tokens exceeding sales cap", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);
    await expect(
      WavePortal7.connect(accounts[0]).buyLovToken({
        value: hre.ethers.utils.parseEther("1000"),
      })
    ).to.reverted;
  });

  it("Users cannot mint NFT certificates without paying minimum price", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    await expect(
      instance.connect(accounts[0])._mintCertificate(0, 0, 0, hre.ethers.utils.parseEther("10"))
    ).to.reverted;
  });

  it("Users cannot mint middle NFT certificates without paying middle price", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    await expect(
      instance.connect(accounts[0])._mintCertificate(101, 0, 0, hre.ethers.utils.parseEther("100"))
    ).to.reverted;
  });

  it("Users cannot mint high NFT certificates without paying high price", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    await expect(
      instance.connect(accounts[0])._mintCertificate(101, 1001, 0, hre.ethers.utils.parseEther("1000"))
    ).to.reverted;
  });

  it("User mints NFT certificate -> pays with LOVE tokens", async function () {
    const { WavePortal7, nftContract, accounts,instance } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance.connect(accounts[0])._mintCertificate(0, 0, 0, hre.ethers.utils.parseEther("50")
    );

    expect(await WavePortal7.balanceOf(accounts[0].address)).to.equal(
      hre.ethers.utils.parseEther("200")
    );
    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("250")
    );

    expect(await nftContract.nftLeft(0, 0, 0)).to.equal(999999);
    
  });

  it("User mints NFT certificate -> contract receives NFT", async function () {
    const { nftContract, accounts,instance } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await instance.connect(accounts[0])._mintCertificate(0, 0, 0, hre.ethers.utils.parseEther("50"));
    const nftid = await nftContract.nftHolder(
     instance.address
    );
    txn = await nftContract.tokenURI(nftid);
    await expect(await nftContract.ownerOf(nftid)).to.equal(
      instance.address
    );
  
  });
});
