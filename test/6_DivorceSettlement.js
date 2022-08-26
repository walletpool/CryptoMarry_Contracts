/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const {
  loadFixture,
  mine,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then((f) => f.deployed());
}

describe("Divorce Settlement Functions", function () {
  async function deployTokenFixture() {
    const accounts = await ethers.getSigners();
    const nftViewContract = await deploy(
      "nftview",
      "0x196eC7109e127A353B709a20da25052617295F6f"
    );

    const nftContract = await deploy("nftmint2", nftViewContract.address);

    const forwarder = await deploy("MinimalForwarder");

    const WaverImplementation = await deploy("WaverImplementation");

    const WaverFactory = await deploy(
      "WaverFactory",
      WaverImplementation.address
    );

    const WavePortal7 = await deploy(
      "WavePortal7",
      forwarder.address,
      nftContract.address,
      WaverFactory.address,
      "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      accounts[0].address
    );

    const nftSplit = await deploy("nftSplit", WavePortal7.address);

    //    Passing parameters

    await nftViewContract.changenftmainAddress(nftContract.address);
    await nftViewContract.changeMainAddress(WavePortal7.address);
    await nftContract.changeMainAddress(WavePortal7.address);
    await WaverFactory.changeAddress(WavePortal7.address);
    await WavePortal7.changeaddressNFTSplit(nftSplit.address);

    await nftViewContract.addheartPatterns(0, "0x3c726563742f3e");
    await nftViewContract.addadditionalGraphics(0, "0x3c726563742f3e");
    await nftViewContract.addcertBackground(
      0,
      "0x3c6c696e6561724772616469656e742069643d2242222078313d2230222079313d2230222078323d22333135222079323d2233313022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f702073746f702d636f6c6f723d2223636235656565222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223306364376534222073746f702d6f7061636974793d222e3939222f3e3c2f6c696e6561724772616469656e743e"
    );
    await nftViewContract.addcertBackground(
      1001,
      "0x3c6c696e6561724772616469656e742069643d2242222078313d22353025222079313d223025222078323d22353025222079323d2231303025223e3c73746f70206f66667365743d223025222073746f702d636f6c6f723d2223374135464646223e3c616e696d617465206174747269627574654e616d653d2273746f702d636f6c6f72222076616c7565733d22233741354646463b20233031464638393b202337413546464622206475723d2234732220726570656174436f756e743d22696e646566696e697465222f3e3c2f73746f703e3c73746f70206f66667365743d2231303025222073746f702d636f6c6f723d2223303146463839223e3c616e696d617465206174747269627574654e616d653d2273746f702d636f6c6f72222076616c7565733d22233031464638393b20233741354646463b202330314646383922206475723d2234732220726570656174436f756e743d22696e646566696e697465222f3e3c2f73746f703e3c2f6c696e6561724772616469656e743e"
    );
    await nftViewContract.addheartPatterns(
      101,
      "0x3c6c696e6561724772616469656e742069643d2270222078313d2230222078323d22313131222079313d223330222079323d22323022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f702073746f702d636f6c6f723d222346463542393922206f66667365743d22313025222f3e3c73746f702073746f702d636f6c6f723d222346463534343722206f66667365743d22323025222f3e3c73746f702073746f702d636f6c6f723d222346463742323122206f66667365743d22343025222f3e3c73746f702073746f702d636f6c6f723d222345414643333722206f66667365743d22363025222f3e3c73746f702073746f702d636f6c6f723d222334464342364222206f66667365743d22383025222f3e3c73746f702073746f702d636f6c6f723d222335314637464522206f66667365743d2231303025222f3e3c2f6c696e6561724772616469656e743e"
    );

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
      .addFamilyMember(accounts[4].address, 0);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address, 0);

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
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[4])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[5])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    await expect(
      await instance.connect(accounts[0]).executeVoting(1, 0, 0)
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
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[4])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[5])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = await instance.connect(accounts[0]).executeVoting(1, 0, 0);

    await expect(
      instance
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
        )
    ).to.reverted;
    await expect(
      instance
        .connect(accounts[1])
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
    await expect(
      instance
        .connect(accounts[4])
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
    await expect(
      instance
        .connect(accounts[5])
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

  it("After divorce ETH cannot be deposited", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
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
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[4])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[5])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = await instance.connect(accounts[0]).executeVoting(1, 0, 0);

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
    txn = await instance
      .connect(accounts[4])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 2, 0);
    txn = await instance
      .connect(accounts[5])
      .voteResponse(1, hre.ethers.utils.parseEther("100"), 2, 0);

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
    txn = instance
      .connect(accounts[1])
      .voteResponse(2, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[4])
      .voteResponse(2, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[5])
      .voteResponse(2, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = await instance.connect(accounts[0]).executeVoting(2, 0, 0);

    await expect(instance.connect(accounts[0]).executeVoting(1, 0, 0)).to
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
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[4])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[5])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = await instance.connect(accounts[0]).executeVoting(1, 0, 0);

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
    txn = await nftContract
      .connect(accounts[0])
      .transferFrom(accounts[0].address, instance.address, 1);
    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

  
    await expect( instance
      .connect(accounts[0])
      .SplitNFT(nftContract.address, 1, "json1", "json2")).to.reverted;
    
  });

  it("After divorce NFT tokens can be split between partners", async function () {
    const { instance, accounts, WavePortal7, nftContract, nftSplit } =
      await loadFixture(deployTokenFixture);

    txn = await WavePortal7.connect(accounts[0]).MintCertificate(0, 0, 0, {
      value: hre.ethers.utils.parseEther("1"),
    });
    txn = await nftContract
      .connect(accounts[0])
      .transferFrom(accounts[0].address, instance.address, 1);
    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

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
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[4])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[5])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = await instance.connect(accounts[0]).executeVoting(1, 0, 0);

    txn = await instance
      .connect(accounts[0])
      .SplitNFT(nftContract.address, 1, "json1", "json2");
    const id = await nftSplit.tokenTracker(nftContract.address, 1);

    await expect(await nftSplit.balanceOf(accounts[0].address, id)).to.equal(1);
    await expect(await nftSplit.balanceOf(accounts[1].address, id)).to.equal(1);
  });

  it("Partner can acquire all copies of split NFT and receive it", async function () {
    const { instance, accounts, WavePortal7, nftContract, nftSplit } =
      await loadFixture(deployTokenFixture);

    txn = await WavePortal7.connect(accounts[0]).MintCertificate(0, 0, 0, {
      value: hre.ethers.utils.parseEther("1"),
    });
    txn = await nftContract
      .connect(accounts[0])
      .transferFrom(accounts[0].address, instance.address, 1);
    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

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
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[4])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[5])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = await instance.connect(accounts[0]).executeVoting(1, 0, 0);

    txn = await instance
      .connect(accounts[0])
      .SplitNFT(nftContract.address, 1, "json1", "json2");
    const id = await nftSplit.tokenTracker(nftContract.address, 1);

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
    txn = await nftContract
      .connect(accounts[0])
      .transferFrom(accounts[0].address, instance.address, 1);
    await expect(await nftContract.ownerOf(1)).to.be.equal(instance.address);

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
    txn = instance
      .connect(accounts[1])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[4])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = instance
      .connect(accounts[5])
      .voteResponse(1, hre.ethers.utils.parseEther("10"), 1, 0);
    txn = await instance.connect(accounts[0]).executeVoting(1, 0, 0);

    txn = await instance
      .connect(accounts[0])
      .SplitNFT(nftContract.address, 1, "json1", "json2");
    const id = await nftSplit.tokenTracker(nftContract.address, 1);

    await expect(nftSplit.connect(accounts[1]).joinNFT(id)).to.reverted;
  });
});
