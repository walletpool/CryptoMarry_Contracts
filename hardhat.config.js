require('@nomiclabs/hardhat-waffle');
require('dotenv').config()
require('solidity-coverage');

module.exports = {
  solidity: '0.8.17',
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
};