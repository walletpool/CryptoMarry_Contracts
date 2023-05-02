// SPDX-License-Identifier: BSL
pragma solidity ^0.8.17;

/**
*   [BSL License]
*   @title CM Proxy contract implementation.
*   @notice Individual contract is created after proposal has been sent to the partner. 
    ETH stake will be deposited to this newly created contract.
*   @dev The proxy uses Diamond Pattern for modularity. Relevant code was borrowed from  
    Nick Mudge <nick@perfectabstractions.com>. 
*   Reimbursement of sponsored TXFee through 
    MinimalForwarder, amounts to full estimated TX Costs of relevant 
    functions.   
*   @author Ismailov Altynbek <altyni@gmail.com>
*/

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/security/ReentrancyGuardUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./handlers/SecuredTokenTransfer.sol";
import "./handlers/DefaultCallbackHandler.sol";
import {LibDiamond} from "./libraries/LibDiamond.sol";
import {IDiamondCut} from "./interfaces/IDiamondCut.sol";
import {VoteProposalLib} from "./libraries/VotingStatusLib.sol";

/*Interface for the Main Contract*/
interface WaverContract {
    function addFamilyMember(address, uint256, uint256) external;

    function cancel(uint256 , address _proposed, address _proposer ) external;

    function deleteFamilyMember(address, uint) external;

    function divorceUpdate(uint256 _id) external;

    function isMember(address _member, uint _contractID ) external view returns (uint8 status);

    function addressNFTSplit() external returns (address);

    function claimToken(address msgSender_, uint _id, uint _familyMembers) external; 
    
    function MintCertificate(
        uint256 logoID,
        uint256 BackgroundID,
        uint256 MainID,
        uint256 _id,
        uint256 value,
        address proposer,
        address proposed
    ) external;
}
interface IWrappedNativeTokenInstance {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}


/*Interface for the NFT Split Contract*/

interface nftSplitInstance {
    function splitNFT(
        address _nft_Address,
        uint256 _tokenID,
        string memory image,
        address waver,
        address proposed,
        address _implementationAddr,
        uint shareDivide
    ) external;
}

