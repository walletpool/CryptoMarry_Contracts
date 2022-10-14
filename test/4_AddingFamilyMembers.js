/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const {
  loadFixture,
  mine,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { deployTest } = require('../scripts/deployForTest');


describe("Adding Family Members Testing", function () {
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
      instance.connect(accounts[2]).addFamilyMember(accounts[2].address)
    ).to.reverted;
  });

  it("Partners cannot invite as a family members themselves", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);
    await expect(
      instance.connect(accounts[0]).addFamilyMember(accounts[0].address)
    ).to.reverted;
    await expect(
      instance.connect(accounts[1]).addFamilyMember(accounts[0].address)
    ).to.reverted;
    await expect(
      instance.connect(accounts[0]).addFamilyMember(accounts[1].address)
    ).to.reverted;
    await expect(
      instance.connect(accounts[1]).addFamilyMember(accounts[1].address)
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
      instance.connect(accounts[0]).addFamilyMember(accounts[2].address)
    ).to.reverted;
    await expect(
      instance.connect(accounts[1]).addFamilyMember(accounts[3].address)
    ).to.reverted;
  });

  it("Partners can invite a family member", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    let txn;
    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[2].address);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[3].address);

    txn = await WavePortal7.checkMarriageStatus();

    await expect(await WavePortal7.member(accounts[2].address, 0)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[3].address, 0)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[2].address, 1)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[3].address, 1)).to.equal(
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
      .addFamilyMember(accounts[4].address);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address);
    txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus();

    const instance2 = await WaverImplementation.attach(txn.marriageContract);

    txn = await instance2
      .connect(accounts[2])
      .addFamilyMember(accounts[6].address);
    txn = await instance2
      .connect(accounts[3])
      .addFamilyMember(accounts[7].address);

    txn = await WavePortal7.connect(accounts[4]).joinFamily(1);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(1);
    txn = await WavePortal7.connect(accounts[6]).joinFamily(1);
    txn = await WavePortal7.connect(accounts[7]).joinFamily(1);

    await expect(await WavePortal7.member(accounts[4].address, 0)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[5].address, 0)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[6].address, 0)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[7].address, 0)).to.equal(
      0
    );

    await expect(await WavePortal7.member(accounts[4].address, 1)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[5].address, 1)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[6].address, 1)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[7].address, 1)).to.equal(
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
      .addFamilyMember(accounts[4].address);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address);

    txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus();

    const instance2 = await WaverImplementation.attach(txn.marriageContract);

    txn = await instance2
      .connect(accounts[2])
      .addFamilyMember(accounts[6].address);
    txn = await instance2
      .connect(accounts[3])
      .addFamilyMember(accounts[7].address);

    txn = await WavePortal7.checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[4].address, 0)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[5].address, 0)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[4].address, 1)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[5].address, 1)).to.equal(
      0
    );

    txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[6].address, 0)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[7].address, 0)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[6].address, 1)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[7].address, 1)).to.equal(
      0
    );

    txn = await WavePortal7.connect(accounts[4]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[6]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[7]).joinFamily(2);

    await expect(await WavePortal7.member(accounts[4].address, 0)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[5].address, 0)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[6].address, 0)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[7].address, 0)).to.equal(
      0
    );

    txn = await WavePortal7.checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[4].address, 1)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[5].address, 1)).to.equal(
      txn.id.toNumber()
    );

    txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[6].address, 1)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[7].address, 1)).to.equal(
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
      .addFamilyMember(accounts[6].address);
    txn = await instance2
      .connect(accounts[3])
      .addFamilyMember(accounts[7].address);

    await expect(
      instance.connect(accounts[1]).addFamilyMember(accounts[6].address)
    ).to.reverted;
    await expect(
      instance.connect(accounts[0]).addFamilyMember(accounts[7].address)
    ).to.reverted;

    txn = await WavePortal7.connect(accounts[6]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[7]).joinFamily(2);

    await expect(
      instance.connect(accounts[1]).addFamilyMember(accounts[6].address)
    ).to.reverted;
    await expect(
      instance.connect(accounts[0]).addFamilyMember(accounts[7].address)
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
      .addFamilyMember(accounts[6].address);
    txn = await instance2
      .connect(accounts[3])
      .addFamilyMember(accounts[7].address);

    txn = await WavePortal7.connect(accounts[6]).joinFamily(1);
    txn = await WavePortal7.connect(accounts[7]).joinFamily(1);

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[6].address);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[7].address);
    txn = await WavePortal7.checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[6].address, 0)).to.equal(
      txn.id.toNumber()
    );
    await expect(await WavePortal7.member(accounts[7].address, 0)).to.equal(
      txn.id.toNumber()
    );
  });

  it("Invited Family Members cannot claim LOVE token before joining", async function () {
    const { WavePortal7, instance, accounts, WaverImplementation } =
      await loadFixture(deployTokenFixture);

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address);

    await expect(WavePortal7.connect(accounts[4]).claimToken()).to.reverted;
    await expect(WavePortal7.connect(accounts[5]).claimToken()).to.reverted;
  });

  it("Invited Family Members can claim LOVE token after joining", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address);

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
      .addFamilyMember(accounts[4].address);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address);

    txn = await WavePortal7.connect(accounts[4]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(2);

    txn = await WavePortal7.connect(accounts[4]).checkMarriageStatus();

    const instance2 = await WaverImplementation.attach(txn.marriageContract);
    await expect(
      instance2.connect(accounts[4]).addFamilyMember(accounts[6].address)
    ).to.reverted;
    await expect(
      instance2.connect(accounts[5]).addFamilyMember(accounts[7].address)
    ).to.reverted;
  });

  it("Partners can delete invited and inviation accepted members. Deleted members lose access to proxy", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address);
    txn = await WavePortal7.checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[4].address, 0)).to.equal(
      txn.id.toNumber()
    );
    txn = await WavePortal7.connect(accounts[4]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[4]).checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[4].address, 1)).to.equal(
      txn.id.toNumber()
    );

    txn = await instance.connect(accounts[4]).getVotingStatuses(1);

    txn = await instance
      .connect(accounts[0])
      .deleteFamilyMember(accounts[4].address);
    await expect(await WavePortal7.member(accounts[4].address, 0)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[4].address, 1)).to.equal(
      0
    );
    await expect(instance.connect(accounts[4]).getVotingStatuses(1)).to
      .reverted;

    txn = await instance
      .connect(accounts[1])
      .deleteFamilyMember(accounts[5].address);
    await expect(await WavePortal7.member(accounts[5].address, 0)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[5].address, 1)).to.equal(
      0
    );
  });

  it("Partners cannot delete invited members two times ", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address);
    txn = await WavePortal7.checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[4].address, 0)).to.equal(
      txn.id.toNumber()
    );
    txn = await WavePortal7.connect(accounts[4]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[4]).checkMarriageStatus();
    await expect(await WavePortal7.member(accounts[4].address, 1)).to.equal(
      txn.id.toNumber()
    );

    txn = await instance.connect(accounts[4]).getVotingStatuses(1);

    txn = await instance
      .connect(accounts[0])
      .deleteFamilyMember(accounts[4].address);
    await expect(await WavePortal7.member(accounts[4].address, 0)).to.equal(
      0
    );
    await expect(await WavePortal7.member(accounts[4].address, 1)).to.equal(
      0
    );
    await expect(instance.connect(accounts[4]).getVotingStatuses(1)).to
      .reverted;

    await expect(
      instance.connect(accounts[1]).deleteFamilyMember(accounts[4].address)
    ).to.reverted;
  });

  it("Partners cannot delete not invited members", async function () {
    const { instance, accounts } = await loadFixture(deployTokenFixture);

    await expect(
      instance.connect(accounts[1]).deleteFamilyMember(accounts[4].address)
    ).to.reverted;
  });

  it("Family members cannot delete other family members", async function () {
    const { WavePortal7, instance, accounts } = await loadFixture(
      deployTokenFixture
    );

    txn = await instance
      .connect(accounts[0])
      .addFamilyMember(accounts[4].address);
    txn = await instance
      .connect(accounts[1])
      .addFamilyMember(accounts[5].address);

    txn = await WavePortal7.connect(accounts[4]).joinFamily(2);
    txn = await WavePortal7.connect(accounts[5]).joinFamily(2);

    await expect(
      instance.connect(accounts[4]).deleteFamilyMember(accounts[5].address)
    ).to.reverted;
  });
});
