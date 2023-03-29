//This Test should be run on polygon

const { expect } = require("chai");
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const hre = require('hardhat');
const { ethers } = require("hardhat");
const { resetForkedChain } = require('./common.js');
const networks = require('./addresses.json');
const net = hre.config.cometInstance;
const { deployTest } = require('../deployForTest');
const { getSelectors, FacetCutAction } = require('../libraries/diamond.js');
const { zeroPad } = require("ethers/lib/utils.js");

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

  const cometAbi = [
    'event Supply(address indexed from, address indexed dst, uint256 amount)',
    'function supply(address asset, uint amount)',
    'function withdraw(address asset, uint amount)',
    'function balanceOf(address account) returns (uint256)',
    'function accrueAccount(address account)',
    'function borrowBalanceOf(address account) returns (uint256)',
    'function collateralBalanceOf(address account, address asset) external view returns (uint128)',
  ];


const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
const blockNumber = hre.config.networks.hardhat.forking.blockNumber;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let Contracts = {}

let jsonRpcServer, baseAssetAddress, 
wethAddress, txn, instance, YearnFacet;

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

async function advanceBlockHeight(blocks) {
    const txns = [];
    for (let i = 0; i < blocks; i++) {
      txns.push(hre.network.provider.send('evm_mine'));
    }
    await Promise.all(txns);
  }

  // Test account index 9 uses Comet to borrow and then seed the toAddress with tokens
