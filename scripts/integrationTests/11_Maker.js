
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

  const IMakerVatAbi = [
    'function can(address, address) external view returns (uint)',
    'function ilks(bytes32) external view returns (uint, uint, uint, uint, uint)',
    'function dai(address) external view returns (uint)',
    'function urns(bytes32, address) external view returns (uint, uint)',
    'function frob(bytes32, address, address, address, int, int) external',
    'function hope(address) external',
    'function move(address, address, uint) external',
  ]

  const IMakerGemJoin = [
    "function dec() external view returns (uint)",
    "function gem() external view returns (address)",
    "function join(address, uint) external payable",
    "function exit(address, uint) external",
  ]


const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
const blockNumber = hre.config.networks.hardhat.forking.blockNumber;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const slippage = ethers.BigNumber.from('3');
const makerMcdJoinETHName = 'ETH-A';
let Contracts = {}
const utils = web3.utils;

let jsonRpcServer, baseAssetAddress, 
wethAddress, txn, instance, MakerFacet,MakerInit,data;

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

  
describe("Maker Integration Test", function () {
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
      MakerCDPManagerAddress = networks[net].MakerCDPManager
      MakerProxyActionsAddress = networks[net].MakerProxyActions
      MakerDaiAddress = networks[net].MAKER_MCD_JOIN_DAI
      MakerETHAddress = networks[net].MAKER_MCD_JOIN_ETH_A
      MakerVATAddress = networks[net].MAKER_MCD_VAT
      MakerUSDCAddress = networks[net].MAKER_MCD_JOIN_USDC_A

    });
  
    beforeEach(async () => {
      //await resetForkedChain(hre, providerUrl, blockNumber);
      let WhiteListAddr = [];
      
    Contracts = await deployTest();
     
    MakerFacet = await deploy('MakerFacet',Contracts.forwarder.address,MakerProxyRegistryAddress,daiAddress,MakerChainLogAddress, MakerCDPManagerAddress, MakerProxyActionsAddress);
    MakerInit = await deploy('DiamondInitMaker', MakerProxyRegistryAddress);
    data = MakerInit.interface.encodeFunctionData("init",[])
      
      WhiteListAddr.push({
        ContractAddress: MakerFacet.address,
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
  
    it('Users can connect Maker App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: MakerFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(MakerFacet)
          })

        tx = await diamondCut.diamondCut(cut,MakerInit.address, data);
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(MakerFacet.address)

    });
  
    it('Third party Users cannot connect Maker App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: MakerFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(MakerFacet)
          })
        await expect(diamondCut.connect(Contracts.accounts[3]).diamondCut(cut,MakerInit.address, data)).to.reverted;
    });

    it('Users can disconnect Maker App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: MakerFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(MakerFacet)
          })
        tx = await diamondCut.diamondCut(cut,MakerInit.address, data);
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(MakerFacet.address);
        const instanceMaker = await ethers.getContractAt('MakerFacet', instance.address);
        proxy = await instanceMaker._getProxy()
        let remove = []; 
        remove.push({
            facetAddress: ZERO_ADDRESS,
            action: FacetCutAction.Remove,
            functionSelectors: getSelectors(MakerFacet)
          })
        tx = await diamondCut.diamondCut(remove,ZERO_ADDRESS, "0x");
        txn = await instance.getAllConnectedApps();
        expect (txn).to.not.contain(MakerFacet.address);
        await expect (instanceMaker._getProxy()).to.reverted;
    });


    it('Users can open vault in Maker with minimum ETH', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: MakerFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(MakerFacet)
          })
        txn = await diamondCut.diamondCut(cut,MakerInit.address, data);

        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const vat = new ethers.Contract(MakerVATAddress, IMakerVatAbi, signer);
        await seedWithBaseToken(instance.address, ethers.utils.parseUnits('10000',6));
        const instanceMaker = await ethers.getContractAt('MakerFacet', instance.address);


        const ilkEth = utils.padRight(
          utils.asciiToHex(makerMcdJoinETHName),
          64
        );

        const conf =  await vat.ilks(ilkEth);
        const wad = ethers.BigNumber.from(conf[4]).div(ethers.BigNumber.from('1000000000000000000000000000'))
        const value = ethers.BigNumber.from(conf[4]).div(ethers.BigNumber.from(conf[2])).mul(ethers.BigNumber.from(12)).div(ethers.BigNumber.from(10));

        console.log ("WAD",ethers.utils.formatEther(wad) ,ethers.utils.formatEther(value))

         //Depositing ETH  
         txn = await instance
         .createProposal(
           ilkEth,
           130,
           MakerDaiAddress,
           MakerETHAddress,
           value,
           wad,
           false
         );
 
         txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);
         txn = await instanceMaker.openLockETHAndDraw(1);
         txn = await instance.getVotingStatuses(1);
         expect(txn[0].voteStatus).to.equal(130);


          //Depositing ETH  
          txn = await instance
          .createProposal(
            0x2,
            132,
            ZERO_ADDRESS,
            MakerETHAddress,
            ethers.utils.parseEther("1"),
            100,
            false
          );
  
          txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);
          txn = await instanceMaker.safeLockETH(2); // i'th coin is wheere it is located in pool order 
          txn = await instance.getVotingStatuses(1);
          expect(txn[1].voteStatus).to.equal(132);


           //Withdrawing ETH  
           txn = await instance
           .createProposal(
             0x2,
             134,
             ZERO_ADDRESS,
             MakerETHAddress,
             ethers.utils.parseEther("1"),
             100,
             false
           );
           console.log("INS", instance.address, )
   
           txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);
           txn = await instanceMaker.freeETH(3); // i'th coin is wheere it is located in pool order 
           txn = await instance.getVotingStatuses(1);
           expect(txn[2].voteStatus).to.equal(134);

            //Withdrawing DAI  
            txn = await instance
            .createProposal(
              0x2,
              136,
              "0x0000000000000000000000000000000000000001",
              MakerDaiAddress,
              ethers.utils.parseEther("100"),
              100,
              false
            );
    
            txn = await instance.connect(Contracts.accounts[1]).voteResponse(4, 1, false);
            txn = await instanceMaker.draw(4); // i'th coin is wheere it is located in pool order 
            txn = await instance.getVotingStatuses(1);
            expect(txn[3].voteStatus).to.equal(136);


            //Paying back DAI  
            txn = await instance
            .createProposal(
              0x2,
              137,
              "0x0000000000000000000000000000000000000001",
              MakerDaiAddress,
              ethers.utils.parseEther("50"),
              100,
              false
            );
    
            txn = await instance.connect(Contracts.accounts[1]).voteResponse(5, 1, false);
            txn = await instanceMaker.wipe(5); // i'th coin is wheere it is located in pool order 
            txn = await instance.getVotingStatuses(1);
            expect(txn[4].voteStatus).to.equal(137);


             //Paying back DAI  
             txn = await instance
             .createProposal(
               0x2,
               137,
               "0x0000000000000000000000000000000000000001",
               MakerDaiAddress,
               ethers.utils.parseEther("50"),
               100,
               false
             );
     
             txn = await instance.connect(Contracts.accounts[1]).voteResponse(6, 1, false);
             txn = await instanceMaker.wipe(6); // i'th coin is wheere it is located in pool order 
             txn = await instance.getVotingStatuses(1);
             expect(txn[5].voteStatus).to.equal(137);

      });



      it('Users can open vault in Maker with minimum USDC', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: MakerFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(MakerFacet)
          })
        txn = await diamondCut.diamondCut(cut,MakerInit.address, data);

        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const vat = new ethers.Contract(MakerVATAddress, IMakerVatAbi, signer);
        const tok = new ethers.Contract(MakerUSDCAddress,IMakerGemJoin , signer);
        const usdc = new ethers.Contract(usdcAddress,stdErc20Abi , signer);
        
        await seedWithBaseToken(instance.address, ethers.utils.parseUnits('100000',6));
        const instanceMaker = await ethers.getContractAt('MakerFacet', instance.address);


        const ilkToken = utils.padRight(utils.asciiToHex('USDC-A'), 64);
        const addr = await tok.callStatic.gem()
        const cbal = await usdc.callStatic.balanceOf(instance.address)
       
        const conf =  await vat.ilks(ilkToken);
        const wad = ethers.BigNumber.from(conf[4]).div(ethers.BigNumber.from('1000000000000000000000000000'))
        const value = ethers.BigNumber.from(conf[4]).div(ethers.BigNumber.from(conf[2])).mul(ethers.BigNumber.from(12)).div(ethers.BigNumber.from(10*10^12));
  
         //Depositing USDC. TODO: Need to tune in minumum and limit amounts 
         txn = await instance
         .createProposal(
          ilkToken,
           131,
           MakerDaiAddress,
           MakerUSDCAddress,
           ethers.utils.parseUnits("50000",6),
           0,
           false
         );
 
        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);
        txn = await instanceMaker.openLockGemAndDraw(1); 
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(131);

          //depositing USDC to newly created vault  
          txn = await instance
          .createProposal(
            0x2,
            133,
            usdcAddress,
            MakerUSDCAddress,
            ethers.utils.parseUnits("10000",6),
            100,
            false
          );
  
          txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);
          txn = await instanceMaker.safeLockGem(2);
          txn = await instance.getVotingStatuses(1);
          expect(txn[1].voteStatus).to.equal(133);


           //Withdrawing USDC  
           txn = await instance
           .createProposal(
             0x2,
             135,
             usdcAddress,
             MakerUSDCAddress,
             ethers.utils.parseUnits("500",6),
             100,
             false
           );
     
           txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);
           txn = await instanceMaker.freeGem(3); 
           txn = await instance.getVotingStatuses(1);
           expect(txn[2].voteStatus).to.equal(135);

           await advanceBlockHeight(1000);

            //Withdrawing DAI  
            txn = await instance
            .createProposal(
              0x2,
              136,
              usdcAddress,
              MakerDaiAddress,
              0,
              100,
              false
            );
    
            txn = await instance.connect(Contracts.accounts[1]).voteResponse(4, 1, false);
            txn = await instanceMaker.draw(4); //
            txn = await instance.getVotingStatuses(1);
            expect(txn[3].voteStatus).to.equal(136);


      });



  
  });