require('@nomiclabs/hardhat-waffle');
require("@nomiclabs/hardhat-etherscan");
require('dotenv').config()
require('solidity-coverage');
require('hardhat-contract-sizer');
require("hardhat-gas-reporter");
//npx hardhat size-contracts
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY;

module.exports = {
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
    forking: {
      url: process.env.FORK_ALCHEMY_URL,
    },
    polygon: {
      url: process.env.POLYGON_ALCHEMY_URL,
      accounts: [process.env.DEPLOY_ACCOUNT_POLYGON],
      
    },
    goerli: {
      url: process.env.GOERLI_ALCHEMY_URL,
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
  }
}
