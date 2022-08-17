// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

abstract contract ERC1155Royalty is ERC2981, ERC1155 {
    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {ERC721-_burn}. This override additionally clears the royalty information for the token.
     */
    function _burn(address from, uint tokenID, uint amount) internal virtual override {
        super._burn(from, tokenID, amount);
        _resetTokenRoyalty(tokenID);
    }
}

abstract contract Instance {
function sendNft (address nft_address, address receipent, uint nft_ID  ) external virtual;
}


contract nftSplit is ERC1155Royalty, Ownable{ 
  
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    address internal mainAddress;

    // Tracking addresses of Proxy contracts that have right to mint NFT certificates
    mapping(address => uint8) internal authrizedAddresses;
     mapping (address => mapping (uint => uint)) public tokenTracker;


    struct NFTAttributes {
        address nft_address;
        string nft_json1;
        string nft_json2;
        uint256 nft_ID;
        address implementationAddr;
    }


// We create a mapping from the nft's tokenId => that NFTs attributes.
  mapping(uint256 => NFTAttributes) internal nftHolderAttributes;

constructor (address _mainaddress) ERC1155 ("") {
     _tokenIds.increment();
     _setDefaultRoyalty(_mainaddress,100);
      mainAddress = _mainaddress;
    }

  // This is how authorized proxies are registered through main contract

    function addAddresses(address _addAddresses) external {
        require(mainAddress == msg.sender);
        authrizedAddresses[_addAddresses] = 1;
    }

      // This is main factory contract
    function changeMainAddress(address _mainAddress) external onlyOwner {
        mainAddress = _mainAddress;
    }

function checkStatus (uint _tokenID) external view returns (bool) {
      return balanceOf(msg.sender,_tokenID) == 2;
    }

function addressToString(address addr)
        private
        pure
        returns (string memory)
    {
        // Cast address to byte array
        bytes memory addressBytes = abi.encodePacked(addr);
        // Byte array for the new string
        bytes memory stringBytes = new bytes(42);
        // Assign first two bytes to 'Ox'
        stringBytes[0] = "0";
        stringBytes[1] = "x";
        // Iterate over every byte in the array
        // Each byte contains two hex digits that gets individually converted
        // into their ASCII representation and added to the string
        for (uint256 i = 0; i < 20; i++) {
            // Convert hex to decimal values
            uint8 leftValue = uint8(addressBytes[i]) / 16;
            uint8 rightValue = uint8(addressBytes[i]) - 16 * leftValue;
            //Convert decimals to ASCII values
            bytes1 leftChar = leftValue < 10
                ? bytes1(leftValue + 48)
                : bytes1(leftValue + 87);
            bytes1 rightChar = rightValue < 10
                ? bytes1(rightValue + 48)
                : bytes1(rightValue + 87);
            // Add ASCII values to the string byte array
            stringBytes[2 * i + 3] = rightChar;
            stringBytes[2 * i + 2] = leftChar;
        }
        // Cast byte array to string and return
        bytes memory trimmedr = new bytes(8);
        bytes memory trimmedl = new bytes(8);
        for (uint256 k = 0; k < 8; k++) {
            trimmedr[k] = stringBytes[k];
            trimmedl[k] = stringBytes[34 + k];
        }
        string memory trimmed = string(
            abi.encodePacked(trimmedr, "...", trimmedl)
        );
        return trimmed;
    }


  function splitNFT (address _nft_Address, uint _tokenID, string memory nft_json1,string memory nft_json2, address waver, address proposed, address _implementationAddr) external {
     require(authrizedAddresses[msg.sender] == 1, "NAuth Split");
      uint256 newItemId = _tokenIds.current();
      _mint(waver,newItemId,1,"0x0");
      _mint(proposed,newItemId,1,"0x0");

      nftHolderAttributes[newItemId] =  NFTAttributes({
        nft_address: _nft_Address,
        nft_json1: nft_json1,
        nft_json2: nft_json2,
        nft_ID: _tokenID,
        implementationAddr: _implementationAddr
    });

    tokenTracker[_nft_Address][_tokenID] = newItemId;
    
     _tokenIds.increment(); 
  }


function joinNFT (uint256 _tokenID) external {
  require (balanceOf(msg.sender,_tokenID) == 2,"Not enough balance");
  NFTAttributes storage nftAttributes =  nftHolderAttributes[_tokenID]; 
  Instance instance = Instance(nftAttributes.implementationAddr);
  instance.sendNft (nftAttributes.nft_address, msg.sender, nftAttributes.nft_ID);
  _burn(msg.sender,_tokenID,2);

}


function uri(uint256 _tokenId) public view override returns (string memory) {
  
  NFTAttributes memory nftAttributes = nftHolderAttributes[_tokenId];

  string memory json = Base64.encode(
    
      
        abi.encodePacked(nftAttributes.nft_json1,'{"trait_type": "CryptoMarry Split:", "value": "1 out of 2"},','{"trait_type": "Original owned by:", "value": "',addressToString(nftAttributes.implementationAddr),'"},',nftAttributes.nft_json2)
      
    
  );
  string memory output = string(
  abi.encodePacked("data:application/json;base64,", json)
  );
  return output;
}

}

