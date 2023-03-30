const { expect, assert } = require("chai");
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const hre = require('hardhat');
const { ethers } = require("hardhat");
const { resetForkedChain } = require('./common.js');
const networks = require('./addresses.json');
const net = hre.config.cometInstance;
const { deployTest } = require('../deployForTest');
const { getSelectors, FacetCutAction } = require('../libraries/diamond.js');
const { zeroPad } = require("ethers/lib/utils.js");

const {
  evmRevert,
  evmSnapshot,
  mulPercent,
  getHandlerReturn,
  getCallData,
  getTokenProvider,
  callExternalApi,
  mwei,
} = require('../libraries/utils');
const queryString = require('query-string');

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

  const IParaSwap = [
    'function swap(address, uint, address, bytes) external returns (uint)',
  ];

  const URL_PARASWAP = 'https://apiv5.paraswap.io/';
  const EXCLUDE_DEXS = 'ParaSwapPool,ParaSwapLimitOrders';
  const IGNORE_CHECKS_PARAM = 'ignoreChecks=true';
  const URL_PARASWAP_PRICE = URL_PARASWAP + 'prices';
  const URL_PARASWAP_TRANSACTION =
    URL_PARASWAP +
    'transactions/' +
    1+
    '?' +
    IGNORE_CHECKS_PARAM;

    const PARTNER_ADDRESS = '0x5cF829F5A8941f4CD2dD104e39486a69611CD013';


    const URL_1INCH = 'https://api.1inch.exchange/v5.0/' + 1 + '/';
    const URL_1INCH_SWAP = URL_1INCH + 'swap';
    

const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
const blockNumber = hre.config.networks.hardhat.forking.blockNumber;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const slippageInBps = 3; //1%

let Contracts = {}

let jsonRpcServer, cometAddress, baseAssetAddress, 
wethAddress, txn, instance, OneInchV5Facet;

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

  async function getPriceData(
    srcToken,
    srcDecimals,
    destToken,
    destDecimals,
    amount,
    route = '',
    excludeDirectContractMethods = ''
  ) {
    const priceReq = queryString.stringifyUrl({
      url: URL_PARASWAP_PRICE,
      query: {
        srcToken: srcToken,
        srcDecimals: srcDecimals,
        destToken: destToken,
        destDecimals: destDecimals,
        amount: amount,
        network: 1,
        excludeDEXS: EXCLUDE_DEXS,
        route: route,
        partner: PARTNER_ADDRESS,
        excludeDirectContractMethods: excludeDirectContractMethods,
      },
    });
  
    // Call Paraswap price API
    const priceResponse = await callExternalApi(priceReq);
    let priceData = priceResponse.json();
    if (priceResponse.ok === false) {
      assert.fail('ParaSwap price api fail:' + priceData.error);
    }
    return priceData;
  }


  async function getTransactionData(
    priceData,
    slippageInBps,
    userAddress,
    txOrigin
  ) {
    const body = {
      srcToken: priceData.priceRoute.srcToken,
      srcDecimals: priceData.priceRoute.srcDecimals,
      destToken: priceData.priceRoute.destToken,
      destDecimals: priceData.priceRoute.destDecimals,
      srcAmount: priceData.priceRoute.srcAmount,
      slippage: slippageInBps,
      userAddress: userAddress,
      txOrigin: txOrigin,
      priceRoute: priceData.priceRoute,
      partner: PARTNER_ADDRESS,
    };
  
    const txResp = await callExternalApi(URL_PARASWAP_TRANSACTION, 'post', body);
    const txData = await txResp.json();
    if (txResp.ok === false) {
      assert.fail('ParaSwap transaction api fail:' + txData.error);
    }
    return txData;
  }

async function advanceBlockHeight(blocks) {
    const txns = [];
    for (let i = 0; i < blocks; i++) {
      txns.push(hre.network.provider.send('evm_mine'));
    }
    await Promise.all(txns);
  }

  
