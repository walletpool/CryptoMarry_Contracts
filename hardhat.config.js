require('@nomiclabs/hardhat-waffle');
require("@nomiclabs/hardhat-etherscan");
require('dotenv').config()
require('solidity-coverage');
require('hardhat-contract-sizer');
require("hardhat-gas-reporter");
//npx hardhat size-contracts
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY;

// Choose the Comet instance to run tests against using the `connections` object
const cometInstance = 'usdc-mainnet';

// Optionally, you can hardcode provider URLs here
const connections = {
  'usdc-mainnet': {
    providerUrl: process.env.FORK_ALCHEMY_URL,
    //blockNumber: 15415000, // 2022-08-26T11:06:22.000Z
    blockNumber: 16783000, // 2022-12-15T18:51:47.000Z
    chainId: 1,
  },
  'usdc-goerli': {
    providerUrl: process.env.GOERLI_ALCHEMY_URL,
    blockNumber: 8141000, // 2022-12-15T19:00:48.000Z
    chainId: 5,
  },
};

const { providerUrl, blockNumber, chainId } = connections[cometInstance];

if (!providerUrl) {
  console.error('Cannot connect to the blockchain.');
  console.error('Add a provider URL in the hardhat.config.js file.');
  process.exit(1);
}

// Do not use this mnemonic outside of localhost tests!
const mnemonic = 'romance zebra roof insect stem water kiwi park acquire domain gossip second';

if (!providerUrl) {
  console.error('Missing JSON RPC provider URL as environment variable. See hardhat.config.js.');
  process.exit(1);
}


module.exports = {
  cometInstance, // this tells the test scripts which addresses to use
  testProviderUrl: providerUrl,
  testBlockNumber: blockNumber,
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
          enabled: true,
          runs: 100,
          details: {
            yul: false
          }
      }
    },
},
gasReporter: {
  outputFile: "gas-report.txt",
  enabled: process.env.REPORT_GAS !== undefined,
  currency: "USD",
  noColors: true,
  coinmarketcap: process.env.COIN_MARKETCAP_API_KEY || "",
  token: "ETH"
},
  networks: {
    hardhat: {
      chainId,
      forking: {
        url: providerUrl,
        blockNumber,
      },
      gasPrice: 0,
      initialBaseFeePerGas: 0,
      loggingEnabled: false,
      accounts: {
        mnemonic
      },
    },

    
    polygon: {
      url: process.env.POLYGON_ALCHEMY_URL,
      accounts: [process.env.DEPLOY_ACCOUNT_POLYGON],
      
    },
    goerli: {
      url: process.env.GOERLI_ALCHEMY_URL,
      accounts: [process.env.DEPLOY_ACCOUNT_GOERLI],
    },
    sepolia: {
      url: process.env.SEPOLIA_ALCHEMY_URL,
      accounts: [process.env.DEPLOY_ACCOUNT_GOERLI],
    },
    mainnet: {
      url: process.env.MAINNET_ALCHEMY_URL,
      accounts: [process.env.DEPLOY_ACCOUNT_MAINNET],
    },
  },
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      goerli: ETHERSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY}
  },
  mocha: {
    timeout: 60000
  }
}
