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

  let diamondCutFacet
  let diamondLoupeFacet
  let UniswapFacet
  let CompoundFacet
  let tx
  let receipt
  let result
  const addresses = []

  async function deployTokenFixture() {
  
    const {WavePortal7, WaverImplementation,nftContract,accounts, nftSplit,diamondInit}  = await deployTest();

    txn = await WavePortal7.propose(
      accounts[1].address,
      "I love you so much!!!",
      0,
      { value: hre.ethers.utils.parseEther("100") }
    );

    txn = await WavePortal7.connect(accounts[2]).propose(
      accounts[3].address,
      "Let's do it",
      0,
      { value: hre.ethers.utils.parseEther("100") }
    );
    txn = await WavePortal7.checkMarriageStatus();
    const instance = await WaverImplementation.attach(txn.marriageContract);

    console.log('Deploying facets');
  const FacetNames = [
    'DiamondLoupeFacet',
    'CompoundFacet',
    'UniSwapFacet'
  ]
  const cut = []
  for (const FacetName of FacetNames) {
    const Facet = await ethers.getContractFactory(FacetName)
    const facet = await Facet.deploy()
    await facet.deployed()
    console.log(`${FacetName} deployed: ${facet.address}`)
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


  txn = await WavePortal7.connect(accounts[2]).checkMarriageStatus();
  const instance2 = await WaverImplementation.attach(txn.marriageContract);

  diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', instance.address)
  diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', instance.address)
  UniswapFacet = await ethers.getContractAt('UniSwapFacet', instance.address)
  CompoundFacet = await ethers.getContractAt('CompoundFacet', instance.address)

   
    return { WavePortal7, WaverImplementation, accounts,instance,instance2,diamondCutFacet,diamondLoupeFacet,UniswapFacet,CompoundFacet };
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
    const {diamondCutFacet,diamondLoupeFacet,UniswapFacet,CompoundFacet} = await loadFixture(deployTokenFixture);
    
    let selectors = getSelectors(diamondCutFacet)

    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[0])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(diamondLoupeFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[1])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(CompoundFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[2])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(UniswapFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3])
    assert.sameMembers(result, selectors)
    
  })

  it('selectors should be associated to facets correctly -- multiple calls to facetAddress function', async () => {
    const {diamondCutFacet,diamondLoupeFacet,UniswapFacet,CompoundFacet} = await loadFixture(deployTokenFixture);
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
      await diamondLoupeFacet.facetAddress('0xa63275e7')
    )
    assert.equal(
      addresses[3],
      await diamondLoupeFacet.facetAddress('0x162bcf14')
    )
  })
 

});
