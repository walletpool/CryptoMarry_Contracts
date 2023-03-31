//This Test should be run on polygon

const { expect } = require("chai");
const  web3  = require("web3");
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const hre = require('hardhat');
const { ethers } = require("hardhat");
const { resetForkedChain } = require('./common.js');
const networks = require('./addresses.json');
const net = hre.config.cometInstance;
const { deployTest } = require('../deployForTest');
const { getSelectors, FacetCutAction } = require('../libraries/diamond.js');

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

  const StargateRouterAbi = [
    'function quoteLayerZeroFee(uint16 _dstChainId, uint8 _functionType, bytes _toAddress, bytes _transferAndCallPayload, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams) view returns (uint256, uint256)'
  ];


const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
const blockNumber = hre.config.networks.hardhat.forking.blockNumber;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const STARGATE_PARTNER_ID= "0x0010";

let Contracts = {}

let jsonRpcServer, baseAssetAddress, 
wethAddress, txn, instance, StargateFacet;

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

  
describe("Stargate Integration Test", function () {
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
      STARGATE_ROUTER_ADDRESS = networks[net].STARGATE_ROUTER;
      STARGATE_ROUTER_ETH_ADDRESS =  networks[net].STARGATE_ROUTER_ETH;
      STARGATE_FACTORY_ADDRESS= networks[net].STARGATE_FACTORY;
      STARGATE_WIDGET_SWAP_ADDRESS= networks[net].STARGATE_WIDGET_SWAP;
      STARGATE_TOKEN_ADDRESS = networks[net].STARGATE_TOKEN;
    
    });
  
    beforeEach(async () => {
      //await resetForkedChain(hre, providerUrl, blockNumber);
      let WhiteListAddr = [];
      
    Contracts = await deployTest();
     
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
          value: hre.ethers.utils.parseEther("100"),
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
  
    it('Users can connect Stargate App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: StargateFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(StargateFacet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(StargateFacet.address)
    });
  
    it('Third party Users cannot connect Stargate App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: StargateFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(StargateFacet)
          })
        await expect(diamondCut.connect(Contracts.accounts[3]).diamondCut(cut,ZERO_ADDRESS, "0x")).to.reverted;
    });

    it('Users can disconnect Stargate App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: StargateFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(StargateFacet)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(StargateFacet.address);
        const instanceLido = await ethers.getContractAt('StargateFacet', instance.address);
        let remove = []; 
        remove.push({
            facetAddress: ZERO_ADDRESS,
            action: FacetCutAction.Remove,
            functionSelectors: getSelectors(StargateFacet)
          })
        tx = await diamondCut.diamondCut(remove,ZERO_ADDRESS, "0x");
        txn = await instance.getAllConnectedApps();
        expect (txn).to.not.contain(StargateFacet.address);
     //   await expect (instanceQuick.getPairAddressQuickSwap(usdcAddress,wethAddress)).to.reverted;
    });


    it('Users can swap ETH on Stargate', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: StargateFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(StargateFacet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        const signer = provider.getSigner(Contracts.accounts[0].address);
        const stargateRouter = new ethers.Contract(STARGATE_ROUTER_ADDRESS, StargateRouterAbi, signer);

        await seedWithBaseToken(instance.address, ethers.utils.parseUnits('10000',6));
        const STARGATE_DESTINATION_CHAIN_ID = 110
        const TYPE_SWAP_REMOTE = 1
        const payload = '0x';
        const amountOutMin = ethers.utils.parseUnits('9.98',18);
        const instanceStargate = await ethers.getContractAt('StargateFacet', instance.address);
        const receiver = ethers.utils.solidityPack(
          ["address"], // encode as address 
          [Contracts.accounts[1].address]) //address

        const fees = await stargateRouter.callStatic.quoteLayerZeroFee(
          STARGATE_DESTINATION_CHAIN_ID,
          TYPE_SWAP_REMOTE,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        
        //Swapping ETH --> Mainnet --> Arbitrum 
        txn = await instance
        .createProposal(
          0x2,
          1001,
          Contracts.accounts[1].address,
          ZERO_ADDRESS,
          ethers.utils.parseUnits('10',18),
          STARGATE_DESTINATION_CHAIN_ID,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);
        txn = await instanceStargate.swapEthStargate(1,fee,amountOutMin); // voteID
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(1001);



      });

      it('Users can swap Token on Stargate', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: StargateFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(StargateFacet)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        const signer = provider.getSigner(Contracts.accounts[0].address);
        const stargateRouter = new ethers.Contract(STARGATE_ROUTER_ADDRESS, StargateRouterAbi, signer);
        const usdc = new ethers.Contract(usdcAddress, stdErc20Abi, signer);

        await seedWithBaseToken(instance.address, ethers.utils.parseUnits('10000',6));
        const STARGATE_DESTINATION_CHAIN_ID = 110
        const TYPE_SWAP_REMOTE = 1
        const payload = '0x';
        const amountOutMin = ethers.utils.parseUnits('98',6);
        const instanceStargate = await ethers.getContractAt('StargateFacet', instance.address);
        const to = web3.utils.padLeft(Contracts.accounts[1].address, 64);
        const receiver = ethers.utils.solidityPack(
          ["address"], // encode as address 
          [Contracts.accounts[1].address]) //address

        const fees = await stargateRouter.callStatic.quoteLayerZeroFee(
          STARGATE_DESTINATION_CHAIN_ID,
          TYPE_SWAP_REMOTE,
          receiver,
          payload,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: '0x' } // lzTxObj
        );
        const fee = fees[0];
        

        //Swapping USDC --> Mainnet --> Arbitrum 
        txn = await instance
        .createProposal(
          0x2,
          1002,
          Contracts.accounts[1].address,
          usdcAddress,
          ethers.utils.parseUnits('100',6),
          STARGATE_DESTINATION_CHAIN_ID,
          false
        );

        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);
        txn = await instanceStargate.swapTokenStargate(1,fee,1,1,amountOutMin); // voteID
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(1002);
        expect (await usdc.callStatic.balanceOf(instance.address)).to.equal(ethers.utils.parseUnits('9900',6))

      });

  
  });