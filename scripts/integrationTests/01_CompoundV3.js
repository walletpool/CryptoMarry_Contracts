const { expect } = require("chai");
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const hre = require('hardhat');
const { ethers } = require("hardhat");
const { resetForkedChain } = require('./common.js');
const networks = require('./addresses.json');
const net = hre.config.cometInstance;
const { deployTest } = require('../deployForTest');
const { getSelectors, FacetCutAction } = require('../libraries/diamond.js')

const wethAbi = [
    'function deposit() payable',
    'function balanceOf(address) returns (uint)',
    'function approve(address, uint) returns (bool)',
    'function transfer(address, uint)',
  ];
  
  const stdErc20Abi = [
    'function approve(address, uint) returns (bool)',
    'function transfer(address, uint)',
    'function balanceOf(address) returns (uint)',
  ];
  

const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
const blockNumber = hre.config.networks.hardhat.forking.blockNumber;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let jsonRpcServer, deployment, cometAddress, myContractFactory, baseAssetAddress, 
wethAddress, txn,CompoundV3FacetUSDC, instance,
WavePortal7, WaverImplementation,nftContract, allAccounts,nftSplit, diamondInit, diamondLoupeFacet, DiamondCutFacet , CompoundFacet, forwarder;

const mnemonic = hre.network.config.accounts.mnemonic;
const addresses = [];
const privateKeys = [];
for (let i = 0; i < 20; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`);
  addresses.push(wallet.address);
  privateKeys.push(wallet._signingKey().privateKey);
}

async function deploy(name, ...params) {
    const Contract = await ethers.getContractFactory(name);
    return await Contract.deploy(...params).then((f) => f.deployed());
  }

describe("Compound III Integration Test", function () {
    before(async () => {
      console.log('\n Running a hardhat local evm fork of a public net...\n');
  
      jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
        hostname: 'localhost',
        port: 8545,
        provider: hre.network.provider
      });
  
      await jsonRpcServer.listen();
  
      baseAssetAddress = networks[net].USDC;
      usdcAddress = baseAssetAddress;
      cometAddress = networks[net].comet;
      wethAddress = networks[net].WETH;
      
    });
  
    beforeEach(async () => {
      //await resetForkedChain(hre, providerUrl, blockNumber);
      let WhiteListAddr = [];
      
    const {WavePortal7, WaverImplementation,nftContract, accounts,nftSplit, diamondInit, diamondLoupeFacet, DiamondCutFacet , CompoundFacet, forwarder} = await deployTest();
    allAccounts = accounts;
      CompoundV3FacetUSDC = await deploy('CompoundV3FacetUSDC',forwarder.address,cometAddress);
      
      WhiteListAddr.push({
        ContractAddress: CompoundV3FacetUSDC.address,
        Status: 1
      })
      txn = await WavePortal7.whiteListAddr(WhiteListAddr);


      txn = await WavePortal7.connect(accounts[0]).propose(
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
      instance = await WaverImplementation.attach(txn[0].marriageContract);
  
      txn = await instance.connect(accounts[0])._claimToken();
      txn = await instance.connect(accounts[1])._claimToken();
    });
    
    after(async () => {
      await jsonRpcServer.close();
    });
  
    it('Users Can connect CompoundV3 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: CompoundV3FacetUSDC.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CompoundV3FacetUSDC)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(CompoundV3FacetUSDC.address)
    });
  
    it('Third party Users cannot connect CompoundV3 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: CompoundV3FacetUSDC.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CompoundV3FacetUSDC)
          })
        await expect(diamondCut.connect(allAccounts[3]).diamondCut(cut,ZERO_ADDRESS, "0x")).to.reverted;
    });

    it('Users Can disconnect CompoundV3 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: CompoundV3FacetUSDC.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CompoundV3FacetUSDC)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(CompoundV3FacetUSDC.address);
        let remove = []; 
        remove.push({
            facetAddress: ZERO_ADDRESS,
            action: FacetCutAction.Remove,
            functionSelectors: getSelectors(CompoundV3FacetUSDC)
          })
        tx = await diamondCut.diamondCut(remove,ZERO_ADDRESS, "0x");
        txn = await instance.getAllConnectedApps();
        expect (txn).to.not.contain(CompoundV3FacetUSDC.address);

    });

    it('Users can supply WETH and borrow USDC', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: CompoundV3FacetUSDC.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CompoundV3FacetUSDC)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        //Getting some WETH
        const signer = provider.getSigner(allAccounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);
        let tx = await weth.deposit({ value: ethers.utils.parseEther('100') });
        await tx.wait(1);

        tx = await weth.transfer(instance.address, ethers.utils.parseEther('10'));
        await tx.wait(1);

        txn = await instance
        .createProposal(
          0x2,
          800,
          "0x0000000000000000000000000000000000000000",
          wethAddress,
          ethers.utils.parseEther('8'),
          100,
          false
        );
        txn = await instance.connect(allAccounts[1]).voteResponse(1, 1, false);

        const stakeWETH = await ethers.getContractAt('CompoundV3FacetUSDC', instance.address);
        txn = await stakeWETH.executeSupplyCompoundV3USDC(1);
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(800);

        //borrowing USDC
        txn = await instance
        .createProposal(
          0x2,
          801,
          "0x0000000000000000000000000000000000000000",
          usdcAddress,
          ethers.utils.parseUnits("100",6),
          100,
          false
        );
        txn = await instance.connect(allAccounts[1]).voteResponse(2, 1, false);
        txn = await stakeWETH.executeSupplyCompoundV3USDC(2);
        txn = await instance.getVotingStatuses(1);
        expect(txn[1].voteStatus).to.equal(801);
        bal = await usdc.callStatic.balanceOf(instance.address);
        expect(bal).to.equal(ethers.utils.parseUnits("100",6))        
      
    });
  });