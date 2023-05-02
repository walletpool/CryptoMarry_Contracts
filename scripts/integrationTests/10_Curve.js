const {
  mulPercent,
} = require('../libraries/utils');
const {  BN } = require('@openzeppelin/test-helpers');
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
    'function calc_withdraw_one_coin(uint256,int128) returns (uint256)',
    'function calc_token_amount(uint256[3],bool) returns (uint256)',
    'function get_dy(int128,int128,uint256) returns (uint)'
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
const slippage = ethers.BigNumber.from('3');
let Contracts = {}

let jsonRpcServer, baseAssetAddress, 
wethAddress, txn, instance, CurveFacet;

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
  const dai = new ethers.Contract(daiAddress, stdErc20Abi, signer);
  const usdt = new ethers.Contract(usdtAddress, stdErc20Abi, signer);

  let tx = await weth.deposit({ value: ethers.utils.parseEther('100') });
  await tx.wait(1);

  tx = await weth.approve(cometAddress, ethers.constants.MaxUint256);
  await tx.wait(1);

  tx = await comet.supply(wethAddress, ethers.utils.parseEther('100'));
  await tx.wait(1);

  // baseBorrowMin is 1000 USDC
  tx = await comet.withdraw(usdcAddress, (10000 * 1e6).toString());
  await tx.wait(1);
  // // baseBorrowMin is 1000 DAI
  // tx = await comet.withdraw(daiAddress, ethers.utils.parseUnits('10000',18));
  // await tx.wait(1);
  // // baseBorrowMin is 1000 USDT
  // tx = await comet.withdraw(usdtAddress, (10000 * 1e6).toString());
  // await tx.wait(1);

  // transfer from this account to the main test account (0th)
  tx = await usdc.transfer(toAddress, (amt).toString());
  await tx.wait(1);
  // tx = await dai.transfer(toAddress, (amt).toString());
  // await tx.wait(1);
  // tx = await usdt.transfer(toAddress, (amt).toString());
  // await tx.wait(1);

  return;
}

  
describe("Curve Integration Test", function () {
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
      daiAddress = networks[net].DAI;
      usdtAddress = networks[net].USDT;
      curveHandlerDAIUSDCUSDT = networks[net].DAIUSDCUSDT
      curvePoolDAIUSDCUSDT = networks[net].CURVE_3POOLCRV
      CurveMinterAddress = networks[net].curveMinter
      CRVTokenAddress = networks[net].CRV_TOKEN

      
    });
  
    beforeEach(async () => {
      //await resetForkedChain(hre, providerUrl, blockNumber);
      let WhiteListAddr = [];
      
    Contracts = await deployTest();
     
    CurveFacet = await deploy('CurveFacet',Contracts.forwarder.address, CurveMinterAddress, CRVTokenAddress );

      
      WhiteListAddr.push({
        ContractAddress: CurveFacet.address,
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
  
    it('Users can connect Curve App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: CurveFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CurveFacet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(CurveFacet.address)
    });
  
    it('Third party Users cannot connect Curve App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: CurveFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CurveFacet)
          })
        await expect(diamondCut.connect(Contracts.accounts[3]).diamondCut(cut,ZERO_ADDRESS, "0x")).to.reverted;
    });

    it('Users can disconnect Curve App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: CurveFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CurveFacet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(CurveFacet.address);
        const instanceCurve = await ethers.getContractAt('CurveFacet', instance.address);
        let remove = []; 
        remove.push({
            facetAddress: ZERO_ADDRESS,
            action: FacetCutAction.Remove,
            functionSelectors: getSelectors(CurveFacet)
          })
        tx = await diamondCut.diamondCut(remove,ZERO_ADDRESS, "0x");
        txn = await instance.getAllConnectedApps();
        expect (txn).to.not.contain(CurveFacet.address);
     //   await expect (instanceQuick.getPairAddressQuickSwap(usdcAddress,wethAddress)).to.reverted;
    });


    it('Users can deposit and withdraw assets on Curve', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: CurveFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CurveFacet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const pool3 = new ethers.Contract(curvePoolDAIUSDCUSDT, stdErc20Abi, signer);
        const handler3 = new ethers.Contract(curveHandlerDAIUSDCUSDT, stdErc20Abi, signer);
        await seedWithBaseToken(instance.address, ethers.utils.parseUnits('10000',6));
        const instanceCurve = await ethers.getContractAt('CurveFacet', instance.address);

        //Creating Yearn Liquidity supply proposal
        const respi = await handler3.callStatic.calc_token_amount([ethers.utils.parseUnits('0',18),ethers.utils.parseUnits('1100',6),ethers.utils.parseUnits('0',6)],true);
        percentage = ethers.BigNumber.from('100').sub(slippage)
        div = ethers.BigNumber.from(percentage).div(ethers.BigNumber.from(100))
        minMintAmount = ethers.BigNumber.from(respi).mul(div)

        txn = await instanceCurve
        .createProposalLiquidity(
           
          416,
          100,
          1,
          minMintAmount,
          curvePoolDAIUSDCUSDT,
          curveHandlerDAIUSDCUSDT,
          [daiAddress,usdcAddress,usdtAddress],
          [ethers.utils.parseUnits('0',18),ethers.utils.parseUnits('1100',6),ethers.utils.parseUnits('0',6)],
          0
        );
        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);

        txn = await instanceCurve.addLiquidity(1); // voteID

        txn = await pool3.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.greaterThan(Number(ethers.utils.parseUnits('1000',18)));
        await advanceBlockHeight(5000);

        withdrawAmount = await pool3.callStatic.balanceOf(instance.address);
        resp = await handler3.callStatic.calc_withdraw_one_coin(withdrawAmount,1);
        
        percentage = ethers.BigNumber.from('100').sub(slippage)
        div = ethers.BigNumber.from(percentage).div(ethers.BigNumber.from(100))
        minMintAmount = ethers.BigNumber.from(respi).mul(div)
         //Withdrawing USDC 
         txn = await instance
         .createProposal(
            
           419,
           curvePoolDAIUSDCUSDT,
           usdcAddress,
           withdrawAmount,
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);
         txn = await instanceCurve.removeLiquidityOneCoin(2,curveHandlerDAIUSDCUSDT, 1, minMintAmount); // i'th coin is wheere it is located in pool order 
         txn = await instance.getVotingStatuses(1);
         expect(txn[1].voteStatus).to.equal(419);

         tokensLeft = await pool3.callStatic.balanceOf(instance.address);
         expect(tokensLeft).to.equal(0);

      });


      it('Users can swap assets in pools --> USDC to USDT', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: CurveFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CurveFacet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        const signer = provider.getSigner(Contracts.accounts[0].address);
        const usdt = new ethers.Contract(usdtAddress, stdErc20Abi, signer);
        const pool3 = new ethers.Contract(curvePoolDAIUSDCUSDT, stdErc20Abi, signer);
        const handler3 = new ethers.Contract(curveHandlerDAIUSDCUSDT, stdErc20Abi, signer);
        await seedWithBaseToken(instance.address, ethers.utils.parseUnits('10000',6));
        const instanceCurve = await ethers.getContractAt('CurveFacet', instance.address);

        
        amount = ethers.utils.parseUnits('1000',6)        
        resp = await handler3.callStatic.get_dy(1,2,amount);
        percentage = ethers.BigNumber.from('100').sub(slippage)
        div = ethers.BigNumber.from(percentage).div(ethers.BigNumber.from(100))
        minMintAmount = ethers.BigNumber.from(resp).mul(div)
         //Withdrawing USDC 
         txn = await instance
         .createProposal(
            
           410,
           usdtAddress,
           usdcAddress,
           amount,
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);
         txn = await instanceCurve.executeCurveExchange(1,curveHandlerDAIUSDCUSDT,1,2,minMintAmount); // i'th coin is wheere it is located in pool order 
         txn = await instance.getVotingStatuses(1);
         expect(txn[0].voteStatus).to.equal(410);

         tokensUSDT = await usdt.callStatic.balanceOf(instance.address);
         expect(Number(tokensUSDT)).to.greaterThanOrEqual(Number(minMintAmount));

      });


  
  });