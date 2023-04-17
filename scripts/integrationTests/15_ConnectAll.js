
const { expect } = require("chai");
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const hre = require('hardhat');
const { ethers } = require("hardhat");
const  web3  = require("web3");
const { resetForkedChain } = require('./common.js');
const networks = require('./addresses.json');
const net = hre.config.cometInstance;
const { deployTest } = require('../deployForTest');
const { getSelectors,getSelector, FacetCutAction } = require('../libraries/diamond.js');

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
const makerMcdJoinETHName = 'ETH-A';
let Contracts = {}
const utils = web3.utils;

let jsonRpcServer, baseAssetAddress, 
wethAddress, txn, instance, BProtocolFacet,MakerInit,data;

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

  let tx = await weth.deposit({ value: ethers.utils.parseEther('1000') });
  await tx.wait(1);

  tx = await weth.approve(cometAddress, ethers.constants.MaxUint256);
  await tx.wait(1);

  tx = await comet.supply(wethAddress, ethers.utils.parseEther('100'));
  await tx.wait(1);

  // baseBorrowMin is 1000 USDC
  tx = await comet.withdraw(usdcAddress, (100000 * 1e6).toString());
  await tx.wait(1);

  // transfer from this account to the main test account (0th)
  tx = await usdc.transfer(toAddress, (amt).toString());
  await tx.wait(1);
  return;
}

  
describe("Integration Test of All Apps", function () {
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
      MakerProxyRegistryAddress = networks[net].MakerProxyRegistry
      MakerChainLogAddress = networks[net].MakerChainLog
      BPCDPManagerAddress = networks[net].BPCDPManager
      BPProxyActionsAddress = networks[net].BPProxyActions
      MakerDaiAddress = networks[net].MAKER_MCD_JOIN_DAI
      MakerETHAddress = networks[net].MAKER_MCD_JOIN_ETH_A
      MakerVATAddress = networks[net].MAKER_MCD_VAT
      MakerUSDCAddress = networks[net].MAKER_MCD_JOIN_USDC_A
      UniswapRouterAddress = networks[net].uniswapRouter;
      UniswapRouterV2Address = networks[net].uniswapV2Router;
      SushiSwapRouterAddress = networks[net].SushiSwapRouter;
      QuickSwapRouterAddress = networks[net].QuickSwapRouter;
      AaveV2ProviderAddress = networks[net].aaveV2Provider;
      AaveV3ProviderAddress = networks[net].aaveV3Provider;
      CurveMinterAddress = networks[net].curveMinter
      CRVTokenAddress = networks[net].CRV_TOKEN
      MakerCDPManagerAddress = networks[net].MakerCDPManager
      MakerProxyActionsAddress = networks[net].MakerProxyActions
      AugustusAddress = networks[net].AUGUSTUS_SWAPPER;
      TokenProxy = networks[net].TOKEN_TRANSFER_PROXY;
      LidoProxyAddress = networks[net].LIDO_PROXY;
      stethAddress = networks[net].STETH;
      STARGATE_ROUTER_ADDRESS = networks[net].STARGATE_ROUTER;
      STARGATE_ROUTER_ETH_ADDRESS =  networks[net].STARGATE_ROUTER_ETH;
      STARGATE_FACTORY_ADDRESS= networks[net].STARGATE_FACTORY;
      STARGATE_WIDGET_SWAP_ADDRESS= networks[net].STARGATE_WIDGET_SWAP;
      STARGATE_TOKEN_ADDRESS = networks[net].STARGATE_TOKEN;
      STARGATE_PARTNER_ID= "0x0010";

    });
  
    beforeEach(async () => {
      //await resetForkedChain(hre, providerUrl, blockNumber);
      let WhiteListAddr = [];
      
    Contracts = await deployTest();
    //BProtocol
    BProtocolFacet = await deploy('BProtocolFacet',Contracts.forwarder.address,
    MakerProxyRegistryAddress,daiAddress,MakerChainLogAddress, BPCDPManagerAddress, BPProxyActionsAddress);
    MakerInit = await deploy('DiamondInitMaker', MakerProxyRegistryAddress);
    data = MakerInit.interface.encodeFunctionData("init",[])
      
      WhiteListAddr.push({
        ContractAddress: BProtocolFacet.address,
        Status: 1
      })
    //1.CompoundV3
    CompoundV3FacetUSDC = await deploy('CompoundV3FacetUSDC',Contracts.forwarder.address,cometAddress, wethAddress);
      
    WhiteListAddr.push({
        ContractAddress: CompoundV3FacetUSDC.address,
        Status: 1
      })

      //2. CompoundV2 
      CompoundV2Facet = await deploy('CompoundV2Facet',Contracts.forwarder.address,CompAddress);
      
      WhiteListAddr.push({
        ContractAddress: CompoundV2Facet.address,
        Status: 1
      })

      //3. Uniswap V3
      UniSwapV3Facet = await deploy('UniSwapV3Facet',Contracts.forwarder.address,UniswapRouterAddress, wethAddress);

      
      WhiteListAddr.push({
        ContractAddress: UniSwapV3Facet.address,
        Status: 1
      })
      //4. Uniswap V2
      UniSwapV2Facet = await deploy('UniSwapV2Facet',Contracts.forwarder.address,UniswapRouterV2Address);
      
      WhiteListAddr.push({
        ContractAddress: UniSwapV2Facet.address,
        Status: 1
      })

      //5. SushiSwap 

      SushiSwapFacet = await deploy('SushiSwapFacet',Contracts.forwarder.address,SushiSwapRouterAddress);
      WhiteListAddr.push({
        ContractAddress: SushiSwapFacet.address,
        Status: 1
      })

      //6. QuickSwap 

      QuickSwapV2Facet = await deploy('QuickSwapV2Facet',Contracts.forwarder.address,QuickSwapRouterAddress);

      WhiteListAddr.push({
        ContractAddress: QuickSwapV2Facet.address,
        Status: 1
      })

      //7. Aave V2
      AaveV2Facet = await deploy('AaveV2Facet',Contracts.forwarder.address,AaveV2ProviderAddress, wethAddress);

      WhiteListAddr.push({
        ContractAddress: AaveV2Facet.address,
        Status: 1
      })

      //8.AaveV3
      AaveV3Facet = await deploy('AaveV3Facet',Contracts.forwarder.address,AaveV3ProviderAddress, wethAddress);

      WhiteListAddr.push({
        ContractAddress: AaveV3Facet.address,
        Status: 1
      })

      //9.Yearn 

      YearnFacet = await deploy('YearnFacet',Contracts.forwarder.address);

      WhiteListAddr.push({
        ContractAddress: YearnFacet.address,
        Status: 1
      })

      //10.Curve
      CurveFacet = await deploy('CurveFacet',Contracts.forwarder.address, CurveMinterAddress, CRVTokenAddress );
      WhiteListAddr.push({
        ContractAddress: CurveFacet.address,
        Status: 1
      })

      //11.Maker
    MakerFacet = await deploy('MakerFacet',Contracts.forwarder.address,MakerProxyRegistryAddress,daiAddress,MakerChainLogAddress, MakerCDPManagerAddress, MakerProxyActionsAddress);
    MakerInit2 = await deploy('DiamondInitMaker', MakerProxyRegistryAddress);
    data2 = MakerInit2.interface.encodeFunctionData("init",[])
      WhiteListAddr.push({
        ContractAddress: MakerFacet.address,
        Status: 1
      })

      //12.Paraswap

      ParaSwapFacet = await deploy('ParaSwapFacet',Contracts.forwarder.address,AugustusAddress, TokenProxy);
      WhiteListAddr.push({
        ContractAddress: ParaSwapFacet.address,
        Status: 1
      })

          //13.OneInch

          OneInchV5Facet = await deploy('OneInchV5Facet',Contracts.forwarder.address,TokenProxy);

          WhiteListAddr.push({
            ContractAddress: OneInchV5Facet.address,
            Status: 1
          })

          //14. Lido

          LidoFacet = await deploy('LidoFacet',Contracts.forwarder.address, ZERO_ADDRESS, LidoProxyAddress);

          WhiteListAddr.push({
            ContractAddress: LidoFacet.address,
            Status: 1
          })

          //15. Stargate

          StargateFacet = await deploy('StargateFacet',Contracts.forwarder.address,
              STARGATE_ROUTER_ADDRESS,
              STARGATE_ROUTER_ETH_ADDRESS,
              STARGATE_TOKEN_ADDRESS,
              STARGATE_FACTORY_ADDRESS,
              STARGATE_WIDGET_SWAP_ADDRESS,
              STARGATE_PARTNER_ID
        );
      
      WhiteListAddr.push({
        ContractAddress: StargateFacet.address,
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
          value: hre.ethers.utils.parseEther("20"),
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
  
    it('Users can connect All Apps', async () => {
        let cut = []
        const Apps = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: BProtocolFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(BProtocolFacet)
          })
        tx = await diamondCut.diamondCut(cut,MakerInit.address, data);
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(BProtocolFacet.address)
        Apps.push(BProtocolFacet);
        
      //CompoundV3

        cut = []
        cut.push({
          facetAddress: CompoundV3FacetUSDC.address,
          action: FacetCutAction.Add,
          functionSelectors: getSelectors(CompoundV3FacetUSDC)
        })
      tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
      receipt = await tx.wait();
      

      txn = await instance.getAllConnectedApps();
      expect (txn).contain(CompoundV3FacetUSDC.address)
      Apps.push(CompoundV3FacetUSDC);

        //CompoundV2

      cut = []
      cut.push({
        facetAddress: CompoundV2Facet.address,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(CompoundV2Facet)
      })
    tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
    receipt = await tx.wait();
    txn = await instance.getAllConnectedApps();
    expect (txn).contain(CompoundV2Facet.address)
    Apps.push(CompoundV2Facet);

//Uniswap V3
cut = []
    cut.push({
      facetAddress: UniSwapV3Facet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(UniSwapV3Facet)
    })
  tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
  receipt = await tx.wait();
  txn = await instance.getAllConnectedApps();
  expect (txn).contain(UniSwapV3Facet.address)

  Apps.push(UniSwapV3Facet);
//Uniswap V2
  cut = []
  cut.push({
    facetAddress: UniSwapV2Facet.address,
    action: FacetCutAction.Add,
    functionSelectors: getSelectors(UniSwapV2Facet)
  })
tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
receipt = await tx.wait();
txn = await instance.getAllConnectedApps();
expect (txn).contain(UniSwapV2Facet.address)
Apps.push(UniSwapV2Facet);

//SushiSwap
cut = []
cut.push({
  facetAddress: SushiSwapFacet.address,
  action: FacetCutAction.Add,
  functionSelectors: getSelectors(SushiSwapFacet)
})
tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
receipt = await tx.wait();
txn = await instance.getAllConnectedApps();
expect (txn).contain(SushiSwapFacet.address)
Apps.push(SushiSwapFacet);
//QuickSwap
cut = []
cut.push({
  facetAddress: QuickSwapV2Facet.address,
  action: FacetCutAction.Add,
  functionSelectors: getSelectors(QuickSwapV2Facet)
})
tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
receipt = await tx.wait();
txn = await instance.getAllConnectedApps();
expect (txn).contain(QuickSwapV2Facet.address)
Apps.push(QuickSwapV2Facet);

//AaveV2
cut = []
cut.push({
  facetAddress: AaveV2Facet.address,
  action: FacetCutAction.Add,
  functionSelectors: getSelectors(AaveV2Facet)
})
tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
receipt = await tx.wait();
txn = await instance.getAllConnectedApps();
expect (txn).contain(AaveV2Facet.address)
Apps.push(AaveV2Facet);

//AaveV3
cut = []
cut.push({
  facetAddress: AaveV3Facet.address,
  action: FacetCutAction.Add,
  functionSelectors: getSelectors(AaveV3Facet)
})
tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
receipt = await tx.wait();
txn = await instance.getAllConnectedApps();
expect (txn).contain(AaveV3Facet.address)
Apps.push(AaveV3Facet);

//Yearn
cut = []
cut.push({
  facetAddress: YearnFacet.address,
  action: FacetCutAction.Add,
  functionSelectors: getSelectors(YearnFacet)
})
tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
receipt = await tx.wait();
txn = await instance.getAllConnectedApps();
expect (txn).contain(YearnFacet.address)
Apps.push(YearnFacet);


//Curve
cut = []
cut.push({
  facetAddress: CurveFacet.address,
  action: FacetCutAction.Add,
  functionSelectors: getSelectors(CurveFacet)
})
tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
receipt = await tx.wait();
txn = await instance.getAllConnectedApps();
expect (txn).contain(CurveFacet.address)
Apps.push(CurveFacet);

//Maker
cut = []
cut.push({
  facetAddress: MakerFacet.address,
  action: FacetCutAction.Add,
  functionSelectors: getSelectors(MakerFacet)
})

tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x"); ///!!! Proxy of BP Protocol and Maker already registered. Cannot register twice... 
receipt = await tx.wait();
txn = await instance.getAllConnectedApps();
expect (txn).contain(MakerFacet.address)
Apps.push(MakerFacet);

//Paraswap
cut = []
cut.push({
  facetAddress: ParaSwapFacet.address,
  action: FacetCutAction.Add,
  functionSelectors: getSelectors(ParaSwapFacet)
})
tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
receipt = await tx.wait();
txn = await instance.getAllConnectedApps();
expect (txn).contain(ParaSwapFacet.address)
Apps.push(ParaSwapFacet);


//OneInch
cut = []
cut.push({
  facetAddress: OneInchV5Facet.address,
  action: FacetCutAction.Add,
  functionSelectors: getSelectors(OneInchV5Facet)
})
tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
receipt = await tx.wait();
txn = await instance.getAllConnectedApps();
expect (txn).contain(OneInchV5Facet.address)
Apps.push(OneInchV5Facet);

//Lido
cut = []
cut.push({
  facetAddress: LidoFacet.address,
  action: FacetCutAction.Add,
  functionSelectors: getSelectors(LidoFacet)
})
tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
receipt = await tx.wait();
txn = await instance.getAllConnectedApps();
expect (txn).contain(LidoFacet.address)
Apps.push(LidoFacet);

//Stargate
cut = []
cut.push({
  facetAddress: StargateFacet.address,
  action: FacetCutAction.Add,
  functionSelectors: getSelectors(StargateFacet)
})
tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
receipt = await tx.wait();
txn = await instance.getAllConnectedApps();
expect (txn).contain(StargateFacet.address)
Apps.push(StargateFacet);

      
      let remove = []; 
      for (const App of Apps) {
      remove.push({
          facetAddress: ZERO_ADDRESS,
          action: FacetCutAction.Remove,
          functionSelectors: getSelectors(App)
        })}
      tx = await diamondCut.diamondCut(remove,ZERO_ADDRESS, "0x");
      txn = await instance.getAllConnectedApps();
      expect(txn.length).to.equal(1);

    });
  


  
  });