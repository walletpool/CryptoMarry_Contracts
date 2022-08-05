// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/metatx/MinimalForwarder.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./SecuredTokenTransfer.sol";

/// [MIT License]
/// @title Main contract for CryptoMarry to handle initial user interactions
/// @notice This contract to creat proxy contract and get initial approvals
/// @author Ismailov Altynbek <altyni@gmail.com>

//This is how Factory contract that creates procy contracts
abstract contract WaverFactoryC {
    function newMarriage(
        address _addressWaveContract,
        address _Forwarder,
        address _swapRouterAddress,
        uint256 id,
        address _waver,
        address _proposed,
        uint256 _marryDate
    ) public virtual returns (address);

    function MarriageID(uint256 id) public virtual returns (address);
}

//This is how proxy contracts are added for NFT mint interactions
abstract contract NFTContract {
     function mintCertificate(
        address _waver,
        uint8 _hasensWaver,
        address _proposed,
        uint8 _hasensProposed,
        uint256 _stake,
        uint256 _id,
        uint256 _heartPatternsID,
        uint256 _certBackgroundID,
        uint256 mainID
    ) external virtual;
    
    function changeStatus(
        address _waver,
        address _proposed,
        bool _status
    ) external virtual;

}
abstract contract nftSplitC {
function addAddresses(address _addAddresses) public virtual;}

abstract contract waverImplementation1 {
function _addFamilyMember (address _member, address _owner ) external virtual; }

