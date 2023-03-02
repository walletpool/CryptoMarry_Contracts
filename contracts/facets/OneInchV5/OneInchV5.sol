// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../../libraries/LibDiamond.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "../handlerBase.sol";

contract OneInchFacet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);
    
    address public immutable oneInchRouter;
    
    constructor(MinimalForwarderUpgradeable forwarder, address _oneInchRouter)
        ERC2771ContextUpgradeable(address(forwarder))
        {oneInchRouter = _oneInchRouter;}

    function executeOneInchSwap(
        uint24 _id,
        bytes calldata data
    ) external payable returns (uint256 returnAmount){
       address msgSender_ = _msgSender();   
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 amount = vt.voteProposalAttributes[_id].amount;

        if (vt.voteProposalAttributes[_id].voteType != 135 ) revert COULD_NOT_PROCESS("Not OneINCHtype");
        vt.voteProposalAttributes[_id].voteStatus =135;

         IERC20 srcToken = IERC20(vt.voteProposalAttributes[_id].tokenID);
         IERC20 dstToken = IERC20(vt.voteProposalAttributes[_id].receiver);

           uint256 dstTokenBalanceBefore =
            _getBalance(address(dstToken), type(uint256).max);

             // Interact with 1inch
        if (_isNotNativeToken(address(srcToken))) {
            // ERC20 token need to approve before swap
            _tokenApprove(address(srcToken), oneInchRouter, amount);
            returnAmount = _oneInchswapCall(0, data);
            _tokenApproveZero(address(srcToken), oneInchRouter);
        } else {
            returnAmount = _oneInchswapCall(amount, data);
        }

         uint256 dstTokenBalanceAfter =
            _getBalance(address(dstToken), type(uint256).max);

        if ( dstTokenBalanceAfter - dstTokenBalanceBefore != returnAmount) 
        revert COULD_NOT_PROCESS("Invalid output token amount");
     
     emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            135,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

      /* ========== INTERNAL FUNCTIONS ========== */

   function _oneInchswapCall(uint256 value, bytes calldata data)
        internal
        returns (uint256 returnAmount)
    {
        // Interact with 1inch through contract call with data
        (bool success, bytes memory returnData) =
            oneInchRouter.call{value: value}(data);

        // Verify return status and data
        if (success) {
            returnAmount = abi.decode(returnData, (uint256));
        } else {
            if (returnData.length < 68) {
                // If the returnData length is less than 68, then the transaction failed silently.
                revert COULD_NOT_PROCESS("_oneInchswapCall");
            } else {
                // Look for revert reason and bubble it up if present
                assembly {
                    returnData := add(returnData, 0x04)
                }
                revert COULD_NOT_PROCESS(abi.decode(returnData, (string)));
            }
        }
    }
}

