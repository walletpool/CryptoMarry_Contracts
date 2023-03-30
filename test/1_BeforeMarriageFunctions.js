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

  it("Can query empty struct", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);

    const txn = await WavePortal7.checkMarriageStatus(1);
    expect (txn.length).to.equal(0);
  });

  it("Should not be able to propose itself", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);

    await expect(
      WavePortal7.propose(
      accounts[0].address, 
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      })
    ).to.reverted;
  });

  it("Once proposed, new contract with a balance is created", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );
    txn = await WavePortal7.checkMarriageStatus(1);
    const instance = await WaverImplementation.attach(txn[0].marriageContract);

    expect(await instance.getMarriageStatus()).to.equal(0);

    expect(await hre.ethers.provider.getBalance(instance.address)).to.equal(
      hre.ethers.utils.parseEther("10")
    );

  });

  it("Once proposed, new contract without a balance is created if nothing was sent", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
    );
    txn = await WavePortal7.checkMarriageStatus(1);
    const instance = await WaverImplementation.attach(txn[0].marriageContract);

    expect(await instance.getMarriageStatus()).to.equal(0);

    expect(await hre.ethers.provider.getBalance(instance.address)).to.equal(
      hre.ethers.utils.parseEther("0")
    );

  });

  it("User can propose 8 times and retreive pages", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    for (let i=0; i<8; i++) {

    txn = await WavePortal7.propose(
      accounts[1].address,
      `0x746573740000000000000000000000000000000000000000000000000000000${i}`, 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    ); }
    txn = await WavePortal7.checkMarriageStatus(1);
    const instance = await WaverImplementation.attach(txn[7].marriageContract);
    expect(await instance.getMarriageStatus()).to.equal(0);
    expect(await hre.ethers.provider.getBalance(instance.address)).to.equal(
      hre.ethers.utils.parseEther("10")
    );
  });

  it("Once proposed, proposer can cancel before response is received, balances should zero out", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    for (let i=0; i<2; i++) {
    txn = await WavePortal7.propose(
      accounts[1].address,
      `0x746573740000000000000000000000000000000000000000000000000000000${i}`, 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );}
    txn = await WavePortal7.checkMarriageStatus(1);

    const instance = await WaverImplementation.attach(txn[1].marriageContract);
    
    txn = await WavePortal7.connect(accounts[1]).checkMarriageStatus(1)
    expect(txn.length).to.equal(2); 

    txn = await instance.cancel();

    expect(await hre.ethers.provider.getBalance(instance.address)).to.equal(
      hre.ethers.utils.parseEther("0")
    );
    txn = await instance.getMarriageStatus()
    expect(txn).to.equal(2);
    
    txn = await WavePortal7.proposalAttributes(2);
    expect(await txn.ProposalStatus).to.equal(2);
    
    txn = await WavePortal7.checkMarriageStatus(1)
    expect(txn.length).to.equal(1);    

    txn = await WavePortal7.connect(accounts[1]).checkMarriageStatus(1)
    expect(txn.length).to.equal(1);  
  });

  it("Once proposed, external accounts cannot call proposal related functions", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );
    txn = await WavePortal7.checkMarriageStatus(1);

    const instance = await WaverImplementation.attach(txn[0].marriageContract);

    await expect(WavePortal7.connect(accounts[3]).cancel(1)).to.reverted;
    await expect(WavePortal7.connect(accounts[3]).response(2,0,1)).to.reverted;
    await expect(WaverImplementation.connect(accounts[3]).initialize(accounts[3].address,1,accounts[3].address,accounts[3].address,1,1,1,1)).to.reverted;
    await expect(instance.connect(accounts[0]).initialize(accounts[3].address,1,accounts[3].address,accounts[3].address,1,1,1,1)).to.reverted;
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
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );

    txn = await WavePortal7.checkMarriageStatus(1);

    const instance = await WaverImplementation.attach(txn[0].marriageContract);

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

  it("Once proposed, before response, a partner cannot claim LOVE tokens", async function () {
    const { WavePortal7, WaverImplementation,accounts } = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );
    txn = await WavePortal7.checkMarriageStatus(1);

    const instance = await WaverImplementation.attach(txn[0].marriageContract);

    await expect(instance.connect(accounts[0])._claimToken()).to.reverted;
    await expect(instance.connect(accounts[1])._claimToken()).to.reverted;
    await expect(instance.connect(accounts[2])._claimToken()).to.reverted;
  });

  it("Everyone can buy LOVE tokens", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.connect(accounts[0]).buyLovToken({
      value: hre.ethers.utils.parseEther("10"),
    })

    txn = await WavePortal7.connect(accounts[1]).buyLovToken({
      value: hre.ethers.utils.parseEther("10"),
    })

     expect( await
      WavePortal7.balanceOf(accounts[0].address)
    ).to.equal(hre.ethers.utils.parseEther("20000"));
     expect(await
      WavePortal7.balanceOf(accounts[1].address)
      ).to.equal(hre.ethers.utils.parseEther("20000"));
  });

  it("Once proposed,  proposer cannot call vote related functions", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );
    txn = await WavePortal7.checkMarriageStatus(1);

    const instance = await WaverImplementation.attach(txn[0].marriageContract);

    await expect(
      instance
        .connect(accounts[0])
        .createProposal(
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          1,
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          1,
          0,
          false
        )
    ).to.reverted;
    await expect(
      instance
        .connect(accounts[1])
        .createProposal(
          "test1",
          1,
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          1,
          0,
          false
        )
    ).to.reverted;
  });

  it("Once proposed, before response, a partner cannot mint NFT certificates", async function () {
    const { WavePortal7, accounts,WaverImplementation } = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );

    txn = await WavePortal7.checkMarriageStatus(1);

    const instance = await WaverImplementation.attach(txn[0].marriageContract);

    await expect(
      instance.connect(accounts[0])._mintCertificate(0, 0, 0, hre.ethers.utils.parseEther("50"))
    ).to.reverted;
    await expect(
      instance.connect(accounts[1])._mintCertificate(0, 0, 0, hre.ethers.utils.parseEther("50"))
    ).to.reverted;
  });

