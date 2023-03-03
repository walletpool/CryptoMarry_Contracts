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

contract ParaSwapFacet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);
    
    address public immutable AUGUSTUS_SWAPPER;
     address public immutable TOKEN_TRANSFER_PROXY;
    
    constructor(MinimalForwarderUpgradeable forwarder, address _AUGUSTUS_SWAPPER,address _TOKEN_TRANSFER_PROXY)
        ERC2771ContextUpgradeable(address(forwarder))
        {AUGUSTUS_SWAPPER = _AUGUSTUS_SWAPPER;
        TOKEN_TRANSFER_PROXY= _TOKEN_TRANSFER_PROXY;}

    function executeParaSwap(
        uint24 _id,
        bytes calldata data
    ) external payable {
       address msgSender_ = _msgSender();   
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 amount = vt.voteProposalAttributes[_id].amount;

        if (vt.voteProposalAttributes[_id].voteType != 143 ) revert COULD_NOT_PROCESS("Not OneINCHtype");
        vt.voteProposalAttributes[_id].voteStatus = 143;

         address srcToken = vt.voteProposalAttributes[_id].tokenID;
         address destToken = vt.voteProposalAttributes[_id].receiver;

           uint256 dstTokenBalanceBefore =
            _getBalance(address(destToken), type(uint256).max);

             // Interact with 1inch
         if (_isNotNativeToken(srcToken)) {
            // ERC20 token need to approve before paraswap
            _tokenApprove(srcToken, TOKEN_TRANSFER_PROXY, amount);
            _paraswapCall(0, data);
        } else {
            _paraswapCall(amount, data);
        }

         uint256 dstTokenBalanceAfter =
            _getBalance(address(destToken), type(uint256).max);

        if (dstTokenBalanceAfter - dstTokenBalanceBefore == 0) 
        revert COULD_NOT_PROCESS("Invalid output token amount");
     
     emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            143,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

      /* ========== INTERNAL FUNCTIONS ========== */

  function _paraswapCall(uint256 value, bytes calldata data) internal {
        // Interact with paraswap through contract call with data
        (bool success, bytes memory returnData) =
            AUGUSTUS_SWAPPER.call{value: value}(data);

        if (!success) {
            if (returnData.length < 68) {
                // If the returnData length is less than 68, then the transaction failed silently.
                revert COULD_NOT_PROCESS("_paraswapCall");
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

