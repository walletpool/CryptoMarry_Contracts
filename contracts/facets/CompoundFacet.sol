// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

/*Interface for the CERC20 (Compound) Contract*/
interface CErc20 {
    function mint(uint256) external;

    function redeem(uint256) external;
}

/*Interface for the CETH (Compound)  Contract*/
interface CEth {
    function mint() external payable;
    function redeem(uint256) external;
}

contract CompoundFacet is ERC2771ContextUpgradeable{
    error COULD_NOT_PROCESS();
    
    constructor(MinimalForwarderUpgradeable forwarder)
        ERC2771ContextUpgradeable(address(forwarder))
        {}

     function executeInvest(
        uint24 _id
    ) external {
       address msgSender_ = _msgSender();
      
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();


        //A small fee for the protocol is deducted here
        uint256 _amount = vt.voteProposalAttributes[_id].amount;
         
        if (vt.voteProposalAttributes[_id].voteType == 203) {
            vt.voteProposalAttributes[_id].voteStatus = 203;

            CEth cToken = CEth(vt.voteProposalAttributes[_id].receiver);
            cToken.mint{value: _amount}();
           emit VoteProposalLib.AddStake(address(this), vt.voteProposalAttributes[_id].receiver, block.timestamp, _amount);
            }
    
    else if (vt.voteProposalAttributes[_id].voteType == 204){
        vt.voteProposalAttributes[_id].voteStatus =204;
     
            CErc20 cToken = CErc20(vt.voteProposalAttributes[_id].receiver);

            TransferHelper.safeApprove(
                vt.voteProposalAttributes[_id].tokenID,
                vt.voteProposalAttributes[_id].receiver,
                _amount
            );
             cToken.mint(_amount);
            }

     else if (vt.voteProposalAttributes[_id].voteType == 205) {
           vt.voteProposalAttributes[_id].voteStatus = 205;
  
            CEth cEther = CEth(vt.voteProposalAttributes[_id].tokenID);

            cEther.redeem(_amount);

        }
        // Redeeming cToken for corresponding ERC20 token.
        else if (vt.voteProposalAttributes[_id].voteType == 206) {
             vt.voteProposalAttributes[_id].voteStatus = 206;

            CErc20 cToken = CErc20(vt.voteProposalAttributes[_id].tokenID);
            cToken.redeem(_amount);

        } else {revert COULD_NOT_PROCESS();}
        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder();
    }


}