//   /** Method to send ETH
//  * await expect( accounts[0].sendTransaction({to:instance.address, 
//                                            value: hre.ethers.utils.parseEther("10") })).to.reverted;
//  */

  it("Once proposed, other accounts can propose both partners", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );
    txn =  WavePortal7.connect(accounts[3]).propose(
      accounts[0].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    )

   
    txn = WavePortal7.connect(accounts[3]).propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    )
  })

  it("Once proposed, partner accounts can propose to third accounts", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );

    txn = await WavePortal7.connect(accounts[0]).propose(
      accounts[3].address,
      "0x7465737400000000000000000000000000000000000000000000000000000001", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    )

    txn = await WavePortal7.connect(accounts[1]).propose(
      accounts[3].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    )
  });

  it("Once proposed, proposed partner can decline", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;
    for (let i = 0; i<3; i++) {
    txn = await WavePortal7.propose(
      accounts[1].address,
      `0x746573740000000000000000000000000000000000000000000000000000000${i}`, 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );
  }
 
    txn = await WavePortal7.connect(accounts[1]).response( 2, 0, 2);

    txn = await WavePortal7.checkMarriageStatus(1);
    expect(await txn[1].ProposalStatus).to.equal(0);

    const instance = await WaverImplementation.attach(txn[1].marriageContract);

    expect(await instance.getMarriageStatus()).to.equal(1);

    txn = await WavePortal7.connect(accounts[1]).checkMarriageStatus(1);
    expect(await txn.length).to.equal(2);
  });

  it("Once proposal is declined, proposer can cancel marriage", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );

    txn = await WavePortal7.connect(accounts[1]).response(2, 0,1);

    txn = await WavePortal7.checkMarriageStatus(1);

    const instance = await WaverImplementation.attach(txn[0].marriageContract);

    txn = await instance.cancel();

    expect(await hre.ethers.provider.getBalance(instance.address)).to.equal(
      hre.ethers.utils.parseEther("0")
    );
    expect(await hre.ethers.provider.getBalance(WavePortal7.address)).to.equal(
      hre.ethers.utils.parseEther("0")
    );
    expect(await instance.getMarriageStatus()).to.equal(2);
  });

  it("Once proposed, proposed partner can accept proposal", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
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
    expect(await txn[0].ProposalStatus).to.equal(4);
    const instance = await WaverImplementation.attach(txn[0].marriageContract);
    expect(await instance.getMarriageStatus()).to.equal(3);
  });

  it("Third accounts, cannot respond to non existent proposals", async function () {
    const { WavePortal7, accounts } = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );

    await expect(WavePortal7.connect(accounts[3]).response(1, 0,1)).to
      .reverted;
  });

  it("Once proposal is accepted, proposer cannot cancel marriage", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );

    txn = await WavePortal7.connect(accounts[1]).response(1, 0,1);

    txn = await WavePortal7.checkMarriageStatus(1);
    const instance = await WaverImplementation.attach(txn[0].marriageContract);
    await expect(instance.connect(accounts[0]).cancel()).to.reverted;
    await expect(instance.connect(accounts[1]).cancel()).to.reverted;
  });

  it("Once proposal is accepted, partners can claim LOVE tokens", async function () {
    const { WavePortal7, accounts, WaverImplementation} = await loadFixture(deployTokenFixture);
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );

    txn = await WavePortal7.connect(accounts[1]).response(1, 0,1);

    txn = await WavePortal7.checkMarriageStatus(1);
    const instance = await WaverImplementation.attach(txn[0].marriageContract);


    txn = await instance.connect(accounts[0])._claimToken();
    txn = await instance.connect(accounts[1])._claimToken();

    expect(await WavePortal7.balanceOf(accounts[0].address)).to.equal(
      hre.ethers.utils.parseEther("250")
    );

    expect(await WavePortal7.balanceOf(accounts[1].address)).to.equal(
      hre.ethers.utils.parseEther("250")
    );
  });

  it("Multiple users have different proxy implementation addresses when proposed", async function () {
    const { WavePortal7, WaverImplementation, accounts } = await loadFixture(
      deployTokenFixture
    );
    let txn;

    txn = await WavePortal7.propose(
      accounts[1].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );
    txn = await WavePortal7.connect(accounts[2]).propose(
      accounts[3].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );
    txn = await WavePortal7.connect(accounts[4]).propose(
      accounts[5].address,
      "0x7465737400000000000000000000000000000000000000000000000000000000", 
      0, 
      86400,
      5,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );

    expect (await WavePortal7.connect(accounts[0]).checkMarriageStatus(1)).to.not.equal(await WavePortal7.connect(accounts[2]).checkMarriageStatus(1));
  });

});
