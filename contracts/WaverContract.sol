/// SPDX-License-Identifier: BSL

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/metatx/MinimalForwarder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
[BSL License]
@title CryptoMarry contract
@notice This is the main contract that sets rules for proxy contract creation, minting ERC20 LOVE tokens,
minting NFT certificates, and other policies for the proxy contract. Description of the methods are provided 
below. 
@author Ismailov Altynbek <altyni@gmail.com>
 */

/*Interface for a Proxy Contract Factory*/
interface WaverFactoryC {
    function newMarriage(
        address _addressWaveContract,
        address _diamondCutFacet,
        uint256 id,
        address _waver,
        address _proposed,
        uint256 policyDays,
        uint256 cmFee
    ) external returns (address);

    function MarriageID(uint256 id) external returns (address);
}

/*Interface for a NFT Certificate Factory Contract*/
interface NFTContract {
    function mintCertificate(
        address _proposer,
        uint8 _hasensWaver,
        address _proposed,
        uint8 _hasensProposed,
        address _marriageContract,
        uint256 _id,
        uint256 _heartPatternsID,
        uint256 _certBackgroundID,
        uint256 mainID
    ) external;

    function changeStatus(
        address _marriageContract,
        bool _status
    ) external;

    function nftHolder(
        address _marriageContract
    ) external returns(uint);

}

/*Interface for a NFT split contracts*/
interface nftSplitC {
    function addAddresses(address _addAddresses) external;
}

/*Interface for a Proxy contract */
interface waverImplementation1 {
    function _addFamilyMember(address _member) external;

    function agreed() external;

    function declined() external;

    function getFamilyMembersNumber() external returns (uint);
}


