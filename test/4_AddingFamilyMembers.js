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

describe("Adding Family Members Testing", function () {
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

    return {
      WavePortal7,
      instance,
      accounts,
      nftContract,
      WaverImplementation,
    };
  }

  it("Third parties cannot invite family members to a proxy", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    await expect(
      instance.connect(accounts[2]).addFamilyMember(accounts[2].address, 0)
    ).to.reverted;
  });

  it("Partners cannot invite as a family members themselves", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    await expect(
      instance.connect(accounts[0]).addFamilyMember(accounts[0].address, 0)
    ).to.reverted;
    await expect(
      instance.connect(accounts[1]).addFamilyMember(accounts[0].address, 0)
    ).to.reverted;
    await expect(
      instance.connect(accounts[0]).addFamilyMember(accounts[1].address, 0)
    ).to.reverted;
    await expect(
      instance.connect(accounts[1]).addFamilyMember(accounts[1].address, 0)
    ).to.reverted;
  });

  it("Partners cannot invite as a family members the ones who are already partners or family members somewhere else in CM", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await WavePortal7.connect(accounts[2]).propose(
      accounts[3].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    await expect(
      instance.connect(accounts[0]).addFamilyMember(accounts[2].address, 0)
    ).to.reverted;
    await expect(
      instance.connect(accounts[1]).addFamilyMember(accounts[3].address, 0)
    ).to.reverted;
  });

  it("Partners can invite a family member", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    let txn;
    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[2].address, 0);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[3].address, 0);

    txn = await WavePortal7.checkMarriageStatus();

    await expect(await WavePortal7.member(accounts[2].address, false)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[3].address, false)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[2].address, true)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[3].address, true)).to.equal(
      0
    );

    txn = await WavePortal7.getFamilyMembers(instance.address);
    await expect(txn[0]).to.equal(accounts[2].address);
    await expect(txn[1]).to.equal(accounts[3].address);
  });

  it("Invited family members can decline inviation ", async function () {
    const { WavePortal7, instance, accounts, WaverImplementation } =
      await loadFixture(deployTokenFixture);

    txn = await WavePortal7.connect(accounts[2]).propose(
      accounts[3].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.connect(accounts[3]).response("Yes", 1, 0);

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address, 0);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address, 0);
    txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus();

    const instance2 = await WaverImplementation.attach(txn.marriageContract);

    txn = await instance2
      .connect(accounts[2])
      .addFamilyMember(accounts[6].address, 0);
    txn = await instance2
      .connect(accounts[3])
      .addFamilyMember(accounts[7].address, 0);

    txn = await WavePortal7.connect(accounts[4]).joinFamily(1);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(1);
    txn = await WavePortal7.connect(accounts[6]).joinFamily(1);
    txn = await WavePortal7.connect(accounts[7]).joinFamily(1);

    await expect(await WavePortal7.member(accounts[4].address, false)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[5].address, false)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[6].address, false)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[7].address, false)).to.equal(
      0
    );

    await expect(await WavePortal7.member(accounts[4].address, true)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[5].address, true)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[6].address, true)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[7].address, true)).to.equal(
      0
    );
  });

  it("Invited family members can accept inviation", async function () {
    const { WavePortal7, instance, accounts, WaverImplementation } =
      await loadFixture(deployTokenFixture);

    txn = await WavePortal7.connect(accounts[2]).propose(
      accounts[3].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.connect(accounts[3]).response("Yes", 1, 0);

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address, 0);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address, 0);

    txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus();

    const instance2 = await WaverImplementation.attach(txn.marriageContract);

    txn = await instance2
      .connect(accounts[2])
      .addFamilyMember(accounts[6].address, 0);
    txn = await instance2
      .connect(accounts[3])
      .addFamilyMember(accounts[7].address, 0);

    txn = await WavePortal7.checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[4].address, false)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[5].address, false)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[4].address, true)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[5].address, true)).to.equal(
      0
    );

    txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[6].address, false)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[7].address, false)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[6].address, true)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[7].address, true)).to.equal(
      0
    );

    txn = await WavePortal7.connect(accounts[4]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[6]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[7]).joinFamily(2);

    await expect(await WavePortal7.member(accounts[4].address, false)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[5].address, false)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[6].address, false)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[7].address, false)).to.equal(
      0
    );

    txn = await WavePortal7.checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[4].address, true)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[5].address, true)).to.equal(
      txn.id.toNumber()
    );

    txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[6].address, true)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[7].address, true)).to.equal(
      txn.id.toNumber()
    );
  });

  it("Partners cannot invite family members from other families", async function () {
    const { WavePortal7, instance, accounts, WaverImplementation } =
      await loadFixture(deployTokenFixture);

    txn = await WavePortal7.connect(accounts[2]).propose(
      accounts[3].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.connect(accounts[3]).response("Yes", 1, 0);

    txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus();

    const instance2 = await WaverImplementation.attach(txn.marriageContract);

    txn = await instance2
      .connect(accounts[2])
      .addFamilyMember(accounts[6].address, 0);
    txn = await instance2
      .connect(accounts[3])
      .addFamilyMember(accounts[7].address, 0);

    await expect(
      instance.connect(accounts[1]).addFamilyMember(accounts[6].address, 0)
    ).to.reverted;
    await expect(
      instance.connect(accounts[0]).addFamilyMember(accounts[7].address, 0)
    ).to.reverted;

    txn = await WavePortal7.connect(accounts[6]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[7]).joinFamily(2);

    await expect(
      instance.connect(accounts[1]).addFamilyMember(accounts[6].address, 0)
    ).to.reverted;
    await expect(
      instance.connect(accounts[0]).addFamilyMember(accounts[7].address, 0)
    ).to.reverted;
  });

  it("Partners can invite family members that declined others invitation", async function () {
    const { WavePortal7, instance, accounts, WaverImplementation } =
      await loadFixture(deployTokenFixture);

    txn = await WavePortal7.connect(accounts[2]).propose(
      accounts[3].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("10") }
    );

    txn = await WavePortal7.connect(accounts[3]).response("Yes", 1, 0);

    txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus();

    const instance2 = await WaverImplementation.attach(txn.marriageContract);

    txn = await instance2
      .connect(accounts[2])
      .addFamilyMember(accounts[6].address, 0);
    txn = await instance2
      .connect(accounts[3])
      .addFamilyMember(accounts[7].address, 0);

    txn = await WavePortal7.connect(accounts[6]).joinFamily(1);
    txn = await WavePortal7.connect(accounts[7]).joinFamily(1);

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[6].address, 0);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[7].address, 0);
    txn = await WavePortal7.checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[6].address, false)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[7].address, false)).to.equal(
      txn.id.toNumber()
    );
  });

  it("Invited Family Members cannot claim LOVE token before joining", async function () {
    const { WavePortal7, instance, accounts, WaverImplementation } =
      await loadFixture(deployTokenFixture);

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address, 0);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address, 0);

    await expect(WavePortal7.connect(accounts[4]).claimToken()).to.reverted;
    await expect(WavePortal7.connect(accounts[5]).claimToken()).to.reverted;
  });

  it("Invited Family Members can claim LOVE token after joining", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address, 0);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address, 0);

    txn = await WavePortal7.connect(accounts[4]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(2);

    txn = await WavePortal7.connect(accounts[4]).claimToken();
    txn = await WavePortal7.connect(accounts[5]).claimToken();

    expect(await WavePortal7.balanceOf(accounts[4].address)).to.equal(
      hre.ethers.utils.parseEther("247.5")
    );

    expect(await WavePortal7.balanceOf(accounts[5].address)).to.equal(
      hre.ethers.utils.parseEther("247.5")
    );
  });

  it("Invited Family Members cannot add other members ", async function () {
    const { WavePortal7, instance, accounts, WaverImplementation } =
      await loadFixture(deployTokenFixture);

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address, 0);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address, 0);

    txn = await WavePortal7.connect(accounts[4]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(2);

    txn = await WavePortal7.connect(accounts[4]).checkMarriageStatus();

    const instance2 = await WaverImplementation.attach(txn.marriageContract);
    await expect(
      instance2.connect(accounts[4]).addFamilyMember(accounts[6].address, 0)
    ).to.reverted;
    await expect(
      instance2.connect(accounts[5]).addFamilyMember(accounts[7].address, 0)
    ).to.reverted;
  });

  it("Partners can delete invited and inviation accepted members. Deleted members lose access to proxy", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address, 0);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address, 0);
    txn = await WavePortal7.checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[4].address, false)).to.equal(
      txn.id.toNumber()
    );
    txn = await WavePortal7.connect(accounts[4]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[4]).checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[4].address, true)).to.equal(
      txn.id.toNumber()
    );

    txn = await instance.connect(accounts[4]).getVotingStatuses(1);

    txn = await instance
      .connect(accounts[0])
      .deleteFamilyMember(accounts[4].address, 0);
    await expect(await WavePortal7.member(accounts[4].address, false)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[4].address, true)).to.equal(
      0
    );
    await expect(instance.connect(accounts[4]).getVotingStatuses(1)).to
      .reverted;

    txn = await instance
      .connect(accounts[1])
      .deleteFamilyMember(accounts[5].address, 0);
    await expect(await WavePortal7.member(accounts[5].address, false)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[5].address, true)).to.equal(
      0
    );
  });

  it("Partners cannot delete invited members two times ", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address, 0);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address, 0);
    txn = await WavePortal7.checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[4].address, false)).to.equal(
      txn.id.toNumber()
    );
    txn = await WavePortal7.connect(accounts[4]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[4]).checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[4].address, true)).to.equal(
      txn.id.toNumber()
    );

    txn = await instance.connect(accounts[4]).getVotingStatuses(1);

    txn = await instance
      .connect(accounts[0])
      .deleteFamilyMember(accounts[4].address, 0);
    await expect(await WavePortal7.member(accounts[4].address, false)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[4].address, true)).to.equal(
      0
    );
    await expect(instance.connect(accounts[4]).getVotingStatuses(1)).to
      .reverted;

    await expect(
      instance.connect(accounts[1]).deleteFamilyMember(accounts[4].address, 0)
    ).to.reverted;
  });

  it("Partners cannot delete not invited members", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);

    await expect(
      instance.connect(accounts[1]).deleteFamilyMember(accounts[4].address, 0)
    ).to.reverted;
  });

  it("Family members cannot delete other family members", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address, 0);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address, 0);

    txn = await WavePortal7.connect(accounts[4]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(2);

    await expect(
      instance.connect(accounts[4]).deleteFamilyMember(accounts[5].address, 0)
    ).to.reverted;
  });
});