contract WaverIDiamond is
    Initializable,
    SecuredTokenTransfer,
    DefaultCallbackHandler,
    ERC2771ContextUpgradeable,
    ReentrancyGuardUpgradeable
{
    string public constant VERSION = "1.0.2"; //Removed CM fees 
    address immutable diamondcut;
    address private immutable _diamondForwarder;
    /*Constructor to connect Forwarder Address*/
    IWrappedNativeTokenInstance public immutable wrappedNativeToken;
    constructor(MinimalForwarderUpgradeable forwarder, address _diamondcut, IWrappedNativeTokenInstance _wrappedNativeToken )
        initializer
        ERC2771ContextUpgradeable(address(forwarder))
    {diamondcut = _diamondcut;
    _diamondForwarder= address(forwarder);
    wrappedNativeToken = _wrappedNativeToken;}

    /**
     * @notice Initialization function of the proxy contract
     * @dev Initialization params are passed from the main contract.
     * @param _addressWaveContract Address of the main contract.
     * @param _id Marriage ID assigned by the main contract.
     * @param _proposer Address of the prpoposer.
     * @param _proposer Address of the proposed.
     * @param _policyDays Cooldown before dissolution
     * @param _divideShare the share that will be divided among partners upon dissolution.
     */

    function initialize(
        address payable _addressWaveContract,
        uint256 _id,
        address _proposer,
        address _proposed,
        uint256 _policyDays,
        uint256 _divideShare,
        uint256 _threshold
    ) public initializer {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        unchecked {
            vt.voteid++;
        }
        vt.addressWaveContract = _addressWaveContract;
        vt.marriageStatus = VoteProposalLib.MarriageStatus.Proposed;
        vt.hasAccess[_proposer] = true;
        vt.id = _id;
        vt.proposer = _proposer;
        vt.proposed = _proposed;
        vt.policyDays = _policyDays;
        vt.setDeadline = 1 days;
        vt.divideShare = _divideShare;
        vt.trustedForwarder = _diamondForwarder;
        vt.threshold = _threshold;

         LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
         ds.waveAddress=_addressWaveContract;

        // Add the diamondCut external function from the diamondCutFacet
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);

        bytes4[] memory functionSelectors = new bytes4[](1);

        functionSelectors[0] = IDiamondCut.diamondCut.selector;

        cut[0] = IDiamondCut.FacetCut({
            facetAddress: diamondcut,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: functionSelectors
        });

        LibDiamond.diamondCut(cut, address(0), "");
    }

    /**
     *@notice Proposer can cancel access to the contract if response has not been reveived or accepted. 
      The ETH balance of the contract will be sent to the proposer.   
     *@dev Once trigerred the access to the proxy contract will not be possible from the CM Frontend. Access is preserved 
     from the custom fronted such as Remix.   
     *@dev mobile
     */

    function cancel() external {
        VoteProposalLib.enforceNotYetMarried();
        VoteProposalLib.enforceUserHasAccess(_msgSender());

        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        vt.marriageStatus = VoteProposalLib.MarriageStatus.Cancelled;
        WaverContract _wavercContract = WaverContract(vt.addressWaveContract);
        _wavercContract.cancel(vt.id,vt.proposed, vt.proposer);

        VoteProposalLib.processtxn(payable(vt.proposer), address(this).balance);
    }

    /**
     *@notice If the proposal is accepted, triggers this function to be added to the proxy contract.
     *@dev this function is called from the Main Contract.
     */

    function agreed() external {
        VoteProposalLib.enforceContractHasAccess();
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        vt.marriageStatus = VoteProposalLib.MarriageStatus.Married;
        vt.marryDate = block.timestamp;
        vt.hasAccess[vt.proposed] = true;
        vt.familyMembers = 2;
    }

    /**
     *@notice If the proposal is declined, the status is changed accordingly.
     *@dev this function is called from the Main Contract.
     */

    function declined() external {
        VoteProposalLib.enforceContractHasAccess();
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        vt.marriageStatus = VoteProposalLib.MarriageStatus.Declined;
    }

    error DISSOLUTION_COOLDOWN_NOT_PASSED(uint cooldown);
   
    /**
     * @notice Through this method proposals for voting is created. 
     * @dev All params are required. tokenID for the native currency is 0x0 address. To create proposals it is necessary to 
     have LOVE tokens as it will be used as backing of the proposal. 
     * @param _votetype Type of the proposal as it was listed in enum above. 
     * @param _receiver Address of the receiver who will be receiving indicated amounts. 
     * @param _tokenID Address of the ERC20, ERC721 or other tokens. 
     * @param _amount The amount of token that is being sent. Alternatively can be used as NFT ID. 
     *@dev mobile
     */

    function createProposal(
        uint16 _votetype,
        address payable _receiver,
        address _tokenID,
        uint256 _amount,
        uint256 _voteends,
        bool execute
    ) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceMarried();
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        
        if (_votetype == 4) {
             //Cooldown has to pass before divorce is proposed.
            if (vt.marryDate + vt.policyDays > block.timestamp) { revert DISSOLUTION_COOLDOWN_NOT_PASSED(vt.marryDate + vt.policyDays );}
           
            //Only partners can propose divorce
            VoteProposalLib.enforceOnlyPartners(msgSender_);
       
            _voteends = block.timestamp + 10 days;
        } else if (_votetype == 7){
            require(vt.hasAccess[_receiver] == false);}

          else if (_votetype == 8){
            WaverContract _wavercContract = WaverContract(vt.addressWaveContract);
            require (_wavercContract.isMember(_receiver,vt.id)>0);
            VoteProposalLib.enforceNotPartnerAddr(_receiver);
            }
        
        vt.voteProposalAttributes[vt.voteid] = VoteProposalLib.VoteProposal({
            id: vt.voteid,
            proposer: msgSender_,
            voteType: _votetype,
            voteStatus: 1,
            voteends: _voteends,
            receiver: _receiver,
            tokenID: _tokenID,
            amount: _amount,
            votersLeft: vt.familyMembers - 1,
            familyDao: 0,
            numTokenFor: 1,
            numTokenAgainst: 0
        });

        vt.votingStatus[vt.voteid][msgSender_] = true;

        if (execute && vt.threshold == 1 && _votetype != 4 && _votetype != 1 ) {
            vt.voteProposalAttributes[vt.voteid].voteStatus = 2;
            executeVoting(vt.voteid);
        }
      
       emit VoteProposalLib.VoteStatus(
            vt.voteid,
            msgSender_,
            1,
            block.timestamp
        ); 

        unchecked {
            vt.voteid++;
        }
        VoteProposalLib.checkForwarder();
    }

    /**
     * @notice Through this method, proposals are voted for/against.  
     * @dev A user cannot vote twice. User cannot vote on voting which has been already passed/declined. Token staked is burnt.
     There is no explicit ways of identifying votes for or against the vote. 
     * @param _id Vote ID, that is being voted for/against. 
     * @param responsetype Voting response for/against
     *@dev mobile
     */

    function voteResponse(
        uint256 _id,
        uint8 responsetype,
        bool execute
    ) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceNotVoted(_id,msgSender_);
        VoteProposalLib.enforceProposedStatus(_id);
        VoteProposalLib.enforceFamilyDAO(0,_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        vt.votingStatus[_id][msgSender_] = true;
        vt.voteProposalAttributes[_id].votersLeft -= 1;

        if (responsetype == 2) {
            vt.voteProposalAttributes[_id].numTokenFor += 1;
        } else {
            vt.voteProposalAttributes[_id].numTokenAgainst += 1;
        }
          if (vt.voteProposalAttributes[_id].numTokenFor >= vt.threshold) {
                vt.voteProposalAttributes[_id].voteStatus = 2;
            
            if(execute && vt.voteProposalAttributes[_id].voteType != 4 && vt.voteProposalAttributes[_id].voteType != 1) 
               executeVoting(_id);
            }
          
        if (vt.voteProposalAttributes[_id].votersLeft == 0 && vt.voteProposalAttributes[_id].voteStatus == 1) {
                vt.voteProposalAttributes[_id].voteStatus = 3;  
        }

         emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );  
        if (!execute) VoteProposalLib.checkForwarder();
    }

    /**
     * @notice The vote can be cancelled by the proposer if it has not been passed.
     * @dev once cancelled the proposal cannot be voted or executed.
     * @param _id Vote ID, that is being voted for/against.
     *@dev mobile
     */

    function cancelVoting(uint256 _id) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceProposedStatus(_id);
        VoteProposalLib.enforceOnlyProposer(_id, msgSender_);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        vt.voteProposalAttributes[_id].voteStatus = 4;

       emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder();
    }

    
