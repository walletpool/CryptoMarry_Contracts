/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then((f) => f.deployed());
}

describe("Testing before marriage interactions", function () {
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

    return { WavePortal7, WaverImplementation, accounts };
  }

  it("Should not be able to propose itself", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);

    await expect(
      WavePortal7.propose(accounts[0].address, "I love you so much!!!", 0, {
        value: hre.ethers.utils.parseEther("10"),
      })
    ).to.reverted;
  });

  it("Once proposed, new contract with a balance is created and comission is sent to the Main contract", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );
    txn = await WavePortal7.checkMarriageStatus();

    const instance = await WaverImplementation.attach(txn.marriageContract);

    expect(await instance.marriageStatus()).to.equal(0);

    expect(await hre.ethers.provider.getBalance(instance.address)).to.equal(
      hre.ethers.utils.parseEther("9.9")
    );

    expect(await hre.ethers.provider.getBalance(WavePortal7.address)).to.equal(
      hre.ethers.utils.parseEther("0.1")
    );
  });

  it("Once proposed, proposer can cancel before response is received, balances should zero out", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );
    txn = await WavePortal7.checkMarriageStatus();

    const instance = await WaverImplementation.attach(txn.marriageContract);

    txn = await instance.cancel();

    expect(await hre.ethers.provider.getBalance(instance.address)).to.equal(
      hre.ethers.utils.parseEther("0")
    );
    expect(await hre.ethers.provider.getBalance(WavePortal7.address)).to.equal(
      hre.ethers.utils.parseEther("0.199")
    );
    expect(await instance.marriageStatus()).to.equal(2);
    txn = await WavePortal7.checkMarriageStatus();
    expect(await txn.id).to.equal(0);
    //expect (await hre.ethers.provider.getBalance(accounts[0].address)).to.equal(hre.ethers.utils.parseEther("9999.757510958326712120"));
  });

  it("Once proposed, external accounts cannot call proposal related functions", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );
    txn = await WavePortal7.checkMarriageStatus();

    const instance = await WaverImplementation.attach(txn.marriageContract);

    await expect(WavePortal7.connect(accounts[3]).cancel(1)).to.reverted;
    await expect(instance.connect(accounts[3]).cancel()).to.reverted;
    await expect(instance.connect(accounts[3]).agreed()).to.reverted;
    await expect(instance.connect(accounts[3]).declined()).to.reverted;
  });

  it("ETH can be staked once proposed", async function () {
    const { WavePortal7, accounts, WaverImplementation } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.checkMarriageStatus();

    const instance = await WaverImplementation.attach(txn.marriageContract);

    await expect(
      await accounts[0].sendTransaction({
        to: instance.address,
        value: hre.ethers.utils.parseEther("10"),
      })
    ).to.changeEtherBalances(
      [instance, WavePortal7, accounts[0]],
      [
        hre.ethers.utils.parseEther("9.9"),
        hre.ethers.utils.parseEther("0.1"),
        hre.ethers.utils.parseEther("-10"),
      ]
    );

    await expect(
      await instance.addstake({ value: hre.ethers.utils.parseEther("10") })
    ).to.changeEtherBalances(
      [instance, WavePortal7, accounts[0]],
      [
        hre.ethers.utils.parseEther("9.9"),
        hre.ethers.utils.parseEther("0.1"),
        hre.ethers.utils.parseEther("-10"),
      ]
    );
  });

  it("Once proposed, before response, a partner cannot claim LOVE tokens", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    await expect(WavePortal7.connect(accounts[0]).claimToken()).to.reverted;
    await expect(WavePortal7.connect(accounts[1]).claimToken()).to.reverted;
    await expect(WavePortal7.connect(accounts[2]).claimToken()).to.reverted;
  });

  it("Once proposed, before response, a partner cannot buy LOVE tokens", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    await expect(
      WavePortal7.connect(accounts[0]).buyLovToken({
        value: hre.ethers.utils.parseEther("10"),
      })
    ).to.reverted;
    await expect(
      WavePortal7.connect(accounts[1]).buyLovToken({
        value: hre.ethers.utils.parseEther("10"),
      })
    ).to.reverted;
  });

  it("Once proposed,  proposer cannot call vote related functions", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );
    txn = await WavePortal7.checkMarriageStatus();

    const instance = await WaverImplementation.attach(txn.marriageContract);

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
  });

  it("Once proposed, before response, a partner cannot mint NFT certificates", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    await expect(
      WavePortal7.connect(accounts[0]).MintCertificate(0, 0, 0, {
        value: hre.ethers.utils.parseEther("10"),
      })
    ).to.reverted;
    await expect(
      WavePortal7.connect(accounts[1]).MintCertificate(0, 0, 0, {
        value: hre.ethers.utils.parseEther("10"),
      })
    ).to.reverted;
  });

  /** Method to send ETH
 * await expect( accounts[0].sendTransaction({to:instance.address, 
                                           value: hre.ethers.utils.parseEther("10") })).to.reverted;
 */

  it("Once proposed, other accounts cannot propose both partners", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    await expect(
      WavePortal7.connect(accounts[3]).propose(
        accounts[0].address,
        "I love you so much!!!",
        0,
        { value: hre.ethers.utils.parseEther("10") }
      )
    ).to.reverted;

    await expect(
      WavePortal7.connect(accounts[3]).propose(
        accounts[1].address,
        "I love you so much!!!",
        0,
        { value: hre.ethers.utils.parseEther("10") }
      )
    ).to.reverted;
  });

  it("Once proposed, partner accounts cannot propose to third accounts", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    await expect(
      WavePortal7.connect(accounts[0]).propose(
        accounts[3].address,
        "I love you so much!!!",
        0,
        { value: hre.ethers.utils.parseEther("10") }
      )
    ).to.reverted;

    await expect(
      WavePortal7.connect(accounts[1]).propose(
        accounts[3].address,
        "I love you so much!!!",
        0,
        { value: hre.ethers.utils.parseEther("10") }
      )
    ).to.reverted;
  });

  it("Once proposed, proposed partner can decline", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.connect(accounts[1]).response("No", 2, 0);

    txn = await WavePortal7.checkMarriageStatus();

    expect(await txn.ProposalStatus).to.equal(0);

    const instance = await WaverImplementation.attach(txn.marriageContract);

    expect(await instance.marriageStatus()).to.equal(1);
  });

  it("Once proposal is declined, proposer can cancel marriage", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.connect(accounts[1]).response("No", 2, 0);

    txn = await WavePortal7.checkMarriageStatus();

    const instance = await WaverImplementation.attach(txn.marriageContract);

    txn = await instance.cancel();

    expect(await hre.ethers.provider.getBalance(instance.address)).to.equal(
      hre.ethers.utils.parseEther("0")
    );
    expect(await hre.ethers.provider.getBalance(WavePortal7.address)).to.equal(
      hre.ethers.utils.parseEther("0.199")
    );
    expect(await instance.marriageStatus()).to.equal(2);
    txn = await WavePortal7.checkMarriageStatus();
    expect(await txn.id).to.equal(0);
  });

  it("Once proposed, proposed partner can accept proposal", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
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
    expect(await txn.ProposalStatus).to.equal(4);
    const instance = await WaverImplementation.attach(txn.marriageContract);
    expect(await instance.marriageStatus()).to.equal(3);
  });

  it("Third accounts, cannot respond to non existent proposals", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    await expect(WavePortal7.connect(accounts[3]).response("Yes", 1, 0)).to
      .reverted;
  });

  it("Once proposal is accepted, proposer cannot cancel marriage", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
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
    await expect(instance.connect(accounts[0]).cancel()).to.reverted;
    await expect(instance.connect(accounts[1]).cancel()).to.reverted;
  });

  it("Once proposal is accepted, partners can claim LOVE tokens", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.connect(accounts[1]).response("Yes", 1, 0);

    txn = await WavePortal7.connect(accounts[0]).claimToken();
    txn = await WavePortal7.connect(accounts[1]).claimToken();

    expect(await WavePortal7.balanceOf(accounts[0].address)).to.equal(
      hre.ethers.utils.parseEther("495")
    );

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("495")
    );
  });
});
