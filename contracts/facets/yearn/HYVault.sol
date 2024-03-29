// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../../libraries/LibDiamond.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "./IYVault.sol";
import "../handlerBase.sol";


contract YearnFacet is ERC2771ContextUpgradeable, HandlerBase{
    error COULD_NOT_PROCESS(string);

    
    constructor(MinimalForwarderUpgradeable forwarder)
        ERC2771ContextUpgradeable(address(forwarder))
        {}

    function executeYearn(
        uint256 _id
    ) external returns (uint result) {
       address msgSender_ = _msgSender();   
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 _amount = vt.voteProposalAttributes[_id].amount;
        uint256 Before; 
        uint256 After;
        address tokenAddr = vt.voteProposalAttributes[_id].tokenID;
        _amount = _getBalance(tokenAddr, _amount);

     //Depositing token into Yearn
     if (vt.voteProposalAttributes[_id].voteType == 210){
        vt.voteProposalAttributes[_id].voteStatus = 210;

        IYVault yVault = IYVault(vt.voteProposalAttributes[_id].receiver);

        Before =
            IERC20(address(yVault)).balanceOf(address(this));
           
            _tokenApprove(tokenAddr, address(yVault), _amount);

        try yVault.deposit(_amount) {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("deposit");
        }
        _tokenApproveZero(tokenAddr, address(yVault));
        After =
            IERC20(address(yVault)).balanceOf(address(this));     
            }

        //Depositing ETH
        else if (vt.voteProposalAttributes[_id].voteType == 211){
        vt.voteProposalAttributes[_id].voteStatus = 211;

        IYVault yVault = IYVault(vt.voteProposalAttributes[_id].receiver);

        Before =
            IERC20(address(yVault)).balanceOf(address(this));

        try yVault.depositETH{value: _amount}() {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("depositETH");
        }
        After =
            IERC20(address(yVault)).balanceOf(address(this));
            }

        //Withdrawing token
        else if (vt.voteProposalAttributes[_id].voteType == 212){
        vt.voteProposalAttributes[_id].voteStatus =212;

        IYVault yVault = IYVault(vt.voteProposalAttributes[_id].receiver);
          address token = vt.voteProposalAttributes[_id].tokenID;

          Before = IERC20(token).balanceOf(address(this));

        try yVault.withdraw(_amount){} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("withdraw");
        }
        After = IERC20(token).balanceOf(address(this));      
            }

         //Withdrawing ETH
        else if (vt.voteProposalAttributes[_id].voteType == 213){
        vt.voteProposalAttributes[_id].voteStatus =213;

        IYVault yVault = IYVault(vt.voteProposalAttributes[_id].receiver);

        Before = address(this).balance;

         try yVault.withdrawETH(_amount) {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("withdraw");
        }
        After = address(this).balance;              
        }
        
        else {revert COULD_NOT_PROCESS("Not Yearn Type");}
     
     emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder();
        return After - Before;  
    }

}

