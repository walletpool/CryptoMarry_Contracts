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

let jsonRpcServer, cometAddress, baseAssetAddress, 
wethAddress, txn, instance, UniSwapV3Facet;

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

  
describe("Uniswap V3 Integration Test", function () {
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
      UniswapRouterAddress = networks[net].uniswapRouter;
      wbtcAddress = networks[net].WBTC;
      
    });
  
    beforeEach(async () => {
      //await resetForkedChain(hre, providerUrl, blockNumber);
      let WhiteListAddr = [];
      
    Contracts = await deployTest();
     
    UniSwapV3Facet = await deploy('UniSwapV3Facet',Contracts.forwarder.address,UniswapRouterAddress, wethAddress);

      
      WhiteListAddr.push({
        ContractAddress: UniSwapV3Facet.address,
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
  
    it('Users Can connect UniswapV3 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: UniSwapV3Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(UniSwapV3Facet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(UniSwapV3Facet.address)
    });
  
    it('Third party Users cannot connect UniswapV3 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: UniSwapV3Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(UniSwapV3Facet)
          })
        await expect(diamondCut.connect(Contracts.accounts[3]).diamondCut(cut,ZERO_ADDRESS, "0x")).to.reverted;
    });

    it('Users can disconnect UniswapV3 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: UniSwapV3Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(UniSwapV3Facet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(UniSwapV3Facet.address);
        const UniswapFacet = await ethers.getContractAt('UniSwapV3Facet', instance.address);
        //txn = await UniswapFacet.withdrawWeth(0)
        let remove = []; 
        remove.push({
            facetAddress: ZERO_ADDRESS,
            action: FacetCutAction.Remove,
            functionSelectors: getSelectors(UniSwapV3Facet)
          })
        tx = await diamondCut.diamondCut(remove,ZERO_ADDRESS, "0x");
        txn = await instance.getAllConnectedApps();
        expect (txn).to.not.contain(UniSwapV3Facet.address);
        //await expect (stakeWETH.withdrawWeth(0)).to.reverted;
    });

    it('Users can swap assets on UniswapV3 --> Exact Amount Out', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: UniSwapV3Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(UniSwapV3Facet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);


        //Swapping ETH to USDC 
        txn = await instance
        .createProposal(
          0x2,
          107,
          baseAssetAddress,
          "0x0000000000000000000000000000000000000000",
          ethers.utils.parseUnits('2000',6),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);

        const swapETH = await ethers.getContractAt('UniSwapV3Facet', instance.address);
        txn = await swapETH.executeUniSwapOutput(1,ethers.utils.parseUnits('1.3',18),3000,0); // voteID, MinimumAmount, fee=3000, 0
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(107);

        txn = await usdc.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.equal(Number(ethers.utils.parseUnits('2000',6)));

        //Swapping USDC to ETH 
        txn = await instance
        .createProposal(
          0x2,
          108,
          ZERO_ADDRESS,
          baseAssetAddress,
          ethers.utils.parseUnits('0.5',18),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);

        const swapUSDC = await ethers.getContractAt('UniSwapV3Facet', instance.address);
        txn = await swapUSDC.executeUniSwapOutput(2, ethers.utils.parseUnits('780',6),3000,0); // voteID, MinimumAmount, fee=3000, 0
        txn = await instance.getVotingStatuses(1);
        expect(txn[1].voteStatus).to.equal(108);
        txn = await usdc.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('1220',6)));

         //Swapping USDC to WETH 
         txn = await instance
         .createProposal(
           0x2,
           109,
           wethAddress,
           baseAssetAddress,
           ethers.utils.parseUnits('0.25',18),
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);
 
         const swapUSDCWETH = await ethers.getContractAt('UniSwapV3Facet', instance.address);
         txn = await swapUSDCWETH.executeUniSwapOutput(3,  ethers.utils.parseUnits('390',6),3000,0); // voteID, MinimumAmount, fee=3000, 0
         txn = await instance.getVotingStatuses(1);
         expect(txn[2].voteStatus).to.equal(109);
         txn = await usdc.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('830',6)));
         txn = await weth.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('0.25',18)));
   
   
      });

      it('Users can swap assets on UniswapV3 --> Exact Amount In', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: UniSwapV3Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(UniSwapV3Facet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        //Getting some WETH
        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);


        //Swapping ETH to USDC 
        txn = await instance
        .createProposal(
          0x2,
          101,
          baseAssetAddress,
          "0x0000000000000000000000000000000000000000",
          ethers.utils.parseEther('1'),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);

        const swapETH = await ethers.getContractAt('UniSwapV3Facet', instance.address);
        txn = await swapETH.executeUniSwap(1,ethers.utils.parseUnits('1549',6),3000,0); // voteID, MinimumAmount, fee=3000, 0
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(101);

        txn = await usdc.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('1549',6)));

        //Swapping USDC to ETH 
        txn = await instance
        .createProposal(
          0x2,
          102,
          ZERO_ADDRESS,
          baseAssetAddress,
          ethers.utils.parseUnits('780',6),
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);

        const swapUSDC = await ethers.getContractAt('UniSwapV3Facet', instance.address);
        txn = await swapUSDC.executeUniSwap(2, ethers.utils.parseEther('0.5'),3000,0); // voteID, MinimumAmount, fee=3000, 0
        txn = await instance.getVotingStatuses(1);
        expect(txn[1].voteStatus).to.equal(102);
        txn = await usdc.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('769',6)));

         //Swapping USDC to WETH 
         txn = await instance
         .createProposal(
           0x2,
           103,
           wethAddress,
           baseAssetAddress,
           ethers.utils.parseUnits('390',6),
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);
 
         const swapUSDCWETH = await ethers.getContractAt('UniSwapV3Facet', instance.address);
         txn = await swapUSDCWETH.executeUniSwap(3, ethers.utils.parseEther('0.25'),3000,0); // voteID, MinimumAmount, fee=3000, 0
         txn = await instance.getVotingStatuses(1);
         expect(txn[2].voteStatus).to.equal(103);
         txn = await usdc.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('378',6)));
         txn = await weth.callStatic.balanceOf(instance.address);
         expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('0.25',18)));   
    
        });

    it('Users can swap tokens through Multiple Pools', async () => {
      const cut = []
      const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
      const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
      cut.push({
          facetAddress: UniSwapV3Facet.address,
          action: FacetCutAction.Add,
          functionSelectors: getSelectors(UniSwapV3Facet)
        })
      txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

      //Getting some WETH
      const signer = provider.getSigner(Contracts.accounts[0].address);
      const weth = new ethers.Contract(wethAddress, wethAbi, signer);
      const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);

      //Swapping ETH to USDC 
      txn = await instance
      .createProposal(
        0x2,
        104,
        baseAssetAddress,
        wethAddress,
        ethers.utils.parseEther('1'),
        100,
        false
      );

      txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);

      const swapETH = await ethers.getContractAt('UniSwapV3Facet', instance.address);
    
     path =   ethers.utils.solidityPack(
    ["address", "uint24","address","uint24", "address"], // encode as address array
    [ wethAddress, 3000,wbtcAddress,3000,baseAssetAddress]) //addresses and fees

      txn = await swapETH.executeUniSwapMulti(1,path, ethers.utils.parseUnits('1547',6)); // voteID, path, MinimumAmount
      txn = await instance.getVotingStatuses(1);
      expect(txn[0].voteStatus).to.equal(104);

      txn = await usdc.callStatic.balanceOf(instance.address);
      expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('1547',6)));

      //Swapping USDC to ETH 
      txn = await instance
      .createProposal(
        0x2,
        105,
        wethAddress,
        baseAssetAddress,
        ethers.utils.parseUnits('780',6),
        100,
        false
      );

      txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);

      const swapUSDC = await ethers.getContractAt('UniSwapV3Facet', instance.address);

      path = ethers.utils.solidityPack(
        ["address", "uint24","address","uint24", "address"], // encode as address array
        [ baseAssetAddress, 3000,wbtcAddress,3000,wethAddress]) //addresses and fees
    
      txn = await swapUSDC.executeUniSwapMulti(2,path, ethers.utils.parseEther('0.40')); // voteID, MinimumAmount
      txn = await instance.getVotingStatuses(1);
      expect(txn[1].voteStatus).to.equal(105);
      txn = await usdc.callStatic.balanceOf(instance.address);
      expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('600',6)));

       //Swapping USDC to WETH 
       txn = await instance
       .createProposal(
         0x2,
         106,
         wethAddress,
         baseAssetAddress,
         ethers.utils.parseUnits('390',6),
         100,
         false
       );

       txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);

       const swapUSDCWETH = await ethers.getContractAt('UniSwapV3Facet', instance.address);

       path = ethers.utils.solidityPack(
        ["address", "uint24","address","uint24", "address"], // encode as address array
        [ baseAssetAddress, 3000,wbtcAddress,3000,wethAddress]) //addresses and fees

       txn = await swapUSDCWETH.executeUniSwapMulti(3,path, ethers.utils.parseEther('0.20')); // voteID, MinimumAmount, fee=3000, 0
       txn = await instance.getVotingStatuses(1);
       expect(txn[2].voteStatus).to.equal(106);
       txn = await usdc.callStatic.balanceOf(instance.address);
       expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('200',6)));
       txn = await weth.callStatic.balanceOf(instance.address);
       expect (Number(txn)).to.greaterThanOrEqual(Number(ethers.utils.parseUnits('0.20',18)));   

      
      
    });
  });