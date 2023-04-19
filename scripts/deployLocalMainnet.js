const { ethers,config } = require("hardhat");
const { writeFileSync } = require("fs");
const networks = require("./integrationTests/addresses.json");
const {
  callExternalApi,
} = require('./libraries/utils');
const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')

async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then((f) => f.deployed());
}

function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

async function main() {
  console.log("Construction started.....");
  const accounts = await ethers.getSigners();
  const accountsPriv = config.networks.hardhat.accounts;
  
  let index = 5; // first wallet, increment for next wallets
  const wallet1 = ethers.Wallet.fromMnemonic(accountsPriv.mnemonic, accountsPriv.path + `/${index}`);
  const privateKey1 = wallet1.privateKey

   index = 6; // first wallet, increment for next wallets
  const wallet2 = ethers.Wallet.fromMnemonic(accountsPriv.mnemonic, accountsPriv.path + `/${index}`);
  const privateKey2 = wallet2.privateKey

  console.log('HH private keys',privateKey1,privateKey2)

  const net = "usdc-mainnet";
  cometAddress = networks[net].comet;
  usdcAddress = networks[net].USDC;
  wethAddress = networks[net].WETH;
  CompAddress = networks[net].comptroller;
  daiAddress = networks[net].DAI;
  CETHAddress= networks[net].CETH;
  CUSDCAddress= networks[net].CUSDC;
  MakerProxyRegistryAddress = networks[net].MakerProxyRegistry;
  MakerChainLogAddress = networks[net].MakerChainLog;
  BPCDPManagerAddress = networks[net].BPCDPManager;
  BPProxyActionsAddress = networks[net].BPProxyActions;
  UniswapRouterAddress = networks[net].uniswapRouter;
  UniswapRouterV2Address = networks[net].uniswapV2Router;
  SushiSwapRouterAddress = networks[net].SushiSwapRouter;
  QuickSwapRouterAddress = networks[net].QuickSwapRouter;
  AaveV2ProviderAddress = networks[net].aaveV2Provider;
  AaveV3ProviderAddress = networks[net].aaveV3Provider;
  CurveMinterAddress = networks[net].curveMinter
  CRVTokenAddress = networks[net].CRV_TOKEN
  MakerCDPManagerAddress = networks[net].MakerCDPManager;
  MakerProxyActionsAddress = networks[net].MakerProxyActions;
  AugustusAddress = networks[net].AUGUSTUS_SWAPPER;
  TokenProxy = networks[net].TOKEN_TRANSFER_PROXY
  LidoProxyAddress = networks[net].LIDO_PROXY;
  STARGATE_ROUTER_ADDRESS = networks[net].STARGATE_ROUTER;
  STARGATE_ROUTER_ETH_ADDRESS = networks[net].STARGATE_ROUTER_ETH;
  STARGATE_FACTORY_ADDRESS = networks[net].STARGATE_FACTORY;
  STARGATE_WIDGET_SWAP_ADDRESS = networks[net].STARGATE_WIDGET_SWAP;
  STARGATE_TOKEN_ADDRESS = networks[net].STARGATE_TOKEN;
  STARGATE_PARTNER_ID = "0x0010";
  ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const forwarder = await deploy("MinimalForwarder");

  console.log(
    "Minimal Forwarder Contract deployed:",
    forwarder.address,
    forwarder.deployTransaction.gasLimit
  );

  let WhiteListAddr = [];

  //Deploying Cut

  const DiamondCutFacet = await deploy("DiamondCutFacet", forwarder.address);
  console.log(
    "DiamondCutFacet deployed:",
    DiamondCutFacet.address,
    DiamondCutFacet.deployTransaction.gasLimit
  );

  //Deploying Facts
    console.log("COMET",cometAddress )
  //1.CompoundV3
  CompoundV3FacetUSDC = await deploy(
    "CompoundV3FacetUSDC",
    forwarder.address,
    cometAddress,
    wethAddress
  );

  WhiteListAddr.push({
    ContractAddress: CompoundV3FacetUSDC.address,
    Status: 1,
  });

  console.log(
    "CompoundV3FacetUSDC deployed:",
    CompoundV3FacetUSDC.address,
    CompoundV3FacetUSDC.deployTransaction.gasLimit
  );

  //2. CompoundV2
  CompoundV2Facet = await deploy(
    "CompoundV2Facet",
    forwarder.address,
    CompAddress
  );

  WhiteListAddr.push({
    ContractAddress: CompoundV2Facet.address,
    Status: 1,
  });

  console.log(
    "CompoundV2Facet deployed:",
    CompoundV2Facet.address,
    CompoundV2Facet.deployTransaction.gasLimit
  );

  //3. Uniswap V3
  UniSwapV3Facet = await deploy(
    "UniSwapV3Facet",
    forwarder.address,
    UniswapRouterAddress,
    wethAddress
  );

  WhiteListAddr.push({
    ContractAddress: UniSwapV3Facet.address,
    Status: 1,
  });

  console.log(
    "UniSwapV3Facet deployed:",
    UniSwapV3Facet.address,
    UniSwapV3Facet.deployTransaction.gasLimit
  );
  //4. Uniswap V2
  UniSwapV2Facet = await deploy(
    "UniSwapV2Facet",
    forwarder.address,
    UniswapRouterV2Address
  );

  WhiteListAddr.push({
    ContractAddress: UniSwapV2Facet.address,
    Status: 1,
  });

  console.log(
    "UniSwapV2Facet deployed:",
    UniSwapV2Facet.address,
    UniSwapV2Facet.deployTransaction.gasLimit
  );

  //5. SushiSwap

  SushiSwapFacet = await deploy(
    "SushiSwapFacet",
    forwarder.address,
    SushiSwapRouterAddress
  );
  WhiteListAddr.push({
    ContractAddress: SushiSwapFacet.address,
    Status: 1,
  });

  console.log(
    "SushiSwapFacet deployed:",
    SushiSwapFacet.address,
    SushiSwapFacet.deployTransaction.gasLimit
  );

  //6. QuickSwap

  QuickSwapV2Facet = await deploy(
    "QuickSwapV2Facet",
    forwarder.address,
    QuickSwapRouterAddress
  );

  WhiteListAddr.push({
    ContractAddress: QuickSwapV2Facet.address,
    Status: 1,
  });

  console.log(
    "QuickSwapV2Facet deployed:",
    QuickSwapV2Facet.address,
    QuickSwapV2Facet.deployTransaction.gasLimit
  );

  //7. Aave V2
  AaveV2Facet = await deploy(
    "AaveV2Facet",
    forwarder.address,
    AaveV2ProviderAddress,
    wethAddress
  );

  WhiteListAddr.push({
    ContractAddress: AaveV2Facet.address,
    Status: 1,
  });

  console.log(
    "AaveV2Facet deployed:",
    AaveV2Facet.address,
    AaveV2Facet.deployTransaction.gasLimit
  );

  //8.AaveV3
  AaveV3Facet = await deploy(
    "AaveV3Facet",
    forwarder.address,
    AaveV3ProviderAddress,
    wethAddress
  );

  WhiteListAddr.push({
    ContractAddress: AaveV3Facet.address,
    Status: 1,
  });

  console.log(
    "AaveV3Facet deployed:",
    AaveV3Facet.address,
    AaveV3Facet.deployTransaction.gasLimit
  );

  //9.Yearn

  YearnFacet = await deploy("YearnFacet", forwarder.address);

  WhiteListAddr.push({
    ContractAddress: YearnFacet.address,
    Status: 1,
  });

  console.log(
    "YearnFacet deployed:",
    YearnFacet.address,
    YearnFacet.deployTransaction.gasLimit
  );

  //10.Curve ==> Not available in GOerli
  CurveFacet = await deploy(
    "CurveFacet",
    forwarder.address,
    CurveMinterAddress,
    CRVTokenAddress
  );
  WhiteListAddr.push({
    ContractAddress: CurveFacet.address,
    Status: 1,
  });

  console.log(
    "Curve deployed:",
    CurveFacet.address,
    CurveFacet.deployTransaction.gasLimit
  );

  //11.Maker
  MakerFacet = await deploy(
    "MakerFacet",
    forwarder.address,
    MakerProxyRegistryAddress,
    daiAddress,
    MakerChainLogAddress,
    MakerCDPManagerAddress,
    MakerProxyActionsAddress
  );
  MakerInit2 = await deploy("DiamondInitMaker", MakerProxyRegistryAddress);
  data2 = MakerInit2.interface.encodeFunctionData("init", []);
  WhiteListAddr.push({
    ContractAddress: MakerFacet.address,
    Status: 1,
  });

  console.log(
    "MakerFacet deployed:",
    MakerFacet.address,
    MakerFacet.deployTransaction.gasLimit
  );

  //12.Paraswap -> No Goerli

  ParaSwapFacet = await deploy(
    "ParaSwapFacet",
    forwarder.address,
    AugustusAddress,
    TokenProxy
  );
  WhiteListAddr.push({
    ContractAddress: ParaSwapFacet.address,
    Status: 1,
  });

  console.log(
    "ParaSwapFacet deployed:",
    ParaSwapFacet.address,
    ParaSwapFacet.deployTransaction.gasLimit
  );

  //13.OneInch --> No Goerli
  const URL_1INCH = 'https://api.1inch.exchange/v5.0/' + 1 + '/';
  const routerResponse = await callExternalApi(URL_1INCH + 'approve/spender');
  const routerAddress = (await routerResponse.json()).address;

  OneInchV5Facet = await deploy(
    "OneInchV5Facet",
    forwarder.address,
    routerAddress
  );

  WhiteListAddr.push({
    ContractAddress: OneInchV5Facet.address,
    Status: 1,
  });
  console.log(
    "OneInchV5Facet deployed:",
    OneInchV5Facet.address,
    OneInchV5Facet.deployTransaction.gasLimit
  );

  //14. Lido

  LidoFacet = await deploy(
    "LidoFacet",
    forwarder.address,
    ZERO_ADDRESS,
    LidoProxyAddress
  );

  WhiteListAddr.push({
    ContractAddress: LidoFacet.address,
    Status: 1,
  });

  //15. Stargate

  StargateFacet = await deploy(
    "StargateFacet",
    forwarder.address,
    STARGATE_ROUTER_ADDRESS,
    STARGATE_ROUTER_ETH_ADDRESS,
    STARGATE_TOKEN_ADDRESS,
    STARGATE_FACTORY_ADDRESS,
    STARGATE_WIDGET_SWAP_ADDRESS,
    STARGATE_PARTNER_ID
  );

  WhiteListAddr.push({
    ContractAddress: StargateFacet.address,
    Status: 1,
  });

  const familyDao = await deploy("FamilyDAOFacet", forwarder.address);
  console.log(
    "FamilyDAO contract deployed:",
    familyDao.address,
    familyDao.deployTransaction.gasLimit
  );
  WhiteListAddr.push({
    ContractAddress: familyDao.address,
    Status: 1,
  });
  //const diamondInit = await deploy('DiamondInit');
  const nftViewContract = await deploy(
    "nftview",
    "0x3671aE578E63FdF66ad4F3E12CC0c0d71Ac7510C"
  );
  //Goerli reverse --> 0x333Fc8f550043f239a2CF79aEd5e9cF4A20Eb41e
  //0x3671aE578E63FdF66ad4F3E12CC0c0d71Ac7510C --> Mainnet reverse address

  console.log(
    "NFT View Contract deployed:",
    nftViewContract.address,
    nftViewContract.deployTransaction.gasLimit
  );
  sleep(1000);
  const nftContract = await deploy("nftmint2", nftViewContract.address);

  console.log(
    "NFT Contract deployed:",
    nftContract.address,
    nftContract.deployTransaction.gasLimit
  );

  const WaverImplementation = await deploy(
    "WaverIDiamond",
    forwarder.address,
    DiamondCutFacet.address,
    wethAddress
  );

  console.log(
    "Waver Implementation Contract deployed:",
    WaverImplementation.address,
    WaverImplementation.deployTransaction.gasLimit
  );

  sleep(1000);
  const WavePortal7 = await deploy(
    "WavePortal7",
    forwarder.address,
    nftContract.address,
    WaverImplementation.address,
    "0xEC3215C0ba03fA75c8291Ce92ace346589483E26",
    DiamondCutFacet.address
  );

  console.log(
    "Wave Portal Contract deployed:",
    WavePortal7.address,
    WavePortal7.deployTransaction.gasLimit
  );

  const nftSplit = await deploy("nftSplit", WavePortal7.address);

  console.log(
    "NFT Split Contract deployed:",
    nftSplit.address,
    nftSplit.deployTransaction.gasLimit
  );

  writeFileSync(
    "deploytest-LocalHost-new.json",
    JSON.stringify(
      {
        DiamondCutFacet: DiamondCutFacet.address,
        CompoundV3FacetUSDC: CompoundV3FacetUSDC.address,
        CompoundV2Facet: CompoundV2Facet.address,
        UniSwapV3Facet: UniSwapV3Facet.address,
        UniSwapV2Facet: UniSwapV2Facet.address,
        SushiSwapFacet: SushiSwapFacet.address,
        QuickSwapV2Facet: QuickSwapV2Facet.address,
        AaveV2Facet: AaveV2Facet.address,
        AaveV3Facet: AaveV3Facet.address,
        YearnFacet: YearnFacet.address,
        CurveFacet: CurveFacet.address,
        MakerFacet: MakerFacet.address,
        ParaSwapFacet: ParaSwapFacet.address,
        OneInchV5Facet: OneInchV5Facet.address,
        MakerInit2: MakerInit2.address,
        LidoFacet: LidoFacet.address,
        StargateFacet: StargateFacet.address,
        familyDao: familyDao.address,
        nftViewContract: nftViewContract.address,
        nftContract: nftContract.address,
        MinimalForwarder: forwarder.address,
        WaverImplementation: WaverImplementation.address,
        WavePortal: WavePortal7.address,
        nftSplit: nftSplit.address,
        PrivateKey1: privateKey1,
        PrivateKey2: privateKey2
      },
      null,
      2
    )
  );

  console.log("Passing parameters ----->");
  var txn;
  txn = await nftViewContract.changenftmainAddress(nftContract.address);
  console.log("NFT Main Address updated");
  txn.wait(1);

  txn = await nftViewContract.changeMainAddress(WavePortal7.address);
  console.log("NFT Address updated in View");
  txn.wait(1);

  txn = await nftContract.changeMainAddress(WavePortal7.address);
  console.log("NFT Address updated");
  txn.wait(1);

  txn = await WavePortal7.changeaddressNFT(
    nftContract.address,
    nftSplit.address
  );
  console.log("WavePortal Split Address updated");
  txn.wait(1);

  console.log("WhiteList:", WhiteListAddr);

  txn = await WavePortal7.whiteListAddr(WhiteListAddr);
  console.log("WavePortal Whitelist Addresses added");
  txn.wait(2);

  txn = await nftViewContract.addheartPatterns(
    0,
    "0x3c6c696e6561724772616469656e742069643d227022203e3c73746f70206f66667365743d22302522207374796c653d2273746f702d636f6c6f723a20233930363b2073746f702d6f7061636974793a2030222f3e3c2f6c696e6561724772616469656e743e"
  );
  console.log("Updated patterns");
  txn.wait(2);

  txn = await nftViewContract.addadditionalGraphics(
    0,
    "0x3c6c696e6561724772616469656e742069643d227022203e3c73746f70206f66667365743d22302522207374796c653d2273746f702d636f6c6f723a20233930363b2073746f702d6f7061636974793a2030222f3e3c2f6c696e6561724772616469656e743e"
  );
  console.log("Updated Graphics");
  txn.wait(2);

  txn = await nftViewContract.addcertBackground(
    0,
    "0x3c6c696e6561724772616469656e742069643d274227206772616469656e74556e6974733d277573657253706163654f6e557365272078313d272d392e393525272079313d2733302e333225272078323d273130392e393525272079323d2736392e363825273e3c73746f70206f66667365743d272e343438272073746f702d636f6c6f723d2723433537424646272f3e3c73746f70206f66667365743d2731272073746f702d636f6c6f723d2723333035444646272f3e3c2f6c696e6561724772616469656e743e"
  );
  console.log("Added Background");
  txn.wait(2);

  txn = await nftViewContract.addcertBackground(
    1001,
    "0x3c6c696e6561724772616469656e742069643d2242222078313d22353025222079313d223025222078323d22353025222079323d2231303025223e3c73746f70206f66667365743d223025222073746f702d636f6c6f723d2223374135464646223e3c616e696d617465206174747269627574654e616d653d2273746f702d636f6c6f72222076616c7565733d22233741354646463b20233031464638393b202337413546464622206475723d2234732220726570656174436f756e743d22696e646566696e697465222f3e3c2f73746f703e3c73746f70206f66667365743d2231303025222073746f702d636f6c6f723d2223303146463839223e3c616e696d617465206174747269627574654e616d653d2273746f702d636f6c6f72222076616c7565733d22233031464638393b20233741354646463b202330314646383922206475723d2234732220726570656174436f756e743d22696e646566696e697465222f3e3c2f73746f703e3c2f6c696e6561724772616469656e743e"
  );
  console.log("Added Background 2");
  txn.wait(2);

  txn = await nftViewContract.addheartPatterns(
    101,
    "0x3c6c696e6561724772616469656e742069643d2270222078313d2230222078323d22313131222079313d223330222079323d22323022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f702073746f702d636f6c6f723d222346463542393922206f66667365743d22313025222f3e3c73746f702073746f702d636f6c6f723d222346463534343722206f66667365743d22323025222f3e3c73746f702073746f702d636f6c6f723d222346463742323122206f66667365743d22343025222f3e3c73746f702073746f702d636f6c6f723d222345414643333722206f66667365743d22363025222f3e3c73746f702073746f702d636f6c6f723d222334464342364222206f66667365743d22383025222f3e3c73746f702073746f702d636f6c6f723d222335314637464522206f66667365743d2231303025222f3e3c2f6c696e6561724772616469656e743e"
  );
  console.log("Added Patterns 2");
  txn.wait(2);

  console.log("Construction completed!");

  console.log("Creating Accounts....")
  txn = await WavePortal7.connect(accounts[5]).propose(
     accounts[6].address,
     "0x7465737400000000000000000000000000000000000000000000000000000000", 
    0, 
    86400,
    5,
    1,
    {
      value: hre.ethers.utils.parseEther("100"),
    }
  );

  txn = await WavePortal7.connect(accounts[6]).response(1, 0, 1);

  txn = await WavePortal7.connect(accounts[5]).checkMarriageStatus(1);
  instance = await WaverImplementation.attach(txn[0].marriageContract);

  console.log("Connecting Apps...")
  ///Connecting Compound and Uniswap V3
  const cut = []
  let tx;
  let receipt;
  cut.push({
      facetAddress: CompoundV2Facet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(CompoundV2Facet)
    })
    cut.push({
      facetAddress: UniSwapV3Facet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(UniSwapV3Facet)
    })

  const diamondCut = await ethers.getContractAt('DiamondCutFacet', instance.address);
  
  tx = await diamondCut.connect(accounts[5]).diamondCut(cut,ZERO_ADDRESS, "0x");
  receipt = await tx.wait();

  console.log("Swapping ETH to USDC...")
   //Swapping ETH to USDC 
   txn = await instance.connect(accounts[5]).
   createProposal(
    '0x50726f706f73616c202300000000000000000000000000000000000000000000',
     101,
     usdcAddress,
     "0x0000000000000000000000000000000000000000",
     ethers.utils.parseEther('10'),
     100,
     false
   );
   txn = await instance.connect(accounts[6]).voteResponse(1, 1, false);

   const swapETH = await ethers.getContractAt('UniSwapV3Facet', instance.address);
   txn = await swapETH.connect(accounts[5]).executeUniSwap(1,ethers.utils.parseUnits('19000',6),3000,0);

   console.log("Swapping ETH to cETH...")
     //Supplying ETH
     txn = await instance.connect(accounts[5]).
     createProposal(
      '0x50726f706f73616c202300000000000000000000000000000000000000000000',
       810,
       CETHAddress,
       "0x0000000000000000000000000000000000000000",
       ethers.utils.parseEther('10'),
       100,
       false
     );

     txn = await instance.connect(accounts[6]).voteResponse(2, 1, false);

     const stakeETH = await ethers.getContractAt('CompoundV2Facet', instance.address);
     txn = await stakeETH.connect(accounts[5]).compoundV2Supply(2);

     console.log("Swapping USDC to cUSDC...")
     //Supplying USDC
     txn = await instance.connect(accounts[5])
     .createProposal(
      '0x50726f706f73616c202300000000000000000000000000000000000000000000',
       811,
       CUSDCAddress,
       usdcAddress,
       ethers.utils.parseUnits('10000',6),
       100,
       false
     );

     txn = await instance.connect(accounts[6]).voteResponse(3, 1, false);
     const stakeUSDC = await ethers.getContractAt('CompoundV2Facet', instance.address);
     txn = await stakeUSDC.connect(accounts[6]).compoundV2Supply(3);
     console.log("Account setup completed!")
}
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