error VOTE_ID_NOT_FOUND();
    /**
     * @notice If the proposal has been passed, depending on vote type, the proposal is executed.
     * @dev  Two external protocols are used Uniswap and Compound.
     * @param _id Vote ID, that is being voted for/against.
     *@dev mobile
     */

    function executeVoting(uint256 _id) public nonReentrant {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        WaverContract _wavercContract = WaverContract(vt.addressWaveContract);
        //A small fee for the protocol is deducted here
        uint256 _amount = vt.voteProposalAttributes[_id].amount;

        // Sending ETH from the contract
        if (vt.voteProposalAttributes[_id].voteType == 3) {
            vt.voteProposalAttributes[_id].voteStatus = 5;
            VoteProposalLib.processtxn(
                payable(vt.voteProposalAttributes[_id].receiver),
                _amount
            );
            
        }
        //Sending ERC20 tokens owned by the contract
        else if (vt.voteProposalAttributes[_id].voteType == 2) {
            vt.voteProposalAttributes[_id].voteStatus = 5;
            require(
                transferToken(
                    vt.voteProposalAttributes[_id].tokenID,
                    payable(vt.voteProposalAttributes[_id].receiver),
                    _amount
                ),"I101"
            );
        }
         //Sending ERC721 tokens owned by the contract
         else if (vt.voteProposalAttributes[_id].voteType == 5) {
            vt.voteProposalAttributes[_id].voteStatus = 10;
            IERC721(vt.voteProposalAttributes[_id].tokenID).safeTransferFrom(
                address(this),
                vt.voteProposalAttributes[_id].receiver,
                vt.voteProposalAttributes[_id].amount
            );
            //Extending minimum deadline for family DAO votes
        } else if (vt.voteProposalAttributes[_id].voteType == 6) {
            vt.voteProposalAttributes[_id].voteStatus = 11;
            vt.setDeadline = vt.voteProposalAttributes[_id].amount;

           //Inviting family members 
        } else if (vt.voteProposalAttributes[_id].voteType == 7){
             vt.voteProposalAttributes[_id].voteStatus = 12;
            address _member = vt.voteProposalAttributes[_id].receiver;
            _wavercContract.addFamilyMember(_member, vt.id, vt.voteProposalAttributes[_id].amount);
                  
          //Deleting a family member 
        }else if (vt.voteProposalAttributes[_id].voteType == 8){
             vt.voteProposalAttributes[_id].voteStatus = 13;
             address _member = vt.voteProposalAttributes[_id].receiver;
             _wavercContract.deleteFamilyMember(_member,vt.id);
                if (vt.hasAccess[_member] == true) {
                delete vt.hasAccess[_member];
                vt.familyMembers -= 1;}
                updateThreshold(vt.voteProposalAttributes[_id].amount, vt);
        }
        //Changing Threshold of a Family Contract 
        else if (vt.voteProposalAttributes[_id].voteType == 9){
             vt.voteProposalAttributes[_id].voteStatus = 14;
             updateThreshold(vt.voteProposalAttributes[_id].amount, vt);
             
        }
         //Wrapping Native Token 
        else if (vt.voteProposalAttributes[_id].voteType == 10){
             vt.voteProposalAttributes[_id].voteStatus = 15;
        wrappedNativeToken.deposit{value: _amount}(); 
        emit VoteProposalLib.AddStake(address(this), address(wrappedNativeToken), block.timestamp, _amount); 
        }
         //Unwrapping Native Token  
        else if (vt.voteProposalAttributes[_id].voteType == 11){
             vt.voteProposalAttributes[_id].voteStatus = 16;
             wrappedNativeToken.withdraw(_amount);
        }
        else {
            revert VOTE_ID_NOT_FOUND();
        }
       emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder();
    }

    function updateThreshold (uint _threshold, VoteProposalLib.VoteTracking storage vt) internal {
        if (_threshold > vt.familyMembers) {_threshold = vt.familyMembers;}
        require (_threshold>=1);
        vt.threshold = _threshold;
    }
      /**
     * @notice A view function to monitor balance
     *@dev mobile
     */

    function balance() external view returns (uint ETHBalance) {
       return address(this).balance;
    }

    error TOO_MANY_MEMBERS();

    /**
     * @notice Through this method a family member is added once invitation is accepted.
     * @dev This method is called by the main contract.
     * @param _member The address that is being added.
     */

    function _addFamilyMember(address _member, uint256 _threshold) external {
        VoteProposalLib.enforceContractHasAccess();
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        vt.hasAccess[_member] = true;
        vt.familyMembers += 1;
        updateThreshold(_threshold, vt);
        if (vt.familyMembers > 50) {revert TOO_MANY_MEMBERS();}
    }
     /**
     * @notice This function settles balances in case of divorce for native token
     * @dev mobile
     * @param _id the ID of the proposal for divorce
     */

    function settleDivorce(uint256 _id) external nonReentrant{
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceOnlyPartners(msgSender_);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        WaverContract _wavercContract = WaverContract(vt.addressWaveContract);

        require (vt.voteProposalAttributes[_id].voteType == 4);

        if (vt.voteProposalAttributes[_id].voteends > block.timestamp) {
            VoteProposalLib.enforceAcceptedStatus(_id);
        } 
        vt.marriageStatus = VoteProposalLib.MarriageStatus.Divorced;
        vt.voteProposalAttributes[_id].voteStatus = 6;

            uint256 shareProposer = address(this).balance * vt.divideShare/10;
            uint256 shareProposed = address(this).balance - shareProposer;

            VoteProposalLib.processtxn(payable(vt.proposer), shareProposer);
            VoteProposalLib.processtxn(payable(vt.proposed), shareProposed);

            _wavercContract.divorceUpdate(vt.id);
    }

  
    /* Divorce settlement. Once Divorce is processed there are 
    other assets that have to be split*/

    /**
     * @notice Once divorced, partners can split ERC20 tokens owned by the proxy contract.
     * @dev Each partner/or other family member can call this function to transfer ERC20 to respective wallets.
     * @dev mobile
     * @param _tokenID the address of the ERC20 token that is being split.
     */

    function withdrawERC20(address _tokenID) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceOnlyPartners(msgSender_);
        VoteProposalLib.enforceDivorced();
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        uint256 amount = IERC20Upgradeable(_tokenID).balanceOf(address(this));
  
        uint256 shareProposer = amount * vt.divideShare/10;
        uint256 shareProposed = amount - shareProposer;

        require(transferToken(_tokenID, vt.proposer, shareProposer),"I101");
        require(transferToken(_tokenID, vt.proposed, shareProposed),"I101");
        VoteProposalLib.checkForwarder();
    }

    /**
     * @notice Before partner user accepts invitiation, initiator can claim ERC20 tokens back.
     * @dev Only Initiator can claim ERC20 tokens
     * @dev mobile
     * @param _tokenID the address of the ERC20 token.
     */

    function earlyWithdrawERC20(address _tokenID) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceNotYetMarried();
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        uint256 amount = IERC20Upgradeable(_tokenID).balanceOf(address(this));
        require(transferToken(_tokenID, vt.proposer, amount),"I101");
        VoteProposalLib.checkForwarder();
    }
    /**
     * @notice Once divorced, partners can split ERC721 tokens owned by the proxy contract. 
     * @dev Each partner/or other family member can call this function to split ERC721 token between partners.
     Two identical copies of ERC721 will be created by the NFT Splitter contract creating a new ERC1155 token.
      The token will be marked as "Copy". 
     To retreive the original copy, the owner needs to have both copies of the NFT. 
     * @dev mobile

     * @param _tokenAddr the address of the ERC721 token that is being split. 
     * @param _tokenID the ID of the ERC721 token that is being split
     * @param image the Image of the NFT 
     */

    function SplitNFT(
        address _tokenAddr,
        uint256 _tokenID,
        string calldata image
    ) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceOnlyPartners(msgSender_);
        VoteProposalLib.enforceDivorced();
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        WaverContract _wavercContract = WaverContract(vt.addressWaveContract);
        address nftSplitAddr = _wavercContract.addressNFTSplit(); //gets NFT splitter address from the main contract
        nftSplitInstance nftSplit = nftSplitInstance(nftSplitAddr);
        nftSplit.splitNFT(
            _tokenAddr,
            _tokenID,
            image,
            vt.proposer,
            vt.proposed,
            address(this),
            vt.divideShare
        ); //A copy of the NFT is created by the NFT Splitter.
        VoteProposalLib.checkForwarder();
    }

    /**
     * @notice If partner acquires both copies of NFTs, the NFT can be redeemed by that partner through NFT Splitter contract. 
     NFT Splitter uses this function to implement transfer of the token. Only Splitter Contract can call this function. 
     * @param _tokenAddr the address of the ERC721 token that is being joined. 
     * @param _receipent the address of the ERC721 token that is being sent. 
     * @param _tokenID the ID of the ERC721 token that is being sent
     */

    function sendNft(
        address _tokenAddr,
        address _receipent,
        uint256 _tokenID
    ) external {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        WaverContract _wavercContract = WaverContract(vt.addressWaveContract);
        if (_wavercContract.addressNFTSplit() != msg.sender) {revert VoteProposalLib.CONTRACT_NOT_AUTHORIZED(msg.sender);}
        IERC721(_tokenAddr).safeTransferFrom(
            address(this),
            _receipent,
            _tokenID
        );
    }

    /* Checking and Querying the voting data*/

    /* This view function returns how many votes has been created
    * @dev mobile
    */
    
    function getVoteLength() external view returns (uint256) {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        return vt.voteid - 1;
    }

    /**
     * @notice This function is used to query votings.  
     * @dev Since there is no limit for the number of voting proposals, the proposals are paginated. 
     Web queries page number to get voting statuses. Each page has 20 vote proposals. 
     * @param _pagenumber A page number queried.   
     * @dev mobile
     */

    function getVotingStatuses(uint256 _pagenumber)
        external
        view
        returns (VoteProposalLib.VoteProposal[] memory)
    {
        VoteProposalLib.enforceUserHasAccess(msg.sender);

        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        uint256 length = vt.voteid - 1;
        uint256 page = length / 20;
        uint256 size = 0;
        uint256 start = 0;
        if (_pagenumber * 20 > length) {
            size = length % 20;
            if (size == 0 && page != 0) {
                size = 20;
                page -= 1;
            }
            start = page * 20 + 1;
        } else if (_pagenumber * 20 <= length) {
            size = 20;
            start = (_pagenumber - 1) * 20 + 1;
        }

        VoteProposalLib.VoteProposal[]
            memory votings = new VoteProposalLib.VoteProposal[](size);

        for (uint256 i = 0; i < size; i++) {
            votings[i] = vt.voteProposalAttributes[start + i];
        }
        return votings;
    }
    /* Getter of Family Members Number
    * @dev mobile*/
    function getFamilyMembersNumber() external view returns (uint256) {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        return vt.familyMembers;
    }
  
      /* Getter of different utility contstants
      * @dev mobile
      */

    function getPolicies() external view 
    returns (uint policyDays, uint marryDate, uint divideShare, uint setDeadline, address proposer, address proposed, uint threshold) 
    {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        return (vt.policyDays,
                vt.marryDate,
                vt.divideShare,
                vt.setDeadline,
                vt.proposer,
                vt.proposed,
                vt.threshold 
                );
    }

    /**
     * @notice This function is used to mint NFTs, Depending on the ID the type of NFT will be minted 
     * @param logoID ID of logo
     * @param BackgroundID ID of Background 
     * @param MainID ID misc. 
     * @param value Love tokens to be sent to buy the NFT
     * @dev mobile
     */

    function _mintCertificate(
        uint256 logoID,
        uint256 BackgroundID,
        uint256 MainID, 
        uint256 value ) external {
        address msgSender_ = _msgSender();
         VoteProposalLib.enforceUserHasAccess(msgSender_);
         VoteProposalLib.enforceMarried();
          VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
          WaverContract _wavercContract = WaverContract(vt.addressWaveContract);

          _wavercContract.MintCertificate (
             logoID,
             BackgroundID,
             MainID,
             vt.id,
             value,
             vt.proposer,
             vt.proposed
          );
          VoteProposalLib._burn(msgSender_, value);
         VoteProposalLib.checkForwarder();
    }

     /**
     * @notice This function is used to claim LOVE tokens
     * @dev mobile
     */


    function _claimToken() external {
        address msgSender_ = _msgSender();
         VoteProposalLib.enforceUserHasAccess(msgSender_);
         VoteProposalLib.enforceMarried();
          VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
          WaverContract _wavercContract = WaverContract(vt.addressWaveContract);
         _wavercContract.claimToken(msgSender_,vt.id, vt.familyMembers);
         
         VoteProposalLib.checkForwarder();
    }


    /**
     * @notice A function to add string name for an Address 
     * @dev Names are used for better UI/UX. 
     * @param _name String name
     * @dev mobile
     */
 

    function addName(string memory _name) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        vt.nameAddress[msgSender_] = _name;
         VoteProposalLib.checkForwarder();
    }

    function getNameAddress(address _named) external view returns (string memory name){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        return vt.nameAddress[_named];
    }

 /* Getter of marriage status
 * @dev mobile 
 */
    function getMarriageStatus()
        external
        view
        returns (VoteProposalLib.MarriageStatus)
    {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        return vt.marriageStatus;
    }

    /* Checker of whether Module (Facet) is connected
    * @dev mobile*/
    function checkAppConnected(address appAddress)
        external
        view
        returns (bool)
    {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.connectedApps[appAddress];
    }

    /* Sends all connected modules
    * @dev mobile*/
    function getAllConnectedApps()
        external
        view
        returns (address [] memory Apps)
    {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.allConnectedApps;
    }

    error FACET_DOES_NOT_EXIST(address facet);
    // Find facet for function that is called and execute the
    // function if a facet is found and return any value.
    fallback() external payable {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        // get diamond storage
        assembly {
            ds.slot := position
        }
        // get facet from function selector
        address facet = ds
            .facetAddressAndSelectorPosition[msg.sig]
            .facetAddress;
        if (facet == address(0)) {revert FACET_DOES_NOT_EXIST(facet);}
        // Execute external function from facet using delegatecall and return any value.
        assembly {
            // copy function selector and any arguments
            calldatacopy(0, 0, calldatasize())
            // execute function call using the facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            // get any return value
            returndatacopy(0, 0, returndatasize())
            // return any return value or error back to the caller
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    /**
     * @notice A fallback function that receives native currency.
     * @dev It is required that the status is not divorced so that funds are not locked.
     */
    receive() external payable {
        require(msg.value > 0);
        if (gasleft() > 2300) {
            VoteProposalLib.enforceNotDivorced();   
            emit VoteProposalLib.AddStake(
                msg.sender,
                address(this),
                block.timestamp,
                msg.value
            ); 
        }
    }
}
