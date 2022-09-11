// SPDX-License-Identifier: BSL
pragma solidity ^0.8.13;

/**
*   [BSL License]
*   @title CM Proxy contract implementation.
*   @notice Individual contract is created after proposal has been sent to the partner. 
    ETH stake will be deposited to this newly created contract.
*   @dev The proxy uses Diamond Pattern for modularity. Relevant code was borrowed from  
    Nick Mudge <nick@perfectabstractions.com>. Reimbursement of sponsored TXFee through
    MinimalForwarder, amounts to full estimated TX Costs at the beginning of relevant 
    functions.   
*   @author Ismailov Altynbek <altyni@gmail.com>
*/

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/security/ReentrancyGuardUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "./SecuredTokenTransfer.sol";

import {LibDiamond} from "./libraries/LibDiamond.sol";
import {IDiamondCut} from "./interfaces/IDiamondCut.sol";
import {VoteProposalLib} from "./libraries/VotingStatusLib.sol";

/*Interface for the Main Contract*/
interface WaverContract {
    function burn(address _to, uint256 _amount) external;

    function addFamilyMember(address, uint256) external;

    function cancel(uint256) external;

    function deleteFamilyMember(address) external;

    function divorceUpdate(uint256 _id) external;

    function addressNFTSplit() external returns (address);
}

/*Interface for the NFT Split Contract*/

interface nftSplitInstance {
    function splitNFT(
        address _nft_Address,
        uint256 _tokenID,
        string memory nft_json1,
        string memory nft_json2,
        address waver,
        address proposed,
        address _implementationAddr
    ) external;
}

