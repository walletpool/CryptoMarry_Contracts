// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {VoteProposalLib} from "../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

/*Interface for the CERC20 (Compound) Contract*/
interface CErc20 {
    function mint(uint256) external returns (uint256);

    function redeem(uint256) external returns (uint256);
}

/*Interface for the CETH (Compound)  Contract*/
interface CEth {
    function mint() external payable;
    function redeem(uint256) external returns (uint256);
}


contract CompoundFacet {
    
    /* Uniswap Router Address with interface*/

     function executeInvest(
        uint24 _id
    ) external {

        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess();
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
      
        

        //A small fee for the protocol is deducted here
        uint256 _amount = (vt.voteProposalAttributes[_id].amount *
            (10000 - vt.cmFee)) / 10000;
        uint256 _cmfees = vt.voteProposalAttributes[_id].amount - _amount;

        if (vt.voteProposalAttributes[_id].voteType == 103) {

       VoteProposalLib.processtxn(vt.addressWaveContract, _cmfees);

            CEth cToken = CEth(vt.voteProposalAttributes[_id].receiver);
            cToken.mint{value: _amount}();
            vt.voteProposalAttributes[_id].voteStatus = 103;}
    
    else if (vt.voteProposalAttributes[_id].voteType == 104){
         TransferHelper.safeTransfer(
                    vt.voteProposalAttributes[_id].tokenID,
                    vt.addressWaveContract,
                    _cmfees
                );

            CErc20 cToken = CErc20(vt.voteProposalAttributes[_id].receiver);

            TransferHelper.safeApprove(
                vt.voteProposalAttributes[_id].tokenID,
                vt.voteProposalAttributes[_id].receiver,
                _amount
            );

            cToken.mint(_amount);
            vt.voteProposalAttributes[_id].voteStatus =104;}

     else if (vt.voteProposalAttributes[_id].voteType == 105) {
           
           TransferHelper.safeTransfer(
                    vt.voteProposalAttributes[_id].tokenID,
                    vt.addressWaveContract,
                    _cmfees
                );

            CEth cEther = CEth(vt.voteProposalAttributes[_id].receiver);

            cEther.redeem(_amount);
            vt.voteProposalAttributes[_id].voteStatus = 105;
        }
        // Redeeming cToken for corresponding ERC20 token.
        else if (vt.voteProposalAttributes[_id].voteType == 106) {
             
           TransferHelper.safeTransfer(
                    vt.voteProposalAttributes[_id].tokenID,
                    vt.addressWaveContract,
                    _cmfees
                );

            CErc20 cToken = CErc20(vt.voteProposalAttributes[_id].receiver);

            cToken.redeem(_amount);
            vt.voteProposalAttributes[_id].voteStatus = 106;
        }
    
        
        emit VoteProposalLib.VoteStatus(
            _id,
            msg.sender,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
    }

       

}