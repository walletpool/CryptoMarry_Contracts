// SPDX-License-Identifier: BSL
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

/**
 [BSL License]
 @title NFT Splitter
 @notice This contract transforms ERC721 NFTs into ERC1155 NFTs with 2 identical tokens. 
 @author Ismailov Altynbek <altyni@gmail.com>
*/

/* The sale of NFT using this contract results in royalty for CM */

abstract contract ERC1155Royalty is ERC2981, ERC1155 {
    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {ERC721-_burn}. This override additionally clears the royalty information for the token.
     */
    function _burn(
        address from,
        uint256 tokenID,
        uint256 amount
    ) internal virtual override {
        super._burn(from, tokenID, amount);
        _resetTokenRoyalty(tokenID);
    }
}

/* If a partner collects two copies of the ERC721 NFT, a partner can retreive it from their proxy contract. */
abstract contract Instance {
    function sendNft(
        address nft_address,
        address receipent,
        uint256 nft_ID
    ) external virtual;
}

contract nftSplit is ERC1155Royalty, Ownable {
    using Counters for Counters.Counter; // Counting IDs
    Counters.Counter private _tokenIds; //Storing count IF
    address internal mainAddress; //The address of the main contract
    mapping(address => mapping(uint256 => uint8)) public wasDistributed;
    mapping(address => uint8) internal authrizedAddresses; //Proxies have to authorized here to split NFTs
    mapping(address => mapping(uint256 => uint256)) public tokenTracker; //Tracking NFTs that were split

    /* NFTs that are to be splitted holds the following attrubutes*/
    struct NFTAttributes {
        address nft_address; //the address of the ERC721 NFT
        string image; //image of the NFT
        uint256 nft_ID; //the ID of the ERC721 token
        address implementationAddr; //The address that holds ERC721 NFT
    }

    mapping(uint256 => NFTAttributes) internal nftHolderAttributes; //Storage of the ERC1155 NFTs attributes

    /* The main address is passed to this NFT*/
    constructor(address _mainaddress) ERC1155("") {
        _tokenIds.increment();
        _setDefaultRoyalty(_mainaddress, 100); //Royalty is set to 1% of the sales price.
        mainAddress = _mainaddress;
    }

    /**
     * @notice Addresses of the proxy contracts needs to be added to authorize them to split NFTs held by the contract.
     * @param _addAddresses an Address of the proxy contract.
     */

    function addAddresses(address _addAddresses) external {
        require(mainAddress == msg.sender);
        authrizedAddresses[_addAddresses] = 1;
    }

    /**
     * @notice Changing the main address;
     * @param _mainAddress an Address of the main contract that mints NFTs
     */
    function changeMainAddress(address _mainAddress) external onlyOwner {
        mainAddress = _mainAddress;
    }

    /**
     * @notice Checks whether an account holds both copies of ERC721 tokens
     * @dev TokenID of the ERC1155 token.
     * @param _tokenID The ID of the NFT stored within this contract
     */
    function checkStatus(uint256 _tokenID) external view returns (bool) {
        return balanceOf(msg.sender, _tokenID) == 2;
    }

    /* Utility function that transforms address to trimmed string address */
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

    /**
     * @notice Once divorced, partners can split ERC721 tokens owned by the proxy contract. 
     * @dev Each partner/or other family member can call this function to split ERC721 token between partners.
     Two identical copies of ERC721 will be created by the NFT Splitter contract creating a new ERC1155 token.
      The token will be marked as "Copy". 
     To retreive the original copy, the owner needs to have both copies of the NFT.
     This function is called by the proxy contract.  

     * @param _tokenAddr the address of the ERC721 token that is being split. 
     * @param _tokenID the ID of the ERC721 token that is being split
     * @param image image of the NFT 
     * @param proposer A proposer
     * @param proposed A proposed
     * @param _implementationAddr An address of the proxy contract
     */

    function splitNFT(
        address _tokenAddr,
        uint256 _tokenID,
        string memory image,
        address proposer,
        address proposed,
        address _implementationAddr
    ) external {
        require(authrizedAddresses[msg.sender] == 1, "NAuth Split");
        require(wasDistributed[_tokenAddr][_tokenID] == 0); //ERC721 Token should not be split before
        require(checkOwnership(_tokenAddr, _tokenID) == true); // Check whether the indicated token is owned by the proxy contract.
        wasDistributed[_tokenAddr][_tokenID] = 1; //Check and Effect
        uint256 newItemId = _tokenIds.current();
        _mint(proposer, newItemId, 1, "0x0");
        _mint(proposed, newItemId, 1, "0x0");

        nftHolderAttributes[newItemId] = NFTAttributes({
            nft_address: _tokenAddr,
            image: image,
            nft_ID: _tokenID,
            implementationAddr: _implementationAddr
        });

        tokenTracker[_tokenAddr][_tokenID] = newItemId;

        _tokenIds.increment();
    }

    /**
     * @notice If partner acquires both copies of NFTs, the NFT can be retreived by that partner through this function.
     * @dev The contract checks whether an address has both copies. Tokens are burnt once retreived.
     * @param _tokenID the ID of the ERC721 token that is being sent
     */

    function joinNFT(uint256 _tokenID) external {
        require(balanceOf(msg.sender, _tokenID) == 2, "Not enough balance");
        NFTAttributes storage nftAttributes = nftHolderAttributes[_tokenID];
        Instance instance = Instance(nftAttributes.implementationAddr);
         _burn(msg.sender, _tokenID, 2);
        instance.sendNft(
            nftAttributes.nft_address,
            msg.sender,
            nftAttributes.nft_ID
        );
    }

       /**
     * @notice Checks the ownership of the ERC721 token.
     * @param _tokenAddr the address of the ERC721 token that is being split.
     * @param _tokenID the ID of the ERC721 token that is being split
     */

    function checkOwnership(address _tokenAddr, uint256 _tokenID)
        internal
        view
        returns (bool)
    {
        address _owner;
        _owner = IERC721(_tokenAddr).ownerOf(_tokenID);
        return (msg.sender == _owner);
    }

    /* A view function to see URI of the ERC1155 token*/
    function uri(uint256 _tokenId)
        public
        view
        override
        returns (string memory)
    {
        NFTAttributes memory nftAttributes = nftHolderAttributes[_tokenId];

        string memory json = Base64.encode(
            abi.encodePacked(
                 '{"name": "',
                "CryptoMarry NFT Duplicate.",
                '", "description": "This NFT has been split between partners upon dissolution of the Family Account", "image": "',
                nftAttributes.image,
                '", "attributes":[',
                '{"trait_type": "CryptoMarry copies:", "value": "1 out of 2"},',
                '{"trait_type": "Original is owned by:", "value": "',
                addressToString(nftAttributes.implementationAddr),
                '"}',']}'
            )
        );
        string memory output = string(
            abi.encodePacked("data:application/json;base64,", json)
        );
        return output;
    }
}