contract WaverIDiamond is
    Initializable,
    SecuredTokenTransfer,
    ERC721HolderUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC2771ContextUpgradeable
{
    /*Constructor to connect Forwarder Address*/
    constructor(MinimalForwarderUpgradeable forwarder)
        initializer
        ERC2771ContextUpgradeable(address(forwarder))
    {}

    /**
     * @notice Initialization function of the proxy contract
     * @dev Initialization params are passed from the main contract.
     * @param _addressWaveContract Address of the main contract.
     * @param _diamondCutFacet Address of the Diamond Facet Cut
     * @param _id Marriage ID assigned by the main contract.
     * @param _proposer Address of the prpoposer.
     * @param _proposer Address of the proposed.
     * @param _policyDays Cooldown before divorcing
     * @param _cmFee CM fee, as a small percentage of incoming and outgoing transactions.
     */

    function initialize(
        address payable _addressWaveContract,
        address _diamondCutFacet,
        uint256 _id,
        address _proposer,
        address _proposed,
        uint256 _policyDays,
        uint256 _cmFee
    ) public initializer {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        unchecked {
            ++vt.voteid;
        }
        vt.addressWaveContract = _addressWaveContract;
        vt.marriageStatus = VoteProposalLib.MarriageStatus.Proposed;
        vt.hasAccess[_proposer] = true;
        vt.id = _id;
        vt.proposer = _proposer;
        vt.proposed = _proposed;
        vt.cmFee = _cmFee;
        vt.policyDays = _policyDays;

        // Add the diamondCut external function from the diamondCutFacet
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);

        bytes4[] memory functionSelectors = new bytes4[](1);

        functionSelectors[0] = IDiamondCut.diamondCut.selector;

        cut[0] = IDiamondCut.FacetCut({
            facetAddress: _diamondCutFacet,
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
     */

    function cancel() external {
        VoteProposalLib.enforceNotYetMarried();
        VoteProposalLib.enforceUserHasAccess(_msgSender());

        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        vt.marriageStatus = VoteProposalLib.MarriageStatus.Cancelled;
        WaverContract _wavercContract = WaverContract(vt.addressWaveContract);
        _wavercContract.cancel(vt.id);

        VoteProposalLib.processtxn(
            vt.addressWaveContract,
            (address(this).balance * vt.cmFee) / 10000
        );
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

    /**
     * @notice This method allows to add stake to the contract.
     * @dev it is required that the marriage status is proper, since the funds will be locked if otherwise.
     */

    function addstake() external payable {
        VoteProposalLib.enforceNotDivorced();
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        VoteProposalLib.processtxn(
            vt.addressWaveContract,
            ((msg.value) * vt.cmFee) / 10000
        );
        emit VoteProposalLib.AddStake(
            msg.sender,
            address(this),
            block.timestamp,
            msg.value
        );
    }

    /**
     * @notice Through this method proposals for voting is created. 
     * @dev All params are required. tokenID for the native currency is 0x0 address. To create proposals it is necessary to 
     have LOVE tokens as it will be used as backing of the proposal. 
     * @param _message String text on details of the proposal. 
     * @param _votetype Type of the proposal as it was listed in enum above. 
     * @param _voteends Timestamp on when the voting ends
     * @param _numTokens Number of LOVE tokens that is used to back this proposal. 
     * @param _receiver Address of the receiver who will be receiving indicated amounts. 
     * @param _tokenID Address of the ERC20, ERC721 or other tokens. 
     * @param _amount The amount of token that is being sent. Alternatively can be used as NFT ID. 
     */

    function createProposal(
        string calldata _message,
        uint8 _votetype,
        uint256 _voteends,
        uint256 _numTokens,
        address payable _receiver,
        address _tokenID,
        uint256 _amount
    ) external {
        uint256 _GasLeft = gasleft();
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceMarried();

        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        WaverContract _wavercContract = WaverContract(vt.addressWaveContract);

        if (_votetype == 4) {
            //Cooldown has to pass before divorce is proposed.
            require(vt.marryDate + vt.policyDays < block.timestamp);
            //Only partners can propose divorce
            VoteProposalLib.enforceOnlyPartners(msgSender_);
        }

        vt.voteProposalAttributes[vt.voteid] = VoteProposalLib.VoteProposal({
            id: vt.voteid,
            proposer: msgSender_,
            voteType: _votetype,
            tokenVoteQuantity: _numTokens,
            voteProposalText: _message,
            voteStatus: 1,
            voteends: _voteends,
            receiver: _receiver,
            tokenID: _tokenID,
            amount: _amount,
            votersLeft: vt.familyMembers - 1
        });

        vt.numTokenFor[vt.voteid] = _numTokens;

        vt.votingStatus[vt.voteid][msgSender_] = true;

        _wavercContract.burn(msgSender_, _numTokens);

        emit VoteProposalLib.VoteStatus(
            vt.voteid,
            msgSender_,
            1,
            block.timestamp
        );

        unchecked {
            ++vt.voteid;
        }
        checkForwarder(_GasLeft, vt);
    }

    /**
     * @notice Through this method, proposals are voted for/against.  
     * @dev A user cannot vote twice. User cannot vote on voting which has been already passed/declined. Token staked is burnt.
     There is no explicit ways of identifying votes for or against the vote. 
     * @param _id Vote ID, that is being voted for/against. 
     * @param _numTokens Number of LOVE tokens that is being backed within the vote. 
     * @param responsetype Voting response for/against
     */

    function voteResponse(
        uint24 _id,
        uint256 _numTokens,
        uint8 responsetype
    ) external {
        uint256 _GasLeft = gasleft();
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceNotVoted(_id,msgSender_);
        VoteProposalLib.enforceProposedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        WaverContract _wavercContract = WaverContract(vt.addressWaveContract);

        vt.votingStatus[_id][msgSender_] = true;
        vt.voteProposalAttributes[_id].votersLeft -= 1;

        if (responsetype == 2) {
            vt.numTokenFor[_id] += _numTokens;
        } else {
            vt.numTokenAgainst[_id] += _numTokens;
        }

        if (vt.voteProposalAttributes[_id].votersLeft == 0) {
            if (vt.numTokenFor[_id] < vt.numTokenAgainst[_id]) {
                vt.voteProposalAttributes[_id].voteStatus = 3;
            } else {
                vt.voteProposalAttributes[_id].voteStatus = 2;
            }
        }

        _wavercContract.burn(msgSender_, _numTokens);
        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
        checkForwarder(_GasLeft, vt);
    }

    /**
     * @notice The vote can be cancelled by the proposer if it has not been passed.
     * @dev once cancelled the proposal cannot be voted or executed.
     * @param _id Vote ID, that is being voted for/against.
     */

    function cancelVoting(uint24 _id) external {
        address msgSender_ = _msgSender();
        uint256 _GasLeft = gasleft();
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
        checkForwarder(_GasLeft, vt);
    }

    /**
     * @notice The vote can be processed if deadline has been passed.
     * @dev voteend is compounded. The status of the vote proposal depends on number of Tokens voted for/against.
     * @param _id Vote ID, that is being voted for/against.
     */

    function endVotingByTime(uint24 _id) external {
        address msgSender_ = _msgSender();
        uint256 _GasLeft = gasleft();
        VoteProposalLib.enforceUserHasAccess(msgSender_ );
        VoteProposalLib.enforceProposedStatus(_id);
        VoteProposalLib.enforceDeadlinePassed(_id);

        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.numTokenFor[_id] < vt.numTokenAgainst[_id]) {
            vt.voteProposalAttributes[_id].voteStatus = 3;
        } else {
            vt.voteProposalAttributes[_id].voteStatus = 2;
        }

        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_ ,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
        checkForwarder(_GasLeft, vt);
    }

    /**
     * @notice If the proposal has been passed, depending on vote type, the proposal is executed.
     * @dev  Two external protocols are used Uniswap and Compound.
     * @param _id Vote ID, that is being voted for/against.
     */

    function executeVoting(uint24 _id) external nonReentrant {
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msg.sender);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        WaverContract _wavercContract = WaverContract(vt.addressWaveContract);
        //A small fee for the protocol is deducted here
        uint256 _amount = (vt.voteProposalAttributes[_id].amount *
            (10000 - vt.cmFee)) / 10000;
        uint256 _cmfees = vt.voteProposalAttributes[_id].amount - _amount;

        // Sending ETH from the contract
        if (vt.voteProposalAttributes[_id].voteType == 3) {
            VoteProposalLib.processtxn(vt.addressWaveContract, _cmfees);
            VoteProposalLib.processtxn(
                payable(vt.voteProposalAttributes[_id].receiver),
                _amount
            );
            vt.voteProposalAttributes[_id].voteStatus = 5;
        }
        //Sending ERC20 tokens owned by the contract
        else if (vt.voteProposalAttributes[_id].voteType == 2) {
            require(
                transferToken(
                    vt.voteProposalAttributes[_id].tokenID,
                    vt.addressWaveContract,
                    _cmfees
                )
            );
            require(
                transferToken(
                    vt.voteProposalAttributes[_id].tokenID,
                    payable(vt.voteProposalAttributes[_id].receiver),
                    _amount
                )
            );

            vt.voteProposalAttributes[_id].voteStatus = 5;
        }
         else if (vt.voteProposalAttributes[_id].voteType == 3) {
            VoteProposalLib.processtxn(vt.addressWaveContract, _cmfees);
            VoteProposalLib.processtxn(payable(vt.voteProposalAttributes[_id].receiver), _amount);

        
            vt.voteProposalAttributes[_id].voteStatus = 5;
        }
        //This is if two sides decide to divorce, funds are split between partners
        else if (vt.voteProposalAttributes[_id].voteType == 4) {
            vt.marriageStatus = VoteProposalLib.MarriageStatus.Divorced;

            VoteProposalLib.processtxn(
                vt.addressWaveContract,
                (address(this).balance * vt.cmFee) / 10000
            );

            uint256 splitamount = address(this).balance / 2;
            VoteProposalLib.processtxn(payable(vt.proposer), splitamount);
            VoteProposalLib.processtxn(payable(vt.proposed), splitamount);

            _wavercContract.divorceUpdate(vt.id);

            vt.voteProposalAttributes[_id].voteStatus = 6;

            //Sending ERC721 tokens owned by the contract
        } else if (vt.voteProposalAttributes[_id].voteType == 5) {
            IERC721(vt.voteProposalAttributes[_id].tokenID).safeTransferFrom(
                address(this),
                vt.voteProposalAttributes[_id].receiver,
                vt.voteProposalAttributes[_id].amount
            );
            vt.voteProposalAttributes[_id].voteStatus = 10;
        } else {
            revert();
        }
        emit VoteProposalLib.VoteStatus(
            _id,
            msg.sender,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
    }

    /**
     * @notice Function to reimburse transactions costs of relayers
     * @param _GasLeft Gas left at the beginning of the transaction*/

    function checkForwarder(
        uint256 _GasLeft,
        VoteProposalLib.VoteTracking storage vt
    ) internal {
        if (isTrustedForwarder(msg.sender)) {
            VoteProposalLib.processtxn(
                vt.addressWaveContract,
                _GasLeft * tx.gasprice
            );
        }
    }

    /**
     * @notice Through this method a family member can be invited. Once added, the user needs to accept invitation.
     * @dev Only partners can add new family member. Partners cannot add their current addresses.
     * @param _member The address who are being invited to the proxy.
     */

    function addFamilyMember(address _member) external {
        address msgSender_ = _msgSender();
        uint256 _GasLeft = gasleft();
        VoteProposalLib.enforceOnlyPartners(msgSender_);
        VoteProposalLib.enforceNotPartnerAddr(_member);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        require(vt.familyMembers < 50);

        WaverContract _waverContract = WaverContract(vt.addressWaveContract);
        _waverContract.addFamilyMember(_member, vt.id);

        emit VoteProposalLib.VoteStatus(
            0,
            msgSender_,
            11,
            block.timestamp
        );
        checkForwarder(_GasLeft, vt);
    }

    /**
     * @notice Through this method a family member is added once invitation is accepted.
     * @dev This method is called by the main contract.
     * @param _member The address that is being added.
     */

    function _addFamilyMember(address _member) external {
        VoteProposalLib.enforceContractHasAccess();
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        vt.hasAccess[_member] = true;
        vt.familyMembers += 1;
    }

    /**
     * @notice Through this method a family member can be deleted. Member can be deleted by partners or by the members own address.
     * @dev Member looses access and will not be able to access to the proxy contract from the front end. Member address cannot be that of partners'.
     * @param _member The address who are being deleted.
     */

    function deleteFamilyMember(address _member) external {
        uint256 _GasLeft = gasleft();
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceOnlyPartners(msgSender_);
        VoteProposalLib.enforceNotPartnerAddr(_member);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        WaverContract _waverContract = WaverContract(vt.addressWaveContract);

        _waverContract.deleteFamilyMember(_member);
        delete vt.hasAccess[_member];
        vt.familyMembers -= 1;
        emit VoteProposalLib.VoteStatus(
            0,
            msgSender_,
            12,
            block.timestamp
        );
        checkForwarder(_GasLeft, vt);
    }

    /* Divorce settlement. Once Divorce is processed there are 
    other assets that have to be split*/

    /**
     * @notice Once divorced, partners can split ERC20 tokens owned by the proxy contract.
     * @dev Each partner/or other family member can call this function to transfer ERC20 to respective wallets.
     * @param _tokenID the address of the ERC20 token that is being split.
     */

    function withdrawERC20(address _tokenID) external nonReentrant {
        VoteProposalLib.enforceOnlyPartners(msg.sender);
        VoteProposalLib.enforceDivorced();
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        uint256 amount = IERC20Upgradeable(_tokenID).balanceOf(address(this));

        require(
            transferToken(
                _tokenID,
                vt.addressWaveContract,
                (amount * vt.cmFee) / 10000
            )
        );
        amount = IERC20Upgradeable(_tokenID).balanceOf(address(this));

        require(transferToken(_tokenID, vt.proposer, (amount / 2)));
        require(transferToken(_tokenID, vt.proposed, (amount / 2)));
    }

    /**
     * @notice Once divorced, partners can split ERC721 tokens owned by the proxy contract. 
     * @dev Each partner/or other family member can call this function to split ERC721 token between partners.
     Two identical copies of ERC721 will be created by the NFT Splitter contract creating a new ERC1155 token.
      The token will be marked as "Copy". 
     To retreive the original copy, the owner needs to have both copies of the NFT. 

     * @param _tokenAddr the address of the ERC721 token that is being split. 
     * @param _tokenID the ID of the ERC721 token that is being split
     * @param nft_json1 metadata of the ERC721.  
     * @param nft_json2 metadata of the ERC721 part 2.  
     */

    function SplitNFT(
        address _tokenAddr,
        uint256 _tokenID,
        string memory nft_json1,
        string memory nft_json2
    ) external {
        VoteProposalLib.enforceOnlyPartners(msg.sender);
        VoteProposalLib.enforceDivorced();
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        require(vt.wasDistributed[_tokenAddr][_tokenID] == 0); //ERC721 Token should not be split before
        require(checkOwnership(_tokenAddr, _tokenID) == true); // Check whether the indicated token is owned by the proxy contract.

        WaverContract _wavercContract = WaverContract(vt.addressWaveContract);
        address nftSplitAddr = _wavercContract.addressNFTSplit(); //gets NFT splitter address from the pain contract

        nftSplitInstance nftSplit = nftSplitInstance(nftSplitAddr);
        vt.wasDistributed[_tokenAddr][_tokenID] == 1; //Check and Effect
        nftSplit.splitNFT(
            _tokenAddr,
            _tokenID,
            nft_json1,
            nft_json2,
            vt.proposer,
            vt.proposed,
            address(this)
        ); //A copy of the NFT is created by NFT Splitter.
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
        return (address(this) == _owner);
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
        require(_wavercContract.addressNFTSplit() == msg.sender);
        IERC721(_tokenAddr).safeTransferFrom(
            address(this),
            _receipent,
            _tokenID
        );
    }

    /* Checking and Querying the voting data*/

    /* This view function returns how many votes has been created*/
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
     */

    function getVotingStatuses(uint24 _pagenumber)
        external
        view
        returns (VoteProposalLib.VoteProposal[] memory)
    {
        VoteProposalLib.enforceUserHasAccess(msg.sender);

        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        uint24 length = vt.voteid - 1;
        uint24 page = length / 20;
        uint24 size;
        uint24 start;
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

        for (uint24 i = 0; i < size; i++) {
            votings[i] = vt.voteProposalAttributes[start + i];
        }
        return votings;
    }
    /* Getter of Family Members Number*/
    function getFamilyMembersNumber() external view returns (uint256) {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        return vt.familyMembers;
    }

      /* Getter of cooldown before divorce*/

    function getPolicyDays() external view returns (uint256) {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        return vt.policyDays;
    }

    /* Getter date of marriage*/
    function getMarryDate() external view returns (uint256) {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        return vt.marryDate;
    }

 /* Getter of marriage status*/
    function getMarriageStatus()
        external
        view
        returns (VoteProposalLib.MarriageStatus)
    {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        return vt.marriageStatus;
    }

    /* Getter of NFT status*/
    function getNFTDistributed(address tokenAddr, uint256 TokenID)
        external
        view
        returns (uint8)
    {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        return vt.wasDistributed[tokenAddr][TokenID];
    }

    /* Checker of whether Module (Facet) is connected*/
    function checkAppConnected(address appAddress)
        external
        view
        returns (bool)
    {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.connectedApps[appAddress];
    }

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
        require(facet != address(0));
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
            VoteProposalLib.VoteTracking storage vt = VoteProposalLib
                .VoteTrackingStorage();
            VoteProposalLib.processtxn(
                vt.addressWaveContract,
                (msg.value * vt.cmFee) / 10000
            );
            emit VoteProposalLib.AddStake(
                msg.sender,
                address(this),
                block.timestamp,
                msg.value
            );
        }
    }
}
