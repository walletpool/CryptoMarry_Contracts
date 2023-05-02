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
   ' function getUserAccountData(address user) external  view returns (uint256 totalCollateralETH,uint256 totalDebtETH,uint256 availableBorrowsETH,uint256 currentLiquidationThreshold,uint256 ltv,uint256 healthFactor)',
    ' function getReserveData(address asset) external view returns ( uint256 data,  uint128 liquidityIndex,uint128 variableBorrowIndex,uint128 currentLiquidityRate,uint128 currentVariableBorrowRate,uint128 currentStableBorrowRate,uint40 lastUpdateTimestamp,address aTokenAddress,address stableDebtTokenAddress,address variableDebtTokenAddress,address interestRateStrategyAddress,uint8 id)',
  'function principalBalanceOf(address user) external view returns (uint256)'
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
wethAddress, txn, instance, AaveV2Facet;

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

  
describe("AaveV2 Integration Test", function () {
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
      AaveV2ProviderAddress = networks[net].aaveV2Provider;
      wbtcAddress = networks[net].WBTC;
      
    });
  
    beforeEach(async () => {
      //await resetForkedChain(hre, providerUrl, blockNumber);
      let WhiteListAddr = [];
      
    Contracts = await deployTest();
     
    AaveV2Facet = await deploy('AaveV2Facet',Contracts.forwarder.address,AaveV2ProviderAddress, wethAddress);

      
      WhiteListAddr.push({
        ContractAddress: AaveV2Facet.address,
        Status: 1
      })
      txn = await Contracts.WavePortal7.whiteListAddr(WhiteListAddr);

      txn = await Contracts.WavePortal7.connect(Contracts.accounts[0]).propose(
        Contracts.accounts[1].address,
         "0x7465737400000000000000000000000000000000000000000000000000000000", 
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
      instance = await Contracts.WaverImplementation.attach(txn[0].marriageContract);
  
      txn = await instance.connect(Contracts.accounts[0])._claimToken();
      txn = await instance.connect(Contracts.accounts[1])._claimToken();
    });
    
    after(async () => {
      await jsonRpcServer.close();
    });
  
    it('Users can connect AaveV2 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: AaveV2Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(AaveV2Facet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(AaveV2Facet.address)
    });
  
    it('Third party Users cannot connect AaveV2 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: AaveV2Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(AaveV2Facet)
          })
        await expect(diamondCut.connect(Contracts.accounts[3]).diamondCut(cut,ZERO_ADDRESS, "0x")).to.reverted;
    });

    it('Users can disconnect AaveV2 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: AaveV2Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(AaveV2Facet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(AaveV2Facet.address);
        const instanceAaveV2 = await ethers.getContractAt('AaveV2Facet', instance.address);
        let remove = []; 
        remove.push({
            facetAddress: ZERO_ADDRESS,
            action: FacetCutAction.Remove,
            functionSelectors: getSelectors(AaveV2Facet)
          })
        tx = await diamondCut.diamondCut(remove,ZERO_ADDRESS, "0x");
        txn = await instance.getAllConnectedApps();
        expect (txn).to.not.contain(AaveV2Facet.address);
     //   await expect (instanceQuick.getPairAddressQuickSwap(usdcAddress,wethAddress)).to.reverted;
    });


    it('Users can deposit and withdraw assets on AaveV2', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: AaveV2Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(AaveV2Facet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);
        await seedWithBaseToken(instance.address, ethers.utils.parseUnits('10000',6));
        const instanceAaveV2 = await ethers.getContractAt('AaveV2Facet', instance.address);


        //Depositing USDC
        txn = await instance
        .createProposal(
           
          600,
          ZERO_ADDRESS,
          baseAssetAddress,
          ethers.utils.parseUnits('1000',6),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);

        txn = await instanceAaveV2.executeAaveV2(1); // voteID
    
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(600);

        txn = await usdc.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.equal(Number(ethers.utils.parseUnits('9000',6)));

        pool = await instanceAaveV2._getLendingPoolAndAToken(baseAssetAddress);
        const apoolusdc = new ethers.Contract(pool.aToken, stdErc20Abi, signer);
        txn = await apoolusdc.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.equal(Number(ethers.utils.parseUnits('1000',6)));



        //Depositing ETH
        txn = await instance
        .createProposal(
           
          601,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ethers.utils.parseUnits('5',18),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);

        txn = await instanceAaveV2.executeAaveV2(2); // voteID
    
        txn = await instance.getVotingStatuses(1);
        expect(txn[1].voteStatus).to.equal(601);

        pool = await instanceAaveV2._getLendingPoolAndAToken(wethAddress);
        const apoolweth = new ethers.Contract(pool.aToken, stdErc20Abi, signer);
        txn = await apoolweth.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.equal(Number(ethers.utils.parseUnits('5',18)));

        
        await advanceBlockHeight(1000);

        usdcTotal = await apoolusdc.callStatic.balanceOf(instance.address);
        wethTotal = await apoolweth.callStatic.balanceOf(instance.address);
        
    

         //Withdrawing USDC
         txn = await instance
         .createProposal(
            
           602,
           ZERO_ADDRESS,
           baseAssetAddress,
           usdcTotal,
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);
 
         txn = await instanceAaveV2.executeAaveV2(3); // voteID
     
         txn = await instance.getVotingStatuses(1);
         expect(txn[2].voteStatus).to.equal(602);
 
         txn = await usdc.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.greaterThan(Number(ethers.utils.parseUnits('10000',6)));


         //Withdrawing ETH
         txn = await instance
         .createProposal(
            
           603,
           ZERO_ADDRESS,
           ZERO_ADDRESS,
           ethers.utils.parseUnits('5',18),
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(4, 1, false);
 
         txn = await instanceAaveV2.executeAaveV2(4); // voteID
     
         txn = await instance.getVotingStatuses(1);
         expect(txn[3].voteStatus).to.equal(603);
 

      });

      it('Users can borrow and repay assets  to AaveV2', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: AaveV2Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(AaveV2Facet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);
        await seedWithBaseToken(instance.address, ethers.utils.parseUnits('10000',6));
        const instanceAaveV2 = await ethers.getContractAt('AaveV2Facet', instance.address);


        //Depositing USDC
        txn = await instance
        .createProposal(
           
          600,
          ZERO_ADDRESS,
          baseAssetAddress,
          ethers.utils.parseUnits('10000',6),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);

        txn = await instanceAaveV2.executeAaveV2(1); // voteID
    
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(600);

        txn = await usdc.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.equal(Number(ethers.utils.parseUnits('0',6)));

        
         DebtPool = await instanceAaveV2._getLendingPoolAndAToken(wethAddress);
        const apoolweth = new ethers.Contract(DebtPool.pool, stdErc20Abi, signer);
        txn = await apoolweth.callStatic.getUserAccountData(instance.address);

       
         //Borrowing WETH
         txn = await instance
         .createProposal(
            
           604,
           ZERO_ADDRESS,
           wethAddress,
           ethers.utils.parseUnits('2',18),
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);
 
         txn = await instanceAaveV2.executeAaveV2BorrowRepay(2,1); // voteID
     
         txn = await instance.getVotingStatuses(1);
         expect(txn[1].voteStatus).to.equal(604);
 
         txn = await weth.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.equal(Number(ethers.utils.parseUnits('2',18)));

         txn = await apoolweth.callStatic.getUserAccountData(instance.address);
         expect(txn.totalDebtETH).to.equal(ethers.utils.parseUnits('2',18))
 


         await advanceBlockHeight(1000);

         //Getting total amount + health factors and other
         txn = await apoolweth.callStatic.getUserAccountData(instance.address);
         expect(Number(txn.totalDebtETH)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('2',18)))
        
        //Getting principal amount
         txn = await apoolweth.callStatic.getReserveData(wethAddress);
         const stableDebtTokenAddress = new ethers.Contract(txn.stableDebtTokenAddress, stdErc20Abi, signer);
         txn = await stableDebtTokenAddress.callStatic.balanceOf(instance.address);


         //borrowing ETH
         txn = await instance
         .createProposal(
            
           605,
           ZERO_ADDRESS,
           ZERO_ADDRESS,
           ethers.utils.parseUnits('2',18),
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);
 
         txn = await instanceAaveV2.executeAaveV2BorrowRepay(3,1); // voteID
     
         txn = await instance.getVotingStatuses(1);
         expect(txn[2].voteStatus).to.equal(605);

         txn = await apoolweth.callStatic.getUserAccountData(instance.address);
         expect(Number(txn.totalDebtETH)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('4',18)))


          //Repaying with ETH all debt 
          debtNow = await stableDebtTokenAddress.callStatic.balanceOf(instance.address);
          txn = await instance
          .createProposal(
             
            607,
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            debtNow,
            100,
            false
          );
  
          txn = await instance.connect(Contracts.accounts[1]).voteResponse(4, 1, false);
  
          txn = await instanceAaveV2.executeAaveV2BorrowRepay(4,1); // voteID
      
          txn = await instance.getVotingStatuses(1);
          expect(txn[3].voteStatus).to.equal(607);

          txn = await apoolweth.callStatic.getUserAccountData(instance.address);
         // expect(Number(txn.totalDebtETH)).to.equal(Number(0))


      


      });

  
  });