contract WavePortal7 is ERC20, ERC2771Context, Ownable {
   
    address internal addressNFT; // Address of NFT certificate factory
    address public addressNFTSplit; // Address of NFT splitting contract
    address internal waverFactoryAddress; // Address of Proxy contract factory
    address internal forwarderAddress; // Address of Minimal Forwarder
    address internal diamondCutFacetAddress; // Address of SWAP router UNISWAP
    address internal withdrawaddress; //Address to where comissions are withdrawed/

    uint256 internal id; //IDs of a marriage
    uint256 public saleCap; //Maximum cap of a LOVE token Sale
    uint256 public minPricePolicy; //Minimum price for NFTs
    uint24 public poolFee; // Fee paid by users for Uniswap
    uint256 public cmFee; // Small percentage paid by users for incoming and outgoing transactions.
    uint256 public exchangeRate; // Exchange rate for LOVE tokens for 1 ETH
    uint256 public policyDays; //Cooldown for Dissolution proposal;
    uint256 public claimPolicyDays; //Cooldown for claiming LOVE tokens;

    //Structs

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
        TokenSold,
        Tokenclaimed
    }

    struct Wave {
        uint256 id;
        uint256 stake;
        address proposer;
        address proposed;
        Status ProposalStatus;
        address marriageContract;
    }

    mapping(address => uint256) internal proposers; //Marriage ID of proposer partner
    mapping(address => uint256) internal proposedto; //Marriage ID of proposed partner
    mapping(address => mapping(uint8 => uint256)) public member; //Stores family member IDs
    mapping(address => uint8) internal hasensName; //Whether a partner wants to display ENS address within the NFT
    mapping(uint256 => Wave) internal proposalAttributes; //Attributes of the Proposal of each marriage
    mapping(address => string) public messages; //stores messages of CM users
    mapping(address => uint8) internal authrizedAddresses; //Tracks whether a proxy contract addresses is authorized to interact with this contract.
    mapping(address => address[]) internal familyMembers; // List of family members addresses
    mapping(address => uint256) public claimtimer; //maps addresses to when the last time LOVE tokens were claimed.
    mapping (address => string) public nameAddress; //For giving Names for addresses. 

    /* An event to track status changes of the contract*/
    event NewWave(
        uint256 id,
        address indexed sender,
        uint256 timestamp,
        Status vid
    );

    /* A contructor that sets initial conditions of the Contract*/
    constructor(
        MinimalForwarder forwarder,
        address _nftaddress,
        address _waveFactory,
        address _diamondCutFacet,
        address _withdrawaddress
    ) payable ERC20("CryptoMarry", "LOVE") ERC2771Context(address(forwarder)) {
        claimPolicyDays =  24 hours;
        policyDays = 24 hours;
        addressNFT = _nftaddress;
        saleCap = 1e23;
        minPricePolicy = 1e16;
        forwarderAddress = address(forwarder);
        waverFactoryAddress = _waveFactory;
        diamondCutFacetAddress = _diamondCutFacet;
        cmFee = 100;
        exchangeRate = 1000;
        withdrawaddress = _withdrawaddress;
    }

    /*This modifier check whether an address is authorised proxy contract*/
    modifier onlyContract() {
        require(authrizedAddresses[msg.sender] == 1);
        _;
    }

    /*These two below functions are to reconcile minimal Forwarder and ERC20 contracts for MSGSENDER */
    function _msgData()
        internal
        view
        override(Context, ERC2771Context)
        returns (bytes calldata)
    {
        return ERC2771Context._msgData();
    }

    function _msgSender()
        internal
        view
        override(Context, ERC2771Context)
        returns (address)
    {
        return ERC2771Context._msgSender();
    }

    /**
     * @notice Proposal and separate contract is created with given params.
     * @dev Proxy contract is created for each proposal. Most functions of the proxy contract will be available if proposal is accepted.
     * @param _proposed Address of the one whom proposal is send.
     * @param _message String message that will be sent to the proposed Address
     * @param _hasensWaver preference whether Proposer wants to display ENS on the NFT certificate
     */

    function propose(
        address _proposed,
        string memory _message,
        uint8 _hasensWaver
    ) public payable {
        id += 1;

        require(msg.sender != _proposed);

        require(isMember(_proposed) == 0 && isMember(msg.sender) == 0);

        proposers[msg.sender] = id;
        proposedto[_proposed] = id;
    

        hasensName[msg.sender] = _hasensWaver;
        messages[msg.sender] = _message;

        WaverFactoryC factory = WaverFactoryC(waverFactoryAddress);

        address _newMarriageAddress;

        /*Creating proxy contract here */
        _newMarriageAddress = factory.newMarriage(
            address(this),
            diamondCutFacetAddress,
            id,
            msg.sender,
            _proposed,
            policyDays,
            cmFee
        );

        //_newMarriageAddress = factory.MarriageID(id);

        nftSplitC nftsplit = nftSplitC(addressNFTSplit);
        nftsplit.addAddresses(_newMarriageAddress);

        authrizedAddresses[_newMarriageAddress] = 1;

        proposalAttributes[id] = Wave({
            id: id,
            stake: msg.value,
            proposer: msg.sender,
            proposed: _proposed,
            ProposalStatus: Status.Proposed,
            marriageContract: _newMarriageAddress
        });

        processtxn(payable(_newMarriageAddress), msg.value);

        emit NewWave(id, msg.sender, block.timestamp, Status.Proposed);
    }

    /**
     * @notice Response is given from the proposed Address.
     * @dev Updates are made to the proxy contract with respective response. ENS preferences will be checked onchain.
     * @param _message String message that will be recorded as response.
     * @param _agreed Response sent as uint. 1 - Agreed, anything else will trigger Declined status.
     * @param _hasensProposed preference whether Proposed wants to display ENS on the NFT certificate
     */

    function response(
        string memory _message,
        uint8 _agreed,
        uint8 _hasensProposed
    ) public {
        address msgSender_ = _msgSender();
        uint256 _id = proposedto[msgSender_];

        Wave storage waver = proposalAttributes[_id];
        require(waver.ProposalStatus == Status.Proposed);
        messages[msgSender_] = _message;

        waverImplementation1 waverImplementation = waverImplementation1(
            waver.marriageContract
        );

        if (_agreed == 1) {
            waver.ProposalStatus = Status.Processed;
            hasensName[msgSender_] = _hasensProposed;
            waverImplementation.agreed();
        } else {
            waver.ProposalStatus = Status.Declined;
            proposedto[msgSender_] = 0;
            waverImplementation.declined();
        }
        emit NewWave(_id, msgSender_, block.timestamp, waver.ProposalStatus);
    }

    /**
     * @notice Updates statuses from the main contract on the marriage status
     * @dev Helper function that is triggered from the proxy contract. Requirements are checked within the proxy.
     * @param _id The id of the partnership recorded within the main contract.
     */

    function cancel(uint256 _id) external onlyContract {
        Wave storage waver = proposalAttributes[_id];
        waver.ProposalStatus = Status.Cancelled;
        //emit NewWave(_id, waver.proposer, block.timestamp, Status.Cancelled);
        proposers[waver.proposer] = 0;
        proposedto[waver.proposed] = 0;
    }

    /**
     * @notice Users claim LOVE tokens depending on the proxy contract's balance and the number of family members.
     * @dev LOVE tokens are distributed once within policyDays defined by the owner.
     */

    function claimToken() external {
        (address msgSender_, uint256 _id) = checkAuth();
        Wave storage waver = proposalAttributes[_id];
        require(waver.ProposalStatus == Status.Processed);
        
        require(claimtimer[msgSender_] + claimPolicyDays < block.timestamp, "Not passed");
          waverImplementation1 waverImplementation = waverImplementation1(
            waver.marriageContract
        );
        claimtimer[msgSender_] = block.timestamp;
        uint256 amount = (waver.marriageContract.balance * exchangeRate) /
            (10 * waverImplementation.getFamilyMembersNumber());

        _mint(msgSender_, amount);

        emit NewWave(
            waver.id,
            msgSender_,
            block.timestamp,
            Status.Tokenclaimed
        );
    }

    /**
     * @notice Users can buy LOVE tokens depending on the exchange rate. There is a cap for the Sales of the tokens.
     * @dev Only registered users within the proxy contracts can buy LOVE tokens. Sales Cap is universal for all users.
     */

    function buyLovToken() external payable {
        (address msgSender_, uint256 _id) = checkAuth();
        Wave storage waver = proposalAttributes[_id];
        require(waver.ProposalStatus == Status.Processed);
        uint256 issued = msg.value * exchangeRate;

        _mint(msgSender_, issued);
        saleCap -= (issued);

        emit NewWave(_id, msgSender_, block.timestamp, Status.TokenSold);
    }

    /**
     * @notice Users can mint tiered NFT certificates. 
     * @dev The tier of the NFT is identified by the passed params. The cost of mint depends on minPricePolicy. 
     depending on msg.value user also automatically mints LOVE tokens depending on the Exchange rate. 
     * @param logoID the ID of logo to be minted.
     * @param BackgroundID the ID of Background to be minted.
     * @param MainID the ID of other details to be minted.   
     */

    function MintCertificate(
        uint256 logoID,
        uint256 BackgroundID,
        uint256 MainID
    ) external payable {
        //getting price and NFT address
        require(msg.value >= minPricePolicy);

        (address msgSender_, uint256 _id) = checkAuth();
        Wave storage waver = proposalAttributes[_id];
        require(waver.ProposalStatus == Status.Processed);
        uint256 issued = msg.value * exchangeRate;

        saleCap -= issued;
       
        NFTContract NFTmint = NFTContract(addressNFT);

        if (BackgroundID >= 1000) {
            require(msg.value >= minPricePolicy * 100);
        } else if (logoID >= 100) {
            require(msg.value >= minPricePolicy * 10);
        }

        NFTmint.mintCertificate(
            waver.proposer,
            hasensName[waver.proposer],
            waver.proposed,
            hasensName[waver.proposed],
            waver.marriageContract,
            waver.id,
            logoID,
            BackgroundID,
            MainID
        );

        _mint(waver.proposer, issued / 2);
        _mint(waver.proposed, issued / 2);

        emit NewWave(_id, msgSender_, block.timestamp, Status.NftMinted);
    }

    /* Adding Family Members*/

    /**
     * @notice When an Address has been added to a Proxy contract as a family member, 
     the owner of the Address have to accept the invitation.  
     * @dev The system checks whether the msg.sender has an invitation, if it is i.e. id>0, it adds the member to 
     corresponding marriage id. It also makes pertinent adjustments to the proxy contract. 
     * @param _response Bool response of the owner of Address.    
     */

    function joinFamily(uint8 _response) external {
        address msgSender_ = _msgSender();
        require(member[msgSender_][0] > 0);
        uint256 _id = member[msgSender_][0];

        if (_response == 2) {
            member[msgSender_][1] = _id;
            member[msgSender_][0] = 0;
            Wave storage waver = proposalAttributes[_id];
            waverImplementation1 waverImplementation = waverImplementation1(
                waver.marriageContract
            );
            waverImplementation._addFamilyMember(msgSender_);
        } else {
            member[msgSender_][0] = 0;
        }

        emit NewWave(_id, msgSender_, block.timestamp, Status.joinConfirmed);
    }

    /**
     * @notice A proxy contract adds a family member through this method. A family member is first invited,
     and added only if the indicated Address accepts the invitation.   
     * @dev invited user preliminary received marriage _id and is added to a list of family Members of the contract.
     Only marriage partners can add a family member. 
     * @param _familyMember Address of a member being invited.    
     * @param _id ID of the marriage.
     */

    function addFamilyMember(address _familyMember, uint256 _id)
        external
        onlyContract
    {
        require(isMember(_familyMember) == 0);
        member[_familyMember][0] = _id;
        familyMembers[msg.sender].push(_familyMember);
    }

    /**
     * @notice A family member can be deleted through a proxy contract. A family member can be deleted at any stage.
     * @dev the list of a family members per a proxy contract is not updated to keep history of members. Deleted 
     members can be added back. 
     * @param _familyMember Address of a member being deleted.    
     */

    function deleteFamilyMember(address _familyMember) external onlyContract {
        if (member[_familyMember][1] > 0) {
            member[_familyMember][1] = 0;
        } else {
            require(member[_familyMember][0] > 0);
            member[_familyMember][0] = 0;
        }
    }

      /**
     * @notice A function to add string name for an Address 
     * @dev Names are used for better UI/UX. 
     * @param _name String name
     */

    function addName(string memory _name) external {
        require(isMember(msg.sender) > 0);
        nameAddress[msg.sender] = _name;
    }

     /**
     * @notice A function that resets indexes of users 
     * @dev A user will not be able to access proxy contracts if triggered from the CM FrontEnd
     */

    function forgetMe() external {
        require(isMember(msg.sender) > 0);
        proposers[msg.sender] = 0;
        proposedto[msg.sender] = 0;
        member[msg.sender][1] = 0;
    }

    /**
     * @notice A view function to get the list of family members per a Proxy Contract.
     * @dev the list is capped by a proxy contract to avoid unlimited lists.
     * @param _instance Address of a Proxy Contract.
     */

    function getFamilyMembers(address _instance)
        external
        view
        returns (address[] memory)
    {
        return familyMembers[_instance];
    }

    /**
     * @notice If a divorce is initiated and accepted, this method updates the status of the marriage as Divorced.
     It also updates the last NFT Certificates Status.  
     * @dev this method is triggered once settlement has happened within the proxy contract. 
     * @param _id ID of the marriage.   
     */

    function divorceUpdate(uint256 _id) external onlyContract {
        Wave storage waver = proposalAttributes[_id];
        require(waver.ProposalStatus == Status.Processed);
        waver.ProposalStatus = Status.Divorced;
        NFTContract NFTmint = NFTContract(addressNFT);

        if (NFTmint.nftHolder(waver.marriageContract)>0) {
            NFTmint.changeStatus(waver.marriageContract, false);
        }
    }

    /**
     * @notice Internal function to process payments.
     * @dev call method is used to keep process gas limit higher than 2300.
     * @param _to Address that will be reveiving payment
     * @param _amount the amount of payment
     */

    function processtxn(address payable _to, uint256 _amount) internal {
        (bool success, ) = _to.call{value: _amount}("");
        require(success);
    }

    /**
     * @notice internal view function to check whether msg.sender has marriage ID.
     * @dev for a family member that was invited, temporary id is given.
     */

    function isMember(address _partner) public view returns (uint256 _id) {
        if (proposers[_partner] > 0) {
            return proposers[_partner];
        } else if (proposedto[_partner] > 0) {
            return proposedto[_partner];
        } else if (member[_partner][1] > 0) {
            return member[_partner][1];
        } else if (member[_partner][0] > 0) {
            return 1e9;
        }
    }

    function checkAuth()
        internal
        view
        returns (address __msgSender, uint256 _id)
    {
        address msgSender_ = _msgSender();
        uint256 uid = isMember(msgSender_);
        return (msgSender_, uid);
    }

    /**
     * @notice  public view function to check whether msg.sender has marriage struct Wave with proxy contract..
     * @dev if msg.sender is a family member that was invited, temporary id is sent. If id>0 not found, empty struct is sent.
     */
  

    function checkMarriageStatus() external view returns (Wave memory) {
        // Get the tokenId of the user's character NFT
        (address msgSender_, uint256 _id) = checkAuth();
        // If the user has a tokenId in the map, return their character.
        if (_id > 0 && _id < 1e9) {
            return proposalAttributes[_id];
        }

        if (_id == 1e9) {
            return
                Wave({
                    id: _id,
                    stake: 0,
                    proposer: msgSender_,
                    proposed: msgSender_,
                    ProposalStatus: Status.WaitingConfirmation,
                    marriageContract: 0x0000000000000000000000000000000000000000
                });
        }

        Wave memory emptyStruct;
        return emptyStruct;
    }

    /**
     * @notice Proxy contract can burn LOVE tokens as they are being used.
     * @dev only Proxy contracts can call this method/
     * @param _to Address whose LOVE tokens are to be burned.
     * @param _amount the amount of LOVE tokens to be burned.
     */

    function burn(address _to, uint256 _amount) external onlyContract {
        _burn(_to, _amount);
    }

    /* Parameters that are adjusted by the contract owner*/

    /**
     * @notice Policy Days are set to regulate how often LOVE tokens are minted. 
     This policyDays is also used as a cooldown before a partner can propose a divorce.
     * @param _policyDays The number of days.   
     */

    function changePolicy(uint256 _policyDays,uint256 _claimPolicyDays) external onlyOwner {
        policyDays = _policyDays;
        claimPolicyDays = _claimPolicyDays;
    }

    /**
     * @notice minimum price for the NFT certificate.
     * @param _minPricePolicy uint is set in Wei.
     */

    function changePricePolicy(uint256 _minPricePolicy) external onlyOwner {
        minPricePolicy = _minPricePolicy;
    }

    /**
     * @notice A Sales Cap for the sale of LOVE tokens.
     * @param _saleCap uint is set in Wei.
     */

    function changeSaleCap(uint256 _saleCap) external onlyOwner {
        saleCap = _saleCap;
    }


    /**
     * @notice A fee that is paid by users for incoming and outgoing transactions.
     * @param _cmFee uint is set in Wei.
     */

    function changeFee(uint256 _cmFee) external onlyOwner {
        cmFee = _cmFee;
    }

    /**
     * @notice An exchange rate of LOVE tokens per 1 ETH
     * @param _exchangeRate uint, how many LOVE tokens per 1 ETH.
     */

    function changeExchangeRate(uint256 _exchangeRate) external onlyOwner {
        exchangeRate = _exchangeRate;
    }

    /**
     * @notice A reference contract address of NFT Certificates factory.
     * @param _addressNFT an Address.
     */

    //These functions to control reference contract addresses if they change
    function changeaddressNFT(address _addressNFT) external onlyOwner {
        addressNFT = _addressNFT;
    }

    /**
     * @notice A reference contract address of NFT Splitting factory.
     * @param _addressNFTSplit an Address.
     */

    function changeaddressNFTSplit(address _addressNFTSplit)
        external
        onlyOwner
    {
        addressNFTSplit = _addressNFTSplit;
    }

    /**
     * @notice A reference contract address of Proxy Contract factory.
     * @param _addressFactory an Address.
     */

    function changewaverFactoryAddress(address _addressFactory)
        external
        onlyOwner
    {
        waverFactoryAddress = _addressFactory;
    }

    /**
     * @notice A reference contract address of minimal forwarding address.
     * @param _forwarderAddress an Address.
     */

    function changeforwarderAddress(address _forwarderAddress)
        external
        onlyOwner
    {
        forwarderAddress = _forwarderAddress;
    }
  

    /**
     * @notice A reference address for withdrawing commissions.
     * @param _withdrawaddress an Address.
     */

    function changesWithdrawAddress(address _withdrawaddress)
        external
        onlyOwner
    {
        withdrawaddress = _withdrawaddress;
    }

    /**
     * @notice A method to withdraw comission that is accumulated within the main contract. 
     Withdraws the whole balance.
     */

    function withdrawcomission() external onlyOwner {
        processtxn(payable(withdrawaddress), address(this).balance);
    }

    /**
     * @notice A method to withdraw comission that is accumulated within ERC20 contracts.  
     Withdraws the whole balance.
     * @param _tokenID the address of the ERC20 contract.
     */
    function withdrawERC20(address _tokenID) external onlyOwner {
        uint256 amount;
        amount = IERC20(_tokenID).balanceOf(address(this));
        require(IERC20(_tokenID).transfer(withdrawaddress, amount));
    }

    receive() external payable {
        require(msg.value > 0);
    }
}
