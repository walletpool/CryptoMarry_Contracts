// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
/// [MIT License]
/// @title CryptoMarry NFT contract
/// @notice This contract has NFT viewing functionality
/// @author Ismailov Altynbek <altyni@gmail.com>

import "@openzeppelin/contracts/utils/Base64.sol";

abstract contract WaverContractM {
    function messages(address) external view virtual returns (string memory);
}

abstract contract ReverseRecords {
    function getNames(address[] calldata addresses)
        external
        view
        virtual
        returns (string[] memory r);
}

contract nftview {
    // Some initialization variables
    address internal nftmainAddress;
    address internal mainAddress;
    address internal addressENS;
    address public owner;


    mapping(uint256 => bytes) internal heartPatterns;
    mapping(uint256 => bytes) internal certBackground;
    mapping(uint256 => bytes) internal additionalGraphics;


    constructor( address _ensResolver) {

      addressENS = _ensResolver;
      owner = msg.sender;
    }

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


        // This is to change ENS resolver address
    function changeENSAddress(address _ensaddress) external {
        require(owner == msg.sender);
        addressENS = _ensaddress;
    }
    // This is used to Resolve ENS names
    function reverseResolve(address[] memory addresses)
        internal
        view
        returns (string[] memory r)
    {
        ReverseRecords reverserecords = ReverseRecords(addressENS);
        r = reverserecords.getNames(addresses);
        return r;
    }


       // Functions below to further customize NFTs
    function addheartPatterns(uint256 _id, bytes memory _pattern) external {
        require(owner == msg.sender);
        heartPatterns[_id] = _pattern;
    }

    function addadditionalGraphics(uint256 _id, bytes memory _pattern)
        external
    {
        require(owner == msg.sender);
        additionalGraphics[_id] = _pattern;
    }

    function addcertBackground(uint256 _id, bytes memory _pattern) external {
        require(owner == msg.sender);
        certBackground[_id] = _pattern;
    }


 // Owner is the wallet that created the contract
    function changeOwner(address _addAddresses) external {
        require(owner == msg.sender);
        owner = _addAddresses;
    }

    // This is main  contract
    function changenftmainAddress(address _nftmainAddress) external {
        require(owner == msg.sender);
        nftmainAddress = _nftmainAddress;
    }

     function changeMainAddress(address _mainAddress) external {
        require(owner == msg.sender);
        mainAddress = _mainAddress;
    }



     function getAddr(address _address, uint8 ensStatus)
        internal
        view
        returns (string memory)
    {
        string memory Addr;
        address[] memory _addr = new address[](1);

        if (ensStatus == 1) {
            _addr[0] = _address;
            Addr = reverseResolve(_addr)[0];
        } else {
            Addr = addressToString(_address);
        }

        return Addr;
    }


    // Utility function to turn wallet addresses into strings

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


    // Utility function to turn UINT into string
    function uint2str(uint256 _i)
        internal
        pure
        returns (string memory _uintAsString)
    {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    // Utility function to turn Stakes' into strings
    function generateStake(uint256 _stake)
        private
        pure
        returns (string memory)
    {
        uint256 wholepart = _stake / 1000000000000000000;
        uint256 tenth = _stake / 100000000000000000 - wholepart * 10;
        uint256 hundredth = _stake /
            10000000000000000 -
            wholepart *
            100 -
            tenth *
            10;
        string memory wholestring = uint2str(wholepart);
        string memory tenthsstring = uint2str(tenth);
        string memory hundredsstring = uint2str(hundredth);
        string memory stakeamount = string(
            abi.encodePacked(wholestring, ".", tenthsstring, hundredsstring)
        );
        return stakeamount;
    }


    // Changes Function to view NFTs
    function getURI(uint256 _tokenId,
    CertificateAttributes calldata charAttributes
    )
        public
        view
        returns (string memory)
    {
    require (nftmainAddress == msg.sender);

        string memory Messagetext;
   
      
        if (charAttributes.heartPatternsID >= 1) {
            WaverContractM _wavercContract = WaverContractM(mainAddress);
            Messagetext = string(
                abi.encodePacked(
                    '{"trait_type": "Proposers Love note", "value": "',
                    _wavercContract.messages(charAttributes.waver),
                    '"},{ "trait_type": "Response Love note", "value": "',
                    _wavercContract.messages(charAttributes.proposed),
                    '"},'
                )
            );
        }

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "',
                        "CryptoMarry Certificate.",
                        " -- NFT #: ",
                        uint2str(_tokenId),
                        '", "description": "This Marriage Certificate is stored on the Ethereum.", "image": "data:image/svg+xml;base64,',
                        Base64.encode(
                            bytes(
                                abi.encodePacked(
                                    '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect fill="url(#B)" width="500" height="500" rx="42" ry="42"/><defs><filter id="c"><feGaussianBlur in="SourceGraphic" stdDeviation="50"/></filter><filter id="A" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse" height="500" width="500"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity=".225" width="200%" height="200%"/></filter><clipPath id="a"><rect width="500" height="500" rx="42" ry="42"/></clipPath>',
                                    string(
                                        heartPatterns[
                                            charAttributes.heartPatternsID
                                        ]
                                    ),
                                    "",
                                   string(
                                        certBackground[
                                            charAttributes.certBackgroundID
                                        ]
                                    ),
                                    '</defs><g clip-path="url(#a)"><g style="filter:url(#c);transform:scale(1.5);transform-origin:center top"><path fill="none" d="M0 0h500v500H0z"/><ellipse cx="50%" rx="180" ry="120" opacity=".5"/></g></g><rect x="16" y="16" width="468" height="468" rx="26" ry="26" fill="rgba(0,0,0,0)" stroke="rgba(255,255,255,0.3)"/>',
                                   string(
                                        additionalGraphics[
                                            charAttributes.additionalGraphicsID
                                        ]
                                    ),
                                    '<path fill="url(#p)" stroke="#fff" stroke-width=".4%" d="M72 68 60 56H48L36 68v12l12 12 12 12 12 12 12-12 12-12 12-12V68L96 56H84L72 68Z">',
                                    '<animate attributeName="stroke-width" values="1;5;1" dur="1s" repeatCount="indefinite"/>',
                                    '</path><g mask="url(#g)" fill="#fff" font-family="Courier New, monospace"><text y="85" x="130" font-weight="400" font-size="50">CERTIFICATE</text><text y="130" x="131" font-weight="400" font-size="40">of Marriage</text></g><g style="transform:translate(35px,170px)"><rect width="200" height="40" rx="8" ry="8" fill="rgba(0,0,0,0.6)"/><text x="12" y="30" font-family="Courier New, monospace" font-size="30" fill="#fff"><tspan fill="rgba(255,255,255,0.8)">ID: </tspan>',
                                    uint2str(charAttributes.id),
                                    '</text></g><g style="transform:translate(35px,230px)"><rect width="400" height="40" rx="8" ry="8" fill="rgba(0,0,0,0.6)"/><text x="12" y="30" font-family="Courier New, monospace" font-size="30" fill="#fff"><tspan fill="rgba(255,255,255,0.8)">Stake: </tspan>',
                                    generateStake(charAttributes.stake),
                                    ' rETH</text></g><g style="transform:translate(35px,290px)"><rect width="400" height="40" rx="8" ry="8" fill="rgba(0,0,0,0.6)"/><text x="12" y="30" font-family="Courier New, monospace" font-size="30" fill="#fff"><tspan fill="rgba(255,255,255,0.8)">Block#: </tspan>',
                                    uint2str(charAttributes.blockNumber),
                                    '</text></g><g style="transform:translate(35px,350px)"><rect width="430" height="95" rx="8" ry="8" fill="rgba(0,0,0,0.6)"/><text x="12" y="30" font-family="Courier New, monospace" font-size="30" fill="#fff"><tspan fill="rgba(255,255,255,0.8)">Between: </tspan></text><g fill="#fff" font-family="Courier New, monospace" font-size="16"><text x="12" y="55">',
                                    getAddr(charAttributes.waver,charAttributes.hasensWaver),
                                    '</text><text x="12" y="75">',
                                    getAddr(charAttributes.proposed,charAttributes.hasensProposed),
                                    "</text></g></g></svg>"
                                )
                            )
                        ),
                        '", "attributes":[',
                        Messagetext,
                        ' {"trait_type": "Status", "value": "',
                      charAttributes.Status,
                        '"}]}'
                    )
                )
            )
        );

        string memory output = string(
            abi.encodePacked("data:application/json;base64,", json)
        );
        return output;
    }
}
