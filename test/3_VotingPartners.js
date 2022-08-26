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

describe("Testing voting interactions", function () {
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
