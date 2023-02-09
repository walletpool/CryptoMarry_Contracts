// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

/*Interface for the Main Contract*/

contract FamilyDAOFacet is ERC2771ContextUpgradeable{
    
    error COULD_NOT_PROCESS();
    
    constructor(MinimalForwarderUpgradeable forwarder)
        ERC2771ContextUpgradeable(address(forwarder))
        {}
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
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceMarried();
        require(bytes(_message).length < 192);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

      
        
        if (_voteends < block.timestamp + vt.setDeadline) {_voteends = block.timestamp + vt.setDeadline; } //Checking for too short notice
        
        vt.voteProposalAttributes[vt.voteid] = VoteProposalLib.VoteProposal({
            id: vt.voteid,
            proposer: msgSender_,
            voteType: _votetype,
            voteProposalText: _message,
            voteStatus: 1,
            voteends: _voteends,
            receiver: _receiver,
            tokenID: _tokenID,
            amount: _amount,
            votersLeft: vt.familyMembers - 1,
            familyDao: 1,
            numTokenFor: _numTokens,
            numTokenAgainst: 0
        });
        vt.votingStatus[vt.voteid][msgSender_] = true;
       if (_numTokens>0) {VoteProposalLib._burn(msgSender_, _numTokens);}

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
     * @param _numTokens Number of LOVE tokens that is being backed within the vote. 
     * @param responsetype Voting response for/against
     */

    function voteResponse(
        uint24 _id,
        uint256 _numTokens,
        uint8 responsetype
    ) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceNotVoted(_id,msgSender_);
        VoteProposalLib.enforceProposedStatus(_id);
        VoteProposalLib.enforceFamilyDAO(1,_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

      
        vt.votingStatus[_id][msgSender_] = true;
        vt.voteProposalAttributes[_id].votersLeft -= 1;

        if (responsetype == 2) {
            vt.voteProposalAttributes[_id].numTokenFor += _numTokens;
        } else {
            vt.voteProposalAttributes[_id].numTokenAgainst += _numTokens;
        }

          if (vt.voteProposalAttributes[_id].votersLeft == 0) {
            if (vt.voteProposalAttributes[_id].numTokenFor >= vt.voteProposalAttributes[_id].numTokenAgainst ) {
                vt.voteProposalAttributes[_id].voteStatus = 2;
            } else {
                vt.voteProposalAttributes[_id].voteStatus = 3;
            }
        }

        if (_numTokens>0) {VoteProposalLib._burn(msgSender_, _numTokens);}
         emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );  
        VoteProposalLib.checkForwarder();
    }

     /**
     * @notice The vote can be processed if deadline has been passed.
     * @dev voteend is compounded. The status of the vote proposal depends on number of Tokens voted for/against.
     * @param _id Vote ID, that is being voted for/against.
     */

    function endVotingByTime(uint24 _id) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceOnlyPartners(msgSender_);
        VoteProposalLib.enforceProposedStatus(_id);
        VoteProposalLib.enforceDeadlinePassed(_id);
        VoteProposalLib.enforceFamilyDAO(1,_id);

        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].numTokenFor >= vt.voteProposalAttributes[_id].numTokenAgainst ) {
            vt.voteProposalAttributes[_id].voteStatus = 7;
        } else {
            vt.voteProposalAttributes[_id].voteStatus = 3;
        }

      emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_ ,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder();
    }

}