# CryptoMarry Contracts 

CryptoMarry (CM) allows marriage partners to create shared crypto account and manage crypto assets. Notable features: 
    1) If partners both agree for the marriage partnership, a distinct contract will be created. 
    2) CM allows for joint management of crypto assets including sending/receiving ERC20 and ERC721 tokens, and integration to Uniswap and Compound.
    3) CM has built in voting mechanism to reach consensus between partners. Voting is done through LOVE tokens. 
    4) LOVE tokens can be claimed depending on the balance of the marriage contract, or can be bought according to the exchange rate and the cap. 
    5) If partners decide to divorce, the CM protocol provides settlement mechanisms, including: 
       a) Splitting ETH balance 
       b) Splitting ERC20 balance 
       c) Splitting NFT assets 
    6) Partners may decide to add other family members to the contract who can participate in the management of the crypto assets.  
    7) Partners can mint tiered NFT certificates that certify the existance of account within the CM. 
    8) CM has several other convenience functions such as sponsored transactions. 

# Contracts 

A few main contracts include: 

    **1) WaverContract  **
    An entry contract where partners can create marriage contracts. This is the main contract that gives access to a proxy contract. 
    **2) WaverImplementation**
    A proxy contract that carries logic behind reaching consensus and management of crypto assets. 

# Installation

To run CM contracts, pull the repository from Github, and install its dependencies. You will need [npm](https://docs.npmjs.com/cli/install) installed.


        git clone https://github.com/altyni86/CryptoMarry_Contracts.git
        cd CryptoMarry_Contracts
        run  `npm install`

# Compile 

You can compile contracts through:

        npx hardhat compile

# Testing 

You can JS test the contract by running, you will need to have local node running:

                npx hardhat run scripts/test.js  
                npx hardhat run scripts/integrationtest.js
Scenarios are already have been included for test purposes.  

# Deployment 

You can deploy the contracts through: 
                npx hardhat run scripts/deploy.js 



# Side notes 
    1) Hardhat config is set for Forking - Local or Rinkeby Networks. You will need to include necessary information to env file
    2) Due to issues in OpenZeppelin npm installations, ERC2771ContextUpgradeable.sol has been copied to contracts folder. 
