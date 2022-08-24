require('@nomiclabs/hardhat-waffle');
require('dotenv').config()

module.exports = {
  solidity: '0.8.13',
  networks: {
    forking: {
      url: process.env.FORK_ALCHEMY_URL,
    },
    rinkeby: {
      url: process.env.RINKEBY_ALCHEMY_URL,
      accounts: [process.env.DEPLOY_ACCOUNT],
      
    },
  },
};