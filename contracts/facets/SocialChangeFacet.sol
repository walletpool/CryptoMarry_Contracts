// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";


contract SocialChange {
    
    /* Changing Address of a Partner who lost account*/

     function executeChangePartnerAddress(
        uint24 _id
    ) external {
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msg.sender);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
      
     vt.voteProposalAttributes[_id].voteStatus = 207;

     require (vt.voteProposalAttributes[_id].votersLeft <= 1, "Threshold not reached");



    emit VoteProposalLib.VoteStatus(
            _id,
            msg.sender,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 
    }

       

}