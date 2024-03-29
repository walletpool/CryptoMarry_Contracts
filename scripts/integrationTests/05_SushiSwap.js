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


const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
const blockNumber = hre.config.networks.hardhat.forking.blockNumber;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let Contracts = {}

let jsonRpcServer, cometAddress, baseAssetAddress, 
wethAddress, txn, instance, SushiSwapFacet;

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

  
describe("SushiSwap Integration Test", function () {
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
      SushiSwapRouterAddress = networks[net].SushiSwapRouter;
      wbtcAddress = networks[net].WBTC;
      
    });
  
    beforeEach(async () => {
      //await resetForkedChain(hre, providerUrl, blockNumber);
      let WhiteListAddr = [];
      
    Contracts = await deployTest();
     
    SushiSwapFacet = await deploy('SushiSwapFacet',Contracts.forwarder.address,SushiSwapRouterAddress);

      
      WhiteListAddr.push({
        ContractAddress: SushiSwapFacet.address,
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
  
    it('Users can connect SushiSwap App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: SushiSwapFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(SushiSwapFacet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(SushiSwapFacet.address)
    });
  
    it('Third party Users cannot connect SushiSwap App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: SushiSwapFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(SushiSwapFacet)
          })
        await expect(diamondCut.connect(Contracts.accounts[3]).diamondCut(cut,ZERO_ADDRESS, "0x")).to.reverted;
    });

    it('Users can disconnect SushiSwap App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: SushiSwapFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(SushiSwapFacet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(SushiSwapFacet.address);
        const instanceSushi = await ethers.getContractAt('SushiSwapFacet', instance.address);
        txn = await instanceSushi.getPairAddressSushi(usdcAddress,wethAddress)
        let remove = []; 
        remove.push({
            facetAddress: ZERO_ADDRESS,
            action: FacetCutAction.Remove,
            functionSelectors: getSelectors(SushiSwapFacet)
          })
        tx = await diamondCut.diamondCut(remove,ZERO_ADDRESS, "0x");
        txn = await instance.getAllConnectedApps();
        expect (txn).to.not.contain(SushiSwapFacet.address);
        await expect (instanceSushi.getPairAddressSushi(usdcAddress,wethAddress)).to.reverted;
    });



    it('Users can swap assets on SushiSwap', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: SushiSwapFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(SushiSwapFacet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);


        //Swapping exact ETH to USDC 
        txn = await instance
        .createProposal(
          0x2,
          520,
          baseAssetAddress,
          wethAddress,
          ethers.utils.parseUnits('1',18),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);

        const swapETH = await ethers.getContractAt('SushiSwapFacet', instance.address);

        path = [wethAddress,baseAssetAddress]

        txn = await swapETH.executeSushiSwap(1,ethers.utils.parseUnits('1548',6),path); // voteID, MinimumAmount, fee=3000, 0
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(520);

        txn = await usdc.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('1548',6)));

         //Swapping ETH to exact USDC 
         txn = await instance
         .createProposal(
           0x2,
           521,
           baseAssetAddress,
           wethAddress,
           ethers.utils.parseUnits('2000',6),
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);
 
         const swapETHUSDC = await ethers.getContractAt('SushiSwapFacet', instance.address);
 
         path = [wethAddress,baseAssetAddress]
 
         txn = await swapETHUSDC.executeSushiSwap(2,ethers.utils.parseUnits("1.65",18),path); // voteID, MinimumAmount, fee=3000, 0
         txn = await instance.getVotingStatuses(1);
         expect(txn[1].voteStatus).to.equal(521);
 
         txn = await usdc.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('2000',6)));

        //Swapping USDC to ETH 
        txn = await instance
        .createProposal(
          0x2,
          522,
          wethAddress,
          baseAssetAddress,
          ethers.utils.parseUnits("780",6),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);

        const swapUSDC = await ethers.getContractAt('SushiSwapFacet', instance.address);
        path = [baseAssetAddress,wethAddress]
        txn = await swapUSDC.executeSushiSwap(3, ethers.utils.parseUnits("0.5",18),path); // voteID, MinimumAmount
        txn = await instance.getVotingStatuses(1);
        expect(txn[2].voteStatus).to.equal(522);
        txn = await usdc.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('1220',6)));

         //Swapping USDC to ETH 
         txn = await instance
         .createProposal(
           0x2,
           523,
           wethAddress,
           baseAssetAddress,
           ethers.utils.parseUnits("0.5",18),
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(4, 1, false);
 
         const swapUSDCETH = await ethers.getContractAt('SushiSwapFacet', instance.address);
         path = [baseAssetAddress,wethAddress]
         txn = await swapUSDCETH.executeSushiSwap(4, ethers.utils.parseUnits("800",6),path); // voteID, MinimumAmount
         txn = await instance.getVotingStatuses(1);
         expect(txn[3].voteStatus).to.equal(523);
         txn = await usdc.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('780',6)));

           //Swapping USDC to WETH 
           txn = await instance
           .createProposal(
             0x2,
             524,
             wethAddress,
             baseAssetAddress,
             ethers.utils.parseUnits('390',6),
             100,
             false
           );
   
           txn = await instance.connect(Contracts.accounts[1]).voteResponse(5, 1, false);
   
           const swapeUSDCWETH = await ethers.getContractAt('SushiSwapFacet', instance.address);
           path = [baseAssetAddress,wethAddress]
           txn = await swapeUSDCWETH.executeSushiSwap(5,  ethers.utils.parseUnits('0.25',18),path); // voteID, MinimumAmount
           
           txn = await instance.getVotingStatuses(1);
           expect(txn[4].voteStatus).to.equal(524);

           txn = await usdc.callStatic.balanceOf(instance.address);
           expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('500',6)));
           txn = await weth.callStatic.balanceOf(instance.address);
           expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('0.25',18)));

         //Swapping USDC to WETH 
         txn = await instance
         .createProposal(
           0x2,
           525,
           wethAddress,
           baseAssetAddress,
           ethers.utils.parseUnits('0.25',18),
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(6, 1, false);
         path = [baseAssetAddress,wethAddress]
 
         const swapUSDCWETH = await ethers.getContractAt('SushiSwapFacet', instance.address);
         txn = await swapUSDCWETH.executeSushiSwap(6, ethers.utils.parseUnits('390',6), path); // voteID, MinimumAmount, fee=3000, 0
         txn = await instance.getVotingStatuses(1);
         expect(txn[5].voteStatus).to.equal(525);
         txn = await usdc.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('100',6)));
         txn = await weth.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('0.5',18)));
   
      });

      it('Users can supply assets to SushiSwap', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: SushiSwapFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(SushiSwapFacet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);
        


        //Swapping exact ETH to USDC 
        txn = await instance
        .createProposal(
          0x2,
          520,
          baseAssetAddress,
          wethAddress,
          ethers.utils.parseUnits('2',18),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);

        const swapETH = await ethers.getContractAt('SushiSwapFacet', instance.address);

        path = [wethAddress,baseAssetAddress]

        txn = await swapETH.executeSushiSwap(1,ethers.utils.parseUnits('3096',6),path); // voteID, MinimumAmount, fee=3000, 0
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(520);

        txn = await usdc.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('3000',6)));

         //Supplying to ETH/USDC Pool
         resp = await instance
         .createProposal(
           0x2,
           526,
           wethAddress,
           baseAssetAddress,
           ethers.utils.parseUnits('1',18),
           ethers.utils.parseUnits('1540',6),
           false
         );

 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);
 
         const supplyETHUSDC = await ethers.getContractAt('SushiSwapFacet', instance.address);
 
         txn = await supplyETHUSDC.sushiAddLiquidityETH(2,ethers.utils.parseUnits("0.9",18),ethers.utils.parseUnits("1440",6)); // voteID, MinimumAmount, fee=3000, 0
         txn = await instance.getVotingStatuses(1);
         expect(txn[1].voteStatus).to.equal(526);
 
         txn = await usdc.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('1500',6)));

             //Swapping USDC to WETH 
           txn = await instance
           .createProposal(
             0x2,
             524,
             wethAddress,
             baseAssetAddress,
             ethers.utils.parseUnits('500',6),
             100,
             false
           );
   
           txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);
   
           const swapeUSDCWETH = await ethers.getContractAt('SushiSwapFacet', instance.address);
           path = [baseAssetAddress,wethAddress]
           txn = await swapeUSDCWETH.executeSushiSwap(3,  ethers.utils.parseUnits('0.3',18),path); // voteID, MinimumAmount
           
           txn = await instance.getVotingStatuses(1);
           expect(txn[2].voteStatus).to.equal(524);

           txn = await usdc.callStatic.balanceOf(instance.address);
           expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('900',6)));

           txn = await weth.callStatic.balanceOf(instance.address);
           expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('0.25',18)));


           //Supplying to WETH/USDC Pool
         txn = await instance
         .createProposal(
           0x2,
           527,
           wethAddress,
           baseAssetAddress,
           ethers.utils.parseUnits('145',6),
           ethers.utils.parseUnits('0.1',18),
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(4, 1, false);
 
         const supplyWETHUSDC = await ethers.getContractAt('SushiSwapFacet', instance.address);
 
         txn = await supplyWETHUSDC.sushiAddLiquidity(4,ethers.utils.parseUnits("140",6),ethers.utils.parseUnits("0.09",18)); // voteID, MinimumAmount, fee=3000, 0
         txn = await instance.getVotingStatuses(1);
         expect(txn[3].voteStatus).to.equal(527);
 
         txn = await usdc.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('800',6)));

         await advanceBlockHeight(5000);

         const removeLiqETH = await ethers.getContractAt('SushiSwapFacet', instance.address);

         pair = await removeLiqETH.callStatic.getPairAddressSushi(baseAssetAddress,wethAddress);
         const liq = new ethers.Contract(pair, stdErc20Abi, signer);

         liquidity = await liq.callStatic.balanceOf(instance.address);

         //Remove liquidity ETH
      
         txn = await instance
         .createProposal(
           0x2,
           528,
           wethAddress,
           baseAssetAddress,
           liquidity,
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(5, 1, false);
 
         txn = await removeLiqETH.sushiRemoveLiquidityETH(5,ethers.utils.parseUnits("1600",6),ethers.utils.parseUnits("1.02",18)); // voteID, MinimumAmount
         txn = await instance.getVotingStatuses(1);
         expect(txn[4].voteStatus).to.equal(528);
         txn = await usdc.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('800',6)));
         liquidity = await liq.callStatic.balanceOf(instance.address);

   
      });

  
  });