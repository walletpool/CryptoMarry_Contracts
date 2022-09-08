// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/******************************************************************************\
* Author: Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
* EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535
*
* Implementation of a diamond.
/******************************************************************************/

import "@gnus.ai/contracts-upgradeable-diamond/proxy/utils/Initializable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/token/ERC721/utils/ERC721HolderUpgradeable.sol";
//import "@gnus.ai/contracts-upgradeable-diamond/security/ReentrancyGuardUpgradeable.sol";

//import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
//import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "./SecuredTokenTransfer.sol";

//import "hardhat/console.sol";

import {LibDiamond} from "./libraries/LibDiamond.sol";
import {IDiamondCut} from "./interfaces/IDiamondCut.sol";
import {MarriageStatusLib} from "./libraries/MarriageStatusLib.sol";
import {VoteProposalLib} from "./libraries/VotingStatusLib.sol";

interface WaverContract {
    function burn(address _to, uint256 _amount) external;

    function policyDays() external returns (uint256);

    function addFamilyMember(address, uint256) external;

    function cancel(uint256) external;

    function deleteFamilyMember(address) external;

    function divorceUpdate(uint256 _id) external;

    function addressNFTSplit() external returns (address);

    function poolFee() external returns (uint24);
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
    ERC721HolderUpgradeable
{
    /**
     * @notice Initialization function of the proxy contract
     * @dev Initialization params are passed from the main contract.
     * @param _addressWaveContract Address of the main contract.
     * @param _id Marriage ID assigned by the main contract.
     * @param _proposer Address of the prpoposer.
     * @param _proposer Address of the proposed.
     * @param _cmFee CM fee, as a small percentage of incoming and outgoing transactions.
     */

    function initialize(
        address payable _addressWaveContract,
         address _diamondCutFacet,
        uint256 _id,
        address _proposer,
        address _proposed,
        uint256 _cmFee
    ) public initializer {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        vt.voteid += 1;

        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();

        ms.addressWaveContract = _addressWaveContract;
        ms.marriageStatus = MarriageStatusLib.MarriageStatus.Proposed;
        ms.hasAccess[_proposer] = true;
        ms.id = _id;
        ms.proposer = _proposer;
        ms.proposed = _proposed;
        ms.cmFee = _cmFee;

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
        MarriageStatusLib.enforceNotYetMarried();
        MarriageStatusLib.enforceUserHasAccess();

        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();
        ms.marriageStatus = MarriageStatusLib.MarriageStatus.Cancelled;
        WaverContract _wavercContract = WaverContract(ms.addressWaveContract);
        _wavercContract.cancel(ms.id);

        MarriageStatusLib.processtxn(
            ms.addressWaveContract,
            (address(this).balance * ms.cmFee) / 10000
        );
        MarriageStatusLib.processtxn(
            payable(ms.proposer),
            address(this).balance
        );
    }

    /**
     *@notice If the proposal is accepted, triggers this function to be added to the proxy contract.
     *@dev this function is called from the Main Contract.
     */

    function agreed() external {
        MarriageStatusLib.enforceContractHasAccess();
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();
        ms.marriageStatus = MarriageStatusLib.MarriageStatus.Married;
        ms.marryDate = block.timestamp;
        ms.hasAccess[ms.proposed] = true;
        ms.familyMembers = 2;
    }

    /**
     *@notice If the proposal is declined, the status is changed accordingly.
     *@dev this function is called from the Main Contract.
     */

    function declined() external {
        MarriageStatusLib.enforceContractHasAccess();
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();
        ms.marriageStatus = MarriageStatusLib.MarriageStatus.Declined;
    }

    /**
     * @notice This method allows to add stake to the contract.
     * @dev it is required that the marriage status is proper, since the funds will be locked if otherwise.
     */

    function addstake() external payable {
        MarriageStatusLib.enforceNotDivorced();
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();
        MarriageStatusLib.processtxn(
            ms.addressWaveContract,
            ((msg.value) * ms.cmFee) / 10000
        );
        emit MarriageStatusLib.AddStake(
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
     * @param _votestarts Timestamp on when the voting starts
     * @param _numTokens Number of LOVE tokens that is used to back this proposal. 
     * @param _receiver Address of the receiver who will be receiving indicated amounts. 
     * @param _tokenID Address of the ERC20, ERC721 or other tokens. 
     * @param _amount The amount of token that is being sent. Alternatively can be used as NFT ID. 
     Minimal Forwarder.
     */

    function createProposal(
        string memory _message,
        uint8 _votetype,
        uint256 _voteends,
        uint256 _votestarts,
        uint256 _numTokens,
        address payable _receiver,
        address _tokenID,
        uint256 _amount
    ) external {
        MarriageStatusLib.enforceUserHasAccess();
        MarriageStatusLib.enforceMarried();

        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();

        if (_votestarts < block.timestamp) {
            _votestarts = block.timestamp;
        }

        WaverContract _wavercContract = WaverContract(ms.addressWaveContract);

        if (_votetype == 4) {
            //Cooldown has to pass before divorce is proposed.
            uint256 policyDays = _wavercContract.policyDays();
            require(ms.marryDate + policyDays < block.timestamp);
            //Only partners can propose divorce
            MarriageStatusLib.enforceOnlyPartners();
        }

        vt.findVoteId.push(vt.voteid);

        vt.voteProposalAttributes[vt.voteid] = VoteProposalLib.VoteProposal({
            id: vt.voteid,
            proposer: msg.sender,
            voteType: _votetype,
            tokenVoteQuantity: _numTokens,
            voteProposalText: _message,
            voteStatus: VoteProposalLib.Status.Proposed,
            voteends: _voteends,
            voteStarts: _votestarts,
            receiver: _receiver,
            tokenID: _tokenID,
            amount: _amount
        });

        vt.numTokenFor[vt.voteid] = _numTokens;

        vt.votersLeft[vt.voteid] = ms.familyMembers - 1;
        vt.votingStatus[vt.voteid][msg.sender] = true;

        _wavercContract.burn(msg.sender, _numTokens);
        emit VoteProposalLib.VoteStatus(
            vt.voteid,
            msg.sender,
            VoteProposalLib.Status.Proposed,
            block.timestamp
        );

        vt.voteid += 1;
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
        uint256 _id,
        uint256 _numTokens,
        uint8 responsetype
    ) external {
        MarriageStatusLib.enforceUserHasAccess();
        VoteProposalLib.enforceNotVoted(_id);
        VoteProposalLib.enforceProposedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();

        WaverContract _wavercContract = WaverContract(ms.addressWaveContract);

        vt.votingStatus[_id][msg.sender] = true;
        vt.votersLeft[_id] -= 1;

        if (responsetype == 2) {
            vt.numTokenFor[_id] += _numTokens;
        } else {
            vt.numTokenAgainst[_id] += _numTokens;
        }

        if (vt.votersLeft[_id] == 0) {
            if (vt.numTokenFor[_id] < vt.numTokenAgainst[_id]) {
                vt.voteProposalAttributes[_id].voteStatus = VoteProposalLib
                    .Status
                    .Declined;
            } else {
                vt.voteProposalAttributes[_id].voteStatus = VoteProposalLib
                    .Status
                    .Accepted;
            }
        }

        _wavercContract.burn(msg.sender, _numTokens);
        emit VoteProposalLib.VoteStatus(
            _id,
            msg.sender,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
    }

    /**
     * @notice The vote can be cancelled by the proposer if it has not been passed.
     * @dev once cancelled the proposal cannot be voted or executed.
     * @param _id Vote ID, that is being voted for/against.
     */

    function cancelVoting(uint256 _id) external {
        VoteProposalLib.enforceProposedStatus(_id);
        VoteProposalLib.enforceOnlyProposer(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        vt.voteProposalAttributes[_id].voteStatus = VoteProposalLib
            .Status
            .Cancelled;
        emit VoteProposalLib.VoteStatus(
            _id,
            msg.sender,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
    }

    /**
     * @notice The vote can be processed if deadline has been passed.
     * @dev voteend is compounded. The status of the vote proposal depends on number of Tokens voted for/against.
     * @param _id Vote ID, that is being voted for/against.
     
     */

    function endVotingByTime(uint256 _id) external {
       
        MarriageStatusLib.enforceUserHasAccess();
        
        VoteProposalLib.enforceProposedStatus(_id);

        VoteProposalLib.enforceDeadlinePassed(_id);
  
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

            if (vt.numTokenFor[_id] < vt.numTokenAgainst[_id]) {
                vt.voteProposalAttributes[_id].voteStatus = VoteProposalLib
                    .Status
                    .Declined;
            } else {
                vt.voteProposalAttributes[_id].voteStatus = VoteProposalLib
                    .Status
                    .Accepted;
            }
        
        emit VoteProposalLib.VoteStatus(
            _id,
            msg.sender,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
    }

    /**
     * @notice If the proposal has been passed, depending on vote type, the proposal is executed.
     * @dev  Two external protocols are used Uniswap and Compound.
     * @param _id Vote ID, that is being voted for/against.
     */

    function executeVoting(uint256 _id) external {
        MarriageStatusLib.enforceMarried();
        MarriageStatusLib.enforceUserHasAccess();
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();

        WaverContract _wavercContract = WaverContract(ms.addressWaveContract);

        //A small fee for the protocol is deducted here
        uint256 _amount = (vt.voteProposalAttributes[_id].amount *
            (10000 - ms.cmFee)) / 10000;
        uint256 _cmfees = vt.voteProposalAttributes[_id].amount - _amount;

        // Sending ETH from the contract
        if (vt.voteProposalAttributes[_id].voteType == 3) {
            MarriageStatusLib.processtxn(ms.addressWaveContract, _cmfees);
            MarriageStatusLib.processtxn(
                payable(vt.voteProposalAttributes[_id].receiver),
                _amount
            );
            vt.voteProposalAttributes[_id].voteStatus = VoteProposalLib
                .Status
                .Paid;
        }
        //Sending ERC20 tokens owned by the contract
        else if (vt.voteProposalAttributes[_id].voteType == 2) {
            require(
                transferToken(
                    vt.voteProposalAttributes[_id].tokenID,
                    ms.addressWaveContract,
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

            vt.voteProposalAttributes[_id].voteStatus = VoteProposalLib
                .Status
                .Paid;
        }
        //This is if two sides decide to divorce, funds are split between partners
        else if (vt.voteProposalAttributes[_id].voteType == 4) {
            ms.marriageStatus = MarriageStatusLib.MarriageStatus.Divorced;

            MarriageStatusLib.processtxn(
                ms.addressWaveContract,
                (address(this).balance * ms.cmFee) / 10000
            );

            uint256 splitamount = address(this).balance / 2;
            MarriageStatusLib.processtxn(payable(ms.proposer), splitamount);
            MarriageStatusLib.processtxn(payable(ms.proposed), splitamount);

            _wavercContract.divorceUpdate(ms.id);

            vt.voteProposalAttributes[_id].voteStatus = VoteProposalLib
                .Status
                .Divorced;

            //Sending ERC721 tokens owned by the contract
        } else if (vt.voteProposalAttributes[_id].voteType == 5) {
            IERC721(vt.voteProposalAttributes[_id].tokenID).safeTransferFrom(
                address(this),
                vt.voteProposalAttributes[_id].receiver,
                vt.voteProposalAttributes[_id].amount
            );
            vt.voteProposalAttributes[_id].voteStatus = VoteProposalLib
                .Status
                .NFTsent;
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
     * @notice Through this method a family member can be invited. Once added, the user needs to accept invitation.
     * @dev Only partners can add new family member. Partners cannot add their current addresses.
     * @param _member The address who are being invited to the proxy.
     */

    function addFamilyMember(address _member) external {
        MarriageStatusLib.enforceOnlyPartners();
        MarriageStatusLib.enforceNotPartnerAddr(_member);
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();
        require(ms.familyMembers < 50);
        WaverContract _waverContract = WaverContract(ms.addressWaveContract);
        _waverContract.addFamilyMember(_member, ms.id);

        emit VoteProposalLib.VoteStatus(
            0,
            msg.sender,
            VoteProposalLib.Status.FamilyAdded,
            block.timestamp
        );
    }

    /**
     * @notice Through this method a family member is added once invitation is accepted.
     * @dev This method is called by the main contract.
     * @param _member The address that is being added.
     */

    function _addFamilyMember(address _member) external {
        MarriageStatusLib.enforceContractHasAccess();
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();
        ms.hasAccess[_member] = true;
        ms.familyMembers += 1;
    }

    /**
     * @notice Through this method a family member can be deleted. Member can be deleted by partners or by the members own address.
     * @dev Member looses access and will not be able to access to the proxy contract from the front end. Member address cannot be that of partners'.
     * @param _member The address who are being deleted.
     */

    function deleteFamilyMember(address _member) external {
        MarriageStatusLib.enforceOnlyPartners();
        MarriageStatusLib.enforceNotPartnerAddr(_member);
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();

        WaverContract _waverContract = WaverContract(ms.addressWaveContract);

        _waverContract.deleteFamilyMember(_member);
        delete ms.hasAccess[_member];
        ms.familyMembers -= 1;
        emit VoteProposalLib.VoteStatus(
            0,
            msg.sender,
            VoteProposalLib.Status.FamilyDeleted,
            block.timestamp
        );
    }

    /* Divorce settlement. Once Divorce is processed there are 
    other assets that have to be split*/

    /**
     * @notice Once divorced, partners can split ERC20 tokens owned by the proxy contract.
     * @dev Each partner/or other family member can call this function to transfer ERC20 to respective wallets.
     * @param _tokenID the address of the ERC20 token that is being split.
     */

    function withdrawERC20(address _tokenID) external {
        MarriageStatusLib.enforceOnlyPartners();
        MarriageStatusLib.enforceDivorced();
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();
        uint256 amount = IERC20Upgradeable(_tokenID).balanceOf(address(this));

        require(
            transferToken(
                _tokenID,
                ms.addressWaveContract,
                (amount * ms.cmFee) / 10000
            )
        );
        amount = IERC20Upgradeable(_tokenID).balanceOf(address(this));

        require(transferToken(_tokenID, ms.proposer, (amount / 2)));
        require(transferToken(_tokenID, ms.proposed, (amount / 2)));
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
        MarriageStatusLib.enforceOnlyPartners();
        MarriageStatusLib.enforceDivorced();
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();

        require(ms.wasDistributed[_tokenAddr][_tokenID] == 0); //ERC721 Token should not be split before
        require(checkOwnership(_tokenAddr, _tokenID) == true); // Check whether the indicated token is owned by the proxy contract.

        WaverContract _wavercContract = WaverContract(ms.addressWaveContract);
        address nftSplitAddr = _wavercContract.addressNFTSplit(); //gets NFT splitter address from the pain contract

        nftSplitInstance nftSplit = nftSplitInstance(nftSplitAddr);
        ms.wasDistributed[_tokenAddr][_tokenID] == 1; //Check and Effect
        nftSplit.splitNFT(
            _tokenAddr,
            _tokenID,
            nft_json1,
            nft_json2,
            ms.proposer,
            ms.proposed,
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
     NFT Splitter uses this function to implement transfer of the token.  
     * @param _tokenAddr the address of the ERC721 token that is being joined. 
     * @param _receipent the address of the ERC721 token that is being sent. 
     * @param _tokenID the ID of the ERC721 token that is being sent
     */

    function sendNft(
        address _tokenAddr,
        address _receipent,
        uint256 _tokenID
    ) external {
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();
        WaverContract _wavercContract = WaverContract(ms.addressWaveContract);
        require(_wavercContract.addressNFTSplit() == msg.sender);
        IERC721(_tokenAddr).safeTransferFrom(
            address(this),
            _receipent,
            _tokenID
        );
    }

    /* GETTERS*/

    /* Checking and Querying the voting data*/

    /* This view function returns how many votes has been created*/
    function getVoteLength() external view returns (uint256) {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        return vt.findVoteId.length;
    }

    /**
     * @notice This function is used to query votings.  
     * @dev Since there is no limit for the number of voting proposals, the proposals are paginated. 
     Web queries page number to get voting statuses. Each page has 20 vote proposals. 
     * @param _pagenumber A page number queried.   
     */

    function getVotingStatuses(uint256 _pagenumber)
        external
        view
        returns (VoteProposalLib.VoteProposal[] memory)
    {
        MarriageStatusLib.enforceUserHasAccess();

        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        uint256 page = vt.findVoteId.length / 20;
        uint256 size;
        uint256 start;
        if (_pagenumber * 20 > vt.findVoteId.length) {
            size = vt.findVoteId.length % 20;
            if (size == 0 && page != 0) {
                size = 20;
                page -= 1;
            }
            start = page * 20;
        } else if (_pagenumber * 20 <= vt.findVoteId.length) {
            size = 20;
            start = (_pagenumber - 1) * 20;
        }

        VoteProposalLib.VoteProposal[]
            memory votings = new VoteProposalLib.VoteProposal[](size);

        for (uint256 i = 0; i < size; i++) {
            votings[i] = vt.voteProposalAttributes[vt.findVoteId[start + i]];
        }
        return votings;
    }

    function getFamilyMembersNumber() external view returns (uint256) {
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();
        return ms.familyMembers;
    }

    function getMarryDate() external view returns (uint256) {
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();
        return ms.marryDate;
    }

    function getMarriageStatus()
        external
        view
        returns (MarriageStatusLib.MarriageStatus)
    {
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();
        return ms.marriageStatus;
    }

    function getVotersLeft(uint256 _voteid) external view returns (uint256) {
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        return vt.votersLeft[_voteid];
    }

    function getNFTDistributed(address tokenAddr, uint256 TokenID)
        external
        view
        returns (uint8)
    {
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();
        return ms.wasDistributed[tokenAddr][TokenID];
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
        require(facet != address(0), "Diamond: Function does not exist");
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
            MarriageStatusLib.enforceNotDivorced();
            MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
                .marriageStatusStorage();
            MarriageStatusLib.processtxn(
                ms.addressWaveContract,
                (msg.value * ms.cmFee) / 10000
            );
            emit MarriageStatusLib.AddStake(
                msg.sender,
                address(this),
                block.timestamp,
                msg.value
            );
        }
    }
}