describe("OneInch V5 Integration Test", function () {
    before(async () => {
      console.log('\n Running a hardhat local evm fork of a public net...\n');
  
      jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
        hostname: 'localhost',
        port: 8545,
        provider: hre.network.provider
      });
  
      await jsonRpcServer.listen();
      const healthCkeck = await callExternalApi(URL_1INCH + 'healthcheck');
    if (!healthCkeck.ok) {
      console.error(`=====> 1inch API not healthy now, skip the tests`);
    }
  
      baseAssetAddress = networks[net].USDC;
      usdcAddress = baseAssetAddress;
      cometAddress = networks[net].comet;
      wethAddress = networks[net].WETH;
      rewardsCOMP = networks[net].rewards;
      CompAddress = networks[net].comptroller;
      AugustusAddress = networks[net].AUGUSTUS_SWAPPER;
      TokenProxy = networks[net].TOKEN_TRANSFER_PROXY
      wbtcAddress = networks[net].WBTC;
      
    });
  
    beforeEach(async () => {
      //await resetForkedChain(hre, providerUrl, blockNumber);
      let WhiteListAddr = [];
      
    Contracts = await deployTest();

    const routerResponse = await callExternalApi(URL_1INCH + 'approve/spender');
    const routerAddress = (await routerResponse.json()).address;
     
    OneInchV5Facet = await deploy('OneInchV5Facet',Contracts.forwarder.address,routerAddress);

      
      WhiteListAddr.push({
        ContractAddress: OneInchV5Facet.address,
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
  
    it('Users Can connect OneInchV5 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: OneInchV5Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(OneInchV5Facet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(OneInchV5Facet.address)
    });
  
    it('Third party Users cannot connect OneInchV5 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: OneInchV5Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(OneInchV5Facet)
          })
        await expect(diamondCut.connect(Contracts.accounts[3]).diamondCut(cut,ZERO_ADDRESS, "0x")).to.reverted;
    });

    it('Users can disconnect OneInchV5 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: OneInchV5Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(OneInchV5Facet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(OneInchV5Facet.address);
        const ParaFacet = await ethers.getContractAt('OneInchV5Facet', instance.address);
        //txn = await UniswapFacet.withdrawWeth(0)
        let remove = []; 
        remove.push({
            facetAddress: ZERO_ADDRESS,
            action: FacetCutAction.Remove,
            functionSelectors: getSelectors(OneInchV5Facet)
          })
        tx = await diamondCut.diamondCut(remove,ZERO_ADDRESS, "0x");
        txn = await instance.getAllConnectedApps();
        expect (txn).to.not.contain(OneInchV5Facet.address);
        //await expect (stakeWETH.withdrawWeth(0)).to.reverted;
    });

    it('Users can swap assets on OneInchV5', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: OneInchV5Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(OneInchV5Facet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);
        const paraswap = new ethers.Contract(instance.address, IParaSwap, signer);
        const OneInchFacet = await ethers.getContractAt('OneInchV5Facet', instance.address);

        //Swapping ETH to USDC 
  
        amount = ethers.utils.parseEther('5');
        srcAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        srcDecimals = 18;
        dstAddress = usdcAddress;
        dstDecimals = 6;

        let swapReq = queryString.stringifyUrl({
          url: URL_1INCH_SWAP,
          query: {
            fromTokenAddress: srcAddress,
            toTokenAddress: dstAddress,
            amount: amount,
            slippage: slippageInBps,
            disableEstimate: true,
            fromAddress: instance.address,
          },
        });

         // Call 1inch API
          swapResponse = await callExternalApi(swapReq);
         expect(swapResponse.ok, '1inch api response not ok').to.be.true;
          swapData = await swapResponse.json();
          quote = swapData.toTokenAmount;

    
        txn = await instance
        .createProposal(
          0x2,
          137,
          dstAddress,
          ZERO_ADDRESS,
          amount,
          100,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);

        txn = await OneInchFacet.executeOneInchSwap(1,swapData.tx.data); 
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(137);

        txn = await usdc.callStatic.balanceOf(instance.address);
        expect (Number(txn)).to.greaterThan(Number(quote)*0.98);


         //Swapping USDC to ETH 
  
         amount = ethers.utils.parseUnits('1000',6);
         srcAddress = usdcAddress;
         srcDecimals = 6;
         dstAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
         dstDecimals = 18;
 
          swapReq = queryString.stringifyUrl({
           url: URL_1INCH_SWAP,
           query: {
             fromTokenAddress: srcAddress,
             toTokenAddress: dstAddress,
             amount: amount,
             slippage: slippageInBps,
             disableEstimate: true,
             fromAddress: instance.address,
           },
         });
 
          // Call 1inch API
           swapResponse = await callExternalApi(swapReq);
          expect(swapResponse.ok, '1inch api response not ok').to.be.true;
           swapData = await swapResponse.json();
           quote = swapData.toTokenAmount;
 
     
         txn = await instance
         .createProposal(
           0x2,
           137,
           ZERO_ADDRESS,
           srcAddress,
           amount,
           100,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);
 
         txn = await OneInchFacet.executeOneInchSwap(2,swapData.tx.data); 
         txn = await instance.getVotingStatuses(1);
         expect(txn[1].voteStatus).to.equal(137);


          //Swapping USDC to WETH 
  
          amount = ethers.utils.parseUnits('1000',6);
          srcAddress = usdcAddress;
          srcDecimals = 6;
          dstAddress = wethAddress;
          dstDecimals = 18;
  
           swapReq = queryString.stringifyUrl({
            url: URL_1INCH_SWAP,
            query: {
              fromTokenAddress: srcAddress,
              toTokenAddress: dstAddress,
              amount: amount,
              slippage: slippageInBps,
              disableEstimate: true,
              fromAddress: instance.address,
            },
          });
  
           // Call 1inch API
            swapResponse = await callExternalApi(swapReq);
           expect(swapResponse.ok, '1inch api response not ok').to.be.true;
            swapData = await swapResponse.json();
            quote = swapData.toTokenAmount;
  
      
          txn = await instance
          .createProposal(
            0x2,
            137,
            dstAddress,
            srcAddress,
            amount,
            100,
            false
          );
  
          txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);
  
          txn = await OneInchFacet.executeOneInchSwap(3,swapData.tx.data); 
          txn = await instance.getVotingStatuses(1);
          expect(txn[2].voteStatus).to.equal(137);

          txn = await weth.callStatic.balanceOf(instance.address);
          expect (Number(txn)).to.greaterThan(Number(quote)*0.98);


   
      });

     

      
  });