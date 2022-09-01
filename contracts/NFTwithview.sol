// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
/**
/// [MIT License]
/// @title CryptoMarry NFT Certificate Factory
/// @notice This ERC721 contract mints NFT certificates.  
/// @author Ismailov Altynbek <altyni@gmail.com>
 */

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/*A struct that has NFT certificate attributes*/
struct CertificateAttributes {
    address proposer; //Address of the proposer
    address proposed; //Address of the proposed
    string Status; //Marriage status  - Married, Divorced.
    uint8 hasensWaver; //If a proposer has opted in to show ENS within the Certificate
    uint8 hasensProposed; //If a proposed has opted in to show ENS within the Certificate
    uint256 stake; //Current balance of the proxy contract
    uint256 id; //ID of the marriage
    uint256 blockNumber; //BlockNumber when the NFT was created
    uint256 heartPatternsID; //ID of NFT element
    uint256 certBackgroundID; //ID of NFT element
    uint256 additionalGraphicsID; //ID of NFT element
}

/*A separate contract for getting NFT URI*/

abstract contract NftviewC {
    function getURI(uint256, CertificateAttributes memory)
        public
        view
        virtual
        returns (string memory);
}

contract nftmint2 is ERC721 {
    using Counters for Counters.Counter; //counting NFT IDs
    address public owner; //owner of the contract
    address internal mainAddress; //Address of the main contract
    address internal nftViewAddress; //Address of the contract for viewing NFTs

    Counters.Counter private _tokenIds; //Tracking NFT ids

    mapping(uint256 => CertificateAttributes) internal nftHolderAttributes; //Storage of NFT attributes
    mapping(address => mapping(address => uint256)) public nftHolders; //Storage of NFT holders
    mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256)))
        public nftLeft; //tracks a cap for a particular type of NFT certificate


    /*A contract address for viewing URI should be passed to this contract*/
    constructor(address _nftViewAddress) ERC721("CryptoMarry", "LOVE") {
        _tokenIds.increment();
        owner = msg.sender;
        nftViewAddress = _nftViewAddress;
        nftLeft[0][0][0] = 1e6;
        nftLeft[101][0][0] = 1e3;
        nftLeft[101][1001][0] = 1e2;
    }

    /**
     * @notice Changing the owner of this contract
     * @param _addAddresses an Address to which the owner is being changed.
     */
    function changeOwner(address _addAddresses) external {
    
        owner = _addAddresses;
    }

     /**
     * @notice A Sales Cap for NFT types. A combination of IDs create a unique NFT type
     * @param logoID the ID of logo to be minted.
     * @param backgroundID the ID of Background to be minted.
     * @param mainID the ID of other details to be minted.
     * @param cap uint cap for a set of IDs.
     */
    function addNftCap(
        uint256 logoID,
        uint256 backgroundID,
        uint256 mainID,
        uint256 cap
    ) external  {
        require(owner == msg.sender);
        nftLeft[logoID][backgroundID][mainID] = cap;
    }

    /**
     * @notice Changing the main address;
     * @param _mainAddress an Address of the main contract that mints NFTs
     */
    function changeMainAddress(address _mainAddress) external {
        require(owner == msg.sender);
        mainAddress = _mainAddress;
    }

    /**
     * @notice NFT certificates are minted through this function.
     * @dev Two nfts are minted for eah partner.
     * @param _proposer Address of the proposer
     * @param _hasensWaver If a proposer has opted in to show ENS within the Certificate
     * @param _proposed Address of the proposed
     * @param _hasensProposed If a proposed has opted in to show ENS within the Certificate.
     * @param _stake Current balance of the proxy contract
     * @param _heartPatternsID ID of NFT element
     * @param _certBackgroundID ID of NFT element
     * @param _additionalGraphicsID ID of NFT element
     */

    function mintCertificate(
        address _proposer,
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
         nftLeft[_heartPatternsID][_certBackgroundID][_additionalGraphicsID] -= 1;

        _safeMint(_proposer, newItemId);

        nftHolderAttributes[newItemId] = CertificateAttributes({
            proposer: _proposer,
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

        nftHolders[_proposer][_proposed] = newItemId;

        _tokenIds.increment();
        newItemId = _tokenIds.current();

        _safeMint(_proposed, newItemId);

        nftHolderAttributes[newItemId] = CertificateAttributes({
            proposer: _proposer,
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

        _tokenIds.increment();
    }

    /**
     * @notice If partners divorce, this function will change the status of the NFT.
     * @dev Both NFTs change status. Main contract can call this function.
     * @param _proposer Address of the proposer
     * @param _proposed Address of the proposed
     * @param _status Status of the marriage
     */

    function changeStatus(
        address _proposer,
        address _proposed,
        bool _status
    ) external {
        require(mainAddress == msg.sender);
        uint256 nftTokenIdOfPlayer = nftHolders[_proposer][_proposed];
        CertificateAttributes storage certificate = nftHolderAttributes[
            nftTokenIdOfPlayer
        ];
        if (_status == false) {
            certificate.Status = "Divorced";
            CertificateAttributes storage certificate2 = nftHolderAttributes[
                nftTokenIdOfPlayer + 1
            ];
            certificate2.Status = "Divorced";
        }
    }

    /**
     * @notice This function returns string token URI
     * @dev URI string is generated by a separate contract with given attributes.
     * @param _tokenId The ID of the NFT.
     */

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
        return output;
    }
}
