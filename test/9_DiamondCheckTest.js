/* eslint-disable prettier/prettier*/
/* eslint-disable no-undef */
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect,assert } = require("chai");
const { deployTest } = require('../scripts/deployForTest');
const {
  getSelectors,
  FacetCutAction,
  removeSelectors,
  findAddressPositionInFacets
} = require('../scripts/libraries/diamond.js')


describe("Testing Diamond Facets", function () {

  let DiamondCutFacet
  let diamondLoupeFacet
  let UniSwapFacet
  let CompoundFacet
  let tx
  let receipt
  let result
  const addresses = []

  async function deployTokenFixture() {
  
    const {WavePortal7, WaverImplementation,nftContract,accounts, nftSplit,diamondInit}  = await deployTest();

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

    txn = await WavePortal7.connect(accounts[2]).propose(
      accounts[3].address,
      "0x49206c6f766520796f7520736f206d75636821", 
      0, 
      86400,
      9,
      1,
       
      {
        value: hre.ethers.utils.parseEther("10"),
      }
    );
    txn = await WavePortal7.checkMarriageStatus(2);
    const instance = await WaverImplementation.attach(txn[0].marriageContract);

    console.log('Deploying facets');
  const FacetNames = [
    'DiamondLoupeFacet',
    'CompoundFacet',
    'UniSwapFacet'
  ]
  const cut = []
  for (const FacetName of FacetNames) {
    const Facet = await ethers.getContractFactory(FacetName)
    let facet;
    if (FacetName ==  'UniSwapFacet') { 
      facet = await Facet.deploy("0xE592427A0AEce92De3Edee1F18E0157C05861564","0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6","0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6")
    } else {facet = await Facet.deploy("0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6")}
    await facet.deployed()
    console.log(`${FacetName} deployed: ${facet.address}`)
    const txn = await WavePortal7.whiteListAddr([{ContractAddress: facet.address, Status: 1 }])
    cut.push({
      facetAddress: facet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet)
    })
  }
  
  const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
  let tx;
  let receipt;
  // call to init function
  let functionCall = diamondInit.interface.encodeFunctionData('init');
  tx = await diamondCut.diamondCut(cut, diamondInit.address, functionCall);
  console.log('Diamond cut tx: ', tx.hash)
  receipt = await tx.wait()
  if (!receipt.status) {
    throw Error(`Diamond upgrade failed: ${tx.hash}`)
  }


   txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus(1);
   const instance2 = await WaverImplementation.attach(txn[0].marriageContract);

  DiamondCutFacet = await ethers.getContractAt('DiamondCutFacet', instance.address)
  diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', instance.address)
  UniSwapFacet = await ethers.getContractAt('UniSwapFacet', instance.address)
  CompoundFacet = await ethers.getContractAt('CompoundFacet', instance.address)

   
    return { WavePortal7, WaverImplementation, accounts,instance,instance2,DiamondCutFacet,diamondLoupeFacet,UniSwapFacet,CompoundFacet };
  }

  it("Four facets have to be registered", async function () {
    const {diamondLoupeFacet } = await loadFixture(deployTokenFixture);

    for (const address of await diamondLoupeFacet.facetAddresses()) {
      addresses.push(address)
    }
    assert.equal(addresses.length, 4)
  });

  it("Other implementations do not have any functions", async function () {
    const {instance2 } = await loadFixture(deployTokenFixture);
    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', instance2.address)
    await expect ( diamondLoupeFacet.facetAddresses()).to.reverted

  });
 
  it('Facets should have the right function selectors -- call to facetFunctionSelectors function', async () => {
    const {DiamondCutFacet,diamondLoupeFacet,UniSwapFacet,CompoundFacet} = await loadFixture(deployTokenFixture);
    
    let selectors = getSelectors(DiamondCutFacet)

    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[0])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(diamondLoupeFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[1])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(CompoundFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[2])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(UniSwapFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3])
    assert.sameMembers(result, selectors)
    
  })

  it('selectors should be associated to facets correctly -- multiple calls to facetAddress function', async () => {
    const {DiamondCutFacet,diamondLoupeFacet,UniSwapFacet,CompoundFacet} = await loadFixture(deployTokenFixture);
    const selectors = getSelectors(UniSwapFacet);
    console.log("UNISWAP SELECTORS", selectors)
    assert.equal(
      addresses[1],
      await diamondLoupeFacet.facetAddress('0xcdffacc6')
    )
    assert.equal(
      addresses[2],
      await diamondLoupeFacet.facetAddress('0x62fe52ed')
    )
    assert.equal(
      addresses[3],
      await diamondLoupeFacet.facetAddress('0x5358fbda')
    )
    assert.equal(
      addresses[3],
      await diamondLoupeFacet.facetAddress('0xecbe78d5')
    )
  })

  it('Connected modules (facets) have true statuses and not connected modules have false statuses ', async () => {
    const {instance,accounts,UniSwapFacet,CompoundFacet} = await loadFixture(deployTokenFixture);

    await expect (await instance.checkAppConnected(addresses[1])).to.equal(true);
    await expect (await instance.checkAppConnected(addresses[2])).to.equal(true);
    await expect (await instance.checkAppConnected(addresses[3])).to.equal(true);
    await expect (await instance.checkAppConnected(accounts[4].address)).to.equal(false);
    await expect (await instance.checkAppConnected(accounts[5].address)).to.equal(false);
  })
 

  it('Disconnected (removed) modules (facets) turn their status to false', async () => {
    const {instance,accounts,UniSwapFacet,CompoundFacet} = await loadFixture(deployTokenFixture);
    await expect (await instance.checkAppConnected(addresses[2])).to.equal(true);
    const selectors = getSelectors(CompoundFacet);
    console.log("SELECTORS", selectors)
    tx = await DiamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }

    await expect (await instance.checkAppConnected(addresses[2])).to.equal(false);
  })

  it('Third parties cannot Disconnect (remove) modules (facets)', async () => {
    const {instance,accounts,UniSwapFacet,CompoundFacet} = await loadFixture(deployTokenFixture);
    await expect (await instance.checkAppConnected(addresses[2])).to.equal(true);
    const selectors = getSelectors(CompoundFacet);
    await expect (DiamondCutFacet.connect(accounts[4]).diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })).to.reverted;
    })

});
