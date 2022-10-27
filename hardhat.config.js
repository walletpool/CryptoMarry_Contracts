require('@nomiclabs/hardhat-waffle');
require("@nomiclabs/hardhat-etherscan");
require('dotenv').config()
require('solidity-coverage');
require('hardhat-contract-sizer');
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

module.exports = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
          enabled: true,
          runs: 200,
          details: {
            yul: false
          }
      }
    },
},
  networks: {
    forking: {
      url: process.env.FORK_ALCHEMY_URL,
    },
    rinkeby: {
      url: process.env.RINKEBY_ALCHEMY_URL,
      accounts: [process.env.DEPLOY_ACCOUNT],
      
    },
    goerli: {
      url: process.env.GOERLI_ALCHEMY_URL,
      accounts: [process.env.DEPLOY_ACCOUNT],
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  }
}
