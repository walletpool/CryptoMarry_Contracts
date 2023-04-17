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
wethAddress, txn,CompoundV3FacetUSDC, instance,
WavePortal7, WaverImplementation,nftContract,nftSplit, diamondInit, diamondLoupeFacet, DiamondCutFacet , CompoundFacet;

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
    tx = await comet.withdraw(usdcAddress, (21000 * 1e6).toString());
    await tx.wait(1);
  
    // transfer from this account to the main test account (0th)
    tx = await usdc.transfer(toAddress, (amt).toString());
    await tx.wait(1);
  
    return;
  }

describe("Compound III Integration Test", function () {
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
      
    });
  
    beforeEach(async () => {
      //await resetForkedChain(hre, providerUrl, blockNumber);
      let WhiteListAddr = [];
      
    Contracts = await deployTest();
     
    CompoundV3FacetUSDC = await deploy('CompoundV3FacetUSDC',Contracts.forwarder.address,cometAddress, wethAddress);
      
      WhiteListAddr.push({
        ContractAddress: CompoundV3FacetUSDC.address,
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
  
    it('Users Can connect CompoundV3 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: CompoundV3FacetUSDC.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CompoundV3FacetUSDC)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(CompoundV3FacetUSDC.address)
    });
  
    it('Third party Users cannot connect CompoundV3 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: CompoundV3FacetUSDC.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CompoundV3FacetUSDC)
          })
        await expect(diamondCut.connect(Contracts.accounts[3]).diamondCut(cut,ZERO_ADDRESS, "0x")).to.reverted;
    });

    it('Users Can disconnect CompoundV3 App', async () => {
        const cut = []
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        let tx;
        let receipt;
        cut.push({
            facetAddress: CompoundV3FacetUSDC.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CompoundV3FacetUSDC)
          })
        tx = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");
        receipt = await tx.wait();
        txn = await instance.getAllConnectedApps();
        expect (txn).contain(CompoundV3FacetUSDC.address);
        const stakeWETH = await ethers.getContractAt('CompoundV3FacetUSDC', instance.address);
        txn = await stakeWETH.getTvlUSDC()
        let remove = []; 
        remove.push({
            facetAddress: ZERO_ADDRESS,
            action: FacetCutAction.Remove,
            functionSelectors: getSelectors(CompoundV3FacetUSDC)
          })
        tx = await diamondCut.diamondCut(remove,ZERO_ADDRESS, "0x");
        txn = await instance.getAllConnectedApps();
        expect (txn).to.not.contain(CompoundV3FacetUSDC.address);
        await expect (stakeWETH.getTvlUSDC()).to.reverted;
    });

    it('Users can supply ETH, and get back WETH', async () => {
      const cut = []
      const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
      const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
      cut.push({
          facetAddress: CompoundV3FacetUSDC.address,
          action: FacetCutAction.Add,
          functionSelectors: getSelectors(CompoundV3FacetUSDC)
        })
      txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

      //Getting some WETH
      const signer = provider.getSigner(Contracts.accounts[0].address);
      const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);
      const weth = new ethers.Contract(wethAddress, wethAbi, signer);
      const stakeWETH = await ethers.getContractAt('CompoundV3FacetUSDC', instance.address);
      const amount = ethers.utils.parseEther('10')
   
      txn = await instance
      .createProposal(
        0x2,
        800, 
        "0x0000000000000000000000000000000000000000",
        wethAddress,
        amount,
        100,
        false
      );
      txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);    
      txn = await stakeWETH.executeSupplyCompoundV3USDC(1);
      txn = await instance.getVotingStatuses(1);
      expect(txn[0].voteStatus).to.equal(800);
      txn = await stakeWETH.callStatic.getcollateralBalanceOfUSDC(wethAddress);
      expect (Number(ethers.utils.formatEther(amount))).to.equal(Number(ethers.utils.formatEther(txn)));
      txn = await instance.callStatic.balance();
      expect (Number(ethers.utils.formatEther(txn))).to.equal(90);

        //Withdrawing my ETH
      txn = await instance
        .createProposal(
          0x2,
          803,
          "0x0000000000000000000000000000000000000000",
          wethAddress,
          ethers.utils.parseEther('10'),
          100,
          false
        );
        txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);
        txn = await stakeWETH.executeSupplyCompoundV3USDC(2);
        txn = await stakeWETH.callStatic.getcollateralBalanceOfUSDC(wethAddress);
        expect (Number(ethers.utils.formatEther(txn))).to.equal(0);
        txn = await instance.callStatic.balance();
        expect (Number(ethers.utils.formatEther(txn))).to.equal(100);

  });

    it('Users can supply WETH, borrow USDC, and repay of usdc, and get back WETH', async () => {
        const cut = []
        const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
        const diamondCut = await ethers.getContractAt('IDiamondCut', instance.address);
        cut.push({
            facetAddress: CompoundV3FacetUSDC.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(CompoundV3FacetUSDC)
          })
        txn = await diamondCut.diamondCut(cut,ZERO_ADDRESS, "0x");

        //Getting some WETH
        const signer = provider.getSigner(Contracts.accounts[0].address);
        const weth = new ethers.Contract(wethAddress, wethAbi, signer);
        const usdc = new ethers.Contract(baseAssetAddress, stdErc20Abi, signer);
        const stakeWETH = await ethers.getContractAt('CompoundV3FacetUSDC', instance.address);
        let tx = await weth.deposit({ value: ethers.utils.parseEther('100') });
        await tx.wait(1);

        tx = await weth.transfer(instance.address, ethers.utils.parseEther('100'));
        await tx.wait(1);
        const amount = ethers.utils.parseEther('10');

        txn = await instance
        .createProposal(
          0x2,
          801, //Token Type
          "0x0000000000000000000000000000000000000000",
          wethAddress,
          amount,
          100,
          false
        );
        txn = await instance.connect(Contracts.accounts[1]).voteResponse(1, 1, false);
        txn = await stakeWETH.executeSupplyCompoundV3USDC(1);
        txn = await instance.getVotingStatuses(1);
        expect(txn[0].voteStatus).to.equal(801);
       txn = await stakeWETH.callStatic.getcollateralBalanceOfUSDC(wethAddress);
        expect (Number(ethers.utils.formatEther(amount))).to.equal(Number(ethers.utils.formatEther(txn)));
        txn = await weth.callStatic.balanceOf(instance.address);
        expect (Number(ethers.utils.formatEther(txn))).to.equal(90);

        //borrowing USDC
          //Getting Supply APR
        txn = await stakeWETH.callStatic.getSupplyAprUSDC();
        console.log('APR:', txn);
         //Getting USDC Balance 
        txn = await stakeWETH.callStatic.getBalanceOfUSDC();
        console.log('USDC Balance:', txn);

        //Getting Borrow Balance USDC
        txn = await stakeWETH.callStatic.getBorrowBalanceOfUSDC();
        console.log('USDC Borrow Balance:', txn);

          //Getting Borrow APR
          txn = await stakeWETH.callStatic.getBorrowAprUSDC();
          console.log('USDC Borrow APR:', txn);

          //Getting Borrowable USDC
          txn = await stakeWETH.callStatic.getBorrowableAmountUSDC();
          console.log('USDC Borrowable USDC:', ethers.utils.formatUnits(txn,18));

        txn = await instance
        .createProposal(
          0x2,
          804,
          "0x0000000000000000000000000000000000000000",
          usdcAddress,
          ethers.utils.parseUnits("10000",6),
          100,
          false
        );
        txn = await instance.connect(Contracts.accounts[1]).voteResponse(2, 1, false);
        txn = await stakeWETH.executeSupplyCompoundV3USDC(2);
        txn = await instance.getVotingStatuses(1);
        expect(txn[1].voteStatus).to.equal(804);
        bal = await usdc.callStatic.balanceOf(instance.address);
        expect(bal).to.equal(ethers.utils.parseUnits("10000",6))  
        expect (await stakeWETH.getBorrowBalanceOfUSDC()).to.equal(ethers.utils.parseUnits("10000",6));      

        
        //paying with some interest 
        await advanceBlockHeight(1000);
        let outstanding = await stakeWETH.callStatic.getBorrowBalanceOfUSDC();
        await seedWithBaseToken(instance.address, ethers.utils.parseUnits("20000",6));
         //Getting Borrow Balance USDC
         console.log('USDC Borrow Balance:', outstanding);
          //Getting Borrowable USDC
          txn = await stakeWETH.callStatic.getBorrowableAmountUSDC();
          console.log('USDC Borrowable USDC:', ethers.utils.formatUnits(txn,18));
         outstanding = ethers.constants.MaxUint256;
         //repaying full USDC debt
        txn = await instance
        .createProposal(
          0x2,
          805,
          "0x0000000000000000000000000000000000000000",
          usdcAddress,
          outstanding,
          100,
          false
        );
        txn = await instance.connect(Contracts.accounts[1]).voteResponse(3, 1, false);
        txn = await stakeWETH.executeSupplyCompoundV3USDC(3);
        expect (await stakeWETH.getBorrowBalanceOfUSDC()).to.equal(ethers.utils.parseUnits("0",6)); 


        txn = await usdc.callStatic.balanceOf(instance.address);
        console.log('Current USDC Balance:', ethers.utils.formatUnits(txn,6));
          //Supply USDC to check! 
        txn = await instance
        .createProposal(
          0x2,
          802,
          "0x0000000000000000000000000000000000000000",
          usdcAddress,
          ethers.utils.parseUnits("10000",6),
          100,
          false
        );
        txn = await instance.connect(Contracts.accounts[1]).voteResponse(4, 1, false);
        txn = await stakeWETH.executeSupplyCompoundV3USDC(4);

         txn = await stakeWETH.callStatic.getBorrowableAmountUSDC();

          console.log('USDC Borrowable USDC:', ethers.utils.formatUnits(txn,18));

          //Withdrawing my WETH
        txn = await instance
          .createProposal(
            0x2,
            804,
            "0x0000000000000000000000000000000000000000",
            wethAddress,
            amount,
            100,
            false
          );
          txn = await instance.connect(Contracts.accounts[1]).voteResponse(5, 1, false);
          txn = await stakeWETH.executeSupplyCompoundV3USDC(5);

          txn = await stakeWETH.callStatic.getcollateralBalanceOfUSDC(wethAddress);
          expect (Number(ethers.utils.formatEther(txn))).to.equal(0);
          txn = await weth.callStatic.balanceOf(instance.address);
          expect (Number(ethers.utils.formatEther(txn))).to.equal(100);
  
          txn = await stakeWETH.callStatic.getBorrowableAmountUSDC();

          console.log('USDC Borrowable USDC:', ethers.utils.formatUnits(txn,18));
    });

  });