contract WavePortal7 is
    ERC20,
    ERC2771Context,
    ReentrancyGuard,
    SecuredTokenTransfer,
    Ownable
{
    //Variables
    uint256 internal id; //tracking ids for marriages
    uint256 public policyDays;
    address public addressNFT;
    address public addressNFTSplit;
    uint256 public saleCap; //Maximum sale at a time
    uint256 public minPricePolicy;
    uint256 public middlePricePolicy;
    uint256 public highPricePolicy;
    address public waverFactoryAddress;
    address public forwarderAddress;
    address public swapRouterAddress;
    
    uint24 public poolFee;
    uint256 public cmFee;
     

    //Struct

    enum Status {
        Declined, 
        Proposed,
        Cancelled,
        Accepted,
        Processed,
        Divorced,
        WaitingConfirmation,
        joinConfirmed,
        NftMinted,
        TokenSold
    }

    struct Wave {
        uint256 id;
        address waver;
        address proposed;
        Status ProposalStatus;
        uint256 stake; //Stake how much will be put in contract.
        uint256 gift; //The amount that will be sent to proposed.
        address marriageContract;
    }

    mapping(address => uint256) internal proposers;
    mapping(address => uint256) internal proposedto;
    mapping(address => mapping(bool => uint256)) public child;
    mapping(address => uint8) internal hasensName;
    mapping(uint256 => Wave) internal proposalAttributes;
    mapping(address => string) public messages;
    mapping(address => uint8) internal authrizedAddresses;
    mapping(address => address[]) internal familyMembers;
    mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256))) public nftLeft;
    mapping (address => bool) public NftMinted;
       

    //event types 1 - NewWave, 2-proposal response, 3-Proposal Cancel, 4- proposal executed, 5-divorce proposed, 6-responded, 7 not responded in 28 days
    event NewWave(
        uint256 id,
        address indexed sender,
        uint256 timestamp,
        Status vid
    ); //done

    //The contract uses Minimal Forwarder contracts to sponsor TXs
    constructor(
        MinimalForwarder forwarder,
        address _nftaddress,
        address _waveFactory,
        address _swaprouter
    ) payable ERC20("CryptoMarry", "LOVE") ERC2771Context(address(forwarder)) {
        policyDays = 10 minutes;
        addressNFT = _nftaddress;
        saleCap = 1e21;
        minPricePolicy = 1e13;
        middlePricePolicy = 1e14;
        highPricePolicy = 1e15;
        forwarderAddress = address(forwarder);
        waverFactoryAddress = _waveFactory;
        nftLeft[0][0][0] = 1e6;
        nftLeft[101][0][0] = 1e3;
        nftLeft[101][1001][0] = 1e2;
        swapRouterAddress = _swaprouter;
        poolFee = 3000; 
    }


      modifier onlyContract() {
        require(authrizedAddresses[msg.sender] == 1);
        _;
    }

    //These two functions to reconcile minimal Forwarder and ERC20 contracts for MSGSENDER
    function _msgSender()
        internal
        view
        override(Context, ERC2771Context)
        returns (address)
    {
        return ERC2771Context._msgSender();
    }

    function _msgData()
        internal
        view
        override(Context, ERC2771Context)
        returns (bytes memory)
    {
        return ERC2771Context._msgData();
    }

    //These functions are used to mint and burn native LOVE tokens called from proxy contracts
    function mint(address _to, uint256 _amount) external onlyContract {
        _mint(_to, _amount);
    }

    function burn(address _to, uint256 _amount) external onlyContract {
        _burn(_to, _amount);
    }

    //These functions are used to set cooldown days of minting and divorce
    function changePolicy(uint256 _policyDays) external onlyOwner {
        policyDays = _policyDays;
    }

    //These functions are used to set prices for NFTs
    function changePricePolicy(
        uint256 _minPricePolicy,
        uint256 _middlePricePolicy,
        uint256 _highPricePolicy
    ) external onlyOwner {
        minPricePolicy = _minPricePolicy;
        middlePricePolicy = _middlePricePolicy;
        highPricePolicy = _highPricePolicy;
    }

    //To get the list of family members per proxy contract
    function getFamilyMembers(address _instance)
        external
        view
        returns (address[] memory)
    {
        return familyMembers[_instance];
    }

    //This is to control how many LOVE tokens could be sold
    function changeSaleCap(uint256 _saleCap) external onlyOwner {
        saleCap = _saleCap;
    }

    //This is to control how many NFTs can be minted
    function addNftCap(
        uint256 logoID,
        uint256 BackgroundID,
        uint256 MainID,
        uint256 Cap
    ) external onlyOwner {
        nftLeft[logoID][BackgroundID][MainID] = Cap;
    }


    //These functions to control reference contract addresses if they change
    function changeaddressNFT(address _addressNFT) external onlyOwner {
        addressNFT = _addressNFT;
    }
 
    //These functions to control reference contract addresses if they change
    function changeaddressNFTSplit(address _addressNFTSplit) external onlyOwner {
        addressNFTSplit = _addressNFTSplit;
    }


    function changewaverFactoryAddress(address _addressFactory)
        external
        onlyOwner
    {
        waverFactoryAddress = _addressFactory;
    }

    function changeforwarderAddress(address _forwarderAddress)
        external
        onlyOwner
    {
        forwarderAddress = _forwarderAddress;
    }


    function changeswaprouterAddress(address _routerAddress)
        external
        onlyOwner
    {
        swapRouterAddress = _routerAddress;
    }

    //Adding family members through proxy contracts

    function addFamilyMember(address _familyMember, uint256 _id) external onlyContract {
        child[_familyMember][false] = _id;
        Wave storage waver = proposalAttributes[_id];
        familyMembers[waver.marriageContract].push(_familyMember);
    }

 function divorceUpdate(uint256 _id) external onlyContract {
     Wave storage waver = proposalAttributes[_id];
    require(waver.ProposalStatus == Status.Processed);
    waver.ProposalStatus = Status.Divorced;  
    if (NftMinted[waver.marriageContract] = true) {
        NFTContract NFTmint = NFTContract(addressNFT);
        NFTmint.changeStatus(waver.waver, waver.proposed, false);    }
    }

    //Deleting family members through proxy contracts
    function deleteFamilyMember(address _familyMember) external onlyContract{
        if (child[_familyMember][true] > 0) {
            child[_familyMember][true] = 0;
        } else {
            child[_familyMember][false] = 0;
        }
    }


     //User mints NFTs and pays to the main contract from which comissions are withdrawn
    function MintCertificate(
        uint256 logoID,
        uint256 BackgroundID,
        uint256 MainID
    ) external payable {
        //getting price and NFT address
        require(
            msg.value >= minPricePolicy
        );

        uint256 _id = checkAuth();
        Wave storage waver = proposalAttributes[_id];
        require(waver.ProposalStatus == Status.Processed);
        NftMinted[waver.marriageContract] = true;

        NFTContract NFTmint = NFTContract(addressNFT);

        if (BackgroundID >= 1000) {
            require(msg.value >= highPricePolicy);
        } else if (logoID >= 100) {
            require(msg.value >= middlePricePolicy);
        }

        NFTmint.mintCertificate(
            waver.waver,
            hasensName[waver.waver],
            waver.proposed,
            hasensName[waver.proposed],
            waver.stake,
            waver.id,
            logoID,
            BackgroundID,
            MainID
        );
    nftLeft[logoID][BackgroundID][MainID] -= 1;
    _mint(waver.waver, msg.value * 50);
    _mint(waver.proposed, msg.value * 50);
    saleCap -= (msg.value * 100);
    emit NewWave(
        _id,
        msg.sender,
        block.timestamp,
        Status.NftMinted
    );
    }

      //User mints LOVE tokens and pays to the main contract from which comissions are withdrawn

    function buyLovToken() external payable {
        require(msg.value > 0 && saleCap > 0);
        uint256 _id = checkAuth();
        _mint(msg.sender, msg.value * 100);
        saleCap -= (msg.value * 100);

        emit NewWave(
        _id,
        msg.sender,
        block.timestamp,
        Status.TokenSold
    );
    }



    //This is onboarding function that allows user to propose Marriages
    function wave(
        address _proposed,
        uint256 _stake,
        uint256 _gift,
        string memory _message,
        uint8 _hasensWaver
    ) public {
        id += 1;
        require(
            msg.sender != _proposed &&
            proposers[msg.sender] == 0 &&
            proposedto[msg.sender] == 0 &&
            proposedto[_proposed] == 0 &&
            proposers[_proposed] == 0
        );

        proposers[msg.sender] = id;
        proposedto[_proposed] = id;
        hasensName[msg.sender] = _hasensWaver;
        messages[msg.sender] = _message;

        proposalAttributes[id] = Wave({
            id: id,
            waver: msg.sender,
            proposed: _proposed,
            ProposalStatus: Status.Proposed,
            stake: _stake,
            gift: _gift,
            marriageContract: 0x0000000000000000000000000000000000000000
        });

        emit NewWave(id, msg.sender, block.timestamp, Status.Proposed);
    }

    //Reset proposals
    function reset(address waver, address proposed) internal {
        proposers[waver] = 0;
        proposedto[proposed] = 0;
    }

    //Function to respond to the proposal
    function approvals(
        string memory _message,
        uint8 _agreed,
        uint8 _hasensProposed
    ) public {
        address msgSender_ = _msgSender();
        uint256 _id = proposedto[msgSender_];
        Wave storage waver = proposalAttributes[_id];
        require(waver.ProposalStatus == Status.Proposed);
         messages[msgSender_] = _message;

        if (_agreed == 1) {
            waver.ProposalStatus = Status.Accepted;
            hasensName[msgSender_] = _hasensProposed;
        } else {
            waver.ProposalStatus = Status.Cancelled;
            proposedto[msgSender_] = 0;
        }
        emit NewWave(_id, msgSender_, block.timestamp, waver.ProposalStatus);
    }

    //Function to cancel  the proposal
    function cancel() external {
        uint256 _id = checkAuth();
        Wave storage waver = proposalAttributes[_id];
        require(waver.ProposalStatus != Status.Processed && waver.ProposalStatus != Status.Declined);
        waver.ProposalStatus = Status.Cancelled;
        emit NewWave(_id, _msgSender(), block.timestamp, Status.Cancelled);
        reset(waver.waver, waver.proposed);
    }

    //Function to join the family if they are invited

    function joinFamily(bool _response) external {
        address msgSender_ = _msgSender();
        require(child[msgSender_][false] > 0);
        if (_response == true) {
            uint _id = child[msgSender_][false];
            child[msgSender_][true] = _id;
            child[msgSender_][false] = 0;
            Wave storage waver = proposalAttributes[_id];
            waverImplementation1 waverImplementation = waverImplementation1(waver.marriageContract);
            waverImplementation._addFamilyMember(msgSender_,waver.proposed);
        } else {
            child[msgSender_][false] = 0;
        }
        emit NewWave(child[msgSender_][true], msgSender_, block.timestamp, Status.joinConfirmed);
    }

    //This is main function to create a proxy contract. User send some funds to a newly created contract.

    function execute() external payable nonReentrant {
        uint256 _id = proposers[msg.sender];
        Wave storage waver = proposalAttributes[_id];
        require(waver.ProposalStatus == Status.Accepted);
        require(msg.value >= (waver.gift + waver.stake));

        WaverFactoryC factory = WaverFactoryC(waverFactoryAddress);

        address _newMarriageAddress;
        _newMarriageAddress = factory.newMarriage(
            address(this),
            forwarderAddress,
            swapRouterAddress,
            waver.id,
            waver.waver,
            waver.proposed,
            block.timestamp
        );

        _newMarriageAddress = factory.MarriageID(waver.id);

        nftSplitC nftsplit = nftSplitC(addressNFTSplit);
        nftsplit.addAddresses(_newMarriageAddress);

        authrizedAddresses[_newMarriageAddress] = 1;
        waver.marriageContract = _newMarriageAddress;

        processtxn(payable(_newMarriageAddress), (waver.stake));

        if (waver.gift > 0) {
            uint256 _gift = (waver.gift * 99) / 100;
            waver.gift = 0;
            processtxn(payable(waver.proposed), _gift);
        }

        waver.ProposalStatus = Status.Processed;

        emit NewWave(_id, msg.sender, block.timestamp, Status.Processed);
    }

    //This is to withdraw commissions that accumulated in this contract.
    function withdrawcomission() external onlyOwner {
        processtxn(payable(msg.sender), address(this).balance);
    }

    function withdrawERC20(address _tokenID) external onlyOwner {
        uint256 amount;
        amount = IERC20(_tokenID).balanceOf(address(this));
        require(
            transferToken(_tokenID, payable(msg.sender), amount)
        );
    }

    //This is internal function to proccess payments
    function processtxn(address payable _to, uint256 _amount) internal {
        (bool success, ) = _to.call{value: _amount}("");
        require(success);
    }

    function getBalance() public view returns (uint256) {
        return (address(this).balance);
    }


    //This is used to check whether user is authorized and has contract in CryptoMarry
    function checkAuth() internal view returns (uint256 __id) {
        uint256 _id;
        address msgSender_ = _msgSender();
        if (proposers[msgSender_] > 0) {
            _id = proposers[msgSender_];
        } else if (proposedto[msgSender_] > 0) {
            _id = proposedto[msgSender_];
        } else if (child[msgSender_][true] > 0) {
            _id = child[msgSender_][true];
        } else if (child[msgSender_][false] > 0) {
            _id = 1e9;
        }
        return (_id);
    }

    //View function to check who has contract

    function checkMarriageStatus() public view returns (Wave memory) {
        // Get the tokenId of the user's character NFT
        uint256 _id = checkAuth();
        // If the user has a tokenId in the map, return their character.
        if (_id > 0 && _id < 1e9) {
            return proposalAttributes[_id];
        } else if (_id == 1e9) {
            return
                Wave({
                    id: _id,
                    waver: msg.sender,
                    proposed: msg.sender,
                    ProposalStatus: Status.WaitingConfirmation,
                    stake: 0,
                    gift: 0,
                    marriageContract: 0x0000000000000000000000000000000000000000
                });
        }
        // Else, return an empty character.
        else {
            Wave memory emptyStruct;
            return emptyStruct;
        }
    }

    receive() external payable {
        require(msg.value > 0);
    }
}
