/// SPDX-License-Identifier: BSL

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/metatx/MinimalForwarder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./WaverImplementationDiamond.sol";
import "hardhat/console.sol";

/**
[BSL License]
@title CryptoMarry contract
@notice This is the main contract that sets rules for proxy contract creation, minting ERC20 LOVE tokens,
minting NFT certificates, and other policies for the proxy contract. Description of the methods are provided 
below. 
@author Ismailov Altynbek <altyni@gmail.com>
 */


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
    function _addFamilyMember(address _member, uint _threshold) external;

    function agreed() external;

    function declined() external;

    function getFamilyMembersNumber() external view returns (uint);
}


contract WavePortal7 is ERC20, ERC2771Context, Ownable {
   
    address public addressNFT; // Address of NFT certificate factory
    address public addressNFTSplit; // Address of NFT splitting contract
    address public withdrawaddress; //Address to where comissions are withdrawed/
    address public waverImplementationAddress;// Address of Implementation contract

    uint256 public id; //IDs of a marriage
    
    uint256 public claimPolicyDays; //Cooldown for claiming LOVE tokens;
    uint256 public promoAmount; //Amount of token to be disposed in promo period
    uint256 public saleCap; //Maximum cap of a LOVE token Sale
    uint256 public minPricePolicy; //Minimum price for NFTs
    uint256 public exchangeRate; // Exchange rate for LOVE tokens for 1 ETH
    string public constant VERSION = "VER-1.0.3";// Updates: 06.02.2023

    /**
    1. Changed monetization scheme from 1% of transaction amount to 12% of gas fee
    2. Default method of reaching consensus is MultiSig with Threshold 
    3. Family DAO can be connected separately 
    4. Added multiple participation in contracts 
    5.  */

    //Structs

    enum Status {
        Declined,
        Proposed,
        Cancelled,
        Accepted,
        Processed,
        Divorced,
        WaitingConfirmation,
        MemberInvited,
        InvitationAccepted,
        InvitationDeclined,
        MemberDeleted,
        PartnerAddressChanged
    }

    struct Wave {
        uint256 id;
        Status ProposalStatus;
        address marriageContract;
        mapping (address => uint8) hasRole;
        bytes32 name;
    }

    struct ReturnAccounts {
        uint256 id;
        Status ProposalStatus;
        address marriageContract;
        uint8 hasRole;
        bytes32 name;
    }


    struct AddressList {
        address ContractAddress;
        uint Status;
    }

    mapping(address => uint256[]) public accountIDJournal; //All accounts IDs of an account 
    mapping(uint256 => Wave) public proposalAttributes; //Attributes of the Proposal of each marriage
    mapping(address => mapping(uint256 => uint256)) public idPosition; //Position to pop if needed; 
    mapping(address => mapping(uint256 => uint256)) public proposedThreshold; //Proposed threshold
    mapping(uint256 => address) public MarriageID; //Mapping of the proxy contract addresses by ID.
    mapping(address => address[]) internal familyMembers; // List of family members addresses
    mapping(bytes32 => mapping (address=> address)) public names; //stores names of CM accounts

    mapping(address => uint8) internal hasensName; //Whether a partner wants to display ENS address within the NFT
    mapping(address => uint8) internal authrizedAddresses; //Tracks whether a proxy contract addresses is authorized to interact with this contract.
    mapping(address => mapping (uint256 => uint256)) public claimtimer; //maps addresses to when the last time LOVE tokens were claimed.
    
    mapping(address => uint) public pauseAddresses; //Addresses that can be paused.
    mapping(address => uint) public rewardAddresses; //Addresses that may claim reward. 
    mapping(address => uint) public whiteListedAddresses; // Facet addresses to be whitelisted. 

    /* An event to track status changes of the contract*/
    event NewWave(
        uint256 id,
        address sender,
        address indexed marriageContract,
        Status vid
    );


    /* A contructor that sets initial conditions of the Contract*/
    constructor(
        MinimalForwarder forwarder,
        address _nftaddress,
        address _waverImplementationAddress,
        address _withdrawaddress,
        address _diamonCut
    ) payable ERC20("CryptoMarry", "LOVE") ERC2771Context(address(forwarder)) {
        claimPolicyDays = 1 hours;
        addressNFT = _nftaddress;
        saleCap = 1e24;
        minPricePolicy = 50 * 1e18 ;
        waverImplementationAddress = _waverImplementationAddress;
        exchangeRate = 2000;
        withdrawaddress = _withdrawaddress;
        promoAmount = 50 * 1e18;
        whiteListedAddresses[_diamonCut] = 1; 
    }

    error CONTRACT_NOT_AUTHORIZED(address contractAddress);

    /*This modifier check whether an address is authorised proxy contract*/
    modifier onlyContract() {
        if (authrizedAddresses[msg.sender] != 1) {revert CONTRACT_NOT_AUTHORIZED(msg.sender);}
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

    /** Errors replated to propose function */
     error YOU_CANNOT_PROPOSE_YOURSELF(address proposed);
     error USER_ALREADY_EXISTS_IN_CM(address user);
     error INALID_SHARE_PROPORTION(uint share);
     error PLATFORM_TEMPORARILY_PAUSED();
     error NAME_TAKEN();
    /**
     * @notice Proposal and separate contract is created with given params.
     * @dev Proxy contract is created for each proposal. Most functions of the proxy contract will be available if proposal is accepted.
     * @param _proposed Address of the one whom proposal is send.
     * @param _name String that will be used to name the contract
     * @param _hasensWaver preference whether Proposer wants to display ENS on the NFT certificate
     */

    function propose(
        address _proposed,
        bytes32 _name,
        uint8 _hasensWaver,
        uint _policyDays,
        uint _divideShare,
        uint _threshold
    ) public payable {
        address msgSender = _msgSender();
        id += 1;
        if (pauseAddresses[address(this)]==1) {revert PLATFORM_TEMPORARILY_PAUSED();}
        if (msgSender == _proposed) {revert YOU_CANNOT_PROPOSE_YOURSELF(msgSender);}
        if (_divideShare > 10) {revert INALID_SHARE_PROPORTION (_divideShare);}
        if (names[_name][msgSender] != address(0)) {revert NAME_TAKEN();}
        require(_threshold == 1 || _threshold == 2);

        accountIDJournal[msgSender].push(id);
        accountIDJournal[_proposed].push(id);
       
        idPosition[msgSender][id] = accountIDJournal[msgSender].length-1;
        idPosition[_proposed][id] = accountIDJournal[_proposed].length-1;

        hasensName[msgSender] = _hasensWaver;
        
        bytes32 newsalt = newSalt(_name, msgSender, _proposed);
        address payable _newMarriageAddress = payable(Clones.cloneDeterministic(waverImplementationAddress, newsalt));
        WaverIDiamond(_newMarriageAddress).initialize(
            payable(address(this)),
            id,
            msgSender,
            _proposed,
            _policyDays,
            _divideShare,
            _threshold);
        
        names[_name][msgSender] = _newMarriageAddress;
        nftSplitC nftsplit = nftSplitC(addressNFTSplit);
        nftsplit.addAddresses(_newMarriageAddress);
       
        authrizedAddresses[_newMarriageAddress] = 1;
        MarriageID[id] = _newMarriageAddress;
        Wave storage proposal = proposalAttributes[id];

        proposal.id = id;
        proposal.ProposalStatus= Status.Proposed;
        proposal.marriageContract=_newMarriageAddress;
        proposal.hasRole[msgSender]=1;
        proposal.hasRole[_proposed]=11;
        proposal.name = _name;
   
        if (msg.value>0) {processtxn(payable(_newMarriageAddress), msg.value);}

        emit NewWave(id, msgSender,_newMarriageAddress, Status.Proposed);
    }

    function newSalt(bytes32 _name, address msgSender, address _proposed) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(keccak256(abi.encodePacked(msgSender,_proposed, VERSION)), _name));
    }

    function getAddressForCounterfactualWallet(
            bytes32 _name, address msgSender, address _proposed
    )
        external
        view
        returns (address _wallet)
    {
        bytes32 newsalt = newSalt(_name, msgSender, _proposed);
        _wallet = Clones.predictDeterministicAddress(waverImplementationAddress, newsalt);
    }


    error PROPOSAL_STATUS_CHANGED();
    error HAS_NO_ACCESS(address msgSender);
    /**
     * @notice Response is given from the proposed Address.
     * @dev Updates are made to the proxy contract with respective response. ENS preferences will be checked onchain.
     * @param _agreed Response sent as uint. 1 - Agreed, anything else will trigger Declined status.
     * @param _hasensProposed preference whether Proposed wants to display ENS on the NFT certificate
     */

    function response(
        uint8 _agreed,
        uint8 _hasensProposed,
        uint256 _id
    ) public {
        address msgSender_ = _msgSender();

        Wave storage waver = proposalAttributes[_id];

        if (waver.hasRole[msgSender_] != 11) {revert HAS_NO_ACCESS(msgSender_);}
        if (waver.ProposalStatus != Status.Proposed) {revert PROPOSAL_STATUS_CHANGED();}
      
        waverImplementation1 waverImplementation = waverImplementation1(
            waver.marriageContract
        );

        if (_agreed == 1) {
            waver.ProposalStatus = Status.Processed;
            hasensName[msgSender_] = _hasensProposed;
            waverImplementation.agreed();
            waver.hasRole[msgSender_] = 2;
        } else {
            waver.ProposalStatus = Status.Declined;
            waverImplementation.declined();
            //removing from the list of Contracts 
            removeUser(msgSender_, _id, waver);
            
        }
        emit NewWave(_id, msgSender_, waver.marriageContract, waver.ProposalStatus);
    }

    function removeUser (address msgSender_, uint _id, Wave storage waver) internal{
        uint lastID = accountIDJournal[msgSender_][accountIDJournal[msgSender_].length-1]; 
        uint toBeRemoved = idPosition[msgSender_][_id]; 
            accountIDJournal[msgSender_][toBeRemoved]=lastID;              
            accountIDJournal[msgSender_].pop();
            idPosition[msgSender_][lastID] = toBeRemoved;
            waver.hasRole[msgSender_]=0;
    }

    /**
     * @notice Updates statuses from the main contract on the marriage status
     * @dev Helper function that is triggered from the proxy contract. Requirements are checked within the proxy.
     * @param _id The id of the partnership recorded within the main contract.
     */

    function cancel(uint256 _id, address _proposed, address _proposer  ) external onlyContract {
        Wave storage waver = proposalAttributes[_id];
        require(waver.ProposalStatus != Status.Cancelled);
        if (waver.ProposalStatus != Status.Declined) {removeUser(_proposed, _id, waver);}
        waver.ProposalStatus = Status.Cancelled;

        removeUser(_proposer, _id, waver);
           
    emit NewWave(_id, tx.origin, msg.sender, Status.Cancelled);
    }

    error FAMILY_ACCOUNT_NOT_ESTABLISHED();
    error CLAIM_TIMOUT_NOT_PASSED();
    /**
     * @notice Users claim LOVE tokens depending on the proxy contract's balance and the number of family members.
     * @dev LOVE tokens are distributed once within policyDays defined by the owner.
     */

     /// # of users # balance #claim amount 

    function claimToken(address msgSender_, uint _id, uint _familyMembers) external onlyContract{
        if (claimtimer[msgSender_][_id] + claimPolicyDays > block.timestamp) {revert CLAIM_TIMOUT_NOT_PASSED();}
        claimtimer[msgSender_][_id] = block.timestamp;
        uint amount  = promoAmount;
        if ( msg.sender.balance > 1e20) {
            amount = promoAmount * 100/_familyMembers;}
        else if (msg.sender.balance > 1e19) {
            amount = promoAmount * 50/_familyMembers;
        }  else if ( msg.sender.balance > 1e18) {
            amount = promoAmount * 10/_familyMembers;
        }
        _mint(msgSender_, amount);
    }


    /**
     * @notice Users can buy LOVE tokens depending on the exchange rate. There is a cap for the Sales of the tokens.
     * @dev Only registered users within the proxy contracts can buy LOVE tokens. Sales Cap is universal for all users.
     */

    function buyLovToken() external payable {        
        uint256 issued = msg.value * exchangeRate;
        saleCap -= issued;
        _mint(msg.sender, issued);
    }

    error PAYMENT_NOT_SUFFICIENT(uint requiredPayment);
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
        uint256 MainID,
        uint256 _id,
        uint256 value,
        address proposer,
        address proposed
    ) external onlyContract{
        //getting price and NFT address
        if (value < minPricePolicy) {revert PAYMENT_NOT_SUFFICIENT(minPricePolicy);}
        if (BackgroundID >= 1000) {
            if (value < minPricePolicy * 100) {revert PAYMENT_NOT_SUFFICIENT(minPricePolicy * 100);}
        } else if (logoID >= 100) {
            if (value < minPricePolicy * 10) {revert PAYMENT_NOT_SUFFICIENT(minPricePolicy * 10);}
        }
        
         NFTContract NFTmint = NFTContract(addressNFT);

        NFTmint.mintCertificate(
            proposer,
            hasensName[proposer],
            proposed,
            hasensName[proposed],
            msg.sender,
            _id,
            logoID,
            BackgroundID,
            MainID
        );
    }

    /* Adding Family Members*/

    error MEMBER_NOT_INVITED(address member);
    /**
     * @notice When an Address has been added to a Proxy contract as a family member, 
     the owner of the Address have to accept the invitation.  
     * @dev The system checks whether the msg.sender has an invitation, if it is i.e. id>0, it adds the member to 
     corresponding marriage id. It also makes pertinent adjustments to the proxy contract. 
     * @param _response Bool response of the owner of Address.    
     */

    function joinFamily(uint8 _response, uint _id) external {
        address msgSender_ = _msgSender();
        Wave storage waver = proposalAttributes[_id];
        if (waver.hasRole[msgSender_] != 10) {revert MEMBER_NOT_INVITED(msgSender_);}
        Status status;
        if (_response == 2) {
            waver.hasRole[msgSender_] = 3;
    
            waverImplementation1 waverImplementation = waverImplementation1(
                waver.marriageContract
            );
            uint _threshold= proposedThreshold[msgSender_][_id];
            waverImplementation._addFamilyMember(msgSender_,_threshold);
            status = Status.InvitationAccepted;
        } else {
            removeUser(msgSender_, _id, waver);
            status = Status.InvitationDeclined;
        }

      emit NewWave(_id, msgSender_, waver.marriageContract, status);
    }

    
    /**
     * @notice A proxy contract adds a family member through this method. A family member is first invited,
     and added only if the indicated Address accepts the invitation.   
     * @dev invited user preliminary received marriage _id and is added to a list of family Members of the contract.
     Only marriage partners can add a family member. 
     * @param _familyMember Address of a member being invited.    
     * @param _id ID of the marriage.
     */

    function addFamilyMember(address _familyMember, uint256 _id, uint256 _threshold)
        external
        onlyContract
    {
        accountIDJournal[_familyMember].push(_id);
        idPosition[_familyMember][_id] = accountIDJournal[_familyMember].length-1;
        proposedThreshold[_familyMember][_id] = _threshold;
        Wave storage waver = proposalAttributes[_id];
        waver.hasRole[_familyMember] = 10;     
        familyMembers[msg.sender].push(_familyMember);

        emit NewWave(_id, _familyMember,msg.sender,Status.MemberInvited);
    }
  
    /**
     * @notice A family member can be deleted through a proxy contract. A family member can be deleted at any stage.
     * @dev the list of a family members per a proxy contract is not updated to keep history of members. Deleted 
     members can be added back. 
     * @param _familyMember Address of a member being deleted.    
     */

    function deleteFamilyMember(address _familyMember, uint _id) external onlyContract {
        Wave storage waver = proposalAttributes[_id];
        removeUser(_familyMember, _id, waver);
        
    emit NewWave(_id, _familyMember, msg.sender, Status.MemberDeleted);
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
     * @notice If a Dissalution is initiated and accepted, this method updates the status of the partnership as Divorced.
     It also updates the last NFT Certificates Status.  
     * @dev this method is triggered once settlement has happened within the proxy contract. 
     * @param _id ID of the marriage.   
     */

    function divorceUpdate(uint256 _id) external onlyContract {
        Wave storage waver = proposalAttributes[_id];
      if (waver.ProposalStatus != Status.Processed) {revert FAMILY_ACCOUNT_NOT_ESTABLISHED();}
        waver.ProposalStatus = Status.Divorced;
        NFTContract NFTmint = NFTContract(addressNFT);

        if (NFTmint.nftHolder(waver.marriageContract)>0) {
            NFTmint.changeStatus(waver.marriageContract, false);
        }
    emit NewWave(_id, msg.sender, msg.sender, Status.Divorced);
    }

    error COULD_NOT_PROCESS(address _to, uint amount);

    /**
     * @notice Internal function to process payments.
     * @dev call method is used to keep process gas limit higher than 2300.
     * @param _to Address that will be reveiving payment
     * @param _amount the amount of payment
     */

    function processtxn(address payable _to, uint256 _amount) internal {
        (bool success, ) = _to.call{value: _amount}("");
        if (!success) {revert COULD_NOT_PROCESS(_to,_amount);}
    }


    /**
     * @notice  public view function to check whether msg.sender has marriage struct Wave with proxy contract..
     * @dev if msg.sender is a family member that was invited, temporary id is sent. If id>0 not found, empty struct is sent.
     */
  

    function checkMarriageStatus(uint _pagenumber) external view returns (ReturnAccounts [] memory) {

        uint length = accountIDJournal[msg.sender].length;
        uint page = length / 30;
        uint size = 0;
        uint start = 0;
        if (_pagenumber * 30 > length) {
            size = length % 30;
            if (size == 0 && page != 0) {
                size = 30;
                page -= 1;
            }
            start = page * 30;
        } else if (_pagenumber * 30 <= length) {
            size = 30;
            start = (_pagenumber - 1) * 30;
        }

       ReturnAccounts[]
            memory returnAccounts = new ReturnAccounts[](size);

        for (uint24 i = 0; i < size; i++) {
            uint IDs = accountIDJournal[msg.sender][start + i];
            Wave storage waver =  proposalAttributes[IDs];
            returnAccounts[i] = ReturnAccounts({
             id: waver.id,
             ProposalStatus: waver.ProposalStatus,
             marriageContract: waver.marriageContract,
             hasRole: waver.hasRole[msg.sender],
             name: waver.name
            });
        }
        return returnAccounts;

    }

     function isMember(address _member, uint _contractID ) external view returns (uint8 status) {
        Wave storage waver =  proposalAttributes[_contractID];
        return waver.hasRole[_member];
    }

     function getName(uint _contractID ) external view returns (bytes32 name) {
        Wave storage waver =  proposalAttributes[_contractID];
        return waver.name;
    }

    /**
     * @notice Proxy contract can burn LOVE tokens as they are being used.
     * @dev only Proxy contracts can call this method/
     * @param _from Address whose LOVE tokens are to be burned.
     * @param _amount the amount of LOVE tokens to be burned.
     */

    function burn(address _from, uint256 _amount) external onlyContract {
        _burn(_from, _amount);
    }

        /**
     * @notice Proxy contract can mint LOVE tokens as they are being used.
     * @dev only Proxy contracts can call this method/
     * @param _to Address whom LOVE tokens are minted
     * @param _amount the amount of LOVE tokens to be minted.
     */

    function mint(address _to, uint256 _amount) external onlyContract {
        _mint(_to, _amount);
    }

    /* Parameters that are adjusted by the contract owner*/

    /**
     * @notice Tuning policies related to CM functioning
     * @param _claimPolicyDays The number of days required before claiming next LOVE tokens
     * @param _minPricePolicy Minimum price of minting NFT certificate of family account
     */

    function changePolicy(uint256 _claimPolicyDays, uint256 _minPricePolicy) external onlyOwner {
        claimPolicyDays = _claimPolicyDays;
        minPricePolicy = _minPricePolicy;
    }


    /**
     * @notice Changing Policies in terms of Sale Cap, Fees and the Exchange Rate
     * @param _saleCap uint is set in Wei.
     * @param _exchangeRate uint is set how much Love Tokens can be bought for 1 Ether.
     */

    function changeTokenPolicy(uint256 _saleCap, uint256 _exchangeRate, uint256 _promoAmount) external onlyOwner {
        saleCap = _saleCap;
        exchangeRate = _exchangeRate;
        promoAmount = _promoAmount;
    }

    /**
     * @notice A reference contract address of NFT Certificates factory and NFT split.
     * @param _addressNFT an Address of the NFT Factort.
     * @param _addressNFTSplit an Address of the NFT Split. 
     */

    function changeaddressNFT(address _addressNFT, address _addressNFTSplit ) external onlyOwner {
        addressNFT = _addressNFT;
        addressNFTSplit = _addressNFTSplit;
    }

    /**
     * @notice Changing contract addresses of Factory and Forwarder
     * @param _waverImplementationAddress an Address of the Implementation.
     */

    function changeSystemAddresses(address _waverImplementationAddress, address _withdrawaddress)
        external
        onlyOwner
    {
        waverImplementationAddress = _waverImplementationAddress;
        withdrawaddress = _withdrawaddress;
    }

 
   /**
     * @notice A functionality for "Social Changing" of a partner address. 
     * @dev can be called only by the Partnership contract 
     * @param _partner an Address to be changed.
     * @param _newAddress an address to be changed to.
     * @param _id Address of the partnership.
     */

    function changePartnerAddress(address _partner, address _newAddress, uint _id) 
        external
    {
         Wave storage waver = proposalAttributes[_id];
         if (msg.sender != waver.marriageContract) {revert CONTRACT_NOT_AUTHORIZED(msg.sender);}

         removeUser(_partner, _id, waver);

        accountIDJournal[_partner].push(_id);
        idPosition[_partner][_id] = accountIDJournal[_partner].length-1;
        waver.hasRole[_partner] = 4;     

    emit NewWave(_id, _newAddress, msg.sender, Status.PartnerAddressChanged);
    }

    /**
     * @notice A function that resets indexes of users 
     * @dev A user will not be able to access proxy contracts if triggered from the CM FrontEnd
     */

    function forgetMe(uint _id) external {
        address msgSender_ = _msgSender();
        Wave storage waver = proposalAttributes[_id];
        if (waver.hasRole[msgSender_] == 0) {revert HAS_NO_ACCESS(msgSender_);}
        removeUser(msgSender_, _id, waver);

    }
    error ACCOUNT_PAUSED(address sender);
    /**
     * @notice A method to withdraw comission that is accumulated within the main contract. 
     Withdraws the whole balance.
     */

    function withdrawcomission() external {
        if (msg.sender != withdrawaddress) {revert CONTRACT_NOT_AUTHORIZED(msg.sender);}
        if (pauseAddresses[msg.sender] == 1){revert ACCOUNT_PAUSED(msg.sender);}
        processtxn(payable(withdrawaddress), address(this).balance);
    }

    /**
     * @notice A method to withdraw comission that is accumulated within ERC20 contracts.  
     Withdraws the whole balance.
     * @param _tokenID the address of the ERC20 contract.
     */
    function withdrawERC20(address _tokenID) external {
        if (msg.sender != withdrawaddress) {revert CONTRACT_NOT_AUTHORIZED(msg.sender);}
        if (pauseAddresses[msg.sender] == 1){revert ACCOUNT_PAUSED(msg.sender);}
        uint256 amount;
        amount = IERC20(_tokenID).balanceOf(address(this));
        bool success =  IERC20(_tokenID).transfer(withdrawaddress, amount);
        if (!success) {revert COULD_NOT_PROCESS(withdrawaddress,amount);}
    }

    /**
     * @notice A method to pause withdrawals from the this and proxy contracts if threat is detected.
     * @param pauseData an List of addresses to be paused/unpaused
     */
    function pause(AddressList[] calldata pauseData) external {
        if (msg.sender != withdrawaddress) {revert CONTRACT_NOT_AUTHORIZED(msg.sender);}
        for (uint i; i<pauseData.length; i++) {
            pauseAddresses[pauseData[i].ContractAddress] = pauseData[i].Status;
        }   
    }

     /**
     * @notice A method to enter LOVE tokens who participated in Reward Program
     * @param mintData an List of addresses to be rewarded
     */
    function reward(AddressList[] calldata mintData) external onlyOwner{
        for (uint i; i<mintData.length; i++) {
            rewardAddresses[mintData[i].ContractAddress] = mintData[i].Status;
        }   
    }
      /**
     * @notice A method to add whitelisted addresses for facets
     * @param addressData an List of addresses to be rewarded
     */
    function whiteListAddr(AddressList[] calldata addressData) external onlyOwner{
        for (uint i; i<addressData.length; i++) {
            whiteListedAddresses[addressData[i].ContractAddress] = addressData[i].Status;
        }   
    }

    /**
     * @notice A method to claim LOVE tokens who participated in the Reward program.
     */
    error REWARD_NOT_FOUND(address claimer);
    function claimReward() external {
        if (rewardAddresses[msg.sender] == 0) {revert REWARD_NOT_FOUND(msg.sender);}
        uint amount = rewardAddresses[msg.sender];
        rewardAddresses[msg.sender] = 0;
        _mint(msg.sender, amount);
        saleCap-= amount;
    }

  /**
     * @notice A view function to monitor balance
     */

    function balance() external view returns (uint ETHBalance) {
       return address(this).balance;
    }


    receive() external payable {
        if (pauseAddresses[msg.sender] == 1){revert ACCOUNT_PAUSED(msg.sender);}
        require(msg.value > 0);
    }
}
