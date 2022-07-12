// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
/// [MIT License]
/// @title CryptoMarry NFT contract
/// @notice This contract has NFT minting functionality
/// @author Ismailov Altynbek <altyni@gmail.com>

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

  struct CertificateAttributes {
        address waver;
        address proposed;
        string Status;
        uint8 hasensWaver;
        uint8 hasensProposed;
        uint256 stake;
        uint256 id;
        uint256 blockNumber;
        uint256 heartPatternsID;
        uint256 certBackgroundID;
        uint256 additionalGraphicsID;
    }
  

abstract contract NftviewC {
  
    function getURI(uint256,
    CertificateAttributes memory
    )
        public
        virtual
        view
        returns (string memory);
}


contract nftmint2 is ERC721 {
   
    // Some initialization variables
    using Counters for Counters.Counter;
    address public owner;
    address internal mainAddress;
    address internal nftViewAddress; 

  
    Counters.Counter private _tokenIds;

 
   
    // We create a mapping from the nft's tokenId => that NFTs attributes.
    mapping(uint256 => CertificateAttributes) internal nftHolderAttributes;

    // A mapping from an address => the NFTs tokenId. Gives me an ez way
    // to store the owner of the NFT and reference it later.
    mapping(address => mapping(address => uint256)) public nftHolders;


    constructor(address _nftViewAddress) ERC721("CryptoMarry", "LOVE") {
        _tokenIds.increment();
        owner = msg.sender;
        nftViewAddress = _nftViewAddress;
    }

 
    // Owner is the wallet that created the contract
    function changeOwner(address _addAddresses) external {
        require(owner == msg.sender);
        owner = _addAddresses;
    }


    // This is main  contract
    function changeMainAddress(address _mainAddress) external {
        require(owner == msg.sender);
        mainAddress = _mainAddress;
    }


    // Main function to mint NFT certificates from proxy contracts. Two NFTs are minted.
    function mintCertificate(
        address _waver,
        uint8 _hasensWaver,
        address _proposed,
        uint8 _hasensProposed,
        uint256 _stake,
        uint256 _id,
        uint256 _heartPatternsID,
        uint256 _certBackgroundID,
        uint256 _additionalGraphicsID
    ) external {
        require(mainAddress == msg.sender);

        uint256 newItemId = _tokenIds.current();

        _safeMint(_waver, newItemId);

        nftHolderAttributes[newItemId] = CertificateAttributes({
            waver: _waver,
            proposed: _proposed,
            Status: "Married",
            hasensWaver: _hasensWaver,
            hasensProposed: _hasensProposed,
            stake: _stake,
            id: _id,
            blockNumber: block.number,
            heartPatternsID: _heartPatternsID,
            certBackgroundID: _certBackgroundID,
            additionalGraphicsID: _additionalGraphicsID
        });

        // Keep an easy way to see who owns what NFT.
        nftHolders[_waver][_proposed] = newItemId;

        _tokenIds.increment();
        newItemId = _tokenIds.current();

        _safeMint(_proposed, newItemId);

        nftHolderAttributes[newItemId] = CertificateAttributes({
            waver: _waver,
            proposed: _proposed,
            Status: "Married",
            hasensWaver:  _hasensWaver,
            hasensProposed: _hasensProposed,
            stake: _stake,
            id: _id,
            blockNumber: block.number,
            heartPatternsID: _heartPatternsID,
            certBackgroundID: _certBackgroundID,
            additionalGraphicsID: _additionalGraphicsID
        });
        // Increment the tokenId for the next person that uses it.
        _tokenIds.increment();
    }


    // Changes the status of NFT
    function changeStatus(
        address _waver,
        address _proposed,
        bool _status
    ) external {
        require(mainAddress == msg.sender);
        // Get the state of the player's NFT.
        uint256 nftTokenIdOfPlayer = nftHolders[_waver][_proposed];
        CertificateAttributes storage certificate = nftHolderAttributes[
            nftTokenIdOfPlayer
        ];
        if (_status == false) {
        certificate.Status = "Divorced";
        CertificateAttributes storage certificate2 = nftHolderAttributes[
            nftTokenIdOfPlayer + 1
        ];
        certificate2.Status = "Divorced"; }
    }

    // Changes Function to view NFTs
    function tokenURI(uint256 _tokenId)
        public
        view
        override
        returns (string memory)
    {
        CertificateAttributes memory charAttributes = nftHolderAttributes[
            _tokenId
        ];
        NftviewC _nftview = NftviewC(nftViewAddress);
       
       string memory output = _nftview.getURI(_tokenId, charAttributes);
       return output ;
      
    }
}
