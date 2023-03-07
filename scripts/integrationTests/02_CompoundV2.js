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

let jsonRpcServer, deployment, cometAddress, myContractFactory, baseAssetAddress, 
wethAddress, txn, instance,
WavePortal7, WaverImplementation,nftContract,nftSplit, diamondInit, diamondLoupeFacet, DiamondCutFacet , CompoundV2Facet;

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

describe("Compound II Integration Test", function () {
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
      CETHAddress= networks[net].CETH;
      CUSDCAddress= networks[net].CUSDC;
      
    });
  
    beforeEach(async () => {
      //await resetForkedChain(hre, providerUrl, blockNumber);
      let WhiteListAddr = [];
      
    Contracts = await deployTest();
     
    CompoundV2Facet = await deploy('CompoundV2Facet',Contracts.forwarder.address,CompAddress);
      
      WhiteListAddr.push({
        ContractAddress: CompoundV2Facet.address,
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
      instance = await Contracts.WaverImplementation.attach(txn[0].marriageContract);
  
      txn = await instance.connect(Contracts.accounts[0])._claimToken();
      txn = await instance.connect(Contracts.accounts[1])._claimToken();
    });
    
    after(async () => {
      await jsonRpcServer.close();
    });
  
    it('Users Can connect CompoundV2 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: CompoundV2Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CompoundV2Facet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(CompoundV2Facet.address)
    });
  
    it('Third party Users cannot connect CompoundV2 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: CompoundV2Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CompoundV2Facet)
          })
        await expect(diamondCut.connect(Contracts.accounts[3]).diamondCut(cut,ZERO_ADDRESS, "0x")).to.reverted;
    });

    it('Users Can disconnect CompoundV2 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: CompoundV2Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CompoundV2Facet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(CompoundV2Facet.address);
        const stakeWETH = await ethers.getContractAt('CompoundV2Facet', instance.address);
        txn = await stakeWETH.claimComp()
        let remove = []; 
        remove.push({
            facetAddress: ZERO_ADDRESS,
            action: FacetCutAction.Remove,
            functionSelectors: getSelectors(CompoundV2Facet)
          })
        tx = await diamondCut.diamondCut(remove,ZERO_ADDRESS, "0x");
        txn = await instance.getAllConnectedApps();
        expect (txn).to.not.contain(CompoundV2Facet.address);
        await expect (stakeWETH.claimComp()).to.reverted;
    });

    it('Users can supply  ETH, USDC and get/redeem corresponding CTokens', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: CompoundV2Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CompoundV2Facet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        //Getting some WETH
        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const ceth = new ethers.Contract(CETHAddress, stdErc20Abi, signer);
        const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);
        const cusdc = new ethers.Contract(CUSDCAddress, stdErc20Abi, signer);
        let tx = await weth.deposit({ value: ethers.utils.parseEther('100') });
        await tx.wait(1);
        await seedWithBaseToken(instance.address, ethers.utils.parseUnits('10000',6));
        tx = await weth.transfer(instance.address, ethers.utils.parseEther('100'));
        await tx.wait(1);

        tx = await weth.callStatic.balanceOf(instance.address);
        tx = await usdc.callStatic.balanceOf(instance.address);

        //Supplying ETH
        txn = await instance
        .createProposal(
          0x2,
          810,
          CETHAddress,
          "0x0000000000000000000000000000000000000000",
          ethers.utils.parseEther('10'),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);

        const stakeETH = await ethers.getContractAt('CompoundV2Facet', instance.address);
        txn = await stakeETH.compoundV2Supply(1);
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(810);
        txn = await ceth.callStatic.balanceOf(instance.address);
       
        //Supplying USDC
        txn = await instance
        .createProposal(
          0x2,
          811,
          CUSDCAddress,
          usdcAddress,
          ethers.utils.parseUnits('10',6),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);

        const stakeUSDC = await ethers.getContractAt('CompoundV2Facet', instance.address);
        txn = await stakeUSDC.compoundV2Supply(2);
        txn = await instance.getVotingStatuses(1);
        expect(txn[1].voteStatus).to.equal(811);
        txn = await usdc.callStatic.balanceOf(instance.address);

        await advanceBlockHeight(1000);

        balanceCETH = await ceth.callStatic.balanceOf(instance.address);
        //Redeeming cETH
        txn = await instance
        .createProposal(
          0x2,
          812,
          "0x0000000000000000000000000000000000000000",
          CETHAddress,
          balanceCETH,
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);

        const RedeemEth = await ethers.getContractAt('CompoundV2Facet', instance.address);
        txn = await RedeemEth.compoundV2Supply(3);
        txn = await instance.getVotingStatuses(1);
        expect(txn[2].voteStatus).to.equal(812);
        txn = await ceth.callStatic.balanceOf(instance.address);


        //Redeeming cUSDC
        balanceCUSDC = await cusdc.callStatic.balanceOf(instance.address);
        txn = await instance
        .createProposal(
          0x2,
          814,
          usdcAddress,
          CUSDCAddress,
          balanceCUSDC,
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(4, 1, false);
        const RedeemUSDC = await ethers.getContractAt('CompoundV2Facet', instance.address);
        txn = await RedeemUSDC.compoundV2Supply(4);
        txn = await instance.getVotingStatuses(1);
        expect(txn[3].voteStatus).to.equal(814);
        txn = await usdc.callStatic.balanceOf(instance.address);
    });

    it('Users can borrow tokens with the colleteral they have supplied', async () => {
       const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: CompoundV2Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CompoundV2Facet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        //Getting some WETH
        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const ceth = new ethers.Contract(CETHAddress, stdErc20Abi, signer);
        const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);
        const cusdc = new ethers.Contract(CUSDCAddress, stdErc20Abi, signer);
        let tx = await weth.deposit({ value: ethers.utils.parseEther('100') });
        await tx.wait(1);
        await seedWithBaseToken(instance.address, ethers.utils.parseUnits('10000',6));
        tx = await weth.transfer(instance.address, ethers.utils.parseEther('100'));
        await tx.wait(1);

        tx = await weth.callStatic.balanceOf(instance.address);
        tx = await usdc.callStatic.balanceOf(instance.address);

         //Supplying ETH
         txn = await instance
         .createProposal(
           0x2,
           810,
           CETHAddress,
           "0x0000000000000000000000000000000000000000",
           ethers.utils.parseEther('10'),
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);
 
         const stakeETH = await ethers.getContractAt('CompoundV2Facet', instance.address);
         txn = await stakeETH.compoundV2Supply(1);
         txn = await instance.getVotingStatuses(1);
         expect(txn[0].voteStatus).to.equal(810);
         txn = await ceth.callStatic.balanceOf(instance.address);
        
         //Supplying USDC
         txn = await instance
         .createProposal(
           0x2,
           811,
           CUSDCAddress,
           usdcAddress,
           ethers.utils.parseUnits('1000',6),
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);
 
         const stakeUSDC = await ethers.getContractAt('CompoundV2Facet', instance.address);
         txn = await stakeUSDC.compoundV2Supply(2);
         txn = await instance.getVotingStatuses(1);
         expect(txn[1].voteStatus).to.equal(811);
         txn = await usdc.callStatic.balanceOf(instance.address);

         //Borrowing USDC 

         txn = await instance
         .createProposal(
           0x2,
           816,
           usdcAddress,
           CUSDCAddress,
           ethers.utils.parseUnits('100',6),
           100,
           false
         );

         txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);
         const borrowUSDC = await ethers.getContractAt('CompoundV2Facet', instance.address);
         txn = await borrowUSDC.compoundV2BorrowRepay(3);
         txn = await instance.getVotingStatuses(1);
         expect(txn[2].voteStatus).to.equal(816);

         //Borrowing ETH

         txn = await instance
         .createProposal(
           0x2,
           817,
           ZERO_ADDRESS,
           CETHAddress,
           ethers.utils.parseUnits('1',18),
           100,
           false
         );

         txn = await instance.connect(Contracts.accounts[1]).voteResponse(4, 1, false);
         const borrowETH = await ethers.getContractAt('CompoundV2Facet', instance.address);
         txn = await borrowETH.compoundV2BorrowRepay(4);
         txn = await instance.getVotingStatuses(1);
         expect(txn[3].voteStatus).to.equal(817);

         await advanceBlockHeight(1000);

           //Repaying USDC 

           const repayUSDC = await ethers.getContractAt('CompoundV2Facet', instance.address);
           outstandingUSDC = await repayUSDC.getborrowBalanceStored(CUSDCAddress);

           txn = await instance
           .createProposal(
             0x2,
             818,
             usdcAddress,
             CUSDCAddress,
             outstandingUSDC,
             100,
             false
           );
  
           txn = await instance.connect(Contracts.accounts[1]).voteResponse(5, 1, false);
           
           txn = await repayUSDC.compoundV2BorrowRepay(5);
           txn = await instance.getVotingStatuses(1);
           expect(txn[4].voteStatus).to.equal(818);
           txn = await repayUSDC.getborrowBalanceStored(CUSDCAddress);
  
           //Borrowing ETH
           const repayETH = await ethers.getContractAt('CompoundV2Facet', instance.address);
           outstandingETH = await repayETH.getborrowBalanceStored(CETHAddress);
  
           txn = await instance
           .createProposal(
             0x2,
             819,
             wethAddress,
             CETHAddress,
             outstandingETH,
             100,
             false
           );
  
           txn = await instance.connect(Contracts.accounts[1]).voteResponse(6, 1, false);
           txn = await repayETH.compoundV2BorrowRepay(6);
           txn = await instance.getVotingStatuses(1);
           expect(txn[5].voteStatus).to.equal(819);
           outstandingETH = await repayETH.getborrowBalanceStored(CUSDCAddress);
        
    });
  });