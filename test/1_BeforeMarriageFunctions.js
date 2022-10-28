/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { deployTest } = require('../scripts/deployForTest');

describe("Testing before marriage interactions", function () {
  async function deployTokenFixture() {
  
    const {WavePortal7, WaverImplementation,nftContract,accounts, nftSplit}  = await deployTest();
   
    return { WavePortal7, WaverImplementation, accounts };
  }

  it("Should not be able to propose itself", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);

    await expect(
      WavePortal7.propose(
      accounts[0].address, 
      "I love you so much!!!", 
      0, 
      86400,
      86400,
      5,
      {
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
      86400,
      86400,
      5,
      { value: hre.ethers.utils.parseEther("10") }
    );
    txn = await WavePortal7.checkMarriageStatus();

    const instance = await WaverImplementation.attach(txn.marriageContract);

    expect(await instance.getMarriageStatus()).to.equal(0);

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
      86400,
      86400,
      5,
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
    expect(await instance.getMarriageStatus()).to.equal(2);
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
      86400,
      86400,
      5,
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
      86400,
      86400,
      5,
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
    const TX = {
      to: instance.address,
      value: hre.ethers.utils.parseEther("10"),
    };
   
    await expect(
      await accounts[0].sendTransaction(TX)
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
      86400,
      86400,
      5,
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
      86400,
      86400,
      5,
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
      86400,
      86400,
      5,
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
      86400,
      86400,
      5,
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
      86400,
      86400,
      5,
      { value: hre.ethers.utils.parseEther("10") }
    );

    await expect(
      WavePortal7.connect(accounts[3]).propose(
        accounts[0].address,
        "I love you so much!!!",
        0,
        86400,
        86400,
        5,
        { value: hre.ethers.utils.parseEther("10") }
      )
    ).to.reverted;

    await expect(
      WavePortal7.connect(accounts[3]).propose(
        accounts[1].address,
        "I love you so much!!!",
        0,
        86400,
        86400,
        5,
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
      86400,
      86400,
      5,
      { value: hre.ethers.utils.parseEther("10") }
    );

    await expect(
      WavePortal7.connect(accounts[0]).propose(
        accounts[3].address,
        "I love you so much!!!",
        0,
        86400,
        86400,
        5,
        { value: hre.ethers.utils.parseEther("10") }
      )
    ).to.reverted;

    await expect(
      WavePortal7.connect(accounts[1]).propose(
        accounts[3].address,
        "I love you so much!!!",
        0,
        86400,
        86400,
        5,
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
      86400,
      86400,
      5,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.connect(accounts[1]).response( 2, 0);

    txn = await WavePortal7.checkMarriageStatus();

    expect(await txn.ProposalStatus).to.equal(0);

    const instance = await WaverImplementation.attach(txn.marriageContract);

    expect(await instance.getMarriageStatus()).to.equal(1);
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
      86400,
      86400,
      5,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.connect(accounts[1]).response(2, 0);

    txn = await WavePortal7.checkMarriageStatus();

    const instance = await WaverImplementation.attach(txn.marriageContract);

    txn = await instance.cancel();

    expect(await hre.ethers.provider.getBalance(instance.address)).to.equal(
      hre.ethers.utils.parseEther("0")
    );
    expect(await hre.ethers.provider.getBalance(WavePortal7.address)).to.equal(
      hre.ethers.utils.parseEther("0.199")
    );
    expect(await instance.getMarriageStatus()).to.equal(2);
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
      86400,
      86400,
      5,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.connect(accounts[1]).response(1, 0);

    txn = await WavePortal7.checkMarriageStatus();
    expect(await txn.ProposalStatus).to.equal(4);
    const instance = await WaverImplementation.attach(txn.marriageContract);
    expect(await instance.getMarriageStatus()).to.equal(3);
  });

  it("Third accounts, cannot respond to non existent proposals", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      86400,
      86400,
      5,
      { value: hre.ethers.utils.parseEther("10") }
    );

    await expect(WavePortal7.connect(accounts[3]).response(1, 0)).to
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
      86400,
      86400,
      5,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.connect(accounts[1]).response(1, 0);

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
      86400,
      86400,
      5,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.connect(accounts[1]).response(1, 0);

    txn = await WavePortal7.connect(accounts[0]).claimToken();
    txn = await WavePortal7.connect(accounts[1]).claimToken();

    expect(await WavePortal7.balanceOf(accounts[0].address)).to.equal(
      hre.ethers.utils.parseEther("495")
    );

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("495")
    );
  });

  it("Multiple users have different proxy implementation addresses when proposed", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      86400,
      86400,
      5,
      { value: hre.ethers.utils.parseEther("10") }
    );
    txn = await WavePortal7.connect(accounts[2]).propose(
      accounts[3].address,
      "I love you so much!!!",
      0,
      86400,
      86400,
      5,
      { value: hre.ethers.utils.parseEther("10") }
    );
    txn = await WavePortal7.connect(accounts[4]).propose(
      accounts[5].address,
      "I love you so much!!!",
      0,
      86400,
      86400,
      5,
      { value: hre.ethers.utils.parseEther("10") }
    );

    expect (await WavePortal7.connect(accounts[0]).checkMarriageStatus()).to.not.equal(await WavePortal7.connect(accounts[2]).checkMarriageStatus());
  });

});