async function seedWithBaseToken(toAddress, amt) {
  const baseTokenDecimals = 6; // USDC
  const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
  const signer = provider.getSigner(addresses[9]);
  const comet = new ethers.Contract(cometAddress, cometAbi, signer);
  const weth = new ethers.Contract(wethAddress, wethAbi, signer);
  const usdc = new ethers.Contract(usdcAddress, stdErc20Abi, signer);

  let tx = await weth.deposit({ value: ethers.utils.parseEther('100') });
  await tx.wait(1);

  tx = await weth.approve(cometAddress, ethers.constants.MaxUint256);
  await tx.wait(1);

  tx = await comet.supply(wethAddress, ethers.utils.parseEther('100'));
  await tx.wait(1);

  // baseBorrowMin is 1000 USDC
  tx = await comet.withdraw(usdcAddress, (10000 * 1e6).toString());
  await tx.wait(1);

  // transfer from this account to the main test account (0th)
  tx = await usdc.transfer(toAddress, (amt).toString());
  await tx.wait(1);

  return;
}

  
describe("Yearn Integration Test", function () {
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
      rewardsCOMP = networks[net].rewards;
      CompAddress = networks[net].comptroller;
      USDCYVaultAddress = networks[net].USDCYVault;
      ETHYVaultAddress = networks[net].ETHYVault;
      
    });
  
    beforeEach(async () => {
      //await resetForkedChain(hre, providerUrl, blockNumber);
      let WhiteListAddr = [];
      
    Contracts = await deployTest();
     
    YearnFacet = await deploy('YearnFacet',Contracts.forwarder.address);

      
      WhiteListAddr.push({
        ContractAddress: YearnFacet.address,
        Status: 1
      })
      txn = await Contracts.WavePortal7.whiteListAddr(WhiteListAddr);

      txn = await Contracts.WavePortal7.connect(Contracts.accounts[0]).propose(
        Contracts.accounts[1].address,
         "0x49206c6f766520796f7520736f206d75636821", 
        0, 
        86400,
        5,
        1,
        {
          value: hre.ethers.utils.parseEther("10"),
        }
      );
      txn = await Contracts.WavePortal7.connect(Contracts.accounts[1]).response(1, 0, 1);
      txn = await Contracts.WavePortal7.checkMarriageStatus(1);
      instance = await hre.ethers.getContractAt("WaverIDiamond", txn[0].marriageContract);
  
      txn = await instance.connect(Contracts.accounts[0])._claimToken();
      txn = await instance.connect(Contracts.accounts[1])._claimToken();
    });
    
    after(async () => {
      await jsonRpcServer.close();
    });
  
    it('Users can connect Yearn App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: YearnFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(YearnFacet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(YearnFacet.address)
    });
  
    it('Third party Users cannot connect Yearn App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: YearnFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(YearnFacet)
          })
        await expect(diamondCut.connect(Contracts.accounts[3]).diamondCut(cut,ZERO_ADDRESS, "0x")).to.reverted;
    });

    it('Users can disconnect Yearn App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: YearnFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(YearnFacet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(YearnFacet.address);
        const instanceYearn = await ethers.getContractAt('YearnFacet', instance.address);
        let remove = []; 
        remove.push({
            facetAddress: ZERO_ADDRESS,
            action: FacetCutAction.Remove,
            functionSelectors: getSelectors(YearnFacet)
          })
        tx = await diamondCut.diamondCut(remove,ZERO_ADDRESS, "0x");
        txn = await instance.getAllConnectedApps();
        expect (txn).to.not.contain(YearnFacet.address);
     //   await expect (instanceQuick.getPairAddressQuickSwap(usdcAddress,wethAddress)).to.reverted;
    });


    it('Users can deposit and withdraw assets on Yearn', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: YearnFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(YearnFacet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);
        const yusdc = new ethers.Contract(USDCYVaultAddress, stdErc20Abi, signer);
        const yeth = new ethers.Contract(ETHYVaultAddress, stdErc20Abi, signer);
        await seedWithBaseToken(instance.address, ethers.utils.parseUnits('10000',6));
        const instanceYearn = await ethers.getContractAt('YearnFacet', instance.address);


        //Depositing USDC
        txn = await instance
        .createProposal(
          0x2,
          210,
          USDCYVaultAddress,
          baseAssetAddress,
          ethers.utils.parseUnits('1000',6),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);

        txn = await instanceYearn.executeYearn(1); // voteID
    
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(210);

        txn = await usdc.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.equal(Number(ethers.utils.parseUnits('9000',6)));
        txn = await yusdc.callStatic.balanceOf(instance.address);
        console.log("YUSDC", txn)


        //Depositing ETH
        txn = await instance
        .createProposal(
          0x2,
          211,
          ETHYVaultAddress,
          ZERO_ADDRESS,
          ethers.utils.parseUnits('1',18),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);
        //txn = await instanceYearn.executeYearn(2); // voteID
    
        txn = await instance.getVotingStatuses(1);
        //expect(txn[1].voteStatus).to.equal(211);
        txn = await yeth.callStatic.balanceOf(instance.address);

      
        
        await advanceBlockHeight(1000);

        usdcTotal = await yusdc.callStatic.balanceOf(instance.address);
        // wethTotal = await apoolweth.callStatic.balanceOf(instance.address);
        
         //Withdrawing USDC
         txn = await instance
         .createProposal(
           0x2,
           212,
           USDCYVaultAddress,
           baseAssetAddress,
           usdcTotal,
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);
 
         txn = await instanceYearn.executeYearn(3); // voteID
     
         txn = await instance.getVotingStatuses(1);
         expect(txn[2].voteStatus).to.equal(212);
 
         txn = await usdc.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.greaterThan(Number(ethers.utils.parseUnits('10000',6)));
         txn = await yusdc.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.equal(Number(0));


        //  //Withdrawing ETH
        //  txn = await instance
        //  .createProposal(
        //    0x2,
        //    603,
        //    ZERO_ADDRESS,
        //    ZERO_ADDRESS,
        //    ethers.utils.parseUnits('5',18),
        //    100,
        //    false
        //  );
 
        //  txn = await instance.connect(Contracts.accounts[1]).voteResponse(4, 1, false);
 
        //  txn = await instanceYearn.executeYearn(4); // voteID
     
        //  txn = await instance.getVotingStatuses(1);
        //  expect(txn[3].voteStatus).to.equal(603);
 

      });

  
  });